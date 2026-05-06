/* photo-tools — frame style: frosted-dark.
 *
 * Same self-blur architecture as 'frosted' but with deeper darken + lower
 * brightness, so the background tints toward a moody twilight rather than
 * a bright wash. Stronger blur to compensate for the higher-contrast
 * darken pass.
 */
(function () {
  'use strict';
  const root = (typeof self !== 'undefined' ? self : globalThis);
  root.PhotoRender.registerFrame('frosted-dark', {
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
  });
})();
