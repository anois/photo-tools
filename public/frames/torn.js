/* photo-tools — frame style: torn (torn-paper edge).
 *
 * Photo clipped to a procedurally-generated jagged "torn page" outline
 * instead of the default rounded rectangle. Sits on a warm cream paper
 * background, casts a soft offset shadow whose silhouette tracks the
 * torn edge — giving the visual of "a snapshot ripped out of an old
 * album and glued onto a fresh page".
 *
 * Joins the instant family ("复古 / 温度感 / 私密") as a third variant.
 * Polaroid + Instax both lean printed/manufactured; torn paper leans
 * hand-made / scrapbook / diary. Together the three cover the
 * "vintage personal" range.
 *
 * Determinism: sampling runs in BASE-1440 space (canvas px ÷ layout.scale)
 * and the seed derives from the cell's scale-free identity (its position
 * as a fraction of the canvas + the jitter knob) — NOT from pixel dims.
 * Two consequences, both deliberate (1.16.1):
 *   · the silhouette is identical at any render scale, so the 0.2×
 *     lights-down drag frames, the 0.5× preview and the full-res export
 *     all show the same tear;
 *   · resizing the cell (padding drag) deforms the existing tear smoothly
 *     instead of re-tearing every frame — the rng sequence per vertex
 *     stays fixed while the sampling grid stretches.
 *
 * Renderer integration: relies on the optional `frame.clipPath` hook
 * shipped alongside this frame. compose() (main thread + worker) routes
 * the same path through shadow casting, photo clip, and signature clip,
 * so all three layers stay torn-coherent.
 */
