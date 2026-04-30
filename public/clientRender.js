/* photo-tools — client-side Canvas renderer (preview + final export).
 *
 * One pipeline drives both the on-screen preview (low-res, displayed canvas,
 * customScale=0.5) and the full-resolution export (OffscreenCanvas, quality
 * setting drives scale). Browser Canvas2D operations are GPU-accelerated by
 * default — that's the "use GPU" of this app: blur via ctx.filter, scaled
 * drawImage, alpha compositing, and toBlob encoding all happen on GPU.
 */
(function () {
  'use strict';

  const R = window.PhotoRender;
  const PREVIEW_SCALE = 0.5;
  const PREVIEW_MAX_EDGE = 1440;   // long-edge cap for the bitmap used by the preview path

  // Decoded ImageBitmap cache — keyed by {File, maxEdge} so a photo can hold
  // both a downsampled preview bitmap and a full-resolution export bitmap.
  // The preview path almost always works on the small one, so blur+drawImage
  // stays fast even when the source is a 6000px native JPEG.
  const bitmapCache = new WeakMap();   // File → { full?: Promise<ImageBitmap>, preview?: Promise<ImageBitmap> }

  function loadBitmap(file, maxEdge) {
    let entry = bitmapCache.get(file);
    if (!entry) { entry = {}; bitmapCache.set(file, entry); }
    const slot = maxEdge ? 'preview' : 'full';
    if (entry[slot]) return entry[slot];
    const opts = { imageOrientation: 'from-image' };
    if (maxEdge) {
      // Resize at decode time so the GPU never materializes a full-res bitmap.
      // resizeWidth/resizeHeight on createImageBitmap is the cheapest path —
      // skips main-thread JS, runs on the codec thread.
      opts.resizeWidth  = maxEdge;
      opts.resizeHeight = maxEdge;
      opts.resizeQuality = 'medium';
    }
    const p = createImageBitmap(file, opts).then(async (bm) => {
      // resizeWidth/Height fits *into* the box, but createImageBitmap may
      // letterbox by default. We want "fit, keep aspect" — re-derive from
      // the source dims and re-decode if the result isn't aspect-correct.
      // (In practice Chrome/Firefox preserve aspect when only one dim is
      // smaller than source. This branch is a safety net for engines that
      // letterbox.)
      if (maxEdge && Math.abs(bm.width / bm.height - 1) < 0.01 && bm.width === maxEdge) {
        // Looks square but source probably isn't — re-decode honoring aspect.
        bm.close();
        const probe = await createImageBitmap(file, { imageOrientation: 'from-image' });
        const ratio = Math.min(maxEdge / probe.width, maxEdge / probe.height);
        const w = Math.round(probe.width * ratio);
        const h = Math.round(probe.height * ratio);
        probe.close();
        return createImageBitmap(file, {
          imageOrientation: 'from-image',
          resizeWidth: w, resizeHeight: h, resizeQuality: 'medium'
        });
      }
      return bm;
    });
    entry[slot] = p;
    return p;
  }

  // Caption-SVG → HTMLImageElement LRU cache. The SVG payload is dominated by
  // an 868KB base64-inlined Inter font face that the browser must parse on
  // every <img>.decode(). Without this cache, every preview render eats that
  // cost. Cache key = JSON of the inputs that actually change the SVG.
  const captionCache = new Map();        // key → { img, url }
  const CAPTION_CACHE_MAX = 20;

  function captionCacheKey(args) {
    return JSON.stringify({
      n: args.normExif,
      l: { W: args.layout.W, H: args.layout.H, scale: args.layout.scale,
           cap: args.layout.caption, baseY: args.layout.textBaselineY,
           cW: args.layout.canvas.W, cH: args.layout.canvas.H },
      t: args.template, ts: args.textStyle, sf: args.showFields
    });
  }

  function captionCacheTouch(key, entry) {
    captionCache.delete(key);
    captionCache.set(key, entry);   // moves to most-recent
    while (captionCache.size > CAPTION_CACHE_MAX) {
      const oldestKey = captionCache.keys().next().value;
      const oldest = captionCache.get(oldestKey);
      captionCache.delete(oldestKey);
      if (oldest && oldest.url) URL.revokeObjectURL(oldest.url);
    }
  }

  function svgToImage(svg, cacheKey) {
    if (cacheKey) {
      const hit = captionCache.get(cacheKey);
      if (hit) { captionCacheTouch(cacheKey, hit); return Promise.resolve(hit.img); }
    }
    return new Promise((resolve, reject) => {
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        if (cacheKey) captionCacheTouch(cacheKey, { img, url });
        else setTimeout(() => URL.revokeObjectURL(url), 5000);
        resolve(img);
      };
      img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });
  }

  // Rendered-background ImageBitmap cache. The bg pass (full-canvas blur +
  // saturate + brightness + darken + grain tile) is the second-most expensive
  // step after the caption SVG decode. Because bg only depends on the source
  // photo + bg params + canvas dim — not on caption text or padding — switching
  // back to a photo we've already rendered hits the cache and skips the entire
  // blur compute. Keyed by File identity (not pixels) so frame switches that
  // touch bg params correctly invalidate.
  const bgCache = new Map();   // key → { bitmap, key }
  const BG_CACHE_MAX = 6;

  function bgCacheKey(file, layout, params, rot) {
    const k = params.bg.type === 'frosted'
      ? `f|${layout.canvas.W}x${layout.canvas.H}|s${params.bg.blurSigma}|b${params.bg.brightness}|sat${params.bg.saturation}|d${params.bg.darken}|g${params.bg.grainOpacity}`
      : `s|${layout.canvas.W}x${layout.canvas.H}|c${params.bg.color}`;
    // File identity is required only for frosted bg (the photo IS the bg);
    // solid frames don't need it, but mixing keys is harmless. Rotation is
    // mixed in too — rotating the primary should rotate the blurred bg with
    // it, otherwise the bg goes out of sync with the rotated fg photo.
    return k + '|r' + (rot || 0) + '|' + (file ? (file.name + ':' + file.size + ':' + file.lastModified) : 'na');
  }

  function bgCacheTouch(key, entry) {
    bgCache.delete(key);
    bgCache.set(key, entry);
    while (bgCache.size > BG_CACHE_MAX) {
      const oldestKey = bgCache.keys().next().value;
      const oldest = bgCache.get(oldestKey);
      bgCache.delete(oldestKey);
      if (oldest && oldest.bitmap && oldest.bitmap.close) oldest.bitmap.close();
    }
  }

  // Pre-generated grain tile: 256×256 noise rasterized once at first use, then
  // tiled via createPattern. Replaces a 1M+ iteration Math.random loop that
  // ran on every preview render. Visual difference is imperceptible (the
  // human eye doesn't notice 256-px noise repetition under a heavy blur).
  let grainTile = null;
  function ensureGrainTile() {
    if (grainTile) return grainTile;
    const TILE = 256;
    const c = (typeof OffscreenCanvas !== 'undefined')
      ? new OffscreenCanvas(TILE, TILE)
      : Object.assign(document.createElement('canvas'), { width: TILE, height: TILE });
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

  // User-supplied signature image cache. Keyed by dataURL so a re-upload of
  // the same file (identical bytes → identical dataURL) reuses the bitmap.
  // Capped at 3 entries since we only support one active signature at a time
  // — extra entries appear when undo/redo or live re-upload happens.
  const customLogoCache = new Map();   // dataURL → Promise<ImageBitmap | HTMLImageElement | null>
  const CUSTOM_LOGO_CACHE_MAX = 3;

  async function decodeCustomLogo(dataURL) {
    if (!dataURL) return null;
    const hit = customLogoCache.get(dataURL);
    if (hit) return hit;
    const p = (async () => {
      // Prefer createImageBitmap (off-thread, returns a true ImageBitmap), but
      // Chrome rejects SVG blobs that lack explicit width/height attrs even
      // when a viewBox is present. HTMLImageElement is more lenient — it will
      // raster the SVG at its viewBox's intrinsic size. Both objects work
      // equally well as drawImage sources.
      try {
        const blob = await fetch(dataURL).then((r) => r.blob());
        return await createImageBitmap(blob);
      } catch (cibErr) {
        try {
          return await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = (e) => reject(e);
            img.src = dataURL;
          });
        } catch (imgErr) {
          console.warn('[customLogo] decode failed', cibErr, imgErr);
          return null;
        }
      }
    })();
    customLogoCache.set(dataURL, p);
    while (customLogoCache.size > CUSTOM_LOGO_CACHE_MAX) {
      const oldestKey = customLogoCache.keys().next().value;
      const oldest = customLogoCache.get(oldestKey);
      customLogoCache.delete(oldestKey);
      try {
        const bm = await oldest;
        if (bm && bm.close) bm.close();
      } catch { /* never resolved → nothing to close */ }
    }
    return p;
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
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      return;
    }
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y,     x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x,     y + h, rr);
    ctx.arcTo(x,     y + h, x,     y,     rr);
    ctx.arcTo(x,     y,     x + w, y,     rr);
    ctx.closePath();
  }
  function clipRoundRect(ctx, x, y, w, h, r) {
    pathRoundRect(ctx, x, y, w, h, r);
    ctx.clip();
  }

  // Draw `bm` cover-fit into `cell`, optionally rotating CW by `rot` (0/90/
  // 180/270 degrees). Rotation is applied around the cell center, after
  // clipping to a rounded rect of `radius`. Cover-fit is computed against
  // the post-rotation effective dimensions so a 90°/270° rotation correctly
  // covers a non-square cell.
  function drawCellPhoto(ctx, cell, bm, rot, radius) {
    ctx.save();
    clipRoundRect(ctx, cell.x, cell.y, cell.w, cell.h, radius);
    if (rot) {
      const sw = (rot === 90 || rot === 270) ? bm.height : bm.width;
      const sh = (rot === 90 || rot === 270) ? bm.width  : bm.height;
      const ratio = Math.max(cell.w / sw, cell.h / sh);
      const dw = bm.width  * ratio;
      const dh = bm.height * ratio;
      ctx.translate(cell.x + cell.w / 2, cell.y + cell.h / 2);
      ctx.rotate(rot * Math.PI / 180);
      ctx.drawImage(bm, -dw / 2, -dh / 2, dw, dh);
    } else {
      const ratio = Math.max(cell.w / bm.width, cell.h / bm.height);
      const dw = bm.width  * ratio;
      const dh = bm.height * ratio;
      ctx.drawImage(bm,
        cell.x + (cell.w - dw) / 2,
        cell.y + (cell.h - dh) / 2,
        dw, dh);
    }
    ctx.restore();
  }

  // Core compose: draws the bg + foreground + caption on the given canvas
  // sized to layout.canvas.W × layout.canvas.H. Used by both preview and
  // export entry points.
  async function compose(canvas, args) {
    const { bitmap, layout, params, captionSvg } = args;
    const W = layout.canvas.W, H = layout.canvas.H;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const rotForBg = ((args.rotation | 0) + 360) % 360;
    // ─── Background ──────────────────────────────────────────────────────
    const bgKey = args.cacheBg ? bgCacheKey(args.file, layout, params, rotForBg) : null;
    const bgHit = bgKey ? bgCache.get(bgKey) : null;
    if (bgHit) {
      bgCacheTouch(bgKey, bgHit);
      ctx.drawImage(bgHit.bitmap, 0, 0);
    } else if (params.bg.type === 'frosted') {
      const sigma = params.bg.blurSigma * layout.scale;
      ctx.save();
      ctx.filter = `blur(${sigma}px) saturate(${params.bg.saturation}) brightness(${params.bg.brightness})`;
      if (rotForBg) {
        const sw = (rotForBg === 90 || rotForBg === 270) ? bitmap.height : bitmap.width;
        const sh = (rotForBg === 90 || rotForBg === 270) ? bitmap.width  : bitmap.height;
        const ratio = Math.max(W / sw, H / sh);
        const dw = bitmap.width  * ratio;
        const dh = bitmap.height * ratio;
        ctx.translate(W / 2, H / 2);
        ctx.rotate(rotForBg * Math.PI / 180);
        ctx.drawImage(bitmap, -dw / 2, -dh / 2, dw, dh);
      } else {
        const ratio = Math.max(W / bitmap.width, H / bitmap.height);
        const dw = bitmap.width  * ratio;
        const dh = bitmap.height * ratio;
        ctx.drawImage(bitmap, (W - dw) / 2, (H - dh) / 2, dw, dh);
      }
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
    // Snapshot bg into the cache after rendering, so subsequent renders for
    // the same {file, dims, bg-params} skip the blur compute. We snapshot
    // BEFORE drawing fg/caption so the cached bitmap is bg-only.
    if (bgKey && !bgHit) {
      try {
        const snap = await createImageBitmap(canvas, 0, 0, W, H);
        bgCacheTouch(bgKey, { bitmap: snap, key: bgKey });
      } catch { /* createImageBitmap may fail on some Safari versions; skip cache */ }
    }

    // ─── Foreground shadow ───────────────────────────────────────────────
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

    // ─── Foreground (rounded photo, or N-cell collage) ───────────────────
    const rot = ((args.rotation | 0) + 360) % 360;
    const cells = R.collageCellRects(args.collage, layout);
    if (cells && Array.isArray(args.bitmaps) && args.bitmaps.length >= cells.length) {
      for (let i = 0; i < cells.length; i++) {
        if (args.bitmaps[i]) drawCellPhoto(ctx, cells[i], args.bitmaps[i], rot, layout.radius);
      }
    } else {
      drawCellPhoto(ctx, {
        x: layout.fgLeft, y: layout.fgTop, w: layout.fgW, h: layout.fgH
      }, bitmap, rot, layout.radius);
    }

    // ─── Caption (SVG → Image → drawImage) ───────────────────────────────
    if (captionSvg) {
      try {
        const capImg = await svgToImage(captionSvg, args.captionKey);
        ctx.drawImage(capImg, 0, 0);
      } catch (err) {
        console.warn('[render] caption rasterize failed:', err);
      }
    }

    // ─── Custom signature overlay (drawn last, clipped to fg rect) ───────
    if (args.customLogo && args.customLogo.data) {
      const bm = await decodeCustomLogo(args.customLogo.data);
      if (bm) {
        const bw = bm.naturalWidth  || bm.width;
        const bh = bm.naturalHeight || bm.height;
        const rect = R.customLogoRect(layout, args.customLogo, bw / bh);
        if (rect) {
          ctx.save();
          clipRoundRect(ctx, layout.fgLeft, layout.fgTop, layout.fgW, layout.fgH, layout.radius);
          ctx.globalAlpha = rect.opacity;
          ctx.drawImage(bm, rect.x, rect.y, rect.w, rect.h);
          ctx.restore();
        }
      }
    }
  }

  function buildLayoutAndCaption(bitmap, cfg, normExif, opts) {
    const frame = R.resolveFrame(cfg.frame);
    const params = R.resolveRenderParams(frame, cfg);
    const layoutOpts = {
      aspect: cfg.aspect,
      padding: cfg.padding,
      captionHeight: cfg.captionHeight,
      ...frame.layout
    };
    if (opts.customScale != null) layoutOpts.customScale = opts.customScale;
    if (opts.quality)             layoutOpts.quality     = opts.quality;
    // Rotation pre-image: when the user rotates 90°/270° the effective aspect
    // swaps. computeLayout needs to see the post-rotation dimensions so the
    // foreground rect ends up the right shape for the rotated photo.
    const rot = ((cfg.rotation | 0) + 360) % 360;
    const meta = (rot === 90 || rot === 270)
      ? { width: bitmap.height, height: bitmap.width }
      : { width: bitmap.width,  height: bitmap.height };
    const layout = R.computeLayout(meta, layoutOpts);
    const effectiveTextStyle = layout.caption.placement === 'overlay' ? 'light' : frame.textStyle;
    const captionArgs = {
      template: cfg.template,
      textStyle: effectiveTextStyle,
      showFields: cfg.showFields,
      fontFaceCss: opts.fontFaceCss,
      logos: opts.logos
    };
    const captionSvg = R.buildCaptionSvg(normExif, layout, captionArgs);
    // Cache only the preview path — full-resolution exports are ad-hoc and
    // rarely repeated, so caching them just wastes memory on multi-MB SVGs.
    const captionKey = opts.cacheCaption
      ? captionCacheKey({ normExif, layout, template: cfg.template, textStyle: effectiveTextStyle, showFields: cfg.showFields })
      : null;
    const validLayouts = ['h2', 'v2', 'h3', 'v3', '2x2'];
    const collage = (cfg.collage && validLayouts.indexOf(cfg.collage.layout) >= 0)
      ? { layout: cfg.collage.layout }
      : null;
    return {
      layout, params, captionSvg, captionKey,
      customLogo: cfg.customLogo || null,
      collage: collage,
      rotation: rot
    };
  }

  // Preview entry point — draws to the visible <canvas>. Uses a downsampled
  // ImageBitmap (long edge ≤ PREVIEW_MAX_EDGE) so blur + drawImage stay fast
  // even on multi-MB native originals.
  async function renderPreview(canvas, args) {
    const { file, cfg, normExif, logos, fontFaceCss, partnerFiles } = args;
    if (!file) {
      canvas.width = 1; canvas.height = 1;
      return;
    }
    const bitmap = await loadBitmap(file, PREVIEW_MAX_EDGE);
    const built = buildLayoutAndCaption(bitmap, cfg, normExif, {
      customScale: PREVIEW_SCALE, fontFaceCss, logos, cacheCaption: true
    });
    let bitmaps = null;
    if (built.collage && Array.isArray(partnerFiles) && partnerFiles.length) {
      const partnerBms = await Promise.all(partnerFiles.map((f) =>
        f ? loadBitmap(f, PREVIEW_MAX_EDGE).catch(() => null) : null
      ));
      bitmaps = [bitmap, ...partnerBms];
    }
    await compose(canvas, { bitmap, bitmaps, file, cacheBg: true, ...built });
  }

  // Final export — renders to an OffscreenCanvas at the requested quality
  // and returns a Blob (JPEG or PNG). Caller is responsible for re-attaching
  // EXIF (via ExifIO.reattachExif) and triggering download.
  async function renderFinal(args) {
    const { file, cfg, normExif, logos, fontFaceCss, format, quality, partnerFiles } = args;
    const bitmap = await loadBitmap(file);   // full-resolution
    const built = buildLayoutAndCaption(bitmap, cfg, normExif, {
      quality: quality || 'standard', fontFaceCss, logos
    });
    let bitmaps = null;
    if (built.collage && Array.isArray(partnerFiles) && partnerFiles.length) {
      const partnerBms = await Promise.all(partnerFiles.map((f) =>
        f ? loadBitmap(f).catch(() => null) : null
      ));
      bitmaps = [bitmap, ...partnerBms];
    }
    const canvas = (typeof OffscreenCanvas !== 'undefined')
      ? new OffscreenCanvas(built.layout.canvas.W, built.layout.canvas.H)
      : Object.assign(document.createElement('canvas'), { width: built.layout.canvas.W, height: built.layout.canvas.H });
    await compose(canvas, { bitmap, bitmaps, ...built });
    const mime = format === 'png' ? 'image/png' : 'image/jpeg';
    const q = quality === 'original' ? 0.98 : quality === 'high' ? 0.95 : 0.92;
    if (canvas.convertToBlob) return canvas.convertToBlob({ type: mime, quality: q });
    return new Promise((resolve) => canvas.toBlob(resolve, mime, q));
  }

  // Boot helper: fetch logos.json + fonts.css concurrently.
  async function loadAssets() {
    const [lj, fc] = await Promise.all([
      fetch('logos.json').then((r) => r.json()),
      fetch('fonts.css').then((r) => r.text())
    ]);
    return { logos: lj, fontFaceCss: fc };
  }

  window.ClientRender = {
    renderPreview, renderFinal, loadBitmap, loadAssets
  };
})();
