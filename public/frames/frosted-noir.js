/* photo-tools — frame style: frosted-noir.
 *
 * Same self-blur architecture as 'frosted' but with deeper darken + lower
 * brightness, so the background tints toward a moody twilight rather than
 * a bright wash. Stronger blur to compensate for the higher-contrast
 * darken pass.
 *
 * Renamed from 'frosted-dark' (the old key is kept as an alias so existing
 * presets / share codes / per-photo cfgs still resolve).
 */
(function () {
  'use strict';
  const root = (typeof self !== 'undefined' ? self : globalThis);
  const def = {
    bg: {
      type: 'frosted',
      darken: 0.22,
      saturation: 1.0,
      brightness: 0.78,
      blurSigma: 70,
      grainOpacity: 0.14
    },
    textStyle: 'light',
    layout: {},
    shadowDefault: { blur: 90, offsetY: 28, opacity: 0.45 },
    // ─── 1.7.x harness · cfg schema ──────────────────────────────────
    // Declares the 5 user-facing bg knobs. R.collectFrameCfgDefaults()
    // walks every frame's `cfg` block at app boot to build defaultCfg()
    // and LOOK_KEYS, replacing the hand-coded 25-key list in app.js.
    // frameDefault here duplicates `bg.*` above (legacy resolveRenderParams
    // still reads from frame.bg.*); both will consolidate in a follow-up.
    cfg: {
      bgBlur:       { kind: 'slider', min: 0,   max: 120, step: 2,    default: null, frameDefault: 70   },
      bgBrightness: { kind: 'slider', min: 0.5, max: 1.2, step: 0.02, default: null, frameDefault: 0.78 },
      bgSaturation: { kind: 'slider', min: 0.5, max: 1.6, step: 0.02, default: null, frameDefault: 1.0  },
      bgDarken:     { kind: 'slider', min: 0,   max: 0.7, step: 0.02, default: null, frameDefault: 0.22 },
      bgGrain:      { kind: 'slider', min: 0,   max: 0.5, step: 0.01, default: null, frameDefault: 0.14 }
    }
  };
  root.PhotoRender.registerFrame('frosted-noir', def);
  root.PhotoRender.registerFrame('frosted-dark', def);
})();
