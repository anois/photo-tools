'use strict';

const FIELD_KEYS = ['brand', 'model', 'focal', 'aperture', 'shutter', 'iso', 'lens', 'date', 'author', 'flash', 'gps'];
const R = window.PhotoRender;
const CR = window.ClientRender;
const T = (k, vars) => window.I18N.t(k, vars);

const DEFAULT_FRAME = 'frosted-noir';

// One immutable factory — every photo gets its own cloned cfg. Each photo
// holds its complete render configuration (frame/aspect/template/padding/bg/
// shadow/showFields/exif). Output format and quality stay global on `state`
// because they apply uniformly to a batch.
function defaultCfg() {
  const sd = R.FRAMES[DEFAULT_FRAME].shadowDefault;
  return {
    aspect: '9:16',
    frame: DEFAULT_FRAME,
    template: 'minimal-text',
    padding: 70,
    // Per-edge padding overrides (1.1+). null = follow scalar `padding` +
    // frame's topPaddingBoost / bottomPaddingBias. Any non-null value WINS
    // outright: the user has explicitly dialed that edge in Compose mode,
    // bypassing frame boosts (frame.minPadding then nudges via warning,
    // doesn't block). Reset to null on frame switch (consistent with
    // bgBlur / shadowBlur). Same v:1 additive contract as radiusOverride.
    paddingTop: null,
    paddingRight: null,
    paddingBottom: null,
    paddingLeft: null,
    captionHeight: null,
    bgBlur: null, bgBrightness: null, bgSaturation: null,   // null → use frame preset
    shadowBlur: sd.blur, shadowOffsetY: sd.offsetY, shadowOpacity: sd.opacity,
    // null = use frame.layout.radiusOverride or aspect base.radius (default 36).
    // Exposed in B · Frame so any user can dial it down to 0 (35mm authentic
    // look) or up beyond defaults — not just factory presets that flip it.
    radiusOverride: null,
    // false = caption auto-routes via computeCaptionZone priority.
    // true = force overlay placement regardless of available padding,
    // for "watermark stamped inside the photo" looks (e.g. authentic film).
    captionForceOverlay: false,
    // Torn-paper knobs (only meaningful when frame === 'torn'). null = use
    // frame.torn defaults (jitter 6 / step 7 / edgeOpacity 0.22). The
    // "Advanced · torn paper" panel in B · Frame exposes them as 3 sliders,
    // mirroring the frosted bg's blur/brightness/saturation triplet.
    tornJitter: null,
    tornStep: null,
    tornEdgeOpacity: null,
    // Film-mf vintage-aging strength (0..1). null = use frame default
    // (1.0 = full vintage). Scales sepia / fade / vignette / foxing
    // alphas uniformly. Only meaningful when frame === 'film-mf'.
    filmMfAge: null,
    // Top-of-frame badge (cfg.topTemplate). Independent of bottom caption —
    // stamps brand identity into the frame's top padding. 'none' = no badge.
    // 'brand-model' = logo + " · " + model. 'brand-only' = logo alone.
    // 'wordmark' = oversized uppercase brand name (no logo).
    topTemplate: 'none',
    // captionOverlayTextLift: only meaningful with captionForceOverlay = true.
    // 0–120 base-1440 px. Floats the overlay TEXT up by N px while the
    // semi-transparent gradient backdrop stays pinned to the photo's bottom
    // edge. 0 = caption text sits at the very bottom (legacy behavior).
    captionOverlayTextLift: 0,
    showFields: { brand: true, model: true, focal: true, aperture: true, shutter: true, iso: true, lens: false, date: false, author: true, flash: false, gps: false },
    // Rotation applied at render time, in degrees clockwise. 0 / 90 / 180 / 270.
    // Per-photo correction — not propagated by "Apply frame to all" or by
    // presets, since it's more of a "this specific photo was shot wrong"
    // fix than a stylistic choice.
    rotation: 0,
    // Crop rect in post-rotation [0..1] coordinates, applied at render time.
    // null = no crop (full image). Per-photo correction like rotation —
    // not propagated by Apply-frame-all and not in presets, since cropping
    // is a per-shot composition fix rather than a shared look.
    crop: null,
    // User-supplied background image. When set + frame is frosted/frosted-dark,
    // this image (blurred + tinted with the frame's saturation/brightness/
    // darken) replaces the self-image bg. null = use the photo itself.
    customBg: null,
    // User-uploaded signature image overlaid on the foreground photo. null means
    // no signature; otherwise { data: dataURL, type: 'svg'|'png',
    // position: 'br'|'bl'|'bc', scale: 0.06, opacity: 1 }.
    customLogo: null,
    // Collage mode. null = single photo; otherwise { layout: 'h2'|'v2'|
    // 'h3'|'v3'|'2x2' }. Partner Files themselves aren't part of cfg
    // (Files don't serialize to JSON); they live on the per-photo entry as
    // `entry.partnerFiles` (array, length depends on layout).
    collage: null,
    // EXIF user overrides keyed by input name (make/model/focalLength/...) →
    // raw string from the form. Backend applies formatters via formatBrand etc.
    exifOverride: {}
  };
}

function cloneCfg(c) {
  return {
    ...c,
    showFields: { ...c.showFields },
    exifOverride: { ...c.exifOverride },
    customLogo: c.customLogo ? { ...c.customLogo } : null,
    customBg: c.customBg ? { ...c.customBg } : null,
    collage: c.collage ? { ...c.collage } : null,
    crop: c.crop ? { ...c.crop } : null
  };
}

const state = {
  files: [],            // { file, url, exif, normalized, cfg }
  activeIdx: -1,
  draftCfg: defaultCfg(),  // referenced via activeCfg() when no files are loaded
  format: 'jpeg',
  quality: 'standard',
  logos: null,
  fontFaceCss: '',
  rendering: false,
  pendingRender: false
};

// LOOK system state — declared early so syncControlsFromCfg() (which boots
// at module load, before the LOOK section runs) can safely reach for it.
// Mutated by setLookActive() / applyPresetByName() further down. See the
// "LOOK system" comment block for what each field means.
const lookState = {
  baseline: null,
  label: null,
  iconEmoji: null,
  isFactory: false,
  id: null
};

function activeCfg() {
  const f = state.files[state.activeIdx];
  return f ? f.cfg : state.draftCfg;
}

const els = {
  fileInput: document.getElementById('file-input'),
  thumbRail: document.getElementById('thumb-rail'),
  aspectSeg: document.getElementById('aspect-seg'),
  aspectCustomBtn: document.getElementById('aspect-custom-btn'),
  aspectCustomLabel: document.getElementById('aspect-custom-label'),
  aspectModal: document.getElementById('aspect-modal'),
  aspectW: document.getElementById('aspect-w'),
  aspectH: document.getElementById('aspect-h'),
  aspectApply: document.getElementById('aspect-apply'),
  aspectCancel: document.getElementById('aspect-cancel'),
  aspectClose: document.getElementById('aspect-close'),
  aspectError: document.getElementById('aspect-error'),
  aspectPresets: document.querySelectorAll('.aspect-preset'),
  frameSeg: document.getElementById('frame-seg'),
  frameFamilySeg: document.getElementById('frame-family-seg'),
  templateSeg: document.getElementById('template-seg'),
  templateFamilySeg: document.getElementById('template-family-seg'),
  format: document.getElementById('format'),
  quality: document.getElementById('quality'),
  padding: document.getElementById('padding'),
  paddingVal: document.getElementById('padding-val'),
  captionH: document.getElementById('caption-h'),
  captionHVal: document.getElementById('caption-h-val'),
  radius: document.getElementById('radius'),
  radiusVal: document.getElementById('radius-val'),
  captionOverlayToggle: document.getElementById('caption-overlay-toggle'),
  captionOverlayLiftRow: document.getElementById('caption-overlay-lift-row'),
  captionOverlayLift: document.getElementById('caption-overlay-lift'),
  captionOverlayLiftVal: document.getElementById('caption-overlay-lift-val'),
  topTemplateSeg: document.getElementById('top-template-seg'),
  frostedAdvanced: document.getElementById('frosted-advanced'),
  bgBlur: document.getElementById('bg-blur'),
  bgBlurVal: document.getElementById('bg-blur-val'),
  bgBrightness: document.getElementById('bg-brightness'),
  bgBrightnessVal: document.getElementById('bg-brightness-val'),
  bgSaturation: document.getElementById('bg-saturation'),
  bgSaturationVal: document.getElementById('bg-saturation-val'),
  resetBgBtn: document.getElementById('reset-bg-btn'),
  // Torn-paper advanced — same details-panel pattern, gated on frame === 'torn'
  tornAdvanced: document.getElementById('torn-advanced'),
  tornJitter: document.getElementById('torn-jitter'),
  tornJitterVal: document.getElementById('torn-jitter-val'),
  tornStep: document.getElementById('torn-step'),
  tornStepVal: document.getElementById('torn-step-val'),
  tornEdgeOpacity: document.getElementById('torn-edge-opacity'),
  tornEdgeOpacityVal: document.getElementById('torn-edge-opacity-val'),
  resetTornBtn: document.getElementById('reset-torn-btn'),
  // Film-mf advanced — vintage-aging slider, gated on frame === 'film-mf'
  filmMfAdvanced: document.getElementById('film-mf-advanced'),
  filmMfAge: document.getElementById('film-mf-age'),
  filmMfAgeVal: document.getElementById('film-mf-age-val'),
  resetFilmMfBtn: document.getElementById('reset-film-mf-btn'),
  applyFrameAllBtn: document.getElementById('apply-frame-all-btn'),
  // ── LOOK system (presets library — promoted to lookbar first-class) ──
  lookbarLook: document.querySelector('.lookbar-look'),
  lookbarLookValue: document.getElementById('lookbar-look-value'),
  lookbarLookStatus: document.getElementById('lookbar-look-status'),
  lookFactoryGrid: document.getElementById('look-factory-grid'),
  lookFactoryCount: document.getElementById('look-factory-count'),
  lookUserList: document.getElementById('look-user-list'),
  lookUserCount: document.getElementById('look-user-count'),
  lookUserEmpty: document.getElementById('look-user-empty'),
  lookSaveBtn: document.getElementById('look-save-btn'),
  lookShareBtn: document.getElementById('look-share-btn'),
  lookPasteBtn: document.getElementById('look-paste-btn'),
  shadowBlur: document.getElementById('shadow-blur'),
  shadowBlurVal: document.getElementById('shadow-blur-val'),
  shadowOffset: document.getElementById('shadow-offset'),
  shadowOffsetVal: document.getElementById('shadow-offset-val'),
  shadowOpacity: document.getElementById('shadow-opacity'),
  shadowOpacityVal: document.getElementById('shadow-opacity-val'),
  showFields: document.getElementById('show-fields'),
  signatureInput: document.getElementById('signature-input'),
  signatureDrop: document.getElementById('signature-drop'),
  signaturePreview: document.getElementById('signature-preview'),
  signaturePreviewImg: document.getElementById('signature-preview-img'),
  signatureClearBtn: document.getElementById('signature-clear-btn'),
  signaturePosGrid: document.getElementById('signature-pos-grid'),
  signatureScale: document.getElementById('signature-scale'),
  signatureScaleVal: document.getElementById('signature-scale-val'),
  signatureOpacity: document.getElementById('signature-opacity'),
  signatureOpacityVal: document.getElementById('signature-opacity-val'),
  collageLayout: document.getElementById('collage-layout'),
  collageSlots: document.getElementById('collage-slots'),
  geometryReadout: document.getElementById('geometry-readout'),
  cropRotCcw: document.getElementById('crop-rot-ccw'),
  cropRotCw: document.getElementById('crop-rot-cw'),
  cropAngle: document.getElementById('crop-angle'),
  cropAngleVal: document.getElementById('crop-angle-val'),
  cropRotReset: document.getElementById('crop-rot-reset'),
  cropOpenBtn: document.getElementById('crop-open-btn'),
  cropModal: document.getElementById('crop-modal'),
  cropModalCloseBtn: document.getElementById('crop-modal-close'),
  cropStage: document.getElementById('crop-stage'),
  cropCanvas: document.getElementById('crop-canvas'),
  cropRect: document.getElementById('crop-rect'),
  cropReadout: document.getElementById('crop-readout'),
  cropResetBtn: document.getElementById('crop-reset'),
  cropCancelBtn: document.getElementById('crop-cancel'),
  cropApplyBtn: document.getElementById('crop-apply'),
  cropAspectSeg: document.getElementById('crop-aspect-seg'),
  cropPctW: document.getElementById('crop-pct-w'),
  cropPctH: document.getElementById('crop-pct-h'),
  cropReadoutPx: document.getElementById('crop-readout-px'),
  cropReadoutRatio: document.getElementById('crop-readout-ratio'),
  canvasFrameBadge: document.getElementById('canvas-frame-badge'),
  canvasBadgeFrame: document.getElementById('canvas-badge-frame'),
  canvasBadgeTemplate: document.getElementById('canvas-badge-template'),
  canvasBadgeRot: document.getElementById('canvas-badge-rot'),
  canvasBadgeRotVal: document.getElementById('canvas-badge-rot-val'),
  rotationFlash: document.getElementById('rotation-flash'),
  rotationFlashArrow: document.getElementById('rotation-flash-arrow'),
  rotationFlashVal: document.getElementById('rotation-flash-val'),
  changelogBtn: document.getElementById('changelog-btn'),
  changelogBadge: document.getElementById('changelog-badge'),
  changelogModal: document.getElementById('changelog-modal'),
  changelogModalCloseBtn: document.getElementById('changelog-modal-close'),
  changelogBody: document.getElementById('changelog-body'),
  customBgInput: document.getElementById('custom-bg-input'),
  customBgDrop: document.getElementById('custom-bg-drop'),
  customBgReadout: document.getElementById('custom-bg-readout'),
  customBgPreview: document.getElementById('custom-bg-preview'),
  customBgName: document.getElementById('custom-bg-name'),
  customBgClearBtn: document.getElementById('custom-bg-clear-btn'),
  exportBtn: document.getElementById('export-btn'),
  batchBtn: document.getElementById('batch-btn'),
  clearExifBtn: document.getElementById('clear-exif-btn'),
  applyExifAllBtn: document.getElementById('apply-exif-all-btn'),
  copyRawExifBtn: document.getElementById('copy-raw-exif-btn'),
  status: document.getElementById('status'),
  statusbar: document.querySelector('.statusbar'),
  canvasPane: document.getElementById('canvas-pane'),
  canvas: document.getElementById('preview-canvas'),
  previewLoading: document.getElementById('preview-loading'),
  empty: document.getElementById('empty'),
  dropHint: document.getElementById('drop-hint'),
  exifWarn: document.getElementById('exif-warn'),
  exifDetails: document.getElementById('exif-details'),
  countCurrent: document.getElementById('count-current'),
  countTotal: document.getElementById('count-total'),
  railCount: document.getElementById('rail-count'),
  railMenu: document.getElementById('rail-context-menu'),
  exif: {
    make: document.getElementById('exif-make'),
    model: document.getElementById('exif-model'),
    focalLength: document.getElementById('exif-focalLength'),
    fNumber: document.getElementById('exif-fNumber'),
    exposureTime: document.getElementById('exif-exposureTime'),
    iso: document.getElementById('exif-iso'),
    lensModel: document.getElementById('exif-lensModel'),
    dateTimeOriginal: document.getElementById('exif-dateTimeOriginal'),
    author: document.getElementById('exif-author'),
    flash: document.getElementById('exif-flash'),
    latitude: document.getElementById('exif-latitude'),
    longitude: document.getElementById('exif-longitude')
  }
};

const pad2 = (n) => String(n).padStart(2, '0');

// status holds the i18n key + vars instead of a literal string, so a locale
// switch can re-render the bar without losing what message is currently up.
let currentStatus = { key: 'status.ready', vars: null, mode: null };

function setStatus(keyOrText, mode, vars) {
  // Back-compat: callers used to pass a literal string. If the argument is
  // not a known status key, render it raw and clear the persisted state so
  // a locale switch shows 'ready' instead of an outdated literal.
  if (typeof keyOrText === 'string' && !keyOrText.startsWith('status.')) {
    els.status.textContent = keyOrText;
    currentStatus = { key: 'status.ready', vars: null, mode: mode || null };
  } else {
    const key = keyOrText || 'status.ready';
    currentStatus = { key, vars: vars || null, mode: mode || null };
    els.status.textContent = T(key, vars);
  }
  els.statusbar.classList.toggle('busy', mode === 'busy');
  els.statusbar.classList.toggle('err', mode === 'err');
}

// Number + dim unit ('70 px' rendered as `70` strong + `PX` dim·smaller).
// Pass null/empty unit for unitless values; falls back to plain textContent.
function setReadoutNum(el, value, unit) {
  if (unit) el.innerHTML = String(value) + '<span class="ru">' + unit + '</span>';
  else el.textContent = String(value);
}

function refreshLocaleSensitive() {
  els.status.textContent = T(currentStatus.key, currentStatus.vars);
  // Defaults / readouts that store a literal need to be repainted from cfg.
  const cfg = activeCfg();
  if (els.captionHVal && (cfg.captionHeight == null)) {
    els.captionHVal.textContent = T('frame.captionAuto');
  }
  const frame = R.FRAMES[cfg.frame];
  if (frame && frame.bg.type === 'frosted') {
    if (cfg.bgBlur == null)       els.bgBlurVal.textContent       = T('frame.defaultReadout');
    if (cfg.bgBrightness == null) els.bgBrightnessVal.textContent = T('frame.defaultReadout');
    if (cfg.bgSaturation == null) els.bgSaturationVal.textContent = T('frame.defaultReadout');
  }
  // Aspect seg's Custom button label is either i18n'd ("自定义"/"⋯") or the
  // active custom W:H literal — repaint it through the same sync path.
  if (cfg.aspect) syncAspectSeg(cfg.aspect);
  // Empty rail and EXIF warning re-render from canonical state too.
  renderRail();
  const active = state.files[state.activeIdx];
  updateExifWarn(active ? active.normalized : null);
  // Re-render the LOOK picker on locale flip so the user-preset list's
  // relative-time labels ("3 days ago") + section headers / counts stay in
  // sync with the active locale. Factory tile labels carry data-i18n already
  // so applyDom() handles those in place.
  if (typeof renderLookUserList === 'function') renderLookUserList();
  if (typeof syncLookValueDisplay === 'function') syncLookValueDisplay();
  // Template-compat hint copy comes from the i18n dictionary, so flip
  // languages while the hint is visible needs a repaint.
  refreshTemplateCompatHint();
}

// ─── Asset bundle: pre-baked logos.json + base64-inlined fonts.css ───────
async function loadBundle() {
  const assets = await CR.loadAssets();
  state.logos = assets.logos;
  state.fontFaceCss = assets.fontFaceCss;
}

// EXIF parsing now happens entirely in the browser via the exifr UMD bundle.
// Returns { raw, normalized } — same shape the old /api/exif endpoint emitted.
async function uploadForExif(file) {
  return window.ExifIO.parseExif(file);
}

function hasMeaningfulExif(n) {
  if (!n) return false;
  return !!(n.make || n.model || n.focalLength || n.fNumber || n.exposureTime || n.iso || n.lensModel || n.date);
}

function updateExifWarn(normalized) {
  const showWarn = !hasMeaningfulExif(normalized);
  els.exifWarn.hidden = !showWarn;
  els.exifWarn.innerHTML = showWarn ? T('exif.warn') : '';
  if (showWarn) els.exifDetails.open = true;
}

// Push auto-parsed values into the EXIF inputs. Then any user override stored
// in cfg.exifOverride is layered on top. Auto-parsed comes from the file's
// own metadata; override is the user-edited form value persisted per photo.
function populateExifInputs(normalized) {
  if (!normalized) normalized = {};
  const setIf = (el, v) => { el.value = v != null && v !== '' ? String(v) : ''; };
  setIf(els.exif.make, normalized.make);
  setIf(els.exif.model, normalized.model);
  setIf(els.exif.focalLength, normalized.focalLength ? parseFloat(normalized.focalLength) || '' : '');
  setIf(els.exif.fNumber, normalized.fNumber ? parseFloat(String(normalized.fNumber).replace(/^F/, '')) || '' : '');
  setIf(els.exif.exposureTime, normalized.exposureTime ? String(normalized.exposureTime).replace(/s$/, '') : '');
  setIf(els.exif.iso, normalized.iso ? parseInt(String(normalized.iso).replace(/^ISO/, ''), 10) || '' : '');
  setIf(els.exif.lensModel, normalized.lensModel);
  setIf(els.exif.dateTimeOriginal, normalized.date);
  setIf(els.exif.author, normalized.author);
  setIf(els.exif.latitude, typeof normalized.latitude === 'number' ? normalized.latitude.toFixed(6) : '');
  setIf(els.exif.longitude, typeof normalized.longitude === 'number' ? normalized.longitude.toFixed(6) : '');
  // Flash select reflects the auto-parsed boolean so the user can see what
  // exifr detected; an empty string preserves "auto" semantics on save.
  els.exif.flash.value = normalized.flashFired ? 'fired' : (normalized.flash ? 'off' : '');
}

function applyOverrideToInputs(override) {
  for (const [k, v] of Object.entries(override || {})) {
    if (els.exif[k]) els.exif[k].value = v;
  }
}

// Compose the EXIF object the renderer sees: auto-parsed normalized base with
// per-photo user overrides layered on top, formatted via shared formatters.
function buildExifForFile(f) {
  const base = f && f.normalized ? { ...f.normalized } : {};
  const override = f && f.cfg ? f.cfg.exifOverride : {};
  let gpsTouched = false;
  for (const [key, raw] of Object.entries(override || {})) {
    const v = String(raw).trim();
    if (v === '') {
      if (key === 'dateTimeOriginal') base.date = '';
      else if (key === 'latitude' || key === 'longitude') { base[key] = null; gpsTouched = true; }
      else base[key] = '';
      continue;
    }
    if (key === 'focalLength')           base.focalLength = R.formatFocalLength(v);
    else if (key === 'fNumber')          base.fNumber = R.formatAperture(v);
    else if (key === 'exposureTime')     base.exposureTime = R.formatShutter(v);
    else if (key === 'iso')              base.iso = R.formatIso(v);
    else if (key === 'dateTimeOriginal') base.date = R.formatDate(v);
    else if (key === 'make')             base.make = R.formatBrand(v);
    else if (key === 'flash')            base.flashFired = (v === 'fired');
    else if (key === 'latitude' || key === 'longitude') {
      const n = Number(v);
      base[key] = isFinite(n) ? n : null;
      gpsTouched = true;
    }
    else                                  base[key] = v;
  }
  if (gpsTouched) base.gps = R.formatGps(base.latitude, base.longitude);
  return base;
}

function buildCurrentExif() {
  return buildExifForFile(state.files[state.activeIdx]);
}

