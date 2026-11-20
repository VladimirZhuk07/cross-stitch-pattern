// Developer tool: writes the app icons into icons/ from the design in src/core/app-icon.js.
// Run it by hand after changing the icon design; its output is committed. The app never runs
// this file. It uses only Node built-ins and makes no network requests.
// tests/integration/app-icons.test.js fails when the committed icons no longer match the design.
//
// Usage: node scripts/make-icons.js

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderIcon, iconSvg } from '../src/core/app-icon.js';
import { encodePng } from '../src/core/png.js';

const ICONS_DIRECTORY = fileURLToPath(new URL('../icons/', import.meta.url));

/** The PNG icons: file name in icons/, size in px, and renderIcon layout. */
export const PNG_ICONS = Object.freeze([
  { file: 'icon-192.png', size: 192, layout: 'any' },
  { file: 'icon-512.png', size: 512, layout: 'any' },
  { file: 'icon-maskable-512.png', size: 512, layout: 'maskable' },
  { file: 'apple-touch-icon.png', size: 180, layout: 'any' },
  { file: 'favicon-32.png', size: 32, layout: 'squares' },
]);

/** The SVG favicon's file name in icons/. */
export const SVG_ICON_FILE = 'favicon.svg';

/**
 * Writes all six icon files into directory (default: the repository's icons/ folder).
 * Resolves to the list of written file names.
 */
export async function makeIcons(directory = ICONS_DIRECTORY) {
  await mkdir(directory, { recursive: true });
  const written = [];
  for (const { file, size, layout } of PNG_ICONS) {
    await writeFile(resolve(directory, file), await encodePng(renderIcon(size, layout)));
    written.push(file);
  }
  await writeFile(resolve(directory, SVG_ICON_FILE), iconSvg());
  written.push(SVG_ICON_FILE);
  return written;
}

const isRunDirectly = process.argv[1] !== undefined
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isRunDirectly) {
  try {
    for (const file of await makeIcons()) {
      process.stdout.write(`Wrote icons/${file}\n`);
    }
  } catch (error) {
    process.stderr.write(`${error.stack}\n`);
    process.exitCode = 1;
  }
}
