# 相框风格 · 设计参考文档

**v0.10 · 2026-05-08**

photo-tools 的相框系统当前共 **11 款相框 × 4 个家族**，每个家族两到三款变体。本文档说明每款相框的设计意图、视觉灵感、技术实现、推荐配对的水印模板、以及已知的不适用场景，作为后续整改的 review 基线。

---

## 总览

| 家族 | 调性 | 适合的照片类型 | 关键视觉特征 |
|---|---|---|---|
| **编辑 / Editorial** | 杂志感、有叙事感、可深可浅 | 旅行 / 街拍 / 生活随笔 | 自模糊 / 暖纸色背景 + 不对称留白 |
| **画廊 / Gallery** | 美术馆装裱感、克制、突出主体 | 作品照 / 静物 / 风景中长焦 | 纯色衬底 + 细线衬纸 / phosphor 高光 |
| **即影 / Instant** | 复古、温度感、私密 | 人像 / 旅行胶片感、聚会 | 底部超宽留白 + 印纸纹理 |
| **胶片 / Film** | 实物感、电影感、做旧 | 街拍 / 暮光 / 实验性 | 黑底 + 齿孔 + 边缘印章 |

每个家族在交互上是一个 family tab；点开后下面才显示该家族的 2–3 个变体。这种两段式 picker 的核心目的是：用户先用心智模型「我要拍什么风格」选家族，再细化具体变体——而不是面对一排扁平的 8 个选项盲选。

下面按家族逐个展开。

---

## 1. 编辑 · Editorial

**家族定位**：照片本身的色彩、氛围是主角；相框是承托；让杂志读者有"翻页停下来看一眼"的感觉。

**家族统一的视觉锚点**：
- 浅暖色调（不是冷灰、不是纯白）
- 文字带（caption）有充足呼吸空间，不挤压主体
- 默认走 minimal-text 或 wordmark 模板，避免技术参数喧宾夺主

### 1.1 `frosted` （毛玻璃）

> 项目最早的"招牌"风格。

- **设计意图**：把照片自身高斯模糊作为背景，复刻杂志封面"主体清晰 + 周围氛围弥散"的双层感；同时让任何照片都自带颜色协调（背景永远来自照片本身）
- **视觉灵感**：`小相机` / `Lit` / `西卡` 这类中文摄影 app 的"毛玻璃白底"核心模式；本质上是 iOS 系统 UI 那种 backdrop-filter 在静态图上的复刻
- **技术实现**：
  - `bg.type: 'frosted'`，blurSigma=60 / brightness=0.92 / saturation=1.05 / darken=0.06 / grain=0.12
  - 文字色系 `light`（白字铺在弥散背景上）
  - shadowDefault: blur 80 / offsetY 24 / opacity 0.35（前景轻微悬浮）
  - 无 decorate hook
- **推荐配对**：`minimal-text`（参数横排，干净）/ `tech-stack`（参数竖排，更密集）/ `wordmark`（极简大字）
- **不适合**：
  - 主体太暗的照片（背景模糊后整个画面都是黑色，对比度坍塌）
  - 主体颜色太单一（背景模糊后没有色彩层次，看起来像被涂抹了一层黑灰）

### 1.2 `frosted-noir` （毛玻璃·暗）

> 同骨架，更深的暮色调。

- **设计意图**：在 `frosted` 基础上增加 darken 与降低 brightness，让背景往"暮光 / 室内夜景"方向走；适合主体较亮、背景偏暗的照片
- **视觉灵感**：黑胶唱片封面、深色摄影集印刷品的视觉
- **技术实现**：
  - `bg.type: 'frosted'`，blurSigma=70 / brightness=0.78 / saturation=1.0 / darken=0.22 / grain=0.14
  - 旧 key `frosted-dark` 注册为别名（保持已有 cfg / preset 兼容）
  - shadowDefault: blur 90 / offsetY 28 / opacity 0.45（暗背景需要更重的阴影才看得出层次）
- **推荐配对**：和 `frosted` 一致，但白字在暗背景上对比度更友好
- **不适合**：白天高光照片（darken 把整个画面压暗了，得不偿失）

