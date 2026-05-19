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

self.importScripts(
  'vendor/piexif.js',
  'shared/render.js',
  'frames/frosted-noir.js',
  'frames/gallery-white.js',
  'frames/instax.js',
  'frames/film-35.js',
  'frames/film-mf.js',
  'frames/slide-mount.js',
  'frames/torn.js'
);

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

// Mirrors clientRender.js — see that file for the full design notes. Crop
// coords are normalized in the inscribed safe area (rotation-dependent),
// not the rotated bbox, so rendered output never has transparent corners.
function drawRotatedCroppedSrc(ctx, bm, dst, rot, crop) {
  const rRad = ((Number(rot) || 0) % 360 + 360) % 360 * Math.PI / 180;
  const safe = R.inscribedSafeArea(bm, rot);
  const safeW = safe.w, safeH = safe.h;

  const cx = crop && crop.x != null ? crop.x : 0;
  const cy = crop && crop.y != null ? crop.y : 0;
  const cw = crop && crop.w > 0 ? crop.w : 1;
  const ch = crop && crop.h > 0 ? crop.h : 1;
  const cropPxW = cw * safeW;
  const cropPxH = ch * safeH;
  const cropOffX = (cx + cw / 2 - 0.5) * safeW;
  const cropOffY = (cy + ch / 2 - 0.5) * safeH;
  const ratio = Math.max(dst.w / cropPxW, dst.h / cropPxH);

  ctx.translate(dst.x + dst.w / 2, dst.y + dst.h / 2);
  ctx.scale(ratio, ratio);
  ctx.translate(-cropOffX, -cropOffY);
  ctx.rotate(rRad);
  ctx.drawImage(bm, -bm.width / 2, -bm.height / 2);
}

function drawCellPhoto(ctx, cell, bm, rot, radius, crop, clipFn) {
  ctx.save();
  if (clipFn) {
    clipFn(ctx, cell.x, cell.y, cell.w, cell.h);
    ctx.clip();
  } else {
    clipRoundRect(ctx, cell.x, cell.y, cell.w, cell.h, radius);
  }
  drawRotatedCroppedSrc(ctx, bm, cell, rot, crop);
  ctx.restore();
}

