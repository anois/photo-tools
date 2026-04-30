# photo-tools

Pure-frontend single-page app that adds a "frosted-glass" camera frame (blurred self-background + rounded foreground + EXIF caption) to photos. Reference input / output pairs live in `data/`:

- `data/old.jpg` → `data/new.jpg` — original aesthetic target (frosted frame, minimal-text caption)
- `data/00010.JPG` → `data/00010_framed.jpg` — cafe wall, `frosted-dark` + `minimal-text`, FUJIFILM X-M5
- `data/00012.JPG` → `data/00012_framed.jpg` — industrial structure, `frosted` + `tech-stack`, FUJIFILM X-M5 + SIGMA 18-50/2.8 lens caption

The `_framed.jpg` outputs are real renders from the current pipeline — keep them as a visual regression baseline. If a refactor changes layout / typography, expect these to drift; re-render and commit alongside the change so future readers see the new look.

## Project declaration

**This is a personal-use tool. Not commercial software.**

- Bundled third-party assets (brand logos from Wikimedia Commons / simple-icons, Inter font from Google Fonts) are used for personal photo compositions. No redistribution, no resale, no commercial product.
- **Do not add trademark / fair-use / licensing disclaimers** to code, comments, or docs. They are noise for this project.
- When the user asks to bundle a brand asset or scrape a source, do it. Don't hedge with "consider commercial implications".
- Bug reports here take precedence over theoretical legal purity.

## Claude Code rules

When iterating on this project:

1. **Personal-use mindset** — see above. No legal hedging anywhere in the repo.

2. **Don't re-ask settled decisions.** The user has locked in:
   - **Pure-frontend SPA.** No Node backend at runtime — all pixel processing happens in the browser via Canvas2D (GPU-accelerated by the browser), `createImageBitmap`, `canvas.toBlob`, and JSZip for batch packaging.
   - **No build step at runtime.** No Vite/webpack/React. Vendored libraries (`exifr`, `piexifjs`, `JSZip`) are checked in under `public/vendor/` and loaded as plain `<script>` tags. The two Node scripts in `scripts/` (build-logos, build-fonts) are one-shot authoring helpers, not a runtime build pipeline.
   - **No framework.** Vanilla HTML/JS only.
   - Bundled real brand logos (Wikimedia Commons first, simple-icons fallback) in original colors.
   - Chinese in the chat, English in code/commits/files.

3. **Manual browser testing.** There's no automated smoke since the backend is gone. After non-trivial changes, run `npm run dev` (starts `npx serve public`), open `http://localhost:3000`, load a real EXIF-bearing photo, and verify: preview renders, single export downloads a JPEG with EXIF intact, batch ZIP packs all photos.

4. **Keep CLAUDE.md and README.md current.** Both are durable docs but with different audiences and update triggers — neglecting either degrades trust in the project. They drift in different ways and have to be checked separately:

   - **CLAUDE.md** — internal source of truth ("why" + "how it works"). When introducing a new concept (frame, template, toggle, frame-layout tweak, pipeline change, gotcha discovered), update the relevant section in the **same commit**. Project memory entries should only hold cross-session user/feedback context, not project facts.

   - **README.md** — public face on GitHub ("what" + "how to start"). Update in the same commit when you change:
     - the feature list (new frame / template / aspect / show-field / output format)
     - Quick Start commands (script renames, Node version bump, new env vars)
     - the Project Layout tree (file additions / moves / removals)
     - the Deployment section (new target, changed CI workflow, new env requirements)
     - **preview images** — re-render `data/00010_framed.jpg` / `data/00012_framed.jpg` and regenerate the 480px previews via `sips --resampleWidth 480` (or future `scripts/build-previews.sh`) whenever a pipeline change visibly alters output. Stale previews lie about what the tool does today.

     Don't duplicate detail between the two files — link to CLAUDE.md sections from README for deep dives.

5. **One source of truth per concept.**
   - Layout math + frames + templates + caption SVG: `public/shared/render.js` (the original UMD module — module.exports branch is dead but harmless).
   - Render parameter resolution: `R.resolveRenderParams(frame, cfg)` in `public/shared/render.js`.
   - Pixel composition (main thread): `public/clientRender.js` (`compose()` core; `renderPreview()` and `renderFinal()` thin entry points).
   - Pixel composition (worker thread): `public/worker.js` (mirrors `compose()` for batch export).
   - Export orchestration: `public/exporter.js` (single = main thread; batch = worker pool + JSZip).
   - Progress modal: `public/progressModal.js` (`<dialog id="export-modal">` controller).
   - EXIF I/O: `public/exifio.js` (read via exifr UMD, write via piexifjs).
   - Per-photo cfg model + UI wiring: `public/app.js`.

