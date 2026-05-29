/*
 * photo-tools shared rendering core.
 * UMD wrapper — usable in Node (require) and browser (script tag → window.PhotoRender).
 *
 * Inputs: pure data (normalized EXIF, logos map, font CSS string).
 * Outputs: SVG fragment strings, layout objects. No I/O, no native deps.
 *
 * Backend rasterizes the final SVG with sharp + libvips.
 * Browser rasterizes the caption SVG with `new Image()` and composites onto Canvas
 *   — algorithm is intentionally the SAME text rendering; tiny pixel diffs accepted.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PhotoRender = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ======================================================================
  // EXIF formatters + normalizer
  // ======================================================================

  // Coerce whatever EXIF hands us into a finite JS number. Handles:
  //   number → passthrough;
  //   "42.0" / "42" → parseFloat;
  //   "10/20000" / "640/100" → rational split (exifr sometimes emits these
  //      for edited/re-encoded JPEGs);
  //   [N, D] array → rational.
  // Returns NaN when the input genuinely can't be converted.
  function toNumber(v) {
    if (v == null || v === '') return NaN;
    if (typeof v === 'number') return v;
    if (Array.isArray(v) && v.length >= 2) {
      const d = Number(v[1]);
      return d ? Number(v[0]) / d : NaN;
    }
    const s = String(v).trim();
    const frac = s.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);
    if (frac) {
      const d = Number(frac[2]);
      return d ? Number(frac[1]) / d : NaN;
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function formatFocalLength(v) {
    const n = toNumber(v);
    if (!Number.isFinite(n)) return '';
    return Math.round(n) + 'mm';
  }
  function formatAperture(v) {
    const n = toNumber(v);
    if (!Number.isFinite(n)) return '';
    return 'F' + (n % 1 === 0 ? n.toFixed(0) : n.toFixed(1));
  }
  function formatShutter(v) {
    // If it's already a string with a slash that ends in 's', accept as-is
    // (pre-formatted, e.g., user-typed "1/180s").
    if (typeof v === 'string' && /s$/.test(v.trim())) return v.trim();
    // Display-form fraction without suffix (user typed "1/180") → trust it.
    if (typeof v === 'string' && /^\s*\d+\s*\/\s*\d+\s*$/.test(v) && Number(v.split('/')[0]) === 1) {
      return v.trim() + 's';
    }
    const n = toNumber(v);
    if (!Number.isFinite(n) || n <= 0) return '';
    if (n >= 1) return (n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)) + 's';
    return '1/' + Math.round(1 / n) + 's';
  }
  function formatIso(v) {
    const n = toNumber(v);
    if (!Number.isFinite(n)) return '';
    return 'ISO' + Math.round(n);
  }
  function formatBrand(v) {
    if (!v) return '';
    return String(v).toUpperCase().trim();
  }
  function formatDate(v) {
    if (!v) return '';
    if (v instanceof Date) {
      if (isNaN(v.getTime())) return '';
      return v.getFullYear() + '.' + pad2(v.getMonth() + 1) + '.' + pad2(v.getDate());
    }
    const s = String(v).trim();
    const m = s.match(/^(\d{4})[.\-:/](\d{1,2})[.\-:/](\d{1,2})/);
    if (m) return m[1] + '.' + pad2(m[2]) + '.' + pad2(m[3]);
    const d = new Date(s);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '.' + pad2(d.getMonth() + 1) + '.' + pad2(d.getDate());
  }
  function pad2(n) { n = String(n); return n.length < 2 ? '0' + n : n; }

  // exifr emits decimal-degree latitude/longitude on the top-level result
  // when gps:true. Hemisphere refs are folded into the sign (south/west are
  // negative). We render absolute degrees + N/S + E/W with 4-decimal
  // precision (~11 m) — DMS is too verbose for a caption line.
  function formatGps(lat, lng) {
    // null/undefined explicitly mean "missing" — don't let Number(null)==0
    // synthesize a fake "0°N · 0°E" line when the user has cleared GPS.
    if (lat == null || lng == null) return '';
    const a = typeof lat === 'number' ? lat : Number(lat);
    const b = typeof lng === 'number' ? lng : Number(lng);
    if (!isFinite(a) || !isFinite(b)) return '';
    return Math.abs(a).toFixed(4) + '°' + (a >= 0 ? 'N' : 'S')
      + ' · ' + Math.abs(b).toFixed(4) + '°' + (b >= 0 ? 'E' : 'W');
  }

  // LensInfo is a 4-element array [minFocal, maxFocal, maxApMin, maxApMax] that
  // most cameras write even when LensModel is blank. We synthesize a readable
  // "18-50mm F2.8" / "24-70mm F2.8-4" / "50mm F1.4" string so prime and
  // constant-aperture lenses still surface something when LensModel is missing.
  function lensInfoToModel(info) {
    if (!Array.isArray(info) || info.length < 4) return '';
    const fMin = toNumber(info[0]), fMax = toNumber(info[1]);
    const aMin = toNumber(info[2]), aMax = toNumber(info[3]);
    if (![fMin, fMax, aMin, aMax].every(Number.isFinite)) return '';
    const focal = fMin === fMax ? Math.round(fMin) + 'mm'
                                : Math.round(fMin) + '-' + Math.round(fMax) + 'mm';
    const fmtAp = function (n) { return n % 1 === 0 ? n.toFixed(0) : n.toFixed(1); };
    const aper = aMin === aMax ? 'F' + fmtAp(aMin)
                               : 'F' + fmtAp(aMin) + '-' + fmtAp(aMax);
    return focal + ' ' + aper;
  }

  // exifr with translateValues:true emits flash as either:
  //   - object: { Fired: true, Mode, RedEye, Function, Return }
  //   - string: "Flash fired" / "Flash did not fire, ..."
  //   - number: raw EXIF byte (LSB = fired)
  function flashWasFired(flash) {
    if (flash == null) return false;
    if (typeof flash === 'object') return !!flash.Fired;
    if (typeof flash === 'number') return (flash & 1) === 1;
    const s = String(flash).toLowerCase();
    return /fired/.test(s) && !/did not fire/.test(s);
  }

  function normalizeExif(raw) {
    if (!raw) raw = {};
    // Check TIFF/EXIF first, then fall back to XMP- and IPTC-style names.
    // exifr with mergeOutput:true flattens all segments; different tools
    // write fields to different places, so we cast a wide net.
    const lensModelRaw = raw.lensModel ?? raw.LensModel ?? raw.Lens;
    const lensFromInfo = lensInfoToModel(raw.LensInfo ?? raw.lensInfo);
    const focal35 = raw.FocalLengthIn35mmFilm ?? raw.FocalLengthIn35mmFormat;
    const flashRaw = raw.flash ?? raw.Flash;
    return {
      make:            formatBrand(raw.make ?? raw.Make ?? raw['tiff:Make']),
      model:           raw.model ?? raw.Model ?? raw['tiff:Model'] ?? '',
      focalLength:     formatFocalLength(raw.focalLength ?? raw.FocalLength),
      focalLength35:   focal35 ? formatFocalLength(focal35) : '',
      fNumber:         formatAperture(raw.fNumber ?? raw.FNumber ?? raw.ApertureValue),
      exposureTime:    formatShutter(raw.exposureTime ?? raw.ExposureTime ?? raw.ShutterSpeedValue),
      iso:             formatIso(raw.iso ?? raw.ISO ?? raw.ISOSpeedRatings ?? raw.PhotographicSensitivity),
      lensMake:        formatBrand(raw.lensMake ?? raw.LensMake),
      // Prefer explicit LensModel; fall back to LensInfo array when absent.
      lensModel:       (typeof lensModelRaw === 'string' && lensModelRaw.trim())
                         ? lensModelRaw
                         : lensFromInfo,
      date:            formatDate(raw.dateTimeOriginal ?? raw.DateTimeOriginal ?? raw.CreateDate ?? raw.DateCreated ?? raw.DateTime ?? raw.date),
      author:          (raw.author ?? raw.Artist ?? raw.artist ?? raw.Creator ?? raw.creator ?? raw['By-line'] ?? '').toString().trim(),
      // Extended fields surfaced by standard inspectors (macOS Finder, exiftool):
      meteringMode:    (raw.meteringMode ?? raw.MeteringMode ?? '').toString(),
      exposureProgram: (raw.exposureProgram ?? raw.ExposureProgram ?? '').toString(),
      whiteBalance:    (raw.whiteBalance ?? raw.WhiteBalance ?? '').toString(),
      flash:           typeof flashRaw === 'object' && flashRaw !== null
                         ? (flashRaw.Fired ? 'Fired' : 'Off')
                         : (flashRaw ?? '').toString(),
      flashFired:      flashWasFired(flashRaw),
      latitude:        typeof raw.latitude === 'number' ? raw.latitude : null,
      longitude:       typeof raw.longitude === 'number' ? raw.longitude : null,
      gps:             formatGps(raw.latitude, raw.longitude)
    };
  }

  function escapeXml(s) {
    return String(s == null ? '' : s).replace(/[<>&'"]/g, function (c) {
      return { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c];
    });
  }

  // ======================================================================
  // Layout
  // ======================================================================

  // bottomPaddingBias is added on top of `padding` ONLY at the bottom edge of
  // the canvas so caption text always has breathing room — even when the
  // photo's aspect matches the frame's and would otherwise be flush with the
  // padding on all four sides. Values are in base-1440 units; user `padding`
  // slider remains the upper edge / left / right reference.
  const BASE_PRESETS = {
    '9:16': { W: 1440, H: 2560, padding: 70, radius: 36, bottomCaptionH: 140, fgYOffset: -100, bottomPaddingBias: 60 },
    '3:4':  { W: 1440, H: 1920, padding: 70, radius: 36, bottomCaptionH: 120, fgYOffset: -70,  bottomPaddingBias: 60 },
    '1:1':  { W: 1440, H: 1440, padding: 70, radius: 36, bottomCaptionH: 110, fgYOffset: -60,  bottomPaddingBias: 80 },
    // Landscape canvases — same long-edge dimensions as their portrait
    // siblings, just rotated. Caption defaults shrink slightly because the
    // bottom strip eats vertical space that's already in shorter supply.
    '4:3':  { W: 1920, H: 1440, padding: 70, radius: 36, bottomCaptionH: 110, fgYOffset: -50,  bottomPaddingBias: 60 },
    '16:9': { W: 2560, H: 1440, padding: 70, radius: 36, bottomCaptionH: 100, fgYOffset: -45,  bottomPaddingBias: 60 }
  };

  // Resolve an aspect token to a layout preset. Known tokens hit BASE_PRESETS;
  // unknown tokens of the form "W:H" (e.g. "3:2", "2.35:1") are parsed and a
  // preset is synthesized — short edge fixed at 1440, long edge scales with
  // the ratio, layout constants take the conservative midpoint values. Returns
  // null on parse failure (caller decides whether to throw or fall back).
  const ASPECT_MIN = 0.1;
  const ASPECT_MAX = 10;
  function parseAspectRatio(token) {
    if (typeof token !== 'string') return null;
    const m = token.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
    if (!m) return null;
    const w = Number(m[1]);
    const h = Number(m[2]);
    if (!(w > 0 && h > 0)) return null;
    const r = w / h;
    if (r < ASPECT_MIN || r > ASPECT_MAX) return null;
    return { w, h, r };
  }
  function resolveAspectPreset(aspect) {
    if (BASE_PRESETS[aspect]) return BASE_PRESETS[aspect];
    const parsed = parseAspectRatio(aspect);
    if (!parsed) return null;
    const SHORT = 1440;
    const W = parsed.r >= 1 ? Math.round(SHORT * parsed.r) : SHORT;
    const H = parsed.r >= 1 ? SHORT : Math.round(SHORT / parsed.r);
    return {
      W, H,
      padding: 70,
      radius: 36,
      bottomCaptionH: 110,
      fgYOffset: -60,
      bottomPaddingBias: 60
    };
  }
  const QUALITY_FACTOR = { standard: 1, high: 2 };

  function computeCaptionZone(args) {
    const W = args.W, H = args.H;
    const fgLeft = args.fgLeft, fgTop = args.fgTop, fgW = args.fgW, fgH = args.fgH;
    const scale = args.scale, preferredBottomH = args.preferredBottomH;
    const fgRight = fgLeft + fgW, fgBottom = fgTop + fgH;
    const bottomGap = H - fgBottom;
    const rightGap = W - fgRight;
    const leftGap = fgLeft;

    // Side placement is preferred over overlay: lowered threshold so that
    // any non-trivial left/right gap (≥ ~40 px at scale=1) wins before we
    // fall back to drawing the caption on top of the photo.
    const MIN_BOTTOM = Math.round(70 * scale);
    const MIN_SIDE   = Math.round(40 * scale);
    const OVERLAY_H  = Math.round(70 * scale);

    // `forceOverlay` is a cfg-level escape hatch (set by the user via the
    // "caption inside photo" toggle, or by factory presets like "35mm
    // authentic") that drops the priority chain entirely and stamps the
    // caption inside the photo with a gradient backdrop.
    if (args.forceOverlay) {
      return { x: fgLeft, y: fgBottom - OVERLAY_H, width: fgW, height: OVERLAY_H, rotation: 0, placement: 'overlay' };
    }

    // `prefer` is a frame-level hint that overrides the default priority
    // (bottom > right > left > overlay) when the preferred zone has
    // enough space. Editorial layouts use this to route caption into a
    // wide right-side strip even though the bottom strip would also fit.
    // `top` is opt-in only — never auto-routes — because frames like
    // film/instant reserve top padding for sprockets/edge-print and the
    // caption shouldn't squat on it without explicit consent.
    if (args.prefer === 'top' && fgTop >= MIN_BOTTOM) {
      const h = Math.min(fgTop, Math.max(preferredBottomH, MIN_BOTTOM));
      return { x: 0, y: 0, width: W, height: h, rotation: 0, placement: 'top' };
    }
    if (args.prefer === 'right' && rightGap >= MIN_SIDE) {
      return { x: fgRight, y: fgTop, width: fgH, height: rightGap, rotation: -90, placement: 'right' };
    }
    if (args.prefer === 'left' && leftGap >= MIN_SIDE) {
      return { x: 0, y: fgTop, width: fgH, height: leftGap, rotation: 90, placement: 'left' };
    }

    if (bottomGap >= MIN_BOTTOM) {
      const h = Math.min(bottomGap, Math.max(preferredBottomH, MIN_BOTTOM));
      return { x: 0, y: H - h, width: W, height: h, rotation: 0, placement: 'bottom' };
    }
    if (rightGap >= MIN_SIDE) {
      return { x: fgRight, y: fgTop, width: fgH, height: rightGap, rotation: -90, placement: 'right' };
    }
    if (leftGap >= MIN_SIDE) {
      return { x: 0, y: fgTop, width: fgH, height: leftGap, rotation: 90, placement: 'left' };
    }
    return { x: fgLeft, y: fgBottom - OVERLAY_H, width: fgW, height: OVERLAY_H, rotation: 0, placement: 'overlay' };
  }

  function computeLayout(meta, opts) {
    opts = opts || {};
    const aspect = opts.aspect || '9:16';
    const base = resolveAspectPreset(aspect);
    if (!base) throw new Error('unknown aspect: ' + aspect);

    let basePadding = opts.padding != null ? Number(opts.padding) : base.padding;
    if (!isFinite(basePadding)) basePadding = base.padding;
    basePadding = Math.max(0, Math.min(300, basePadding));

    // Per-edge padding overrides (Compose mode). Each is in base-1440 units.
    // null = "fall through" — that edge gets basePadding + frame's boost +
    // aspect's bias (legacy behavior). A concrete number WINS outright: the
    // user explicitly dialed it, so frame.topPaddingBoost / aspect's
    // bottomPaddingBias are skipped on that edge. frame.minPadding is a soft
    // recommendation rendered as a warning in the UI; it doesn't clamp here.
    const padOverride = (v) => (v != null && isFinite(Number(v))) ? Math.max(0, Math.min(300, Number(v))) : null;
    const padTopOv    = padOverride(opts.paddingTop);
    const padRightOv  = padOverride(opts.paddingRight);
    const padBottomOv = padOverride(opts.paddingBottom);
    const padLeftOv   = padOverride(opts.paddingLeft);

    const baseRadius = opts.radiusOverride != null ? opts.radiusOverride : base.radius;
    // captionHeight is a direct override of the bottom caption zone height in
    // base-1440 pixels. Otherwise we use the preset value + any frame-supplied
    // extraBottom (e.g., polaroid's wider bottom).
    const baseCaptionH = (opts.captionHeight != null && isFinite(Number(opts.captionHeight)))
      ? Math.max(60, Math.min(400, Number(opts.captionHeight)))
      : base.bottomCaptionH + (opts.extraBottom || 0);
    const baseFgYOffset = base.fgYOffset + (opts.fgYBoost || 0);

    let scale;
    if (opts.customScale != null && isFinite(opts.customScale) && opts.customScale > 0) {
      scale = opts.customScale;
    } else {
      scale = QUALITY_FACTOR[opts.quality] || 1;
      if (opts.quality === 'original') {
        const defaultFgW = base.W - basePadding * 2;
        if (defaultFgW > 0) scale = Math.max(1, meta.width / defaultFgW);
      }
    }

    const W = Math.round(base.W * scale);
    const H = Math.round(base.H * scale);
    const padding = Math.round(basePadding * scale);
    const radius = Math.round(baseRadius * scale);
    const preferredBottomH = Math.round(baseCaptionH * scale);
    const fgYOffset = Math.round(baseFgYOffset * scale);

    // Asymmetric vertical padding: by default `padding` rules left/right and
    // top, while bottom adds `bottomPaddingBias` (per-aspect) plus optional
    // frame-level `bottomPaddingBoost`, and top adds `topPaddingBoost` (e.g.
    // film-35's sprocket-row space). Each edge can also be HARD-OVERRIDDEN
    // via opts.padding{Top,Right,Bottom,Left} — Compose-mode user dialing.
    // When an override is present, frame boost + aspect bias are bypassed
    // on that edge (the override is the user's explicit final word).
    const topBoostBase = (opts.topPaddingBoost || 0);
    const topPadding = padTopOv != null
      ? Math.round(padTopOv * scale)
      : padding + Math.round(topBoostBase * scale);
    const bottomBiasBase = (base.bottomPaddingBias || 0) + (opts.bottomPaddingBoost || 0);
    const bottomPadding = padBottomOv != null
      ? Math.round(padBottomOv * scale)
      : padding + Math.round(bottomBiasBase * scale);
    const leftPadding  = padLeftOv  != null ? Math.round(padLeftOv  * scale) : padding;
    const rightPadding = padRightOv != null ? Math.round(padRightOv * scale) : padding;

    // `extraRightInset` / `extraLeftInset` are frame-level options
    // (base-1440 units) that carve an additional strip out of one side
    // of the canvas for asymmetric editorial layouts. When > 0, fg
    // shrinks AND anchors to the OPPOSITE side's padding (instead of
    // centering), so the inset becomes a clean vertical zone the
    // caption auto-routes into. The two are mutually exclusive — if
    // both happen to be set, right wins. This pair is what makes
    // `editorial` (caption right) and `editorial-mirror` (caption
    // left) look like proper magazine spreads instead of just shifted
    // photos.
    const extraRightInset = Math.round((opts.extraRightInset || 0) * scale);
    const extraLeftInset  = extraRightInset > 0 ? 0 : Math.round((opts.extraLeftInset || 0) * scale);

    const inputAspect = meta.width / meta.height;
    let fgW = W - leftPadding - rightPadding - extraRightInset - extraLeftInset;
    let fgH = Math.round(fgW / inputAspect);
    const maxFgH = H - topPadding - bottomPadding;
    if (fgH > maxFgH) {
      fgH = maxFgH;
      fgW = Math.round(fgH * inputAspect);
    }

    // Horizontal placement:
    //   - extraRightInset > 0: anchor fg to leftPadding (the inset defines
    //     the right-side caption strip).
    //   - extraLeftInset  > 0: anchor fg to rightPadding (mirror).
    //   - otherwise: center within the L/R padding box, with optional
    //     fgXOffset shift in base-1440 units.
    let fgLeft;
    if (extraRightInset > 0) {
      fgLeft = leftPadding;
    } else if (extraLeftInset > 0) {
      fgLeft = W - rightPadding - fgW;
    } else {
      const fgXShift = Math.round((opts.fgXOffset || 0) * scale);
      fgLeft = Math.round(leftPadding + (W - leftPadding - rightPadding - fgW) / 2) + fgXShift;
      if (fgLeft < leftPadding) fgLeft = leftPadding;
      if (fgLeft + fgW > W - rightPadding) fgLeft = Math.max(leftPadding, W - rightPadding - fgW);
    }
    // Center within the asymmetric vertical box, then apply fgYOffset.
    let fgTop = Math.round(topPadding + (H - topPadding - bottomPadding - fgH) / 2 + fgYOffset);
    if (fgTop < topPadding) fgTop = topPadding;
    if (fgTop + fgH > H - bottomPadding) fgTop = Math.max(topPadding, H - bottomPadding - fgH);

    const caption = computeCaptionZone({
      W, H, fgLeft, fgTop, fgW, fgH, scale, preferredBottomH,
      prefer: opts.captionPrefer || null,
      forceOverlay: opts.captionForceOverlay === true
    });
    // captionOverlayTextLift: only meaningful when caption ends up in overlay
    // placement. Carried as canvas-px on caption so wrapCaption can apply it
    // to the text inner-group while leaving the gradient backdrop pinned to
    // the bottom edge.
    if (caption.placement === 'overlay' && opts.captionOverlayTextLift != null) {
      const lift = Math.max(0, Math.min(120, Number(opts.captionOverlayTextLift) || 0));
      caption.textLift = Math.round(lift * scale);
    }

    // outputPx is a soft scaling factor for "thin lines / hairlines that
    // shouldn't bloat at high quality": `Math.max(1, N * outputPx)` gives a
    // stroke width that stays visually thin across preview / standard /
    // high quality. At preview customScale=0.5 it floors to 1; at
    // standard scale=1 it's ~0.6 (also floors to 1); at high scale=2 it
    // becomes 1.2 — roughly half what plain `N * scale` would give.
    // Frame `decorate` hooks use this for passe-partout borders, sprocket
    // holes, and other decorative elements that should read as fine
    // print regardless of output resolution.
    const outputPx = Math.max(0.5, scale * 0.6);

    return {
      canvas: { W, H },
      W: caption.width,
      H: caption.height,
      fgW, fgH, fgLeft, fgTop,
      padding, radius,
      textBaselineY: caption.placement === 'overlay'
        ? Math.round(caption.height - 18 * scale)
        : Math.round(caption.height / 2 + 10 * scale),
      scale,
      outputPx,
      aspect,
      caption
    };
  }

  // Stroke / fill a rounded rectangle path. Public helper so frame
  // `decorate` hooks (gallery passe-partout, film-35 sprocket holes)
  // don't each need to inline the arcTo fallback for older Safari.
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

  // ─── Procedural grain tile · shared between frames ────────────────────
  // Lazily-built 64×64 grayscale noise tile that decorate hooks can blend
  // over their canvases. Built once per JS context (main thread or worker)
  // and pattern-tiled at the call site. The original tile lives in
  // clientRender.js as a private detail; this is the shared public version
  // so any frame's decorate (which runs in BOTH main thread and worker)
  // can apply grain consistently.
  let _grainTile = null;
  function ensureGrainTile() {
    if (_grainTile) return _grainTile;
    const W = 64, H = 64;
    const HasOC = (typeof OffscreenCanvas !== 'undefined');
    let tile;
    if (HasOC) {
      tile = new OffscreenCanvas(W, H);
    } else if (typeof document !== 'undefined') {
      tile = document.createElement('canvas');
      tile.width = W; tile.height = H;
    } else {
      return null;
    }
    const tctx = tile.getContext('2d');
    if (!tctx) return null;
    const img = tctx.createImageData(W, H);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      // Mean-centered noise so the tile is visually neutral on overlay
      // blend (rgb=128 → no change; values above/below tint up/down).
      const v = 96 + ((Math.random() * 64) | 0);
      d[i] = v; d[i+1] = v; d[i+2] = v; d[i+3] = 255;
    }
    tctx.putImageData(img, 0, 0);
    _grainTile = tile;
    return tile;
  }
  // Paint procedural film grain over the given rect at `opacity` (0..1).
  // Uses 'overlay' blend so light areas tint slightly darker + dark areas
  // tint slightly lighter — yields a chemical-emulsion feel rather than
  // the flat haze that 'source-over' would produce. Cheap: O(canvas/tile²)
  // pattern fills, no per-pixel JS.
  function fillGrain(ctx, x, y, w, h, opacity) {
    if (opacity <= 0) return;
    const tile = ensureGrainTile();
    if (!tile) return;
    const pattern = ctx.createPattern(tile, 'repeat');
    if (!pattern) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = pattern;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  // ======================================================================
  // Frames + caption colors
  // ======================================================================

  // Frame styles register themselves into FRAMES via registerFrame() — see
  // public/frames/*.js. Keeping each definition in its own file makes
  // adding / tweaking a frame a single-file change rather than a hunt
  // through this monolith.
  //
  // FRAME_ALIASES carries migration shims for retired frame names: when
  // a share-code or stored preset references a frame that's been removed,
  // we resolve to the closest surviving alternative rather than silently
  // falling through to the default. Aliases land in 0.22.0 — the cull from
  // 12 frames to 6 (see CLAUDE.md "Project conventions"). Old share-codes
  // posted before the cull still render to something visually adjacent.
  const FRAMES = {};
  const FRAME_ALIASES = {
    // Retired in 0.22.0 (12 → 6 frames). Each maps to the nearest survivor.
    'frosted':          'frosted-noir',     // light variant → dark variant (lossy: bg dim differs)
    'polaroid':         'instax',           // sibling instant-print frame
    'gallery-noir':     'gallery-white',    // dark gallery → light gallery (lossy: color invert)
    'kodak-pro':        'gallery-white',    // cream bg closest survivor; brand wordmark moves to cfg.topTemplate
    'editorial':        'gallery-white',    // asymmetric layout retired; default to clean gallery
    'editorial-mirror': 'gallery-white'
  };
  function registerFrame(name, def) { FRAMES[name] = def; }
  function resolveFrame(name) {
    if (FRAMES[name]) return FRAMES[name];
    const aliased = FRAME_ALIASES[name];
    if (aliased && FRAMES[aliased]) return FRAMES[aliased];
    return FRAMES['frosted-noir'] || FRAMES[Object.keys(FRAMES)[0]];
  }

  // ─── Per-frame cfg schema harness (1.7.x architecture · phase 9) ────
  // Each frame file may declare `def.cfg = { <cfgKey>: { kind, min, max,
  // step, options, default, frameDefault } }` to describe its user-facing
  // knobs. The two helpers below collect those declarations across ALL
  // registered frames and produce:
  //   collectFrameCfgDefaults()  — { cfgKey: defaultValue } map, fed into
  //                                app.js defaultCfg() to populate fresh
  //                                cfg objects.
  //   collectFrameCfgKeys()      — array of cfg key names, fed into
  //                                LOOK_KEYS so presets / share-codes
  //                                automatically snapshot all frame knobs.
  // Key uniqueness is enforced via console.warn (collision = bug, since
  // each frame's knobs use a frame-specific prefix today: bg* / torn* /
  // film35* / instax* / gal* / slide* / filmMf*).
  //
  // This is the foundational layer of rev.3's "frame files are self-
  // contained modules" promise. Future sessions will harness more of the
  // 11-touchpoint cfg checklist (doRender projection, sync, reset,
  // event listeners, resolveRenderParams) onto the same schemas — for
  // now only defaultCfg + LOOK_KEYS are auto-generated.
  function collectFrameCfgDefaults() {
    const out = {};
    for (const frame of Object.values(FRAMES)) {
      if (!frame || !frame.cfg) continue;
      for (const key of Object.keys(frame.cfg)) {
        if (key in out) {
          // Two frames declared the same cfg key — likely a bug.
          // eslint-disable-next-line no-console
          if (typeof console !== 'undefined') console.warn('[frame-cfg] duplicate key declared by multiple frames:', key);
          continue;
        }
        const spec = frame.cfg[key] || {};
        out[key] = ('default' in spec) ? spec.default : null;
      }
    }
    return out;
  }
  function collectFrameCfgKeys() {
    const seen = new Set();
    const out = [];
    for (const frame of Object.values(FRAMES)) {
      if (!frame || !frame.cfg) continue;
      for (const key of Object.keys(frame.cfg)) {
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(key);
      }
    }
    return out;
  }

  // Merge user cfg overrides with frame presets to produce the single set of
  // numbers both the SVG (compose.js) and Canvas (clientRender.js) renderers
  // consume. Keeps fallback logic in one place — neither renderer should
  // re-implement `cfg.X ?? frame.bg.X ?? hardcoded`.
  function resolveRenderParams(frame, cfg) {
    cfg = cfg || {};
    const bg = Object.assign({}, frame.bg);
    if (bg.type === 'frosted') {
      if (cfg.bgBlur != null)       bg.blurSigma    = Number(cfg.bgBlur);
      if (cfg.bgBrightness != null) bg.brightness   = Number(cfg.bgBrightness);
      if (cfg.bgSaturation != null) bg.saturation   = Number(cfg.bgSaturation);
      if (cfg.bgDarken != null)     bg.darken       = Math.max(0, Math.min(0.7, Number(cfg.bgDarken)));
      if (cfg.bgGrain != null)      bg.grainOpacity = Math.max(0, Math.min(0.5, Number(cfg.bgGrain)));
    }
    const sd = frame.shadowDefault || { blur: 0, offsetY: 0, opacity: 0 };
    const shadow = {
      blur:    cfg.shadowBlur    != null ? Number(cfg.shadowBlur)    : sd.blur,
      offsetY: cfg.shadowOffsetY != null ? Number(cfg.shadowOffsetY) : sd.offsetY,
      opacity: cfg.shadowOpacity != null ? Number(cfg.shadowOpacity) : sd.opacity
    };
    // Torn-paper params — only meaningful for the `torn` frame, but kept on
    // the universal params shape so renderer call sites don't need
    // frame-specific branching. Frame's `torn` block carries the defaults;
    // cfg overrides win when present. Fields:
    //   jitter      — inward bite depth in base-1440 px (0 = clean cut)
    //   step        — sample point spacing in base-1440 px (smaller = finer)
    //   edgeOpacity — alpha of the dark hairline traced along the tear
    const td = frame.torn || { jitter: 6, step: 7, edgeOpacity: 0.22 };
    const torn = {
      jitter:      cfg.tornJitter      != null ? Number(cfg.tornJitter)      : td.jitter,
      step:        cfg.tornStep        != null ? Number(cfg.tornStep)        : td.step,
      edgeOpacity: cfg.tornEdgeOpacity != null ? Number(cfg.tornEdgeOpacity) : td.edgeOpacity
    };
    // Film-mf vintage-aging scalar — 0..1 strength multiplier consumed by
    // film-mf's decorate hook to scale sepia / fade / vignette / foxing
    // alphas. Same shape contract as `torn` (frame default + cfg override).
    const fmd = frame.filmMf || { age: 1.0 };
    const filmMf = {
      age: cfg.filmMfAge != null ? Math.max(0, Math.min(1, Number(cfg.filmMfAge))) : fmd.age
    };
    // Instax (1.6.0+). 4 user-controllable knobs:
    //   slab      — bottom strip depth in base-1440 px (60–360). Flows
    //               into layoutOpts.extraBottom at compose call sites
    //               (clientRender.js / worker.js), NOT here — listed in
    //               params for readback/debugging but doesn't change bg.
    //   tint      — paper color enum 'pure' | 'cream' | 'aged' →
    //               override bg.color via the frame's tintColors table.
    //   dateStamp — toggle for the decorate-painted YY·MM·DD stamp.
    //   rainbow   — toggle for the decorate-painted 4-color signature.
    // Only meaningful when frame === 'instax'. Defaults match the frame.
    const ixd = (frame.instax) || { slab: 240, tint: 'pure', dateStamp: false, rainbow: false };
    const instaxTint = cfg.instaxTint || ixd.tint;
    const instax = {
      slab:      cfg.instaxSlab    != null ? Math.max(60, Math.min(360, Number(cfg.instaxSlab))) : ixd.slab,
      tint:      instaxTint,
      dateStamp: cfg.instaxStamp   != null ? !!cfg.instaxStamp   : ixd.dateStamp,
      rainbow:   cfg.instaxRainbow != null ? !!cfg.instaxRainbow : ixd.rainbow
    };
    // Apply tint to bg.color if frame has a tintColors table (instax).
    if (frame.instax && frame.instax.tintColors && bg.type === 'solid') {
      const tintColor = frame.instax.tintColors[instaxTint];
      if (tintColor) bg.color = tintColor;
    }
    // Slide-mount (1.7.0+). 4 user-controllable knobs:
    //   mountColor  — cardstock color enum 'cream' | 'leather' | 'black'
    //                 → looked up against frame.slideMount.mountColors,
    //                 overrides bg.color (the cardstock IS the bg).
    //   outerRing   — outer tray color enum 'wine' | 'brass' | 'charcoal'
    //                 → resolved via frame.slideMount.ringColors, passed
    //                 through params for decorate to paint.
    //   pebbleScale — pebble density multiplier 0.5–1.5× (5 buckets).
    //                 Resolved into numBumps that the tile cache keys on.
    //   bevelDepth  — bevel depth in base-1440 px (4–20). Scales the
    //                 cardstock bevel cues AND the aperture inset shadow.
    const smd = (frame.slideMount) || { mountColor: 'cream', outerRing: 'wine', pebbleScale: 1.0, bevelDepth: 8 };
    const slideMountColor = cfg.slideMountColor || smd.mountColor;
    const slideOuterRing  = cfg.slideOuterRing  || smd.outerRing;
    const slidePebble     = cfg.slidePebble != null ? Math.max(0.5, Math.min(1.5, Number(cfg.slidePebble))) : smd.pebbleScale;
    const slideBevel      = cfg.slideBevel  != null ? Math.max(4,   Math.min(20,  Number(cfg.slideBevel)))  : smd.bevelDepth;
    const slideMount = {
      mountColor: slideMountColor,
      outerRing:  slideOuterRing,
      pebbleScale: slidePebble,
      numBumps:    Math.round(180 * slidePebble),
      bevelDepth:  slideBevel
    };
    // Apply mountColor to bg.color if frame supplies a mountColors table.
    if (frame.slideMount && frame.slideMount.mountColors && bg.type === 'solid') {
      const mc = frame.slideMount.mountColors[slideMountColor];
      if (mc) bg.color = mc;
    }
    // Film-35 cine-look (1.5.0+). 4 user-controllable knobs:
    //   sprocketScale — pitch multiplier (0.5 = sparser / 2.0 = denser)
    //   grain         — emulsion noise intensity (0..1 mapped to overlay alpha)
    //   edgePrint     — show/hide top "BRAND · ISO·T · DX" stamp
    //   frameNo       — 'xx' (anonymous "· XX ·") | '1-36' (default) | 'a-z' (uppercase letter)
    // Only meaningful when frame === 'film-35'. Defaults match the legacy
    // hardcoded values so cfg-null sliders reproduce the legacy look.
    const f35d = (frame.film35) || { sprocketScale: 1.0, grain: 0, edgePrint: true, frameNo: '1-36' };
    const film35 = {
      sprocketScale: cfg.f35Sprocket  != null ? Math.max(0.5, Math.min(2.0, Number(cfg.f35Sprocket))) : f35d.sprocketScale,
      grain:         cfg.f35Grain     != null ? Math.max(0, Math.min(1, Number(cfg.f35Grain)))       : f35d.grain,
      edgePrint:     cfg.f35EdgePrint != null ? !!cfg.f35EdgePrint                                    : f35d.edgePrint,
      frameNo:       cfg.f35FrameNo   || f35d.frameNo
    };
    // Gallery-white passe-partout (1.4.0+). 4 user-controllable knobs:
    //   matWidth     — outer hairline distance from photo edge (base-1440 px)
    //   lineSpacing  — gap between inner and outer hairlines
    //   lineWeight   — multiplier on stroke width (1.0 = legacy hardcoded look)
    //   lineColor    — enum 'ink' | 'charcoal' | 'warm' (decorate maps to RGBA)
    // Only meaningful when frame === 'gallery-white'. Defaults match the
    // pre-1.4 hardcoded values so cfg-null sliders reproduce legacy look.
    const gwd = (frame.galleryWhite) || { matWidth: 26, lineSpacing: 18, lineWeight: 1.0, lineColor: 'ink' };
    const galleryWhite = {
      matWidth:    cfg.galMatWidth    != null ? Math.max(8, Math.min(60, Number(cfg.galMatWidth)))    : gwd.matWidth,
      lineSpacing: cfg.galLineSpacing != null ? Math.max(4, Math.min(24, Number(cfg.galLineSpacing))) : gwd.lineSpacing,
      lineWeight:  cfg.galLineWeight  != null ? Math.max(0.5, Math.min(2.4, Number(cfg.galLineWeight))): gwd.lineWeight,
      lineColor:   cfg.galLineColor   || gwd.lineColor
    };
    return { bg: bg, shadow: shadow, torn: torn, filmMf: filmMf, film35: film35, instax: instax, slideMount: slideMount, galleryWhite: galleryWhite };
  }

  function captionColors(textStyle) {
    if (textStyle === 'dark') {
      return { brand: '#1a1a1a', meta: 'rgba(0,0,0,0.7)', accent: 'rgba(0,0,0,0.45)' };
    }
    return { brand: '#ffffff', meta: 'rgba(255,255,255,0.9)', accent: 'rgba(255,255,255,0.6)' };
  }

  function parseHex(hex) {
    const s = String(hex || '').replace(/^#/, '');
    if (s.length === 3) return s.split('').map(function (c) { return parseInt(c + c, 16); });
    return [0, 2, 4].map(function (i) { return parseInt(s.slice(i, i + 2) || '0', 16); });
  }
  function relLum(hex) {
    const rgb = parseHex(hex);
    const chan = rgb.map(function (v) {
      const c = (v || 0) / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
  }
  function contrast(l1, l2) { return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }

  function resolveLogoFill(brandHex, textStyle) {
    const fallback = captionColors(textStyle).brand;
    if (!brandHex) return fallback;
    const bgLum = textStyle === 'dark' ? 0.93 : 0.06;
    return contrast(bgLum, relLum(brandHex)) >= 1.3 ? brandHex : fallback;
  }

  // ======================================================================
  // Brand → logo key
  // ======================================================================

  const ALIASES = {
    canoninc: 'canon',
    canoncameras: 'canon',
    nikoncorporation: 'nikon',
    nikonjapan: 'nikon',
    leicacameraagermany: 'leica',
    leicacamera: 'leica',
    leicacameraag: 'leica',
    sonygroup: 'sony',
    sonycorporation: 'sony',
    applecomputer: 'apple',
    applemacbook: 'apple',
    appleinc: 'apple',
    samsungelectronics: 'samsung',
    samsungtechwin: 'samsung',
    huaweitechnologies: 'huawei',
    huaweiterminal: 'huawei',
    xiaomitechnology: 'xiaomi',
    google: 'google',
    googlepixel: 'google',
    oppoelectronics: 'oppo',
    vivomobile: 'vivo',
    djitechnology: 'dji'
  };

  function brandToLogoKey(make, logosMap) {
    if (!make) return null;
    let s = String(make).toLowerCase().trim();
    s = s.replace(/\b(corporation|corp|co\.?,?|ltd\.?|inc\.?|imaging|camera|company|gmbh|ag|kk|k\.k\.|optics|optical|electronics|technology|technologies|mobile|japan)\b/g, '');
    s = s.replace(/[^a-z0-9]/g, '');
    if (!s) return null;
    if (logosMap[s]) return s;
    if (ALIASES[s] && logosMap[ALIASES[s]]) return ALIASES[s];

    // Start-of-string prefix match: a brand like "sonyalpha" should hit "sony".
    for (const key in logosMap) {
      if (key.length >= 4 && s.startsWith(key)) return key;
    }
    // Fallback: substring match, but only for keys ≥ 4 chars to avoid
    // spurious hits like "asu" → "asus".
    for (const key in logosMap) {
      if (key.length >= 4 && s.indexOf(key) >= 0) return key;
    }
    return null;
  }

  // ======================================================================
  // Inline logo SVG
  // ======================================================================

  // Swap near-black fills (#000-#222 range, `black`) to white so multi-color
  // logos stay legible on dark captions. Also swaps near-white to dark on light
  // captions. Branded colors (red, yellow, blue, etc.) are preserved.
  const NEAR_BLACK_RE = /(fill\s*[=:]\s*['"]?)(#0{3,6}|#1[0-2][0-9a-fA-F]{0,4}|#2[0-2][0-9a-fA-F]{0,4}|black)(['"]?)/g;
  const NEAR_WHITE_RE = /(fill\s*[=:]\s*['"]?)(#f{3,6}|#f[cdefCDEF][cdefCDEF]{0,4}|white)(['"]?)/g;

  function adaptMultiColor(inner, textStyle) {
    if (textStyle === 'light') return inner.replace(NEAR_BLACK_RE, '$1#ffffff$3');
    if (textStyle === 'dark')  return inner.replace(NEAR_WHITE_RE, '$1#1a1a1a$3');
    return inner;
  }

  function logoInlineSvg(key, logosMap, opts) {
    const entry = logosMap[key];
    if (!entry) return { svg: '', width: 0 };
    const height = opts.height;
    const width = Math.round(height * (entry.vw / entry.vh));
    if (entry.monochrome) {
      const fill = opts.fillColor || entry.brandColor || '#000';
      const inner = entry.inner.replace(/\s+fill\s*=\s*"[^"]*"/gi, '');
      return {
        svg: '<svg x="' + opts.x + '" y="' + opts.y + '" width="' + width + '" height="' + height + '" viewBox="' + entry.viewBox + '" fill="' + fill + '" preserveAspectRatio="xMidYMid meet">' + inner + '</svg>',
        width: width
      };
    }
    const inner = adaptMultiColor(entry.inner, opts.textStyle);
    return {
      svg: '<svg x="' + opts.x + '" y="' + opts.y + '" width="' + width + '" height="' + height + '" viewBox="' + entry.viewBox + '" preserveAspectRatio="xMidYMid meet">' + inner + '</svg>',
      width: width
    };
  }

  // ======================================================================
  // Caption helpers
  // ======================================================================

  function estimateTextWidth(text, sizePx, weight, letterSpacing) {
    if (letterSpacing == null) letterSpacing = 0;
    const widthPerEm = (weight && weight >= 600) ? 0.54 : 0.49;
    const n = String(text).length;
    return n * sizePx * widthPerEm + Math.max(0, n - 1) * letterSpacing;
  }

  function on(show, key) { return !show || show[key] !== false; }

  // Lightning-bolt glyph used for the optional "flash fired" indicator.
  // Sits on the text baseline like a capital letter: height matches Inter
  // cap-height (~0.72·textSize), aspect matches the path's viewBox (10:16).
  // Caller passes the same `y` it used for `<text>` and the rendered glyph
  // top/bottom mirrors how a digit "0" or capital "I" would occupy that line.
  const FLASH_GLYPH_HEIGHT_RATIO = 0.72;  // glyph height / textSize
  const FLASH_GLYPH_ASPECT = 0.625;       // glyph width / glyph height (10/16)
  function flashGlyphWidth(textSize) {
    return Math.round(textSize * FLASH_GLYPH_HEIGHT_RATIO * FLASH_GLYPH_ASPECT);
  }
  function flashGlyphSvg(x, baselineY, textSize, fill) {
    const h = Math.round(textSize * FLASH_GLYPH_HEIGHT_RATIO);
    const w = Math.round(h * FLASH_GLYPH_ASPECT);
    const top = baselineY - h;   // bottom of glyph sits on baseline
    return '<svg x="' + x + '" y="' + top + '" width="' + w + '" height="' + h +
      '" viewBox="0 0 10 16" overflow="visible">' +
      '<path d="M7 0 L0 9 L4 9 L3 16 L10 7 L6 7 Z" fill="' + fill + '"/></svg>';
  }

  // Boxed spec: rounded-rect outlined value with a tiny uppercase label
  // hanging below it. The visual primitive behind the magazine-style
  // spec-rail / spec-grid templates (Hasselblad / Leica reference) and
  // available to any future template / decorate hook that wants the
  // same look without re-implementing the geometry.
  //
  // Returns { svg, width, height, boxH }:
  //   width  — outer width of the rect (max of value text + 2·padX, or min)
  //   height — total height including the label row (when label present)
  //   boxH   — rect height alone (without the label gap + label row)
  //
  // The rect is centered on x; the label (when given) sits centered below
  // the rect with `labelGap` of breathing room. Caller passes the absolute
  // (x, cy_of_rect) anchor — matches the convention of renderLensInline /
  // flashGlyphSvg so templates can mix-and-match these primitives.
  function boxedSpec(x, cy, value, label, opts) {
    opts = opts || {};
    const valuePx = opts.valuePx || 22;
    const labelPx = opts.labelPx || 11;
    const padX    = opts.padX != null ? opts.padX : 14;
    const padY    = opts.padY != null ? opts.padY : 8;
    const radius  = opts.radius != null ? opts.radius : 8;
    const stroke  = opts.stroke != null ? opts.stroke : 1.2;
    const labelGap = opts.labelGap != null ? opts.labelGap : 8;
    const minBoxW  = opts.minBoxW  != null ? opts.minBoxW  : Math.round(valuePx * 2.4);
    const valueColor  = opts.valueColor  || '#1a1a1a';
    const labelColor  = opts.labelColor  || 'rgba(0,0,0,0.55)';
    const strokeColor = opts.strokeColor || 'rgba(0,0,0,0.35)';
    const fontFamily  = opts.fontFamily  || "'Inter',sans-serif";
    const valueWeight = opts.valueWeight || 500;
    const labelWeight = opts.labelWeight || 500;
    const labelLetterSpacing = opts.labelLetterSpacing != null ? opts.labelLetterSpacing : 1;

    const valueText = String(value == null ? '' : value);
    const valueW = estimateTextWidth(valueText, valuePx, valueWeight, 0);
    const boxW = Math.max(Math.round(valueW + padX * 2), minBoxW);
    const boxH = Math.round(valuePx + padY * 2);
    const boxX = Math.round(x - boxW / 2);
    const boxY = Math.round(cy - boxH / 2);
    // Value baseline approximates Inter cap-baseline at ~0.78 of em-box
    // — mirrors the math used in tWordmark / tHeadline.
    const valueY = boxY + padY + Math.round(valuePx * 0.78);

    let svg = '<rect x="' + boxX + '" y="' + boxY + '" width="' + boxW + '" height="' + boxH +
      '" rx="' + radius + '" fill="none" stroke="' + strokeColor +
      '" stroke-width="' + stroke + '"/>' +
      '<text x="' + x + '" y="' + valueY + '" text-anchor="middle" ' +
      'style="font:' + valueWeight + ' ' + valuePx + 'px ' + fontFamily +
      ';fill:' + valueColor + ';">' + escapeXml(valueText) + '</text>';

    let totalH = boxH;
    if (label) {
      const labelText = String(label);
      const labelY = boxY + boxH + labelGap + labelPx;
      svg += '<text x="' + x + '" y="' + labelY + '" text-anchor="middle" ' +
        'style="font:' + labelWeight + ' ' + labelPx + 'px ' + fontFamily +
        ';fill:' + labelColor + ';letter-spacing:' + labelLetterSpacing +
        'px;text-transform:uppercase;">' + escapeXml(labelText) + '</text>';
      totalH = (labelY - boxY) + Math.round(labelPx * 0.25);
    }
    return { svg: svg, width: boxW, height: totalH, boxH: boxH };
  }

  function renderLensInline(args) {
    const lens = (args.lensModel || '').trim();
    if (!lens && !args.lensMake) return '';
    const logoKey = brandToLogoKey(args.lensMake, args.logosMap || {});
    const textSize = args.textSize;
    const cx = args.cx, y = args.y;
    const textClass = args.textClass || 'meta';
    const scale = args.scale || 1;
    const ls = args.letterSpacing || 0;
    if (!logoKey) {
      return '<text x="' + cx + '" y="' + y + '" text-anchor="middle" class="' + textClass + '">' + escapeXml(lens || String(args.lensMake || '').toUpperCase()) + '</text>';
    }
    const entry = args.logosMap[logoKey];
    const logoH = Math.round(textSize * 1.15);
    const gap = Math.round(10 * scale);
    const fill = resolveLogoFill(entry.brandColor, args.textStyle);
    const probe = logoInlineSvg(logoKey, args.logosMap, { x: 0, y: 0, height: logoH, fillColor: fill, textStyle: args.textStyle });
    const textW = lens ? estimateTextWidth(lens, textSize, args.textWeight || 400, ls) : 0;
    const totalW = probe.width + (lens ? gap + textW : 0);
    const startX = Math.round(cx - totalW / 2);
    const logoY = Math.round(y - textSize * 0.9);
    const logo = logoInlineSvg(logoKey, args.logosMap, { x: startX, y: logoY, height: logoH, fillColor: fill, textStyle: args.textStyle });
    const textX = startX + probe.width + gap;
    const textEl = lens ? '<text x="' + textX + '" y="' + y + '" text-anchor="start" class="' + textClass + '">' + escapeXml(lens) + '</text>' : '';
    return logo.svg + textEl;
  }

  // ======================================================================
  // Templates  (each: (exif, layout, fontFaceCss, opts) -> innerSvgString)
  // ======================================================================

  function tMinimalText(exif, layout, fontFaceCss, opts) {
    const colors = captionColors(opts.textStyle);
    const show = opts.showFields;
    const brandLogoKey = on(show, 'brand') ? brandToLogoKey(exif.make, opts.logos || {}) : null;
    const brandText = on(show, 'brand') ? (exif.make || '').toString().toUpperCase() : '';
    const modelText = on(show, 'model') ? (exif.model || '') : '';
    const params = [
      on(show, 'focal')    ? exif.focalLength  : '',
      on(show, 'aperture') ? exif.fNumber      : '',
      on(show, 'shutter')  ? exif.exposureTime : '',
      on(show, 'iso')      ? exif.iso          : ''
    ].filter(Boolean).join('  ');
    const showFlash = on(show, 'flash') && exif.flashFired;
    const extras = [
      on(show, 'lens') ? exif.lensModel : '',
      on(show, 'date') ? exif.date      : '',
      on(show, 'gps')  ? exif.gps       : ''
      ,(on(show, 'author') && exif.author) ? '© ' + exif.author : ''
    ].filter(Boolean).join('  •  ');

    const s = layout.scale || 1;
    const cx = layout.W / 2;
    const y = layout.textBaselineY;
    const brandPx = Math.round(30 * s);
    const metaPx = Math.round(26 * s);
    const extraPx = Math.round(20 * s);
    const gap = Math.round(18 * s);
    const mainY = extras ? y - Math.round(16 * s) : y;

    // Compose main line: [brand or logo]  [model?]  [params]
    // We render text using <text> and logo as nested <svg>; center by estimating widths.
    const ls = Math.round(1 * s);
    const lsBrand = Math.round(2 * s);

    const brandLabel = (modelText && brandText) ? (brandText + ' · ' + modelText) : (brandText + (modelText ? ' ' + modelText : ''));
    // When brand has a logo, we show logo + optional model inline
    const showingLogo = !!(brandLogoKey && on(show, 'brand'));
    const logoW = showingLogo
      ? (function () { const entry = opts.logos[brandLogoKey]; return Math.round(brandPx * (entry.vw / entry.vh)); })()
      : 0;
    const sepModelLabel = (showingLogo && modelText) ? (' · ' + modelText) : '';
    const sepModelW = sepModelLabel ? estimateTextWidth(sepModelLabel, Math.round(metaPx * 0.95), 400, ls) : 0;
    const sepModelGap = sepModelLabel ? Math.round(8 * s) : 0;
    const brandW = showingLogo ? (logoW + sepModelGap + sepModelW) : estimateTextWidth(brandLabel, brandPx, 600, lsBrand);
    const paramsW = estimateTextWidth(params, metaPx, 400, ls);
    const sep = (showingLogo || brandText || modelText) && params ? gap : 0;
    // Flash glyph hangs off the right of the centered brand+params group so
    // the params line keeps its pre-flash horizontal position. Width gap is
    // ~half the text height — wider than the within-params two-space separation.
    const flashGap = Math.round(metaPx * 0.5);
    const totalW = (showingLogo || brandLabel ? brandW : 0) + sep + (params ? paramsW : 0);
    const startX = totalW > 0
      ? Math.round(cx - totalW / 2)
      : Math.round(cx - flashGlyphWidth(metaPx) / 2);   // flash alone → center it

    let parts = [];
    let cursor = startX;

    if (showingLogo) {
      const entry = opts.logos[brandLogoKey];
      const fill = resolveLogoFill(entry.brandColor, opts.textStyle);
      const logoY = Math.round(mainY - brandPx * 0.9);
      const logo = logoInlineSvg(brandLogoKey, opts.logos, { x: cursor, y: logoY, height: brandPx, fillColor: fill, textStyle: opts.textStyle });
      parts.push(logo.svg);
      cursor += logo.width;
      if (modelText) {
        // Render " · model" as one text element so the separator sits visually
        // between logo and model identically to the all-text "BRAND · MODEL"
        // path (line above where brandLabel is built).
        const sepLabel = ' · ' + modelText;
        const mGap = Math.round(8 * s);
        cursor += mGap;
        parts.push('<text x="' + cursor + '" y="' + mainY + '" text-anchor="start" class="model-inline">' + escapeXml(sepLabel) + '</text>');
        cursor += estimateTextWidth(sepLabel, Math.round(metaPx * 0.95), 400, ls);
      }
    } else if (brandLabel) {
      parts.push('<text x="' + cursor + '" y="' + mainY + '" text-anchor="start" class="brand">' + escapeXml(brandLabel) + '</text>');
      cursor += brandW;
    }

    if (params) {
      cursor += sep;
      parts.push('<text x="' + cursor + '" y="' + mainY + '" text-anchor="start" class="meta">' + escapeXml(params) + '</text>');
      cursor += paramsW;
    }
    if (showFlash) {
      // Add flashGap only when there's preceding content; if flash is alone
      // the cursor already sits at a centered glyph position.
      if (totalW > 0) cursor += flashGap;
      parts.push(flashGlyphSvg(cursor, mainY, metaPx, colors.meta));
    }

    const extraLine = extras
      ? '<text x="' + cx + '" y="' + (mainY + Math.round(30 * s)) + '" text-anchor="middle" class="extra">' + escapeXml(extras) + '</text>'
      : '';

    const styleBlock = '<style>' + fontFaceCss +
      '.brand{font:600 ' + brandPx + 'px \'Inter\',sans-serif;fill:' + colors.brand + ';letter-spacing:' + lsBrand + 'px;}' +
      '.meta{font:400 ' + metaPx + 'px \'Inter\',sans-serif;fill:' + colors.meta + ';letter-spacing:' + ls + 'px;}' +
      '.model-inline{font:400 ' + Math.round(metaPx * 0.95) + 'px \'Inter\',sans-serif;fill:' + colors.meta + ';letter-spacing:' + ls + 'px;}' +
      '.extra{font:400 ' + extraPx + 'px \'Inter\',sans-serif;fill:' + colors.meta + ';letter-spacing:' + ls + 'px;}' +
      '</style>';

    return styleBlock + parts.join('') + extraLine;
  }

  function tBrandLogo(exif, layout, fontFaceCss, opts) {
    const colors = captionColors(opts.textStyle);
    const show = opts.showFields;
    const brandText = (exif.make || '').toString().toUpperCase();
    const model = on(show, 'model') ? (exif.model || '') : '';
    const topRight = [on(show, 'focal') ? exif.focalLength : '', on(show, 'aperture') ? exif.fNumber : ''].filter(Boolean).join('  ');
    const botRight = [on(show, 'shutter') ? exif.exposureTime : '', on(show, 'iso') ? exif.iso : ''].filter(Boolean).join('  ');
    const showLens = on(show, 'lens');
    const showDate = on(show, 'date');

    const s = layout.scale || 1;
    const cx = layout.W / 2;
    const baseY = layout.textBaselineY;
    const hasAuthor = on(show, 'author') && !!exif.author;
    const hasGps = on(show, 'gps') && !!exif.gps;
    const hasExtras = (showLens && exif.lensModel) || (showDate && exif.date) || (showLens && exif.lensMake) || hasAuthor || hasGps;
    const y = hasExtras ? baseY - Math.round(14 * s) : baseY;

    const brandPx = Math.round(36 * s);
    const modelPx = Math.round(22 * s);
    const paramsPx = Math.round(26 * s);
    const paramsSubPx = Math.round(22 * s);
    const extraPx = Math.round(20 * s);
    const gap = Math.round(30 * s);
    const lineGap = Math.round(32 * s);
    const dividerHalf = Math.round(32 * s);
    // Match the text-brand cap height so logo and BRAND text align visually
    // when the user toggles between branded photos and unmatched ones.
    const brandLogoH = brandPx;

    const logoKey = on(show, 'brand') ? brandToLogoKey(exif.make, opts.logos) : null;
    let brandBlock = '';
    if (!on(show, 'brand')) {
      brandBlock = '';
    } else if (logoKey) {
      const entry = opts.logos[logoKey];
      const fill = resolveLogoFill(entry.brandColor, opts.textStyle);
      const logoY = y - lineGap / 2 - brandLogoH + Math.round(8 * s);
      const probe = logoInlineSvg(logoKey, opts.logos, { x: 0, y: 0, height: brandLogoH, fillColor: fill, textStyle: opts.textStyle });
      const logoX = cx - gap - probe.width;
      brandBlock = logoInlineSvg(logoKey, opts.logos, { x: logoX, y: logoY, height: brandLogoH, fillColor: fill, textStyle: opts.textStyle }).svg;
    } else if (brandText) {
      brandBlock = '<text x="' + (cx - gap) + '" y="' + (y - lineGap / 2) + '" text-anchor="end" class="brand">' + escapeXml(brandText) + '</text>';
    }

    const modelLine = model
      ? '<text x="' + (cx - gap) + '" y="' + (y + lineGap / 2 + Math.round(4 * s)) + '" text-anchor="end" class="model">' + escapeXml(model) + '</text>'
      : '';
    const paramsTop = topRight
      ? '<text x="' + (cx + gap) + '" y="' + (y - lineGap / 2) + '" text-anchor="start" class="params">' + escapeXml(topRight) + '</text>'
      : '';
    const showFlash = on(show, 'flash') && exif.flashFired;
    const paramsBotY = y + lineGap / 2 + Math.round(4 * s);
    let paramsBot = botRight
      ? '<text x="' + (cx + gap) + '" y="' + paramsBotY + '" text-anchor="start" class="params2">' + escapeXml(botRight) + '</text>'
      : '';
    if (showFlash) {
      const botW = botRight ? estimateTextWidth(botRight, paramsSubPx, 400, Math.round(1 * s)) : 0;
      const flashX = (cx + gap) + botW + (botRight ? Math.round(paramsSubPx * 0.55) : 0);
      paramsBot += flashGlyphSvg(flashX, paramsBotY, paramsSubPx, colors.meta);
    }
    const hasLeft = !!brandBlock || !!modelLine;
    const hasRight = !!paramsTop || !!paramsBot;
    const divider = (hasLeft && hasRight)
      ? '<line x1="' + cx + '" y1="' + (y - dividerHalf) + '" x2="' + cx + '" y2="' + (y + dividerHalf / 3) + '" stroke="' + colors.accent + '" stroke-width="' + Math.max(1, Math.round(2 * s)) + '"/>'
      : '';

    let extraSvg = '';
    if (hasExtras) {
      const extraY = baseY + Math.round(30 * s);
      const dateText = (showDate && exif.date) ? exif.date : '';
      const lensText = (showLens && exif.lensModel) ? exif.lensModel : '';
      const lensMake = showLens ? exif.lensMake : '';
      if (dateText && (lensText || lensMake)) {
        const sep = '  •  ';
        const lsX = Math.round(1 * s);
        const dateW = estimateTextWidth(dateText + sep, extraPx, 400, lsX);
        const lensLogoKey = brandToLogoKey(lensMake, opts.logos);
        const lensLogoH = Math.round(extraPx * 1.15);
        let lensWidth = 0, lensFill = null;
        if (lensLogoKey) {
          const lEntry = opts.logos[lensLogoKey];
          lensFill = resolveLogoFill(lEntry.brandColor, opts.textStyle);
          lensWidth = Math.round(lensLogoH * (lEntry.vw / lEntry.vh));
        }
        const innerGap = lensLogoKey ? Math.round(8 * s) : 0;
        const lensTextW = estimateTextWidth(lensText, extraPx, 400, lsX);
        const totalW = dateW + lensWidth + innerGap + lensTextW;
        const startX = cx - totalW / 2;
        let cursor = startX;
        extraSvg += '<text x="' + cursor + '" y="' + extraY + '" text-anchor="start" class="extra">' + escapeXml(dateText + sep) + '</text>';
        cursor += dateW;
        if (lensLogoKey) {
          const logoY = Math.round(extraY - extraPx * 0.9);
          extraSvg += logoInlineSvg(lensLogoKey, opts.logos, { x: cursor, y: logoY, height: lensLogoH, fillColor: lensFill, textStyle: opts.textStyle }).svg;
          cursor += lensWidth + innerGap;
        }
        if (lensText) {
          extraSvg += '<text x="' + cursor + '" y="' + extraY + '" text-anchor="start" class="extra">' + escapeXml(lensText) + '</text>';
        }
      } else if (lensText || lensMake) {
        extraSvg = renderLensInline({
          lensMake: lensMake, lensModel: lensText,
          cx: cx, y: extraY, textClass: 'extra',
          textSize: extraPx, textWeight: 400,
          letterSpacing: Math.round(1 * s),
          textStyle: opts.textStyle, scale: s, logosMap: opts.logos
        });
      } else if (dateText) {
        extraSvg = '<text x="' + cx + '" y="' + extraY + '" text-anchor="middle" class="extra">' + escapeXml(dateText) + '</text>';
      }
      // Author line goes BELOW the date/lens row (or alone if no other extras).
      if (hasAuthor) {
        const authorY = baseY + Math.round((extraSvg ? 58 : 30) * s);
        extraSvg += '<text x="' + cx + '" y="' + authorY + '" text-anchor="middle" class="extra">© ' + escapeXml(exif.author) + '</text>';
      }
      // GPS line tucks in below the author (or below date/lens if no author).
      if (hasGps) {
        const lineCount = (extraSvg.match(/<text /g) || []).length;
        const gpsY = baseY + Math.round((lineCount > 0 ? 30 + 28 * lineCount : 30) * s);
        extraSvg += '<text x="' + cx + '" y="' + gpsY + '" text-anchor="middle" class="extra">' + escapeXml(exif.gps) + '</text>';
      }
    }

    const styleBlock = '<style>' + fontFaceCss +
      '.brand{font:600 ' + brandPx + 'px \'Inter\',sans-serif;fill:' + colors.brand + ';letter-spacing:' + Math.round(3 * s) + 'px;}' +
      '.model{font:400 ' + modelPx + 'px \'Inter\',sans-serif;fill:' + colors.meta + ';letter-spacing:' + Math.round(1 * s) + 'px;}' +
      '.params{font:600 ' + paramsPx + 'px \'Inter\',sans-serif;fill:' + colors.brand + ';letter-spacing:' + Math.round(1 * s) + 'px;}' +
      '.params2{font:400 ' + paramsSubPx + 'px \'Inter\',sans-serif;fill:' + colors.meta + ';letter-spacing:' + Math.round(1 * s) + 'px;}' +
      '.extra{font:400 ' + extraPx + 'px \'Inter\',sans-serif;fill:' + colors.meta + ';letter-spacing:' + Math.round(1 * s) + 'px;}' +
      '</style>';

    return styleBlock + brandBlock + modelLine + divider + paramsTop + paramsBot + extraSvg;
  }

  function tDateLens(exif, layout, fontFaceCss, opts) {
    const colors = captionColors(opts.textStyle);
    const show = opts.showFields;
    const date = on(show, 'date') ? (exif.date || '') : '';
    const lens = on(show, 'lens') ? (exif.lensModel || '') : '';
    const lensMake = on(show, 'lens') ? exif.lensMake : '';
    const author = (on(show, 'author') && exif.author) ? exif.author : '';
    const showFlash = on(show, 'flash') && exif.flashFired;
    const s = layout.scale || 1;
    const cx = layout.W / 2;
    const y = layout.textBaselineY;
    const px = Math.round(26 * s);
    const ls = Math.round(1.5 * s);
    const fGap = Math.round(px * 0.5);
    const fW = flashGlyphWidth(px);

    const style = '<style>' + fontFaceCss +
      '.text{font:400 ' + px + 'px \'Inter\',sans-serif;fill:' + colors.meta + ';letter-spacing:' + ls + 'px;}' +
      '</style>';
    const authorSvg = author
      ? '<text x="' + cx + '" y="' + (y + Math.round(30 * s)) + '" text-anchor="middle" class="text">© ' + escapeXml(author) + '</text>'
      : '';

    if (!date && !lens && !lensMake) {
      const flashOnly = showFlash
        ? flashGlyphSvg(Math.round(cx - fW / 2), y, px, colors.meta)
        : '';
      return style + flashOnly + authorSvg;
    }
    if (date && !lens && !lensMake) {
      // Date stays centered at cx via text-anchor=middle (native text metrics);
      // ⚡ hangs off to the right using estimator only for the offset, so
      // estimator drift is along one axis and never disturbs date centering.
      let out = style + '<text x="' + cx + '" y="' + y + '" text-anchor="middle" class="text">' + escapeXml(date) + '</text>';
      if (showFlash) {
        const dateW = estimateTextWidth(date, px, 400, ls);
        out += flashGlyphSvg(Math.round(cx + dateW / 2 + fGap), y, px, colors.meta);
      }
      return out + authorSvg;
    }
    if (!date) {
      // lens-only: renderLensInline self-centers at cx; append flash to the
      // right using its estimated width.
      const inline = renderLensInline({
        lensMake: lensMake, lensModel: lens,
        cx: cx, y: y, textClass: 'text', textSize: px, textWeight: 400,
        letterSpacing: ls, textStyle: opts.textStyle, scale: s, logosMap: opts.logos
      });
      let flashEl = '';
      if (showFlash) {
        const lensLogoKeyOnly = brandToLogoKey(lensMake, opts.logos);
        const probeW = lensLogoKeyOnly
          ? Math.round(px * 1.15 * (opts.logos[lensLogoKeyOnly].vw / opts.logos[lensLogoKeyOnly].vh))
          : 0;
        const lTextW = lens ? estimateTextWidth(lens, px, 400, ls) : 0;
        const lineW = probeW + (lens && lensLogoKeyOnly ? Math.round(10 * s) : 0) + lTextW;
        flashEl = flashGlyphSvg(Math.round(cx + lineW / 2 + fGap), y, px, colors.meta);
      }
      return style + inline + flashEl + authorSvg;
    }
    // date + lens
    const sep = '  •  ';
    const dateW = estimateTextWidth(date + sep, px, 400, ls);
    const lensLogoKey = brandToLogoKey(lensMake, opts.logos);
    const lensLogoH = Math.round(px * 1.15);
    let lensWidth = 0, lensFill = null;
    if (lensLogoKey) {
      const lEntry = opts.logos[lensLogoKey];
      lensFill = resolveLogoFill(lEntry.brandColor, opts.textStyle);
      lensWidth = Math.round(lensLogoH * (lEntry.vw / lEntry.vh));
    }
    const innerGap = lensLogoKey ? Math.round(8 * s) : 0;
    const lensTextW = estimateTextWidth(lens, px, 400, ls);
    // Don't include flash in totalW — keep date+lens centered as before, ⚡ hangs off right.
    const totalW = dateW + lensWidth + innerGap + lensTextW;
    const startX = cx - totalW / 2;
    let cursor = startX;
    let out = style + '<text x="' + cursor + '" y="' + y + '" text-anchor="start" class="text">' + escapeXml(date + sep) + '</text>';
    cursor += dateW;
    if (lensLogoKey) {
      const logoY = Math.round(y - px * 0.9);
      out += logoInlineSvg(lensLogoKey, opts.logos, { x: cursor, y: logoY, height: lensLogoH, fillColor: lensFill, textStyle: opts.textStyle }).svg;
      cursor += lensWidth + innerGap;
    }
    if (lens) {
      out += '<text x="' + cursor + '" y="' + y + '" text-anchor="start" class="text">' + escapeXml(lens) + '</text>';
      cursor += lensTextW;
    }
    if (showFlash) out += flashGlyphSvg(cursor + fGap, y, px, colors.meta);
    return out + authorSvg;
  }

  // NEW: vertical-stack tech-data look (camera OSD style)
  function tTechStack(exif, layout, fontFaceCss, opts) {
    const colors = captionColors(opts.textStyle);
    const show = opts.showFields;
    const s = layout.scale || 1;
    const cx = layout.W / 2;
    const cy = layout.textBaselineY;

    const brandLogoKey = on(show, 'brand') ? brandToLogoKey(exif.make, opts.logos) : null;
    const brandText = on(show, 'brand') ? (exif.make || '').toString().toUpperCase() : '';
    const modelText = on(show, 'model') ? (exif.model || '') : '';
    const params = [
      on(show, 'focal')    ? exif.focalLength  : '',
      on(show, 'aperture') ? exif.fNumber      : '',
      on(show, 'shutter')  ? exif.exposureTime : '',
      on(show, 'iso')      ? exif.iso          : ''
    ].filter(Boolean).join('   ');
    const showFlash = on(show, 'flash') && exif.flashFired;
    const extras = [
      on(show, 'lens') ? exif.lensModel : '',
      on(show, 'date') ? exif.date      : '',
      on(show, 'gps')  ? exif.gps       : ''
      ,(on(show, 'author') && exif.author) ? '© ' + exif.author : ''
    ].filter(Boolean).join('  ·  ');

    const brandPx = Math.round(32 * s);
    const modelPx = Math.round(18 * s);
    const paramsPx = Math.round(22 * s);
    const extraPx = Math.round(18 * s);
    const lineH = Math.round(28 * s);

    const style = '<style>' + fontFaceCss +
      '.ts-brand{font:600 ' + brandPx + 'px \'Inter\',sans-serif;fill:' + colors.brand + ';letter-spacing:' + Math.round(3 * s) + 'px;}' +
      '.ts-model{font:400 ' + modelPx + 'px \'Inter\',sans-serif;fill:' + colors.meta + ';letter-spacing:' + Math.round(2 * s) + 'px;text-transform:uppercase;}' +
      '.ts-params{font:500 ' + paramsPx + 'px \'Inter\',sans-serif;fill:' + colors.brand + ';letter-spacing:' + Math.round(1.5 * s) + 'px;}' +
      '.ts-extra{font:400 ' + extraPx + 'px \'Inter\',sans-serif;fill:' + colors.meta + ';letter-spacing:' + Math.round(1 * s) + 'px;}' +
      '</style>';

    // First row combines brand (logo or text) AND model side-by-side, centered.
    const rows = [];
    if (brandLogoKey || brandText || modelText) rows.push('brandline');
    if (params || showFlash) rows.push('params');
    if (extras) rows.push('extras');
    if (!rows.length) return style;

    const totalH = rows.length * lineH;
    const firstY = Math.round(cy - totalH / 2 + lineH * 0.75);

    const modelLs = Math.round(2 * s);
    const brandModelGap = Math.round(16 * s);

    let out = style;
    rows.forEach(function (row, i) {
      const y = firstY + i * lineH;
      if (row === 'brandline') {
        // Pure-text brand+model path uses one <text> with two <tspan>s and
        // text-anchor=middle, so the browser measures real glyph widths and
        // centers the group exactly — no estimator drift.
        if (!brandLogoKey && brandText && modelText) {
          out += '<text x="' + cx + '" y="' + y + '" text-anchor="middle">' +
                 '<tspan class="ts-brand">' + escapeXml(brandText) + '</tspan>' +
                 '<tspan class="ts-model" dx="' + brandModelGap + '">' + escapeXml(modelText) + '</tspan>' +
                 '</text>';
        } else if (!brandLogoKey && brandText) {
          // Brand-only — keep original precise centering at cx.
          out += '<text x="' + cx + '" y="' + y + '" text-anchor="middle" class="ts-brand">' + escapeXml(brandText) + '</text>';
        } else if (!brandLogoKey && modelText) {
          out += '<text x="' + cx + '" y="' + y + '" text-anchor="middle" class="ts-model">' + escapeXml(modelText) + '</text>';
        } else if (brandLogoKey) {
          // Logo + optional model — estimator-based centering (logo width is
          // exact but model text width must be estimated).
          const logoEntry = opts.logos[brandLogoKey];
          const logoFill = resolveLogoFill(logoEntry.brandColor, opts.textStyle);
          const logoLogoH = brandPx;
          const brandW = Math.round(logoLogoH * (logoEntry.vw / logoEntry.vh));
          const modelW = modelText ? estimateTextWidth(modelText, modelPx, 400, modelLs) : 0;
          const gap = modelW ? brandModelGap : 0;
          const totalW = brandW + gap + modelW;
          const startX = Math.round(cx - totalW / 2);
          const ly = Math.round(y - brandPx * 0.88);
          out += logoInlineSvg(brandLogoKey, opts.logos, { x: startX, y: ly, height: logoLogoH, fillColor: logoFill, textStyle: opts.textStyle }).svg;
          if (modelText) {
            out += '<text x="' + (startX + brandW + gap) + '" y="' + y + '" text-anchor="start" class="ts-model">' + escapeXml(modelText) + '</text>';
          }
        }
      } else if (row === 'params') {
        // Params text stays centered at cx (text-anchor=middle) so it lines up
        // with brandline above and extras below — flash glyph hangs off the
        // right without disturbing that alignment.
        if (params) {
          out += '<text x="' + cx + '" y="' + y + '" text-anchor="middle" class="ts-params">' + escapeXml(params) + '</text>';
        }
        if (showFlash) {
          const fGap = Math.round(paramsPx * 0.5);
          if (params) {
            const pls = Math.round(1.5 * s);
            const pW = estimateTextWidth(params, paramsPx, 500, pls);
            out += flashGlyphSvg(Math.round(cx + pW / 2 + fGap), y, paramsPx, colors.brand);
          } else {
            // Flash alone on this row: center the glyph itself
            out += flashGlyphSvg(Math.round(cx - flashGlyphWidth(paramsPx) / 2), y, paramsPx, colors.brand);
          }
        }
      } else if (row === 'extras') {
        // Use renderLensInline if we have a lens logo match, else plain text
        const lensLogoKey = on(show, 'lens') ? brandToLogoKey(exif.lensMake, opts.logos) : null;
        if (lensLogoKey && on(show, 'lens') && exif.lensModel) {
          out += renderLensInline({
            lensMake: exif.lensMake, lensModel: exif.lensModel,
            cx: cx, y: y, textClass: 'ts-extra', textSize: extraPx,
            textWeight: 400, letterSpacing: Math.round(1 * s),
            textStyle: opts.textStyle, scale: s, logosMap: opts.logos
          });
          // Date would go to second row if both — but tech-stack shows inline
          // Append date if also present
          // (simplification: show date inline after lens via the extras string when no logo)
        } else {
          out += '<text x="' + cx + '" y="' + y + '" text-anchor="middle" class="ts-extra">' + escapeXml(extras) + '</text>';
        }
      }
    });
    return out;
  }

  // NEW: mirrored minimal — params on the LEFT, brand/logo on the RIGHT
  function tBrandRight(exif, layout, fontFaceCss, opts) {
    const colors = captionColors(opts.textStyle);
    const show = opts.showFields;
    const s = layout.scale || 1;
    const cx = layout.W / 2;
    const y = layout.textBaselineY;

    const brandLogoKey = on(show, 'brand') ? brandToLogoKey(exif.make, opts.logos) : null;
    const brandText = on(show, 'brand') ? (exif.make || '').toString().toUpperCase() : '';
    const modelText = on(show, 'model') ? (exif.model || '') : '';
    const params = [
      on(show, 'focal')    ? exif.focalLength  : '',
      on(show, 'aperture') ? exif.fNumber      : '',
      on(show, 'shutter')  ? exif.exposureTime : '',
      on(show, 'iso')      ? exif.iso          : ''
    ].filter(Boolean).join('  ');
    const extras = [
      on(show, 'lens') ? exif.lensModel : '',
      on(show, 'date') ? exif.date      : '',
      on(show, 'gps')  ? exif.gps       : ''
      ,(on(show, 'author') && exif.author) ? '© ' + exif.author : ''
    ].filter(Boolean).join('  •  ');

    const paramsPx = Math.round(26 * s);
    const brandPx = Math.round(30 * s);
    const modelPx = Math.round(20 * s);
    const extraPx = Math.round(20 * s);
    const gap = Math.round(24 * s);
    const dividerHalf = Math.round(22 * s);
    const ls = Math.round(1 * s);
    const brandLogoH = Math.round(30 * s);

    const style = '<style>' + fontFaceCss +
      '.br-params{font:500 ' + paramsPx + 'px \'Inter\',sans-serif;fill:' + colors.brand + ';letter-spacing:' + ls + 'px;}' +
      '.br-brand{font:600 ' + brandPx + 'px \'Inter\',sans-serif;fill:' + colors.brand + ';letter-spacing:' + Math.round(2 * s) + 'px;}' +
      '.br-model{font:400 ' + modelPx + 'px \'Inter\',sans-serif;fill:' + colors.meta + ';letter-spacing:' + ls + 'px;}' +
      '.br-extra{font:400 ' + extraPx + 'px \'Inter\',sans-serif;fill:' + colors.meta + ';letter-spacing:' + ls + 'px;}' +
      '</style>';

    const mainY = extras ? y - Math.round(14 * s) : y;

    // Params go on the LEFT (text-anchor=end at cx - gap)
    const showFlash = on(show, 'flash') && exif.flashFired;
    let paramsEl = params
      ? '<text x="' + (cx - gap) + '" y="' + mainY + '" text-anchor="end" class="br-params">' + escapeXml(params) + '</text>'
      : '';
    if (showFlash) {
      // Place glyph to the LEFT of the params text, since the right edge is
      // anchored to the divider. Width pre-computed via estimator.
      const paramsW = params ? estimateTextWidth(params, paramsPx, 500, ls) : 0;
      const flashX = (cx - gap) - paramsW - (params ? Math.round(paramsPx * 0.55) : 0) - flashGlyphWidth(paramsPx);
      paramsEl = flashGlyphSvg(flashX, mainY, paramsPx, colors.brand) + paramsEl;
    }

    // Brand/logo on the RIGHT (text-anchor=start at cx + gap)
    let brandEl = '';
    if (brandLogoKey) {
      const entry = opts.logos[brandLogoKey];
      const fill = resolveLogoFill(entry.brandColor, opts.textStyle);
      const logoY = Math.round(mainY - brandLogoH * 0.93);
      brandEl = logoInlineSvg(brandLogoKey, opts.logos, { x: cx + gap, y: logoY, height: brandLogoH, fillColor: fill, textStyle: opts.textStyle }).svg;
    } else if (brandText) {
      brandEl = '<text x="' + (cx + gap) + '" y="' + mainY + '" text-anchor="start" class="br-brand">' + escapeXml(brandText) + '</text>';
    }

    // Optional model line appended under brand
    const modelEl = modelText
      ? '<text x="' + (cx + gap) + '" y="' + (mainY + Math.round(22 * s)) + '" text-anchor="start" class="br-model">' + escapeXml(modelText) + '</text>'
      : '';

    const divider = (params && (brandEl || modelText))
      ? '<line x1="' + cx + '" y1="' + (mainY - dividerHalf) + '" x2="' + cx + '" y2="' + (mainY + dividerHalf / 3) + '" stroke="' + colors.accent + '" stroke-width="' + Math.max(1, Math.round(2 * s)) + '"/>'
      : '';

    const extraEl = extras
      ? '<text x="' + cx + '" y="' + (mainY + Math.round(34 * s)) + '" text-anchor="middle" class="br-extra">' + escapeXml(extras) + '</text>'
      : '';

    return style + paramsEl + divider + brandEl + modelEl + extraEl;
  }

  // Wordmark: oversized brand mark (logo or wordmark), tiny date subline.
  // Luxury-minimalist look — works as the centerpiece in editorial /
  // gallery frames where the photo + brand identity carry the eye and
  // technical specs aren't the point.
  function tWordmark(exif, layout, fontFaceCss, opts) {
    const colors = captionColors(opts.textStyle);
    const show = opts.showFields;
    const brandText = on(show, 'brand') ? (exif.make || '').toString().toUpperCase() : '';
    const brandLogoKey = on(show, 'brand') ? brandToLogoKey(exif.make, opts.logos) : null;
    const dateText = on(show, 'date') ? (exif.date || '') : '';
    const author = (on(show, 'author') && exif.author) ? exif.author : '';
    const s = layout.scale || 1;
    const cx = layout.W / 2;
    const y = layout.textBaselineY;

    // Cap brand size against caption height so it never overflows
    // (overlay placement gives a thin strip; editorial right gives a
    // fat one — same template, both look right).
    const brandPxRaw = Math.round(38 * s);
    const brandPx = Math.min(brandPxRaw, Math.round(layout.H * 0.42));
    const subPx = Math.max(Math.round(13 * s), Math.round(brandPx * 0.30));
    const lsBrand = Math.round(brandPx * 0.10);
    const lsSub = Math.round(2 * s);

    const subParts = [dateText, author ? '© ' + author : ''].filter(Boolean);
    const subline = subParts.join('   ·   ');
    const mainY = subline ? y - Math.round(brandPx * 0.32) : y;
    const subY = mainY + Math.round(brandPx * 0.78);

    const style = '<style>' + fontFaceCss +
      '.wm-brand{font:600 ' + brandPx + 'px \'Inter\',sans-serif;fill:' + colors.brand + ';letter-spacing:' + lsBrand + 'px;}' +
      '.wm-sub{font:400 ' + subPx + 'px \'Inter\',sans-serif;fill:' + colors.meta + ';letter-spacing:' + lsSub + 'px;text-transform:uppercase;}' +
      '</style>';

    let brandBlock = '';
    if (brandLogoKey) {
      const entry = opts.logos[brandLogoKey];
      const fill = resolveLogoFill(entry.brandColor, opts.textStyle);
      const logoH = brandPx;
      const logoW = Math.round(logoH * (entry.vw / entry.vh));
      const logoY = Math.round(mainY - logoH * 0.86);
      brandBlock = logoInlineSvg(brandLogoKey, opts.logos, {
        x: Math.round(cx - logoW / 2), y: logoY, height: logoH,
        fillColor: fill, textStyle: opts.textStyle
      }).svg;
    } else if (brandText) {
      brandBlock = '<text x="' + cx + '" y="' + mainY + '" text-anchor="middle" class="wm-brand">' + escapeXml(brandText) + '</text>';
    }

    const subEl = subline
      ? '<text x="' + cx + '" y="' + subY + '" text-anchor="middle" class="wm-sub">' + escapeXml(subline) + '</text>'
      : '';

    return style + brandBlock + subEl;
  }

  // Headline: editorial-cover treatment that promotes the geographic +
  // temporal context to the visual lead. "TOKYO · 2026.03" hero line
  // (or just "2026.03" when GPS is absent), with a small camera-spec
  // line below. Designed for the editorial frame's right strip — the
  // long axis is plenty wide for big type — but works in any frame's
  // bottom placement too.
  function tHeadline(exif, layout, fontFaceCss, opts) {
    const colors = captionColors(opts.textStyle);
    const show = opts.showFields;
    const s = layout.scale || 1;
    const cx = layout.W / 2;
    const y = layout.textBaselineY;

    // Headline string. GPS drives the lead text; date forms the trailing
    // half. When GPS is missing we degrade gracefully to date-only so
    // the user never sees an empty "·" remnant.
    const dateText = on(show, 'date') ? (exif.date || '') : '';
    // Reformat YYYY.MM.DD → YYYY.MM (headline doesn't need day precision).
    const dateHead = dateText
      ? (dateText.split('.').slice(0, 2).join('.') || dateText)
      : '';
    // GPS as headline lead: use the pre-formatted base.gps but trim
    // each side to "lat°N" / "lng°E" without the four-decimal precision —
    // headline-style readers don't need centimeter accuracy.
    let gpsHead = '';
    if (on(show, 'gps') && exif.gps) {
      const m = exif.gps.match(/(\d+(?:\.\d+)?)°([NS])\s+·\s+(\d+(?:\.\d+)?)°([EW])/);
      if (m) {
        gpsHead = Math.round(parseFloat(m[1])) + '°' + m[2] + ' · ' + Math.round(parseFloat(m[3])) + '°' + m[4];
      } else {
        gpsHead = exif.gps;
      }
    }

    let headline;
    if (gpsHead && dateHead) headline = gpsHead + ' · ' + dateHead;
    else if (gpsHead) headline = gpsHead;
    else if (dateHead) headline = dateHead;
    else headline = (exif.make ? formatBrand(exif.make) : 'PHOTOGRAPH');

    const params = [
      on(show, 'focal')    ? exif.focalLength  : '',
      on(show, 'aperture') ? exif.fNumber      : '',
      on(show, 'shutter')  ? exif.exposureTime : '',
      on(show, 'iso')      ? exif.iso          : ''
    ].filter(Boolean).join('  ');
    const author = (on(show, 'author') && exif.author) ? '© ' + exif.author : '';
    const subline = [params, author].filter(Boolean).join('     ');

    const headPxRaw = Math.round(46 * s);
    const headPx = Math.min(headPxRaw, Math.round(layout.H * 0.5));
    const subPx = Math.max(Math.round(14 * s), Math.round(headPx * 0.32));
    const lsHead = Math.round(headPx * 0.06);
    const lsSub = Math.round(1.5 * s);

    const mainY = subline ? y - Math.round(headPx * 0.32) : y;
    const subY = mainY + Math.round(headPx * 0.92);

    const style = '<style>' + fontFaceCss +
      '.hl-head{font:600 ' + headPx + 'px \'Inter\',sans-serif;fill:' + colors.brand + ';letter-spacing:' + lsHead + 'px;}' +
      '.hl-sub{font:400 ' + subPx + 'px \'Inter\',sans-serif;fill:' + colors.meta + ';letter-spacing:' + lsSub + 'px;}' +
      '</style>';

    const headEl = '<text x="' + cx + '" y="' + mainY + '" text-anchor="middle" class="hl-head">' + escapeXml(headline) + '</text>';
    const subEl = subline
      ? '<text x="' + cx + '" y="' + subY + '" text-anchor="middle" class="hl-sub">' + escapeXml(subline) + '</text>'
      : '';
    return style + headEl + subEl;
  }

  // Slate: clapper-board / camera-OSD field grid in monospace. Each
  // metadata field gets its own labeled cell ("DATE / CAM / LENS / EXP")
  // separated by hairlines, like a film slate or DIT log overlay. Uses
  // system monospace fallback (`ui-monospace, "SF Mono"…`) so we don't
  // need to inline a Plex Mono subset just for this template.
  function tSlate(exif, layout, fontFaceCss, opts) {
    const colors = captionColors(opts.textStyle);
    const show = opts.showFields;
    const s = layout.scale || 1;
    const cx = layout.W / 2;
    const cy = layout.textBaselineY;

    const date = on(show, 'date') ? (exif.date || '——') : '——';
    const cam = (on(show, 'brand') ? (exif.make || '').toString().toUpperCase() : '').trim();
    const model = (on(show, 'model') ? (exif.model || '') : '').trim();
    const camLine = [cam, model].filter(Boolean).join(' ') || '——';
    const lens = (on(show, 'lens') ? (exif.lensModel || '') : '').trim() || '——';
    const params = [
      on(show, 'focal')    ? exif.focalLength  : '',
      on(show, 'aperture') ? exif.fNumber      : '',
      on(show, 'shutter')  ? exif.exposureTime : '',
      on(show, 'iso')      ? exif.iso          : ''
    ].filter(Boolean).join(' · ') || '——';

    const labelPx = Math.max(Math.round(11 * s), Math.round(layout.H * 0.08));
    const valPx = Math.max(Math.round(15 * s), Math.round(labelPx * 1.35));
    const lineH = Math.round(valPx * 1.55);
    const monoStack = '"SFMono-Regular", "SF Mono", Menlo, Monaco, Consolas, monospace';

    const rows = [
      ['DATE', date],
      ['CAM',  camLine],
      ['LENS', lens],
      ['EXP',  params]
    ];
    const totalH = rows.length * lineH;
    const firstY = Math.round(cy - totalH / 2 + lineH * 0.7);

    // Two-column metric: label cell width fixed (~"LENS" + padding),
    // value cell takes remainder. Compute label cell from the longest
    // canonical label so columns align across all rows.
    const labelW = Math.round(estimateTextWidth('LENS  ', labelPx, 600, Math.round(2 * s)));
    const colGap = Math.round(20 * s);
    const totalRowW = Math.min(layout.W * 0.78, labelW + colGap + estimateTextWidth(camLine, valPx, 400, 0));
    const startX = Math.round(cx - totalRowW / 2);
    const valStartX = startX + labelW + colGap;

    const style = '<style>' + fontFaceCss +
      '.sl-label{font:600 ' + labelPx + 'px ' + monoStack + ';fill:' + colors.accent + ';letter-spacing:' + Math.round(2 * s) + 'px;}' +
      '.sl-val{font:400 ' + valPx + 'px ' + monoStack + ';fill:' + colors.brand + ';letter-spacing:' + Math.round(0.5 * s) + 'px;}' +
      '</style>';

    let out = style;
    rows.forEach(function (row, i) {
      const y = firstY + i * lineH;
      out += '<text x="' + startX + '" y="' + y + '" text-anchor="start" class="sl-label">' + escapeXml(row[0]) + '</text>';
      out += '<text x="' + valStartX + '" y="' + y + '" text-anchor="start" class="sl-val">' + escapeXml(row[1]) + '</text>';
      // Hairline between rows (skip the last row's bottom rule).
      if (i < rows.length - 1) {
        const ruleY = y + Math.round(lineH * 0.30);
        out += '<line x1="' + startX + '" y1="' + ruleY + '" x2="' + (startX + Math.round(totalRowW)) + '" y2="' + ruleY + '" stroke="' + colors.accent + '" stroke-width="' + Math.max(1, Math.round(0.6 * s)) + '" opacity="0.35"/>';
      }
    });
    return out;
  }

  // Passport: tiny boxed corner stamp with date + GPS (bordered rect,
  // monospace, faux-print-on-document feel). Render is intentionally
  // small so it sits like a postmark — never the visual lead of the
  // composition. Best paired with frames whose caption zone is wide
  // (frosted, gallery, editorial) so the stamp has breathing room.
  function tPassport(exif, layout, fontFaceCss, opts) {
    const colors = captionColors(opts.textStyle);
    const show = opts.showFields;
    const s = layout.scale || 1;
    const cx = layout.W / 2;
    const cy = layout.textBaselineY;

    const date = on(show, 'date') ? (exif.date || '') : '';
    const gps = on(show, 'gps') ? (exif.gps || '') : '';
    const lines = [date, gps].filter(Boolean);
    if (!lines.length) return '<style>' + fontFaceCss + '</style>';

    const px = Math.max(Math.round(13 * s), Math.round(layout.H * 0.18));
    const lineH = Math.round(px * 1.6);
    const padX = Math.round(px * 1.4);
    const padY = Math.round(px * 0.85);
    const monoStack = '"SFMono-Regular", "SF Mono", Menlo, Monaco, Consolas, monospace';
    // Box width: longest line + 2× horizontal padding. Use a generous
    // estimator with monospace assumptions (each glyph ≈ 0.6em).
    const longest = lines.reduce(function (a, b) { return b.length > a.length ? b : a; }, '');
    const textW = Math.round(longest.length * px * 0.6);
    const boxW = textW + padX * 2;
    const boxH = lines.length * lineH + padY * 2 - Math.round(lineH * 0.3);
    const boxX = Math.round(cx - boxW / 2);
    const boxY = Math.round(cy - boxH / 2);

    const style = '<style>' + fontFaceCss +
      '.pp-text{font:500 ' + px + 'px ' + monoStack + ';fill:' + colors.brand + ';letter-spacing:' + Math.round(1.5 * s) + 'px;text-transform:uppercase;}' +
      '</style>';

    let out = style;
    out += '<rect x="' + boxX + '" y="' + boxY + '" width="' + boxW + '" height="' + boxH + '" fill="none" stroke="' + colors.accent + '" stroke-width="' + Math.max(1, Math.round(1 * s)) + '" rx="' + Math.round(2 * s) + '" opacity="0.7"/>';
    lines.forEach(function (line, i) {
      const y = boxY + padY + (i + 1) * lineH - Math.round(lineH * 0.3);
      out += '<text x="' + cx + '" y="' + y + '" text-anchor="middle" class="pp-text">' + escapeXml(line) + '</text>';
    });
    return out;
  }

  // Spec-rail: vertical stack of outlined spec capsules + brand cluster.
  // Built for the editorial frame's right strip (Leica M10 reference): in
  // the rotated local frame, layout.W runs along the photo's vertical axis
  // and layout.H is the strip's narrow dimension. We lay capsules out
  // along layout.W with the brand row anchored at one end.
  function tSpecRail(exif, layout, fontFaceCss, opts) {
    const colors = captionColors(opts.textStyle);
    const show = opts.showFields;
    const s = layout.scale || 1;
    const W = layout.W, H = layout.H;

    const cells = [
      { value: on(show, 'shutter')  ? exif.exposureTime : '', label: 'S' },
      { value: on(show, 'iso')      ? exif.iso          : '', label: 'ISO' },
      { value: on(show, 'focal')    ? exif.focalLength  : '', label: 'MM' },
      { value: on(show, 'aperture') ? exif.fNumber      : '', label: 'F' }
    ].filter(function (c) { return c.value; });
    const brandText = on(show, 'brand') ? (exif.make || '').toString().toUpperCase() : '';
    const modelText = on(show, 'model') ? (exif.model || '') : '';
    const brandLogoKey = brandText ? brandToLogoKey(exif.make, opts.logos || {}) : null;
    const author = (on(show, 'author') && exif.author) ? exif.author : '';

    const valuePx = Math.max(Math.round(20 * s), Math.round(H * 0.16));
    const labelPx = Math.max(Math.round(10 * s), Math.round(valuePx * 0.52));
    const radius  = Math.round(7 * s);
    const padX    = Math.round(13 * s);
    const padY    = Math.round(7 * s);
    const labelGap = Math.round(7 * s);
    const stroke  = Math.max(1, 1.1 * (layout.outputPx || s));
    const minBoxW = Math.round(valuePx * 3.0);
    const boxOpts = {
      valuePx: valuePx, labelPx: labelPx, padX: padX, padY: padY, radius: radius,
      labelGap: labelGap, stroke: stroke, minBoxW: minBoxW,
      valueColor: colors.brand, labelColor: colors.meta, strokeColor: colors.accent,
      labelLetterSpacing: Math.max(1, Math.round(labelPx * 0.08))
    };

    // Capsules occupy the upper portion of the strip; brand sits below.
    // 0.40 / 0.78 of layout.H is a nice 60/40 split that mirrors the
    // Leica reference's "spec stack on top, brand at bottom" rhythm.
    const capsulesCY = Math.round(H * 0.40);
    const brandY     = Math.round(H * 0.78);

    // Distribute capsules along layout.W with breathing margins.
    let out = '<style>' + fontFaceCss + '</style>';
    if (cells.length) {
      const margin = Math.round(W * 0.10);
      const usable = W - margin * 2;
      const slot = usable / cells.length;
      cells.forEach(function (cell, i) {
        const cx = Math.round(margin + slot * (i + 0.5));
        const b = boxedSpec(cx, capsulesCY, cell.value, cell.label, boxOpts);
        out += b.svg;
      });
    }

    // Brand row: optional logo + brand wordmark, model below in tiny meta.
    const brandPx  = Math.max(Math.round(20 * s), Math.round(H * 0.18));
    const modelPx  = Math.max(Math.round(11 * s), Math.round(brandPx * 0.55));
    const brandLs  = Math.round(brandPx * 0.06);
    const modelLs  = Math.round(modelPx * 0.10);
    const cx = Math.round(W / 2);

    let brandBlock = '';
    if (brandLogoKey) {
      const entry = opts.logos[brandLogoKey];
      const logoH = brandPx;
      const logoW = Math.round(logoH * (entry.vw / entry.vh));
      const fill = resolveLogoFill(entry.brandColor, opts.textStyle);
      brandBlock = logoInlineSvg(brandLogoKey, opts.logos, {
        x: Math.round(cx - logoW / 2), y: Math.round(brandY - logoH * 0.78), height: logoH,
        fillColor: fill, textStyle: opts.textStyle
      }).svg;
    } else if (brandText) {
      brandBlock = '<text x="' + cx + '" y="' + brandY + '" text-anchor="middle" ' +
        'style="font:600 ' + brandPx + 'px \'Inter\',sans-serif;fill:' + colors.brand +
        ';letter-spacing:' + brandLs + 'px;">' + escapeXml(brandText) + '</text>';
    }

    let metaLine = '';
    if (modelText) metaLine = modelText;
    if (author) metaLine = metaLine ? metaLine + '   ·   © ' + author : '© ' + author;
    if (metaLine) {
      const metaY = brandY + Math.round(brandPx * 0.65);
      brandBlock += '<text x="' + cx + '" y="' + metaY + '" text-anchor="middle" ' +
        'style="font:400 ' + modelPx + 'px \'Inter\',sans-serif;fill:' + colors.meta +
        ';letter-spacing:' + modelLs + 'px;text-transform:uppercase;">' +
        escapeXml(metaLine) + '</text>';
    }
    return out + brandBlock;
  }

  // Spec-grid: horizontal layout for bottom strips (Hasselblad X2D reference).
  // Top row: brand wordmark/logo + thin divider + model; bottom row: 4 spec
  // capsules spread evenly. Designed for `placement: 'bottom'`.
  function tSpecGrid(exif, layout, fontFaceCss, opts) {
    const colors = captionColors(opts.textStyle);
    const show = opts.showFields;
    const s = layout.scale || 1;
    const W = layout.W, H = layout.H;

    const cells = [
      { value: on(show, 'shutter')  ? exif.exposureTime : '', label: 'S' },
      { value: on(show, 'iso')      ? exif.iso          : '', label: 'ISO' },
      { value: on(show, 'focal')    ? exif.focalLength  : '', label: 'MM' },
      { value: on(show, 'aperture') ? exif.fNumber      : '', label: 'F' }
    ].filter(function (c) { return c.value; });
    const brandText = on(show, 'brand') ? (exif.make || '').toString().toUpperCase() : '';
    const modelText = on(show, 'model') ? (exif.model || '') : '';
    const brandLogoKey = brandText ? brandToLogoKey(exif.make, opts.logos || {}) : null;

    // Two-row split: brand on top 35%, capsules on bottom 60%.
    const brandRowCY    = Math.round(H * 0.32);
    const capsulesRowCY = Math.round(H * 0.72);

    const brandPx = Math.max(Math.round(18 * s), Math.round(H * 0.20));
    const modelPx = Math.max(Math.round(11 * s), Math.round(brandPx * 0.62));
    const cx = Math.round(W / 2);

    // Brand row: [logo|wordmark]   |   [model]
    let brandRow = '';
    let brandWidth = 0;
    let brandRender = '';
    if (brandLogoKey) {
      const entry = opts.logos[brandLogoKey];
      const logoH = brandPx;
      const logoW = Math.round(logoH * (entry.vw / entry.vh));
      brandWidth = logoW;
      const fill = resolveLogoFill(entry.brandColor, opts.textStyle);
      brandRender = logoInlineSvg(brandLogoKey, opts.logos, {
        x: 0, y: Math.round(brandRowCY - logoH * 0.78), height: logoH,
        fillColor: fill, textStyle: opts.textStyle
      });
    } else if (brandText) {
      brandWidth = Math.round(estimateTextWidth(brandText, brandPx, 600, Math.round(brandPx * 0.06)));
    }
    const modelW = modelText
      ? Math.round(estimateTextWidth(modelText, modelPx, 400, Math.round(modelPx * 0.10)))
      : 0;
    const dividerW = (brandWidth && modelW) ? Math.round(20 * s) : 0;
    const totalW = brandWidth + (dividerW ? dividerW * 2 + Math.max(1, Math.round(1 * s)) : 0) + modelW;
    let xCursor = Math.round(cx - totalW / 2);

    if (brandLogoKey && brandRender) {
      // Re-emit with corrected x.
      const entry = opts.logos[brandLogoKey];
      const logoH = brandPx;
      const logoW = Math.round(logoH * (entry.vw / entry.vh));
      const fill = resolveLogoFill(entry.brandColor, opts.textStyle);
      brandRow = logoInlineSvg(brandLogoKey, opts.logos, {
        x: xCursor, y: Math.round(brandRowCY - logoH * 0.78), height: logoH,
        fillColor: fill, textStyle: opts.textStyle
      }).svg;
      xCursor += logoW;
    } else if (brandText) {
      brandRow = '<text x="' + xCursor + '" y="' + brandRowCY + '" text-anchor="start" ' +
        'style="font:600 ' + brandPx + 'px \'Inter\',sans-serif;fill:' + colors.brand +
        ';letter-spacing:' + Math.round(brandPx * 0.06) + 'px;">' +
        escapeXml(brandText) + '</text>';
      xCursor += brandWidth;
    }
    if (dividerW) {
      const dx = xCursor + dividerW;
      const dyTop = Math.round(brandRowCY - brandPx * 0.45);
      const dyBot = Math.round(brandRowCY + brandPx * 0.10);
      brandRow += '<line x1="' + dx + '" y1="' + dyTop + '" x2="' + dx + '" y2="' + dyBot +
        '" stroke="' + colors.accent + '" stroke-width="' + Math.max(1, Math.round(1 * s)) + '"/>';
      xCursor += dividerW * 2 + Math.max(1, Math.round(1 * s));
    }
    if (modelText) {
      brandRow += '<text x="' + xCursor + '" y="' + brandRowCY + '" text-anchor="start" ' +
        'style="font:400 ' + modelPx + 'px \'Inter\',sans-serif;fill:' + colors.meta +
        ';letter-spacing:' + Math.round(modelPx * 0.10) + 'px;">' +
        escapeXml(modelText) + '</text>';
    }

    // Capsules row.
    const valuePx = Math.max(Math.round(18 * s), Math.round(H * 0.22));
    const labelPx = Math.max(Math.round(10 * s), Math.round(valuePx * 0.52));
    const boxOpts = {
      valuePx: valuePx, labelPx: labelPx,
      padX: Math.round(12 * s), padY: Math.round(6 * s),
      radius: Math.round(6 * s), labelGap: Math.round(6 * s),
      stroke: Math.max(1, 1.1 * (layout.outputPx || s)),
      minBoxW: Math.round(valuePx * 2.6),
      valueColor: colors.brand, labelColor: colors.meta, strokeColor: colors.accent,
      labelLetterSpacing: Math.max(1, Math.round(labelPx * 0.08))
    };
    let capsulesRow = '';
    if (cells.length) {
      const margin = Math.round(W * 0.16);
      const usable = W - margin * 2;
      const slot = usable / cells.length;
      cells.forEach(function (cell, i) {
        const cellCX = Math.round(margin + slot * (i + 0.5));
        capsulesRow += boxedSpec(cellCX, capsulesRowCY, cell.value, cell.label, boxOpts).svg;
      });
    }

    return '<style>' + fontFaceCss + '</style>' + brandRow + capsulesRow;
  }

  const TEMPLATES = {
    'minimal-text': tMinimalText,
    'brand-logo':   tBrandLogo,
    'date-lens':    tDateLens,
    'tech-stack':   tTechStack,
    'brand-right':  tBrandRight,
    wordmark:       tWordmark,
    headline:       tHeadline,
    slate:          tSlate,
    passport:       tPassport,
    'spec-rail':    tSpecRail,
    'spec-grid':    tSpecGrid
  };

  // Build the template's inner SVG content (no outer <svg> wrapper).
  function renderTemplate(templateName, exif, layout, fontFaceCss, opts) {
    const fn = TEMPLATES[templateName] || TEMPLATES['minimal-text'];
    return fn(exif, layout, fontFaceCss, opts || {});
  }

  // Wrap the template's inner content in an outer full-canvas SVG that applies
  // caption-zone translate/rotate + overlay gradient when placement==='overlay'.
  function wrapCaption(innerContent, layout) {
    const cap = layout.caption;
    const CW = layout.canvas.W, CH = layout.canvas.H;

    // Anchor rules, picked so the zone's local (width×height) rect lines up
    // with the canvas gap that the zone was computed to occupy:
    //   bottom / top / overlay : plain translate, no rotation
    //   right  (−90° CCW): anchor at (cap.x, cap.y + cap.width) — bottom-left
    //                      of the right gap; text then reads bottom→top
    //   left   (+90° CW) : anchor at (cap.x + cap.height, cap.y) — top-right
    //                      of the left gap; text then reads top→bottom
    let transform;
    if (cap.placement === 'right') {
      transform = 'translate(' + cap.x + ' ' + (cap.y + cap.width) + ') rotate(-90)';
    } else if (cap.placement === 'left') {
      transform = 'translate(' + (cap.x + cap.height) + ' ' + cap.y + ') rotate(90)';
    } else {
      transform = 'translate(' + cap.x + ' ' + cap.y + ')';
    }
    let defs = '', overlayRect = '';
    if (cap.placement === 'overlay') {
      defs = '<defs><linearGradient id="capGrad" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="black" stop-opacity="0"/>' +
        '<stop offset="0.35" stop-color="black" stop-opacity="0.25"/>' +
        '<stop offset="1" stop-color="black" stop-opacity="0.75"/>' +
        '</linearGradient></defs>';
      overlayRect = '<rect x="0" y="0" width="' + cap.width + '" height="' + cap.height + '" fill="url(#capGrad)"/>';
    }
    // captionOverlayTextLift: when caption is in overlay placement and the
    // user has dialed a lift > 0, wrap the template's inner content in a
    // separate translate so text floats up while gradient stays bottom-pinned.
    let innerWrap;
    if (cap.placement === 'overlay' && cap.textLift > 0) {
      innerWrap = '<g transform="translate(0 ' + (-cap.textLift) + ')">' + innerContent + '</g>';
    } else {
      innerWrap = innerContent;
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + CW + '" height="' + CH + '">' +
      defs + '<g transform="' + transform + '">' + overlayRect + innerWrap + '</g></svg>';
  }

  // ======================================================================
  // Inscribed safe area (for crop semantics on arbitrary rotation)
  // ======================================================================

  // Returns the largest axis-aligned (in rotated-frame) rectangle that fits
  // entirely INSIDE the rotated bitmap — i.e., the largest rect that
  // contains only valid bitmap pixels and zero transparent corners. The
  // rect's aspect tracks the rotated bbox's aspect (rotW : rotH), which
  // means at axis-aligned angles (0/90/180/270) the safe area equals the
  // full rotated source dims (no shrinkage), while at intermediate angles
  // it smoothly contracts to inscribe inside the rotated content.
  //
  // This is the "straighten preview" shape used by Lightroom / iOS Photos:
  // the user always sees a clean rectangular crop window, never empty
  // corners, and as they rotate the photo zooms slightly to fill the
  // window edge-to-edge.
  //
  // Math: with c = |cos(rot)|, s = |sin(rot)|, the rotated bbox has
  // dims (bw·c + bh·s) × (bw·s + bh·c). The fit constraints for a rect
  // at the rotated bbox's aspect a are W = a·H plus
  //   W·c + H·s ≤ bw, W·s + H·c ≤ bh
  // which solve to H = min(bw / (a·c + s), bh / (a·s + c)).
  function inscribedSafeArea(bm, rot) {
    const r = ((Number(rot) || 0) % 360 + 360) % 360;
    const rad = r * Math.PI / 180;
    const c = Math.abs(Math.cos(rad));
    const s = Math.abs(Math.sin(rad));
    const bw = bm.width, bh = bm.height;
    const rotW = bw * c + bh * s;
    const rotH = bw * s + bh * c;
    const a = rotW / rotH;
    const hA = bw / (a * c + s);
    const hB = bh / (a * s + c);
    const safeH = Math.min(hA, hB);
    const safeW = a * safeH;
    return { w: safeW, h: safeH };
  }

  // ======================================================================
  // Collage (2–4 photos in one frame)
  // ======================================================================

  // Split the foreground rect into N cells. Layouts:
  //   h2 = 2 side-by-side                v2 = 2 stacked
  //   h3 = 3 in a row                    v3 = 3 in a column
  //   2x2 = 4 in a 2×2 grid (top-left, top-right, bottom-left, bottom-right)
  // Each cell carries an explicit gutter so adjacent photos don't visually
  // fuse at the seam. Gap defaults to 12 base-px (scaled by layout.scale).
  // Returns null when collage is missing/off so callers can fall through to
  // the single-photo fg pass.
  function collageCellRects(collage, layout) {
    if (!collage) return null;
    const valid = ['h2', 'v2', 'h3', 'v3', '2x2'];
    if (valid.indexOf(collage.layout) < 0) return null;
    const s = layout.scale || 1;
    const gap = Math.round(12 * s);
    const x = layout.fgLeft, y = layout.fgTop, w = layout.fgW, h = layout.fgH;

    function splitH(N) {
      const cellW = Math.floor((w - gap * (N - 1)) / N);
      const cells = [];
      for (let i = 0; i < N; i++) {
        const isLast = i === N - 1;
        cells.push({
          x: x + i * (cellW + gap),
          y: y,
          w: isLast ? (w - i * (cellW + gap)) : cellW,
          h: h
        });
      }
      return cells;
    }
    function splitV(N) {
      const cellH = Math.floor((h - gap * (N - 1)) / N);
      const cells = [];
      for (let i = 0; i < N; i++) {
        const isLast = i === N - 1;
        cells.push({
          x: x,
          y: y + i * (cellH + gap),
          w: w,
          h: isLast ? (h - i * (cellH + gap)) : cellH
        });
      }
      return cells;
    }

    switch (collage.layout) {
      case 'h2': return splitH(2);
      case 'v2': return splitV(2);
      case 'h3': return splitH(3);
      case 'v3': return splitV(3);
      case '2x2': {
        const cellW = Math.floor((w - gap) / 2);
        const cellH = Math.floor((h - gap) / 2);
        const rW = w - cellW - gap, rH = h - cellH - gap;
        return [
          { x: x,                 y: y,                 w: cellW, h: cellH },
          { x: x + cellW + gap,   y: y,                 w: rW,    h: cellH },
          { x: x,                 y: y + cellH + gap,   w: cellW, h: rH    },
          { x: x + cellW + gap,   y: y + cellH + gap,   w: rW,    h: rH    }
        ];
      }
    }
    return null;
  }

  // ======================================================================
  // Custom signature / logo overlay
  // ======================================================================

  // Compute the destination rect for a user-supplied signature image overlaid
  // on the foreground photo. Returns null when customLogo is missing or has
  // an invalid scale. The rect is in canvas-px (already scaled), positioned
  // inside the foreground bounds with a small margin so the signature sits
  // visually away from the fg edge.
  //
  // Position model — accepts both legacy and new schemas:
  //   - Legacy: `position: 'br' | 'bl' | 'bc'` (3 corner anchors)
  //   - New:    `position: { anchor, dx, dy }` where anchor is a 2-letter
  //             code in the 9-cell grid (tl/tc/tr/cl/cc/cr/bl/bc/br) and
  //             dx / dy are optional fine offsets in base-1440 px.
  // Migration in app.js upgrades persisted cfg, but we also tolerate the
  // legacy form here so worker / SVG round-trips don't have to migrate.
  function customLogoRect(layout, customLogo, imgAspect) {
    if (!customLogo || !customLogo.data || !(customLogo.scale > 0)) return null;
    const ar = (imgAspect && isFinite(imgAspect) && imgAspect > 0) ? imgAspect : 1;
    const margin = Math.round(20 * (layout.scale || 1));
    let dw = Math.max(1, Math.round(layout.fgW * Number(customLogo.scale)));
    let dh = Math.max(1, Math.round(dw / ar));
    const maxH = Math.round(layout.fgH * 0.5);
    if (dh > maxH) { dh = maxH; dw = Math.round(dh * ar); }

    // Decode the position into a 2-letter anchor + optional dx/dy. Both
    // legacy (string) and new (object) schemas land here.
    let anchor = 'br', dx = 0, dy = 0;
    const pos = customLogo.position;
    if (typeof pos === 'string') {
      anchor = pos;   // legacy 'br' / 'bl' / 'bc'
    } else if (pos && typeof pos === 'object') {
      anchor = pos.anchor || 'br';
      dx = Number(pos.dx) || 0;
      dy = Number(pos.dy) || 0;
    }
    // Each anchor is "<row><col>" — row in {t, c, b}, col in {l, c, r}.
    const ay = anchor.charAt(0) || 'b';
    const ax = anchor.charAt(1) || 'r';
    let x, y;
    if (ax === 'l')      x = layout.fgLeft + margin;
    else if (ax === 'c') x = layout.fgLeft + Math.round((layout.fgW - dw) / 2);
    else                 x = layout.fgLeft + layout.fgW - dw - margin;
    if (ay === 't')      y = layout.fgTop + margin;
    else if (ay === 'c') y = layout.fgTop + Math.round((layout.fgH - dh) / 2);
    else                 y = layout.fgTop + layout.fgH - dh - margin;

    // dx/dy are in base-1440 units; scale into canvas px before applying.
    const s = layout.scale || 1;
    if (dx) x += Math.round(dx * s);
    if (dy) y += Math.round(dy * s);

    const opacity = customLogo.opacity != null && isFinite(Number(customLogo.opacity))
      ? Math.max(0, Math.min(1, Number(customLogo.opacity)))
      : 1;
    return { x: x, y: y, w: dw, h: dh, opacity: opacity };
  }

  // Convenience: build the final full-canvas caption SVG in one call.
  function buildCaptionSvg(exif, layout, opts) {
    const inner = renderTemplate(opts.template, exif, layout, opts.fontFaceCss, {
      textStyle: opts.textStyle,
      showFields: opts.showFields,
      logos: opts.logos
    });
    return wrapCaption(inner, layout);
  }

  // ======================================================================
  // Top-of-frame badge (cfg.topTemplate)
  // ======================================================================

  // Builds a small SVG that paints into the frame's top padding area —
  // independent of the bottom caption template. The composition layers
  // brand logo + camera model along a centered baseline so the photo gets
  // a "magazine masthead" style stamp at the top edge.
  //
  // Returns null when topTemplate is 'none', when there's no EXIF brand to
  // surface, or when the frame's top padding is too tight to read.
  //
  // Variants:
  //   'brand-model' — logo + " · " + model (the common case; matches the
  //                   torn-paper preset's intent)
  //   'brand-only'  — logo by itself, slightly larger
  //   'wordmark'    — large uppercase brand name, no logo (channels the
  //                   retired kodak-pro frame's identity onto any frame)
  function buildTopBadgeSvg(exif, layout, opts) {
    const tt = opts && opts.topTemplate;
    if (!tt || tt === 'none') return null;
    const s = layout.scale || 1;
    const fgL = layout.fgLeft, fgT = layout.fgTop, fgW = layout.fgW;
    // Need at least ~30 base-px of top padding to render without crowding
    // either the canvas edge or the photo edge. Frames with no real top
    // padding (e.g. extreme custom aspects) skip silently.
    if (fgT < 30 * s) return null;

    const make = (exif && exif.make) ? String(exif.make).trim() : '';
    const model = (exif && exif.model) ? String(exif.model).trim() : '';
    if (!make && !model) return null;

    const CW = layout.canvas.W, CH = layout.canvas.H;
    const colors = captionColors(opts.textStyle || 'light');
    const logos = opts.logos || {};
    const logoKey = make ? brandToLogoKey(make, logos) : null;
    const logoEntry = logoKey ? logos[logoKey] : null;
    const logoFill = logoEntry ? resolveLogoFill(logoEntry.brandColor, opts.textStyle) : colors.brand;

    // Sizing: badge height target = min(36 base-px, 50% of top padding).
    // The lower bound (14 base-px) keeps text legible on very tight frames.
    const baseBadgeH = Math.min(36, (fgT / s) * 0.5);
    const badgeH = Math.max(14, Math.round(baseBadgeH * s));
    const textPx = Math.round(badgeH * 0.62);
    const sepGap = Math.round(textPx * 0.5);
    const cx = fgL + Math.round(fgW / 2);
    const cy = Math.round(fgT / 2);
    // Baseline: place the badge's optical center at cy. textPx*0.34 is the
    // approximate descent-to-baseline ratio for Inter — gives a baseline
    // that sits visually centered with logo (which we draw with its top at
    // cy - badgeH/2).
    const baselineY = cy + Math.round(textPx * 0.34);

    // Collect pieces, computing widths first so we can center the whole row.
    const pieces = [];
    function pushLogo() {
      if (logoEntry) {
        const probe = logoInlineSvg(logoKey, logos, { x: 0, y: 0, height: badgeH, fillColor: logoFill, textStyle: opts.textStyle });
        pieces.push({ kind: 'logo', width: probe.width });
      } else if (make) {
        const w = estimateTextWidth(make.toUpperCase(), textPx, 600, Math.round(2 * s));
        pieces.push({ kind: 'text', text: make.toUpperCase(), cls: 'tb-brand', width: w });
      }
    }
    function pushModel() {
      if (!model) return;
      // Sep dot then model text, both at textPx
      pieces.push({ kind: 'spacer', width: sepGap });
      const sepW = estimateTextWidth('·', textPx, 400, 0);
      pieces.push({ kind: 'text', text: '·', cls: 'tb-sep', width: sepW });
      pieces.push({ kind: 'spacer', width: sepGap });
      const w = estimateTextWidth(model, textPx, 500, 0);
      pieces.push({ kind: 'text', text: model, cls: 'tb-model', width: w });
    }

    if (tt === 'brand-only') {
      pushLogo();
    } else if (tt === 'brand-model') {
      pushLogo();
      pushModel();
    } else if (tt === 'wordmark') {
      // Single oversized uppercase brand. Falls back silently if there's
      // no make in EXIF — we won't fake one.
      if (make) {
        const bigPx = Math.round(badgeH * 0.85);
        const bigLs = Math.round(3 * s);
        const w = estimateTextWidth(make.toUpperCase(), bigPx, 700, bigLs);
        pieces.push({ kind: 'text', text: make.toUpperCase(), cls: 'tb-wordmark', width: w, size: bigPx, ls: bigLs });
      }
    } else {
      return null;
    }
    if (!pieces.length) return null;

    const totalW = pieces.reduce(function (a, p) { return a + p.width; }, 0);
    let cursor = cx - Math.round(totalW / 2);
    let body = '';
    for (const p of pieces) {
      if (p.kind === 'logo') {
        const logoY = Math.round(cy - badgeH / 2);
        body += logoInlineSvg(logoKey, logos, { x: cursor, y: logoY, height: badgeH, fillColor: logoFill, textStyle: opts.textStyle }).svg;
      } else if (p.kind === 'text') {
        body += '<text x="' + cursor + '" y="' + baselineY + '" class="' + p.cls + '">' + escapeXml(p.text) + '</text>';
      }
      // 'spacer' just advances cursor
      cursor += p.width;
    }

    const fontFaceCss = opts.fontFaceCss || '';
    const ls = Math.round(1 * s);
    const lsBrand = Math.round(2 * s);
    const wordmarkPx = pieces.find(function (p) { return p.cls === 'tb-wordmark'; });
    const wmSize = wordmarkPx ? wordmarkPx.size : Math.round(badgeH * 0.85);
    const wmLs = wordmarkPx ? wordmarkPx.ls : Math.round(3 * s);
    const styleBlock = '<style>' + fontFaceCss +
      '.tb-brand{font:600 ' + textPx + 'px \'Inter\',sans-serif;fill:' + colors.brand + ';letter-spacing:' + lsBrand + 'px;}' +
      '.tb-model{font:500 ' + textPx + 'px \'Inter\',sans-serif;fill:' + colors.meta + ';letter-spacing:' + ls + 'px;}' +
      '.tb-sep{font:400 ' + textPx + 'px \'Inter\',sans-serif;fill:' + colors.accent + ';}' +
      '.tb-wordmark{font:700 ' + wmSize + 'px \'Inter\',sans-serif;fill:' + colors.brand + ';letter-spacing:' + wmLs + 'px;}' +
      '</style>';

    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + CW + '" height="' + CH + '">' +
      styleBlock + body + '</svg>';
  }

  // ======================================================================
  // Public API
  // ======================================================================

  return {
    // EXIF
    normalizeExif: normalizeExif,
    formatFocalLength: formatFocalLength,
    formatAperture: formatAperture,
    formatShutter: formatShutter,
    formatIso: formatIso,
    formatBrand: formatBrand,
    formatDate: formatDate,
    formatGps: formatGps,
    escapeXml: escapeXml,

    // Layout
    BASE_PRESETS: BASE_PRESETS,
    resolveAspectPreset: resolveAspectPreset,
    parseAspectRatio: parseAspectRatio,
    computeLayout: computeLayout,
    computeCaptionZone: computeCaptionZone,

    // Frames
    FRAMES: FRAMES,
    FRAME_ALIASES: FRAME_ALIASES,
    registerFrame: registerFrame,
    resolveFrame: resolveFrame,
    resolveRenderParams: resolveRenderParams,
    collectFrameCfgDefaults: collectFrameCfgDefaults,
    collectFrameCfgKeys: collectFrameCfgKeys,
    captionColors: captionColors,
    resolveLogoFill: resolveLogoFill,

    // Logos
    ALIASES: ALIASES,
    brandToLogoKey: brandToLogoKey,
    logoInlineSvg: logoInlineSvg,

    // Helpers
    estimateTextWidth: estimateTextWidth,
    renderLensInline: renderLensInline,
    boxedSpec: boxedSpec,
    pathRoundRect: pathRoundRect,
    fillGrain: fillGrain,

    // Templates
    TEMPLATES: TEMPLATES,
    TEMPLATE_KEYS: Object.keys(TEMPLATES),
    renderTemplate: renderTemplate,
    wrapCaption: wrapCaption,
    buildCaptionSvg: buildCaptionSvg,
    buildTopBadgeSvg: buildTopBadgeSvg,

    // Custom signature
    customLogoRect: customLogoRect,

    // Collage (2–4 photos)
    collageCellRects: collageCellRects,

    // Inscribed safe area (rotation-aware crop bounds)
    inscribedSafeArea: inscribedSafeArea
  };
});
