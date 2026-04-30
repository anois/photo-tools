'use strict';

const FIELD_KEYS = ['brand', 'model', 'focal', 'aperture', 'shutter', 'iso', 'lens', 'date', 'author', 'flash'];
const R = window.PhotoRender;
const CR = window.ClientRender;

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
    // EXIF user overrides keyed by input name (make/model/focalLength/...) →
    // raw string from the form. Backend applies formatters via formatBrand etc.
    exifOverride: {}
  };
}

function cloneCfg(c) {
  return {
    ...c,
    showFields: { ...c.showFields },
    exifOverride: { ...c.exifOverride }
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
  shadowBlur: document.getElementById('shadow-blur'),
  shadowBlurVal: document.getElementById('shadow-blur-val'),
  shadowOffset: document.getElementById('shadow-offset'),
  shadowOffsetVal: document.getElementById('shadow-offset-val'),
  shadowOpacity: document.getElementById('shadow-opacity'),
  shadowOpacityVal: document.getElementById('shadow-opacity-val'),
  showFields: document.getElementById('show-fields'),
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

function setStatus(text, mode) {
  els.status.textContent = text || 'ready';
  els.statusbar.classList.toggle('busy', mode === 'busy');
  els.statusbar.classList.toggle('err', mode === 'err');
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
  const warn = hasMeaningfulExif(normalized) ? null :
    '<strong>⚠ 未在图片中读取到 EXIF</strong> — 下方输入框的灰色斜体文字只是示例占位。' +
    '微信 / 社交平台上传会剥离元数据。请手动填写需要显示的字段，或改用原图。';
  els.exifWarn.hidden = !warn;
  els.exifWarn.innerHTML = warn || '';
  if (warn) els.exifDetails.open = true;
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
    empty.textContent = 'No photos yet';
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
      file: active._converted || active.file,
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
        showFields: c.showFields
      },
      normExif: buildCurrentExif(),
      logos: state.logos,
      fontFaceCss: state.fontFaceCss
    });
    els.empty.hidden = true;
  } catch (err) {
    console.error('[preview]', err);
    setStatus('preview failed: ' + err.message, 'err');
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
  els.paddingVal.textContent = `${cfg.padding} px`;
  if (cfg.captionHeight != null) {
    els.captionH.value = cfg.captionHeight;
    els.captionHVal.textContent = `${cfg.captionHeight} px`;
  } else {
    els.captionHVal.textContent = 'auto';
  }
  const frame = R.FRAMES[cfg.frame];
  if (frame.bg.type === 'frosted') {
    els.bgBlur.value = cfg.bgBlur != null ? cfg.bgBlur : frame.bg.blurSigma;
    els.bgBrightness.value = cfg.bgBrightness != null ? cfg.bgBrightness : frame.bg.brightness;
    els.bgSaturation.value = cfg.bgSaturation != null ? cfg.bgSaturation : frame.bg.saturation;
    els.bgBlurVal.textContent = cfg.bgBlur != null ? String(cfg.bgBlur) : '默认';
    els.bgBrightnessVal.textContent = cfg.bgBrightness != null ? Number(cfg.bgBrightness).toFixed(2) : '默认';
    els.bgSaturationVal.textContent = cfg.bgSaturation != null ? Number(cfg.bgSaturation).toFixed(2) : '默认';
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
      setStatus('reading EXIF…', 'busy');
      const r = await uploadForExif(f.file);
      f.normalized = r.normalized;
      f.rawExif = r.slim;
      populateExifInputs(f.normalized);
      applyOverrideToInputs(f.cfg.exifOverride);
      updateExifWarn(f.normalized);
      setStatus('ready');
    } catch (err) {
      f.normalized = {};
      updateExifWarn(null);
      setStatus('EXIF parse failed: ' + err.message, 'err');
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
  for (let file of newFiles) {
    const key = file.name + ':' + file.size + ':' + file.lastModified;
    if (seen.has(key)) continue;
    seen.add(key);

    const ext = (file.name.match(/\.([^.]+)$/) || ['',''])[1].toLowerCase();
    const mime = (file.type || '').toLowerCase();
    const isHeic = ext === 'heic' || ext === 'heif' || mime.includes('heic') || mime.includes('heif');

    const cfg = cloneCfg(seedCfg);
    cfg.exifOverride = {};
    const entry = {
      file,
      url: isHeic ? null : URL.createObjectURL(file),
      normalized: null,
      cfg,
      isHeic
    };
    added.push(entry);
  }

  // Probe each new file via createImageBitmap before adding to state.files.
  // HEIC, truncated downloads, and renamed non-image files all surface here.
  // Probing in parallel keeps it fast for big batches; failures are dropped
  // with a friendly Chinese error message reported via the status bar.
  const rejected = [];
  await Promise.all(added.map(async (entry) => {
    try {
      if (entry.isHeic) {
        setStatus(`converting ${entry.file.name}…`, 'busy');
        let blob;
        try {
          blob = await window.heic2any({
            blob: entry.file,
            toType: 'image/jpeg',
            quality: 0.92
          });
        } catch (convErr) {
          console.error('[heic] conversion failed:', entry.file.name, convErr);
          throw new Error('HEIC 转换失败: ' + (convErr.message || '未知错误'));
        }
        // heic2any returns a single blob or array of blobs.
        const convertedBlob = Array.isArray(blob) ? blob[0] : blob;
        if (!convertedBlob) throw new Error('HEIC 转换结果为空');

        entry._converted = new File([convertedBlob], entry.file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
        entry.url = URL.createObjectURL(entry._converted);
        try {
          await CR.loadBitmap(entry._converted, 1440);
        } catch (loadErr) {
          console.error('[heic] decode failed after conversion:', entry.file.name, loadErr);
          throw loadErr;
        }
      } else {
        // loadBitmap will populate the bitmap cache so the subsequent preview
        // render reuses the decoded ImageBitmap rather than decoding again.
        await CR.loadBitmap(entry.file, 1440);
      }
    } catch (err) {
      rejected.push({ name: entry.file.name, reason: humanizeDecodeError(err, entry.file) });
      if (entry.url) URL.revokeObjectURL(entry.url);
      entry._broken = true;
    }
  }));

  for (const e of added) if (!e._broken) merged.push(e);
  state.files = merged;

  // Background EXIF parse for the survivors (best-effort).
  for (const entry of added) {
    if (entry._broken) continue;
    if (!entry.normalized) {
      // Use original file for EXIF parsing even for HEIC (exifr supports it)
      uploadForExif(entry.file).then((r) => { entry.normalized = r.normalized; entry.rawExif = r.slim; }).catch(() => {});
    }
  }

  if (rejected.length) {
    const msg = rejected.length === 1
      ? `${rejected[0].name}: ${rejected[0].reason}`
      : `${rejected.length} 张图片无法解码（已跳过）`;
    setStatus(msg, 'err');
    if (rejected.length > 1) console.warn('[import] rejected files:', rejected);
    setTimeout(() => setStatus('ready'), 4000);
  }
  return { addedCount: added.length - rejected.length, rejected };
}

// Translate the various createImageBitmap failure modes into a single short
// Chinese label the user can act on. err.name is `InvalidStateError` /
// `NotFoundError` / `NotSupportedError` depending on the browser; we treat
// them all as "browser refused to decode".
function humanizeDecodeError(err, file) {
  if (err && err.message && (err.message.includes('转换') || err.message.includes('结果为空'))) {
    return err.message;
  }
  const mime = (file.type || '').toLowerCase();
  if (mime && mime !== 'image/jpeg' && mime !== 'image/png' && !mime.includes('heic') && !mime.includes('heif')) {
    return `不支持的格式 ${mime}`;
  }
  console.warn('[decode]', file.name, err);
  return '图片无法解码（文件可能已损坏）';
}

els.fileInput.addEventListener('change', async () => {
  const files = Array.from(els.fileInput.files || []);
  if (!files.length) return;
  const prevLen = state.files.length;
  setStatus('reading…', 'busy');
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
  els.bgBlurVal.textContent = '默认';
  els.bgBrightnessVal.textContent = '默认';
  els.bgSaturationVal.textContent = '默认';
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
  els.paddingVal.textContent = `${v} px`;
  requestRender();
});

// captionHeight: moving off the default position sets an explicit override;
// double-clicking the slider label resets to preset ("auto" readout).
els.captionH.addEventListener('input', () => {
  const v = Number(els.captionH.value);
  activeCfg().captionHeight = v;
  els.captionHVal.textContent = `${v} px`;
  requestRender();
});
els.captionHVal.addEventListener('dblclick', () => {
  activeCfg().captionHeight = null;
  els.captionHVal.textContent = 'auto';
  requestRender();
});

els.showFields.querySelectorAll('input[type=checkbox]').forEach((cb) => {
  cb.checked = state.draftCfg.showFields[cb.dataset.key];
  cb.addEventListener('change', () => {
    activeCfg().showFields[cb.dataset.key] = cb.checked;
    requestRender();
  });
});

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
    setStatus('no photo loaded', 'err');
    return;
  }
  if (!f.rawExif) {
    setStatus('EXIF still loading…', 'busy');
    return;
  }
  const json = JSON.stringify(f.rawExif, null, 2);
  try {
    await navigator.clipboard.writeText(json);
    const n = Object.keys(f.rawExif).length;
    setStatus(`copied raw EXIF (${n} keys) to clipboard`);
  } catch {
    // Clipboard API is gated on user gesture + secure context. As a fallback,
    // dump to a hidden <textarea> and run document.execCommand('copy').
    const ta = document.createElement('textarea');
    ta.value = json;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    setStatus('copied raw EXIF (fallback)');
  }
  setTimeout(() => setStatus('ready'), 2500);
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
    setStatus('only one photo loaded', 'err');
    setTimeout(() => setStatus('ready'), 1500);
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
  }
  setStatus(`applied frame settings to ${state.files.length - 1} photo(s)`);
  setTimeout(() => setStatus('ready'), 1800);
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
    setStatus('only one photo loaded', 'err');
    setTimeout(() => setStatus('ready'), 1500);
    return;
  }
  for (const f of state.files) {
    if (f === active) continue;
    f.cfg.exifOverride = { ...src };
  }
  setStatus(`applied ${keys.length} EXIF field(s) to ${state.files.length - 1} photo(s)`);
  setTimeout(() => setStatus('ready'), 1800);
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
  const files = Array.from(e.dataTransfer.files || []).filter(
    (f) => f.type === 'image/jpeg' || f.type === 'image/png'
  );
  if (!files.length) return;
  const prevLen = state.files.length;
  setStatus('reading…', 'busy');
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
  return cfg;
}

