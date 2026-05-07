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

3. **Browser testing — drive it yourself, don't ask the user.** There's no automated CI since the backend is gone. After any non-trivial change, verify in a real browser before claiming done. Three flows, in order of when each fits:

   - **chrome-devtools MCP** — the default interactive verification layer. Spin up the dev server, then drive Chrome via `mcp__plugin_chrome-devtools-mcp_chrome-devtools__*`: `navigate_page` to localhost, `take_snapshot` for the a11y tree (gives you `uid` handles), `click` / `fill` / `evaluate_script` to drive the UI, `take_screenshot` for visual confirmation, and `evaluate_script` for computed styles, DOM state, network, console messages. Use it proactively for any UI / CSS / event-wiring change AND as a regression check after refactors that touch the render or export path. Reading the source CSS or the diff alone is not verification — *something is broken until the rendered output proves otherwise*. **Verify on mobile viewports too** (rule 13 — mobile is the primary surface): drive `resize_page(width: 390, height: 844)` for iPhone, `resize_page(width: 768, height: 1024)` for iPad, snapshot + screenshot at each, before resizing back to desktop. **Cache caveat**: when verifying a fix that ships in a precached asset (`styles.css`, `app.js`, etc.), the previously-installed SW will sit `waiting` while the old one keeps serving stale bytes — see "Verifying a shipped CSS/shell fix" in the PWA section for the SKIP_WAITING + caches.delete + reload sequence to run *before* judging the fix.
   - `npm run dev` → `http://localhost:3000`, load a real EXIF-bearing photo, and verify: preview renders, single export downloads a JPEG with EXIF intact, batch ZIP packs all photos. Use this when you need a free-form human-style smoke against real files (the MCP can't ergonomically pick a file from the user's disk through the OS file picker).
   - `npm run smoke` → `http://localhost:3001/smoke.html`. This is a visual-regression aid that re-renders each `data/<id>_framed.jpg` baseline through the current pipeline and shows diff %, side-by-side. Green &lt;1%, yellow 1–3%, red &gt;3%. ~0.5% baseline noise is expected from JPEG-encode chroma + EXIF re-attach jitter even with no pipeline change. Run after any layout-math edit (rotation, collage cell rects, padding, caption zone, font subsetting). Cfgs for each fixture live inline at the top of `smoke.html` and mirror the canonical look documented for each `data/` pair.

4. **Auto-update `public/CHANGELOG.md` in the same commit as any user-visible change. The agent does this without being prompted.** This is the project's most-visible promise: GitHub visitors see CHANGELOG.md and the in-app ✦ pill renders it live. Skipping it on a feature/fix commit is a regression of the project's contract with users — don't ship a feature without telling them.

   - **Same commit, no backfills.** A "feat:" / "fix:" commit MUST include the CHANGELOG bullet alongside the code change. No "fix: forgot to update changelog" follow-ups, no batched-up backfills at release time. If you forget, amend the commit before pushing — but the user shouldn't have to ask.
   - **What counts as user-visible**: any added/changed/removed feature, frame, template, caption field, UI control, keyboard shortcut, format support, performance change a user could feel, or fix the user could observe. Pure refactors / internal renames / dev-only tooling stay out — the changelog is for users, not commit archaeology.
   - **New release blocks**: when starting a fresh `## <version>` block, prepend it at the top of the file (the in-app badge keys off the *first* `## ` heading). Date format `YYYY-MM-DD`. Group bullets under emoji-prefixed `### ` subheadings (`🎨 相框 / 模板`, `✂️ 编辑工具`, `⚡ 性能`, etc.) so the modal stays scannable.
   - **Markdown subset the renderer supports**: `#` / `##` / `###`, `-` bullets, `**bold**`, `*italic*`, `` `code` ``, `[text](https-url)`, `---` horizontal rule, blank-line paragraphs. No tables, code blocks, blockquotes, or nested lists — anything outside this set just won't render in the modal.

