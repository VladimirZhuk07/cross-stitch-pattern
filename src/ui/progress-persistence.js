// Keeps the marked stitches in this browser and brings them back (openspec/specs/stitch-progress/
// spec.md, "Progress is saved in this browser" and the requirements after it; design D4 of
// persist-progress). Saving is debounced; a page that is hidden is saved at once. A new pattern
// whose fingerprint matches the saved progress gets its marks back. The first mark on another
// pattern asks before it replaces the saved progress. Storage problems show a note once and
// never stop marking.

import {
  restoreProgress,
  toSavedProgress,
  isSavedProgressOf,
  formatReplaceWarning,
  RESTORED_NOTE,
  UNSAVED_NOTE,
} from '../core/progress.js';

/** Quiet time after the last toggle before the progress is written. */
export const SAVE_DELAY_MS = 500;

/**
 * Connects state.progress to the browser storage.
 * root          the document (visibility events) or an element with the same API; contains
 *               the note [data-role="progress-note"]
 * store         the app store from ./store.js
 * storePromise  a Promise of { load(), save(record), clear() } (openProgressStore in
 *               ../io/progress-store.js); a rejection means "storage unavailable"
 * warning       { confirm({ text, confirmLabel }) } (createProgressWarning in ./progress-warning.js)
 * Returns {
 *   confirmFirstMark()  Promise<boolean>: may the first mark of this pattern be made? Asks
 *                       only when it would replace the saved progress of another pattern
 *   discard()           Promise: drops a pending save and deletes the saved progress (after
 *                       the user confirmed losing the progress)
 * }
 */
export function setupProgressPersistence(root, store, storePromise, warning) {
  const note = root.querySelector('[data-role="progress-note"]');
  let saved = null; // what storage holds, as far as this page knows
  let isUnavailable = false;
  let approvedPattern = null; // the pattern whose first mark the user allowed
  let saveTimer = null;
  let noteText = '';

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
      if (noteText === RESTORED_NOTE) {
        showNote('');
      }
      restoreFor(state.pattern);
    }
    const isToggle = state.progress !== previous.progress && state.progress !== null
      && state.progress.version > 0 && state.progress.pattern === previous.progress?.pattern;
    if (isToggle) {
      if (noteText === RESTORED_NOTE) {
        showNote('');
      }
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
    const isConfirmed = await warning.confirm({
      text: formatReplaceWarning(saved.imageName, saved.stitchedCount, saved.totalCount),
      confirmLabel: 'Start new progress',
    });
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

  if (store.getState().pattern !== null) {
    restoreFor(store.getState().pattern);
  }
  return { confirmFirstMark, discard };
}
