// Drives src/ui/progress.js with the real store, a fake Progress layer and a fake counter output
// (see openspec/specs/stitch-progress/spec.md, "A tap or click toggles a stitch", "A counter
// shows the progress", "The Progress layer starts as the Chart").

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPattern } from '../../src/core/pattern.js';
import { cellAtPoint } from '../../src/core/chart-layout.js';
import { createStore } from '../../src/ui/store.js';
import { createInitialState } from '../../src/ui/app-state.js';
import { setupProgress } from '../../src/ui/progress.js';

// Test fixtures, not palette data (same as the pattern-model spec).
const BLACK = { code: '310', name: 'Black', hex: '#000000' };
const RED = { code: '321', name: 'Red', hex: '#C72B3B' };
const CELLS_20 = { x: 0, y: 0, width: 60, height: 40 };

// Cell 3 is empty; the others can be stitched.
function threeByTwoPattern() {
  return buildPattern({ width: 3, height: 2, cells: [0, 1, 1, -1, 1, 0], colors: [RED, BLACK] });
}

function setup(state = {}, options = undefined) {
  const counter = { textContent: '', hidden: true };
  const root = { querySelector: (selector) => (selector === '[data-role="progress-summary"]' ? counter : null) };
  const store = createStore({ ...createInitialState(), activeLayer: 'progress', frame: { width: 60, height: 40 }, ...state });
  // The Progress layer's cellAt, as if it had just painted the pattern in 20 px cells.
  const layer = { cellAt: (point) => cellAtPoint(CELLS_20, store.getState().pattern, point) };
  const progress = setupProgress(root, store, layer, options);
  return { store, progress, counter };
}

describe('progress state', () => {
  it('starts a fresh progress for every new pattern, and none without a pattern', () => {
    const { store } = setup();
    assert.equal(store.getState().progress, null);
    const pattern = threeByTwoPattern();
    store.setState({ pattern });
    assert.equal(store.getState().progress.pattern, pattern);
    assert.equal(store.getState().progress.stitchedCount, 0);
    store.setState({ pattern: null });
    assert.equal(store.getState().progress, null);
  });

  it('creates the progress of a pattern that already exists at setup', () => {
    const pattern = threeByTwoPattern();
    const { store } = setup({ pattern });
    assert.equal(store.getState().progress.pattern, pattern);
  });

  it('toggles the cell under a tap on the Progress layer', () => {
    const { store, progress } = setup({ pattern: threeByTwoPattern() });
    progress.toggleAt({ x: 50, y: 30 });
    assert.equal(store.getState().progress.stitchedCount, 1);
    assert.equal(store.getState().progress.lastToggled, 5);
    progress.toggleAt({ x: 50, y: 30 });
    assert.equal(store.getState().progress.stitchedCount, 0);
  });

  it('marks nothing on other layers, on an empty cell or outside the grid', () => {
    const { store, progress } = setup({ pattern: threeByTwoPattern(), activeLayer: 'chart' });
    const before = store.getState().progress;
    progress.toggleAt({ x: 50, y: 30 });
    store.setState({ activeLayer: 'progress' });
    progress.toggleAt({ x: 10, y: 30 }); // cell 3 is empty
    progress.toggleAt({ x: 70, y: 30 }); // outside
    assert.equal(store.getState().progress, before);
  });

  it('toggles the cell at the frame centre for the keyboard', () => {
    const { store, progress } = setup({ pattern: threeByTwoPattern() }); // centre (30, 20) = cell 4
    progress.toggleCentre();
    assert.equal(store.getState().progress.lastToggled, 4);
  });

  it('knows whether stitches are marked, and how many', () => {
    const { progress } = setup({ pattern: threeByTwoPattern() });
    assert.equal(progress.hasMarkedStitches(), false);
    progress.toggleAt({ x: 50, y: 30 });
    assert.equal(progress.hasMarkedStitches(), true);
    assert.deepEqual(progress.markedCounts(), { stitched: 1, total: 5 });
  });
});

describe('progress counter', () => {
  it('shows the count on the Progress layer and hides it on the others', () => {
    const { store, progress, counter } = setup({ pattern: threeByTwoPattern() });
    assert.equal(counter.hidden, false);
    assert.equal(counter.textContent, 'Stitched 0 of 5 (0 %)');
    progress.toggleAt({ x: 50, y: 30 });
    assert.equal(counter.textContent, 'Stitched 1 of 5 (20 %)');
    store.setState({ activeLayer: 'chart' });
    assert.equal(counter.hidden, true);
  });

  it('is hidden without a pattern', () => {
    const { counter } = setup();
    assert.equal(counter.hidden, true);
  });
});

describe('progress: asking before the first mark', () => {
  // A confirmFirstMark that records its calls and answers with the given value.
  function asker(answer) {
    const asked = [];
    const confirmFirstMark = () => {
      asked.push(true);
      return answer instanceof Promise ? answer : Promise.resolve(answer);
    };
    return { asked, confirmFirstMark };
  }

  it('marks nothing when the user keeps the saved progress', async () => {
    const { asked, confirmFirstMark } = asker(false);
    const { store, progress } = setup({ pattern: threeByTwoPattern() }, { confirmFirstMark });
    await progress.toggleAt({ x: 50, y: 30 });
    assert.equal(asked.length, 1);
    assert.equal(store.getState().progress.stitchedCount, 0);
  });

  it('marks after a yes and does not ask while marks exist', async () => {
    const { asked, confirmFirstMark } = asker(true);
    const { store, progress } = setup({ pattern: threeByTwoPattern() }, { confirmFirstMark });
    await progress.toggleAt({ x: 50, y: 30 });
    await progress.toggleAt({ x: 30, y: 30 });
    assert.equal(asked.length, 1);
    assert.equal(store.getState().progress.stitchedCount, 2);
  });

  it('marks nothing when the pattern changed during the question', async () => {
    let answer;
    const { confirmFirstMark } = asker(new Promise((resolve) => { answer = resolve; }));
    const { store, progress } = setup({ pattern: threeByTwoPattern() }, { confirmFirstMark });
    const pending = progress.toggleAt({ x: 50, y: 30 });
    store.setState({ pattern: threeByTwoPattern() });
    answer(true);
    await pending;
    assert.equal(store.getState().progress.stitchedCount, 0);
  });

  it('does not ask for an empty cell or outside the grid', async () => {
    const { asked, confirmFirstMark } = asker(true);
    const { progress } = setup({ pattern: threeByTwoPattern() }, { confirmFirstMark });
    await progress.toggleAt({ x: 10, y: 30 });
    await progress.toggleAt({ x: 70, y: 30 });
    assert.equal(asked.length, 0);
  });
});
