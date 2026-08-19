# 更新日志 / Changelog

> 本项目完全由 [Claude Code](https://claude.com/claude-code) 自主迭代维护。提需求 / 报 bug 请提交 [GitHub Issue](https://github.com/anois/photo-tools/issues/new)，我们会定时捞取合理的请求走流水线自动上线。

每次有意义的功能 / 修复 / 优化都记到这里 —— 同一份文件既给开发者看，也通过顶栏 ✦ 按钮在应用内展示给用户。

## 1.16.1 · 2026-08-19

**🔬 拖拽预览与松手成品不再有出入** —— 灯下看样的低清拖拽帧此前和松手后的成品存在真实差异，不只是清晰度：撕纸边缘轮廓会在松手瞬间跳变、银盐相纸的霉斑会换位置、磨砂背景的颗粒在拖拽时粗一截。根源是这些程序化效果按画布像素播种/采样，而拖拽帧和静置帧的画布尺寸不同。

### 🎨 相框 / 模板

- **撕纸（torn）**：撕边轮廓改为分辨率无关采样 —— 拖拽、预览、导出三者的撕边完全一致；顺带修正了拖动边距时纸边疯狂重撕的问题（现在是平滑变形）。已有照片的撕边花纹会一次性变化（同风格重新生成）
- **银盐相纸（film-mf）**：霉斑位置改为分辨率无关播种 —— 不再在松手瞬间换位置。已有照片的霉斑分布会一次性变化
- **幻灯片装裱（slide-mount)**：卡纸上的明暗斑块同样改为分辨率无关播种，拖拽与成品一致。已有照片的斑块分布会一次性变化
- **半调网屏（halftone）**：拖拽低清帧的网屏此前完全碎裂成混叠噪点（工作分辨率被错误钳制 + 二值点阵被最近邻下采样）—— 现在拖拽时显示同一张网屏的正确灰度平均（相当于隔远看印刷品），松手只变清晰、不再变结构
- **半调网屏 · 预览保真**：颗粒粗细 = 1 时，0.5× 预览此前用的是比导出低一半分辨率的网屏 —— 已修复，预览与导出的网点逐像素一致
- **磨砂背景颗粒**：拖拽低清帧的颗粒尺寸与静置帧对齐（导出不受影响）

### ✂️ 编辑工具

- **拖拽停顿即补清**：按住滑杆不动 200ms，自动渲染一帧全清晰度 —— 拖动时跟手、停下时所见即所得，不必松手就能确认效果

## 1.16.0 · 2026-08-19

**🔦 灯下看样 · 第四步「试印条」** —— 暗房原教旨的比较方式：不确定一个参数该落在哪一档，就把它扫成一张试印条。

### 🎨 工作台

- **◫ 试印条**：工作台顶栏新增 ◫ 按钮 —— 把最近调过的旋钮在它的整个量程上扫出 4 档，以同一构图的四条竖带并排呈现在画布上（每条顶部标注档位值，当前档带实线框）；点中意的那条直接采用该值，◫ / Esc / 抓任何旋钮退出
- 试印条与关灯看样共用同一套编排：条带在场时工作台退后，画布把指针让给你点选

## 1.15.0 · 2026-08-19

**🔦 灯下看样 · 第三步「试印」** —— 改了半天，到底比进来的时候好了多少？工作台顶栏新增 ◐ 按钮：按住即可回看「开台样张」（进工作台那一刻的成品），松手回到当前状态。

### 🎨 工作台

- **◐ 试印对比**：打开工作台时自动把当前画面钉为对比样张；按住 ◐ 查看、松手返回、双击重新取样；切换照片自动重钉。与既有的「看原图」（桌面按住空格 / 移动端长按画布）互补 —— 一个比「原始照片」，一个比「本次进工作台之前的成品」
- 修复：拖完滑杆后焦点留在滑杆上时，按住空格看原图会失效 —— 现在滑杆焦点不再拦截空格

## 1.14.0 · 2026-08-19

**🔦 灯下看样 · 第二步「关灯」** —— 握住任何工作台旋钮的瞬间，工作台整体退后淡出，只留手指下的那一行；照片以全亮度呈现，读数浮上画布，被调整的区域亮起一圈琥珀虚线。手在哪，光在哪。

### 🎨 工作台

- **关灯看样**：拖动任何滑杆时工作台 chrome 淡出至 5%，松手后停一拍再回场 —— 移动端整个底部抽屉变透明，照片从抽屉后面透出来，「盲调」时代结束
- **读数上画布**：拖动时参数名 + 当前值以 HUD 形式浮在照片上方，视线不用再往返滑杆
- **变化有地址**：每个旋钮握住时，画布上它影响的区域（背景 / 阴影圈 / 字幕区 / 照片边缘……）亮起琥珀虚线描边 —— 再微妙的变化也知道往哪看
- 键盘调参（方向键）同样触发关灯看样；点按分段按钮 / 开关时对应区域短暂闪现描边

**🔦 灯下看样 · 第一步「退幕」** —— 调参数时图像变化看不清的病根不在渲染，在于调参的那一刻画面正被工作台遮着。本次先把幕布撤掉：印相期间，暗房让位给相纸。

### 🎨 工作台

- 桌面端打开工作台，预览画布**不再被压暗和模糊** —— 遮罩彻底退场（点空白关闭的手势保留），照片以全亮度呈现你正在调的每一点变化
- 宽屏下打开工作台时，照片自动在抽屉留出的空间里重新居中，不再被抽屉切掉半边

### ⚡ 性能

- 工作台全部滑杆接入低清拖动渲染：按住拖动时预览以约 1/6 像素量逐帧跟手（60fps），松手后自动补一帧全清晰度 —— 与构图（Compose）模式同一套引擎

## 1.12.1 · 2026-08-19

**🌒 工作台「暗房纪律」重设计** —— 工作台的美术风格整体重做。一句话纪律：*琥珀 = 人的手迹*。机器默认态一律石墨中性；被你碰过的东西 —— 正在用的工具、有改动的面板、手写的 EXIF 覆盖 —— 才亮起琥珀安全灯（与构图暗房同一盏灯）。红色从此只留给破坏性动作。

### 🎨 工作台

- 抽屉整体从金棕暖色换为石墨四阶，与构图（Compose）暗房组成同一套世界观
- 7 套「材质仪器卡」（混音台 / 牛皮纸 / 制版纸 / 银盐纸 / 画廊卡 / 拉丝钢板 / 皮革）统一为同一张石墨仪器卡，每帧只保留一条 2px 帧色条 + 卡签 —— 切相框不再换半个抽屉的皮肤；行距压缩后仪器 + 光影一屏放完
- 全部滑杆 / 开关 / 步进器 / 色板统一为同一套石墨 + 琥珀器件；修复了部分卡片滑块被全局红色样式覆盖、自定义样式从未生效的旧问题
- 未触碰的旋钮读数从「默认 / preset」改为安静的「—」
- 笔记（Notation）的拍纸簿纸张退役：自动列 = 等宽灰字，手写覆盖列保留打字机字体并染为琥珀 —— 打字机字 + 安全灯都在说「这是人写的」
- 印记（Seal）面板的红蜡退到放置台：印面改为琥珀微光石墨圆盘，「放置到画面…」升为琥珀主按钮；移除印章保持红色（破坏性动作）
- 移动端底部工作台顶边新增琥珀「安全灯把手」亮线；工具 pill 与桌面语言统一

## 1.12.0 · 2026-08-19

**🖨 新相框「半调网屏 Halftone」+ 全局无相框模式** —— 把照片降解成一张双色理索印刷品：灰度 → 网屏二值化 → 邻近硬边放大 → 油墨 / 纸色双色映射，完整复刻 PS「位图半调网屏」流程，但每个参数都是可拨的旋钮。

### 🎨 相框 / 模板

- 新增第 8 款相框 **半调网屏**（开辟第 5 个视觉家族 · 印刷 Print）：**油墨色 / 纸色**（预置色板 + 自由拾色，纸色同时接管相框底色）、**网点密度**、**颗粒粗细**（1 = 细腻网屏，越大越马赛克）、**网线角度**、**网点形状**（十字线 / 圆点 / 线条 / 菱形）、**明暗** 七个旋钮全部可调，全部进 preset / 分享码
- 风格库新增出厂预设 **半调波点** —— 默认无相框，只输出网屏化后的图像本体；其余出厂预设显式回到有相框模式
- 半调网屏不渲染字幕文字 —— 网屏化的图像就是整个印刷品（字幕带 / 模板相关控件在此相框下会提示不生效）
- 半调帧的预览与导出逐像素一致（网屏几何与渲染倍率无关），拼图 / 裁剪 / 旋转 / 印章全部兼容

### ✂️ 编辑工具

- 新增全局 **无边框 · 仅照片** 开关（工作台 ┃ 测量 顶部）：画布即照片本体 —— 无边距、无字幕、无装饰、无阴影；裁剪 / 旋转 / 拼图 / 印章仍然生效；对任何相框可用，切换相框不会重置

### 🐞 修复

- 修复批量导出的 **worker 池自项目伊始就静默失效** 的问题（piexif 在 worker 里访问 `window` 抛错 → 每次批量导出都在悄悄回退主线程串行渲染）。现在批量导出真正并行、UI 不再卡顿
- 修复视觉回归页 smoke.html 自 0.22 砍帧后一直卡死在 running… 的问题（fixture 用退役帧名 `frosted` 直接下标 FRAMES 表，现改走 `resolveFrame` 别名解析）
- 构图模式的预览投影改为 LOOK_KEYS 驱动 —— 修复画廊 / 35mm / Instax / 幻灯片的仪器旋钮在构图弹窗里不生效的问题

## 1.11.1 · 2026-06-18

### 🐞 修复

- 修复所有弹窗（更新日志 / GPS 地图 / 画幅 / 导出进度 / 工作台身份条）的关闭按钮 ✕ 丢失圆形描边样式、退化成浏览器默认方框 —— 1.10.7 清理旧裁切弹窗 CSS 时，连带删掉了被 6 个弹窗共用的 `.modal-x` 基础规则，现已恢复（28px 圆形 + 描边 + hover/active/focus 三态）
- 修移动端：工作台关闭时，其底部抽屉的顶边（`▤ 文件名 ×` 身份条）会在较高的手机屏幕上从最下方漏出一条 —— `.workshop--bench` 无条件重声明了桌面抽屉定位（`top:0`），盖过了移动端「底部 sheet 下滑藏起」的锚定。去掉冗余声明后，关闭态完整滑出屏幕

## 1.11.0 · 2026-06-01

**❖ 印记（Seal）完整重做 · 自由放置 + 旋转 / 翻转 / 混合模式** —— 印记从「9 宫格锚点、只能压在照片内」升级为「在整张画面任意位置自由拖拽摆放的水印」。同时印章身份标记从 ✦ 换成 ❖（篆刻菱纹），统一用在工具坞图标、面板 eyebrow、红蜡封。

### ✂️ 直接操控放置台

- ❖ 印记 工具新增「**放置到画面…**」按钮，打开一个 Compose 式的直接操控台：在实时合成画面上**拖拽移动 · 拖角/双指缩放 · 旋钮/双指/拖拽条旋转**印记
- **印记可超出照片** —— 落到相框留白 / 边框 / 字幕区都行（不再裁切在圆角照片内）。很多人想把签名放白边里，现在可以了
- 移动端双指 pinch + twist 同步缩放旋转；桌面端角手柄 + 旋转旋钮 + 方向键微移（Shift 自由旋转 / 关吸附）；旋转 ±3° 内吸附 0/90/180/270

### 🎨 新增印记能力

- **旋转** —— 任意角度
- **水平翻转** —— 左右镜像
- **混合模式** —— 正常 / 正片叠底 / 滤色 / 叠加 / 变暗 / 变亮（如正片叠底做压印水印效果，透明 PNG 只叠墨色不染整框）
- 不透明度保留；混合 / 翻转 / 不透明度作为「墨水设置」留在工具面板，位置 / 大小 / 旋转在放置台直接操控

### 🔁 模型统一

- 印记现在是**统一的全局身份**：任意改动（图片 / 位置 / 大小 / 旋转 / 翻转 / 混合 / 不透明度）一次性应用到所有照片 + 本地存储，统一掉旧版「上传全局、位置逐张」的割裂

### ⚠️ Breaking · 仅影响手存预设里的印记

- 印记 `scale` 语义从「相对照片宽度」改为「相对画面宽度」，位置从 9 锚点改为归一化坐标。旧的本地存储 / 预设里的印记会自动迁移（锚点→坐标、尺寸×0.85 近似换算），位置 / 大小可能有轻微偏移，重新拖一下即可。分享码本就不含印记，不受影响

### 🗑️ 退役

- 9 宫格锚点选择器 + 尺寸滑块（被画布直接拖拽 + 缩放取代）

### 🐞 修复

- 「按下印章」蜡封 logo 重做成精致火漆（光滑红蜡圆顶 + ❖ 压进蜡里的凹刻），去掉小尺寸糊成一团的锯齿蜡块
- 修一个老 bug：没上传印记时，签名预览行因 CSS `display` 盖过 `hidden` 而漏出一个空 `<img>` 破图 —— 现在没印记时整行正确隐藏

## 1.10.7 · 2026-05-29

**🧹 移除遗留裁剪弹窗** —— 裁剪 / 旋转早在 1.1 就被 **构图（Compose）模式**统一接管（裁切 + 旋转 + 四边距在一个直接操控的暗房工作台里）。旧的独立裁剪弹窗（`#crop-modal`）作为过渡保留至今，现在彻底清理。

### 🔁 入口收敛

- 工作台 ┃ 测量 工具里多余的「裁剪 & 旋转…」按钮**直接移除** —— 构图已在 lookbar 一键直达，工作台里再摆一个等价入口纯属重复
- 命令面板（⌘K）的「裁剪 & 旋转」命令**保留**，现在直接打开**构图模式**
- 旋转能力不变 —— 构图模式支持任意角度旋转 + 90° 快捷；裁剪、旋转的数据（`cfg.crop` / `cfg.rotation`）格式零变化，老 preset / 分享链接照常解析

### 🗑️ 清理量

- 删除旧裁剪弹窗整套：HTML 弹窗 + 预览区旋转提示浮层、app.js 的 `CROP` 模块 + 旋转控制簇（~460 行）、styles.css 的裁剪弹窗 + 旋转浮层样式（~460 行）、i18n 的顶级 `crop` 文案块 + 一批孤儿键
- 构图模式（`#compose-modal`）的裁剪 / 旋转 / 边距交互完全不受影响

## 1.10.6 · 2026-05-29

**📐 工作台触摸目标合规 + 文案订正** —— 一次多视角审查（6 个独立审视角度并行 + 逐条对抗式复核）捞出几处 1.10.x 引入的触摸可用性问题，本版修复。

### 👆 触摸目标 ≥ 44px

触摸设备上以下控件原来只有 18–28px 高，低于 44×44 的可点击下限（CLAUDE.md rule 13 / WCAG 2.5.5），手指容易点偏到相邻控件：

- **顶部标记 chip**（None / 品牌·型号 / 品牌 / 字标，1.10.0 新组件）—— 约 18px 高
- **底部 应用到全部 / 全部重置 按钮** —— 约 24px 高
- **移动端工具栏 5 个工具 pill** —— 约 28px 高

三者在 `@media (pointer: coarse)`（所有触摸设备，不限宽度）下补到 `min-height: 44px`；桌面精确指针保持原紧凑尺寸不变。

### ✏️ 文案 + 边距订正

- ┃ 测量 工具标题的<em>静态兜底文案</em>从遗留的「测量 · geometry & depth」订正为「测量 · 画幅几何」（i18n 早在 1.10.2 就改对了，只有 JS 加载前一瞬可见的兜底文本漏改）
- 工作台底部按钮条加 `env(safe-area-inset-*)` —— 横屏 home indicator 手势区不再压住 应用/重置 按钮

