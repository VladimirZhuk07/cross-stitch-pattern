// Color math: hex parsing, sRGB <-> linear RGB, conversion to CIELAB, and CIEDE2000.
//
// Shapes used by this module (see openspec spec "dmc-color-matching"):
// - sRGB color: { r, g, b }, integer channels 0–255 (what hexToRgb returns).
// - Linear RGB color: { r, g, b }, linear-light channels 0–1, as produced by srgbToLinear.
//   Area averaging of pixels happens in this space.
// - Lab color: { L, a, b }, CIELAB relative to the D65 white; L 0–100, a and b roughly −128..128
//   (what rgbToLab and linearRgbToLab return).

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

const MAX_CHANNEL = 255;

// sRGB transfer function constants, IEC 61966-2-1:1999.
const SRGB_ENCODED_THRESHOLD = 0.04045;
const SRGB_LINEAR_THRESHOLD = 0.0031308;
const SRGB_LINEAR_SLOPE = 12.92;
const SRGB_OFFSET = 0.055;
const SRGB_GAMMA = 2.4;

// Converts one sRGB channel (0–255, need not be an integer) to linear light (0–1).
// Throws RangeError if the channel is not a finite number in 0–255.
export function srgbToLinear(channel) {
  if (!Number.isFinite(channel) || channel < 0 || channel > MAX_CHANNEL) {
    throw new RangeError(`sRGB channel must be a number in 0–255, got ${channel}`);
  }
  const encoded = channel / MAX_CHANNEL;
  if (encoded <= SRGB_ENCODED_THRESHOLD) {
    return encoded / SRGB_LINEAR_SLOPE;
  }
  return ((encoded + SRGB_OFFSET) / (1 + SRGB_OFFSET)) ** SRGB_GAMMA;
}

// Converts one linear-light value (0–1) back to an unrounded sRGB channel (0–255).
// Values outside 0–1 are clamped first, because averages of linear values can drift a few
// ulps past the ends. Throws RangeError if the value is not a finite number.
export function linearToSrgb(value) {
  if (!Number.isFinite(value)) {
    throw new RangeError(`linear value must be a finite number, got ${value}`);
  }
  const linear = Math.min(1, Math.max(0, value));
  // The power curve gives 254.99999999999997 at exactly 1, so the top end is returned as is.
  if (linear === 1) {
    return MAX_CHANNEL;
  }
  const encoded = linear <= SRGB_LINEAR_THRESHOLD
    ? linear * SRGB_LINEAR_SLOPE
    : (1 + SRGB_OFFSET) * linear ** (1 / SRGB_GAMMA) - SRGB_OFFSET;
  return encoded * MAX_CHANNEL;
}

// Parses a hex color string '#RRGGBB' (hex digits in either case).
// Returns an sRGB color { r, g, b } with integer channels 0–255.
// Throws TypeError for anything else (wrong length, missing '#', non-hex digits, non-strings).
export function hexToRgb(hex) {
  if (typeof hex !== 'string' || !HEX_COLOR_PATTERN.test(hex)) {
    throw new TypeError(`hex color must be '#RRGGBB', got ${JSON.stringify(hex)}`);
  }
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

// sRGB (D65) to CIE XYZ matrix, Bruce Lindbloom, "RGB/XYZ Matrices"
// (http://www.brucelindbloom.com/index.html?Eqn_RGB_XYZ_Matrix.html). Its rows sum to the D65
// white below, so sRGB white maps to Lab (100, 0, 0).
const SRGB_TO_XYZ = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.0721750],
  [0.0193339, 0.1191920, 0.9503041],
];
const D65_WHITE = { x: 0.95047, y: 1.0, z: 1.08883 };

// Exact CIE constants (CIE 15:2004 note) instead of the rounded 0.008856 / 903.3, which make
// the Lab f() function slightly discontinuous.
const LAB_EPSILON = 216 / 24389;
const LAB_KAPPA = 24389 / 27;

// Converts an sRGB color { r, g, b } (channels 0–255) to a Lab color { L, a, b } under D65.
// Throws RangeError if a channel is not a finite number in 0–255. Does not modify the input.
export function rgbToLab(rgb) {
  return linearRgbToLabUnchecked(
    srgbToLinear(rgb.r),
    srgbToLinear(rgb.g),
    srgbToLinear(rgb.b),
  );
}

// Converts a linear RGB color { r, g, b } (channels 0–1) to a Lab color { L, a, b } under D65.
// Channels a few ulps outside 0–1 (rounding drift of averages) are clamped.
// Throws RangeError if a channel is not a finite number. Does not modify the input.
export function linearRgbToLab(linearRgb) {
  return linearRgbToLabUnchecked(
    clampLinearChannel(linearRgb.r),
    clampLinearChannel(linearRgb.g),
    clampLinearChannel(linearRgb.b),
  );
}

function clampLinearChannel(value) {
  if (!Number.isFinite(value)) {
    throw new RangeError(`linear channel must be a finite number, got ${value}`);
  }
  return Math.min(1, Math.max(0, value));
}

function linearRgbToLabUnchecked(r, g, b) {
  const x = SRGB_TO_XYZ[0][0] * r + SRGB_TO_XYZ[0][1] * g + SRGB_TO_XYZ[0][2] * b;
  const y = SRGB_TO_XYZ[1][0] * r + SRGB_TO_XYZ[1][1] * g + SRGB_TO_XYZ[1][2] * b;
  const z = SRGB_TO_XYZ[2][0] * r + SRGB_TO_XYZ[2][1] * g + SRGB_TO_XYZ[2][2] * b;
  return xyzToLab(x, y, z);
}

// CIE XYZ -> CIELAB relative to the D65 white (CIE 15:2004, section 8.2.1).
function xyzToLab(x, y, z) {
  const fx = labF(x / D65_WHITE.x);
  const fy = labF(y / D65_WHITE.y);
  const fz = labF(z / D65_WHITE.z);
  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

function labF(ratio) {
  if (ratio > LAB_EPSILON) {
    return Math.cbrt(ratio);
  }
  return (LAB_KAPPA * ratio + 16) / 116;
}
