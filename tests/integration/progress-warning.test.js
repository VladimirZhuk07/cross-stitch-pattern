// Drives src/ui/progress-warning.js with a fake <dialog> (see openspec/specs/stitch-progress/spec.md,
// "Changing the pattern settings asks first", "Loading another image asks first", "The warning
// dialogs offer to save the progress first").

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createProgressWarning, createProgressGuard } from '../../src/ui/progress-warning.js';
import { fakeElement } from '../helpers/fake-legend-dom.js';

// The dialog of index.html as fake elements: showModal opens it, close closes it and fires
// 'close', like the native element (Esc fires 'cancel' and then closes).
function createDialogDom() {
  const text = fakeElement('p', { 'data-role': 'progress-warning-text' });
  const note = fakeElement('p', { 'data-role': 'progress-warning-note' });
  note.hidden = true;
  const keep = fakeElement('button', { 'data-action': 'keep-progress' });
  const saveFirst = fakeElement('button', { 'data-action': 'save-progress-first' });
  saveFirst.disabled = false;
  saveFirst.focusCount = 0;
  saveFirst.focus = () => {
    saveFirst.focusCount += 1;
  };
  const confirmButton = fakeElement('button', { 'data-action': 'confirm-lose-progress' });
  const dialog = fakeElement('dialog', { 'data-role': 'progress-warning' }, [text, note, keep, saveFirst, confirmButton]);
  dialog.open = false;
  dialog.showModal = () => {
    dialog.open = true;
  };
  dialog.close = () => {
    if (dialog.open) {
      dialog.open = false;
      dialog.dispatch('close');
    }
  };
  const pressEscape = () => {
    dialog.dispatch('cancel');
    dialog.close();
  };
  const root = fakeElement('body', {}, [dialog]);
  return { root, dialog, text, note, keep, saveFirst, confirmButton, pressEscape };
}

const QUESTION = { text: 'Load <b>x</b>.png? Your progress on the current pattern (12 of 6,700 stitches) will be lost.', confirmLabel: 'Load image' };

describe('progress warning dialog', () => {
  it('shows the question as text with the confirm label and opens modally', () => {
    const dom = createDialogDom();
    createProgressWarning(dom.root).confirm(QUESTION);
    assert.equal(dom.dialog.open, true);
    assert.equal(dom.text.textContent, QUESTION.text);
    assert.equal(dom.confirmButton.textContent, 'Load image');
  });

  it('answers true when the user confirms, and closes', async () => {
    const dom = createDialogDom();
    const answer = createProgressWarning(dom.root).confirm(QUESTION);
    dom.confirmButton.dispatch('click');
    assert.equal(await answer, true);
    assert.equal(dom.dialog.open, false);
  });

  it('answers false for Keep my progress', async () => {
    const dom = createDialogDom();
    const answer = createProgressWarning(dom.root).confirm(QUESTION);
    dom.keep.dispatch('click');
    assert.equal(await answer, false);
    assert.equal(dom.dialog.open, false);
  });

  it('answers false for Esc', async () => {
    const dom = createDialogDom();
    const answer = createProgressWarning(dom.root).confirm(QUESTION);
    dom.pressEscape();
    assert.equal(await answer, false);
  });

  it('can ask again after an answer, with another label', async () => {
    const dom = createDialogDom();
    const warning = createProgressWarning(dom.root);
    const first = warning.confirm(QUESTION);
    dom.keep.dispatch('click');
    await first;
    const second = warning.confirm({ text: 'Change the pattern settings? …', confirmLabel: 'Change settings' });
    assert.equal(dom.confirmButton.textContent, 'Change settings');
    dom.confirmButton.dispatch('click');
    assert.equal(await second, true);
  });
});

// Lets pending promise callbacks run.
const settle = () => new Promise((resolve) => setImmediate(resolve));

// A saveFirst function whose Promise the test resolves or rejects by hand.
function manualSave() {
  const calls = [];
  const saveFirst = () => new Promise((resolve, reject) => {
    calls.push({ resolve, reject });
  });
  return { saveFirst, calls };
}

// 'pending' while the promise has not settled, otherwise its value.
async function stateOf(promise) {
  const pending = Symbol('pending');
  const value = await Promise.race([promise, settle().then(() => pending)]);
  return value === pending ? 'pending' : value;
}