// ─── Rail (thumbnail strip) ──────────────────────────────────────────────
function renderRail() {
  els.thumbRail.innerHTML = '';
  if (!state.files.length) {
    const empty = document.createElement('li');
    empty.className = 'rail-empty';
    empty.textContent = T('rail.empty');
    els.thumbRail.appendChild(empty);
  } else {
    state.files.forEach((f, i) => {
      const li = document.createElement('li');
      li.className = 'rail-item' + (i === state.activeIdx ? ' active' : '');
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', i === state.activeIdx);
      li.dataset.idx = i;
      li.innerHTML = `<span class="rail-idx">${pad2(i + 1)}</span><img alt="" src="${f.url}">`;
      li.onclick = () => selectFile(i);
      els.thumbRail.appendChild(li);
    });
    const active = els.thumbRail.querySelector('.rail-item.active');
    if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  els.railCount.textContent = pad2(state.files.length);
  els.countTotal.textContent = pad2(state.files.length);
  els.countCurrent.textContent = pad2(Math.max(0, state.activeIdx + 1));
}

// ─── Client-side preview render ──────────────────────────────────────────
// Schedule via requestAnimationFrame so a burst of input events (slider
// drag firing at 100+ Hz) collapses to one render per frame — smoother
// feedback than the old fixed 40ms setTimeout, and never wastes work on
// frames the browser would skip anyway.
let renderRAF = 0;

async function doRender() {
  const active = state.files[state.activeIdx];
  if (!active || !state.logos) return;
  if (state.rendering) { state.pendingRender = true; return; }
  state.rendering = true;
  els.previewLoading.hidden = false;
  updateFrameBadge(active.cfg);
  try {
    const c = active.cfg;
    await CR.renderPreview(els.canvas, {
      file: active.file,
      partnerFiles: active.partnerFiles || [],
      cfg: {
        aspect: c.aspect,
        frame: c.frame,
        template: c.template,
        padding: c.padding,
        paddingTop: c.paddingTop,
        paddingRight: c.paddingRight,
        paddingBottom: c.paddingBottom,
        paddingLeft: c.paddingLeft,
        captionHeight: c.captionHeight,
        bgBlur: c.bgBlur,
        bgBrightness: c.bgBrightness,
        bgSaturation: c.bgSaturation,
        shadowBlur: c.shadowBlur,
        shadowOffsetY: c.shadowOffsetY,
        shadowOpacity: c.shadowOpacity,
        radiusOverride: c.radiusOverride,
        captionForceOverlay: c.captionForceOverlay,
        captionOverlayTextLift: c.captionOverlayTextLift,
        topTemplate: c.topTemplate,
        tornJitter: c.tornJitter,
        tornStep: c.tornStep,
        tornEdgeOpacity: c.tornEdgeOpacity,
        filmMfAge: c.filmMfAge,
        showFields: c.showFields,
        customLogo: c.customLogo,
        customBg: c.customBg,
        collage: c.collage,
        rotation: c.rotation || 0,
        crop: c.crop || null
      },
      normExif: buildCurrentExif(),
      logos: state.logos,
      fontFaceCss: state.fontFaceCss
    });
    els.empty.hidden = true;
  } catch (err) {
    console.error('[preview]', err);
    setStatus('status.previewFail', 'err', { msg: err.message });
  } finally {
    state.rendering = false;
    els.previewLoading.hidden = true;
    if (state.pendingRender) {
      state.pendingRender = false;
      requestRender();
    }
  }
}

function requestRender() {
  // LOOK chip's "modified" pulse is driven by diffing cfg against the last-
  // applied preset's baseline. Every render request implies a cfg mutation
  // (slider, frame switch, preset apply, photo switch); refresh the chip
  // here so the pulse keeps step with each user action — even when no photo
  // is loaded yet (then the early-return below skips the actual render but
  // we still want the chip's draft-cfg state to update).
  if (typeof syncLookValueDisplay === 'function') syncLookValueDisplay();
  if (state.activeIdx < 0 || !state.logos) return;
  if (renderRAF) return;
  renderRAF = requestAnimationFrame(() => { renderRAF = 0; doRender(); });
}

// Reflect a per-photo cfg into all the DOM controls. Called whenever the
// active photo changes (or apply-to-all rewrites the active photo's EXIF).
function syncControlsFromCfg(cfg) {
  // Guard against a cfg carrying a retired frame name that slipped past the
  // applyPresetToCfg migration path (e.g. a future session where someone
  // hand-edits localStorage). resolveFrame's alias table covers rendering,
  // but the UI sync touches R.FRAMES[cfg.frame] directly below, which would
  // throw on an unknown key. Migrate in place here too.
  const aliases = R.FRAME_ALIASES || {};
  if (cfg.frame && !R.FRAMES[cfg.frame] && aliases[cfg.frame]) {
    cfg.frame = aliases[cfg.frame];
  }
  if (cfg.frame && !R.FRAMES[cfg.frame]) cfg.frame = DEFAULT_FRAME;
  syncAspectSeg(cfg.aspect);
  setSegActive(els.frameSeg, cfg.frame);
  syncFamilyFromValue(els.frameFamilySeg, els.frameSeg, cfg.frame);
  setSegActive(els.templateSeg, cfg.template);
  syncFamilyFromValue(els.templateFamilySeg, els.templateSeg, cfg.template);
  refreshTemplateCompatHint();
  els.padding.value = cfg.padding;
  setReadoutNum(els.paddingVal, cfg.padding, 'px');
  if (cfg.captionHeight != null) {
    els.captionH.value = cfg.captionHeight;
    setReadoutNum(els.captionHVal, cfg.captionHeight, 'px');
  } else {
    els.captionHVal.textContent = T('frame.captionAuto');
  }
  // Radius slider mirrors current effective value but readout flags
  // "preset" when cfg.radiusOverride is null (frame default). Slider's
  // displayed position uses frame override OR aspect base radius (36).
  const frameDef = R.FRAMES[cfg.frame];
  const baseRadius = (frameDef.layout && frameDef.layout.radiusOverride != null)
    ? frameDef.layout.radiusOverride : 36;
  els.radius.value = cfg.radiusOverride != null ? cfg.radiusOverride : baseRadius;
  if (cfg.radiusOverride != null) setReadoutNum(els.radiusVal, cfg.radiusOverride, 'px');
  else els.radiusVal.textContent = T('frame.defaultReadout');
  els.captionOverlayToggle.checked = !!cfg.captionForceOverlay;
  // Caption overlay text-lift slider is only meaningful with forceOverlay on;
  // hide the row when overlay is off so the UI doesn't dangle a control that
  // has no visible effect.
  if (els.captionOverlayLiftRow) {
    els.captionOverlayLiftRow.hidden = !cfg.captionForceOverlay;
    const lift = Number(cfg.captionOverlayTextLift) || 0;
    if (els.captionOverlayLift) els.captionOverlayLift.value = lift;
    if (els.captionOverlayLiftVal) setReadoutNum(els.captionOverlayLiftVal, lift, 'px');
  }
  if (els.topTemplateSeg) setSegActive(els.topTemplateSeg, cfg.topTemplate || 'none');
  const frame = R.FRAMES[cfg.frame];
  if (frame.bg.type === 'frosted') {
    els.bgBlur.value = cfg.bgBlur != null ? cfg.bgBlur : frame.bg.blurSigma;
    els.bgBrightness.value = cfg.bgBrightness != null ? cfg.bgBrightness : frame.bg.brightness;
    els.bgSaturation.value = cfg.bgSaturation != null ? cfg.bgSaturation : frame.bg.saturation;
    if (cfg.bgBlur != null) setReadoutNum(els.bgBlurVal, cfg.bgBlur, 'px');
    else els.bgBlurVal.textContent = T('frame.defaultReadout');
    els.bgBrightnessVal.textContent = cfg.bgBrightness != null ? Number(cfg.bgBrightness).toFixed(2) : T('frame.defaultReadout');
    els.bgSaturationVal.textContent = cfg.bgSaturation != null ? Number(cfg.bgSaturation).toFixed(2) : T('frame.defaultReadout');
  }
  els.frostedAdvanced.hidden = frame.bg.type !== 'frosted';
  if (els.frostedAdvanced.open && frame.bg.type !== 'frosted') els.frostedAdvanced.open = false;
  // Torn-paper advanced — only relevant for the `torn` frame. Slider
  // positions reflect cfg overrides when set, otherwise the frame default;
  // readout shows "preset" until the user explicitly drags.
  if (cfg.frame === 'torn' && els.tornAdvanced) {
    const td = (frame.torn) || { jitter: 6, step: 7, edgeOpacity: 0.22 };
    els.tornJitter.value = cfg.tornJitter != null ? cfg.tornJitter : td.jitter;
    els.tornStep.value = cfg.tornStep != null ? cfg.tornStep : td.step;
    els.tornEdgeOpacity.value = cfg.tornEdgeOpacity != null ? cfg.tornEdgeOpacity : td.edgeOpacity;
    els.tornJitterVal.textContent = cfg.tornJitter != null ? Number(cfg.tornJitter).toFixed(1) + 'px' : T('frame.defaultReadout');
    els.tornStepVal.textContent = cfg.tornStep != null ? Number(cfg.tornStep).toFixed(1) + 'px' : T('frame.defaultReadout');
    els.tornEdgeOpacityVal.textContent = cfg.tornEdgeOpacity != null ? Number(cfg.tornEdgeOpacity).toFixed(2) : T('frame.defaultReadout');
  }
  if (els.tornAdvanced) {
    els.tornAdvanced.hidden = cfg.frame !== 'torn';
    if (els.tornAdvanced.open && cfg.frame !== 'torn') els.tornAdvanced.open = false;
  }
  // Film-mf vintage-aging panel — sister of torn-advanced, gated on
  // frame === 'film-mf'. Slider position reflects cfg override; readout
  // shows "preset" when null.
  if (cfg.frame === 'film-mf' && els.filmMfAdvanced) {
    const fmd = (frame.filmMf) || { age: 1.0 };
    els.filmMfAge.value = cfg.filmMfAge != null ? cfg.filmMfAge : fmd.age;
    els.filmMfAgeVal.textContent = cfg.filmMfAge != null
      ? Math.round(Number(cfg.filmMfAge) * 100) + '%'
      : T('frame.defaultReadout');
  }
  if (els.filmMfAdvanced) {
    els.filmMfAdvanced.hidden = cfg.frame !== 'film-mf';
    if (els.filmMfAdvanced.open && cfg.frame !== 'film-mf') els.filmMfAdvanced.open = false;
  }
  els.shadowBlur.value = cfg.shadowBlur;
  els.shadowOffset.value = cfg.shadowOffsetY;
  els.shadowOpacity.value = cfg.shadowOpacity;
  setReadoutNum(els.shadowBlurVal, cfg.shadowBlur, 'px');
  setReadoutNum(els.shadowOffsetVal, cfg.shadowOffsetY, 'px');
  els.shadowOpacityVal.textContent = Number(cfg.shadowOpacity).toFixed(2);
  els.showFields.querySelectorAll('input[type=checkbox]').forEach((cb) => {
    cb.checked = !!cfg.showFields[cb.dataset.key];
  });
  syncSignatureFromCfg(cfg);
  syncCollageFromActive();
  syncRotateFromCfg(cfg);
  syncCustomBgFromCfg(cfg);
  // Repaint the lookbar chips (frame swatch / value text) — wireToolbarShell
  // exposes the sync helper on window and is loaded after this function.
  if (window.PhotoToolsShell) window.PhotoToolsShell.syncLookchips();
}

function syncCustomBgFromCfg(cfg) {
  const cb = cfg.customBg;
  const has = !!(cb && cb.data);
  els.customBgReadout.hidden = !has;
  els.customBgPreview.src = has ? cb.data : '';
  els.customBgName.textContent = has ? (cb.name || 'image') : '—';
}

// Update only the readouts (modal angle text + B · Frame geometry hint)
// from the active rotation/crop. Used when the slider is itself the source
// of the change — writing back to slider.value mid-drag can snap the
// thumb between +180 and -180 (geometrically equivalent but visually
// jarring).
function syncRotationReadouts(cfg) {
  const r = ((Number(cfg.rotation) || 0) % 360 + 360) % 360;
  const sliderV = r > 180 ? r - 360 : r;
  if (els.cropAngleVal) els.cropAngleVal.textContent = sliderV.toFixed(1) + '°';
  if (els.geometryReadout) {
    const parts = [];
    if (Math.abs(sliderV) >= 0.05) parts.push('<em>' + sliderV.toFixed(1) + '°</em>');
    if (cfg.crop) parts.push(T('frame.geometryCropped'));
    els.geometryReadout.innerHTML = parts.length ? parts.join(' · ') : T('frame.geometryClean');
  }
}

function syncRotateFromCfg(cfg) {
  // Full sync: slider position + readouts. Used when source ≠ slider
  // (modal open, photo switch, ↶ ↷ click, reset click).
  const r = ((Number(cfg.rotation) || 0) % 360 + 360) % 360;
  const sliderV = r > 180 ? r - 360 : r;
  if (els.cropAngle) els.cropAngle.value = String(sliderV);
  syncRotationReadouts(cfg);
}

// Floating canvas badge: a discreet pill hovering top-left of the
// preview canvas, showing live frame swatch + frame name (Fraunces
// italic) · template name + rotation when non-zero. Hidden when no
// photo loaded so the empty state stays uncluttered.
function updateFrameBadge(cfg) {
  if (!cfg || state.activeIdx < 0) {
    els.canvasFrameBadge.hidden = true;
    return;
  }
  const frameKey = cfg.frame || 'frosted-noir';
  const tplKey = cfg.template || 'minimal-text';
  const frameLabel = T('frame.styles.' + frameKey) || frameKey;
  const tplLabel = T('caption.templates.' + tplKey) || tplKey;
  els.canvasBadgeFrame.textContent = frameLabel;
  els.canvasBadgeTemplate.textContent = tplLabel;
  const swatch = document.getElementById('canvas-badge-swatch');
  if (swatch) swatch.setAttribute('data-frame', frameKey);
  const r = ((Number(cfg.rotation) || 0) % 360 + 360) % 360;
  // Show rotation only when meaningful — sub-0.05° values come from slider
  // float drift after a "reset to 0" click and shouldn't surface.
  const visible = Math.abs(r) >= 0.05 && Math.abs(r - 360) >= 0.05;
  els.canvasBadgeRot.hidden = !visible;
  if (visible) {
    const display = r > 180 ? r - 360 : r;
    // Whole-degree values render without a decimal; otherwise 1 decimal place.
    els.canvasBadgeRotVal.textContent = (Math.abs(display - Math.round(display)) < 0.05)
      ? Math.round(display) + '°'
      : display.toFixed(1) + '°';
  }
  els.canvasFrameBadge.hidden = false;
}

// Layout → number of partner photos required.
const COLLAGE_PARTNERS = { h2: 1, v2: 1, h3: 2, v3: 2, '2x2': 3 };

function syncCollageFromActive() {
  const cfg = activeCfg();
  const active = state.files[state.activeIdx];
  const layout = (cfg.collage && cfg.collage.layout) || 'off';
  els.collageLayout.value = COLLAGE_PARTNERS[layout] ? layout : 'off';
  renderCollageSlots(layout, active);
}

// Render N-1 file slots for the active layout. Each slot owns a hidden file
// input + a label/readout swap so that when a slot is empty we show the
// upload affordance and when populated we show the filename + a remove
// button. Re-rendered on layout change and on selectFile so the slots
// always reflect the active entry's partnerFiles[].
function renderCollageSlots(layout, active) {
  els.collageSlots.innerHTML = '';
  const N = COLLAGE_PARTNERS[layout] || 0;
  if (!N) return;
  if (active && !Array.isArray(active.partnerFiles)) active.partnerFiles = [];
  for (let i = 0; i < N; i++) {
    const file = active && active.partnerFiles ? active.partnerFiles[i] : null;
    if (file) {
      const row = document.createElement('div');
      row.className = 'collage-readout';
      const name = document.createElement('span');
      name.className = 'collage-name';
      name.textContent = `#${i + 2}  ${file.name}`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-ghost';
      btn.textContent = T('collage.clear');
      btn.addEventListener('click', () => {
        if (active && active.partnerFiles) active.partnerFiles[i] = null;
        renderCollageSlots(layout, active);
        requestRender();
      });
      row.appendChild(name);
      row.appendChild(btn);
      els.collageSlots.appendChild(row);
    } else {
      const label = document.createElement('label');
      label.className = 'file-drop collage-drop';
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/heic,image/heif,.heic,.heif';
      input.addEventListener('change', async () => {
        const f = input.files && input.files[0];
        input.value = '';
        if (!f || !active) return;
        try {
          let partner = f;
          if (window.HeicTools && window.HeicTools.isHeic(f)) {
            partner = await window.HeicTools.transcode(f);
          }
          if (!Array.isArray(active.partnerFiles)) active.partnerFiles = [];
          active.partnerFiles[i] = partner;
          renderCollageSlots(layout, active);
          requestRender();
          setStatus('status.collagePartnerSet', null, { n: i + 2, name: partner.name });
          setTimeout(() => setStatus('status.ready'), 1500);
        } catch (err) {
          console.error('[collage]', err);
          setStatus('status.collagePartnerFail', 'err', { msg: err.message });
        }
      });
      const inner = document.createElement('div');
      inner.className = 'file-drop-inner';
      inner.innerHTML = `
        <div class="file-drop-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18"><path d="M4 6h7v12H4zM13 6h7v12h-7z" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"/></svg>
        </div>
        <div class="file-drop-copy">
          <strong>${T('collage.choose', { n: i + 2 })}</strong>
          <span class="file-drop-hint-desktop">JPEG / PNG / HEIC</span>
        </div>`;
      label.appendChild(input);
      label.appendChild(inner);
      els.collageSlots.appendChild(label);
    }
  }
}

// Resolve the active anchor letter ('br' / 'tl' / etc.) regardless of
// whether cfg.customLogo.position is the legacy string form or the new
// { anchor, dx, dy } object. Single source of truth so UI sync and
// migration stay in lockstep.
function customLogoAnchor(cl) {
  if (!cl) return 'br';
  const pos = cl.position;
  if (typeof pos === 'string') return pos;
  if (pos && typeof pos === 'object' && pos.anchor) return pos.anchor;
  return 'br';
}

function setPosGridActive(grid, anchor) {
  grid.querySelectorAll('button').forEach((b) => {
    const on = b.dataset.anchor === anchor;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
}

function syncSignatureFromCfg(cfg) {
  const cl = cfg.customLogo;
  const has = !!(cl && cl.data);
  els.signaturePreview.hidden = !has;
  els.signaturePreviewImg.src = has ? cl.data : '';
  setPosGridActive(els.signaturePosGrid, has ? customLogoAnchor(cl) : 'br');
  const scalePct = Math.round((has ? (cl.scale != null ? cl.scale : 0.06) : 0.06) * 100);
  const opacity = has ? (cl.opacity != null ? cl.opacity : 1) : 1;
  els.signatureScale.value = scalePct;
  setReadoutNum(els.signatureScaleVal, scalePct, '%');
  els.signatureOpacity.value = opacity;
  setReadoutNum(els.signatureOpacityVal, Math.round(opacity * 100), '%');
  els.signaturePosGrid.querySelectorAll('button').forEach((b) => { b.disabled = !has; });
  els.signatureScale.disabled = !has;
  els.signatureOpacity.disabled = !has;
}

// Migrate persisted customLogo schemas to the current shape:
//   v0 (legacy): { data, type, position: 'br'|'bl'|'bc', scale, opacity }
//   v1 (now):    { data, type, position: { anchor, dx, dy }, scale, opacity }
// Run at every persistence boundary (localStorage load, preset apply,
// share-code decode) so future code paths only see the new shape.
// `customLogoRect` itself still tolerates both for safety, but this
// function is what gradually upgrades the user's stored data.
function migrateCustomLogo(cl) {
  if (!cl || typeof cl !== 'object') return cl;
  const out = { ...cl };
  if (typeof out.position === 'string') {
    out.position = { anchor: out.position, dx: 0, dy: 0 };
  } else if (!out.position || typeof out.position !== 'object') {
    out.position = { anchor: 'br', dx: 0, dy: 0 };
  } else {
    out.position = {
      anchor: out.position.anchor || 'br',
      dx: Number(out.position.dx) || 0,
      dy: Number(out.position.dy) || 0
    };
  }
  return out;
}

function setSegActive(seg, val) {
  seg.querySelectorAll('button').forEach((b) => {
    const on = b.dataset.val === val;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
}

// Two-tier seg picker (family tabs + variant chips). Family clicks
// reveal that family's variants and auto-select the first one if the
// current value isn't in the new family. Variant clicks call wireSeg's
// existing behavior + we sync the family tab to match the picked
// variant's data-family.
//
// Used for both the frame picker (B · Frame) and the caption template
// picker (C · Caption) — the two largest seg controls in the sidebar.
// Keeps each chip ~3× wider than a flat 9-button seg, recovering full
// labels on mobile.
function setFamilyActive(familySeg, family) {
  familySeg.querySelectorAll('button').forEach((b) => {
    const on = b.dataset.family === family;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
}
function showFamilyVariants(variantSeg, family) {
  variantSeg.querySelectorAll('button').forEach((b) => {
    b.hidden = b.dataset.family !== family;
  });
}
function syncFamilyFromValue(familySeg, variantSeg, value) {
  const btn = variantSeg.querySelector('button[data-val="' + value + '"]');
  const family = btn ? btn.dataset.family : familySeg.querySelector('button')?.dataset.family;
  if (!family) return;
  setFamilyActive(familySeg, family);
  showFamilyVariants(variantSeg, family);
}
function wireFamilyTabs(familySeg, variantSeg, onPick) {
  familySeg.querySelectorAll('button').forEach((tab) => {
    tab.addEventListener('click', () => {
      const family = tab.dataset.family;
      setFamilyActive(familySeg, family);
      showFamilyVariants(variantSeg, family);
      // If the currently-active variant is in a different family, jump
      // to the first variant of the newly-selected family — picking a
      // family is a real commit, not just a filter.
      const activeVariant = variantSeg.querySelector('button.active');
      if (!activeVariant || activeVariant.dataset.family !== family) {
        const first = variantSeg.querySelector('button[data-family="' + family + '"]');
        if (first && onPick) {
          setSegActive(variantSeg, first.dataset.val);
          onPick(first.dataset.val);
        }
      }
    });
  });
}

// ─── File selection ──────────────────────────────────────────────────────
async function selectFile(idx) {
  state.activeIdx = idx;
  renderRail();
  document.dispatchEvent(new CustomEvent('phototools:photo-switched'));
  const f = state.files[idx];
  if (!f) return;
  syncControlsFromCfg(f.cfg);
  if (!f.normalized) {
    try {
      setStatus('status.readingExif', 'busy');
      // HEIC was already transcoded to JPEG; exifr can parse the original
      // HEIC's metadata directly, so feed it the source when present.
      const r = await uploadForExif(f.heicSource || f.file);
      f.normalized = r.normalized;
      f.rawExif = r.slim;
      populateExifInputs(f.normalized);
      applyOverrideToInputs(f.cfg.exifOverride);
      updateExifWarn(f.normalized);
      setStatus('status.ready');
    } catch (err) {
      f.normalized = {};
      updateExifWarn(null);
      setStatus('status.exifFail', 'err', { msg: err.message });
    }
  } else {
    populateExifInputs(f.normalized);
    applyOverrideToInputs(f.cfg.exifOverride);
    updateExifWarn(f.normalized);
  }
  els.exportBtn.disabled = false;
  els.batchBtn.disabled = state.files.length === 0;
  requestRender();
}

// Reset to the "no photo" state — used when removing the last file.
// Mirrors the visual state the app boots into before any import.
function clearActivePreview() {
  state.activeIdx = -1;
  els.empty.hidden = false;
  const ctx = els.canvas.getContext('2d');
  ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
  els.exportBtn.disabled = true;
  els.batchBtn.disabled = true;
}

// Remove a single photo from the rail. Adjusts activeIdx to a sensible
// neighbor when the active photo is removed; revokes the entry's blob
// URL so the thumbnail bitmap can be GC'd. Used by the rail context
// menu (right-click on desktop, long-press on mobile).
function removeFile(idx) {
  if (idx < 0 || idx >= state.files.length) return;
  const wasActive = idx === state.activeIdx;
  const removed = state.files[idx];
  if (removed && removed.url) URL.revokeObjectURL(removed.url);
  state.files.splice(idx, 1);
  if (state.files.length === 0) {
    clearActivePreview();
    renderRail();
    return;
  }
  if (wasActive) {
    selectFile(Math.min(idx, state.files.length - 1));
  } else if (idx < state.activeIdx) {
    state.activeIdx -= 1;
    renderRail();
  } else {
    renderRail();
  }
}

// Newly imported files inherit the active photo's full cfg (or the draft when
// no photos exist yet) — so users configure look once, then drag in photos.
// EXIF override is intentionally NOT inherited; each photo keeps its own
// auto-parsed metadata + can be overridden individually.
async function mergeFiles(newFiles) {
  const existing = state.files.map((s) => s.file);
  const seen = new Set(existing.map((f) => f.name + ':' + f.size + ':' + f.lastModified));
  const merged = [...state.files];
  const seedCfg = activeCfg();
  const added = [];
  for (const file of newFiles) {
    const key = file.name + ':' + file.size + ':' + file.lastModified;
    if (seen.has(key)) continue;
    seen.add(key);
    const cfg = cloneCfg(seedCfg);
    cfg.exifOverride = {};
    // entry.heicSource (if set) keeps the original HEIC file around for
    // exifr — exifr can parse HEIC EXIF directly, but the bitmap pipeline
    // works on the transcoded JPEG (entry.file).
    const entry = { file, url: URL.createObjectURL(file), normalized: null, cfg, heicSource: null };
    added.push(entry);
  }

  // HEIC is decoded only via libheif-js — browsers don't natively decode it
  // in createImageBitmap. Transcode to JPEG up front so the rest of the
  // pipeline (preview, worker batch, EXIF rewrite) sees only standard formats.
  const heicCount = added.filter((e) => window.HeicTools && window.HeicTools.isHeic(e.file)).length;
  if (heicCount) {
    setStatus('status.heicDecoding', 'busy', { n: heicCount });
  }
  await Promise.all(added.map(async (entry) => {
    if (!window.HeicTools || !window.HeicTools.isHeic(entry.file)) return;
    try {
      const original = entry.file;
      const jpeg = await window.HeicTools.transcode(original);
      // Splice the source HEIC's EXIF into the transcoded JPEG so the
      // exported file preserves Make / Model / focal / aperture / shutter
      // / ISO / lens / date — without this step HEIC sources would lose
      // all metadata round-trip on export.
      const withExif = await window.ExifIO.injectExifFromHeic(original, jpeg);
      entry.heicSource = original;
      URL.revokeObjectURL(entry.url);
      entry.file = new File([withExif], jpeg.name, {
        type: 'image/jpeg',
        lastModified: original.lastModified || Date.now()
      });
      entry.url = URL.createObjectURL(entry.file);
    } catch (err) {
      entry._heicFail = err;
    }
  }));

  // Probe each new file via createImageBitmap before adding to state.files.
  // Truncated downloads and renamed non-image files all surface here.
  // Probing in parallel keeps it fast for big batches; failures are dropped
  // with a friendly localized error message reported via the status bar.
  const rejected = [];
  await Promise.all(added.map(async (entry) => {
    if (entry._heicFail) {
      rejected.push({ name: entry.file.name, reason: humanizeDecodeError(entry._heicFail, entry.file) });
      URL.revokeObjectURL(entry.url);
      entry._broken = true;
      return;
    }
    try {
      // loadBitmap will populate the bitmap cache so the subsequent preview
      // render reuses the decoded ImageBitmap rather than decoding again.
      await CR.loadBitmap(entry.file, 1440);
    } catch (err) {
      rejected.push({ name: entry.file.name, reason: humanizeDecodeError(err, entry.file) });
      URL.revokeObjectURL(entry.url);
      entry._broken = true;
    }
  }));

  for (const e of added) if (!e._broken) merged.push(e);
  state.files = merged;

  // Background EXIF parse for the survivors (best-effort).
  for (const entry of added) {
    if (entry._broken) continue;
    if (!entry.normalized) {
      const exifSource = entry.heicSource || entry.file;
      uploadForExif(exifSource).then((r) => { entry.normalized = r.normalized; entry.rawExif = r.slim; }).catch(() => {});
    }
  }

  if (rejected.length) {
    const msg = rejected.length === 1
      ? `${rejected[0].name}: ${rejected[0].reason}`
      : T('status.decodeFailMany', { n: rejected.length });
    setStatus(msg, 'err');
    if (rejected.length > 1) console.warn('[import] rejected files:', rejected);
    setTimeout(() => setStatus('status.ready'), 4000);
  }
  return { addedCount: added.length - rejected.length, rejected };
}

// Translate the various createImageBitmap failure modes into a single short
// Chinese label the user can act on. err.name is `InvalidStateError` /
// `NotFoundError` / `NotSupportedError` depending on the browser; we treat
// them all as "browser refused to decode".
function humanizeDecodeError(err, file) {
  const ext = (file.name.match(/\.([^.]+)$/) || ['',''])[1].toLowerCase();
  const mime = (file.type || '').toLowerCase();
  // HEIC arrives here only when libheif-js itself failed (corrupt bitstream,
  // wasm load error, etc.) — the import path transcodes successful HEICs to
  // JPEG before probing.
  if (ext === 'heic' || ext === 'heif' || mime.includes('heic') || mime.includes('heif')) {
    return T('status.decodeHeicFail');
  }
  if (mime && mime !== 'image/jpeg' && mime !== 'image/png') {
    return T('status.decodeUnsupported', { mime });
  }
  console.warn('[decode]', file.name, err);
  return T('status.decodeBroken');
}

els.fileInput.addEventListener('change', async () => {
  const files = Array.from(els.fileInput.files || []);
  if (!files.length) return;
  const prevLen = state.files.length;
  setStatus('status.reading', 'busy');
  await mergeFiles(files);
  renderRail();
  if (state.files.length > prevLen) await selectFile(prevLen);
  els.fileInput.value = '';
});

// ─── Segmented controls ──────────────────────────────────────────────────
// All event handlers write through to `activeCfg()` — that's either the active
// file's cfg, or the draft cfg used before any photo is loaded.
function wireSeg(seg, key, onChange) {
  seg.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      setSegActive(seg, btn.dataset.val);
      activeCfg()[key] = btn.dataset.val;
      if (onChange) onChange(btn.dataset.val);
      requestRender();
    });
  });
}
// Aspect picker — like wireSeg, but the trailing "Custom" button opens a
// dialog instead of writing its data-val into cfg, and the active-state sync
// has to fall through to the custom button when cfg.aspect is a free-form
// W:H token (e.g. "3:2") that none of the preset buttons match.
const ASPECT_CUSTOM_LS = 'phototools.aspectCustom';
function syncAspectSeg(aspect) {
  let matched = false;
  els.aspectSeg.querySelectorAll('button').forEach((b) => {
    if (b.dataset.val === 'custom') return;
    const on = b.dataset.val === aspect;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
    if (on) matched = true;
  });
  if (els.aspectCustomBtn) {
    const customActive = !matched;
    els.aspectCustomBtn.classList.toggle('active', customActive);
    els.aspectCustomBtn.setAttribute('aria-checked', customActive ? 'true' : 'false');
    if (els.aspectCustomLabel) {
      els.aspectCustomLabel.textContent = customActive ? aspect : (T('frame.aspectCustom') || '⋯');
    }
  }
}
els.aspectSeg.querySelectorAll('button').forEach((btn) => {
  if (btn.dataset.val === 'custom') {
    btn.addEventListener('click', () => openAspectModal());
  } else {
    btn.addEventListener('click', () => {
      activeCfg().aspect = btn.dataset.val;
      syncAspectSeg(btn.dataset.val);
      requestRender();
    });
  }
});

function openAspectModal() {
  const dlg = els.aspectModal;
  if (!dlg) return;
  // Pre-fill: if current aspect is a custom W:H, reuse it; else fall back to
  // the last saved custom value, then a hard default of 3:2.
  const cur = activeCfg().aspect;
  const curParsed = R.parseAspectRatio(cur);
  let initW = 3, initH = 2;
  if (curParsed && !R.BASE_PRESETS[cur]) {
    initW = curParsed.w; initH = curParsed.h;
  } else {
    try {
      const saved = JSON.parse(localStorage.getItem(ASPECT_CUSTOM_LS) || 'null');
      if (saved && saved.w > 0 && saved.h > 0) { initW = saved.w; initH = saved.h; }
    } catch (_) {}
  }
  els.aspectW.value = String(initW);
  els.aspectH.value = String(initH);
  els.aspectError.hidden = true;
  if (typeof dlg.showModal === 'function') dlg.showModal();
  else dlg.setAttribute('open', '');
  setTimeout(() => els.aspectW && els.aspectW.select(), 30);
}
function closeAspectModal() {
  const dlg = els.aspectModal;
  if (!dlg) return;
  if (typeof dlg.close === 'function') dlg.close();
  else dlg.removeAttribute('open');
}
function applyAspectModal() {
  const w = Number(els.aspectW.value);
  const h = Number(els.aspectH.value);
  if (!(w > 0) || !(h > 0)) {
    els.aspectError.textContent = T('frame.aspectCustomError');
    els.aspectError.hidden = false;
    return;
  }
  // Round to 2 decimals so "2.353" stops echoing forever and the seg label
  // stays readable. Anything inside [0.1, 10] passes the resolver's gate.
  const wR = Math.round(w * 100) / 100;
  const hR = Math.round(h * 100) / 100;
  const token = wR + ':' + hR;
  if (!R.parseAspectRatio(token)) {
    els.aspectError.textContent = T('frame.aspectCustomError');
    els.aspectError.hidden = false;
    return;
  }
  activeCfg().aspect = token;
  try { localStorage.setItem(ASPECT_CUSTOM_LS, JSON.stringify({ w: wR, h: hR })); } catch (_) {}
  syncAspectSeg(token);
  closeAspectModal();
  requestRender();
}
if (els.aspectApply) els.aspectApply.addEventListener('click', applyAspectModal);
if (els.aspectCancel) els.aspectCancel.addEventListener('click', closeAspectModal);
if (els.aspectClose) els.aspectClose.addEventListener('click', closeAspectModal);
[els.aspectW, els.aspectH].forEach((inp) => {
  if (!inp) return;
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); applyAspectModal(); }
  });
  inp.addEventListener('input', () => { els.aspectError.hidden = true; });
});
els.aspectPresets.forEach((btn) => {
  btn.addEventListener('click', () => {
    els.aspectW.value = btn.dataset.w;
    els.aspectH.value = btn.dataset.h;
    els.aspectError.hidden = true;
  });
});

wireSeg(els.frameSeg, 'frame', (val) => { syncFamilyFromValue(els.frameFamilySeg, els.frameSeg, val); onFrameChange(val); });
wireSeg(els.templateSeg, 'template', (val) => { syncFamilyFromValue(els.templateFamilySeg, els.templateSeg, val); refreshTemplateCompatHint(); });
wireFamilyTabs(els.frameFamilySeg, els.frameSeg, (val) => { activeCfg().frame = val; onFrameChange(val); requestRender(); });
wireFamilyTabs(els.templateFamilySeg, els.templateSeg, (val) => { activeCfg().template = val; refreshTemplateCompatHint(); requestRender(); });

// ─── bg/shadow sync ──────────────────────────────────────────────────────
// Frame switch resets bg overrides to "use preset" (null) and shadow sliders
// Frame×template combos that render poorly. Soft hint, not a hard
// disable — some users may want the combo anyway. Two failure modes:
//   - 'narrow': frames with a narrow bottom caption strip (instant
//     family) cramming a multi-row spec template
//   - 'rotated': frames where caption rotates ±90° (editorial family)
//     trying to use a horizontally-laid spec template
const TEMPLATE_INCOMPAT = {
  instax: { slate: 'narrow',  'tech-stack': 'narrow'  },
  torn:   { slate: 'narrow',  'tech-stack': 'narrow'  }
};

function refreshTemplateCompatHint() {
  const cfg = activeCfg();
  const map = TEMPLATE_INCOMPAT[cfg.frame];
  const key = map && map[cfg.template];
  const el = document.getElementById('template-compat-hint');
  const text = document.getElementById('template-compat-hint-text');
  if (!el || !text) return;
  if (key) {
    text.textContent = T('caption.compat.' + key);
    el.hidden = false;
  } else {
    el.hidden = true;
  }
}

// `onFrameChange` resets bgBlur/brightness/saturation to "use preset" and
// to that frame's shadowDefault on the active cfg. Also toggles the frosted-
// only Advanced panel. Only affects the current photo (per-photo cfg).
function onFrameChange(frameName) {
  const cfg = activeCfg();
  const frame = R.FRAMES[frameName];
  cfg.bgBlur = null;
  cfg.bgBrightness = null;
  cfg.bgSaturation = null;
  // Per-edge padding overrides reset on frame switch — film-35's sprocket
  // boost should kick in on switch even if previous frame had paddingTop:0.
  cfg.paddingTop = null;
  cfg.paddingRight = null;
  cfg.paddingBottom = null;
  cfg.paddingLeft = null;
  els.bgBlurVal.textContent = T('frame.defaultReadout');
  els.bgBrightnessVal.textContent = T('frame.defaultReadout');
  els.bgSaturationVal.textContent = T('frame.defaultReadout');
  if (frame.bg.type === 'frosted') {
    els.bgBlur.value = frame.bg.blurSigma;
    els.bgBrightness.value = frame.bg.brightness;
    els.bgSaturation.value = frame.bg.saturation;
  }
  els.frostedAdvanced.hidden = frame.bg.type !== 'frosted';
  if (els.frostedAdvanced.open && frame.bg.type !== 'frosted') els.frostedAdvanced.open = false;
  // Reset torn knobs to the frame default whenever the frame switches —
  // matches the bg/shadow/radius reset semantic. When switching INTO torn
  // for the first time, the slider positions snap to the frame's defaults
  // (no user override yet); when switching AWAY from torn the panel hides.
  cfg.tornJitter = null;
  cfg.tornStep = null;
  cfg.tornEdgeOpacity = null;
  if (els.tornAdvanced) {
    const td = frame.torn || { jitter: 6, step: 7, edgeOpacity: 0.22 };
    els.tornJitter.value = td.jitter;
    els.tornStep.value = td.step;
    els.tornEdgeOpacity.value = td.edgeOpacity;
    els.tornJitterVal.textContent = T('frame.defaultReadout');
    els.tornStepVal.textContent = T('frame.defaultReadout');
    els.tornEdgeOpacityVal.textContent = T('frame.defaultReadout');
    els.tornAdvanced.hidden = frameName !== 'torn';
    if (els.tornAdvanced.open && frameName !== 'torn') els.tornAdvanced.open = false;
  }
  // Film-mf vintage-aging — same reset semantic.
  cfg.filmMfAge = null;
  if (els.filmMfAdvanced) {
    const fmd = frame.filmMf || { age: 1.0 };
    els.filmMfAge.value = fmd.age;
    els.filmMfAgeVal.textContent = T('frame.defaultReadout');
    els.filmMfAdvanced.hidden = frameName !== 'film-mf';
    if (els.filmMfAdvanced.open && frameName !== 'film-mf') els.filmMfAdvanced.open = false;
  }

  const sd = frame.shadowDefault;
  cfg.shadowBlur = sd.blur;
  cfg.shadowOffsetY = sd.offsetY;
  cfg.shadowOpacity = sd.opacity;
  els.shadowBlur.value = sd.blur;
  els.shadowOffset.value = sd.offsetY;
  els.shadowOpacity.value = sd.opacity;
  setReadoutNum(els.shadowBlurVal, sd.blur, 'px');
  setReadoutNum(els.shadowOffsetVal, sd.offsetY, 'px');
  els.shadowOpacityVal.textContent = sd.opacity.toFixed(2);
  // Radius + overlay toggle: same "reset to frame default" rule as the
  // shadow / bg knobs. Frame switch is the natural moment to start fresh —
  // a 35mm-authentic radius=0 shouldn't bleed into the next frame.
  cfg.radiusOverride = null;
  cfg.captionForceOverlay = false;
  cfg.captionOverlayTextLift = 0;
  cfg.topTemplate = 'none';
  const baseRadius = (frame.layout && frame.layout.radiusOverride != null) ? frame.layout.radiusOverride : 36;
  els.radius.value = baseRadius;
  els.radiusVal.textContent = T('frame.defaultReadout');
  els.captionOverlayToggle.checked = false;
  if (els.captionOverlayLiftRow) els.captionOverlayLiftRow.hidden = true;
  if (els.captionOverlayLift)    els.captionOverlayLift.value = 0;
  if (els.captionOverlayLiftVal) setReadoutNum(els.captionOverlayLiftVal, 0, 'px');
  if (els.topTemplateSeg)        setSegActive(els.topTemplateSeg, 'none');
  refreshTemplateCompatHint();
}

els.bgBlur.addEventListener('input', () => {
  const v = Number(els.bgBlur.value);
  activeCfg().bgBlur = v;
  setReadoutNum(els.bgBlurVal, v, 'px');
  requestRender();
});
els.bgBrightness.addEventListener('input', () => {
  const v = Number(els.bgBrightness.value);
  activeCfg().bgBrightness = v;
  els.bgBrightnessVal.textContent = v.toFixed(2);
  requestRender();
});
els.bgSaturation.addEventListener('input', () => {
  const v = Number(els.bgSaturation.value);
  activeCfg().bgSaturation = v;
  els.bgSaturationVal.textContent = v.toFixed(2);
  requestRender();
});
els.resetBgBtn.addEventListener('click', () => {
  // Replays frame-switch logic on the active cfg without changing frame.
  onFrameChange(activeCfg().frame);
  requestRender();
});

// Torn-paper sliders — drag captures cfg override; double-click readout
// reverts that one slider back to the frame default ("preset"). Reset
// button blanks all three.
if (els.tornJitter) els.tornJitter.addEventListener('input', () => {
  const v = Number(els.tornJitter.value);
  activeCfg().tornJitter = v;
  els.tornJitterVal.textContent = v.toFixed(1) + 'px';
  requestRender();
});
if (els.tornStep) els.tornStep.addEventListener('input', () => {
  const v = Number(els.tornStep.value);
  activeCfg().tornStep = v;
  els.tornStepVal.textContent = v.toFixed(1) + 'px';
  requestRender();
});
if (els.tornEdgeOpacity) els.tornEdgeOpacity.addEventListener('input', () => {
  const v = Number(els.tornEdgeOpacity.value);
  activeCfg().tornEdgeOpacity = v;
  els.tornEdgeOpacityVal.textContent = v.toFixed(2);
  requestRender();
});

// Film-mf vintage-aging slider — single 0..1 knob scaling all of the
// frame's aging effects (sepia / fade / vignette / foxing). Readout shows
// percentage so users can talk about it in human terms ("dial down to
// 50%"). Reset button blanks back to null = use frame default.
if (els.filmMfAge) els.filmMfAge.addEventListener('input', () => {
  const v = Number(els.filmMfAge.value);
  activeCfg().filmMfAge = v;
  els.filmMfAgeVal.textContent = Math.round(v * 100) + '%';
  requestRender();
});
if (els.resetFilmMfBtn) els.resetFilmMfBtn.addEventListener('click', () => {
  onFrameChange(activeCfg().frame);
  requestRender();
});
if (els.filmMfAgeVal) els.filmMfAgeVal.addEventListener('dblclick', () => {
  activeCfg().filmMfAge = null;
  els.filmMfAgeVal.textContent = T('frame.defaultReadout');
  const fr = R.FRAMES[activeCfg().frame];
  const fmd = (fr && fr.filmMf) || { age: 1.0 };
  els.filmMfAge.value = fmd.age;
  requestRender();
});
function makeTornReadoutResetter(valueEl, sliderEl, fieldKey, frameDefaultGetter) {
  if (!valueEl) return;
  valueEl.addEventListener('dblclick', () => {
    activeCfg()[fieldKey] = null;
    valueEl.textContent = T('frame.defaultReadout');
    const frame = R.FRAMES[activeCfg().frame];
    sliderEl.value = frameDefaultGetter(frame);
    requestRender();
  });
}
makeTornReadoutResetter(els.tornJitterVal, els.tornJitter, 'tornJitter', (f) => (f.torn || {}).jitter || 6);
makeTornReadoutResetter(els.tornStepVal, els.tornStep, 'tornStep', (f) => (f.torn || {}).step || 7);
makeTornReadoutResetter(els.tornEdgeOpacityVal, els.tornEdgeOpacity, 'tornEdgeOpacity', (f) => (f.torn || {}).edgeOpacity != null ? (f.torn || {}).edgeOpacity : 0.22);
if (els.resetTornBtn) els.resetTornBtn.addEventListener('click', () => {
  // Replays frame-switch logic on the active cfg without actually changing
  // frame — onFrameChange already handles the torn reset path.
  onFrameChange(activeCfg().frame);
  requestRender();
});

