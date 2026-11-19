// Drives src/ui/legend.js with a fake legend DOM and the real store (see
// openspec/specs/stitch-chart/spec.md, "One legend color can be selected", "Esc clears the
// selection", "The selection follows the pattern and the view", "The selected legend row
// stands out").

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPattern } from '../../src/core/pattern.js';
import { createStore } from '../../src/ui/store.js';
import { createInitialState } from '../../src/ui/app-state.js';
import { setupLegend } from '../../src/ui/legend.js';
import { createLegendDom } from '../helpers/fake-legend-dom.js';

// Test fixtures, not palette data (same as the pattern-model spec).
const BLACK = { code: '310', name: 'Black', hex: '#000000' };
const RED = { code: '321', name: 'Red', hex: '#C72B3B' };

// Legend 1 = 310 (3 stitches), 2 = 321 (2 stitches).
function threeByTwoPattern() {
  return buildPattern({ width: 3, height: 2, cells: [0, 1, 1, -1, 1, 0], colors: [RED, BLACK] });
}

function setup(state = {}) {
  const dom = createLegendDom();
  const store = createStore({ ...createInitialState(), pattern: threeByTwoPattern(), activeLayer: 'chart', ...state });
  setupLegend(dom.root, store);
  const rowElements = () => dom.rows.children;
  const button = (rowIndex) => rowElements()[rowIndex].querySelector('[data-action="highlight-color"]');
  const pressedStates = () => rowElements().map((_, index) => button(index).getAttribute('aria-pressed'));
  const selectedRows = () => rowElements().map((row) => row.classList.contains('legend__row--selected'));
  return { dom, store, rowElements, button, pressedStates, selectedRows };
}

describe('legend highlight selection', () => {
  it('marks every row with its legend index and names its button', () => {
    const { rowElements, button } = setup();
    assert.deepEqual(rowElements().map((row) => row.dataset.legendIndex), ['0', '1']);
    assert.equal(button(1).getAttribute('aria-label'), 'Highlight color 2, DMC 321 Red');
    assert.equal(button(0).getAttribute('aria-label'), 'Highlight color 1, DMC 310 Black');
  });

  it('selects the color of a clicked row', () => {
    const { rowElements, store, pressedStates, selectedRows } = setup();
    rowElements()[1].querySelector('[data-field="name"]').dispatch('click');
    assert.equal(store.getState().highlightedColor, 1);
    assert.deepEqual(pressedStates(), ['false', 'true']);
    assert.deepEqual(selectedRows(), [false, true]);
  });

  it('selects through the number button (Enter and Space click a native button)', () => {
    const { button, store } = setup();
    button(1).dispatch('click');
    assert.equal(store.getState().highlightedColor, 1);
  });

  it('moves the selection to another row', () => {
    const { rowElements, store, pressedStates, selectedRows } = setup();
    rowElements()[1].dispatch('click');
    rowElements()[0].dispatch('click');
    assert.equal(store.getState().highlightedColor, 0);
    assert.deepEqual(pressedStates(), ['true', 'false']);
    assert.deepEqual(selectedRows(), [true, false]);
  });

  it('clears the selection when the selected row is clicked again', () => {
    const { rowElements, store, pressedStates, selectedRows } = setup();
    rowElements()[0].dispatch('click');
    rowElements()[0].dispatch('click');
    assert.equal(store.getState().highlightedColor, null);
    assert.deepEqual(pressedStates(), ['false', 'false']);
    assert.deepEqual(selectedRows(), [false, false]);
  });

  it('ignores clicks in the rows container outside any row', () => {
    const { dom, store } = setup();
    dom.rows.dispatch('click');
    assert.equal(store.getState().highlightedColor, null);
  });

  it('switches to the Chart when a color is selected on another layer', () => {
    const { rowElements, store } = setup({ activeLayer: 'dmc' });
    rowElements()[1].dispatch('click');
    assert.equal(store.getState().activeLayer, 'chart');
    assert.equal(store.getState().highlightedColor, 1);
  });

  it('keeps the Progress layer, which shows the highlight too', () => {
    const { rowElements, store } = setup({ activeLayer: 'progress' });
    rowElements()[1].dispatch('click');
    assert.equal(store.getState().activeLayer, 'progress');
    assert.equal(store.getState().highlightedColor, 1);
  });

  it('does not switch the layer when the selection is cleared', () => {
    const { rowElements, store } = setup({ activeLayer: 'chart' });
    rowElements()[1].dispatch('click');
    store.setState({ activeLayer: 'original' });
    rowElements()[1].dispatch('click');
    assert.equal(store.getState().highlightedColor, null);
    assert.equal(store.getState().activeLayer, 'original');
  });

  it('clears the selection on Esc', () => {
    const { dom, rowElements, store, pressedStates } = setup();
    rowElements()[1].dispatch('click');
    dom.root.dispatch('keydown', { key: 'Escape' });
    assert.equal(store.getState().highlightedColor, null);
    assert.deepEqual(pressedStates(), ['false', 'false']);
  });

  it('writes no state on Esc or other keys without a selection', () => {
    const { dom, store } = setup();
    const before = store.getState();
    dom.root.dispatch('keydown', { key: 'Escape' });
    dom.root.dispatch('keydown', { key: 'Enter' });
    assert.equal(store.getState(), before);
  });

  it('keeps the selection on keys other than Esc', () => {
    const { dom, rowElements, store } = setup();
    rowElements()[1].dispatch('click');
    dom.root.dispatch('keydown', { key: 'Enter' });
    assert.equal(store.getState().highlightedColor, 1);
  });

  it('clears the selection when the pattern changes and starts the new rows unpressed', () => {
    const { rowElements, store, pressedStates, selectedRows } = setup();
    rowElements()[1].dispatch('click');
    store.setState({ pattern: threeByTwoPattern() });
    assert.equal(store.getState().highlightedColor, null);
    assert.deepEqual(pressedStates(), ['false', 'false']);
    assert.deepEqual(selectedRows(), [false, false]);
  });

  it('keeps the selection while the layer, zoom or frame change', () => {
    const { rowElements, store, pressedStates } = setup();
    rowElements()[1].dispatch('click');
    store.setState({ activeLayer: 'original', viewport: { scale: 2, offsetX: 0, offsetY: 0 }, frame: { width: 10, height: 10 } });
    assert.equal(store.getState().highlightedColor, 1);
    assert.deepEqual(pressedStates(), ['false', 'true']);
  });
});
