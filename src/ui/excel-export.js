// The Excel workbook item of the Export menu (openspec/specs/excel-export/spec.md once archived;
// design D11 of add-excel-export): checks the size, asks with the Large workbook dialog when
// needed, has the pictures encoded and the workbook written in a worker, then downloads it and
// reports the result in the status line.

import { exportFileName } from '../core/file-names.js';
import { XLSX_MEDIA_TYPE } from '../core/xlsx-package.js';
import {
  workbookSizeCheck,
  formatLargeWorkbookQuestion,
  formatWorkbookTooLarge,
  CREATING_WORKBOOK_TEXT,
  formatWorkbookReady,
  formatWorkbookError,
} from '../core/xlsx-limits.js';

/**
 * Connects the Excel workbook item.
 * root   element (or document) containing [data-role="export-menu"], its
 *        [data-action="export-xlsx"] item and the [data-role="xlsx-warning"] dialog
 * store  the app store from ./store.js (reads image, pattern and status; writes status)
 * deps   { encodePictures(image, pattern), createWorkbook({ pattern, pictures }),
 *          download(blob, fileName) }: encodeSummaryPictures (../io/summary-pictures.js),
 *        createWorkbookInWorker bound to a worker factory (../io/xlsx-worker-client.js) and
 *        downloadBlob (../io/download.js); fakes in tests.
 * The item is enabled exactly while a pattern exists and no workbook is being created.
 */
export function setupExcelExport(root, store, deps) {
  const menu = root.querySelector('[data-role="export-menu"]');
  const item = root.querySelector('[data-action="export-xlsx"]');
  const question = createLargeWorkbookQuestion(root.querySelector('[data-role="xlsx-warning"]'));
  let isBusy = false;

  function render(state) {
    item.disabled = state.pattern === null || isBusy;
  }

  // Shows status only if the status this export set is still the newest one, so a newer
  // message (such as a new image loading) is never overwritten.
  function finishStatus(ownStatus, status) {
    if (store.getState().status === ownStatus) {
      store.setState({ status });
    }
  }

  async function createAndDownload(image, pattern) {
    isBusy = true;
    render(store.getState());
    const ownStatus = { kind: 'loading', text: CREATING_WORKBOOK_TEXT };
    store.setState({ status: ownStatus });
    try {
      const pictures = await deps.encodePictures(image, pattern);
      const bytes = await deps.createWorkbook({ pattern, pictures });
      const fileName = exportFileName(image.fileName, 'xlsx');
      deps.download(new Blob([bytes], { type: XLSX_MEDIA_TYPE }), fileName);
      finishStatus(ownStatus, { kind: 'info', text: formatWorkbookReady(fileName) });
    } catch (error) {
      finishStatus(ownStatus, { kind: 'error', text: formatWorkbookError(error.message) });
    } finally {
      isBusy = false;
      render(store.getState());
    }
  }

  async function exportWorkbook() {
    menu.open = false;
    const { image, pattern } = store.getState();
    if (pattern === null || image === null || isBusy) {
      return;
    }
    const check = workbookSizeCheck(pattern);
    if (check === 'too-large') {
      store.setState({ status: { kind: 'error', text: formatWorkbookTooLarge(pattern) } });
      return;
    }
    if (check === 'confirm' && !(await question.ask(formatLargeWorkbookQuestion(pattern)))) {
      return;
    }
    await createAndDownload(image, pattern);
  }

  item.addEventListener('click', () => {
    exportWorkbook();
  });
  render(store.getState());
  store.subscribe((state, previous) => {
    if (state.pattern !== previous.pattern) {
      render(state);
    }
  });
}

// The Large workbook dialog. ask(text) shows text, opens the modal dialog and resolves true for
// Create workbook, false for Cancel, Esc or any other way of closing it.
function createLargeWorkbookQuestion(dialog) {
  const text = dialog.querySelector('[data-role="xlsx-warning-text"]');
  let answer = null;

  function finish(isConfirmed) {
    if (answer === null) {
      return;
    }
    const resolve = answer;
    answer = null;
    dialog.close();
    resolve(isConfirmed);
  }

  dialog.querySelector('[data-action="cancel-xlsx"]').addEventListener('click', () => finish(false));
  dialog.querySelector('[data-action="confirm-xlsx"]').addEventListener('click', () => finish(true));
  dialog.addEventListener('close', () => finish(false));

  return {
    ask(question) {
      finish(false);
      text.textContent = question;
      dialog.showModal();
      return new Promise((resolve) => {
        answer = resolve;
      });
    },
  };
}