### 1.3 `editorial` （杂志）🆕

> 唯一一款打破对称布局的相框。

- **设计意图**：照片只占左侧 ~66% 宽度，右侧 ~24% 是一条空白纸色竖向 strip，专门用来放排版式 caption（headline / wordmark）。视觉上像翻开杂志的右页排版
- **视觉灵感**：The New York Times Magazine、《Kinfolk》、Apartamento 这类编辑类杂志内页的图文排版
- **技术实现**：
  - `bg.type: 'solid', color: '#f4f0e6'`（暖纸色，比 gallery-white 的 #f4f3ee 黄一些）
  - `layout.extraRightInset: 350`（base-1440 单位，挖出右侧条带）+ `captionPrefer: 'right'`（强制 caption 路由到右侧）
  - 照片自动 anchor 到左侧 padding（不再居中）
  - shadowDefault: blur 70 / offsetY 22 / opacity 0.22（中等阴影 + 浅纸底，让照片"从纸面上微浮起"）
- **推荐配对**：
  - `headline`（"40°N · 116°E · 2026.03" 大字标题，最适合右侧竖排）
  - `wordmark`（FUJIFILM 一个字标贴在右侧，luxury minimalist）
  - 不推荐 `tech-stack` / `slate`（横排参数被旋转 -90° 后字符垂直排列，可读性差）
- **不适合**：
  - 1:1 / 16:9 等宽幅画幅（纸条 strip 占比变大，照片被挤窄太多）—— 当前这一款最适合 9:16 / 3:4 portrait
  - 没有 GPS + 没有 date 的照片（`headline` 模板会降级为只显示品牌大字，弱化了"地点+日期"的核心叙事）

### 1.4 `editorial-mirror` （杂志·镜像）🆕

> `editorial` 的左右镜像版。

- **设计意图**：跟 `editorial` 同一套美学，唯一区别是照片靠**右**、caption 留白条在**左**。给左→右视觉流（人物面朝右、运动方向向右、路径通向右）的照片留个"caption 不挡视觉出口"的选项，不必为了排版被迫翻转或重裁
- **视觉灵感**：杂志跨页排版里"图右文左"的对开页（左页文字 + 右页满版图）
- **技术实现**：
  - 完全复用 `editorial` 的 `bg / textStyle / shadowDefault`，只换 layout 锚点
  - 新增 layout 选项 `extraLeftInset`（base-1440 单位，与 `extraRightInset` 互斥，二者同时设置时 right 优先），照片自动 anchor 到右侧 padding
  - `captionPrefer: 'left'` 强制 caption 路由到左侧 strip（旋转 +90°，文字读取方向 top→bottom）
- **推荐配对**：与 `editorial` 一致（`headline` / `wordmark`）
- **不适合**：与 `editorial` 一致

---

## 2. 画廊 / Gallery

**家族定位**：模拟美术馆装裱（passe-partout）/ 当代艺术展厅墙面，让一张照片看起来"有被认真对待"。

**家族统一的视觉锚点**：
- 纯色衬底（无任何模糊或噪点）
- 在照片外圈用极细的线（1–1.5 px in 输出像素，无论 quality 设置）勾勒出装裱痕迹
- 阴影更"实体"（更短、更紧、更直接）

### 2.1 `gallery-white` （白衬）

> 替换原 `white` 相框，加入 passe-partout 双线衬纸装饰。

- **设计意图**：照片像被白色 mat 装裱在画廊墙上；外层细线 + 内层更细线之间留 ~16 base-px 空隙，模拟实物装裱里照片与 mat 之间的"凹陷边"
- **视觉灵感**：传统画廊 / 摄影展的硬卡纸装裱（passe-partout matting）；MoMA / Aperture 摄影集印刷边距
- **技术实现**：
  - `bg.type: 'solid', color: '#f4f3ee'`（暖灰白，避免纯白带来的电子产品感；比打印纸略冷一档）
  - decorate hook 画两个同心圆角矩形 stroke（外层 inset 26 base-px / lineWidth 1.5×outputPx；内层 inset 8 base-px / lineWidth 0.9×outputPx）
  - **关键**：lineWidth 用 `layout.outputPx`（Math.max(0.5, scale * 0.6)）做缩放，确保高质量导出时线宽不会从 1.5px 变成 3-4px——hairline 就该一直是 hairline
  - shadowDefault: blur 60 / offsetY 18 / opacity 0.18（最浅的阴影，模拟照片从纸面微微浮起）
  - 旧 key `white` 别名兼容
