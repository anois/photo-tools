/* photo-tools — frame style: editorial.
 *
 * Magazine-spread asymmetric layout. A warm paper-cream field carries
 * the photo flush-left at ~65% canvas width; the remaining ~25% strip
 * on the right side becomes a vertical caption zone (the existing
 * computeCaptionZone auto-routes there because rightGap >> MIN_SIDE).
 *
 * Best paired with the `wordmark` or `headline` template — either reads
 * cleanly when rotated -90° to run bottom→top along the strip. Spec /
 * tech-stack templates also work but are dense for the strip width.
 *
 * The asymmetric anchor + paper background is the whole identity here;
 * no decorate hook is needed.
 */
(function () {
  'use strict';
  const root = (typeof self !== 'undefined' ? self : globalThis);
  root.PhotoRender.registerFrame('editorial', {
    bg: { type: 'solid', color: '#f4f0e6' },
    textStyle: 'dark',
    // 350 base-1440 units of right strip (≈ 24% of a 1440-wide canvas).
    // Combined with default 70 base-px padding on left/right, the photo
    // occupies (1440 - 70 - 70 - 350) / 1440 ≈ 66% of canvas width.
    layout: { extraRightInset: 350, captionPrefer: 'right' },
    shadowDefault: { blur: 70, offsetY: 22, opacity: 0.22 }
  });
})();
