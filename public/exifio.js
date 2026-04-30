/* photo-tools — frontend EXIF read + write helpers.
 *
 * READ: thin wrapper over `exifr` UMD bundle, returning the same shape the
 * old `/api/exif` endpoint emitted ({ raw, normalized }).
 * WRITE: uses `piexifjs` to splice the source image's EXIF segment back into
 * a freshly-encoded JPEG blob. Without this step, canvas.toBlob('image/jpeg')
 * strips all metadata.
 *
 * Both libraries are vendored under public/vendor/ and exposed as globals
 * (`exifr` and `piexif`) by their UMD wrappers. No build step.
 */
(function () {
  'use strict';

  const R = window.PhotoRender;

  // exifr options. `makerNote: true` is **required** for several phone
  // brands that hide focal/aperture/shutter inside the MakerNote segment
  // (iPhone < iOS 11, Huawei P series, some Xiaomi models). XMP + IPTC
  // catch re-edited Fujifilm DSCF files where standard EXIF was rewritten.
  const EXIFR_OPTS = {
    tiff: true, ifd0: true, exif: true,
    gps: false, interop: false, thumbnail: false,
    xmp: true, iptc: true, icc: false, jfif: false,
    makerNote: true,
    mergeOutput: true,
    translateValues: true, reviveValues: true
  };

  function looksEmpty(n) {
    return !(n && (n.make || n.model || n.focalLength || n.fNumber || n.exposureTime || n.iso || n.lensModel || n.date));
  }

  function slimRaw(raw) {
    const slim = {};
    for (const k of Object.keys(raw || {})) {
      const v = raw[k];
      // Skip TypedArray / ArrayBuffer payloads — they bloat the JSON without
      // carrying user-meaningful info.
      if (v && typeof v === 'object' && (v.buffer || ArrayBuffer.isView(v))) continue;
      slim[k] = v;
    }
    return slim;
  }

  async function parseExif(file) {
    let raw = {};
    try {
      raw = await window.exifr.parse(file, EXIFR_OPTS) || {};
    } catch (err) {
      console.info('[exif] parse threw for', file.name, err);
      raw = {};
    }
    const normalized = R.normalizeExif(raw);
    const slim = slimRaw(raw);
    // Always emit at info level so the row shows up in the default Console
    // filter (warn/error filters often hide [exif] noise). Caller stashes
    // `slim` on the file entry so the page can dump it on demand.
    console.info('[exif]', file.name, '· raw keys:', Object.keys(slim).length,
                 '· empty?', looksEmpty(normalized), '\n', slim);
    return { raw, normalized, slim };
  }

  // Read the JPEG bytes once, return as a binary string suitable for piexif.
  // piexifjs predates ArrayBuffer support and works on raw Latin-1 strings.
  function fileToBinaryString(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsBinaryString(file);
    });
  }

  function blobToBinaryString(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsBinaryString(blob);
    });
  }

  function binaryStringToBlob(s, mime) {
    const buf = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) buf[i] = s.charCodeAt(i) & 0xff;
    return new Blob([buf], { type: mime });
  }

  // Pull EXIF from the original File and inject it into an already-encoded
  // JPEG blob (the GPU-rendered export). PNG output skips this — browsers
  // don't write EXIF chunks for PNG and piexifjs is JPEG-only.
  async function reattachExif(sourceFile, outputBlob) {
    if (outputBlob.type !== 'image/jpeg') return outputBlob;
    let exifBin;
    try {
      const srcBin = await fileToBinaryString(sourceFile);
      const exifObj = window.piexif.load(srcBin);
      // Drop the thumbnail to keep output JPEG slim — original thumb refers
      // to the un-framed image and is now misleading.
      delete exifObj['1st'];
      delete exifObj.thumbnail;
      exifBin = window.piexif.dump(exifObj);
    } catch {
      // Source had no EXIF (e.g. social-platform-stripped images) — fine,
      // just return the output unchanged.
      return outputBlob;
    }
    try {
      const outBin = await blobToBinaryString(outputBlob);
      const merged = window.piexif.insert(exifBin, outBin);
      return binaryStringToBlob(merged, 'image/jpeg');
    } catch {
      return outputBlob;
    }
  }

  window.ExifIO = { parseExif, reattachExif, slimRaw };
})();
