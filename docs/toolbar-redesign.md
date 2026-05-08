# 工具栏重设计 · 设计提案 v1

**2026-05-08 · 当前主干 0.14.1**

打破"7 个 section 上下排列填表"的现状，从你**真实使用路径的频率分布**出发，重新组织所有 11 个功能点的可达性。

配套交互原型：[`toolbar-redesign-mockup.html`](toolbar-redesign-mockup.html)（独立 HTML，浏览器直接打开就能点）。

---

## 1 · 现状诊断

当前左侧 `.pane-controls` 的结构（7 个 section，纵向堆叠）：

```
[原图] → [相框] → [文字] → [EXIF] → [拼贴] → [签名] → [导出]
```

加上左缘 52px 的 `#section-nav` activity rail 让用户跳章节。控件宽度 360px、活动 rail 52px，**一共占 412px**。

**问题**：

| # | 痛点 | 根因 |
|---|---|---|
| 1 | 每次都要从顶部滚到底部找导出按钮 | "导出"是高频功能，但被排在第 7 节最末 |
| 2 | 想"换风格再导出"时被中间一堆 EXIF / 拼贴 section 阻断 | 7 节都是平等的 nav target，但实际频率根本不平等 |
| 3 | 11 款相框 / 9 个模板的视觉选择疲劳 | 现在用文字 chip 名字（"frosted"/"frosted-noir"），用户必须读+回忆+对应到视觉 |
| 4 | 桌面 412px 的 chrome 把画布挤窄了；移动端整屏被表单占满 | 表单驱动布局，画布不是主角 |
| 5 | 高频 / 低频功能视觉权重一样 | 「点 4 下进 Crop」跟「点 4 下选 Frame」一样累，但前者一周才一次 |
| 6 | 缺乏 power-user 的快捷入口 | 没有 command palette / 全局搜索 / 任务级 shortcut |

**频率分布**（你自己的使用估算，作为设计 north star）：

| Tier | 功能 | 频率 |
|---|---|---|
| **Hot path** | 选 frame · 选 template · 选 aspect · 调 quality · 导出 | **每次 100%** |
| **Per-photo** | 调 padding / captionH · 勾 show fields · 切照片 · 看进度 | 60% |
| **Occasional** | crop / rotate · EXIF override · 自定义画幅 | 15% |
| **Config-once** | 上传签名 · 装拼贴 · 存预设 / share · 切语言 · 看 changelog | <5% |

按这个分布，当前 UI 给最少用的功能（拼贴、签名、预设）和最常用的（导出）**等同视觉权重 + 等同点击成本**。这是要打破的核心。

---

## 2 · 设计原则

四条原则贯穿整个重设计：

1. **画布为主，工具按需** — canvas 是主角，工具栏不是。Hot path 控件以 chip 形式贴底，画布之外只露最小化的入口
2. **视觉先，文字后** — 11 款相框、9 个模板都用**实时小预览**而不是名字。用户挑画面，不挑字符串
3. **三层暴露**（与频率严格匹配）：
   - **Tier 1 · 0 击可见**：5 个核心 chip 永远在底部 Look bar（frame · template · aspect · quality · export）
   - **Tier 2 · 1 击 popover**：每个 chip 点开是聚焦 picker，整屏只一个 picker active
   - **Tier 3 · 1 击进 Workshop**：crop / EXIF / 签名 / 拼贴 / 预设 全部归到一个右侧滑出 drawer，互斥 tab
4. **Mobile / Desktop 同 model 异 surface** — 共享同一份「3 个 chip + Workshop」心智模型，移动端用 native 底部 sheet，桌面端用 floating dock + slide-in drawer。**不是缩放，是重设**

---

## 3 · 候选方向（3 条，对比择一）

### 方向 A · Dock + 弹出 picker （**推荐**）

**核心比喻**：底部 floating Look bar = 永远在的"控制中心"；点 chip 弹出聚焦 picker；深度工具进右侧 Workshop drawer。

- **Hot path 0 击可见**：5 个 chip + 导出按钮永远贴底
- **Picker = 视觉网格**：点 frame chip → 11 个迷你预览（用当前照片实时渲染），按 4 家族分组；点 template chip → 9 个 caption typography 预览
- **Workshop drawer**：右上角 ⋯ → drawer 滑出，tab 内是 Crop · EXIF · 签名 · 拼贴 · 预设。一次只看一个 tab
- **⌘K 命令面板**：key trigger，搜得到所有 frames / templates / actions
- **手机版**：底部 sheet 三段式（peek 88px / quick 50% / full 95%），peek 永远露 5 chip + Export

