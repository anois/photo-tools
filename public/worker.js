/* photo-tools — render worker.
 *
 * Runs the full export render pipeline (decode + compose + encode + EXIF
 * re-attach) entirely off the main thread. Spawned by `exporter.js` for
 * batch exports; main thread handles UI updates and ZIP packaging.
 *
 * No DOM available here — caption SVG goes through createImageBitmap(blob)
 * instead of `new Image()`, and FileReader is replaced by Blob.arrayBuffer().
 */
/* eslint-disable no-restricted-globals */

self.importScripts('vendor/piexif.js', 'shared/render.js');

const R = self.PhotoRender;

let logos = null;
let fontFaceCss = '';
let initialized = false;

// ─── Grain tile (one per worker, lazily) ─────────────────────────────────
let grainTile = null;
function ensureGrainTile() {
  if (grainTile) return grainTile;
  const TILE = 256;
  const c = new OffscreenCanvas(TILE, TILE);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(TILE, TILE);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = 180 + ((Math.random() * 40) | 0);
    d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  grainTile = c;
  return c;
}

function drawGrain(ctx, W, H, opacity) {
  if (opacity <= 0) return;
  const tile = ensureGrainTile();
  const pattern = ctx.createPattern(tile, 'repeat');
  if (!pattern) return;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function pathRoundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y,     x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x,     y + h, rr);
  ctx.arcTo(x,     y + h, x,     y,     rr);
  ctx.arcTo(x,     y,     x + w, y,     rr);
  ctx.closePath();
}
function clipRoundRect(ctx, x, y, w, h, r) { pathRoundRect(ctx, x, y, w, h, r); ctx.clip(); }

async function compose(canvas, args) {
  const { bitmap, layout, params, captionSvg } = args;
  const W = layout.canvas.W, H = layout.canvas.H;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  if (params.bg.type === 'frosted') {
    const sigma = params.bg.blurSigma * layout.scale;
    const ratio = Math.max(W / bitmap.width, H / bitmap.height);
    const dw = bitmap.width * ratio;
    const dh = bitmap.height * ratio;
    ctx.save();
    ctx.filter = `blur(${sigma}px) saturate(${params.bg.saturation}) brightness(${params.bg.brightness})`;
    ctx.drawImage(bitmap, (W - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.restore();
    if (params.bg.darken) {
      ctx.fillStyle = `rgba(0,0,0,${params.bg.darken})`;
      ctx.fillRect(0, 0, W, H);
    }
    drawGrain(ctx, W, H, params.bg.grainOpacity);
  } else {
    ctx.fillStyle = params.bg.color;
    ctx.fillRect(0, 0, W, H);
  }

  if (params.shadow.opacity > 0) {
    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,${params.shadow.opacity})`;
    ctx.shadowBlur = params.shadow.blur * layout.scale;
    ctx.shadowOffsetY = params.shadow.offsetY * layout.scale;
    ctx.fillStyle = '#000';
    pathRoundRect(ctx, layout.fgLeft, layout.fgTop, layout.fgW, layout.fgH, layout.radius);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  clipRoundRect(ctx, layout.fgLeft, layout.fgTop, layout.fgW, layout.fgH, layout.radius);
  const fgRatio = Math.max(layout.fgW / bitmap.width, layout.fgH / bitmap.height);
  const fdw = bitmap.width * fgRatio;
  const fdh = bitmap.height * fgRatio;
  ctx.drawImage(bitmap,
    layout.fgLeft + (layout.fgW - fdw) / 2,
    layout.fgTop  + (layout.fgH - fdh) / 2,
    fdw, fdh);
  ctx.restore();

  if (captionSvg) {
    const blob = new Blob([captionSvg], { type: 'image/svg+xml;charset=utf-8' });
    // Workers can't use new Image(); createImageBitmap accepts SVG blobs in
    // Chrome/Firefox. Safari worker SVG support landed in 17.4.
    const cap = await createImageBitmap(blob);
    ctx.drawImage(cap, 0, 0);
    cap.close();
  }
}

// ─── EXIF passthrough (worker version) ───────────────────────────────────
async function blobToBinaryString(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  // Rebuild as Latin-1 string in chunks (fromCharCode.apply has stack limits).
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, buf.subarray(i, i + CHUNK));
  }
  return s;
}

async function reattachExif(sourceBlob, outputBlob) {
  if (outputBlob.type !== 'image/jpeg') return outputBlob;
  let exifBin;
  try {
    const srcBin = await blobToBinaryString(sourceBlob);
    const exifObj = self.piexif.load(srcBin);
    delete exifObj['1st'];
    delete exifObj.thumbnail;
    exifBin = self.piexif.dump(exifObj);
  } catch {
    return outputBlob;     // source had no EXIF — fine
  }
  try {
    const outBin = await blobToBinaryString(outputBlob);
    const merged = self.piexif.insert(exifBin, outBin);
    const arr = new Uint8Array(merged.length);
    for (let i = 0; i < merged.length; i++) arr[i] = merged.charCodeAt(i) & 0xff;
    return new Blob([arr], { type: 'image/jpeg' });
  } catch {
    return outputBlob;
  }
}

// ─── Job dispatch ────────────────────────────────────────────────────────
async function renderJob(msg) {
  const { file, cfg, normExif, format, quality } = msg;
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const frame = R.resolveFrame(cfg.frame);
    const params = R.resolveRenderParams(frame, cfg);
    const layoutOpts = {
      aspect: cfg.aspect,
      padding: cfg.padding,
      captionHeight: cfg.captionHeight,
      quality: quality || 'standard',
      ...frame.layout
    };
    const layout = R.computeLayout({ width: bitmap.width, height: bitmap.height }, layoutOpts);
    const effectiveTextStyle = layout.caption.placement === 'overlay' ? 'light' : frame.textStyle;
    const captionSvg = R.buildCaptionSvg(normExif, layout, {
      template: cfg.template,
      textStyle: effectiveTextStyle,
      showFields: cfg.showFields,
      fontFaceCss, logos
    });
    const canvas = new OffscreenCanvas(layout.canvas.W, layout.canvas.H);
    await compose(canvas, { bitmap, layout, params, captionSvg });
    const mime = format === 'png' ? 'image/png' : 'image/jpeg';
    const q = quality === 'original' ? 0.98 : quality === 'high' ? 0.95 : 0.92;
    let outBlob = await canvas.convertToBlob({ type: mime, quality: q });
    outBlob = await reattachExif(file, outBlob);
    return outBlob;
  } finally {
    bitmap.close();
  }
}

self.onmessage = async (e) => {
  const msg = e.data;
  if (msg.type === 'init') {
    logos = msg.logos;
    fontFaceCss = msg.fontFaceCss;
    initialized = true;
    self.postMessage({ type: 'ready', id: msg.id });
    return;
  }
  if (msg.type === 'render') {
    if (!initialized) {
      self.postMessage({ type: 'result', id: msg.id, ok: false, error: 'worker not initialized' });
      return;
    }
    try {
      const blob = await renderJob(msg);
      self.postMessage({ type: 'result', id: msg.id, ok: true, blob });
    } catch (err) {
      self.postMessage({ type: 'result', id: msg.id, ok: false, error: err && err.message || String(err) });
    }
  }
};
