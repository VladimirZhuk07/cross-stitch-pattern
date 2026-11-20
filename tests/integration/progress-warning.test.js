// Drives src/ui/progress-warning.js with a fake <dialog> (see openspec/specs/stitch-progress/spec.md,
// "Changing the pattern settings asks first", "Loading another image asks first").

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createProgressWarning, createProgressGuard } from '../../src/ui/progress-warning.js';
import { fakeElement } from '../helpers/fake-legend-dom.js';

// The dialog of index.html as fake elements: showModal opens it, close closes it and fires
// 'close', like the native element (Esc fires 'cancel' and then closes).
function createDialogDom() {
  const text = fakeElement('p', { 'data-role': 'progress-warning-text' });
  const keep = fakeElement('button', { 'data-action': 'keep-progress' });
  const confirmButton = fakeElement('button', { 'data-action': 'confirm-lose-progress' });
  const dialog = fakeElement('dialog', { 'data-role': 'progress-warning' }, [text, keep, confirmButton]);
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
  return { root, dialog, text, keep, confirmButton, pressEscape };
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

  it('keeps the saved progress when the user keeps the marks', async () => {
    const { guard, discarded } = await guardAnswering(false);
    assert.equal(await guard.confirmSettings(), false);
    assert.equal(await guard.confirmImage('cat.png'), false);
    assert.equal(discarded.length, 0);
  });
});
