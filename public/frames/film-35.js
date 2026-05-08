/* photo-tools — frame style: film-35.
 *
 * Physical 35mm motion-picture film aesthetic. Designed to read as an
 * actual frame of cine film — not just "a black box with holes".
 *
 * Visual stack, top → bottom:
 *   [edge print: "FUJIFILM · 640T · DX"     →]  ← stock label + head/tail arrow
 *   [top perforation row, 8–32 BH-spec perfs]   ← density adapts to fg width
 *   [photo, with subtle cream hairline]
 *   [bottom perforation row, mirror of top]
 *   [· 21A ·]                                   ← frame number from EXIF date
 *   [caption strip]
 *
 * Body color is a warm dark (#100c08) instead of pure black — real
 * processed film never reads as #000. Perforations are cream
 * (#ebdcb8), with a 1.4×outputPx darker shadow along the bottom
 * inside edge to suggest "punched through". Perforation aspect
 * ratio follows the BH-1866 spec (~1.4:1 W:H).
 *
 * Edge print + frame number derive from EXIF (brand, ISO, date)
 * so two different photos with the same frame look distinct,
 * mimicking real frame-by-frame film numbering.
 */
(function () {
  'use strict';
  const root = (typeof self !== 'undefined' ? self : globalThis);
  const R = root.PhotoRender;

  // Approximate spacing between perforation centers, in base-1440 px.
  // Real 35mm has 4 perfs per frame at 4.75mm pitch. Scaled to our
  // canvas, ~110 px gives a similar rhythm: 9:16 ≈ 12 perfs across,
  // 16:9 ≈ 22 perfs, 1:1 ≈ 12 perfs — consistent visual cadence at
  // every aspect ratio.
  const HOLE_PITCH_BASE = 110;
  const HOLE_W_BASE = 28;   // BH-1866 is wider than tall
  const HOLE_H_BASE = 20;
  const HOLE_R_BASE = 3;    // perforation corner radius

  // Authentic film cream (warmer than pure white — film leader has a
  // slight orange/yellow base tint).
  const FILM_CREAM = '#ebdcb8';
  const FILM_CREAM_DIM = 'rgba(60, 48, 32, 0.55)';   // inner shadow, dark warm

  // ─── Edge print synthesis ─────────────────────────────────────────────

  // Top edge print: "BRAND · ISO·T · DX" — mimics real film-stock labels
  // like "KODAK 5219 VISION3 500T", just abbreviated for our gutter.
  // The "T" suffix is an artistic nod to real stock IDs (T = tungsten);
  // DX is the canister barcode appended at the end as on real cassettes.
  function topEdgePrint(exif) {
    const brandRaw = (exif && exif.make) ? String(exif.make).toUpperCase().trim() : '';
    const brand = brandRaw || 'FILM';
    const isoMatch = (exif && exif.iso) ? String(exif.iso).match(/(\d+)/) : null;
    const iso = isoMatch ? isoMatch[1] : '400';
    return brand + ' · ' + iso + 'T · DX';
  }

  // Bottom frame number: "· 08A ·" — derived from EXIF date day so
  // sequential photos from the same shoot get plausible-looking
  // sequential frame numbers. The 'A' suffix mimics real motion-
  // picture half-frame numbering (24, 24A, 25, 25A …).
  function bottomFrameNumber(exif) {
    if (!exif || !exif.date) return '· 24A ·';
    const m = String(exif.date).match(/(\d{2})$/);
    return m ? '· ' + m[1] + 'A ·' : '· 24A ·';
  }

  // ─── Perforation drawing ──────────────────────────────────────────────

  // Draw a single perforation: cream-filled rounded rect with a 1-px
  // darker bottom-edge inner shadow to suggest depth. The shadow is the
  // visual difference between "rectangle on a dark field" and "rectangle
  // PUNCHED through". Without it the perfs look painted on; with it
  // they read as physical holes.
  function drawPerforation(ctx, x, y, w, h, r, op) {
    R.pathRoundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = FILM_CREAM;
    ctx.fill();
    // Inner bottom-edge shadow — 1.2px stripe inside the rect, darker.
    // Drawn via clip + small filled rect rather than stroke (stroke
    // would render on both sides of the path).
    ctx.save();
    R.pathRoundRect(ctx, x, y, w, h, r);
    ctx.clip();
    ctx.fillStyle = FILM_CREAM_DIM;
    const shadowH = Math.max(1, 1.4 * op);
    ctx.fillRect(x, y + h - shadowH, w, shadowH);
    ctx.restore();
  }

  // ─── Decorate hook ────────────────────────────────────────────────────

  function decorate(ctx, layout, args) {
    const s = layout.scale || 1;
    const op = layout.outputPx || Math.max(0.5, s * 0.6);
    const W = layout.canvas.W;
    const H = layout.canvas.H;
    const fgL = layout.fgLeft, fgT = layout.fgTop, fgW = layout.fgW, fgH = layout.fgH;

    // ── Perforation geometry ──────────────────────────────────────────
    // Density adapts to photo width so all aspect ratios get similar
    // visual rhythm. Bounded at [8, 32] so extreme aspect ratios don't
    // give us 6 sparse perfs (looks cheap) or 60 cramped perfs (loses
    // individual readability).
    const numHoles = Math.max(8, Math.min(32, Math.round((fgW / s) / HOLE_PITCH_BASE)));
    const holeW = Math.round(HOLE_W_BASE * s);
    const holeH = Math.round(HOLE_H_BASE * s);
    const holeR = Math.max(1, Math.round(HOLE_R_BASE * s));

    // Vertical center of each perf row — pulled close to the photo
    // edge so the perfs read as "attached to the frame" rather than
    // floating mid-gutter. 0.30 of the gap leaves the larger 70%
    // outside the perfs free for edge print (top) and caption +
    // frame number (bottom), which solves the portrait-aspect
    // crowding where caption used to bump the bottom perf row.
    const topGap = fgT;
    const botGap = H - (fgT + fgH);
    const topRowCY = Math.round(fgT - topGap * 0.30);
    const botRowCY = Math.round(fgT + fgH + botGap * 0.30);
    const slotW = fgW / numHoles;

    // Top + bottom perforation rows (mirror).
    for (let i = 0; i < numHoles; i++) {
      const cx = fgL + i * slotW + slotW / 2;
      const x = Math.round(cx - holeW / 2);
      drawPerforation(ctx, x, Math.round(topRowCY - holeH / 2), holeW, holeH, holeR, op);
      drawPerforation(ctx, x, Math.round(botRowCY - holeH / 2), holeW, holeH, holeR, op);
    }

    // ── Top edge print (above the top perforation row) ────────────────
    // Real film stocks print continuous edge text along the perf edge
    // — KODAK 5219, FUJI ETERNA — and motion-picture leader has a
    // direction arrow at the opposite end (head→tail marker). We
    // compress that into one line: stock label flush-left, arrow
    // flush-right. Color matches the perforation cream so they read
    // as "same emulsion layer".
    const stamp = topEdgePrint(args && args.normExif);
    const stampPx = Math.max(10, Math.round(13 * s));
    const stampY = Math.max(stampPx + 2, Math.round((topRowCY - holeH / 2) / 2));
    ctx.font = 'bold ' + stampPx + 'px ui-monospace, "SF Mono", "Menlo", monospace';
    ctx.fillStyle = 'rgba(235, 220, 184, 0.78)';   // FILM_CREAM at 78% alpha
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(stamp, fgL, stampY);
    ctx.textAlign = 'right';
    ctx.fillText('→', fgL + fgW, stampY);

    // ── Bottom frame number (in gutter between bottom perf row and
    //    caption zone) ────────────────────────────────────────────────
    // Real motion-picture film prints sequential frame numbers along
    // the perf edge: "23A 24 24A 25". For a still we show one number
    // derived from date. Position is the midpoint of the gutter
    // between the bottom perf row and where the caption strip starts
    // — mirrors the top stamp placement and avoids overlapping the
    // caption (a problem in 4:3 / 16:9 aspects where the bottom strip
    // is short). Bumped to 12px / 0.74 alpha so it stays legible on
    // warm dark at standard quality.
    const frameNum = bottomFrameNumber(args && args.normExif);
    const fnPx = Math.max(10, Math.round(12 * s));
    const perfBot = botRowCY + holeH / 2;
    const captionTop = (layout.caption && layout.caption.placement === 'bottom')
      ? layout.caption.y
      : H;
    const gutterMid = perfBot + (captionTop - perfBot) / 2;
    const fnY = Math.min(H - fnPx / 2 - 2, Math.round(gutterMid));
    ctx.font = fnPx + 'px ui-monospace, "SF Mono", "Menlo", monospace';
    ctx.fillStyle = 'rgba(235, 220, 184, 0.74)';
    ctx.textAlign = 'left';
    ctx.fillText(frameNum, fgL, fnY);

    // ── Photo edge — cream hairline ───────────────────────────────────
    // Hairline matches the perforation cream rather than cold white,
    // keeping all the "physical film" elements in the same warm
    // family. Slightly more visible than v1 (0.08 vs 0.05) because
    // the warm dark body needs a touch more contrast at the photo
    // boundary to read as a sharp imprint edge.
    ctx.strokeStyle = 'rgba(235, 220, 184, 0.10)';
    ctx.lineWidth = Math.max(1, 0.8 * op);
    R.pathRoundRect(ctx, fgL, fgT, fgW, fgH, layout.radius);
    ctx.stroke();
  }

  R.registerFrame('film-35', {
    // Warm dark — slight orange-brown undertone, not pure black. Real
    // processed film bodies have residual base tint; this keeps the
    // cream perforations from feeling like white-on-pure-black.
    bg: { type: 'solid', color: '#100c08' },
    textStyle: 'light',
    layout: { topPaddingBoost: 70, bottomPaddingBoost: 90 },
    shadowDefault: { blur: 0, offsetY: 0, opacity: 0 },
    decorate: decorate
  });
})();
