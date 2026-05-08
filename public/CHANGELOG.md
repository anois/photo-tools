# 更新日志 / Changelog

> 本项目完全由 [Claude Code](https://claude.com/claude-code) 自主迭代维护。提需求 / 报 bug 请提交 [GitHub Issue](https://github.com/anois/photo-tools/issues/new)，我们会定时捞取合理的请求走流水线自动上线。

每次有意义的功能 / 修复 / 优化都记到这里 —— 同一份文件既给开发者看，也通过顶栏 ✦ 按钮在应用内展示给用户。

## 0.10 · 2026-05-08

### 🎨 编辑相框 · 杂志非对称 + 大字模版

水印模版第一波扩展，配合新增的 `editorial`（编辑）相框落地。这是把 photo-tools 从"EXIF 摆放器"推向"叙事/编辑画面"工具的第一步。

- **🆕 编辑 · 杂志（`editorial`）相框** — 暖纸色 `#f4f0e6` 背景 + **照片 flush-left 占 ~66% 宽度** + 右侧 ~24% 留白用于排版式 caption。caption 自动垂直竖排（`-90°`），读起来像杂志页脚的版式注脚
- **🆕 字标 · 大字品牌（`wordmark`）模版** — 极简：仅大号品牌字标 / logo + 一行小字日期 + 作者。配合 editorial 右侧竖排时整行 "FUJIFILM" 立起来；配合任何底部 caption 也能用
- **🆕 标题 · 地点 + 日期（`headline`）模版** — 大字标题（GPS 经纬度 + 日期年月，例如 "40°N · 116°E · 2026.03"）+ 一行小字相机参数。GPS 缺失时自动降级为只显示日期
- **支持非对称布局的渲染基础**：`computeLayout` 现在认识 `extraRightInset`（右侧 carve 留白）、`captionPrefer`（强制 caption 走 'right' / 'left' 而不是默认的 bottom 优先）、`fgXOffset`（水平偏移）三个 frame layout 选项。后续家族（场记板、护照戳）共用同一基础设施

### 🎨 相框系统重新策划 · 第一阶段（基础设施 + 4 个家族骨架）

参考 NOMO Pro / 西卡 / Hipstamatic / 画廊馆藏 / 35mm 胶片 等市面常见审美方向，把现有的 6 种相框重新组织为 **4 个家族**（编辑 / 画廊 / 即影 / 胶片），每家族两款，扩到 **8 款**。本次先落地相框层，水印模版 + 签名升级在后续阶段。

- **🆕 35mm 胶片**（`film-35`）— 新增。深黑底 + 上下各 7 个齿孔（仿真 motion-picture perforation 圆角矩形）+ 顶部 cream 色「F · 4000 · DX」边缘印章（按 EXIF 品牌首字母 + ISO 数值动态合成）。带照片的话最远还原"35mm 胶片帧"的实物感
- **画廊·白**（`gallery-white`，替换原 `white`）— 浅暖灰底 `#f4f3ee` + 围绕照片的 **双层细线 passe-partout 衬纸**（外层 1.5px、内层 0.9px，输出像素恒定不随导出质量放大）。仿馆藏装裱
- **画廊·黑**（`gallery-noir`，替换原 `black`）— 深中性 `#171717` + 单层 phosphor 暗光高光线，配合加重的阴影，像照片在黑墙上微微悬浮
- **毛玻璃·暗**（`frosted-noir`，原 `frosted-dark` 重命名）— 视觉与原版完全相同，改名让"frosted / frosted-noir"两兄弟更对称
- **保留旧 cfg 兼容**：所有重命名 / 替换都注册了旧 key 别名（`frosted-dark` → `frosted-noir`、`white` → `gallery-white`、`black` → `gallery-noir`），既存的 preset / 分享链接 / 已存照片 cfg 全部继续可用

### 🛠 渲染管线 · 装饰钩子 + 输出像素恒定

- **`decorate(ctx, layout, args)` 钩子** — `R.registerFrame` 的 def 现支持可选 `decorate` 字段。compose() 在 caption 之后、签名之前调用；主线程 + worker 双端镜像。passe-partout 双线、胶片齿孔、leader 印章都跑在这层。给后续家族补充新装饰元素（馆藏角标、场记板格栅、邮戳印章…）留好扩展点
- **`layout.outputPx`** — `computeLayout` 返回值新增字段 `outputPx = max(0.5, scale × 0.6)`。装饰函数用 `Math.max(1, N × outputPx)` 算线宽 / 字号，预览（scale=0.5）和 high quality 导出（scale=2）下衬纸 / 齿孔印记仍保持视觉细线感，不会随 quality 等比放大变粗
- **`layout.topPaddingBoost`** — 新增对称的顶部 padding 提升（之前只有 bottom），让 film-35 这类需要"上下都留出装饰带"的相框无需 hack 就能合理布局
- **`R.pathRoundRect`** — 共享圆角矩形路径助手（含老 Safari 的 arcTo 兜底），公开给所有 frame 装饰函数复用



### 🗺 GPS · 地图选点 + 手动经纬度

- **EXIF 编辑里能填经纬度了** — 之前 GPS 字段只有"源图带啥就显示啥"一条路；微信 / 社交平台剥过 EXIF 之后那行字幕就废了，没法补。现在 D · EXIF 面板末尾多了 **Latitude** / **Longitude** 两个输入框（六位小数精度，约 11 cm），跟其它 EXIF override 字段一样写入 `cfg.exifOverride`，预览字幕里的 GPS 行实时刷新
- **📍 在地图上选** — 输入框下方一颗按钮，点开懒加载 Leaflet + 高德地图瓦片的小弹窗。点地图 / 拖 pin / 用「使用当前位置」（`navigator.geolocation`）任一种方式落点，确认后六位小数回填到 lat/lon 输入。Leaflet（约 165 KB）只在第一次打开时按需下载，永不打开就永不付费；离线无网时弹窗自动给"无法加载地图，请用上方手动输入"的兜底提示
- **国内可达的瓦片源 + GCJ-02 火星坐标自动校正** — OSM 在国内被防火墙挡住会渲染成空白，所以默认走高德 `webrd0X.is.autonavi.com` 中文标注的 raster road 瓦片。代价：高德瓦片用 GCJ-02 偏移坐标系，直接渲染会让国内地标偏 50–500 m。geopicker 在 Leaflet 边界两侧自动转换：传入 WGS-84 时 wgs2gcj 后再设 marker、用户点选时 gcj2wgs 回 WGS-84 存到 EXIF；中国境外的点位 conversion 是 no-op，海外照片不会受影响
- **导出会写回 GPS IFD** — 导出 JPEG（单张 / 批量）会用 piexif 写出 `GPSLatitude/Ref` + `GPSLongitude/Ref` 标准 EXIF 块，即使源图原本没有 EXIF 也会合成一段。把 photo-tools 当成"补 EXIF 工具"用也成立，分享出去成品文件里的 GPS 跟你在 UI 看到的一致

### 🎨 相框 / 模板

- **新增两个横向画幅** — `4:3`（1920×1440）和 `16:9`（2560×1440）。横构图源图（街拍 / 风景 / 屏幕截图）以前只能挤进 1:1 或硬切回 9:16 portrait，现在直接选对应横向 aspect 即可。两者都把字幕条放在底部（auto-placement 会按可用空间挑），captionH 默认略低于 portrait（横向纵高更紧）。crop 弹窗里也同步加了 `4:3` 选项，跟 frame aspect 保持一致

## 0.8 · 2026-05-08

### 🎞 胶卷右键菜单扩成三项

- **新增"把这张的相框 / EXIF 应用到全部"**——以前 B/D 段底部的"应用到全部"按钮只能复制**当前激活照片**的设置；想从别的照片复制必须先切到那张再点按钮，绕路。现在直接右键 / 长按目标缩略图，菜单里直接一项搞定，激活照片不变。`applyFrameToAll(src)` / `applyExifToAll(src)` 两个函数从原 click handler 抽出，接收源照片作为参数，B/D 段按钮和右键菜单都走同一份函数，激活照片如果接收了变更会自动 `syncControlsFromCfg + requestRender` 同步 UI
- **菜单加分隔线 + 危险动作差异化样式**——三项现在视觉分两组：上面两项 apply-* 是 accent-wash 红字 hover；分隔线下方"从胶卷中移除"是危险动作，hover 时直接 accent 实色填充 + 白字，点击意图视觉化分明，不会顺手点错

### 🎞 胶卷右键 · 长按移除单张

- **右键 / 长按缩略图弹出操作菜单**——之前胶卷只能整批清空（重新加载页面）或一直滚屏，单张照片导入错了想删都做不到。现在桌面右键 / 移动端长按 0.5 秒 thumbnail 弹出小菜单，目前一项「从胶卷中移除」。点 Esc / 点菜单外区域 / 选完动作后菜单自动关闭
- **跨端原生交互**（rule 13）— 桌面端用 `contextmenu` 事件（系统原生右键习惯），移动端用 touchstart + 500ms 延迟 + 移动 ≤ 10px 触发长按。手指移动超过阈值（如想横向滚动 filmstrip）自动取消，不会误弹菜单
- **`removeFile(idx)` 处理三种边界**：(1) 移除非激活照片只更新数组；(2) 移除当前激活照片，自动选邻位（最后一张被删则选倒数第一张）；(3) 移除最后一张全清空，恢复 canvas 空状态。每个被移除条目的 blob URL 也走 `URL.revokeObjectURL` 释放，不漏内存
- **长按后的合成 click 被吞掉**——iOS / Android 浏览器在 touchend 后会合成一次 mouse click 事件落到 touchstart 的目标上。如果不拦截，长按菜单弹出的同时 thumbnail 也会触发 selectFile 切换照片。修法：长按触发时 set `suppressNextClick=true`，document 级 capture-phase click 监听器在 flag 命中时 `stopImmediatePropagation`，吞掉合成 click 不影响后续真实点击

### 🖥 桌面快捷键 · 按住空格看原图

- **桌面端 hold-Space 预览原图** — 移动端有 canvas 长按预览原图，桌面端不能没有对等手势。Photoshop / Lightroom 用 hold-Space 平移视图，本工具借用这个肌肉记忆做"预览原图"——按住空格键即把画面切换为不带相框 / 字带 / 签名的源图（contain-fit 居中），松开恢复带框预览。状态栏底部加了"`空格 看原图`"提示
- **共用一份 peek 引擎** — 触屏长按和键盘按住共享同一对 `enterPeek` / `exitPeek`（提到模块作用域）。任一路径触发时另一路径都能正确收尾，幂等设计避免重复绘制 / 重复 requestRender。两端各自原生（rule 13）
- **不与正在输入的表单冲突** — 空格键监听只在 body / 非交互元素上生效。焦点在 `<input>` / `<button>` / `<select>` / `contenteditable` 时空格按原样穿透到表单，不会误触发 peek。键盘 auto-repeat 也被 `spaceHeld` flag 抑制，避免连续按下导致多次解码

### 🐛 修复

- **聚焦下拉框出现一排红色波浪雪佛龙** — 点击预设 / 模板 / 拼贴布局 / 质量 / 格式等 `<select>` 控件后，控件横向铺满了一排红色 `∨` 形小箭头。根因是 `select:focus` 用了 CSS `background:` **shorthand** 来切背景色，shorthand 会把所有 `background-*` 子属性重置回 initial（包括 `background-repeat: repeat`、`background-position: 0% 0%`、`background-size: auto`）。基础 `select` 规则上的 `no-repeat` + 右侧定位 + 10×6 尺寸全被覆盖；后续 `select:focus { background-image: 红雪佛龙 }` longhand 把图加回来后，红雪佛龙就在左上角原始尺寸开始横向 tile，于是看到一排波浪。改用 `background-color:` longhand 即可保留基础状态的所有几何属性
- **桌面端 changelog modal 偶尔冒出 OS 原生滚动条** — 用户报告"右侧偶尔出现浏览器原生滚动条"。诊断发现：`<dialog>` UA 默认有 `overflow: auto`，叠加全局 `* { box-sizing: border-box }`，dialog 的 `max-height: 86vh` 包含 1px 上 + 1px 下 border，所以内容区只有 `86vh - 2px`；但 `.changelog-modal-inner` 的 `max-height: 86vh` 占满，正好溢出 2px → UA auto 滚动条触发。验证：`dialog.scrollHeight - dialog.clientHeight === 2`。修复：在 `.changelog-modal` 上显式 `overflow: hidden`——内层 body 有自己的滚动容器，dialog 这一层不需要滚动

### 📱 移动端横滑切照片 + 长按预览原图

- **canvas 上左右滑动 = 上一张 / 下一张** — iOS Photos / WhatsApp / 微信图片预览全是这个交互，本项目移动端却只能点 filmstrip 缩略图切换，缺一档纯触屏直觉。新增 touch 事件处理：从 canvas 区域开始的水平滑动，距离 ≥ 50px、|垂直| ≤ |水平|·0.7、≤ 800ms 完成，则触发 `moveSelection(±1)`（与 J/K 键完全一致的循环行为）。垂直滚动、轻触、慢拖都被启发式排除，不会误触。touchend 监听在 document 上，所以手指从 canvas 滑到 filmstrip / 控制面板抬起也照常生效
- **canvas 上长按 = 临时预览原图** — 加了相框 + 标注后想看看"没加之前长什么样"，过去得切换到别的照片再切回来。现在按住 canvas 0.5 秒不动，画面切换为不带相框 / 字带 / 签名的源图（在框架尺寸内 contain-fit 居中、四周保留 bg-canvas 底色作为对照参考），松手立即恢复带框预览。手指移动 > 10px 自动取消（避免横滑切照片时误触发），与 swipe 共用一份 touch 事件状态机。源 bitmap 走已有的 `bitmapCache` 复用，不重新解码
- **桌面 / 鼠标零变化** — touch 事件不会被鼠标触发，桌面体验完全不受影响

### 📱 移动端拇指区导出

- **导出按钮升到屏幕底部拇指区** — 之前移动端要导出一张照片得滚到 7 段控制项的最末（G 段）才能找到"导出当前 / 批量 · ZIP"按钮，对单手操作敌视。现在 ≤768px 视口在视口底部固定一根 dock：左 60% 是 accent 实色填充的"导出当前"主按钮（52pt 高，符合 Apple HIG 触控目标），右 40% 是次级 ghost"批量 · ZIP"。dock 背景半透明 + 10px backdrop-filter blur，像 iOS Music Now Playing 那条 chrome。底部留 `env(safe-area-inset-bottom)` 给 home indicator
- **状态栏自动让位** — 之前状态栏 sticky bottom，加了 dock 后会和 dock 撞在一起。现在状态栏改用 fixed 定位，落在 dock 上方一行，导出过程中的"渲染中…"实时反馈仍然可见
- **G 段冗余的导出按钮在手机上隐藏** — 同一功能两个入口在手机上是干扰，dock 接管后 G 段只保留质量 / 格式选择器（仍有用）
- **桌面端零变化** — dock `display: none` 在 desktop，G 段按钮原样保留，桌面键盘党 `⌘E` / `⌘⇧E` 仍走原按钮路径。两端各自原生（rule 13）

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