## 1.10.4 · 2026-05-29

**🔧 Apply-to-all 修复 7 字段漏授** —— 之前用户在某张照片上设置 *顶部品牌标记* / *字幕浮高* / *四边距任一边* / *film-mf 老化度*，再点 footer 的「应用到全部照片」按钮，这些设置不会传播到其他照片。

### 🐞 怎么出现的

`applyFrameToAll` 一直手维护一份 `FRAME_KEYS` 白名单（30+ 个键），而 preset / share-code 用的是 `LOOK_KEYS`（同样目的，但通过 `R.collectFrameCfgKeys` harness 自动跟 `frame.cfg` schema 联动）。两份名单从 0.22.0 起逐渐 drift —— 0.22 新加的 topTemplate / captionOverlayTextLift、1.1 新加的 paddingTop/Right/Bottom/Left、film-mf 老化度 filmMfAge 共 7 个字段，preset 全部 OK 但 Apply 按钮漏授。

### 🔨 怎么修

`applyFrameToAll` 现在直接遍历 `LOOK_KEYS`（外加 showFields / customLogo / customBg 三个独立追踪的对象），杜绝未来 drift。新加 frame.cfg 知识点 / 新增 LOOK_KEYS 字段时只需要改一处。

### 🧹 顺手清理

- 删除 50+ 死 i18n key —— rev.0 4-tab IA (`workshop.tabs.*`)、rev.1 5-section IA (`workshop.section.*`)、1.10.2 后失效的 `workshop.caliper.shadowGeom`、跟着旧设计语言的 `workshop.padding / topBadge / instrument / instrumentHint / signature / footerSummary`
- Caliper 工具内 zone label 上的 "1" 数字标记去掉 —— Zone 2 阴影搬到 Instrument 后 Caliper 只剩一个 zone，孤立的"1"读起来反而像未完成
- 内部函数重命名 `refreshSealClampActive` → `refreshArrangeClampActive`（clamp 1.10.1 起就搬到 ▦ Arrange 工具了，函数名一直挂着 seal 容易误导）
- CLAUDE.md 内部文档清理 5 处过期 IA 引用 (B · Frame / D · EXIF / E · Top / D · Shadow rev.0 章节代号)，替换为 5 工具 IA 描述

## 1.10.3 · 2026-05-29

**🪪 顶部身份条瘦身** —— 工作台顶部的双行身份条砍掉冗余的第 2 行 (`FROSTED-NOIR · 3:4 · MINIMAL · 4 MODIFIED`)。这一行的三个 token (frame / aspect / template) lookbar 上方的 4 个 lookchip 已经实时显示，"N MODIFIED" 工作台底部 footer 也有，重复一次反而让用户找信息变难。

### 🟢 改动细节

- 顶部身份条现在就一行：文件名 + 关闭 ×
- footer 占位符 *5 sections · 0 modified* → *5 tools · 0 modified*（rev.2 "The Bench" 5 工具语义对齐；JS 首渲染前的占位文本，看到的几率极低但顺手修了）
- 删除冗余 i18n key `workshop.identityEmpty` 和对应 CSS `.bench-identity-spec`

## 1.10.2 · 2026-05-29

**☀ 阴影三件套从测量搬到仪器** —— Shadow blur / drop / depth 三个滑块从 ┃ 测量 Zone 2 搬到 ◉ 仪器 面板底部，作为「光影 · LIGHTING」子区跟着当前相框走。

### 🔦 为什么是仪器，不是测量

- **shadow 默认值是相框身份的一部分** —— film-35 出厂值是 0/0/0（它是底片印刷不该有 drop shadow）、slide-mount 同 0/0/0（照片 inset 在皮料里）、instax 是软落影、gallery-white 是博物馆灯光。在 ┃ 测量 里把 shadow 当作"通用 6 件套"会鼓励用户在 film-35 上拉 shadow blur 把底片画成"床单上的相片"，违背相框设计
- **┃ 测量 现在专注于纯几何** —— padding + radius + Compose CTA。标题改为 *测量 · 画幅几何* (en: *Caliper · frame geometry*)
- **◉ 仪器 底部多了一条光影 strip** —— 钢蓝深色面板配琥珀刻度 eyebrow，复用同一套黄铜滑环 chrome；位置在 7 张相框仪器卡之下、面板底部，切相框时跟着该相框的 shadowDefault 重置

### 🟢 改动细节

- `cfg.shadowBlur` / `cfg.shadowOffsetY` / `cfg.shadowOpacity` 字段语义零变化；老 preset / share-code / 老 cfg 不受影响
- 3 个 `<input id="shadow-(blur|offset|opacity)">` 全部保留 —— 事件监听器一字不动
- modified-state 红点判定从 ┃ 测量 移到 ◉ 仪器（红点位置变了但口径一致）

## 1.10.1 · 2026-05-29

**▦ 排版 · 第 5 件工具落地** —— 把多张照片的拼贴布局从 ✦ 印记 工具里抽出来，独立成新的 **▦ 排版 / Arrange** 工具，跟仪器 / 测量 / 笔记 / 印记 并列在工具栏。

### 🪟 工作台从 4 工具变 5 工具

- **▦ Arrange · 排版** 新工具：6 张纸夹小卡（off / 1×2 / 2×1 / 1×3 / 3×1 / 2×2）+ 伙伴照片绑定槽，原样从 Seal Zone 2 搬过来；继承同款米黄卡纸 chrome（共享 paper-craft 材质族）
- **✦ Seal · 印记** 收窄成纯签名工具：保留蜡印按下按钮 + 9 位置画框 + size/opacity 双 meter，hint 改为 *盖在照片画框内的蜡印水印*
- **为什么**：1.9.2 版本把拼贴当作"印记的第二张纸夹"，但拼贴是<em>多张照片如何排版</em>的决策，跟<em>一张照片上盖什么签名</em>语义无关 — 一个用户打开 Seal 想加签名却先看到 6 张布局会困惑

### 🟢 改动细节

- 工具栏移动端横向 pill bar 5 chip 仍然横滚可达；桌面 64px 左栏垂直排列容纳无压力
- `customBg`（毛玻璃自定义背景图）的 modified-state 红点从 Seal 改归到 ◉ Instrument（它的 UI 一直在 frosted-noir 仪器卡里，归属早就该校正）
- 所有 cfg / preset / share-code 字段语义零变化；33 个 `<input id="…">` 全部保留 — `#collage-layout` / `#sealcard-clamps` / `#collage-slots` / 9 个签名锚点全部就位
- `refreshSealClampActive` 仍按 `.sealcard-clamp` 类选 — clamp 按钮 class 名称沿用（搬位置不改类）

## 1.10.0 · 2026-05-29

**🪜 工作台 IA 整改** —— 1.9.x 落地的 4 工具语言保持不变（仪器 / 测量 / 笔记 / 印记），但把两块功能搬到了对的工具里：

### ✎ 字幕带尺寸搬到「笔记」

- **Caption h（字幕带高度） / Caption inside photo（嵌入开关） / Lift（嵌入字浮高）** 从 ┃ 测量 整体搬到 ✎ 笔记，作为 Zone 1「字幕带」，EXIF 双栏成为 Zone 2
- **为什么**：调一条 caption 的完整决策（用什么 template / 显示哪些字段 / EXIF 覆盖 / 字幕带高度 / 是否嵌入照片底 / 嵌入字距底多远）原来要在测量↔笔记两个工具之间反复切；语义上它们都属于「这条字幕的外观」，应该坐在一起
- ┃ 测量现在专注于「画幅几何 + 光影」两个 zone — 主标题相应改为 *测量 · 画幅与阴影* (en: *Caliper · frame & shadow*)

### ◉ 顶部品牌标记搬到「仪器」

- **Top badge（None / Brand·Model / Brand / Wordmark）** 从 ✎ 笔记 Zone 1 搬到 ◉ 仪器，作为 7 张相框仪器卡<em>之上</em>的一条通用 strip
- **为什么**：顶部标记是<em>相框的一种装饰</em>（在相框留白区域盖一行品牌字），跟「这条字幕显示什么」不是同一件事。放在 Notation 是按"哪个 cfg 字段"分组的遗产，按"用户怎么想"分组它属于 Instrument
- 视觉上做成深色琥珀镶边的 4 chip 通用 strip，避免跟 7 张相框各自的物质化 chrome 抢戏

### 🟢 兼容性

- 所有 cfg / preset / share-code 的字段语义零变化；老的 preset / 分享链接照常加载
- 33 个 `<input id="…">` 全部保留 — 事件监听器、syncControlsFromCfg、`buildConfigForFile` / `doRender` 投影都无需改
- 4 个工具按钮的红点 modified-state 重新按新归属计算

## 1.9.2 · 2026-05-29

**✦ Seal 工具 · 蜡印 + 纸夹** —— Phase 14 of「The Bench」(收尾)，跟 1.9.0 Caliper 黄铜测距尺 / 1.9.1 Notation 笔记本同级。Seal 从 1.9.0 包装着旧 chrome 升级为完整<em>厚卡纸蜡印盒 + 纸夹拼贴卡</em>设计：上半区是签名印章 + 9 位置照片画框，下半区是 6 张纸夹小卡（带金属夹头）替代下拉布局选择器。

### 🔏 蜡印盒视觉

```
✦ SEAL · 印记 · signature + collage
┌──────────────────────────────────┐
│ ①  蜡印 · 签名                    │
│ ┌─[ ✦ ]─────────────────────────┐│  ← wax press button
│ │  红蜡圆球 + Press your seal    ││    irregular drip edges
│ │  SVG · PNG · transparent bg    ││    上传 = 按下印章
│ └────────────────────────────────┘│
│                                    │
│  Where to stamp                    │  ← 9 位置 = 照片画框 + 蜡红圆点
│  ┌────────────┐                    │     active = 大红蜡 drop
│  │ • • •      │                    │
│  │ • • •      │                    │
│  │ • • ●      │                    │
│  └────────────┘                    │
│                                    │
│  Size       ━━━●━━━━━━━━   6%      │  ← 红蜡细线 + 小蜡丸 thumb
│  Opacity    ━━━━━━━●━━━   100%     │
├──────────────────────────────────┤
│ ②  纸夹 · 拼贴                    │
│  ╔═══╗ ╔═══╗ ╔═══╗                │  ← 纸夹小卡 (3×2 grid)
│  ║Off║ ║1×2║ ║2×1║                │    顶部金属夹头
│  ╚═══╝ ╚═══╝ ╚═══╝                │    active = 米黄 + 蜡红边
│  ╔═══╗ ╔═══╗ ╔═══╗                │
│  ║1×3║ ║3×1║ ║2×2║                │
│  ╚═══╝ ╚═══╝ ╚═══╝                │
└──────────────────────────────────┘
```

### 🔧 实现注释

- **厚卡纸卡片** (`#ede1c4 → #e0d2af`) + SVG 纤维噪点 + 双线压痕边
- **蜡印 press button** = irregular clip-path 红蜡圆球（drip 边）+ `✦` Fraunces 斜体高光 + 沉色虚线边框 + 「Press your seal」13px Fraunces 斜体
- **蜡印 imprint** = 上传后切换：左侧蜡印小圆球 + 中间签名图片预览 + 右侧「Remove seal」沉色按钮
- **9 位置 = 照片画框** (4:3 aspect-ratio + 沉色边) · 9 个位置以圆点呈现 (8px) · 激活的位置变 14px 大蜡红 drop + 内嵌高光
- **细线 meter slider** (size + opacity) · 红蜡细线 track + 小蜡红圆球 thumb (12px)
- **6 张纸夹小卡** 替代 `<select>` · 每张顶部带<em>金属夹头</em>（黄铜小药丸）+ 小型 layout 视觉化（1/2/3 photo cells）+ 标签
  - 激活态 = 沉色边框 + 黄米黄背景 + 内嵌阴影 + cell 变沉色
- **隐藏 `<select id="collage-layout">`** 保留（驱动 change-event listener）· 可见纸夹按钮 click 时同步 select.value + dispatch change
- **`refreshSealClampActive()`** 在 `syncCollageFromActive` 末尾跑 · photo switch / preset apply 时纸夹激活态正确刷新

### 🔧 接线 0 行 cfg / render 改动

- 所有 8 个 signature/collage 相关 id 保留: signature-input · signature-preview · signature-preview-img · signature-clear-btn · signature-pos-grid · signature-scale · signature-opacity · collage-layout · collage-slots
- 现有事件 listener (`els.collageLayout.addEventListener('change', ...)`) 通过 dispatchEvent 触发 · 旧逻辑不动
- service-worker `CACHE_VERSION` 走到 v56

### 🎯 「The Bench」 4 件工具收尾

| 工具 | 物理隐喻 | 落地版本 |
|---|---|---|
| ◉ Instrument | 7 张物质化仪器卡 | 1.3-1.7 |
| ┃ Caliper | 黄铜测距尺 + 双 zone | 1.9.0 |
| ✎ Notation | 米黄横线笔记纸 + 双栏 | 1.9.1 |
| **✦ Seal** | **厚卡纸 + 红蜡圆球 + 纸夹** | **1.9.2** |

4 件工具全员到齐 · 每件都有自己的物理外壳 · workshop 完整重做闭环。

---

## 1.9.1 · 2026-05-29

**✎ Notation 工具 · 摄影师笔记本** —— Phase 13 of「The Bench」 (跟 1.9.0 的 Caliper 黄铜测距尺平级)。Notation 从 1.9.0 包装着旧 chrome 升级为完整<em>米黄横线笔记纸</em>设计：装订针孔 + 横线 + 4 张顶部标记纸贴 + EXIF 双栏对照（打字机原文 vs Special Elite 手写覆盖）+ 沉色三按钮笔记动作。

### 📝 笔记本视觉

```
✎ NOTATION
笔记 · caption + EXIF
─────────────────────────
○  ○  ○  ○                ← 装订针孔
─────────────────────────
①  顶部品牌
   [none] [brand·model] [brand-only] [wordmark]   ← 4 张纸贴 (略微旋转)

②  EXIF override
   FIELD  | AUTO · 自动识别 | HAND · 手写覆盖
   ────── | ────────────── | ─────────────
   make   | Fujifilm       | _________________  ← Special Elite 手写体
   model  | X-T5           | _________________
   focal  | 35             | _________________
   ...
   [📍 Pick on map]

   [Erase hand]  [Copy to all]  [Copy raw]      ← 三沉色按钮
```

- **米黄横线纸** (`#f0e8d4` → `#ead9b8`) + multiply SVG 纤维噪点 + 22px 横线节奏
- **4 装订针孔** 沿顶边 · 内陷阴影 + 微高光
- **4 张纸贴** 替代 segmented 按钮 · 每张略微旋转 (-1.5° / +1° / -0.5° / +1.8°) · 激活态酒红蜡封色 + 内嵌高光
- **EXIF 双栏**: 左 AUTO 列 (JetBrains Mono · 灰) · 右 HAND 列 (Special Elite 手写体 · 深沉色 `#5a1810`)
- **AUTO 列实时填充**: `populateExifAutoDisplay(normalized)` 从 EXIF 自动识别结果填 12 个 `.notebook-auto` 跨度。手写非空时 AUTO 列<em>划线</em>表示被覆盖
- **横向虚线** 在每行之间作为笔记本的细密分隔
- **Special Elite 手写字段** focus 时下划线变成酒红蜡色 · 占位符也是斜体 Special Elite
- **三沉色按钮**: Erase hand · Copy to all · Copy raw — 沉色边框 + 米黄背景 hover

### 🔧 实现注释

