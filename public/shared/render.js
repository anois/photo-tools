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
      flashFired:      flashWasFired(flashRaw)
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
    '1:1':  { W: 1440, H: 1440, padding: 70, radius: 36, bottomCaptionH: 110, fgYOffset: -60,  bottomPaddingBias: 80 }
  };
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
    const base = BASE_PRESETS[aspect];
    if (!base) throw new Error('unknown aspect: ' + aspect);

    let basePadding = opts.padding != null ? Number(opts.padding) : base.padding;
    if (!isFinite(basePadding)) basePadding = base.padding;
    basePadding = Math.max(0, Math.min(300, basePadding));

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

    // Asymmetric vertical padding: `padding` rules the top/left/right edges,
    // bottom is pushed in further by `bottomPaddingBias` (+ optional frame
    // boost). This guarantees the caption zone has space even on near-square
    // photos in the 1:1 frame, where symmetric padding used to leave the fg
    // flush against both top and bottom.
    const topPadding = padding;
    const bottomBiasBase = (base.bottomPaddingBias || 0) + (opts.bottomPaddingBoost || 0);
    const bottomPadding = padding + Math.round(bottomBiasBase * scale);

    const inputAspect = meta.width / meta.height;
    let fgW = W - padding * 2;
    let fgH = Math.round(fgW / inputAspect);
    const maxFgH = H - topPadding - bottomPadding;
    if (fgH > maxFgH) {
      fgH = maxFgH;
      fgW = Math.round(fgH * inputAspect);
    }

    const fgLeft = Math.round((W - fgW) / 2);
    // Center within the asymmetric vertical box, then apply fgYOffset.
    let fgTop = Math.round(topPadding + (H - topPadding - bottomPadding - fgH) / 2 + fgYOffset);
    if (fgTop < topPadding) fgTop = topPadding;
    if (fgTop + fgH > H - bottomPadding) fgTop = Math.max(topPadding, H - bottomPadding - fgH);

    const caption = computeCaptionZone({ W, H, fgLeft, fgTop, fgW, fgH, scale, preferredBottomH });

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
      aspect,
      caption
    };
  }

  // ======================================================================
  // Frames + caption colors
  // ======================================================================

  const FRAMES = {
    'frosted':      { bg: { type: 'frosted', darken: 0.06, saturation: 1.05, brightness: 0.92, blurSigma: 60, grainOpacity: 0.12 }, textStyle: 'light', layout: {}, shadowDefault: { blur: 80, offsetY: 24, opacity: 0.35 } },
    'frosted-dark': { bg: { type: 'frosted', darken: 0.22, saturation: 1.0,  brightness: 0.78, blurSigma: 70, grainOpacity: 0.14 }, textStyle: 'light', layout: {}, shadowDefault: { blur: 90, offsetY: 28, opacity: 0.45 } },
    'white':        { bg: { type: 'solid',   color: '#f5f5f5' },                                 textStyle: 'dark',  layout: {}, shadowDefault: { blur: 80, offsetY: 24, opacity: 0.30 } },
    'black':        { bg: { type: 'solid',   color: '#121212' },                                 textStyle: 'light', layout: {}, shadowDefault: { blur: 80, offsetY: 24, opacity: 0.50 } },
    'polaroid':     { bg: { type: 'solid',   color: '#fafafa' },                                 textStyle: 'dark',  layout: { extraBottom: 180, fgYBoost: -80, radiusOverride: 8 }, shadowDefault: { blur: 0, offsetY: 0, opacity: 0 } }
  };
  function resolveFrame(name) { return FRAMES[name] || FRAMES.frosted; }

  // Merge user cfg overrides with frame presets to produce the single set of
  // numbers both the SVG (compose.js) and Canvas (clientRender.js) renderers
  // consume. Keeps fallback logic in one place — neither renderer should
  // re-implement `cfg.X ?? frame.bg.X ?? hardcoded`.
  function resolveRenderParams(frame, cfg) {
    cfg = cfg || {};
    const bg = Object.assign({}, frame.bg);
    if (bg.type === 'frosted') {
      if (cfg.bgBlur != null)       bg.blurSigma  = Number(cfg.bgBlur);
      if (cfg.bgBrightness != null) bg.brightness = Number(cfg.bgBrightness);
      if (cfg.bgSaturation != null) bg.saturation = Number(cfg.bgSaturation);
    }
    const sd = frame.shadowDefault || { blur: 0, offsetY: 0, opacity: 0 };
    const shadow = {
      blur:    cfg.shadowBlur    != null ? Number(cfg.shadowBlur)    : sd.blur,
      offsetY: cfg.shadowOffsetY != null ? Number(cfg.shadowOffsetY) : sd.offsetY,
      opacity: cfg.shadowOpacity != null ? Number(cfg.shadowOpacity) : sd.opacity
    };
    return { bg: bg, shadow: shadow };
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
      on(show, 'date') ? exif.date      : ''
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
    const hasExtras = (showLens && exif.lensModel) || (showDate && exif.date) || (showLens && exif.lensMake) || hasAuthor;
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
      on(show, 'date') ? exif.date      : ''
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
      on(show, 'date') ? exif.date      : ''
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

  const TEMPLATES = {
    'minimal-text': tMinimalText,
    'brand-logo':   tBrandLogo,
    'date-lens':    tDateLens,
    'tech-stack':   tTechStack,
    'brand-right':  tBrandRight
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
    //   bottom / overlay : plain translate, no rotation
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
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + CW + '" height="' + CH + '">' +
      defs + '<g transform="' + transform + '">' + overlayRect + innerContent + '</g></svg>';
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
    escapeXml: escapeXml,

    // Layout
    BASE_PRESETS: BASE_PRESETS,
    computeLayout: computeLayout,
    computeCaptionZone: computeCaptionZone,

    // Frames
    FRAMES: FRAMES,
    resolveFrame: resolveFrame,
    resolveRenderParams: resolveRenderParams,
    captionColors: captionColors,
    resolveLogoFill: resolveLogoFill,

    // Logos
    ALIASES: ALIASES,
    brandToLogoKey: brandToLogoKey,
    logoInlineSvg: logoInlineSvg,

    // Helpers
    estimateTextWidth: estimateTextWidth,
    renderLensInline: renderLensInline,

    // Templates
    TEMPLATES: TEMPLATES,
    TEMPLATE_KEYS: Object.keys(TEMPLATES),
    renderTemplate: renderTemplate,
    wrapCaption: wrapCaption,
    buildCaptionSvg: buildCaptionSvg
  };
});