- **推荐配对**：
  - `wordmark`（一个字标 + 日期，画廊标签风）
  - `minimal-text`（极简参数）
  - `passport`（角落小邮戳，像馆藏标签）
- **不适合**：
  - 主体颜色非常浅 / 偏白的照片（白底 + 白主体边界丢失）
  - 强烈高对比的彩色街拍（白底反而抢色）

### 2.2 `gallery-noir` （黑衬）

> 替换原 `black` 相框，加入 phosphor 暗光高光线装饰。

- **设计意图**：照片像挂在黑色展厅墙上；不用双线（黑墙上双线会过于装饰），改用单条极细的"phosphor 内辉"（白色 28% 透明度），让照片边缘有轻微的光晕
- **视觉灵感**：当代摄影黑墙展（如 Pace Gallery 黑展厅）；MoMA PS1 的 darkroom-style 装裱
- **技术实现**：
  - `bg.type: 'solid', color: '#171717'`（深中性灰，比纯黑 #000 暖一档；纯黑会让照片看着像被嵌进黑洞）
  - decorate hook 画一条 inflate=14 的圆角矩形 stroke（rgba(255,255,245, 0.28) / lineWidth 0.9×outputPx）。alpha 从最初的 0.16 提到 0.28——0.16 在 9:16 portrait 上几乎看不出，0.28 是兼顾"柔和反光"和"还能看见"的平衡点；继续往 0.35 推会开始读成结构性边框，破坏"低调画廊墙"的家族调性
  - shadowDefault: blur 90 / offsetY 28 / opacity 0.55（深底配重阴影，前景才能"飘起来"）
  - 旧 key `black` 别名兼容
- **推荐配对**：
  - `minimal-text` 白字
  - `wordmark` 大字标
- **不适合**：
  - 整体偏暗 / 夜景照片（主体陷进黑底分不清边界）
  - 同 gallery-white 的反面：白底主体 + 黑相框可以，黑底主体 + 黑相框会"被吃掉"

---

## 3. 即影 / Instant

**家族定位**：复古、有温度、有私密性；底部宽留白是身份识别符。

**家族统一的视觉锚点**：
- 底部 1.8x ~ 2.5x 留白（不再是上下对称）
- 照片圆角小（4-8 px）模拟实物即影印纸的物理切割边缘
- 浅米/奶油色 / 浅灰白底（不是纯白）

### 3.1 `polaroid` （宝丽来）

- **设计意图**：复刻 Polaroid SX-70 / 600 系列的经典外观——白底 + 底部宽边 + 平面无阴影。底部宽边在原版用来手写 caption；本工具沿用这个传统，把 caption 模板放在底部
- **视觉灵感**：Polaroid 原品牌 / VSCO 滤镜里的 polaroid mode / 80-90 年代家庭相册
- **技术实现**：
  - `bg.type: 'solid', color: '#fafafa'`（接近纯白但留一点温度）
  - `layout.extraBottom: 180`（base-1440 单位，底部加宽用于 caption）
  - `layout.fgYBoost: -80`（照片整体向上推一点，让顶部 padding 看起来均匀）
  - `layout.radiusOverride: 8`（小圆角，模拟实物切割边）
  - shadowDefault: 0 / 0 / 0 —— **完全无阴影**，因为 polaroid 实物是平面贴在桌上的，没有立体感
- **推荐配对**：
  - `date-lens`（最贴合 polaroid 那种"日期戳 + 镜头"的手写感）
  - `wordmark`（少数字字标）
  - `passport`（小邮戳风）
