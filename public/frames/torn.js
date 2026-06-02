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
 * Determinism: the torn pattern is seeded from cell geometry (x,y,w,h),
 * so the same photo at the same dimensions always produces the same
 * silhouette. Without a stable seed the edge would shimmer on every
 * render — a slider drag would visibly re-tear the paper, which is a
 * nightmare UX.
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

  // Mulberry32 — small, high-quality, deterministic 32-bit PRNG.
  // We need determinism (same seed → same sequence) so the torn edge
  // doesn't shimmer between renders. Math.random() would be a disaster
  // here — every slider tweak would re-tear the paper differently.
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

  // Three classic large primes — the geometry hash is the same kind
  // used in spatial-hashing schemes. Different cells in a collage get
  // different seeds because their (x, y) origins differ; same cell at
  // same dims always gets the same seed across renders.
  function hashGeom(x, y, w, h) {
    return (
      ((x | 0) * 73856093) ^
      ((y | 0) * 19349663) ^
      ((w | 0) * 83492791) ^
      ((h | 0) * 2654435761)
    ) >>> 0;
  }

  function tornClip(ctx, x, y, w, h, layout, args) {
    const s = layout.scale || 1;
    // Defaults match the original hardcoded values; cfg overrides arrive
    // via R.resolveRenderParams' `params.torn` block. Floored so that
    // very-low-quality previews don't degenerate (step → 1 sample / side)
    // and so jitter=0 reads as "clean cut" rather than NaN/-px.
    const t = (args && args.params && args.params.torn)
      ? args.params.torn
      : { jitter: 6, step: 7 };
    // Sample point spacing along the edge, in canvas px. ~7 base-px reads
    // as fibrous-not-noisy at 1× preview. Larger steps give chunkier,
    // more irregular tears (think old paperback dog-eared corners);
    // smaller is finer.
    const step = Math.max(2, t.step * s);
    // Inward jitter amplitude — how deep the tear can bite into the
    // photo. 0 = scissors-cut clean; ~6 base-px reads as "torn paper";
    // very large (>12) reads as chewed. Math.max with 0 (not 1) so the
    // user can dial it to a perfectly straight edge if they want.
    const jitter = Math.max(0, t.jitter * s);

    const rng = mulberry32(hashGeom(x, y, w, h));
    const j = () => rng() * jitter;

    // Walk the rectangle clockwise: top L→R, right T→B, bottom R→L,
    // left B→T. Each sample point displaces inward by [0, jitter].
    // The four corners use single-jitter samples (not corner-of-two-
    // edges) — keeps the corners from looking suspiciously sharp.
    ctx.beginPath();

    // Top edge L → R
    ctx.moveTo(x, y + j());
    for (let px = x + step; px < x + w; px += step) {
      ctx.lineTo(px, y + j());
    }
    ctx.lineTo(x + w, y + j());

    // Right edge T → B
    for (let py = y + step; py < y + h; py += step) {
      ctx.lineTo(x + w - j(), py);
    }
    ctx.lineTo(x + w - j(), y + h);

    // Bottom edge R → L
    for (let px = x + w - step; px > x; px -= step) {
      ctx.lineTo(px, y + h - j());
    }
    ctx.lineTo(x, y + h - j());

    // Left edge B → T
    for (let py = y + h - step; py > y; py -= step) {
      ctx.lineTo(x + j(), py);
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
