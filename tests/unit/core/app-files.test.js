// Unit tests for src/core/app-files.js (openspec/changes/add-pwa-install/design.md, D5;
// specs/app-install/spec.md: "The app works offline after the first visit").

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  extractHtmlReferences,
  extractJsReferences,
  extractCssReferences,
  extractManifestReferences,
  isRelativeReference,
  referencesOf,
  collectAppFiles,
} from '../../../src/core/app-files.js';

const SCOPE = 'https://user.github.io/cross-stitch-pattern/';

describe('extractHtmlReferences', () => {
  it('returns script src, link href and img src in document order', () => {
    const html = [
      '<link rel="manifest" href="./manifest.webmanifest">',
      '<link rel="stylesheet" href="./styles/main.css">',
      '<script type="module" src="./src/main.js"></script>',
      '<img class="icon" src="./icons/icon-192.png" alt="">',
    ].join('\n');
    assert.deepEqual(extractHtmlReferences(html), [
      './manifest.webmanifest',
      './styles/main.css',
      './src/main.js',
      './icons/icon-192.png',
    ]);
  });

  it('ignores anchors and other attributes', () => {
    assert.deepEqual(extractHtmlReferences('<a href="./x.html">x</a><input data-src="./y.js">'), []);
  });
});

describe('extractJsReferences', () => {
  it('finds static, bare, re-export, dynamic and new URL references in source order', () => {
    const source = [
      "import { a } from './a.js';",
      "import './b.js';",
      "export { c } from '../c.js';",
      "const d = await import('./d.js');",
      "const worker = new URL('./workers/e.js', import.meta.url);",
    ].join('\n');
    assert.deepEqual(extractJsReferences(source), ['./a.js', './b.js', '../c.js', './d.js', './workers/e.js']);
  });

  it('reads imports spread over several lines', () => {
    const source = "import {\n  first,\n  second,\n} from './many.js';";
    assert.deepEqual(extractJsReferences(source), ['./many.js']);
  });

  it('finds nothing in a module without imports', () => {
    assert.deepEqual(extractJsReferences('export const answer = 42;'), []);
  });
});

describe('extractCssReferences', () => {
  it('returns url() targets and @import targets', () => {
    const css = "@import './print.css';\n.a { background: url('./bg.png'); }\n.b { mask: url(./mask.svg); }";
    assert.deepEqual(extractCssReferences(css), ['./bg.png', './mask.svg', './print.css']);
  });
});

describe('extractManifestReferences', () => {
  it('returns the src of every icon', () => {
    const manifest = JSON.stringify({
      start_url: './',
      icons: [{ src: './icons/icon-192.png' }, { src: './icons/icon-maskable-512.png', purpose: 'maskable' }],
    });
    assert.deepEqual(extractManifestReferences(manifest), ['./icons/icon-192.png', './icons/icon-maskable-512.png']);
  });

  it('returns [] for invalid JSON', () => {
    assert.deepEqual(extractManifestReferences('{ "icons": ['), []);
  });

  it('returns [] when there are no icons or an icon has no string src', () => {
    assert.deepEqual(extractManifestReferences('{"name":"x"}'), []);
    assert.deepEqual(extractManifestReferences('{"icons":[{"sizes":"1x1"},{"src":7}]}'), []);
  });
});

describe('isRelativeReference', () => {
  it('accepts ./ and ../ and rejects absolute paths and URLs', () => {
    assert.equal(isRelativeReference('./src/main.js'), true);
    assert.equal(isRelativeReference('../core/color.js'), true);
    assert.equal(isRelativeReference('/src/main.js'), false);
    assert.equal(isRelativeReference('https://cdn.example/x.js'), false);
    assert.equal(isRelativeReference('src/main.js'), false);
  });
});

describe('referencesOf', () => {
  it('reads a URL ending in / as HTML', () => {
    assert.deepEqual(referencesOf(SCOPE, '<script src="./src/main.js"></script>'), ['./src/main.js']);
  });

  it('chooses the extractor by extension: .html, .js, .css, .webmanifest', () => {
    assert.deepEqual(referencesOf(`${SCOPE}index.html`, '<link href="./a.css">'), ['./a.css']);
    assert.deepEqual(referencesOf(`${SCOPE}src/main.js`, "import './x.js';"), ['./x.js']);
    assert.deepEqual(referencesOf(`${SCOPE}styles/main.css`, "@import './p.css';"), ['./p.css']);
    assert.deepEqual(referencesOf(`${SCOPE}manifest.webmanifest`, '{"icons":[{"src":"./i.png"}]}'), ['./i.png']);
  });

  it('ignores the query string when choosing the extractor', () => {
    assert.deepEqual(referencesOf(`${SCOPE}src/main.js?v=2`, "import './x.js';"), ['./x.js']);
  });

  it('returns [] for other extensions such as .png and .svg', () => {
    assert.deepEqual(referencesOf(`${SCOPE}icons/icon-192.png`, '<script src="./x.js">'), []);
    assert.deepEqual(referencesOf(`${SCOPE}icons/favicon.svg`, '<svg/>'), []);
  });
});