els.shadowBlur.addEventListener('input', () => {
  const v = Number(els.shadowBlur.value);
  activeCfg().shadowBlur = v;
  setReadoutNum(els.shadowBlurVal, v, 'px');
  requestRender();
});
els.shadowOffset.addEventListener('input', () => {
  const v = Number(els.shadowOffset.value);
  activeCfg().shadowOffsetY = v;
  setReadoutNum(els.shadowOffsetVal, v, 'px');
  requestRender();
});
els.shadowOpacity.addEventListener('input', () => {
  const v = Number(els.shadowOpacity.value);
  activeCfg().shadowOpacity = v;
  els.shadowOpacityVal.textContent = v.toFixed(2);
  requestRender();
});

// Initialize UI to the draft cfg's frame defaults.
syncControlsFromCfg(state.draftCfg);

// Template picker is wired via wireSeg + wireFamilyTabs above (replaced
// the old <select> with a two-tier seg in C · Caption).
els.format.addEventListener('change',   () => { state.format = els.format.value; });
els.quality.addEventListener('change',  () => { state.quality = els.quality.value; });

els.padding.addEventListener('input', () => {
  const v = Number(els.padding.value);
  activeCfg().padding = v;
  setReadoutNum(els.paddingVal, v, 'px');
  requestRender();
});

// captionHeight: moving off the default position sets an explicit override;
// double-clicking the slider label resets to preset ("auto" readout).
els.captionH.addEventListener('input', () => {
  const v = Number(els.captionH.value);
  activeCfg().captionHeight = v;
  setReadoutNum(els.captionHVal, v, 'px');
  requestRender();
});
els.captionHVal.addEventListener('dblclick', () => {
  activeCfg().captionHeight = null;
  els.captionHVal.textContent = T('frame.captionAuto');
  requestRender();
});

// Corner radius — DIY override of frame default. Drag = explicit value;
// double-click readout to clear back to "preset" (uses frame's
// radiusOverride or aspect base).
els.radius.addEventListener('input', () => {
  const v = Number(els.radius.value);
  activeCfg().radiusOverride = v;
  setReadoutNum(els.radiusVal, v, 'px');
  requestRender();
});
els.radiusVal.addEventListener('dblclick', () => {
  activeCfg().radiusOverride = null;
  els.radiusVal.textContent = T('frame.defaultReadout');
  // Snap slider position to frame default for consistent visual feedback.
  const fd = R.FRAMES[activeCfg().frame];
  const base = (fd.layout && fd.layout.radiusOverride != null) ? fd.layout.radiusOverride : 36;
  els.radius.value = base;
  requestRender();
});

els.captionOverlayToggle.addEventListener('change', () => {
  activeCfg().captionForceOverlay = els.captionOverlayToggle.checked;
  // Show/hide the lift slider in lockstep — it only matters under forceOverlay.
  if (els.captionOverlayLiftRow) els.captionOverlayLiftRow.hidden = !els.captionOverlayToggle.checked;
  requestRender();
});

// Caption overlay text-lift slider — base-1440 px (0..120). 0 = legacy
// bottom-pinned text; higher values float text up inside the gradient.
if (els.captionOverlayLift) {
  els.captionOverlayLift.addEventListener('input', () => {
    const v = Math.max(0, Math.min(120, Number(els.captionOverlayLift.value) || 0));
    activeCfg().captionOverlayTextLift = v;
    if (els.captionOverlayLiftVal) setReadoutNum(els.captionOverlayLiftVal, v, 'px');
    requestRender();
  });
}

// Top-of-frame badge picker (cfg.topTemplate). 'none' | 'brand-model' |
// 'brand-only' | 'wordmark' — see shared/render.js → buildTopBadgeSvg.
if (els.topTemplateSeg) {
  wireSeg(els.topTemplateSeg, 'topTemplate', () => {});
}

els.showFields.querySelectorAll('input[type=checkbox]').forEach((cb) => {
  cb.checked = state.draftCfg.showFields[cb.dataset.key];
  cb.addEventListener('change', () => {
    activeCfg().showFields[cb.dataset.key] = cb.checked;
    requestRender();
  });
});

// ─── Signature (custom-logo) wiring ─────────────────────────────────────
// Upload propagates the new image to draftCfg + every loaded photo + localStorage.
// Per-photo position / size / opacity remain editable on the active cfg only.
const SIGNATURE_STORAGE_KEY = 'phototools.customLogo';
const SIGNATURE_MAX_BYTES = 2 * 1024 * 1024;

function readSignatureFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

// Many hand-authored SVGs ship with only a viewBox and no width/height attrs.
// Chrome's createImageBitmap rejects such blobs, which silently nukes the
// signature in batch export (the worker has no HTMLImageElement fallback).
// Patching the dataURL once at upload time is cheaper and more robust than
// guarding every decode site downstream.
function ensureSvgDimensions(dataURL) {
  if (!/^data:image\/svg/i.test(dataURL)) return dataURL;
  const comma = dataURL.indexOf(',');
  if (comma < 0) return dataURL;
  const meta = dataURL.slice(0, comma);
  const body = dataURL.slice(comma + 1);
  let svgText;
  try {
    svgText = /;base64/i.test(meta) ? atob(body) : decodeURIComponent(body);
  } catch (_) { return dataURL; }
  let doc;
  try { doc = new DOMParser().parseFromString(svgText, 'image/svg+xml'); }
  catch (_) { return dataURL; }
  const root = doc && doc.documentElement;
  if (!root || root.nodeName !== 'svg' || root.querySelector('parsererror')) return dataURL;
  const hasW = root.hasAttribute('width');
  const hasH = root.hasAttribute('height');
  if (hasW && hasH) return dataURL;
  const vb = root.getAttribute('viewBox');
  if (!vb) return dataURL;
  const parts = vb.trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((n) => !isFinite(n)) || parts[2] <= 0 || parts[3] <= 0) {
    return dataURL;
  }
  if (!hasW) root.setAttribute('width', String(parts[2]));
  if (!hasH) root.setAttribute('height', String(parts[3]));
  const out = new XMLSerializer().serializeToString(doc);
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(out);
}

function applyCustomLogoEverywhere(payload) {
  state.draftCfg.customLogo = payload ? { ...payload } : null;
  for (const f of state.files) {
    f.cfg.customLogo = payload ? { ...payload } : null;
  }
  try {
    if (payload) localStorage.setItem(SIGNATURE_STORAGE_KEY, JSON.stringify(payload));
    else localStorage.removeItem(SIGNATURE_STORAGE_KEY);
  } catch (_) { /* private mode / quota — non-fatal */ }
}

els.signatureInput.addEventListener('change', async () => {
  const file = els.signatureInput.files && els.signatureInput.files[0];
  els.signatureInput.value = '';
  if (!file) return;
  if (file.size > SIGNATURE_MAX_BYTES) {
    setStatus('status.signatureTooBig', 'err', { mb: (file.size / 1024 / 1024).toFixed(1) });
    setTimeout(() => setStatus('status.ready'), 3000);
    return;
  }
  try {
    const raw = await readSignatureFile(file);
    const data = ensureSvgDimensions(raw);
    const type = /^data:image\/svg/i.test(data) ? 'svg' : 'png';
    // Carry over the active photo's position/size/opacity if a signature was
    // already there — re-uploading should swap the image but keep the look.
    // New uploads always write the v1 schema (object position).
    const prev = activeCfg().customLogo;
    const prevPos = prev && prev.position;
    const positionObj = (prevPos && typeof prevPos === 'object' && prevPos.anchor)
      ? { anchor: prevPos.anchor, dx: Number(prevPos.dx) || 0, dy: Number(prevPos.dy) || 0 }
      : { anchor: (typeof prevPos === 'string' ? prevPos : 'br'), dx: 0, dy: 0 };
    const payload = {
      data: data,
      type: type,
      position: positionObj,
      scale:    prev && prev.scale != null ? prev.scale : 0.06,
      opacity:  prev && prev.opacity != null ? prev.opacity : 1
    };
    applyCustomLogoEverywhere(payload);
    syncSignatureFromCfg(activeCfg());
    requestRender();
    setStatus('status.signatureLoaded');
    setTimeout(() => setStatus('status.ready'), 1500);
  } catch (err) {
    console.error('[signature]', err);
    setStatus('status.signatureFail', 'err', { msg: err.message });
  }
});

els.signatureClearBtn.addEventListener('click', () => {
  applyCustomLogoEverywhere(null);
  syncSignatureFromCfg(activeCfg());
  requestRender();
});

els.signaturePosGrid.querySelectorAll('button').forEach((btn) => {
  btn.addEventListener('click', () => {
    const cfg = activeCfg();
    if (!cfg.customLogo) return;
    const anchor = btn.dataset.anchor;
    setPosGridActive(els.signaturePosGrid, anchor);
    // Always write the new schema (object). dx/dy preserved if the user
    // had custom offsets from a future microadjust UI; defaults to 0/0
    // for the legacy "just pick a corner" path.
    const prev = (cfg.customLogo.position && typeof cfg.customLogo.position === 'object')
      ? cfg.customLogo.position
      : { dx: 0, dy: 0 };
    cfg.customLogo = {
      ...cfg.customLogo,
      position: { anchor, dx: prev.dx || 0, dy: prev.dy || 0 }
    };
    requestRender();
  });
});

els.signatureScale.addEventListener('input', () => {
  const cfg = activeCfg();
  if (!cfg.customLogo) return;
  const pct = Number(els.signatureScale.value);
  cfg.customLogo = { ...cfg.customLogo, scale: pct / 100 };
  setReadoutNum(els.signatureScaleVal, pct, '%');
  requestRender();
});

els.signatureOpacity.addEventListener('input', () => {
  const cfg = activeCfg();
  if (!cfg.customLogo) return;
  const v = Number(els.signatureOpacity.value);
  cfg.customLogo = { ...cfg.customLogo, opacity: v };
  setReadoutNum(els.signatureOpacityVal, Math.round(v * 100), '%');
  requestRender();
});

// ─── Rotation wiring (lives inside the crop modal) ──────────────────────
// Rotation is now a free-form float in [0, 360) — the modal hosts a slider
// for fine angle adjustment plus ↶ ↷ buttons for ±90° quick jumps. Both
// write through to cfg.rotation and re-render the modal canvas + the main
// preview pane in one shot.
function setRotation(angle, opts) {
  const cfg = activeCfg();
  let r = Number(angle) || 0;
  if (Math.abs(r) < 0.05) r = 0;   // snap sub-degree dust to clean zero
  const norm = ((r % 360) + 360) % 360;
  cfg.rotation = norm;
  // Skip the slider-write when the slider IS the source — would snap thumb
  // between +180 / -180 mid-drag.
  if (opts && opts.fromSlider) syncRotationReadouts(cfg);
  else                          syncRotateFromCfg(cfg);
  if (CROP.bm) {
    CROP.rotation = norm;
    refitCropCanvas();
  }
  if (opts && opts.flashDelta != null) {
    flashRotation(opts.flashDelta, norm);
  }
  requestRender();
}

function bumpRotation(delta) {
  const cur = Number(activeCfg().rotation) || 0;
  setRotation(cur + delta, { flashDelta: delta });
}
els.cropRotCcw.addEventListener('click', () => bumpRotation(-90));
els.cropRotCw.addEventListener('click', () => bumpRotation(90));
els.cropAngle.addEventListener('input', () => {
  setRotation(Number(els.cropAngle.value) || 0, { fromSlider: true });
});
els.cropRotReset.addEventListener('click', () => setRotation(0));

// Transient rotation indicator — flashes for ~700ms after each rotate
// click, showing the new total angle. Direction comes from the click
// (CW arrow shape vs CCW = mirrored). Suppressed when no photo is loaded
// so we don't flash over the empty state.
let rotFlashTimer = 0;
function flashRotation(delta, totalDeg) {
  if (state.activeIdx < 0) return;
  const el = els.rotationFlash;
  if (!el) return;
  // ↻ for CW rotation, ↺ for CCW. Driven by the click direction so the
  // arrow always matches the action the user just took.
  els.rotationFlashArrow.textContent = delta < 0 ? '↺' : '↻';
  els.rotationFlashVal.textContent = totalDeg + '°';
  // Re-trigger animation by removing class on next frame
  el.classList.remove('flash-show');
  void el.offsetWidth;   // force reflow so class re-add re-fires the transition
  el.classList.add('flash-show');
  if (rotFlashTimer) clearTimeout(rotFlashTimer);
  rotFlashTimer = setTimeout(() => {
    el.classList.remove('flash-show');
    rotFlashTimer = 0;
  }, 700);
}

// ─── Crop modal wiring ──────────────────────────────────────────────────
// Crop is stored on cfg in normalized post-rotation [0..1] space, so that's
// also the coordinate frame the modal works in. We render the active photo
// pre-rotated onto the modal's canvas (so the user crops the orientation
// they see in preview) and overlay an absolutely-positioned div whose
// position/size is computed from the rect each pointermove tick.
const CROP = {
  rect: { x: 0, y: 0, w: 1, h: 1 },
  canvasCss: { x: 0, y: 0, w: 0, h: 0 },
  // True post-rotation source dims (used for the px readout). Distinct
  // from the canvas's intrinsic dims, which we shrink to fit the modal.
  trueW: 0,
  trueH: 0,
  // The pre-loaded bitmap + rotation we kept around so refitCropCanvas
  // can re-render at a different size on viewport resize.
  bm: null,
  rotation: 0,
  drag: null,
  // 'free' = no aspect lock; 'frame' = current frame aspect; 'W:H' = literal
  aspect: 'free'
};
const CROP_MIN = 0.05;
// Frame aspect → numeric width/height ratio. Falls back to the shared
// resolver so custom W:H tokens (e.g. "3:2", "2.35:1") agree with what the
// renderer will actually paint.
function frameAspectToRatio(aspect) {
  const preset = R.resolveAspectPreset(aspect);
  return preset ? preset.W / preset.H : 1;
}

function parseAspectToken(token) {
  if (token === 'free') return null;
  if (token === 'frame') {
    return frameAspectToRatio(activeCfg().aspect || '9:16');
  }
  const m = token.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const w = Number(m[1]), h = Number(m[2]);
  return (w > 0 && h > 0) ? (w / h) : null;
}

// The aspect ratio is in PIXEL space (W_px / H_px). Convert to normalized
// coords (W_norm / H_norm) so we can compare against rect.w / rect.h.
function pxAspectToNorm(pxRatio) {
  if (!pxRatio || !CROP.trueW || !CROP.trueH) return null;
  return pxRatio * CROP.trueH / CROP.trueW;
}

function gcd(a, b) { return b ? gcd(b, a % b) : a; }
function fmtRatio(w, h) {
  if (!w || !h) return '—';
  const r = Math.round(w * 1000) / Math.round(h * 1000);
  // Try a tidy integer ratio if it's close to common ones
  const candidates = [
    [1, 1], [4, 3], [3, 4], [16, 9], [9, 16], [3, 2], [2, 3], [16, 10], [21, 9], [5, 4]
  ];
  for (const [cw, ch] of candidates) {
    if (Math.abs(r - cw / ch) < 0.012) return cw + ':' + ch;
  }
  // Fallback: greatest common divisor of pixel rounded values
  const wi = Math.round(w), hi = Math.round(h);
  if (wi > 0 && hi > 0) {
    const g = gcd(wi, hi);
    if (g > 1 && wi / g < 100 && hi / g < 100) return (wi / g) + ':' + (hi / g);
  }
  return r.toFixed(2);
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

async function openCropModal() {
  const active = state.files[state.activeIdx];
  if (!active) {
    setStatus('status.noPhoto', 'err');
    setTimeout(() => setStatus('status.ready'), 1500);
    return;
  }
  const bm = await CR.loadBitmap(active.file, 1440);
  CROP.bm = bm;
  CROP.rotation = ((Number(active.cfg.rotation) || 0) % 360 + 360) % 360;
  // trueW/trueH are recomputed from the rotated bbox inside
  // refitCropCanvas, since they shift whenever the user changes rotation.
  CROP.rect = active.cfg.crop ? { ...active.cfg.crop } : { x: 0, y: 0, w: 1, h: 1 };
  CROP.aspect = 'free';
  syncCropAspectSeg();
  syncRotateFromCfg(active.cfg);    // surface current angle on the slider
  els.cropModal.showModal();
  // Wait one frame for the dialog to settle into its definite height, then
  // size the canvas + draw. refitCropCanvas + drawCropModalCanvas together
  // produce a canvas whose CSS box is the rotated bbox, scaled to exactly
  // fit the stage — no contain-margins, no overflow.
  requestAnimationFrame(refitCropCanvas);
}

// Recompute the canvas's intrinsic dims from the rotated bounding box at
// the current rotation, fit to the stage, then redraw. Called on modal
// open, on stage resize (ResizeObserver), and on every rotation change —
// the rotated bbox grows for non-axis-aligned angles, so the canvas size
// has to track it for the visible image to stay fitted.
function refitCropCanvas() {
  if (!CROP.bm || !els.cropModal.open) return;
  const stage = els.cropStage;
  const sRect = stage.getBoundingClientRect();
  // Padding mirrors the .crop-stage CSS rule.
  const PAD = 28;
  const availW = Math.max(0, sRect.width  - PAD * 2);
  const availH = Math.max(0, sRect.height - PAD * 2);
  if (!availW || !availH) return;
  // Inscribed safe-area dims at the current rotation. The canvas is
  // sized to this rect (not the larger rotated bbox), so the modal
  // displays a rectangular zoom-into-the-rotated-photo with no
  // transparent corners — the bitmap content overflows past the canvas
  // edges and gets clipped naturally. Matches the Lightroom / iOS Photos
  // straighten preview behavior the user asked for.
  const safe = R.inscribedSafeArea(CROP.bm, CROP.rotation || 0);
  CROP.trueW = safe.w;
  CROP.trueH = safe.h;
  // Cap at 1 — never upscale a small source.
  const ratio = Math.min(availW / safe.w, availH / safe.h, 1);
  const dispW = Math.max(1, Math.round(safe.w * ratio));
  const dispH = Math.max(1, Math.round(safe.h * ratio));
  const c = els.cropCanvas;
  if (c.width !== dispW || c.height !== dispH) {
    c.width = dispW;
    c.height = dispH;
  }
  drawCropModalCanvas();
  updateCropRectPosition();
}

// Draw the source bitmap into the modal canvas at the current rotation.
// Canvas's intrinsic dims = rotated bbox × fit-scale (set by the caller
// in refitCropCanvas). The bitmap is drawn centered, rotated, scaled by
// that same fit factor — its rotated silhouette fills the canvas
// exactly, with transparent corners outside the silhouette for non-90°
// angles (the typical "straighten" preview look).
function drawCropModalCanvas() {
  const c = els.cropCanvas;
  const ctx = c.getContext('2d');
  const bm = CROP.bm;
  if (!bm || !CROP.trueW) return;
  const W = c.width;
  const H = c.height;
  const rRad = ((Number(CROP.rotation) || 0) % 360 + 360) % 360 * Math.PI / 180;
  // Same scale used by refitCropCanvas to size the canvas. Use one of
  // the two ratios — both equal because bbox is fitted in both axes.
  const scale = W / CROP.trueW;
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(scale, scale);
  ctx.rotate(rRad);
  ctx.drawImage(bm, -bm.width / 2, -bm.height / 2);
  ctx.restore();
}

function syncCropAspectSeg() {
  els.cropAspectSeg.querySelectorAll('button').forEach((b) => {
    const on = b.dataset.val === CROP.aspect;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
}

function updateCropRectPosition() {
  if (!els.cropModal.open) return;
  const sRect = els.cropStage.getBoundingClientRect();
  const cRect = els.cropCanvas.getBoundingClientRect();
  CROP.canvasCss = {
    x: cRect.left - sRect.left,
    y: cRect.top  - sRect.top,
    w: cRect.width,
    h: cRect.height
  };
  const r = CROP.rect;
  const cc = CROP.canvasCss;
  els.cropRect.style.left   = (cc.x + r.x * cc.w) + 'px';
  els.cropRect.style.top    = (cc.y + r.y * cc.h) + 'px';
  els.cropRect.style.width  = (r.w * cc.w) + 'px';
  els.cropRect.style.height = (r.h * cc.h) + 'px';

  // Three readouts: percent, pixel dims (against TRUE post-rotation
  // source dims, not the modal's display canvas), aspect.
  els.cropPctW.textContent = Math.round(r.w * 100);
  els.cropPctH.textContent = Math.round(r.h * 100);
  const wPx = Math.round(r.w * CROP.trueW);
  const hPx = Math.round(r.h * CROP.trueH);
  els.cropReadoutPx.textContent = wPx + ' × ' + hPx + ' px';
  els.cropReadoutRatio.textContent = '≈ ' + fmtRatio(wPx, hPx);
}

function applyDrag(handle, dx, dy, start) {
  const r = { ...start };
  switch (handle) {
    case 'move':
      r.x = clamp(start.x + dx, 0, 1 - r.w);
      r.y = clamp(start.y + dy, 0, 1 - r.h);
      break;
    case 'nw':
      r.x = clamp(start.x + dx, 0, start.x + start.w - CROP_MIN);
      r.w = start.x + start.w - r.x;
      r.y = clamp(start.y + dy, 0, start.y + start.h - CROP_MIN);
      r.h = start.y + start.h - r.y;
      break;
    case 'ne':
      r.w = clamp(start.w + dx, CROP_MIN, 1 - start.x);
      r.y = clamp(start.y + dy, 0, start.y + start.h - CROP_MIN);
      r.h = start.y + start.h - r.y;
      break;
    case 'sw':
      r.x = clamp(start.x + dx, 0, start.x + start.w - CROP_MIN);
      r.w = start.x + start.w - r.x;
      r.h = clamp(start.h + dy, CROP_MIN, 1 - start.y);
      break;
    case 'se':
      r.w = clamp(start.w + dx, CROP_MIN, 1 - start.x);
      r.h = clamp(start.h + dy, CROP_MIN, 1 - start.y);
      break;
    case 'n':
      r.y = clamp(start.y + dy, 0, start.y + start.h - CROP_MIN);
      r.h = start.y + start.h - r.y;
      break;
    case 's':
      r.h = clamp(start.h + dy, CROP_MIN, 1 - start.y);
      break;
    case 'w':
      r.x = clamp(start.x + dx, 0, start.x + start.w - CROP_MIN);
      r.w = start.x + start.w - r.x;
      break;
    case 'e':
      r.w = clamp(start.w + dx, CROP_MIN, 1 - start.x);
      break;
  }
  return r;
}

function startCropDrag(handle, e) {
  e.preventDefault();
  CROP.drag = {
    handle,
    startMouse: { x: e.clientX, y: e.clientY },
    startRect: { ...CROP.rect }
  };
  els.cropRect.classList.add('dragging');
  document.addEventListener('pointermove', onCropDrag);
  document.addEventListener('pointerup', endCropDrag, { once: true });
}

function onCropDrag(e) {
  const d = CROP.drag;
  if (!d) return;
  const cc = CROP.canvasCss;
  if (cc.w <= 0 || cc.h <= 0) return;
  const dx = (e.clientX - d.startMouse.x) / cc.w;
  const dy = (e.clientY - d.startMouse.y) / cc.h;
  let r = applyDrag(d.handle, dx, dy, d.startRect);
  const normRatio = pxAspectToNorm(parseAspectToken(CROP.aspect));
  if (normRatio && d.handle !== 'move') {
    r = snapAspect(r, d.handle, normRatio);
  }
  CROP.rect = r;
  updateCropRectPosition();
}

function endCropDrag() {
  CROP.drag = null;
  els.cropRect.classList.remove('dragging');
  document.removeEventListener('pointermove', onCropDrag);
}

// Anchor for each handle = the opposite point that stays fixed during drag.
// Used by snapAspect to recompute the dragged-to side after honouring the
// aspect lock.
const HANDLE_ANCHOR = {
  nw: 'se', ne: 'sw', sw: 'ne', se: 'nw',
  n: 's',  s: 'n',  w: 'e',  e: 'w'
};

// Given a rect from applyDrag (which may not honor the aspect lock) and
// the drag handle, snap the rect so r.w / r.h === normRatio while keeping
// the anchor point fixed. Then clamp to canvas bounds.
function snapAspect(r, handle, normRatio) {
  const anchor = HANDLE_ANCHOR[handle] || 'center';
  const currentRatio = r.w / r.h;
  if (currentRatio > normRatio) {
    // too wide → shrink width
    const newW = r.h * normRatio;
    if (anchor === 'nw' || anchor === 'sw' || anchor === 'w') {
      r.w = newW;            // anchored on the LEFT, shrink toward the left
    } else if (anchor === 'ne' || anchor === 'se' || anchor === 'e') {
      r.x = r.x + (r.w - newW);
      r.w = newW;
    } else {
      r.x = r.x + (r.w - newW) / 2;
      r.w = newW;
    }
  } else if (currentRatio < normRatio) {
    // too tall → shrink height
    const newH = r.w / normRatio;
    if (anchor === 'nw' || anchor === 'ne' || anchor === 'n') {
      r.h = newH;
    } else if (anchor === 'sw' || anchor === 'se' || anchor === 's') {
      r.y = r.y + (r.h - newH);
      r.h = newH;
    } else {
      r.y = r.y + (r.h - newH) / 2;
      r.h = newH;
    }
  }
  // Clamp into [0, 1]² without changing dims (slide if needed)
  if (r.x < 0) r.x = 0;
  if (r.y < 0) r.y = 0;
  if (r.x + r.w > 1) r.x = 1 - r.w;
  if (r.y + r.h > 1) r.y = 1 - r.h;
  if (r.w > 1) r.w = 1;
  if (r.h > 1) r.h = 1;
  return r;
}

// Refit the rect to a new aspect lock. Always picks the LARGEST rect of
// `normRatio` aspect that fits within the full image [0,1]², centered.
// Crucially, this is computed against the WHOLE IMAGE, not the prior rect
// — clicking 1:1, then 3:4, then 1:1 again should give the same maximal
// 1:1 rect every time, not progressively shrink.
function refitRectToAspect(normRatio) {
  if (!normRatio) return;
  let newW, newH;
  if (normRatio >= 1) {
    // Wider in normalized coords → width is the limiter, fill the image's
    // full width and let height come out smaller.
    newW = 1;
    newH = 1 / normRatio;
  } else {
    newH = 1;
    newW = normRatio;
  }
  CROP.rect = {
    x: (1 - newW) / 2,
    y: (1 - newH) / 2,
    w: newW,
    h: newH
  };
}

els.cropOpenBtn.addEventListener('click', () => { openCropModal().catch(console.error); });
els.cropModalCloseBtn.addEventListener('click', () => els.cropModal.close());
els.cropCancelBtn.addEventListener('click', () => els.cropModal.close());
els.cropResetBtn.addEventListener('click', () => {
  CROP.rect = { x: 0, y: 0, w: 1, h: 1 };
  // Reset honors the current aspect lock — if user has 1:1 selected, the
  // "reset" rect is the largest 1:1 rect that fits the canvas, not 1×1.
  const ratio = pxAspectToNorm(parseAspectToken(CROP.aspect));
  if (ratio) refitRectToAspect(ratio);
  updateCropRectPosition();
});

// Aspect lock segmented control — pick a constraint and the rect snaps to
// the largest rect of that aspect that fits the previous rect's center.
els.cropAspectSeg.querySelectorAll('button').forEach((btn) => {
  btn.addEventListener('click', () => {
    CROP.aspect = btn.dataset.val;
    syncCropAspectSeg();
    const ratio = pxAspectToNorm(parseAspectToken(CROP.aspect));
    if (ratio) refitRectToAspect(ratio);
    updateCropRectPosition();
  });
});
els.cropApplyBtn.addEventListener('click', () => {
  const r = CROP.rect;
  const isFull = r.x < 0.002 && r.y < 0.002 && r.w > 0.998 && r.h > 0.998;
  activeCfg().crop = isFull ? null : { x: r.x, y: r.y, w: r.w, h: r.h };
  els.cropModal.close();
  requestRender();
});

// Pointerdown handlers: rect interior moves, handles resize.
els.cropRect.addEventListener('pointerdown', (e) => {
  if (e.target.classList.contains('crop-handle')) {
    startCropDrag(e.target.dataset.h, e);
  } else {
    startCropDrag('move', e);
  }
});

// Re-fit the canvas (and reposition the overlay rect) on viewport resize
// AND on stage resize. ResizeObserver on the stage catches dialog reflow
// after showModal + browser zoom; observing the stage (not the canvas)
// avoids the feedback loop that observing canvas would create — we set
// canvas.width/height inside refitCropCanvas, which would re-fire on
// canvas-watchers. The observer + listener both no-op when modal is shut.
window.addEventListener('resize', () => {
  if (els.cropModal.open) refitCropCanvas();
});
if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(() => {
    if (els.cropModal.open) refitCropCanvas();
  }).observe(els.cropStage);
}

// ─── Collage (2–4 photos in one frame) wiring ───────────────────────────
els.collageLayout.addEventListener('change', () => {
  const v = els.collageLayout.value;
  const cfg = activeCfg();
  cfg.collage = COLLAGE_PARTNERS[v] ? { layout: v } : null;
  // Reset partnerFiles array length to match new layout — drop trailing
  // entries that no longer fit, keep prefix entries the user already picked.
  const active = state.files[state.activeIdx];
  if (active) {
    if (!Array.isArray(active.partnerFiles)) active.partnerFiles = [];
    const want = COLLAGE_PARTNERS[v] || 0;
    active.partnerFiles.length = want;
  }
  syncCollageFromActive();
  requestRender();
});

// Hydrate from localStorage on boot so a returning user finds their signature
// pre-loaded. Falls through silently when storage is unavailable or empty.
(function hydrateSignature() {
  try {
    const raw = localStorage.getItem(SIGNATURE_STORAGE_KEY);
    if (!raw) return;
    const payload = JSON.parse(raw);
    if (payload && payload.data) {
      // Migrate legacy schema (string position) to the current shape so
      // every downstream consumer sees the same { anchor, dx, dy } object.
      state.draftCfg.customLogo = migrateCustomLogo(payload);
      syncSignatureFromCfg(state.draftCfg);
    }
  } catch (_) { /* malformed entry — drop silently */ }
})();

// ─── Custom bg image (frosted bg replacement) wiring ────────────────────
// Same shape as signature: upload cascades to draftCfg + every loaded photo
// + localStorage. Uploads of any size are accepted but downscaled to
// CUSTOMBG_MAX_EDGE long-edge and re-encoded as JPEG q=0.85 before storage —
// the bg gets blurred anyway, so a 4K source contributes zero visual benefit
// over a 1920px one and would balloon localStorage. CUSTOMBG_HARD_CAP is
// only there to refuse genuinely insane files (decoding a 100MB JPEG just
// to throw it out is wasteful).
const CUSTOMBG_STORAGE_KEY = 'phototools.customBg';
const CUSTOMBG_HARD_CAP = 32 * 1024 * 1024;
// The bg layer renders behind a sigma-60..90 blur, so detail below ~4 px
// in the source is invisible in output. 1024 long-edge + q=0.72 is the
// sweet spot — any smaller and JPEG block-artifacts start poking through
// the blur in the lighter midtones; larger is just bytes for nothing.
const CUSTOMBG_MAX_EDGE = 1024;
const CUSTOMBG_QUALITY = 0.72;

function applyCustomBgEverywhere(payload) {
  state.draftCfg.customBg = payload ? { ...payload } : null;
  for (const f of state.files) {
    f.cfg.customBg = payload ? { ...payload } : null;
  }
  try {
    if (payload) localStorage.setItem(CUSTOMBG_STORAGE_KEY, JSON.stringify(payload));
    else localStorage.removeItem(CUSTOMBG_STORAGE_KEY);
  } catch (_) { /* private mode / quota — non-fatal */ }
}

// Downscale + JPEG-encode any image File. HEIC sources go through
// HeicTools.transcode first since createImageBitmap can't decode HEIC. The
// returned dataURL is suitable for stuffing into customBg.data.
async function compressBgImage(file) {
  let workFile = file;
  if (window.HeicTools && window.HeicTools.isHeic(file)) {
    workFile = await window.HeicTools.transcode(file);
  }
  const bm = await createImageBitmap(workFile, { imageOrientation: 'from-image' });
  try {
    const ratio = Math.min(1, CUSTOMBG_MAX_EDGE / Math.max(bm.width, bm.height));
    const dw = Math.max(1, Math.round(bm.width * ratio));
    const dh = Math.max(1, Math.round(bm.height * ratio));
    const canvas = (typeof OffscreenCanvas !== 'undefined')
      ? new OffscreenCanvas(dw, dh)
      : Object.assign(document.createElement('canvas'), { width: dw, height: dh });
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bm, 0, 0, dw, dh);
    const blob = canvas.convertToBlob
      ? await canvas.convertToBlob({ type: 'image/jpeg', quality: CUSTOMBG_QUALITY })
      : await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', CUSTOMBG_QUALITY));
    const dataURL = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = () => reject(r.error || new Error('read failed'));
      r.readAsDataURL(blob);
    });
    return { data: dataURL, type: 'jpeg', name: file.name, byteSize: blob.size };
  } finally {
    bm.close();
  }
}

els.customBgInput.addEventListener('change', async () => {
  const file = els.customBgInput.files && els.customBgInput.files[0];
  els.customBgInput.value = '';
  if (!file) return;
  if (file.size > CUSTOMBG_HARD_CAP) {
    setStatus('status.customBgTooBig', 'err', { mb: (file.size / 1024 / 1024).toFixed(1) });
    setTimeout(() => setStatus('status.ready'), 3000);
    return;
  }
  setStatus('status.customBgCompressing', 'busy');
  try {
    const payload = await compressBgImage(file);
    applyCustomBgEverywhere(payload);
    syncCustomBgFromCfg(activeCfg());
    requestRender();
    setStatus('status.customBgLoaded');
    setTimeout(() => setStatus('status.ready'), 1500);
  } catch (err) {
    console.error('[customBg]', err);
    setStatus('status.customBgFail', 'err', { msg: err.message });
  }
});

els.customBgClearBtn.addEventListener('click', () => {
  applyCustomBgEverywhere(null);
  syncCustomBgFromCfg(activeCfg());
  requestRender();
});