- **行为变化**: EXIF 输入框现在 ONLY 持有 override 值 (不再 prefill 自动识别)。AUTO 列负责显示自动识别。<em>这是行为改变但语义更清晰</em>: 输入空 = 用 auto · 输入非空 = override。Renderer 不变 (`buildExifForFile` 依然合并 normalized + override)。
- **`populateExifInputs(normalized)`** 重定义为「清空所有 EXIF 输入 + 填 AUTO 列」。所有 call site 自动改用新行为
- **新增 `refreshNotebookOverriddenState()`** 在 input event + cfg sync 末尾跑 · 给每行 `<label>` 设 `data-overridden` 属性 → CSS 命中划线
- **新增 `populateExifAutoDisplay(normalized)`** 把 12 个字段从 normalized 投影到 `.notebook-auto[data-auto-field]` 跨度
- 所有 16 个 EXIF 相关 input/button id 保留 (exif-make / model / focalLength / fNumber / exposureTime / iso / lensModel / dateTimeOriginal / author / flash / latitude / longitude / pick-on-map-btn / clear-exif-btn / apply-exif-all-btn / copy-raw-exif-btn / exif-details / exif-warn / top-template-seg)
- service-worker `CACHE_VERSION` 走到 v55

### ⚠️ Behavior note

老用户注意: **打开照片后 EXIF 输入框默认为空，自动识别在左侧 AUTO 列显示**。这是设计变化，不是 bug。要"用自动值" → 输入空即可；要"覆盖" → 写在 HAND 列输入里。"Erase hand" 按钮清空 HAND 一列，AUTO 列不动。

剩 Phase 14 (Seal 工具 · 蜡印 + 纸夹) 待落地。

---

## 1.9.0 · 2026-05-29

**工作台重做 · 「The Bench」** —— 1.8.x 的 5-section 字母 rail 复盘后认定不够个性化（除 B · 仪器面板外仍是 section header + 通用控件），IA 也不是按摄影师思考路径划。Phase 12 重新组织整个 workshop 模块的交互语言：5 段折成 **4 件工具** 摆在「暗房工作台」上，每件工具都有自己的物理隐喻和材质 chrome。详见 [docs/workshop-redesign-rev1.html](../docs/workshop-redesign-rev1.html) + .claude plan「steady-gliding-graham」。

### 🪛 4 件工具的暗房工作台

```
┌───── photo-tools · workshop ─────┐
│ ▤  IMG_1234.HEIC            [×] │ ← identity strip (read-only stamp)
│    FROSTED-NOIR · 3:4 · ··· · 0 │
├──────┬──────────────────────────┤
│ ◉ 仪器│  当前工具的物质化面板    │
│ ┃ 测量│                          │
│ ✎ 笔记│                          │
│ ✦ 印记│                          │
├──────┴──────────────────────────┤
│ 4 件工具 · N 修改  [Reset][Apply]│
└──────────────────────────────────┘
```

- **◉ Instrument · 仪器** —— 当前相框的物质化面板 (frosted-noir 5 通道 / torn 牛皮 / film-mf 黄铜 / gallery-white passe-partout / film-35 拉丝钢 / instax 奶油塑料 / slide-mount 酒红皮革)。1.3–1.7 已完成，原样嵌入。打开 workshop 默认看到的就是这件。
- **┃ Caliper · 测量** —— **黄铜测距尺**新工具。合并 1.8.x 的 A · Edges + C · Shadow + Compose 入口于一台仪器。两侧黄铜镶边带刻度线，内部分两 zone (画幅几何 1: padding/captionH/radius · 光影深度 2: shadow blur/drop/depth)，外加 caption overlay 切换 + Compose CTA。Thumb 是黄铜小环（独特于仪器卡的钢小药丸），落在深色刻槽里。
- **✎ Notation · 笔记** —— Phase 12 暂保留旧 D · Caption 内容 (top badge + EXIF override + actions)。Phase 13 将重设为<em>摄影师笔记本</em>：左栏打字机原文 / 右栏手写覆盖（Special Elite handwriting 字体）。
- **✦ Seal · 印记** —— Phase 12 暂保留旧 E · Mark 内容 (signature + collage)。Phase 14 将重设为<em>蜡印 + 纸夹</em>：签名拖到照片占位图 9 位置盖章 + 拼贴布局以纸夹比喻。

### 🪧 顶部 identity 条

永远显示的只读 readout 条:
- 行 1: `▤ IMG_1234.HEIC` (mono 灰) + 右侧 × close
- 行 2: `FROSTED-NOIR · 3:4 · MINIMAL · N MODIFIED` (mono 琥珀小)

不在 workshop 内换 frame/aspect/template (那些在 lookbar)；这条是<em>这张照片现在是什么</em>的现场报告。

### 🧭 Tool dock 导航

- 桌面: 左侧 68px 纵向工具栏 · 4 个 icon + 中文名 + modified 红点
- 移动: 横向 pill bar (身份条下方) · 同一组 icon + 名字
- 当前工具琥珀高亮 + 24px 高光条；其他淡米色

### 🔧 实现注释

- **保留所有 input id** (33+ 个): padding / caption-h / radius / shadow-blur / shadow-offset / shadow-opacity / caption-overlay-toggle / caption-overlay-lift / crop-open-btn / top-template-seg / 12 EXIF inputs / signature-* / collage-layout / apply-frame-all-btn / workshop-close 等全部保留位置变了 id 不变 · 现有 event listener 一字未动
- **保留所有 cfg schema + 渲染管线**: 22 个 frame-cfg 旋钮 / 7 frame defs / resolveRenderParams / FACTORY_PRESETS / preset 系统 / Compose modal / lookbar pickers 全部不动
- **删 IntersectionObserver scroll-spy** (Phase 11 上线): 新 IA 单一可见 tool panel · scroll 不再 index sections · tool dock click 是唯一导航源
- **旧 tab name 兼容**: setWorkshopTab('tweak'/'exif'/'sign'/'tile'/'edges'/'shadow'/'caption'/'mark') 自动映射到对应 4 工具 · 外部 caller (lookbar / picker close / cmdk) 无需立即改动
- service-worker `CACHE_VERSION` 走到 v54

### ⚠️ Breaking visual

老用户 muscle memory 注意:
- **5-letter rail → 4-tool dock**: A/B/C/D/E 字母 rail 退役
- **EXIF 现在叫 Notation**: 在 ✎ 工具下
- **签名/拼贴现在叫 Seal**: 在 ✦ 工具下
- **shadow 出了独立段, 重新归到 Caliper 工具的 Zone 2**

Phase 13/14 将进一步把 Notation/Seal 落地它们各自的物理 chrome (笔记本 / 蜡印 + 纸夹)。

---

## 1.8.1 · 2026-05-29

**工作台 rail 联动滚动 + section 修改指示** —— Phase 11 of the workshop redesign（接 1.8.0 的 5-section IA）。打开工作台滚动时，左侧 rail 的 A/B/C/D/E 字母<em>自动跟随</em>当前可见的 section 高亮琥珀；修改过的 section 字母右上角亮起 5px 红点；底部 footer 实时显示 "5 sections · N modified" 计数。

### 🎯 实时反馈

- **rail 滚动联动**：基于 `IntersectionObserver`，root 设为 `#ws-content`，rootMargin 偏向上半视口（`-10% 0px -50% 0px`）—— section 顶部进入上半时被认为"当前"。5 个阈值采样（0/0.1/0.25/0.5/0.75/1.0），保证滑动时 rail 高亮顺滑切换。
- **section 修改指示**：每个 section 维护一个 `isModified` 计算：A 段比对 padding/captionH/radius/captionOverlay/lift/perEdge padding/rotation/crop；B 段比对当前相框的所有 `frame.cfg` keys (null = 默认)；C 段比对 `frame.shadowDefault`；D 段比对 topTemplate / exifOverride / showFields；E 段比对 customLogo / customBg / collage。基线一律 = `defaultCfg()` 快照（一次性缓存在 `_wsBaseline`）。
- **footer 实时计数**：footer 左侧"5 sections · 0 modified" 占位文字现在 live 计算——拨任何一个旋钮立刻刷新。0 时显示 "全部默认 / all default"。

### 🔧 实现注释

- `refreshWorkshopModifiedState(cfg)` 挂到 `syncControlsFromCfg()` 末尾——每次 cfg 改动（slider/toggle/swatch/photo switch/preset apply）都会重算。
- `initWorkshopScrollSpy()` 在 `openWorkshop()` 首次调用时 lazy-init（IntersectionObserver 需要 workshop 在 DOM 树里且 rect 非零，关着的时候没法初始化）。Idempotent，多次调用安全。
- service-worker `CACHE_VERSION` 走到 v53。

### 🎯 Phase 11 锁单

Phase 10 (1.8.0) 落了 IA + chrome。Phase 11 (1.8.1) 落了 rail 联动 + modified 指示 + footer 计数。剩下 Phase 12 (移动端打磨：grabber + sticky section heads) 和 Phase 13 (footer Apply 提升) 按后续需求分别推。

---

## 1.8.0 · 2026-05-29

**工作台抽屉重做 · 5 sections 替代 4 tabs · 暖暗调色板** —— Phase 10 of the workshop redesign（见 [docs/workshop-redesign-rev1.html](../docs/workshop-redesign-rev1.html)）。打开工作台不再是「微调 / EXIF / 签名 / 拼贴」4 个分裂的 tab——是一条连续滚动的长页，左侧 52px 字母 rail (A/B/C/D/E) 指示当前位置，底部 sticky footer 放 Reset / Apply 两个全局动作。视觉语言跟<em>仪器面板</em>和 <em>Compose mode</em> 完全打通——同一个房间的三块功能区。

### 🗂️ 5 sections IA · 按工作流排

| | 段名 | 内容 |
|---|---|---|
| **A** | Edges · 边距 | padding · captionH · radius · caption-overlay 开关 + lift · Compose 入口 |
| **B** | Instrument · 仪器 | 7 张仪器卡（仅改名，内容跟 1.7.0 一致）|
| **C** | Shadow · 阴影 | 阴影 blur/Y/opacity（终于<em>不再藏在折叠抽屉里</em>）|
| **D** | Caption · 说明 | 顶部 brand 标记 + EXIF 字段覆盖 + Reset / Apply EXIF / Copy raw |
| **E** | Mark · 印记 | 签名上传 + position grid + 大小 / 透明度 + 拼贴布局 |

### 🎨 视觉语言

- workshop 调色板从冷暗 `#0a0c0e` 切到暖暗 `#14120f → #2a2520`——跟 Compose mode + 仪器面板用同一套<em>琥珀 + 红色</em>双色系统。琥珀 (`#d4a574`) 驱动导航 / eyebrow / 提示语；红色 (`#e5493a`) 保留作 active 指示色。
- 顶部条：Fraunces 斜体 "Editor's desk" 副标 + JetBrains Mono 红色 "PHOTO-TOOLS · WORKSHOP" eyebrow。
- 每个 section header：方块 eyebrow 字母 (A/B/C/D/E 琥珀 mono) + Fraunces 斜体 section 名 + 右侧灰色 mono 中文小标。跟 C · 仪器面板 1.4.0 已经用的 ws-section-eyebrow 是同套语言。
- 通用 slider thumb 改为<em>冷调钢小药丸</em>（12×12 cream-to-cool-steel 渐变）+ 琥珀光晕——跟仪器面板的"steel pill"语言一致。

### 🧭 导航

- 左侧 **vertical rail** 永远显示 A/B/C/D/E 5 个字母。当前 section 字母琥珀色 + 24px 高光条；其他淡米色。点字母平滑滚动到那段（`scrollIntoView({behavior:'smooth'})`）。
- 字母右上角 5px 红点 = 该 section 修改过 placeholder（Phase 11 接活 modified 检测）。
- 移动端（≤700px）rail 横转 90° 变成 horizontal **pill bar**：5 个琥珀边胶囊按钮，激活态琥珀填充 + 深色字。

### 📍 sticky footer

- 永远在底部：左侧 "5 sections" 元数据（modified 计数 Phase 11 接），右侧 "Reset all" ghost 按钮 + "Apply to all photos" **琥珀 primary**。
- Apply-to-all 从 B · Frame 底部按钮升级为 footer primary——因为它<em>跨照片</em>，是编辑师层级的动作，应该常驻可触。

### 🔧 实现注释

- **零 cfg / 渲染管线改动**：所有 22 个旋钮 cfg key 一字不动，frame schemas 一字不动，resolveRenderParams 一字不动，FACTORY_PRESETS 一字不动。这一波是<em>纯 IA + UI 重构</em>。
- **所有 input id 完整保留**：33 个关键 id（padding / caption-h / radius / shadow-blur / shadow-offset / shadow-opacity / top-template-seg / 12 个 exif-* / signature-* / collage-layout / apply-frame-all-btn 等）位置变了但 id 没变，所有 event listener 继续 work。
- `app.js` 旧 `setWorkshopTab(tab)` 函数保留作 alias：tweak→edges / exif→caption / sign→mark / tile→mark，外部调用方（lookbar 触发 / picker 关闭 / cmdk action）无需立即改动。
- shadow-advanced `<details>` 折叠 chrome 退役 (1.3.x 上线，1.8.0 退役)。shadow 现在作为顶层 C 段直接展开。
- service-worker `CACHE_VERSION` 走到 v52。

### ⚠️ Breaking

- workshop 4 tab → 5 section IA 调整：长期肌肉记忆的用户会短期"找不到 EXIF 在哪"。EXIF 现在在 **D · Caption**；签名在 **E · Mark**；拼贴也在 **E · Mark**。

---

## 1.7.0 · 2026-05-29

**slide-mount 上线 · 7 台仪器全员到齐 · ✦** —— Phase 8 of the per-frame instrument language（[docs/frame-instruments-rev3.html](../docs/frame-instruments-rev3.html)）。最后一台沉默的相框现在也有自己的仪器面板。**C · 仪器面板现在 7/7 全员到齐**：frosted-noir / torn / film-mf / gallery-white / film-35 / instax / slide-mount，从 1.3.0 启动到这一版完整闭环，每个相框都从「hardcoded 常量箱」升级为「用户可拨弄的乐器」。

### 🎞️ slide-mount · 4 根新旋钮

- **`cfg.slideMountColor`** ('cream' / 'leather' / 'black'，默认 cream) · 卡纸色。三档枚举对应 `#e6dac0` / `#9c7a4a` / `#2a1a14`——Kodachrome 米黄、皮革棕、档案黑。**改 mountColor 不只是换 bg.color——pebble tile 会按新颜色重建**，这样皮革凸起的明暗对比在不同底色下都保持视觉一致。
- **`cfg.slideOuterRing`** ('wine' / 'brass' / 'charcoal'，默认 wine) · 外框色。canvas 周边 28px 实心带的颜色。酒红是原版；黄铜是 Kodachrome slide tray 的高档质感；炭黑是博物馆装裱风。
- **`cfg.slidePebble`** (0.5×–1.5×，默认 1.0×，5 档：0.5/0.75/1.0/1.25/1.5) · 皮革凸起密度。乘到 `numBumps`（180 默认 → 90/135/180/225/270）。**这是 rev.3 标的 R6 风险点**——tile 重建有成本，所以 cache 按 `(mountColor, numBumps)` 组合键化，最多缓存 3 × 5 = 15 张 128×128 tile (~960 KB worst case)；用户拨过一遍之后全部命中缓存。
- **`cfg.slideBevel`** (4–20 px，默认 8) · 凹陷深度。同时缩放卡纸 bevel cues 的宽度和照片孔的 inset shadow 深度（后者最多 36px）。从「平面贴纸」到「深陷镶嵌」全光谱。

### 🎛️ slide-mount 仪器卡

C · 仪器面板第 7 张卡，**酒红皮革 + 黄铜配件**：160° 酒红到深紫渐变 + multiply 皮革纹理 overlay + 左上角的 radial 暖色高光（黄铜反射既视感）。黄铜横杠 + `SLIDE · MOUNT` mono 大写 + 右侧 `PROJECTOR` Fraunces 大写副标。Thumb 是**抛光黄铜圆钮**（径向金色渐变 + 内嵌高光环 + 外阴影）。Swatches 是 3 个实色圆盘 + 黄铜激活光晕。