6. **Delete aggressively.** Don't leave commented-out alternatives or "in case we need it" stubs. Prefer lean code over optionality.

7. **Good-enough over precise.** The approximate text-width estimator is fine for centering; don't swap it for a font-metrics library unless a misalignment is visually reported.

8. **Don't auto-revert explicit user choices.** If the user says "use Wikimedia logos in original colors", don't switch to monochrome "for consistency" later.

## Quick start

```bash
npm install         # installs `serve` only — no native build, no sharp
npm run dev         # → http://localhost:3000
```

That's it. Open the URL in a browser. No backend process to manage.

To regenerate bundled assets after editing logos / fonts on disk:

```bash
npm run build-logos   # rebuild public/logos.json from public/logos/*.svg
npm run build-fonts   # rebuild public/fonts.css from public/fonts/*.ttf
npm run fetch-logos   # download new brand SVGs from Wikimedia/simple-icons + rebuild logos.json
```

These are authoring-time helpers, not part of the runtime path.

## Architecture

```
┌──────────────────────────────── browser tab ────────────────────────────────┐
│                                                                              │
│  HTML index → <script> vendored libs (exifr, piexif, jszip)                 │
│             → <script> shared/render.js   (layout + frames + caption SVG)   │
│             → <script> exifio.js          (parse + write JPEG EXIF)         │
│             → <script> clientRender.js    (Canvas pipeline; preview + final)│
│             → <script> exporter.js        (single + batch + ZIP + download) │
│             → <script> app.js             (UI wiring + per-photo cfg state) │
│                                                                              │
│  Static fetched at boot: logos.json (~57KB), fonts.css (~870KB base64)      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**There is no backend at runtime.** `npx serve public/` only serves static files.

### Render pipeline (`public/clientRender.js`)

`compose(canvas, args)` is the single core: draws bg → fg shadow → fg image → caption SVG onto a Canvas2D. Two thin entry points share it:

| Entry | Canvas | Use |
|-------|--------|-----|
| `renderPreview(canvas, args)` | the visible `<canvas>` (`customScale=0.5`) | live UI preview while user adjusts sliders |
| `renderFinal(args)` | a freshly-allocated `OffscreenCanvas` at `quality` scale | full-res export, returns a Blob |

Browser GPU does the heavy lifting:
- `createImageBitmap(file, { imageOrientation: 'from-image' })` decodes + applies EXIF Orientation on the GPU (replaces the old `sharp.rotate()`).
- `ctx.filter = 'blur(Npx) saturate(...) brightness(...)'` is GPU-composited.
- `ctx.drawImage` with scaling is GPU.
- `ctx.shadowBlur` for the floating-card shadow under the rounded foreground is GPU.
- `canvas.toBlob('image/jpeg', q)` / `OffscreenCanvas.convertToBlob` for encoding.

Caption is still rendered as SVG (via `R.buildCaptionSvg`) and rasterized via `new Image(svgBlob)` → `drawImage`. Same SVG markup as the previous backend used; one source of truth in `public/shared/render.js`.

### Render caches (preview hot path)

Three caches keep the preview render cheap when switching photos / dragging sliders. All live in `public/clientRender.js`. Caches are bypassed on the export path (`renderFinal`) — full-resolution renders are rare and would just bloat memory.

| cache | key | stores | when it hits |
|---|---|---|---|
| `bitmapCache` (WeakMap) | source `File` | decoded `ImageBitmap` | repeat select of same photo |
| `bgCache` (LRU, max 6) | `File + canvas dim + bg params` | bg-only `ImageBitmap` (post-blur, pre-fg) | switching back to a photo with same frame/aspect/padding |
| `captionCache` (LRU, max 20) | `normExif + layout zone + template + textStyle + showFields` | rasterized caption `<img>` (with blob URL kept alive) | tweaking non-caption params on the same photo, or revisiting a photo |

**Eager prefetch.** `mergeFiles()` in `public/app.js` fires `CR.loadBitmap()` + `uploadForExif()` immediately for newly added files (no await). By the time the user clicks/keys to that photo, decode + EXIF parse are usually done.

**rAF debounce.** `requestRender()` schedules `doRender()` via `requestAnimationFrame` instead of `setTimeout(40)`, so a burst of slider input collapses to one render per frame and the typical input-to-paint latency drops from `~40ms+` to `<16ms`.

**Grain tile.** `drawGrain()` rasterizes a 256×256 noise tile once at first use and tiles it via `ctx.createPattern` instead of running a full-canvas `Math.random()` loop on every frame.

Empirical impact on warm photo switching (10-sample harness, 2-photo back-and-forth, ~720×1280 preview canvas): switch-to-paint p90 dropped from ~72ms to ~56ms, p90−median jitter from ~13ms to ~2ms.

### Caption auto-placement (`public/shared/render.js → computeCaptionZone`)

`computeCaptionZone` picks the caption location based on available space around the foreground. Placements in priority order:

| placement | when | rotation | visual |
|-----------|------|----------|--------|
| `bottom`  | `bottomGap ≥ ~70·scale`        | 0°   | traditional below-photo caption |
| `right`   | `rightGap  ≥ ~80·scale`        | −90° | vertical caption reading bottom→top on the right edge |
| `left`    | `leftGap   ≥ ~80·scale`        | +90° | vertical caption on the left edge |
| `overlay` | otherwise (tight padding)      | 0°   | semi-transparent gradient strip overlaid on bottom of photo; text forced to white |

Templates draw into a local coordinate system where `layout.W × layout.H` is the zone; the outer wrapper handles translate/rotate. When adding a new template, don't hardcode canvas dimensions; use `layout.W` for centering and `layout.textBaselineY` for vertical position.

### Brand logos (`public/logos/` + `public/logos.json`)

Source SVG files live in `public/logos/`. `scripts/build-logos.js` (run via `npm run build-logos` or implicitly by `fetch-logos.sh`) parses each:

1. Strip Inkscape/Sketch/Sodipodi namespaces and `<metadata>` blocks.
2. Detect monochrome vs multi-color via `fill="..."` and `style="...;fill:...;..."`.
3. Namespace internal element IDs (so multiple logos can coexist in one composition without `<defs>` ID collisions).
4. Extract viewBox + brand color.

Output: a single `public/logos.json` keyed by slug, fetched once at boot. Re-run after adding/replacing an SVG.

`logoInlineSvg` in `public/shared/render.js` decides at render time:
- **Monochrome** logos respect the caller's `fillColor` (via `resolveLogoFill` — picks brand hex unless contrast against bg < 1.3).
- **Multi-color** logos render with their original palette untouched.

**Tight viewBoxes**: existing repo SVGs are already pre-tightened (legacy `tighten-bboxes.js` was deleted along with sharp). Future logos added via `fetch-logos.sh` will use their natural viewBox; if a fetched simple-icons SVG renders too small relative to captions, manually tighten it (e.g., open in Inkscape → File → Document Properties → Resize to content, or use a one-off Node + `sharp.trim()` script).

**Add a brand:** drop a well-formed SVG into `public/logos/<key>.svg`, run `npm run build-logos`, refresh browser. If EXIF `Make` / `LensMake` doesn't directly match the filename, extend `ALIASES` in `public/shared/render.js`.

### Frames (`public/shared/render.js`)

| name | bg | textStyle | layout mods | shadowDefault (blur/offsetY/opacity) |
|------|-----|-----------|-------------|--------------------------------------|
| `frosted`      | blurred self-image, light dim | light | — | 80 / 24 / 0.35 |
| `frosted-dark` | blurred self-image, stronger dim | light | — | 90 / 28 / 0.45 |
| `white`        | solid `#f5f5f5`       | dark  | — | 80 / 24 / 0.30 |
| `black`        | solid `#121212`       | light | — | 80 / 24 / 0.50 |
| `polaroid`     | solid `#fafafa`       | dark  | `extraBottom: 180, fgYBoost: -80, radiusOverride: 8` | 0 / 0 / 0 (flat) |