| 优点 | 缺点 |
|---|---|
| Hot path 真的快（0 击）| 需要 picker 内做 mini-render（实现成本中） |
| 视觉化选择消除选择疲劳 | command palette 对手机用户价值打折 |
| 桌面端画布占比 +30%（412 → 0px chrome）| Workshop drawer 可能藏得太深，新用户得摸一下 |
| 移动端 native 底部 sheet 配 thumb-zone export | 现有 7 section 心智模型要丢掉 |

### 方向 B · Radial Tool Wheel （**否决**）

把 frame picker 做成轮盘，长按画布 → 圆形 picker 围绕指尖出现。

- 速度快、空间利用极致、视觉惊喜
- **否决原因**：（a）键盘 / 鼠标 hover 派的桌面用户基本无解；（b）发现性灾难，新人完全不知道怎么开；（c）实现复杂度爆炸（圆周 layout + 11 个 frame 摆不开）；（d）你说一天 50 次——肌肉记忆是好的，但 1.0 之前不应该把所有牌押在一个高门槛交互上

### 方向 C · 命令面板优先 （**部分采纳**）

把 ⌘K 做成主入口，传统侧栏全删，所有操作都靠搜索。

- 极致 power user
- **否决（作为主交互）原因**：（a）手机端命令面板 ≈ 笨拙的搜索框；（b）你 50 次 / 天里大部分是"看一眼 → 换 frame → 导出"，搜索是中间多余的一步；（c）选择疲劳问题没解决，因为搜不出"哪个 frame 在我这张照片上好看"
- **采纳作为补充**：方向 A 里保留 ⌘K 作为 power-user 加速器，搜得到所有 frame / template / action，但不是默认入口

---

## 4 · 选定方向 A · 详细 Spec

### 4.1 桌面布局（≥900px viewport）

```
┌───────────────────────────────────────────────────────────────────┐
│ Topbar 48px                                                        │
│  ▣ photo·tools          [Import]   ⌘K   ⋯   中/EN   ✦   GitHub  │
├───────────────────────────────────────────────────────────────────┤
│                                                                    │
│                                                                    │
│                                                            ┃       │
│                                                            ┃ thumb │
│                  CANVAS (居中，最大化)                       ┃ thumb │
│                                                            ┃ thumb │
│                                                            ┃       │
│                                                            ┃ 64px  │
│                                                            ┃ 右侧  │
│                                                            ┃ 胶卷  │
│                                                                    │
├───────────────────────────────────────────────────────────────────┤
│ Look bar 64px (floating, glass)                                    │
│  ┌──┬──────────┬────────────┬─────────┬────────┐    ┌──────────┐ │
│  │▦ │ Frosted  │ Minimal·tx│  9:16   │ Std·1× │    │ ⤓ Export │ │
│  └──┴──────────┴────────────┴─────────┴────────┘    └──────────┘ │
│   ↑ frame chip — 含一个 12px live mini-preview thumbnail           │
└───────────────────────────────────────────────────────────────────┘
```

**关键实体**：

- **Look bar**（底部 64px）：5 个 chip 永远在；Export 按钮 accent 红 fill，永远在右；chip 之间用 1px line-strong 分隔；整 bar 用 backdrop-filter blur(20px) + bg-chrome 70% alpha，画布微微透出来给环境感
- **Photo rail**（右侧 64px 窄条）：垂直缩略图，活跃的有 1px accent 边；上下箭头 / J·K 切换不变
- **顶 bar**（48px）：极简，只露 wordmark · Import · ⌘K · ⋯ · 中/EN · ✦ · GitHub
- **左侧 0px**：彻底没有 sidebar 也没有 activity rail。**这是本设计最大胆的一个动作**

**Picker 弹出（点 chip 后）**：

锚定在 chip 上方，向上展开：

```
       ┌────────────────────────────────────────────┐
       │  Editorial                                  │
       │  ┌──────┐ ┌──────┐ ┌──────┐               │
       │  │frost │ │noir  │ │spread│               │
       │  └──────┘ └──────┘ └──────┘               │
       │  Gallery                                    │
       │  ┌──────┐ ┌──────┐                         │
       │  │ white│ │ noir │                         │
       │  └──────┘ └──────┘                         │
       │  Instant                                    │
       │  ┌──────┐ ┌──────┐ ┌──────┐               │
       │  │polar.│ │instax│ │ torn │               │
       │  └──────┘ └──────┘ └──────┘               │
       │  Film                                       │
       │  ┌──────┐ ┌──────┐                         │
       │  │ 35mm │ │  MF  │                         │
       │  └──────┘ └──────┘                         │
       └────────────────────────────────────────────┘
       ┌──┐
       │▦ │ Frosted ←── chip 锚点
       └──┘
```

