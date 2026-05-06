/* photo-tools — frame style: black.
 *
 * Solid near-black (#121212) bg + light caption text. Theater-poster
 * vibe; the deeper shadow opacity (0.50) lets the foreground photo float
 * a touch more visibly off the dark field than other frames need.
 */
(function () {
  'use strict';
  const root = (typeof self !== 'undefined' ? self : globalThis);
  root.PhotoRender.registerFrame('black', {
    bg: { type: 'solid', color: '#121212' },
    textStyle: 'light',
    layout: {},
    shadowDefault: { blur: 80, offsetY: 24, opacity: 0.50 }
  });
})();
