// Saving and loading the progress as a .stitch file (openspec/specs/stitch-progress/spec.md,
// "Progress can be saved as a .stitch file" and the requirements after it; design D5 and D7 of
// add-progress-file): the saver used by the menu and by Save progress first in the warning
// dialogs, and the two items of the Export menu.

import { toSavedProgress } from '../core/progress.js';
import { exportFileName } from '../core/file-names.js';
import { encodeProgressFile, PROGRESS_FILE_EXTENSION } from '../core/progress-file.js';
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
