// The modal question before a new pattern would replace marked stitches: the
// <dialog data-role="progress-warning"> of index.html (openspec/specs/stitch-progress/spec.md,
// "Changing the pattern settings asks first", "Loading another image asks first", "The warning
// dialogs offer to save the progress first"). The native modal dialog traps the focus, starts on
// the autofocus button (Keep my progress) and closes on Esc; this module only sets the texts,
// runs the optional Save progress first and turns the answer into a Promise.

import { formatImageWarning, formatSettingsWarning } from '../core/progress.js';
import { formatSavedFileLine, SAVE_FAILED_TEXT } from '../core/progress-file.js';

/**
 * Connects the warning dialog.
 * root  element (or document) containing [data-role="progress-warning"]
 * Returns { confirm({ text, confirmLabel, saveFirst }) }: shows text (as plain text) and the
 * confirm button's label, opens the dialog and resolves true when the user presses that button,
 * false for Keep my progress, Esc or any other way of closing it.
 * saveFirst  optional () => Promise<fileName>: shows Save progress first, which calls it and
 *            then shows 'Saved NAME.' (or the failure line) without answering the question.
 *            Without it the button is hidden.
 */
export function createProgressWarning(root) {
  const dialog = root.querySelector('[data-role="progress-warning"]');
  const text = dialog.querySelector('[data-role="progress-warning-text"]');
  const note = dialog.querySelector('[data-role="progress-warning-note"]');
  const keepButton = dialog.querySelector('[data-action="keep-progress"]');
  const saveFirstButton = dialog.querySelector('[data-action="save-progress-first"]');
  const confirmButton = dialog.querySelector('[data-action="confirm-lose-progress"]');
  let answer = null;
  let saveCurrentQuestion = null; // the saveFirst of the open question
  let question = 0; // increases with every question, so a late save result can be ignored

  // Resolves the open question (once) and closes the dialog.
  function finish(isConfirmed) {
    if (answer === null) {
      return;
    }
    const resolve = answer;
    answer = null;
    dialog.close();
    resolve(isConfirmed);
  }

  keepButton.addEventListener('click', () => finish(false));
  confirmButton.addEventListener('click', () => finish(true));
  dialog.addEventListener('close', () => finish(false)); // Esc, or the dialog closed otherwise
  saveFirstButton.addEventListener('click', saveFirst);

  function showNote(noteText) {
    note.textContent = noteText;
    note.hidden = noteText === '';
  }

  // Downloads the progress at risk and says so; the question stays open. The button is
  // disabled meanwhile, so one press gives one file.
  async function saveFirst() {
    if (saveCurrentQuestion === null || saveFirstButton.disabled) {
      return;
    }
    const askedQuestion = question;
    saveFirstButton.disabled = true;
    let line;
    try {
      line = formatSavedFileLine(await saveCurrentQuestion());
    } catch (error) {
      console.error('Could not save the progress file:', error);
      line = SAVE_FAILED_TEXT;
    }
    if (askedQuestion !== question || answer === null) {
      return; // the dialog was answered (or asks something else) meanwhile
    }
    saveFirstButton.disabled = false;
    // Disabling the focused button moved the focus away; give it back.
    saveFirstButton.focus();
    showNote(line);
  }

  function confirm({ text: questionText, confirmLabel, saveFirst: save = null }) {
    finish(false); // a question still open is answered "keep" before the new one
    question += 1;
    saveCurrentQuestion = save;
    text.textContent = questionText;
    confirmButton.textContent = confirmLabel;
    saveFirstButton.hidden = save === null;
    saveFirstButton.disabled = false;
    showNote('');
    dialog.showModal();
    return new Promise((resolve) => {
      answer = resolve;
    });
  }

  return { confirm };
}

/**
 * The guard the settings form and the image input ask before replacing the pattern.
 * progress     the object returned by setupProgress (./progress.js)
 * warning      the object returned by createProgressWarning
 * persistence  optional { discard() } (./progress-persistence.js): a confirmed loss also deletes
 *              the saved progress, so it cannot come back later
 * saver        optional { saveCurrent() } (./progress-file.js): offered as Save progress first
 * Returns {
 *   hasMarkedStitches()       true while at least one stitch is marked
 *   confirmSettings()         Promise<boolean>: may the settings change?
 *   confirmImage(fileName)    Promise<boolean>: may fileName replace the image? (true at once
 *                             without marked stitches)
 * }
 */
export function createProgressGuard(progress, warning, persistence = null, saver = null) {
  const saveFirst = saver?.saveCurrent;

  async function confirmLoss(question) {
    const isConfirmed = await warning.confirm(question);
    if (isConfirmed && persistence !== null) {
      await persistence.discard();
    }
    return isConfirmed;
  }

  return {
    hasMarkedStitches: progress.hasMarkedStitches,
    confirmSettings() {
      const { stitched, total } = progress.markedCounts();
      return confirmLoss({ text: formatSettingsWarning(stitched, total), confirmLabel: 'Change settings', saveFirst });
    },
    async confirmImage(fileName) {
      if (!progress.hasMarkedStitches()) {
        return true;
      }
      const { stitched, total } = progress.markedCounts();
      return confirmLoss({ text: formatImageWarning(fileName, stitched, total), confirmLabel: 'Load image', saveFirst });
    },
  };
}
