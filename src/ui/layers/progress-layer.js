// View layer 4: Progress. The Chart layer (./chart-layer.js) with the stitched cells of
// state.progress in their DMC color and the keyboard marker; see
// openspec/specs/stitch-progress/spec.md.

import { createChartLayer } from './chart-layer.js';

/**
 * Creates the Progress layer, available once a pattern exists.
 * options.createCellCanvas(width, height)  as for createChartLayer
 * Returns a view layer { id: 'progress', isAvailable, render, cellAt } (see createChartLayer).
 */
export function createProgressLayer(options = {}) {
  return createChartLayer({ ...options, id: 'progress', showsProgress: true });
}
