# 更新日志 / Changelog

> 本项目完全由 [Claude Code](https://claude.com/claude-code) 自主迭代维护。提需求 / 报 bug 请提交 [GitHub Issue](https://github.com/anois/photo-tools/issues/new)，我们会定时捞取合理的请求走流水线自动上线。

每次有意义的功能 / 修复 / 优化都记到这里 —— 同一份文件既给开发者看，也通过顶栏 ✦ 按钮在应用内展示给用户。

## 0.7 · 2026-05-07

### 🧭 桌面侧栏重构

- **顶端横排 A-G 按钮整体移除，左侧加一根 52px 宽的活动栏（activity bar）** — 之前 7 个章节导航是 pane 内顶端的 sticky 横条，被反馈"丑陋"且密度低、占内容垂直空间。重做为 VSCode/Linear 风格的垂直 activity bar，常驻在 pane 左侧最外层。每个 tile 是 40×40 圆角方块、Fraunces 小写字母 a-g（lowercase serif 在 darkroom 调子里更有性格）、active 态贴左缘 3px 红色竖条 + accent glow，hover 200ms 后右侧弹出 mono caps tooltip。tile 之间一根 1px 虚线"film leader"竖脊连接 tile 中心，呼应胶卷胎记
- **侧栏可折叠为只剩 activity bar** — 顶部新增 32×32 chevron 折叠开关，点击/`[` 键切换。展开态 412px（52 activity + 360 controls）、折叠态仅 52px。canvas 抢占空出来的 360px。`workspace[data-pane-collapsed]` 驱动 CSS 用 220ms `cubic-bezier(.4, 0, .2, 1)` 平滑动画 grid-template-columns。折叠状态 localStorage 持久化（`phototools.paneCollapsed`），下次打开还是上次的样子。折叠时点任意 tile = 自动展开 + 跳到该章节
- **桌面键盘语法**：`[` 折叠/展开侧栏 · `⌘1-7` 跳到 A-G 章节（之前只能滚轮翻找）。状态栏的快捷键提示同步更新
- **章节标题改成印刷标签风格** — 不再是 "A 原图" 加红色徽章，而是裸 "原图" 用 mono caps + 0.2em 字距 + 底部 1px hairline 横线，像暗室设备面板上的丝印标签。letter 由 activity bar 承担，省掉重复语义

### 🐛 修复 + 📱 移动端

- **更新日志滚动条彻底隐藏** — 上一轮换皮 / 移除 mask-image 之后，macOS "始终显示滚动条" 偏好下仍会冒一根 14px 灰条。原因：之前是"换更细的皮"，但定制皮在系统强制 always-show 偏好下仍以原生宽度渲染。本轮改成**完全隐藏**滚动条（`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`），靠已有的顶/底渐隐 mask 单独承担"还有内容"的视觉信号；同时去掉 `scrollbar-gutter: stable` 让渐隐 mask 恢复全宽（之前为了给滚动条让位收了 12px）。验证：3 档视口下 `body.offsetWidth - body.clientWidth === 0`
- **更新日志在手机上变 bottom sheet** — 之前在手机上仍是居中卡片 modal，宽度紧、关闭 X 在右上角拇指够不到、纯居中淡入与 iOS 系统视觉语言完全脱节。现在 ≤768px 视口自动切换：从底部弹起的全宽 sheet（`max-height: 92dvh` + `cubic-bezier(0.32, 0.72, 0, 1)` 320ms 上滑动画 — iOS 系统 sheet easing），顶部一根 36×4 拖拽 handle pill 提示可关闭，关闭按钮挪到**左**上角（拇指自然区，对应 iOS Mail / Notes 阅读型 modal 惯例）。桌面端保持原居中卡片不变
- **点击 modal 背景关闭** — Esc 在桌面好用、在手机不存在；现在点击 dialog 背景区域（内容卡片之外）也能关，桌面顺带受益。配合可见的关闭按钮，符合移动端 modal 的双重 dismiss 惯例

### 🐛 修复

- 更新日志右侧仍显示 macOS 原生粗灰滚动条 — 上一轮以为换皮肤就够了，实际是 `mask-image` 的副作用：WebKit 在被 mask 的滚动元素上会**回退到 OS 默认 overlay 滚动条**，自定义 `::-webkit-scrollbar` 被无视。修法把渐隐效果从 `.changelog-modal-body` 上拿掉，改用 `.changelog-modal-inner::before/::after` 两条 22px 高的绝对定位渐变盖在 body 上方/下方，body 自己只剩 `scrollbar-gutter: stable`，自定义滚动条恢复生效。验证：`offsetWidth - clientWidth` 从 0 变 11px 即定制条占位

### 🧭 区段导航 + 错误可见性 (Section nav & error visibility)

- **左栏顶部加 A · B · C · D · E · F · G 跳转条** — 7 个段以前只能滚轮翻找，现在顶部一排 sticky 字母 pill，点击平滑滚动到对应段，IntersectionObserver-style 滚动监听让"当前段"的字母自动高亮 accent。同时区段标题里的 A/B/C 红色徽章修了 `flex: 1` 把它撑开成红条的 bug，现在稳稳是 22×22 圆角方块（之前 18×18 + accent-line 描边）
- **错误状态状态栏看得见了** — `.statusbar.err` 之前红字红点对比度太低，用户根本察觉不到出错。重做：(1) 状态栏顶边变成 1px accent 红线；(2) 左侧 280px 渐隐红色 wash；(3) 状态点改成红色小方块 + 0.9s 脉冲；(4) 文字改 `#ff7a6c`（比 `--accent` 稍亮，在 bg-chrome 上对比度 5+）+ 600 字重；(5) 进入 err 态时 600ms 红色背景闪烁后退到稳态。和暗房"录制中 / 警报"指示灯一个语义
- **裁剪 modal 三按钮统一形态** — 之前 重置 / 取消 是 mono-caps 小 ghost 按钮、应用 是大红填充，三个不等高不同字号。新增 `.btn-secondary`（透明底 + line 边框 + UI 字 + center justify），重置/取消/应用 现在共用 `.btn` 基础尺寸，主次层级靠填充色区分（应用红填、重置/取消透明），符合标准三档按钮约定
- **滚动条可见度提升** — Changelog 那条之前用 `--line`（rgba 7%）太隐，看起来像默认 macOS 灰条。现在 thumb 提到 `--line-strong`（rgba 13%）+ 宽度 8→10px，4 个滚动容器（`.pane-controls` / `.rail-items` / `.changelog-modal-body` / `.export-errors`）一致

### 📜 弹窗与滚动条统一 (Modal & scrollbar polish)

- **三个 modal 统一一种关闭按钮** — 之前 crop 用圆形 X、changelog 用方形 ghost+`×` 字符、export 用文字按钮 `关闭`，三套并存。统一抽出 `.modal-x` 圆形 X 图标按钮（28px 圆 + accent-line hover + focus-visible 红色光晕），三个 modal 都用同一份
- **更新日志可读性大改** — 之前列表条目太挤、`<code>` 内联标签基线偏、滚动条是默认 macOS 灰条。现在：(1) `<li>` 之间加 9px gap + 行高 1.65 + 红色小方块 marker（替换默认 disc 圆点）；(2) 顶部 / 底部 mask-image 渐隐 18px，长内容滚动时不再"硬切到 modal 头/尾"；(3) 段落间距、版本块红色下划线分隔更明显；(4) `<code>` 行内代码 `vertical-align: 1px` 修基线、`white-space: nowrap` 防止换行；(5) 字体提到 14px / 1.65，中文阅读更舒服
- **统一暗房风格滚动条** — `.changelog-modal-body` / `.export-errors` 之前没有 `::-webkit-scrollbar` 样式，浏览器吐默认条；现在和 `.pane-controls` / `.rail-items` 共用同一份："非活动状态几乎不可见 / hover 高亮 accent-line"，4 个滚动容器视觉一致。Firefox 走 `scrollbar-color` 同步

### ✨ UI 细节打磨 (UI polish pass)

- **导出进度条改用主题红色** — 之前批量导出弹窗的进度条用蓝色 `#5b8def → #7aa3ff` 渐变，是全 UI 唯一一处偏离暗房红的地方，最有仪式感的瞬间反而最跳。改成 `--accent → #f05a4b` 红色渐变 + accent glow，错误列表也从桃色 `#ffa67a` 统一为 `--accent`
- **分段控件激活态更显眼** — `.seg button.active` 之前是红字（contrast ~3.6:1，11px 偏弱），改成白字 + 600 字重 + 底部 2px 红色 inset 标记，读起来像真实的机械键 / tab 高亮
- **Slider thumb 全局统一** — 之前裁剪 modal 用白边红心、主面板用灰白圆点，同一控件两套外观。统一成 12px 红心 + 2px 白边 + accent glow，focus-visible 时外扩 4px accent-soft 光晕
- **Select 用真正的 SVG 雪佛龙** — 替换掉用两个线性渐变拼出来的 X 形 chevron，inline SVG 三态（默认 dim / hover muted / focus accent）
- **数值与单位视觉分层** — Padding / Caption height / Shadow blur·offset / Signature size·opacity 等读数把单位（PX / %）拆出来用更小、更暗的字号，"70 px" 变成强调数字 + 弱化单位，更像仪表盘读数
- **Disabled 按钮不再隐形** — 未导入照片时 Export current / Batch · ZIP 透明度从 0.4 提到 0.55，首屏就能看见这两个功能存在
- **Chip 键盘焦点态** — Show fields 段的复选 chip 现在键盘 Tab 切到时有 accent-line 边框 + 光晕，不再"切到了不知道"
- **品牌点慢呼吸** — 顶栏左上的红点之前永远静态，加了 4.5s 呼吸（5px → 11px glow），让首屏不那么死板。`prefers-reduced-motion` 下自动停
- **Crop modal Apply 主按钮加重** — 比 Reset / Cancel 略大、字重 600、accent glow，主路径不再被同高 ghost 按钮淹没
- **状态栏文字按 locale 大写** — EN locale 下 mono-caps + 字距，与 brand-sub / sec-head / kbd 统一；zh-CN locale 下保持原样（中文不能 uppercase）
- **`<i>A/B/C…</i>` 改 `<span class="sec-mark">`** — 区段编号徽章原来用 `<i>` 标签 + `font-style: normal` 反着用，屏幕阅读器会读成"重点：A"。改成语义中性的 span
- **杂项**：Frame badge 与 preview-loading 标签风格统一（都用 3px 方块 + 同一 backdrop blur）；裸 `rgba(229, 73, 58, …)` 字面量全部抽成 `--accent-wash` / `--accent-vignette` 变量；Update banner 删掉重复的 1px outer shadow；preview-canvas 背景 `#101115` 改用 `--bg-canvas` 变量

## 0.5 · 2026-05-07

### 🌀 旋转 & 裁剪 (Rotate & crop overhaul)

- **旋转改为任意角度** — `cfg.rotation` 从 0/90/180/270 整数升级为 [0, 360) 浮点数，渲染管线（前台 + worker）的 fg 与 frosted bg pass 全改用 transform composition（`drawRotatedCroppedSrc`）。0°、90°、30°、−15.5° 走同一份代码路径
- **旋转控件并入裁剪 modal** — B · Frame 段不再有独立的 ↶ ↷，改为单按钮 "裁剪 & 旋转…"。打开 modal 后 stage 上方多一条旋转工具栏：↶ 90° 步进 / 滑块（−180° → +180°，0.5° 步精度）/ ↷ 90° 步进 / 实时角度读数 / 归零按钮。slider 拖动实时同步主预览 + modal 画布 + 顶栏的 frame badge
- **B · Frame 几何摘要** — "Crop & rotate…" 按钮上方新增一行 mono-caps 读数（如 `−15.5°　·　已裁剪`），让用户在不打开 modal 的情况下也知道当前几何状态
- **旋转永远不留黑边** — 裁剪坐标改为内接 safe area 归一化（参考 Lightroom / iOS Photos straighten preview）。`R.inscribedSafeArea(bm, rot)` 返回旋转源里能内接的最大 AABB（aspect 跟随旋转 bbox），在 0/90/180/270° 时正好等于完整旋转源（无内容损失），其它角度平滑收缩以排除透明角落。modal 画布尺寸也跟着 safe area 走，旋转 slider 拖动时图片在画布里"放大居中"，永远是干净的矩形预览

### 🐛 修复

- 比例锁定按钮重复点击越裁越小 — `refitRectToAspect` 之前是"在前一个 rect 内 fit"，每次都基于上一帧缩水。改成"在原图内最大 fit + 居中"，每次点击都从原图算起。1:1 → 3:4 → 1:1 现在每次都给出同一个最大 1:1 框
- 阿里云 OSS 镜像上 PWA manifest 失效 — Aliyun OSS 默认 MIME 表里没有 `.webmanifest`，回退成 `application/octet-stream`，浏览器拒认 manifest，PWA 安装、theme color、standalone 模式全失效。改名 `manifest.webmanifest` → `manifest.json`，OSS 推断为 `application/json`（W3C manifest 规范接受），同时更新 HTML link 引用、SW 预缓存列表，bump CACHE_VERSION → v5 让现有 PWA 装机自动收到新 shell
- 浏览器缓存导致用户卡在旧版本 — 之前 SW 整体走 stale-while-revalidate，HTML 也是先吐缓存后台刷新，意味着用户回访第一次还是看到旧版，得**第二次访问**才会被升级 banner 通知。重做缓存策略：(1) SW 拆两条路径 —— navigation 走 **network-first**（在线时永远拿最新 HTML，offline 才 fallback），其它资源继续 SWR；(2) SW 内所有 `fetch` 都加 `cache: 'reload'` 绕过浏览器 HTTP cache，让 SW 成为唯一权威缓存层；(3) SW 注册参数 `updateViaCache: 'none'`，浏览器更新 SW 文件本身时也跳 HTTP cache；(4) OSS 部署 workflow 显式设 `htmlCacheControl: 'no-cache'` + `otherCacheControl: 'public, max-age=86400'`（1 天，原默认 30 天太久）。CACHE_VERSION → v6。net 效果：deploy 落地后用户首次回访就看到新版，往返不超过几秒

## 0.4 · 2026-05-06

### 🪞 交互打磨 (Interaction polish)

- **裁剪 modal 重做** — 比例锁定段（自由 / 当前画幅 / 1:1 / 3:4 / 9:16 / 16:9）；rect 内置 rule-of-thirds 网格（拖拽时自动显现）；底栏读数同时给 % / 像素 / 比例三套；handle hit 区域放大（视觉小、命中区大）；modal 整体放宽到 960px、加 darkroom 风格红色 vignette
- **旋转视觉反馈** — 每次点 ↶ ↷ 时，预览中央闪一个 "↻ 90°" / "↺ 270°" 红色 pill（~700ms），不再"按了好像没反应"
- **画布常驻 frame badge** — 预览左上角悬浮 mono-caps 标签（`FROSTED · MINIMAL·TEXT`），切换照片或改 cfg 时实时刷新；旋转 ≠ 0 时尾部追加角度
- **空状态升级** — 居中光圈图替换原来的 ⌖ 标记（柔和呼吸动画 + accent 红色 drop shadow），Display 字体大字标题取代纯文本

### 🐛 修复

- 裁剪 modal 在竖向源图上溢出 — 完整改用"预缩放到 fit 尺寸"方案。第一版尝试用 CSS `object-fit: contain` 让 canvas 自动适配，但留白让 canvas 的 CSS box 比可见图像更大，crop rect 落点和图像像素错位。改成在 JS 里测量 stage 可用区域、把 canvas 的 intrinsic 尺寸设成 fit 后的精确值、把源 bitmap rotated + scaled 直接画进去 —— canvas 的 CSS box 现在 1:1 等于可见图像，rect 永远贴在用户看到的像素上。配合 ResizeObserver 监听 stage（不是 canvas，避免反馈环），窗口缩放或对话框 reflow 时 canvas 自动重 fit 重绘

## 0.3 · 2026-05-06

### 📜 项目治理 (Project governance)

- 公开声明：本项目完全由 Claude Code 自主迭代维护，无人类提交者
- 流水线说明：用户通过 GitHub Issue 提需求 → 定时捞取 → Claude Code 自动实现 + 测试 + 更新 CHANGELOG + 自动部署
- 写进 README + CLAUDE.md 规则：每次用户可感知的改动必须在同一个 commit 里更新 `public/CHANGELOG.md`，agent 默认承担这件事

### 🎨 相框 / 模板 (Frames & templates)

- 新相框 **Instax-mini** — 奶油色纸 + 大底边距 + 微浮起阴影
- 拼贴模式 **Collage** — 2–4 张照片同框：`1×2` / `2×1` / `1×3` / `3×1` / `2×2` 五种布局
- 重构：每个 frame 拆成独立文件 `public/frames/<name>.js`，自注册到共享 registry

### ✂️ 编辑工具 (Editing)

- **90° 旋转** — 每张照片独立、渲染时应用、不重新编码源图
- **自由裁剪** — 模态框拖拽，4 角 + 4 边 + 中心区可拖；预览实时反映
- 旋转 + 裁剪都不修改源文件，完全可逆

### 🖼️ 视觉与输出 (Visual & output)

- **自定义签名 / 水印** — SVG / PNG 上传，钉到照片任意角落，跨会话保留
- **自定义背景图** — 替换 frosted 自模糊源；上传时自动压缩到 1024 长边 + JPEG q=0.72
- **GPS 字段** — 字幕字段开关（默认关闭，避免误公开），打开后显示十进制经纬度
- **HEIC / HEIF 输入** — iPhone 照片直接拖入；懒加载 libheif-js wasm 转码
- HEIC 输出 EXIF round-trip — 转码 JPEG 携带源 Make / Model / focal / aperture / shutter / ISO / lens / date

### 📦 工作流 (Workflow)

- **预设保存与分享** — 命名预设存 `localStorage`；或复制 `#p=<base64url>` 链接发给朋友（剥离签名以缩短 URL）
- **中英双语 UI** — 顶栏一键切换；首次访问按浏览器语言自动选择
- **可安装 PWA** — service worker 预缓存壳，首次访问后离线可用；新版本部署时弹"刷新使用"提示，不打断当前会话

### ⚡ 性能 (Performance)

- `fonts.css` 从 ~870 KB 压到 ~150 KB（Inter 字体 subset 到 Latin 覆盖范围，-82%）
- 非阻塞 boot — UI 立即可交互，`logos.json` / `fonts.css` 在后台 fetch
- 视觉回归 smoke 页（`npm run smoke`）— 拖入两张参考照片、跑当前管线、像素 diff 对比

### 🐛 修复 (Fixes)

- 导出 JPEG 的 EXIF Orientation 双旋转 — `createImageBitmap` 已经按方向烤进像素，重写 EXIF 时强制 Orientation = 1，避免查看器再转一次
- 自定义背景图过大不再拒绝，改为压缩接受

---

## 0.2 · 2026-04-27

- 双部署目标（GitHub Pages + 阿里云 OSS）
- 双语 README

## 0.1 · 2026-04-27

- 首次发布
- 5 种相框风格 + 5 种字幕模板
- EXIF 自动解析 + 手动覆盖
- 单张 + 批量 ZIP 导出
