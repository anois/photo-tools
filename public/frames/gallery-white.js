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

  // passe-partout draws the two concentric thin rounded rects around the fg.
  // Line widths are tied to layout.outputPx so hairlines stay thin even at
  // `quality: high` (where naive scaling would bloat to 3-4 canvas-px).
  function decorate(ctx, layout) {
    const s = layout.scale || 1;
    const op = layout.outputPx || Math.max(0.5, s * 0.6);
    const innerInflate = Math.round(8 * s);
    const outerInflate = Math.round(26 * s);
    const innerR = layout.radius + innerInflate;
    const outerR = layout.radius + outerInflate;

    // Inner hairline: tighter ring snugged against the photo, lighter ink
    ctx.strokeStyle = 'rgba(35, 35, 30, 0.32)';
    ctx.lineWidth = Math.max(1, 0.9 * op);
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
    ctx.strokeStyle = 'rgba(35, 35, 30, 0.52)';
    ctx.lineWidth = Math.max(1, 1.5 * op);
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
    decorate: decorate
  };
  R.registerFrame('gallery-white', def);
  R.registerFrame('white', def);
})();
