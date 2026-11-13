// Reads the pixels of a loaded image, so the pattern pipeline in ../core/ can work on plain
// bytes. Runs on the main thread once per image (design D1); the result is transferred to
// the pattern worker.

/**
 * Returns the pixel image { width, height, pixels } of a loaded image (see loadImageFile in
 * ./image-loader.js): pixels is a new Uint8ClampedArray of width × height × 4 bytes, RGBA,
 * row-major, sRGB, straight alpha, owning its whole buffer (so it can be transferred).
 * The shape is described at resizeToGrid in ../core/stitch-grid.js.
 * Throws if the browser has no OffscreenCanvas or cannot create a 2D context.
 */
export function readImagePixels(image) {
  if (typeof OffscreenCanvas === 'undefined') {
    throw new Error('this browser cannot read image pixels (OffscreenCanvas is not available)');
  }
  const { width, height, bitmap } = image;
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (context === null) {
    throw new Error('this browser could not create a canvas to read the image pixels');
  }
  context.drawImage(bitmap, 0, 0, width, height);
  const { data } = context.getImageData(0, 0, width, height, { colorSpace: 'srgb' });
  return { width, height, pixels: data };
}
