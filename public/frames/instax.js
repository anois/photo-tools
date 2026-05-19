/* photo-tools — frame style: instax (instax-mini).
 *
 * Cream-tinted (#fffdf6) paper bg with a deep bottom margin (extraBottom
 * 240, fgYBoost -120 — twice polaroid's bottom-strip depth). Tiny 4-px
 * corner radius — instax prints have only a whisper of rounding. Subtle
 * drop shadow (blur 30, offset 12, opacity 0.18) so the print appears to
 * float a hair off the page, distinct from polaroid which sits flat.
 */
(function () {
  'use strict';
  const root = (typeof self !== 'undefined' ? self : globalThis);
  root.PhotoRender.registerFrame('instax', {
    bg: { type: 'solid', color: '#fffdf6' },
    textStyle: 'dark',
    layout: { extraBottom: 240, fgYBoost: -120, radiusOverride: 4 },
    // Compose-mode soft minimum — instant-print bottom slab is the
    // signature visual element of this frame. Below ~100 the caption
    // strip cramps into the photo bottom edge.
    minPadding: { bottom: 100 },
    shadowDefault: { blur: 30, offsetY: 12, opacity: 0.18 }
  });
})();
