// Developer tool: converts makebead/craft-color-codes data/json/dmc-floss.json into
// src/data/dmc.js. Run once by hand; its output is committed. The app never runs this file,
// and it makes no network requests: download the source file first (see openspec change
// add-dmc-color-matching, design.md, "Palette import").
//
// Usage: node scripts/import-dmc-palette.js <path-to-dmc-floss.json> <commit-sha>

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const OUTPUT_FILE = fileURLToPath(new URL('../src/data/dmc.js', import.meta.url));
const SOURCE_REPO_URL = 'https://github.com/makebead/craft-color-codes';
const SOURCE_FILE_PATH = 'data/json/dmc-floss.json';
const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
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

// Renders the text of src/data/dmc.js for the given DMC colors { code, name, hex } and
// provenance { commitSha (40 lower-case hex), sourceSha256 (64 lower-case hex) }.
// The output is deterministic: the same input gives byte-identical text.
// Throws an Error if commitSha or sourceSha256 is malformed.
export function renderPaletteModule(colors, { commitSha, sourceSha256 }) {
  if (!COMMIT_SHA_PATTERN.test(commitSha)) {
    throw new Error(`commit SHA must be 40 lower-case hex characters, got ${JSON.stringify(commitSha)}`);
  }
  if (!SHA256_PATTERN.test(sourceSha256)) {
    throw new Error(`source SHA-256 must be 64 lower-case hex characters, got ${JSON.stringify(sourceSha256)}`);
  }
  const header = [
    `// DMC stranded cotton (six-strand embroidery floss) palette: ${colors.length} colors.`,
    '//',
    '// DMC_COLORS is a frozen array of frozen DMC colors { code, name, hex }:',
    "// - code: the DMC floss code as a string, upper case ('310', 'BLANC', 'ECRU', 'B5200');",
    '// - name: the color name exactly as in the source;',
    "// - hex: the approximate sRGB color as '#RRGGBB', upper case.",
    '// DMC publishes no official RGB values; these are approximations taken from the source below.',
    '//',
    `// Source: ${SOURCE_REPO_URL}, file ${SOURCE_FILE_PATH}`,
    `//   commit ${commitSha}`,
    `//   ${SOURCE_REPO_URL.replace('github.com', 'raw.githubusercontent.com')}/${commitSha}/${SOURCE_FILE_PATH}`,
    `//   SHA-256 of the source file: ${sourceSha256}`,
    '// License: CC-BY-4.0 (https://creativecommons.org/licenses/by/4.0/).',
    '// Color data: craft-color-codes by MakeBead (https://makebead.com).',
    '// The dataset names its own upstream sources: floss.maxxmint.com,',
    '// adrianj/CrossStitchCreator, and xstitchify.com.',
    '//',
    '// Transformations (the only changes made to the source data):',
    "// - codes upper-cased ('Blanc' -> 'BLANC', 'Ecru' -> 'ECRU');",
    '// - hex upper-cased (same value);',
    '// - rgb field dropped, after checking that it agrees with hex.',
    '// Names and entry order are unchanged.',
    '//',
    '// Generated by: node scripts/import-dmc-palette.js <path-to-dmc-floss.json> <commit-sha>',
    '// Do not edit by hand; re-run the script instead.',
  ];
  // JSON.stringify quotes and escapes every string, so names with quotes stay valid JS.
  const entryLines = colors.map(
    ({ code, name, hex }) => `  { code: ${JSON.stringify(code)}, name: ${JSON.stringify(name)}, hex: ${JSON.stringify(hex)} },`,
  );
  return [
    ...header,
    '',
    'const ENTRIES = [',
    ...entryLines,
    '];',
    '',
    'export const DMC_COLORS = Object.freeze(ENTRIES.map((entry) => Object.freeze(entry)));',
    '',
  ].join('\n');
}

// Reads the downloaded source file, converts it, and writes src/data/dmc.js. Nothing is
// written if any step fails. Prints the codes that upper-casing changed.
async function main([sourcePath, commitSha]) {
  if (!sourcePath || !commitSha) {
    throw new Error('usage: node scripts/import-dmc-palette.js <path-to-dmc-floss.json> <commit-sha>');
  }
  const sourceBytes = await readFile(sourcePath);
  const sourceSha256 = createHash('sha256').update(sourceBytes).digest('hex');
  const entries = readSourceColors(JSON.parse(sourceBytes.toString('utf8')));
  const colors = convertSourceEntries(entries);
  const text = renderPaletteModule(colors, { commitSha, sourceSha256 });
  await mkdir(dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, text, 'utf8');

  const changedCodes = entries
    .map((entry, index) => [entry.code, colors[index].code])
    .filter(([before, after]) => before !== after)
    .map(([before, after]) => `${before} -> ${after}`);
  process.stdout.write(`Wrote ${colors.length} colors to ${OUTPUT_FILE}\n`);
  process.stdout.write(`Source SHA-256: ${sourceSha256}\n`);
  process.stdout.write(`Codes changed by upper-casing: ${changedCodes.join(', ') || 'none'}\n`);
}

const isRunDirectly = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isRunDirectly) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`import-dmc-palette: ${error.message}\n`);
    process.exitCode = 1;
  });
}
