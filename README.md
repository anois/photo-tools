<div align="center">

<img src="public/logo.svg" width="88" alt="photo-tools logo" />

# photo-tools

**Camera-real finishing aesthetics for your photos.**

Pick a seed · fork it in the workshop · share by URL. 100% in the browser.

<p>
<a href="https://anois.github.io/photo-tools/"><img src="https://img.shields.io/badge/launch_app-anois.github.io%2Fphoto--tools-e5493a?style=for-the-badge" alt="Launch app" /></a>
</p>

<sub>
<a href="https://photo-tools.oss-cn-hangzhou.aliyuncs.com/">CN mirror</a> ·
<a href="public/CHANGELOG.md">v1.0.0</a> ·
<a href="LICENSE">MIT</a> ·
<a href="README.zh-CN.md">中文</a>
</sub>

</div>

---

photo-tools is a photo-finishing engine that lives entirely in your browser. Drop in a photo (JPEG / PNG / HEIC), pick one of seven finishing aesthetics — silver darkroom print, mounted Kodachrome slide, 35mm negative with sprocket holes, torn paper edge, frosted-glass card, gallery passe-partout, instant print — then either keep the seed as-is or open the workshop and rewrite every render parameter yourself. A "look" is just a JSON snapshot, so you save your own, share by `#p=...` URL, and back-load via a personal S3 / R2 / OSS bucket if you want. Nothing leaves your device unless you ask it to.

## 7 finishing aesthetics, one engine

These are not skins. Each one is a tuned starting point — every render parameter (frame · template · padding · radius · caption placement · top-badge · grain · shadow · …) is reachable from the workshop and capturable into your own LOOK.

<table>
  <tr>
    <td width="20%" align="center"><img src="data/samples/01-film-mf_preview.jpg" alt="film-mf · slate template" /></td>
    <td width="20%" align="center"><img src="data/samples/02-slide-mount_preview.jpg" alt="slide-mount · date-lens template" /></td>
    <td width="20%" align="center"><img src="data/samples/03-film-35_preview.jpg" alt="film-35 · wordmark template" /></td>
    <td width="20%" align="center"><img src="data/samples/04-torn_preview.jpg" alt="torn · brand topTemplate" /></td>
    <td width="20%" align="center"><img src="data/samples/05-frosted-noir_preview.jpg" alt="frosted-noir · brand-logo template" /></td>
  </tr>
  <tr>
    <td align="center"><sub><b>📽 Silver print</b><br/><code>film-mf</code> · slate</sub></td>
    <td align="center"><sub><b>🎞 Slide mount</b><br/><code>slide-mount</code> · date-lens</sub></td>
    <td align="center"><sub><b>🎞 35mm film</b><br/><code>film-35</code> · wordmark</sub></td>
    <td align="center"><sub><b>📜 Torn paper</b><br/><code>torn</code> · brand-model</sub></td>
    <td align="center"><sub><b>✨ Frosted noir</b><br/><code>frosted-noir</code> · brand-logo</sub></td>
  </tr>
</table>

<sub>Above are 720px previews. Full-resolution outputs sit under <a href="data/samples/"><code>data/samples/</code></a>.</sub>

## The 30-second loop

1. **Drop a photo onto the canvas.** EXIF gets parsed automatically; HEIC transcodes in the browser via a lazy-loaded libheif wasm shim, so iPhone shots work without conversion.
2. **Pick a LOOK** from the picker (or paste a `#p=` share-code from a friend). Five tuned seeds ship with the app; user-saved presets list right below.
3. **Export.** Single photo → JPEG / PNG; batch → ZIP via a web-worker pool. EXIF round-trips intact (Make / Model / focal / aperture / shutter / ISO / lens / date / GPS).

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/01-desktop-main.png" alt="Main canvas with photo loaded" /></td>
    <td width="50%"><img src="docs/screenshots/02-desktop-look-picker.png" alt="LOOK picker open with 5 factory seeds" /></td>
  </tr>
  <tr>
    <td align="center"><sub>Main canvas — sidebar / canvas / filmstrip</sub></td>
    <td align="center"><sub>LOOK picker — seeds + saved presets + share/paste</sub></td>
  </tr>
