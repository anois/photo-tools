/* photo-tools — frame style: halftone.
 *
 * Two-ink halftone screen print (risograph / silkscreen aesthetic).
 * Reproduces the classic Photoshop recipe — grayscale → bitmap mode with
 * a halftone screen (frequency / angle / dot shape) → nearest-neighbor
 * resample → gradient map — as one ImageData pass over the composed
 * foreground:
 *
 *   1. downscale the fg region to a working buffer (px = chunk size),
 *   2. per pixel: Rec.709 luma → tone gamma → rotated-grid spot-function
 *      threshold → binary ink/paper decision,
 *   3. blit back with imageSmoothingEnabled=false (the "邻近/硬边缘"
 *      resample that gives the chunky print grain).
 *
 * This is the first frame to use the `fx` hook — a pixel-effect pass that
 * compose() runs AFTER the foreground photo/collage cells are drawn and
 * BEFORE caption / top badge / decorate / seal, so text and stamps stay
 * crisp solid ink over the screened photo (matching how real print
 * overlays type on a halftoned plate).
 *
 * The frame is caption-less by design (`noCaption: true`): the subject IS
 * the screened image. Paper color doubles as the frame bg (same takeover
 * pattern as instax tintColors), so photo highlights that drop out to
 * bare paper merge seamlessly into the margin.
 *
 * Screen geometry is defined in base-1440 units (cell pitch + chunk size
 * both scale with layout.scale), which makes the working buffer size
 * independent of render scale — preview and export compute the same
 * screen, only the nearest-upscale factor differs.
 */