const assets = () => ({ logos: state.logos, fontFaceCss: state.fontFaceCss });

els.exportBtn.addEventListener('click', async () => {
  const active = state.files[state.activeIdx];
  if (!active) return;
  els.exportBtn.disabled = true;
  setStatus('exporting…', 'busy');
  try {
    const cfg = buildConfigForFile(active);
    await window.Exporter.exportSingle(
      { file: active.file, _converted: active._converted, normExif: buildExifForFile(active) },
      cfg, assets()
    );
    setStatus('exported', null);
    setTimeout(() => setStatus('ready'), 1500);
  } catch (err) {
    console.error('[export]', err);
    setStatus(err.message || 'export failed', 'err');
  } finally {
    els.exportBtn.disabled = false;
  }
});

async function runBatch() {
  if (state.files.length === 0) return;
  els.batchBtn.disabled = true;
  els.exportBtn.disabled = true;
  setStatus(`batch · ${state.files.length} files`, 'busy');
  try {
    const entries = state.files.map((f) => ({
      file: f.file,
      _converted: f._converted,
      normExif: buildExifForFile(f),
      cfg: buildConfigForFile(f)
    }));
    // Exporter drives the progress modal directly via window.ProgressModal —
    // status bar just gets the final result.
    const { errors } = await window.Exporter.exportBatch(entries, assets());
    setStatus(`done · ${errors.length} errors`, errors.length ? 'err' : null);
    setTimeout(() => setStatus('ready'), 2000);
  } catch (err) {
    console.error('[batch]', err);
    setStatus(err.message || 'batch failed', 'err');
  } finally {
    els.batchBtn.disabled = false;
    els.exportBtn.disabled = state.activeIdx < 0;
  }
}
els.batchBtn.addEventListener('click', runBatch);

// ─── Boot ────────────────────────────────────────────────────────────────
(async () => {
  try {
    setStatus('loading assets…', 'busy');
    await loadBundle();
    setStatus('ready');
    renderRail();
  } catch (err) {
    setStatus('bundle load failed: ' + err.message, 'err');
    console.error(err);
  }
})();
