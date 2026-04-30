#!/usr/bin/env node
// Encode public/fonts/*.ttf as base64 and emit public/fonts.css with two
// @font-face rules. The SPA fetches this CSS once at boot and inlines it
// into every caption SVG so libvips-equivalent text rendering works without
// the user's browser having to download Inter from Google Fonts.

const fs = require('fs');
const path = require('path');

const FONTS_DIR = path.join(__dirname, '..', 'public', 'fonts');
const OUT = path.join(__dirname, '..', 'public', 'fonts.css');

const regular  = fs.readFileSync(path.join(FONTS_DIR, 'Inter-Regular.ttf')).toString('base64');
const semibold = fs.readFileSync(path.join(FONTS_DIR, 'Inter-SemiBold.ttf')).toString('base64');

const css =
  `@font-face{font-family:'Inter';src:url(data:font/ttf;base64,${regular}) format('truetype');font-weight:400;font-style:normal;}` +
  `@font-face{font-family:'Inter';src:url(data:font/ttf;base64,${semibold}) format('truetype');font-weight:600;font-style:normal;}`;

fs.writeFileSync(OUT, css);
console.log(`wrote ${OUT} — ${css.length} bytes`);