(function () {
  'use strict';
  const root = (typeof self !== 'undefined' ? self : globalThis);
  const R = root.PhotoRender;

  const INK_DEFAULT = '#2b56a5';    // deep federal blue (riso vernacular)
  const PAPER_DEFAULT = '#f2ead6';  // warm cream stock

  function hexRgb(hex) {
    const s = String(hex || '').replace(/^#/, '');
    return [
      parseInt(s.slice(0, 2), 16) || 0,
      parseInt(s.slice(2, 4), 16) || 0,
      parseInt(s.slice(4, 6), 16) || 0
    ];
  }

  // Spot functions — the threshold field of each PS screen shape, over
  // cell-local coords fu/fv ∈ [-0.5, 0.5). A pixel inks when its (gamma-
  // adjusted) luma sits below the local threshold, so darker areas grow
  // the shape from its skeleton (axes / center / diagonal) outward. All
  // shapes reach ~0 at the cell corners: even pure black keeps a paper
  // speck per corner — the "breathing" texture of real riso shadows.
  function spot(fu, fv, shape) {
    switch (shape) {
      case 'round':   return 1 - Math.hypot(fu, fv) * 1.4142;
      case 'line':    return 1 - Math.abs(fv) * 2;
      case 'diamond': return 1 - (Math.abs(fu) + Math.abs(fv));
      default:        return 1 - Math.min(Math.abs(fu), Math.abs(fv)) * 2; // cross
    }
  }

  // fx hook — runs in BOTH main thread (clientRender.js) and worker
  // (worker.js). No DOM assumptions: OffscreenCanvas preferred, with a
  // document.createElement fallback for old main-thread Safari (workers
  // that exist at all always have OffscreenCanvas).
  function fxHalftone(ctx, layout, args) {
    const p = args && args.params && args.params.halftone;
    if (!p) return;
    const rx = Math.round(layout.fgLeft), ry = Math.round(layout.fgTop);
    const rw = Math.round(layout.fgW), rh = Math.round(layout.fgH);
    if (rw < 8 || rh < 8) return;

    // Chunk = the on-canvas pixel size of one working-buffer pixel.
    // p.px is in base-1440 units; scale it like everything else. Floor at
    // 1 so low preview scales never upsample into the "downscale" pass.
    const chunk = Math.max(1, p.px * layout.scale);
    const workW = Math.max(8, Math.round(rw / chunk));
    const workH = Math.max(8, Math.round(rh / chunk));

    let work;
    if (typeof OffscreenCanvas !== 'undefined') {
      work = new OffscreenCanvas(workW, workH);
    } else if (typeof document !== 'undefined') {
      work = document.createElement('canvas');
      work.width = workW; work.height = workH;
    } else {
      return;
    }
    const wctx = work.getContext('2d', { willReadFrequently: true });
    if (!wctx) return;
    // Downscale-read the composed fg region (photo or collage cells —
    // gutters are paper-colored bg and screen back to near-paper).
    wctx.drawImage(ctx.canvas, rx, ry, rw, rh, 0, 0, workW, workH);

    const img = wctx.getImageData(0, 0, workW, workH);
    const d = img.data;
    // Cell pitch in working-buffer pixels. Guard ≥ 1.5 so extreme
    // cell/px combos can't degenerate into per-pixel noise.
    const cell = Math.max(1.5, (p.cell * layout.scale) / chunk);
    const rad = (p.angle || 0) * Math.PI / 180;
    const cs = Math.cos(rad), sn = Math.sin(rad);
    const gamma = Math.pow(2, -(p.tone || 0));
    const ic = hexRgb(p.ink), pc = hexRgb(p.paper);
    let i = 0;
    for (let y = 0; y < workH; y++) {
      for (let x = 0; x < workW; x++, i += 4) {
        let l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
        if (gamma !== 1) l = Math.pow(l, gamma);
        const u = (x * cs + y * sn) / cell;
        const v = (-x * sn + y * cs) / cell;
        const fu = u - Math.floor(u) - 0.5;
        const fv = v - Math.floor(v) - 0.5;
        const on = l < spot(fu, fv, p.shape);
        d[i]     = on ? ic[0] : pc[0];
        d[i + 1] = on ? ic[1] : pc[1];
        d[i + 2] = on ? ic[2] : pc[2];
        d[i + 3] = 255;
      }
    }
    wctx.putImageData(img, 0, 0);

    ctx.save();
    ctx.imageSmoothingEnabled = false;   // PS「邻近（硬边缘）」resample
    ctx.drawImage(work, 0, 0, workW, workH, rx, ry, rw, rh);
    ctx.restore();
  }

  R.registerFrame('halftone', {
    // Solid paper bg — the actual color is taken over per-render by
    // params.halftone.paper in resolveRenderParams (instax-tint pattern),
    // so the htPaper knob recolors photo highlights AND margin together.
    bg: { type: 'solid', color: PAPER_DEFAULT },
    textStyle: 'dark',
    // Print is flat: square corners, no drop shadow.
    layout: { radiusOverride: 0 },
    shadowDefault: { blur: 0, offsetY: 0, opacity: 0 },
    // No EXIF caption on this frame — the screened image is the whole
    // subject (per the 1.12.0 design ruling: the reference poster's text
    // was noise, not the goal). buildLayoutAndCaption skips the caption
    // SVG entirely; template / caption knobs are inert while active.
    noCaption: true,
    halftone: {
      ink: INK_DEFAULT, paper: PAPER_DEFAULT,
      cell: 8, px: 2, angle: 45, shape: 'cross', tone: 0
    },
    // ─── harness · cfg schema (7 knobs) ─────────────────────────────────
    // kind 'color' is new with this frame: swatch row + free <input
    // type="color"> picker; cfg stores a '#rrggbb' string, null = frame
    // default (same null semantics as sliders).
    cfg: {
      htInk:   { kind: 'color', swatches: ['#2b56a5', '#0078bf', '#dd4a33', '#00a95c', '#7a4a24', '#221f1c'], default: null, frameDefault: INK_DEFAULT },
      htPaper: { kind: 'color', swatches: ['#f8f4e8', '#f2ead6', '#e6d7b8'], default: null, frameDefault: PAPER_DEFAULT },
      htCell:  { kind: 'slider', min: 4, max: 24, step: 1, default: null, frameDefault: 8 },
      htPx:    { kind: 'slider', min: 1, max: 6, step: 1, default: null, frameDefault: 2 },
      htAngle: { kind: 'slider', min: 0, max: 90, step: 1, default: null, frameDefault: 45 },
      htShape: { kind: 'stepper', options: ['cross', 'round', 'line', 'diamond'], default: null, frameDefault: 'cross' },
      htTone:  { kind: 'slider', min: -1, max: 1, step: 0.05, default: null, frameDefault: 0 }
    },
    fx: fxHalftone
  });
})();