</table>

## Workshop — seeds, not skins

The product model is **engine + community look library**, not "fixed frames + a few sliders". When a seed isn't quite your photo's vibe, the workshop opens with every knob the engine exposes: corner radius, caption-inside-photo with sub-pixel lift, torn-paper jitter/density/edge, vintage-print age scalar, top-of-frame badge picker, custom background image, drop-shadow tuple, signature overlay. Every change becomes a new LOOK you can save, share by URL, or apply to the whole rail.

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/03-desktop-workshop.png" alt="Workshop drawer open" /></td>
    <td width="50%"><img src="docs/screenshots/04-desktop-crop.png" alt="Crop & rotate modal" /></td>
  </tr>
  <tr>
    <td align="center"><sub>Workshop — every render knob exposed</sub></td>
    <td align="center"><sub>Crop & rotate — per-photo, render-time only</sub></td>
  </tr>
</table>

## Compose mode — direct manipulation (1.1+)

Crop, rotation, and per-edge padding now live in a single full-bleed surface that unifies them into one direct-manipulation language. Open it from the lookbar's **Compose** entry (the 6th independent block, sibling of LOOK + the four lookchips). The interaction model:

- **Inside the photo** = crop. Drag the corner brackets to tighten composition.
- **In the frame margin** = padding (independent per edge). Push the bars to reshape the frame paper around the photo.
- **Top stem + ring** = rotation. Default 90° snap; hold `Shift` for free 1° increments.
- **Drag inside the photo body** = pan the cropped region.

The cropped-out part of the source stays visible at 30% opacity as a "ghost layer" behind the rendered preview, so you always see what's getting clipped. Each frame declares a `minPadding` recommendation (e.g. film-35 wants ≥ 70 px top + ≥ 90 px bottom for the sprocket rows) — when you cross it, a soft red warning band appears on that edge, but the engine never clamps your input. A bench across the bottom of the dialog always shows the live numbers (`W × H`, `T / R / B / L`, angle) and every value is a typeable input for precise composition.

## Share by URL, not by file

A LOOK is a base64url-encoded JSON snapshot. Copy `#p=<code>`, send it as a chat message, the recipient's app applies it on boot. If you want to share *photos* (not just the look), the S3 cloud module signs SigV4 directly from the browser against your own bucket: upload the rail, copy a `#s3=<code>` URL, the recipient sees your gallery with a thumbnail grid + lightbox preview + per-image or bulk-ZIP download. Pure-frontend signing (vendored aws4fetch, ~12 KB, lazy-loaded only on first cloud-panel open), three providers handled (AWS S3 / Cloudflare R2 / Aliyun OSS).

<table>
  <tr>
    <td width="50%" align="center"><img src="docs/screenshots/05-mobile-main.png" alt="Mobile main UI" width="300" /></td>
    <td width="50%" align="center"><img src="docs/screenshots/06-mobile-look-picker.png" alt="Mobile LOOK picker as bottom sheet" width="300" /></td>
  </tr>
  <tr>
    <td align="center"><sub>Mobile main — lookbar at thumb zone</sub></td>
    <td align="center"><sub>Mobile LOOK picker — bottom-sheet native</sub></td>
  </tr>
</table>

## What's inside the toolkit