(function hydrateCustomBg() {
  try {
    const raw = localStorage.getItem(CUSTOMBG_STORAGE_KEY);
    if (!raw) return;
    const payload = JSON.parse(raw);
    if (payload && payload.data) {
      state.draftCfg.customBg = payload;
      syncCustomBgFromCfg(state.draftCfg);
    }
  } catch (_) { /* malformed entry — drop silently */ }
})();

for (const [key, el] of Object.entries(els.exif)) {
  el.addEventListener('input', () => {
    const v = el.value.trim();
    const ovr = activeCfg().exifOverride;
    // Empty string = "user explicitly cleared this field" — keep it as override
    // so backend / preview see an empty value (suppressing auto-parsed).
    // Exception: flash select's empty value means "use auto-parsed" (tri-state),
    // so drop the override entirely instead of forcing flashFired=false.
    if (key === 'flash' && v === '') delete ovr[key];
    else ovr[key] = v;
    requestRender();
  });
}

// ─── Pick on map ───────────────────────────────────────────────────────
// Opens the GeoPicker modal pre-positioned at whatever lat/lon the user
// already has (override → normalized → unset world view), and writes
// 6-decimal-place strings back into the lat/lon inputs + override on
// confirm. Triggers requestRender so the gps caption row updates live.
const pickOnMapBtn = document.getElementById('pick-on-map-btn');
if (pickOnMapBtn) pickOnMapBtn.addEventListener('click', async () => {
  if (!window.GeoPicker) return;
  const f = state.files[state.activeIdx];
  const ovr = activeCfg().exifOverride;
  const norm = f && f.normalized ? f.normalized : {};
  const readSeed = (key) => {
    if (ovr && ovr[key] != null && ovr[key] !== '') {
      const n = Number(ovr[key]);
      return isFinite(n) ? n : null;
    }
    return typeof norm[key] === 'number' ? norm[key] : null;
  };
  const result = await window.GeoPicker.open({
    initialLat: readSeed('latitude'),
    initialLng: readSeed('longitude')
  });
  if (!result) return;
  const lat = result.lat.toFixed(6);
  const lng = result.lng.toFixed(6);
  els.exif.latitude.value = lat;
  els.exif.longitude.value = lng;
  ovr.latitude = lat;
  ovr.longitude = lng;
  requestRender();
});

// Diagnostic helper — copies the raw exifr output for the active photo to
// the clipboard as pretty JSON. Use this when EXIF fields look unexpectedly
// empty: the raw dump tells us whether the file actually contained metadata
// and which exact tag names exifr surfaced.
els.copyRawExifBtn.addEventListener('click', async () => {
  const f = state.files[state.activeIdx];
  if (!f) {
    setStatus('status.noPhoto', 'err');
    return;
  }
  if (!f.rawExif) {
    setStatus('status.exifLoading', 'busy');
    return;
  }
  const json = JSON.stringify(f.rawExif, null, 2);
  try {
    await navigator.clipboard.writeText(json);
    const n = Object.keys(f.rawExif).length;
    setStatus('status.copiedRaw', null, { n });
  } catch {
    // Clipboard API is gated on user gesture + secure context. As a fallback,
    // dump to a hidden <textarea> and run document.execCommand('copy').
    const ta = document.createElement('textarea');
    ta.value = json;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    setStatus('status.copiedRawFallback');
  }
  setTimeout(() => setStatus('status.ready'), 2500);
});

els.clearExifBtn.addEventListener('click', () => {
  const cfg = activeCfg();
  cfg.exifOverride = {};
  const active = state.files[state.activeIdx];
  if (active && active.normalized) populateExifInputs(active.normalized);
  else for (const el of Object.values(els.exif)) el.value = '';
  requestRender();
});

// Apply a source photo's full frame configuration (everything *except* EXIF)
// to all OTHER loaded photos. Covers aspect, frame, template, padding,
// captionHeight, bg overrides, shadow, and showFields. The intent: once
// you've dialed a look on one photo, propagate it across the batch.
//
// Source defaults to the active photo (B-section button path) but the rail
// context menu passes the right-clicked photo so the user doesn't have to
// switch active first.
function applyFrameToAll(src) {
  if (!src) return;
  if (state.files.length <= 1) {
    setStatus('status.onlyOne', 'err');
    setTimeout(() => setStatus('status.ready'), 1500);
    return;
  }
  const FRAME_KEYS = [
    'aspect', 'frame', 'template', 'padding', 'captionHeight',
    'bgBlur', 'bgBrightness', 'bgSaturation',
    'shadowBlur', 'shadowOffsetY', 'shadowOpacity',
    'radiusOverride', 'captionForceOverlay',
    'tornJitter', 'tornStep', 'tornEdgeOpacity'
  ];
  for (const f of state.files) {
    if (f === src) continue;
    for (const k of FRAME_KEYS) f.cfg[k] = src.cfg[k];
    f.cfg.showFields = { ...src.cfg.showFields };
    f.cfg.customLogo = src.cfg.customLogo ? { ...src.cfg.customLogo } : null;
    f.cfg.customBg = src.cfg.customBg ? { ...src.cfg.customBg } : null;
  }
  // If the active photo received settings, re-sync its controls to reflect
  // them. (When the source IS the active photo this is a noop.)
  if (state.activeIdx >= 0 && state.files[state.activeIdx] !== src) {
    syncControlsFromCfg(state.files[state.activeIdx].cfg);
    requestRender();
  }
  setStatus('status.appliedFrame', null, { n: state.files.length - 1 });
  setTimeout(() => setStatus('status.ready'), 1800);
}
els.applyFrameAllBtn.addEventListener('click', () => {
  applyFrameToAll(state.files[state.activeIdx]);
});

// Apply a source photo's EXIF override to all OTHER loaded photos. Each
// other photo keeps its own auto-parsed metadata for keys NOT in the
// override — only the user-edited fields propagate. Useful for e.g.
// setting author across the whole batch, or correcting a misparsed brand
// globally.
function applyExifToAll(src) {
  if (!src) return;
  const ov = src.cfg.exifOverride || {};
  const keys = Object.keys(ov);
  if (state.files.length <= 1) {
    setStatus('status.onlyOne', 'err');
    setTimeout(() => setStatus('status.ready'), 1500);
    return;
  }
  for (const f of state.files) {
    if (f === src) continue;
    f.cfg.exifOverride = { ...ov };
  }
  if (state.activeIdx >= 0 && state.files[state.activeIdx] !== src) {
    applyOverrideToInputs(state.files[state.activeIdx].cfg.exifOverride);
    requestRender();
  }
  setStatus('status.appliedExif', null, { n: keys.length, m: state.files.length - 1 });
  setTimeout(() => setStatus('status.ready'), 1800);
}
els.applyExifAllBtn.addEventListener('click', () => {
  applyExifToAll(state.files[state.activeIdx]);
});

// ─── Keyboard nav ────────────────────────────────────────────────────────
function moveSelection(delta) {
  if (!state.files.length) return;
  const next = (state.activeIdx + delta + state.files.length) % state.files.length;
  selectFile(next);
}

document.addEventListener('keydown', (e) => {
  const t = e.target;
  const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  if (typing) {
    if (e.key === 'Escape') t.blur();
    return;
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'j' || e.key === 'J') {
    e.preventDefault(); moveSelection(1);
  } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'k' || e.key === 'K') {
    e.preventDefault(); moveSelection(-1);
  } else if ((e.key === 'e' || e.key === 'E') && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    if (e.shiftKey) els.batchBtn.click(); else els.exportBtn.click();
  } else if (e.key === 'Escape') {
    if (els.exifDetails.open) els.exifDetails.open = false;
    else if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }
});

// ─── Peek at original — shared between mobile long-press + desktop Space ──
// Surface-native idioms (rule 13): mobile holds the canvas to peek;
// desktop holds the spacebar (Photoshop / Lightroom convention). Both
// drive the same paint-the-source-bitmap-onto-the-canvas routine,
// hoisted to module scope so the keyboard and touch handlers can both
// invoke it. Idempotent: re-entering while already peeking is a no-op,
// re-exiting while not peeking is a no-op.
let __peekActive = false;
async function enterPeek() {
  if (__peekActive) return;
  if (state.activeIdx < 0) return;
  const f = state.files[state.activeIdx];
  if (!f || !f.file) return;
  __peekActive = true;
  try {
    const bm = await CR.loadBitmap(f.file, 1440);
    if (!__peekActive) return;          // released during decode
    const c = els.canvas;
    const ctx = c.getContext('2d');
    ctx.save();
    ctx.fillStyle = getComputedStyle(c).backgroundColor || '#101115';
    ctx.fillRect(0, 0, c.width, c.height);
    const s = Math.min(c.width / bm.width, c.height / bm.height);
    const dw = bm.width * s, dh = bm.height * s;
    ctx.drawImage(bm, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
    ctx.restore();
  } catch (_) {
    __peekActive = false;
  }
}
function exitPeek() {
  if (!__peekActive) return;
  __peekActive = false;
  if (state.activeIdx >= 0) requestRender();
}

// ─── Canvas touch gestures: pinch-zoom + swipe + long-press peek ────────
// Three coordinated gestures on the preview canvas, multiplexed by touch
// count + zoom state:
//
//  1. Two-finger pinch → zoom canvas (1x–4x) around the centroid; centroid
//     drift pans simultaneously. Double-tap snaps back to 1x.
//  2. One-finger horizontal swipe (dx ≥ 50px, ≤ 800ms, |dy| ≤ |dx|·0.7)
//     → prev/next photo. SUPPRESSED while zoomed (would conflict with pan).
//  3. One-finger drag while zoomed → pan the zoomed canvas.
//  4. One-finger long-press (≥ 500ms, < 10px movement) → enterPeek().
//
// touchmove/touchend live on document so a finger that started on canvas
// and moves/lifts elsewhere still resolves the gesture cleanly.

const __zoom = { scale: 1, tx: 0, ty: 0 };
function __isZoomed() { return __zoom.scale > 1.02; }
function __applyZoomTransform() {
  const c = els.canvas;
  if (!c) return;
  if (!__isZoomed() && Math.abs(__zoom.tx) < 0.5 && Math.abs(__zoom.ty) < 0.5) {
    c.style.transform = '';
    if (els.canvasPane) els.canvasPane.dataset.zoomed = 'false';
  } else {
    c.style.transform = `translate(${__zoom.tx.toFixed(1)}px, ${__zoom.ty.toFixed(1)}px) scale(${__zoom.scale.toFixed(3)})`;
    if (els.canvasPane) els.canvasPane.dataset.zoomed = 'true';
  }
}
function __resetZoom(animated) {
  const c = els.canvas;
  if (!c) return;
  if (animated) {
    c.style.transition = 'transform 260ms cubic-bezier(0.32,0.72,0,1)';
    setTimeout(() => { c.style.transition = ''; }, 280);
  }
  __zoom.scale = 1; __zoom.tx = 0; __zoom.ty = 0;
  __applyZoomTransform();
}

(function wireCanvasGestures() {
  const pane = els.canvasPane;
  if (!pane) return;
  const PEEK_DELAY_MS = 500;
  let startX = 0, startY = 0, startTime = 0, active = false;
  let peekTimer = 0;
  let pinch = null;     // { startDist, startCenter, startScale, startTx, startTy }
  let pan = null;       // { startX, startY, startTx, startTy }
  let lastTapTime = 0;

  function dist(t1, t2) {
    const dx = t1.clientX - t2.clientX, dy = t1.clientY - t2.clientY;
    return Math.hypot(dx, dy);
  }
  function center(t1, t2) {
    return { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
  }
  function clampPan() {
    // Clamp translation so the zoomed canvas can't be dragged off-screen
    // by more than ~half its scaled size in either direction.
    const c = els.canvas;
    if (!c) return;
    const r = c.getBoundingClientRect();
    if (!r.width || !r.height) return;
    // r.width is already post-scale; back-compute pre-scale dims
    const preW = r.width / __zoom.scale;
    const preH = r.height / __zoom.scale;
    const overflowX = (preW * (__zoom.scale - 1)) / 2;
    const overflowY = (preH * (__zoom.scale - 1)) / 2;
    __zoom.tx = Math.max(-overflowX, Math.min(overflowX, __zoom.tx));
    __zoom.ty = Math.max(-overflowY, Math.min(overflowY, __zoom.ty));
  }

  pane.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      // Begin pinch — cancel any in-progress single-finger gesture.
      active = false;
      pan = null;
      clearTimeout(peekTimer);
      pinch = {
        startDist: dist(e.touches[0], e.touches[1]),
        startCenter: center(e.touches[0], e.touches[1]),
        startScale: __zoom.scale,
        startTx: __zoom.tx,
        startTy: __zoom.ty,
      };
      els.canvas.style.transition = 'none';
      return;
    }
    if (e.touches.length !== 1) { active = false; return; }
    if (__isZoomed()) {
      // One finger on a zoomed canvas → pan, not swipe/peek.
      pan = {
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        startTx: __zoom.tx,
        startTy: __zoom.ty,
      };
      els.canvas.style.transition = 'none';
      return;
    }
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startTime = Date.now();
    active = true;
    clearTimeout(peekTimer);
    peekTimer = setTimeout(() => { if (active) enterPeek(); }, PEEK_DELAY_MS);
  }, { passive: true });

  pane.addEventListener('touchmove', (e) => {
    if (pinch && e.touches.length >= 2) {
      const d = dist(e.touches[0], e.touches[1]);
      const c = center(e.touches[0], e.touches[1]);
      const factor = d / pinch.startDist;
      __zoom.scale = Math.max(1, Math.min(4, pinch.startScale * factor));
      __zoom.tx = pinch.startTx + (c.x - pinch.startCenter.x);
      __zoom.ty = pinch.startTy + (c.y - pinch.startCenter.y);
      clampPan();
      __applyZoomTransform();
      e.preventDefault();
      return;
    }
    if (pan && e.touches.length === 1) {
      __zoom.tx = pan.startTx + (e.touches[0].clientX - pan.startX);
      __zoom.ty = pan.startTy + (e.touches[0].clientY - pan.startY);
      clampPan();
      __applyZoomTransform();
      e.preventDefault();
      return;
    }
  }, { passive: false });

  document.addEventListener('touchmove', (e) => {
    if (!active || __peekActive) return;
    if (!e.changedTouches.length) return;
    const t = e.changedTouches[0];
    if (Math.abs(t.clientX - startX) > 10 || Math.abs(t.clientY - startY) > 10) {
      clearTimeout(peekTimer);
    }
  }, { passive: true });

  document.addEventListener('touchcancel', () => {
    active = false;
    pinch = null;
    pan = null;
    clearTimeout(peekTimer);
    exitPeek();
  });

  document.addEventListener('touchend', (e) => {
    // Settle pinch — snap back to 1x if close, otherwise let zoom persist.
    if (pinch && e.touches.length < 2) {
      pinch = null;
      els.canvas.style.transition = '';
      if (__zoom.scale < 1.05) {
        __resetZoom(true);
      } else {
        clampPan();
        __applyZoomTransform();
      }
      return;
    }
    if (pan && e.touches.length === 0) {
      pan = null;
      els.canvas.style.transition = '';
      return;
    }
    if (!active) {
      // Detect double-tap to reset zoom (only when zoomed, fingers all up).
      if (e.touches.length === 0 && __isZoomed() && e.changedTouches.length === 1) {
        const now = Date.now();
        if (now - lastTapTime < 300) __resetZoom(true);
        lastTapTime = now;
      }
      return;
    }
    active = false;
    clearTimeout(peekTimer);
    if (__peekActive) { exitPeek(); return; }
    if (!e.changedTouches.length) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    const dt = Date.now() - startTime;
    if (dt > 800) return;
    if (Math.abs(dx) < 50) return;
    if (Math.abs(dy) > Math.abs(dx) * 0.7) return;
    moveSelection(dx < 0 ? 1 : -1);
  }, { passive: true });

  // Reset zoom when switching photos — keeps the new photo unzoomed.
  document.addEventListener('phototools:photo-switched', () => __resetZoom(false));
})();

// ─── Hold Space to peek at original (desktop equivalent) ───────────────
// Photoshop / Lightroom convention. Skipped when an interactive element
// has focus (typing into an input, Space activating a focused button,
// etc.) so the gesture doesn't hijack normal form behavior. window.blur
// releases peek to avoid a stuck state if the user alt-tabs while held.
(function wireKeyboardPeek() {
  let spaceHeld = false;
  function isInteractiveTarget(t) {
    if (!t || !t.tagName) return false;
    if (t.isContentEditable) return true;
    return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'
        || t.tagName === 'SELECT' || t.tagName === 'BUTTON';
  }
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space') return;
    if (spaceHeld) return;             // ignore key auto-repeat
    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    if (isInteractiveTarget(e.target)) return;
    spaceHeld = true;
    e.preventDefault();
    enterPeek();
  });
  document.addEventListener('keyup', (e) => {
    if (e.code !== 'Space') return;
    if (!spaceHeld) return;
    spaceHeld = false;
    exitPeek();
  });
  window.addEventListener('blur', () => {
    if (spaceHeld) { spaceHeld = false; exitPeek(); }
  });
})();

// ─── Drag-drop ───────────────────────────────────────────────────────────
['dragenter', 'dragover'].forEach((ev) => {
  els.canvasPane.addEventListener(ev, (e) => {
    if (!e.dataTransfer || Array.from(e.dataTransfer.types).indexOf('Files') < 0) return;
    e.preventDefault();
    els.dropHint.classList.add('visible');
  });
});
['dragleave', 'drop'].forEach((ev) => {
  els.canvasPane.addEventListener(ev, (e) => {
    e.preventDefault();
    els.dropHint.classList.remove('visible');
  });
});
els.canvasPane.addEventListener('drop', async (e) => {
  const files = Array.from(e.dataTransfer.files || []).filter((f) => {
    if (f.type === 'image/jpeg' || f.type === 'image/png') return true;
    return window.HeicTools && window.HeicTools.isHeic(f);
  });
  if (!files.length) return;
  const prevLen = state.files.length;
  setStatus('status.reading', 'busy');
  await mergeFiles(files);
  renderRail();
  if (state.files.length > prevLen) await selectFile(prevLen === 0 ? 0 : prevLen);
});

// ─── Export (single + batch) ─────────────────────────────────────────────
// Per-photo cfg shape consumed by ClientRender + Exporter. exifOverride (raw
// form strings) is shipped as cfg.exif so buildExifForFile can format/normalize.
function buildConfigForFile(f) {
  const c = f.cfg;
  const exifPayload = {};
  for (const [k, v] of Object.entries(c.exifOverride || {})) {
    if (typeof v === 'string' && v.trim() !== '') exifPayload[k] = v.trim();
  }
  const cfg = {
    aspect: c.aspect,
    frame: c.frame,
    template: c.template,
    format: state.format,
    quality: state.quality,
    padding: c.padding,
    shadowBlur: c.shadowBlur,
    shadowOffsetY: c.shadowOffsetY,
    shadowOpacity: c.shadowOpacity,
    showFields: { ...c.showFields },
    exif: exifPayload
  };
  if (c.captionHeight != null) cfg.captionHeight = c.captionHeight;
  if (c.paddingTop != null)    cfg.paddingTop = c.paddingTop;
  if (c.paddingRight != null)  cfg.paddingRight = c.paddingRight;
  if (c.paddingBottom != null) cfg.paddingBottom = c.paddingBottom;
  if (c.paddingLeft != null)   cfg.paddingLeft = c.paddingLeft;
  if (c.bgBlur != null)        cfg.bgBlur = c.bgBlur;
  if (c.bgBrightness != null)  cfg.bgBrightness = c.bgBrightness;
  if (c.bgSaturation != null)  cfg.bgSaturation = c.bgSaturation;
  if (c.radiusOverride != null) cfg.radiusOverride = c.radiusOverride;
  if (c.captionForceOverlay)   cfg.captionForceOverlay = true;
  if (c.captionOverlayTextLift) cfg.captionOverlayTextLift = c.captionOverlayTextLift;
  if (c.topTemplate && c.topTemplate !== 'none') cfg.topTemplate = c.topTemplate;
  if (c.tornJitter != null)    cfg.tornJitter = c.tornJitter;
  if (c.tornStep != null)      cfg.tornStep = c.tornStep;
  if (c.tornEdgeOpacity != null) cfg.tornEdgeOpacity = c.tornEdgeOpacity;
  if (c.filmMfAge != null)     cfg.filmMfAge = c.filmMfAge;
  if (c.customLogo)            cfg.customLogo = { ...c.customLogo };
  if (c.customBg)              cfg.customBg = { ...c.customBg };
  if (c.collage)               cfg.collage = { ...c.collage };
  if (c.rotation)              cfg.rotation = c.rotation;
  if (c.crop)                  cfg.crop = { ...c.crop };
  return cfg;
}

const assets = () => ({ logos: state.logos, fontFaceCss: state.fontFaceCss });

els.exportBtn.addEventListener('click', async () => {
  const active = state.files[state.activeIdx];
  if (!active) return;
  els.exportBtn.disabled = true;
  setStatus('status.exporting', 'busy');
  try {
    const cfg = buildConfigForFile(active);
    await window.Exporter.exportSingle(
      { file: active.file, normExif: buildExifForFile(active), partnerFiles: active.partnerFiles || [] },
      cfg, assets()
    );
    setStatus('status.exported', null);
    setTimeout(() => setStatus('status.ready'), 1500);
  } catch (err) {
    console.error('[export]', err);
    setStatus(err.message || T('status.exportFail'), 'err');
  } finally {
    els.exportBtn.disabled = false;
  }
});

async function runBatch() {
  if (state.files.length === 0) return;
  els.batchBtn.disabled = true;
  els.exportBtn.disabled = true;
  setStatus('status.batchPrefix', 'busy', { n: state.files.length });
  try {
    const entries = state.files.map((f) => ({
      file: f.file,
      normExif: buildExifForFile(f),
      cfg: buildConfigForFile(f),
      partnerFiles: f.partnerFiles || []
    }));
    // Exporter drives the progress modal directly via window.ProgressModal —
    // status bar just gets the final result.
    const { errors } = await window.Exporter.exportBatch(entries, assets());
    setStatus('status.batchDone', errors.length ? 'err' : null, { n: errors.length });
    setTimeout(() => setStatus('status.ready'), 2000);
  } catch (err) {
    console.error('[batch]', err);
    setStatus(err.message || T('status.batchFail'), 'err');
  } finally {
    els.batchBtn.disabled = false;
    els.exportBtn.disabled = state.activeIdx < 0;
  }
}
els.batchBtn.addEventListener('click', runBatch);

// ─── Rail context menu — right-click (desktop) or long-press (mobile) ──
// One floating menu reused for any thumbnail interaction. Captures the
// idx of the targeted item on open; the menu's click handler reads that
// idx and dispatches the action (currently just "remove this photo",
// future-extensible). Cross-surface idiom (rule 13): right-click on
// desktop, long-press on mobile — both routes call openMenu().
//
// Long-press synthesizes a click on the rail item via touchend's
// compatibility mouse events; we suppress that one click via a
// capture-phase document listener so the long-press doesn't ALSO
// select the photo it was launched from.
(function wireRailContextMenu() {
  const menu = els.railMenu;
  const rail = els.thumbRail;
  if (!menu || !rail) return;
  const LONGPRESS_MS = 500;
  let pendingIdx = -1;
  let suppressNextClick = false;

  function openMenu(x, y, idx) {
    pendingIdx = idx;
    menu.hidden = false;
    // Measure after un-hiding (display: block needed for getBoundingClientRect).
    const r = menu.getBoundingClientRect();
    const px = Math.max(4, Math.min(x, window.innerWidth - r.width - 4));
    const py = Math.max(4, Math.min(y, window.innerHeight - r.height - 4));
    menu.style.left = px + 'px';
    menu.style.top = py + 'px';
  }
  function closeMenu() {
    menu.hidden = true;
    pendingIdx = -1;
  }

  // Right-click (desktop)
  rail.addEventListener('contextmenu', (e) => {
    const item = e.target.closest('.rail-item');
    if (!item) return;
    e.preventDefault();
    openMenu(e.clientX, e.clientY, parseInt(item.dataset.idx, 10));
  });

  // Long-press (mobile)
  let lpTimer = 0;
  let lpItem = null;
  let lpStartX = 0, lpStartY = 0;
  rail.addEventListener('touchstart', (e) => {
    const item = e.target.closest('.rail-item');
    if (!item || e.touches.length !== 1) { lpItem = null; return; }
    lpItem = item;
    lpStartX = e.touches[0].clientX;
    lpStartY = e.touches[0].clientY;
    clearTimeout(lpTimer);
    lpTimer = setTimeout(() => {
      if (!lpItem) return;
      const r = lpItem.getBoundingClientRect();
      const idx = parseInt(lpItem.dataset.idx, 10);
      // Anchor the menu just below + centered on the thumbnail
      openMenu(r.left + r.width / 2 - 80, r.bottom + 6, idx);
      // Suppress the synthesized click that fires on touchend so the
      // long-press doesn't also re-select the photo it was launched on.
      suppressNextClick = true;
      // Fallback timeout: if no click follows (e.g., user lifted off
      // before touchend synthesizes), clear the flag so the next real
      // tap on a different item isn't swallowed.
      setTimeout(() => { suppressNextClick = false; }, 600);
    }, LONGPRESS_MS);
  }, { passive: true });
  rail.addEventListener('touchmove', (e) => {
    if (!lpItem || !e.changedTouches.length) return;
    const t = e.changedTouches[0];
    if (Math.abs(t.clientX - lpStartX) > 10 || Math.abs(t.clientY - lpStartY) > 10) {
      clearTimeout(lpTimer);
      lpItem = null;
    }
  }, { passive: true });
  rail.addEventListener('touchcancel', () => { clearTimeout(lpTimer); lpItem = null; });
  rail.addEventListener('touchend', () => { clearTimeout(lpTimer); lpItem = null; });

  // Capture-phase click suppressor for the synthesized click after long-press.
  document.addEventListener('click', (e) => {
    if (suppressNextClick) {
      suppressNextClick = false;
      e.stopImmediatePropagation();
      e.preventDefault();
      return;
    }
    // Tap-outside dismiss
    if (!menu.hidden && !menu.contains(e.target)) closeMenu();
  }, { capture: true });

  // Esc closes
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) closeMenu();
  });

  // Menu item dispatch
  menu.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const idx = pendingIdx;
    closeMenu();
    const src = state.files[idx];
    if (action === 'remove') removeFile(idx);
    else if (action === 'apply-frame') applyFrameToAll(src);
    else if (action === 'apply-exif') applyExifToAll(src);
  });
})();

// ─── Presets ─────────────────────────────────────────────────────────────
// A preset captures the "look" half of cfg (everything except per-photo EXIF
// overrides + global format/quality). Local presets persist to localStorage
// and may carry the user's signature; share codes (URL hash) intentionally
// strip customLogo because dataURLs blow up URL length.
const PRESET_STORAGE_KEY = 'phototools.presets';
const PRESET_SCHEMA_VERSION = 1;
const LOOK_KEYS = [
  'aspect', 'frame', 'template', 'padding', 'captionHeight',
  // Per-edge padding (1.1+) — additive in v:1. Old presets / share-codes
  // that don't carry these default to null = follow scalar padding.
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'bgBlur', 'bgBrightness', 'bgSaturation',
  'shadowBlur', 'shadowOffsetY', 'shadowOpacity',
  // Additive in v:1 — old presets / share-codes that don't carry these
  // simply default to null / false on apply, so backwards compat holds.
  'radiusOverride', 'captionForceOverlay',
  // Torn-paper knobs (0.21+) — null on non-torn frames, only kicked in
  // when the active frame is torn. Same additive-default invariant.
  'tornJitter', 'tornStep', 'tornEdgeOpacity',
  // Top-of-frame badge + overlay text-lift (0.22+) — additive in v:1.
  // Old share-codes that don't carry these default to 'none' / 0.
  'topTemplate', 'captionOverlayTextLift',
  // Film-mf vintage-aging strength (0.22+) — null on non-film-mf frames,
  // only kicked in when the active frame is film-mf.
  'filmMfAge'
];

// Factory ("seed") presets — curated combos shipped with the app to
// showcase what the DIY engine can do. Read-only, never written to
// localStorage. The product position is "starting points the user
// then twists into their own look", not "ready-made skins" — every
// field a factory preset sets is also reachable via UI controls so
// the user can override and save back into "我的预设".
//
// 0.22.0 rework: dropped from 7 → 4 seeds. Each remaining seed
// represents one identifiable real-world aesthetic (frosted glass,
// torn paper, 35mm negative, gelatin silver print), tuned end-to-end
// rather than picking a frame + template + leaving defaults. Removed
// seeds (magazine-editorial / hasselblad-tribute / leica-side-rail /
// kodak-professional / polaroid-classic / frosted-classic / film-35-
// authentic) were unfocused — they showcased frame×template
// combinations without committing to a finished look.
const FACTORY_PRESETS = [
  // Frosted noir · tech-stack — dark blurred-self-bg with a moody
  // depth pop. Showcases bg dim + heavy floating shadow + bumped radius.
  { id: 'frosted-noir-stack', nameKey: 'preset.factory.frostedNoirStack', iconEmoji: '✨',
    preset: { v: 1, frame: 'frosted-noir', template: 'tech-stack',
              aspect: '3:4', padding: 70, captionHeight: 252,
              bgBlur: 72, bgBrightness: 0.98, bgSaturation: 1.32,
              shadowBlur: 124, shadowOffsetY: 34, shadowOpacity: 0.64,
              radiusOverride: 44, captionForceOverlay: false,
              captionOverlayTextLift: 0, topTemplate: 'none',
              tornJitter: null, tornStep: null, tornEdgeOpacity: null,
              filmMfAge: null,
              paddingTop: null, paddingRight: null, paddingBottom: null, paddingLeft: null,
              showFields: { brand: true, model: true, focal: true, aperture: true, shutter: true, iso: true, lens: false, date: true, gps: false, author: true, flash: false } } },
  // Torn paper · date-lens + top brand-model — handmade scrapbook feel.
  // Showcases the new topTemplate ('brand-model' stamps FUJIFILM · X-T5
  // above the photo) + torn-paper jitter/density knobs.
  { id: 'torn-paper-stack',   nameKey: 'preset.factory.tornPaperStack',   iconEmoji: '📜',
    preset: { v: 1, frame: 'torn', template: 'date-lens',
              aspect: '9:16', padding: 32, captionHeight: 360,
              bgBlur: null, bgBrightness: null, bgSaturation: null,
              shadowBlur: 50, shadowOffsetY: 16, shadowOpacity: 0.20,
              radiusOverride: 0, captionForceOverlay: false,
              captionOverlayTextLift: 0, topTemplate: 'brand-model',
              tornJitter: 9.5, tornStep: 6.5, tornEdgeOpacity: 0.28,
              filmMfAge: null,
              paddingTop: null, paddingRight: null, paddingBottom: null, paddingLeft: null,
              showFields: { brand: true, model: true, focal: true, aperture: true, shutter: true, iso: true, lens: false, date: true, gps: false, author: true, flash: false } } },
  // Film 35mm · tech-stack + overlay watermark — caption stamped onto the
  // negative, lifted 32px from the bottom edge for breathing room.
  // Showcases captionForceOverlay + new captionOverlayTextLift knob.
  { id: 'film-35-stack',      nameKey: 'preset.factory.film35Stack',      iconEmoji: '🎞',
    preset: { v: 1, frame: 'film-35', template: 'tech-stack',
              aspect: '9:16', padding: 60, captionHeight: 228,
              bgBlur: null, bgBrightness: null, bgSaturation: null,
              shadowBlur: 0, shadowOffsetY: 0, shadowOpacity: 0,
              radiusOverride: 0, captionForceOverlay: true,
              captionOverlayTextLift: 32, topTemplate: 'none',
              tornJitter: null, tornStep: null, tornEdgeOpacity: null,
              filmMfAge: null,
              paddingTop: null, paddingRight: null, paddingBottom: null, paddingLeft: null,
              showFields: { brand: true, model: true, focal: false, aperture: false, shutter: false, iso: false, lens: false, date: true, gps: false, author: true, flash: false } } },
  // Medium format · slate — gelatin silver darkroom print with the
  // monospace slate template carrying full spec + lens. The hand-written
  // library notation comes from the frame's decorate hook.
  { id: 'film-mf-print',      nameKey: 'preset.factory.filmMfPrint',      iconEmoji: '📽',
    preset: { v: 1, frame: 'film-mf', template: 'slate',
              aspect: '9:16', padding: 60, captionHeight: 360,
              bgBlur: null, bgBrightness: null, bgSaturation: null,
              shadowBlur: 40, shadowOffsetY: 12, shadowOpacity: 0.14,
              radiusOverride: 0, captionForceOverlay: false,
              captionOverlayTextLift: 0, topTemplate: 'none',
              tornJitter: null, tornStep: null, tornEdgeOpacity: null,
              filmMfAge: null,
              paddingTop: null, paddingRight: null, paddingBottom: null, paddingLeft: null,
              showFields: { brand: true, model: true, focal: false, aperture: false, shutter: false, iso: true, lens: true, date: true, gps: false, author: true, flash: false } } },
  // Slide mount — Kodachrome-era mounted transparency. Top + bottom
  // EXIF-stamps (BRAND / TRANSPARENCY / PROCESSED BY BRAND, bottom
  // mirrored 180°) carry the brand identity, so the inner caption stays
  // minimal: just date + lens for the per-shot stamp.
  { id: 'slide-mount-print',  nameKey: 'preset.factory.slideMountPrint',  iconEmoji: '🎞',
    preset: { v: 1, frame: 'slide-mount', template: 'date-lens',
              aspect: '4:3', padding: 70, captionHeight: null,
              bgBlur: null, bgBrightness: null, bgSaturation: null,
              shadowBlur: 0, shadowOffsetY: 0, shadowOpacity: 0,
              radiusOverride: 0, captionForceOverlay: false,
              captionOverlayTextLift: 0, topTemplate: 'none',
              tornJitter: null, tornStep: null, tornEdgeOpacity: null,
              filmMfAge: null,
              paddingTop: null, paddingRight: null, paddingBottom: null, paddingLeft: null,
              showFields: { brand: false, model: false, focal: true, aperture: true, shutter: true, iso: true, lens: true, date: true, gps: false, author: true, flash: false } } }
];

