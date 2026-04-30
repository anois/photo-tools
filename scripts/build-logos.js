#!/usr/bin/env node
// Bundle all SVG files in public/logos/ into a single public/logos.json that
// the SPA fetches at boot. Run this whenever a logo SVG is added/replaced.
// (One-off authoring step, not a runtime build pipeline — frontend stays
// build-step-free.)

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'public', 'logos');
const OUT = path.join(__dirname, '..', 'public', 'logos.json');

function normFill(v) {
  if (!v) return null;
  const s = String(v).trim().toLowerCase();
  if (s === 'none' || s === 'transparent' || s === '' || s === 'currentcolor') return null;
  return s;
}

function parseRoot(raw) {
  const m = raw.match(/<svg\b([^>]*)>/i);
  if (!m) return { viewBox: '0 0 24 24', vw: 24, vh: 24 };
  const attrs = m[1];
  const vb = attrs.match(/\bviewBox\s*=\s*"([^"]+)"/i);
  const w = attrs.match(/\bwidth\s*=\s*"([^"]+)"/i);
  const h = attrs.match(/\bheight\s*=\s*"([^"]+)"/i);
  if (vb) {
    const p = vb[1].trim().split(/\s+/).map(Number);
    return { viewBox: vb[1], vw: p[2] || 24, vh: p[3] || 24 };
  }
  if (w && h) {
    const ww = parseFloat(w[1]);
    const hh = parseFloat(h[1]);
    if (Number.isFinite(ww) && Number.isFinite(hh) && ww > 0 && hh > 0) {
      return { viewBox: `0 0 ${ww} ${hh}`, vw: ww, vh: hh };
    }
  }
  return { viewBox: '0 0 24 24', vw: 24, vh: 24 };
}

const DROP_NAMESPACES = /\s+(sodipodi|inkscape|sketch|cc|dc|rdf|sf|ns\d*|style\d*):[a-zA-Z0-9_-]+\s*=\s*"[^"]*"/gi;
const DROP_XMLNS = /\s+xmlns:(sodipodi|inkscape|sketch|cc|dc|rdf|sf|ns\d*|style\d*)\s*=\s*"[^"]*"/gi;

function stripCruft(svgText) {
  return svgText
    .replace(/<\?xml[^?]*\?>/g, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<metadata[\s\S]*?<\/metadata>/gi, '')
    .replace(/<sodipodi:[\s\S]*?\/>/gi, '')
    .replace(/<sodipodi:[\s\S]*?<\/sodipodi:[^>]+>/gi, '')
    .replace(/<rdf:[\s\S]*?<\/rdf:[^>]+>/gi, '')
    .replace(DROP_NAMESPACES, '')
    .replace(DROP_XMLNS, '');
}

function analyzeInner(innerRaw) {
  const fills = new Set();
  innerRaw.replace(/\bfill\s*=\s*"([^"]+)"/gi, (_, v) => {
    const n = normFill(v);
    if (n && !n.startsWith('url(')) fills.add(n);
    return '';
  });
  innerRaw.replace(/\bstyle\s*=\s*"([^"]+)"/gi, (_, style) => {
    const m = /fill\s*:\s*([^;"\s]+)/i.exec(style);
    if (m) {
      const n = normFill(m[1]);
      if (n && !n.startsWith('url(')) fills.add(n);
    }
    return '';
  });
  const unique = Array.from(fills);
  const monochrome = unique.length <= 1;
  const nonTrivial = unique.find((c) => !/^#?(000|000000|fff|ffffff)$/i.test(c.replace('#', '')));
  const brandColor = (nonTrivial || unique[0] || null);
  return { monochrome, brandColor: brandColor ? brandColor.toUpperCase() : null };
}

function namespaceIds(inner, keyPrefix) {
  const ids = new Set();
  inner.replace(/\bid\s*=\s*"([^"]+)"/gi, (_, id) => { ids.add(id); return ''; });
  let out = inner;
  for (const id of ids) {
    const safe = id.replace(/[^a-zA-Z0-9_-]/g, '_');
    const ns = `${keyPrefix}__${safe}`;
    const re = new RegExp(`(["'\\(#])${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(["'\\)])`, 'g');
    out = out.replace(re, `$1${ns}$2`);
    out = out.replace(
      new RegExp(`\\bid\\s*=\\s*"${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g'),
      `id="${ns}"`
    );
  }
  return out;
}

function buildOne(filePath) {
  const key = path.basename(filePath, path.extname(filePath)).toLowerCase();
  let raw = fs.readFileSync(filePath, 'utf8');
  raw = stripCruft(raw);

  const root = parseRoot(raw);
  const innerMatch = raw.match(/<svg\b[^>]*>([\s\S]*?)<\/svg>/i);
  if (!innerMatch) return null;
  let inner = innerMatch[1]
    .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<desc[^>]*>[\s\S]*?<\/desc>/gi, '')
    .trim();

  const { monochrome, brandColor: innerColor } = analyzeInner(inner);
  const outerFillMatch = raw.match(/<svg\b[^>]*\bfill\s*=\s*"([^"]+)"/i);
  const outerHex = outerFillMatch ? normFill(outerFillMatch[1]) : null;
  const brandColor = innerColor || (outerHex ? outerHex.toUpperCase() : null);

  inner = namespaceIds(inner, key);

  return { key, viewBox: root.viewBox, vw: root.vw, vh: root.vh, inner, brandColor, monochrome };
}

function main() {
  const out = {};
  const files = fs.readdirSync(SRC_DIR).filter((f) => f.toLowerCase().endsWith('.svg'));
  for (const f of files) {
    const e = buildOne(path.join(SRC_DIR, f));
    if (e) out[e.key] = e;
  }
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(`wrote ${OUT} — ${Object.keys(out).length} logos`);
}

main();