| Axis | What's there |
|---|---|
| **Frames** | 7 hand-tuned styles in 4 families — Editorial (`frosted-noir`) · Gallery (`gallery-white`) · Instant (`instax` · `torn`) · Film (`film-35` · `film-mf` · `slide-mount`) |
| **Captions** | 11 templates in 4 grammars — Spec (`minimal-text` · `tech-stack` · `spec-grid` · `spec-rail`) · Brand (`brand-logo` · `brand-right`) · Editorial (`wordmark` · `headline`) · Stamp (`date-lens` · `slate` · `passport`) |
| **Engine** | Every render parameter UI-reachable + preset-capturable · LOOK seeds as first-class entries · `#p=<code>` share-link round-trip |
| **Input** | JPEG / PNG / HEIC (libheif lazy-loaded) · auto EXIF · `LensInfo` → lens-model fallback · per-photo manual override |
| **Output** | Single + batch (web-worker pool) · JPEG / PNG · EXIF round-trip preserved · RAW pass-through from cloud gallery |
| **Composition** | Collage 2 / 3 / 4 cells · 90° rotation · free-form crop (render-time, source untouched) · GPS auto-parse + manual + map picker (Leaflet + AutoNavi, GCJ-02 ↔ WGS-84) |
| **Cloud** | Direct-from-browser SigV4 against your bucket (AWS S3 / Cloudflare R2 / Aliyun OSS) · `#s3=<code>` share-link · upload / gallery / lightbox / bulk download |
| **Platform** | Installable PWA · offline shell · Chinese / English UI · brand logos for Fujifilm · Sony · Leica · Nikon · Canon · Apple · Xiaomi · OPPO · Vivo · DJI · … |
| **Surface** | Desktop and mobile speak their own gesture grammar — sidebar + keyboard shortcuts on desktop, bottom sheets + thumb-zone CTA + swipe on mobile |

## Run it locally

```bash
git clone https://github.com/anois/photo-tools.git
cd photo-tools
npm install
npm run build       # generates logos.json + fonts.css
npm run dev         # → http://localhost:3000
```

No transpilation, no bundler, no backend process — `serve` only serves static files.

- **Deeper architecture** (render pipeline, cfg / LOOK / share-link data model, frame & template systems, PWA cache layering, cloud module, plus step-by-step recipes for adding a frame / template / aspect / brand logo / translation in a fork) → [`docs/architecture.md`](docs/architecture.md)
- **Deployment** (GitHub Pages workflow, other static hosts, full Aliyun OSS China-mirror setup, custom domain) → [`docs/deploy.md`](docs/deploy.md)

## 🤖 Maintained by Claude Code

**Every commit in this repository is produced by a [Claude Code](https://claude.com/claude-code) session.** Code, frame definitions, render math, UI wiring, CSS, i18n strings, this README, the CHANGELOG, the deploy workflow — there is no human-authored line of code in the visible history, and there isn't supposed to be. This is the project's actual operating model, not a marketing flourish.

- **Human-initiated PRs are not part of the workflow.** Please don't open one — it won't be merged. The single committer identity for this repo is the Claude Code maintenance pipeline.
- **Input channel = [GitHub Issues](https://github.com/anois/photo-tools/issues/new).** Plain prose is fine; describe what you'd like in a few lines. Reasonable issues get pulled periodically, handed to a Claude Code session that implements + tests + writes the CHANGELOG bullet + opens the PR + (after the maintainer's local acceptance) merges + auto-deploys.
- **Auditable**: every shipped change shows up in [`public/CHANGELOG.md`](public/CHANGELOG.md). The ✦ pill in the topbar surfaces it inside the app, with an accent dot whenever there's a version you haven't seen yet. Commit history is the audit trail; PR descriptions document why each shipped.

## License

[MIT](LICENSE) for the code in this repository.

The repository additionally bundles third-party assets that retain their own licenses:

- **Inter** font subset — [SIL Open Font License 1.1](https://fonts.google.com/specimen/Inter)
- **Brand logo SVGs** (`public/logos/*.svg`) — sourced from Wikimedia Commons and [simple-icons](https://simpleicons.org/) (CC0). Trademarks remain with their respective owners; the logos are used here for the personal-use purpose of compositing photo metadata onto user-supplied images
- **Vendored libraries** retain their upstream licenses: exifr (MIT) · piexifjs (MIT) · JSZip (MIT/GPL) · libheif-js (LGPL) · Leaflet (BSD-2-Clause) · aws4fetch (MIT)

This is a personal photo tool. Bundled third-party assets are used for personal photo compositions; no redistribution, no commercial product. Rendering quality and bug fixes take precedence over theoretical legal hedging.

---

<div align="center">
<sub><a href="https://github.com/anois/photo-tools">github.com/anois/photo-tools</a> · every line shipped by <a href="https://claude.com/claude-code">Claude Code</a></sub>
</div>
