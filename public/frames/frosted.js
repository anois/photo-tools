/* photo-tools — frame style: frosted (default).
 *
 * Self-blur background — the photo itself, scaled to cover the canvas,
 * then blurred + slightly desaturated and darkened so caption text reads
 * cleanly over it. The "magazine cover" look.
 *
 * Loaded as a plain <script> after shared/render.js (in both index.html
 * and the worker). Self-registers into PhotoRender.FRAMES.
 */
(function () {
  'use strict';
  const root = (typeof self !== 'undefined' ? self : globalThis);
  root.PhotoRender.registerFrame('frosted', {
    bg: {
      type: 'frosted',
      darken: 0.06,
      saturation: 1.05,
      brightness: 0.92,
      blurSigma: 60,
      grainOpacity: 0.12
    },
    textStyle: 'light',
    layout: {},
    shadowDefault: { blur: 80, offsetY: 24, opacity: 0.35 }
  });
})();