- **不适合**：极端长宽比（16:9）—— polaroid 实物是接近方形的，强行用横画幅看起来"像把宽屏照片硬塞进了 polaroid"

### 3.2 `instax`

- **设计意图**：富士 Instax mini 的复刻——比 polaroid 更窄的画幅 + 更深的底部 + 微弱阴影（instax 实物纸是有一点厚度的，不像 polaroid 完全平贴）
- **视觉灵感**：Fuji Instax mini 9 / 11 / Evo 系列卡式相纸
- **技术实现**：
  - `bg.type: 'solid', color: '#fffdf6'`（温暖奶油色，比 polaroid 更黄）
  - `layout.extraBottom: 240`（更深，约 polaroid 的 1.33×）
  - `layout.fgYBoost: -120`（更靠上）
  - `layout.radiusOverride: 4`（圆角更小，instax 实物切割比 polaroid 更精细）
  - shadowDefault: blur 30 / offsetY 12 / opacity 0.18（轻微浮起感）
- **推荐配对**：和 polaroid 相同，但视觉更日系
- **不适合**：和 polaroid 相同

**`polaroid` vs `instax` 取舍**：两者视觉很接近，但 polaroid 是"美式 / 平面 / 柯达白"、instax 是"日系 / 微浮 / 奶油"。当前两者都保留是因为用户群体里两种审美各有受众；如果未来要削减为一款，`polaroid` 因为更通用值得保留。

### 3.3 `torn` （撕纸）🆕

> 即影家族的第三款，把视觉从"印纸"扩到"老相册撕页"。

- **设计意图**：照片不走传统矩形剪裁，而是一条程序化生成的不规则锯齿边——视觉上像从老相册里撕下一张快照，贴在新一页温暖的奶油纸上。pollaroid / instax 偏"工业制造的小印片"，torn paper 偏"私密手作 / 日记 / scrapbook"，三款一起把"vintage personal" 范围铺满
- **视觉灵感**：手写日记 / scrapbook / 老式相册插页 / Hipstamatic 的 torn-edge 模式；本质是数字工具复刻"剪贴本"美学
- **技术实现**：
  - `bg.type: 'solid', color: '#f4ecd6'`（暖奶油纸色，比 gallery-white 黄、比 instax 更接近"老纸张"）
  - **新基础设施 · `clipPath` 钩子**：`R.registerFrame` 的 def 现在认识可选 `clipPath(ctx, x, y, w, h, layout, args)`。`compose()`（主线程 + worker 双端镜像）把这条 path 同时用在三个地方——阴影投射、照片剪裁、签名剪裁——三层一致地走撕纸轮廓，避免"照片是撕的、阴影还是矩形"这种穿帮
  - **撕纸路径生成**（`tornClip`）：沿矩形四边按 7 base-px 步长采样，每点向内位移 [0, 6 base-px] 的随机量。用 mulberry32 PRNG + 由 cell 几何 (x,y,w,h) 派生的种子，**保证同一画幅同一位置每次重渲生成完全一致的 path**——不然滑块拖一下就会"重新撕"，UX 灾难
  - **decorate hook**：在撕纸 path 上叠一条 `rgba(45,30,15,0.22)` 的细暗线（暖偏红的色调匹配纸张纤维），让撕口有"切口处略暗的物理深度"。没这条线的话，照片只会读成"完美剪裁的多边形"，而不是"被撕开"
  - shadowDefault: blur 50 / offsetY 16 / opacity 0.20（modest 偏移阴影，让撕下来的小片"贴在新页上微微浮起"）
- **推荐配对**：
  - `date-lens`（最贴合 scrapbook 的"手写日期戳"调性）
  - `passport`（小邮戳，跟相册插页呼应）
  - `wordmark`（少字字标也行）
- **不适合**：
  - 极端长宽比 9:21 / 21:9（撕纸 6 base-px 抖动相对于狭长边不够明显，效果弱化）
  - 已经有"复古做旧滤镜"的源图——撕边 + 滤镜叠加容易过载
