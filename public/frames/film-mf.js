/* photo-tools — frame style: film-mf (medium-format film).
 *
 * Companion to `film-35`. Designed to read as a frame of 120 roll film
 * (medium format) — the larger negatives that came out of Hasselblad,
 * Mamiya, Rolleiflex bodies. Visual differentiation from film-35 has
 * to be unmistakable, otherwise the family is confusing.
 *
 * Visual stack, top → bottom:
 *   [stock label: "FUJIFILM · 120 · ASA 400"     6×6]   ← header strip
 *   [photo, with subtle cream hairline]
 *   [frame number: "07 / 12"           ←  →]            ← footer strip
 *
 * Key differentiators from film-35:
 *  - NO perforations. Real 120 roll film has no sprocket holes — film
 *    advance happens through the spool's paper backing. This is the
 *    single most identifiable visual difference between 35mm and 120
 *    in person, and we honor it. (The doc end-candidate had suggested
 *    "sparser perfs", but reality wins over that off-the-cuff brief
 *    once you accept the family's whole point is "this looks like
 *    medium format", not "this looks like 35mm but with fewer perfs".)
 *  - Larger top/bottom rebates (more padding) — on real 120 the
 *    margin around the image is proportionally bigger because the
 *    film stock is much wider (120 ≈ 60mm vs 35mm ≈ 24mm short edge).
 *  - Verbose stock label that prints brand + format + sensitivity —
 *    "FUJIFILM · 120 · ASA 400" — instead of the compact 35mm tag
 *    "FUJIFILM · 400T · DX". 120 has no DX code (DX is a 35mm canister
 *    convention) and no T suffix (tungsten balance was a cinematic
 *    35mm thing).
 *  - Frame number reads "07 / 12" not "07A" — 6×6 yields exactly 12
 *    exposures per roll, so "X of 12" is the canonical readout.
 *  - Top-right corner "6×6" tag, the unique-to-medium-format square
 *    aspect callout (real 6×6 cameras like Hasselblad were the
 *    archetype).
 *
 * Same warm dark body (#100c08) as film-35 to keep the family visually
 * coherent — both read as "exposed film stock under low light", just
 * with different formats. Same cream perforation color is repurposed
 * for all label text so the family palette stays consistent.
 */
(function () {
  'use strict';
  const root = (typeof self !== 'undefined' ? self : globalThis);
  const R = root.PhotoRender;

  const FILM_CREAM = '#ebdcb8';

  // ─── Synthesis from EXIF ──────────────────────────────────────────────

  function topStockLabel(exif) {
    const brandRaw = (exif && exif.make) ? String(exif.make).toUpperCase().trim() : '';
    const brand = brandRaw || 'FILM';
    const isoMatch = (exif && exif.iso) ? String(exif.iso).match(/(\d+)/) : null;
    const iso = isoMatch ? isoMatch[1] : '400';
    return brand + ' · 120 · ASA ' + iso;
  }

  // 6×6 has 12 exposures per roll, so "N / 12" is the canonical readout.
  // Map EXIF day-of-month into the range 1..12 so sequential photos from
  // a shoot get plausibly sequential frame numbers (with wraparound).
  function frameNumber(exif) {
    if (!exif || !exif.date) return '07 / 12';
    const m = String(exif.date).match(/(\d{2})$/);
    if (!m) return '07 / 12';
    const dd = parseInt(m[1], 10);
    const num = ((dd - 1) % 12) + 1;
    return (num < 10 ? '0' + num : num) + ' / 12';
  }

  // ─── Decorate hook ────────────────────────────────────────────────────

  function decorate(ctx, layout, args) {
    const s = layout.scale || 1;
    const op = layout.outputPx || Math.max(0.5, s * 0.6);
    const H = layout.canvas.H;
    const fgL = layout.fgLeft, fgT = layout.fgTop, fgW = layout.fgW, fgH = layout.fgH;
    const exif = args && args.normExif;

    // ── Top stock label + format tag ──────────────────────────────────
    // Stock label flush-left along the photo's left edge; format tag
    // ("6×6") flush-right. Mirrors film-35's left/right header pair
    // visually but the right side is a format callout instead of a
    // direction arrow — the format tag is the most "medium-format-y"
    // thing on the frame, can't bury it.
    const stamp = topStockLabel(exif);
    const stampPx = Math.max(11, Math.round(15 * s));
    const stampY = Math.max(stampPx + 2, Math.round(fgT / 2));
    ctx.font = 'bold ' + stampPx + 'px ui-monospace, "SF Mono", "Menlo", monospace';
    ctx.fillStyle = 'rgba(235, 220, 184, 0.82)';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(stamp, fgL, stampY);

    const tagPx = Math.max(10, Math.round(13 * s));
    ctx.font = tagPx + 'px ui-monospace, "SF Mono", "Menlo", monospace';
    ctx.fillStyle = 'rgba(235, 220, 184, 0.62)';
    ctx.textAlign = 'right';
    ctx.fillText('6×6', fgL + fgW, stampY);

    // ── Bottom frame number ───────────────────────────────────────────
    // Position is the midpoint between the bottom of the photo and the
    // top of the caption strip — same gutter math as film-35 so the
    // two cousin frames have visually consistent label heights.
    const fnText = frameNumber(exif);
    const fnPx = Math.max(11, Math.round(14 * s));
    const captionTop = (layout.caption && layout.caption.placement === 'bottom')
      ? layout.caption.y
      : H;
    const fnY = Math.min(H - fnPx / 2 - 2, Math.round(fgT + fgH + (captionTop - (fgT + fgH)) / 2));
    ctx.font = fnPx + 'px ui-monospace, "SF Mono", "Menlo", monospace';
    ctx.fillStyle = 'rgba(235, 220, 184, 0.78)';
    ctx.textAlign = 'left';
    ctx.fillText(fnText, fgL, fnY);

    // ── Photo edge — cream hairline ───────────────────────────────────
    // Same hairline as film-35 — keeps the family visually unified
    // while the body design (no perfs, bigger labels) does the
    // differentiation work.
    ctx.strokeStyle = 'rgba(235, 220, 184, 0.10)';
    ctx.lineWidth = Math.max(1, 0.8 * op);
    R.pathRoundRect(ctx, fgL, fgT, fgW, fgH, layout.radius);
    ctx.stroke();
  }

  R.registerFrame('film-mf', {
    bg: { type: 'solid', color: '#100c08' },
    textStyle: 'light',
    // Bigger rebates than film-35 — top 130 / bottom 160 (vs film-35's
    // 70 / 90). 120 negatives have proportionally larger margins, and
    // the verbose stock label wants more breathing room than film-35's
    // 35mm edge tag.
    layout: { topPaddingBoost: 130, bottomPaddingBoost: 160 },
    shadowDefault: { blur: 0, offsetY: 0, opacity: 0 },
    decorate: decorate
  });
})();