5. **This project is autonomously maintained by Claude Code.** There are no human committers. Code, docs, CHANGELOG, deploy — every commit on the visible history comes from a Claude Code session. Users send feature requests / bug reports as [GitHub Issues](https://github.com/anois/photo-tools/issues); reasonable ones get pulled periodically and shipped through this same pipeline, then auto-deploy via the existing GitHub Pages + Aliyun OSS workflow. The README states this publicly so contributors know the model up front. As the maintaining agent, your job is to honor that pipeline: take Issues at face value, ship clean commits, keep CHANGELOG honest.

6. **Keep CLAUDE.md and README.md current.** Both are durable docs but with different audiences and update triggers — neglecting either degrades trust in the project. They drift in different ways and have to be checked separately:

   - **CLAUDE.md** — internal source of truth ("why" + "how it works"). When introducing a new concept (frame, template, toggle, frame-layout tweak, pipeline change, gotcha discovered), update the relevant section in the **same commit**. Project memory entries should only hold cross-session user/feedback context, not project facts.

   - **README.md** (English, canonical) and **README.zh-CN.md** (Chinese mirror) — public face on GitHub ("what" + "how to start"). Update in the same commit when you change:
     - the feature list (new frame / template / aspect / show-field / output format)
     - Quick Start commands (script renames, Node version bump, new env vars)
     - the Project Layout tree (file additions / moves / removals)
     - the Deployment section (new target, changed CI workflow, new env requirements)
     - **preview images** — re-render `data/00010_framed.jpg` / `data/00012_framed.jpg` and regenerate the 480px previews via `sips --resampleWidth 480` (or future `scripts/build-previews.sh`) whenever a pipeline change visibly alters output. Stale previews lie about what the tool does today.

     **Two-language rule**: any structural edit (new section, renamed section, reordered sections, new badge, changed image, changed deploy URL) MUST be applied to both `README.md` and `README.zh-CN.md` in the same commit. The two files mirror section-for-section (verify with `grep -E "^##? " README*.md`). English is the canonical source for content decisions; Chinese is the localized mirror — translate prose, but keep code blocks / file paths / badge URLs identical.

     Don't duplicate detail between READMEs and CLAUDE.md — link to CLAUDE.md sections from READMEs for deep dives.

7. **One source of truth per concept.**
   - Layout math + templates + caption SVG: `public/shared/render.js` (the original UMD module — module.exports branch is dead but harmless).
   - Frame styles: one file per style under `public/frames/`. Each file calls `R.registerFrame(name, def)` to slot its definition into the shared `FRAMES` registry. shared/render.js holds only the registry + `resolveFrame()` fallback.
   - Render parameter resolution: `R.resolveRenderParams(frame, cfg)` in `public/shared/render.js`.
   - Pixel composition (main thread): `public/clientRender.js` (`compose()` core; `renderPreview()` and `renderFinal()` thin entry points).
   - Pixel composition (worker thread): `public/worker.js` (mirrors `compose()` for batch export).
   - Export orchestration: `public/exporter.js` (single = main thread; batch = worker pool + JSZip).
   - Progress modal: `public/progressModal.js` (`<dialog id="export-modal">` controller).
   - EXIF I/O: `public/exifio.js` (read via exifr UMD, write via piexifjs).
   - HEIC import shim: `public/heic.js` (lazy-loads libheif-js, transcodes HEIC → JPEG `File` at import).
   - Per-photo cfg model + UI wiring: `public/app.js`.
   - UI strings + locale switching: `public/i18n.js` (zh-CN + en dictionaries; nothing else owns user-visible copy).
   - Presets (save / load / share): a self-contained block in `public/app.js`, keyed off `LOOK_KEYS` and `localStorage['phototools.presets']`.

8. **Delete aggressively.** Don't leave commented-out alternatives or "in case we need it" stubs. Prefer lean code over optionality.

9. **Good-enough over precise.** The approximate text-width estimator is fine for centering; don't swap it for a font-metrics library unless a misalignment is visually reported.

10. **Don't auto-revert explicit user choices.** If the user says "use Wikimedia logos in original colors", don't switch to monochrome "for consistency" later.

11. **Confirm the requirement is fully resolved before committing — keep history clean.** A commit lands only after the change has been verified end-to-end against the actual user-visible behavior (rule 3, browser testing). No "fix: actually fix it this time" / "fix: forgot the changelog" / "fix: typo from previous commit" follow-ups — they pollute the visible history that users browse on GitHub and read in the in-app changelog modal. Concretely:

    - **Verify before committing, not after.** If a user reports a bug, reproduce it in the browser, ship the fix, then *re-verify in the browser that the symptom is gone*. Rule 3 is the gate, not an afterthought.
    - **One requirement → one commit.** If a single user request implies multiple changes (code + CHANGELOG + CLAUDE.md + README), they go in the same commit. Don't fragment a logically atomic change into a stutter of fixups.
    - **Amend, don't append, before pushing.** If you discover a missed file or wrong message *before* `git push`, amend the working commit. Once pushed, treat history as immutable and write the next commit forward — but the only reason to ever land a "fix-up" commit on `main` is genuine new information, not the previous commit's incompleteness.
    - **Don't pre-commit speculatively.** Don't commit a half-done attempt "to checkpoint progress" expecting to refine it in subsequent commits — local changes hold state perfectly well, and the published history shouldn't carry intermediate stumbles.

12. **Retrospect before each commit — distill recurring lessons into project rules.** Right before staging the final commit for a completed iteration (and *after* rule 11's end-to-end verification), pause and ask: *what went wrong this round that wasn't covered by an existing rule?* If the answer is non-empty, capture the lesson in the same commit before pushing. Without this step the same trap recurs across sessions because the agent has no persistent memory of "we already learned this." The bar for what to capture:

    - **Was there a wrong-turn or wasted round?** (e.g. "spent a round chasing a CSS bug that was actually a stale SW cache" → write the SW-cache caveat into the PWA section + add a verification-time rule.)
    - **Did the user have to correct or re-direct the approach?** (a correction that's specific to *this codebase / this workflow* belongs here; correction that's specific to *this user's preferences* belongs in the auto-memory system, not here.)
    - **Would a future Claude session, with no memory of today, fall into the same trap?** If yes, capture it. If the lesson is already implicit in existing rules or in the code itself, don't restate it.

    Where the lesson lands depends on its type:
    - Concrete technical gotcha tied to a specific subsystem → "Pitfalls discovered during build" section, or the relevant subsystem section (PWA, render pipeline, EXIF, etc.).
    - Process / workflow rule that should govern *every* future change → a new numbered rule in this list.
    - One-off implementation detail that's already obvious from the code → don't write it down; the code is the source of truth (rule 7).

    Quality bar: each captured lesson must include enough *why* (the failure mode it prevents) that a future reader can judge edge cases, not just mechanically obey. Rules without their reasoning rot into superstition.

13. **Mobile-first UI iteration — phone is the primary surface, not an afterthought.** This is a personal-use tool whose owner ships from a phone more often than from a laptop. Every UI change must include a mobile path before being claimed done. A design that only fits on a 1280px-wide laptop is *incomplete*, regardless of how good it looks on desktop. Concrete rules:

    - **Design at phone width first.** Default mental viewport is 390-430px wide (iPhone 14 / 15). Sketch the mobile composition before the desktop one — desktop is the secondary surface that usually just gets more breathing room. If your design only resolves at ≥1024px, you've designed the wrong thing.
    - **Touch targets ≥ 44×44px.** Apple HIG minimum. Cursor-sized chrome (24px chips, dense top rails) doesn't survive on touch — fingers fat-finger adjacent controls and produce wrong-photo edits or accidental closes.
    - **Verify on mobile viewports via chrome-devtools MCP** (rule 3): `resize_page(width: 390, height: 844)` for iPhone, `resize_page(width: 768, height: 1024)` for iPad. Snapshot + screenshot in both. Don't ship a UI change after only validating at desktop width.
    - **Three-pane desktop layouts (sidebar + canvas + filmstrip) don't survive mobile.** Plan a separate mobile composition explicitly: typical patterns are bottom-sheet for controls + full-bleed canvas + horizontal filmstrip pinned to top or bottom. The mobile path is not "the desktop layout, scaled" — it's its own composition that may share components but rearranges them.
    - **HEIC import is a mobile feature.** Every iPhone photo is HEIC by default; regressing the HEIC path (`public/heic.js`) breaks the primary flow even if desktop JPEG/PNG still work.
    - **iOS Safari pitfalls already documented in "Pitfalls discovered during build"** (`canvas.toBlob` silent downsizing >5MP, `OffscreenCanvas` 4096px cap, EXIF Orientation reset). Re-test these on every render-pipeline change; an iOS regression here means broken exports for the primary-use surface.
    - **Modal close on mobile**: tap-outside dismiss + a visibly large close button (mobile users have no Esc key). Both, not either.
    - **Sticky bottom action bar for primary CTAs** (Export, Apply) when the user is mid-scroll on a long control list — fingers don't naturally reach the top of the screen, and one-handed reach to a top-mounted Export button is hostile.
    - **Safe-area insets**: `env(safe-area-inset-*)` for any element pinned to viewport edges (notch, home indicator). PWA installed to home screen exposes these directly.

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
│             → <script> shared/render.js   (layout + caption SVG + helpers)  │
│             → <script> frames/<name>.js   (6× one per style; self-register) │
│             → <script> exifio.js          (parse + write JPEG EXIF)         │
│             → <script> heic.js            (lazy libheif-js shim — HEIC→JPEG)│
│             → <script> clientRender.js    (Canvas pipeline; preview + final)│
│             → <script> exporter.js        (single + batch + ZIP + download) │
│             → <script> app.js             (UI wiring + per-photo cfg state) │
│                                                                              │
│  Static fetched at boot: logos.json (~57KB), fonts.css (~150KB base64)      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**There is no backend at runtime.** `npx serve public/` only serves static files.

### Render pipeline (`public/clientRender.js`)

`compose(canvas, args)` is the single core: draws bg → fg shadow → fg image → caption SVG → optional signature onto a Canvas2D. Two thin entry points share it:

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

### GPS coordinates (caption field)

EXIF GPS is parsed automatically (the exifr options flip `gps: true`) and surfaced in `normalizeExif` as `latitude` / `longitude` decimal numbers + a pre-formatted `gps` string (e.g. `39.9042°N · 116.4074°E`, four-decimal precision ≈ 11 m). `formatGps(lat, lng)` is exported from `public/shared/render.js` for any future caller that wants to re-format from raw decimals.

The GPS line is opt-in via the `gps` show-field chip — defaults to off so users don't accidentally publish coordinates. When enabled it's appended to each template's existing extras row alongside lens / date, with the `brand-logo` template emitting it on its own line below the author so the layout doesn't get cramped.

### Caption auto-placement (`public/shared/render.js → computeCaptionZone`)

`computeCaptionZone` picks the caption location based on available space around the foreground. Placements in priority order:

| placement | when | rotation | visual |
|-----------|------|----------|--------|
| `bottom`  | `bottomGap ≥ ~70·scale`        | 0°   | traditional below-photo caption |
| `right`   | `rightGap  ≥ ~80·scale`        | −90° | vertical caption reading bottom→top on the right edge |
| `left`    | `leftGap   ≥ ~80·scale`        | +90° | vertical caption on the left edge |
| `overlay` | otherwise (tight padding)      | 0°   | semi-transparent gradient strip overlaid on bottom of photo; text forced to white |

Templates draw into a local coordinate system where `layout.W × layout.H` is the zone; the outer wrapper handles translate/rotate. When adding a new template, don't hardcode canvas dimensions; use `layout.W` for centering and `layout.textBaselineY` for vertical position.

### Inter font (`public/fonts/` + `public/fonts.css`)

`scripts/build-fonts.js` subsets the source TTFs (`Inter-Regular.ttf`, `Inter-SemiBold.ttf`, ~317KB each) before base64-inlining them into `public/fonts.css`. The subset covers:

- ASCII printable (U+0020–007E)
- Latin-1 supplement (U+00A0–00FF) — gives us `©`, `·`, `°`, all Western European accents
- Latin Extended-A (U+0100–017F) — gives us Polish/Czech/Hungarian/Turkish accents
- A handful of typographic punctuation: en/em dashes, curly quotes, bullet, ellipsis, prime marks, ™

Result: `fonts.css` shrinks from ~870KB to ~150KB while still covering every European name a user might type into the EXIF author field. CJK author names fall back to the system sans-serif — a deliberate trade-off (covering CJK would re-bloat the bundle to multi-MB and we don't render Chinese in the caption itself, only the optional Author line).

The subsetter is the [`subset-font`](https://www.npmjs.com/package/subset-font) npm package (devDependency, harfbuzz-wasm under the hood). `npm install` pulls it; `npm run build-fonts` regenerates `fonts.css` from the source TTFs.

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

### Frames (`public/frames/<name>.js`)

Each frame style is a single self-contained file under `public/frames/`. It runs an IIFE on load and calls `R.registerFrame(name, definition)` to slot itself into the shared `FRAMES` registry. `shared/render.js` only holds the empty registry + `resolveFrame(name)` lookup — no frame data.

The shell loads every frame script after `shared/render.js`: index.html via `<script>` tags, worker.js via `importScripts`, smoke.html with the `public/` prefix, service-worker.js via the precache list. Adding a frame means creating one new file and adding it to those four lists (plus the seg button + i18n label below).

| name | bg | textStyle | layout mods | shadowDefault (blur/offsetY/opacity) |
|------|-----|-----------|-------------|--------------------------------------|
| `frosted`      | blurred self-image, light dim | light | — | 80 / 24 / 0.35 |
| `frosted-dark` | blurred self-image, stronger dim | light | — | 90 / 28 / 0.45 |
| `white`        | solid `#f5f5f5`       | dark  | — | 80 / 24 / 0.30 |
| `black`        | solid `#121212`       | light | — | 80 / 24 / 0.50 |
| `polaroid`     | solid `#fafafa`       | dark  | `extraBottom: 180, fgYBoost: -80, radiusOverride: 8` | 0 / 0 / 0 (flat) |
| `instax`       | solid `#fffdf6`       | dark  | `extraBottom: 240, fgYBoost: -120, radiusOverride: 4` | 30 / 12 / 0.18 |

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

### Custom signature overlay (`public/shared/render.js → customLogoRect`)

Users can upload one signature image (SVG or PNG) which gets drawn as the very last layer of `compose()`, clipped to the rounded foreground rect so it never escapes into the frame area.

| field | type | meaning |
|---|---|---|
| `customLogo.data` | dataURL | the uploaded SVG/PNG, base64-inlined |
| `customLogo.type` | `'svg'` / `'png'` | source format (decided at upload from MIME prefix) |
| `customLogo.position` | `'br'` / `'bl'` / `'bc'` | bottom-right / bottom-left / bottom-center anchor |
| `customLogo.scale` | 0.03–0.20 | width relative to fg width (UI exposes 3–20%) |
| `customLogo.opacity` | 0.2–1.0 | global alpha multiplier |

`customLogo` lives on each per-photo `cfg` (or `null` when no signature), but **upload always cascades**: a new image writes to `draftCfg`, every loaded photo, and `localStorage['phototools.customLogo']`. Per-photo position/scale/opacity edits stay local; "Apply frame to all" propagates them along with the frame settings. Re-uploading the same image while one is already loaded preserves the active photo's position/scale/opacity.

Decoding:
- Main thread: `customLogoCache` (Map, max 3) in `public/clientRender.js`, keyed by dataURL → `Promise<ImageBitmap>`. Same dataURL hits the cache, so dragging the size slider doesn't re-decode.
- Workers: each worker decodes on every job (no cache); cheap because PNG/SVG decode is fast and batch jobs typically share one signature.

Storage: 2MB upload cap (pre-encoding); SVG dataURLs are usually <50KB, PNG can reach the cap. Larger files surface `status.signatureTooBig` and are rejected. The clear button (`#signature-clear-btn`) wipes the signature from every loaded photo + draftCfg + localStorage in one shot — there is no per-photo remove.

### Presets (save / share)

The preset panel at the top of B · Frame snapshots the "look" half of cfg (everything except per-photo `exifOverride` and global `format`/`quality`) into a named slot. Implementation lives entirely in `public/app.js` — no separate module. Two storage paths:

| Storage | Where | Includes `customLogo`? | Use |
|---|---|---|---|
| Named local presets | `localStorage['phototools.presets'] = { name: preset }` | yes | long-term personal library |
| Share code | URL hash `#p=<base64url-encoded-JSON>` | no | one-shot link to a friend |

Schema:
```js
{
  v: 1,
  aspect, frame, template, padding, captionHeight,
  bgBlur, bgBrightness, bgSaturation,
  shadowBlur, shadowOffsetY, shadowOpacity,
  showFields,
  customLogo?  // local presets only; share codes strip this
}
```

**Encode/decode**: plain JSON → UTF-8 → base64url (no compression). A typical preset is ~500 bytes JSON → ~700 bytes URL — well under any browser limit. `LOOK_KEYS` in `app.js` is the source of truth for which fields make the trip.

**Apply scope**: applying a preset writes to `activeCfg()` + `state.draftCfg` so future imports inherit, but **does not** mutate other already-loaded photos. Users propagate via "Apply frame to all" if needed (matches the existing one-look-many-photos flow).

**Hash boot**: `applyHashPresetIfPresent()` runs once after `loadBundle()` — decodes `#p=…`, applies to draftCfg, `history.replaceState`'s the hash away (so refresh doesn't reapply, and the URL doesn't leak into the user's next share). Auto-apply, no confirmation dialog. Decode failure surfaces `status.presetHashBad`.

**Naming**: `prompt()` with default `Preset YYYY-MM-DD HH:MM`. Same-name save overwrites silently. 60-char cap.

**Versioning**: `v: 1` field. Future schema changes bump to 2; old code refuses unknown versions and surfaces `presetHashBad`.

### Custom background image (`cfg.customBg`)

`cfg.customBg = null | { data: dataURL, type: 'jpeg'|'png', name }` lets the user pin a chosen image as the bg blur source for frosted / frosted-dark frames, instead of using the photo itself. All other frosted params (blur, brightness, saturation, darken, grain) still apply on top.

Render path: in `compose()`, when `params.bg.type === 'frosted'` AND `args.customBg.data` is set, the bg pass decodes the dataURL via `decodeCustomBg` (LRU cache, sibling of `decodeCustomLogo`) and uses it as the source instead of `bitmap`. Bg cache is bypassed when customBg is set — keying caches by full dataURL would balloon memory and the blur is GPU-cheap to redo. Custom bg also ignores `cfg.rotation` deliberately: rotating the photo shouldn't tilt the chosen backdrop.

UI: in B · Frame's "Advanced · frosted bg" details panel, below the slider trio. Upload cascades the compressed dataURL to `draftCfg`, every loaded photo, and `localStorage['phototools.customBg']`. The picker accepts JPEG / PNG / HEIC; HEIC sources route through `HeicTools.transcode` first.

Compression at upload time: `compressBgImage()` decodes the source via `createImageBitmap`, downscales to fit `CUSTOMBG_MAX_EDGE` (1024px long edge), and re-encodes as JPEG `q=0.72`. The bg layer renders behind a sigma-60..90 blur, so detail below ~4 px in the source is invisible in output — anything finer than 1024×0.72 is just bytes for nothing, and going much smaller starts letting JPEG block artifacts poke through the blur in lighter midtones. There's still a `CUSTOMBG_HARD_CAP` (32MB raw) so the picker refuses files large enough that even attempting decode would be wasteful, but otherwise any source size is accepted. Clear wipes everything globally.

Solid-bg frames (white / black / polaroid) ignore customBg.

### Crop (`cfg.crop`)

`cfg.crop = null | { x, y, w, h }` is a rect in **post-rotation [0..1]** coordinates. The user crops what they see in the rotated preview, so the modal renders the source pre-rotated and the rect is captured in that frame; render-time math then reverses the rotation to produce a bitmap-space `(sx, sy, sw, sh)` for `drawImage`.

The math lives in `R.srcRectFromCropRotation(bm, rot, crop)` and is exported from `public/shared/render.js`. Both threads (`clientRender.js` + `worker.js`) call it for the foreground draw and the frosted-bg draw, so a cropped photo also crops its self-blur backdrop. Customer bg (`cfg.customBg`) deliberately skips both rotation and crop — the chosen backdrop is independent of the photo's framing decisions.

Layout: `buildLayoutAndCaption` feeds `computeLayout` the cropped+rotated effective dims (`postW * crop.w`, `postH * crop.h`), so the foreground rect's aspect tracks the cropped silhouette rather than the source bitmap.

Cache invalidation: `bgCacheKey` mixes in a 3-decimal-rounded crop tag so each crop variant lives in its own cache slot.

UI: a `<dialog id="crop-modal">` with the source pre-rotated onto a canvas + an absolutely-positioned rect overlay with 8 handles (4 corners + 4 edges) and a draggable interior. State machine in `app.js`: pointerdown on rect/handle records start state, document-level pointermove/pointerup do the drag. Apply writes to `activeCfg().crop`; Reset clears to full image; Cancel/× discards.

In collage mode the crop applies to the primary cell only — partner files have no crop UI of their own and inheriting the primary's rect would be nonsense.

### Rotation (`cfg.rotation`)

`cfg.rotation` (0 / 90 / 180 / 270, clockwise degrees) is a per-photo render-time correction. Two ↶ ↷ buttons at the bottom of B · Frame bump it by ±90°.

The rotation is **not** baked into the source pixels — it lives on cfg and is applied at compose time:

1. `buildLayoutAndCaption` swaps `bitmap.width` / `bitmap.height` when feeding `R.computeLayout` so the foreground rect ends up the right shape for the rotated photo (90°/270°).
2. `compose()` rotates the frosted bg around the canvas center so the blurred backdrop tracks the rotated fg. The `bgCacheKey` mixes in rotation, so changing rotation invalidates only the rotated bg variant.
3. `drawCellPhoto(ctx, cell, bm, rot, radius)` clips to the cell, translates to the cell center, rotates, and cover-fits the bitmap using post-rotation effective dims. Used by both single-photo and every collage cell.

`drawCellPhoto` is duplicated in `clientRender.js` and `worker.js` (mirroring the existing compose duplication). Keep them in sync.

Rotation is **not** carried by presets or by "Apply frame to all" — it's intentionally per-photo (a "this specific shot was framed wrong" fix, not a stylistic choice). Collage applies the same rotation to every cell uniformly; for v1 we don't expose per-cell rotation.

### Collage (2–4 photos in one frame)

A photo entry can pair with up to three additional photos to render as a multi-cell collage inside a single frame. Two pieces:

- `cfg.collage = null | { layout: 'h2' | 'v2' | 'h3' | 'v3' | '2x2' }` — serializable, lives on cfg.
- `entry.partnerFiles = File[]` — the actual partner photos (length depends on layout, 1–3), kept on the rail entry because `File` doesn't survive `JSON.stringify`.

| layout | shape | partners needed |
|---|---|---|
| `h2` | 1×2 horizontal | 1 |
| `v2` | 2×1 vertical | 1 |
| `h3` | 1×3 row | 2 |
| `v3` | 3×1 column | 2 |
| `2x2` | 2×2 grid | 3 |

When `cfg.collage.layout` is set AND the active entry has the right number of partner files, `compose()` swaps the single-bitmap fg pass for a cell loop using `R.collageCellRects(collage, layout)`. Each cell uses the same rounded radius as the full fg, so the visual reads as one rounded panel split by 12-px gutters (scaled). Caption + frame + signature still treat the collage as one unit — caption uses the primary photo's EXIF, signature pins to the global fg corner, shadow renders under the full envelope.

HEIC partner files are transcoded via `HeicTools.transcode` at upload time (in the per-slot file input handler in `app.js`), same as primaries, so `entry.partnerFiles[i]` is always JPEG/PNG by the time it reaches the worker.

Layout switch resets `partnerFiles.length` to the new requirement: shrinking drops trailing entries, growing leaves new slots empty for the user to fill.

Limitations:
- Caption is keyed off the primary's EXIF — partners' metadata is ignored.
- Collage layout is in cfg (so it survives photo switch + preset apply via "Apply frame to all"), but `partnerFiles` is per-entry and not propagated by either path. Re-binding partners is a per-entry action.

## Per-photo cfg model

Each `state.files[i]` carries its own complete `cfg` (frame / aspect / template / padding / captionHeight / bg* / shadow* / showFields / customLogo / collage / exifOverride). Only `format` and `quality` stay global because they apply to a batch uniformly. The collage `partnerFiles` array lives on the rail entry itself (not in cfg) because `File` is not JSON-serializable.

- Switching the active photo via the rail or arrow keys re-syncs **all** controls to that photo's cfg via `syncControlsFromCfg(cfg)`.
- Changing any control writes through to `activeCfg()` only — other photos are unaffected.
- Newly imported photos inherit a deep-cloned cfg from the active photo (or `state.draftCfg` when no photo is loaded), but `exifOverride` is reset to `{}` so each photo gets its own auto-parsed metadata.

Two batch-apply buttons let users propagate the active photo's settings:

| Button | Location | Copies | Excludes |
|---|---|---|---|
| **Apply 相框设置到全部** | end of B · Frame | `aspect`, `frame`, `template`, `padding`, `captionHeight`, `bgBlur`, `bgBrightness`, `bgSaturation`, `shadowBlur`, `shadowOffsetY`, `shadowOpacity`, `showFields`, `customLogo` | `exifOverride` |
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
| `open(total)` | render | shows dialog, resets counter to `0/total` |
| `render(done, name)` | render | bumps counter, fills bar, displays current filename |
| `pack()` | pack | bar to 100%, message switches to "build archive" |
| `done(errors)` | done | reveals close button, lists errors if any |

Stage labels come from `window.I18N` and follow the active locale. The controller tracks the current stage internally so a locale flip mid-export repaints the visible label without losing progress state.

The exporter resolves the modal lazily (`PM = () => window.ProgressModal`) because script ordering loads `exporter.js` before `progressModal.js`.

### Internationalization (`public/i18n.js`)

Two locales are bundled — `zh-CN` (the original UI) and `en`. There is no `t-r-anslation server`; the dictionary is a static object, addressed by dotted keys. Three bits are wired together:

1. **Static markup** uses `data-i18n="key"` on an element to translate its text content (or `data-i18n-html` for the EXIF warning's `<strong>` markup). Placeholders, `aria-label`, and `title` use `data-i18n-placeholder` / `data-i18n-aria-label` / `data-i18n-title`. `I18N.applyDom()` walks these on boot and after every locale switch.
2. **Dynamic strings** in `app.js` and `progressModal.js` call `T(key, vars)` (= `window.I18N.t`) instead of inlining literals. Status messages persist their key + vars in a small struct so the bar can be repainted on locale flip.
3. **Switcher UI** is the two-segment `<div id="lang-seg">` in the topbar (`中` / `EN`). Clicking calls `I18N.setLocale(loc)`, which writes through to `localStorage['phototools.locale']`, re-walks the DOM, and fires every `onChange` subscriber. `app.js` subscribes via `refreshLocaleSensitive()` to repaint readouts that hold a literal (`默认` / preset, `自动` / auto, etc.). `progressModal.js` subscribes to repaint the active stage label.

First-visit detection: if no localStorage key, look at `navigator.language` — `zh*` → `zh-CN`, anything else → `en`.

**Adding a new translatable string:** add the key to *both* locales in `DICT` inside `public/i18n.js`. Static UI gets `data-i18n="..."` in `index.html`; dynamic code paths call `T('key.path', { var })`. Don't add literal Chinese or English copy anywhere outside `i18n.js` — that's the convention. Keep keys grouped by section (`status.*`, `frame.*`, `caption.fields.*`).

**Pitfall:** when extending `setStatus` in `app.js`, pass an `i18n` key (e.g. `'status.exifFail'`) plus `vars`, not a pre-formatted literal. The bar persists the key so a locale flip mid-status reflows correctly. Literal strings still work (back-compat) but get cleared on the next locale flip — only use them for messages caught from `err.message` or other untranslatable sources.

### Big-photo path

`createImageBitmap(file, { resizeWidth, resizeHeight, resizeQuality })` is used by `loadBitmap(file, maxEdge)` to deliver a **downsampled** ImageBitmap for preview (long edge ≤ 1440px). This keeps `ctx.filter='blur(...)'` and `drawImage` cheap even when the source JPEG is 6000+ px on long edge. The export path calls `loadBitmap(file)` without `maxEdge` to get the native bitmap. Both slots are cached per-File on the same WeakMap entry, so importing a 50-photo batch decodes 50 small bitmaps in the background (eager prefetch in `mergeFiles`) without blocking on full-resolution decodes.

### HEIC import (`public/heic.js`)

HEIC arrives only via the import path. `mergeFiles()` calls `HeicTools.isHeic(file)` and, on a hit, `await HeicTools.transcode(file)` before probing the bitmap.

`HeicTools.transcode()`:
1. Lazy-loads `public/vendor/libheif-bundle.js` (~1.2MB) by injecting a `<script>` tag on first call. Subsequent calls reuse the cached `window.libheif` global.
2. `decoder.decode(arrayBuffer)` returns an array of HeifImage; we use the primary at index 0.
3. `image.display({ data, width, height }, cb)` populates an RGBA `Uint8ClampedArray`.
4. Paint into a Canvas2D / OffscreenCanvas, encode as JPEG at 0.95 quality.
5. Wrap the Blob in a fresh `File({ type: 'image/jpeg', lastModified })` with `.heic` swapped to `.jpg` in the filename.

The original HEIC `File` is kept on `entry.heicSource` so `uploadForExif` can feed it to exifr (exifr handles HEIC natively). Everything downstream — `loadBitmap`, worker render jobs, `Exporter.exportSingle`, `ExifIO.reattachExif` — sees only the transcoded JPEG, so no other module needs HEIC awareness.

**EXIF round-trip**: right after transcode, `mergeFiles` calls `ExifIO.injectExifFromHeic(originalHeic, transcodedJpeg)`, which uses exifr to parse the HEIC's metadata and `buildExifObjFromParsed` to translate the curated field set into a piexif IFD object, then `piexif.insert` splices it as an APP1 segment into the JPEG. From that point on the JPEG file's EXIF is identical to a native JPEG source's, so `reattachExif` on export carries it through normally.

The lazy load means non-HEIC users never download the wasm bundle.

### PWA / offline (`public/service-worker.js` + `public/manifest.json`)

The app is a PWA — it can be installed to the home screen and runs offline after the first visit. Two pieces:

- `manifest.json` declares the app metadata (name, icons, theme color, standalone display) so install prompts work in Chrome/Edge/Safari (iOS 16.4+). The file uses the `.json` extension (not `.webmanifest`) deliberately: Aliyun OSS's default MIME map doesn't include `.webmanifest` and falls back to `application/octet-stream`, which browsers reject. `.json` resolves to `application/json` everywhere, which the manifest spec accepts.
- `service-worker.js` runs a two-strategy fetch handler: **navigation requests go network-first** (returning users see the latest deploy in one round-trip; cache only kicks in when offline), **assets go stale-while-revalidate** (cache-first paint, refresh in the background, next visit picks up new bytes). On `activate` it purges any older caches whose names start with `phototools-shell-` but don't match the current `CACHE_VERSION`.

What's precached: index.html, every `.js` and `.css` shipped, vendored libs (exifr, piexif, jszip — but NOT libheif-bundle.js), `fonts.css`, `logos.json`, `logo.svg`, the manifest itself.

What isn't: `vendor/libheif-bundle.js` (~1.2MB) is excluded from precache because most users never touch HEIC. It's cached opportunistically the first time it's fetched, like any other same-origin GET.

### Cache layering — the SW is the authoritative layer

Three cache layers are in play; understanding their interaction matters when reasoning about staleness:

1. **Browser HTTP cache** — controlled server-side. OSS sends `Cache-Control: no-cache` for HTML and `public, max-age=86400` (1 day) for everything else (configured in `.github/workflows/deploy.yml`). Pages sets defaults that are similar in behavior.
2. **SW cache** — controlled by `service-worker.js`. The SW always fetches with `{cache: 'reload'}`, so its refreshes go straight to origin and bypass the HTTP cache layer above. This makes the SW the authority on what's cached for the application — HTTP cache is just a cold-start speedup.
3. **`service-worker.js` itself** — the page registers it with `{updateViaCache: 'none'}`, which tells the browser to bypass HTTP cache when fetching the SW file. Without this, a 1-day-cached SW would mean a deploy + `CACHE_VERSION` bump wouldn't reach users for up to a day. With it, every navigation re-checks the SW within minutes.

Net effect: deploy lands → user navigates → browser fetches HTML from origin (no-cache) → page boots → fresh SW.js fetched → new SW installs → "Refresh to update" banner appears → click → page reloads on the new SW + new shell. End-to-end propagation in seconds.

**Bumping the cache**: when you change shell behavior (new precache asset, change to render pipeline that breaks compat with old cached files), bump `CACHE_VERSION` in `service-worker.js`. The activate handler purges caches that don't match.

**Upgrade UX**: the install handler does **not** call `skipWaiting()` automatically — silently swapping JS mid-session leads to weird half-loaded states. Instead, when `app.js` detects a `installed` SW waiting (via `registration.updatefound` + `statechange`), it surfaces the `#update-banner` ("New version available · Refresh"). Click → `waitingSw.postMessage({type:'SKIP_WAITING'})` → SW activates → `controllerchange` fires → page reloads cleanly. There's a `message` listener in the SW that translates that postMessage into `self.skipWaiting()`.

**Dev caveat**: the SW caches files aggressively. During development run with DevTools "Update on reload" enabled, or unregister the SW via DevTools → Application → Service Workers. Otherwise edits to `app.js` etc. won't show up until the next stale-while-revalidate cycle completes.

**Verifying a shipped CSS/shell fix in Chrome (or Chrome MCP) — activate the new SW first.** After bumping `CACHE_VERSION` and shipping a fix that lives in `styles.css` / a precached asset, opening the page in a browser that already has the previous SW installed will give a *false negative*: the new SW installs as `waiting` while the old (`active`) SW keeps serving the previous cache, so computed styles and `cssRules` reflect the pre-fix CSS even though the file on disk is correct. Diagnostic signature:

- `await caches.keys()` → both `phototools-shell-v<old>` and `phototools-shell-v<new>` present
- `(await navigator.serviceWorker.getRegistrations())[0]` → has both `active` and `waiting`
- The CSSOM rules for the affected selector are missing the new properties

Before judging the fix, force-activate the new SW + drop caches + hard reload:

```js
const regs = await navigator.serviceWorker.getRegistrations();
for (const r of regs) r.waiting?.postMessage({ type: 'SKIP_WAITING' });
for (const n of await caches.keys()) await caches.delete(n);
location.reload();
```

Then re-check computed styles. Only conclude "fix doesn't work" after this dance — otherwise you'll waste a round re-fixing already-correct code (and a real fix is what's left over after subtracting cache staleness from the apparent failure). Same logic applies whether you're driving the browser by hand or via `mcp__plugin_chrome-devtools-mcp_chrome-devtools__*`.

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
- **Image input formats: JPEG, PNG, HEIC/HEIF.** HEIC arrives via `public/heic.js`, which lazy-loads the vendored libheif-js wasm bundle and transcodes the source to a JPEG `File` at import time. Once transcoded the rest of the pipeline (preview, worker batch, EXIF reattach) only ever sees standard formats. Other formats throw at `createImageBitmap` and surface to the user via the dropzone filter.

## Boot flow (`public/app.js`)

1. Load vendored libs + shared modules (script tags in `index.html`).
2. `loadBundle()` → `CR.loadAssets()` → fetches `logos.json` + `fonts.css` in parallel. Stored on `state.logos` / `state.fontFaceCss`.
3. UI is interactive immediately. No file loaded yet → `state.draftCfg` accepts slider tweaks; first imported photo inherits.
4. On file import: `mergeFiles()` clones `activeCfg()` per new file (with empty `exifOverride`) and assigns. `selectFile(idx)` runs `ExifIO.parseExif(file)` once per photo, caches `f.normalized`, syncs controls.
5. Slider/seg/EXIF input → write to `activeCfg()` → `requestRender()` (debounced 40ms) → `renderPreview()` to the on-screen `<canvas>`.

## Extending

**Add a new EXIF template:** see "Templates" section above.

**Add a new frame style:**
1. Create `public/frames/<slug>.js` — an IIFE that calls `PhotoRender.registerFrame('<slug>', { bg, textStyle, layout, shadowDefault })`. Copy any existing file under that directory as a starting point.
2. Add a `<script src="frames/<slug>.js">` tag to `public/index.html`, immediately after the existing frame scripts and before `exifio.js`.
3. Add the same path to `worker.js`'s `importScripts(...)` and to `service-worker.js`'s `PRECACHE` array, then bump `CACHE_VERSION` so existing PWA installs pick up the new shell.
4. Add `<script src="public/frames/<slug>.js">` to `smoke.html` so the regression page can render fixtures using the new frame.
5. Add a `<button data-val="<slug>">` to `<div id="frame-seg">` in `public/index.html` and a `frame.styles.<slug>` entry to both locales in `public/i18n.js`.
6. Add a row to the frames table in this file.

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
3. Add a `<label class="chip">` checkbox to `#show-fields` in `public/index.html` with `data-i18n="caption.fields.<key>"` on the label span.
4. Seed default in both `defaultCfg().showFields` in `public/app.js` (drives state) — chip-checked attribute in HTML drives initial UI but `state.draftCfg.showFields[key]` overrides it on render.
5. Add `caption.fields.<key>` to the dictionary in `public/i18n.js` for both locales.

**Add a translatable string:** put the key in *both* `zh-CN` and `en` blocks of `DICT` in `public/i18n.js`. Static markup uses `data-i18n="..."`; runtime code uses `T('key', vars)`. See "Internationalization" above.

## Pitfalls discovered during build

- **`data/old.jpg` has no embedded EXIF** — the reference is already a processed image. Expect parse to return empty fields for it.
- **WeChat / social-platform images have zero EXIF** — those platforms strip all metadata on upload/download. The frontend detects all-empty normalized EXIF and shows a `#exif-warn` banner. If a user reports "EXIF lost," this is the top suspect.
- **`LensModel` may be absent while `LensInfo` is present.** Many cameras (notably some Sony/Fujifilm bodies + third-party lenses, and any social-platform-stripped image that retained the LensInfo array) write `LensInfo: [minFocal, maxFocal, minMaxAp, maxMaxAp]` but no `LensModel` string. `normalizeExif` falls back to `lensInfoToModel(LensInfo)` and synthesizes `"18-50mm F2.8"` / `"50mm F1.4"` / `"24-70mm F2.8-4"` so the lens chip still surfaces something. Lens **brand** can't be derived from numbers alone, so `lensMake` stays empty and no lens-brand logo is rendered in this fallback case.
- **`exif.flashFired` is the canonical flag**, not `exif.flash`. exifr emits `Flash` as a string (`"Flash fired"`), an object (`{ Fired: true, ... }`), or a numeric byte depending on source — `flashWasFired()` in `public/shared/render.js` collapses all three into the boolean `flashFired`. The string `flash` field is kept for display compatibility but templates should gate on `flashFired`.
- **`createImageBitmap` with `imageOrientation: 'from-image'`** — Safari supported this since 17. On older Safari users would see un-rotated photos.
- **Canvas `ctx.filter = 'blur(Npx)'`** only affects subsequent `drawImage` calls and must be reset to `'none'` (or `restore()` from a `save()`) before drawing non-blurred content.
- **`OffscreenCanvas` size limits**: Chrome/Firefox cap at ~16384 px per side, Safari at ~4096 px per side as of 2025. `quality: original` on a very large source can exceed Safari's cap. Default to `standard` or `high` for cross-browser exports.
- **`canvas.toBlob` on iOS Safari** silently downsizes images > ~5MP for memory. Test on actual device if iOS Safari is a target.
- **`createImageBitmap(svgBlob)` rejects SVGs without explicit `width` / `height` attrs** in Chrome — even when `viewBox` is present. Many hand-authored SVGs (Inkscape exports, simple-icons) ship with viewBox-only. The signature upload path patches this at upload time via `ensureSvgDimensions` in `public/app.js`, injecting width/height from the viewBox before persisting. Workers have no `HTMLImageElement` fallback, so this preprocessing is the only thing keeping batch export reliable for SVG signatures.
- **EXIF Orientation must be reset to 1 on every export.** `createImageBitmap(file, { imageOrientation: 'from-image' })` bakes the source's rotation into the rendered pixels, so the output canvas already shows the photo upright. If `reattachExif` then re-injects the source's original Orientation tag (e.g. 6 = "rotate 90° CW for display"), any viewer that honors EXIF will rotate the already-rotated pixels a second time — landscape photos come out sideways. Both reattach paths (`public/exifio.js` for single export, `public/worker.js` for batch) must set `exifObj['0th'][274] = 1` (Orientation = Top-left) before `piexif.dump`.

## Known limitations / future work

- HEIC inputs round-trip the curated EXIF tag set (Make / Model / focal / aperture / shutter / ISO / lens / date / artist) — see `ExifIO.injectExifFromHeic`. Tags outside that table (manufacturer-specific MakerNote subfields, GPS, color profile, etc.) are dropped by the transcode.
- RAW inputs are not supported.
- `brand-logo` template renders the brand as text when no SVG slug matches — bundle more SVGs to expand coverage.
- Job batching is in-memory only; for very large batches (50+ photos at original quality) the browser may run out of memory.
- No automated test suite; verify changes by browser smoke (load → preview → export single → export batch → check EXIF round-trip).