每个 tile 是 120×72px 的当前照片在那个 frame 下的 mini-render（用 cache，第一次开 picker 时一次性生成 11 张，后续切照片 invalidate）。Selected tile 有 accent 红描边 + ✓ 角标。Hover 微缩放 1.03x。

Template picker 同结构：9 个 tile，每个 tile 是当前照片 EXIF 走那个 template 后的 caption 区典型样式（120×72，模拟字幕条）。

### 4.2 Tier 3 · Workshop Drawer

点右上 ⋯ → 从右滑入 360px 宽 drawer，遮住右侧胶卷一部分（drawer 在胶卷上层，半透明背景遮罩点了关闭）。

drawer 顶部 5 个 tab（互斥）：

```
┌──────────────────────────────────────┐
│ × Workshop                            │
├──────────────────────────────────────┤
│ [Tweak] [EXIF] [Sign] [Tile] [Lib]   │  ← 5 互斥 tab
├──────────────────────────────────────┤
│                                       │
│  Tab 内容                             │
│  - Tweak: padding / captionH / 高级   │
│           shadow / crop & rotate /    │
│           show fields                 │
│  - EXIF: 所有 EXIF override 输入框   │
│  - Sign: 上传 + 9 宫格 + size + α    │
│  - Tile: 拼贴布局 + 伴随照片          │
│  - Lib: 预设保存 / 应用 / share       │
│                                       │
└──────────────────────────────────────┘
```

只有当前 active tab 渲染，其它 tab 是 lazy。drawer 关闭时整体卸载。

### 4.3 ⌘K 命令面板

居中 modal 600×400，单行搜索框 + 结果列表。模糊搜：

- `frosted` → 跳到那个 frame
- `polaroid date-lens` → 切 frame + template
- `crop` → 打开 Workshop > Tweak > 滚到 crop
- `export ⇧` → 触发批量 ZIP
- `1:1` → 切 aspect

行尾显示 hint shortcut（如果有）。↑↓ 选 / Enter 触发 / Esc 关。

### 4.4 移动布局（<900px viewport）

```
┌────────────────────┐
│ ▣ photo·tools  ⋯ ✦ │ 44px topbar
├────────────────────┤
│                    │
│                    │
│      CANVAS        │
│      （满铺）        │
│                    │
│                    │
│                    │
│ ··●··············  │ ← 4px horizontal photo dots
├────────────────────┤
│ ━━━━━ (drag)       │ ← 底部 sheet handle
│ ┌──┬───┬───┬───┐  │
│ │▦ │ Tx│ 9:│ St│  │ ← 5 chip 紧凑排
│ └──┴───┴───┴───┘  │
│  [⤓ EXPORT]        │ ← 全宽 export
└────────────────────┘
```

底部 sheet 三档 snap：

| 档位 | 高度 | 内容 |
|---|---|---|
| **Peek** | 96px (default) | drag handle + 5 chip + 全宽 Export |
| **Quick** | 50% screen | 加 padding 滑块 + show fields chips + EXIF brand 自动检测警告（如果有） |
| **Full** | 95% screen | Workshop 全套 5 tab，跟桌面 drawer 一样 |

drag handle 上下拖动 snap 切档。tap chip 永远全屏 take-over picker（不是 popover），因为手机屏幕太窄，popover 受限。

⋯ 顶部菜单包含 Workshop 入口（直接打到 Full 档某个 tab）+ 切语言 + 看 changelog 等极低频。

照片切换不再是右侧胶卷，改成 canvas 下方 4px 高的 dots row + 左右 swipe。

### 4.5 命中表（11 功能点 × 新设计 vs 旧设计 击数对比）

| 功能 | 旧（章节模型） | 新（Dock 模型） | 变化 |
|---|---|---|---|
| 选 frame | 滚 + 看到 + 点 chip ≈ 2 击 | tap frame chip + tap tile = 2 击，但 100% 视觉化 | 击数同，质量+++ |
| 选 template | 同上 ≈ 2 击 | 同 | 同 |
| 选 aspect | 1 击（已经是 chip） | 1 击 | 同 |
| 调 padding | 滚到 B 节 + 拖 = 2 击 | ⋯ → Tweak tab → 拖 = 3 击 | -1 (合理：低频) |
| 调 quality | 滚到导出 + 选 = 2 击 | 1 击 | +1 |
| **Export current** | 滚到底 + 点 = 2 击 | **0 击 + 1 click** = 1 击 | **+1，最大改善** |
| Export batch | 滚到底 + 点 = 2 击 | long-press export OR ⌘K"export batch" | 同 |
| Crop & rotate | 滚到 B + 点 = 2 击 | ⋯ → Tweak → 滚到 = 3 击 | -1 (低频可接受) |
| EXIF override | 滚到 D + 展开 details + 输入 = 3 击 | ⋯ → EXIF tab + 输入 = 3 击 | 同 |
| 上传签名 | 滚到签名 + 点 = 2 击 | ⋯ → Sign tab = 2 击 | 同 |
| 拼贴布局 | 滚到拼贴 + 选 = 2 击 | ⋯ → Tile tab + 选 = 3 击 | -1 (低频可接受) |
| 存预设 | 找 B 顶部 details + 输入 = 3 击 | ⋯ → Lib tab + 输入 = 3 击 | 同 |
| 切语言 / changelog | top bar = 1 击 | top bar = 1 击 | 同 |