function presetFromCfg(cfg, opts) {
  const out = { v: PRESET_SCHEMA_VERSION };
  for (const k of LOOK_KEYS) out[k] = cfg[k];
  out.showFields = { ...cfg.showFields };
  if (opts && opts.includeCustomLogo && cfg.customLogo) {
    out.customLogo = { ...cfg.customLogo };
  }
  return out;
}

function applyPresetToCfg(preset, cfg) {
  if (!preset || preset.v !== PRESET_SCHEMA_VERSION) return false;
  for (const k of LOOK_KEYS) if (k in preset) cfg[k] = preset[k];
  if (preset.showFields) cfg.showFields = { ...preset.showFields };
  // 0.22.0 frame retirements: when an old share-code or stored preset
  // references a frame that no longer exists, walk it forward to the
  // closest survivor via the central FRAME_ALIASES table. Rendering
  // would resolve the alias anyway (resolveFrame falls through), but
  // migrating cfg.frame at apply time keeps the UI (seg button, swatch,
  // future preset re-saves) coherent with the surviving frame name.
  const aliases = R.FRAME_ALIASES || {};
  if (cfg.frame && !R.FRAMES[cfg.frame] && aliases[cfg.frame]) {
    cfg.frame = aliases[cfg.frame];
  }
  // customLogo is optional in the preset; only applied when present so a
  // share code without the signature doesn't wipe a local one the user has.
  // Run through migrateCustomLogo so older presets / share-codes that
  // serialized the legacy string position upgrade on the way in.
  if (preset.customLogo) cfg.customLogo = migrateCustomLogo({ ...preset.customLogo });
  return true;
}

function loadPresets() {
  try {
    const raw = localStorage.getItem(PRESET_STORAGE_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : {};
  } catch (_) { return {}; }
}

function savePresets(map) {
  try { localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(map)); }
  catch (_) { /* private mode / quota — non-fatal */ }
}

// Base64url codec for the share code. JSON → UTF-8 → base64 → +/= swap.
// Stays under URL length limits for any typical preset (~700 bytes when
// customLogo is excluded).
function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(code) {
  let s = code.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function nowDefaultPresetName() {
  const d = new Date();
  const ts = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
           + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  return T('frame.presetDefaultName', { ts });
}

// ─── LOOK system ──────────────────────────────────────────────────────────
// Promoted to the lookbar's first-class meta-primitive (0.20). Replaces the
// workshop · Library tab. The library now lives behind a single tap on the
// LOOK chip; the chip itself shows the currently-applied preset's name and
// pulses an accent dot when the user has dialed away from that baseline.

// ── Applied-preset state (lookState declared at top of module so
// syncControlsFromCfg can safely touch it during boot) ──────────────────
//
// The "baseline" stored on lookState is a snapshot of look-relevant cfg
// fields captured at the moment a preset was applied. cfgDivergesFromBaseline
// then asks "does the active cfg still match what was applied?". When it
// doesn't, the LOOK chip surfaces a status pulse — the user has forked the
// look in their head; we just reflect that.

function captureLookBaseline(preset) {
  // showFields is included because divergence in field toggles also reads as
  // "I tweaked this look". customLogo / customBg / collage / exifOverride are
  // intentionally excluded — they're orthogonal asset choices, not aesthetic.
  const snap = { v: PRESET_SCHEMA_VERSION };
  for (const k of LOOK_KEYS) snap[k] = preset[k];
  snap.showFields = preset.showFields ? { ...preset.showFields } : null;
  return snap;
}

function cfgDivergesFromBaseline(cfg, baseline) {
  if (!baseline) return false;
  for (const k of LOOK_KEYS) {
    // Use loose comparison (==) so null vs undefined doesn't count as drift —
    // legacy share-codes that omit additive fields land as undefined, the
    // baseline carries them as null, and they should agree.
    if (cfg[k] != baseline[k]) return true;
  }
  if (baseline.showFields) {
    for (const k of Object.keys(baseline.showFields)) {
      if (!!(cfg.showFields || {})[k] !== !!baseline.showFields[k]) return true;
    }
  }
  return false;
}

function setLookActive(opts) {
  // Centralised setter so save / paste / apply / clear paths all funnel
  // through one place. Pass null to clear.
  if (!opts) {
    lookState.baseline = null;
    lookState.label = null;
    lookState.iconEmoji = null;
    lookState.isFactory = false;
    lookState.id = null;
  } else {
    lookState.baseline = opts.baseline;
    lookState.label = opts.label || null;
    lookState.iconEmoji = opts.iconEmoji || null;
    lookState.isFactory = !!opts.isFactory;
    lookState.id = opts.id || null;
  }
  syncLookValueDisplay();
}

function syncLookValueDisplay() {
  const lookEl = els.lookbarLook;
  const valueEl = els.lookbarLookValue;
  const statusEl = els.lookbarLookStatus;
  if (!lookEl || !valueEl) return;
  const cfg = activeCfg();
  if (lookState.label) {
    valueEl.textContent = (lookState.iconEmoji ? lookState.iconEmoji + '  ' : '') + lookState.label;
    lookEl.removeAttribute('data-empty');
    const modified = cfgDivergesFromBaseline(cfg, lookState.baseline);
    if (statusEl) statusEl.hidden = !modified;
    lookEl.dataset.modified = modified ? 'true' : 'false';
  } else {
    valueEl.textContent = T('look.empty');
    lookEl.setAttribute('data-empty', 'true');
    if (statusEl) statusEl.hidden = true;
    lookEl.dataset.modified = 'false';
  }
  highlightActiveLookInPicker();
}

function highlightActiveLookInPicker() {
  if (els.lookFactoryGrid) {
    els.lookFactoryGrid.querySelectorAll('.look-tile').forEach((t) => {
      t.classList.toggle('active', !!lookState.label && lookState.isFactory && t.dataset.id === lookState.id);
    });
  }
  if (els.lookUserList) {
    els.lookUserList.querySelectorAll('.look-user-row').forEach((r) => {
      r.classList.toggle('active', !!lookState.label && !lookState.isFactory && r.dataset.name === lookState.label);
    });
  }
}

// Shared apply path. Used by factory-tile click, user-row click, hash-preset
// boot, and paste-share-code action. `opts.isFactory` + `opts.iconEmoji` +
// `opts.id` drive the LOOK chip's display + active-tile highlight.
function applyPresetByName(preset, label, opts) {
  if (!preset) return false;
  const target = activeCfg();
  if (!applyPresetToCfg(preset, target)) return false;
  // draftCfg always tracks the latest applied look so future imports inherit.
  if (target !== state.draftCfg) applyPresetToCfg(preset, state.draftCfg);
  syncControlsFromCfg(target);
  // customLogo lives outside syncControlsFromCfg's bg/shadow/showFields scope.
  // Sync the visible preview here when present (mirrors prior select-change
  // logic); this is per-active-photo, not cascaded — user hits "Apply frame
  // to all" to propagate.
  if (preset.customLogo) {
    els.signaturePreview.hidden = false;
    els.signaturePreviewImg.src = preset.customLogo.data;
    setPosGridActive(els.signaturePosGrid, customLogoAnchor(preset.customLogo));
    const sc = Math.round((preset.customLogo.scale != null ? preset.customLogo.scale : 0.06) * 100);
    const op = preset.customLogo.opacity != null ? preset.customLogo.opacity : 1;
    els.signatureScale.value = sc;
    setReadoutNum(els.signatureScaleVal, sc, '%');
    els.signatureOpacity.value = op;
    setReadoutNum(els.signatureOpacityVal, Math.round(op * 100), '%');
    els.signaturePosGrid.querySelectorAll('button').forEach((b) => { b.disabled = false; });
    els.signatureScale.disabled = false;
    els.signatureOpacity.disabled = false;
  }
  setLookActive({
    baseline: captureLookBaseline(preset),
    label: label,
    iconEmoji: (opts && opts.iconEmoji) || null,
    isFactory: !!(opts && opts.isFactory),
    id: (opts && opts.id) || null
  });
  requestRender();
  setStatus('status.presetApplied', null, { name: label });
  setTimeout(() => setStatus('status.ready'), 1500);
  return true;
}

// ── Render: factory grid (curated seeds) ──────────────────────────────
function renderLookFactoryGrid() {
  const root = els.lookFactoryGrid;
  if (!root) return;
  root.innerHTML = '';
  for (const f of FACTORY_PRESETS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'look-tile';
    btn.dataset.id = f.id;
    btn.setAttribute('role', 'listitem');
    const emoji = document.createElement('span');
    emoji.className = 'look-tile-emoji';
    emoji.textContent = f.iconEmoji;
    emoji.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'look-tile-label';
    label.dataset.i18n = f.nameKey;
    label.textContent = T(f.nameKey);
    btn.appendChild(emoji);
    btn.appendChild(label);
    btn.addEventListener('click', () => {
      applyPresetByName(f.preset, T(f.nameKey), { isFactory: true, iconEmoji: f.iconEmoji, id: f.id });
    });
    root.appendChild(btn);
  }
  if (els.lookFactoryCount) els.lookFactoryCount.textContent = FACTORY_PRESETS.length;
}

// ── Render: user-saved presets list ──────────────────────────────────
function renderLookUserList() {
  const root = els.lookUserList;
  const empty = els.lookUserEmpty;
  if (!root) return;
  root.innerHTML = '';
  const map = loadPresets();
  const names = Object.keys(map);
  if (els.lookUserCount) els.lookUserCount.textContent = names.length;
  if (empty) empty.hidden = names.length > 0;
  for (const name of names) {
    const preset = map[name];
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'look-user-row';
    row.dataset.name = name;
    row.setAttribute('role', 'listitem');

    const text = document.createElement('span');
    text.className = 'look-user-row-text';
    const nameEl = document.createElement('span');
    nameEl.className = 'look-user-row-name';
    nameEl.textContent = name;
    const metaEl = document.createElement('span');
    metaEl.className = 'look-user-row-meta';
    const frameLabel = preset.frame ? T('frame.styles.' + preset.frame) : '—';
    const tmplLabel = preset.template ? T('caption.templates.' + preset.template) : '—';
    metaEl.textContent = frameLabel + ' · ' + tmplLabel;
    text.appendChild(nameEl);
    text.appendChild(metaEl);

    const shareAction = document.createElement('span');
    shareAction.className = 'look-user-row-action';
    shareAction.setAttribute('role', 'button');
    shareAction.setAttribute('tabindex', '0');
    shareAction.title = T('look.shareTitle');
    shareAction.textContent = '↗';
    shareAction.addEventListener('click', (e) => {
      e.stopPropagation();
      shareCfgAsLink(preset);
    });

    const delAction = document.createElement('span');
    delAction.className = 'look-user-row-action is-danger';
    delAction.setAttribute('role', 'button');
    delAction.setAttribute('tabindex', '0');
    delAction.title = T('look.delete');
    delAction.textContent = '×';
    delAction.addEventListener('click', (e) => {
      e.stopPropagation();
      const m = loadPresets();
      delete m[name];
      savePresets(m);
      // If we just deleted the currently-applied preset, clear the chip too.
      if (lookState.label === name && !lookState.isFactory) setLookActive(null);
      renderLookUserList();
      setStatus('status.presetDeleted', null, { name });
      setTimeout(() => setStatus('status.ready'), 1500);
    });

    row.appendChild(text);
    row.appendChild(shareAction);
    row.appendChild(delAction);
    row.addEventListener('click', () => applyPresetByName(preset, name, { isFactory: false }));
    root.appendChild(row);
  }
  highlightActiveLookInPicker();
}

renderLookFactoryGrid();
renderLookUserList();

// ── Footer actions: save / share-current / paste-share-code ──────────

async function shareCfgAsLink(preset) {
  // preset === null → share current cfg; preset === {…} → share that specific
  // saved preset (used by the per-row share action).
  const p = preset || presetFromCfg(activeCfg(), { includeCustomLogo: false });
  const code = b64urlEncode(JSON.stringify(p));
  const url = location.origin + location.pathname + '#p=' + code;
  try {
    await navigator.clipboard.writeText(url);
    setStatus('status.presetShareCopied');
  } catch (_) {
    // Clipboard API gated on user gesture + secure context. Try the legacy
    // execCommand path before giving up.
    const ta = document.createElement('textarea');
    ta.value = url;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); setStatus('status.presetShareCopied'); }
    catch (_) { setStatus('status.presetShareFail', 'err'); }
    document.body.removeChild(ta);
  }
  setTimeout(() => setStatus('status.ready'), 2000);
}

if (els.lookSaveBtn) els.lookSaveBtn.addEventListener('click', () => {
  const def = nowDefaultPresetName();
  const raw = window.prompt(T('frame.presetSavePrompt'), def);
  if (raw == null) return;
  const name = raw.trim().slice(0, 60);
  if (!name) {
    setStatus('status.presetEmptyName', 'err');
    setTimeout(() => setStatus('status.ready'), 1500);
    return;
  }
  const map = loadPresets();
  map[name] = presetFromCfg(activeCfg(), { includeCustomLogo: true });
  savePresets(map);
  // Adopt the just-saved preset as the current applied look so the chip
  // shows the new name and modified-state clears.
  setLookActive({ baseline: captureLookBaseline(map[name]), label: name, isFactory: false });
  renderLookUserList();
  setStatus('status.presetSaved', null, { name });
  setTimeout(() => setStatus('status.ready'), 1500);
});

if (els.lookShareBtn) els.lookShareBtn.addEventListener('click', () => shareCfgAsLink(null));

if (els.lookPasteBtn) els.lookPasteBtn.addEventListener('click', async () => {
  // Try clipboard read first; fall back to a prompt() when the browser
  // refuses (Safari requires a permission grant for readText).
  let raw = '';
  try { raw = await navigator.clipboard.readText(); }
  catch (_) { raw = window.prompt(T('look.pastePrompt')) || ''; }
  raw = raw.trim();
  if (!raw) return;
  // Accept a full URL with #p=... or a bare base64url code.
  const m = raw.match(/#p=([A-Za-z0-9_-]+)/);
  const code = m ? m[1] : raw;
  let preset;
  try { preset = JSON.parse(b64urlDecode(code)); }
  catch (_) {
    setStatus('status.presetHashBad', 'err');
    setTimeout(() => setStatus('status.ready'), 2500);
    return;
  }
  if (!applyPresetByName(preset, T('look.pastedLabel'), { isFactory: false })) {
    setStatus('status.presetHashBad', 'err');
    setTimeout(() => setStatus('status.ready'), 2500);
  }
});

// Decode and apply a #p=<code> hash on boot. Caller invokes this after
// loadBundle() succeeds so the rest of the UI is interactive.
function applyHashPresetIfPresent() {
  const m = location.hash.match(/^#p=([A-Za-z0-9_-]+)/);
  if (!m) return;
  let preset;
  try { preset = JSON.parse(b64urlDecode(m[1])); }
  catch (_) {
    setStatus('status.presetHashBad', 'err');
    setTimeout(() => setStatus('status.ready'), 2500);
    return;
  }
  if (!applyPresetToCfg(preset, state.draftCfg)) {
    setStatus('status.presetHashBad', 'err');
    setTimeout(() => setStatus('status.ready'), 2500);
    return;
  }
  syncControlsFromCfg(state.draftCfg);
  // Adopt the hash-supplied preset as the current look so the chip reflects
  // it (and modifies-from-baseline detection works correctly when the user
  // starts dialing things).
  setLookActive({ baseline: captureLookBaseline(preset), label: T('look.pastedLabel'), isFactory: false });
  // Strip the hash so a refresh doesn't reapply (and so the user doesn't
  // accidentally copy the preset URL into their next share).
  history.replaceState(null, '', location.pathname + location.search);
  setStatus('status.presetHashApplied');
  setTimeout(() => setStatus('status.ready'), 2000);
}

// ─── Boot ────────────────────────────────────────────────────────────────
// Non-blocking: kick off the asset fetch in parallel with UI hydration. The
// rest of the page (rail, preset list, hash preset) is interactive while
// logos.json + fonts.css are still flying. requestRender already guards on
// `state.logos`; once the bundle resolves we trigger a render of the active
// photo (if any) so the user doesn't see an empty canvas after they import.
setStatus('status.loadingAssets', 'busy');
const bundlePromise = loadBundle();
applyHashPresetIfPresent();
renderRail();
bundlePromise.then(() => {
  setStatus('status.ready');
  if (state.activeIdx >= 0) requestRender();
}).catch((err) => {
  setStatus('status.bundleFail', 'err', { msg: err.message });
  console.error(err);
});

// ─── Changelog modal ────────────────────────────────────────────────────
// public/CHANGELOG.md is the single source of truth. The topbar pill button
// fetches it on first click and renders into a <dialog>. A small accent dot
// on the pill flags any version newer than what the user last opened
// (tracked in localStorage). The first heading-2 in the file is treated as
// the "latest version" string.
const CHANGELOG_SEEN_KEY = 'phototools.lastSeenChangelog';
let changelogCachedMd = null;

function escapeChangelogHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// Inline markdown applied AFTER the line has been HTML-escaped — `code`,
// **bold**, *italic*, [text](url). Order matters: code first so its content
// isn't re-processed; links before bold so [**X**](url) works.
function renderChangelogInline(s) {
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  return s;
}

// Line-based markdown → HTML for the small subset we use in CHANGELOG.md:
// h1/h2/h3, paragraphs, bullet lists, horizontal rules, plus the inline
// patterns above. No tables, code blocks, blockquotes, or nested lists —
// keeps the renderer < 30 lines and the changelog itself stays scannable.
function renderChangelogMarkdown(md) {
  const lines = md.split('\n');
  const out = [];
  let inList = false;
  function endList() { if (inList) { out.push('</ul>'); inList = false; } }
  for (const line of lines) {
    const escaped = escapeChangelogHtml(line);
    let m;
    if ((m = line.match(/^(#{1,3})\s+(.+)$/))) {
      endList();
      const lvl = m[1].length;
      out.push('<h' + lvl + '>' + renderChangelogInline(escapeChangelogHtml(m[2])) + '</h' + lvl + '>');
    } else if ((m = line.match(/^[-*]\s+(.+)$/))) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push('<li>' + renderChangelogInline(escapeChangelogHtml(m[1])) + '</li>');
    } else if (/^---+\s*$/.test(line)) {
      endList();
      out.push('<hr>');
    } else if (line.trim() === '') {
      endList();
    } else {
      endList();
      out.push('<p>' + renderChangelogInline(escaped) + '</p>');
    }
  }
  endList();
  return out.join('');
}

function changelogLatestVersion(md) {
  // First "## " heading is the most recent release entry. Trim trailing
  // whitespace + treat the whole heading text as the seen-version key.
  const m = md.match(/^##\s+([^\n]+)/m);
  return m ? m[1].trim() : '';
}

async function fetchChangelog() {
  if (changelogCachedMd != null) return changelogCachedMd;
  changelogCachedMd = await fetch('CHANGELOG.md').then((r) => r.text());
  return changelogCachedMd;
}

async function checkChangelogBadge() {
  try {
    const md = await fetchChangelog();
    const latest = changelogLatestVersion(md);
    if (!latest) return;
    const seen = localStorage.getItem(CHANGELOG_SEEN_KEY) || '';
    if (latest !== seen) els.changelogBadge.hidden = false;
  } catch (_) { /* offline / 404 — silently skip */ }
}

async function openChangelog() {
  els.changelogModal.showModal();
  try {
    const md = await fetchChangelog();
    els.changelogBody.innerHTML = renderChangelogMarkdown(md);
    const latest = changelogLatestVersion(md);
    if (latest) {
      try { localStorage.setItem(CHANGELOG_SEEN_KEY, latest); } catch (_) {}
    }
    els.changelogBadge.hidden = true;
  } catch (err) {
    els.changelogBody.innerHTML = '<p>' + escapeChangelogHtml(err.message || 'load failed') + '</p>';
  }
}

els.changelogBtn.addEventListener('click', () => { openChangelog(); });
els.changelogModalCloseBtn.addEventListener('click', () => els.changelogModal.close());
// Tap on backdrop closes the modal (mobile users have no Esc key; desktop
// gets it for free as a parity bonus). The backdrop is the dialog element
// itself outside its inner content rect, so we test the click target.
els.changelogModal.addEventListener('click', (e) => {
  if (e.target === els.changelogModal) els.changelogModal.close();
});
checkChangelogBadge();

// ─── Lookbar / picker / workshop / cmdk wiring ─────────────────────────
// The whole "left sidebar" is gone. Hot path lives in the bottom Lookbar
// (5 chips + Export). Less-used controls (padding sliders, EXIF override,
// signature, collage, presets) live behind a right-side Workshop drawer.
// Frame / template / aspect / quality each have a focused popover picker
// that opens above its lookbar chip; pickers are mutually exclusive.
// ⌘K opens a command palette that searches the whole feature space.
//
// All of the original control elements (frame-seg, template-seg,
// aspect-seg, quality, format) keep their IDs — they live inside the
// pickers now, but the existing wireSeg + change-event handlers don't
// know or care where the buttons live, so they keep working.
//
// This block:
//   1. Generates visual frame/template tile buttons inside the picker
//      grids (they proxy clicks to the hidden seg buttons → wireSeg
//      already wired).
//   2. Syncs the lookchip values + swatch from the active cfg.
//   3. Manages picker open/close (1 active at a time).
//   4. Wires the workshop drawer + 5 互斥 tabs.
//   5. Wires the ⌘K command palette + keyboard nav.
//   6. Wires the import button + the lookbar Export keyboard shortcut.
(function wireToolbarShell() {
  // ── Frame metadata for the cmdk + tile name display.
  const FRAME_FAMILIES = {
    'frosted-noir': 'editorial',
    'gallery-white': 'gallery',
    instax: 'instant', torn: 'instant',
    'film-35': 'film', 'film-mf': 'film', 'slide-mount': 'film',
  };
  const ALL_FRAMES = Object.keys(FRAME_FAMILIES);
  const ALL_TEMPLATES = ['minimal-text', 'tech-stack', 'brand-logo', 'brand-right', 'wordmark', 'headline', 'date-lens', 'slate', 'passport'];
  const TEMPLATE_FAMILIES = {
    'minimal-text': 'spec', 'tech-stack': 'spec',
    'brand-logo': 'brand', 'brand-right': 'brand',
    wordmark: 'editorial', headline: 'editorial',
    'date-lens': 'stamp', slate: 'stamp', passport: 'stamp',
  };
  const TEMPLATE_PREVIEWS = {
    'minimal-text': () => 'FUJIFILM · X-M5  50mm F3.2 1/210s ISO640',
    'tech-stack': () => 'FUJIFILM\nX-M5\n50mm · F3.2\n1/210s · ISO640',
    'brand-logo': () => '▣  FUJIFILM\n   X-M5',
    'brand-right': () => 'FUJIFILM  ▣\nX-M5',
    'wordmark': () => 'FUJIFILM',
    'headline': () => '40°N · 116°E\n2026.03',
    'date-lens': () => '2026.03.21 · 50mm',
    'slate': () => 'DATE 2026.03.21\nCAM  X-M5\nLENS 50mm\nEXP  F3.2 / 1/210s',
    'passport': () => '2026.03.21\n40°N · 116°E',
  };
  const QUALITY_LABELS_KEY = { standard: 'export.qualities.standard', high: 'export.qualities.high', original: 'export.qualities.original' };

  // ── Build visual frame tile buttons inside each family grid. Clicks
  //    forward to the hidden seg buttons so wireSeg's handler runs.
  const frameSegHidden = els.frameSeg;
  const frameTilesByVal = {};
  ALL_FRAMES.forEach((val, idx) => {
    const family = FRAME_FAMILIES[val];
    const grid = document.getElementById('frame-seg-' + family);
    if (!grid) return;
    const segBtn = frameSegHidden.querySelector('[data-val="' + val + '"]');
    if (!segBtn) return;
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'frame-tile';
    tile.dataset.val = val;
    tile.dataset.family = family;
    tile.style.setProperty('--i', String(idx));
    tile.innerHTML = `
      <span class="frame-tile-preview"><span class="frame-tile-photo"></span></span>
      <span class="frame-tile-name" data-i18n="frame.styles.${val}"></span>`;
    // i18n.applyDom() will populate the localized name; we set an
    // initial textContent so it's not empty for the brief moment
    // before applyDom runs (and as a fallback if i18n's not ready).
    tile.querySelector('.frame-tile-name').textContent = segBtn.textContent.trim();
    tile.dataset.frame = val;
    tile.querySelector('.frame-tile-preview').setAttribute('data-frame', val);
    tile.addEventListener('click', () => {
      // Forward to the hidden seg button (wireSeg already attached its
      // click handler, which writes cfg.frame and triggers render).
      segBtn.click();
      closePicker();
    });
    grid.appendChild(tile);
    frameTilesByVal[val] = tile;
  });

  // ── Build template tile buttons (typography preview cards).
  const tmplSegHidden = els.templateSeg;
  const tmplTilesByVal = {};
  ALL_TEMPLATES.forEach((val, idx) => {
    const family = TEMPLATE_FAMILIES[val];
    const grid = document.getElementById('tmpl-seg-' + family);
    if (!grid) return;
    const segBtn = tmplSegHidden.querySelector('[data-val="' + val + '"]');
    if (!segBtn) return;
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'tmpl-tile';
    tile.dataset.val = val;
    tile.dataset.family = family;
    tile.style.setProperty('--i', String(idx));
    const preview = (TEMPLATE_PREVIEWS[val] || (() => ''))();
    const previewHtml = preview.split('\n').map((l) => l.replace(/&/g, '&amp;').replace(/</g, '&lt;')).join('<br>');
    tile.innerHTML = `
      <span class="tmpl-tile-name" data-i18n="caption.templates.${val}"></span>
      <span class="tmpl-tile-preview">${previewHtml}</span>`;
    tile.querySelector('.tmpl-tile-name').textContent = segBtn.textContent.trim();
    tile.addEventListener('click', () => { segBtn.click(); closePicker(); });
    grid.appendChild(tile);
    tmplTilesByVal[val] = tile;
  });

  // ── Sync lookchip displays (frame swatch + name; template, aspect,
  //    quality value text). Called after any cfg change that affects
  //    a chip.
  const swatch = document.getElementById('lookchip-frame-swatch');
  const frameVal = document.getElementById('lookchip-frame-value');
  const tmplVal = document.getElementById('lookchip-template-value');
  const aspectVal = document.getElementById('lookchip-aspect-value');
  const qualityVal = document.getElementById('lookchip-quality-value');

  function frameLabel(val) {
    return window.I18N ? T('frame.styles.' + val) : (val || '');
  }
  function tmplLabel(val) {
    return window.I18N ? T('caption.templates.' + val) : (val || '');
  }
  function setChipValue(el, next) {
    if (!el || el.textContent === next) return;
    el.textContent = next;
    el.classList.remove('is-changing');
    // Re-trigger the keyframe animation by forcing reflow.
    void el.offsetWidth;
    el.classList.add('is-changing');
  }
  function syncLookchips() {
    const cfg = activeCfg();
    if (!cfg) return;
    if (swatch) swatch.setAttribute('data-frame', cfg.frame || 'frosted-noir');
    setChipValue(frameVal, frameLabel(cfg.frame));
    setChipValue(tmplVal, tmplLabel(cfg.template));
    setChipValue(aspectVal, (cfg.aspect || '').replace(':', ' : '));
    if (qualityVal && els.quality) {
      setChipValue(qualityVal, T(QUALITY_LABELS_KEY[els.quality.value] || 'export.qualities.standard'));
    }
    // Active tile in the picker
    Object.values(frameTilesByVal).forEach((t) => t.classList.toggle('active', t.dataset.val === cfg.frame));
    Object.values(tmplTilesByVal).forEach((t) => t.classList.toggle('active', t.dataset.val === cfg.template));
    // Active row in quality picker
    document.querySelectorAll('#quality-list .quality-row').forEach((r) => {
      r.classList.toggle('active', r.dataset.quality === (els.quality && els.quality.value));
    });
    // Active button in format seg
    document.querySelectorAll('#format-seg button').forEach((b) => {
      b.classList.toggle('active', b.dataset.val === (els.format && els.format.value));
      if (b.classList.contains('active')) b.setAttribute('aria-checked', 'true');
      else b.setAttribute('aria-checked', 'false');
    });
  }

  // ── Picker overlay.
  const overlay = document.getElementById('picker-overlay');
  const lookbar = document.getElementById('lookbar');
  let activePicker = null;
  function setActiveChipGlow(anchor) {
    // Drives the lookbar's --active-chip-y CSS variable so the warm
    // accent halo on the rail's right edge tracks the focused chip
    // vertically. When anchor is null, the halo falls back to the
    // chip-group's vertical center and the picker-open data-attr
    // toggles opacity to dim the glow.
    if (!lookbar) return;
    if (!anchor) {
      lookbar.removeAttribute('data-picker-open');
      lookbar.style.removeProperty('--active-chip-y');
      lookbar.style.removeProperty('--active-chip-h');
      return;
    }
    const r = anchor.getBoundingClientRect();
    const lr = lookbar.getBoundingClientRect();
    // y relative to the lookbar (not viewport), since the ::before is
    // positioned within the lookbar's own coordinate space.
    const yWithinBar = r.top + r.height / 2 - lr.top;
    lookbar.style.setProperty('--active-chip-y', yWithinBar + 'px');
    lookbar.style.setProperty('--active-chip-h', Math.round(r.height * 1.6) + 'px');
    lookbar.dataset.pickerOpen = 'true';
  }
  function openPicker(name, anchor) {
    closePicker(true);
    const el = document.getElementById('picker-' + name);
    if (!el) return;
    document.querySelectorAll('.picker').forEach((p) => { p.hidden = true; });
    el.hidden = false;
    overlay.dataset.open = 'true';
    overlay.setAttribute('aria-hidden', 'false');
    activePicker = name;
    document.querySelectorAll('.lookchip, .lookbar-look').forEach((c) => c.removeAttribute('data-open'));
    if (anchor) anchor.setAttribute('data-open', 'true');
    setActiveChipGlow(anchor);
    positionPicker(el, anchor);
  }
  function closePicker(silent) {
    overlay.dataset.open = 'false';
    overlay.setAttribute('aria-hidden', 'true');
    document.querySelectorAll('.lookchip, .lookbar-look').forEach((c) => c.removeAttribute('data-open'));
    activePicker = null;
    setActiveChipGlow(null);
    if (silent) {
      // Caller is about to open another picker — no transition cleanup.
    }
  }
  function positionPicker(el, anchor) {
    if (window.innerWidth <= 768) {
      // Mobile: full-width bottom sheet, CSS handles it.
      el.style.removeProperty('--picker-top');
      return;
    }
    if (!anchor) return;
    // Vertical anchor: align picker's vertical center with the clicked
    // chip's vertical center. Clamp to viewport so a chip near the
    // top/bottom doesn't push the picker off-screen.
    const r = anchor.getBoundingClientRect();
    const chipCY = r.top + r.height / 2;
    // Read the picker's own height; if not yet rendered (first open),
    // fall back to a reasonable estimate. We translateY -50% in CSS so
    // the picker centers on the y-coordinate we set.
    const pickerH = el.getBoundingClientRect().height || 480;
    const margin = 16;
    const minTop = margin + pickerH / 2;
    const maxTop = window.innerHeight - margin - pickerH / 2;
    let y = chipCY;
    if (y < minTop) y = minTop;
    if (y > maxTop) y = maxTop;
    el.style.setProperty('--picker-top', y + 'px');
  }
  // Picker click delegation — covers both the four `.lookchip[data-picker]`
  // fine-tune chips AND the `.lookbar-look[data-picker="look"]` meta-primitive.
  // They live in different DOM containers and have different shapes/sizes,
  // but go through the same picker-open pipeline.
  document.querySelectorAll('.lookchip[data-picker], .lookbar-look[data-picker]').forEach((chip) => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      const name = chip.dataset.picker;
      if (activePicker === name) { closePicker(); return; }
      openPicker(name, chip);
    });
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePicker();
  });
  // Re-position on viewport resize while picker is open
  window.addEventListener('resize', () => {
    if (!activePicker) return;
    const el = document.getElementById('picker-' + activePicker);
    const anchor = document.querySelector(`.lookchip[data-picker="${activePicker}"], .lookbar-look[data-picker="${activePicker}"]`);
    if (el && anchor) positionPicker(el, anchor);
  });

  // ── Quality + Format picker rows: write to the hidden <select> and
  //    fire change so existing app.js handlers run.
  document.querySelectorAll('#quality-list .quality-row').forEach((row) => {
    row.addEventListener('click', () => {
      els.quality.value = row.dataset.quality;
      els.quality.dispatchEvent(new Event('change', { bubbles: true }));
      syncLookchips();
    });
  });
  document.querySelectorAll('#format-seg button').forEach((btn) => {
    btn.addEventListener('click', () => {
      els.format.value = btn.dataset.val;
      els.format.dispatchEvent(new Event('change', { bubbles: true }));
      syncLookchips();
    });
  });

  // ── Workshop drawer.
  const wsOverlay = document.getElementById('workshop-overlay');
  const wsTrigger = document.getElementById('workshop-trigger');
  const wsClose = document.getElementById('workshop-close');
  function openWorkshop(tab) {
    wsOverlay.dataset.open = 'true';
    wsOverlay.setAttribute('aria-hidden', 'false');
    if (tab) setWorkshopTab(tab);
  }
  function closeWorkshop() {
    wsOverlay.dataset.open = 'false';
    wsOverlay.setAttribute('aria-hidden', 'true');
  }
  function setWorkshopTab(tab) {
    document.querySelectorAll('.workshop-tab').forEach((t) => {
      const on = t.dataset.tab === tab;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.ws-tab').forEach((c) => {
      c.dataset.active = (c.dataset.tab === tab) ? 'true' : 'false';
    });
  }
  if (wsTrigger) wsTrigger.addEventListener('click', () => openWorkshop());
  // Mobile-only mirror entry — the lookbar's workshop button is hidden
  // on phones to save vertical space, so a topbar pill takes its place.
  // Both buttons funnel into the same openWorkshop() handler.
  const wsPillMobile = document.getElementById('workshop-pill-mobile');
  if (wsPillMobile) wsPillMobile.addEventListener('click', () => openWorkshop());
  if (wsClose) wsClose.addEventListener('click', closeWorkshop);
  wsOverlay.addEventListener('click', (e) => {
    if (e.target === wsOverlay) closeWorkshop();
  });
  document.querySelectorAll('.workshop-tab').forEach((t) => {
    t.addEventListener('click', () => setWorkshopTab(t.dataset.tab));
  });

  // ── Bottom-sheet swipe-dismiss (mobile only).
  // Drag from the top 36px of any sheet — workshop, picker, changelog —
  // to dismiss it. Threshold: dragged > 28% of sheet height OR release
  // velocity > 0.55 px/ms. Only active when the layout is in bottom-sheet
  // mode (matches the CSS breakpoint), so iPad-class tablets (which keep
  // the desktop drawer/picker) ignore the gesture.
  const SHEET_MQ_QUERY = '(max-width: 700px), (max-height: 500px) and (orientation: landscape)';
  const sheetMQ = window.matchMedia(SHEET_MQ_QUERY);
  function inSheetMode() { return sheetMQ.matches; }
  function wireSheetSwipeDismiss(sheetEl, closeFn) {
    if (!sheetEl) return;
    const HANDLE_AREA_PX = 36;
    const DISMISS_PCT = 0.28;
    const VELOCITY_THRESHOLD = 0.55;
    let startY = 0, startTime = 0, dy = 0, dragging = false;
    let savedTransition = '';
    sheetEl.addEventListener('touchstart', (e) => {
      if (!inSheetMode()) return;
      if (e.touches.length !== 1) { dragging = false; return; }
      // Only initiate drag if the touch starts within the top "handle"
      // strip — content scrolling below should still work normally.
      const r = sheetEl.getBoundingClientRect();
      const localY = e.touches[0].clientY - r.top;
      if (localY < 0 || localY > HANDLE_AREA_PX) return;
      startY = e.touches[0].clientY;
      startTime = Date.now();
      dy = 0;
      dragging = true;
      savedTransition = sheetEl.style.transition;
      sheetEl.style.transition = 'none';
    }, { passive: true });
    sheetEl.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const dyRaw = e.touches[0].clientY - startY;
      // Resist upward drag — sqrt-style rubber-band so the sheet feels
      // anchored rather than locked.
      dy = dyRaw < 0 ? -Math.sqrt(-dyRaw * 6) : dyRaw;
      sheetEl.style.transform = `translateY(${dy.toFixed(1)}px)`;
    }, { passive: true });
    function settle() {
      if (!dragging) return;
      dragging = false;
      sheetEl.style.transition = savedTransition;
      const dt = Math.max(1, Date.now() - startTime);
      const r = sheetEl.getBoundingClientRect();
      const velocity = dy / dt;
      const dismiss = dy > r.height * DISMISS_PCT || velocity > VELOCITY_THRESHOLD;
      sheetEl.style.transform = '';
      if (dismiss) closeFn();
      dy = 0;
    }
    sheetEl.addEventListener('touchend', settle, { passive: true });
    sheetEl.addEventListener('touchcancel', settle, { passive: true });
  }
  // Wire each sheet up. Picker has multiple instances (frame / template /
  // aspect / quality) — each gets its own listener.
  wireSheetSwipeDismiss(document.getElementById('workshop'), closeWorkshop);
  document.querySelectorAll('.picker').forEach((p) => {
    wireSheetSwipeDismiss(p, () => closePicker());
  });
  const changelogModal = document.getElementById('changelog-modal');
  if (changelogModal) {
    wireSheetSwipeDismiss(changelogModal, () => {
      if (typeof changelogModal.close === 'function') changelogModal.close();
    });
  }

  // ── Import button shortcut.
  const importBtn = document.getElementById('import-btn');
  const fileInput = document.getElementById('file-input');
  if (importBtn && fileInput) {
    importBtn.addEventListener('click', () => fileInput.click());
  }

  // ── Command palette (⌘K / Ctrl+K).
  const cmdkOverlay = document.getElementById('cmdk-overlay');
  const cmdkTrigger = document.getElementById('cmdk-trigger');
  const cmdkInput = document.getElementById('cmdk-input');
  const cmdkResults = document.getElementById('cmdk-results');

  const ACTION_ITEMS = [
    { type: 'action', key: 'export-current', i18n: 'cmdk.actions.exportCurrent', shortcut: ['⌘', 'E'], fn: () => els.exportBtn.click() },
    { type: 'action', key: 'export-batch', i18n: 'cmdk.actions.exportBatch', shortcut: ['⌘', '⇧', 'E'], fn: () => els.batchBtn.click() },
    { type: 'action', key: 'crop', i18n: 'cmdk.actions.crop', fn: () => document.getElementById('crop-open-btn').click() },
    { type: 'action', key: 'edit-exif', i18n: 'cmdk.actions.editExif', fn: () => openWorkshop('exif') },
    { type: 'action', key: 'upload-signature', i18n: 'cmdk.actions.uploadSignature', fn: () => openWorkshop('sign') },
    { type: 'action', key: 'collage', i18n: 'cmdk.actions.collage', fn: () => openWorkshop('tile') },
    { type: 'action', key: 'save-preset', i18n: 'cmdk.actions.savePreset', fn: () => { const b = document.getElementById('look-save-btn'); if (b) b.click(); } },
    { type: 'action', key: 'copy-share', i18n: 'cmdk.actions.copyShare', fn: () => { const b = document.getElementById('look-share-btn'); if (b) b.click(); } },
    { type: 'action', key: 'apply-frame-all', i18n: 'cmdk.actions.applyFrameAll', fn: () => document.getElementById('apply-frame-all-btn').click() },
    { type: 'action', key: 'changelog', i18n: 'cmdk.actions.changelog', fn: () => document.getElementById('changelog-btn').click() },
    { type: 'action', key: 'import', i18n: 'cmdk.actions.import', shortcut: ['⌘', 'O'], fn: () => fileInput.click() },
  ];

  function buildCmdkItems() {
    const items = [];
    ALL_FRAMES.forEach((k) => items.push({
      type: 'frame', key: k, label: frameLabel(k),
      group: T('cmdk.groupFrames') + ' · ' + T('frame.families.' + FRAME_FAMILIES[k]),
      run: () => { frameSegHidden.querySelector('[data-val="' + k + '"]').click(); }
    }));
    ALL_TEMPLATES.forEach((k) => items.push({
      type: 'template', key: k, label: tmplLabel(k),
      group: T('cmdk.groupTemplates'),
      run: () => { tmplSegHidden.querySelector('[data-val="' + k + '"]').click(); }
    }));
    ['9:16', '3:4', '1:1', '4:3', '16:9'].forEach((k) => items.push({
      type: 'aspect', key: k, label: T('cmdk.aspectLabel') + ' ' + k,
      group: T('cmdk.groupAspects'),
      run: () => {
        const segBtn = els.aspectSeg.querySelector('[data-val="' + k + '"]');
        if (segBtn) segBtn.click();
      }
    }));
    ACTION_ITEMS.forEach((a) => items.push({
      type: 'action', key: a.key, label: T(a.i18n), shortcut: a.shortcut,
      group: T('cmdk.groupActions'), run: a.fn
    }));
    return items;
  }

  function renderCmdk(query) {
    const items = buildCmdkItems();
    const q = (query || '').trim().toLowerCase();
    const matched = q
      ? items.filter((it) => it.label.toLowerCase().includes(q) || (it.key || '').toLowerCase().includes(q) || (it.group || '').toLowerCase().includes(q))
      : items;
    if (!matched.length) {
      cmdkResults.innerHTML = `<div class="cmdk-empty">${T('cmdk.empty')}</div>`;
      return;
    }
    const groups = {};
    matched.forEach((it) => { (groups[it.group] = groups[it.group] || []).push(it); });
    let html = '';
    let firstActive = true;
    Object.entries(groups).forEach(([g, list]) => {
      html += `<div class="cmdk-group-title">${g}</div>`;
      list.forEach((it) => {
        const ico = it.type === 'frame'
          ? `<span class="ico" data-frame="${it.key}"></span>`
          : `<span class="ico" style="opacity:0.4"></span>`;
        const sc = it.shortcut ? `<span class="cmdk-row-shortcut">${it.shortcut.map((k) => `<kbd>${k}</kbd>`).join('')}</span>` : '';
        html += `<div class="cmdk-row${firstActive ? ' active' : ''}" data-type="${it.type}" data-key="${it.key}">
          ${ico}
          <span class="cmdk-row-name">${it.label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>
          <span class="cmdk-row-meta">${sc || it.type}</span>
        </div>`;
        firstActive = false;
      });
    });
    cmdkResults.innerHTML = html;
    cmdkResults.querySelectorAll('.cmdk-row').forEach((row) => {
      row.addEventListener('click', () => {
        runCmdk(row.dataset.type, row.dataset.key);
        closeCmdk();
      });
    });
    // Re-paint frame swatches on the cmdk-row .ico — uses lookchip-icon styles.
    cmdkResults.querySelectorAll('.cmdk-row .ico[data-frame]').forEach((ico) => {
      const f = ico.dataset.frame;
      ico.classList.add('lookchip-icon');
      ico.setAttribute('data-frame', f);
    });
  }
  function runCmdk(type, key) {
    const items = buildCmdkItems();
    const it = items.find((i) => i.type === type && i.key === key);
    if (it && typeof it.run === 'function') it.run();
  }
  function openCmdk() {
    cmdkOverlay.dataset.open = 'true';
    cmdkOverlay.setAttribute('aria-hidden', 'false');
    if (cmdkInput) {
      cmdkInput.value = '';
      renderCmdk('');
      setTimeout(() => cmdkInput.focus(), 60);
    }
  }
  function closeCmdk() {
    cmdkOverlay.dataset.open = 'false';
    cmdkOverlay.setAttribute('aria-hidden', 'true');
  }
  if (cmdkTrigger) cmdkTrigger.addEventListener('click', openCmdk);
  if (cmdkInput) cmdkInput.addEventListener('input', (e) => renderCmdk(e.target.value));
  cmdkOverlay.addEventListener('click', (e) => {
    if (e.target === cmdkOverlay) closeCmdk();
  });

  document.addEventListener('keydown', (e) => {
    // ⌘K / Ctrl+K → toggle command palette
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      if (cmdkOverlay.dataset.open === 'true') closeCmdk(); else openCmdk();
      return;
    }
    // Esc closes any open overlay
    if (e.key === 'Escape') {
      if (activePicker) { closePicker(); return; }
      if (cmdkOverlay.dataset.open === 'true') { closeCmdk(); return; }
      if (wsOverlay.dataset.open === 'true') { closeWorkshop(); return; }
    }
    // Inside cmdk: ↑/↓/Enter
    if (cmdkOverlay.dataset.open === 'true') {
      const rows = Array.from(cmdkResults.querySelectorAll('.cmdk-row'));
      if (!rows.length) return;
      const idx = rows.findIndex((r) => r.classList.contains('active'));
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        rows.forEach((r) => r.classList.remove('active'));
        const next = rows[Math.min(idx + 1, rows.length - 1)];
        next.classList.add('active');
        next.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        rows.forEach((r) => r.classList.remove('active'));
        const prev = rows[Math.max(idx - 1, 0)];
        prev.classList.add('active');
        prev.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const active = rows.find((r) => r.classList.contains('active'));
        if (active) {
          runCmdk(active.dataset.type, active.dataset.key);
          closeCmdk();
        }
      }
    }
  });

  // ── Hook into existing change paths so chips stay in sync.
  // wireSeg fires the seg button click handler which writes activeCfg()[key]
  // and calls requestRender(). We piggyback by re-syncing chips after any
  // such click.
  function syncOnChange() { syncLookchips(); }
  frameSegHidden.addEventListener('click', syncOnChange);
  tmplSegHidden.addEventListener('click', syncOnChange);
  els.aspectSeg.addEventListener('click', syncOnChange);
  if (els.quality) els.quality.addEventListener('change', syncOnChange);
  if (els.format) els.format.addEventListener('change', syncOnChange);
  // syncControlsFromCfg() (called on every photo switch / cfg apply) calls
  // window.PhotoToolsShell.syncLookchips() at the end of its body — see the
  // function definition above. That keeps chip text + active-tile state in
  // sync with the active per-photo cfg without any monkey-patching here.

  // Initial paint — re-walk i18n on the freshly generated tile DOM so
  // tile-name spans pick up their data-i18n="frame.styles.<key>" /
  // "caption.templates.<key>" entries. Without this they keep whatever
  // textContent the seg button had at tile creation time, which goes
  // stale on locale switch.
  if (window.I18N && window.I18N.applyDom) window.I18N.applyDom();
  if (window.I18N && window.I18N.onChange) {
    window.I18N.onChange(() => syncLookchips());
  }
  // Defer initial sync to the next tick — wireSeg + cfg defaults need to
  // settle first.
  setTimeout(syncLookchips, 0);

  // Expose minimal API for other modules / debugging.
  window.PhotoToolsShell = { openWorkshop, openCmdk, openPicker, closePicker, syncLookchips };
})();

