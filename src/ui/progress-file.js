// Saving and loading the progress as a .stitch file (openspec/specs/stitch-progress/spec.md,
// "Progress can be saved as a .stitch file" and the requirements after it; design D5 and D7 of
// add-progress-file): the saver used by the menu and by Save progress first in the warning
// dialogs, and the two items of the Export menu.

import { toSavedProgress } from '../core/progress.js';
import { exportFileName } from '../core/file-names.js';
import {
  encodeProgressFile,
  decodeProgressFile,
  formatProgressFileError,
  formatLoadWarning,
  ProgressFileError,
  MAX_PROGRESS_FILE_BYTES,
  PROGRESS_FILE_EXTENSION,
  SAVE_FAILED_TEXT,
} from '../core/progress-file.js';
import { downloadProgressFile } from '../io/progress-file.js';

/**
 * Creates the saver of .stitch files.
 * store     the app store from ./store.js
 * download  (bytes, fileName) => void, default downloadProgressFile (../io/progress-file.js)
 * Returns {
 *   saveCurrent()      downloads state.progress as the image's name with .stitch ('cat.png' →
 *                      'cat.stitch')
 *   saveRecord(saved)  downloads a SavedProgress of the browser storage, named after its
 *                      imageName ('' → 'pattern.stitch')
 * }
 * Both resolve to the file name, or reject when the file cannot be made (e.g. no
 * CompressionStream in this browser).
 */
export function createProgressFileSaver(store, download = downloadProgressFile) {
  async function saveRecord(saved) {
    const fileName = exportFileName(saved.imageName, PROGRESS_FILE_EXTENSION);
    download(await encodeProgressFile(saved), fileName);
    return fileName;
  }

  function saveCurrent() {
    const { progress, image } = store.getState();
    return saveRecord(toSavedProgress(progress, image?.fileName ?? '', Date.now()));
  }

  return { saveCurrent, saveRecord };
}

/**
 * Connects the two progress items of the Export menu.
 * root     element (or document) containing [data-role="export-menu"] (a <details>), the button
 *          [data-action="export-progress"] and the file input [data-role="progress-file-input"]
 * store    the app store from ./store.js
 * options  {
 *   saver        the object returned by createProgressFileSaver
 *   warning      { confirm({ text, confirmLabel, saveFirst }) } (./progress-warning.js)
 *   persistence  { confirmFirstMark(), adoptProgress(progress, fileName) }
 *                (./progress-persistence.js)
 *   readBytes    (file) => Promise<Uint8Array> (readFileBytes in ../io/progress-file.js)
 * }
 * Save is enabled while a pattern has at least one marked stitch; Load while a pattern exists
 * and none is being generated. Errors go to the status line, naming the file.
 */
export function setupProgressFileMenu(root, store, { saver, warning, persistence, readBytes }) {
  const menu = root.querySelector('[data-role="export-menu"]');
  const saveItem = root.querySelector('[data-action="export-progress"]');
  const fileInput = root.querySelector('[data-role="progress-file-input"]');
  let shownError = null; // the status this module set, while it is still shown
  let statusBeforeError = null;

  function render(state) {
    saveItem.disabled = state.pattern === null || !(state.progress?.stitchedCount > 0);
    fileInput.disabled = state.pattern === null || state.generation.kind === 'running';
  }

  function showError(text) {
    const { status } = store.getState();
    if (status !== shownError) {
      statusBeforeError = status;
    }
    shownError = { kind: 'error', text };
    store.setState({ status: shownError });
  }

  // After a later success, an error of this module still in the status line is out of date.
  function clearShownError() {
    if (shownError !== null && store.getState().status === shownError) {
      store.setState({ status: statusBeforeError });
    }
    shownError = null;
  }

  async function saveCurrentProgress() {
    menu.open = false;
    try {
      await saver.saveCurrent();
      clearShownError();
    } catch (error) {
      console.error('Could not save the progress file:', error);
      showError(SAVE_FAILED_TEXT);
    }
  }

  async function loadChosenFile() {
    const file = fileInput.files[0];
    fileInput.value = ''; // so the same file can be chosen again
    menu.open = false;
    if (file === undefined) {
      return;
    }
    const { pattern } = store.getState();
    const loaded = await readAndDecode(file, pattern);
    if (loaded === null || store.getState().pattern !== pattern) {
      return;
    }
    const askedProgress = store.getState().progress;
    if (!(await confirmLoad(file.name, askedProgress, loaded))) {
      return;
    }
    if (store.getState().progress !== askedProgress) {
      return; // marks changed while the question was open
    }
    clearShownError();
    persistence.adoptProgress(loaded, file.name);
  }

  // The Progress in the file, or null after showing why it cannot be used. Checked before any
  // question, so an invalid file never asks.
  async function readAndDecode(file, pattern) {
    try {
      if (file.size > MAX_PROGRESS_FILE_BYTES) {
        throw new ProgressFileError('not-progress-file', `the file has ${file.size} bytes`);
      }
      const bytes = await readBytes(file);
      if (store.getState().pattern !== pattern) {
        return null;
      }
      return await decodeProgressFile(bytes, pattern);
    } catch (error) {
      if (store.getState().pattern === pattern) {
        showError(formatProgressFileError(file.name, error, pattern));
      }
      return null;
    }
  }

  // Marks on screen ask with the load question; otherwise the first-mark question may ask
  // whether to replace another picture's saved progress.
  function confirmLoad(fileName, progress, loaded) {
    if (progress.stitchedCount === 0) {
      return persistence.confirmFirstMark();
    }
    return warning.confirm({
      text: formatLoadWarning(fileName, progress.stitchedCount, loaded.stitchedCount, progress.totalCount),
      confirmLabel: 'Load progress',
      saveFirst: saver.saveCurrent,
    });
  }

  saveItem.addEventListener('click', saveCurrentProgress);
  fileInput.addEventListener('change', loadChosenFile);
  render(store.getState());
  store.subscribe((state, previous) => {
    const isChanged = state.pattern !== previous.pattern || state.progress !== previous.progress
      || state.generation !== previous.generation;
    if (isChanged) {
      render(state);
    }
  });
}
