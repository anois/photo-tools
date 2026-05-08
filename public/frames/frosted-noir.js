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
    shadowDefault: { blur: 90, offsetY: 28, opacity: 0.45 }
  };
  root.PhotoRender.registerFrame('frosted-noir', def);
  root.PhotoRender.registerFrame('frosted-dark', def);
})();
