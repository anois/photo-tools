/* photo-tools — frame style: film-mf (medium-format · aged gelatin silver print).
 *
 * Channels the look of a hand-printed darkroom photograph that has spent
 * a few decades in a drawer or on a wall: warm amber fiber-paper that has
 * darkened with age, a partially faded image, scattered foxing spots
 * (brown specks where the paper has oxidized), a soft corner vignette
 * from handling, and a barely-readable pencil notation in the margin.
 * Distinct from film-35 (the negative aesthetic with sprocket holes +
 * edge print) — this is the print AFTER decades, not the source film.
 *
 * Aging effects are baked into the `decorate` hook so they compose with
 * the photo at render time rather than being applied as a static filter
 * pre-bake. That keeps the source bitmap untouched (no destructive
 * edits) and means every render parameter the user dials still composes
 * cleanly on top.
 *
 * Determinism: foxing spots are seeded from photo geometry, so the
 * same photo at the same dimensions always produces the same speck
 * pattern. Without a seed the specks would shimmer on every render —
 * a slider drag would re-spawn the entire foxing field, which is a
 * nightmare UX (and ruins the "this is an artifact frozen in time"
 * illusion).
 */
(function () {
  'use strict';
  const root = (typeof self !== 'undefined' ? self : globalThis);
  const R = root.PhotoRender;

  // Aged fiber-paper. More amber/yellow than fresh cream — represents
  // the natural darkening of unbuffered paper over ~50 years. Picked
  // by feel: lighter than tobacco-stain (#d8c08c) reads as a deliberate
  // tea-tone; darker than fresh fiber (#f5efe2) reads as "actually old".
  const PAPER = '#e8d7ab';
  // Pencil graphite — softer than ink, slightly warmer due to the
  // surrounding amber paper biasing perception.
  const GRAPHITE = 'rgba(55, 42, 26, 0.62)';
  // Deckle / cut edge — a hint of darker tone right at the photo edge
  // suggesting silver oxidation at the emulsion boundary.
  const DECKLE = 'rgba(48, 32, 18, 0.32)';

  // Mulberry32 + geometry-hash, same pattern as torn-paper. Lets every
  // unique photo geometry get a stable foxing pattern across renders.
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

  // Same library-notation algorithm as before — pick a series letter
  // (excluding visually-confusable I/O/Q/U/X) from year+month, and
  // an index 1..31 from day. Stable per EXIF date so consecutive shots
  // get plausibly sequential catalog numbers.
  function libraryNotation(exif) {
    const letters = 'ABCDEFGHJKLMNPRSTVWY';
    if (!exif || !exif.date) return 'E · 14';
    const m = String(exif.date).match(/(\d{4})[-/.](\d{2})[-/.](\d{2})/);
    if (!m) return 'E · 14';
    const year = parseInt(m[1], 10) || 2024;
    const month = parseInt(m[2], 10) || 1;
    const day = parseInt(m[3], 10) || 1;
    const idx = ((year * 12 + month) % letters.length + letters.length) % letters.length;
    return letters.charAt(idx) + ' · ' + day;
  }

  function decorate(ctx, layout, args) {
    const s = layout.scale || 1;
    const op = layout.outputPx || Math.max(0.5, s * 0.6);
    const fgL = layout.fgLeft, fgT = layout.fgTop, fgW = layout.fgW, fgH = layout.fgH;
    const W = layout.canvas.W, H = layout.canvas.H;
    const radius = layout.radius;
    const exif = args && args.normExif;

    // Vintage-aging intensity (0..1). Comes from `cfg.filmMfAge` via
    // `R.resolveRenderParams` → `args.params.filmMf.age`. Frame default
    // is 1.0 (full vintage); user can dial down toward 0 for a near-
    // fresh print without losing the paper/notation/edge identity.
    // The paper bg + deckle hairline + library notation are NOT scaled
    // — those are "this is a print" cues that should persist regardless.
    const age = (args && args.params && args.params.filmMf && typeof args.params.filmMf.age === 'number')
      ? Math.max(0, Math.min(1, args.params.filmMf.age))
      : 1.0;

    // ── Photo aging (clipped to the photo silhouette) ──────────────────
    // Paint the warm tint + uneven fade + corner vignette ONTO the photo
    // pixels using composite-blend modes. Clipping to the rounded-rect
    // photo path keeps the paper margin (and any decorate stamps below)
    // free of the aging tint — only the image gets the patina.
    ctx.save();
    R.pathRoundRect(ctx, fgL, fgT, fgW, fgH, radius);
    ctx.clip();

    // Sepia / yellow shift via multiply — warm amber pulled across all
    // pixels. Lower alpha keeps photo content readable; higher would
    // collapse mid-tones into a muddy brown wash. 0.30 is the sweet
    // spot for "clearly tinted, still legible" at age=1.
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(220, 175, 110, ' + (0.30 * age).toFixed(3) + ')';
    ctx.fillRect(fgL, fgT, fgW, fgH);

    // Partial fade — non-uniform light damage. Real prints fade most
    // where they sat in light over decades; the top corners typically
    // bleach more than the bottom. We approximate with a diagonal
    // linear gradient that lifts (lightens via screen) one upper
    // corner more than the rest. A fixed upper-left corner is the
    // most common archival-photo convention (matches how prints hung
    // on east/south walls fade).
    ctx.globalCompositeOperation = 'screen';
    const fadeGrad = ctx.createLinearGradient(fgL, fgT, fgL + fgW * 0.85, fgT + fgH * 0.6);
    fadeGrad.addColorStop(0,   'rgba(255, 235, 195, ' + (0.40 * age).toFixed(3) + ')');
    fadeGrad.addColorStop(0.5, 'rgba(255, 235, 195, ' + (0.18 * age).toFixed(3) + ')');
    fadeGrad.addColorStop(1,   'rgba(255, 235, 195, 0)');
    ctx.fillStyle = fadeGrad;
    ctx.fillRect(fgL, fgT, fgW, fgH);

    // Corner vignette — darker brown bias near the edges, classic
    // print-from-the-attic feel. Radial gradient from transparent
    // center to a warm sepia at the corners.
    ctx.globalCompositeOperation = 'multiply';
    const cx = fgL + fgW / 2;
    const cy = fgT + fgH / 2;
    const rInner = Math.min(fgW, fgH) * 0.30;
    const rOuter = Math.sqrt(fgW * fgW + fgH * fgH) / 2;   // reaches the corners
    const vig = ctx.createRadialGradient(cx, cy, rInner, cx, cy, rOuter);
    vig.addColorStop(0,   'rgba(110, 80, 50, 0)');
    vig.addColorStop(0.7, 'rgba(110, 80, 50, ' + (0.22 * age).toFixed(3) + ')');
    vig.addColorStop(1,   'rgba(95, 65, 38, '  + (0.48 * age).toFixed(3) + ')');
    ctx.fillStyle = vig;
    ctx.fillRect(fgL, fgT, fgW, fgH);

    ctx.restore();

    // ── Foxing spots — scattered on the paper margin ───────────────────
    // Foxing = the small brown specks that appear on old paper as iron
    // impurities oxidize. They cluster most on the broad paper margins
    // (where airflow and humidity reach), avoiding the photo's emulsion
    // layer. We seed by photo geometry so the same photo keeps the
    // same spot pattern across renders.
    const rng = mulberry32(hashGeom(fgL, fgT, fgW, fgH));
    const cap = layout.caption;
    const numSpots = 18;
    let placed = 0, attempts = 0;
    while (placed < numSpots && attempts < numSpots * 6) {
      attempts++;
      const x = rng() * W;
      const y = rng() * H;
      // Reject if inside the photo (foxing only on paper, not on the
      // image — emulsion protects from foxing).
      if (x > fgL - 8 * s && x < fgL + fgW + 8 * s &&
          y > fgT - 8 * s && y < fgT + fgH + 8 * s) continue;
      // Reject if inside the caption zone — keep caption text crisp.
      if (cap && cap.placement === 'bottom' &&
          x > cap.x - 6 * s && x < cap.x + cap.width + 6 * s &&
          y > cap.y - 6 * s && y < cap.y + cap.height + 6 * s) continue;
      placed++;

      const baseR = (3 + rng() * 7) * s;        // 3..10 base-px
      const aspectR = baseR * (0.55 + rng() * 0.6);   // not always round
      const rot = rng() * Math.PI * 2;
      const alpha = (0.10 + rng() * 0.16) * age;
      // Pick a brown hue in the 20°-40° HSL range — warm sepia browns.
      const hue = 24 + rng() * 14;
      const lum = 28 + rng() * 10;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, baseR);
      grad.addColorStop(0,    'hsla(' + hue + ', 55%, ' + lum + '%, ' + alpha.toFixed(3) + ')');
      grad.addColorStop(0.55, 'hsla(' + hue + ', 50%, ' + (lum + 8) + '%, ' + (alpha * 0.45).toFixed(3) + ')');
      grad.addColorStop(1,    'hsla(' + hue + ', 50%, ' + (lum + 8) + '%, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      // ellipse() lets us draw irregular non-round spots — more
      // organic than a circle. Workers + main thread both support it
      // (since Chrome 60 / Safari 14 / Firefox 67).
      ctx.ellipse(x, y, baseR, aspectR, rot, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Photo edge — deckle hairline ───────────────────────────────────
    // Single fine line right at the emulsion boundary. Reads as the
    // cut/oxidation transition between image and paper.
    ctx.strokeStyle = DECKLE;
    ctx.lineWidth = Math.max(1, 0.9 * op);
    R.pathRoundRect(ctx, fgL, fgT, fgW, fgH, radius);
    ctx.stroke();

    // ── Library notation — pencil-script in the print margin ───────────
    const labelText = libraryNotation(exif);
    const labelPx = Math.max(11, Math.round(13 * s));
    const captionTop = (cap && cap.placement === 'bottom') ? cap.y : H;
    const labelY = Math.min(
      captionTop - Math.round(labelPx * 0.7),
      Math.round(fgT + fgH + (captionTop - (fgT + fgH)) / 2)
    );
    ctx.font = 'italic ' + labelPx + 'px "Times New Roman", "Georgia", serif';
    ctx.fillStyle = GRAPHITE;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'right';
    ctx.fillText(labelText, fgL + fgW, labelY);
  }

  R.registerFrame('film-mf', {
    bg: { type: 'solid', color: PAPER },
    textStyle: 'dark',
    // Generous fiber-print margin — vintage gallery prints float the
    // image in a wide white (well, amber-cream) border. Slightly more
    // top than the previous fresh-paper version because aged prints
    // sit in deeper mats.
    layout: { topPaddingBoost: 100, bottomPaddingBoost: 120 },
    // Subtle soft drop — old prints under non-reflective glass have a
    // gentle floating shadow, not a heavy modern pop.
    shadowDefault: { blur: 40, offsetY: 12, opacity: 0.16 },
    // Vintage-aging defaults. cfg.filmMfAge (when present) overrides
    // via R.resolveRenderParams. 1.0 = full vintage (current default);
    // 0 = clean print (paper + deckle + library notation only).
    filmMf: { age: 1.0 },
    decorate: decorate
  });
})();