// ─── PWA service-worker registration + upgrade prompt ──────────────────
// Precaches the SPA shell so the app loads instantly + works offline. The
// SW is at public/service-worker.js so its scope is the deploy root.
//
// Upgrade flow: when the page detects a new SW has reached `installed` and
// is waiting (i.e., a deploy happened since last visit), we surface a
// non-intrusive banner asking the user to refresh — beats silently swapping
// running code mid-session. Click → message {type:'SKIP_WAITING'} → SW
// activates → controllerchange fires → page reloads.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      // updateViaCache:'none' forces the browser to bypass its HTTP cache
      // when fetching the SW file itself. Without this, a 24h-cached
      // service-worker.js would mean a deploy + version bump wouldn't
      // reach the user for up to a day. With it, every navigation re-
      // checks the SW from origin so update checks land within minutes.
      const reg = await navigator.serviceWorker.register('service-worker.js', {
        updateViaCache: 'none'
      });
      // A SW can already be in `waiting` at registration time if the user
      // closed the tab during a previous update window — surface that too.
      if (reg.waiting && navigator.serviceWorker.controller) showUpdateBanner(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const newer = reg.installing;
        if (!newer) return;
        newer.addEventListener('statechange', () => {
          if (newer.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner(newer);
          }
        });
      });
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading) return;
        reloading = true;
        location.reload();
      });
    } catch (err) {
      console.warn('[sw] register failed', err);
    }
  });
}

function showUpdateBanner(waitingSw) {
  const banner = document.getElementById('update-banner');
  if (!banner) return;
  banner.hidden = false;
  document.getElementById('update-banner-btn').onclick = () => {
    waitingSw.postMessage({ type: 'SKIP_WAITING' });
  };
  document.getElementById('update-banner-dismiss').onclick = () => {
    banner.hidden = true;
  };
}

// ─── Language switcher ──────────────────────────────────────────────────
// Two-segment toggle in the topbar. Clicking flips the active locale, which
// re-walks all data-i18n hooks and fires our refresh hook for live readouts.
(function wireLangSeg() {
  const seg = document.getElementById('lang-seg');
  if (!seg) return;
  function syncActive() {
    const cur = window.I18N.getLocale();
    seg.querySelectorAll('button[data-loc]').forEach((b) => {
      const on = b.dataset.loc === cur;
      b.classList.toggle('active', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }
  seg.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-loc]');
    if (!btn) return;
    window.I18N.setLocale(btn.dataset.loc);
  });
  window.I18N.onChange(() => {
    syncActive();
    refreshLocaleSensitive();
  });
  syncActive();
})();

