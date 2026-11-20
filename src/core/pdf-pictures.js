// The two pictures on the PDF info page: their pixel sizes, and the facts the PDF needs from a
// JPEG file (width, height, color components). Pure; the JPEG bytes themselves are made from
// canvases in src/io/pdf-picture-encoder.js.

/** The long side of both pictures in px at most: about 340 dpi across their 90 mm box. */
export const MAX_PICTURE_SIDE = 1200;

const SOI = 0xd8;
const MARKER_PREFIX = 0xff;
// Start-of-frame markers of DCT JPEGs that PDF's DCTDecode reads: baseline, extended
// sequential and progressive (ITU-T T.81, table B.1).
const DCT_FRAME_MARKERS = new Set([0xc0, 0xc1, 0xc2]);
// All other start-of-frame markers (lossless, hierarchical, arithmetic-coded).
const OTHER_FRAME_MARKERS = new Set([0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
// Markers without a length field: TEM and RST0–RST7.
const STANDALONE_MARKERS = new Set([0x01, 0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7]);
const SUPPORTED_COMPONENTS = new Set([1, 3]);

/**
 * Reads the frame header of a JPEG file (Uint8Array): walks the segments from the SOI marker
 * to the first start-of-frame. Returns { width, height, components } in px.
 * Throws TypeError for anything that is not a baseline or progressive JPEG with 1 (gray) or
 * 3 (color) components.
 */
export function readJpegInfo(bytes) {
  if (bytes.length < 2 || bytes[0] !== MARKER_PREFIX || bytes[1] !== SOI) {
    throw new TypeError('not a JPEG: the SOI marker is missing');
  }
  let index = 2;
  while (index + 3 < bytes.length) {
    if (bytes[index] !== MARKER_PREFIX) {
      throw new TypeError(`not a JPEG: no marker at byte ${index}`);
    }
    const marker = bytes[index + 1];
    if (marker === MARKER_PREFIX) {
      index += 1; // fill byte
      continue;
    }
    if (STANDALONE_MARKERS.has(marker)) {
      index += 2;
      continue;
    }
    if (DCT_FRAME_MARKERS.has(marker)) {
      return readFrameHeader(bytes, index + 4);
    }
    if (OTHER_FRAME_MARKERS.has(marker)) {
      throw new TypeError(`unsupported JPEG type (marker 0xFF${marker.toString(16).toUpperCase()})`);
    }
    index += 2 + ((bytes[index + 2] << 8) | bytes[index + 3]);
  }
  throw new TypeError('not a JPEG: no frame header found');
}

// The frame header after the marker and its length: precision, height, width, components.
function readFrameHeader(bytes, start) {
  if (start + 6 > bytes.length) {
    throw new TypeError('not a JPEG: the frame header is cut off');
  }
  const height = (bytes[start + 1] << 8) | bytes[start + 2];
  const width = (bytes[start + 3] << 8) | bytes[start + 4];
  const components = bytes[start + 5];
  if (!SUPPORTED_COMPONENTS.has(components)) {
    throw new TypeError(`a JPEG for the PDF needs 1 or 3 color components, got ${components}`);
  }
  if (width === 0 || height === 0) {
    throw new TypeError(`a JPEG for the PDF needs a size, got ${width} × ${height}`);
  }
  return { width, height, components };
}

/**
 * The pixel size of the original picture for an image of width × height px: the long side
 * capped at MAX_PICTURE_SIDE, never enlarged, rounded (at least 1 px).
 * pictureSize(4000, 3000) → { width: 1200, height: 900 }.
 */
export function pictureSize(width, height) {
  const scale = Math.min(1, MAX_PICTURE_SIDE / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * Pixels per stitch of the DMC colors picture for a grid { width, height } in stitches: the
 * largest whole number k with k × long side ≤ MAX_PICTURE_SIDE, at least 1. Whole numbers keep
 * every stitch a sharp block of k × k px. dmcPictureScale({ width: 100, height: 67 }) → 12.
 */
export function dmcPictureScale(grid) {
  return Math.max(1, Math.floor(MAX_PICTURE_SIDE / Math.max(grid.width, grid.height)));
}

/**
 * The pixel size of the DMC colors picture for a grid { width, height } in stitches: the grid
 * times dmcPictureScale, or, for a grid longer than MAX_PICTURE_SIDE stitches, scaled down to
 * that long side like pictureSize. { width: 2000, height: 1600 } → { width: 1200, height: 960 }.
 */
export function dmcPictureSize(grid) {
  const scale = dmcPictureScale(grid);
  return pictureSize(grid.width * scale, grid.height * scale);
}