### 📊 C · 仪器面板 最终阵容

| Frame | 物质身体 | 旋钮数 | Thumb 造型 |
|---|---|---|---|
| frosted-noir | 冷调编辑控制台 | 5 | 红色小药丸（5 通道 channel-strip） |
| torn | 牛皮纸工作台 | 3 旋钮 + 1 选材 | 带炭笔印章的牛皮纸方块 |
| film-mf | 米黄相纸图书馆 | 1（复合 age） | 黄铜镶边圆钮 |
| gallery-white | 美术馆铭牌 | 3 旋钮 + 1 选材 | 极简白方块 + 黑细边 |
| film-35 | 拉丝钢顶板 | 2 旋钮 + 1 开关 + 1 步进 | 滚花金属药丸 + 红刻线 |
| instax | 奶油塑料拍立得 | 1 旋钮 + 2 开关 + 1 选材 | 奶油塑料厚块 + 橙刻线 |
| slide-mount | 酒红皮革幻灯片机座 | 2 旋钮 + 2 选材 | 抛光黄铜圆钮 |

**总计 22 根旋钮** · **每根都跟自己的物质外壳一致** · **底层机制全部统一为 input + button 的标准 web 控件**——这是 rev.3 设计语言「Same mechanism · different garment」的完整兑现。

### 🔧 实现注释

- `slide-mount.js` tile cache 现在用 Map 按 `${mountColor}_${numBumps}` 组合键化（之前是 `_leatherTile` 模块级单缓存）。lazy 填充，只构造用户真实拨到的组合。
- `buildLeatherTile(baseColor, numBumps)` 重构为接收两个参数，seed 也混入 numBumps 让不同密度 tile 视觉上有别（不只是 bump 数量变）。
- `resolveRenderParams` 现在包含 7 个相框-namespace block (`bg / torn / filmMf / film35 / instax / slideMount / galleryWhite`) + shadow。函数已经接近 90 行——下一波 cfg 命名空间迁移会把这套 if-block 收敛成一个 schema-driven loop。
- service-worker `CACHE_VERSION` 走到 v50。

### 🚀 下一步

完成 C · 仪器面板 7/7 后，**下一波是架构重构**——把所有 9 + 4 + 4 + 4 + 4 + 4 = 29 个扁平 cfg key（`bgBlur` / `tornJitter` / ... / `slideBevel`）迁移到嵌套 `cfg.bg.blur` / `cfg.torn.jitter` / ... 命名空间，搭 schema-driven `renderInstrumentPanel(frameId)` harness（[设计稿 rev.3](../docs/frame-instruments-rev3.html) 章节 03）。preset / share-code 走 alias 表迁移，保 v:1 兼容。这是真正兑现「frame 文件是自治模块」的最后一步。

---

## 1.6.0 · 2026-05-29

**instax 升级为可调拍立得 · 仪器面板第 6 台** —— Phase 6 of the per-frame instrument language（[docs/frame-instruments-rev3.html](../docs/frame-instruments-rev3.html)）。把 instax 相框从「2 个 hardcoded 常量 + 没 decorate」变成「4 根真旋钮 + 第一个新画的 decorate hook」。这是 rev.3 标的"风险最高"的 phase——slab 是唯一会真实改变 layout 数学（fg 位置 + caption zone）的参数；其他 5 台仪器的所有旋钮都在 decorate 里活，不动 layout。

### 📷 instax · 4 根新旋钮

- **`cfg.instaxSlab`** (60–360 base-1440 px，默认 240) · 底部留白深度。是这一波唯一**真改 layout**的旋钮——`layoutOpts.extraBottom` 在 `clientRender.js` + `worker.js` 接收 cfg 覆盖，进入 `computeLayout` 重新算 fg 位置 + caption zone。调小得到"边窄"的现代 mini Evo，调大得到"大白边"的复古 polaroid 既视感。
- **`cfg.instaxTint`** ('pure' / 'cream' / 'aged'，默认 'pure') · 相纸色调。3 档枚举对应 #fffdf6 / #f5ecd6 / #eddcb8——`resolveRenderParams` 在解析 bg 时按相框的 `tintColors` 查表替换 `bg.color`。从纯白到奶油到陈旧泛黄。
- **`cfg.instaxStamp`** (boolean，默认 false) · 日期戳。新画的 decorate hook（instax 之前没有 decorate）从 EXIF 解析日期，按 `'YY·MM·DD` 格式（实际 instax mini Evo 的打印格式）画在底部留白右侧。
- **`cfg.instaxRainbow`** (boolean，默认 false) · 彩虹条。decorate hook 在底部留白左侧画 4 色彩虹方块（#ff6b35 / #ffc857 / #7fbf6e / #4595d0）——真 instax 包装的标志性视觉。

### 🎛️ instax 仪器卡

C · 仪器面板第 6 张卡，**奶油塑料拍立得正面**：#fffdf6 卡纸 + 多 multiply 纸纹噪点，底部左侧带 absolute 定位的小彩虹条 signature。橙色 #ee6a39 nameplate tag + Fraunces 斜体 "Instax mini" 大字。Thumb 是**奶油塑料厚块**（24×28 圆角矩形 + 双向阴影），落在浅灰极细轨道上。Toggle 是 FUJI 橙填充胶囊；swatches 是 3 个对应实际相纸色的圆色块。

### 🔧 实现注释

- 这一版 layout 数学**第一次**接收 cfg 覆盖。之前 `computeLayout` 的 opts 是 frame 给的死值（`extraBottom: 240`），现在 `clientRender + worker` 都在传给 computeLayout 之前 `if (cfg.instaxSlab != null && cfg.frame === 'instax') layoutOpts.extraBottom = ...` 截胡。这是为后续允许其他 frame 也参数化 layout 数学开的口子。
- `frame.instax.tintColors` 是新引入的"frame 提供的 enum 查表"模式——为后续 slide-mount 的 mountColor / outerRing 等 enum 旋钮提供前例。
- instax 第一次有了 decorate hook。原本它只是"bg + layout + 没有装饰画"的极简 frame；现在 stamp + rainbow 作为 cfg-toggle 的纯加成画，不影响 layout。
- C · 仪器面板进度：5/7 → **6/7**。剩下 slide-mount 一台。
- service-worker `CACHE_VERSION` 走到 v49。

---

## 1.5.0 · 2026-05-29

**film-35 升级为可调电影胶片 · 仪器面板第 5 台** —— Phase 7 of the per-frame instrument language（[docs/frame-instruments-rev3.html](../docs/frame-instruments-rev3.html)）。把 film-35 相框从「4 个 hardcoded 常量」变成「4 根真旋钮」——齿孔密度、胶片颗粒、DX 边印开关、帧号样式。C · 仪器面板里现在能看见第 5 张穿着拉丝钢 + Kodak 红 + 滚花金属药丸 thumb 的仪器卡了。

### 🎞️ film-35 · 4 根新旋钮

- **`cfg.f35Sprocket`** (0.5×–2.0×，默认 1.0×) · 齿孔密度乘数。沿用现有的 `numHoles = clamp([8,32], fgW / pitch)` 几何，调小让齿孔变稀疏（IMAX 大画幅风）、调大让齿孔变密（8mm 家用机风）。
- **`cfg.f35Grain`** (0–1，默认 0) · 胶片颗粒强度。新增的 `R.fillGrain` 公共 helper（`shared/render.js`）用 64×64 噪点 tile + overlay blend 给整张画布盖一层化学颗粒。100% 上限阿尔法 0.32——重也不会变成电视雪花。
- **`cfg.f35EdgePrint`** (boolean，默认 true) · 顶部 "BRAND · 400T · DX" 胶片标识能不能关——关掉得到"未冲洗 leader"质感。
- **`cfg.f35FrameNo`** ('xx' / '1-36' / 'a-z'，默认 '1-36') · 底部帧号样式。`24A`（电影半帧编号默认）/ `XX`（匿名未编号）/ `R`（字母 A–Z 周期，按日期日推算）。

### 🎛️ film-35 仪器卡

C · 仪器面板里的新成员，**拉丝钢顶板**：125° 五段渐变（深→浅→高光→浅→深）+ 90° 重复线性渐变模拟刷痕 + 噪点 overlay。Kodak 红圆点 + "FILM · 35MM" mono 大写 nameplate + "TOP PLATE" Fraunces 大写副标。Thumb 是**滚花金属药丸**——36×18 钢色四段渐变 + 内嵌 repeating-linear-gradient 模拟滚花纹 + 中央红刻线，停在深钢色细轨上。Toggle 是 Kodak 红填充的胶囊开关；stepper 是黑底红激活的三档分段按钮。

### 🔧 实现注释

- 新增 `R.fillGrain(ctx, x, y, w, h, opacity)` —— `shared/render.js` 公共 API，所有 frame decorate 都能调（worker 用 OffscreenCanvas、主线程用 HTMLCanvasElement）。原本只在 `clientRender.js` 私有的噪点能力现在升级到 shared 层。
- film-35 decorate hook 现在读 `args.params.film35.*`；legacy 调用 (`args.params` 缺失) fallback 到 1.4.x 的 hardcoded 常量，smoke baseline 在数学上等价。
- C · 仪器面板现有 5 台仪器：frosted-noir / torn / film-mf / gallery-white / film-35。还差 2 台 (instax · slide-mount) 沿同一架构补齐。
- service-worker `CACHE_VERSION` 走到 v48。

---

## 1.4.0 · 2026-05-29

**C · 仪器面板 顶层化 · gallery-white 升级为可调 passe-partout** —— Phase 4+5 of the per-frame instrument design language（见 [docs/frame-instruments-rev3.html](../docs/frame-instruments-rev3.html)）。1.3.x 把 frosted-noir / torn / film-mf 三台仪器穿上了物质外壳，但它们还藏在 B · Frame 底部的折叠抽屉里；这一版把整套 Advanced 升级为 workshop 顶层的「C · 仪器面板」section——永远可见、跟着相框切换、不用展开任何东西。同时把 gallery-white 从"4 个 hardcoded 常量"变成"4 根真旋钮"。

### 🎛️ 顶层化 · C · 仪器面板

- **从 B · Frame 抽屉升级为顶层 section**：原本 frosted-advanced / torn-advanced / film-mf-advanced 是埋在 B · Frame 底部的 `<details>` 折叠抽屉——要先滚到 B 底部再点开。现在它们升级为顶层「C · 仪器面板」，**永远展开**、永远可见。切换相框 = 看见对应仪器的房间，0 click cost。
- **`<details>` 改为 `<section>`**：3 个面板不再有可折叠 summary——summary chrome 让位给 C section 自己的标题（Fraunces 斜体 + 红色 mono eyebrow「C」标）。视觉上读为「这是一台仪器房间」而不是「这是又一个折叠抽屉」。
- **shadow-advanced 保留在 B · Frame 底部折叠**：阴影是跨相框的几何参数（不属于任何一台仪器的"性格"），按 rev.3 设计原则继续留在 B 里。

### 🖼️ gallery-white · 4 根新旋钮

- **衬纸宽度** (`cfg.galMatWidth`, 8–60px) · **双线间距** (`cfg.galLineSpacing`, 4–24px) · **线条粗细** (`cfg.galLineWeight`, 0.5–2.4×) · **线条颜色** (`cfg.galLineColor`, 墨色 / 炭灰 / 暖棕)。
- 原本 gallery-white 的 passe-partout 双线是 frame 内部的 hardcoded 数字（衬纸 26、间距 18、粗细 1.0、墨色），现在每张照片都能自己调——从"几乎看不见的细线" 到 "建筑事务所厚衬纸"，从精确数学制图风到温暖手工书装风。
- 仪器卡视觉延续设计语言：**暖米色板 + 双层 passe-partout 边线包裹整张卡**（呼应它绘制在照片周围的同款细线），Fraunces 斜体标签、JetBrains Mono 数值读出、奶油白小方块 thumb 落在暗墨细轨上。

### 🔧 实现注释

- `frames/gallery-white.js` 的 decorate hook 重写为读 `args.params.galleryWhite.*` (legacy 调用 fallback 到 hardcoded，smoke 基线不漂)。
- 所有 cfg key 仍是扁平命名（`galMatWidth` 等）——下一波会把 9 个扁平 key 统一迁到 `cfg.bg.* / cfg.torn.* / cfg.filmMf.* / cfg.galleryWhite.*` 命名空间，并在 frame 文件里声明 cfg schema 让 harness 自动织入（[设计稿 rev.3](../docs/frame-instruments-rev3.html) 章节 03）。
- service-worker `CACHE_VERSION` 走到 v47。

---

## 1.3.1 · 2026-05-29

**相框高级面板 · 全套乐器外壳上线** —— Phase 3 of the per-frame instrument design language（见 [docs/frame-instruments-design.html](../docs/frame-instruments-design.html) rev.2）。1.3.0 给 frosted-noir 落地了 channel-strip 编辑台；这一版把 torn 和 film-mf 的 Advanced 面板也穿上各自的物质外壳，让"打开这个相框的高级设置"在视觉上真的像"打开那台仪器的面板"。

### 🎛️ Advanced 面板 · 三个房间

- **torn · 牛皮纸工作台**：打开后是一块带<em>不规则撕痕顶边</em>（clip-path 多边形）的牛皮纸卡片，纸面有 fractalNoise 纤维纹理；标签用 Special Elite 打字机体；滑块 thumb 是<em>带炭笔印章的牛皮纸方块</em>（内嵌 SVG），落在暗炭笔色轨道里。Reset 按钮也换成炭笔描边样式。
- **film-mf · 图书馆档案**：打开后是一块<em>陈年米黄相纸</em>（径向渐变 + 5 处随机 foxing 斑点 + 对角光线衰减），右上角带馆藏登记号「Archive · vol. iv / MF · 6×7 · 1974」（Fraunces 斜体 + JetBrains Mono 配排）；标签用 Fraunces 斜体；滑块 thumb 是<em>黄铜镶边圆钮</em>（径向金属渐变），落在 sepia 浅刻槽里。
- **frosted-noir · 编辑控制台**（向后兼容微调）：1.3.0 的 5 通道 rack 现在被包在一层<em>冷调钢蓝</em>卡片里（轻量纵向 magazine grid 线），跟另外两个面板形成"三张卡片各自一种物理"的视觉系列感。已有的 channel-strip 行为 100% 保留。
- **summary 左侧 2px 颜色条**：三个面板的折叠条左边各加了一道 frame 主色——frosted-cool / kraft / sepia——折叠状态下也能从颜色看出这是哪台仪器的房间。

### 📚 字体新增

- 顶部 `<link>` 加载了 **Fraunces italic** 和 **Special Elite**——前者给 film-mf 标签当馆藏花体，后者给 torn 标签当工作台打字机体。两个都来自 Google Fonts，本来 Fraunces roman 就在工程里加载，只是补了 italic 轴。

### 🔧 实现注释

- 所有 `<input type="range">` id 完全不变（torn-jitter / torn-step / torn-edge-opacity / film-mf-age），仅替换外层 wrapper class + 加 per-frame slider chrome (`.torn-slider` / `.filmmf-slider`)。事件 listener / syncControlsFromCfg / onFrameChange 一行没动。
- 触屏自动加大 slider hit target（torn 28→32 wide × 22→26 high；film-mf 22→26 round），桌面端保持精密手感。
- service-worker `CACHE_VERSION` 走到 v46。

---

## 1.3.0 · 2026-05-29