// ─── S3 cloud gallery — config, upload, gallery, share, export-original ──
// Self-contained block. Reuses outer-scope helpers (setStatus, T, state,
// activeCfg, mergeFiles). All DOM lookups are local to keep `els` lean.
// Storage / dataflow / share-code semantics are documented in CLAUDE.md.
(function wireS3() {
  const CS = window.CloudS3;
  if (!CS) {
    console.warn('[s3] CloudS3 module not present — feature disabled');
    return;
  }

  const S3_STORAGE_KEY = 'phototools.s3Config';
  const SHARE_PREFIX = '#s3=';
  const THUMB_PREFIX = '_thumbs/';

  const modal = document.getElementById('s3-modal');
  const trigger = document.getElementById('s3-trigger');
  if (!modal || !trigger) return;

  const el = {
    // ── Config modal (single-pane, no tabs) ────────────────────────────
    close: document.getElementById('s3-close'),
    providerSeg: document.getElementById('s3-provider-seg'),
    region: document.getElementById('s3-region'),
    accountField: document.getElementById('s3-field-account'),
    account: document.getElementById('s3-account'),
    bucket: document.getElementById('s3-bucket'),
    prefix: document.getElementById('s3-prefix'),
    endpoint: document.getElementById('s3-endpoint'),
    accessKey: document.getElementById('s3-access-key'),
    secretKey: document.getElementById('s3-secret-key'),
    secretToggle: document.getElementById('s3-secret-toggle'),
    configError: document.getElementById('s3-config-error'),
    guideBody: document.getElementById('s3-guide-body'),
    save: document.getElementById('s3-save'),
    test: document.getElementById('s3-test'),
    share: document.getElementById('s3-share'),
    // ── Gallery pane (top-level, sibling of canvas-pane) ──────────────
    galleryPane: document.getElementById('cloud-gallery-pane'),
    canvasPane: document.getElementById('canvas-pane'),
    galleryBack: document.getElementById('gallery-back'),
    galleryConfig: document.getElementById('gallery-config'),
    galleryPath: document.getElementById('gallery-path'),
    uploadCurrent: document.getElementById('gallery-upload-current'),
    uploadLocal: document.getElementById('gallery-upload-local'),
    localInput: document.getElementById('gallery-local-input'),
    refresh: document.getElementById('gallery-refresh'),
    galleryStatus: document.getElementById('gallery-status'),
    galleryGrid: document.getElementById('gallery-grid'),
    galleryCount: document.getElementById('gallery-count'),
    loadSelected: document.getElementById('gallery-load-selected'),
    downloadSelected: document.getElementById('gallery-download-selected'),
    // ── Lightbox (overlay inside gallery pane) ────────────────────────
    lightbox: document.getElementById('gallery-lightbox'),
    lightboxImg: document.getElementById('lightbox-img'),
    lightboxLoading: document.getElementById('lightbox-loading'),
    lightboxPrev: document.getElementById('lightbox-prev'),
    lightboxNext: document.getElementById('lightbox-next'),
    lightboxClose: document.getElementById('lightbox-close'),
    lightboxName: document.getElementById('lightbox-name'),
    lightboxSize: document.getElementById('lightbox-size'),
    lightboxToggleSelect: document.getElementById('lightbox-toggle-select'),
    lightboxDownload: document.getElementById('lightbox-download')
  };

  // Module-local state.
  // formCfg / liveCfg / endpointDirty — config-modal form state.
  // gallery — current list of remote items.
  // lightboxIdx — currently-previewed item index in `gallery`; -1 when closed.
  // lightboxOriginalUrl — blob URL for the swap-in original; revoked on next nav.
  let formCfg = CS.normalizeConfig({ provider: 'aws' });
  let liveCfg = null;
  let endpointDirty = false;
  let gallery = []; // [{ key, name, size, thumbUrl, selected }]
  const thumbBlobUrls = []; // for cleanup on refresh
  let lightboxIdx = -1;
  let lightboxOriginalUrl = null;
  let lightboxClient = null; // memoized AwsClient for lightbox-original GETs
  state.s3Config = null;

  function renderGuide(provider) {
    if (!el.guideBody) return;
    // i18n stores the per-provider guide as a pre-built HTML fragment with a
    // {origin} placeholder — `T(...)` is the project's vars-substituting
    // accessor (see public/i18n.js → t()). Content is developer-authored, so
    // innerHTML is safe; do NOT concatenate any user-supplied input here.
    const html = window.I18N.t('s3.guide.' + provider, { origin: location.origin });
    el.guideBody.innerHTML = html || '';
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(S3_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return CS.normalizeConfig(parsed);
    } catch (_) { return null; }
  }

  function saveToStorage(cfg) {
    try { localStorage.setItem(S3_STORAGE_KEY, JSON.stringify(cfg)); }
    catch (_) { /* quota; ignore */ }
  }

  function setProvider(provider) {
    formCfg.provider = provider;
    el.providerSeg.querySelectorAll('button').forEach((b) => {
      b.setAttribute('aria-checked', b.dataset.val === provider ? 'true' : 'false');
    });
    // R2 needs an account ID (not a region in the conventional sense). Toggle
    // visibility — region stays in the form for AWS/Aliyun.
    el.accountField.classList.toggle('s3-field-hidden', provider !== 'r2');
    renderGuide(provider);
    rederiveEndpoint();
  }

  function rederiveEndpoint() {
    if (endpointDirty && el.endpoint.value.trim()) return;
    const auto = CS.resolveEndpoint(formCfg.provider, el.region.value, el.bucket.value, el.account.value);
    if (auto) {
      el.endpoint.value = auto;
      endpointDirty = false;
    }
  }

  function readForm() {
    return CS.normalizeConfig({
      provider: formCfg.provider,
      endpoint: el.endpoint.value,
      region: el.region.value,
      bucket: el.bucket.value,
      prefix: el.prefix.value,
      accountId: el.account.value,
      accessKeyId: el.accessKey.value,
      secretAccessKey: el.secretKey.value
    });
  }

  function writeForm(cfg) {
    if (!cfg) return;
    setProvider(cfg.provider || 'aws');
    el.region.value = cfg.region || '';
    el.account.value = cfg.accountId || '';
    el.bucket.value = cfg.bucket || '';
    el.prefix.value = cfg.prefix || '';
    el.endpoint.value = cfg.endpoint || '';
    el.accessKey.value = cfg.accessKeyId || '';
    el.secretKey.value = cfg.secretAccessKey || '';
    endpointDirty = !!cfg.endpoint;
  }

  function showConfigError(msg) {
    if (!msg) { el.configError.hidden = true; el.configError.textContent = ''; return; }
    el.configError.hidden = false;
    el.configError.textContent = msg;
  }

  // ── Config modal (lightweight; bucket / credentials / guide only) ──────
  function openConfigModal() {
    CS.ensureLoaded().catch((err) => console.warn('[s3] aws4fetch load failed', err));
    const stored = loadFromStorage();
    if (stored) writeForm(stored);
    else setProvider(formCfg.provider || 'aws');
    showConfigError('');
    if (typeof modal.showModal === 'function') modal.showModal();
    else modal.setAttribute('open', '');
  }

  function closeModal() {
    if (typeof modal.close === 'function') modal.close();
    else modal.removeAttribute('open');
  }

  // ── Cloud gallery pane (sibling of canvas pane; toggles via hidden attr).
  // Canvas-pane gets hidden too so the user is on one surface at a time;
  // lookbar + rail stay put so they don't lose the rest of the chrome. ──
  function showGalleryPane() {
    const cfg = liveCfg || loadFromStorage();
    if (!CS.isUsable(cfg)) {
      // No usable config yet — drop into the config modal first; user can
      // re-trigger the gallery once credentials land.
      openConfigModal();
      setStatus('status.s3MissingFields', 'err');
      setTimeout(() => setStatus('status.ready'), 2500);
      return;
    }
    // Pin liveCfg before downstream paths consult it — refreshGallery and
    // the lightbox both read liveCfg directly, so an explicit assignment here
    // saves them from re-walking localStorage.
    liveCfg = cfg;
    state.s3Config = cfg;
    if (el.canvasPane) el.canvasPane.hidden = true;
    if (el.galleryPane) el.galleryPane.hidden = false;
    updatePathLabel(cfg);
    refreshGallery().catch((err) => console.warn('[s3] auto-refresh failed', err));
    // Wire global keyboard handler while the pane is visible (Esc closes
    // lightbox or pane; arrows nav lightbox).
    document.addEventListener('keydown', onGalleryKeydown, true);
  }

  function hideGalleryPane() {
    closeLightbox();
    if (el.galleryPane) el.galleryPane.hidden = true;
    if (el.canvasPane) el.canvasPane.hidden = false;
    document.removeEventListener('keydown', onGalleryKeydown, true);
  }

  function updatePathLabel(cfg) {
    if (!el.galleryPath) return;
    const path = (cfg.bucket || '?') + (cfg.prefix ? '/' + cfg.prefix : '') + '/';
    el.galleryPath.textContent = path;
  }

  function onGalleryKeydown(e) {
    if (!el.galleryPane || el.galleryPane.hidden) return;
    // Don't hijack typing in text inputs.
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;
    if (lightboxIdx >= 0) {
      if (e.key === 'Escape') { e.preventDefault(); closeLightbox(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); navLightbox(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); navLightbox(1); }
      else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        toggleSelectedAt(lightboxIdx);
        paintLightboxSelectState();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      hideGalleryPane();
    }
  }

  // ── Hash boot: #s3=<base64url(JSON)> ────────────────────────────────────
  function applyHashS3IfPresent() {
    const m = location.hash.match(/^#s3=([A-Za-z0-9_-]+)/);
    if (!m) return;
    let cfg;
    try { cfg = CS.decodeShareCode(m[1]); }
    catch (_) {
      setStatus('status.s3HashBad', 'err');
      setTimeout(() => setStatus('status.ready'), 2500);
      return;
    }
    if (!CS.isUsable(cfg)) {
      setStatus('status.s3HashBad', 'err');
      setTimeout(() => setStatus('status.ready'), 2500);
      return;
    }
    saveToStorage(cfg);
    state.s3Config = cfg;
    liveCfg = cfg;
    writeForm(cfg);
    history.replaceState(null, '', location.pathname + location.search);
    setStatus('status.s3HashApplied');
    setTimeout(() => setStatus('status.ready'), 2000);
    // Auto-open the gallery pane so the receiver immediately sees the
    // shared photos — the whole point of the share flow.
    setTimeout(() => { showGalleryPane(); }, 100);
  }

  // ── Form wiring ─────────────────────────────────────────────────────────
  el.providerSeg.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-val]');
    if (!b) return;
    setProvider(b.dataset.val);
  });
  el.region.addEventListener('input', rederiveEndpoint);
  el.account.addEventListener('input', rederiveEndpoint);
  el.bucket.addEventListener('input', rederiveEndpoint);
  el.endpoint.addEventListener('input', () => { endpointDirty = true; });

  el.secretToggle.addEventListener('click', () => {
    el.secretKey.type = el.secretKey.type === 'password' ? 'text' : 'password';
  });

  el.close.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    // Click outside .s3-modal-inner (i.e. on backdrop) closes the dialog.
    if (e.target === modal) closeModal();
  });

  // ── Surface routing ─────────────────────────────────────────────────────
  // Topbar ☁ pill = unified "cloud entry" available on every breakpoint.
  // Mobile breakpoints hide the lookbar "From Cloud" hero (the lookbar is
  // a fixed 3-row grid with no room for it), so the pill MUST also reach
  // the gallery — not just the config modal. Behavior:
  //   • config present + usable → open gallery pane
  //   • config missing / invalid → open config modal first
  // Once credentials land, the next click on the pill drops the user
  // straight into the gallery. The lookbar "From Cloud" hero on desktop is
  // an equivalent shortcut; both routes converge on showGalleryPane via
  // the same smart entry. The gallery pane's ⚙ button is the explicit
  // route to config without leaving the browse context.
  function openCloudEntry() {
    const cfg = liveCfg || loadFromStorage();
    if (CS.isUsable(cfg)) showGalleryPane();
    else openConfigModal();
  }
  trigger.addEventListener('click', openCloudEntry);
  const cloudImportBtn = document.getElementById('import-cloud-btn');
  if (cloudImportBtn) cloudImportBtn.addEventListener('click', openCloudEntry);
  if (el.galleryBack) el.galleryBack.addEventListener('click', hideGalleryPane);
  if (el.galleryConfig) el.galleryConfig.addEventListener('click', openConfigModal);

  // ── Save / Test / Share ─────────────────────────────────────────────────
  el.save.addEventListener('click', () => {
    const cfg = readForm();
    if (!CS.isUsable(cfg)) {
      showConfigError(T('status.s3MissingFields'));
      return;
    }
    showConfigError('');
    saveToStorage(cfg);
    state.s3Config = cfg;
    liveCfg = cfg;
    // Credentials may have changed — drop the cached signer so the next
    // gallery action rebuilds it against the new cfg.
    lightboxClient = null;
    setStatus('status.s3Saved');
    setTimeout(() => setStatus('status.ready'), 1500);
    closeModal();
  });

  el.test.addEventListener('click', async () => {
    const cfg = readForm();
    if (!CS.isUsable(cfg)) {
      showConfigError(T('status.s3MissingFields'));
      return;
    }
    showConfigError('');
    el.test.disabled = true;
    setStatus('status.s3Listing', 'busy');
    try {
      await CS.ensureLoaded();
      const client = CS.buildClient(cfg);
      await CS.listObjects(client, cfg.endpoint, cfg.prefix ? cfg.prefix + '/' : '', { maxKeys: 1, pageLimit: 1 });
      setStatus('status.s3TestOk');
      // After a successful test, treat the form values as live so subsequent
      // gallery actions don't require a separate Save click.
      saveToStorage(cfg);
      state.s3Config = cfg;
      liveCfg = cfg;
      setTimeout(() => setStatus('status.ready'), 1500);
    } catch (err) {
      const msg = CS.describeError(err);
      showConfigError(msg);
      setStatus('status.s3TestFail', 'err', { msg });
    } finally {
      el.test.disabled = false;
    }
  });

  el.share.addEventListener('click', async () => {
    const cfg = readForm();
    if (!CS.isUsable(cfg)) {
      showConfigError(T('status.s3MissingFields'));
      return;
    }
    const code = CS.encodeShareCode(cfg);
    const url = location.origin + location.pathname + SHARE_PREFIX + code;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        prompt('Share link:', url);
      }
      // Save-as-side-effect mirrors what users mentally do anyway: they only
      // share configs they've validated as their own.
      saveToStorage(cfg);
      state.s3Config = cfg;
      liveCfg = cfg;
      setStatus('status.s3LinkCopied');
      // Surface the read-write warning conspicuously — the link grants the
      // bearer full bucket permission, and the user just put it on their
      // clipboard.
      window.setTimeout(() => alert(T('s3.shareWarning')), 50);
      setTimeout(() => setStatus('status.ready'), 2500);
    } catch (_) {
      setStatus('status.s3LinkFail', 'err');
    }
  });

  // ── Upload helpers ──────────────────────────────────────────────────────
  // Generate the thumbnail blob for the gallery. HEIC files can't be fed to
  // createImageBitmap directly (browsers don't decode HEIC), so we transcode
  // via the same lazy libheif shim mergeFiles uses. The HEIC original itself
  // is still uploaded as-is — when someone loads it back through the gallery,
  // mergeFiles transcodes it at import time the same way local-import does.
  async function makeThumbForUpload(file) {
    if (window.HeicTools && window.HeicTools.isHeic(file)) {
      const jpeg = await window.HeicTools.transcode(file);
      return await CS.makeThumb(jpeg, 480);
    }
    return await CS.makeThumb(file, 480);
  }

  // Source-agnostic upload helper. Drives the ProgressModal stage-by-stage
  // (one increment per file pair), collects errors into the modal's error
  // list, refreshes the gallery once everything settles. Both
  // #gallery-upload-current (state.files) and #gallery-upload-local
  // (file-picker output) route through this.
  async function uploadFiles(files) {
    // uploadFiles can be triggered from either the gallery pane (where the
    // user is browsing) or, in principle, before any config exists — fall
    // back to opening the config modal so the user can fix it without us
    // dumping them somewhere stateless.
    const cfg = liveCfg && CS.isUsable(liveCfg) ? liveCfg : readForm();
    if (!CS.isUsable(cfg)) {
      showConfigError(T('status.s3MissingFields'));
      openConfigModal();
      return;
    }
    if (!files || files.length === 0) {
      setStatus('status.noPhoto', 'err');
      setTimeout(() => setStatus('status.ready'), 1500);
      return;
    }
    saveToStorage(cfg);
    state.s3Config = cfg;
    liveCfg = cfg;

    const PM = window.ProgressModal;
    const total = files.length;
    const errors = [];
    const uploadKeys = {
      title: 's3.upload.modalTitle',
      stageRender: 's3.upload.stageUpload',
      stageDone: 's3.upload.stageDone',
      currentEmpty: 's3.upload.currentEmpty',
      currentDone: 's3.upload.currentDone',
      doneTitle: 's3.upload.modalDoneTitle',
      doneWithErrors: 's3.upload.modalDoneWithErrors'
    };
    el.uploadCurrent.disabled = true;
    if (el.uploadLocal) el.uploadLocal.disabled = true;
    el.refresh.disabled = true;
    if (PM) PM.open(total, uploadKeys);
    try {
      await CS.ensureLoaded();
      const client = CS.buildClient(cfg);
      const basePrefix = cfg.prefix ? cfg.prefix + '/' : '';
      let done = 0;
      for (const file of files) {
        const name = file.name || ('photo-' + Date.now() + '.jpg');
        if (PM) PM.render(done, name);
        try {
          // Thumbnail first — if the source can't be decoded we fail before
          // pushing the original up, so the bucket never holds an original-
          // without-thumbnail (gallery list keys off `_thumbs/`).
          const thumb = await makeThumbForUpload(file);
          await CS.putObject(client, cfg.endpoint, basePrefix + name, file);
          await CS.putObject(client, cfg.endpoint, basePrefix + THUMB_PREFIX + name + '.jpg', thumb);
        } catch (err) {
          console.warn('[s3] upload failed for', name, err);
          errors.push(name + ': ' + CS.describeError(err));
        }
        done++;
        if (PM) PM.render(done, name);
      }
      if (PM) PM.done(errors);
      const ok = total - errors.length;
      setStatus('status.s3UploadDone', errors.length ? 'err' : null, { n: ok });
      setTimeout(() => setStatus('status.ready'), 2500);
      await refreshGallery();
    } catch (err) {
      const msg = CS.describeError(err);
      if (PM) PM.done([msg]);
      setStatus('status.s3UploadFail', 'err', { msg });
    } finally {
      el.uploadCurrent.disabled = false;
      if (el.uploadLocal) el.uploadLocal.disabled = false;
      el.refresh.disabled = false;
    }
  }

  // ── Upload current rail ─────────────────────────────────────────────────
  el.uploadCurrent.addEventListener('click', () => {
    const files = state.files.map((entry) => entry.file).filter(Boolean);
    uploadFiles(files);
  });

  // ── Upload from local disk (no rail involvement) ────────────────────────
  if (el.uploadLocal && el.localInput) {
    el.uploadLocal.addEventListener('click', () => {
      // Reset so picking the same files twice fires `change` both times.
      el.localInput.value = '';
      el.localInput.click();
    });
    el.localInput.addEventListener('change', () => {
      const picked = Array.from(el.localInput.files || []);
      el.localInput.value = '';
      if (picked.length) uploadFiles(picked);
    });
  }

  // ── Gallery list + render ───────────────────────────────────────────────
  async function refreshGallery() {
    const cfg = liveCfg || loadFromStorage() || readForm();
    if (!CS.isUsable(cfg)) {
      el.galleryStatus.textContent = T('status.s3MissingFields');
      return;
    }
    el.galleryStatus.textContent = T('status.s3Listing');
    el.refresh.disabled = true;
    try {
      await CS.ensureLoaded();
      const client = CS.buildClient(cfg);
      const basePrefix = cfg.prefix ? cfg.prefix + '/' : '';
      // List the whole prefix (one round-trip, paginated internally) and
      // split into originals + thumbs. The `size` field on each item must
      // reflect the *original* photo, not the 480px thumbnail, so the
      // lightbox footer reports something meaningful when the user is
      // about to download. Items without a matching thumbnail are hidden
      // — we never generated one for them, so they don't belong on the
      // grid (was the prior behavior; preserved).
      const all = await CS.listObjects(client, cfg.endpoint, basePrefix, { maxKeys: 1000 });
      // Clear previous blob URLs to avoid leaks across multiple refreshes.
      thumbBlobUrls.forEach((u) => URL.revokeObjectURL(u));
      thumbBlobUrls.length = 0;
      const thumbPrefix = basePrefix + THUMB_PREFIX;
      const thumbBySource = new Map(); // origKey → { key, size, etag }
      const originals = [];
      for (const it of all) {
        if (it.size <= 0) continue;
        if (it.key.startsWith(thumbPrefix)) {
          const fileName = it.key.slice(thumbPrefix.length).replace(/\.jpg$/i, '');
          thumbBySource.set(basePrefix + fileName, it);
        } else if (it.key.startsWith(basePrefix)) {
          originals.push(it);
        }
      }
      gallery = originals
        .filter((it) => thumbBySource.has(it.key))
        .map((it) => {
          const thumb = thumbBySource.get(it.key);
          const fileName = it.key.slice(basePrefix.length);
          return {
            thumbKey: thumb.key,
            origKey: it.key,
            name: fileName,
            size: it.size,        // original photo bytes (was thumb size; bug fix)
            thumbSize: thumb.size,
            etag: it.etag,
            thumbUrl: '',
            selected: false
          };
        });
      // Sort newest-first by file name (timestamps in EXIF flow as suffixes
      // for many cameras; for non-camera names fall back to lexicographic).
      gallery.sort((a, b) => b.name.localeCompare(a.name));
      renderGallery();
      el.galleryStatus.textContent = gallery.length
        ? T('status.s3ListDone', { n: gallery.length })
        : T('status.s3ListEmpty');
      // Fetch thumbnails in parallel-ish (the browser will queue them anyway).
      gallery.forEach(async (item) => {
        try {
          const { blob } = await CS.getObject(client, cfg.endpoint, item.thumbKey);
          const url = URL.createObjectURL(blob);
          thumbBlobUrls.push(url);
          item.thumbUrl = url;
          const img = el.galleryGrid.querySelector('[data-key="' + CSS.escape(item.thumbKey) + '"] img');
          if (img) img.src = url;
        } catch (err) {
          console.warn('[s3] thumb fetch failed', item.thumbKey, err);
        }
      });
    } catch (err) {
      const msg = CS.describeError(err);
      el.galleryStatus.textContent = msg;
      setStatus('status.s3TestFail', 'err', { msg });
    } finally {
      el.refresh.disabled = false;
    }
  }

  // Two distinct click targets per cell so users get fast browse + selection:
  //   • cell body → open lightbox (large preview, navigation, hi-fi review)
  //   • cell checkbox → toggle selected (no lightbox)
  // The checkbox is also surfaced inside the lightbox so users can decide
  // after looking at the original.
  function renderGallery() {
    el.galleryGrid.innerHTML = '';
    if (gallery.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'gallery-empty';
      empty.textContent = T('status.s3ListEmpty');
      el.galleryGrid.appendChild(empty);
      updateSelectedCount();
      return;
    }
    gallery.forEach((item, idx) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'gallery-cell';
      cell.setAttribute('aria-selected', item.selected ? 'true' : 'false');
      cell.dataset.key = item.thumbKey;
      cell.dataset.idx = String(idx);
      cell.title = item.name;
      const img = document.createElement('img');
      img.alt = item.name;
      if (item.thumbUrl) img.src = item.thumbUrl;
      const label = document.createElement('span');
      label.className = 'gallery-cell-name';
      label.textContent = item.name;
      const check = document.createElement('span');
      check.className = 'gallery-cell-checkbox';
      check.textContent = '✓';
      check.setAttribute('role', 'checkbox');
      check.setAttribute('aria-checked', item.selected ? 'true' : 'false');
      check.title = T('gallery.lightboxSelect');
      cell.appendChild(img);
      cell.appendChild(label);
      cell.appendChild(check);
      check.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSelectedAt(idx);
      });
      cell.addEventListener('click', () => openLightbox(idx));
      el.galleryGrid.appendChild(cell);
    });
    updateSelectedCount();
  }

  function toggleSelectedAt(idx) {
    const item = gallery[idx];
    if (!item) return;
    item.selected = !item.selected;
    const cell = el.galleryGrid.querySelector('[data-idx="' + idx + '"]');
    if (cell) {
      cell.setAttribute('aria-selected', item.selected ? 'true' : 'false');
      const cb = cell.querySelector('.gallery-cell-checkbox');
      if (cb) cb.setAttribute('aria-checked', item.selected ? 'true' : 'false');
    }
    updateSelectedCount();
  }

  function updateSelectedCount() {
    const n = gallery.filter((g) => g.selected).length;
    el.loadSelected.disabled = n === 0;
    if (el.downloadSelected) el.downloadSelected.disabled = n === 0;
    el.galleryCount.textContent = n === 0 ? T('s3.noneSelected') : T('status.s3CountSelected', { n });
  }

  // ── Lightbox ────────────────────────────────────────────────────────────
  // Shows the thumbnail instantly (already in cache), then fetches the
  // original via signed GET and swaps the <img src> when it lands. Blob URL
  // for the original is revoked on next nav / close so we don't leak.
  function openLightbox(idx) {
    if (idx < 0 || idx >= gallery.length) return;
    lightboxIdx = idx;
    paintLightboxFor(gallery[idx]);
    if (el.lightbox) el.lightbox.hidden = false;
    // Focus the close button so screen readers / keyboard users land in the
    // overlay; arrow keys are bound at document level via onGalleryKeydown.
    if (el.lightboxClose) el.lightboxClose.focus();
  }

  function closeLightbox() {
    lightboxIdx = -1;
    if (lightboxOriginalUrl) {
      URL.revokeObjectURL(lightboxOriginalUrl);
      lightboxOriginalUrl = null;
    }
    if (el.lightbox) el.lightbox.hidden = true;
    if (el.lightboxImg) el.lightboxImg.removeAttribute('src');
  }

  function navLightbox(dir) {
    if (gallery.length === 0 || lightboxIdx < 0) return;
    const next = (lightboxIdx + dir + gallery.length) % gallery.length;
    openLightbox(next);
  }

  function paintLightboxFor(item) {
    if (!item) return;
    // Revoke previous original blob URL — we're switching photos.
    if (lightboxOriginalUrl) {
      URL.revokeObjectURL(lightboxOriginalUrl);
      lightboxOriginalUrl = null;
    }
    if (el.lightboxImg) {
      el.lightboxImg.src = item.thumbUrl || '';
      el.lightboxImg.alt = item.name;
    }
    if (el.lightboxName) el.lightboxName.textContent = item.name;
    if (el.lightboxSize) el.lightboxSize.textContent = formatBytes(item.size);
    if (el.lightboxLoading) el.lightboxLoading.hidden = !item.thumbUrl;
    paintLightboxSelectState();
    // Fetch the original asynchronously and swap. Track the idx-at-request
    // time so a fast nav doesn't overwrite the current view with a stale
    // original.
    const requestedIdx = lightboxIdx;
    const cfg = liveCfg || loadFromStorage();
    if (!CS.isUsable(cfg)) return;
    if (!lightboxClient) {
      try { lightboxClient = CS.buildClient(cfg); }
      catch (err) { console.warn('[s3] lightbox client failed', err); return; }
    }
    if (el.lightboxLoading) {
      el.lightboxLoading.hidden = false;
      el.lightboxLoading.textContent = T('gallery.lightboxLoading');
    }
    CS.getObject(lightboxClient, cfg.endpoint, item.origKey).then((got) => {
      if (requestedIdx !== lightboxIdx) return; // user navigated away
      lightboxOriginalUrl = URL.createObjectURL(got.blob);
      if (el.lightboxImg) el.lightboxImg.src = lightboxOriginalUrl;
      if (el.lightboxLoading) el.lightboxLoading.hidden = true;
    }).catch((err) => {
      console.warn('[s3] original fetch failed', item.origKey, err);
      if (requestedIdx !== lightboxIdx) return;
      if (el.lightboxLoading) {
        el.lightboxLoading.hidden = false;
        el.lightboxLoading.textContent = CS.describeError(err);
      }
    });
  }

  function paintLightboxSelectState() {
    if (lightboxIdx < 0 || !el.lightboxToggleSelect) return;
    const item = gallery[lightboxIdx];
    if (!item) return;
    const sel = !!item.selected;
    el.lightboxToggleSelect.setAttribute('aria-pressed', sel ? 'true' : 'false');
    el.lightboxToggleSelect.textContent = sel
      ? T('gallery.lightboxSelected')
      : T('gallery.lightboxSelect');
  }

  function formatBytes(n) {
    if (!n || n < 1024) return (n || 0) + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }

  if (el.lightboxClose) el.lightboxClose.addEventListener('click', closeLightbox);
  if (el.lightboxPrev) el.lightboxPrev.addEventListener('click', () => navLightbox(-1));
  if (el.lightboxNext) el.lightboxNext.addEventListener('click', () => navLightbox(1));
  if (el.lightboxToggleSelect) {
    el.lightboxToggleSelect.addEventListener('click', () => {
      if (lightboxIdx < 0) return;
      toggleSelectedAt(lightboxIdx);
      paintLightboxSelectState();
    });
  }
  if (el.lightboxDownload) {
    el.lightboxDownload.addEventListener('click', () => {
      if (lightboxIdx < 0) return;
      downloadOne(gallery[lightboxIdx]);
    });
  }
  // Lightbox backdrop click closes — except clicks on the image itself or
  // on the nav buttons / footer, which keep it open.
  if (el.lightbox) {
    el.lightbox.addEventListener('click', (e) => {
      if (e.target === el.lightbox) closeLightbox();
    });
  }

  // ── Download to local ──────────────────────────────────────────────────
  // Two surfaces. Single download = lightbox "Download" button — reuses
  // the original blob already in memory if the lightbox finished loading
  // it, otherwise re-GETs. Batch download = toolbar "Download selected" —
  // packs every selected pick into a ZIP via JSZip + uses ProgressModal
  // for the per-file progress (parallel to upload flow's UX). Single-pick
  // selections short-circuit straight to downloadOne to avoid a 1-entry
  // ZIP that nobody asked for.
  async function downloadOne(item) {
    if (!item) return;
    const cfg = liveCfg || loadFromStorage();
    if (!CS.isUsable(cfg)) {
      setStatus('status.s3MissingFields', 'err');
      setTimeout(() => setStatus('status.ready'), 2000);
      return;
    }
    // Lightbox path: if the original is already loaded into a blob URL,
    // download it directly without a second GET — instant for users who
    // browsed before deciding.
    if (lightboxIdx >= 0 && gallery[lightboxIdx] === item && lightboxOriginalUrl) {
      const a = document.createElement('a');
      a.href = lightboxOriginalUrl;
      a.download = item.name;
      a.click();
      setStatus('status.s3DownloadDone', null, { name: item.name });
      setTimeout(() => setStatus('status.ready'), 1500);
      return;
    }
    try {
      await CS.ensureLoaded();
      const client = CS.buildClient(cfg);
      setStatus('status.s3Downloading', 'busy', { name: item.name });
      const got = await CS.getObject(client, cfg.endpoint, item.origKey);
      window.Exporter.downloadBlob(got.blob, item.name);
      setStatus('status.s3DownloadDone', null, { name: item.name });
      setTimeout(() => setStatus('status.ready'), 1500);
    } catch (err) {
      setStatus('status.s3DownloadFail', 'err', { msg: CS.describeError(err) });
    }
  }

  async function downloadSelected() {
    const picks = gallery.filter((g) => g.selected);
    if (picks.length === 0) return;
    if (picks.length === 1) { await downloadOne(picks[0]); return; }
    const cfg = liveCfg || loadFromStorage();
    if (!CS.isUsable(cfg)) return;
    if (!window.JSZip) {
      setStatus('status.s3DownloadFail', 'err', { msg: 'JSZip not loaded' });
      return;
    }
    const PM = window.ProgressModal;
    const total = picks.length;
    const errors = [];
    const downloadKeys = {
      title: 's3.download.modalTitle',
      stageRender: 's3.download.stageDownload',
      stagePack: 's3.download.stagePack',
      stageDone: 's3.download.stageDone',
      currentEmpty: 's3.download.currentEmpty',
      currentPack: 's3.download.currentPack',
      currentDone: 's3.download.currentDone',
      doneTitle: 's3.download.modalDoneTitle',
      doneWithErrors: 's3.download.modalDoneWithErrors'
    };
    el.downloadSelected.disabled = true;
    if (PM) PM.open(total, downloadKeys);
    try {
      await CS.ensureLoaded();
      const client = CS.buildClient(cfg);
      const zip = new window.JSZip();
      let done = 0;
      for (const pick of picks) {
        if (PM) PM.render(done, pick.name);
        try {
          const got = await CS.getObject(client, cfg.endpoint, pick.origKey);
          // STORE (no deflate) — input is mostly already-compressed JPEG /
          // HEIC bytes, deflate buys ~1-2% at high CPU cost.
          zip.file(pick.name, got.blob, { compression: 'STORE' });
        } catch (err) {
          console.warn('[s3] download failed for', pick.origKey, err);
          errors.push(pick.name + ': ' + CS.describeError(err));
        }
        done++;
        if (PM) PM.render(done, pick.name);
      }
      if (PM) PM.pack();
      const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const zipName = (cfg.bucket || 'cloud') + '-' + stamp + '.zip';
      window.Exporter.downloadBlob(zipBlob, zipName);
      if (PM) PM.done(errors);
      const ok = total - errors.length;
      setStatus('status.s3DownloadDone', errors.length ? 'err' : null, { name: zipName + ' · ' + ok + '/' + total });
      setTimeout(() => setStatus('status.ready'), 2500);
    } catch (err) {
      const msg = CS.describeError(err);
      if (PM) PM.done([msg]);
      setStatus('status.s3DownloadFail', 'err', { msg });
    } finally {
      el.downloadSelected.disabled = false;
    }
  }

  if (el.downloadSelected) {
    el.downloadSelected.addEventListener('click', () => {
      downloadSelected().catch((err) => console.warn('[s3] download batch', err));
    });
  }

  el.refresh.addEventListener('click', () => {
    refreshGallery().catch((err) => console.warn('[s3] refresh', err));
  });

  // ── Load selected → rail via mergeFiles ─────────────────────────────────
  el.loadSelected.addEventListener('click', async () => {
    const cfg = liveCfg || loadFromStorage();
    const picks = gallery.filter((g) => g.selected);
    if (!cfg || picks.length === 0) return;
    el.loadSelected.disabled = true;
    try {
      await CS.ensureLoaded();
      const client = CS.buildClient(cfg);
      const files = [];
      const errors = [];
      let done = 0;
      // Mint a single base timestamp per click so files within one batch get
      // monotonically-increasing lastModified values. mergeFiles dedups on
      // `name + size + lastModified`; using Date.now() per pick guarantees a
      // fresh dedup key on every "Load selected" click — so re-loading the
      // same photo on purpose isn't silently dropped, and the user always
      // sees rail count increase.
      const baseTs = Date.now();
      for (let i = 0; i < picks.length; i++) {
        const pick = picks[i];
        setStatus('status.s3LoadingRemote', 'busy', { done: done + 1, total: picks.length });
        try {
          const got = await CS.getObject(client, cfg.endpoint, pick.origKey);
          const file = new File([got.blob], pick.name, {
            type: got.contentType || got.blob.type || 'image/jpeg',
            lastModified: baseTs + i
          });
          files.push(file);
        } catch (err) {
          console.warn('[s3] get failed for', pick.origKey, err);
          errors.push({ name: pick.name, msg: CS.describeError(err) });
        }
        done++;
      }
      if (files.length === 0) {
        const msg = errors.length
          ? (errors[0].name + ': ' + errors[0].msg)
          : 'GET returned no files';
        setStatus('status.s3UploadFail', 'err', { msg });
        return;
      }
      // Mirror the local-file import pattern at app.js:1110-1112 — without
      // selectFile() the rail updates but the canvas keeps showing whatever
      // was active before, which looks like "nothing happened" to the user.
      const prevLen = state.files.length;
      await mergeFiles(files);
      if (state.files.length > prevLen) await selectFile(prevLen);
      const added = state.files.length - prevLen;
      if (errors.length) {
        const detail = errors.length === 1
          ? errors[0].name + ': ' + errors[0].msg
          : T('status.decodeFailMany', { n: errors.length });
        setStatus(detail, 'err');
      } else {
        setStatus('status.s3LoadedRemote', null, { n: added });
      }
      setTimeout(() => setStatus('status.ready'), 2500);
      closeModal();
    } catch (err) {
      const msg = CS.describeError(err);
      setStatus('status.s3UploadFail', 'err', { msg });
    } finally {
      el.loadSelected.disabled = false;
      updateSelectedCount();
    }
  });

  // ── Boot: rehydrate from localStorage; then check share-URL hash ──────
  const stored = loadFromStorage();
  if (stored) {
    state.s3Config = stored;
    liveCfg = stored;
    writeForm(stored);
  } else {
    setProvider('aws');
  }
  // Repaint the setup guide on locale flip so a mid-modal language toggle
  // doesn't strand the user on a stale-language walkthrough.
  if (window.I18N && typeof window.I18N.onChange === 'function') {
    window.I18N.onChange(() => renderGuide(formCfg.provider));
  }
  applyHashS3IfPresent();
})();

