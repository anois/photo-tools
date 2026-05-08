/* photo-tools — frame style: editorial-mirror.
 *
 * Mirror of `editorial`: photo flush-right with the wide caption strip
 * on the LEFT side instead of the right. Same paper-cream background,
 * same shadow, same templates work.
 *
 * Why a mirror exists at all: composition. Some photos read with a
 * strong left-to-right visual flow (faces facing right, motion to the
 * right, a path leading right). Captioning on the right of those
 * photos puts the headline on top of the visual exit. Mirroring lets
 * the user pick which side carries the text without re-cropping.
 *
 * The asymmetric anchor + paper background is the whole identity; no
 * decorate hook needed.
 */
(function () {
  'use strict';
  const root = (typeof self !== 'undefined' ? self : globalThis);
  root.PhotoRender.registerFrame('editorial-mirror', {
    bg: { type: 'solid', color: '#f4f0e6' },
    textStyle: 'dark',
    // Mirror of editorial: 350 base-1440 units of LEFT strip; the photo
    // anchors to the right padding, so caption auto-routes left.
    layout: { extraLeftInset: 350, captionPrefer: 'left' },
    shadowDefault: { blur: 70, offsetY: 22, opacity: 0.22 }
  });
})();
