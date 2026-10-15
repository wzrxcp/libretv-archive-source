# LibreTV Archive Source

把 [Internet Archive](https://archive.org) 上的公有领域 / 开放授权影片，转成 **苹果 CMS V10** 接口格式，
这样 [LibreTV](https://github.com/LibreSpark/LibreTV) 就能把它当作「自定义 API」直接搜索、播放。

> 内容来自 archive.org（含大量公有领域老电影、纪录片、动画短片、Blender 开放电影等）。
> 本服务只是把公开检索结果按标准格式转发，**不含任何盗版采集源**。

## 接口（路径无关，只看 query）

- 搜索 / 列表：`/?ac=videolist&wd=关键词&pg=1`
- 详情（拿播放地址）：`/?ac=detail&ids=标识符`

返回标准苹果 CMS V10 JSON：

```json
{
  "code": 1,
  "msg": "ok",
  "list": [
    {
      "vod_id": "BigBuckBunny",
      "vod_name": "Big Buck Bunny",
      "vod_pic": "https://archive.org/services/img/BigBuckBunny",
      "vod_year": "2008",
      "vod_remarks": "Archive",
      "vod_content": "…简介…",
      "vod_play_url": "Archive$https://archive.org/download/BigBuckBunny/BigBuckBunny.mp4"
    }
  ],
  "total": "123"
}
```

`vod_play_url` 多集/多版本用 `#` 分隔：`源名$地址#源名$地址`。

## 本地运行

```bash
npm install
npm start
# 打开 http://localhost:3000/api?ac=videolist&wd=cat
```

## 部署到 Vercel（推荐，免费）

1. 把这个仓库推到你的 GitHub。
2. 在 Vercel 导入该仓库（默认会识别 `api/index.js` 为 Serverless Function）。
3. 部署后得到地址，例如 `https://your-app.vercel.app`。

或者点一键部署（替换为你自己的仓库地址）：

```
https://vercel.com/new/clone?repository-url=https://github.com/你的用户名/libretv-archive-source
```

## 在 LibreTV 里配置

1. 打开 LibreTV 的「设置 → 数据源 / 自定义 API」。
2. API 类型选 **苹果 CMS V10**。
3. API 地址填：`https://你的部署地址/api`
   （若播放页拉不到源，可试 `https://你的部署地址/api/provide/vod`）
4. 保存后搜索即可看到 archive.org 的影片，点开直接播。

## 在 LibreTVCast（电视 App）里配置

电视 App 首次打开会让你填 LibreTV 的 URL（即上面配好数据源的 LibreTV 实例地址）。
把「已配好 Archive 数据源」的 LibreTV 实例地址填进去即可。

## 说明 / 局限

- archive.org 对高频请求有限流，个人使用足够；公开大规模使用可能被限流。
- 部分条目只有 `.ogv/.avi` 等非 mp4 格式会被跳过，可能显示「无播放源」。
- 搜索结果偏向 archive.org 的 `movies` 媒体类型，以老片/纪录片/动画为主。