- **跨画幅适配性**：1:1 / 3:4 / 4:3 / 9:16 / 16:9 全部成立。撕纸纹理在 high-quality 导出（scale ≥ 1）下看得最清楚，预览（scale 0.5）下抖动幅度被缩到 3 px 内，会显得相对克制——这是预期行为

---

## 4. 胶片 / Film

**家族定位**：实物胶片质感、电影感。当前家族 2 款：35mm 电影胶片 + 120 中画幅胶片，覆盖 motion-picture 和 medium-format 两条主流胶片审美轨。

### 4.1 `film-35` （35mm 胶片）🆕

> 新增的旗舰款。设计目标：从远处一眼读出"这是胶片"，凑近看每一处细节都对得上真实 35mm motion-picture stock 的视觉语法。

- **设计意图**：把照片包装成一帧 35mm 电影胶片。视觉栈（top → bottom）：
  ```
  [edge print: "FUJIFILM · 640T · DX"]  ← stock label，左对齐，cream 78% alpha
  [→]                                   ← 头标方向箭头，右对齐同行
  [top perforation row, 8–32 个]         ← 自适应密度
  [photo, with cream hairline 边]
  [bottom perforation row, 镜像]
  [· 21A · ]                            ← frame number，从 EXIF 日期末两位派生
  [caption strip]
  ```
- **视觉灵感**：35mm motion picture film（Kodak 5219 / Fuji ETERNA）/ Hipstamatic 的 film border / 电影《Roma》之类的胶片回忆滤镜。关键参考：真胶片 leader 一端是 stock 编号、另一端是头/尾箭头，frame number 沿 perf 边缘连续印出
- **技术实现**：
  - `bg.type: 'solid', color: '#100c08'`（**warm dark**，不是纯黑——真处理过的胶片永远不会读成 #000，加一点橙棕底色让 cream 色齿孔不显得死白对死黑）
  - `layout.topPaddingBoost: 70` + `layout.bottomPaddingBoost: 90`（symmetric 上下加宽）
  - **齿孔几何**（`HOLE_PITCH_BASE = 110 / W = 28 / H = 20 / R = 3`，base-1440 单位）：
    - 自适应密度：`numHoles = clamp(round(fgW / HOLE_PITCH_BASE), 8, 32)`，9:16 ≈ 12 对、4:3 ≈ 20 对、16:9 ≈ 22 对——所有画幅节奏一致，**横画幅不再"齿孔太稀"**
    - 长宽比 ≈ 1.4:1，参考真实 BH-1866 perforation 规格（比早期 7 对装饰版的 36×20 更准）
    - 颜色 `#ebdcb8`（FILM_CREAM，比早期 `#f3efe5` 更暖一档），底部内嵌 1.4×outputPx 高的暗色阴影条 `rgba(60,48,32,0.55)`，模拟"穿孔"的立体感——没有这个阴影齿孔会读成"画上去的"
    - 行 CY = `fgEdge ± gap × 0.30`（贴近照片边缘，把 70% gap 让给 edge print / frame number / caption）
  - **顶部 edge print**："`BRAND · ISO·T · DX`"（左对齐 fgL）+ "`→`"（右对齐 fgL+fgW）同行：
    - 品牌全称（FUJIFILM / CANON / SONY），不是早期的首字母缩写——一行打开，信息密度更接近真实 stock label
    - `T` 后缀致敬 tungsten-balanced 真实胶卷型号（如 Kodak 500T）
    - DX 后缀致敬 35mm 胶卷罐头的 DX code
    - EXIF 缺失降级为 `FILM · 400T · DX`
    - 字号 13×scale，bold mono，alpha 78%
  - **底部 frame number**：`· DD A ·`（DD = EXIF 日期末两位，A = 致敬真实 motion-picture half-frame 编号 24/24A/25/25A）
    - 字号 12×scale，alpha 74%——之前 11/0.62 在 warm dark 上读不出
    - Y 位置 = `(perfRowBottom + caption.y) / 2`，**用 `layout.caption.y` 取 caption strip 顶边作为下界**，避免 4:3 / 16:9 等短底带画幅里 frame number 跟 caption 重叠
    - EXIF 缺失降级为 `· 24A ·`
  - **照片 cream hairline**：`rgba(235, 220, 184, 0.10)` / lineWidth 0.8×outputPx——把照片边缘锁进 cream 色家族，从黑底分离开
  - shadowDefault: 0 / 0 / 0（胶片是 2D 物体，立体阴影破坏物理直觉）
