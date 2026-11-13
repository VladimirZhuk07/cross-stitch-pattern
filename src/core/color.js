// Color math: hex parsing, sRGB <-> linear RGB, conversion to CIELAB, and CIEDE2000.
//
// Shapes used by this module (see openspec spec "dmc-color-matching"):
// - sRGB color: { r, g, b }, integer channels 0–255 (what hexToRgb returns).
// - Linear RGB color: { r, g, b }, linear-light channels 0–1, as produced by srgbToLinear.
//   Area averaging of pixels happens in this space.

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
