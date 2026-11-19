// Checks src/ui/collapsible.js with a minimal stand-in for a <button> (see
// openspec/specs/responsive-layout/spec.md, "Settings fold into a summary button on compact
// screens").

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setupCollapsible } from '../../src/ui/collapsible.js';
import { fakeButton } from '../helpers/fake-button.js';

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

  it('reports every flip to onToggle after aria-expanded has changed', () => {
    const toggle = fakeButton({ 'aria-expanded': 'false' });
    const reports = [];
    setupCollapsible(toggle, (isExpanded) => {
      reports.push([isExpanded, toggle.getAttribute('aria-expanded')]);
    });
    toggle.click();
    toggle.click();
    assert.deepEqual(reports, [[true, 'true'], [false, 'false']]);
  });
});
