// The PDF chart export: the Export menu's "PDF chart" item and the
// <dialog data-role="pdf-export-dialog"> of index.html (openspec/specs/pdf-export/spec.md).
// The dialog shows the page count, asks first above 100 pages, refuses above 1,000, shows the
// progress with Cancel, and the finished PDF is downloaded. The work runs in the PDF worker.

import {
  formatPdfConfirm,
  formatPdfError,
  formatPdfRunning,
  formatPdfTooLarge,
  isPdfTooLarge,
  needsPdfConfirmation,
  planPdfPages,
} from '../core/pdf-page-plan.js';
import { exportFileName } from '../core/file-names.js';

const PDF_TYPE = 'application/pdf';

/**
 * Connects the PDF export.
 * root   element (or document) containing [data-action="export-pdf"], the Export menu and the
 *        PDF export dialog
 * store  the app store (./store.js); reads pattern, image.fileName and settings.fabricCount
 * deps   { client, encodePictures, download }:
 *        client          the PDF worker client (../io/pdf-worker-client.js)
 *        encodePictures  (image, pattern) → Promise<{ original, dmc }> JPEG bytes
 *                        (../io/pdf-picture-encoder.js)
 *        download        (blob, fileName) saves the file (../io/download.js)
 * The item is enabled while a pattern exists and no export is running. Whether an export runs
 * is local to this module: no other module reads it, and the modal dialog keeps the settings
 * and the image from changing meanwhile.
 */
export function setupPdfExport(root, store, { client, encodePictures, download }) {
  const button = root.querySelector('[data-action="export-pdf"]');
  const menu = root.querySelector('[data-role="export-menu"]');
  const dialog = root.querySelector('[data-role="pdf-export-dialog"]');
  const text = dialog.querySelector('[data-role="pdf-export-text"]');
  const progress = dialog.querySelector('[data-role="pdf-export-progress"]');
  const cancelButton = dialog.querySelector('[data-action="cancel-pdf-export"]');
  const confirmButton = dialog.querySelector('[data-action="confirm-pdf-export"]');

  let run = null; // the running export's token; a stopped run's late results are ignored
  let question = null; // the snapshot waiting for Create PDF

  function render() {
    button.disabled = store.getState().pattern === null || run !== null;
  }

  function show(message, { cancelLabel, isConfirmShown = false, isProgressShown = false }) {
    text.textContent = message;
    cancelButton.textContent = cancelLabel;
    confirmButton.textContent = 'Create PDF';
    confirmButton.hidden = !isConfirmShown;
    progress.hidden = !isProgressShown;
    if (!dialog.open) {
      dialog.showModal();
    }
  }

  function stopRun() {
    if (run === null) {
      return;
    }
    run = null;
    client.stop();
    render();
  }

  async function startRun(snapshot) {
    const token = {};
    run = token;
    question = null;
    render();
    progress.value = 0;
    show(formatPdfRunning(snapshot.plan), { cancelLabel: 'Cancel', isProgressShown: true });
    try {
      const pictures = await encodePictures(snapshot.image, snapshot.pattern);
      if (run !== token) {
        return;
      }
      const request = { pattern: snapshot.pattern, fileName: snapshot.image.fileName, fabricCount: snapshot.fabricCount, pictures };
      const bytes = await client.exportPdf(request, ({ done, total }) => {
        if (run === token) {
          progress.value = Math.floor((100 * done) / total);
        }
      });
      if (run !== token) {
        return;
      }
      run = null;
      render();
      download(new Blob([bytes], { type: PDF_TYPE }), exportFileName(snapshot.image.fileName, 'pdf'));
      dialog.close();
    } catch (error) {
      if (run !== token) {
        return; // cancelled: the stop is not a failure
      }
      run = null;
      render();
      show(formatPdfError(error.message), { cancelLabel: 'Close' });
    }
  }

  button.addEventListener('click', () => {
    menu.open = false;
    const state = store.getState();
    if (state.pattern === null || run !== null) {
      return;
    }
    const snapshot = {
      pattern: state.pattern,
      image: state.image,
      fabricCount: state.settings.fabricCount,
      plan: planPdfPages(state.pattern),
    };
    if (isPdfTooLarge(snapshot.plan)) {
      show(formatPdfTooLarge(snapshot.plan), { cancelLabel: 'Close' });
      return;
    }
    if (needsPdfConfirmation(snapshot.plan)) {
      question = snapshot;
      show(formatPdfConfirm(snapshot.plan), { cancelLabel: 'Cancel', isConfirmShown: true });
      return;
    }
    startRun(snapshot);
  });

  confirmButton.addEventListener('click', () => {
    if (question !== null) {
      startRun(question);
    }
  });

  cancelButton.addEventListener('click', () => dialog.close());

  // Cancel, Close and Esc all end up here: a running export stops at once.
  dialog.addEventListener('close', () => {
    question = null;
    stopRun();
  });

  store.subscribe(render);
  render();
}
