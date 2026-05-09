/* photo-tools — frame style: kodak-pro.
 *
 * Magazine-print aesthetic inspired by Kodak Professional editorial layouts.
 * Visual stack, top → bottom:
 *   [Kodak Professional brand banner — left-aligned, in the top padding]
 *   [photo with rounded corners + soft drop shadow]
 *   [caption strip — driven by whatever template the user picks]
 *
 * The top brand banner is painted by the frame's `decorate` hook, not a
 * caption. It is part of the frame's identity (like the gallery
 * passe-partout or film-35 sprockets), so it doesn't compete with the
 * camera-EXIF caption that the user composes in the bottom strip.
 *
 * Body color is a slightly warm white (#fafaf7) — pure #fff reads cold
 * against the editorial-magazine context. Kodak red (#ed1c24) is the
 * brand's documented spot color; "Professional" rides next to it in
 * black at 0.78 alpha to keep the kodak word the visual lead.
 */
(function () {
  'use strict';
  const root = (typeof self !== 'undefined' ? self : globalThis);
  const R = root.PhotoRender;

  const KODAK_RED   = '#ed1c24';
  const KODAK_INK   = 'rgba(20, 20, 20, 0.82)';
  const PAPER_TINT  = '#fafaf7';

  function drawKodakHeader(ctx, layout, args) {
    const s = layout.scale || 1;
    const fgL = layout.fgLeft, fgT = layout.fgTop;

    // Banner sits in the top padding (above the photo). Vertically
    // centered between canvas top and fgTop. Left-aligned with the photo
    // edge so it reads as a header for the composition.
    const bannerCY = Math.round(fgT / 2);
    const kodakPx  = Math.max(18, Math.round(34 * s));
    const proPx    = Math.max(15, Math.round(28 * s));

    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    // "Kodak" in red, semibold.
    ctx.font = '700 ' + kodakPx + 'px \'Inter\', system-ui, sans-serif';
    ctx.fillStyle = KODAK_RED;
    const kodakText = 'Kodak';
    ctx.fillText(kodakText, fgL, bannerCY);
    const kodakW = ctx.measureText(kodakText).width;

    // Spacer + "Professional" in dark ink, regular weight.
    const gap = Math.round(8 * s);
    ctx.font = '400 ' + proPx + 'px \'Inter\', system-ui, sans-serif';
    ctx.fillStyle = KODAK_INK;
    ctx.fillText('Professional', fgL + kodakW + gap, bannerCY);

    ctx.restore();
  }

  R.registerFrame('kodak-pro', {
    bg: { type: 'solid', color: PAPER_TINT },
    textStyle: 'dark',
    layout: { topPaddingBoost: 90, bottomPaddingBoost: 30 },
    shadowDefault: { blur: 50, offsetY: 16, opacity: 0.18 },
    decorate: drawKodakHeader
  });
})();