(function () {
  'use strict';
  const root = (typeof self !== 'undefined' ? self : globalThis);
  const R = root.PhotoRender;

  // Stateless indexed hash → [0,1). Same mixing core as mulberry32 but
  // addressed by (seed, edge, vertex-index) instead of consumed as a
  // stream — determinism without order-sensitivity.
  function h01(seed, a, b) {
    let t = (seed ^ Math.imul(a, 0x9E3779B1) ^ Math.imul(b + 1, 0x85EBCA6B)) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Scale-free cell identity → seed. Position enters as a fraction of the
  // canvas (×32 buckets) so collage cells get distinct seeds while the
  // value is identical at any render scale (canvas-px inputs would make
  // the 0.2× drag frames tear differently from the 0.5× rest frames —
  // the exact bug this replaced). Pixel dims deliberately stay OUT of the
  // seed: resizing deforms the tear instead of re-rolling it.
  function seedFor(x, y, layout, t) {
    const cw = Math.max(1, (layout.canvas && layout.canvas.W) || 1);
    const ch = Math.max(1, (layout.canvas && layout.canvas.H) || 1);
    const relX = Math.round((x / cw) * 32);
    const relY = Math.round((y / ch) * 32);
    return (
      (relX * 73856093) ^
      (relY * 19349663) ^
      ((Math.round(t.jitter * 2) + 1) * 83492791)
    ) >>> 0;
  }

  function tornClip(ctx, x, y, w, h, layout, args) {
    const s = layout.scale || 1;
    // Defaults match the original hardcoded values; cfg overrides arrive
    // via R.resolveRenderParams' `params.torn` block.
    const t = (args && args.params && args.params.torn)
      ? args.params.torn
      : { jitter: 6, step: 7 };
    // All sampling math runs in base-1440 units; only the emitted path
    // coordinates multiply by `s`. Sample spacing ~7 base-px reads as
    // fibrous-not-noisy; larger steps give chunkier tears. Jitter is the
    // inward bite depth: 0 = scissors-clean, ~6 = torn paper, >12 = chewed.
    const stepB = Math.max(1.5, t.step);
    const jitterB = Math.max(0, t.jitter);
    const xb = x / s, yb = y / s, wb = w / s, hb = h / s;

    // Jitter is hashed PER VERTEX INDEX, not drawn from a sequential rng:
    // canvas-px rounding can add/drop one vertex near a corner between
    // render scales, and a sequential stream would shift every subsequent
    // draw — re-rolling the whole edge. Indexed hashing confines any
    // count difference to that single corner-adjacent vertex.
    const seed = seedFor(x, y, layout, t);
    const j = (edge, i) => h01(seed, edge, i) * jitterB;
    const P = (bx, by) => ctx.lineTo(bx * s, by * s);

    // Walk the rectangle clockwise: top L→R, right T→B, bottom R→L,
    // left B→T. Each sample point displaces inward by [0, jitter].
    // The four corners use single-jitter samples (not corner-of-two-
    // edges) — keeps the corners from looking suspiciously sharp.
    ctx.beginPath();

    // Top edge L → R
    ctx.moveTo(xb * s, (yb + j(1, 0)) * s);
    let i = 1;
    for (let px = xb + stepB; px < xb + wb; px += stepB, i++) {
      P(px, yb + j(1, i));
    }
    P(xb + wb, yb + j(1, 9999));

    // Right edge T → B
    i = 1;
    for (let py = yb + stepB; py < yb + hb; py += stepB, i++) {
      P(xb + wb - j(2, i), py);
    }
    P(xb + wb - j(2, 9999), yb + hb);

    // Bottom edge R → L
    i = 1;
    for (let px = xb + wb - stepB; px > xb; px -= stepB, i++) {
      P(px, yb + hb - j(3, i));
    }
    P(xb, yb + hb - j(3, 9999));

    // Left edge B → T
    i = 1;
    for (let py = yb + hb - stepB; py > yb; py -= stepB, i++) {
      P(xb + j(4, i), py);
    }

    ctx.closePath();
  }

  // Trace the torn edge with a faint dark hairline — gives the cut a
  // hint of physical depth (you're looking at the torn fiber from
  // slightly above, where the inner edge catches a bit of shadow).
  // Without this the photo can read as "perfectly clipped polygon",
  // not "ripped out of paper".
  function decorate(ctx, layout, args) {
    const op = layout.outputPx || Math.max(0.5, (layout.scale || 1) * 0.6);
    const t = (args && args.params && args.params.torn)
      ? args.params.torn
      : { edgeOpacity: 0.22 };
    // Skip the hairline entirely when opacity is dialed to 0 — saves a
    // pointless stroke pass and gives users a clean exit (no faint line
    // at all when they want a soft-clip-only look).
    if (t.edgeOpacity <= 0) return;
    ctx.save();
    // Forward `args` so the inner tornClip reads the same jitter/step the
    // photo clip + shadow path used. Without this, decorate would re-tear
    // with a different geometry and the dark hairline would float free
    // of the actual silhouette.
    tornClip(ctx, layout.fgLeft, layout.fgTop, layout.fgW, layout.fgH, layout, args);
    ctx.strokeStyle = 'rgba(45, 30, 15, ' + t.edgeOpacity.toFixed(3) + ')';
    ctx.lineWidth = Math.max(1, 1.0 * op);
    ctx.stroke();
    ctx.restore();
  }

  R.registerFrame('torn', {
    // Warm cream paper — slightly more yellow than gallery-white's
    // #f4f3ee. Reads as "old album page" rather than "modern gallery
    // wall". Matches the family description (复古 / 温度感 / 私密).
    bg: { type: 'solid', color: '#f4ecd6' },
    textStyle: 'dark',
    layout: {},
    // Modest soft-offset shadow — enough that the torn snippet
    // appears glued onto the page slightly raised, not cut into it.
    // Heavy shadow would fight the "casual scrapbook" vibe; zero
    // shadow flattens the torn into being merely a clipping mask.
    shadowDefault: { blur: 50, offsetY: 16, opacity: 0.20 },
    // Torn-paper procedural defaults. cfg.tornJitter / tornStep /
    // tornEdgeOpacity (when present) win over these via R.resolveRenderParams,
    // exposing the same DIY-knob pattern frosted's bgBlur/Brightness/
    // Saturation use. Surfaced in the workshop's ◉ Instrument tool · torn card.
    torn: { jitter: 6, step: 7, edgeOpacity: 0.22 },
    // ─── 1.7.x harness · cfg schema (3 knobs) ─────────────────────────
    cfg: {
      tornJitter:      { kind: 'slider', min: 0, max: 14,  step: 0.5,  default: null, frameDefault: 6    },
      tornStep:        { kind: 'slider', min: 3, max: 14,  step: 0.5,  default: null, frameDefault: 7    },
      tornEdgeOpacity: { kind: 'slider', min: 0, max: 0.5, step: 0.02, default: null, frameDefault: 0.22 }
    },
    clipPath: tornClip,
    decorate: decorate
  });
})();