Each frame carries a `shadowDefault` (drop shadow under the rounded foreground photo). User-tunable via the **D · Shadow** UI (3 sliders) and overrideable in cfg. `opacity = 0` short-circuits the entire shadow render path.

### Render parameter resolution (`resolveRenderParams`)

`renderPreview` and `renderFinal` both feed `frame` + cfg through `R.resolveRenderParams(frame, cfg)`. Returns `{ bg, shadow }` with all numbers concrete; renderers never re-implement `cfg.X ?? frame.X ?? hardcoded` fallbacks. User-overrideable cfg fields:

- `bgBlur` (0–120) / `bgBrightness` (0.5–1.2) / `bgSaturation` (0.5–1.6) — only for `frame.bg.type === 'frosted'`. Frame switch resets to `null` (use preset).
- `shadowBlur` (0–160) / `shadowOffsetY` (0–80) / `shadowOpacity` (0–0.8) — for any frame. Frame switch resets to `frame.shadowDefault`.

`darken` and `grainOpacity` of the frosted bg are intentionally **not** UI-exposed.

### Templates (in `public/shared/render.js`)

| key              | Layout                                                              |
|------------------|---------------------------------------------------------------------|
| `minimal-text`   | Centered single line: brand [· model]  focal aperture shutter ISO  (extras on second line) |
| `brand-logo`     | Two-column with divider: brand-logo + model on left, params on right |
| `brand-right`    | Mirror of brand-logo: params on left, brand-logo on right           |
| `tech-stack`     | Vertical stack: brand / model / params / lens·date  — camera-OSD style |
| `date-lens`      | Single line: date · lens (with lens brand logo inline when matched) |

