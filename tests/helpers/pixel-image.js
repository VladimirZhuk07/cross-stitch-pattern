// Builders for small synthetic pixel images { width, height, pixels } (RGBA bytes, row-major).

export const OPAQUE_BLACK = [0, 0, 0, 255];
export const OPAQUE_WHITE = [255, 255, 255, 255];
export const TRANSPARENT = [0, 0, 0, 0];

// Builds a pixel image from a list of width × height [r, g, b, a] pixels in row-major order.
export function pixelImage(width, height, rgbaPixels) {
  if (rgbaPixels.length !== width * height) {
    throw new RangeError(`expected ${width * height} pixels, got ${rgbaPixels.length}`);
  }
  return { width, height, pixels: new Uint8ClampedArray(rgbaPixels.flat()) };
}

// Builds a width × height image where every pixel is the same [r, g, b, a].
export function solidImage(width, height, rgba) {
  return pixelImage(width, height, Array.from({ length: width * height }, () => rgba));
}

// Builds a width × height opaque image whose pixel (x, y) is colorAt(x, y) → [r, g, b].
export function opaqueImageFrom(width, height, colorAt) {
  const rgbaPixels = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      rgbaPixels.push([...colorAt(x, y), 255]);
    }
  }
  return pixelImage(width, height, rgbaPixels);
}