- **推荐配对**：
  - `passport`（小邮戳，跟胶片印章呼应）
  - `slate`（场记板 mono 字体，跟胶片同语系）
  - `date-lens`（简单时间戳）
- **跨画幅适配性**（自适应齿孔密度修复后）：9:16 / 3:4 / 4:3 / 1:1 / 16:9 全部信号清晰，旧版"不适合极端宽画幅"的限制已**解除**。3:4 portrait 信号最强（最接近真实胶片单帧比例）

### 4.2 `film-mf` （中画幅胶片）🆕

> 跟 `film-35` 是表亲，但视觉语法刻意拉开距离——一眼区分"35mm 电影胶片"和"120 中画幅胶卷"。

- **设计意图**：把照片包装成一帧 120 卷装中画幅胶片（Hasselblad / Mamiya / Rolleiflex 出片风格）。视觉栈：
  ```
  [stock label: "FUJIFILM · 120 · ASA 640"     6×6]   ← 顶部 header strip
  [photo, with cream hairline]                          ← 主图，奶油细线锁边
  [07 / 12]                                             ← bottom frame number
  [caption strip]
  ```
- **视觉灵感**：120 roll film（Kodak Portra 400 / Fuji Pro 400H / Ilford HP5+）的实物外观——较宽的 rebate（黑边）、印在边缘的 brand stock 文本、1..12 编号
- **跟 `film-35` 的关键差异**（从远处也能一眼区分）：
  - **没有齿孔**——120 卷装胶片**真实上**没有 sprocket holes，胶片靠 paper backing 推进。doc 末尾候选清单原本提议"齿孔模式更稀疏"，但深入实物对比后发现"无齿孔"才是 medium-format 最强的视觉签名，遵从实物
  - **更厚的 rebate**：`topPaddingBoost: 130` + `bottomPaddingBoost: 160`（vs film-35 的 70 / 90）。120 负片实物的边距比 35mm 大很多，proportionally 也是
  - **更长的 stock label**：`BRAND · 120 · ASA NNN`（vs film-35 的 `BRAND · NNNT · DX`）。120 没有 DX code（DX 是 35mm 罐头独有），也没有 T 后缀（tungsten balance 是 cinematic 35mm 才有的概念），所以诚实标注 `ASA`
  - **frame number 用 `NN / 12`**（vs film-35 的 `· DDA ·`）。6×6 一卷 12 张是黄金标准，"X of 12" 是 medium-format 用户最熟悉的进度提示形式
  - **顶部右上角 `6×6` 标签**——medium-format 最 iconic 的方画幅符号，不能埋
- **技术实现**：
  - `bg.type: 'solid', color: '#100c08'`（同 film-35，warm dark，保持胶片家族色调统一）
  - `layout.topPaddingBoost: 130 / bottomPaddingBoost: 160`（更宽 rebate 给 stock label / frame number 留呼吸空间）
  - decorate hook：
    - 顶部 stock label `BRAND · 120 · ASA ${ISO}` 左对齐 fgL，cream 0.82 alpha，bold 15×scale；右上角 `6×6` 同行，cream 0.62 alpha，13×scale
    - 底部 frame number `NN / 12` 左对齐，cream 0.78 alpha，14×scale，Y 用 `layout.caption.y` 算 photo↔caption gutter 中点（同 film-35，一致的 label 高度）
    - 照片边 cream 0.10 alpha hairline（同 film-35）
  - shadowDefault: 0 / 0 / 0（同 film-35，胶片是 2D）
- **推荐配对**：
  - `passport`（最贴 medium-format 那种"严肃记录"调性）
  - `minimal-text`（极简一行参数）
  - `slate`（场记板 mono 字体，跟胶片同语系）
