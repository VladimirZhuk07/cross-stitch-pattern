// Matching colors to the nearest DMC floss by CIEDE2000.
//
// Shapes used by this module (see openspec spec "dmc-color-matching"):
// - DMC color: { code, name, hex } as described in src/data/dmc.js.
// - Prepared palette: frozen array, in palette order, of frozen { code, name, hex, lab } where
//   lab is the Lab color { L, a, b } of hex (what prepareLabPalette returns).
// - Match result: { color, index, deltaE } — the prepared-palette color, its index in the
//   prepared palette, and its ΔE00 to the input (what nearestDmcColor returns).
//
// This module does not import the palette data: callers pass it in, typically
// prepareLabPalette(DMC_COLORS) once per run.

import { hexToRgb, rgbToLab } from './color.js';

// Precomputes the Lab value of every color in a palette of DMC colors { code, name, hex }.
// Returns a prepared palette (frozen, same order). Does not modify the input.
// Throws RangeError for an empty palette, Error for a duplicate code, TypeError for an
// invalid hex value.
export function prepareLabPalette(colors) {
  if (!Array.isArray(colors) || colors.length === 0) {
    throw new RangeError(`palette must be a non-empty array, got ${JSON.stringify(colors)}`);
  }
  const seenCodes = new Set();
  const prepared = [];
  for (const { code, name, hex } of colors) {
    if (seenCodes.has(code)) {
      throw new Error(`palette contains duplicate code '${code}'`);
    }
    seenCodes.add(code);
    const lab = Object.freeze(rgbToLab(hexToRgb(hex)));
    prepared.push(Object.freeze({ code, name, hex, lab }));
  }
  return Object.freeze(prepared);
}