async function compose(canvas, args) {
  const { bitmap, layout, params, captionSvg } = args;
  const W = layout.canvas.W, H = layout.canvas.H;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const rot = ((Number(args.rotation) || 0) % 360 + 360) % 360;
  // Decode custom bg if the caller passed one. Workers have no shared cache
  // — the cost is one fetch+createImageBitmap per render job, which is
  // negligible compared to the actual blur+encode pass.
  let customBgBm = null;
  if (params.bg.type === 'frosted' && args.customBg && args.customBg.data) {
    try {
      const blob = await fetch(args.customBg.data).then((r) => r.blob());
      customBgBm = await createImageBitmap(blob);
    } catch (err) {
      console.warn('[worker customBg] decode failed', err);
    }
  }
  if (params.bg.type === 'frosted') {
    const sigma = params.bg.blurSigma * layout.scale;
    const src = customBgBm || bitmap;
    ctx.save();
    ctx.filter = `blur(${sigma}px) saturate(${params.bg.saturation}) brightness(${params.bg.brightness})`;
    const useTx = !customBgBm;
    drawRotatedCroppedSrc(
      ctx, src,
      { x: 0, y: 0, w: W, h: H },
      useTx ? rot : 0,
      useTx ? args.crop : null
    );
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

  // Frames can override the default rounded-rect silhouette via
  // `frame.clipPath`. Used for shadow casting + photo clip + signature
  // clip — see clientRender.js for the full rationale.
  const clipFn = (args.frame && typeof args.frame.clipPath === 'function')
    ? (ctx2, x, y, w, h) => args.frame.clipPath(ctx2, x, y, w, h, layout, args)
    : null;

  if (params.shadow.opacity > 0) {
    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,${params.shadow.opacity})`;
    ctx.shadowBlur = params.shadow.blur * layout.scale;
    ctx.shadowOffsetY = params.shadow.offsetY * layout.scale;
    ctx.fillStyle = '#000';
    if (clipFn) clipFn(ctx, layout.fgLeft, layout.fgTop, layout.fgW, layout.fgH);
    else        pathRoundRect(ctx, layout.fgLeft, layout.fgTop, layout.fgW, layout.fgH, layout.radius);
    ctx.fill();
    ctx.restore();
  }

  const cells = R.collageCellRects(args.collage, layout);
  if (cells && Array.isArray(args.bitmaps) && args.bitmaps.length >= cells.length) {
    for (let i = 0; i < cells.length; i++) {
      if (!args.bitmaps[i]) continue;
      const cellCrop = (i === 0) ? args.crop : null;
      drawCellPhoto(ctx, cells[i], args.bitmaps[i], rot, layout.radius, cellCrop, clipFn);
    }
  } else {
    drawCellPhoto(ctx, {
      x: layout.fgLeft, y: layout.fgTop, w: layout.fgW, h: layout.fgH
    }, bitmap, rot, layout.radius, args.crop, clipFn);
  }

  // Stash captionImg on args so frame.decorate hooks that destructively
  // paint over the caption zone (slide-mount's leather tile fill) can
  // re-stamp the caption. Defer cap.close() until after decorate runs.
  let captionImg = null;
  if (captionSvg) {
    const blob = new Blob([captionSvg], { type: 'image/svg+xml;charset=utf-8' });
    // Workers can't use new Image(); createImageBitmap accepts SVG blobs in
    // Chrome/Firefox. Safari worker SVG support landed in 17.4.
    captionImg = await createImageBitmap(blob);
    ctx.drawImage(captionImg, 0, 0);
  }
  args.captionImg = captionImg;

  // Top-of-frame badge (cfg.topTemplate). Painted before decorate so the
  // frame's own top-padding decoration (e.g. film-35 edge stamp) keeps
  // visual primacy when combined with a user-applied topBadge. Stashed
  // on args so destructive decorate hooks (slide-mount leather) can
  // re-stamp it on top; close() is deferred until end of compose.
  let topBadgeImg = null;
  if (args.topBadgeSvg) {
    try {
      const tbBlob = new Blob([args.topBadgeSvg], { type: 'image/svg+xml;charset=utf-8' });
      topBadgeImg = await createImageBitmap(tbBlob);
      ctx.drawImage(topBadgeImg, 0, 0);
    } catch (err) {
      console.warn('[worker] top badge rasterize failed:', err);
    }
  }
  args.topBadgeImg = topBadgeImg;

  // Mirrors clientRender.js: frame.decorate runs after caption, before
  // signature. decorate runs in worker context (no DOM) — frames must use
  // ctx primitives + R.pathRoundRect, not document.createElement.
  if (args.frame && typeof args.frame.decorate === 'function') {
    ctx.save();
    try { args.frame.decorate(ctx, layout, args); }
    catch (err) { console.warn('[worker] frame.decorate failed:', err); }
    ctx.restore();
  }

  if (customBgBm) customBgBm.close();
  if (captionImg && captionImg.close) captionImg.close();
  if (topBadgeImg && topBadgeImg.close) topBadgeImg.close();

  if (args.customLogo && args.customLogo.data) {
    let bm = null;
    try {
      const sigBlob = await fetch(args.customLogo.data).then((r) => r.blob());
      bm = await createImageBitmap(sigBlob);
    } catch (err) {
      // Decoding a user signature should never abort the export — log and skip.
      console.warn('[worker customLogo] decode failed', err);
    }
    if (bm) {
      const rect = R.customLogoRect(layout, args.customLogo, bm.width / bm.height);
      if (rect) {
        ctx.save();
        if (clipFn) {
          clipFn(ctx, layout.fgLeft, layout.fgTop, layout.fgW, layout.fgH);
          ctx.clip();
        } else {
          clipRoundRect(ctx, layout.fgLeft, layout.fgTop, layout.fgW, layout.fgH, layout.radius);
        }
        ctx.globalAlpha = rect.opacity;
        ctx.drawImage(bm, rect.x, rect.y, rect.w, rect.h);
        ctx.restore();
      }
      bm.close();
    }
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

function buildGpsIfd(lat, lng) {
  if (!isFinite(lat) || !isFinite(lng)) return null;
  const G = self.piexif.GPSIFD;
  const ifd = {};
  ifd[G.GPSLatitudeRef] = lat >= 0 ? 'N' : 'S';
  ifd[G.GPSLatitude] = self.piexif.GPSHelper.degToDmsRational(lat);
  ifd[G.GPSLongitudeRef] = lng >= 0 ? 'E' : 'W';
  ifd[G.GPSLongitude] = self.piexif.GPSHelper.degToDmsRational(lng);
  return ifd;
}

async function reattachExif(sourceBlob, outputBlob, gpsOverride) {
  if (outputBlob.type !== 'image/jpeg') return outputBlob;
  let exifObj = null;
  try {
    const srcBin = await blobToBinaryString(sourceBlob);
    exifObj = self.piexif.load(srcBin);
  } catch {
    // source had no parseable EXIF — fine; only synthesize a shell if we
    // need to write a user-provided GPS override.
  }
  if (!exifObj && !gpsOverride) return outputBlob;
  if (!exifObj) exifObj = { '0th': {}, 'Exif': {}, 'GPS': {} };
  delete exifObj['1st'];
  delete exifObj.thumbnail;
  // Match the main-thread reattach: createImageBitmap already baked the
  // source's Orientation into the rendered pixels, so the output JPEG must
  // declare Orientation=1 (no rotation) — otherwise a second rotation gets
  // applied at view time. 274 is piexif.ImageIFD.Orientation.
  if (!exifObj['0th']) exifObj['0th'] = {};
  exifObj['0th'][274] = 1;
  if (gpsOverride) {
    const gpsIfd = buildGpsIfd(Number(gpsOverride.lat), Number(gpsOverride.lng));
    if (gpsIfd) exifObj.GPS = gpsIfd;
  }
  let exifBin;
  try {
    exifBin = self.piexif.dump(exifObj);
  } catch {
    return outputBlob;
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

function readGpsOverride(cfg) {
  const ovr = cfg && cfg.exif;
  if (!ovr) return null;
  if (ovr.latitude == null || ovr.longitude == null) return null;
  const lat = Number(ovr.latitude);
  const lng = Number(ovr.longitude);
  if (!isFinite(lat) || !isFinite(lng)) return null;
  return { lat, lng };
}

// ─── Job dispatch ────────────────────────────────────────────────────────
async function renderJob(msg) {
  const { file, cfg, normExif, format, quality, partnerFiles } = msg;
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const validLayouts = ['h2', 'v2', 'h3', 'v3', '2x2'];
  const wantsCollage = cfg.collage && validLayouts.indexOf(cfg.collage.layout) >= 0
                       && Array.isArray(partnerFiles) && partnerFiles.length;
  let partnerBms = [];
  if (wantsCollage) {
    partnerBms = await Promise.all(partnerFiles.map(async (f) => {
      if (!f) return null;
      try { return await createImageBitmap(f, { imageOrientation: 'from-image' }); }
      catch { return null; }
    }));
  }
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
    if (cfg.radiusOverride != null)   layoutOpts.radiusOverride     = cfg.radiusOverride;
    if (cfg.captionForceOverlay)      layoutOpts.captionForceOverlay = true;
    if (cfg.captionOverlayTextLift != null) layoutOpts.captionOverlayTextLift = cfg.captionOverlayTextLift;
    // Per-edge padding overrides — see clientRender.js mirror.
    if (cfg.paddingTop != null)    layoutOpts.paddingTop    = cfg.paddingTop;
    if (cfg.paddingRight != null)  layoutOpts.paddingRight  = cfg.paddingRight;
    if (cfg.paddingBottom != null) layoutOpts.paddingBottom = cfg.paddingBottom;
    if (cfg.paddingLeft != null)   layoutOpts.paddingLeft   = cfg.paddingLeft;
    const rot = ((Number(cfg.rotation) || 0) % 360 + 360) % 360;
    const safe = R.inscribedSafeArea(bitmap, rot);
    const cropW = cfg.crop && cfg.crop.w > 0 ? cfg.crop.w : 1;
    const cropH = cfg.crop && cfg.crop.h > 0 ? cfg.crop.h : 1;
    const meta = { width: safe.w * cropW, height: safe.h * cropH };
    const layout = R.computeLayout(meta, layoutOpts);
    const effectiveTextStyle = layout.caption.placement === 'overlay' ? 'light' : frame.textStyle;
    const captionSvg = R.buildCaptionSvg(normExif, layout, {
      template: cfg.template,
      textStyle: effectiveTextStyle,
      showFields: cfg.showFields,
      fontFaceCss, logos
    });
    const topBadgeSvg = R.buildTopBadgeSvg(normExif, layout, {
      topTemplate: cfg.topTemplate,
      textStyle: frame.textStyle,
      fontFaceCss, logos
    });
    const canvas = new OffscreenCanvas(layout.canvas.W, layout.canvas.H);
    const collage = wantsCollage && partnerBms.some(Boolean) ? { layout: cfg.collage.layout } : null;
    const bitmaps = collage ? [bitmap, ...partnerBms] : null;
    await compose(canvas, {
      bitmap, bitmaps, layout, params, captionSvg, topBadgeSvg, frame, normExif,
      customLogo: cfg.customLogo || null,
      customBg: cfg.customBg || null,
      collage,
      rotation: rot,
      crop: cfg.crop || null
    });
    const mime = format === 'png' ? 'image/png' : 'image/jpeg';
    const q = quality === 'original' ? 0.98 : quality === 'high' ? 0.95 : 0.92;
    let outBlob = await canvas.convertToBlob({ type: mime, quality: q });
    outBlob = await reattachExif(file, outBlob, readGpsOverride(cfg));
    return outBlob;
  } finally {
    bitmap.close();
    for (const bm of partnerBms) if (bm) bm.close();
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
