// The highlight overlay of the Chart and Progress layers: a picture from ./pattern-picture.js
// that is red where its block holds a stitch of the selected legend color and transparent
// elsewhere, at a level whose pixels cover at least one device pixel, drawn without smoothing,
// so a single highlighted stitch is never averaged away (../../core/highlight.js).

import {
  HIGHLIGHT_SINGLE_PICTURE_MAX_SIDE,
  HIGHLIGHT_CACHE_BUDGET_BYTES,
  fillHighlightRows,
  highlightLevel,
} from '../../core/highlight.js';
import { createPatternPicture } from './pattern-picture.js';

/** A legend index no cell has: no color is highlighted. */
export const NO_HIGHLIGHT = -2;

/**
 * Creates the highlight picture of one layer. createCellCanvas(width, height) makes its canvases.
 * Returns { select(pattern, highlightedColor), draw(ctx, frame, pattern, range) }: select
 * releases the old picture when the pattern or the color changed and returns the legend index
 * to highlight (NO_HIGHLIGHT for none, or for an index the pattern does not have); draw then
 * draws the picture and returns true when it is complete (always true without a selection).
 */
export function createHighlightPicture(createCellCanvas) {
  let selected = { pattern: null, index: NO_HIGHLIGHT, picture: null };

  function select(pattern, highlightedColor) {
    const isInPattern = Number.isInteger(highlightedColor) && highlightedColor >= 0
      && highlightedColor < pattern.legend.length;
    const index = isInPattern ? highlightedColor : NO_HIGHLIGHT;
    if (selected.pattern === pattern && selected.index === index) {
      return index;
    }
    if (selected.picture !== null) {
      selected.picture.release();
    }
    const picture = index === NO_HIGHLIGHT ? null : createPatternPicture({
      createCellCanvas,
      fillRows: (grid, level, region, rowStart, rowEnd, out) => fillHighlightRows(grid, index, level, region, rowStart, rowEnd, out),
      levelFor: highlightLevel,
      limits: { singlePictureMaxSide: HIGHLIGHT_SINGLE_PICTURE_MAX_SIDE, cacheBudgetBytes: HIGHLIGHT_CACHE_BUDGET_BYTES },
    });
    selected = { pattern, index, picture };
    return index;
  }

  function draw(ctx, frame, pattern, range) {
    if (selected.picture === null) {
      return true;
    }
    ctx.imageSmoothingEnabled = false;
    return selected.picture.draw(ctx, frame, pattern, range);
  }

  return { select, draw };
}
