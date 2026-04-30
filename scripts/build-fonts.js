#!/usr/bin/env node
// Subset Inter Regular + SemiBold to the character ranges photo-tools actually
// renders, then base64-inline both into public/fonts.css. The SPA fetches this
// CSS once at boot and embeds it into every caption SVG so libvips-equivalent
// text rendering works without the user's browser pulling Inter from Google.
//
// Subsetting: shipping the full Inter face is ~870KB (~57KB after gzip but
// browsers don't gzip data: URLs). Restricting to printable Latin-1 + Latin
// Extended-A + a handful of typographic punctuation we actually use shrinks
// the bundle to ~120KB while still covering every European name a user might
// type into the EXIF author field. CJK author names fall back to the system
// sans-serif — explicit trade-off, not an oversight.

const fs = require('fs');
const path = require('path');
const subsetFont = require('subset-font');

const FONTS_DIR = path.join(__dirname, '..', 'public', 'fonts');
const OUT = path.join(__dirname, '..', 'public', 'fonts.css');

// Character coverage:
//   - U+0020–007E: printable ASCII (everything from space through ~)
//   - U+00A0–00FF: Latin-1 supplement (©, ·, °, accented letters)
//   - U+0100–017F: Latin Extended-A (Eastern European diacritics)
//   - Misc typographic punctuation we render: en/em dash, bullet, ellipsis,
//     curly quotes, prime marks, ™
function buildCharset() {
  const ranges = [
    [0x0020, 0x007E],
    [0x00A0, 0x00FF],
    [0x0100, 0x017F]
  ];
  const extras = [
    0x2010, 0x2011, 0x2013, 0x2014,
    0x2018, 0x2019, 0x201A,
    0x201C, 0x201D, 0x201E,
    0x2022,
    0x2026,
    0x2032, 0x2033,
    0x2122
  ];
  let out = '';
  for (const [lo, hi] of ranges) {
    for (let cp = lo; cp <= hi; cp++) out += String.fromCodePoint(cp);
  }
  for (const cp of extras) out += String.fromCodePoint(cp);
  return out;
}

async function subsetTtf(srcPath) {
  const buf = fs.readFileSync(srcPath);
  return await subsetFont(buf, buildCharset(), { targetFormat: 'truetype' });
}

(async () => {
  const regularBuf = await subsetTtf(path.join(FONTS_DIR, 'Inter-Regular.ttf'));
  const semiboldBuf = await subsetTtf(path.join(FONTS_DIR, 'Inter-SemiBold.ttf'));

  const regular = regularBuf.toString('base64');
  const semibold = semiboldBuf.toString('base64');

  const css =
    `@font-face{font-family:'Inter';src:url(data:font/ttf;base64,${regular}) format('truetype');font-weight:400;font-style:normal;}` +
    `@font-face{font-family:'Inter';src:url(data:font/ttf;base64,${semibold}) format('truetype');font-weight:600;font-style:normal;}`;

  fs.writeFileSync(OUT, css);
  console.log(`wrote ${OUT} — ${(css.length / 1024).toFixed(1)} KB`);
  console.log(`  · Regular subset:  ${(regularBuf.length / 1024).toFixed(1)} KB raw`);
  console.log(`  · SemiBold subset: ${(semiboldBuf.length / 1024).toFixed(1)} KB raw`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