- **跨画幅适配性**：1:1（最贴近 6×6 真实画幅）信号最强；3:4 / 9:16 / 4:3 也都成立。16:9 极端宽画幅由于上下 rebate 占比变高，主图被挤窄，信号弱化但仍可读
- **不适合**：
  - 极致宽画幅（16:9 + ）—— rebate 占比过高
  - 没有 EXIF Make 的源图（label 降级为 `FILM · 120 · ASA 400`，可读但少了真实感）

---

## 跨家族取舍

### 阴影策略对比

| 家族 | 阴影哲学 |
|---|---|
| 编辑 | 中等（让照片"漂浮"在弥散背景或纸面上） |
| 画廊 | 浅 (white) / 重 (noir)，浅底配浅阴影 / 深底配重阴影，对比度逻辑 |
| 即影 | 0 (polaroid) / 极浅 (instax)，模拟实物贴桌的物理感 |
| 胶片 | 0，胶片就是 2D，加阴影破坏物理直觉 |

### 文字色系（textStyle）

| 风格 | textStyle | 原因 |
|---|---|---|
| frosted / frosted-noir / gallery-noir / film-35 / film-mf | `light` | 深底白字 |
| gallery-white / polaroid / instax / torn / editorial / editorial-mirror | `dark` | 浅底深字 |

### 推荐 frame × template 默认配对

| frame | 推荐 default template | 备选 |
|---|---|---|
| frosted | minimal-text | tech-stack / wordmark |
| frosted-noir | minimal-text | tech-stack |
| gallery-white | wordmark | passport / minimal-text |
| gallery-noir | minimal-text | wordmark |
| polaroid | date-lens | wordmark |
| instax | date-lens | wordmark |
| torn | date-lens | passport / wordmark |
| film-35 | passport | slate / date-lens |
| film-mf | passport | minimal-text / slate |
| editorial | headline | wordmark |
| editorial-mirror | headline | wordmark |

> **当前并未实现"切相框时自动切默认模板"**——这是 Phase 5 的待办项。改造后用户切到 editorial 自动配 headline，切到 polaroid 自动配 date-lens，省一步操作。

---

## 已知边界 / 未覆盖的设计语法

按市场对照，photo-tools 当前**还没有**的相框语义：

1. **手撕白边 / 撕纸边缘**（torn-paper edge）：很多日记类 app 有，模拟从相册撕下来的不规则边
2. **多幅拼贴的整体相框**（contact sheet / 印样）：现在的 collage 是把 2–4 张照片塞进同一个相框；contact sheet 风格是把照片当成 36 张缩略图打印在一张纸上的样子
3. **真实相机机身复刻**（NOMO Pro / 一甲 风格）：把整个 Hasselblad / Leica 机身画进 frame；视觉冲击大但文件管理复杂（需要单独的机身 SVG 资产）
4. **木框 / 油画装裱**：质感型相框，需要纹理图，不能纯 ctx 画
5. **杂志整页排版**（spread）：当前 `editorial` 是右侧竖排，杂志真实排版常常是图文交错、栏宽变化的；下一步可以扩展为 `editorial-spread` 多列布局

---

## 后续候选改造方向（求 review 意见）

