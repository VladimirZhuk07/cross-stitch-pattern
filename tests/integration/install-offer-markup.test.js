// Checks the install bar markup in index.html and the styles it relies on
// (openspec/changes/add-pwa-install/specs/app-install/spec.md: "The install bar is unobtrusive
// and accessible"; design D10). The layout itself is checked in the browser.

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const REPO_ROOT = new URL('../../', import.meta.url);
const COMPACT_MEDIA = 'screen and (width < 48rem), screen and (height < 30rem) and (width < 60rem)';
const COARSE_MEDIA = 'screen and (pointer: coarse)';

async function readText(path) {
  return readFile(new URL(path, REPO_ROOT), 'utf8');
}

// The install bar element, from its opening tag to its closing tag.
function installBar(html) {
  const start = html.search(/<aside\b[^>]*data-role="install-offer"/);
  assert.ok(start !== -1, 'an <aside data-role="install-offer">');
  return html.slice(start, html.indexOf('</aside>', start) + '</aside>'.length);
}

function attributeOf(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}(?:="([^"]*)")?[\\s>]`));
  if (match === null) {
    return null;
  }
  return match[1] ?? '';
}

// The declarations of every rule whose selector list contains selector, inside the @media
// blocks with exactly condition (or outside every block for condition null).
function declarationsFor(css, selector, condition) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const scopes = [];
  let topLevel = '';
  let index = 0;
  for (const match of text.matchAll(/@media\s+([^{]+)\{/g)) {
    if (match.index < index) {
      continue;
    }
    topLevel += text.slice(index, match.index);
    let depth = 1;
    let end = match.index + match[0].length;
    while (depth > 0) {
      if (text[end] === '{') {
        depth += 1;
      } else if (text[end] === '}') {
        depth -= 1;
      }
      end += 1;
    }
    if (match[1].trim() === condition) {
      scopes.push(text.slice(match.index + match[0].length, end - 1));
    }
    index = end;
  }
  topLevel += text.slice(index);
  if (condition === null) {
    scopes.push(topLevel);
  }
  const declarations = [];
  for (const scope of scopes) {
    for (const rule of scope.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      if (rule[1].split(',').map((part) => part.trim()).includes(selector)) {
        declarations.push(rule[2]);
      }
    }
  }
  return declarations;
}

describe('install bar markup', () => {
  let html;

  before(async () => {
    html = await readText('index.html');
  });

  it('is a labelled, hidden <aside> right after </main>, outside the header', () => {
    const bar = installBar(html);
    const opening = bar.slice(0, bar.indexOf('>') + 1);
    assert.equal(attributeOf(opening, 'aria-label'), 'Install the app');
    assert.equal(attributeOf(opening, 'hidden'), '');
    assert.equal(attributeOf(opening, 'class'), 'install-offer');
    const afterMain = html.slice(html.indexOf('</main>') + '</main>'.length);
    assert.ok(afterMain.trimStart().startsWith('<aside'), 'the bar follows </main> directly');
    const header = html.slice(html.indexOf('<header'), html.indexOf('</header>'));
    assert.ok(!header.includes('install'), 'nothing of the bar is in the header');
  });

  it('is not a live region', () => {
    const bar = installBar(html);
    assert.doesNotMatch(bar, /aria-live|role="(status|alert|log)"/);
  });

  it('holds the text, an Install and a Not now button, and a decorative icon', () => {
    const bar = installBar(html);
    assert.match(bar, /<p class="install-offer__text" data-role="install-offer-text"><\/p>/);
    const buttons = [...bar.matchAll(/<button\b([^>]*)>([^<]*)<\/button>/g)];
    assert.deepEqual(buttons.map((button) => button[2]), ['Install', 'Not now']);
    for (const [, attributes] of buttons) {
      assert.equal(attributeOf(`${attributes}>`, 'type'), 'button');
    }
    assert.equal(attributeOf(`${buttons[0][1]}>`, 'data-action'), 'install-app');
    assert.equal(attributeOf(`${buttons[0][1]}>`, 'hidden'), '');
    assert.equal(attributeOf(`${buttons[1][1]}>`, 'data-action'), 'dismiss-install-offer');
    const image = bar.match(/<img\b[^>]*>/);
    assert.ok(image, 'an <img>');
    assert.equal(attributeOf(image[0], 'alt'), '');
    assert.equal(attributeOf(image[0], 'src'), './icons/icon-192.png');
  });
});

describe('install bar styles', () => {
  let mainCss;

  before(async () => {
    mainCss = await readText('styles/main.css');
  });

  it('lets the hidden attribute beat display: flex', () => {
    const declarations = declarationsFor(mainCss, '.install-offer[hidden]', null);
    assert.ok(declarations.some((text) => /display:\s*none/.test(text)), '.install-offer[hidden] { display: none }');
  });

  for (const [name, condition] of [['compact screens', COMPACT_MEDIA], ['coarse pointers', COARSE_MEDIA]]) {
    it(`makes the buttons at least 44 × 44 px on ${name}`, () => {
      const declarations = declarationsFor(mainCss, '.install-offer__button', condition).join(';');
      assert.match(declarations, /min-height:\s*var\(--touch-target\)/);
      assert.match(declarations, /min-width:\s*var\(--touch-target\)/);
    });
  }

  it('hides the bar when printing', async () => {
    const printCss = await readText('styles/print.css');
    const declarations = declarationsFor(printCss, '.install-offer', null);
    assert.ok(declarations.some((text) => /display:\s*none/.test(text)), '.install-offer { display: none }');
  });
});
