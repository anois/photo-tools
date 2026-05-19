# Architecture

This document is for a curious developer who wants to understand how the engine works, the cfg / LOOK / share-link data model, the frame and caption-template systems, and how to extend any of them in a fork. Internal Claude-Code maintenance conventions live in [`CLAUDE.md`](../CLAUDE.md) at the repo root — that file is dense and optimized for AI sessions iterating on the project; this one is optimized for a human reading sideways.

## High-level shape

photo-tools is a pure-frontend single-page app — no backend at runtime. Every pixel operation happens in the browser via Canvas2D / `OffscreenCanvas`, EXIF parsing via [exifr](https://github.com/MikeKovarik/exifr), EXIF writeback via [piexifjs](https://github.com/hMatoba/piexifjs), batch packaging via [JSZip](https://stuk.github.io/jszip/). HEIC, GPS map picker, and S3 cloud are all lazy-loaded — non-users pay zero bytes.

```
┌──────────────────────────────── browser tab ────────────────────────────────┐
│                                                                              │
│  HTML index → <script> vendored libs (exifr, piexif, jszip)                  │
│             → <script> shared/render.js   (layout + caption SVG + helpers)   │
│             → <script> frames/<name>.js   (7× one per style; self-register)  │
│             → <script> exifio.js          (parse + write JPEG EXIF)          │
│             → <script> heic.js            (lazy libheif-js shim — HEIC→JPEG) │
│             → <script> geopicker.js       (lazy Leaflet shim — GPS picker)   │
│             → <script> clientRender.js    (Canvas pipeline; preview + final) │
│             → <script> exporter.js        (single + batch + ZIP + download)  │
│             → <script> cloudS3.js         (lazy aws4fetch shim — S3 gallery) │
│             → <script> progressModal.js   (<dialog> controller)              │
│             → <script> app.js             (UI wiring + per-photo cfg state)  │
│                                                                              │
│  Static fetched at boot: logos.json (~57KB), fonts.css (~150KB base64)       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

`npm run dev` is just `serve public/`. There is no build step at runtime — vendored libraries (`exifr`, `piexifjs`, `JSZip`, `aws4fetch`, `leaflet`, `libheif-js`) sit under `public/vendor/` and load as plain `<script>` tags. The two Node helpers in `scripts/` (`build-logos`, `build-fonts`) are one-shot authoring tools, not a runtime pipeline.

## Render pipeline

`compose(canvas, args)` in [`public/clientRender.js`](../public/clientRender.js) is the single core. It draws: background pass → foreground shadow → foreground image (rounded) → caption SVG → frame `decorate` hook → signature overlay, all onto a Canvas2D context. Two thin entry points share it:

| Entry | Canvas | Use |
|-------|--------|-----|
| `renderPreview(canvas, args)` | the visible `<canvas>` (`customScale=0.5`) | live UI preview while the user adjusts sliders |
| `renderFinal(args)` | a freshly-allocated `OffscreenCanvas` at `quality` scale | full-resolution export, returns a Blob |

Batch export goes off the main thread via a Worker pool ([`public/worker.js`](../public/worker.js)) — `compose()` is mirrored verbatim there. Pool size = `min(3, hardwareConcurrency - 1)`; fallback to main-thread looping if `new Worker()` throws.

Browser GPU does the heavy lifting:

- `createImageBitmap(file, { imageOrientation: 'from-image' })` decodes + applies EXIF Orientation on the GPU
- `ctx.filter = 'blur(Npx) saturate(...) brightness(...)'` is GPU-composited
- `ctx.shadowBlur` for the floating-card shadow under the rounded foreground is GPU
- `canvas.toBlob('image/jpeg', q)` / `OffscreenCanvas.convertToBlob` for encoding

Captions are rendered as SVG (via `R.buildCaptionSvg`) and rasterized via `createImageBitmap(svgBlob)` → `drawImage`. Same SVG markup is used in main thread and worker — one source of truth in [`public/shared/render.js`](../public/shared/render.js).

### Caches (preview hot path)

Three caches keep preview cheap when switching photos or dragging sliders. All in `clientRender.js`. Bypassed on the export path because full-resolution renders are rare and would just bloat memory.

| Cache | Key | Stores | Hits when |
|---|---|---|---|
| `bitmapCache` (WeakMap) | source `File` | decoded `ImageBitmap` | re-select same photo |
| `bgCache` (LRU, max 6) | `File + canvas dim + bg params` | bg-only `ImageBitmap` (post-blur, pre-fg) | switching back to a photo with same frame/aspect/padding |
| `captionCache` (LRU, max 20) | `normExif + layout zone + template + textStyle + showFields` | rasterized caption `<img>` | tweaking non-caption params on the same photo |

Plus two main-thread niceties: **eager prefetch** (`mergeFiles()` fires `loadBitmap()` + `uploadForExif()` immediately for newly-imported files, so by the time the user clicks/keys to that photo, decode + EXIF parse are usually done), and **rAF debounce** (`requestRender()` collapses a burst of slider input into one render per frame).

## cfg / LOOK / share-link data model

Each `state.files[i]` carries its own complete `cfg` object — frame · aspect · template · padding · **paddingTop/Right/Bottom/Left** (1.1+ per-edge overrides) · captionHeight · bg* · shadow* · radiusOverride · captionForceOverlay · captionOverlayTextLift · topTemplate · torn* · filmMfAge · showFields · customLogo · customBg · collage · rotation · crop · exifOverride. Only `format` and `quality` are global (apply to a whole batch uniformly).

Switching the active photo via the rail or J/K re-syncs **all** controls to that photo's cfg via `syncControlsFromCfg(cfg)`. Editing any control writes through to `activeCfg()` only — other photos are unaffected. Newly imported photos inherit a deep-cloned cfg from the active photo (or `state.draftCfg` if nothing is loaded), with `exifOverride` reset to `{}` so each photo gets its own auto-parsed metadata.

### LOOK_KEYS and presets

`LOOK_KEYS` in [`public/app.js`](../public/app.js) is the canonical list of cfg fields that travel into a preset / share-link. Saving a LOOK takes a snapshot:

```js
{
  v: 1,
  aspect, frame, template, padding, captionHeight,
  paddingTop, paddingRight, paddingBottom, paddingLeft,  // 1.1+, null = follow `padding`
  bgBlur, bgBrightness, bgSaturation,
  shadowBlur, shadowOffsetY, shadowOpacity,
  radiusOverride, captionForceOverlay, captionOverlayTextLift,
  topTemplate, tornJitter, tornStep, tornEdgeOpacity, filmMfAge,
  showFields,
  customLogo?  // local presets only; share codes strip this
}
```

Two storage paths:

| Storage | Where | Includes `customLogo`? | Use |
|---|---|---|---|
| Named local presets | `localStorage['phototools.presets']` | yes | long-term personal library |
| Share code | URL hash `#p=<base64url-encoded-JSON>` | no | one-shot link to a friend |

Schema v:1 stays additive — new fields are introduced without bumping `v`. Old presets / share-codes that don't carry a new field default it to null / false on apply. The version bumps only when an existing field's *meaning* changes.

Applying a preset writes to `activeCfg()` + `state.draftCfg` so future imports inherit, but does not mutate other already-loaded photos. The user propagates via "Apply frame to all" if needed.

`applyHashPresetIfPresent()` runs once after `loadBundle()` — decodes `#p=…`, applies it, then `history.replaceState`s the hash away so a refresh doesn't reapply.

### Factory presets

`FACTORY_PRESETS` (also in `app.js`) is a curated array of seed looks — read-only, never written to localStorage, surfaced as the 4-column tile grid at the top of the Looks picker. Each entry uses the same v:1 schema as user presets, so the same `applyPresetToCfg` code path handles both.

**Design rule**: every parameter a seed touches must also be reachable from the UI. If a seed needs a knob a user can't dial themselves, expose the knob first (slider / toggle / picker), then add the seed. Otherwise the user can't fork the preset, and we've shipped a skin instead of an engine showcase.

## Frame system

Each frame style is a single self-contained file under [`public/frames/`](../public/frames/). It runs an IIFE on load and calls `R.registerFrame(name, definition)` to slot itself into the shared `FRAMES` registry. `shared/render.js` only holds the empty registry + `resolveFrame(name)` lookup — no frame data.

The 7 shipped frames sit in 4 families:

| Family | Frame | Look |
|---|---|---|
| Editorial | `frosted-noir` | blurred-self background, strong dim, light text |
| Gallery | `gallery-white` | solid `#f4f3ee`, dark text, passe-partout double thin lines |
| Instant | `instax` | solid `#fffdf6`, dark text, instant-print bottom slab |
| Instant | `torn` | solid `#f4ecd6`, procedural jagged silhouette + dark hairline along the tear |
| Film | `film-35` | solid `#100c08`, sprocket-hole rows top+bottom + cream "BRAND · ISOT · DX" edge print + EXIF-day frame number |
| Film | `film-mf` | solid `#e8d7ab` (aged amber fiber paper), aged gelatin-silver-print decorate baked in (sepia tint, diagonal partial fade, corner vignette, 18 deterministic foxing spots) |
| Film | `slide-mount` | solid `#e6dac0` cream cardstock with pebbled-leather pattern + deep-wine outer border + recessed photo aperture with embossed caption |

A frame definition is `{ bg, textStyle, layout, shadowDefault, decorate? }`. Fields:

- `bg.type` is `'frosted'` (blur the photo itself as background) or `'solid'` (solid color). For frosted, `bgDarken` / `bgGrain` are baked frame defaults; bg blur / brightness / saturation are cfg-overrideable.
- `textStyle` is `'light'` or `'dark'` — picks default caption text color.
- `layout` carries asymmetric layout options: `topPaddingBoost` / `bottomPaddingBoost` (vertical extension), `extraRightInset` (carves a strip out of the right for editorial layouts), `captionPrefer: 'right' | 'left' | 'top'` (overrides default bottom-priority caption routing).
- `shadowDefault` is the drop-shadow tuple under the rounded foreground photo. cfg can override per photo.
- `decorate(ctx, layout, args)` is an optional post-caption hook for frame-specific decoration: gallery passe-partout, film sprocket holes, film-mf aging, slide-mount leather + bevel. Runs in worker context too (no DOM), so it uses ctx primitives only + `R.pathRoundRect` for rounded-rect paths.

### Render parameter resolution

`R.resolveRenderParams(frame, cfg)` is the single fallback ladder for render parameters. Returns `{ bg, shadow }` with all numbers concrete. Renderers never re-implement `cfg.X ?? frame.X ?? hardcoded` themselves.

User-overrideable cfg fields and their valid ranges:

- `bgBlur` (0–120) / `bgBrightness` (0.5–1.2) / `bgSaturation` (0.5–1.6) — only meaningful for `frame.bg.type === 'frosted'`. Frame switch resets to `null` (use frame default).
- `shadowBlur` (0–160) / `shadowOffsetY` (0–80) / `shadowOpacity` (0–0.8) — for any frame. Frame switch resets to `frame.shadowDefault`.
- `radiusOverride` (0–72, or `null`) — overrides the frame's default corner radius.
- `captionForceOverlay` (boolean) — short-circuits `computeCaptionZone` to overlay regardless of available padding.
- `captionOverlayTextLift` (0–120) — when overlay is on, floats the text up within the gradient.
- `tornJitter` / `tornStep` / `tornEdgeOpacity` — `torn` frame's procedural-tear knobs.
- `filmMfAge` (0–1, or `null`) — `film-mf` vintage-aging composite scalar.
- `paddingTop` / `paddingRight` / `paddingBottom` / `paddingLeft` (0–300, or `null`) — per-edge padding overrides (1.1+, set via Compose mode). When non-null, the override WINS on that edge — frame's `topPaddingBoost` / `bottomPaddingBoost` and aspect's `bottomPaddingBias` are bypassed for that edge alone. Frame switch resets all four to null. Each frame may declare a `minPadding: { top?, right?, bottom?, left? }` soft minimum (warning when violated, never clamped).

## Caption template system

Templates are organized into 4 grammars. The grammar tells you the role the caption metadata plays in the composition:

| Grammar | Templates | Role |
|---|---|---|
| **Spec** | `minimal-text` · `tech-stack` · `spec-grid` · `spec-rail` | Camera spec readout — brand · model · focal · aperture · shutter · ISO |
| **Brand** | `brand-logo` · `brand-right` | Brand-logo + model + spec, two-column with a divider |
| **Editorial** | `wordmark` · `headline` | Oversized brand mark, big GPS+date hero line |
| **Stamp** | `date-lens` · `slate` · `passport` | Minimal stamp variants — single line, OSD field grid, postmark |

Templates are functions in `public/shared/render.js`, registered in the `TEMPLATES` map. They draw into a local coordinate system where `layout.W × layout.H` is the caption zone; the outer wrapper handles translate/rotate (caption can sit on any side of the foreground).

### Caption auto-placement

`computeCaptionZone` picks the caption location based on available space around the foreground. Priority order:

| Placement | When | Rotation | Visual |
|---|---|---|---|
| `top` | only when `captionPrefer:'top'` is set on the frame AND top gap is large enough | 0° | caption above the photo |
| `bottom` | bottom gap ≥ ~70·scale | 0° | traditional below-photo caption |
| `right` | right gap ≥ ~80·scale | −90° | vertical caption reading bottom→top on the right edge |
| `left` | left gap ≥ ~80·scale | +90° | vertical caption on the left edge |
| `overlay` | otherwise (tight padding) | 0° | semi-transparent gradient strip overlaid on bottom of photo; text forced to white |

`top` is opt-in only — never auto-routes. Frames like `film-35` / `instax` / `slide-mount` reserve their top padding for sprockets / edge prints / brand stamps via their `decorate` hook, and the auto-router would happily squat captions on top of those decorations.

## EXIF round-trip

`canvas.toBlob('image/jpeg')` strips all metadata. To preserve the source photo's Make / Model / focal / aperture / shutter / ISO / lens / date / GPS in the export, [`public/exifio.js`](../public/exifio.js) does:

1. `FileReader.readAsBinaryString(sourceFile)` → Latin-1 string of the original JPEG
2. `piexif.load(srcBin)` → EXIF object (drops `1st` / `thumbnail` since the original thumb refers to the un-framed image)
3. **Reset `0th[Orientation] = 1`** — `createImageBitmap` already baked the orientation into the rendered pixels; re-injecting the source's tag would double-rotate
4. If `cfg.exif.latitude` and `cfg.exif.longitude` are both present, replace the GPS IFD via `piexif.GPSHelper.degToDmsRational` + N/S/E/W refs
5. `piexif.dump(exifObj)` → EXIF segment binary string
6. `piexif.insert(exifBin, outputBin)` → JPEG with EXIF segment spliced in front of the SOI

PNG output skips this — browsers don't write EXIF chunks for PNG, and piexifjs is JPEG-only.

## HEIC import

HEIC arrives only via the import path. `mergeFiles()` checks `HeicTools.isHeic(file)` and on a hit awaits `HeicTools.transcode(file)` before probing the bitmap.

`HeicTools.transcode()`:

1. Lazy-loads `public/vendor/libheif-bundle.js` (~1.2 MB) by injecting a `<script>` tag on first call. Subsequent calls reuse the cached `window.libheif` global
2. `decoder.decode(arrayBuffer)` → array of HeifImage; use index 0 (primary)
3. `image.display(...)` populates an RGBA `Uint8ClampedArray`
4. Paint into a Canvas2D / OffscreenCanvas, encode as JPEG at 0.95 quality
5. Wrap the Blob in a fresh `File({ type: 'image/jpeg', lastModified })` with `.heic` swapped to `.jpg`

The original HEIC `File` stays on `entry.heicSource` so `uploadForExif` can feed it to exifr (exifr handles HEIC natively). Everything downstream (loadBitmap, worker render jobs, Exporter, EXIF reattach) only ever sees standard JPEG — no other module needs HEIC awareness.

Right after transcode, `mergeFiles` calls `ExifIO.injectExifFromHeic(originalHeic, transcodedJpeg)`, which uses exifr to parse the HEIC's metadata and translates the curated tag set into a piexif IFD object, then `piexif.insert`s it as an APP1 segment into the JPEG. From that point on the JPEG's EXIF is identical to a native-JPEG source's.

The lazy load means non-HEIC users never download the wasm bundle.

## PWA / offline

The app is installable to home screen and runs offline after the first visit. Two pieces:

- [`public/manifest.json`](../public/manifest.json) declares app metadata (name, icons, theme color, standalone display). Uses `.json` extension deliberately — Aliyun OSS's default MIME map doesn't include `.webmanifest`
- [`public/service-worker.js`](../public/service-worker.js) runs a two-strategy fetch handler: **navigation requests go network-first** (returning users see the latest deploy in one round-trip; cache only kicks in offline), **assets go stale-while-revalidate** (cache-first paint, refresh in the background, next visit picks up new bytes). On `activate` it purges older caches whose names don't match the current `CACHE_VERSION`

Precached: `index.html`, every `.js` / `.css` shipped, vendored libs (exifr, piexif, jszip), `fonts.css`, `logos.json`, `logo.svg`, the manifest itself. Not precached: `vendor/libheif-bundle.js` (~1.2 MB) and the leaflet / aws4fetch lazy shims — most users never touch HEIC / GPS-pick / cloud, so they're cached opportunistically on first fetch.

Cache layering: the SW always fetches with `{cache: 'reload'}` so its refreshes go straight to origin and bypass the HTTP cache layer above. The SW.js itself is registered with `{updateViaCache: 'none'}` so a deploy + `CACHE_VERSION` bump reaches users within minutes, not days.

When a new SW is detected `installed` and waiting, `app.js` surfaces the `#update-banner` ("New version available · Refresh"). Click → `waitingSw.postMessage({type:'SKIP_WAITING'})` → SW activates → `controllerchange` → page reloads cleanly on the new shell.

## Cloud module (S3-compatible)

[`public/cloudS3.js`](../public/cloudS3.js) is an optional branch — upload the rail to a user-owned S3-compatible bucket, share via a credential-bearing URL hash, let recipients pull thumbnails + originals back into their rail. Pure-frontend: every PUT / GET / LIST is browser-signed via SigV4 (vendored [aws4fetch](https://github.com/mhart/aws4fetch), ~12 KB, lazy-loaded on first cloud-panel open). Three providers handled (AWS S3, Cloudflare R2 — uses `auto` as signing region, Aliyun OSS — auto-strips `oss-` prefix from region).

Storage layout in the bucket:

```
<prefix>/<filename>                  ← original (what mergeFiles() will receive)
<prefix>/_thumbs/<filename>.jpg      ← 480px JPEG q=0.7 thumbnail
```

Gallery refresh lists `<prefix>/_thumbs/`, derives each original key by stripping the `_thumbs/` segment + `.jpg` suffix, renders cells lazily — thumbnail blob URLs populate as GETs resolve. Clicking "Load selected" GETs each original, wraps in a fresh `File` (with `lastModified` stamped to `Date.now()` so a re-load doesn't dedup against a same-name local file), and feeds the array to `mergeFiles()`.

Share URL semantics — `#s3=<base64url(JSON)>` bundles the full config object including read/write credentials. The UI surfaces a hard warning on copy ("此链接含读写凭证") so the user isn't surprised. Recipients: `applyHashS3IfPresent()` at boot decodes → writes to localStorage → strips the hash → auto-opens the gallery → triggers `refreshGallery()`.

The most common failure mode is CORS misconfiguration on the bucket (browser fetch can't tell CORS failure from network failure — both surface as `TypeError: Failed to fetch`). The modal's collapsible "CORS help" panel renders a provider-specific config template inline that the user can copy into their bucket console.

## Extending — adding new content in a fork

### Add a frame style

1. Create `public/frames/<slug>.js` — an IIFE that calls `PhotoRender.registerFrame('<slug>', { bg, textStyle, layout, shadowDefault })`. Copy any existing file under that directory as a starting point.
2. Add a `<script src="frames/<slug>.js">` tag to `public/index.html`, immediately after the existing frame scripts and before `exifio.js`.
3. Add the same path to `worker.js`'s `importScripts(...)` and to `service-worker.js`'s `PRECACHE` array, then bump `CACHE_VERSION` so existing PWA installs pick up the new shell.
4. Add `<script src="public/frames/<slug>.js">` to `smoke.html` so the regression page can render fixtures using the new frame.
5. Add a `<button data-val="<slug>">` to `<div id="frame-seg">` in `public/index.html` and a `frame.styles.<slug>` entry to both locales in `public/i18n.js`.

### Add a caption template

1. Write a function inside `public/shared/render.js` and register it in the `TEMPLATES` map.
2. Add an `<option>` to `<select id="template">` in `public/index.html`.
3. Add a `caption.templates.<key>` entry to both locales in `public/i18n.js`.

### Add an aspect ratio

For a one-off / experimental ratio, end users can use the **Custom** button in `#aspect-seg` (writes a literal `"W:H"` token into `cfg.aspect`; `R.resolveAspectPreset(token)` synthesizes the layout on the fly). No code change needed.

To promote a ratio into the seg as a first-class preset with tuned layout constants:

1. Extend `BASE_PRESETS` in `public/shared/render.js` with hand-tuned `bottomCaptionH` / `fgYOffset` / `bottomPaddingBias` for that ratio.
2. Add a `<button data-val="W:H">` to `#aspect-seg` in `public/index.html`, **before** the trailing `id="aspect-custom-btn"` button.

### Add a brand logo

1. Drop a well-formed SVG into `public/logos/<brand-slug>.svg` (multi-color Wikimedia-style preferred; single-color simple-icons-style works).
2. `npm run build-logos` to rebuild `public/logos.json`.
3. Refresh browser.
4. If EXIF `Make` doesn't directly match the slug, add an entry to `ALIASES` in `public/shared/render.js`.

### Add a toggleable caption field

1. Extend `FIELD_KEYS` in `public/app.js` (top of file).
2. Respect it in any template that references it (use the `on(show, key)` helper in `public/shared/render.js`).
3. Add a `<label class="chip">` checkbox to `#show-fields` in `public/index.html` with `data-i18n="caption.fields.<key>"` on the label span.
4. Seed default in `defaultCfg().showFields` in `public/app.js`.
5. Add `caption.fields.<key>` to both locales in `public/i18n.js`.

### Add a translatable string

Put the key in *both* `zh-CN` and `en` blocks of `DICT` in `public/i18n.js`. Static markup uses `data-i18n="..."`; runtime code calls `T('key', vars)`. Don't add literal Chinese or English copy anywhere outside `i18n.js` — that's the convention. Keep keys grouped by section (`status.*`, `frame.*`, `caption.fields.*`, …).
