# photo-tools

Pure-frontend single-page app that adds a "frosted-glass" camera frame (blurred self-background + rounded foreground + EXIF caption) to photos.

Reference assets live in two places:

- **Regression baselines for `smoke.html`** — `data/00010.JPG` → `data/00010_framed.jpg` (cafe wall, `frosted-noir` + `minimal-text`) and `data/00012.JPG` → `data/00012_framed.jpg` (industrial structure, `frosted-noir` + `tech-stack`). The `_framed.jpg` outputs are real renders from the current pipeline — keep them as visual regression baselines. If a refactor changes layout / typography, expect them to drift; re-render and commit alongside the change.
- **README showcase samples** — `data/samples/0[1-5]-*.jpg` are the 5 finished aesthetics rendered for the README hero strip, each accompanied by a 720px `*_preview.jpg` for inline embedding.

## Project declaration

**This is a personal-use tool. Not commercial software.**

- Bundled third-party assets (brand logos from Wikimedia Commons / simple-icons, Inter font from Google Fonts) are used for personal photo compositions. No redistribution, no resale, no commercial product.
- **Do not add trademark / fair-use / licensing disclaimers** to code, comments, or docs. They are noise for this project.
- When the user asks to bundle a brand asset or scrape a source, do it. Don't hedge with "consider commercial implications".
- Bug reports here take precedence over theoretical legal purity.

**Product model = DIY render engine + user / community look library.** The end-game isn't "a fixed set of frames + a few sliders" — it's an engine where every render parameter (frame × template × bg × shadow × radius × caption placement × signature) is reachable from cfg / UI / preset, so users can compose looks we never anticipated and share them via share-codes (and eventually a community gallery). The 7 factory presets are **seeds / showcases**, not ready-made skins. Whenever a render parameter is added, ask "can a user reach this on the UI and capture it in a preset?" — if yes, it lives on cfg + LOOK_KEYS; if no, it stays a frame default. Drift toward more knobs being user-controllable, not fewer.

## Claude Code rules

When iterating on this project:

1. **Personal-use mindset** — see above. No legal hedging anywhere in the repo.

2. **Don't re-ask settled decisions.** The user has locked in:
   - **Pure-frontend SPA.** No Node backend at runtime — all pixel processing happens in the browser via Canvas2D (GPU-accelerated by the browser), `createImageBitmap`, `canvas.toBlob`, and JSZip for batch packaging.
   - **No build step at runtime.** No Vite/webpack/React. Vendored libraries (`exifr`, `piexifjs`, `JSZip`) are checked in under `public/vendor/` and loaded as plain `<script>` tags. The two Node scripts in `scripts/` (build-logos, build-fonts) are one-shot authoring helpers, not a runtime build pipeline.
   - **No framework.** Vanilla HTML/JS only.
   - Bundled real brand logos (Wikimedia Commons first, simple-icons fallback) in original colors.
   - Chinese in the chat, English in code/commits/files.

