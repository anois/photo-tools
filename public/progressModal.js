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
 * Stage labels are deliberately Chinese to match the rest of the UI.
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

  let totalCount = 0;

  function open(total) {
    totalCount = total;
    els.title.textContent = 'Exporting…';
    els.stage.textContent = '渲染中';
    els.done.textContent = '0';
    els.total.textContent = String(total);
    els.fill.style.width = '0%';
    els.current.textContent = '—';
    els.errors.hidden = true;
    els.errors.innerHTML = '';
    els.closeBtn.hidden = true;
    if (typeof els.dialog.showModal === 'function') els.dialog.showModal();
    else els.dialog.setAttribute('open', '');
  }

  function render(done, name) {
    els.done.textContent = String(done);
    els.fill.style.width = totalCount ? `${(done / totalCount) * 100}%` : '0%';
    els.current.textContent = name || '—';
  }

  function pack() {
    els.stage.textContent = '打包 ZIP…';
    els.fill.style.width = '100%';
    els.current.textContent = '生成压缩包';
  }

  function done(errors) {
    els.title.textContent = errors && errors.length ? 'Exported · errors' : 'Exported';
    els.stage.textContent = '完成';
    els.fill.style.width = '100%';
    els.current.textContent = '已下载 ZIP';
    if (errors && errors.length) {
      els.errors.hidden = false;
      els.errors.innerHTML = errors.map((e) => `<li>${e.replace(/[<>&]/g, (c) => ({ '<':'&lt;','>':'&gt;','&':'&amp;'}[c]))}</li>`).join('');
    }
    els.closeBtn.hidden = false;
    els.closeBtn.focus();
  }

  function close() {
    if (els.dialog.open) els.dialog.close();
  }

  els.closeBtn.addEventListener('click', close);
  // Escape key on a <dialog> auto-fires close — handle that to clean up state.
  els.dialog.addEventListener('close', () => { els.errors.innerHTML = ''; });

  window.ProgressModal = { open, render, pack, done, close };
})();
