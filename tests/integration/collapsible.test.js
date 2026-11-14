// Checks src/ui/collapsible.js with a minimal stand-in for a <button>: only the attribute and
// event methods the module uses (see openspec/specs/responsive-layout/spec.md, "Settings fold
// into a summary button on compact screens").

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setupCollapsible } from '../../src/ui/collapsible.js';

// A fake button: keeps attributes in a Map and calls 'click' listeners from click().
function fakeButton(attributes = {}) {
  const values = new Map(Object.entries(attributes));
  const listeners = [];
  return {
    getAttribute: (name) => values.get(name) ?? null,
    setAttribute: (name, value) => values.set(name, String(value)),
    addEventListener: (type, listener) => {
      if (type === 'click') {
        listeners.push(listener);
      }
    },
    click() {
      for (const listener of listeners) {
        listener({ type: 'click', currentTarget: this });
      }
    },
  };
}

describe('setupCollapsible', () => {
  it('expands a collapsed panel on the first click and collapses it on the second', () => {
    const toggle = fakeButton({ 'aria-expanded': 'false' });
    setupCollapsible(toggle);
    toggle.click();
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
    toggle.click();
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  });

  it('treats a button without aria-expanded as collapsed', () => {
    const toggle = fakeButton();
    setupCollapsible(toggle);
    toggle.click();
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  });

  it('changes nothing before the first click', () => {
    const toggle = fakeButton({ 'aria-expanded': 'false' });
    setupCollapsible(toggle);
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  });
});
