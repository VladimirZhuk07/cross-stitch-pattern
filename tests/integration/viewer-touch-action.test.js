// Guards the CSS that keeps pinch and double tap over the view frame from zooming the page:
// the frame [data-role="viewer"] (class .viewer) has touch-action: none, while the page itself
// keeps the browser's normal touch scrolling and zooming (pattern-viewer spec, "Touch gestures
// over the frame do not zoom or scroll the page").

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const STYLESHEETS = ['../../styles/main.css', '../../styles/print.css'];
const PAGE_SELECTORS = ['html', 'body', ':root'];

/**
 * Returns the innermost rules of a stylesheet as { selectors, body }: selectors is the list of
 * trimmed selectors, body the declarations text. Comments are removed; rules inside @media
 * blocks are returned like top-level ones.
 */
function cssRules(css) {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  for (const match of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1].split(',').map((selector) => selector.trim());
    rules.push({ selectors, body: match[2] });
  }
  return rules;
}

describe('touch-action of the view frame and the page', () => {
  let rules;

  before(async () => {
    rules = [];
    for (const path of STYLESHEETS) {
      rules.push(...cssRules(await readFile(new URL(path, import.meta.url), 'utf8')));
    }
  });

  it('sets touch-action: none on the .viewer frame', () => {
    const viewerRules = rules.filter((rule) => rule.selectors.includes('.viewer'));
    assert.ok(viewerRules.length > 0, 'no .viewer rule found');
    assert.ok(
      viewerRules.some((rule) => /(^|[;\s])touch-action\s*:\s*none\s*(;|$)/.test(rule.body)),
      'the .viewer rule must declare touch-action: none',
    );
  });

  it('leaves touch-action of html, body and :root at the browser default', () => {
    const pageRules = rules.filter((rule) => (
      rule.selectors.some((selector) => PAGE_SELECTORS.includes(selector))
    ));
    assert.ok(pageRules.length > 0, 'no html/body/:root rule found');
    for (const rule of pageRules) {
      assert.doesNotMatch(rule.body, /touch-action/, `${rule.selectors.join(', ')} sets touch-action`);
    }
  });
});