// A tiny app: page → stylesheet, manifest, main.js; main.js → a worker via new URL, which imports
// a core module that imports main.js's dependency back (a cycle).
const APP = {
  [SCOPE]: [
    '<link rel="manifest" href="./manifest.webmanifest">',
    '<link rel="icon" href="data:,">',
    '<link rel="stylesheet" href="./styles/main.css">',
    '<script type="module" src="./src/main.js"></script>',
  ].join('\n'),
  [`${SCOPE}styles/main.css`]: ".a { background: url('../icons/bg.png'); }",
  [`${SCOPE}manifest.webmanifest`]: '{"icons":[{"src":"./icons/icon-192.png"},{"src":"./icons/icon-512.png"}]}',
  [`${SCOPE}src/main.js`]: [
    "import { a } from './core/a.js';",
    "const worker = new URL('./workers/pattern.worker.js', import.meta.url);",
  ].join('\n'),
  [`${SCOPE}src/workers/pattern.worker.js`]: "import { b } from '../core/b.js';",
  [`${SCOPE}src/core/a.js`]: "import { b } from './b.js';",
  [`${SCOPE}src/core/b.js`]: "import { a } from './a.js';",
};

// A fake readText over a map that records every URL it was asked for.
function mapReader(files) {
  const reads = [];
  const readText = async (url) => {
    reads.push(url);
    if (!Object.hasOwn(files, url)) {
      throw new Error(`404 ${url}`);
    }
    return files[url];
  };
  return { readText, reads };
}

describe('collectAppFiles', () => {
  it('follows HTML → CSS, HTML → manifest → icons and JS → new URL worker → imports', async () => {
    const { readText } = mapReader(APP);
    assert.deepEqual(await collectAppFiles(SCOPE, SCOPE, readText), [
      SCOPE,
      `${SCOPE}icons/bg.png`,
      `${SCOPE}icons/icon-192.png`,
      `${SCOPE}icons/icon-512.png`,
      `${SCOPE}manifest.webmanifest`,
      `${SCOPE}src/core/a.js`,
      `${SCOPE}src/core/b.js`,
      `${SCOPE}src/main.js`,
      `${SCOPE}src/workers/pattern.worker.js`,
      `${SCOPE}styles/main.css`,
    ]);
  });

  it('reads every file with references once, despite the a.js ↔ b.js cycle, and never reads leaves', async () => {
    const { readText, reads } = mapReader(APP);
    await collectAppFiles(SCOPE, SCOPE, readText);
    assert.equal(reads.length, new Set(reads).size);
    assert.deepEqual([...reads].sort(), Object.keys(APP).sort());
  });

  it('skips data: URLs and references outside the scope', async () => {
    const files = {
      [SCOPE]: [
        '<link rel="icon" href="data:,">',
        '<script src="../other-repo/x.js"></script>',
        '<script src="https://cdn.example/y.js"></script>',
        '<script src="./src/main.js"></script>',
      ].join('\n'),
      [`${SCOPE}src/main.js`]: "import '../../elsewhere.js';",
    };
    const { readText } = mapReader(files);
    assert.deepEqual(await collectAppFiles(SCOPE, SCOPE, readText), [SCOPE, `${SCOPE}src/main.js`]);
  });

  it('returns only the start URL for a page without references', async () => {
    const { readText } = mapReader({ [SCOPE]: '<p>empty</p>' });
    assert.deepEqual(await collectAppFiles(SCOPE, SCOPE, readText), [SCOPE]);
  });

  it('rejects when readText rejects for any file', async () => {
    const files = { ...APP };
    delete files[`${SCOPE}src/core/b.js`];
    const { readText } = mapReader(files);
    await assert.rejects(collectAppFiles(SCOPE, SCOPE, readText), /404 .*src\/core\/b\.js/);
  });
});

describe('app-files.js source', () => {
  it('quotes no example module path that the extractors would take for a reference', async () => {
    const source = await readFile(new URL('../../../src/core/app-files.js', import.meta.url), 'utf8');
    assert.deepEqual(extractJsReferences(source), []);
  });
});
