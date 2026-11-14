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

  it('hides the panel toggle buttons when printing', async () => {
    const printCss = await readFile(PRINT_CSS_URL, 'utf8');
    const declarations = declarationsFor(printCss, '.collapsible__toggle');
    assert.ok(declarations.some((text) => /display:\s*none/.test(text)), '.collapsible__toggle { display: none }');
  });
});
