/* photo-tools — frame style: film-35.
 *
 * 35mm motion-picture film aesthetic — deep-black field with two rows of
 * sprocket-hole punches above and below the foreground photo, plus a
 * small cream-colored "frame number · stock" stamp at the bottom-right
 * edge. Caption (when present) prints in the lower margin below the
 * bottom sprocket row.
 *
 * Layout: padding boost on top + bottom (sprocket-hole gutters), normal
 * left/right padding (filmstrip is mostly tall, holes only top & bottom).
 * The bottom boost is large enough to seat both a sprocket row and a
 * caption strip below it without crowding.
 */
(function () {
  'use strict';
  const root = (typeof self !== 'undefined' ? self : globalThis);
  const R = root.PhotoRender;

  // 7 sprocket-hole pairs reads as enough rhythm to feel like film without
  // turning the gutter into pure decoration. Real 35mm cine has 4 perfs
  // per frame; we're consciously bumping to 7 because the photo here is
  // the FRAME, not a single perf.
  const HOLES = 7;

  // Build the per-photo film-stock stamp. "K · 400 · DX" reads like the
  // edge-print on real motion-picture stock: brand letter + ISO + DX-code
  // suffix. Falls back to a generic "FILM" when EXIF is empty.
  function frameStamp(exif) {
    if (!exif) return 'FILM · 400 · DX';
    let brand = '';
    if (exif.make) {
      const m = String(exif.make).toUpperCase().trim();
      // Use the first letter of the brand (K-Kodak, F-Fujifilm, S-Sony, ...)
      // for a real edge-print feel; fall back to the full short brand
      // when it's already 2-3 chars.
      brand = m.length <= 3 ? m : m.charAt(0);
    }
    // exif.iso is pre-formatted as "ISO400". Strip the prefix for the
    // edge stamp — film edges show the bare DIN/ASA number.
    const isoMatch = exif.iso && String(exif.iso).match(/(\d+)/);
    const iso = isoMatch ? isoMatch[1] : '400';
    const head = brand || 'FILM';
    return head + ' · ' + iso + ' · DX';
  }

  function decorate(ctx, layout, args) {
    const s = layout.scale || 1;
    const op = layout.outputPx || Math.max(0.5, s * 0.6);
    const W = layout.canvas.W;
    const H = layout.canvas.H;
    const fgL = layout.fgLeft, fgT = layout.fgTop, fgW = layout.fgW, fgH = layout.fgH;

    // ── Sprocket holes ────────────────────────────────────────────────
    // Punch holes through the dark gutter above + below the photo. Holes
    // are rounded rectangles; cream/white fill (the perforation reveals
    // the white film leader behind the dark emulsion). Vertical centers
    // sit a touch closer to the photo than to the canvas edge so they
    // read as "attached to the frame" rather than floating.
    const holeW = Math.round(36 * s);
    const holeH = Math.round(20 * s);
    const holeR = Math.round(4 * s);
    // Top row: vertical center one third of the way up from the photo
    // edge into the top gutter (clamped so holes don't bleed off canvas).
    const topGap = fgT;
    const botGap = H - (fgT + fgH);
    const topRowCY = Math.max(holeH, Math.round(fgT - topGap * 0.45));
    const botRowCY = Math.min(H - holeH, Math.round(fgT + fgH + botGap * 0.30));

    // Distribute holes across the photo's horizontal extent — gives the
    // illusion that the perforations align with the frame edge.
    const slotW = fgW / HOLES;

    ctx.fillStyle = '#f3efe5';
    for (let i = 0; i < HOLES; i++) {
      const cx = fgL + i * slotW + slotW / 2;
      const x = cx - holeW / 2;
      R.pathRoundRect(ctx, Math.round(x), Math.round(topRowCY - holeH / 2), holeW, holeH, holeR);
      ctx.fill();
      R.pathRoundRect(ctx, Math.round(x), Math.round(botRowCY - holeH / 2), holeW, holeH, holeR);
      ctx.fill();
    }

    // ── Frame stamp (top-leader edge print) ────────────────────────────
    // Cream-colored monospace stamp evoking film-edge perf labels
    // ("F · 400 · DX"). Positioned in the gutter ABOVE the top sprocket
    // row so it doesn't fight the bottom row of holes for vertical
    // space. Reads like the brand+stock print on a 35mm leader.
    // Uses ctx.fillText with system monospace — workers don't have
    // FontFace API plumbed for arbitrary fonts, and a generic
    // monospace falls back gracefully across browsers.
    const stamp = frameStamp(args && args.normExif);
    const stampPx = Math.max(10, Math.round(13 * s));
    ctx.font = stampPx + 'px ui-monospace, "SF Mono", "Menlo", monospace';
    ctx.fillStyle = 'rgba(243, 239, 229, 0.78)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    // Right-align the stamp with the photo's right edge — same x-grid
    // as the rightmost sprocket-hole column for a clean vertical seam.
    // Vertical: midway between canvas top and top sprocket row.
    const stampX = fgL + fgW;
    const stampY = Math.max(stampPx, Math.round((topRowCY - holeH / 2) / 2));
    ctx.fillText(stamp, stampX, stampY);

    // Subtle hairline along the photo's outer edge — keeps the photo
    // visually integrated with the dark filmstrip rather than looking
    // pasted on. Very low contrast so it doesn't read as a border.
    ctx.strokeStyle = 'rgba(255, 255, 240, 0.05)';
    ctx.lineWidth = Math.max(1, 0.6 * op);
    R.pathRoundRect(ctx, fgL, fgT, fgW, fgH, layout.radius);
    ctx.stroke();
  }

  R.registerFrame('film-35', {
    bg: { type: 'solid', color: '#0c0c0c' },
    textStyle: 'light',
    layout: { topPaddingBoost: 70, bottomPaddingBoost: 90 },
    shadowDefault: { blur: 0, offsetY: 0, opacity: 0 },
    decorate: decorate
  });
})();
