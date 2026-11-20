// The web app manifest and the head links of index.html
// (openspec/changes/add-pwa-install/specs/app-install/spec.md: "The page links its icons and
// manifest with relative URLs", "The manifest describes the app with relative URLs only";
// design D4).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readPngHeader } from '../../src/core/png.js';

const REPO_ROOT = new URL('../../', import.meta.url);

async function readText(path) {
  return readFile(new URL(path, REPO_ROOT), 'utf8');
}

async function readManifest() {
  return JSON.parse(await readText('manifest.webmanifest'));
}

// The value of a custom property on :root in styles/main.css, e.g. '--color-bg' → '#F6F4F0'.
async function cssToken(name) {
  const css = await readText('styles/main.css');
  const match = css.match(new RegExp(`${name}:\\s*([^;]+);`));
  assert.ok(match, `${name} is defined in styles/main.css`);
  return match[1].trim();
}

// Every string value anywhere in a JSON value whose key looks like a URL field.
function urlValues(value, key = '') {
  if (Array.isArray(value)) {
    return value.flatMap((item) => urlValues(item, key));
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([childKey, child]) => urlValues(child, childKey));
  }
  return ['src', 'start_url', 'scope', 'id', 'url'].includes(key) ? [value] : [];
}

describe('manifest.webmanifest', () => {
  it('names the app and starts in standalone mode at ./', async () => {
    const manifest = await readManifest();
    assert.equal(manifest.name, 'Cross-Stitch Pattern Maker');
    assert.equal(manifest.short_name, 'Cross-Stitch');
    assert.equal(manifest.start_url, './');
    assert.equal(manifest.scope, './');
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.lang, 'en');
  });

  it('sets no id, so the identity is the start URL under the sub-path', async () => {
    assert.equal(Object.hasOwn(await readManifest(), 'id'), false);
  });

  it('uses only URLs that start with ./', async () => {
    const urls = urlValues(await readManifest());
    assert.ok(urls.length >= 5, `found ${urls.length} URLs`);
    for (const url of urls) {
      assert.ok(url.startsWith('./'), `${url} must start with ./`);
    }
  });

  it('declares the 192 and 512 icons for any and the 512 icon as maskable', async () => {
    const { icons } = await readManifest();
    assert.deepEqual(
      icons.map(({ src, sizes, type, purpose }) => [src, sizes, type, purpose]),
      [
        ['./icons/icon-192.png', '192x192', 'image/png', 'any'],
        ['./icons/icon-512.png', '512x512', 'image/png', 'any'],
        ['./icons/icon-maskable-512.png', '512x512', 'image/png', 'maskable'],
      ],
    );
  });

  it('points every icon at a PNG whose width and height equal its sizes', async () => {
    for (const icon of (await readManifest()).icons) {
      assert.ok(icon.src.startsWith('./icons/'), icon.src);
      const header = readPngHeader(new Uint8Array(await readFile(new URL(icon.src, REPO_ROOT))));
      assert.equal(`${header.width}x${header.height}`, icon.sizes, icon.src);
    }
  });

  it('uses --color-bg as background_color and --color-surface as theme_color', async () => {
    const manifest = await readManifest();
    assert.equal(manifest.background_color, await cssToken('--color-bg'));
    assert.equal(manifest.background_color, '#F6F4F0');
    assert.equal(manifest.theme_color, await cssToken('--color-surface'));
    assert.equal(manifest.theme_color, '#FFFFFF');
  });
});

describe('index.html head links', () => {
  const HEAD_LINES = [
    '<link rel="manifest" href="./manifest.webmanifest">',
    '<meta name="theme-color" content="#FFFFFF">',
    '<link rel="icon" href="./icons/favicon-32.png" sizes="32x32" type="image/png">',
    '<link rel="icon" href="./icons/favicon.svg" type="image/svg+xml">',
    '<link rel="apple-touch-icon" href="./icons/apple-touch-icon.png">',
  ];

  it('links the manifest, the theme color and the three icons inside <head>', async () => {
    const head = (await readText('index.html')).split('</head>')[0];
    for (const line of HEAD_LINES) {
      assert.ok(head.includes(line), `missing in <head>: ${line}`);
    }
  });

  it('gives the theme-color meta tag the manifest theme_color', async () => {
    const html = await readText('index.html');
    const meta = html.match(/<meta name="theme-color" content="([^"]+)">/);
    assert.ok(meta, 'theme-color meta tag');
    assert.equal(meta[1], (await readManifest()).theme_color);
  });

  it('no longer uses the empty data:, icon', async () => {
    assert.ok(!(await readText('index.html')).includes('href="data:,"'));
  });
});
