/* photo-tools — frame style: instax (instax-mini).
 *
 * Cream-tinted (#fffdf6) paper bg with a deep bottom margin (extraBottom
 * 240, fgYBoost -120 — twice polaroid's bottom-strip depth). Tiny 4-px
 * corner radius — instax prints have only a whisper of rounding. Subtle
 * drop shadow (blur 30, offset 12, opacity 0.18) so the print appears to
 * float a hair off the page, distinct from polaroid which sits flat.
 *
 * 1.6.0+ — 4 user-controllable knobs:
 *   slab    — bottom strip depth in base-1440 px (60–360, default 240).
 *             Override flows into layoutOpts.extraBottom in
 *             clientRender.js / worker.js before computeLayout.
 *   tint    — bg paper color enum 'pure' | 'cream' | 'aged'. Applied at
 *             resolveRenderParams time via bg.color override.
 *   stamp   — toggle date stamp on slab (bottom-right, mono cream-cream).
 *   rainbow — toggle rainbow-stripe signature on slab (bottom-left, 4
 *             color block from real instax packaging).
 *
 * The decorate hook is new at 1.6.0 (instax previously had no decorate).
 * Stamp + rainbow are pure additive painting on top of the bg/photo;
 * they don't move layout — only the slab knob does that.
 */
(function () {
  'use strict';
  const root = (typeof self !== 'undefined' ? self : globalThis);
  const R = root.PhotoRender;

  // Paper tint palette — three plausible instax film stocks. 'pure' is
  // the bright white commonly seen on instax mini Evo / SQ20 prints;
  // 'cream' is the warmer cool-store stock; 'aged' mimics an old print
  // sitting in a shoebox for a decade, gently yellowed.
  const TINT_COLORS = {
    pure:  '#fffdf6',
    cream: '#f5ecd6',
    aged:  '#eddcb8'
  };

  // Rainbow stripe — sampled from real fujifilm instax packaging. The
  // 4-color block is small (44px wide × 11px tall, scaled) and lives in
  // the bottom-left of the slab. Same proportions as the design proposal
  // rev.2 (instax instrument card).
  const RAINBOW_COLORS = ['#ff6b35', '#ffc857', '#7fbf6e', '#4595d0'];

  function drawDateStamp(ctx, layout, exif) {
    // Format: YY·MM·DD with bullet separators (mimics the actual instax
    // mini Evo printing format). Fallback to a plausible date when EXIF
    // is missing — never blank because the toggle promised something
    // would print.
    let txt = "'26·05·29";
    if (exif && exif.date) {
      const m = String(exif.date).match(/(\d{2,4})[-/.: ](\d{1,2})[-/.: ](\d{1,2})/);
      if (m) {
        const y = m[1].length === 4 ? m[1].slice(2) : m[1];
        const mo = String(m[2]).padStart(2, '0');
        const d = String(m[3]).padStart(2, '0');
        txt = "'" + y + '·' + mo + '·' + d;
      }
    }
    const s = layout.scale || 1;
    const fontPx = Math.max(10, Math.round(14 * s));
    ctx.save();
    ctx.font = '500 ' + fontPx + 'px ui-monospace, "SF Mono", "Menlo", monospace';
    ctx.fillStyle = 'rgba(80, 60, 20, 0.55)';   // warm desaturated brown, low alpha
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    const slabBottom = layout.canvas.H;
    const fgBottom = layout.fgTop + layout.fgH;
    const slabMidY = fgBottom + (slabBottom - fgBottom) / 2;
    const padR = Math.round(28 * s);
    ctx.fillText(txt, layout.fgLeft + layout.fgW - padR, Math.round(slabMidY));
    ctx.restore();
  }

  function drawRainbowStripe(ctx, layout) {
    const s = layout.scale || 1;
    const stripeW = Math.round(11 * s);   // width of EACH color band
    const stripeH = Math.round(12 * s);
    const padL = Math.round(28 * s);
    const fgBottom = layout.fgTop + layout.fgH;
    const slabBottom = layout.canvas.H;
    const slabMidY = fgBottom + (slabBottom - fgBottom) / 2;
    const y = Math.round(slabMidY - stripeH / 2);
    ctx.save();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = RAINBOW_COLORS[i];
      ctx.fillRect(layout.fgLeft + padL + i * stripeW, y, stripeW, stripeH);
    }
    // Subtle inner darkening on the bottom edge — print artifact look.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.fillRect(layout.fgLeft + padL, y + stripeH - Math.max(1, s), stripeW * 4, Math.max(1, s));
    ctx.restore();
  }

  function decorate(ctx, layout, args) {
    const p = (args && args.params && args.params.instax) || null;
    if (!p) return;   // legacy callers — no cfg-driven extras
    if (p.dateStamp) drawDateStamp(ctx, layout, args && args.normExif);
    if (p.rainbow)   drawRainbowStripe(ctx, layout);
  }

  R.registerFrame('instax', {
    bg: { type: 'solid', color: TINT_COLORS.pure },
    textStyle: 'dark',
    layout: { extraBottom: 240, fgYBoost: -120, radiusOverride: 4 },
    // Compose-mode soft minimum — instant-print bottom slab is the
    // signature visual element of this frame. Below ~100 the caption
    // strip cramps into the photo bottom edge.
    minPadding: { bottom: 100 },
    shadowDefault: { blur: 30, offsetY: 12, opacity: 0.18 },
    // Frame default values for the 1.6.0+ user-controllable knobs.
    // resolveRenderParams reads these when cfg.instax* fields are null.
    // tintColors is the lookup table consumed by resolveRenderParams
    // when applying a tint enum to bg.color (cfg.instaxTint).
    instax: {
      slab: 240,
      tint: 'pure',
      dateStamp: false,
      rainbow: false,
      tintColors: TINT_COLORS
    },
    // ─── 1.7.x harness · cfg schema (4 knobs) ─────────────────────────
    cfg: {
      instaxSlab:    { kind: 'slider',   min: 60, max: 360, step: 4,   default: null, frameDefault: 240    },
      instaxTint:    { kind: 'swatches', options: ['pure', 'cream', 'aged'],          default: null, frameDefault: 'pure' },
      instaxStamp:   { kind: 'toggle',                                                default: null, frameDefault: false  },
      instaxRainbow: { kind: 'toggle',                                                default: null, frameDefault: false  }
    },
    decorate: decorate
  });
})();
