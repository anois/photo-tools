/* photo-tools — batch export progress modal controller.
 *
 * Thin shell over the <dialog id="export-modal"> element. Exposes a
 * stage-based API so the exporter only has to push events:
 *   open(total)           — show modal in "rendering" stage with totals
 *   render(done, name)    — bump per-file progress
 *   pack()                — switch to "packing" stage (indeterminate-ish)
 *   done(errors)          — switch to "done" stage; reveal close button
 *   close()               — hide
 *
 * Strings come from window.I18N so the modal follows the active locale.
 * We track which "stage" we're in so a locale flip mid-export repaints the
 * stage label and current-line correctly.
 */
(function () {
  'use strict';

  const els = {
    dialog:   document.getElementById('export-modal'),
    title:    document.getElementById('export-modal-title'),
    stage:    document.getElementById('export-stage'),
    done:     document.getElementById('export-done'),
    total:    document.getElementById('export-total'),
    fill:     document.getElementById('export-bar-fill'),
    current:  document.getElementById('export-current'),
    errors:   document.getElementById('export-errors'),
    closeBtn: document.getElementById('export-modal-close')
  };

  const T = (k, vars) => window.I18N.t(k, vars);

  let totalCount = 0;
  let stage = 'idle';      // 'render' | 'pack' | 'done' | 'idle'
  let currentName = '';
  let errorCount = 0;
  // i18n keys for the active "verb" (export render/pack vs. upload). Defaults
  // match the export use case; `open(total, opts)` can override for upload.
  // Stored as keys (not resolved strings) so `paintStage` repaints under a
  // mid-flight locale flip.
  let keys = null;
  const EXPORT_KEYS = {
    title: 'export.modalTitle',
    stageRender: 'export.stageRender',
    stagePack: 'export.stagePack',
    stageDone: 'export.stageDone',
    currentEmpty: 'export.currentEmpty',
    currentPack: 'export.currentPack',
    currentDone: 'export.currentDone',
    doneTitle: 'export.modalDoneTitle',
    doneWithErrors: 'export.modalDoneWithErrors'
  };

  function paintStage() {
    const k = keys || EXPORT_KEYS;
    if (stage === 'render') {
      els.title.textContent = T(k.title);
      els.stage.textContent = T(k.stageRender);
      els.current.textContent = currentName || T(k.currentEmpty);
    } else if (stage === 'pack') {
      els.stage.textContent = T(k.stagePack);
      els.current.textContent = T(k.currentPack);
    } else if (stage === 'done') {
      els.title.textContent = errorCount ? T(k.doneWithErrors) : T(k.doneTitle);
      els.stage.textContent = T(k.stageDone);
      els.current.textContent = T(k.currentDone);
    }
  }

  function open(total, opts) {
    totalCount = total;
    stage = 'render';
    currentName = '';
    errorCount = 0;
    // Merge caller-supplied key overrides; anything they don't set falls
    // through to the export defaults. Keeps existing exporter call sites
    // unchanged while letting the S3 upload path show "Uploading…" etc.
    keys = opts ? Object.assign({}, EXPORT_KEYS, opts) : EXPORT_KEYS;
    els.done.textContent = '0';
    els.total.textContent = String(total);
    els.fill.style.width = '0%';
    els.errors.hidden = true;
    els.errors.innerHTML = '';
    els.closeBtn.hidden = true;
    paintStage();
    if (typeof els.dialog.showModal === 'function') els.dialog.showModal();
    else els.dialog.setAttribute('open', '');
  }

  function render(done, name) {
    currentName = name || '';
    els.done.textContent = String(done);
    els.fill.style.width = totalCount ? `${(done / totalCount) * 100}%` : '0%';
    const k = keys || EXPORT_KEYS;
    els.current.textContent = currentName || T(k.currentEmpty);
  }

  function pack() {
    stage = 'pack';
    els.fill.style.width = '100%';
    paintStage();
  }

  function done(errors) {
    stage = 'done';
    errorCount = (errors && errors.length) || 0;
    els.fill.style.width = '100%';
    if (errorCount) {
      els.errors.hidden = false;
      els.errors.innerHTML = errors.map((e) => `<li>${e.replace(/[<>&]/g, (c) => ({ '<':'&lt;','>':'&gt;','&':'&amp;'}[c]))}</li>`).join('');
    }
    paintStage();
    els.closeBtn.hidden = false;
    els.closeBtn.focus();
  }

  function close() {
    if (els.dialog.open) els.dialog.close();
    stage = 'idle';
  }

  els.closeBtn.addEventListener('click', close);
  // Escape key on a <dialog> auto-fires close — handle that to clean up state.
  els.dialog.addEventListener('close', () => { els.errors.innerHTML = ''; });

  // Repaint stage label when the user flips locale mid-export.
  if (window.I18N && typeof window.I18N.onChange === 'function') {
    window.I18N.onChange(() => { if (stage !== 'idle') paintStage(); });
  }

  window.ProgressModal = { open, render, pack, done, close };
})();
