/* photo-tools — frame style: gallery-noir.
 *
 * Black-room exhibition look — a deep neutral (#171717, slightly warmer
 * than pure black) with a single thin phosphor-highlight ring tracing
 * the foreground photo's outer edge. The line reads as a low-key
 * reflection rather than a structural border; combined with the heavier
 * shadow, the photo appears to float a hair off the wall.
 *
 * Replaces the old 'black' frame; the old key is aliased.
 */
(function () {
  'use strict';
  const root = (typeof self !== 'undefined' ? self : globalThis);
  const R = root.PhotoRender;

  function decorate(ctx, layout) {
    const s = layout.scale || 1;
    const op = layout.outputPx || Math.max(0.5, s * 0.6);
    const inflate = Math.round(14 * s);
    const ringR = layout.radius + inflate;

    // Single phosphor hairline — soft white, ~0.7px effective in output.
    // Alpha 0.28 (was 0.16) — at the original value the highlight nearly
    // dissolved on 9:16 portrait crops at standard quality. 0.28 is the
    // lower end of the doc's "0.25–0.35" exploration range; pushing
    // higher started reading as a structural border instead of a soft
    // reflection, which broke the "low-key gallery wall" family tone.
    ctx.strokeStyle = 'rgba(255, 255, 245, 0.28)';
    ctx.lineWidth = Math.max(1, 0.9 * op);
    R.pathRoundRect(
      ctx,
      layout.fgLeft - inflate,
      layout.fgTop - inflate,
      layout.fgW + 2 * inflate,
      layout.fgH + 2 * inflate,
      ringR
    );
    ctx.stroke();
  }

  const def = {
    bg: { type: 'solid', color: '#171717' },
    textStyle: 'light',
    layout: {},
    shadowDefault: { blur: 90, offsetY: 28, opacity: 0.55 },
    decorate: decorate
  };
  R.registerFrame('gallery-noir', def);
  R.registerFrame('black', def);
})();
