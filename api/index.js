// LibreTV Archive Source
// 把 Internet Archive (archive.org) 的影片转成苹果 CMS V10 接口格式，
// 供 LibreTV 在「自定义 API」里直接搜索 / 播放。
// - 列表: /api?ac=videolist&wd=关键词&pg=1
// - 详情: /api?ac=detail&ids=标识符
// 路径无关（LibreTV 不论拼接 provide/vod 与否都能用），只看 query 参数。

const http = require('node:http');

const ARCHIVE_SEARCH = 'https://archive.org/advancedsearch.php';
const ARCHIVE_META = 'https://archive.org/metadata/';
const ROWS = 24;

async function fetchJson(url, ms = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'LibreTV-ArchiveSource/1.0 (+https://github.com/wzrxcp/libretv-archive-source)',
      },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// 从 metadata.files 里挑出可直链播放的视频文件（优先 mp4/m4v，跳过 sample）
function pickVideos(meta) {
  const files = (meta && meta.files) || [];
  const vids = files.filter((f) => {
    const name = f.name || '';
    const fmt = String(f.format || '').toLowerCase();
    if (/sample/i.test(name)) return false;
    if (/\.(mp4|m4v|webm)$/i.test(name)) return true;
    if (/mpeg4|h\.?264|webm/.test(fmt)) return true;
    return false;
  });
  // 体积大的优先（通常是更清晰的版本）
  vids.sort((a, b) => (Number(b.size) || 0) - (Number(a.size) || 0));
  return vids;
}

function buildPlayUrl(id, vids) {
  if (!vids.length) return '';
  return vids
    .map(
      (v) =>
        `Archive$https://archive.org/download/${encodeURIComponent(id)}/${encodeURIComponent(v.name)}`
    )
    .join('#');
}

function cleanText(s) {
  if (!s) return '';
  return String(s)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 600);
}

function thumb(id) {
  return `https://archive.org/services/img/${encodeURIComponent(id)}`;
}

async function handleList(wd, pg) {
  const page = Math.max(1, parseInt(pg, 10) || 1);
  const start = (page - 1) * ROWS;
  // 无关键词时按最新电影返回，有关键词时在 movies 媒体类型里搜
  const query = wd ? `(${wd}) AND mediatype:(movies)` : 'mediatype:(movies)';
  const url =
    `${ARCHIVE_SEARCH}?q=${encodeURIComponent(query)}` +
    `&fl[]=identifier&fl[]=title&fl[]=year&fl[]=description` +
    `&rows=${ROWS}&start=${start}&output=json`;

  const data = await fetchJson(url);
  const docs = (data && data.response && data.response.docs) || [];
  const total = (data && data.response && data.response.numFound) || docs.length;

  const list = docs.map((d) => ({
    vod_id: d.identifier,
    vod_name: d.title || d.identifier,
    vod_pic: thumb(d.identifier),
    vod_year: d.year || '',
    vod_remarks: 'Archive',
    vod_content: cleanText(d.description),
    type_name: '电影',
  }));

  return { code: 1, msg: 'ok', list, total: String(total) };
}

async function handleDetail(ids) {
  const idList = String(ids || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const list = [];

  for (const id of idList) {
    try {
      const meta = await fetchJson(ARCHIVE_META + encodeURIComponent(id));
      const vids = pickVideos(meta);
      const md = (meta && meta.metadata) || {};
      list.push({
        vod_id: id,
        vod_name: md.title || id,
        vod_pic: thumb(id),
        vod_year: md.year || '',
        vod_remarks: vids.length ? `${vids.length} 个视频` : '无播放源',
        vod_content: cleanText(md.description),
        vod_play_url: buildPlayUrl(id, vids),
        type_name: '电影',
      });
    } catch (e) {
      list.push({
        vod_id: id,
        vod_name: id,
        vod_pic: thumb(id),
        vod_remarks: '获取失败',
        vod_play_url: '',
      });
    }
  }

  return { code: 1, msg: 'ok', list, total: String(list.length) };
}

async function handler(req, res) {
  const u = new URL(req.url, 'http://localhost');
  const p = u.searchParams;
  const ac = (p.get('ac') || 'videolist').toLowerCase();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  try {
    const out =
      ac === 'detail'
        ? await handleDetail(p.get('ids') || '')
        : await handleList(p.get('wd') || '', p.get('pg') || '1');
    res.end(JSON.stringify(out));
  } catch (e) {
    res.end(JSON.stringify({ code: 0, msg: 'error: ' + e.message, list: [], total: '0' }));
  }
}

module.exports = handler;

// 本地直接运行：node api/index.js 起一个 HTTP 服务
if (process.env.VERCEL !== '1' && require.main === module) {
  const port = process.env.PORT || 3000;
  http.createServer(handler).listen(port, () => {
    console.log(`LibreTV Archive Source 已启动: http://localhost:${port}`);
    console.log(`试一下: http://localhost:${port}/api?ac=videolist&wd=cat`);
  });
}
