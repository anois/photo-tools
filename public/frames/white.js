/* photo-tools — frame style: white.
 *
 * Solid off-white (#f5f5f5) bg + dark caption text. The clean editorial
 * look — no self-blur, no gradient, just a paper-like field around the
 * photo. Pairs well with brand-logo and tech-stack templates.
 */
(function () {
  'use strict';
  const root = (typeof self !== 'undefined' ? self : globalThis);
  root.PhotoRender.registerFrame('white', {
    bg: { type: 'solid', color: '#f5f5f5' },
    textStyle: 'dark',
    layout: {},
    shadowDefault: { blur: 80, offsetY: 24, opacity: 0.30 }
  });
})();
