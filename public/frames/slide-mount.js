/* photo-tools — frame style: slide-mount (35mm slide-mount aesthetic).
 *
 * Channels the look of a mounted transparency: a sheet of pebbled-
 * leather cream cardstock with a photo recessed into a rectangular
 * aperture, the whole thing sitting inside a deep-wine outer tray.
 *
 * Visual stack (outside → inside):
 *   [deep wine outer border, ~28 base-px on all 4 sides]
 *   [pebbled-leather cream cardstock — tile-noise pattern + soft patches]
 *   [bevel cues on cream around photo: top+left highlight, bot+right shadow]
 *   [photo aperture edge: heavy dark hairline]
 *   [photo, inset with top+left two-stop inner shadow]
 *
 * Joins the film family as the third variant: film-35 is the negative,
 * film-mf is the print, slide-mount is the mounted transparency.
 *
 * Text on the mount comes from the project's native caption template
 * system — pick any caption template and it renders into the cream
 * area below the photo.
 *
 * Leather texture comes from a 128×128 tile-able value-noise canvas
 * filled via createPattern across the cream margin. This gives uniform
 * sub-pixel grain across the entire mount (vs. the earlier sparse-
 * ellipse approach, which only covered ~0.5% of the cream and read
 * as "scattered dots" not "leather"). On top of the per-pixel grain,
 * ~15 broad soft radial gradients give the surface low-frequency
 * unevenness ("this leather wears in unevenly over time").
 *
 * Determinism: the noise tile is module-level cached using a fixed
 * seed, so the same tile is reused across every render in the same
 * worker / main-thread context. The low-frequency patches use a per-
 * photo geometry seed so the same photo always shows the same patch
 * pattern across renders.
 */