1. ~~**是否再加一款 `film-medium-format`（中画幅胶片）？**~~ ✅ **已实现**：作为 `film-mf`（参见 4.2 节）。设计上偏离了 doc 原始建议的"齿孔更稀疏"——深入实物对比后发现**真实 120 中画幅胶片没有齿孔**（靠 paper backing 推进，不是 sprocket），"无齿孔 + 更厚 rebate + 1/12 frame number + 6×6 标签"才是 medium-format 最强的视觉签名。slug 用 `film-mf` 而非 `film-medium-format`，跟 `film-35` 的简写约定保持一致
2. ~~**`gallery-noir` 的 phosphor 高光线现在很弱（rgba 0.16）—— 是否需要更明显？**~~ ✅ **已实现**：alpha 0.16 → 0.28（参见 2.2 节）。0.28 是 doc 建议探索区间 0.25–0.35 的下限，凑近看是清晰的细线但不抢戏，结构性边框感没出现。0.35 测过一次太硬了，回退
3. ~~**`editorial` 是否需要 left-aligned 镜像变体？**~~ ✅ **已实现**：作为独立 frame `editorial-mirror`（参见 1.4 节），不走 cfg flag——保持 frame 的"一个 key 一种视觉"原则，preset / share-code 也跟其他 frame 一样直接流转。新增 layout 选项 `extraLeftInset` 是 `extraRightInset` 的镜像，两者互斥
4. ~~**`polaroid` / `instax` 的底部 caption 区是否应该限制只能用某些模板？**~~ ✅ **已实现**：作为 picker 下方的**柔提示**（`#template-compat-hint`，accent 色调小 banner），不是硬禁用。两类不兼容组合：
   - `narrow`：即影家族（polaroid / instax / torn）+ 多行模板（slate / tech-stack）—— 底部窄 caption 区塞不下
   - `rotated`：编辑家族（editorial / editorial-mirror）+ 横排参数模板（slate / tech-stack）—— 旋转 ±90° 后字符竖排可读性差
   
   不硬禁用是因为有些用户可能就要这种"挤"的视觉。i18n 完整覆盖 zh-CN + en，建议替代项明确给出。`TEMPLATE_INCOMPAT` map 在 `public/app.js` 里集中维护
5. ~~**`film-35` 的 leader 印章字符串当前是 `品牌首字母 · ISO · DX`——是否过于工程化？**~~ ✅ **已实现**：升级为 `品牌全称 · ISOT · DX`（参见 4.1 节），且加了底部 frame number `· DDA ·` + 顶部方向箭头 `→`、warm dark 底色、自适应齿孔密度。如果未来想做 `filmStock` 自定义字段（让用户输入 "PORTRA 400" 这种真实胶卷型号），仍是 nice-to-have
6. ~~**缺位的"杂志手撕"**——是否值得开 Phase X 加？~~ ✅ **已实现**：作为 `torn`（参见 3.3 节），归到即影家族第三款而非新开 Phase X。同时落地了 `frame.clipPath` 公共钩子作为基础设施，未来需要"非矩形轮廓"的相框（手写胶带边、椭圆、宝丽来撕扯…）都能复用

---

## 文件位置（review 时对应到代码）

| 相框 | 源文件 | 别名 |
|---|---|---|
| frosted | `public/frames/frosted.js` | — |
| frosted-noir | `public/frames/frosted-noir.js` | `frosted-dark`（旧 cfg） |
| gallery-white | `public/frames/gallery-white.js` | `white`（旧 cfg） |
| gallery-noir | `public/frames/gallery-noir.js` | `black`（旧 cfg） |
| polaroid | `public/frames/polaroid.js` | — |
| instax | `public/frames/instax.js` | — |
| torn | `public/frames/torn.js` | — |
| film-35 | `public/frames/film-35.js` | — |
| film-mf | `public/frames/film-mf.js` | — |
| editorial | `public/frames/editorial.js` | — |
| editorial-mirror | `public/frames/editorial-mirror.js` | — |

共享基础设施：
- 注册机制：`R.registerFrame(name, def)` in `public/shared/render.js`
- 渲染管线：`compose()` in `public/clientRender.js` + `public/worker.js`（双线程镜像）
- 装饰钩子：`def.decorate(ctx, layout, args)` 在 caption 之后 / signature 之前调用
- 自定义剪裁路径：`def.clipPath(ctx, x, y, w, h, layout, args)` —— compose() 把这条 path 同时用于阴影投射、照片剪裁、签名剪裁，确保三层一致。撕纸边、不规则边、椭圆等非矩形轮廓相框走这条路
- 输出像素恒定：`layout.outputPx = max(0.5, scale × 0.6)`
- 非对称布局：`layout.extraRightInset` / `layout.extraLeftInset` / `layout.captionPrefer` / `layout.fgXOffset` / `layout.topPaddingBoost`
- 路径助手：`R.pathRoundRect(ctx, x, y, w, h, r)`（含老 Safari arcTo 兜底）

---

文档完。等你 review，提整改意见后我按建议改实现。
