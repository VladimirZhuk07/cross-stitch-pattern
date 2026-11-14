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

// CIE XYZ (D65) to linear sRGB matrix, the inverse of SRGB_TO_XYZ, from the same Lindbloom page.
const XYZ_TO_SRGB = [
  [3.2404542, -1.5371385, -0.4985314],
  [-0.9692660, 1.8760108, 0.0415560],
  [0.0556434, -0.2040259, 1.0572252],
];

// Converts a Lab color { L, a, b } (D65) to linear RGB { r, g, b }. The inverse of
// linearRgbToLab (CIE 15:2004, section 8.2.1, solved for X, Y, Z).
// Channels are NOT clamped: a value below 0 or above 1 means the color is outside sRGB.
export function labToLinearRgb(lab) {
  const fy = (lab.L + 16) / 116;
  const x = D65_WHITE.x * inverseLabF(fy + lab.a / 500);
  const y = D65_WHITE.y * inverseLabF(fy);
  const z = D65_WHITE.z * inverseLabF(fy - lab.b / 200);
  return {
    r: XYZ_TO_SRGB[0][0] * x + XYZ_TO_SRGB[0][1] * y + XYZ_TO_SRGB[0][2] * z,
    g: XYZ_TO_SRGB[1][0] * x + XYZ_TO_SRGB[1][1] * y + XYZ_TO_SRGB[1][2] * z,
    b: XYZ_TO_SRGB[2][0] * x + XYZ_TO_SRGB[2][1] * y + XYZ_TO_SRGB[2][2] * z,
  };
}

function inverseLabF(f) {
  const cube = f ** 3;
  if (cube > LAB_EPSILON) {
    return cube;
  }
  return (116 * f - 16) / LAB_KAPPA;
}

// CIEDE2000 constants, Sharma, Wu & Dalal 2005. Weighting factors kL = kC = kH = 1.
const POW25_7 = 25 ** 7;
const DEGREES_PER_RADIAN = 180 / Math.PI;

// Returns the CIEDE2000 color difference ΔE00 between two Lab colors { L, a, b }
// (kL = kC = kH = 1). Always >= 0; 0 for identical colors; symmetric.
// Throws TypeError if either color is missing a component or has a non-finite one.
export function deltaE2000(lab1, lab2) {
  assertLab(lab1, 'first Lab color');
  assertLab(lab2, 'second Lab color');

  // Sharma et al. 2005, eq. 2–7: chroma correction G and modified a', C', h'.
  const meanChroma = (Math.hypot(lab1.a, lab1.b) + Math.hypot(lab2.a, lab2.b)) / 2;
  const g = 0.5 * (1 - Math.sqrt(meanChroma ** 7 / (meanChroma ** 7 + POW25_7)));
  const a1 = (1 + g) * lab1.a;
  const a2 = (1 + g) * lab2.a;
  const chroma1 = Math.hypot(a1, lab1.b);
  const chroma2 = Math.hypot(a2, lab2.b);
  const hue1 = hueAngleDegrees(lab1.b, a1);
  const hue2 = hueAngleDegrees(lab2.b, a2);

  // Eq. 8–12: differences in lightness, chroma, and hue.
  const deltaL = lab2.L - lab1.L;
  const deltaC = chroma2 - chroma1;
  const deltaHue = hueDifferenceDegrees(hue1, hue2, chroma1 * chroma2);
  const deltaH = 2 * Math.sqrt(chroma1 * chroma2) * Math.sin(toRadians(deltaHue / 2));

  // Eq. 13–21: weighting functions and rotation term.
  const meanL = (lab1.L + lab2.L) / 2;
  const meanC = (chroma1 + chroma2) / 2;
  const meanHue = meanHueDegrees(hue1, hue2, chroma1 * chroma2);
  const t = 1
    - 0.17 * Math.cos(toRadians(meanHue - 30))
    + 0.24 * Math.cos(toRadians(2 * meanHue))
    + 0.32 * Math.cos(toRadians(3 * meanHue + 6))
    - 0.20 * Math.cos(toRadians(4 * meanHue - 63));
  const deltaTheta = 30 * Math.exp(-(((meanHue - 275) / 25) ** 2));
  const rotationC = 2 * Math.sqrt(meanC ** 7 / (meanC ** 7 + POW25_7));
  const lightnessOffset = (meanL - 50) ** 2;
  const weightL = 1 + (0.015 * lightnessOffset) / Math.sqrt(20 + lightnessOffset);
  const weightC = 1 + 0.045 * meanC;
  const weightH = 1 + 0.015 * meanC * t;
  const rotationT = -Math.sin(toRadians(2 * deltaTheta)) * rotationC;

  const termL = deltaL / weightL;
  const termC = deltaC / weightC;
  const termH = deltaH / weightH;
  return Math.sqrt(termL ** 2 + termC ** 2 + termH ** 2 + rotationT * termC * termH);
}

function assertLab(lab, label) {
  const isValid = lab !== null
    && typeof lab === 'object'
    && Number.isFinite(lab.L)
    && Number.isFinite(lab.a)
    && Number.isFinite(lab.b);
  if (!isValid) {
    throw new TypeError(`${label} must be { L, a, b } with finite numbers, got ${JSON.stringify(lab)}`);
  }
}

function toRadians(degrees) {
  return degrees / DEGREES_PER_RADIAN;
}

// Eq. 7: hue angle in degrees 0–360; defined as 0 when a' = b = 0.
function hueAngleDegrees(b, aPrime) {
  if (b === 0 && aPrime === 0) {
    return 0;
  }
  const degrees = Math.atan2(b, aPrime) * DEGREES_PER_RADIAN;
  return degrees < 0 ? degrees + 360 : degrees;
}

// Eq. 10: hue difference in degrees, taking the short way round; 0 if either chroma is 0.
function hueDifferenceDegrees(hue1, hue2, chromaProduct) {
  if (chromaProduct === 0) {
    return 0;
  }
  const difference = hue2 - hue1;
  if (difference > 180) {
    return difference - 360;
  }
  if (difference < -180) {
    return difference + 360;
  }
  return difference;
}

// Eq. 14: mean hue in degrees; the plain sum if either chroma is 0.
function meanHueDegrees(hue1, hue2, chromaProduct) {
  const sum = hue1 + hue2;
  if (chromaProduct === 0) {
    return sum;
  }
  if (Math.abs(hue1 - hue2) <= 180) {
    return sum / 2;
  }
  if (sum < 360) {
    return (sum + 360) / 2;
  }
  return (sum - 360) / 2;
}
