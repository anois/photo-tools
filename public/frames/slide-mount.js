/* photo-tools — frame style: slide-mount (35mm slide-mount aesthetic).
 *
 * Channels the look of a mounted transparency: a sheet of pebbled-
 * leather cream cardstock with a photo recessed into a rectangular
 * aperture, the whole thing sitting inside a deep-wine outer tray.
 *
 * Visual stack (outside → inside):
 *   [outer ring (was wine, now cfg.slideRing) — ~28 base-px on all 4 sides]
 *   [pebbled-leather cardstock (was cream, now cfg.slideMountColor) —
 *    tile-noise pattern + soft patches]
 *   [bevel cues on cardstock around photo: top+left highlight, bot+right shadow]
 *   [photo aperture edge: heavy dark hairline]
 *   [photo, inset with top+left two-stop inner shadow]
 *
 * Joins the film family as the third variant: film-35 is the negative,
 * film-mf is the print, slide-mount is the mounted transparency.
 *
 * 1.7.0+ — 4 user-controllable knobs:
 *   slideMountColor — cardstock color enum 'cream' | 'leather' | 'black'.
 *                     Override bg.color via the frame's mountColors lookup
 *                     AND rebuilds the pebble tile in that color (the tile
 *                     IS the cardstock surface).
 *   slideRing       — outer ring color enum 'wine' | 'brass' | 'charcoal'.
 *                     Solid fill at the canvas perimeter (drawn last).
 *   slidePebble     — pebble density multiplier 0.5–1.5× (5 buckets at
 *                     step 0.25). Default 1.0× = 180 bumps; 0.5× = 90;
 *                     1.5× = 270. Tile cache keyed by (mountColor, numBumps)
 *                     so the rebuild cost is paid once per (color, density)
 *                     combo across a session.
 *   slideBevel      — bevel depth in base-1440 px (4–20). Default 8.
 *                     Scales both bevelW (cream margin highlight/shadow
 *                     width) and the inset shadow depth (capped at 36).
 *
 * Determinism: the noise tile is module-level cached using a fixed
 * seed-per-combo, so the same tile is reused across every render in the
 * same worker / main-thread context. The low-frequency patches use a per-
 * photo geometry seed so the same photo always shows the same patch
 * pattern across renders.
 */
