'use strict';

const FIELD_KEYS = ['brand', 'model', 'focal', 'aperture', 'shutter', 'iso', 'lens', 'date', 'author', 'flash'];
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
    showFields: { brand: true, model: true, focal: true, aperture: true, shutter: true, iso: true, lens: false, date: false, author: true, flash: false },
    // Rotation applied at render time, in degrees clockwise. 0 / 90 / 180 / 270.
    // Per-photo correction — not propagated by "Apply frame to all" or by
    // presets, since it's more of a "this specific photo was shot wrong"
    // fix than a stylistic choice.
    rotation: 0,
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
    collage: c.collage ? { ...c.collage } : null
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
  frameSeg: document.getElementById('frame-seg'),
  template: document.getElementById('template'),
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
  signaturePosSeg: document.getElementById('signature-pos-seg'),
  signatureScale: document.getElementById('signature-scale'),
  signatureScaleVal: document.getElementById('signature-scale-val'),
  signatureOpacity: document.getElementById('signature-opacity'),
  signatureOpacityVal: document.getElementById('signature-opacity-val'),
  collageLayout: document.getElementById('collage-layout'),
  collageSlots: document.getElementById('collage-slots'),
  rotateCcw: document.getElementById('rotate-ccw'),
  rotateCw: document.getElementById('rotate-cw'),
  rotateVal: document.getElementById('rotate-val'),
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
    flash: document.getElementById('exif-flash')
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
  // Empty rail and EXIF warning re-render from canonical state too.
  renderRail();
  const active = state.files[state.activeIdx];
  updateExifWarn(active ? active.normalized : null);
  // Preset select's "(Choose a preset)" placeholder needs re-localizing too,
  // since it was rendered as plain <option> text rather than via data-i18n.
  if (els.presetSelect) populatePresetSelect(els.presetSelect.value);
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
  for (const [key, raw] of Object.entries(override || {})) {
    const v = String(raw).trim();
    if (v === '') {
      if (key === 'dateTimeOriginal') base.date = '';
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
    else                                  base[key] = v;
  }
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
        rotation: c.rotation || 0
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
  setSegActive(els.aspectSeg, cfg.aspect);
  setSegActive(els.frameSeg, cfg.frame);
  els.template.value = cfg.template;
  els.padding.value = cfg.padding;
  els.paddingVal.textContent = T('frame.paddingUnit', { n: cfg.padding });
  if (cfg.captionHeight != null) {
    els.captionH.value = cfg.captionHeight;
    els.captionHVal.textContent = T('frame.captionUnit', { n: cfg.captionHeight });
  } else {
    els.captionHVal.textContent = T('frame.captionAuto');
  }
  const frame = R.FRAMES[cfg.frame];
  if (frame.bg.type === 'frosted') {
    els.bgBlur.value = cfg.bgBlur != null ? cfg.bgBlur : frame.bg.blurSigma;
    els.bgBrightness.value = cfg.bgBrightness != null ? cfg.bgBrightness : frame.bg.brightness;
    els.bgSaturation.value = cfg.bgSaturation != null ? cfg.bgSaturation : frame.bg.saturation;
    els.bgBlurVal.textContent = cfg.bgBlur != null ? String(cfg.bgBlur) : T('frame.defaultReadout');
    els.bgBrightnessVal.textContent = cfg.bgBrightness != null ? Number(cfg.bgBrightness).toFixed(2) : T('frame.defaultReadout');
    els.bgSaturationVal.textContent = cfg.bgSaturation != null ? Number(cfg.bgSaturation).toFixed(2) : T('frame.defaultReadout');
  }
  els.frostedAdvanced.hidden = frame.bg.type !== 'frosted';
  if (els.frostedAdvanced.open && frame.bg.type !== 'frosted') els.frostedAdvanced.open = false;
  els.shadowBlur.value = cfg.shadowBlur;
  els.shadowOffset.value = cfg.shadowOffsetY;
  els.shadowOpacity.value = cfg.shadowOpacity;
  els.shadowBlurVal.textContent = String(cfg.shadowBlur);
  els.shadowOffsetVal.textContent = String(cfg.shadowOffsetY);
  els.shadowOpacityVal.textContent = Number(cfg.shadowOpacity).toFixed(2);
  els.showFields.querySelectorAll('input[type=checkbox]').forEach((cb) => {
    cb.checked = !!cfg.showFields[cb.dataset.key];
  });
  syncSignatureFromCfg(cfg);
  syncCollageFromActive();
  syncRotateFromCfg(cfg);
  syncCustomBgFromCfg(cfg);
}

function syncCustomBgFromCfg(cfg) {
  const cb = cfg.customBg;
  const has = !!(cb && cb.data);
  els.customBgReadout.hidden = !has;
  els.customBgPreview.src = has ? cb.data : '';
  els.customBgName.textContent = has ? (cb.name || 'image') : '—';
}