3. **Browser verification — light by default, heavy only when warranted. The user does the final acceptance locally; don't push to cloud until they've signed off (rule 16).** No automated CI since the backend is gone, but that doesn't mean every change needs a full chrome-devtools MCP regression sweep. The previous "MCP-first, verify everything" stance produced too much process for a personal-use tool. New default:

   - **Default verification = `npm run dev` + leave it running for the user.** For most changes (UI tweaks, copy, frame/template edits, bug fixes the user reported), bring up `http://localhost:3000`, sanity-check that the dev server is healthy and the change compiles + boots, then hand off to the user for visual acceptance. The user is going to look at it anyway before approving a PR — duplicating that work via MCP is wasted motion.
   - **`npm run smoke`** → `http://localhost:3001/smoke.html`. Run when you've touched the **render pipeline math** specifically: layout, rotation, collage cell rects, caption zone, padding, font subsetting, EXIF reattach. Visual-regression diff against `data/*_framed.jpg` baselines. ~0.5% baseline noise is expected; flag anything >3%. Skip for non-pipeline changes (CSS, copy, event wiring) — smoke won't catch those.
   - **chrome-devtools MCP — escalation only, not the default.** Reach for it when one of these is true: (a) the user is reporting a symptom you can't reproduce by reading the code and need to drive the UI to see it; (b) you've made a non-trivial render-path or PWA/service-worker change and want a quick scripted smoke; (c) you genuinely cannot tell whether the code is correct without observing rendered output. Don't reach for it because "it's the most thorough option" — thoroughness has a cost (rounds, tokens, time) the project doesn't want to pay by default.
   - **When you do use MCP, the gotchas still apply** (kept here so you don't re-learn them):
     - **Chrome can die mid-session.** All MCP calls return `"The selected page has been closed"` until a fresh `new_page(url)` resurrects the browser. Don't conclude "the build is broken" from a sequence of MCP errors — `curl` the dev server first; if it's 200, the issue is on the MCP side, just retry `new_page`.
     - **`resize_page` clamps to ~500px minimum width** (Chromium window-frame minimum). Setting `width: 390` actually renders at 500. Mobile `max-width: 768px` queries still match, so behavior checks work — but pixel-perfect iPhone-width fidelity needs a real device or DevTools device-emulation.
     - **Animated dialogs/sheets need a settle delay.** Reading `getBoundingClientRect()` immediately after `dialog.showModal()` returns mid-animation values. Use `await new Promise(r => setTimeout(r, animationDurationMs + 100))` before asserting resting geometry.
     - **Stale-SW cache trap.** When verifying a fix that ships in a precached asset (`styles.css`, `app.js`, etc.), the previously-installed SW sits `waiting` while the old one keeps serving stale bytes — see "Verifying a shipped CSS/shell fix" in the PWA section for the SKIP_WAITING + caches.delete + reload sequence. Run that *before* judging the fix or you'll waste a round.
   - **Don't ask the user to verify in the browser** — that's their job at acceptance time. *Do* tell them clearly what you tested and what you didn't (e.g. "dev server boots clean, smoke green, didn't drive the UI — please eyeball the new collage layout").

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
     - **showcase samples** — when a pipeline change visibly alters the look of any of the 5 frames featured in the README hero strip (`data/samples/0[1-5]-*.jpg`), re-render those samples and regenerate the 720px previews via `sips --resampleWidth 720 <full>.jpg --out <full>_preview.jpg`. Stale samples lie about what the tool does today.

     **Two-language rule**: any structural edit (new section, renamed section, reordered sections, new badge, changed image, changed deploy URL) MUST be applied to both `README.md` and `README.zh-CN.md` in the same commit. The two files mirror section-for-section (verify with `grep -E "^##? " README*.md`). English is the canonical source for content decisions; Chinese is the localized mirror — translate prose, but keep code blocks / file paths / badge URLs identical.

     Don't duplicate detail between READMEs and the visitor-facing technical docs under [`docs/`](docs/) (currently [`docs/architecture.md`](docs/architecture.md) for the engine + extending recipes, and [`docs/deploy.md`](docs/deploy.md) for GitHub Pages + Aliyun OSS setup). READMEs link out to those `docs/` files for deep dives; CLAUDE.md (this file) is the Claude-Code-internal working doc and is **not** linked from the public READMEs — it carries agent conventions and pitfalls that would be noise to a human visitor.

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
   - GPS map picker: `public/geopicker.js` (lazy-loads `vendor/leaflet.{js,css}`, drives `<dialog id="geo-modal">` and resolves with `{lat, lng}` decimals).
   - Per-photo cfg model + UI wiring: `public/app.js`.
   - UI strings + locale switching: `public/i18n.js` (zh-CN + en dictionaries; nothing else owns user-visible copy).
   - Presets (save / load / share): a self-contained block in `public/app.js`, keyed off `LOOK_KEYS` and `localStorage['phototools.presets']`. Factory ("seed") presets live in `FACTORY_PRESETS` const in the same file — same v:1 schema as user presets so `applyPresetToCfg` / `applyPresetByName` is the single apply path.

   **cfg vs frame as the line of authority.** Per-render parameters can live in two places:
   - **`frame.layout` / `frame.shadowDefault` / `frame.bg`** — defaults + identity. Applied unless cfg explicitly overrides.
   - **`cfg.<field>`** (and listed in `LOOK_KEYS`) — what the user has dialed for *this photo*. Wins over frame defaults; gets snapshotted into presets / share-codes.

   When introducing a new render parameter ask: *can a user reach it via UI and capture it in a preset?* If yes → cfg + LOOK_KEYS + UI control + plumb through `clientRender.js` / `worker.js` / `computeLayout` (frame default still readable as fallback). If no (it's pure frame identity, e.g. `decorate` hook or fixed brand color) → keep on the frame. The product direction is "more knobs become user-controllable over time" (see Project declaration), so default to cfg unless there's a real reason to lock something to a frame.

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

13. **Surface-native UI design — mobile and desktop are sibling experiences, each with its own native idioms.** This is a personal-use tool whose owner ships primarily from a phone but also uses it on a laptop. Both surfaces are first-class — neither is the other's fallback or scaled-up/scaled-down derivative. Approach UI changes from the perspective of a senior interaction designer: shared **model** (cfg, EXIF, render pipeline, presets — `app.js` / `clientRender.js` / `shared/render.js`) feeds two **presentation layers** that diverge with intent, each speaking the gestures, affordances, and density appropriate to its surface.

    - **Design both surfaces deliberately, in the same pass.** Sketch the mobile composition AND the desktop composition before writing CSS. They share components (frame picker, EXIF chips, slider semantics) but rearrange them with different interaction grammars. Don't derive one from the other — each gets its own design pass and its own native flourishes.
    - **Native idioms per surface — use them, don't mash them up:**
      - **Mobile**: bottom sheets for control panels (one section at a time, snap-points like Apple Maps); swipe between photos in the filmstrip; thumb-zone primary CTAs (Export pinned bottom-right, within thumb arc); fullscreen canvas mode; tap-and-hold for what would be hover (long-press for tooltips / context); pinch + double-tap to zoom canvas; haptic-style confirmations.
      - **Desktop**: persistent multi-pane composition (sidebar + canvas + filmstrip); hover-revealed affordances; right-click context menus where useful; rich keyboard shortcuts (J/K, Cmd+E, Cmd+1..7, [); drag-and-drop import; tooltips on hover; dense control layout with optional power-user flourishes (chord shortcuts, bulk select).
    - **Anti-patterns:**
      - Hover-only chrome on touch (invisible to mobile users).
      - 290px-wide desktop sidebar squeezed into a 390px phone (overflows or shrinks unusably).
      - Forcing desktop users to operate via single-thumb bottom sheets (slow, low information density, no keyboard payoff).
      - Disabling mobile-native gestures (swipe, pinch) because "we have arrow keys on desktop" — mobile users have neither keys nor patience.
      - Treating either surface as "responsive output of the other" — that's a tell that one surface was never actually designed.
    - **Default mental viewports for each pass**: 390×844 (iPhone 14, primary mobile), 768×1024 (iPad portrait — the hybrid territory that surfaces the worst tensions), 1440×900 (typical laptop). All three must work; the iPad pass is where bad assumptions break first.
    - **Touch targets ≥ 44×44px** on any element a touch user can tap. Desktop hover affordances may be smaller, but the touch-reachable variant of every control must hit ≥44px (Apple HIG).
    - **Verify both surfaces via chrome-devtools MCP** (rule 3) — snapshot + screenshot at all three breakpoints, not just desktop.
    - **HEIC import is mobile-primary.** Every iPhone photo is HEIC by default; regressing `public/heic.js` breaks the primary mobile flow even if desktop JPEG/PNG still work.
    - **iOS Safari pitfalls already in "Pitfalls discovered during build"** (`canvas.toBlob` silent downsizing >5MP, `OffscreenCanvas` 4096px cap, EXIF Orientation reset) need re-testing on every render-pipeline change — an iOS regression here means broken exports for the primary-use surface.
    - **Modal dismissal**: tap-outside + visible close button on mobile (no Esc key), Esc additionally on desktop.
    - **Safe-area insets** (`env(safe-area-inset-*)`) for any element pinned to viewport edges (notch, home indicator). PWA install to home screen exposes these directly.

14. **遵循语义化版本（SemVer 2.0.0）—— `MAJOR.MINOR.PATCH`，每次面向用户的提交都必须带上对应的版本号 bump，并体现在 `public/CHANGELOG.md` 顶部的 `## ` 块标题里。** 这是项目对外的兼容性契约，也是 in-app ✦ 弹窗判断"有新版本"的依据（它读 CHANGELOG 第一个 `## ` 块的版本号）。版本号怎么涨，按以下规则裁断：

    - **PATCH (`0.10.0` → `0.10.1`)** — 用户可观察的 bug 修复、视觉微调、文案订正、性能优化。不增不删功能，不动 cfg / preset / share-code 的 schema。
    - **MINOR (`0.10.1` → `0.11.0`)** — 新增 frame / template / 输出格式 / 导出选项 / 显示字段 / 键盘快捷键 / 整块 UI 区域。新增意味着旧 cfg 里没有的字段被引入；老的 preset / share-code 仍能正常解析（向后兼容）。
    - **MAJOR (`0.x` → `1.0.0`，或将来 `1.x` → `2.0.0`)** — 不向后兼容的破坏性变化：cfg schema 改字段语义且不写迁移、移除 frame / template 没留 alias、preset `v` 字段升级且拒绝旧版本、share-code 解码协议改变、删除已发布的快捷键 / 选项。**0.x 阶段**（当前所处）按 SemVer 惯例：破坏性变化通常 bump MINOR 即可，但**必须**在 CHANGELOG 该块用 `### ⚠️ Breaking` 子标题显式标出来，给用户一个看得见的警告。

    **Why**: 没有版本号约束的 CHANGELOG 会迅速变成"今天加了点啥"的流水账，in-app 弹窗也无法精准告知"你错过的具体变更范围"；尤其本项目的 preset / share-code 是会真实跨版本流转的产物，schema 兼容性必须能被一眼判读。

    **How to apply**:
    - 提交前先看 `public/CHANGELOG.md` 顶部当前版本号，按本次改动的最高级别决定 bump（一次提交里 feat + fix 同时存在时按 feat 的级别 bump，不要分裂成两次提交）。
    - 新版本块插在文件最顶部（rule 4 约定），标题格式 `## MAJOR.MINOR.PATCH · YYYY-MM-DD`；同一天多次发版用第三段递增即可。
    - 仅文档 / 注释 / 内部重构 / 开发工具改动**不**触发版本 bump，也不进 CHANGELOG（rule 4：CHANGELOG 给用户看，不是 commit 考古）。
    - 破坏性变更必须同时（a）保留迁移代码或 alias（参见 rule 4 提到的 `frosted-dark` → `frosted-noir` 别名做法），或者（b）显式 bump MAJOR 并在 CHANGELOG 的 `### ⚠️ Breaking` 块说明影响 + 用户应对。两者必居其一，不能默默改语义。

15. **GitHub workflow — PR-driven, never push directly to `main`.** Classic branch protection on `main` (added 2026-05-08 via #4) enforces: PR required, linear history, no force push, no deletion, admin included. Approval count is 0 so a solo maintainer self-merges; CODEOWNERS defaults the whole repo to `@anois`.

    **Why**: Even for a single-maintainer repo the PR record is the durable surface for *why* a change shipped — Issue link, design discussion, test plan. Direct-to-main pushes leave none of that, and the project was visibly drifting that way (a 7-commit backlog had piled up directly on `main` before the PR-driven flow landed). The PR description box also becomes the durable answer to "what was the test plan?" for future agent sessions.

    **How to apply**:
    - **Branch name**: `<type>/<kebab-slug>`, where `<type>` ∈ {`feat`, `fix`, `chore`, `docs`, `refactor`}. e.g. `feat/custom-aspect-ratio`, `chore/repo-governance`. Slug ≤ 5 words.
    - **Commit & PR title prefix**: same vocabulary (`feat:` / `fix:` / `docs:` / `chore:` / `refactor:`). PR title ≤ 70 chars. PR body uses the `.github/PULL_REQUEST_TEMPLATE.md` skeleton (Summary / Why / How / Test plan).
    - **Issue linking**: `Closes #N` in the PR body for the issue this PR resolves (auto-closes on merge); `Refs #N` for related-only. After merging an Issue-driven PR, also leave a short comment on the Issue summarizing the fix + linking the PR — see #2 / #3 for the precedent.
    - **Merge style**: **squash by default**. Linear history is enforced — the GitHub UI will refuse a merge commit. Use rebase merge only if the intermediate commits in the PR are individually meaningful and worth preserving on `main`.
    - **CHANGELOG**: still ships in the same commit as the user-visible change (rule 4 unchanged); the PR body also surfaces it via the linked issue.
    - **Local `main` resync after merge**: `git pull --rebase origin main`. Plain `git pull` (default merge) creates a merge commit that conflicts with the linear-history rule on the next push.
    - **Don't weaken the protection to push faster.** If `git push origin main` is rejected with `protected branch hook declined`, that's the rule working — branch off and open a PR. The audit trail is more valuable than the saved seconds. The protection JSON lives in GitHub settings, not in this repo, so a future agent that "fixes" a rejected push by editing protection rules is silently regressing the contract.

16. **本地验收通过后再上云 —— 推送 / 开 PR / 合并前必须由用户确认。** This project's release loop is: agent codes → user accepts locally → user explicitly says "go" → agent pushes / opens PR / merges. The agent does not unilaterally publish, even when the change looks obviously correct and the commit is ready.

    **Why**: the user is the only acceptance gate (rule 5 — there are no other human committers), and acceptance happens by them looking at the running app on their own machine. Pushing before they've looked turns "ship a tested change" into "ship something the agent thinks works"; the cloud audit trail (PR description, CHANGELOG, tag) then carries decisions the user never actually signed off on. This is also why rule 3 stopped doing heavy MCP regression — that work duplicates the acceptance pass the user is going to run anyway.

    **How to apply**:
    - **Coding & local commits are fine without asking** — branching, editing, `git commit` on a feature branch, even running `git status` / `git log` are all part of "preparing the change for review."
    - **Stop and ask before**: `git push` (any branch, including the feature branch), `gh pr create`, `gh pr merge`, `gh pr edit`, force-push, tag push, anything that touches the GitHub remote or triggers the deploy workflow.
    - **The ask is short and concrete**: name the action ("ready to push branch X and open a PR — go?") and wait. Don't bundle it into a status update — a clear question gets a clear yes/no. If the user has already said "ship it" / "go ahead and push" earlier in the same turn for this specific change, that authorization stands; don't re-ask within the same back-and-forth.
    - **Don't pre-stage by pushing the branch "so the PR's ready when you say go".** Pushing IS the action that needs confirmation; staging it is just doing it without permission.
    - **Exception — read-only remote ops** (`gh pr view`, `gh issue list`, `gh pr checks`, `git fetch`) don't need confirmation; they observe state without changing it.

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
│             → <script> geopicker.js       (lazy Leaflet shim — GPS map pick)│
│             → <script> clientRender.js    (Canvas pipeline; preview + final)│
│             → <script> exporter.js        (single + batch + ZIP + download) │
│             → <script> cloudS3.js          (lazy aws4fetch shim — S3 gallery)│
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

**Manual override + map picker** (`public/geopicker.js`). Sources that lost GPS during a social-platform round-trip can still get coordinates back: D · EXIF has `latitude` / `longitude` number inputs that write to `cfg.exifOverride` like every other override field. `buildExifForFile` parses lat/lon as numbers, recomputes `base.gps` via `formatGps`, and the caption row updates live. The 📍 button next to the inputs opens `<dialog id="geo-modal">`, which lazy-loads the vendored Leaflet (`vendor/leaflet.js` + `vendor/leaflet.css`, ~165 KB combined) on first call — same pattern as `heic.js`/libheif. PWA service worker doesn't precache the Leaflet bundle (lazy-only) or tile URLs (cross-origin), so users who never open the picker pay nothing. Offline-first visitors see a tiny error overlay pointing them back to the manual lat/lon inputs.

**Tile source: AutoNavi (高德地图) instead of OSM, with GCJ-02 ↔ WGS-84 correction.** OpenStreetMap's tile servers are firewalled in mainland China — the picker would render fully blank for the project's primary user. `webrd0{1-4}.is.autonavi.com/appmaptile?style=7&lang=zh_cn` is reachable from China and ships Chinese place labels by default. Catch: AutoNavi paints content using the GCJ-02 ("Mars coordinates") obfuscated CRS, so a marker placed at WGS-84 39.9042 / 116.4074 (天安门) lands ~500 m NW of where the landmark renders on the tile. EXIF GPS is WGS-84 by spec, so we transform at the Leaflet boundary: `wgs2gcj()` on every coord we hand to Leaflet (`setView`, `marker.setLatLng`); `gcj2wgs()` on every coord Leaflet emits (click, marker drag) before we store it. Both helpers live inline in `geopicker.js` (Krasovsky-1940 ellipsoid math, ~30 lines, 5-iteration fixed-point inverse). `outOfChina(lat, lng)` short-circuits both to identity outside the China bounding box, so non-Chinese photos see no shift. Style `7` is the full base map; `8` is a transparent road overlay (looks blank).

**Export round-trip** (`public/exifio.js` + `public/worker.js → reattachExif(file, blob, gpsOverride?)`). When `cfg.exif.latitude` and `cfg.exif.longitude` are both present, the export path replaces the GPS IFD via `piexif.GPSHelper.degToDmsRational` + N/S / E/W refs. Sources that originally had no EXIF at all get a synthesized empty shell (`{ '0th': {Orientation:1}, 'Exif': {}, 'GPS': {…} }`) — so manually-typed coordinates make it into the output JPEG even from a stripped source. Limitation: clearing the lat/lon inputs only blanks the caption row; it doesn't strip GPS from the source EXIF on export. To scrub GPS, do it externally before importing.

### Caption auto-placement (`public/shared/render.js → computeCaptionZone`)

`computeCaptionZone` picks the caption location based on available space around the foreground. Placements in priority order:

| placement | when | rotation | visual |
|-----------|------|----------|--------|
| `top`     | only when `captionPrefer:'top'` is set on the frame AND `topGap ≥ ~70·scale` | 0°   | caption sits in the top padding above the photo |
| `bottom`  | `bottomGap ≥ ~70·scale`        | 0°   | traditional below-photo caption |
| `right`   | `rightGap  ≥ ~80·scale`        | −90° | vertical caption reading bottom→top on the right edge |
| `left`    | `leftGap   ≥ ~80·scale`        | +90° | vertical caption on the left edge |
| `overlay` | otherwise (tight padding)      | 0°   | semi-transparent gradient strip overlaid on bottom of photo; text forced to white |

`top` is **opt-in only** — it never auto-routes. Frames like `film-35` / `polaroid` / `instax` reserve their top padding for sprockets / edge prints / brand stamps via the `decorate` hook, and the auto-router would happily squat captions on top of those decorations. To use `top`, a frame explicitly sets `captionPrefer: 'top'`.

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

Frames are organized into 4 visual families. The seg buttons in `#frame-seg` carry a `data-family` attribute so future CSS can group them visually.

| family | name | bg | textStyle | layout mods | shadowDefault (blur/offsetY/opacity) | decorate |
|---|---|---|---|---|---|---|
| **Editorial** | `frosted-noir` (alias `frosted-dark`) | blurred self-image, strong dim | light | — | 90 / 28 / 0.45 | — |
| **Gallery** | `gallery-white` (alias `white`) | solid `#f4f3ee` | dark | — | 60 / 18 / 0.18 | passe-partout double thin lines (1.5px outer, 0.9px inner) |
| **Instant** | `instax`   | solid `#fffdf6` | dark  | `extraBottom: 240, fgYBoost: -120, radiusOverride: 4` | 30 / 12 / 0.18 | — |
| | `torn`     | solid `#f4ecd6` | dark  | — | 50 / 16 / 0.20 | procedural jagged silhouette via `clipPath: tornClip` + dark hairline along the tear via `decorate`. **Tunable via cfg**: `tornJitter` (depth 0–14), `tornStep` (sample density 3–14), `tornEdgeOpacity` (0–0.5). Frame defaults `torn: { jitter: 6, step: 7, edgeOpacity: 0.22 }` |
| **Film** | `film-35`   | solid `#100c08` | light | `topPaddingBoost: 70, bottomPaddingBoost: 90` | 0 / 0 / 0 | sprocket-hole rows top+bottom (density adapts to fg width) + cream "BRAND · ISOT · DX" edge print + EXIF-day frame number on the bottom gutter |
| | `film-mf`   | solid `#e8d7ab` (aged amber fiber paper) | dark | `topPaddingBoost: 100, bottomPaddingBoost: 120` | 40 / 12 / 0.16 | aged gelatin silver print: deckle hairline + italic library notation + **vintage aging effects** baked into decorate — sepia multiply tint on the photo, diagonal screen-gradient partial fade (upper-left bleached, simulating decades of light exposure), radial corner vignette (handling oxidation), 18 deterministic foxing spots scattered across the paper margin (rejected from photo + caption zones, seeded per geometry so they stay stable across renders). This is the print AFTER 50 years, not the fresh print |
| | `slide-mount` | solid `#e6dac0` (warm cream cardstock) | dark | `topPaddingBoost: 100, bottomPaddingBoost: 120` | 0 / 0 / 0 (photo is **inset**, not raised) | mounted-transparency look. Caption + topBadge text come from the standard caption + topTemplate systems, but slide-mount destructively paints the leather over them and **re-stamps them in decorate** with an embossed treatment (1.5·s px down-offset inverted-light layer underneath the dark text → "pressed into leather"). **Pebbled-leather surface** is a 128×128 `createPattern` tile (module-level cached, built once per context): cream base + ~180 discrete tile-wrapping pebble bumps each painted as a warm highlight ellipse offset upper-left + a sepia shadow ellipse offset lower-right (fixed lighting → 3D feel) + ±7 per-pixel grain on top. `pattern.setTransform(scale)` keeps pebble density physically constant across quality settings. Plus ~15 broad soft radial patches (low-frequency unevenness, seeded per geometry). **Bevel cues** around the aperture: ~8 base-px highlight gradient on cream top+left + matching dark gradient on cream bottom+right. **Photo aperture**: heavy dark hairline (`rgba(15,8,4,0.82)`, ~1.4·outputPx) + 2-stop inset shadow inside the photo (24 base-px deep, top+left). **Outer wine border** `#3a1822` (28 base-px ring on all 4 sides) drawn last. **Engine contract**: `clientRender.js`/`worker.js` stash `args.captionImg` + `args.topBadgeImg` for any destructive decorate hook to re-stamp; non-destructive frames ignore them |

**Retired frames** (0.22.0 — see `FRAME_ALIASES` in `shared/render.js`): `frosted`, `polaroid`, `gallery-noir`, `editorial`, `editorial-mirror`, `kodak-pro`. Old share-codes / saved presets that reference them resolve via the alias table at preset-apply time (closest survivor → render anyway with `resolveFrame` fallback). `applyPresetToCfg` rewrites `cfg.frame` to the survivor name so the UI shows a coherent seg-button state. Migration table:

| old | new | what's lost |
|---|---|---|
| `frosted` | `frosted-noir` | lighter bg dim variant (no `bgDarken` cfg knob yet) |
| `polaroid` | `instax` | smaller bottom slab + sharper radius; pad/captionH knobs recover most of it |
| `gallery-noir` | `gallery-white` | color inversion (black gallery wall) |
| `editorial` / `editorial-mirror` | `gallery-white` | asymmetric right/left strip layout (no successor) |
| `kodak-pro` | `gallery-white` | red+black "Kodak Professional" wordmark stamp — recover via `cfg.topTemplate = 'wordmark'` on any frame |

Each frame carries a `shadowDefault` (drop shadow under the rounded foreground photo). User-tunable via the **D · Shadow** UI (3 sliders) and overrideable in cfg. `opacity = 0` short-circuits the entire shadow render path.

**Frame `decorate` hook**. `R.registerFrame` accepts an optional `decorate(ctx, layout, args)` function. `compose()` runs it AFTER caption rendering and BEFORE the user signature overlay, mirrored across `clientRender.js` and `worker.js`. Use it for frame-specific decorative passes — gallery passe-partout, film sprocket holes, editorial separator lines, slide-mount labels, etc. Must be self-contained: workers have no DOM, so don't call `document.createElement` from inside; use `ctx` primitives + `R.pathRoundRect` (the public rounded-rect path helper, with arcTo fallback for older Safari).

**`layout.outputPx`** is a soft scaling factor for hairlines: `Math.max(1, N * outputPx)` produces stroke widths that stay thin even at `quality: high` (where naive `N * scale` would bloat to 3-4 canvas-px). Defined as `Math.max(0.5, scale * 0.6)`. Use this in decorate hooks for borders, separator lines, fine print stamps — anything that should READ as a hairline regardless of export resolution.

**Asymmetric layout options** (frame `layout` field):
- `topPaddingBoost` / `bottomPaddingBoost` (base-1440 units): symmetric vertical extension. `film-35` uses both to make room for sprocket rows; instant frames historically used only the bottom variant via `extraBottom` (which boosts the *caption zone*, not the padding).
- `extraRightInset` (base-1440 units): carves a strip out of the right side of the canvas for asymmetric editorial layouts. When > 0, the foreground anchors to left padding instead of centering, so the right strip becomes a clean vertical zone.
- `fgXOffset` (base-1440 units): horizontal shift of the centered photo, ignored when `extraRightInset` is in effect.
- `captionPrefer`: `'right' | 'left' | 'top'` — overrides the default bottom-priority caption routing. Editorial uses `'right'` so caption auto-routes into the wide right strip even though the bottom strip would also fit. `'top'` is opt-in (never the auto fallback) — needed when a frame has top padding free and wants caption above the photo. Falls back to default priority order when the preferred zone's gap is too small.

### Render parameter resolution (`resolveRenderParams`)

`renderPreview` and `renderFinal` both feed `frame` + cfg through `R.resolveRenderParams(frame, cfg)`. Returns `{ bg, shadow }` with all numbers concrete; renderers never re-implement `cfg.X ?? frame.X ?? hardcoded` fallbacks. User-overrideable cfg fields:

- `bgBlur` (0–120) / `bgBrightness` (0.5–1.2) / `bgSaturation` (0.5–1.6) — only for `frame.bg.type === 'frosted'`. Frame switch resets to `null` (use preset).
- `shadowBlur` (0–160) / `shadowOffsetY` (0–80) / `shadowOpacity` (0–0.8) — for any frame. Frame switch resets to `frame.shadowDefault`.

`darken` and `grainOpacity` of the frosted bg are intentionally **not** UI-exposed.

### Top-of-frame badge (`cfg.topTemplate`, 0.22+)

Independent of the bottom caption template. Stamps a brand-identity line into the frame's top padding zone — useful when the user wants "FUJIFILM · X-T5" floated above the photo without committing the caption strip to that role.

| value | shape |
|---|---|
| `'none'` | no badge (default) |
| `'brand-model'` | logo SVG + " · " + model text, centered over fg |
| `'brand-only'` | logo SVG alone |
| `'wordmark'` | oversized uppercase brand name, no logo (channels the retired `kodak-pro` aesthetic onto any frame) |

`R.buildTopBadgeSvg(exif, layout, opts)` returns a full-canvas SVG that `compose()` rasterizes via `svgToImage` and `drawImage`s **BEFORE** the frame's `decorate` hook. Rationale: frames that own their top padding (film-35's edge print, future kodak-style stamps) take visual primacy over the user-applied badge — `decorate` paints over the badge. For clean frames (frosted-noir, instax, torn, gallery-white) there's no conflict and the badge shows through. Badge auto-hides when top padding is below ~30 base-px (extreme custom aspects).

Lives in **E · Top** UI block (workshop tweak tab). Goes through `LOOK_KEYS` so preset / share-code captures it. Frame switch resets to `'none'`.

### Caption overlay text lift (`cfg.captionOverlayTextLift`, 0.22+)

Only meaningful when `captionForceOverlay === true`. Range 0–120 (base-1440 px). Floats the overlay caption's **text** up by N px while the semi-transparent gradient backdrop stays pinned to the photo's bottom edge. 0 = legacy bottom-pinned text; 32 = subtle breathing room from the bottom edge (the value the `film-35-stack` factory preset uses); 120 = text floats ~10% of fg height up.

Implementation: `computeLayout` attaches `caption.textLift` (in canvas px) when caption ends up in overlay placement, then `wrapCaption` emits an inner `<g transform="translate(0 -textLift)">` wrapping the template's text content. Gradient `<rect>` stays at zone origin so it doesn't shift.

UI is the slider row right under the "Caption inside photo" toggle (`#caption-overlay-lift-row`), hidden when forceOverlay is off. Goes through `LOOK_KEYS`. Frame switch resets to 0.

### Templates (in `public/shared/render.js`)

Templates are organized into 4 grammars. Spec / Brand / Editorial / Stamp — pick the family by the role caption metadata plays in the composition.

| family | key | Layout |
|---|---|---|
| **Spec** | `minimal-text` | Centered single line: brand [· model]  focal aperture shutter ISO  (extras on second line) |
| | `tech-stack`   | Vertical stack: brand / model / params / lens·date — camera-OSD style |
| | `spec-grid`    | Horizontal magazine-grid (Hasselblad X2D reference): brand wordmark/logo + divider + model on top row, 4 outlined `boxedSpec` capsules (S / ISO / mm / F) below — for `bottom` placement |
| | `spec-rail`    | Vertical magazine-rail (Leica M10 reference): 4 `boxedSpec` capsules stacked along the long axis + brand cluster at the end — designed for `right`/`left` rotated zones |
| **Brand** | `brand-logo`   | Two-column with divider: brand-logo + model on left, params on right |
| | `brand-right`  | Mirror of brand-logo: params on left, brand-logo on right (kept until Phase 3 mirror flag refactor) |
| **Editorial** | `wordmark`   | Oversized brand mark / text + tiny date subline — luxury-minimalist |
| | `headline`   | Big "GPS · YYYY.MM" hero line + small spec subline; degrades to date-only when GPS missing |
| **Stamp** | `date-lens`  | Single line: date · lens (with lens brand logo inline when matched) |
| | `slate`      | Monospace OSD field grid (DATE / CAM / LENS / EXP) with hairline rules between rows |
| | `passport`   | Tiny bordered postmark stamp with date + GPS — best in caption zones with breathing room |

All bottom-strip templates support a **flash indicator** (small ⚡ glyph) when `showFields.flash === true` AND `exif.flashFired === true`. Helpers: `flashGlyphSvg(x, baselineY, textSize, fill)` + `flashGlyphWidth(textSize)` in `public/shared/render.js`. Each template handles its own positioning math. The newer templates (`wordmark` / `headline` / `slate` / `passport` / `spec-grid` / `spec-rail`) don't yet wire the flash glyph — flash is a "Spec / Brand" concern; editorial and stamp grammars deliberately stay clean, and the magazine-grid spec templates already telegraph "specs" via the capsule grammar without an extra glyph.

**`R.boxedSpec(x, cy, value, label, opts)`** is the public SVG primitive behind the spec-grid / spec-rail capsules: rounded-rect outlined value text + tiny uppercase label hanging below. Returns `{ svg, width, height, boxH }`. Available to any future template / decorate hook so the magazine-style capsule rhythm doesn't get re-implemented per template.

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

### LOOK system — preset library as first-class entry (0.20+)

**Looks** are first-class meta-primitives, not a workshop sub-tab. The lookbar's LOOK chip (the dashed-border block above the four fine-tune chips) is the single one-tap entry to the entire preset library; clicking it opens the **Looks picker** (`#picker-look`) which contains the factory grid + user-saved list + save / share / paste-share-code actions in one cohesive panel. The workshop drawer no longer has a Library tab — workshop is for "deep adjust", LOOK is for "swap the whole vibe".

**The chip's modified state** drives "you've forked this look" awareness. After `applyPresetByName(preset, label, opts)` runs, the cfg snapshot at that moment lives in `lookState.baseline` (LOOK_KEYS + showFields only — orthogonal asset choices like customLogo / customBg / collage are deliberately excluded from divergence detection so swapping a signature doesn't lie about the look having changed). `requestRender()` then calls `syncLookValueDisplay()` on every cfg-mutating event; `cfgDivergesFromBaseline(cfg, lookState.baseline)` is a shallow `LOOK_KEYS.every(k => cfg[k] == baseline[k])` (loose `==` so legacy share-codes' missing-additive-field landings don't read as drift). When divergence is detected, the chip surfaces a 1.6s breathing accent dot — the user can keep tweaking, save as a new preset, or apply another Look to reset.

**Why LOOK is its own row, not a 5th lookchip**: the four fine-tune chips (Frame / Template / Aspect / Quality) are individual primitives in a stacked group with shared border + flush separators. LOOK is a meta-decision that *composes* those primitives, so giving it visual weight (Fraunces italic + ✦ glyph + dashed-then-solid border + accent backdrop) communicates the hierarchy: "this is the lead choice, the four below are how you twist it". Putting it as a 5th chip in the same group would flatten that hierarchy.

**Picker delegation gotcha** (added 2026-05-09 from a wiring miss). The picker open/close click handler in `app.js` historically targeted `.lookchip[data-picker]` only. When LOOK shipped as `.lookbar-look[data-picker="look"]` (a different class on purpose — different visual rules), clicks on the LOOK chip were no-ops until the selector was extended to `.lookchip[data-picker], .lookbar-look[data-picker]`. **Rule for adding a new picker-triggering element**: grep `'\.lookchip'` across `app.js`, find every selector that filters chips, and explicitly add the new class. Three places need it today: the click-binder, the close-state cleanup (clearing `data-open`), and the resize-time anchor lookup. If any of those is missed the chip silently misbehaves (no open / stale open state / mis-positioned popover). The same trap shape is documented for cfg fields in the cfg-field checklist below — both cases are "old surfaces hardcoded a class/list and didn't notice when a sibling joined".

**Mobile** (≤700px): the lookbar grid grows from 2 rows to 3 (`44px 44px 44px`) — LOOK strip across the top-full-width row, then [import + chips], then [export + ZIP]. The +44px height (lookbar grew from 104px to 148px, viewport content area lost 44px) is the agreed cost for the entry-depth reduction.

**Save / share / paste flow** (single panel, no dialogs):
- ✚ Save — prompt for name, snapshot cfg via `presetFromCfg(activeCfg(), { includeCustomLogo: true })`, write to `localStorage['phototools.presets']`, then `setLookActive` adopts the just-saved preset as the current applied look (so the modified-pulse clears immediately).
- ↗ Share — `presetFromCfg` with `includeCustomLogo: false`, base64url-encode, copy `#p=<code>` URL to clipboard. Also available per-row in the user list.
- ⎘ Paste — `navigator.clipboard.readText()` (with `prompt()` fallback for browsers that gate readText), accept either a full URL with `#p=...` or a bare base64url code, decode, apply.

### Presets (data model — schema + storage)

The preset data model is the persistence layer behind the LOOK system. It captures the "look" half of cfg (everything except per-photo `exifOverride` and global `format`/`quality`) into a named slot. Implementation lives entirely in `public/app.js` — no separate module. Two storage paths:

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
  radiusOverride,        // null = use frame.layout.radiusOverride or aspect base.radius
  captionForceOverlay,   // true = bypass auto-routing, stamp caption on photo bottom
  showFields,
  customLogo?  // local presets only; share codes strip this
}
```

**Encode/decode**: plain JSON → UTF-8 → base64url (no compression). A typical preset is ~500 bytes JSON → ~700 bytes URL — well under any browser limit. `LOOK_KEYS` in `app.js` is the source of truth for which fields make the trip.

**Schema v:1 stays additive.** New fields like `radiusOverride` / `captionForceOverlay` are introduced without bumping `v` — old presets / share-codes that don't carry them simply default to null / false on apply, so backwards compat holds. Bump to `v: 2` only when changing the *meaning* of an existing field or when removing a field whose absence used to imply something different.

**Apply scope**: applying a preset writes to `activeCfg()` + `state.draftCfg` so future imports inherit, but **does not** mutate other already-loaded photos. Users propagate via "Apply frame to all" if needed (matches the existing one-look-many-photos flow).

**Hash boot**: `applyHashPresetIfPresent()` runs once after `loadBundle()` — decodes `#p=…`, applies to draftCfg, `history.replaceState`'s the hash away (so refresh doesn't reapply, and the URL doesn't leak into the user's next share). Auto-apply, no confirmation dialog. Decode failure surfaces `status.presetHashBad`.

**Naming**: `prompt()` with default `Preset YYYY-MM-DD HH:MM`. Same-name save overwrites silently. 60-char cap.

**Versioning**: `v: 1` field. Old code refuses unknown versions and surfaces `presetHashBad`. Additive field changes (see above) stay on v:1.

**Factory presets** (`FACTORY_PRESETS` const in `public/app.js`). Curated seed looks shipped with the app — read-only, never written to localStorage, surfaced as the 4-column tile grid at the top of the Looks picker (`#look-factory-grid`). Each entry is `{ id, nameKey, iconEmoji, preset }`, where `preset` is the same v:1 schema as user presets so `applyPresetToCfg` is the single apply path. Both factory-tile clicks and user-row clicks go through `applyPresetByName(preset, label, opts)` (shared helper that owns customLogo sync + lookState baseline capture + modified-state reset + status toast).

Adding / editing a factory preset:
1. Edit the `FACTORY_PRESETS` array in `public/app.js`. Pick a `frame` + `template` combo that the design language actually supports (run dev and check); set every LOOK_KEYS field explicitly so future schema additions don't silently default.
2. Add a `preset.factory.<id>` key to **both** locales in `public/i18n.js`.
3. (Optional) Update the README feature list if the new seed showcases an architectural unlock.

**Design rule for factory presets**: every parameter a seed sets must also be **reachable from the UI**. If a seed needs a knob the user can't dial themselves, expose the knob first (slider / toggle / picker), then add the seed. Otherwise the user can't fork the preset, and we've shipped a "skin" instead of an engine showcase. Past examples:
- `radiusOverride` was unlocked from frame-only to cfg+UI specifically so "35mm authentic" could set it AND users could keep dialing it.
- `captionForceOverlay` likewise.
- `topTemplate` + `captionOverlayTextLift` (0.22) were unlocked as new cfg+UI knobs specifically because the curated `torn-paper-stack` preset wanted "FUJIFILM · X-T5" at the top and `film-35-stack` wanted the watermark lifted 32px from the bottom edge — neither was reachable before, so both knobs landed first, then the seeds.

**0.22.0 preset rework**: the library was cut from 7 generic seeds (`film-35-authentic`, `magazine-editorial`, `hasselblad-tribute`, `leica-side-rail`, `kodak-professional`, `polaroid-classic`, `frosted-classic`) to 4 tuned ones — `frosted-noir-stack`, `torn-paper-stack`, `film-35-stack`, `film-mf-print`. The old seeds were "frame × template combinations with mostly-default knobs"; the new ones each commit to a finished aesthetic (every LOOK_KEYS field set deliberately, every new knob exercised). User-saved presets in localStorage are untouched.

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

Each `state.files[i]` carries its own complete `cfg` (frame / aspect / template / padding / captionHeight / bg* / shadow* / radiusOverride / captionForceOverlay / captionOverlayTextLift / topTemplate / torn* / showFields / customLogo / customBg / collage / rotation / crop / exifOverride). Only `format` and `quality` stay global because they apply to a batch uniformly. The collage `partnerFiles` array lives on the rail entry itself (not in cfg) because `File` is not JSON-serializable.

**`radiusOverride` / `captionForceOverlay`** were added 2026-05-09 (0.19.0) as the first cfg-level unlocks of frame-internal knobs. `radiusOverride: null` means "fall through to frame.layout.radiusOverride or aspect base"; any number 0–72 wins. `captionForceOverlay: true` short-circuits `computeCaptionZone` straight to overlay regardless of `prefer` / available padding. Both are reset to default on frame switch (consistent with bg* / shadow*) and propagated by "Apply frame to all" + presets.

**`tornJitter` / `tornStep` / `tornEdgeOpacity`** (0.21+) — torn-paper frame's procedural-tear knobs, exposed under "Advanced · torn paper" in B · Frame, mirroring frosted-advanced's blur/brightness/saturation triplet. `null` = use frame default (jitter 6 / step 7 / edgeOpacity 0.22). Plumbed via `R.resolveRenderParams` into `params.torn`, which `tornClip` + `decorate` consume from `args.params.torn`. Same reset / preset / share-code semantics as the radius/overlay pair.

**`filmMfAge`** (0.22+) — film-mf vintage-aging strength (0..1). Single composite scalar that scales all of the frame's `decorate`-baked aging effects (sepia tint, partial-fade gradient, corner vignette, foxing speck alphas) uniformly. `null` = use frame default `filmMf: { age: 1.0 }` (full vintage); 0 = clean print (paper bg + deckle hairline + library notation persist; sepia / fade / vignette / foxing all suppressed). Exposed under "Advanced · vintage print" in B · Frame as a single 0–100% slider. Plumbed via `R.resolveRenderParams` into `params.filmMf`, which film-mf's `decorate` reads from `args.params.filmMf.age`. Same reset / preset / share-code semantics as the torn triplet.

**`topTemplate`** (0.22+) — `'none' | 'brand-model' | 'brand-only' | 'wordmark'`. Top-of-frame badge picker (workshop's **E · Top** section). Independent of bottom caption template. Renders via `R.buildTopBadgeSvg` before frame `decorate`. Resets to `'none'` on frame switch. See "Top-of-frame badge" section above for the full design.

**`captionOverlayTextLift`** (0.22+) — 0–120 base-1440 px. Only meaningful when `captionForceOverlay === true`. Lifts overlay caption text up within the gradient. Slider sits in the same C · Template section as the forceOverlay toggle (hidden when overlay is off via `els.captionOverlayLiftRow.hidden`). Resets to 0 on frame switch.

**Adding a new cfg field — full checklist (DO NOT SKIP).** A cfg field that's read in render code (clientRender / worker / shared/render.js) is *not* automatically reachable from the UI just because it exists on the cfg object. There are TWO whitelist projections that strip unknown fields, and forgetting either silently makes the feature look "completely broken" while the schema looks correct:

1. **`defaultCfg()`** in `public/app.js` — the field's initial value + presence on every fresh cfg.
2. **`LOOK_KEYS`** array — what gets snapshotted into presets / share-codes / "Apply frame to all".
3. **`doRender()` cfg projection** in `public/app.js` (~line 415) — the preview path manually projects fields when calling `CR.renderPreview`. Fields missing here are dropped from preview rendering. **This is the easiest one to forget; symptom = slider/toggle has no effect on the on-screen preview.**
4. **`buildConfigForFile()`** in `public/app.js` — the export path's cfg projection. Fields missing here are dropped from JPEG/PNG export. **Symptom = preview shows the change but exported file doesn't.**
5. **`clientRender.js → buildLayoutAndCaption`** — passes cfg field through to `layoutOpts` for `R.computeLayout` / `computeCaptionZone`.
6. **`worker.js`** mirrors #5 for batch export.
7. **`R.computeLayout`** / **`computeCaptionZone`** in `shared/render.js` — actually consume the field.
8. **UI control** in `public/index.html` + event listener in `app.js` — slider / toggle / picker that writes `activeCfg().<field> = ...` and calls `requestRender()`.
9. **`syncControlsFromCfg()`** — pulls the field's value into the UI control on photo switch / preset apply.
10. **`onFrameChange()`** — reset the field on frame switch if it's a "look" parameter (consistent with bg* / shadow*).
11. **i18n keys** for any user-visible label / hint.

When debugging "the new cfg field doesn't seem to do anything," check #3 first (preview) and #4 second (export). The 0.19 round shipped with both projections missing radiusOverride / captionForceOverlay, so the slider + toggle looked dead until the user reported it. The lesson: cfg whitelist projections are silent footguns — adding a cfg field is at minimum an 11-touch change, and #3/#4 are the ones the schema doesn't enforce.

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

### S3 cloud gallery (`public/cloudS3.js` + `<dialog id="s3-modal">`, 0.24+)

Optional cloud branch: upload the current rail to a user-owned S3-compatible bucket, share the bucket via a credential-bearing URL hash, and let recipients pull thumbnails + originals back into their rail. Pure-frontend — every PUT / GET / LIST is browser-signed via SigV4 (vendored `aws4fetch`). Three providers: **AWS S3**, **Cloudflare R2**, **Aliyun OSS** (S3-compat mode).

**Module surface** (`window.CloudS3`):
- `ensureLoaded()` — lazy-injects `vendor/aws4fetch.js` (~12KB UMD) on first use. Never enters service-worker precache; users who skip the cloud feature pay zero bytes.
- `buildClient(cfg)` → `AwsClient` — wraps aws4fetch with `service:'s3'` and a provider-resolved signing region.
- `putObject / getObject / deleteObject / listObjects` — minimal CRUD. List parses `ListObjectsV2` XML via native `DOMParser` and handles `NextContinuationToken` pagination.
- `resolveEndpoint(provider, region, bucket, accountId)` — generates default bucket-scope URL per provider; users can override the endpoint field directly.
- `makeThumb(file)` — 480px long-edge JPEG q=0.7 thumbnail blob (same recipe as `compressBgImage`).
- `encodeShareCode / decodeShareCode` — base64url(JSON) for the `#s3=` URL hash. Same pattern as preset `#p=`.

**Data model** (`state.s3Config`, NOT in `LOOK_KEYS` and NOT in preset/share-code):
```js
{ v: 1, provider: 'aws'|'r2'|'aliyun', endpoint, region, bucket, prefix,
  accountId, accessKeyId, secretAccessKey }
```

localStorage key: `phototools.s3Config`. Persisted on Save / Test-success / Share / Upload (any action that confirms the user intends to keep using this bucket).

**Storage layout on the bucket**:
```
<prefix>/<filename>                  ← original, what mergeFiles() will receive
<prefix>/_thumbs/<filename>.jpg      ← 480px JPEG q=0.7 thumbnail
```

Gallery refresh lists `<prefix>/_thumbs/`, derives each original key by stripping the `_thumbs/` segment + `.jpg` suffix, and renders cells lazily — thumbnail blob URLs populate as GETs resolve. Clicking "Load selected" GETs each original, wraps in `new File([blob], name, { type, lastModified: Date.now() })`, and feeds the array to `mergeFiles()`. mergeFiles' dedup key uses `name + size + lastModified`; from-cloud loads stamp `lastModified` with `Date.now()` so a re-load of the same name doesn't silently dedup.

**Share URL semantics** (`#s3=<base64url(JSON)>`):
- Bundles the full config object including read/write credentials. The UI surfaces a hard warning on copy ("此链接含读写凭证") so the user isn't surprised.
- Recipients: `applyHashS3IfPresent()` at boot decodes → writes to localStorage → strips the hash from the URL via `history.replaceState` → auto-opens the modal on the Gallery tab → triggers `refreshGallery()`.
- Coexists with `#p=` preset-share independently — they're separate boot calls. Cannot combine both in one URL.

**Provider quirks (handled in `resolveEndpoint` + `signingRegion`)**:
- **AWS S3**: virtual-hosted host (`<bucket>.s3.<region>.amazonaws.com`). Region passed as-is.
- **Cloudflare R2**: path-style (`<account>.r2.cloudflarestorage.com/<bucket>/`). Signing region forced to `auto`. Form shows an "Account ID" field instead of region.
- **Aliyun OSS (S3 mode)**: virtual-hosted (`<bucket>.oss-<region>.aliyuncs.com`). Signing region auto-strips the `oss-` prefix users sometimes paste from the console (so `oss-cn-hangzhou` signs as `cn-hangzhou`).
- Users can hand-override the endpoint field for non-listed providers (MinIO etc.) — the form's endpoint is the canonical bucket-scope URL.

**CORS** is the most common failure mode (browser can't sign across `Failed to fetch`). The modal's collapsible "CORS help" panel renders a provider-specific config template inline that the user can copy into their bucket console. `CloudS3.describeError()` adds a "likely CORS misconfig" hint when fetch fails with TypeError.

**Upload-related caveats** (single-file PUT, no multipart):
- For files >50MB AWS S3 recommends multipart; we don't implement it. Single-file PUT works up to several hundred MB on modern browsers but stalls if the connection drops mid-stream.
- Thumbnail is generated client-side via `createImageBitmap` → OffscreenCanvas.convertToBlob; if the source can't be decoded (corrupt JPEG, unsupported format) the upload aborts before the original PUT so the bucket never ends up with an original-without-thumbnail.

**Export-original button** (`Exporter.exportOriginal(entry)` in `public/exporter.js`): a third button in the lookbar export group (`#export-original-btn`, label "RAW"). Bypasses `compose()` entirely and just streams `entry.file` through the same `triggerDownload` helper as framed exports. Useful in the cloud-pull workflow ("get my photo back unedited") but works on any rail entry.

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

For a one-off / experimental ratio, end users can hit the **Custom** button in `#aspect-seg`, which opens `<dialog id="aspect-modal">` (W/H inputs + presets) and writes the literal `"W:H"` token into `cfg.aspect`. `R.resolveAspectPreset(token)` synthesizes the layout on the fly (short edge fixed at 1440, midpoint defaults for padding / radius / caption). No code change needed.

To promote a ratio into the seg as a first-class preset (gets its own button + tuned layout constants):
1. Extend `BASE_PRESETS` in `public/shared/render.js` with hand-tuned `bottomCaptionH` / `fgYOffset` / `bottomPaddingBias` for that ratio.
2. Add a `<button data-val="W:H">` to `#aspect-seg` in `public/index.html`, **before** the trailing `id="aspect-custom-btn"` button — the Custom button is wired to fall through to the dialog and must stay last.

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
- **`overflow-x: hidden` + `overflow-y: visible` (or any "clipped + visible" mismatch) is silently normalized** by browsers. Per CSS spec, when one axis is `visible` and the other is anything else (`hidden`, `auto`, `scroll`), the `visible` axis is forced to `auto`. This trips you up when a desktop rule sets `overflow-x: hidden` (e.g. so a grid cell can shrink to 0 during a collapse animation) and a mobile media query tries to restore natural page scroll with only `overflow-y: visible` — the browser sees `hidden + visible`, normalizes the visible axis to `auto`, and you get an unexpected inner scrollbar instead of page-flow scroll. Fix: in the mobile rule, reset BOTH axes (`overflow: visible`) so neither side mismatches.
- **`element.offsetTop` is wrong while a CSS-grid track is mid-transition.** Reading `offsetTop` inside a parent whose `grid-template-columns` is animating from 0 → N returns the pre-transition layout (children wrap at zero width and pile up taller). Setting `scrollTo(target.offsetTop)` lands somewhere wrong. Fix: trigger the layout change first, then `setTimeout(measureAndScroll, transitionMs + 20)` to outlast the animation. Two `requestAnimationFrame`s aren't enough. (Encountered with the original collapsible sidebar before the v0.15 lookbar redesign; lesson generalizes to any animated grid track.)
- **CSS `background:` shorthand in a state rule (`:focus`/`:hover`/`:active`) resets ALL `background-*` longhands to initial.** If a base rule sets `background-image`, `background-position`, `background-size`, `background-repeat` as longhands (e.g., for a custom select chevron), and a state rule uses the shorthand for what it thinks is "just a color change" (`select:focus { background: var(--bg-base) }`), the shorthand expands to wipe `background-repeat: no-repeat` back to `repeat`, `background-position` to `0% 0%`, `background-size` to `auto`. Even if a *later* state rule re-sets `background-image`, the chevron now tiles across the whole element from the top-left corner — visible as a wave of repeated icons. **Fix**: use `background-color:` longhand in state rules when you only mean to change the color. The shorthand is only safe in rules that own the entire bg-* setup.
- **The HTML `hidden` attribute applies `display: none` only via UA stylesheet (specificity 0,0,0,1 — element selector). ANY author rule with a class selector (specificity ≥ 0,0,1,0) that sets `display:` will silently win the cascade and re-show the "hidden" element.** Surface symptom: an empty overlay div paints invisibly on top of everything else, blocking interaction with whatever is below — and you can't see *what* is blocking because the overlay has no visible content. Diagnostic: `document.elementFromPoint(centerX, centerY)` returns the overlay element instead of the expected content underneath. Bit us when a `<div id="geo-error" class="geo-error" hidden>` overlay (`position: absolute; inset: 0; z-index: 500`) was rendered as `display: flex` because `.geo-error { display: flex }` beat the UA's `[hidden]` rule — the entire Leaflet map appeared blank for 30 minutes of debugging while tiles were happily loading underneath. **Fix**: every author rule that sets `display:` on an element that can be hidden via the `hidden` attribute must add a sibling `[hidden]` rule, e.g. `.geo-error[hidden] { display: none; }`. Or use a class toggle (`.is-visible`) instead of the `hidden` attribute. The rule applies broadly: `.modal { display: flex }` + `<div class="modal" hidden>` has the same trap.
- **`<dialog>` UA stylesheet clamps `max-width: calc((100% - 6px) - 2em)` and a similar `max-height`.** Setting `width: 100vw` on a `<dialog>` to make it full-screen on mobile is **not** enough — the UA max-width still keeps the box ~32–50px shy of the viewport edge, leaving black gutters that read as "the modal didn't actually go fullscreen." Same trap on max-height. **Fix**: override BOTH dimensions explicitly in your full-screen rule (`max-width: 100vw; max-height: 100vh; inset: 0; margin: 0;`). Diagnostic: `getComputedStyle(dlg).maxWidth` returns `calc(100% - 32px)` instead of your declared value. Caught while wiring the GPS picker — no amount of "but my CSS says width 100vw" will get you to edge-to-edge unless you knock down the max-* clamps too.
- **A flex container with fixed height + children that sum past it does NOT clip — it silently shrinks every child via `flex-shrink: 1` (default), making one child collapse to ~0 instead of overflowing visibly.** Diagnostic signature: a child element with `min-height: 44px` declared but `getBoundingClientRect().height` returns 2; `document.elementFromPoint()` at the child's expected center returns a *sibling* element instead of the child (the sibling shifted up to fill the space the shrunken child vacated). Bit us in v0.17 when the mobile lookbar (fixed 116px height) gained a 4th control row in v0.16.1 (workshop entry, ~50px) without lookbar-h being bumped — the flex shrinkage ratio became extreme and chip-group collapsed to 2px, making all 4 lookchips unclickable while LOOKING normal because workshop-trigger had drifted up to overlay the chip area visually. The bug shipped because it was tested at desktop breakpoints where `flex-direction: column` was overridden to `row` with sufficient horizontal space. **Fix**: when adding any new child to a fixed-height flex container, sum the children's natural heights and adjust the container OR add `flex-shrink: 0` to the children that must keep their declared size. Verify on every breakpoint, not just the development viewport. Mobile-specific lookbar additions especially need a "does this fit?" pass — `var(--lookbar-h)` is the budget, every child's natural height counts against it. The lesson generalizes: **fixed-dimension flex containers are silently destructive of size constraints under overflow**, and bottom-sheet UIs are the most common flavor of fixed-dimension flex on this project.
- **iOS Safari keeps `:hover` sticky for ~300ms after a tap, making "lifted" buttons read as stuck mid-press.** Any rule that does `transform: translateY(-1px)` / border-style flip / dramatic background shift on `:hover` will leave that visual state on screen well after the user's finger has lifted, giving a "broken/unresponsive" feel. Diagnostic: tap a button on iOS, observe the lift state freezes for ~half a second; tap an unrelated area to clear. **Fix**: gate hover styling behind `@media (hover: hover) and (pointer: fine)` for desktop-only behavior, OR add a counter-rule under `@media (hover: none)` that resets transforms / border-style / dramatic bg shifts on touch. The latter is less invasive when you have ~50 hover selectors and don't want to refactor each one — it's purely additive. Keep `:active` styles untouched: those fire during the actual press and disappear cleanly on release. Caught during the v0.17 mobile pass; the workshop entry's dashed→solid hover and the Import button's `translateY(-1px)` were the most jarring offenders.
- **`@media (max-width: 768px)` is the wrong cutoff for "is mobile" because iPad portrait is 744–820px wide.** Anything that triggers bottom-sheet / single-column layout at ≤768px will incorrectly catch every iPad in portrait, giving them a tablet-sized phone UI. **Fix**: the project uses a two-axis breakpoint stack instead — `@media (max-width: 700px), (max-height: 500px) and (orientation: landscape)` for "phone mode" (portrait phones up to 700px wide OR any landscape device <500px tall, which catches landscape phones regardless of width while iPad-landscape's 768px height cleanly excludes), AND `@media (min-width: 701px) and (pointer: coarse)` to layer touch-friendly sizing onto the desktop layout for tablets. The "phone vs tablet" split lands on capability + form factor (touch-primary + width), not raw width. When adding new responsive rules, follow the same convention.
- **Browser `fetch()` does not distinguish CORS failures from network failures.** Both surface as a generic `TypeError: Failed to fetch` (`NetworkError` on Firefox, `Load failed` on Safari) — same exception type, no usable detail. When wiring a feature that hits a third-party origin (S3 buckets, OSS endpoints, R2 hostnames), it's easy to chase the wrong cause for half an hour: looks like the URL is wrong, but actually CORS isn't configured. **Fix**: in any user-facing error path that wraps a cross-origin fetch, annotate the error with a "likely CORS misconfiguration" hint AND surface a sample CORS config the user can copy into their bucket console. `CloudS3.describeError()` in `public/cloudS3.js` is the example; the S3 modal's collapsible CORS-help panel shows per-provider templates inline. Without this UX, the user gets "Failed to fetch" and concludes the app is broken — when actually their bucket just needs an `AllowedOrigins` entry. The lesson generalizes: any browser cross-origin call needs UX that pre-empts the CORS confusion, not just code that handles the exception.
- **AWS SigV4 signing region for S3-compatible providers isn't always the obvious string.** Aliyun OSS users paste `oss-cn-hangzhou` into the region field (matching their console URL); SigV4 expects `cn-hangzhou` (no `oss-` prefix) because the service token is already `s3`. Cloudflare R2 ignores region entirely but the SDK requires *something* — they conventionally use the literal string `auto`. AWS S3 uses the bare region like `us-east-1`. `CloudS3.signingRegion(provider, region)` normalizes these so the user can paste whatever their console shows and signing still succeeds. **Lesson when adding a new S3-compat provider**: don't pass the user's input region string straight to AwsClient; map it first. Wrong region produces a signature mismatch (HTTP 403 `SignatureDoesNotMatch`), which from the browser side is indistinguishable from "credentials wrong" — debugging is slow without this normalization layer.
- **`<dialog>` UA stylesheet has `overflow: auto` by default.** Combined with global `* { box-sizing: border-box }`, a dialog with `max-height: 86vh` + 1px top/bottom border has a *content area* of `86vh - 2px` — but if `.dialog-inner` also sets `max-height: 86vh`, the inner overflows the dialog's content box by exactly the border width (2px). The UA's auto-scrollbar then triggers, showing as an OS-native scrollbar on the dialog itself (separate from any custom-scrollbar work on inner scroll containers). Diagnostic: `dialog.scrollHeight - dialog.clientHeight === border-width-sum`. **Fix**: explicitly set `overflow: hidden` on the `<dialog>`. The inner content's own scroll container handles the actual scrolling; the dialog never needs to.

## Known limitations / future work

- HEIC inputs round-trip the curated EXIF tag set (Make / Model / focal / aperture / shutter / ISO / lens / date / artist) — see `ExifIO.injectExifFromHeic`. Tags outside that table (manufacturer-specific MakerNote subfields, GPS, color profile, etc.) are dropped by the transcode.
- RAW inputs are not supported.
- `brand-logo` template renders the brand as text when no SVG slug matches — bundle more SVGs to expand coverage.
- Job batching is in-memory only; for very large batches (50+ photos at original quality) the browser may run out of memory.
- No automated test suite; verify changes by browser smoke (load → preview → export single → export batch → check EXIF round-trip).
