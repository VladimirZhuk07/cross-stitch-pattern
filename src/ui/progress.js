// The stitches the user marks on the Progress layer: owns state.progress (see ./app-state.js),
// turns taps and the keyboard into toggles, and shows the counter line under the frame
// (openspec/specs/stitch-progress/spec.md). Progress lives as long as its pattern; keeping it
// across page loads is the job of a later change.

import { EMPTY_CELL } from '../core/pattern.js';
import { createProgress, toggleStitch, formatProgressSummary } from '../core/progress.js';

const PROGRESS_LAYER = 'progress';

/**
 * Keeps state.progress in step with state.pattern (a fresh Progress for every new pattern) and
 * renders the counter [data-role="progress-summary"], shown only on the Progress layer.
 * root    element (or document) containing the counter
 * store   the app store from ./store.js
 * layer   the Progress view layer (./layers/progress-layer.js); its cellAt(point) finds the
 *         cell under a frame point in what it last painted
 * options optional { confirmFirstMark() → Promise<boolean> } (see ./progress-persistence.js):
 *         asked before the first mark of a pattern; false marks nothing
 * Returns {
 *   toggleAt(point)       toggles the cell under a frame point (CSS px), on the Progress layer
 *                         only; returns a Promise when it had to ask first
 *   toggleCentre()        toggles the cell at the frame centre (the keyboard marker's cell)
 *   hasMarkedStitches()   true while at least one stitch is marked
 *   markedCounts()        { stitched, total } of the current progress ({ 0, 0 } without one)
 * }
 */
export function setupProgress(root, store, layer, options = {}) {
  const counter = root.querySelector('[data-role="progress-summary"]');

  function toggleAt(point) {
    const state = store.getState();
    if (state.activeLayer !== PROGRESS_LAYER || state.progress === null) {
      return undefined;
    }
    const cell = layer.cellAt(point);
    if (cell === null || state.pattern.cells[cell.index] === EMPTY_CELL) {
      return undefined;
    }
    if (state.progress.stitchedCount === 0 && options.confirmFirstMark) {
      return toggleAfterConfirming(state.progress, cell.index);
    }
    store.setState({ progress: toggleStitch(state.progress, cell.index) });
    return undefined;
  }

  // The first mark of a pattern may replace saved progress: ask, then mark only if nothing
  // changed meanwhile (another pattern, or marks made in another way).
  async function toggleAfterConfirming(askedProgress, cellIndex) {
    if (!(await options.confirmFirstMark())) {
      return;
    }
    if (store.getState().progress === askedProgress) {
      store.setState({ progress: toggleStitch(askedProgress, cellIndex) });
    }
  }

  function toggleCentre() {
    const { frame } = store.getState();
    toggleAt({ x: frame.width / 2, y: frame.height / 2 });
  }

  function markedCounts() {
    const { progress } = store.getState();
    return progress === null ? { stitched: 0, total: 0 } : { stitched: progress.stitchedCount, total: progress.totalCount };
  }

  function renderCounter(state) {
    counter.hidden = state.activeLayer !== PROGRESS_LAYER || state.progress === null;
    if (state.progress !== null) {
      counter.textContent = formatProgressSummary(state.progress.stitchedCount, state.progress.totalCount);
    }
  }

  function progressFor(pattern) {
    return pattern === null ? null : createProgress(pattern);
  }

  store.setState({ progress: progressFor(store.getState().pattern) });
  renderCounter(store.getState());
  store.subscribe((state, previous) => {
    if (state.pattern !== previous.pattern) {
      store.setState({ progress: progressFor(state.pattern) }); // a new round renders the counter
      return;
    }
    if (state.progress !== previous.progress || state.activeLayer !== previous.activeLayer) {
      renderCounter(state);
    }
  });

  return {
    toggleAt,
    toggleCentre,
    hasMarkedStitches: () => markedCounts().stitched > 0,
    markedCounts,
  };
}