(function () {
  'use strict';
  const root = (typeof self !== 'undefined' ? self : globalThis);
  const R = root.PhotoRender;

  // Warm cream cardstock — slightly more saturated than gallery-white's
  // #f4f3ee. Reads as "old leather with a hint of yellowing".
  const PAPER = '#e6dac0';
  // Deep wine / oxblood — the slide tray the mount sits inside. Cooler
  // than #5a1820 (reads as brick-orange in low light), warmer than
  // #2a1015 (would read black). #3a1822 lands as "tannic burgundy".
  const BORDER = '#3a1822';

  // ─── Pebbled-leather tile (module-level cache) ──────────────────────
  // A 128×128 OffscreenCanvas filled with a hand-built pebbled texture:
  // cream base + ~180 discrete tile-wrapping "bumps" (each painted as a
  // light-side highlight ellipse offset upper-left and a dark-side
  // shadow ellipse offset lower-right — fixed light direction so all
  // bumps read 3D) + low-amplitude per-pixel noise on top for paper
  // micro-grain. Reused across renders via createPattern('repeat').
  //
  // This shape gives the texture distinct pebble structure (vs. the
  // earlier multi-octave value-noise version which was uniform and
  // read as TV static / fabric weave). The reference is a 35mm slide
  // mount's pressed-cardstock pebble surface.
  const TILE = 128;
  let _leatherTile = null;

  function clampU8(v) {
    return v < 0 ? 0 : v > 255 ? 255 : (v | 0);
  }

  function buildLeatherTile() {
    const canvas = (typeof OffscreenCanvas !== 'undefined')
      ? new OffscreenCanvas(TILE, TILE)
      : (function () {
          const c = document.createElement('canvas');
          c.width = TILE; c.height = TILE;
          return c;
        })();
    const ctx = canvas.getContext('2d');

    // ── Step 1: cream base ──────────────────────────────────────────
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, TILE, TILE);

    // ── Step 2: discrete pebble bumps with fixed-direction lighting ──
    // Each bump is two overlapping radial gradients: a warm highlight
    // at the upper-left (the lit half of the dome) and a sepia shadow
    // at the lower-right (the shadowed side). The pair reads as a
    // raised pebble. Drawing each bump at the 9 tile-offset positions
    // (–TILE, 0, +TILE on both axes) handles seamless wrap; off-canvas
    // copies are auto-clipped by the canvas.
    const rng = (function () {
      // Mulberry32 with a fixed tile seed — same tile every context.
      let a = 0xC0FFEE15;
      return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    })();

    const numBumps = 180;
    for (let i = 0; i < numBumps; i++) {
      // Bump geometry — sample BEFORE the tile-offset loop so rng
      // consumption stays deterministic.
      const cx = rng() * TILE;
      const cy = rng() * TILE;
      const r = 2.2 + rng() * 2.6;          // 2.2..4.8 px radius
      const aspect = 0.75 + rng() * 0.45;   // 0.75..1.2 (slightly ellipsoid)
      const rot = rng() * Math.PI * 2;
      const hOff = r * 0.22;                 // highlight pushed up-left
      const sOff = r * 0.28;                 // shadow pushed down-right
      const sr = r * 0.82;                   // shadow gradient is tighter

      for (let oxi = -1; oxi <= 1; oxi++) {
        for (let oyi = -1; oyi <= 1; oyi++) {
          const ox = oxi * TILE, oy = oyi * TILE;
          // Cull bumps fully outside the tile (their gradients won't
          // contribute any visible pixels).
          if (cx + ox + r * 2 < 0 || cx + ox - r * 2 > TILE) continue;
          if (cy + oy + r * 2 < 0 || cy + oy - r * 2 > TILE) continue;

          // Highlight (light from upper-left → highlight on upper-left)
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

          // Shadow (lower-right of bump → small darker pocket)
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
    // The bumps give discrete structure; this adds paper micro-grain
    // so the surface doesn't read as "smooth dome + smooth dome".
    // Amplitude kept low (±7) — strong enough to break up smooth
    // gradients, weak enough not to overwhelm the bump structure.
    const img = ctx.getImageData(0, 0, TILE, TILE);
    const data = img.data;
    let seed2 = 0xCAFE0BA5;
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

  function getLeatherTile() {
    if (!_leatherTile) _leatherTile = buildLeatherTile();
    return _leatherTile;
  }

  // Mulberry32 + geometry-hash, same deterministic-noise pattern that
  // torn-paper and film-mf use. Used for the LOW-frequency patches that
  // ride on top of the tile noise.
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
    const borderW = Math.round(28 * s);

    // ── Leather-grain tile pattern (4 strips on cream margin) ──────────
    // Pattern is tiled at scale s so the grain feels physically constant
    // across preview / standard / high quality renders. We apply via 4
    // strict-no-overlap rects: top / bottom / left / right of the photo,
    // each inside the wine border. The photo aperture stays untouched.
    const tile = getLeatherTile();
    const pattern = ctx.createPattern(tile, 'repeat');
    if (pattern && pattern.setTransform) {
      // Scale the pattern so each tile prints at the same physical size
      // regardless of canvas resolution. Without this, "high quality"
      // renders show much finer grain than preview, which is wrong —
      // physical leather doesn't change density when you zoom in.
      const m = (typeof DOMMatrix !== 'undefined') ? new DOMMatrix() : null;
      if (m) {
        m.a = s; m.d = s;
        pattern.setTransform(m);
      }
    }
    ctx.fillStyle = pattern;
    // Top strip: between wine border and photo top
    if (fgT > borderW) {
      ctx.fillRect(borderW, borderW, W - 2 * borderW, fgT - borderW);
    }
    // Bottom strip: between photo bottom and wine border
    if (H - borderW > fgT + fgH) {
      ctx.fillRect(borderW, fgT + fgH, W - 2 * borderW, H - borderW - (fgT + fgH));
    }
    // Left strip: between wine border and photo left (only the band beside the photo)
    if (fgL > borderW) {
      ctx.fillRect(borderW, fgT, fgL - borderW, fgH);
    }
    // Right strip: between photo right and wine border
    if (W - borderW > fgL + fgW) {
      ctx.fillRect(fgL + fgW, fgT, W - borderW - (fgL + fgW), fgH);
    }

    // ── Low-frequency unevenness (15 broad soft patches) ──────────────
    // Seeded by photo geometry, distance-rejected from the photo so the
    // bright/dark patches don't bleed onto the image. Adds the "old
    // leather wears in unevenly" character that pure tile-noise misses.
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

    // ── Bevel cues on cream margin (around photo aperture) ─────────────
    // Physical depth comes from light direction (top-right). The
    // chamfered edge of the aperture catches:
    //   top + left edges of cream → faint highlight (light directly hits)
    //   bottom + right edges of cream → faint shadow (cardstock receding away)
    // All four strips strictly stay in the cream margin (no rect overlaps
    // the photo zone), so no clipping needed.
    const bevelW = Math.round(8 * s);

    // Top: highlight on cream just above photo top edge
    const tHi = ctx.createLinearGradient(0, fgT - bevelW, 0, fgT);
    tHi.addColorStop(0, 'rgba(255, 250, 225, 0)');
    tHi.addColorStop(1, 'rgba(255, 250, 225, 0.48)');
    ctx.fillStyle = tHi;
    ctx.fillRect(fgL - bevelW, fgT - bevelW, fgW + bevelW * 2, bevelW);

    // Left: highlight on cream just left of photo left edge
    const lHi = ctx.createLinearGradient(fgL - bevelW, 0, fgL, 0);
    lHi.addColorStop(0, 'rgba(255, 250, 225, 0)');
    lHi.addColorStop(1, 'rgba(255, 250, 225, 0.48)');
    ctx.fillStyle = lHi;
    ctx.fillRect(fgL - bevelW, fgT - bevelW, bevelW, fgH + bevelW * 2);

    // Bottom: shadow on cream just below photo bottom edge
    const bSh = ctx.createLinearGradient(0, fgT + fgH, 0, fgT + fgH + bevelW);
    bSh.addColorStop(0, 'rgba(40, 25, 10, 0.38)');
    bSh.addColorStop(1, 'rgba(40, 25, 10, 0)');
    ctx.fillStyle = bSh;
    ctx.fillRect(fgL - bevelW, fgT + fgH, fgW + bevelW * 2, bevelW);

    // Right: shadow on cream just right of photo right edge
    const rSh = ctx.createLinearGradient(fgL + fgW, 0, fgL + fgW + bevelW, 0);
    rSh.addColorStop(0, 'rgba(40, 25, 10, 0.38)');
    rSh.addColorStop(1, 'rgba(40, 25, 10, 0)');
    ctx.fillStyle = rSh;
    ctx.fillRect(fgL + fgW, fgT - bevelW, bevelW, fgH + bevelW * 2);

    // ── Photo aperture edge: heavy dark hairline ───────────────────────
    // Sharp cut transition. Heavier than other frames because we want
    // the "cardstock thickness" boundary to read decisively.
    ctx.strokeStyle = 'rgba(15, 8, 4, 0.82)';
    ctx.lineWidth = Math.max(1.2, 1.4 * op);
    R.pathRoundRect(ctx, fgL, fgT, fgW, fgH, radius);
    ctx.stroke();

    // ── Photo aperture: inset shadow inside photo ──────────────────────
    // Two-stop gradient so the shadow has a darker "shoulder" right at
    // the edge fading to nothing — gives the recess more depth than a
    // single-stop fade. Top + left only; bottom + right stay clean
    // (light direction convention from upper-right).
    ctx.save();
    R.pathRoundRect(ctx, fgL, fgT, fgW, fgH, radius);
    ctx.clip();

    const insetDepth = Math.round(24 * s);

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

    // ── Re-stamp caption + topBadge ON TOP of the leather (emboss) ────
    // compose() drew the caption + top-badge BEFORE our decorate ran,
    // but the leather tile fill above just painted over the cream
    // margin — including where they sit. Re-draw them here so they're
    // visible on the leather. For the "stamped into leather" visual:
    // paint a slightly-offset INVERTED (light) copy first, so each
    // character carries a thin lit edge below it, then paint the
    // original on top. Together they read as "pressed into the surface,
    // lit from above".
    //
    // The inverted-light pass uses ctx.filter = 'brightness(0) invert(1)'
    // — turns the rasterized dark text into white-on-transparent so
    // we can composite it as a highlight. Available on main thread
    // Canvas2D (Chrome 52+, Safari 15.4+) and OffscreenCanvas
    // (workers); both render paths slide-mount runs in support it.
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

    // ── Outer wine border ──────────────────────────────────────────────
    // Four solid strips around the canvas perimeter. Drawn last so it
    // overpaints any grain / bevel cues that landed in the border zone.
    // Hard transition to the cream — matches how a slide sits flat
    // against a darker tray.
    ctx.fillStyle = BORDER;
    ctx.fillRect(0, 0, W, borderW);                 // top
    ctx.fillRect(0, H - borderW, W, borderW);       // bottom
    ctx.fillRect(0, 0, borderW, H);                 // left
    ctx.fillRect(W - borderW, 0, borderW, H);       // right
  }

  R.registerFrame('slide-mount', {
    bg: { type: 'solid', color: PAPER },
    textStyle: 'dark',
    // Modest top/bottom padding boost — enough that the cream cardstock
    // reads as a real mount with breathing room around the photo, with
    // caption going into the bottom margin via the standard auto-route.
    layout: { topPaddingBoost: 100, bottomPaddingBoost: 120 },
    // No drop shadow — the photo is INSET into the mount (depth comes
    // from the inner-shadow gradient in decorate, not from a raised
    // pop). Anything > 0 would visually fight the recessed metaphor.
    shadowDefault: { blur: 0, offsetY: 0, opacity: 0 },
    decorate: decorate
  });
})();