(function () {
  'use strict';
  const root = (typeof self !== 'undefined' ? self : globalThis);
  const R = root.PhotoRender;

  // ─── Cardstock color palette ─────────────────────────────────────────
  // Three plausible mount stocks: 'cream' is the classic Kodachrome
  // tan; 'leather' is a warm brown portfolio binder; 'black' is the
  // formal black-acid-free archival mount. Same enum-lookup pattern
  // as instax tintColors (1.6.0).
  const MOUNT_COLORS = {
    cream:   '#e6dac0',
    leather: '#9c7a4a',
    black:   '#2a1a14'
  };

  // ─── Outer ring (tray) color palette ────────────────────────────────
  // 'wine' is the original deep oxblood; 'brass' channels luxury slide-
  // tray hardware; 'charcoal' is a sober archival border.
  const RING_COLORS = {
    wine:     '#3a1822',
    brass:    '#9c7a4a',
    charcoal: '#1a1410'
  };

  // ─── Pebbled-leather tile cache (combo-keyed) ─────────────────────────
  // 128×128 OffscreenCanvas filled with a hand-built pebbled texture.
  // Keyed by `${mountColor}_${numBumps}` so each (color × density) combo
  // gets its own deterministic tile. Cache holds at most 3 colors × 5
  // density buckets = 15 entries; each ~64 KB → ~960 KB worst case.
  // Lazily filled — only combos the user actually picks are built.
  const TILE = 128;
  const _tileCache = new Map();

  function clampU8(v) {
    return v < 0 ? 0 : v > 255 ? 255 : (v | 0);
  }

  function buildLeatherTile(baseColor, numBumps) {
    const canvas = (typeof OffscreenCanvas !== 'undefined')
      ? new OffscreenCanvas(TILE, TILE)
      : (function () {
          const c = document.createElement('canvas');
          c.width = TILE; c.height = TILE;
          return c;
        })();
    const ctx = canvas.getContext('2d');

    // ── Step 1: solid base of the chosen mount color ──────────────────
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, TILE, TILE);

    // ── Step 2: discrete pebble bumps with fixed-direction lighting ──
    // Each bump = highlight ellipse (upper-left of dome) + shadow ellipse
    // (lower-right). Drawn at 9 tile-offset positions for seamless wrap.
    // Highlight & shadow alphas are TUNED for the cream base; on dark
    // bases they become subtler but still legible (additive light cream
    // stays visible on darker substrate).
    const rng = (function () {
      // Mulberry32 — same fixed seed per combo so tile is deterministic.
      // Mix in numBumps so different density tiles vary slightly beyond
      // just bump count.
      let a = (0xC0FFEE15 ^ (numBumps * 73856093)) >>> 0;
      return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    })();

    for (let i = 0; i < numBumps; i++) {
      const cx = rng() * TILE;
      const cy = rng() * TILE;
      const r = 2.2 + rng() * 2.6;
      const aspect = 0.75 + rng() * 0.45;
      const rot = rng() * Math.PI * 2;
      const hOff = r * 0.22;
      const sOff = r * 0.28;
      const sr = r * 0.82;

      for (let oxi = -1; oxi <= 1; oxi++) {
        for (let oyi = -1; oyi <= 1; oyi++) {
          const ox = oxi * TILE, oy = oyi * TILE;
          if (cx + ox + r * 2 < 0 || cx + ox - r * 2 > TILE) continue;
          if (cy + oy + r * 2 < 0 || cy + oy - r * 2 > TILE) continue;

          // Highlight
          const hx = cx + ox - hOff;
          const hy = cy + oy - hOff;
          const hGrad = ctx.createRadialGradient(hx, hy, 0, hx, hy, r);
          hGrad.addColorStop(0,   'rgba(255, 248, 222, 0.55)');
          hGrad.addColorStop(0.6, 'rgba(255, 248, 222, 0.18)');
          hGrad.addColorStop(1,   'rgba(255, 248, 222, 0)');
          ctx.fillStyle = hGrad;
          ctx.beginPath();
          ctx.ellipse(hx, hy, r, r * aspect, rot, 0, Math.PI * 2);
          ctx.fill();

          // Shadow
          const sx = cx + ox + sOff;
          const sy = cy + oy + sOff;
          const sGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
          sGrad.addColorStop(0,   'rgba(55, 38, 18, 0.42)');
          sGrad.addColorStop(0.6, 'rgba(55, 38, 18, 0.14)');
          sGrad.addColorStop(1,   'rgba(55, 38, 18, 0)');
          ctx.fillStyle = sGrad;
          ctx.beginPath();
          ctx.ellipse(sx, sy, sr, sr * aspect, rot, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // ── Step 3: low-amplitude per-pixel grain on top ────────────────
    const img = ctx.getImageData(0, 0, TILE, TILE);
    const data = img.data;
    let seed2 = (0xCAFE0BA5 ^ (numBumps * 19349663)) >>> 0;
    for (let i = 0; i < data.length; i += 4) {
      seed2 = (seed2 + 0x6D2B79F5) >>> 0;
      let t = seed2;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      const u = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      const n = (u - 0.5) * 14;  // ±7
      data[i    ] = clampU8(data[i    ] + n);
      data[i + 1] = clampU8(data[i + 1] + n);
      data[i + 2] = clampU8(data[i + 2] + n);
    }
    ctx.putImageData(img, 0, 0);

    return canvas;
  }

  function getLeatherTile(mountColor, numBumps) {
    const key = mountColor + '_' + (numBumps | 0);
    if (!_tileCache.has(key)) {
      const base = MOUNT_COLORS[mountColor] || MOUNT_COLORS.cream;
      _tileCache.set(key, buildLeatherTile(base, numBumps));
    }
    return _tileCache.get(key);
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashGeom(x, y, w, h) {
    return (
      ((x | 0) * 73856093) ^
      ((y | 0) * 19349663) ^
      ((w | 0) * 83492791) ^
      ((h | 0) * 2654435761)
    ) >>> 0;
  }

  function decorate(ctx, layout, args) {
    const s = layout.scale || 1;
    const op = layout.outputPx || Math.max(0.5, s * 0.6);
    const W = layout.canvas.W, H = layout.canvas.H;
    const fgL = layout.fgLeft, fgT = layout.fgTop, fgW = layout.fgW, fgH = layout.fgH;
    const radius = layout.radius;

    // 1.7.0+ — read user-controllable knobs (resolveRenderParams gates
    // them on cfg.slide* and ranges them safely; null falls through to
    // frame defaults for legacy callers).
    const p = (args && args.params && args.params.slideMount) || null;
    const mountColor = p ? p.mountColor : 'cream';
    const ringColor  = p ? p.outerRing  : 'wine';
    const numBumps   = p ? p.numBumps   : 180;
    const bevelBase  = p ? p.bevelDepth : 8;

    const borderW = Math.round(28 * s);
    const bevelW = Math.round(bevelBase * s);
    const insetDepth = Math.round(Math.min(36, bevelBase * 3) * s);

    // ── Leather-grain tile pattern (4 strips on cardstock margin) ──────
    const tile = getLeatherTile(mountColor, numBumps);
    const pattern = ctx.createPattern(tile, 'repeat');
    if (pattern && pattern.setTransform) {
      const m = (typeof DOMMatrix !== 'undefined') ? new DOMMatrix() : null;
      if (m) {
        m.a = s; m.d = s;
        pattern.setTransform(m);
      }
    }
    ctx.fillStyle = pattern;
    if (fgT > borderW) {
      ctx.fillRect(borderW, borderW, W - 2 * borderW, fgT - borderW);
    }
    if (H - borderW > fgT + fgH) {
      ctx.fillRect(borderW, fgT + fgH, W - 2 * borderW, H - borderW - (fgT + fgH));
    }
    if (fgL > borderW) {
      ctx.fillRect(borderW, fgT, fgL - borderW, fgH);
    }
    if (W - borderW > fgL + fgW) {
      ctx.fillRect(fgL + fgW, fgT, W - borderW - (fgL + fgW), fgH);
    }

    // ── Low-frequency unevenness (15 broad soft patches) ──────────────
    // Light/dark patches both painted with mount-aware alphas. On dark
    // mounts the dark patches are nearly invisible (good) and light
    // patches add subtle reflection (also good).
    const rng = mulberry32(hashGeom(fgL, fgT, fgW, fgH));
    {
      let placed = 0, tries = 0;
      while (placed < 15 && tries < 80) {
        tries++;
        const x = rng() * W;
        const y = rng() * H;
        const r = (60 + rng() * 140) * s;
        const dx = Math.max(0, Math.max(fgL - x, x - (fgL + fgW)));
        const dy = Math.max(0, Math.max(fgT - y, y - (fgT + fgH)));
        if (dx * dx + dy * dy < (r * 0.6) * (r * 0.6)) continue;
        placed++;
        const isDark = rng() < 0.5;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        if (isDark) {
          grad.addColorStop(0, 'rgba(50, 35, 18, ' + (0.07 + rng() * 0.05).toFixed(3) + ')');
          grad.addColorStop(1, 'rgba(50, 35, 18, 0)');
        } else {
          grad.addColorStop(0, 'rgba(255, 246, 215, ' + (0.08 + rng() * 0.05).toFixed(3) + ')');
          grad.addColorStop(1, 'rgba(255, 246, 215, 0)');
        }
        ctx.fillStyle = grad;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }

    // ── Bevel cues on cardstock margin (around photo aperture) ─────────
    // Strict-no-overlap rects in cream margin. bevelW scales with
    // cfg.slideBevel; the aperture inset shadow scales 3× capped at 36.
    if (bevelW > 0) {
      const tHi = ctx.createLinearGradient(0, fgT - bevelW, 0, fgT);
      tHi.addColorStop(0, 'rgba(255, 250, 225, 0)');
      tHi.addColorStop(1, 'rgba(255, 250, 225, 0.48)');
      ctx.fillStyle = tHi;
      ctx.fillRect(fgL - bevelW, fgT - bevelW, fgW + bevelW * 2, bevelW);

      const lHi = ctx.createLinearGradient(fgL - bevelW, 0, fgL, 0);
      lHi.addColorStop(0, 'rgba(255, 250, 225, 0)');
      lHi.addColorStop(1, 'rgba(255, 250, 225, 0.48)');
      ctx.fillStyle = lHi;
      ctx.fillRect(fgL - bevelW, fgT - bevelW, bevelW, fgH + bevelW * 2);

      const bSh = ctx.createLinearGradient(0, fgT + fgH, 0, fgT + fgH + bevelW);
      bSh.addColorStop(0, 'rgba(40, 25, 10, 0.38)');
      bSh.addColorStop(1, 'rgba(40, 25, 10, 0)');
      ctx.fillStyle = bSh;
      ctx.fillRect(fgL - bevelW, fgT + fgH, fgW + bevelW * 2, bevelW);

      const rSh = ctx.createLinearGradient(fgL + fgW, 0, fgL + fgW + bevelW, 0);
      rSh.addColorStop(0, 'rgba(40, 25, 10, 0.38)');
      rSh.addColorStop(1, 'rgba(40, 25, 10, 0)');
      ctx.fillStyle = rSh;
      ctx.fillRect(fgL + fgW, fgT - bevelW, bevelW, fgH + bevelW * 2);
    }

    // ── Photo aperture edge: heavy dark hairline ───────────────────────
    ctx.strokeStyle = 'rgba(15, 8, 4, 0.82)';
    ctx.lineWidth = Math.max(1.2, 1.4 * op);
    R.pathRoundRect(ctx, fgL, fgT, fgW, fgH, radius);
    ctx.stroke();

    // ── Photo aperture: inset shadow inside photo ──────────────────────
    if (insetDepth > 0) {
      ctx.save();
      R.pathRoundRect(ctx, fgL, fgT, fgW, fgH, radius);
      ctx.clip();

      const topGrad = ctx.createLinearGradient(0, fgT, 0, fgT + insetDepth);
      topGrad.addColorStop(0,    'rgba(0, 0, 0, 0.58)');
      topGrad.addColorStop(0.25, 'rgba(0, 0, 0, 0.30)');
      topGrad.addColorStop(1,    'rgba(0, 0, 0, 0)');
      ctx.fillStyle = topGrad;
      ctx.fillRect(fgL, fgT, fgW, insetDepth);

      const leftGrad = ctx.createLinearGradient(fgL, 0, fgL + insetDepth, 0);
      leftGrad.addColorStop(0,    'rgba(0, 0, 0, 0.52)');
      leftGrad.addColorStop(0.25, 'rgba(0, 0, 0, 0.28)');
      leftGrad.addColorStop(1,    'rgba(0, 0, 0, 0)');
      ctx.fillStyle = leftGrad;
      ctx.fillRect(fgL, fgT, insetDepth, fgH);

      ctx.restore();
    }

    // ── Re-stamp caption + topBadge ON TOP of the leather (emboss) ────
    // The leather tile fill above just painted over the cream margin —
    // including where the caption + top badge sit. Re-draw them with an
    // embossed treatment: slight-offset INVERTED (light) copy below
    // the dark text, so each character reads as pressed-into-leather.
    function restampEmbossed(img) {
      if (!img) return;
      const liftPx = Math.max(1, Math.round(1.5 * s));
      ctx.save();
      if ('filter' in ctx) {
        ctx.filter = 'brightness(0) invert(1)';
        ctx.globalAlpha = 0.42;
        ctx.drawImage(img, 0, liftPx);
        ctx.filter = 'none';
        ctx.globalAlpha = 1;
      }
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    }
    if (args) {
      restampEmbossed(args.captionImg);
      restampEmbossed(args.topBadgeImg);
    }

    // ── Outer ring (was wine, now user-choice via cfg.slideRing) ──────
    ctx.fillStyle = RING_COLORS[ringColor] || RING_COLORS.wine;
    ctx.fillRect(0, 0, W, borderW);                 // top
    ctx.fillRect(0, H - borderW, W, borderW);       // bottom
    ctx.fillRect(0, 0, borderW, H);                 // left
    ctx.fillRect(W - borderW, 0, borderW, H);       // right
  }

  R.registerFrame('slide-mount', {
    bg: { type: 'solid', color: MOUNT_COLORS.cream },
    textStyle: 'dark',
    layout: { topPaddingBoost: 100, bottomPaddingBoost: 120 },
    minPadding: { top: 100, right: 80, bottom: 120, left: 80 },
    shadowDefault: { blur: 0, offsetY: 0, opacity: 0 },
    // Frame default values for the 1.7.0+ user-controllable knobs.
    // resolveRenderParams reads these when cfg.slide* fields are null.
    // mountColors / ringColors are the enum lookups consumed by
    // resolveRenderParams to apply tint / outerRing selections.
    slideMount: {
      mountColor: 'cream',
      outerRing:  'wine',
      pebbleScale: 1.0,
      bevelDepth: 8,
      mountColors: MOUNT_COLORS,
      ringColors:  RING_COLORS
    },
    // ─── 1.7.x harness · cfg schema (4 knobs) ─────────────────────────
    cfg: {
      slideMountColor: { kind: 'swatches', options: ['cream', 'leather', 'black'], default: null, frameDefault: 'cream' },
      slideOuterRing:  { kind: 'swatches', options: ['wine', 'brass', 'charcoal'], default: null, frameDefault: 'wine'  },
      slidePebble:     { kind: 'slider', min: 0.5, max: 1.5, step: 0.25, default: null, frameDefault: 1.0 },
      slideBevel:      { kind: 'slider', min: 4,   max: 20,  step: 1,    default: null, frameDefault: 8   }
    },
    decorate: decorate
  });
})();
