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

  function bgCacheKey(file, layout, params, rot, crop) {
    const k = params.bg.type === 'frosted'
      ? `f|${layout.canvas.W}x${layout.canvas.H}|s${params.bg.blurSigma}|b${params.bg.brightness}|sat${params.bg.saturation}|d${params.bg.darken}|g${params.bg.grainOpacity}`
      : `s|${layout.canvas.W}x${layout.canvas.H}|c${params.bg.color}`;
    // File identity is required only for frosted bg (the photo IS the bg);
    // solid frames don't need it, but mixing keys is harmless. Rotation +
    // crop are mixed in so changing either invalidates the right cache slot
    // — otherwise the rotated/cropped fg would float over a stale bg.
    const cropTag = crop
      ? `c${(crop.x || 0).toFixed(3)},${(crop.y || 0).toFixed(3)},${(crop.w || 1).toFixed(3)},${(crop.h || 1).toFixed(3)}`
      : 'c0';
    // Round rotation to 0.1° so float-y slider values don't shard the
    // cache across imperceptibly-different angles.
    const rotTag = 'r' + (rot ? Number(rot).toFixed(1) : '0');
    return k + '|' + rotTag + '|' + cropTag + '|' + (file ? (file.name + ':' + file.size + ':' + file.lastModified) : 'na');
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

  // User-supplied signature + background image caches. Keyed by dataURL so a
  // re-upload of the same file (identical bytes → identical dataURL) reuses
  // the decoded bitmap. Capped at 3 entries each since we only support one
  // active signature / bg at a time — extra entries appear when the user
  // swaps the active image live.
  const customLogoCache = new Map();
  const customBgCache = new Map();
  const CUSTOM_LOGO_CACHE_MAX = 3;
  const CUSTOM_BG_CACHE_MAX = 3;

  // Generic dataURL → ImageBitmap (or HTMLImageElement fallback for
  // dimension-less SVGs). Two named caches share this body — signature
  // and background — so the same dataURL doesn't get decoded twice if the
  // user happens to re-use the file.
  async function decodeDataUrlToBitmap(dataURL, cache, cap) {
    if (!dataURL) return null;
    const hit = cache.get(dataURL);
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
    cache.set(dataURL, p);
    while (cache.size > cap) {
      const oldestKey = cache.keys().next().value;
      const oldest = cache.get(oldestKey);
      cache.delete(oldestKey);
      try {
        const bm = await oldest;
        if (bm && bm.close) bm.close();
      } catch { /* never resolved → nothing to close */ }
    }
    return p;
  }

  function decodeCustomLogo(dataURL) {
    return decodeDataUrlToBitmap(dataURL, customLogoCache, CUSTOM_LOGO_CACHE_MAX);
  }
  function decodeCustomBg(dataURL) {
    return decodeDataUrlToBitmap(dataURL, customBgCache, CUSTOM_BG_CACHE_MAX);
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

  // Draw `bm` cover-fit into `cell`, applying CW rotation `rot` (any
  // angle in degrees) and crop `crop` ({x,y,w,h} normalized in post-
  // rotation [0..1]² of the rotated bbox). Cell is clipped to a rounded
  // rect of `radius`.
  //
  // Implementation: transform composition. We don't compute axis-aligned
  // bitmap source rects (which only worked for 90° multiples); instead we
  // set up a coordinate system on canvas where the crop rect's center is
  // at the cell center, scaled to cover-fit, then rotate, then drawImage
  // the bitmap centered at the (rotated) origin. This handles 0°, 90°,
  // and any angle in between with a single code path.
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

  // Shared between fg cells and the frosted bg pass. Both want "draw the
  // rotated+cropped bitmap, cover-fit into a destination rect" — so the
  // bg uses this with cell = full canvas, crop = the user's crop, rot =
  // the user's rotation.
  //
  // Crop coordinates are normalized in the inscribed safe area (the
  // largest rect inside the rotated bitmap that has no transparent
  // corners). At axis-aligned angles (0°/90°/180°/270°) the safe area
  // equals the full rotated bitmap, so this is the same as cropping
  // against the rotated bbox; at other angles the safe area shrinks
  // smoothly to inscribe the rotated content. Net effect: the visible
  // crop output is always free of transparent corners.
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
    // Crop center offset from the safe area's center (which is the
    // rotated-frame origin = source center).
    const cropOffX = (cx + cw / 2 - 0.5) * safeW;
    const cropOffY = (cy + ch / 2 - 0.5) * safeH;
    // Cover-fit: the crop region should cover the full destination rect.
    const ratio = Math.max(dst.w / cropPxW, dst.h / cropPxH);

    ctx.translate(dst.x + dst.w / 2, dst.y + dst.h / 2);
    ctx.scale(ratio, ratio);
    ctx.translate(-cropOffX, -cropOffY);
    ctx.rotate(rRad);
    ctx.drawImage(bm, -bm.width / 2, -bm.height / 2);
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

    const rotForBg = ((Number(args.rotation) || 0) % 360 + 360) % 360;
    // Custom bg image: when present + frame is frosted, the user-supplied
    // image becomes the bg source instead of the photo itself. Decoded
    // lazily by decodeCustomBg (cached) so re-renders don't re-decode.
    const customBgBm = (params.bg.type === 'frosted' && args.customBg && args.customBg.data)
      ? await decodeCustomBg(args.customBg.data)
      : null;
    // ─── Background ──────────────────────────────────────────────────────
    // bg cache is bypassed entirely when customBg is set — caching the
    // composited bg per-dataURL would balloon memory and the blur compute
    // is GPU-cheap to redo. Self-bg (frosted from photo) keeps its cache.
    const bgKey = (args.cacheBg && !customBgBm) ? bgCacheKey(args.file, layout, params, rotForBg, args.crop) : null;
    const bgHit = bgKey ? bgCache.get(bgKey) : null;
    if (bgHit) {
      bgCacheTouch(bgKey, bgHit);
      ctx.drawImage(bgHit.bitmap, 0, 0);
    } else if (params.bg.type === 'frosted') {
      const sigma = params.bg.blurSigma * layout.scale;
      const src = customBgBm || bitmap;
      ctx.save();
      ctx.filter = `blur(${sigma}px) saturate(${params.bg.saturation}) brightness(${params.bg.brightness})`;
      // Custom bg ignores the user's rotation + crop — the bg image is
      // independent of the photo and shouldn't tilt or crop with it. The
      // self-bg path uses the same transform-composition helper as the fg
      // cells so 0°, 90°, or arbitrary angles all go through one code path.
      const useTx = !customBgBm;
      drawRotatedCroppedSrc(
        ctx, src,
        { x: 0, y: 0, w: W, h: H },
        useTx ? rotForBg : 0,
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
    // Snapshot bg into the cache after rendering, so subsequent renders for
    // the same {file, dims, bg-params} skip the blur compute. We snapshot
    // BEFORE drawing fg/caption so the cached bitmap is bg-only.
    if (bgKey && !bgHit) {
      try {
        const snap = await createImageBitmap(canvas, 0, 0, W, H);
        bgCacheTouch(bgKey, { bitmap: snap, key: bgKey });
      } catch { /* createImageBitmap may fail on some Safari versions; skip cache */ }
    }

    // ─── Foreground silhouette path ──────────────────────────────────────
    // Frames can override the default rounded-rect clip with their own
    // path generator (`frame.clipPath(ctx, x, y, w, h, layout, args)`).
    // The override is used for: shadow casting (so the shadow tracks the
    // actual silhouette), photo clip in `drawCellPhoto`, and signature
    // clip below — so a torn-paper frame produces a torn shadow + torn
    // photo edge + torn-clipped signature, all consistent.
    const clipFn = (args.frame && typeof args.frame.clipPath === 'function')
      ? (ctx2, x, y, w, h) => args.frame.clipPath(ctx2, x, y, w, h, layout, args)
      : null;

    // ─── Foreground shadow ───────────────────────────────────────────────
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

    // ─── Foreground (rounded photo, or N-cell collage) ───────────────────
    const rot = ((Number(args.rotation) || 0) % 360 + 360) % 360;
    const cells = R.collageCellRects(args.collage, layout);
    if (cells && Array.isArray(args.bitmaps) && args.bitmaps.length >= cells.length) {
      for (let i = 0; i < cells.length; i++) {
        if (!args.bitmaps[i]) continue;
        // Crop applies to the primary photo only — partner files have no
        // per-cell crop UI and cropping them with the primary's coords would
        // be nonsense.
        const cellCrop = (i === 0) ? args.crop : null;
        drawCellPhoto(ctx, cells[i], args.bitmaps[i], rot, layout.radius, cellCrop, clipFn);
      }
    } else {
      drawCellPhoto(ctx, {
        x: layout.fgLeft, y: layout.fgTop, w: layout.fgW, h: layout.fgH
      }, bitmap, rot, layout.radius, args.crop, clipFn);
    }

    // ─── Caption (SVG → Image → drawImage) ───────────────────────────────
    // Stash the rasterized caption on `args` so any frame.decorate hook
    // that paints destructively over the caption zone (slide-mount's
    // tile-pattern leather fill) can re-stamp the caption on top with
    // its own treatment. Non-destructive decorate hooks ignore it.
    let captionImg = null;
    if (captionSvg) {
      try {
        captionImg = await svgToImage(captionSvg, args.captionKey);
        ctx.drawImage(captionImg, 0, 0);
      } catch (err) {
        console.warn('[render] caption rasterize failed:', err);
      }
    }
    args.captionImg = captionImg;

    // ─── Top-of-frame badge (cfg.topTemplate) ────────────────────────────
    // Painted BEFORE decorate so frames whose decorate hook already owns
    // the top padding (e.g., film-35's edge stamp) keep their identity if
    // a user happens to combine them — frame decoration wins visually.
    // Stash the rasterized bitmap on `args` for the same reason as
    // captionImg: a destructive decorate hook (slide-mount's leather
    // tile fill) can re-stamp it on top with its own treatment.
    let topBadgeImg = null;
    if (args.topBadgeSvg) {
      try {
        topBadgeImg = await svgToImage(args.topBadgeSvg, null);
        ctx.drawImage(topBadgeImg, 0, 0);
      } catch (err) {
        console.warn('[render] top badge rasterize failed:', err);
      }
    }
    args.topBadgeImg = topBadgeImg;

    // ─── Frame decorate hook (passe-partout, sprocket holes, etc.) ───────
    // Runs after caption so decorative elements draw on top of captions in
    // the rare overlap case (film-35 stamps cover caption corners), and
    // before signature so user signatures still sit at the very top.
    if (args.frame && typeof args.frame.decorate === 'function') {
      ctx.save();
      try { args.frame.decorate(ctx, layout, args); }
      catch (err) { console.warn('[render] frame.decorate failed:', err); }
      ctx.restore();
    }

    // ─── Custom signature overlay (drawn last, clipped to fg silhouette) ─
    if (args.customLogo && args.customLogo.data) {
      const bm = await decodeCustomLogo(args.customLogo.data);
      if (bm) {
        const bw = bm.naturalWidth  || bm.width;
        const bh = bm.naturalHeight || bm.height;
        const rect = R.customLogoRect(layout, args.customLogo, bw / bh);
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
    // cfg-level overrides win over frame.layout — these are user/preset
    // knobs (radius slider, "caption inside photo" toggle, factory preset
    // application) that intentionally override frame defaults.
    if (cfg.radiusOverride != null)   layoutOpts.radiusOverride     = cfg.radiusOverride;
    if (cfg.captionForceOverlay)      layoutOpts.captionForceOverlay = true;
    if (cfg.captionOverlayTextLift != null) layoutOpts.captionOverlayTextLift = cfg.captionOverlayTextLift;
    // Per-edge padding overrides — Compose-mode user dialing. Each null
    // falls through to scalar `padding` + frame boosts; non-null wins.
    if (cfg.paddingTop != null)    layoutOpts.paddingTop    = cfg.paddingTop;
    if (cfg.paddingRight != null)  layoutOpts.paddingRight  = cfg.paddingRight;
    if (cfg.paddingBottom != null) layoutOpts.paddingBottom = cfg.paddingBottom;
    if (cfg.paddingLeft != null)   layoutOpts.paddingLeft   = cfg.paddingLeft;
    if (opts.customScale != null) layoutOpts.customScale = opts.customScale;
    if (opts.quality)             layoutOpts.quality     = opts.quality;
    // Rotation + crop pre-image: cfg.crop is normalized in the rotation-
    // dependent inscribed safe area (the largest rect inside the rotated
    // source — see R.inscribedSafeArea). Layout uses crop × safe area so
    // the foreground rect aspect tracks what the user will actually see,
    // including the rotation-induced zoom-in at non-axis-aligned angles.
    const rot = ((Number(cfg.rotation) || 0) % 360 + 360) % 360;
    const safe = R.inscribedSafeArea(bitmap, rot);
    const cropW = cfg.crop && cfg.crop.w > 0 ? cfg.crop.w : 1;
    const cropH = cfg.crop && cfg.crop.h > 0 ? cfg.crop.h : 1;
    const meta = { width: safe.w * cropW, height: safe.h * cropH };
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
    // Top badge (cfg.topTemplate): independent of caption template; sits
    // in the frame's top padding. textStyle is the frame's native style
    // (not the caption's overlay-forced 'light') because the badge lives
    // outside the photo.
    const topBadgeSvg = R.buildTopBadgeSvg(normExif, layout, {
      topTemplate: cfg.topTemplate,
      textStyle: frame.textStyle,
      fontFaceCss: opts.fontFaceCss,
      logos: opts.logos
    });
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
      layout, params, captionSvg, captionKey, topBadgeSvg, frame, normExif,
      customLogo: cfg.customLogo || null,
      customBg: cfg.customBg || null,
      collage: collage,
      rotation: rot,
      crop: cfg.crop || null
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
    // customScale override — Compose-mode dragging passes a smaller value
    // (0.2-ish) so the canvas is ~1/6 the pixel area, drops render time
    // from ~50-80ms to ~10ms for smooth 60fps drag feedback. cfg values
    // are resolution-independent (crop normalized 0..1, padding in base-
    // 1440 px), so the same cfg produces the right geometry at any scale.
    const useScale = (args.customScale != null && isFinite(args.customScale))
      ? Math.max(0.05, Math.min(2, Number(args.customScale)))
      : PREVIEW_SCALE;
    const built = buildLayoutAndCaption(bitmap, cfg, normExif, {
      customScale: useScale, fontFaceCss, logos, cacheCaption: true
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
