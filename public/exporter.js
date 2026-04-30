/* photo-tools — single + batch export orchestration (frontend-only).
 *
 * Single export runs on the main thread (one render, user is waiting).
 * Batch export uses a worker pool so the UI stays interactive while N photos
 * are rendered + EXIF-reattached in parallel. Results stream back; main
 * thread packs the ZIP and triggers download.
 */
(function () {
  'use strict';

  const CR = window.ClientRender;
  const ExifIO = window.ExifIO;
  // Resolve lazily — script ordering is index.html → exporter.js → progressModal.js,
  // and capturing at IIFE time would freeze undefined.
  const PM = () => window.ProgressModal;
  const POOL_SIZE = Math.max(2, Math.min(3, (navigator.hardwareConcurrency || 4) - 1));

  function triggerDownload(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  function outName(file, format) {
    const base = (file.name || 'photo').replace(/\.[^.]+$/, '');
    const ext = format === 'png' ? 'png' : 'jpg';
    return `${base}_framed.${ext}`;
  }

  // Single-photo export, main thread (renderFinal already uses GPU canvas).
  async function exportSingle(entry, cfg, assets) {
    const blob = await CR.renderFinal({
      file: entry.file, cfg, normExif: entry.normExif,
      logos: assets.logos, fontFaceCss: assets.fontFaceCss,
      format: cfg.format, quality: cfg.quality
    });
    const out = await ExifIO.reattachExif(entry.file, blob);
    triggerDownload(out, outName(entry.file, cfg.format));
  }

  // ─── Worker pool ──────────────────────────────────────────────────────
  // One pool per app session, kept warm so subsequent batches reuse the
  // initialized workers (logos+fonts already loaded).
  let pool = null;

  function makePool(assets) {
    const workers = [];
    let initOk = true;
    for (let i = 0; i < POOL_SIZE; i++) {
      let w;
      try { w = new Worker('worker.js'); }
      catch { initOk = false; break; }
      workers.push({ worker: w, busy: false, ready: false, queue: [] });
    }
    if (!initOk) {
      for (const w of workers) w.worker.terminate();
      return null;
    }
    let nextId = 1;
    const pending = new Map();   // id → { resolve, reject }

    const initPromises = workers.map((w) => new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve: () => { w.ready = true; resolve(); }, reject });
      w.worker.onmessage = (e) => {
        const m = e.data;
        const slot = pending.get(m.id);
        if (!slot) return;
        pending.delete(m.id);
        if (m.type === 'ready') slot.resolve();
        else if (m.type === 'result') {
          if (m.ok) slot.resolve(m.blob);
          else slot.reject(new Error(m.error));
        }
      };
      w.worker.onerror = (err) => reject(err);
      w.worker.postMessage({ type: 'init', id, logos: assets.logos, fontFaceCss: assets.fontFaceCss });
    }));

    const ready = Promise.all(initPromises).catch(() => { /* swallow; render() will reject */ });

    function render(job) {
      // Pick the first non-busy worker.
      const worker = workers.find((w) => !w.busy && w.ready) || workers[0];
      worker.busy = true;
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, {
          resolve: (blob) => { worker.busy = false; resolve(blob); },
          reject:  (err)  => { worker.busy = false; reject(err); }
        });
        worker.worker.postMessage({ type: 'render', id, ...job });
      });
    }

    return { ready, render, workers };
  }

  function getPool(assets) {
    if (pool) return pool;
    pool = makePool(assets);
    return pool;
  }

  // ─── Concurrency scheduler ────────────────────────────────────────────
  // Saturates the worker pool by dispatching at most POOL_SIZE jobs in
  // flight. Reports each completion via onProgress.
  async function runPool(items, pool, worker, onProgress) {
    const results = new Array(items.length);
    let cursor = 0;
    let done = 0;
    async function next() {
      while (cursor < items.length) {
        const i = cursor++;
        try { results[i] = { ok: true, blob: await worker(items[i], i) }; }
        catch (err) { results[i] = { ok: false, error: err && err.message || String(err) }; }
        done++;
        if (onProgress) onProgress(done, items.length, items[i]);
      }
    }
    await Promise.all(Array.from({ length: Math.min(POOL_SIZE, items.length) }, () => next()));
    return results;
  }

  // Main-thread fallback when workers can't load (file:// protocol,
  // restrictive CSP, very old browsers). Mirrors the single-export path.
  async function runMainThread(items, assets, onProgress) {
    const results = new Array(items.length);
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      try {
        const blob = await CR.renderFinal({
          file: e.file, cfg: e.cfg, normExif: e.normExif,
          logos: assets.logos, fontFaceCss: assets.fontFaceCss,
          format: e.cfg.format, quality: e.cfg.quality
        });
        const out = await ExifIO.reattachExif(e.file, blob);
        results[i] = { ok: true, blob: out };
      } catch (err) {
        results[i] = { ok: false, error: err && err.message || String(err) };
      }
      if (onProgress) onProgress(i + 1, items.length, e);
    }
    return results;
  }

  async function exportBatch(entries, assets) {
    { const m = PM(); if (m) m.open(entries.length); }
    let results;

    const p = getPool(assets);
    if (p) {
      try { await p.ready; } catch { /* already swallowed */ }
      // If any worker is still not ready, treat pool as broken.
      const ok = p.workers.every((w) => w.ready);
      if (!ok) {
        results = await runMainThread(entries, assets, (done, _t, item) => {
          { const m = PM(); if (m) m.render(done, item.file.name); }
        });
      } else {
        results = await runPool(entries, p, async (e) => {
          return p.render({
            file: e.file, cfg: e.cfg, normExif: e.normExif,
            format: e.cfg.format, quality: e.cfg.quality
          });
        }, (done, _t, item) => {
          { const m = PM(); if (m) m.render(done, item.file.name); }
        });
      }
    } else {
      // No worker support at all (e.g. file:// protocol). Fall back.
      results = await runMainThread(entries, assets, (done, _t, item) => {
        { const m = PM(); if (m) m.render(done, item.file.name); }
      });
    }

    { const m = PM(); if (m) m.pack(); }
    // Yield once so the modal repaints into the pack stage before JSZip
    // starts its synchronous scan over all blobs.
    await new Promise((r) => requestAnimationFrame(r));

    const zip = new window.JSZip();
    const errors = [];
    results.forEach((r, i) => {
      const e = entries[i];
      if (r.ok) zip.file(outName(e.file, e.cfg.format), r.blob);
      else errors.push(`${e.file.name}: ${r.error}`);
    });
    if (errors.length) zip.file('_errors.txt', errors.join('\n') + '\n');
    const out = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    triggerDownload(out, `framed_${Date.now().toString(36)}.zip`);
    { const m = PM(); if (m) m.done(errors); }
    return { errors };
  }

  window.Exporter = { exportSingle, exportBatch };
})();
