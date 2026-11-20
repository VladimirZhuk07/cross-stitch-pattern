// The two pictures of the PDF info page, encoded as JPEG from canvases on the main thread
// before the PDF worker starts (design D9 of add-pdf-export).
//
// Why JPEG: a PDF can embed JPEG bytes unchanged (/DCTDecode), so the PDF writer needs no image
// codec of its own, and every viewer decodes it. PNG would need its rows re-packed and
// deflated for /FlateDecode. JPEG has no alpha, so both pictures are drawn on white first.

import { patternToStitchImage } from '../core/pattern-image.js';
import { dmcPictureScale, dmcPictureSize, pictureSize } from '../core/pdf-pictures.js';

const JPEG_TYPE = 'image/jpeg';
const JPEG_QUALITY = 0.9;
const PAPER_WHITE = '#FFFFFF';

/**
 * Encodes the pictures of the PDF info page.
 * image    the loaded image (src/io/image-loader.js): its bitmap with width × height px
 * pattern  the Pattern (src/core/pattern.js)
 * Resolves to { original, dmc }, two JPEG Uint8Arrays:
 *   original  the image with its long side capped at 1200 px (pictureSize)
 *   dmc       the pattern in its DMC colors, k × k px per stitch (dmcPictureScale) with smoothing
 *             off so stitches stay sharp blocks; a pattern above 1200 stitches is scaled down
 *             smoothly to a 1200 px long side. Empty cells are white (paper).
 * Rejects when the browser cannot encode a JPEG.
 */
export async function encodePdfPictures(image, pattern) {
  const originalSize = pictureSize(image.width, image.height);
  const original = whiteCanvas(originalSize);
  const originalContext = original.getContext('2d');
  originalContext.imageSmoothingQuality = 'high';
  originalContext.drawImage(image.bitmap, 0, 0, originalSize.width, originalSize.height);

  const dmcSize = dmcPictureSize(pattern);
  const dmc = whiteCanvas(dmcSize);
  const dmcContext = dmc.getContext('2d');
  // Upscaling by a whole factor keeps blocks sharp; only a downscaled pattern is smoothed.
  dmcContext.imageSmoothingEnabled = dmcPictureScale(pattern) === 1 && dmcSize.width < pattern.width;
  dmcContext.drawImage(stitchCanvas(pattern), 0, 0, dmcSize.width, dmcSize.height);

  return { original: await jpegBytes(original), dmc: await jpegBytes(dmc) };
}

function whiteCanvas({ width, height }) {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d');
  context.fillStyle = PAPER_WHITE;
  context.fillRect(0, 0, width, height);
  return canvas;
}

// One pixel per stitch in its DMC color, empty cells transparent.
function stitchCanvas(pattern) {
  const stitches = patternToStitchImage(pattern);
  const canvas = new OffscreenCanvas(stitches.width, stitches.height);
  canvas.getContext('2d').putImageData(new ImageData(stitches.data, stitches.width, stitches.height), 0, 0);
  return canvas;
}

async function jpegBytes(canvas) {
  const blob = await canvas.convertToBlob({ type: JPEG_TYPE, quality: JPEG_QUALITY });
  if (blob.type !== JPEG_TYPE) {
    throw new Error(`this browser cannot encode JPEG pictures (got ${blob.type || 'no type'})`);
  }
  return new Uint8Array(await blob.arrayBuffer());
}
