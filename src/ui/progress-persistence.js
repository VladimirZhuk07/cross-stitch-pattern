// Keeps the marked stitches in this browser and brings them back (openspec/specs/stitch-progress/
// spec.md, "Progress is saved in this browser" and the requirements after it; design D4 of
// persist-progress). Saving is debounced; a page that is hidden is saved at once. A new pattern
// whose fingerprint matches the saved progress gets its marks back. The first mark on another
// pattern asks before it replaces the saved progress. A progress loaded from a .stitch file is
// adopted here and saved at once (design D6 of add-progress-file). Storage problems show a note
// once and never stop marking.

import {
  restoreProgress,
  toSavedProgress,
  isSavedProgressOf,
  formatReplaceWarning,
  RESTORED_NOTE,
  UNSAVED_NOTE,
} from '../core/progress.js';
import { formatLoadedNote } from '../core/progress-file.js';

/** Quiet time after the last toggle before the progress is written. */
export const SAVE_DELAY_MS = 500;

/**
 * Connects state.progress to the browser storage.
 * root          the document (visibility events) or an element with the same API; contains
 *               the note [data-role="progress-note"]
 * store         the app store from ./store.js
 * storePromise  a Promise of { load(), save(record), clear() } (openProgressStore in
 *               ../io/progress-store.js); a rejection means "storage unavailable"
 * warning       { confirm({ text, confirmLabel, saveFirst }) } (createProgressWarning in
 *               ./progress-warning.js)
 * saver         optional { saveRecord(saved) } (./progress-file.js): offered as Save progress
 *               first with the replace question, to download the other pattern's saved progress
 * Returns {
 *   confirmFirstMark()  Promise<boolean>: may the first mark of this pattern be made? Asks
 *                       only when it would replace the saved progress of another pattern
 *   discard()           Promise: drops a pending save and deletes the saved progress (after
 *                       the user confirmed losing the progress)
 *   adoptProgress(progress, fileName)
 *                       makes progress (a fresh Progress of state.pattern, e.g. from a .stitch
 *                       file named fileName) the current one, shows the Progress layer with a
 *                       note and saves it at once; the next first mark does not ask again
 * }
 */
export function setupProgressPersistence(root, store, storePromise, warning, saver = null) {
  const note = root.querySelector('[data-role="progress-note"]');
  let saved = null; // what storage holds, as far as this page knows
  let isUnavailable = false;
  let approvedPattern = null; // the pattern whose first mark the user allowed
  let saveTimer = null;
  let noteText = '';

  // The restored and loaded notes last until the next mark or pattern; the unsaved note stays.
  function clearTransientNote() {
    if (noteText !== '' && noteText !== UNSAVED_NOTE) {
      showNote('');
    }
  }

  const ready = storePromise.then(async (progressStore) => {
    saved = await progressStore.load();
    return progressStore;
  }).catch((error) => {
    reportUnavailable(error);
    return null;
  });

  function reportUnavailable(error) {
    if (!isUnavailable) {
      console.error('Progress cannot be saved:', error);
    }
    isUnavailable = true;
    showNote(UNSAVED_NOTE);
  }

  function showNote(text) {
    noteText = text;
    renderNote(store.getState());
  }

  function renderNote(state) {
    note.textContent = noteText;
    note.hidden = noteText === '' || state.activeLayer !== 'progress';
    note.classList.toggle('progress-note--error', noteText === UNSAVED_NOTE);
  }

  async function restoreFor(pattern) {
    const progressStore = await ready;
    const state = store.getState();
    const isStillShown = progressStore !== null && state.pattern === pattern && state.progress?.stitchedCount === 0;
    if (!isStillShown) {
      return;
    }
    const restored = restoreProgress(pattern, saved);
    if (restored !== null && restored.stitchedCount > 0) {
      store.setState({ progress: restored });
      showNote(RESTORED_NOTE);
    }
  }

  async function saveNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    const progressStore = await ready;
    const { progress, image } = store.getState();
    if (progressStore === null || isUnavailable || progress === null) {
      return;
    }
    try {
      if (progress.stitchedCount > 0) {
        const record = toSavedProgress(progress, image?.fileName ?? '', Date.now());
        await progressStore.save(record);
        saved = record;
      } else if (isSavedProgressOf(saved, progress.pattern)) {
        await progressStore.clear();
        saved = null;
      }
    } catch (error) {
      reportUnavailable(error);
    }
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, SAVE_DELAY_MS);
  }

  function flushOnHide() {
    if (saveTimer !== null && root.visibilityState === 'hidden') {
      saveNow();
    }
  }
  root.addEventListener('visibilitychange', flushOnHide);
  root.addEventListener('pagehide', () => {
    if (saveTimer !== null) {
      saveNow();
    }
  });

  store.subscribe((state, previous) => {
    if (state.pattern !== previous.pattern && state.pattern !== null) {
      approvedPattern = null;
      clearTransientNote();
      restoreFor(state.pattern);
    }
    const isToggle = state.progress !== previous.progress && state.progress !== null
      && state.progress.version > 0 && state.progress.pattern === previous.progress?.pattern;
    if (isToggle) {
      clearTransientNote();
      scheduleSave();
    }
    if (state.activeLayer !== previous.activeLayer) {
      renderNote(state);
    }
  });

  async function confirmFirstMark() {
    await ready;
    const { progress, pattern } = store.getState();
    const needsQuestion = !isUnavailable && pattern !== null && progress !== null
      && progress.stitchedCount === 0 && approvedPattern !== pattern
      && saved !== null && saved.stitchedCount > 0 && !isSavedProgressOf(saved, pattern);
    if (!needsQuestion) {
      return true;
    }
    const question = {
      text: formatReplaceWarning(saved.imageName, saved.stitchedCount, saved.totalCount),
      confirmLabel: 'Start new progress',
    };
    if (saver !== null) {
      const atRisk = saved;
      question.saveFirst = () => saver.saveRecord(atRisk);
    }
    const isConfirmed = await warning.confirm(question);
    if (isConfirmed) {
      approvedPattern = pattern;
    }
    return isConfirmed;
  }

  async function discard() {
    clearTimeout(saveTimer);
    saveTimer = null;
    const progressStore = await ready;
    if (progressStore === null || isUnavailable) {
      return;
    }
    try {
      await progressStore.clear();
      saved = null;
    } catch (error) {
      reportUnavailable(error);
    }
  }

  function adoptProgress(progress, fileName) {
    clearTimeout(saveTimer);
    saveTimer = null;
    approvedPattern = progress.pattern; // the browser's slot is this pattern's from now on
    store.setState({ progress, activeLayer: 'progress' });
    if (noteText !== UNSAVED_NOTE) {
      showNote(formatLoadedNote(fileName));
    }
    // With 0 stitches this deletes this pattern's saved progress, as unmarking does.
    saveNow();
  }

  if (store.getState().pattern !== null) {
    restoreFor(store.getState().pattern);
  }
  return { confirmFirstMark, discard, adoptProgress };
}
