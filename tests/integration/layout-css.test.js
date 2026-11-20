// Checks the stylesheet rules the phone layout depends on (see
// openspec/specs/responsive-layout/spec.md). The layout itself is checked in the browser.

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const MAIN_CSS_URL = new URL('../../styles/main.css', import.meta.url);
const PRINT_CSS_URL = new URL('../../styles/print.css', import.meta.url);

// Returns the declarations of every rule whose selector list contains the selector.
function declarationsFor(css, selector) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [...withoutComments.matchAll(/([^{}]+)\{([^}]*)\}/g)];
  return rules
    .filter((rule) => rule[1].split(',').map((part) => part.trim()).includes(selector))
    .map((rule) => rule[2]);
}

// Returns the condition of every @media rule, e.g. 'screen and (width < 48rem)'.
function mediaConditions(css) {
  return [...css.matchAll(/@media\s+([^{]+)\{/g)].map((match) => match[1].trim());
}

describe('layout stylesheet', () => {
  let mainCss;

  before(async () => {
    mainCss = await readFile(MAIN_CSS_URL, 'utf8');
  });

  it('applies the compact layout to screens only, never to printing', () => {
    const compact = mediaConditions(mainCss).filter((condition) => /\b(48|30)rem\b/.test(condition));
    assert.ok(compact.length > 0, 'there is a compact layout rule');
    for (const condition of compact) {
      for (const query of condition.split(',')) {
        assert.match(query.trim(), /^screen\b/, `"${condition}" is limited to screens`);
      }
    }
  });

  it('has no rule left from the old one-column breakpoint', () => {
    assert.ok(!mediaConditions(mainCss).includes('(max-width: 48rem)'));
  });

  it('drops the Export menu items down over the page', () => {
    const declarations = declarationsFor(mainCss, '.export-menu__items');
    assert.ok(declarations.some((text) => /position:\s*absolute/.test(text)), '.export-menu__items { position: absolute }');
  });

  it('hides the Export menu when printing', async () => {
    const printCss = await readFile(PRINT_CSS_URL, 'utf8');
    const declarations = declarationsFor(printCss, '.export-menu');
    assert.ok(declarations.some((text) => /display:\s*none/.test(text)), '.export-menu { display: none }');
  });

  it('hides the panel toggle buttons when printing', async () => {
    const printCss = await readFile(PRINT_CSS_URL, 'utf8');
    const declarations = declarationsFor(printCss, '.collapsible__toggle');
    assert.ok(declarations.some((text) => /display:\s*none/.test(text)), '.collapsible__toggle { display: none }');
  });
});

// The exact complement of the compact layout query on screens (see design D2 of
// add-collapsible-side-panels): wide and medium screens, where the side panels can fold.
const SIDE_PANEL_MEDIA = 'screen and (width >= 48rem) and (height >= 30rem), screen and (width >= 60rem)';

// Splits a stylesheet (comments removed) into its top-level text, outside every @media block,
// and the bodies of the @media blocks, keyed by their condition.
function splitMediaBlocks(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks = [];
  let topLevel = '';
  let index = 0;
  for (const match of text.matchAll(/@media\s+([^{]+)\{/g)) {
    if (match.index < index) {
      continue; // a nested @media, already part of the enclosing block
    }
    topLevel += text.slice(index, match.index);
    let depth = 1;
    let end = match.index + match[0].length;
    while (depth > 0) {
      depth += text[end] === '{' ? 1 : text[end] === '}' ? -1 : 0;
      end += 1;
    }
    blocks.push({ condition: match[1].trim(), body: text.slice(match.index + match[0].length, end - 1) });
    index = end;
  }
  topLevel += text.slice(index);
  return { topLevel, blocks };
}

describe('side panel stylesheet', () => {
  let mainCss;

  before(async () => {
    mainCss = await readFile(MAIN_CSS_URL, 'utf8');
  });

  it('hides the side toggles outside every @media block', () => {
    const { topLevel } = splitMediaBlocks(mainCss);
    const declarations = declarationsFor(topLevel, '.side-toggle');
    assert.ok(declarations.some((text) => /display:\s*none/.test(text)), '.side-toggle { display: none }');
  });

  it('has exactly one block for wide and medium screens, the complement of the compact query', () => {
    const matching = mediaConditions(mainCss).filter((condition) => condition === SIDE_PANEL_MEDIA);
    assert.equal(matching.length, 1);
  });

  it('styles the folded state only inside that block', () => {
    const { topLevel, blocks } = splitMediaBlocks(mainCss);
    assert.ok(!topLevel.includes('.side-toggle[aria-expanded'), 'no folded rule at top level');
    for (const block of blocks) {
      if (block.condition !== SIDE_PANEL_MEDIA) {
        assert.ok(!block.body.includes('.side-toggle[aria-expanded'), `no folded rule in @media ${block.condition}`);
      }
    }
    const sideBlock = blocks.find((block) => block.condition === SIDE_PANEL_MEDIA);
    assert.ok(sideBlock.body.includes('.side-toggle[aria-expanded="false"]'), 'the block styles folded panels');
  });

  it('hides the side toggles when printing', async () => {
    const printCss = await readFile(PRINT_CSS_URL, 'utf8');
    const declarations = declarationsFor(printCss, '.side-toggle');
    assert.ok(declarations.some((text) => /display:\s*none/.test(text)), '.side-toggle { display: none }');
  });
});
