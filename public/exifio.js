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
      // Force Orientation = 1 (Top-left, no rotation). createImageBitmap with
      // imageOrientation: 'from-image' has already baked the source rotation
      // into the rendered pixels, so re-injecting the source's Orientation
      // tag would tell viewers to rotate the already-rotated pixels — a
      // double rotation that surfaces as portraits coming out landscape.
      // 274 is piexif.ImageIFD.Orientation; using the literal avoids a
      // window.piexif lookup on every export.
      if (!exifObj['0th']) exifObj['0th'] = {};
      exifObj['0th'][274] = 1;
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

  // ─── HEIC EXIF injection ────────────────────────────────────────────────
  // libheif-js doesn't surface the source HEIC's EXIF segment as raw bytes,
  // and piexifjs is JPEG-only. To carry HEIC metadata through the transcode,
  // we parse via exifr (which natively reads HEIC), translate the parsed
  // fields into piexif's IFD object format, dump as an EXIF segment, and
  // splice it into the freshly transcoded JPEG.
  //
  // We don't carry every tag — only the curated list that exifr surfaces
  // and that users actually inspect (Make / Model / focal / aperture / shutter
  // / ISO / lens / date / artist). Anything beyond the table is dropped, but
  // the result is good enough for every common viewer (Finder Preview,
  // Photos.app, exiftool's "summary" output).

  // Convert a positive float to a [numerator, denominator] rational. Picks a
  // denominator that captures 6 significant figures for sub-second values
  // (so 1/4000 stays exact) and 3 sig figs for values >= 1 (so 50.0mm,
  // 1.4 f-number stay clean). Returns null for unusable inputs.
  function toRational(n) {
    if (typeof n !== 'number' || !isFinite(n) || n <= 0) return null;
    const denom = n < 1 ? 1000000 : 1000;
    return [Math.round(n * denom), denom];
  }

  // exifr returns DateTime fields as JS Date when reviveValues is on. piexif
  // wants 'YYYY:MM:DD HH:MM:SS'.
  function dateToExifString(d) {
    if (!d) return null;
    const date = (d instanceof Date) ? d : new Date(d);
    if (isNaN(date.getTime())) return null;
    const pad = (n) => String(n).padStart(2, '0');
    return date.getFullYear() + ':' + pad(date.getMonth() + 1) + ':' + pad(date.getDate())
      + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' + pad(date.getSeconds());
  }

  function buildExifObjFromParsed(raw) {
    if (!raw) raw = {};
    const piexif = window.piexif;
    const I = piexif.ImageIFD, E = piexif.ExifIFD;
    const exifObj = { '0th': {}, 'Exif': {}, 'GPS': {} };

    const setS = (group, tag, v) => { if (v != null && v !== '') exifObj[group][tag] = String(v); };
    const setN = (group, tag, v) => { if (typeof v === 'number' && isFinite(v)) exifObj[group][tag] = Math.round(v); };
    const setR = (group, tag, v) => { const r = toRational(typeof v === 'number' ? v : Number(v)); if (r) exifObj[group][tag] = r; };

    setS('0th', I.Make,  raw.Make ?? raw.make);
    setS('0th', I.Model, raw.Model ?? raw.model);
    setS('0th', I.Artist, raw.Artist ?? raw.artist);
    setS('0th', I.Software, raw.Software ?? raw.software);
    const dt = dateToExifString(raw.DateTime ?? raw.dateTime ?? raw.ModifyDate);
    if (dt) exifObj['0th'][I.DateTime] = dt;
    // Orientation = 1 (the transcoded JPEG's pixels are upright, see the
    // double-rotation pitfall in CLAUDE.md).
    exifObj['0th'][I.Orientation] = 1;

    setR('Exif', E.ExposureTime, raw.ExposureTime ?? raw.exposureTime);
    setR('Exif', E.FNumber, raw.FNumber ?? raw.fNumber);
    setR('Exif', E.FocalLength, raw.FocalLength ?? raw.focalLength);
    setN('Exif', E.ISOSpeedRatings, raw.ISO ?? raw.iso ?? raw.ISOSpeedRatings ?? raw.PhotographicSensitivity);
    setN('Exif', E.FocalLengthIn35mmFilm, raw.FocalLengthIn35mmFilm ?? raw.FocalLengthIn35mmFormat);
    const dto = dateToExifString(raw.DateTimeOriginal ?? raw.dateTimeOriginal ?? raw.CreateDate);
    if (dto) exifObj.Exif[E.DateTimeOriginal] = dto;
    const dtd = dateToExifString(raw.DateTimeDigitized ?? raw.dateTimeDigitized);
    if (dtd) exifObj.Exif[E.DateTimeDigitized] = dtd;
    setS('Exif', E.LensMake, raw.LensMake ?? raw.lensMake);
    setS('Exif', E.LensModel, raw.LensModel ?? raw.lensModel);

    return exifObj;
  }

  // Take the original HEIC file + a freshly transcoded JPEG blob; return a
  // JPEG blob with the source's EXIF spliced into an APP1 segment. Any error
  // along the way returns the input JPEG unchanged.
  async function injectExifFromHeic(heicFile, jpegBlob) {
    try {
      const raw = await window.exifr.parse(heicFile, EXIFR_OPTS) || {};
      const exifObj = buildExifObjFromParsed(raw);
      // Don't bother writing a segment if we found nothing worth writing.
      const has = Object.keys(exifObj['0th']).length > 1   // >1 because Orientation is always set
               || Object.keys(exifObj.Exif).length > 0;
      if (!has) return jpegBlob;
      const exifBin = window.piexif.dump(exifObj);
      const outBin = await blobToBinaryString(jpegBlob);
      const merged = window.piexif.insert(exifBin, outBin);
      return binaryStringToBlob(merged, 'image/jpeg');
    } catch (err) {
      console.warn('[exif] HEIC injection failed', err);
      return jpegBlob;
    }
  }

  window.ExifIO = { parseExif, reattachExif, injectExifFromHeic, slimRaw };
})();