All five templates support a **flash indicator** (small ⚡ glyph) when `showFields.flash === true` AND `exif.flashFired === true`. Helpers: `flashGlyphSvg(x, baselineY, textSize, fill)` + `flashGlyphWidth(textSize)` in `public/shared/render.js`. Each template handles its own positioning math (centered templates fold the glyph width into their `totalW` calc; column templates append after the relevant params line).

**Add a template**:
1. Write a function inside `public/shared/render.js` and register it in the `TEMPLATES` map.
2. Add an option to `<select id="template">` in `public/index.html`.

(There is no longer a backend allow-list to update — `app.js` passes `cfg.template` straight through to `R.buildCaptionSvg`, which falls back to the default if unknown.)

## Per-photo cfg model

Each `state.files[i]` carries its own complete `cfg` (frame / aspect / template / padding / captionHeight / bg* / shadow* / showFields / exifOverride). Only `format` and `quality` stay global because they apply to a batch uniformly.

- Switching the active photo via the rail or arrow keys re-syncs **all** controls to that photo's cfg via `syncControlsFromCfg(cfg)`.
- Changing any control writes through to `activeCfg()` only — other photos are unaffected.
- Newly imported photos inherit a deep-cloned cfg from the active photo (or `state.draftCfg` when no photo is loaded), but `exifOverride` is reset to `{}` so each photo gets its own auto-parsed metadata.

Two batch-apply buttons let users propagate the active photo's settings:

| Button | Location | Copies | Excludes |
|---|---|---|---|
| **Apply 相框设置到全部** | end of B · Frame | `aspect`, `frame`, `template`, `padding`, `captionHeight`, `bgBlur`, `bgBrightness`, `bgSaturation`, `shadowBlur`, `shadowOffsetY`, `shadowOpacity`, `showFields` | `exifOverride` |
| **Apply EXIF to all** | inside D · EXIF details | `exifOverride` (raw form strings) | everything else |

The split is deliberate: photos in a batch usually share one *look* (frame/aspect/etc.) but differ in *metadata* (each has its own auto-parsed Make/Model/focal). One button propagates the look without overwriting per-photo EXIF; the other propagates EXIF without resetting per-photo frame tweaks.

## Export pipeline (`public/exporter.js` + `public/worker.js`)

| Action | Path |
|--------|------|
| Single export | `Exporter.exportSingle(entry, cfg, assets)` → `renderFinal()` (main thread) → JPEG/PNG Blob → `ExifIO.reattachExif()` (JPEG only) → `<a download>` |
| Batch export  | `Exporter.exportBatch(entries, assets)` → **worker pool** (2–3 workers) → `JSZip` (main thread) → blob download. Progress streams into the `<dialog id="export-modal">` modal via `window.ProgressModal`. |

**Worker pool.** Each worker is a `new Worker('worker.js')` that `importScripts` the vendored `piexif.js` and `shared/render.js`. On init the main thread sends the `logos`+`fontFaceCss` bundle (one-shot per session). For each render job the worker receives `{ file, cfg, normExif }`, decodes via `createImageBitmap`, runs the same `compose` pipeline (including the GPU canvas filter blur, shadow, foreground clip, caption SVG → ImageBitmap), encodes via `OffscreenCanvas.convertToBlob`, and re-attaches the source EXIF via `piexif.insert` — all without touching the main thread.