**每个相框是一台仪器** —— Phase 2 of the per-frame instrument design language (see [docs/frame-instruments-design.html](../docs/frame-instruments-design.html)). 把 frosted-noir 的"高级 · 毛玻璃参数"区从 3 根松散的 slider 改造成 **5 路 channel-strip 编辑台**，同时把两个一直 hardcoded 在渲染管线里的参数（压暗 · 颗粒）作为真正的旋钮升上来给用户掌控。

### 🎛️ frosted-noir · 5 通道控制台

- **新增旋钮**：`cfg.bgDarken`（CH·4，0–0.7）和 `cfg.bgGrain`（CH·5，0–0.5）。原本是 frame 内部常量，现在每张照片都能自己拨——从原本的 0.22 / 0.14 出厂值可以一路开到漆黑 + 满屏胶片颗粒，也可以归零得到纯净的毛玻璃。
- **5 路 channel-strip 布局**：CH·1 Blur / CH·2 Brightness / CH·3 Saturation / CH·4 Darken / CH·5 Grain。每行 mono 通道号 + 标签 / 滑块 + 右侧 tabular 数值读出，行间细线分隔——视觉上读为一台仪器而不是 5 个独立 slider。
- **更精炼的 slider**：rack 内 slider 厚度从全局 12×12 thumb 改为 10×10 + 双环聚焦阴影。视觉降噪，5 行叠起来不打架。触摸设备自动放大到 14×14 保留 44px 触控目标。
- **预设兼容**：share-code / preset schema 仍是 v:1 additive——旧预设不带 bgDarken / bgGrain 字段时自动 fallback 到 frame 出厂值。

### 📚 设计文档

- [docs/frame-instruments-design.html](../docs/frame-instruments-design.html)（rev.2）—— 7 个相框的"乐器面板"完整设计语言提案：每台仪器有自己的 thumb 造型 / track 纹理（钢制药丸 / 奶油塑料 / 牛皮纸 / 黄铜旋钮），底层机制全部统一为横向滑块。本版落地的是第一台 frosted-noir，余下 6 台按熟悉度依次跟进。

---

## 1.2.0 · 2026-05-21

**移动端裁切交互整个推倒重做** —— 从「拖拽角的 handle」模型换成 iPhone 原生 Photos / Instagram / Lightroom Mobile 那种 **「Through the Aperture」（取景器后面拖照片）** 模型。1.1.x 的 handle UX 在 mobile 完全不可用：手指比 28px 的 bracket 粗，触摸后手指还把那个 bracket 完全挡住；「拽手柄=resize」vs「拽内部=pan」靠 hover 试探的判定在 touch 下根本无法运作。这一版抛掉历史包袱重新设计。

### ✂️ Compose · 移动端裁切完全重做

- **「Through the Aperture」交互范式**：aperture（裁切窗口）固定在屏幕中央，**照片在 aperture 后面被单指平移 + 双指捏合缩放**。aperture 是什么形状，裁出来就是什么形状。**完全没有需要捏住的 handle**，触摸任何地方都是 pan，不存在模式判定错乱。
- **暗罩 + 取景器边框**：aperture 外侧 `rgba(8,6,4,0.78)` 半透明暗罩通过 frame 元素的 `box-shadow: 0 0 0 9999px` 实现，无额外 DOM。4 个角加琥珀色 L 形小 bracket（大画幅取景器既视感）。
- **黄金分割辅助线**：拽动期间 aperture 内部叠加 rule-of-thirds 网格，松手 250ms 内淡出，专注构图。
- **捏合 HUD**：双指缩放时屏幕右侧浮现一个 amber 小牌子显示当前倍率（如「1.4×」），松手即隐。
- **比例 chip 改为黄铜小标牌**：每个 chip 内部画一个小填充矩形预览那个比例的实际形状（1:1 是正方形，9:16 是细高条，16:9 是矮宽条等），琥珀色激活，黄铜质感渐变 + 内嵌高光。Free 是虚线框；Custom 是省略号。切换比例时 aperture 边框琥珀脉冲 1 次锚定操作。
- **GPU 合成层渲染**：照片用 `transform: translate3d() scale()` 跑在合成层，pan + pinch 全程 60fps；松手时才把 transform 反算回归一化的 `cfg.crop` 并触发一次正常 render（不在每帧重画 canvas）。
- **照片占可见 ≥ 75%**：aperture 居中且偏左以避开右侧模式 pill 列。

### 🛠 工程改动

- **桌面端零改动** —— `@media (max-width: 700px)` 内的独立 markup（`<div id="compose-aperture-shell">`）+ CSS gating，桌面 handle 交互完全不动。
- aperture 模块约 400 行 JS（`APERTURE` 状态 + transform↔cfg.crop 数学 + Pointer Events 多指追踪 + 比例 chip 改写）。
- 预渲染 rotated bitmap 一次到 aperture 内部 canvas（rotation 已 bake，pan/pinch 数学只是 2D），随后 pan/pinch 只动 CSS vars。
- service-worker `CACHE_VERSION` v43 → v44。

## 1.1.2 · 2026-05-21

进入 Compose dialog 之后的**移动端交互重做**。1.1.0 把桌面 3-stack bench 布局原样塞进小屏，照片只占 viewport ~30%，工具栏吃掉 70%；1.1.1 修了入口可见但没解决进去之后的拥挤。这次把 mobile Compose 重排成 native 范式 —— 照片占 ≥ 70%，模式切换悬浮，数字编辑折叠。

### ✨ 移动端 Compose dialog 完全重做

- **模式切换悬浮在照片右侧**：4 个 pill（裁剪 / 边距 / 旋转 / 数值）垂直叠在照片右上方，`position: absolute` 不挤压照片宽度。激活 pill 琥珀色填充，48×56px 触摸目标。取代了之前把 3 个 mode "藏" 在 bench module 卡片里的隐式切换。
- **数字调整默认折叠**：W/H/T/R/B/L/° 这些 input 在 mobile 默认不显示，点 `≡` 数值 pill 弹一个底部 sheet 输入精确值。**95% 的 mobile 操作通过手感拖动完成**，5% 需要精确的用户走 sheet 走 numeric pad。
- **裁剪 chip 横向滚动**：8 个比例 chip 不再 wrap 到 2 行，改 `overflow-x: auto` + `scroll-snap-type: x mandatory`，全部摆一行可 swipe 浏览；右侧渐隐 mask 提示「还有更多」。
- **边距改 4 条滑块 + 左右同步**：四边胶囊推条 14×40px 在 touch 下根本拖不动。改成跟桌面端一致的 **4 条水平滑块**（T / R / B / L 各一条 0–300），HUD 跟手 bubble 实时显示数值；**默认左右同步** —— 左右两条滑块 ① 共用一个值，② 顶部带「🔗 左右同步」浮动勾选框可一键解锁独立调整。需要精确数值时仍可点 `≡` 弹底部 sheet 输入。同时 photo 上的 capsule handle 在 mobile pad mode 下完全隐藏（视觉不再拥挤）。
- **旋转保留 360° slider**：mobile 下 slider thumb 22×22 加大、quick 按钮 40×40。
- **HUD 跟手 bubble 在 mobile 避开手指**：拖动期间 bubble 默认偏移到手指 **右上方 30/60px**，越界自动翻转到左下，避免被手指挡住读数。
- **底部 Cancel/Apply 行**：取代桌面 bench 的 Cancel/Apply 列，单行紧凑布局。Apply 是 amber CTA 70% 宽，Cancel 30% 描边按钮。

### 🛠 工程改动

- 移动端断点（`max-width: 700px` + `max-height: 500px and landscape`）独立 markup —— 新增 `<nav id="compose-mode-pills">` / `<div id="compose-mobile-pad-strip">` / `<div id="compose-mobile-actions">` / `<div id="compose-numeric-sheet">`，桌面 bench 原样保留（`display: none` on mobile）。两套 UI 共享同一份 cfg state 和 setFocus / applyAspectChip / setRotationDeg 等 JS handler，零代码逻辑分叉。
- service-worker `CACHE_VERSION` v42 → v43。CSS shell 大变需要推给老用户。



1.1.0 发版后立刻发现的移动端入口问题修复。

### 🐛 移动端构图入口不可见

