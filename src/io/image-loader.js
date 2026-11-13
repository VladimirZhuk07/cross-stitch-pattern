// Decodes an image file chosen by the user into an ImageBitmap, entirely in the browser.
// Nothing is uploaded: createImageBitmap reads the File object locally.

import { capImageSize } from '../core/image-size.js';

/**
 * Longest side, in pixels, of an image as used by the app. Larger images are downscaled.
 * 2048 px is far above any practical stitch width (≤ 500 stitches) and keeps one RGBA copy
 * of the image at most 16 MB.
 */
export const MAX_DECODE_SIDE = 2048;

/**
 * Thrown when a file cannot be decoded as an image (wrong type, empty, or corrupt).
 * fileName is the name of the file, for the user-facing message.
 */
export class ImageDecodeError extends Error {
  constructor(fileName, cause) {
    super(`Cannot decode "${fileName}" as an image`, { cause });
    this.name = 'ImageDecodeError';
    this.fileName = fileName;
  }
}

/**
 * Decodes file (a File or Blob with a name) into a loaded image, downscaled if its longer
 * side exceeds maxSide pixels (default MAX_DECODE_SIDE).
 *
 * Resolves to a loaded image { bitmap, fileName, width, height, sourceWidth, sourceHeight,
 * isDownscaled }:
 *   bitmap                     the decoded ImageBitmap, already at the capped size; the caller
 *                              owns it and must call bitmap.close() when it is replaced
 *   fileName                   file.name
 *   width, height              size of bitmap in pixels
 *   sourceWidth, sourceHeight  size of the image in the file, before the cap
 *   isDownscaled               true if the cap made the image smaller
 * Rejects with ImageDecodeError for empty or undecodable files.
 *
 * Browsers apply EXIF orientation by default and decode the first frame of an animated GIF.
 * The image is first decoded at full size and then resized: reading the size from the file
 * header first would need a second decoding path (trade-off described in design.md, D6).
 */
export async function loadImageFile(file, maxSide = MAX_DECODE_SIDE) {
  if (file.size === 0) {
    throw new ImageDecodeError(file.name);
  }

  let decoded;
  try {
    decoded = await createImageBitmap(file);
  } catch (error) {
    throw new ImageDecodeError(file.name, error);
  }

  const capped = capImageSize(decoded.width, decoded.height, maxSide);
  const result = {
    fileName: file.name,
    sourceWidth: decoded.width,
    sourceHeight: decoded.height,
    width: capped.width,
    height: capped.height,
    isDownscaled: capped.isDownscaled,
  };
  if (!capped.isDownscaled) {
    return { bitmap: decoded, ...result };
  }

  try {
    const resized = await createImageBitmap(decoded, {
      resizeWidth: capped.width,
      resizeHeight: capped.height,
      resizeQuality: 'high',
    });
    return { bitmap: resized, ...result };
  } finally {
    decoded.close();
  }
}
