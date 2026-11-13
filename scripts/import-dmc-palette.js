// Developer tool: converts makebead/craft-color-codes data/json/dmc-floss.json into
// src/data/dmc.js. Run once by hand; its output is committed. The app never runs this file,
// and it makes no network requests: download the source file first (see openspec change
// add-dmc-color-matching, design.md, "Palette import").
//
// Usage: node scripts/import-dmc-palette.js <path-to-dmc-floss.json> <commit-sha>

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const EXPECTED_LICENSE = 'CC-BY-4.0';

// Takes the parsed source file (an object with `license`, `count`, and `colors`) and returns
// its `colors` array. Throws if the license is not CC-BY-4.0, if `colors` is not an array,
// or if `count` does not equal the number of colors.
export function readSourceColors(sourceFile) {
  if (sourceFile?.license !== EXPECTED_LICENSE) {
    throw new Error(`source license must be ${EXPECTED_LICENSE}, got ${JSON.stringify(sourceFile?.license)}`);
  }
  if (!Array.isArray(sourceFile.colors)) {
    throw new Error('source file has no colors array');
  }
  if (sourceFile.count !== sourceFile.colors.length) {
    throw new Error(
      `source count ${sourceFile.count} does not match ${sourceFile.colors.length} colors`,
    );
  }
  return sourceFile.colors;
}

// Converts source entries { code, name, hex, rgb } into DMC colors { code, name, hex }:
// code upper-cased, hex upper-cased, rgb dropped after checking it agrees with hex, name and
// order unchanged. Does not modify its input.
// Throws an Error naming the entry for an empty or non-string code, an empty name, a malformed
// hex, an rgb that disagrees with hex, or a code that is duplicated after upper-casing.
export function convertSourceEntries(entries) {
  const seenCodes = new Set();
  const colors = [];
  for (const entry of entries) {
    const color = convertSourceEntry(entry);
    if (seenCodes.has(color.code)) {
      throw new Error(`duplicate code ${color.code} after upper-casing (source code ${entry.code})`);
    }
    seenCodes.add(color.code);
    colors.push(color);
  }
  return colors;
}

function convertSourceEntry({ code, name, hex, rgb }) {
  if (typeof code !== 'string' || code === '') {
    throw new Error(`entry code must be a non-empty string, got ${JSON.stringify(code)}`);
  }
  if (typeof name !== 'string' || name === '') {
    throw new Error(`entry ${code}: name must be a non-empty string, got ${JSON.stringify(name)}`);
  }
  if (typeof hex !== 'string' || !HEX_COLOR_PATTERN.test(hex)) {
    throw new Error(`entry ${code}: hex must be '#RRGGBB', got ${JSON.stringify(hex)}`);
  }
  if (rgb !== undefined && !rgbMatchesHex(rgb, hex)) {
    throw new Error(`entry ${code}: rgb ${JSON.stringify(rgb)} disagrees with hex ${hex}`);
  }
  return { code: code.toUpperCase(), name, hex: hex.toUpperCase() };
}

function rgbMatchesHex(rgb, hex) {
  if (!Array.isArray(rgb) || rgb.length !== 3) {
    return false;
  }
  const fromHex = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((pair) => Number.parseInt(pair, 16));
  return fromHex.every((channel, index) => channel === rgb[index]);
}
