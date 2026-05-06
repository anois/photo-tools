/* photo-tools — frame style: polaroid.
 *
 * Solid #fafafa with a deep bottom margin (extraBottom 180, fgYBoost -80)
 * to evoke the classic polaroid signature strip. Photo corners get a
 * smaller radius (8) to read like a real instant print rather than a
 * software-rounded thumbnail. No drop shadow — polaroid prints sit flat
 * on the page; their visual weight comes from the heavy white border.
 */
(function () {
  'use strict';
  const root = (typeof self !== 'undefined' ? self : globalThis);
  root.PhotoRender.registerFrame('polaroid', {
    bg: { type: 'solid', color: '#fafafa' },
    textStyle: 'dark',
    layout: { extraBottom: 180, fgYBoost: -80, radiusOverride: 8 },
    shadowDefault: { blur: 0, offsetY: 0, opacity: 0 }
  });
})();
