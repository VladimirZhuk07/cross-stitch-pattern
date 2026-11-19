// The stitched cells of the Progress layer: a picture from ./pattern-picture.js that shows each
// stitched cell in its full DMC color and is transparent elsewhere; zoomed out, a pixel averages
// the stitched cells of its block (alpha = stitched share), see the stitched mask of fillLevelRows
// in ../../core/level-pixels.js. A toggle refreshes one pixel per built picture instead of
// rebuilding them (design D5 of add-progress-view).

import { colorTable, fillLevelRows } from '../../core/level-pixels.js';
import { createPatternPicture } from './pattern-picture.js';

/**
 * Creates the stitched picture of one layer. createCellCanvas(width, height) makes its canvases.
 * Returns { update(pattern, progress), draw(ctx, frame, pattern, range) }:
 *   update  follows state.progress (a Progress of ../../core/progress.js or null): nothing to
 *           draw without stitches or for a Progress of another pattern; the next toggle of the
 *           same Progress line (version + 1) refreshes one cell; any other change rebuilds
 *   draw    draws the picture with the context's current smoothing and returns true when it is
 *           complete (always true when there is nothing to draw)
 */
export function createStitchedPicture(createCellCanvas) {
  let shown = { pattern: null, progress: null, picture: null };

  function startPicture() {
    return createPatternPicture({
      createCellCanvas,
      // Reads the newest bits on every call, so rows built later and refreshed cells match.
      fillRows: (grid, level, region, rowStart, rowEnd, out) => fillLevelRows(grid, shown.table, level, region, rowStart, rowEnd, out, shown.progress.bits),
    });
  }

  function update(pattern, progress) {
    const hasStitches = progress !== null && progress.pattern === pattern && progress.stitchedCount > 0;
    if (!hasStitches) {
      clear();
      return;
    }
    if (progress === shown.progress) {
      return;
    }
    const isNextToggle = shown.picture !== null && shown.pattern === pattern
      && progress.version === shown.progress.version + 1 && progress.lastToggled !== null;
    if (isNextToggle) {
      shown.progress = progress;
      shown.picture.refreshCell(pattern, progress.lastToggled % pattern.width, Math.floor(progress.lastToggled / pattern.width));
      return;
    }
    clear();
    shown = { pattern, progress, table: stitchColors(pattern), picture: null };
    shown.picture = startPicture();
  }

  function clear() {
    if (shown.picture !== null) {
      shown.picture.release();
    }
    shown = { pattern: null, progress: null, picture: null };
  }

  function draw(ctx, frame, pattern, range) {
    if (shown.picture === null) {
      return true;
    }
    return shown.picture.draw(ctx, frame, pattern, range);
  }

  return { update, draw };
}

// The full DMC color of each legend entry; empty cells (and unstitched ones) transparent.
function stitchColors(pattern) {
  return colorTable(pattern.legend.map((entry) => entry.hex), null);
}
