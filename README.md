<div align="center">

<img src="public/logo.svg" width="84" alt="photo-tools logo" />

# photo-tools

**Frosted-glass camera frame for your photos — pure browser, no server.**

[![Live demo](https://img.shields.io/badge/live_demo-anois.github.io%2Fphoto--tools-e5493a?style=flat-square)](https://anois.github.io/photo-tools/)
[![No build step](https://img.shields.io/badge/build-vanilla_HTML/JS-1d2329?style=flat-square)](#stack)
[![Node](https://img.shields.io/badge/node-%3E%3D18-1d2329?style=flat-square)](#quick-start)
[![Repo](https://img.shields.io/badge/source-github-1d2329?style=flat-square&logo=github)](https://github.com/anois/photo-tools)

</div>

A single-page web app that wraps photos in a "frosted-glass" frame — blurred self-background, rounded foreground, EXIF caption with brand logo. Drag in a photo, pick a frame, export. Everything runs in your browser; no upload, no backend.

```
   ┌─────────────────────┐
   │ ░░░░░░░░░░░░░░░░░░ │
   │ ░ ┌──────────────┐ ░ │       blurred self-background
   │ ░ │              │ ░ │       + rounded foreground
   │ ░ │    photo     │ ░ │       + EXIF caption
   │ ░ │              │ ░ │
   │ ░ └──────────────┘ ░ │
   │   FUJIFILM  X-T5    │
   │   46mm  F4.5  1/210s │
   └─────────────────────┘
```

## Features

- **5 frame styles** — frosted, frosted-dark, white, black, polaroid
- **5 caption templates** — minimal-text, brand-logo, brand-right, tech-stack, date-lens
- **Real bundled brand logos** — Fujifilm, Sony, Leica, Nikon, Canon, Apple, Xiaomi, OPPO, Vivo, DJI… (Wikimedia Commons + simple-icons)
- **Auto EXIF parsing** with per-photo manual override and `LensInfo` → lens-model fallback
- **Live preview** via Canvas2D + GPU `ctx.filter` blur — no round-trip to a server
- **Single + batch export** with EXIF round-trip preserved on JPEG (Make / Model / focal / aperture / shutter / ISO / lens / date / GPS)
- **Web-Worker pool** for batch render off the main thread
- **Mobile-friendly** sticky-preview stacked layout for phones

## Preview

Two real outputs from the live pipeline:

<table>
  <tr>
    <td width="50%"><img src="data/00010_preview.jpg" alt="Cafe wall — frosted-dark frame with single-line caption" /></td>
    <td width="50%"><img src="data/00012_preview.jpg" alt="Industrial structure at dusk — frosted frame with stacked tech caption" /></td>
  </tr>
  <tr>
    <td align="center"><sub><b>frosted-dark</b> · <b>minimal-text</b><br/>FUJIFILM X-M5 · 27mm F1.6 1/100s ISO4000</sub></td>
    <td align="center"><sub><b>frosted</b> · <b>tech-stack</b><br/>FUJIFILM X-M5 · SIGMA 18-50mm F2.8 · 2026.02.21</sub></td>
  </tr>
</table>

<sub>Above are 480px previews. Full-resolution outputs (`data/*_framed.jpg`) and the source originals sit side-by-side under [`data/`](data/) so you can compare the round-trip.</sub>

## Quick start

```bash
git clone https://github.com/anois/photo-tools.git
cd photo-tools
npm install
npm run build       # generates logos.json + fonts.css
npm run dev         # → http://localhost:3000
```

That's it — open the URL, drop in a photo, tweak the controls, export.

## How it works

```
┌──────────────────────────── browser tab ─────────────────────────────┐
│                                                                      │
│  index.html → <script> vendored libs (exifr, piexif, jszip)         │
│             → <script> shared/render.js   (layout + frames + caption SVG)
│             → <script> exifio.js          (parse + write JPEG EXIF) │
│             → <script> clientRender.js    (Canvas pipeline)         │
│             → <script> exporter.js        (single + batch + ZIP)    │
│             → <script> app.js             (UI + per-photo cfg)      │
│                                                                      │
│  Boot fetch: logos.json (~60KB)  +  fonts.css (~870KB base64 Inter) │
└──────────────────────────────────────────────────────────────────────┘
```

A single shared module — `public/shared/render.js` — owns all layout math, frame definitions, caption-SVG construction, and template rendering. The on-screen preview and the full-resolution export both go through the same code path; only the canvas size differs.

For exhaustive architecture notes, see [CLAUDE.md](CLAUDE.md).

## Project layout

```
photo-tools/
├── public/                 ← deployable artifact (no build step)
│   ├── index.html
│   ├── app.js              ← UI wiring + per-photo cfg state
│   ├── shared/render.js    ← layout + frames + caption SVG (single source of truth)
│   ├── clientRender.js     ← Canvas2D compose pipeline (preview + export)
│   ├── exifio.js           ← EXIF parse (exifr) + JPEG re-attach (piexifjs)
│   ├── exporter.js         ← single + batch export + ZIP packing
│   ├── worker.js           ← off-main-thread render for batch
│   ├── progressModal.js    ← <dialog> controller for batch progress
│   ├── styles.css
│   ├── logo.svg            ← project logo (favicon + README header)
│   ├── vendor/             ← exifr, piexif, jszip (vendored, no CDN)
│   ├── logos/*.svg         ← brand logo source SVGs (Wikimedia + simple-icons)
│   ├── fonts/*.ttf         ← Inter Regular + SemiBold
│   ├── logos.json          ← built from logos/*.svg
│   └── fonts.css           ← built from fonts/*.ttf
├── scripts/
│   ├── build-logos.js      ← logos/*.svg  → logos.json
│   ├── build-fonts.js      ← fonts/*.ttf  → fonts.css
│   └── fetch-logos.sh      ← scrape Wikimedia Commons / simple-icons
└── data/                   ← reference input/output photos
```

## Deployment

The `public/` directory is the entire deployable artifact — no transpilation, no bundling. Any static host works.

**GitHub Pages** (live at [anois.github.io/photo-tools](https://anois.github.io/photo-tools/), $0):

The workflow lives in [.github/workflows/deploy.yml](.github/workflows/deploy.yml). Every push to `main` triggers it: install deps → `npm run build` → upload `./public/` → publish. Manual re-runs available via the **Actions** tab.

**One-time setup**: in repo Settings → Pages, set **Source** to `GitHub Actions`.

**Other hosts** (S3 + CloudFront, Cloudflare Pages, Netlify, Vercel, …): same idea — point them at `public/` after running `npm run build`.

## Stack

- **Vanilla HTML/JS** — no framework, no transpilation, no build pipeline at runtime
- **CommonJS only** — `public/shared/render.js` is a UMD module so the same source file runs both in the browser and under Node `require()` for ad-hoc rendering smoke checks
- **Canvas2D + WebWorker** — `createImageBitmap` decode, `ctx.filter='blur()'` for the frosted background, `ctx.drawImage` composition, `OffscreenCanvas.convertToBlob` encode
- **Vendored libraries** — [exifr](https://github.com/MikeKovarik/exifr), [piexifjs](https://github.com/hMatoba/piexifjs), [JSZip](https://stuk.github.io/jszip/) — no CDN dependency

## Adding a brand logo

1. Drop `public/logos/<brand-slug>.svg` (Wikimedia multi-color preferred; simple-icons single-color works too).
2. `npm run build-logos`
3. Refresh the browser. If EXIF `Make` doesn't match the slug directly, add an entry to `ALIASES` in `public/shared/render.js`.

## Adding a frame / template / aspect ratio

See the **Extending** section of [CLAUDE.md](CLAUDE.md#extending) — concise step-by-step for each.

## Personal-use mindset

This is a personal photo tool. Bundled third-party assets (brand logos, the Inter font) are used for personal photo compositions; no redistribution, no commercial product. Bug reports and rendering quality take precedence over theoretical legal hedging.

---

<div align="center">
<sub><a href="https://github.com/anois/photo-tools">github.com/anois/photo-tools</a></sub>
</div>
