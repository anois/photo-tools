<div align="center">

<img src="public/logo.svg" width="84" alt="photo-tools logo" />

# photo-tools

**给照片套上磨砂玻璃相框 — 浏览器内渲染，无需服务器。**

[![在线 Demo](https://img.shields.io/badge/在线_demo-anois.github.io%2Fphoto--tools-e5493a?style=flat-square)](https://anois.github.io/photo-tools/)
[![国内镜像](https://img.shields.io/badge/国内镜像-阿里云_OSS-e5493a?style=flat-square)](https://photo-tools.oss-cn-hangzhou.aliyuncs.com/)
[![无构建步骤](https://img.shields.io/badge/build-vanilla_HTML/JS-1d2329?style=flat-square)](#技术栈)
[![Node](https://img.shields.io/badge/node-%3E%3D18-1d2329?style=flat-square)](#快速开始)
[![源码](https://img.shields.io/badge/source-github-1d2329?style=flat-square&logo=github)](https://github.com/anois/photo-tools)

中文 · [English](README.md)

</div>

一个纯前端单页应用，把照片包进"磨砂玻璃"相框 —— 自己模糊后的背景 + 圆角前景 + 带品牌 logo 的 EXIF 字幕。拖入照片、选风格、导出。全程在浏览器里跑，不上传、无后端。

```
   ┌─────────────────────┐
   │ ░░░░░░░░░░░░░░░░░░ │
   │ ░ ┌──────────────┐ ░ │       自己当背景模糊
   │ ░ │              │ ░ │       + 圆角前景
   │ ░ │    photo     │ ░ │       + EXIF 字幕
   │ ░ │              │ ░ │
   │ ░ └──────────────┘ ░ │
   │   FUJIFILM  X-T5    │
   │   46mm  F4.5  1/210s │
   └─────────────────────┘
```

## 🤖 由 Claude Code 维护

本项目完全由 [Claude Code](https://claude.com/claude-code) 自主迭代维护 —— 没有人类提交者，全部代码、文档、CHANGELOG 都由 AI agent 在维护流水线里产出。

- **想要新功能 / 提 bug / 有点子？** 提一个 [GitHub Issue](https://github.com/anois/photo-tools/issues/new) 就行，几句话描述你想要什么即可。
- **怎么上线**：我们会定时捞取 Issue 中合理的需求，丢给 Claude Code session 自动实现 + 自测 + 写 CHANGELOG，再走 GitHub Pages + 阿里云 OSS 镜像自动部署。
- **追踪每次更新**：每条改动都记到 [`public/CHANGELOG.md`](public/CHANGELOG.md)。应用顶栏的 ✦ pill 直接弹出更新日志，遇到你还没看过的版本会有小红点提示。

## 特性

- **4 个家族 · 7 个精选相框风格** — 编辑（`frosted-noir` 深色毛玻璃自我磨砂）/ 画廊（`gallery-white` 双层细线衬纸）/ 即影（`instax` 即拍即得底部宽边 / `torn` 程序化撕纸边缘）/ 胶片（`film-35` 齿孔+leader stamp / `film-mf` 银盐暗房印品 / `slide-mount` 装裱幻灯片：酒红外圈 + 仿皮革乳白卡纸 + 照片凹陷感）。0.22 从 12 砍到 6，每个保留下来的都是高度调优过的出品
- **顶部品牌标记** — `cfg.topTemplate` 在任意相框上方留白处加一行品牌身份标记：**品牌·型号**（FUJIFILM · X-T5）/ **品牌**（仅 logo）/ **字标**（大号纯字，复刻 Kodak Professional 那种字标语言）
- **4 个语法 · 11 种字幕模板** — Spec（minimal-text、tech-stack、**spec-grid** Hasselblad 描边胶囊、**spec-rail** Leica 侧栏胶囊）/ Brand（brand-logo、brand-right）/ Editorial（wordmark 大字字标、headline GPS+日期标题）/ Stamp（date-lens、slate OSD 字段格、passport 邮印戳）
- **真实品牌 logo 内嵌** — Fujifilm、Sony、Leica、Nikon、Canon、Apple、Xiaomi、OPPO、Vivo、DJI…（来自 Wikimedia Commons + simple-icons）
- **EXIF 自动解析**，每张照片可独立手动覆盖；当 `LensModel` 缺失时用 `LensInfo` 数组反推镜头型号
- **自定义签名水印** — 上传 SVG/PNG 钉在前景照片的某个角落；通过 `localStorage` 跨会话保留
- **自定义背景图** — 把 frosted 相框的自我磨砂背景源换成任意图片（仅对毛玻璃风格生效）
- **LOOK 一级入口** —— 左轨 dashed 边框的 LOOK 区块就是整个预设库的单击入口。点开 → 风格库 picker 弹出：上半 4 列网格陈列 **5 个调到位的 ✦ 精选预设**（✨ 夜色毛玻璃 · 📜 撕纸 · 🎞 35mm 胶卷 · 📽 银盐印品 · 🎞 幻灯片），下半是「我的预设」列表，底部固定 ✚ 保存 / ↗ 分享 / ⎘ 粘贴 三个操作。当应用某个预设之后调任何 cfg 字段，LOOK chip 右上角会出现 accent 红呼吸点，提醒"已偏离这个 look，要不要保存为新的"
- **一键分享 / 粘贴 look** —— 把当前 look 编成 `#p=<code>` URL 复制走，或从剪贴板粘贴别人的链接 / 分享码直接应用，都在 picker 底部
- **水印嵌入图片 · 高度可调** —— 开启「水印嵌入图片」后水印盖在照片上（35mm 真实底片观感），新滑块控制水印离底边的距离（0–120px），半透明渐变背景仍贴底但文字基线在渐变内向上抬
- **DIY 渲染引擎** —— 圆角 / 水印嵌入图片 / 水印高度 / 撕纸抖动密度暗边 / 顶部标记 picker，全部加入控件区；精选预设里所有动到的渲染参数，用户都能直接在 UI 上独立调，方便基于种子继续衍生
- **支持 HEIC / HEIF 输入** — iPhone 照片直接拖入即用，浏览器内通过懒加载的 libheif-js 转码（首次遇到 HEIC 才下载）
- **拼贴模式** — 2–4 张照片套同一个相框：左右、上下、1×3 / 3×1 横排、2×2 田字格
- **90° 旋转 + 自由裁剪** — 每张照片独立、渲染时应用（不重新编码源图，完全可逆）
- **GPS 坐标** — 字段开关（默认关闭，避免误公开），开了之后字幕带十进制经纬度。源图没 GPS？EXIF 面板末尾两个 lat/lon 输入框可以手填，或点 **📍 在地图上选** 弹出 Leaflet + 高德地图选点 modal（首次打开懒加载约 165KB；OSM 在国内被墙，所以默认走高德可达的瓦片源）。Leaflet 边界两侧自动做 GCJ-02 ↔ WGS-84 火星坐标校正，存到 EXIF 的永远是标准 WGS-84，国境外是 no-op。导出时即使源图原本没 EXIF 也会合成一段 GPS IFD 写到成品 JPEG 里
- **可安装 PWA** — service worker 预缓存整套 SPA shell，首次访问后完全离线可用
- **实时预览** 走 Canvas2D + GPU 的 `ctx.filter` blur，不走服务端往返
- **单张 + 批量导出** 都保留源图 EXIF（Make / Model / 焦距 / 光圈 / 快门 / ISO / 镜头 / 日期 / GPS）
- **Web Worker 池** 把批量渲染挪出主线程
- **中英双语 UI** — 顶栏一键切换；首次访问按浏览器语言自动选择，并通过 `localStorage` 记住选择
- **桌面 / 移动端各自原生交互** — 不是把同一份界面缩放到两端，而是分别用各自惯用的手势语法：
  - **桌面端**：左侧可折叠侧栏 + 52px 垂直 activity bar（`a–g` tile、accent 竖条 active 标记、虚线 film-leader 脊）、`[` 折叠 / 展开、`⌘1–7` 跳章节、按住 `Space` 看原图（Photoshop / Lightroom 惯例）、缩略图右键弹"把这张相框 / EXIF 应用到全部"+"移除"菜单
  - **移动端 (≤768px)**：拇指区 Export dock 固定屏底（52pt 主 CTA、安全区感知）、canvas 横滑切上 / 下一张、长按 0.5 秒看原图、缩略图长按弹同一份菜单、更新日志 modal 走 iOS 风格 bottom sheet 上滑 + 顶部拖拽 handle

## 效果预览

来自实际渲染管线的两张样张：

<table>
  <tr>
    <td width="50%"><img src="data/00010_preview.jpg" alt="咖啡馆墙面 — frosted-noir 相框 + 单行字幕" /></td>
    <td width="50%"><img src="data/00012_preview.jpg" alt="工业建筑暮光 — frosted-noir 相框 + 多行参数堆叠字幕" /></td>
  </tr>
  <tr>
    <td align="center"><sub><b>frosted-noir</b> · <b>minimal-text</b><br/>FUJIFILM X-M5 · 27mm F1.6 1/100s ISO4000</sub></td>
    <td align="center"><sub><b>frosted-noir</b> · <b>tech-stack</b><br/>FUJIFILM X-M5 · SIGMA 18-50mm F2.8 · 2026.02.21</sub></td>
  </tr>
</table>

<sub>上面是 480px 预览，全分辨率成品（`data/*_framed.jpg`）和原图都放在 [`data/`](data/) 目录下，方便对照。</sub>

## 快速开始

```bash
git clone https://github.com/anois/photo-tools.git
cd photo-tools
npm install
npm run build       # 生成 logos.json + fonts.css
npm run dev         # → http://localhost:3000
```

打开浏览器、拖入照片、调参、导出。就这样。

## 工作原理

```
┌──────────────────────────── 浏览器标签页 ────────────────────────────┐
│                                                                      │
│  index.html → <script> 第三方库 (exifr, piexif, jszip)              │
│             → <script> shared/render.js   (布局 + 相框 + 字幕 SVG)   │
│             → <script> exifio.js          (解析 + 写回 JPEG EXIF)    │
│             → <script> clientRender.js    (Canvas 合成管线)          │
│             → <script> exporter.js        (单张 + 批量 + ZIP)        │
│             → <script> app.js             (UI + 每张照片的 cfg)      │
│                                                                      │
│  启动时 fetch: logos.json (~60KB)  +  fonts.css (~870KB Inter base64)│
└──────────────────────────────────────────────────────────────────────┘
```

单一共享模块 [`public/shared/render.js`](public/shared/render.js) 持有所有的布局数学、相框定义、字幕 SVG 构造、模板渲染逻辑。屏幕预览和高分辨率导出走同一份代码路径，区别只在 canvas 尺寸。

更详细的架构文档见 [CLAUDE.md](CLAUDE.md)。

## 项目结构

```
photo-tools/
├── public/                 ← 部署产物（无构建步骤）
│   ├── index.html
│   ├── app.js              ← UI 接线 + 每张照片的 cfg 状态
│   ├── shared/render.js    ← 布局 + 相框 + 字幕 SVG（唯一源）
│   ├── clientRender.js     ← Canvas2D 合成管线（预览 + 导出）
│   ├── exifio.js           ← EXIF 解析 (exifr) + JPEG 重新写回 (piexifjs)
│   ├── exporter.js         ← 单张 + 批量导出 + ZIP 打包
│   ├── worker.js           ← 批量渲染的 worker 实现
│   ├── progressModal.js    ← <dialog> 进度框控制
│   ├── i18n.js             ← 中英文字典 + 语言切换
│   ├── styles.css
│   ├── logo.svg            ← 项目 logo（favicon + README 头图）
│   ├── vendor/             ← exifr、piexif、jszip（vendored，不走 CDN）
│   ├── logos/*.svg         ← 品牌 logo 源 SVG（Wikimedia + simple-icons）
│   ├── fonts/*.ttf         ← Inter Regular + SemiBold
│   ├── logos.json          ← 由 logos/*.svg 构建生成
│   └── fonts.css           ← 由 fonts/*.ttf 构建生成
├── scripts/
│   ├── build-logos.js      ← logos/*.svg  → logos.json
│   ├── build-fonts.js      ← fonts/*.ttf  → fonts.css
│   └── fetch-logos.sh      ← 从 Wikimedia Commons / simple-icons 抓取
└── data/                   ← 参考图（输入 + 成品）
```

## 部署

`public/` 目录就是完整的部署产物 —— 不转译、不打包。任何静态托管都能用。

**GitHub Pages**（线上：[anois.github.io/photo-tools](https://anois.github.io/photo-tools/)，免费）：

工作流文件在 [.github/workflows/deploy.yml](.github/workflows/deploy.yml)。每次 push 到 `main` 自动触发：装依赖 → `npm run build` → 上传 `./public/` → 发布。也可以在 **Actions** 页面手动重跑。

**一次性配置**：仓库 Settings → Pages，把 **Source** 设成 `GitHub Actions`。

**其它平台**（S3 + CloudFront、Cloudflare Pages、Netlify、Vercel…）：思路一样，跑 `npm run build` 后把 `public/` 指给它们。

### 国内访问镜像（阿里云 OSS）

GitHub Pages 在大陆访问偶尔慢、偶尔不通。同一份 `public/` 产物会同步到阿里云 OSS（华东1 杭州，未备案）作国内访问入口：

```
https://photo-tools.oss-cn-hangzhou.aliyuncs.com/
```

部署 job（[deploy.yml](.github/workflows/deploy.yml) 里的 `deploy-oss`）跟 GitHub Pages job **并行**跑 —— 一边挂了不影响另一边。

**首次配置**（OSS 首次部署前需要做）：

1. **创建 Bucket**：OSS 控制台 → 创建 Bucket
   - 区域：`oss-cn-hangzhou`（也可以选其它大陆区）
   - 读写权限：**公共读**（`public-read`）
   - 进入 Bucket → 静态网站设置，默认首页填 `index.html`
2. **创建 RAM 子用户**：RAM 控制台 → 用户 → 创建用户 `photo-tools-deploy`
   - 访问方式：**OpenAPI 调用访问**
   - 单独创建一个仅作用于该 bucket 的最小权限策略：
     ```json
     {
       "Version": "1",
       "Statement": [{
         "Effect": "Allow",
         "Action": ["oss:PutObject", "oss:DeleteObject", "oss:GetObject", "oss:ListObjects"],
         "Resource": ["acs:oss:*:*:photo-tools", "acs:oss:*:*:photo-tools/*"]
       }]
     }
     ```
   - 保存好 AccessKey ID 和 Secret（**只显示一次**）
3. **添加 GitHub Secrets**（Settings → Secrets and variables → Actions → New secret）：
   - `ALIYUN_ACCESS_KEY_ID`
   - `ALIYUN_ACCESS_KEY_SECRET`
   - `ALIYUN_OSS_BUCKET` = `photo-tools`
   - `ALIYUN_OSS_ENDPOINT` = `oss-cn-hangzhou.aliyuncs.com`
4. **添加一个 repo variable** 来开启 OSS 部署：
   - Settings → Secrets and variables → Actions → **Variables** → `ENABLE_OSS_DEPLOY` = `true`

**注意**：阿里云大陆区直连 OSS 域名（`*.oss-cn-<region>.aliyuncs.com`）作为面向终端用户的站点访问时，由于域名未 ICP 备案，偶尔会被插入安全提示页或限流。个人小流量使用一般没问题。如果触发，可降级到：

- **香港区**（`oss-cn-hongkong.aliyuncs.com`）—— 不需备案、无安全检查页，但延迟略高（大陆 ping 50–100ms）
- **自定义域名 + 阿里云 CDN**（需 ICP 备案，7–20 工作日）—— 长期最佳的国内访问体验

## 技术栈

- **原生 HTML/JS** —— 无框架、无转译、运行时无构建管线
- **CommonJS** —— [`public/shared/render.js`](public/shared/render.js) 是 UMD 模块，同一份源文件既能在浏览器跑，也能在 Node 端通过 `require()` 做即兴渲染冒烟检查
- **Canvas2D + WebWorker** —— `createImageBitmap` 解码、`ctx.filter='blur()'` 做磨砂背景、`ctx.drawImage` 合成、`OffscreenCanvas.convertToBlob` 编码
- **Vendored 依赖** —— [exifr](https://github.com/MikeKovarik/exifr)、[piexifjs](https://github.com/hMatoba/piexifjs)、[JSZip](https://stuk.github.io/jszip/) —— 不依赖 CDN

## 添加品牌 logo

1. 把 `public/logos/<品牌-slug>.svg` 放进去（推荐 Wikimedia 多色版；simple-icons 单色版也支持）
2. `npm run build-logos`
3. 刷新浏览器即可。如果 EXIF 的 `Make` 字段跟 slug 不直接匹配，去 [`public/shared/render.js`](public/shared/render.js) 的 `ALIASES` 里加一条映射

## 添加相框 / 模板 / 长宽比

参考 [CLAUDE.md](CLAUDE.md#extending) 的 **Extending** 节 —— 各自有简短的 step-by-step 说明。

## 个人使用声明

这是一个个人照片工具。打包的第三方资产（品牌 logo、Inter 字体）用于个人照片合成；不分发、不商用。Bug 报告和渲染质量优先于法律层面的过度顾虑。

---

<div align="center">
<sub><a href="https://github.com/anois/photo-tools">github.com/anois/photo-tools</a></sub>
</div>
