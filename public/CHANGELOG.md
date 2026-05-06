# 更新日志 / Changelog

> 本项目完全由 [Claude Code](https://claude.com/claude-code) 自主迭代维护。提需求 / 报 bug 请提交 [GitHub Issue](https://github.com/anois/photo-tools/issues/new)，我们会定时捞取合理的请求走流水线自动上线。

每次有意义的功能 / 修复 / 优化都记到这里 —— 同一份文件既给开发者看，也通过顶栏 ✦ 按钮在应用内展示给用户。

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