Pool size = `min(3, hardwareConcurrency - 1)`. If `new Worker()` throws (file:// protocol, restrictive CSP, very old browser) `exportBatch` silently falls back to the main-thread path.

**Main-thread fallback** mirrors `exportSingle` looped over `entries`. It still reports progress to the modal but blocks UI during render.

Errors don't abort either path — they collect into `_errors.txt` inside the ZIP and surface in the modal's error list.

### Progress modal (`public/progressModal.js` + `<dialog id="export-modal">`)

A native `<dialog>` is the host. The controller exposes a stage-based API consumed only by `exporter.js`:

| API | Stage | UI effect |
|---|---|---|
| `open(total)` | "渲染中" | shows dialog, resets counter to `0/total` |
| `render(done, name)` | "渲染中" | bumps counter, fills bar, displays current filename |
| `pack()` | "打包 ZIP…" | bar to 100%, message switches to "生成压缩包" |
| `done(errors)` | "完成" | reveals close button, lists errors if any |

The exporter resolves the modal lazily (`PM = () => window.ProgressModal`) because script ordering loads `exporter.js` before `progressModal.js`.

### Big-photo path

`createImageBitmap(file, { resizeWidth, resizeHeight, resizeQuality })` is used by `loadBitmap(file, maxEdge)` to deliver a **downsampled** ImageBitmap for preview (long edge ≤ 1440px). This keeps `ctx.filter='blur(...)'` and `drawImage` cheap even when the source JPEG is 6000+ px on long edge. The export path calls `loadBitmap(file)` without `maxEdge` to get the native bitmap. Both slots are cached per-File on the same WeakMap entry, so importing a 50-photo batch decodes 50 small bitmaps in the background (eager prefetch in `mergeFiles`) without blocking on full-resolution decodes.

### EXIF round-trip (`public/exifio.js`)

`canvas.toBlob('image/jpeg')` strips all metadata. To preserve the source photo's Make/Model/focal/aperture/shutter/ISO/lens/date in the export, `ExifIO.reattachExif(sourceFile, outputBlob)`:

1. `FileReader.readAsBinaryString(sourceFile)` → Latin-1 string of original JPEG.
2. `piexif.load(srcBin)` → EXIF object (drops `1st`/`thumbnail` since the original thumb refers to the un-framed image).
3. `piexif.dump(exifObj)` → EXIF segment binary string.
4. `piexif.insert(exifBin, outputBin)` → JPEG with EXIF segment spliced in front of the SOI.
5. Wrap in a fresh `Blob({ type: 'image/jpeg' })`.

PNG output skips this — browsers don't write EXIF chunks for PNG. piexifjs is JPEG-only.

If the source has no EXIF (social-platform-stripped images), the function silently returns the output unchanged.

## Project conventions

- **Pure frontend.** No Node process at runtime. No fetch to `/api/*`. No FormData uploads.
- **Vendored over CDN.** `exifr`, `piexifjs`, `JSZip` sit under `public/vendor/` so the app works offline (file:// caveats aside — see Quick start).
- **No build step (runtime).** Plain HTML/JS served from `public/`. Authoring-time scripts in `scripts/` are run manually when adding logos or fonts.
- **No framework.** No Vite/webpack/React.
- **EXIF merge rule:** `buildExifForFile()` in `app.js` reads `f.normalized` (auto-parsed by exifr) and overlays `f.cfg.exifOverride` (raw form strings) via the same shared formatters used by the caption renderer (`formatBrand`, `formatFocalLength`, `formatShutter`, etc.).
- **EXIF passthrough:** preserved on JPEG export via piexifjs (see above). PNG export does **not** carry EXIF.
- **JPEG encoder caveat:** `canvas.toBlob('image/jpeg', q)` is the browser's native encoder — not mozjpeg. Output JPEGs are ~5–15% larger than the previous sharp+mozjpeg path at equivalent visual quality. `q` is `0.92` / `0.95` / `0.98` for standard / high / original.
- **Image input formats: JPEG + PNG only.** Trust the `<input type="file" accept="image/jpeg,image/png">` and the dropzone filter. `createImageBitmap` will throw for unsupported formats; that error surfaces to the user.

## Boot flow (`public/app.js`)

1. Load vendored libs + shared modules (script tags in `index.html`).
2. `loadBundle()` → `CR.loadAssets()` → fetches `logos.json` + `fonts.css` in parallel. Stored on `state.logos` / `state.fontFaceCss`.
3. UI is interactive immediately. No file loaded yet → `state.draftCfg` accepts slider tweaks; first imported photo inherits.
4. On file import: `mergeFiles()` clones `activeCfg()` per new file (with empty `exifOverride`) and assigns. `selectFile(idx)` runs `ExifIO.parseExif(file)` once per photo, caches `f.normalized`, syncs controls.
5. Slider/seg/EXIF input → write to `activeCfg()` → `requestRender()` (debounced 40ms) → `renderPreview()` to the on-screen `<canvas>`.

## Extending

**Add a new EXIF template:** see "Templates" section above.

**Add a new frame style:**
1. Extend `FRAMES` in `public/shared/render.js` with `{ bg, textStyle, layout, shadowDefault }`.
2. Add button to `<div id="frame-seg">` in `public/index.html`.

**Add a new aspect ratio:**
1. Extend `BASE_PRESETS` in `public/shared/render.js`.
2. Add button to `#aspect-seg` in `public/index.html`.

**Add a new brand logo:**
1. Drop a well-formed SVG into `public/logos/<brand-slug>.svg`. Multi-color Wikimedia-style is preferred; single-color simple-icons-style works.
2. `npm run build-logos` to rebuild `public/logos.json`.
3. Refresh browser.
4. If EXIF `Make` doesn't match the slug directly, add an entry to `ALIASES` in `public/shared/render.js`.

**Add a new toggleable field:**
1. Extend `FIELD_KEYS` in `public/app.js` (top of file).
2. Respect it in any template that references it (use `on(show, key)` helper in `public/shared/render.js`).
3. Add a `<label class="chip">` checkbox to `#show-fields` in `public/index.html`.
4. Seed default in both `defaultCfg().showFields` in `public/app.js` (drives state) — chip-checked attribute in HTML drives initial UI but `state.draftCfg.showFields[key]` overrides it on render.

## Pitfalls discovered during build

- **`data/old.jpg` has no embedded EXIF** — the reference is already a processed image. Expect parse to return empty fields for it.
- **WeChat / social-platform images have zero EXIF** — those platforms strip all metadata on upload/download. The frontend detects all-empty normalized EXIF and shows a `#exif-warn` banner. If a user reports "EXIF lost," this is the top suspect.
- **`LensModel` may be absent while `LensInfo` is present.** Many cameras (notably some Sony/Fujifilm bodies + third-party lenses, and any social-platform-stripped image that retained the LensInfo array) write `LensInfo: [minFocal, maxFocal, minMaxAp, maxMaxAp]` but no `LensModel` string. `normalizeExif` falls back to `lensInfoToModel(LensInfo)` and synthesizes `"18-50mm F2.8"` / `"50mm F1.4"` / `"24-70mm F2.8-4"` so the lens chip still surfaces something. Lens **brand** can't be derived from numbers alone, so `lensMake` stays empty and no lens-brand logo is rendered in this fallback case.
- **`exif.flashFired` is the canonical flag**, not `exif.flash`. exifr emits `Flash` as a string (`"Flash fired"`), an object (`{ Fired: true, ... }`), or a numeric byte depending on source — `flashWasFired()` in `public/shared/render.js` collapses all three into the boolean `flashFired`. The string `flash` field is kept for display compatibility but templates should gate on `flashFired`.
- **`createImageBitmap` with `imageOrientation: 'from-image'`** — Safari supported this since 17. On older Safari users would see un-rotated photos.
- **Canvas `ctx.filter = 'blur(Npx)'`** only affects subsequent `drawImage` calls and must be reset to `'none'` (or `restore()` from a `save()`) before drawing non-blurred content.
- **`OffscreenCanvas` size limits**: Chrome/Firefox cap at ~16384 px per side, Safari at ~4096 px per side as of 2025. `quality: original` on a very large source can exceed Safari's cap. Default to `standard` or `high` for cross-browser exports.
- **`canvas.toBlob` on iOS Safari** silently downsizes images > ~5MP for memory. Test on actual device if iOS Safari is a target.

## Known limitations / future work

- HEIC / RAW inputs are not supported (browser `createImageBitmap` doesn't decode them; would need a HEIC.js decoder library).
- `brand-logo` template renders the brand as text when no SVG slug matches — bundle more SVGs to expand coverage.
- Job batching is in-memory only; for very large batches (50+ photos at original quality) the browser may run out of memory.
- No automated test suite; verify changes by browser smoke (load → preview → export single → export batch → check EXIF round-trip).
