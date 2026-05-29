/* photo-tools — frame style: gallery-white.
 *
 * Curated-print look — a warm off-white field (#f4f3ee, slightly cooler
 * than printer paper, slightly warmer than gallery cardstock) with a
 * double-thin passe-partout border drawn around the foreground photo.
 * The matboard reading: outer line at ~26 base-px from the photo edge,
 * inner line at ~8 base-px, both as fine hairlines that stay thin
 * regardless of export quality.
 *
 * Replaces the old 'white' frame (which was a flat #f5f5f5 with no
 * decorative pass). The old 'white' key is registered as an alias so
 * existing presets / share codes still resolve.
 */
(function () {
  'use strict';
  const root = (typeof self !== 'undefined' ? self : globalThis);
  const R = root.PhotoRender;

  // Line color enum → RGBA pair { inner, outer } consumed by the strokes.
  // Inner is always the lighter twin of the outer pair (eye reads the
  // double-line as "outer dominant, inner whisper"). 1.4.0+ — user-
  // selectable via cfg.galLineColor (resolved into params.galleryWhite).
  const LINE_INK = {
    ink:      { inner: 'rgba(35, 35, 30, 0.32)',  outer: 'rgba(35, 35, 30, 0.52)' },
    charcoal: { inner: 'rgba(95, 90, 82, 0.30)',  outer: 'rgba(95, 90, 82, 0.55)' },
    warm:     { inner: 'rgba(140, 110, 78, 0.30)', outer: 'rgba(140, 110, 78, 0.55)' }
  };

  // passe-partout draws the two concentric thin rounded rects around the fg.
  // Line widths are tied to layout.outputPx so hairlines stay thin even at
  // `quality: high` (where naive scaling would bloat to 3-4 canvas-px).
  //
  // 1.4.0+ — reads `args.params.galleryWhite` for user-controllable matWidth
  // (outer inflate distance), lineSpacing (gap between inner and outer
  // hairlines), lineWeight (stroke scalar) and lineColor (enum → RGBA).
  // Legacy callers (args / args.params missing) fall back to the original
  // hardcoded values so smoke baselines stay green.
  function decorate(ctx, layout, args) {
    const s = layout.scale || 1;
    const op = layout.outputPx || Math.max(0.5, s * 0.6);
    const p = (args && args.params && args.params.galleryWhite) || null;
    const matWidth    = p ? p.matWidth    : 26;
    const lineSpacing = p ? p.lineSpacing : 18;
    const lineWeight  = p ? p.lineWeight  : 1.0;
    const ink         = LINE_INK[p ? p.lineColor : 'ink'] || LINE_INK.ink;

    const outerInflate = Math.round(matWidth * s);
    const innerInflate = Math.round(Math.max(2, matWidth - lineSpacing) * s);
    const innerR = layout.radius + innerInflate;
    const outerR = layout.radius + outerInflate;

    // Inner hairline: tighter ring snugged against the photo, lighter ink
    ctx.strokeStyle = ink.inner;
    ctx.lineWidth = Math.max(1, 0.9 * op * lineWeight);
    R.pathRoundRect(
      ctx,
      layout.fgLeft - innerInflate,
      layout.fgTop - innerInflate,
      layout.fgW + 2 * innerInflate,
      layout.fgH + 2 * innerInflate,
      innerR
    );
    ctx.stroke();

    // Outer hairline: slightly heavier, deeper ink — frames the photo
    ctx.strokeStyle = ink.outer;
    ctx.lineWidth = Math.max(1, 1.5 * op * lineWeight);
    R.pathRoundRect(
      ctx,
      layout.fgLeft - outerInflate,
      layout.fgTop - outerInflate,
      layout.fgW + 2 * outerInflate,
      layout.fgH + 2 * outerInflate,
      outerR
    );
    ctx.stroke();
  }

  const def = {
    bg: { type: 'solid', color: '#f4f3ee' },
    textStyle: 'dark',
    layout: {},
    shadowDefault: { blur: 60, offsetY: 18, opacity: 0.18 },
    // Frame default values for the user-controllable passe-partout knobs.
    // resolveRenderParams reads this when cfg.gal* is null.
    galleryWhite: { matWidth: 26, lineSpacing: 18, lineWeight: 1.0, lineColor: 'ink' },
    // ─── 1.7.x harness · cfg schema (4 knobs) ─────────────────────────
    cfg: {
      galMatWidth:    { kind: 'slider',   min: 8,   max: 60,  step: 1,   default: null, frameDefault: 26  },
      galLineSpacing: { kind: 'slider',   min: 4,   max: 24,  step: 1,   default: null, frameDefault: 18  },
      galLineWeight:  { kind: 'slider',   min: 0.5, max: 2.4, step: 0.1, default: null, frameDefault: 1.0 },
      galLineColor:   { kind: 'swatches', options: ['ink', 'charcoal', 'warm'],         default: null, frameDefault: 'ink' }
    },
    decorate: decorate
  };
  R.registerFrame('gallery-white', def);
  R.registerFrame('white', def);
})();
