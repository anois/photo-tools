'use strict';

const FIELD_KEYS = ['brand', 'model', 'focal', 'aperture', 'shutter', 'iso', 'lens', 'date', 'author', 'flash', 'gps'];
const R = window.PhotoRender;
const CR = window.ClientRender;
const T = (k, vars) => window.I18N.t(k, vars);

const DEFAULT_FRAME = 'frosted';

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
    captionHeight: null,
    bgBlur: null, bgBrightness: null, bgSaturation: null,   // null → use frame preset
    shadowBlur: sd.blur, shadowOffsetY: sd.offsetY, shadowOpacity: sd.opacity,
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
  frostedAdvanced: document.getElementById('frosted-advanced'),
  bgBlur: document.getElementById('bg-blur'),
  bgBlurVal: document.getElementById('bg-blur-val'),
  bgBrightness: document.getElementById('bg-brightness'),
  bgBrightnessVal: document.getElementById('bg-brightness-val'),
  bgSaturation: document.getElementById('bg-saturation'),
  bgSaturationVal: document.getElementById('bg-saturation-val'),
  resetBgBtn: document.getElementById('reset-bg-btn'),
  applyFrameAllBtn: document.getElementById('apply-frame-all-btn'),
  presetPanel: document.getElementById('preset-panel'),
  presetSelect: document.getElementById('preset-select'),
  presetSaveBtn: document.getElementById('preset-save-btn'),
  presetDeleteBtn: document.getElementById('preset-delete-btn'),
  presetShareBtn: document.getElementById('preset-share-btn'),
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
  // Preset select's "(Choose a preset)" placeholder needs re-localizing too,
  // since it was rendered as plain <option> text rather than via data-i18n.
  if (els.presetSelect) populatePresetSelect(els.presetSelect.value);
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
        captionHeight: c.captionHeight,
        bgBlur: c.bgBlur,
        bgBrightness: c.bgBrightness,
        bgSaturation: c.bgSaturation,
        shadowBlur: c.shadowBlur,
        shadowOffsetY: c.shadowOffsetY,
        shadowOpacity: c.shadowOpacity,
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
  if (state.activeIdx < 0 || !state.logos) return;
  if (renderRAF) return;
  renderRAF = requestAnimationFrame(() => { renderRAF = 0; doRender(); });
}

