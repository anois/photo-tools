/* photo-tools — HEIC import shim.
 *
 * Lazy-loads the vendored libheif-js WASM bundle (~1.2MB) on first HEIC
 * encounter so users who never touch HEIC don't pay for it. Decodes the
 * primary image to RGBA, paints onto a canvas, and re-encodes as JPEG.
 *
 * Limitation: the transcoded JPEG carries NO embedded EXIF — libheif-js
 * doesn't surface the raw EXIF segment, and exifr's parsed output isn't
 * trivially convertible to piexif's tag-id format. The caption text still
 * renders correctly because exifr can parse the original HEIC directly into
 * `entry.normalized`; only the file-level metadata round-trip is lost.
 */
(function () {
  'use strict';

  let libheifReady = null;

  function ensureLibheif() {
    if (libheifReady) return libheifReady;
    if (typeof window.libheif !== 'undefined') {
      libheifReady = Promise.resolve(window.libheif);
      return libheifReady;
    }
    libheifReady = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'vendor/libheif-bundle.js';
      s.async = true;
      s.onload = () => {
        if (typeof window.libheif !== 'undefined') resolve(window.libheif);
        else reject(new Error('libheif loaded but global missing'));
      };
      s.onerror = () => reject(new Error('libheif load failed'));
      document.head.appendChild(s);
    });
    return libheifReady;
  }

  function isHeic(file) {
    if (!file) return false;
    const mime = (file.type || '').toLowerCase();
    if (mime === 'image/heic' || mime === 'image/heif' ||
        mime === 'image/heic-sequence' || mime === 'image/heif-sequence') return true;
    const name = (file.name || '').toLowerCase();
    return /\.(heic|heif)$/.test(name);
  }

  async function decodeToRgba(arrayBuffer) {
    const libheif = await ensureLibheif();
    const decoder = new libheif.HeifDecoder();
    const list = decoder.decode(arrayBuffer);
    if (!list || !list.length) throw new Error('no images in HEIC');
    const image = list[0];
    const w = image.get_width();
    const h = image.get_height();
    if (!w || !h) throw new Error('invalid HEIC dimensions');
    const out = new Uint8ClampedArray(w * h * 4);
    return new Promise((resolve, reject) => {
      // libheif-js display() expects an object with .data (Uint8ClampedArray
      // of RGBA, length = w*h*4), .width, .height. The callback fires once
      // the buffer is populated.
      image.display({ data: out, width: w, height: h }, (display) => {
        if (!display) reject(new Error('HEIC decode failed'));
        else resolve({ width: w, height: h, data: display.data });
      });
    });
  }

  async function rgbaToJpegBlob(rgba, width, height, quality) {
    const canvas = (typeof OffscreenCanvas !== 'undefined')
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement('canvas'), { width, height });
    const ctx = canvas.getContext('2d');
    const imageData = new ImageData(new Uint8ClampedArray(rgba), width, height);
    ctx.putImageData(imageData, 0, 0);
    if (canvas.convertToBlob) {
      return canvas.convertToBlob({ type: 'image/jpeg', quality: quality || 0.95 });
    }
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality || 0.95));
  }

  function renamedJpegName(originalName) {
    const base = (originalName || 'photo').replace(/\.(heic|heif)$/i, '');
    return base + '.jpg';
  }

  // Public entry: take the original HEIC File, return a JPEG File the rest of
  // the pipeline can treat as native input. Throws on decode failure.
  async function transcode(file) {
    const buf = await file.arrayBuffer();
    const { width, height, data } = await decodeToRgba(buf);
    const blob = await rgbaToJpegBlob(data, width, height, 0.95);
    return new File([blob], renamedJpegName(file.name), {
      type: 'image/jpeg',
      lastModified: file.lastModified || Date.now()
    });
  }

  window.HeicTools = { isHeic, transcode, ensureLibheif };
})();