**关键观察**：高频（前 5 行）平均 **击数持平或减少**；低频（中段）平均 **+1 击**。这是有意为之——用低频的 +1 击换高频的 -1 击和 hot path 永远可见。

---

## 5 · 视觉与字体

**沿用项目现有 token**，不引新美学：

- 配色：继续用 `--bg-base` `--bg-chrome` `--bg-elev` `--accent #e5493a` `--text` 系列
- 字体：继续 **Fraunces (display) + Hanken Grotesk (UI) + JetBrains Mono (technical)**——这套 trio 已经够特别了
- Look bar 视觉：`backdrop-filter: blur(20px)` + `bg-chrome` 70% alpha，下面画布微微透；底部 1px `--accent-line` 高光；chip 间 1px subtle 分隔线
- Picker tile 视觉：圆角 8px，hover 1.03x scale，selected accent 边 + ✓ 角标
- Workshop drawer：从右滑入，shadow box 重，bg-elev 实色

唯一新视觉：**底部 Look bar 的 frame chip 含一个 12×8px live mini-preview**——能让用户在不开 picker 的情况下从 chip 本身瞥见当前 frame 的视觉。这是项目独有的（其他 SaaS 工具的 chip 都是文字）。

---

## 6 · 迁移策略（增量上线，可逆）

不一次性重写整个 `app.js` + `index.html`，而是分 4 期渐进迁移，每期独立 PR、独立可回退：

| Phase | 范围 | 风险 |
|---|---|---|
| **P1 · Look bar 落地** | 在现有 sidebar 之外新加底部 Look bar，5 chip 触发现有的 frame/template/aspect/quality/export 路径。**侧栏先不动**——先让 hot path 双轨可用 | 低 |
| **P2 · Picker 替换** | 把 frame seg 和 template seg 的点击改造成开 popover picker；旧 chip 在侧栏并存仍可用 | 低 |
| **P3 · 移除侧栏 + Workshop drawer** | 抽掉 `.pane-controls` + `#section-nav`，把 padding / EXIF / 签名 / 拼贴 / 预设 全搬进 drawer | 中 |
| **P4 · ⌘K + 移动 sheet** | 命令面板 + 移动底部 sheet 三档实现；桌面只剩 hot path + drawer | 中 |

每期都有 smoke 检查 + 浏览器 MCP 验证。预设 / share-code / cfg schema 全程保持兼容。

---

## 7 · 风险与开放问题

1. **Mini-render 性能**：picker 第一次开需要并发渲染 11 张当前照片小图。粗估每张 ~30ms，11 张 = 330ms 总耗时，开 picker 时显示骨架屏 → fade in
2. **Picker 关闭范围**：点 chip 外/Esc/再点 chip 都关；移动端全屏 picker 用顶部 X 关
3. **Workshop drawer 内 5 tab 的优先顺序**：建议按你的频率排——Tweak / EXIF / Sign / Tile / Lib
4. **保留 activity rail / Section nav 吗？**：方案是**不保留**。但如果你坚持要 nav 兜底，可以折中放在 ⋯ 菜单下「跳到 Tweak / EXIF / ...」7 行
5. **导出按钮 + long-press 的 mobile UX**：移动端 long-press export 触发批量需要明显视觉反馈（haptic / 进度环）。或者长按弹小菜单「单张 / ZIP / 当前 + 原图」

---

## 8 · 立即可看的产物

[`toolbar-redesign-mockup.html`](toolbar-redesign-mockup.html) 是这套设计的**可交互原型**，独立 HTML，浏览器直接打开就行。包含：

- 完整桌面布局（带 fake 渲染照片做画布占位）
- Look bar + 5 chip + Export 全部可点
- Frame picker / Template picker / Aspect picker 都是真打开的
- Workshop drawer 5 tab 切换
- ⌘K 命令面板（按 ⌘K 或 Ctrl+K 触发）
- 响应式：拖到 <900px 自动切移动 sheet 视图

不是 production code，但能让你**亲自 tap / 看节奏**判断这套交互对不对。看完愿意开 PR 我们就走 P1。