// Reflect a per-photo cfg into all the DOM controls. Called whenever the
// active photo changes (or apply-to-all rewrites the active photo's EXIF).
function syncControlsFromCfg(cfg) {
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

// Floating canvas badge: small mono-caps label hovering top-left of the
// preview canvas, showing FRAME · TEMPLATE (and rotation when non-zero).
// Hidden when no photo is loaded, so the empty state stays uncluttered.
function updateFrameBadge(cfg) {
  if (!cfg || state.activeIdx < 0) {
    els.canvasFrameBadge.hidden = true;
    return;
  }
  const frameLabel = String(cfg.frame || '').toUpperCase().replace(/-/g, '·');
  const tplLabel   = String(cfg.template || '').toUpperCase().replace(/-/g, '·');
  els.canvasBadgeFrame.textContent = frameLabel || '—';
  els.canvasBadgeTemplate.textContent = tplLabel || '—';
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
  polaroid:           { slate: 'narrow',  'tech-stack': 'narrow'  },
  instax:             { slate: 'narrow',  'tech-stack': 'narrow'  },
  torn:               { slate: 'narrow',  'tech-stack': 'narrow'  },
  editorial:          { slate: 'rotated', 'tech-stack': 'rotated' },
  'editorial-mirror': { slate: 'rotated', 'tech-stack': 'rotated' }
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
    'shadowBlur', 'shadowOffsetY', 'shadowOpacity'
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

// ─── Canvas touch gestures: swipe + long-press peek (mobile) ───────────
// Two coordinated gestures on the preview canvas:
//
//  1. Horizontal swipe (dx ≥ 50px, ≤ 800ms, |dy| ≤ |dx|·0.7) → prev/next
//     photo. Same wrap-around behavior as J/K keys (moveSelection).
//  2. Long-press (touch held ≥ 500ms with < 10px movement) → enterPeek().
//
// touchmove/touchend live on document so a finger that started on canvas
// and moves/lifts elsewhere still resolves the gesture cleanly. Once peek
// triggers, touchend just closes peek (no swipe). Movement >10px before
// the 500ms threshold cancels the peek timer so a fast horizontal swipe
// doesn't accidentally start a peek mid-drag.
(function wireCanvasGestures() {
  const pane = els.canvasPane;
  if (!pane) return;
  const PEEK_DELAY_MS = 500;
  let startX = 0, startY = 0, startTime = 0, active = false;
  let peekTimer = 0;

  pane.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { active = false; return; }
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startTime = Date.now();
    active = true;
    clearTimeout(peekTimer);
    peekTimer = setTimeout(() => { if (active) enterPeek(); }, PEEK_DELAY_MS);
  }, { passive: true });

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
    clearTimeout(peekTimer);
    exitPeek();
  });

  document.addEventListener('touchend', (e) => {
    if (!active) return;
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
  if (c.bgBlur != null)        cfg.bgBlur = c.bgBlur;
  if (c.bgBrightness != null)  cfg.bgBrightness = c.bgBrightness;
  if (c.bgSaturation != null)  cfg.bgSaturation = c.bgSaturation;
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
  'bgBlur', 'bgBrightness', 'bgSaturation',
  'shadowBlur', 'shadowOffsetY', 'shadowOpacity'
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

function populatePresetSelect(selectedName) {
  const map = loadPresets();
  const names = Object.keys(map);
  els.presetSelect.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = T('frame.presetChoose');
  els.presetSelect.appendChild(placeholder);
  for (const name of names) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    els.presetSelect.appendChild(opt);
  }
  els.presetSelect.value = (selectedName && map[selectedName]) ? selectedName : '';
}

els.presetSelect.addEventListener('change', () => {
  const name = els.presetSelect.value;
  if (!name) return;
  const map = loadPresets();
  const preset = map[name];
  if (!preset) return;
  const target = activeCfg();
  if (!applyPresetToCfg(preset, target)) return;
  // draftCfg always tracks the latest applied look so future imports inherit.
  if (target !== state.draftCfg) applyPresetToCfg(preset, state.draftCfg);
  syncControlsFromCfg(target);
  // customLogo lives outside syncControlsFromCfg's bg/shadow/showFields scope —
  // mergeFiles already deep-clones it on import, but the visible preview img
  // (`#signature-preview-img`) is owned by the signature handler block, which
  // re-renders when applyCustomLogoEverywhere is called. Skip the cascade
  // here so applying a preset only changes the active photo's signature; the
  // user can hit "Apply frame to all" if they want it propagated.
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
  requestRender();
  setStatus('status.presetApplied', null, { name });
  setTimeout(() => setStatus('status.ready'), 1500);
});

els.presetSaveBtn.addEventListener('click', () => {
  const def = nowDefaultPresetName();
  const raw = window.prompt(T('frame.presetSavePrompt'), def);
  if (raw == null) return;   // cancel
  const name = raw.trim().slice(0, 60);
  if (!name) {
    setStatus('status.presetEmptyName', 'err');
    setTimeout(() => setStatus('status.ready'), 1500);
    return;
  }
  const map = loadPresets();
  map[name] = presetFromCfg(activeCfg(), { includeCustomLogo: true });
  savePresets(map);
  populatePresetSelect(name);
  setStatus('status.presetSaved', null, { name });
  setTimeout(() => setStatus('status.ready'), 1500);
});

els.presetDeleteBtn.addEventListener('click', () => {
  const name = els.presetSelect.value;
  if (!name) {
    setStatus('status.presetNonePicked', 'err');
    setTimeout(() => setStatus('status.ready'), 1500);
    return;
  }
  const map = loadPresets();
  delete map[name];
  savePresets(map);
  populatePresetSelect();
  setStatus('status.presetDeleted', null, { name });
  setTimeout(() => setStatus('status.ready'), 1500);
});

els.presetShareBtn.addEventListener('click', async () => {
  // Share code intentionally drops customLogo to keep URL short.
  const preset = presetFromCfg(activeCfg(), { includeCustomLogo: false });
  const code = b64urlEncode(JSON.stringify(preset));
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
populatePresetSelect();
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
    frosted: 'editorial', 'frosted-noir': 'editorial', editorial: 'editorial', 'editorial-mirror': 'editorial',
    'gallery-white': 'gallery', 'gallery-noir': 'gallery',
    polaroid: 'instant', instax: 'instant', torn: 'instant',
    'film-35': 'film', 'film-mf': 'film',
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
  ALL_FRAMES.forEach((val) => {
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
    tile.innerHTML = `
      <span class="frame-tile-preview"><span class="frame-tile-photo"></span></span>
      <span class="frame-tile-name"></span>
      <span class="frame-tile-meta"></span>`;
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
  ALL_TEMPLATES.forEach((val) => {
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
    const preview = (TEMPLATE_PREVIEWS[val] || (() => ''))();
    const previewHtml = preview.split('\n').map((l) => l.replace(/&/g, '&amp;').replace(/</g, '&lt;')).join('<br>');
    tile.innerHTML = `
      <span class="tmpl-tile-name"></span>
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
  function syncLookchips() {
    const cfg = activeCfg();
    if (!cfg) return;
    if (swatch) swatch.setAttribute('data-frame', cfg.frame || 'frosted');
    if (frameVal) frameVal.textContent = frameLabel(cfg.frame);
    if (tmplVal) tmplVal.textContent = tmplLabel(cfg.template);
    if (aspectVal) aspectVal.textContent = (cfg.aspect || '').replace(':', ' : ');
    if (qualityVal && els.quality) {
      qualityVal.textContent = T(QUALITY_LABELS_KEY[els.quality.value] || 'export.qualities.standard');
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
  let activePicker = null;
  function openPicker(name, anchor) {
    closePicker(true);
    const el = document.getElementById('picker-' + name);
    if (!el) return;
    document.querySelectorAll('.picker').forEach((p) => { p.hidden = true; });
    el.hidden = false;
    overlay.dataset.open = 'true';
    overlay.setAttribute('aria-hidden', 'false');
    activePicker = name;
    document.querySelectorAll('.lookchip').forEach((c) => c.removeAttribute('data-open'));
    if (anchor) anchor.setAttribute('data-open', 'true');
    positionPicker(el, anchor);
  }
  function closePicker(silent) {
    overlay.dataset.open = 'false';
    overlay.setAttribute('aria-hidden', 'true');
    document.querySelectorAll('.lookchip').forEach((c) => c.removeAttribute('data-open'));
    activePicker = null;
    if (silent) {
      // No transition cleanup needed — caller is about to open another one.
    }
  }
  function positionPicker(el, anchor) {
    if (window.innerWidth <= 768) {
      // Mobile: full-width bottom sheet, CSS handles it.
      el.style.left = '';
      el.style.right = '';
      return;
    }
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    el.style.left = '0';
    // Read the actual rendered width
    const w = el.getBoundingClientRect().width || 540;
    let x = r.left + r.width / 2 - w / 2;
    if (x < 12) x = 12;
    if (x + w > window.innerWidth - 12) x = window.innerWidth - w - 12;
    el.style.left = x + 'px';
  }
  document.querySelectorAll('.lookchip[data-picker]').forEach((chip) => {
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
    const anchor = document.querySelector(`.lookchip[data-picker="${activePicker}"]`);
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
  if (wsClose) wsClose.addEventListener('click', closeWorkshop);
  wsOverlay.addEventListener('click', (e) => {
    if (e.target === wsOverlay) closeWorkshop();
  });
  document.querySelectorAll('.workshop-tab').forEach((t) => {
    t.addEventListener('click', () => setWorkshopTab(t.dataset.tab));
  });

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
    { type: 'action', key: 'save-preset', i18n: 'cmdk.actions.savePreset', fn: () => { openWorkshop('lib'); setTimeout(() => document.getElementById('preset-save-btn').click(), 320); } },
    { type: 'action', key: 'copy-share', i18n: 'cmdk.actions.copyShare', fn: () => { openWorkshop('lib'); setTimeout(() => document.getElementById('preset-share-btn').click(), 320); } },
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

  // Initial paint
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
