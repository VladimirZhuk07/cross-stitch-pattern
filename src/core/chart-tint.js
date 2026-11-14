// Cell colors of the stitch chart: a pale tint of each DMC color, light enough that black
// numbers stay easy to read on it. Pure: no DOM, no canvas.
// The authoritative description is openspec/specs/stitch-chart/spec.md
// ("Pale tint of a DMC color"); the choice of formula is explained in the change's design D9.

import { hexToRgb, rgbToLab, labToLinearRgb, srgbToLinear, linearToSrgb } from './color.js';

/**
 * Tint lightness: L' = TINT_LIGHTNESS_BASE + TINT_LIGHTNESS_RANGE × L*, i.e. 72…97.
 * L' ≥ 72 means relative luminance ≥ 0.436, so black text has a WCAG contrast of at least
 * (0.436 + 0.05) / 0.05 ≈ 9.7:1 on every tint, and darker floss still gives a darker tint.
 */
export const TINT_LIGHTNESS_BASE = 72;
export const TINT_LIGHTNESS_RANGE = 0.25;

/** Tint chroma = TINT_CHROMA_FACTOR × the color's chroma (less if sRGB cannot show it). */
export const TINT_CHROMA_FACTOR = 0.6;

/** Halving steps when searching the largest chroma that stays inside sRGB. */
const GAMUT_SEARCH_STEPS = 20;

// WCAG 2.x relative luminance weights (from the sRGB primaries) and the flare term.
const LUMINANCE_WEIGHTS = { r: 0.2126, g: 0.7152, b: 0.0722 };
const CONTRAST_FLARE = 0.05;

/**
 * Returns the pale tint of a color as uppercase '#RRGGBB': the same CIELAB hue, lightness
 * mapped to 72 + 0.25 × L*, chroma × 0.6, and chroma reduced further only as far as needed to
 * stay inside sRGB (lightness and hue are kept, so the contrast guarantee holds).
 * hex  '#RRGGBB', any letter case
 * Throws (from hexToRgb) if hex is malformed.
 */
export function paleTint(hex) {
  const lab = rgbToLab(hexToRgb(hex));
  const lightness = TINT_LIGHTNESS_BASE + TINT_LIGHTNESS_RANGE * lab.L;
  const withChroma = (factor) => labToLinearRgb({ L: lightness, a: lab.a * factor, b: lab.b * factor });

  let linear = withChroma(TINT_CHROMA_FACTOR);
  if (!isInsideSrgb(linear)) {
    linear = withChroma(largestChromaInsideSrgb(withChroma));
  }
  return linearRgbToHex(linear);
}

/**
 * Returns the WCAG 2 contrast ratio of two colors, 1 (equal) to 21 (black on white):
 * (lighter luminance + 0.05) / (darker luminance + 0.05). The argument order does not matter.
 * hexA, hexB  '#RRGGBB', any letter case
 * Throws (from hexToRgb) if a hex is malformed.
 */
export function contrastRatio(hexA, hexB) {
  const luminanceA = relativeLuminance(hexA);
  const luminanceB = relativeLuminance(hexB);
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + CONTRAST_FLARE) / (darker + CONTRAST_FLARE);
}

// Binary search for the largest chroma factor in 0…TINT_CHROMA_FACTOR that stays in sRGB.
// Factor 0 (a neutral grey) is always inside, because L' is 72…97.
function largestChromaInsideSrgb(withChroma) {
  let inside = 0;
  let outside = TINT_CHROMA_FACTOR;
  for (let step = 0; step < GAMUT_SEARCH_STEPS; step++) {
    const middle = (inside + outside) / 2;
    if (isInsideSrgb(withChroma(middle))) {
      inside = middle;
    } else {
      outside = middle;
    }
  }
  return inside;
}

function isInsideSrgb(linear) {
  return [linear.r, linear.g, linear.b].every((channel) => channel >= 0 && channel <= 1);
}

function linearRgbToHex(linear) {
  const toByte = (channel) => Math.round(linearToSrgb(channel)).toString(16).padStart(2, '0');
  return `#${toByte(linear.r)}${toByte(linear.g)}${toByte(linear.b)}`.toUpperCase();
}

function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return LUMINANCE_WEIGHTS.r * srgbToLinear(r)
    + LUMINANCE_WEIGHTS.g * srgbToLinear(g)
    + LUMINANCE_WEIGHTS.b * srgbToLinear(b);
}
