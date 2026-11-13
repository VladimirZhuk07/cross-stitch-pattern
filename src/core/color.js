// Color math: hex parsing, sRGB <-> linear RGB, conversion to CIELAB, and CIEDE2000.
//
// Shapes used by this module (see openspec spec "dmc-color-matching"):
// - sRGB color: { r, g, b }, integer channels 0–255 (what hexToRgb returns).
// - Linear RGB color: { r, g, b }, linear-light channels 0–1, as produced by srgbToLinear.
//   Area averaging of pixels happens in this space.

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

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