[#29](https://github.com/anois/photo-tools/pull/29) 把「构图」做成 lookbar 第 6 独立块（桌面端正常），但移动端 lookbar 是固定 3 行 grid（风格 / [导入+chip] / 导出），没给新按钮显式定位规则。CSS 把它 auto-place 到溢出的第 4 行底部，clipped 到 viewport 外 —— **移动端用户根本看不到「构图」入口**。

修复 —— mobile lookbar 扩到 4 行（148 → 200px），构图作为 row 2 全宽 strip，与 row 1 LOOK strip 视觉同级，对应桌面"第 6 独立块"意图。每行 44px 保证 WCAG 触摸目标，付出的 +52px 高度成本与 0.18 加入 LOOK 时的 +44px 同等量级（per-photo 热路径享受拇指区位置）。

## 1.1.0 · 2026-05-19

把"裁剪 / 旋转 / 边距"三件事合并成一个 **构图模式（Compose）**，作为 lookbar 第 6 个独立块（与 LOOK / 4 个 lookchip 并列）。设计语言：**暗房工作台 + 大画幅 ground glass** —— 暖深棕底 + 单一琥珀色 safelight，照片"悬浮"在画面中央。**三种操作严格互斥**：先点击底部对应模块（裁剪 / 边距 / 旋转）激活该工具，再在照片上执行操作 —— 避免"全部同时可点"导致的干扰和误触。

### ✨ 构图模式 · 全新外部层级功能

- **三模式互斥**。底部工作台的 3 个模块（裁剪 / 边距 / 旋转）就是工具切换器，点哪个激活哪个；激活的模块顶部出现琥珀色 hairline，其他模块下沉为只读读数。激活的模块决定照片上能干什么 —— 其他工具的手柄都 `pointer-events: none`，无法误触。
- **裁剪模式**：照片四角的琥珀色角括号 + 四边中点小针生效；拖角落收紧裁剪；拖照片内部平移裁剪框。**底部悬浮预设比例 chip 条**：自由 / 当前画幅 / 1:1 / 3:4 / 4:3 / 9:16 / 16:9 / 自定义（点"自定义"复用外部画幅 picker 同一个 `<dialog id="aspect-modal">` 输入框，支持任意 W:H 数值）。锁定比例时角落拖动按等比保持，边中点针自动隐藏避免歧义。
- **边距模式**：照片四边的胶囊推条生效；推条向内 / 向外移动，改变对应边的 padding 值。
- **旋转模式**：照片上所有手柄消失，舞台下方出现 **360° 拖拽条**（参照原有 crop modal 的 rotate-bar 范式但配色调到暗房调色板）：`-180° ~ +180°` range slider + 两侧 ↶ ↷ 90° 快捷按钮 + 实时角度读数 + 「归零」按钮。**任意角度都可以**，<0.4° 时自动吸附到 0°。
- **每边可独立的边距**：`paddingTop / paddingRight / paddingBottom / paddingLeft` 加入 cfg + LOOK_KEYS，preset / share-code 自动覆盖（v:1 schema 保持向后兼容，老 preset 全部 null = 不影响）。
- **frame.minPadding 软提醒**：film-35 / film-mf / slide-mount / instax 各自声明了"画框正常运作所需的最小边距"。拖拽低于该阈值时画框对应边出现淡红警示带 + 工作台数字变红 —— **不阻止**，只提醒。
- **拖动期低分辨率渲染**：拖动期画布从 customScale=0.5 降到 0.2，像素量 1/6，帧时延从 ~50-80ms 降到 ~10ms 量级；松手后 120ms settle timer 自动恢复高清渲染。`cfg` 是分辨率无关的（crop 0..1、padding base-1440 px、rotation 度），所以同一份 cfg 在两种 scale 下几何完全一致。
- **手柄走 GPU compositor**：所有手柄 / 中心十字定位从 `style.left/top` 切到 `transform: translate3d()` —— 提升到合成器层，定位更新跳过 layout + paint。`will-change: transform` 在所有相关元素上提示合成器。
- **工作台数字可编辑**：CROP W/H、PAD T/R/B/L、ROT 度数全部是 `<input type="number">`，对追求精确的用户友好。
- **测量 HUD**：拖动手柄时跟随光标的小琥珀牌子实时显示当前数值 + 推荐下限 + warn 状态。
- **键盘**：`1`/`2`/`3` 切换模式、`R` 全部重置、`Esc` 退出。
- **移动端平权**：触屏手柄拉到 ≥ 44×44，工作台栏 2×2 + 操作行布局，rot bar 在小屏紧凑化。

### 🛠 工程改动

- `R.computeLayout` 新增 `opts.paddingTop / Right / Bottom / Left` 接口；非 null 的边覆盖 `padding` 标量 + 帧的 `topPaddingBoost` / `bottomPaddingBoost`（按上一节"用户最终决定权"的策略）。
- `CR.renderPreview` 新增可选 `args.customScale` 覆盖（默认仍是 PREVIEW_SCALE = 0.5）。Compose 模式拖动期注入 0.2。
- `frame.minPadding` 字段加在 `R.registerFrame` 的 def 上，base-1440 单位。
- 顶栏「构图」入口按钮：未导入照片时禁用。已有 crop / rotation / padding 调整时，按钮的副标题摘要为 `裁 · 旋 30° · 距` 一目了然。

## 1.0.1 · 2026-05-17

云相册两个 1.0 后才发现的 bug。

### 🐛 移动端无法打开云端画廊

0.25.0 拆云端配置 / 画廊为两个 UI 层级时，让顶栏 ☁ pill 只触发 config modal、lookbar 的「云端读取」hero 触发画廊。但那个 hero 在移动端断点是 `display: none`（lookbar 是固定 3 行 grid 没有第 4 个 hero 位置），结果**移动端没有任何进画廊的入口**。

修复 —— 把顶栏 ☁ pill（两端都可见）改成统一的"云端入口"智能路由：配置可用就直接打开画廊，否则落到 config modal。桌面端 lookbar 的「云端读取」hero 也走同一路由，两端行为一致；要明确改配置时用画廊 header 上的 ⚙ 按钮。

### 🐛 lightbox 显示的是缩略图大小，不是原图大小

`refreshGallery` 之前只 LIST `_thumbs/` 子目录，gallery item 的 `size` 字段被错填成了缩略图（~50KB JPEG）的字节数，lightbox 底部一行 `1000021023.jpg · 48.5 KB` 完全是误导 —— 用户准备点「下载」时看到的应该是原图字节数。

修复 —— 改成 LIST 整个 prefix 一次（仍是单 round-trip），客户端按 `_thumbs/` 前缀拆成原图 + 缩略图两组，按文件名匹配回填 thumbKey。`item.size` 现在是原图字节数。

## 1.0.0 · 2026-05-17

### 🎉 第一个稳定版

把 0.x 阶段累积下来的引擎 / UI / 资产产品边界画下来 —— 1.0 = 这套形态稳定，可以基于它做长期使用 / 分享 / 二次创作了。版本号跨过 0 区段，但**没有任何破坏性变更**：cfg `v:1` 不动，所有 0.x 存下来的 preset / share-code / 云相册分享链接都继续解析。

引擎层视作 feature-complete：
- **7 个相框 × 4 个家族**（编辑 / 画廊 / 即影 / 胶片三连）+ **11 个字幕模板 × 4 个语法**（Spec / Brand / Editorial / Stamp）
- **DIY 渲染引擎**：每一个渲染参数都从 UI 可达、能存进 LOOK preset / share-code，不存在"只能在精选预设里看到却调不出的旋钮"
- **LOOK 一级入口**：左轨独立 LOOK 区块 + 5 个调到位的种子预设 + 我的预设 + 一键分享 / 粘贴
- **S3 云相册**：上传 / 画廊 + 灯箱 / 单张 + 多张打包下载 / 凭证分享链接（AWS / R2 / 阿里云 OSS 三家）
- **PWA**：service worker 离线壳 + i18n 中英文 + EXIF 完整 round-trip
- **桌面与移动同等公民**：各自的手势语法不互相缩放派生

### 📖 项目仓库面向公开访客升级

之前的 README 是给早期使用者看的"功能清单"，1.0 改成给 GitHub 路过者 30 秒决定"试 / 不试 / 收藏"的产品页：

- **新增 `LICENSE` 文件 · MIT 协议**，README 同时列出第三方资产各自的 license（Inter / 品牌 logo / 各 vendored 库），让 fork / 借鉴的人能一眼判断边界
- **新增 5 张精选相框样张**到 [`data/samples/`](data/samples/)（`film-mf` / `slide-mount` / `film-35` / `torn` / `frosted-noir`），README 顶部一整排陈列；每张同时有 720px `*_preview.jpg` 缩略图给 README 内嵌
- **新增 6 张应用 UI 截图**到 `docs/screenshots/`（桌面主界面 / LOOK picker / 工作台 / 裁剪 modal + 移动主界面 / 移动 LOOK picker bottom sheet），README 「Screenshots」分区陈列
- **README 双语**重写：英文版作为 canonical，中文版逐节镜像；badges 加 `release-1.0.0` / `license-MIT` 两条
- **部署章节**里的"阿里云 OSS 国内镜像配置"折叠进 `<details>` —— 给真要部署到国内的访客留全步骤，但不再占首屏

> **从 0.x 升上来**：什么都不用做。打开应用就是 1.0.0，原有的 LOOK preset / share-code / 云相册配置原样可用。✦ pill 顶上会有 accent 红点提示有新版本，点开就看到这一页。

## 0.25.1 · 2026-05-17

### ✂️ RAW 按钮归位到云端画廊

之前 lookbar 上的 RAW（导出原图）按钮和云端画廊的使用语境对得上但和"成片 / ZIP"并列站在导出区里读起来割裂——本地胶卷里的源文件，用户从硬盘本来就有；真正的"原图下载"场景永远发生在云端浏览。这次：

- lookbar 移除 **RAW** 按钮，导出区回到 [成片 / ZIP] 两个本地操作
- 云端画廊 lightbox 底部增加 **「下载」** 按钮 —— 已在浏览这张大图，一键拿原图到本地。若灯箱已经把原图加载进内存，直接走缓存 blob，不再二次 GET
- 云端画廊工具栏增加 **「下载所选」** 按钮 —— 多选 N 张原图打包为 ZIP（命名：`<bucket>-YYYYMMDD.zip`），复用 progress modal 显示进度（与上传一致的视觉）。N=1 时短路成单张直接下载

技术细节：
- `Exporter` 模块的私有 `triggerDownload` 暴露为 `Exporter.downloadBlob(blob, name)`，给画廊的下载路径共用，不必复制 anchor-click 逻辑
- ZIP 走 `compression: 'STORE'`（输入大多是 JPEG/HEIC 已压缩字节，deflate 收益<2% 但 CPU 成本明显）

## 0.25.0 · 2026-05-17

### ☁️ 云端画廊重做：从 modal 升级为独立"页面"+ 大图灯箱

之前云端配置和画廊塞在同一个 dialog 的两个 tab 里 —— 配置是临时性操作（左/右滑一下就走），画廊是长时间浏览操作，两者强行同居视觉权重打架。这次拆开：

- **配置 = 顶栏右上角 ☁ pill 触发的轻量级 dialog**（窄一档 540px），只装 Bucket / 凭证 / CORS 指引。是个"右上角小工具"风格的元素，不抢主舞台
- **云端画廊 = 独立的 `<section id="cloud-gallery-pane">`**，与 canvas-pane 是兄弟节点，共享中间列。点 lookbar 的「云端读取」按钮时画布 pane 隐藏、画廊 pane 显示，lookbar + rail 留在原位

### 🖼 重做的画廊视觉

- **大缩略图**：4:5 比例（180px minmax），保留更多照片比例感；hover 上浮 + accent 投影
- **独立选中复选框**：右上角 22×22 圆角方框 —— 单击 cell 主体进灯箱大图预览，单击复选框只切换选中态，两个动作不再混淆
- **顶部 header**：返回 / 标题 / Bucket-路径标签 / ⚙ 配置入口（直接打开 config modal，不离开画廊上下文）
- **工具栏在 header 之下**：上传当前胶卷 / 上传本地 / 刷新 / 已选 N 张 / 加载所选

### 🔍 灯箱预览

- 点缩略图进 lightbox：左右 nav 按钮 / 关闭按钮 / 底部文件名 + 大小 / 选中按钮
- **渐进加载** —— 先显示已缓存的缩略图（瞬时），后台 GET 原图，加载完成自动 swap；导航换张时之前的原图 blob URL 立即 revoke 不漏内存
- **键盘**：← / → 切换，Space 切选中态，Esc 关 lightbox / 退出画廊
- 上方的 ⚙ 按钮可以在不离开画廊的情况下打开配置 modal（配完保存 → modal 关 → 画廊继续）

## 0.24.2 · 2026-05-17

### ☁️ 上传进度 modal + 本地批量直传

之前上传到云端时进度只在状态栏一行字滚动，看起来像"卡住了"。现在复用导出用的 progress modal 显示完整进度（计数器 + 条 + 当前文件名 + 失败列表），跟批量导出一致的视觉语言。

新增 Gallery 工具栏的「上传本地文件」按钮：直接从硬盘多选文件批量上传到云端，**不进入当前胶卷**。常见用法 —— 把整个文件夹的旅行照一次性备份/分享给朋友，自己手头不需要先 import 到 rail。HEIC 文件按原样上传（缩略图侧自动 transcode 成 JPEG 才能给浏览器画廊用），下载回来时跟本地 import 一样走 HEIC 转码路径。

技术细节：
- `ProgressModal.open(total, keys)` 接受可选的 i18n key 覆盖，上传路径用 `s3.upload.*` 系列文案替换默认的 `export.*`，跨用例复用同一个 dialog 不再硬绑导出语义
- 上传按钮共用 `uploadFiles(files)` helper —— 「上传当前胶卷」喂 `state.files.map(e=>e.file)`、「上传本地文件」喂 `<input type=file>` 拿到的 array，逻辑与失败聚合完全一致

## 0.24.1 · 2026-05-17

### ☁️ 云端读取提升为 lookbar 一级入口

之前"从云加载照片"只藏在顶栏一个小 ☁ pill 里，与"本地导入"那个 hero 按钮的视觉权重完全不对等。这次在左轨 `Import` 按钮正下方加 **「云端读取 / From Cloud」** 按钮，同样的 padding、字号、字母间距 —— 两个按钮读作"这张照片打哪儿来？"的孪生选择。

- 视觉差异 = outline 变体：透明背景 + accent 描边 + 空心 glyph，与 Import 的填充实心 accent 形成"两个等位但不同来源"的对比，不是"主+次"
- 点击直接跳到 S3 modal 的 Gallery tab（如果配置可用），否则落到 Config 让用户先填好 —— 一键达到目标
- 手机端 lookbar 是固定 3 行 grid 没多余位置，新按钮自动隐藏；顶栏 ☁ pill 继续做手机端唯一云端入口

## 0.24.0 · 2026-05-16

### ☁️ S3 云相册 · 上传 / 分享 / 远程加载

顶栏新增 **☁ Cloud** 入口。把照片上传到自己的 S3 兼容存储（AWS S3 / Cloudflare R2 / 阿里云 OSS），生成一条带凭证的分享链接发给朋友 —— 对方打开链接后，画廊自动弹出，勾选任意张就能加载到自己的胶卷里继续做图。

- **配置面板** —— 服务商单选 + Region / Bucket / Folder / AccessKey / Secret；endpoint 按服务商自动拼接但可手改。"测试连接"一键拉一条 list 验证 CORS 是否放开了本站域名
- **完整配置指引** —— 面板里折叠一段「建桶 → 拿 AccessKey → 配 CORS → 填字段」的分步引导，随当前选中的 provider 自动切到 AWS / R2 / OSS 各自控制台的具体路径 + 直接可复制的 CORS 模板（含本站 origin 已填好），把"我应该怎么从零开始"这一步从外部搜索变成 modal 内一屏读完
- **上传当前胶卷** —— 自动给每张同时生成 480px JPEG 缩略图 + 原图各传一份，缩略图存到 `<prefix>/_thumbs/` 子目录加速画廊加载
- **画廊视图** —— 多选缩略图，点击"加载所选到胶卷"会把原图 GET 回来重新喂进 `mergeFiles` 走完整 EXIF 解析流程
- **分享链接** —— `#s3=<base64url>` 形式，编码完整配置（含凭证）。链接复制时弹一个明显的安全提示："此链接含读写凭证"
- **localStorage 持久化** —— 配置自动存到 `phototools.s3Config`，下次打开自动恢复

技术细节：
- 签名走 [aws4fetch](https://github.com/mhart/aws4fetch)（vendored, ~12KB UMD），首次打开面板才懒加载，从不入 service-worker precache
- 没有后端 / 中间层，所有 PUT / GET / LIST 都从浏览器直签直发
- Aliyun OSS 用 S3-兼容入口 + virtual-hosted 主机名，签名时 region 自动剥 `oss-` 前缀

> ⚠️ 分享链接 = 完整读写权限。仅在信任的小圈子里分享；公开发布前请改用 CORS 严格限定域名 + 只读 IAM。

### ✂️ 导出原图（不渲染）

导出区新增第三个按钮 **RAW** —— 直接把当前胶卷选中的源文件下载下来，不经过画布渲染 / 加 caption / 重写 EXIF。配合 S3 云相册的"加载远程"流，常见用法：从云端拉回原图 → 直接下载到本地 → 用其他工具二次处理。

## 0.23.0 · 2026-05-16

### 🎞 幻灯片相框 · `slide-mount`

新增第 7 个相框 —— 模拟装裱幻灯片的质感。胶片家族从两个变三个（35mm 负片 + 中画幅印品 + 幻灯片），覆盖完整模拟胶片生命周期。

视觉栈（外 → 内）：
- **深酒红外圈** —— `#3a1822` 暗色"载片台"边框，28 base-px 环绕画布四边
- **仿皮革乳白卡纸** —— `#e6dac0` 暖色卡纸底色 + 三层 deterministic 颗粒（500 颗暖色高光小点 + 350 颗深褐细纹 + 15 块大面积柔光斑），按几何 seed 生成、按 even-odd 剪辑只绘制在卡纸边缘外（不污染照片）。整体读作压花皮革质感，不是噪点
- **照片边界物理感** —— 卡纸沿照片四边各画 6 base-px 的 chamfer cues：上+左浅色高光（凿边吃光）/ 下+右暗色阴影（卡纸背面渐变到凹陷）。照片边一根重 hairline，照片内上+左两阶暗色渐变（24 base-px 深，模拟卡纸厚度投到凹陷里的阴影）。整体读作"照片被凿进卡纸里"的实物厚度感

文字交给项目标准的 caption 模板系统 —— 不内嵌固定字标，用户任意挑模板（date-lens / minimal-text / tech-stack …）都会渲染到卡纸底部的留白区域。

### ✨ 精选预设 +1 → 5

- 🎞 **幻灯片**（`slide-mount-print`） —— frame=`slide-mount` + template=`date-lens` · 4:3 · 极简 date · lens 字幕

## 0.22.0 · 2026-05-15

### ✨ 精选预设库重做 · 7 → 4

旧的 7 个工厂预设大多是"相框 + 模板 + 几乎默认参数"的组合，没有真正调到位的最终观感。这一版砍到 4 套精炼预设，每一套都体现一种可识别的真实美学，每个 LOOK_KEYS 字段都是刻意设过的，新增旋钮都被用到了。

- **夜色毛玻璃** ✨ `frosted-noir` + tech-stack · 3:4 · 圆角 44 · 重投影
- **撕纸** 📜 `torn` + date-lens · 9:16 · 顶部 FUJIFILM·X-T5 标识 · 深撕 / 中密度 / 强暗边
- **35mm 胶卷** 🎞 `film-35` + tech-stack · 9:16 · 水印嵌入图片 · 水印离底部 32px 留白
- **银盐印品** 📽 `film-mf` + slate · 9:16 · 暗房印品语言

### 🆕 顶部品牌标记 · `topTemplate`

任意相框都能在上方留白处加一行品牌身份标记。E · Top 新区块的 picker 选择呈现方式：

- **None** — 不加（默认）
- **品牌·型号** — 例如 FUJIFILM · X-T5（撕纸预设默认开）
- **品牌** — 仅 logo
- **字标** — 大号纯字（找回旧 Kodak Professional 相框那种字标语言）

走 LOOK_KEYS，被预设 / 分享码捕获，切相框时重置为 None。

### 🆕 水印嵌入图片 · 离底距离

`水印嵌入图片` 开启后多了一个滑块：水印离照片底边的距离（0–120px，base-1440 单位）。半透明渐变背景仍贴底，但文字基线在渐变内向上抬。35mm 胶卷预设默认 32px。

### 🪒 相框库瘦身 · 12 → 6

为了让出品的 frame 都"高度可用"，砍掉了识别度低 / 与现存功能重叠的 6 个相框：

- `frosted`（与 `frosted-noir` 仅深浅之差） · `polaroid`（极近 `instax`） · `gallery-noir`（同 `gallery-white` 的明暗倒换） · `editorial` / `editorial-mirror`（不对称布局难凭直觉触发） · `kodak-pro`（字标语言现在通过 `topTemplate=wordmark` 在任意相框上复刻）
- **`film-mf` 重做** —— 从原本的"120 胶卷 · 片头标签 + 帧号"重设计为「**银盐印品 · 复古褪色版**」：偏黄的 amber fiber 纸基底色（老纸自然黄化的色调）+ 照片上叠加 sepia 暖色调 + 左上角对角线方向的部分褪色（模拟挂壁照片几十年的光照漂白）+ 边角 vignette（处理痕迹氧化）+ 18 个随机散布在纸边的棕色 foxing 斑（铁杂质氧化痕迹，按几何 seed 确定性生成 → 同一张照片渲染多次斑点位置不变）+ 右下角手写库存编号。整体观感是「从抽屉里翻出的 50 年代印品」。**新增「复古程度」滑块**：选中 film-mf 时 B · Frame 显示「高级 · 复古印品」展开 panel，0–100% 单一标量同时缩放 sepia / 褪色 / vignette / foxing 强度。0 = 干净印品（只剩纸基 + 发丝线 + 手写编号），100% = 完全复古（默认）。slider 数值进 cfg + LOOK_KEYS，可被预设捕获

保留的 6 个：`frosted-noir` · `gallery-white` · `instax` · `torn` · `film-35` · `film-mf`

### ⚠️ Breaking

旧分享码 / 已保存预设里如果引用了已经下线的相框名，在加载时会自动迁移到最近邻：

| 旧名 | 迁移到 | 损失 |
|---|---|---|
| `frosted` | `frosted-noir` | 浅色变体（暂无 bg darken 滑块还原） |
| `polaroid` | `instax` | 极近，几乎无损 |
| `gallery-noir` | `gallery-white` | 黑白对换 |
| `editorial` / `editorial-mirror` | `gallery-white` | 右栏不对称布局（无替代） |
| `kodak-pro` | `gallery-white` | Kodak 字标（可手动开 `topTemplate=wordmark` 找回） |

旧的 4 个工厂预设（`film-35-authentic` / `magazine-editorial` / `hasselblad-tribute` / `leica-side-rail` / `kodak-professional` / `polaroid-classic` / `frosted-classic`）从工厂库下线。用户自己保存的预设不受影响。

## 0.21.0 · 2026-05-09

### 🪒 撕纸相框 · 高级自定义

毛玻璃相框过去就有「高级 · 毛玻璃参数」展开 3 个滑块（模糊 / 亮度 / 饱和度）。这一版把对等的能力补给撕纸相框 —— 之前撕纸的边缘抖动 / 密度 / 暗边都是相框定义里写死的常数，没法用户调。现在也能拨了。

- **「高级 · 撕纸纸面」展开** —— 切到撕纸相框时 B · Frame 显示新展开 panel，跟毛玻璃高级 panel 视觉对等
  - **撕扯深度**（`tornJitter`）：0–14px，控制每个采样点向内的最大抖动幅度。0 = 干净剪裁直边（剪刀切的）、6（默认）= 自然撕纸感、12+ = 啃过的边
  - **撕扯密度**（`tornStep`）：3–14px，控制采样点间距。越小 = 采样越密 = 边缘越细碎纤维感；越大 = 采样越疏 = 大块不规则撕扯（旧书翻折角的感觉）
  - **暗边强度**（`tornEdgeOpacity`）：0–0.5，沿撕纸边的暗色发丝线 alpha。0 = 完全无暗边（纯软裁剪外观）；0.22（默认）= 微微的纸纤维阴影；0.5 = 戏剧性的浓墨边
- **三个滑块都进 cfg + LOOK_KEYS** —— 每张照片可独立调，可被预设捕获，可通过分享码流通；老分享码不带这三个字段时落到默认值（向后兼容）
- **双击数值 → 单项恢复默认；底部 Reset → 三项一起恢复** —— 沿用毛玻璃 panel 的双击重置 + Reset 按钮 双 affordance
- **切相框自动重置** —— 同 bg / shadow / 圆角 的语义：换到别的相框时，撕纸 cfg 字段全清空到 null，避免下次回撕纸时旧值"幽灵复活"

引擎层 `resolveRenderParams` 现在产出第三个 params 块 `torn`（旁边是 `bg` / `shadow`）；torn 相框的 `tornClip` + `decorate` 通过 `args.params.torn` 读取。

无破坏性变更：preset / share-code schema 字段持续 additive。

## 0.20.0 · 2026-05-09

### ✨ 风格库提升为一级入口

把预设从「工作台 → 预设库 tab」三步操作的二级抽屉，提升为左轨 LOOK 区块的**一击可达**的一级入口。视觉上 LOOK 比 4 个调节型 chip 更大、走 Fraunces italic 名字 + ✦ accent mark + dashed-then-solid 边框，明确传达"这是元原语，先选 Look 再用下面 4 项微调"的层级。

- **LOOK 区块进左轨** —— Import 之下、Frame/Template/Aspect/Quality 之上，新增一行高 ~64px 的 LOOK 元原语 chip。Fraunces italic 字号 14.5px 显示当前应用的预设名（factory 带 emoji 前缀，如 🎞 35mm 胶片真），未应用任何预设时显示 `(尚未选择)` 灰斜体
- **风格库 picker** —— 单击 LOOK 弹出右滑 popover：上半 4 列网格的 ✦ 精选预设（7 款 emoji + Fraunces 名字 tile）、下半 list 形态的「我的预设」（Fraunces italic 名字 + mono caps frame·template 副标题 + hover 出现 ↗/× 操作）、底部固定 ✚ 保存当前为新预设 / ↗ 复制分享链接 / ⎘ 粘贴分享码 三个操作
- **修改痕迹追踪** —— 当应用某个预设之后，调任何一个 cfg 字段（圆角、padding、frame、模板等）都会让 LOOK chip 右上角出现 4px accent 红呼吸点，提示"已偏离这个 look，可以保存为新预设"。再次应用任何预设或保存为新预设后呼吸点消失
- **粘贴分享码新增直接入口** —— 之前只能通过 `#p=…` URL 在浏览器地址栏访问，现在 picker 底部一个按钮，从剪贴板（或粘贴对话框）读取分享链接 / 分享码直接应用
- **删除 workshop · 预设库 tab** —— workshop 抽屉从 5 个 tab 减到 4 个（微调 / EXIF / 签名 / 拼贴），workshop 语义聚焦在"deep adjust"，预设流转独立进 LOOK picker
- **桌面 / 平板 / 手机三端适配**：
  - 桌面 1440：左轨 +56px 总高，仍占 viewport 90% 以内安全
  - iPad portrait：跟随桌面布局，picker 4 列网格在 768 宽展开
  - 手机 ≤700px：mobile lookbar 从 2 行扩到 3 行（LOOK strip + import+chips + export+ZIP），总高 +44px → 148px。代价是画布让 44px，这是把"3 步入口 → 1 步入口"的合理换价
- **设计语言细节**：dashed→solid 边框模仿真实卷宗夹"待填入"的视觉、accent glow 跟随 picker 打开状态、tile active 状态加 10×10px 红角标 + 实色边框、用户预设 row hover 出现操作 chip 而非常驻不喧宾

向后兼容：所有 preset / share-code schema 字段不变，老分享码贴入正常工作。`localStorage['phototools.presets']` 数据结构不变。

## 0.19.0 · 2026-05-09

### ✦ 精选预设 + DIY 渲染开关解锁

**产品定位调整**：从"一组预制相框"转向"DIY 渲染引擎 + 用户/社区创作的 look 库"。这一版交付种子预设 + 把过去被 frame 锁定的两个开关（圆角、caption 嵌入图片）放出到 cfg / UI / preset，让任何用户都能改任何渲染参数。

- **7 个开箱即用的精选预设** —— 工作台 · 预设面板顶部新增 ✦ 精选预设区块，单击直接应用：
  - 🎞 **35mm 胶片真** —— `film-35` + `minimal-text` + 圆角清零 + caption 嵌入图片，第一次让 35mm 长相贴近真实底片观感
  - 📖 **杂志编辑** —— `editorial` 右栏 + 新 `spec-rail` 模板，4 个胶囊垂直堆叠 + 品牌区
  - ⬛ **哈苏致敬** —— `gallery-white` + 新 `spec-grid` 模板，4:3 横版底栏胶囊横排
  - 🔴 **Leica 侧栏** —— `editorial-mirror` + `spec-rail`，照片在右、参数在左
  - 🟡 **Kodak 专业** —— 新 `kodak-pro` 相框 + `brand-logo` 模板，红黑双色品牌横条配底栏品牌+参数
  - 📷 **宝丽来经典** —— `polaroid` + `wordmark`，方画幅 + 大字字标
  - ✨ **Frosted 经典** —— `frosted` + `minimal-text`，老用户的"恢复出厂"快捷键
- **「圆角」滑块** —— B · Frame · Padding & caption 区块新增，0–72px 任意调；双击读数恢复 frame 默认（preset）；写入 `cfg.radiusOverride` 进 LOOK_KEYS，会被预设捕获 / 还原
- **「水印嵌入图片」开关** —— 同区块新增切换；`cfg.captionForceOverlay = true` 直接绕过自动 caption 路由，把字幕盖在照片底部渐变条上。同样进 LOOK_KEYS
- **种子预设是起点不是终点** —— 任何字段都可以在 UI 上覆盖修改，覆盖后用「我的预设」存为自己的 look。所有种子预设走和用户预设同一份 v:1 schema，不需要特殊机制
- **向后兼容** —— 老分享码 / 老用户预设没有这两个新字段，应用时落到默认值（null / false），渲染如旧

## 0.18.0 · 2026-05-09

### 🎨 新增杂志级设计语言

参考 Hasselblad / Leica / Kodak 的相机品牌相册排版，把"描边规格胶囊 + 品牌横条"这套设计语言落到工程里。这一版只交付**渲染原语 + 模板 + 相框**三层基础能力；下一版（0.19）会把它们打包成「精选预设」一键可用。

- **Spec grid 模板（参数胶囊·横排）** —— 顶行是品牌 wordmark / logo + 分隔线 + 型号，底行是 4 个圆角描边胶囊（快门 / ISO / 焦距 / 光圈），每个胶囊下方挂一个全大写小标签。底栏 caption 的杂志级排版，参考 Hasselblad X2D 系列相册排版
- **Spec rail 模板（参数胶囊·侧栏）** —— 同样的胶囊结构但垂直堆叠，配合 Editorial · 杂志/镜像 相框的右侧（或左侧）窄栏使用，参考 Leica M10 系列相册排版。底部带品牌名 + logo cluster
- **Kodak Professional 相框** —— 暖白纸基（#fafaf7）+ 顶部"**Kodak** Professional"红黑双色品牌横条 + 中等柔和阴影。和 brand-logo / spec-grid 模板搭配能渲出胶片冲洗厂相册的范儿
- **顶栏 caption placement 引擎能力** —— `computeCaptionZone` 现在认 `captionPrefer: 'top'`，让任何相框都可以把 caption 路由到照片上方的 padding 区。本版没有现成的相框启用它（Kodak Pro 走的是装饰 hook，不是 caption），但底层为后续"双栏式"模板打底
- **`R.boxedSpec` 公开原语** —— 写自定义模板的人可以直接调用拿到一致的描边胶囊几何，无需重新实现

无 cfg / preset / share-code schema 变化；老 share-code 在新引擎下渲染如旧。

## 0.17.0 · 2026-05-09

### 📱 移动端 + 触屏完整适配

继 0.16 lookbar / canvas-first 重构后，把所有"暗示了但没真正打磨"的移动端细节系统性补齐。手机、平板、触屏笔电都各自得到了对的姿态。

- **手机断点 768→700px** —— 把 iPad-class 平板（最小的 iPad mini 是 744）还给桌面布局，不再被错误归为"手机"塞进底部 sheet 模式。手机仍走底部 sheet（≤700px portrait OR landscape ≤500px tall — 后者覆盖 iPhone 14 横屏的 844×390）
- **平板触控友好尺寸** —— 新增 `@media (min-width: 701px) and (pointer: coarse)` 块，iPad / 触屏 Windows 平板**保留桌面布局**但叠加 16px 字号防 iOS 缩放、44px 触摸目标、22px slider thumb，picker tile 在平板宽度下展开为 4 列方便横向比较
- **iOS 粘床 hover 修复** —— iOS Safari 在 tap 后会让 `:hover` 状态保留几百 ms，让"按下抬起"的按钮看起来卡在了 mid-press。新增 `@media (hover: none)` 块，在触屏设备上中和所有 hover transform/border-style 跳变，`:active` 仍保留作 tap 反馈
- **触摸目标合规** —— lookchip 从 38px 拉高到 44px（11px 上下 padding）；radio/checkbox 从 12px 放大到 18px + 整行 44px 命中区；rail-context-item 在 mobile 已经 14px+14px 不变
- **底部 sheet swipe-dismiss** —— workshop / picker / changelog 三个 sheet 从顶部 36px 抓握区下拉关闭；超过 28% 高度或速度 >0.55 px/ms 触发；上拉有 sqrt 阻尼。每个 sheet 顶部加了 36×4px 拖动条视觉提示
- **canvas pinch-zoom 预览** —— 双指捏合在画布上 1×–4× 缩放，centroid 漂移同时驱动平移；单指在 zoom 状态下变成 pan；双击吻合 300ms 内重置回 1x；切换照片自动归位。zoom 状态下水平 swipe 翻页被禁用以避免冲突
- **横屏手机宽度限制移除** —— 之前 `(max-width: 768px)` 让 iPhone 14 横屏（844 宽）拿不到 lookbar 84px 矮版，现在去掉宽度门槛，iPad 因为横屏高度仍 ≥768 自动不匹配
- **480px 小屏专属断点** —— iPhone SE / Pixel 7a 等 ≤480px 设备进一步收紧 lookbar padding、缩小 swatch 与字号，frame-tile 在小屏退到 2 列保证每张缩略图肉眼可分辨
- **🐛 mobile lookbar 重叠 fix（v0.16.1 引入）** —— v0.16.1 把工作台入口提升到 lookbar，但没为 mobile 重排：4 个控件 row（import / chips / workshop / export）总高 ~165px，但 lookbar 只有 116px，flex 把 chip-group 压到 2px，所有 chip 实际不可点。修复：mobile 下隐藏 lookbar-workshop，把工作台入口挪到 topbar 一个新的 ⚙️ pill（紧挨语言 / changelog）；iPad portrait 仍走桌面布局（左轨 168px），workshop 留在原位
- **mobile lookbar 收紧到 2 行 grid 布局** —— `import + chips` 同行（import 缩成 44×44 accent 红方贴在 chip-group 左边，accent 红方块 + 上传箭头 glyph 不带文字标签，符合 mobile 摄影 app 通用范式），`Export + ZIP` 一行。lookbar 高度从首版 v0.17 的 152px 进一步降到 calc(104px + safe-area-inset)，画布拿回 ~40px 高度
- **Export / ZIP 按钮比例从 5:1 调整到 2:1** —— 之前 ZIP 缩成右侧小贴片，视觉比重头重脚轻。新比例下 Export 仍是主按钮但 ZIP 拿回足够的存在感，作为"次要但明确可点"的 batch 入口

无 cfg / preset / share-code schema 变化；smoke 持平 baseline。

## 0.16.1 · 2026-05-09

### 🛠 工作台入口提升 + picker tile i18n 修复

两个细节问题集中处理：

- **工作台入口从顶栏挪到左轨** —— 之前只是顶栏一个小 ⏤ icon，太隐晦。改为左轨 chip-group 下方的一行 prominent 入口：圆形 wrench 图标 + Fraunces italic「工作台 / Workshop」+ 一行 mono caps hint「裁剪 · EXIF · 签名 · 拼贴 · 预设」+ ↗ caret，dashed 边框 hover 转 solid + accent 红，明显是"打开另一个面板"的语义而不是普通操作按钮
- **frame / template picker 的 tile 名称跟随 locale 切换** —— 之前 tile-name 是从 hidden seg 按钮的 `textContent` 在生成时复制过来的，所以一旦切语言（中→英 / 英→中），tile name 永远停在那一刻的语言、不会跟随更新。现在 tile-name 加 `data-i18n="frame.styles.<key>"` / `caption.templates.<key>`，由 `I18N.applyDom()` 在切语言时自动重绘
- **tile 名称改 Fraunces italic** —— 跟 picker 标题、相框徽章、状态栏的 italic 调性统一，从 11px Hanken Grotesk 升到 13px italic Fraunces，selected 状态着 accent 红
- **EN 模板名称去缩写** —— `Brand · L` / `Brand · R` 还原为 `Brand · logo` / `Brand · right`（picker tile 的横向空间足够，不需要再缩）；中文同步从 `品牌左` / `品牌右` 改为 `品牌·logo` / `品牌·右`，跟 doc 4 节命名一致
- 顶栏少了 workshop 入口，节奏更松弛：brand · 计数 · ⌘K · 中-EN · changelog · GitHub

## 0.16 · 2026-05-09

### 🧭 Look bar 改回左侧 · 三栏对称 + Import 归位

桌面端：把 0.15 引入的底部 Look bar 旋转为**左侧垂直工具轨**。Layout 变成 `[左 lookbar | 中 canvas | 右 filmstrip]` 三栏，左右对称给画布天然居中感，跟编辑工具（Lightroom / Capture One）的传统布局一致。

- **Import 按钮归位** —— 从顶栏挪到左轨顶部，不再被 `topbar-pill` 26×26 圆形 icon 容器拉变形。新位置是个带圆形 accent 红 glyph + label 的紧凑行，跟左轨整体调性一致
- **chips 垂直堆叠** —— 4 个 chip 从横排改竖排，每行 swatch 左 / key+value 中 / caret 右。caret 默认指向右（`◀`），picker 打开时旋转到下（`▼`），暗示弹出方向
- **active chip 跟随光改为垂直** —— 0.15.1 加的 lookbar 暖色光晕从顶部水平改成右边缘垂直，跟着当前打开的 chip 上下滑动；右边缘的 1px accent rule 也跟着 chip y 位置 + 高度走
- **picker 弹出方向** —— 从向上展开改为向右展开，水平 `left: lookbar-w + 14px`，垂直跟随 chip y-center（clamp 进 viewport），整体感像"chip 旁边推开一扇门"
- **Export group 在左轨底部** —— 大红 Export + 灰 ZIP 全宽堆叠，仍是 thumb-zone 友好的 44px 高
- **顶栏更清爽** —— 拿掉 import 按钮后，顶栏只剩 brand / 计数 / ⌘K / workshop / 中-EN / changelog / GitHub，节奏更松弛

移动端 (≤768px) **保持 0.15 的底部 sheet 模式不变** —— 手机上 thumb-zone 在屏幕底部，不在屏幕侧边。`.lookbar` 在 `@media (max-width: 768px)` 里 reset 为 fixed-bottom + horizontal chip row + Import 缩成顶部小 accent pill。设计语言不变，只是 surface-native（rule 13）。

无 cfg/preset/share-code schema 变化；smoke 0.53% / 0.38% 持平 baseline。

## 0.15.1 · 2026-05-09

### ✨ 界面美感细节优化

继 0.15 工具栏重设计后的一轮 typography + motion polish。把 Fraunces serif 推到更多有"编辑感"的位置，让画面节奏更像暗房而不是 SaaS 表单。

- **底部 Look bar 更舒展** —— 高度 40 → 44px，chip 间距、swatch（20×14 → 24×18）、value 字号（13 → 14.5px）一起放大。caret 从文字 `▾` 换成 SVG，picker 打开时旋转 180°
- **active chip 跟随的暖色光** —— Look bar 顶端的 accent 高光线现在动态跟着当前打开的 chip 居中，连同后面的 radial halo 一起。这是个细微的"当前焦点的余晖"，让操作有方向感
- **chip value 切换微动效** —— 切相框 / 切模板时，对应 chip 的 value 文字做一个 360ms 的上抬+渐显（不是硬切换）
- **canvas 顶部 frame 徽章重做** —— 从 mono 大写改为 pill 形状 + Fraunces italic 相框名 + 一个小型实色 swatch（跟 lookchip 一致的色板系统）。一眼能看到当前 frame 的颜色身份
- **filmstrip 头部** —— "胶卷 / 00" 改用 Fraunces italic 标题 + accent 红 Fraunces 数字，整体小窄条变成像真实胶卷盒上的 label。空状态加了一个灰色虚线 aperture 圈
- **状态栏** —— 状态文字 "就绪" 走 Fraunces italic，前面加一个 4px accent 红呼吸点，键盘提示用 mono kbd 框包起来
- **空状态** —— title / subtitle 都改为 Fraunces italic，aperture mark 旋转动画从 6s/15° 升到 7s/22.5° + 1.04× 微缩放，更慢更有呼吸
- **picker 标题 + 家族头部** —— 选择相框 / 选择文字模板等 picker 标题统一改为 Fraunces italic 19px。家族下的 "● 编辑 / ● 画廊" 圆点加 accent glow 阴影
- **picker tile 入场动画** —— 打开 picker 时，11 个 tile 按 22ms 的 cascade 时序依次淡入上抬，整个 picker 像舒展开来而不是"砰"地出现
- **canvas 背景层加暖意** —— 顶部 60% 区域注入 0.025 alpha 暖色 wash，底部 40% 注入极淡的 accent 红 vignette，原有的中心透明 → 边缘黑的圆形 vignette 保留。整体读起来像低光暗房而不是 IDE 黑

无功能变化、无 schema 变化、smoke 0.53% 维持 baseline。

## 0.15 · 2026-05-08

### 🎛 工具栏重设计 · 画布主导 + 底部 Look bar + 工作台抽屉

把左侧 360px 侧栏 + 52px 活动栏整个**删掉**——画布拿回那 412px 的横向空间。所有控件按使用频率分三层重新组织，主路径永远 0 击可见，深度功能 1 击可达不暴露。

**Tier 1 · 永远在的 Look bar**（屏幕底部，glassmorphic）：5 个 chip + Export，覆盖每次使用都要碰的"换风格 / 换模板 / 换画幅 / 调质量 / 导出"五件事。Frame chip 自带一个 12×8px 的 frame 实色色板，从 chip 本身就能瞥见当前相框的视觉标识。

**Tier 2 · 1 击 popover · 视觉 picker**：点 chip 弹出聚焦 picker（mutually exclusive，永远只一个 active）。
- **相框 picker**：11 款相框按 4 家族分组（编辑 / 画廊 / 即影 / 胶片），每个 tile 是当前画幅下的 mini-render preview——撕纸的锯齿边、35mm 的齿孔、宝丽来的小圆角全都体现在 thumbnail 里，**选 frame 从此是看图，不是读名字**
- **模板 picker**：9 个模板按 4 grammar 分组，每个 tile 是用真实样片 EXIF 渲染的 typography 预览。"slate" 长什么样、"wordmark" 多大字号一看就知道
- **画幅 picker** + **质量 picker**：聚焦小弹窗，含详细描述和"自定义画幅"入口

**Tier 3 · 工作台抽屉**：右上角 ⋯ 按钮 → 从右侧滑入 440px drawer。5 互斥 tab 装下所有低频但关键的功能：
- **微调** · 边距 / 文字带高度 / 几何调整 (crop & 旋转) / 高级 frosted bg / 高级 shadow / 显示字段 chips
- **EXIF** · 11 个 override 输入 + 地图选点 + 应用到全部
- **签名** · 上传 + 9 宫格定位 + size + opacity
- **拼贴** · 6 种布局 + partner 文件挂载
- **预设库** · 保存 / 应用 / 分享链接

**⌘K 命令面板**：power-user 加速器。键盘 ⌘K (Mac) / Ctrl+K (Win) 召出，搜得到全部 11 相框 / 9 模板 / 5 画幅 / 11 操作。↑↓ Enter 完整键盘 nav。

**移动端 native 底部 sheet**（≤768px viewport）：Look bar 自动重排为底部 sheet，drag handle 在顶、5 chip 紧凑横排、全宽 Export CTA 占 thumb-zone。Picker 全屏 take-over；工作台 drawer 变 92% 高度的底部全屏 sheet，跟 iOS / Android 习惯一致。

**击数对比**（高频路径）：
- Export current：从滚到底点击 (~2 击) → **0 击 + 1 click** = 1 击
- 切相框：滚到 B 段点 chip (~2 击 + 视觉记忆) → 1 击点 frame chip + 1 击点 mini-render tile = 2 击但**视觉化选择消除"猜名字"**
- 调质量：滚到导出段 → 1 击 chip

**全部 cfg / preset / share-code / EXIF override schema 100% 兼容**——纯 UI 重构，旧预设 / 老 share-code 链接照常生效。

## 0.14.1 · 2026-05-08

### 💡 模板兼容性提示

某些 frame × template 组合视觉上会"挤"或"读不出"——比如 polaroid 底部的小白条塞 slate 场记板的 4 行 mono 数据，或 editorial 把 tech-stack 横排参数旋转 ±90° 后字符竖排。这版在模板 picker 下方加了一条柔提示 banner：

- **accent 色调小 banner + ⓘ 图标**：选到不兼容组合时自动出现，列出具体原因（"底部 caption 区偏窄"/"caption 走垂直方向"），并明确建议替代模板（极简 / 日期·镜头 / 标题…）
- **不硬禁用**：有些用户就要这种"挤"的视觉，picker 仍然可选。这是 hint 不是 block
- **覆盖了所有家族新增的不兼容路径**：包括这次同步落地的 `editorial-mirror`（vertical caption）和 `torn`（narrow strip）
- **完整 i18n**：zh-CN + en 双语，跟随顶栏 中/EN 切换实时翻译

## 0.14 · 2026-05-08

### ✂️ 新相框 · 撕纸（`torn`）

把照片剪裁成"从老相册撕下来贴在新页"的不规则锯齿边，归到即影家族第三款。Polaroid / Instax 偏"工业制造的小印片"，撕纸偏"私密手作 / 日记 / scrapbook"，三款一起把"vintage personal" 范围铺满。

- **程序化撕纸边**：沿矩形四边采样、每点向内随机位移 [0, 6 base-px]，用 mulberry32 PRNG + 由 cell 几何派生的种子，**保证同一画幅同一位置每次重渲生成完全一致的 path**——拖滑块不会"重新撕"
- **暖奶油纸底色** `#f4ecd6` + modest 偏移阴影，视觉上是"撕下来的小片轻轻贴在新页上"
- **撕口物理深度**：撕纸 path 上叠一条偏暖红的细暗线 `rgba(45,30,15,0.22)`，模拟切口处略暗的纸张纤维。没这条线照片只会读成"完美剪裁的多边形"
- **新基础设施 · `frame.clipPath` 钩子**：阴影、照片、签名三层都走同一条 path，确保撕纸边在三层视觉一致——避免"照片是撕的、阴影还是矩形"的穿帮。后续需要"非矩形轮廓"的相框都能复用这个钩子

## 0.13 · 2026-05-08

### 🎞 新相框 · 中画幅胶片（`film-mf`）

继 `film-35` 之后胶片家族第二款，刻意拉开视觉距离——一眼区分"35mm 电影胶片"和"120 中画幅胶卷"。

- **没有齿孔** —— 真实 120 卷装胶片靠 paper backing 推进、本来就没有 sprocket holes，遵循实物。原本 doc 建议"齿孔更稀疏"，深入对比后判断"无齿孔"才是最强差异化签名
- **更厚的 rebate** —— 顶部 130 / 底部 160 base-px（vs film-35 的 70 / 90），120 负片实物的边距 proportionally 就是这么大
- **更长的 stock label** —— `BRAND · 120 · ASA NNN`（如 "FUJIFILM · 120 · ASA 640"），不带 DX code（DX 是 35mm 罐头独有），不带 T 后缀（tungsten 是电影 35mm 概念），诚实标注 ASA
- **frame number `NN / 12`** —— 6×6 一卷 12 张是黄金标准，"X of 12" 是 medium-format 用户最熟的进度提示形式（vs film-35 的 `· DDA ·` 半帧致敬）
- **顶部右上角 `6×6` 标签** —— medium-format 最 iconic 的方画幅符号
- **跨画幅适配性**：1:1（最贴 6×6 真实画幅）信号最强，3:4 / 9:16 / 4:3 也都成立

## 0.12 · 2026-05-08

### 🪞 新相框 · 杂志·镜像（`editorial-mirror`）

`editorial`（杂志）的左右镜像版——照片靠右 + caption 留白条在左。两款共用同一套美学，给左→右视觉流（人物面朝右、运动方向向右、路径通向右）的照片一个不挡视觉出口的排版选项。

- 复用 editorial 的暖纸色 `#f4f0e6` 背景 + 中等阴影，只换 layout 锚点
- caption 自动旋转 `+90°` 顺读 top→bottom，跟原版的 `-90°`（bottom→top）形成镜像呼应
- 新增 layout 选项 `extraLeftInset`（与 `extraRightInset` 互斥），是后续左侧不对称排版相框的基础设施

## 0.11.1 · 2026-05-08

### 🖼 黑衬画廊相框 · phosphor 高光线提亮

- **`gallery-noir` 的 phosphor 内辉 alpha 0.16 → 0.28** — 之前在 9:16 portrait 上几乎看不出（背景 #171717 + 28×0.16 ≈ 4 阶亮度差，被预览缩放和 JPEG 压缩进一步吃掉）。0.28 后凑近看是清晰的细线，但还没硬到读成结构性边框——保住"低调画廊墙"的家族调性。0.35 测过太硬，回退到下限

## 0.11 · 2026-05-08

### 📐 自定义画幅比例

之前画幅 segment 只能从 5 个预设里挑（9:16 / 3:4 / 1:1 / 4:3 / 16:9），都是按抖音 / 小红书 / 朋友圈这些主流社交平台预览裁切对齐的。这版新加 **自定义** 按钮，点开弹窗自己填 W:H，覆盖那些预设没顾及到的画幅诉求。

- **任意 W:H 输入** — 比例范围 0.1 ~ 10，覆盖经典 3:2 / 2:3、anamorphic 2.35:1、超宽 21:9、4×5 大画幅 5:4 等
- **快捷预设** — 弹窗里内置 5 个常用比例 chip 一键填入
- **记住上次输入** — 自定义值写到 localStorage，下次打开弹窗自动预填
- **预设和"应用到全部"已自动适配** — 自定义画幅会随预设保存 / 分享链接 / "Apply frame to all" 流转，跟内置 5 个画幅一样
- 关联 issue：[#2](https://github.com/anois/photo-tools/issues/2)

## 0.10.1 · 2026-05-08

### 🎞 胶片相框 v2 · 信号更强的 35mm 实物感

`film-35` 第二轮迭代——目标是凑近看每一处都对得上真实 35mm motion-picture stock。

- **暖底替纯黑** — 底色从 `#0c0c0c` → `#100c08` warm dark。真实处理过的胶片永远不会读成 #000；新底色让 cream 色齿孔不再"死白对死黑"
- **齿孔自适应密度** — 之前固定 7 对齿孔在横画幅会显得太稀。现按照片宽度自适应，9:16 ≈ 12 对、4:3 ≈ 20 对、16:9 ≈ 22 对，clamp 到 8–32。所有画幅节奏一致，**旧版"不适合极端宽画幅"的限制已解除**
- **齿孔加 1.4×outputPx 内嵌阴影** — 底部一条暗色 stripe 模拟"穿孔"立体感。没这条阴影齿孔会读成"画上去的"
- **顶部 edge print 升级** — 从「品牌首字母 · ISO · DX」（"F · 4000 · DX"）扩成「品牌全称 · ISO·T · DX」（"FUJIFILM · 640T · DX"）。`T` 后缀致敬 tungsten-balanced 真实胶卷型号（如 Kodak 500T），DX 致敬胶卷罐头码
- **新增方向箭头 `→`** — 顶部 edge print 同行右端，模仿真胶片 leader 头/尾标记
- **新增底部 frame number** — `· DDA ·` 从 EXIF 日期末两位派生（"21A"），致敬真实 motion-picture half-frame 编号（24 / 24A / 25 / 25A）。位置自动对齐齿孔行与 caption 之间的 gutter，4:3 / 16:9 等短底带画幅里也不会跟 caption 撞位置
- **照片边 cream hairline** — 0.10 alpha 的细线锁住照片边缘进 cream 色家族，把照片从黑底分离开

## 0.10 · 2026-05-08

### 🎛 侧栏交互重组 · 两段式 picker + 9 宫格签名定位

把侧栏改造跟签名重设计绑成一波，一次到位：

- **相框 picker 改两段式** — 顶部一行 4 个家族 tab（编辑 / 画廊 / 即影 / 胶片），下面一行该家族下的 2-3 个变体。变体名字第一次完整显示，移动端不再被压成"35m..."的样子。点家族 tab 直接跳到那个家族的第一个变体；点变体 chip 自动同步到对应家族 tab
- **水印模版 picker 同样改两段式** — 顶部 4 个语法 tab（参数 / 品牌 / 编辑 / 印戳），下面是该语法下的 2-3 个模版。原来的 9 项 `<select>` 下拉换成可视的 chip 选择，看一眼就知道有哪些选项
- **签名定位升级 9 宫格** — 之前只有 br / bl / bc 三个角，现在是 3×3 完整 anchor grid（tl / tc / tr / cl / cc / cr / bl / bc / br）。点哪格签名贴哪。视觉上是清晰的"这里"指示器（accent 边框 + 中心圆点）
- **签名 schema 升级 + 平滑迁移** — `cfg.customLogo.position` 从字符串 `'br'` 升级为对象 `{ anchor, dx, dy }`（dx/dy 为后续微调预留）。所有持久化入口（localStorage 启动 hydrate、preset 应用、share-code 解码）都跑迁移函数，老用户的签名设置自动转新结构。`customLogoRect` 自身两种 schema 都吃，worker 端不需要单独迁移

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
