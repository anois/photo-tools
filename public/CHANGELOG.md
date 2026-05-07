# 更新日志 / Changelog

> 本项目完全由 [Claude Code](https://claude.com/claude-code) 自主迭代维护。提需求 / 报 bug 请提交 [GitHub Issue](https://github.com/anois/photo-tools/issues/new)，我们会定时捞取合理的请求走流水线自动上线。

每次有意义的功能 / 修复 / 优化都记到这里 —— 同一份文件既给开发者看，也通过顶栏 ✦ 按钮在应用内展示给用户。

## 0.5 · 2026-05-07

### 🌀 旋转 & 裁剪 (Rotate & crop overhaul)

- **旋转改为任意角度** — `cfg.rotation` 从 0/90/180/270 整数升级为 [0, 360) 浮点数，渲染管线（前台 + worker）的 fg 与 frosted bg pass 全改用 transform composition（`drawRotatedCroppedSrc`）。0°、90°、30°、−15.5° 走同一份代码路径
- **旋转控件并入裁剪 modal** — B · Frame 段不再有独立的 ↶ ↷，改为单按钮 "裁剪 & 旋转…"。打开 modal 后 stage 上方多一条旋转工具栏：↶ 90° 步进 / 滑块（−180° → +180°，0.5° 步精度）/ ↷ 90° 步进 / 实时角度读数 / 归零按钮。slider 拖动实时同步主预览 + modal 画布 + 顶栏的 frame badge
- **B · Frame 几何摘要** — "Crop & rotate…" 按钮上方新增一行 mono-caps 读数（如 `−15.5°　·　已裁剪`），让用户在不打开 modal 的情况下也知道当前几何状态
- **预览 modal 画布按旋转 bbox 动态 resize** — 拖滑块时画布会跟随旋转后的 bounding box 重新 fit 到 stage，非 90° 角度下角落自然出现透明区，是标准的"straighten preview"视感

### 🐛 修复

- 比例锁定按钮重复点击越裁越小 — `refitRectToAspect` 之前是"在前一个 rect 内 fit"，每次都基于上一帧缩水。改成"在原图内最大 fit + 居中"，每次点击都从原图算起。1:1 → 3:4 → 1:1 现在每次都给出同一个最大 1:1 框

### ⚠️ 已知限制

- 非轴对齐角度（比如 23°）下，裁剪框可以被拖到旋转 bbox 的透明角落区域，导出后那里会是黑边（JPEG）/ 透明（PNG）。后续会加 inscribed-rect 自动约束，目前需用户手动避开

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