function syncRotateFromCfg(cfg) {
  const r = ((cfg.rotation | 0) % 360 + 360) % 360;
  els.rotateVal.textContent = r + '°';
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

function syncSignatureFromCfg(cfg) {
  const cl = cfg.customLogo;
  const has = !!(cl && cl.data);
  els.signaturePreview.hidden = !has;
  els.signaturePreviewImg.src = has ? cl.data : '';
  setSegActive(els.signaturePosSeg, has ? (cl.position || 'br') : 'br');
  const scalePct = Math.round((has ? (cl.scale != null ? cl.scale : 0.06) : 0.06) * 100);
  const opacity = has ? (cl.opacity != null ? cl.opacity : 1) : 1;
  els.signatureScale.value = scalePct;
  els.signatureScaleVal.textContent = scalePct + '%';
  els.signatureOpacity.value = opacity;
  els.signatureOpacityVal.textContent = Math.round(opacity * 100) + '%';
  els.signaturePosSeg.querySelectorAll('button').forEach((b) => { b.disabled = !has; });
  els.signatureScale.disabled = !has;
  els.signatureOpacity.disabled = !has;
}

function setSegActive(seg, val) {
  seg.querySelectorAll('button').forEach((b) => {
    const on = b.dataset.val === val;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
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
wireSeg(els.aspectSeg, 'aspect');
wireSeg(els.frameSeg, 'frame', onFrameChange);

// ─── bg/shadow sync ──────────────────────────────────────────────────────
// Frame switch resets bg overrides to "use preset" (null) and shadow sliders
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
  els.shadowBlurVal.textContent = String(sd.blur);
  els.shadowOffsetVal.textContent = String(sd.offsetY);
  els.shadowOpacityVal.textContent = sd.opacity.toFixed(2);
}

els.bgBlur.addEventListener('input', () => {
  const v = Number(els.bgBlur.value);
  activeCfg().bgBlur = v;
  els.bgBlurVal.textContent = String(v);
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
  els.shadowBlurVal.textContent = String(v);
  requestRender();
});
els.shadowOffset.addEventListener('input', () => {
  const v = Number(els.shadowOffset.value);
  activeCfg().shadowOffsetY = v;
  els.shadowOffsetVal.textContent = String(v);
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

els.template.addEventListener('change', () => { activeCfg().template = els.template.value; requestRender(); });
els.format.addEventListener('change',   () => { state.format = els.format.value; });
els.quality.addEventListener('change',  () => { state.quality = els.quality.value; });

els.padding.addEventListener('input', () => {
  const v = Number(els.padding.value);
  activeCfg().padding = v;
  els.paddingVal.textContent = T('frame.paddingUnit', { n: v });
  requestRender();
});

// captionHeight: moving off the default position sets an explicit override;
// double-clicking the slider label resets to preset ("auto" readout).
els.captionH.addEventListener('input', () => {
  const v = Number(els.captionH.value);
  activeCfg().captionHeight = v;
  els.captionHVal.textContent = T('frame.captionUnit', { n: v });
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
    const prev = activeCfg().customLogo;
    const payload = {
      data: data,
      type: type,
      position: prev && prev.position ? prev.position : 'br',
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

els.signaturePosSeg.querySelectorAll('button').forEach((btn) => {
  btn.addEventListener('click', () => {
    const cfg = activeCfg();
    if (!cfg.customLogo) return;
    setSegActive(els.signaturePosSeg, btn.dataset.val);
    cfg.customLogo = { ...cfg.customLogo, position: btn.dataset.val };
    requestRender();
  });
});

els.signatureScale.addEventListener('input', () => {
  const cfg = activeCfg();
  if (!cfg.customLogo) return;
  const pct = Number(els.signatureScale.value);
  cfg.customLogo = { ...cfg.customLogo, scale: pct / 100 };
  els.signatureScaleVal.textContent = pct + '%';
  requestRender();
});

els.signatureOpacity.addEventListener('input', () => {
  const cfg = activeCfg();
  if (!cfg.customLogo) return;
  const v = Number(els.signatureOpacity.value);
  cfg.customLogo = { ...cfg.customLogo, opacity: v };
  els.signatureOpacityVal.textContent = Math.round(v * 100) + '%';
  requestRender();
});

// ─── Rotation wiring (90° increments) ───────────────────────────────────
function bumpRotation(delta) {
  const cfg = activeCfg();
  cfg.rotation = (((cfg.rotation | 0) + delta) % 360 + 360) % 360;
  syncRotateFromCfg(cfg);
  requestRender();
}
els.rotateCcw.addEventListener('click', () => bumpRotation(-90));
els.rotateCw.addEventListener('click', () => bumpRotation(90));

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
      state.draftCfg.customLogo = payload;
      syncSignatureFromCfg(state.draftCfg);
    }
  } catch (_) { /* malformed entry — drop silently */ }
})();

// ─── Custom bg image (frosted bg replacement) wiring ────────────────────
// Same shape as signature: upload cascades to draftCfg + every loaded photo
// + localStorage. Per-photo override happens via the user editing other
// frosted params; the bg image itself is treated as a global pick.
const CUSTOMBG_STORAGE_KEY = 'phototools.customBg';
const CUSTOMBG_MAX_BYTES = 4 * 1024 * 1024;

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

els.customBgInput.addEventListener('change', async () => {
  const file = els.customBgInput.files && els.customBgInput.files[0];
  els.customBgInput.value = '';
  if (!file) return;
  if (file.size > CUSTOMBG_MAX_BYTES) {
    setStatus('status.customBgTooBig', 'err', { mb: (file.size / 1024 / 1024).toFixed(1) });
    setTimeout(() => setStatus('status.ready'), 3000);
    return;
  }
  try {
    const data = await readSignatureFile(file);   // same FileReader.readAsDataURL helper
    const type = /^data:image\/png/i.test(data) ? 'png' : 'jpeg';
    const payload = { data, type, name: file.name };
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

// Apply the current photo's full frame configuration (everything *except*
// EXIF) to all loaded photos in one click. Covers aspect, frame, template,
// padding, captionHeight, bg overrides, shadow, and showFields. The intent:
// once you've dialed a look on one photo, propagate it across the batch.
els.applyFrameAllBtn.addEventListener('click', () => {
  const active = state.files[state.activeIdx];
  if (!active) return;
  if (state.files.length <= 1) {
    setStatus('status.onlyOne', 'err');
    setTimeout(() => setStatus('status.ready'), 1500);
    return;
  }
  const src = active.cfg;
  const FRAME_KEYS = [
    'aspect', 'frame', 'template', 'padding', 'captionHeight',
    'bgBlur', 'bgBrightness', 'bgSaturation',
    'shadowBlur', 'shadowOffsetY', 'shadowOpacity'
  ];
  for (const f of state.files) {
    if (f === active) continue;
    for (const k of FRAME_KEYS) f.cfg[k] = src[k];
    f.cfg.showFields = { ...src.showFields };
    f.cfg.customLogo = src.customLogo ? { ...src.customLogo } : null;
    f.cfg.customBg = src.customBg ? { ...src.customBg } : null;
  }
  setStatus('status.appliedFrame', null, { n: state.files.length - 1 });
  setTimeout(() => setStatus('status.ready'), 1800);
  // The active photo's UI is already correct; no need to re-sync controls.
});

// Apply the current photo's EXIF override to all loaded photos. Each other
// photo keeps its own auto-parsed metadata for keys NOT in the override —
// only the user-edited fields propagate. Useful for e.g. setting author
// across the whole batch, or correcting a misparsed brand globally.
els.applyExifAllBtn.addEventListener('click', () => {
  const active = state.files[state.activeIdx];
  if (!active) return;
  const src = active.cfg.exifOverride || {};
  const keys = Object.keys(src);
  if (state.files.length <= 1) {
    setStatus('status.onlyOne', 'err');
    setTimeout(() => setStatus('status.ready'), 1500);
    return;
  }
  for (const f of state.files) {
    if (f === active) continue;
    f.cfg.exifOverride = { ...src };
  }
  setStatus('status.appliedExif', null, { n: keys.length, m: state.files.length - 1 });
  setTimeout(() => setStatus('status.ready'), 1800);
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
  if (preset.customLogo) cfg.customLogo = { ...preset.customLogo };
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
    setSegActive(els.signaturePosSeg, preset.customLogo.position || 'br');
    const sc = Math.round((preset.customLogo.scale != null ? preset.customLogo.scale : 0.06) * 100);
    const op = preset.customLogo.opacity != null ? preset.customLogo.opacity : 1;
    els.signatureScale.value = sc;
    els.signatureScaleVal.textContent = sc + '%';
    els.signatureOpacity.value = op;
    els.signatureOpacityVal.textContent = Math.round(op * 100) + '%';
    els.signaturePosSeg.querySelectorAll('button').forEach((b) => { b.disabled = false; });
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

// ─── PWA service-worker registration ────────────────────────────────────
// Precaches the SPA shell so the app loads instantly + works offline. The
// SW is at public/service-worker.js so its scope is the deploy root. We
// register asynchronously after first paint so SW install doesn't compete
// with shell rendering.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch((err) => {
      console.warn('[sw] register failed', err);
    });
  });
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
