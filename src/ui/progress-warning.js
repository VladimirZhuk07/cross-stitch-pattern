// The modal question before a new pattern would replace marked stitches: the
// <dialog data-role="progress-warning"> of index.html (openspec/specs/stitch-progress/spec.md,
// "Changing the pattern settings asks first", "Loading another image asks first"). The native
// modal dialog traps the focus, starts on the autofocus button (Keep my progress) and closes
// on Esc; this module only sets the texts and turns the answer into a Promise.

import { formatImageWarning, formatSettingsWarning } from '../core/progress.js';

/**
 * Connects the warning dialog.
 * root  element (or document) containing [data-role="progress-warning"]
 * Returns { confirm({ text, confirmLabel }) }: shows text (as plain text) and the confirm
 * button's label, opens the dialog and resolves true when the user presses that button, false
 * for Keep my progress, Esc or any other way of closing it.
 */
export function createProgressWarning(root) {
  const dialog = root.querySelector('[data-role="progress-warning"]');
  const text = dialog.querySelector('[data-role="progress-warning-text"]');
  const keepButton = dialog.querySelector('[data-action="keep-progress"]');
  const confirmButton = dialog.querySelector('[data-action="confirm-lose-progress"]');
  let answer = null;

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

  function confirm({ text: question, confirmLabel }) {
    finish(false); // a question still open is answered "keep" before the new one
    text.textContent = question;
    confirmButton.textContent = confirmLabel;
    dialog.showModal();
    return new Promise((resolve) => {
      answer = resolve;
    });
  }

  return { confirm };
}

/**
 * The guard the settings form and the image input ask before replacing the pattern.
 * progress  the object returned by setupProgress (./progress.js)
 * warning   the object returned by createProgressWarning
 * Returns {
 *   hasMarkedStitches()       true while at least one stitch is marked
 *   confirmSettings()         Promise<boolean>: may the settings change?
 *   confirmImage(fileName)    Promise<boolean>: may fileName replace the image? (true at once
 *                             without marked stitches)
 * }
 */
export function createProgressGuard(progress, warning) {
  return {
    hasMarkedStitches: progress.hasMarkedStitches,
    confirmSettings() {
      const { stitched, total } = progress.markedCounts();
      return warning.confirm({ text: formatSettingsWarning(stitched, total), confirmLabel: 'Change settings' });
    },
    async confirmImage(fileName) {
      if (!progress.hasMarkedStitches()) {
        return true;
      }
      const { stitched, total } = progress.markedCounts();
      return warning.confirm({ text: formatImageWarning(fileName, stitched, total), confirmLabel: 'Load image' });
    },
  };
}