// ────────────────────────────────────────────────────────────────────────
// COMPOSE MODE (1.1+) — direct-manipulation surface unifying crop /
// rotation / per-edge padding on a darkroom-aesthetic full-bleed dialog.
// Reuses CR.renderPreview on the inner canvas for the live composition;
// layers a ghost <img> behind so the user sees the full source with the
// framed-out portion at 30% — the "what's getting clipped" affordance.
// Bench at the bottom is always live and editable. Apply commits the
// working cfg back to activeCfg + triggers a main-canvas re-render.
// ────────────────────────────────────────────────────────────────────────
(() => {
  const dlg = document.getElementById('compose-modal');
  if (!dlg) return;

  const COMPOSE = {
    open: false,
    cfg: null,            // working cfg — mutated by handles, committed on Apply
    origCfg: null,        // snapshot for Cancel
    bm: null,             // active photo bitmap
    sourceW: 0, sourceH: 0,
    ghostUrl: null,       // blob URL for the ghost <img>
    focus: 'crop',        // dial selection: crop | pad | rot | all
    rotSnap: 0,           // shadow rotation snapped to nearest 90°
    layout: null,         // last computed layout (R.computeLayout output)
    stageScale: 1,        // scene → stage pixel scale
    renderRAF: 0,
    minPad: null,         // current frame's minPadding (or null)
    isDragging: false,    // any handle / pan drag in flight — drives low-res render
    settleTimer: 0        // scheduled hi-res re-render after drag ends
  };
  // Resolution presets — at-rest preview matches main UI's PREVIEW_SCALE
  // (0.5); during drag we drop to 0.2 so the canvas pixel area is ~1/6,
  // bringing per-frame render cost from ~50-80ms down to ~8-12ms for
  // smooth 60fps feedback. cfg values are resolution-independent so the
  // geometry stays correct across scales — only sharpness changes.
  const COMPOSE_SCALE_REST = 0.5;
  const COMPOSE_SCALE_DRAG = 0.2;

  // ── elements ────────────────────────────────────────────────────────
  const el = {
    trigger: document.getElementById('compose-trigger'),
    chipValue: document.getElementById('lookbar-compose-value'),
    closeBtn: document.getElementById('compose-close'),
    resetAll: document.getElementById('compose-reset-all'),
    apply: document.getElementById('compose-apply'),
    cancel: document.getElementById('compose-cancel'),
    stage: document.getElementById('compose-stage'),
    stageInner: document.getElementById('compose-stage-inner'),
    ghost: document.getElementById('compose-ghost-img'),
    canvas: document.getElementById('compose-canvas'),
    handles: document.getElementById('compose-handles'),
    // Rotation slider bar (replaces the v1.1.0 photo-overlay knob)
    rotBar: document.getElementById('compose-rot-bar'),
    rotSlider: document.getElementById('compose-rot-slider'),
    rotBarVal: document.getElementById('compose-rot-bar-val'),
    rotCcw: document.getElementById('compose-rot-ccw'),
    rotCw: document.getElementById('compose-rot-cw'),
    rotZero: document.getElementById('compose-rot-zero'),
    hint: document.getElementById('compose-hint'),
    hud: document.getElementById('compose-hud'),
    hudKey: document.getElementById('compose-hud-key'),
    hudVal: document.getElementById('compose-hud-val'),
    hudUnit: document.getElementById('compose-hud-unit'),
    hudAux: document.getElementById('compose-hud-aux'),
    title: document.getElementById('compose-modal-title'),
    meta: document.getElementById('compose-meta'),
    leaderNum: document.getElementById('compose-leader-num'),
    leaderDate: document.getElementById('compose-leader-date'),
    leaderDim: document.getElementById('compose-leader-dim'),
    benchCropW: document.getElementById('bench-crop-w'),
    benchCropH: document.getElementById('bench-crop-h'),
    benchCropRatio: document.getElementById('bench-crop-ratio'),
    benchPadT: document.getElementById('bench-pad-t'),
    benchPadR: document.getElementById('bench-pad-r'),
    benchPadB: document.getElementById('bench-pad-b'),
    benchPadL: document.getElementById('bench-pad-l'),
    benchRotDeg: document.getElementById('bench-rot-deg'),
    benchRotSnap: document.getElementById('bench-rot-snap')
  };

  // ── trigger gating: button is disabled when no photo is loaded ─────
  function refreshTriggerEnabled() {
    if (!el.trigger) return;
    const has = state.activeIdx >= 0 && state.files[state.activeIdx];
    el.trigger.disabled = !has;
    el.trigger.dataset.empty = has ? 'false' : 'true';
    // Surface a one-line summary in the chip value: "Crop · Rot 90° · Pad"
    if (has) {
      const c = state.files[state.activeIdx].cfg;
      const parts = [];
      if (c.crop && (c.crop.w < 0.999 || c.crop.h < 0.999)) parts.push(T('compose.tag.crop'));
      if (c.rotation && Math.abs(c.rotation) > 0.5) parts.push(T('compose.tag.rot') + ' ' + Math.round(c.rotation) + '°');
      if (c.paddingTop != null || c.paddingRight != null || c.paddingBottom != null || c.paddingLeft != null) parts.push(T('compose.tag.pad'));
      el.chipValue.textContent = parts.length ? parts.join(' · ') : T('compose.empty');
    } else {
      el.chipValue.textContent = T('compose.empty');
    }
  }
  // Photo-switch / rail-mutate triggers a chip refresh. MutationObserver on
  // the rail is cheap and avoids invasive edits to selectFile() — the rail
  // mutates on add/remove/select via class toggles, which the observer sees.
  const rail = document.getElementById('thumb-rail');
  if (rail) {
    const obs = new MutationObserver(refreshTriggerEnabled);
    obs.observe(rail, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-active'] });
  }
  document.addEventListener('DOMContentLoaded', refreshTriggerEnabled);

  // ── working-cfg helpers ─────────────────────────────────────────────
  // Subset of cfg fields the Compose mode reads / writes. Other fields
  // pass through untouched to renderPreview.
  function snapshotCfg(src) {
    return {
      ...src,
      crop: src.crop ? { ...src.crop } : null,
      showFields: { ...src.showFields },
      customLogo: src.customLogo ? { ...src.customLogo } : null,
      customBg: src.customBg ? { ...src.customBg } : null,
      collage: src.collage ? { ...src.collage } : null,
      exifOverride: { ...(src.exifOverride || {}) }
    };
  }
  function commitWorkingToActive() {
    const active = state.files[state.activeIdx];
    if (!active) return;
    const target = active.cfg;
    const w = COMPOSE.cfg;
    target.crop = w.crop ? { ...w.crop } : null;
    target.rotation = w.rotation || 0;
    target.paddingTop = w.paddingTop;
    target.paddingRight = w.paddingRight;
    target.paddingBottom = w.paddingBottom;
    target.paddingLeft = w.paddingLeft;
  }

  // ── ratio formatter ─────────────────────────────────────────────────
  function simplifyRatio(w, h) {
    if (!w || !h) return '—';
    const g = (a, b) => b ? g(b, a % b) : a;
    const d = g(w, h);
    const a = w / d, b = h / d;
    if (a < 40 && b < 40) return `${a}:${b}`;
    const r = w / h;
    const cands = [[1,1],[3,2],[2,3],[4,3],[3,4],[16,9],[9,16],[4,5],[5,4],[5,7],[7,5],[21,9],[9,21]];
    let best = cands[0], bestD = Infinity;
    cands.forEach(c => { const dd = Math.abs(c[0]/c[1] - r); if (dd < bestD) { bestD = dd; best = c; } });
    return `≈${best[0]}:${best[1]}`;
  }

  // Active customScale for the current render — flips between REST and DRAG
  // values driven by the isDragging flag. Same value is used both here for
  // layout math AND passed to CR.renderPreview so the painted canvas and
  // the JS-computed handle positions reference the same scale space.
  function currentScale() {
    return COMPOSE.isDragging ? COMPOSE_SCALE_DRAG : COMPOSE_SCALE_REST;
  }

  // ── layout computation (mirrors buildLayoutAndCaption's relevant math) ─
  function computeComposeLayout(stageW, stageH) {
    const cfg = COMPOSE.cfg;
    if (!cfg || !COMPOSE.bm) return null;
    const frame = R.resolveFrame(cfg.frame);
    const rot = ((Number(cfg.rotation) || 0) % 360 + 360) % 360;
    const safe = R.inscribedSafeArea(COMPOSE.bm, rot);
    const cropW = cfg.crop && cfg.crop.w > 0 ? cfg.crop.w : 1;
    const cropH = cfg.crop && cfg.crop.h > 0 ? cfg.crop.h : 1;
    const meta = { width: safe.w * cropW, height: safe.h * cropH };
    const layoutOpts = {
      aspect: cfg.aspect,
      padding: cfg.padding,
      captionHeight: cfg.captionHeight,
      ...frame.layout,
      customScale: currentScale()
    };
    if (cfg.radiusOverride != null) layoutOpts.radiusOverride = cfg.radiusOverride;
    if (cfg.captionForceOverlay) layoutOpts.captionForceOverlay = true;
    if (cfg.captionOverlayTextLift != null) layoutOpts.captionOverlayTextLift = cfg.captionOverlayTextLift;
    if (cfg.paddingTop != null) layoutOpts.paddingTop = cfg.paddingTop;
    if (cfg.paddingRight != null) layoutOpts.paddingRight = cfg.paddingRight;
    if (cfg.paddingBottom != null) layoutOpts.paddingBottom = cfg.paddingBottom;
    if (cfg.paddingLeft != null) layoutOpts.paddingLeft = cfg.paddingLeft;
    const layout = R.computeLayout(meta, layoutOpts);

    // Scene scale: fit canvas into stage with margin. Account for the ghost
    // potentially extending beyond canvas when crop < 1 (we want the full
    // source plus a little air around it). Use the larger of (canvas dims,
    // estimated ghost dims) as the scene bounding box.
    // R.computeLayout exposes the foreground rect as TOP-LEVEL fgLeft/fgTop/
    // fgW/fgH (not a nested layout.fg.{x,y,w,h}) — accessing the latter
    // returned undefined and threw on .w. Bug found via chrome-devtools MCP
    // console diagnostics after the user reported "everything is broken".
    const ghostScale = 1; // ghost lives in same scene scale as canvas
    const fullDispW = layout.fgW / cropW;
    const fullDispH = layout.fgH / cropH;
    // Account for rotation expansion of the ghost bbox
    const rad = rot * Math.PI / 180;
    const ghostBboxW = Math.abs(fullDispW * Math.cos(rad)) + Math.abs(fullDispH * Math.sin(rad));
    const ghostBboxH = Math.abs(fullDispW * Math.sin(rad)) + Math.abs(fullDispH * Math.cos(rad));
    const sceneW = Math.max(layout.canvas.W, ghostBboxW + 60);
    const sceneH = Math.max(layout.canvas.H, ghostBboxH + 60);
    // margin: keep at least 80px breathing room around the canvas so the user
    // always sees stage background framing the composition — without this, a
    // 16:9 / landscape canvas fills the entire stage edge-to-edge and the
    // "framed photo as a discrete element" intent disappears visually.
    const margin = 90;
    const fitS = Math.min((stageW - margin * 2) / sceneW, (stageH - margin * 2) / sceneH);
    // Hard cap at 0.85 = canvas never takes >85% of either stage dimension.
    // Lower bound 0.15 = even if stage hasn't laid out yet, we still produce
    // a visible canvas (better tiny than invisible).
    return { layout, stageScale: Math.max(0.15, Math.min(0.85, fitS)) };
  }

  // ── ghost <img> positioning ─────────────────────────────────────────
  function updateGhost() {
    const cfg = COMPOSE.cfg;
    const layout = COMPOSE.layout;
    if (!cfg || !layout || !COMPOSE.ghostUrl) return;
    const ss = COMPOSE.stageScale;
    const fgX = layout.fgLeft * ss, fgY = layout.fgTop * ss;
    const fgW = layout.fgW * ss, fgH = layout.fgH * ss;
    const crop = cfg.crop || { x: 0, y: 0, w: 1, h: 1 };
    const rot = ((Number(cfg.rotation) || 0) % 360 + 360) % 360;

    // Full uncropped source display dims (in stage coords) such that the
    // cropped portion matches fg. Rotation around fg center will spin the
    // ghost in place; the cropped portion stays anchored to fg.
    const fullW = fgW / Math.max(crop.w, 0.01);
    const fullH = fgH / Math.max(crop.h, 0.01);
    const ghostX = fgX - crop.x * fullW;
    const ghostY = fgY - crop.y * fullH;

    el.ghost.style.width = fullW + 'px';
    el.ghost.style.height = fullH + 'px';
    el.ghost.style.left = ghostX + 'px';
    el.ghost.style.top = ghostY + 'px';
    if (rot) {
      const fgCenterX = fgX + fgW / 2;
      const fgCenterY = fgY + fgH / 2;
      el.ghost.style.transform = `rotate(${rot}deg)`;
      el.ghost.style.transformOrigin = `${fgCenterX - ghostX}px ${fgCenterY - ghostY}px`;
    } else {
      el.ghost.style.transform = '';
      el.ghost.style.transformOrigin = '';
    }
  }

  // ── handle positioning ──────────────────────────────────────────────
  function updateHandles() {
    const layout = COMPOSE.layout;
    if (!layout) return;
    const ss = COMPOSE.stageScale;
    const fgX = layout.fgLeft * ss, fgY = layout.fgTop * ss;
    const fgW = layout.fgW * ss, fgH = layout.fgH * ss;
    const cvW = layout.canvas.W * ss, cvH = layout.canvas.H * ss;

    // Position handles via `transform: translate3d()` instead of style.left/
    // top — promotes each handle to its own compositor layer so positioning
    // updates skip layout + paint and stay GPU-side. Pre-existing transform
    // patterns (translate(-50%,-50%) on edge pins / pad handles) are baked
    // into the translate3d offsets here. left/top remain 0 in CSS.
    const set = (sel, x, y, baseAdjustX, baseAdjustY) => {
      const h = el.handles.querySelector(`[data-h="${sel}"]`);
      if (!h) return;
      const tx = x + (baseAdjustX || 0);
      const ty = y + (baseAdjustY || 0);
      h.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
    };
    // Crop corner brackets are 22×22, anchored at fg corner so subtract 11
    // to center the corner of the bracket on the corner of fg.
    set('crop:tl', fgX - 11, fgY - 11);
    set('crop:tr', fgX + fgW - 11, fgY - 11);
    set('crop:br', fgX + fgW - 11, fgY + fgH - 11);
    set('crop:bl', fgX - 11, fgY + fgH - 11);
    // Crop edge mid-pins: CSS originally used translate(-50%,-50%) to center
    // the pin on its anchor — replicated here as an 11-px offset (half of
    // the 22-px hit area) in the transform.
    set('crop:t', fgX + fgW / 2, fgY,            -11, -11);
    set('crop:b', fgX + fgW / 2, fgY + fgH,      -11, -11);
    set('crop:l', fgX,           fgY + fgH / 2,  -11, -11);
    set('crop:r', fgX + fgW,     fgY + fgH / 2,  -11, -11);
    // Padding handles: hit area 40×14 (horiz) or 14×40 (vert). Center on
    // anchor by subtracting half-dim per axis.
    set('pad:top',    fgX + fgW / 2, fgY / 2,                       -20, -7);
    set('pad:bottom', fgX + fgW / 2, fgY + fgH + (cvH - fgY - fgH) / 2, -20, -7);
    set('pad:left',   fgX / 2,                  fgY + fgH / 2,         -7, -20);
    set('pad:right',  fgX + fgW + (cvW - fgX - fgW) / 2, fgY + fgH / 2, -7, -20);
    // Rotation slider replaces the v1.1.0 knob — no per-render handle
    // positioning needed; the slider is in the bottom rot-bar, not on the
    // photo overlay.

    // Center crosshair (24×24, translate(-50%,-50%) anchor)
    const cc = el.handles.querySelector('.compose-center-cross');
    if (cc) {
      cc.style.transform = `translate3d(${fgX + fgW / 2 - 12}px, ${fgY + fgH / 2 - 12}px, 0)`;
    }
    // min-padding warning bands per edge
    const mp = COMPOSE.minPad || {};
    const setWarn = (edge, on, bandPx) => {
      const w = el.handles.querySelector(`.compose-minwarn[data-edge="${edge}"]`);
      if (!w) return;
      w.classList.toggle('is-on', !!on);
      if (!on) return;
      if (edge === 'top')    { w.style.left = fgX + 'px'; w.style.top = 0; w.style.width = fgW + 'px'; w.style.height = bandPx + 'px'; }
      if (edge === 'bottom') { w.style.left = fgX + 'px'; w.style.top = (cvH - bandPx) + 'px'; w.style.width = fgW + 'px'; w.style.height = bandPx + 'px'; }
      if (edge === 'left')   { w.style.left = 0; w.style.top = fgY + 'px'; w.style.width = bandPx + 'px'; w.style.height = fgH + 'px'; }
      if (edge === 'right')  { w.style.left = (cvW - bandPx) + 'px'; w.style.top = fgY + 'px'; w.style.width = bandPx + 'px'; w.style.height = fgH + 'px'; }
    };
    const cfg = COMPOSE.cfg;
    const effPadTop    = cfg.paddingTop    != null ? cfg.paddingTop    : (cfg.padding + (R.resolveFrame(cfg.frame).layout?.topPaddingBoost || 0));
    const effPadRight  = cfg.paddingRight  != null ? cfg.paddingRight  : cfg.padding;
    const effPadBottom = cfg.paddingBottom != null ? cfg.paddingBottom : (cfg.padding + (R.resolveFrame(cfg.frame).layout?.bottomPaddingBoost || 0));
    const effPadLeft   = cfg.paddingLeft   != null ? cfg.paddingLeft   : cfg.padding;
    setWarn('top',    mp.top    && effPadTop    < mp.top,    (mp.top    || 0) * ss * 0.5);
    setWarn('right',  mp.right  && effPadRight  < mp.right,  (mp.right  || 0) * ss * 0.5);
    setWarn('bottom', mp.bottom && effPadBottom < mp.bottom, (mp.bottom || 0) * ss * 0.5);
    setWarn('left',   mp.left   && effPadLeft   < mp.left,   (mp.left   || 0) * ss * 0.5);
  }

  // ── canvas + ghost render (debounced via rAF) ───────────────────────
  let renderingPreview = false;
  let pendingPreview = false;
  function requestComposeRender() {
    if (!COMPOSE.open) return;
    if (COMPOSE.renderRAF) return;
    COMPOSE.renderRAF = requestAnimationFrame(() => { COMPOSE.renderRAF = 0; doComposeRender(); });
  }
  async function doComposeRender() {
    if (renderingPreview) { pendingPreview = true; return; }
    renderingPreview = true;
    try {
      const stage = el.stage;
      // Dialog layout can lag by 1-2 frames after showModal in some browsers
      // (Safari especially). Fall back to viewport dims if stage hasn't
      // measured yet — the ResizeObserver below will fire a follow-up render
      // once the real dims land.
      const sw = stage.clientWidth || window.innerWidth || 1200;
      const sh = (stage.clientHeight || window.innerHeight) - 0;
      const lr = computeComposeLayout(sw, sh);
      if (!lr) return;
      COMPOSE.layout = lr.layout;
      COMPOSE.stageScale = lr.stageScale;
      // Size canvas to displayed scene
      el.canvas.style.width = (lr.layout.canvas.W * lr.stageScale) + 'px';
      el.canvas.style.height = (lr.layout.canvas.H * lr.stageScale) + 'px';
      el.stageInner.style.width = (lr.layout.canvas.W * lr.stageScale) + 'px';
      el.stageInner.style.height = (lr.layout.canvas.H * lr.stageScale) + 'px';
      // Center stageInner in stage (use absolute positioning)
      const active = state.files[state.activeIdx];
      if (!active) return;
      const cfgProjection = composeProjection(COMPOSE.cfg);
      await CR.renderPreview(el.canvas, {
        file: active.file,
        partnerFiles: active.partnerFiles || [],
        cfg: cfgProjection,
        normExif: buildCurrentExif(),
        logos: state.logos,
        fontFaceCss: state.fontFaceCss,
        customScale: currentScale()
      });
      // Canvas's CSS sometimes gets clobbered when renderPreview internally
      // assigns canvas.width/height (the attribute resets the displayed CSS
      // size to match the drawing buffer in some browsers). Re-apply our
      // scene-fit CSS sizing AFTER the paint to be defensive.
      el.canvas.style.width = (lr.layout.canvas.W * lr.stageScale) + 'px';
      el.canvas.style.height = (lr.layout.canvas.H * lr.stageScale) + 'px';
      // Each helper wrapped in try/catch so one failure doesn't break the
      // others — without this an updateBench throw left handles unpositioned
      // and the user couldn't see what state the dialog was in.
      try { updateGhost(); }   catch (e) { console.error('[compose:ghost]', e); }
      try { updateHandles(); } catch (e) { console.error('[compose:handles]', e); }
      try { updateBench(); }   catch (e) { console.error('[compose:bench]', e); }
    } catch (err) {
      console.error('[compose render]', err);
    } finally {
      renderingPreview = false;
      if (pendingPreview) { pendingPreview = false; requestComposeRender(); }
    }
  }
  // Mirror of doRender's cfg projection
  function composeProjection(c) {
    return {
      aspect: c.aspect, frame: c.frame, template: c.template,
      padding: c.padding,
      paddingTop: c.paddingTop, paddingRight: c.paddingRight,
      paddingBottom: c.paddingBottom, paddingLeft: c.paddingLeft,
      captionHeight: c.captionHeight,
      bgBlur: c.bgBlur, bgBrightness: c.bgBrightness, bgSaturation: c.bgSaturation,
      shadowBlur: c.shadowBlur, shadowOffsetY: c.shadowOffsetY, shadowOpacity: c.shadowOpacity,
      radiusOverride: c.radiusOverride,
      captionForceOverlay: c.captionForceOverlay,
      captionOverlayTextLift: c.captionOverlayTextLift,
      topTemplate: c.topTemplate,
      tornJitter: c.tornJitter, tornStep: c.tornStep, tornEdgeOpacity: c.tornEdgeOpacity,
      filmMfAge: c.filmMfAge,
      showFields: c.showFields,
      customLogo: c.customLogo, customBg: c.customBg,
      collage: c.collage,
      rotation: c.rotation || 0,
      crop: c.crop || null
    };
  }

  // ── bench (state readouts + editable inputs) ───────────────────────
  function updateBench() {
    const cfg = COMPOSE.cfg;
    if (!cfg || !COMPOSE.bm) return;
    const crop = cfg.crop || { x: 0, y: 0, w: 1, h: 1 };
    const rot = ((Number(cfg.rotation) || 0) % 360 + 360) % 360;
    const safe = R.inscribedSafeArea(COMPOSE.bm, rot) || { w: COMPOSE.sourceW, h: COMPOSE.sourceH };
    const cropPxW = Math.round((safe.w || COMPOSE.sourceW || 1) * crop.w);
    const cropPxH = Math.round((safe.h || COMPOSE.sourceH || 1) * crop.h);
    if (document.activeElement !== el.benchCropW) el.benchCropW.value = cropPxW;
    if (document.activeElement !== el.benchCropH) el.benchCropH.value = cropPxH;
    el.benchCropRatio.textContent = simplifyRatio(cropPxW, cropPxH);

    const mp = COMPOSE.minPad || {};
    const frameLayout = R.resolveFrame(cfg.frame).layout || {};
    const effT = cfg.paddingTop    != null ? cfg.paddingTop    : (cfg.padding + (frameLayout.topPaddingBoost || 0));
    const effR = cfg.paddingRight  != null ? cfg.paddingRight  : cfg.padding;
    const effB = cfg.paddingBottom != null ? cfg.paddingBottom : (cfg.padding + (frameLayout.bottomPaddingBoost || 0));
    const effL = cfg.paddingLeft   != null ? cfg.paddingLeft   : cfg.padding;
    if (document.activeElement !== el.benchPadT) el.benchPadT.value = Math.round(effT);
    if (document.activeElement !== el.benchPadR) el.benchPadR.value = Math.round(effR);
    if (document.activeElement !== el.benchPadB) el.benchPadB.value = Math.round(effB);
    if (document.activeElement !== el.benchPadL) el.benchPadL.value = Math.round(effL);
    el.benchPadT.classList.toggle('is-warn', !!(mp.top    && effT < mp.top));
    el.benchPadR.classList.toggle('is-warn', !!(mp.right  && effR < mp.right));
    el.benchPadB.classList.toggle('is-warn', !!(mp.bottom && effB < mp.bottom));
    el.benchPadL.classList.toggle('is-warn', !!(mp.left   && effL < mp.left));

    // Normalize cfg.rotation (any number) into the -180..180 range used by
    // both the bench number input and the slider track. Tiny snap to 0
    // applied at write time, not here.
    const rotRaw = Number(COMPOSE.cfg.rotation) || 0;
    const deg = (((rotRaw + 180) % 360) + 360) % 360 - 180;
    if (document.activeElement !== el.benchRotDeg) {
      el.benchRotDeg.value = Math.abs(deg) < 0.05 ? '0' : deg.toFixed(1).replace(/\.0$/, '');
    }
    const snap = ((Math.round(deg / 90) * 90) % 360 + 360) % 360;
    el.benchRotSnap.textContent = snap + '°';
    // Sync the rot-bar slider + readout when it's not the source of truth
    // for this render (e.g. driven by reset / bench number / ±90 button).
    if (el.rotSlider && document.activeElement !== el.rotSlider) {
      el.rotSlider.value = deg;
    }
    if (el.rotBarVal) {
      el.rotBarVal.textContent = (Math.abs(deg) < 0.05 ? '0' : deg.toFixed(1).replace(/\.0$/, '')) + '°';
    }
  }

  // ── HUD helpers ─────────────────────────────────────────────────────
  function showHud(key, val, unit, aux, x, y, warn) {
    el.hudKey.textContent = key;
    el.hudVal.textContent = val;
    el.hudUnit.textContent = unit || '';
    el.hudAux.textContent = aux || '';
    el.hudAux.classList.toggle('is-warn', !!warn);
    el.hud.style.left = x + 'px';
    el.hud.style.top = y + 'px';
    el.hud.classList.add('is-on');
  }
  function hideHud() { el.hud.classList.remove('is-on'); }

  // Flip isDragging on/off + schedule a hi-res re-render N ms after the
  // drag ends. The settle timer covers the case where the user releases
  // between renders — without it the canvas would be stuck at low-res
  // until something else triggers a re-render.
  function beginDrag() {
    COMPOSE.isDragging = true;
    if (COMPOSE.settleTimer) { clearTimeout(COMPOSE.settleTimer); COMPOSE.settleTimer = 0; }
  }
  function endDrag() {
    COMPOSE.isDragging = false;
    if (COMPOSE.settleTimer) clearTimeout(COMPOSE.settleTimer);
    COMPOSE.settleTimer = setTimeout(() => { if (COMPOSE.open) requestComposeRender(); }, 120);
  }

  // ── drag helpers ────────────────────────────────────────────────────
  function bindDrag(elem, onMove, onUp) {
    elem.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
      e.preventDefault();
      try { elem.setPointerCapture(e.pointerId); } catch {}
      elem.classList.add('is-dragging');
      beginDrag();
      const start = { x: e.clientX, y: e.clientY, cfg: snapshotCfg(COMPOSE.cfg) };
      const move = (ev) => { onMove(ev, start); requestComposeRender(); };
      const up = (ev) => {
        try { elem.releasePointerCapture(e.pointerId); } catch {}
        elem.classList.remove('is-dragging');
        elem.removeEventListener('pointermove', move);
        elem.removeEventListener('pointerup', up);
        elem.removeEventListener('pointercancel', up);
        hideHud();
        endDrag();
        onUp && onUp(ev);
      };
      elem.addEventListener('pointermove', move);
      elem.addEventListener('pointerup', up);
      elem.addEventListener('pointercancel', up);
    });
  }

  // ── Padding handle drags ────────────────────────────────────────────
  function bindPadHandle(side, sign, axis) {
    const h = el.handles.querySelector(`[data-h="pad:${side}"]`);
    if (!h) return;
    bindDrag(h, (e, start) => {
      // Each handle drags inward/outward. Convert pointer delta from
      // scene px → base-1440 px via stageScale and computeLayout's customScale.
      // layout's customScale is 0.5, so layout px = base * 0.5. Stage px = layout * stageScale.
      // → base = stagePx / stageScale / 0.5
      const deltaScene = axis === 'y' ? (e.clientY - start.y) : (e.clientX - start.x);
      const deltaBase = (deltaScene / COMPOSE.stageScale / 0.5) * sign;
      const key = 'padding' + side.charAt(0).toUpperCase() + side.slice(1);
      // Starting value from cfg snapshot; if null, derive effective.
      const frameLayout = R.resolveFrame(start.cfg.frame).layout || {};
      let baseStart = start.cfg[key];
      if (baseStart == null) {
        if (side === 'top')    baseStart = start.cfg.padding + (frameLayout.topPaddingBoost || 0);
        else if (side === 'bottom') baseStart = start.cfg.padding + (frameLayout.bottomPaddingBoost || 0);
        else baseStart = start.cfg.padding;
      }
      const next = Math.max(0, Math.min(300, baseStart + deltaBase));
      COMPOSE.cfg[key] = next;
      // HUD
      const mp = COMPOSE.minPad || {};
      const minV = mp[side] || 0;
      const isWarn = next < minV;
      h.classList.toggle('is-warn', isWarn);
      showHud(
        T('compose.hud.pad') + ' · ' + side.toUpperCase(),
        Math.round(next), 'PX',
        T('compose.hud.min') + ' · ' + minV + (isWarn ? ' · ' + T('compose.hud.below') : ''),
        e.clientX, e.clientY, isWarn
      );
    }, () => { h.classList.remove('is-warn'); });
  }

  // ── Crop corner / edge drags ────────────────────────────────────────
  function bindCropCorner(corner) {
    const h = el.handles.querySelector(`[data-h="crop:${corner}"]`);
    if (!h) return;
    const sx = corner.includes('l') ? -1 : 1;
    const sy = corner.includes('t') ? -1 : 1;
    bindDrag(h, (e, start) => {
      const dxBase = (e.clientX - start.x) / COMPOSE.stageScale / 0.5;
      const dyBase = (e.clientY - start.y) / COMPOSE.stageScale / 0.5;
      // Convert base-px deltas to crop normalized space. crop is normalized
      // in the inscribed safe area; layout's foreground in base px equals
      // safe × crop, so dragging by Δbase corresponds to Δcrop = Δbase / safe.
      const rot = ((Number(start.cfg.rotation) || 0) % 360 + 360) % 360;
      const safe = R.inscribedSafeArea(COMPOSE.bm, rot);
      const startCrop = start.cfg.crop || { x: 0, y: 0, w: 1, h: 1 };
      const dcw = dxBase / safe.w;
      const dch = dyBase / safe.h;
      let c = { ...startCrop };
      if (sx === -1) { const nx = Math.max(0, Math.min(c.x + c.w - 0.05, startCrop.x + dcw)); c.w = startCrop.w + (startCrop.x - nx); c.x = nx; }
      else           { c.w = Math.max(0.05, Math.min(1 - c.x, startCrop.w + dcw)); }
      if (sy === -1) { const ny = Math.max(0, Math.min(c.y + c.h - 0.05, startCrop.y + dch)); c.h = startCrop.h + (startCrop.y - ny); c.y = ny; }
      else           { c.h = Math.max(0.05, Math.min(1 - c.y, startCrop.h + dch)); }
      c.x = Math.max(0, Math.min(1 - 0.05, c.x));
      c.y = Math.max(0, Math.min(1 - 0.05, c.y));
      c.w = Math.max(0.05, Math.min(1 - c.x, c.w));
      c.h = Math.max(0.05, Math.min(1 - c.y, c.h));
      COMPOSE.cfg.crop = (c.x === 0 && c.y === 0 && c.w >= 0.999 && c.h >= 0.999) ? null : c;
      const w = Math.round(safe.w * c.w), hh = Math.round(safe.h * c.h);
      showHud(T('compose.hud.crop'), `${w} × ${hh}`, 'PX', simplifyRatio(w, hh), e.clientX, e.clientY);
    });
  }
  function bindCropEdge(side) {
    const h = el.handles.querySelector(`[data-h="crop:${side}"]`);
    if (!h) return;
    bindDrag(h, (e, start) => {
      const dxBase = (e.clientX - start.x) / COMPOSE.stageScale / 0.5;
      const dyBase = (e.clientY - start.y) / COMPOSE.stageScale / 0.5;
      const rot = ((Number(start.cfg.rotation) || 0) % 360 + 360) % 360;
      const safe = R.inscribedSafeArea(COMPOSE.bm, rot);
      const dcw = dxBase / safe.w;
      const dch = dyBase / safe.h;
      const startCrop = start.cfg.crop || { x: 0, y: 0, w: 1, h: 1 };
      let c = { ...startCrop };
      if (side === 't') { const ny = Math.max(0, Math.min(c.y + c.h - 0.05, startCrop.y + dch)); c.h = startCrop.h + (startCrop.y - ny); c.y = ny; }
      if (side === 'b') { c.h = Math.max(0.05, Math.min(1 - c.y, startCrop.h + dch)); }
      if (side === 'l') { const nx = Math.max(0, Math.min(c.x + c.w - 0.05, startCrop.x + dcw)); c.w = startCrop.w + (startCrop.x - nx); c.x = nx; }
      if (side === 'r') { c.w = Math.max(0.05, Math.min(1 - c.x, startCrop.w + dcw)); }
      c.x = Math.max(0, Math.min(1 - 0.05, c.x));
      c.y = Math.max(0, Math.min(1 - 0.05, c.y));
      c.w = Math.max(0.05, Math.min(1 - c.x, c.w));
      c.h = Math.max(0.05, Math.min(1 - c.y, c.h));
      COMPOSE.cfg.crop = (c.x === 0 && c.y === 0 && c.w >= 0.999 && c.h >= 0.999) ? null : c;
      const w = Math.round(safe.w * c.w), hh = Math.round(safe.h * c.h);
      showHud(T('compose.hud.crop'), `${w} × ${hh}`, 'PX', simplifyRatio(w, hh), e.clientX, e.clientY);
    });
  }

  // ── Rotation slider bar (replaces v1.1.0 photo-overlay knob) ────────
  // The bar lives at the bottom of the stage, full-width, visible only
  // when the rot mod is active. Range -180..180, step 0.5, plus ±90°
  // quick buttons and a reset. Live preview drives requestComposeRender
  // on every input event; beginDrag()/endDrag() flip to low-res scale
  // during slider drag, then settle back to hi-res on release.
  function setRotationDeg(deg, source) {
    deg = Number(deg) || 0;
    // Range comes in as -180..180; cfg.rotation accepts any value but we
    // normalize for display. Tiny snap to 0 when within 0.4° (helps the
    // user actually land "no rotation" without aim-fight).
    if (Math.abs(deg) < 0.4) deg = 0;
    COMPOSE.cfg.rotation = deg;
    if (source !== 'slider' && el.rotSlider) {
      // Slider wraps -180..180; if cfg.rotation is outside, clamp display.
      el.rotSlider.value = Math.max(-180, Math.min(180, deg));
    }
    if (el.rotBarVal) {
      const s = Math.abs(deg) < 0.05 ? '0' : deg.toFixed(1).replace(/\.0$/, '');
      el.rotBarVal.textContent = s + '°';
    }
    requestComposeRender();
  }
  function bindRotSlider() {
    if (!el.rotSlider) return;
    // The slider input emits during drag; use pointerdown/pointerup on the
    // slider itself to bracket the low-res draft mode. `change` fires
    // after pointerup so we can also force a settle render then.
    el.rotSlider.addEventListener('pointerdown', () => beginDrag());
    el.rotSlider.addEventListener('pointerup',   () => endDrag());
    el.rotSlider.addEventListener('input', () => setRotationDeg(el.rotSlider.value, 'slider'));
    if (el.rotCcw) el.rotCcw.addEventListener('click', () => {
      let next = (Number(COMPOSE.cfg.rotation) || 0) - 90;
      // Keep within -180..180 for the slider display
      if (next < -180) next += 360;
      setRotationDeg(next);
    });
    if (el.rotCw) el.rotCw.addEventListener('click', () => {
      let next = (Number(COMPOSE.cfg.rotation) || 0) + 90;
      if (next > 180) next -= 360;
      setRotationDeg(next);
    });
    if (el.rotZero) el.rotZero.addEventListener('click', () => setRotationDeg(0));
  }

  // ── Bench numeric inputs ────────────────────────────────────────────
  function bindBenchInputs() {
    const setRender = () => requestComposeRender();
    // Crop W/H — translate to crop.w/h while keeping crop center fixed
    const onCropPx = () => {
      const rot = ((Number(COMPOSE.cfg.rotation) || 0) % 360 + 360) % 360;
      const safe = R.inscribedSafeArea(COMPOSE.bm, rot);
      const w = Math.max(1, Math.min(safe.w, Number(el.benchCropW.value) || safe.w));
      const h = Math.max(1, Math.min(safe.h, Number(el.benchCropH.value) || safe.h));
      const newW = w / safe.w, newH = h / safe.h;
      const cur = COMPOSE.cfg.crop || { x: 0, y: 0, w: 1, h: 1 };
      const cxN = cur.x + cur.w / 2;
      const cyN = cur.y + cur.h / 2;
      let nx = Math.max(0, Math.min(1 - newW, cxN - newW / 2));
      let ny = Math.max(0, Math.min(1 - newH, cyN - newH / 2));
      COMPOSE.cfg.crop = (nx === 0 && ny === 0 && newW >= 0.999 && newH >= 0.999) ? null : { x: nx, y: ny, w: newW, h: newH };
      setRender();
    };
    el.benchCropW.addEventListener('input', onCropPx);
    el.benchCropH.addEventListener('input', onCropPx);
    const onPad = (key, inputEl) => () => {
      const v = Math.max(0, Math.min(300, Number(inputEl.value) || 0));
      COMPOSE.cfg[key] = v;
      setRender();
    };
    el.benchPadT.addEventListener('input', onPad('paddingTop', el.benchPadT));
    el.benchPadR.addEventListener('input', onPad('paddingRight', el.benchPadR));
    el.benchPadB.addEventListener('input', onPad('paddingBottom', el.benchPadB));
    el.benchPadL.addEventListener('input', onPad('paddingLeft', el.benchPadL));
    el.benchRotDeg.addEventListener('input', () => {
      const v = Number(el.benchRotDeg.value);
      if (isFinite(v)) setRotationDeg(v, 'bench');
    });
  }

  // ── Module reset buttons ────────────────────────────────────────────
  function bindResets() {
    document.querySelectorAll('.compose-mod-reset').forEach((b) => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const what = b.dataset.reset;
        if (what === 'crop') COMPOSE.cfg.crop = null;
        if (what === 'pad') {
          COMPOSE.cfg.paddingTop = null;
          COMPOSE.cfg.paddingRight = null;
          COMPOSE.cfg.paddingBottom = null;
          COMPOSE.cfg.paddingLeft = null;
        }
        if (what === 'rot') COMPOSE.cfg.rotation = 0;
        requestComposeRender();
      });
    });
    el.resetAll.addEventListener('click', () => {
      COMPOSE.cfg.crop = null;
      COMPOSE.cfg.paddingTop = COMPOSE.cfg.paddingRight = COMPOSE.cfg.paddingBottom = COMPOSE.cfg.paddingLeft = null;
      COMPOSE.cfg.rotation = 0;
      requestComposeRender();
    });
  }

  // ── Module / dial focus selectors ───────────────────────────────────
  function setFocus(f) {
    // v1.1.1 — strict-exclusive: one tool active at a time. No 'all' mode.
    // Setting `data-focus` on the stage drives all the CSS visibility +
    // pointer-events gating. The rot-bar slider also toggles via `hidden`.
    if (f !== 'crop' && f !== 'pad' && f !== 'rot') f = 'crop';
    COMPOSE.focus = f;
    el.stage.dataset.focus = f;
    document.querySelectorAll('.compose-mod').forEach(m => m.classList.toggle('is-active', m.dataset.mod === f));
    if (el.rotBar) el.rotBar.hidden = (f !== 'rot');
    if (el.hint) el.hint.textContent = T('compose.hint.' + f);
  }
  function bindModSelectors() {
    document.querySelectorAll('.compose-mod').forEach(m => m.addEventListener('click', (e) => {
      // Don't switch focus on input / button clicks within the module —
      // those are bench-level edits / reset, not mode switches.
      if (e.target.closest('input, button')) return;
      setFocus(m.dataset.mod);
    }));
  }

  // ── Keyboard ────────────────────────────────────────────────────────
  function onComposeKey(e) {
    if (!COMPOSE.open) return;
    const tag = (e.target && e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return; // don't hijack bench typing
    if (e.key === '1') { setFocus('crop'); e.preventDefault(); }
    else if (e.key === '2') { setFocus('pad'); e.preventDefault(); }
    else if (e.key === '3') { setFocus('rot'); e.preventDefault(); }
    else if (e.key === 'r' || e.key === 'R') { el.resetAll.click(); e.preventDefault(); }
  }

  // ── Open / close ────────────────────────────────────────────────────
  async function openCompose() {
    const active = state.files[state.activeIdx];
    if (!active) { setStatus('compose.requirePhoto', 'busy'); setTimeout(() => setStatus('status.ready'), 1500); return; }
    COMPOSE.origCfg = snapshotCfg(active.cfg);
    COMPOSE.cfg = snapshotCfg(active.cfg);
    // Bitmap (full source — full-res for accurate inscribedSafeArea)
    COMPOSE.bm = await CR.loadBitmap(active.file);
    COMPOSE.sourceW = COMPOSE.bm.width;
    COMPOSE.sourceH = COMPOSE.bm.height;
    // Ghost <img> source: use a blob URL of the original file
    if (COMPOSE.ghostUrl) URL.revokeObjectURL(COMPOSE.ghostUrl);
    COMPOSE.ghostUrl = URL.createObjectURL(active.file);
    el.ghost.src = COMPOSE.ghostUrl;
    // Frame minPadding
    const frame = R.resolveFrame(COMPOSE.cfg.frame);
    COMPOSE.minPad = frame.minPadding || null;
    // Leader metadata
    if (el.leaderNum) el.leaderNum.textContent = `${state.activeIdx + 1} / ${state.files.length}`;
    if (el.leaderDate) {
      const d = new Date(); el.leaderDate.textContent = `${d.getFullYear()}·${String(d.getMonth()+1).padStart(2,'0')}·${String(d.getDate()).padStart(2,'0')} · ${T('compose.session')}`;
    }
    if (el.leaderDim) el.leaderDim.textContent = `${COMPOSE.sourceW} × ${COMPOSE.sourceH}`;
    if (el.meta) {
      const ne = buildCurrentExif();
      const bits = [ne.cameraMake, ne.cameraModel, ne.focalLengthInfo, ne.apertureInfo, ne.shutterInfo, ne.isoInfo].filter(Boolean);
      el.meta.textContent = bits.join(' · ') || '—';
    }
    setFocus('crop');
    COMPOSE.open = true;
    dlg.showModal();
    // Defer first render to next frame so the dialog has its dimensions.
    // Belt-and-suspenders: also fire at 60ms + 200ms so a slow-laying-out
    // dialog (Safari, big bitmap decode) doesn't strand the user on a
    // tiny initial canvas. ResizeObserver below also catches it.
    requestAnimationFrame(() => requestAnimationFrame(requestComposeRender));
    setTimeout(() => { if (COMPOSE.open) requestComposeRender(); }, 60);
    setTimeout(() => { if (COMPOSE.open) requestComposeRender(); }, 200);
  }
  function closeCompose(commit) {
    if (commit) {
      commitWorkingToActive();
      requestRender();
      refreshTriggerEnabled();
    }
    COMPOSE.open = false;
    if (COMPOSE.ghostUrl) { URL.revokeObjectURL(COMPOSE.ghostUrl); COMPOSE.ghostUrl = null; }
    el.ghost.removeAttribute('src');
    try { dlg.close(); } catch {}
  }

  // ── Bindings ────────────────────────────────────────────────────────
  if (el.trigger) el.trigger.addEventListener('click', () => openCompose());
  if (el.closeBtn) el.closeBtn.addEventListener('click', () => closeCompose(false));
  if (el.cancel) el.cancel.addEventListener('click', () => closeCompose(false));
  if (el.apply) el.apply.addEventListener('click', () => closeCompose(true));
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); closeCompose(false); });
  document.addEventListener('keydown', onComposeKey);

  ['top', 'right', 'bottom', 'left'].forEach((side) => {
    // Outward push = larger padding. Top: drag UP shrinks; drag DOWN grows.
    // Top edge handle sits ABOVE the photo; dragging it DOWN (positive Y)
    // means moving the handle toward the photo, which from the user's POV
    // means SHRINKING the top margin — so sign = -1 for top, +1 for bottom,
    // -1 for left, +1 for right.
    const sign = (side === 'top' || side === 'left') ? -1 : 1;
    const axis = (side === 'top' || side === 'bottom') ? 'y' : 'x';
    bindPadHandle(side, sign, axis);
  });
  ['tl','tr','br','bl'].forEach(bindCropCorner);
  ['t','r','b','l'].forEach(bindCropEdge);
  bindRotSlider();
  bindBenchInputs();
  bindResets();
  bindModSelectors();

  // Pan-crop: drag inside the photo aperture to shift crop without resizing.
  el.canvas.addEventListener('pointerdown', (e) => {
    if (!COMPOSE.open) return;
    // Pan-crop only works when crop mode is active — strict-exclusive (1.1.1).
    if (COMPOSE.focus !== 'crop') return;
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
    const rect = el.canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) / COMPOSE.stageScale;
    const py = (e.clientY - rect.top) / COMPOSE.stageScale;
    const layout = COMPOSE.layout;
    if (!layout) return;
    // Only if inside fg rect
    if (px < layout.fgLeft || px > layout.fgLeft + layout.fgW) return;
    if (py < layout.fgTop  || py > layout.fgTop  + layout.fgH) return;
    e.preventDefault();
    try { el.canvas.setPointerCapture(e.pointerId); } catch {}
    beginDrag();
    const startCrop = COMPOSE.cfg.crop ? { ...COMPOSE.cfg.crop } : { x: 0, y: 0, w: 1, h: 1 };
    const start = { x: e.clientX, y: e.clientY };
    const move = (ev) => {
      const rot = ((Number(COMPOSE.cfg.rotation) || 0) % 360 + 360) % 360;
      const safe = R.inscribedSafeArea(COMPOSE.bm, rot);
      const dxBase = -(ev.clientX - start.x) / COMPOSE.stageScale / 0.5;
      const dyBase = -(ev.clientY - start.y) / COMPOSE.stageScale / 0.5;
      const dcx = dxBase / safe.w;
      const dcy = dyBase / safe.h;
      let nx = Math.max(0, Math.min(1 - startCrop.w, startCrop.x + dcx));
      let ny = Math.max(0, Math.min(1 - startCrop.h, startCrop.y + dcy));
      COMPOSE.cfg.crop = { x: nx, y: ny, w: startCrop.w, h: startCrop.h };
      showHud(T('compose.hud.pan'), `${Math.round(nx*100)}, ${Math.round(ny*100)}`, '%', '', ev.clientX, ev.clientY);
      requestComposeRender();
    };
    const up = () => {
      try { el.canvas.releasePointerCapture(e.pointerId); } catch {}
      el.canvas.removeEventListener('pointermove', move);
      el.canvas.removeEventListener('pointerup', up);
      el.canvas.removeEventListener('pointercancel', up);
      hideHud();
      endDrag();
    };
    el.canvas.addEventListener('pointermove', move);
    el.canvas.addEventListener('pointerup', up);
    el.canvas.addEventListener('pointercancel', up);
  });

  // Refresh on dialog resize / window resize. The ResizeObserver covers the
  // case where the dialog's stage gets its real dimensions a frame or two
  // AFTER showModal() — without it, the first render can land while stage
  // is still 0×0 and the canvas shrinks to the minimum-clamp 0.1× scale.
  window.addEventListener('resize', () => { if (COMPOSE.open) requestComposeRender(); });
  if (typeof ResizeObserver !== 'undefined' && el.stage) {
    new ResizeObserver(() => { if (COMPOSE.open) requestComposeRender(); }).observe(el.stage);
  }

  // Initial enable check
  setTimeout(refreshTriggerEnabled, 100);
})();