describe('Save progress first in the warning dialog', () => {
  it('is hidden without saveFirst', () => {
    const dom = createDialogDom();
    createProgressWarning(dom.root).confirm(QUESTION);
    assert.equal(dom.saveFirst.hidden, true);
    assert.equal(dom.note.hidden, true);
  });

  it('saves once, disabled while it runs, then shows the saved line and keeps asking', async () => {
    const dom = createDialogDom();
    const { saveFirst, calls } = manualSave();
    const answer = createProgressWarning(dom.root).confirm({ ...QUESTION, saveFirst });
    assert.equal(dom.saveFirst.hidden, false);
    dom.saveFirst.dispatch('click');
    assert.equal(calls.length, 1);
    assert.equal(dom.saveFirst.disabled, true);
    dom.saveFirst.dispatch('click'); // a second press while saving does nothing
    assert.equal(calls.length, 1);
    calls[0].resolve('cat.stitch');
    await settle();
    assert.equal(dom.saveFirst.disabled, false);
    assert.equal(dom.saveFirst.focusCount, 1, 'the focus goes back to the button');
    assert.equal(dom.note.hidden, false);
    assert.equal(dom.note.textContent, 'Saved cat.stitch.');
    assert.equal(dom.dialog.open, true);
    assert.equal(await stateOf(answer), 'pending');
  });

  it('can save again', async () => {
    const dom = createDialogDom();
    let count = 0;
    createProgressWarning(dom.root).confirm({ ...QUESTION, saveFirst: async () => `cat-${++count}.stitch` });
    dom.saveFirst.dispatch('click');
    await settle();
    dom.saveFirst.dispatch('click');
    await settle();
    assert.equal(dom.note.textContent, 'Saved cat-2.stitch.');
  });

  it('shows the failure line when the file cannot be made', async (t) => {
    const errors = t.mock.method(console, 'error', () => {});
    const dom = createDialogDom();
    createProgressWarning(dom.root).confirm({ ...QUESTION, saveFirst: async () => { throw new Error('no streams'); } });
    dom.saveFirst.dispatch('click');
    await settle();
    assert.equal(dom.note.textContent, 'Could not save the progress file.');
    assert.equal(dom.note.hidden, false);
    assert.equal(dom.saveFirst.disabled, false);
    assert.equal(errors.mock.callCount(), 1);
  });

  it('starts a new question without the line', async () => {
    const dom = createDialogDom();
    const warning = createProgressWarning(dom.root);
    const first = warning.confirm({ ...QUESTION, saveFirst: async () => 'cat.stitch' });
    dom.saveFirst.dispatch('click');
    await settle();
    dom.keep.dispatch('click');
    await first;
    warning.confirm(QUESTION);
    assert.equal(dom.note.hidden, true);
    assert.equal(dom.note.textContent, '');
    assert.equal(dom.saveFirst.hidden, true);
  });

  it('ignores a save that finishes after the dialog closed', async () => {
    const dom = createDialogDom();
    const { saveFirst, calls } = manualSave();
    const warning = createProgressWarning(dom.root);
    const first = warning.confirm({ ...QUESTION, saveFirst });
    dom.saveFirst.dispatch('click');
    dom.keep.dispatch('click');
    assert.equal(await first, false);
    warning.confirm(QUESTION);
    calls[0].resolve('cat.stitch');
    await settle();
    assert.equal(dom.note.hidden, true);
    assert.equal(dom.saveFirst.disabled, false);
  });
});

describe('progress guard', () => {
  const progress = { hasMarkedStitches: () => true, markedCounts: () => ({ stitched: 12, total: 6700 }) };

  async function guardAnswering(answer) {
    const discarded = [];
    const warning = { confirm: async () => answer };
    const persistence = { discard: async () => { discarded.push(true); } };
    const guard = createProgressGuard(progress, warning, persistence);
    return { guard, discarded };
  }

  it('deletes the saved progress after a confirmed settings change or new image', async () => {
    const { guard, discarded } = await guardAnswering(true);
    assert.equal(await guard.confirmSettings(), true);
    assert.equal(await guard.confirmImage('cat.png'), true);
    assert.equal(discarded.length, 2);
  });

  it('offers the saver with the settings and image questions', async () => {
    const questions = [];
    const warning = { confirm: async (question) => { questions.push(question); return false; } };
    const saver = { saveCurrent: async () => 'cat.stitch' };
    const guard = createProgressGuard(progress, warning, null, saver);
    await guard.confirmSettings();
    await guard.confirmImage('dog.png');
    assert.equal(questions.length, 2);
    for (const question of questions) {
      assert.equal(question.saveFirst, saver.saveCurrent);
    }
  });

  it('keeps the saved progress when the user keeps the marks', async () => {
    const { guard, discarded } = await guardAnswering(false);
    assert.equal(await guard.confirmSettings(), false);
    assert.equal(await guard.confirmImage('cat.png'), false);
    assert.equal(discarded.length, 0);
  });
});
