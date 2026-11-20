// The two pictures of the workbook's Summary sheet, encoded as PNG with an OffscreenCanvas:
// the loaded image and the pattern in DMC colors (design D7 of add-excel-export).
// PNG, not JPEG: it keeps transparency and the flat color blocks sharp.
// Main thread, not the Excel worker: OffscreenCanvas is already required to read the image
// pixels at all, PNG encoding is asynchronous in the browser, and the per-stitch loop of
// patternToStitchImage takes only about 10 ms at the 1,000,000-cell cap.

import { patternToStitchImage } from '../core/pattern-image.js';
import { fitInside, stitchBlockSize } from '../core/picture-size.js';

/** Largest side of either PNG, in px. */
export const SUMMARY_PNG_MAX_SIDE = 1024;

/**
 * Encodes the Summary pictures.
 * image    the loaded image (see loadImageFile in ./image-loader.js): { bitmap, width, height }
 * pattern  the current Pattern (../core/pattern.js)
 * Resolves to WorkbookPictures { original, dmc } (see ../core/xlsx-summary-sheet.js), each
 * { png: Uint8Array with its own buffer, width, height }:
 *   original  the image scaled to fit 1024 × 1024 px (never enlarged), smoothed
 *   dmc       one block of stitchBlockSize px per stitch in its DMC color, empty cells
 *             transparent, with hard block edges
 * Rejects if the browser has no OffscreenCanvas or cannot encode a PNG.
 */
export async function encodeSummaryPictures(image, pattern) {
  if (typeof OffscreenCanvas === 'undefined') {
    throw new Error('this browser cannot draw the workbook pictures (OffscreenCanvas is not available)');
  }
  const original = await encodeOriginal(image);
  const dmc = await encodeDmcPicture(pattern);
  return { original, dmc };
}

async function encodeOriginal(image) {
  const size = fitInside(image, SUMMARY_PNG_MAX_SIDE);
  const canvas = new OffscreenCanvas(size.width, size.height);
  const context = contextOf(canvas);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image.bitmap, 0, 0, size.width, size.height);
  return { png: await encodePng(canvas), ...size };
}

async function encodeDmcPicture(pattern) {
  const stitches = patternToStitchImage(pattern);
  const stitchCanvas = new OffscreenCanvas(stitches.width, stitches.height);
  contextOf(stitchCanvas).putImageData(new ImageData(stitches.data, stitches.width, stitches.height), 0, 0);

  const blockSize = stitchBlockSize(pattern, SUMMARY_PNG_MAX_SIDE);
  const width = pattern.width * blockSize;
  const height = pattern.height * blockSize;
  const canvas = new OffscreenCanvas(width, height);
  const context = contextOf(canvas);
  context.imageSmoothingEnabled = false; // sharp blocks, one per stitch
  context.drawImage(stitchCanvas, 0, 0, width, height);
  return { png: await encodePng(canvas), width, height };
}

function contextOf(canvas) {
  const context = canvas.getContext('2d');
  if (context === null) {
    throw new Error('this browser could not create a canvas for the workbook pictures');
  }
  return context;
}

async function encodePng(canvas) {
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return new Uint8Array(await blob.arrayBuffer());
}
