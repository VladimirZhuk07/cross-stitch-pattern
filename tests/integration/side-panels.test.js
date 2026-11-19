// Checks src/ui/side-panels.js with fake buttons, the real store and a fake storage (see
// openspec/specs/responsive-layout/spec.md, "Side toggles are accessible buttons", "Folded
// state is remembered across page loads", "Folded settings open when generation needs the user").

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setupSidePanels } from '../../src/ui/side-panels.js';
import { createStore } from '../../src/ui/store.js';
import { createInitialState } from '../../src/ui/app-state.js';
import { fakeButton } from '../helpers/fake-button.js';

// The two side toggles as index.html declares them, behind a querySelector by data-action.
function fakeRoot() {
  const toggles = {
    settings: fakeButton({ 'aria-expanded': 'true', title: 'Hide settings' }),
    legend: fakeButton({ 'aria-expanded': 'true', title: 'Hide legend' }),
  };
  const bySelector = {
    '[data-action="toggle-settings-side"]': toggles.settings,
    '[data-action="toggle-legend-side"]': toggles.legend,
  };
  return { toggles, querySelector: (selector) => bySelector[selector] ?? null };
}

// A storage that returns storedText and records every write; write succeeds unless told otherwise.
function fakeStorage(storedText, { canWrite = true } = {}) {
  const writes = [];
  return {
    writes,
    read: () => storedText,
    write: (text) => {
      writes.push(text);
      return canWrite;
    },
  };
}

function setup(storedText, options) {
  const root = fakeRoot();
  const store = createStore(createInitialState());
  const storage = fakeStorage(storedText, options);
  setupSidePanels(root, store, storage);
  return { ...root.toggles, store, storage };
}

describe('setupSidePanels', () => {
  it('restores the stored state into aria-expanded and the tooltips', () => {
    const { settings, legend } = setup('{"settings":"folded","legend":"open"}');
    assert.equal(settings.getAttribute('aria-expanded'), 'false');
    assert.equal(settings.getAttribute('title'), 'Show settings');
    assert.equal(legend.getAttribute('aria-expanded'), 'true');
    assert.equal(legend.getAttribute('title'), 'Hide legend');
  });

  it('opens both panels when nothing is stored', () => {
    const { settings, legend, storage } = setup(null);
    assert.equal(settings.getAttribute('aria-expanded'), 'true');
    assert.equal(legend.getAttribute('aria-expanded'), 'true');
    assert.deepEqual(storage.writes, []);
  });

  it('stores the new state and updates the tooltip on a click', () => {
    const { legend, storage } = setup('{"settings":"folded","legend":"open"}');
    legend.click();
    assert.deepEqual(storage.writes, ['{"settings":"folded","legend":"folded"}']);
    assert.equal(legend.getAttribute('aria-expanded'), 'false');
    assert.equal(legend.getAttribute('title'), 'Show legend');
  });

  it('keeps folding when storage cannot be written', () => {
    const { settings } = setup(null, { canWrite: false });
    settings.click();
    assert.equal(settings.getAttribute('aria-expanded'), 'false');
    settings.click();
    assert.equal(settings.getAttribute('aria-expanded'), 'true');
    assert.equal(settings.getAttribute('title'), 'Hide settings');
  });

  it('opens folded settings when a large pattern waits for Generate', () => {
    const { settings, store, storage } = setup('{"settings":"folded","legend":"open"}');
    store.setState({ generation: { kind: 'running', text: 'Generating pattern…' } });
    store.setState({ generation: { kind: 'awaiting-confirmation', text: 'Press Generate to start.' } });
    assert.equal(settings.getAttribute('aria-expanded'), 'true');
    assert.equal(settings.getAttribute('title'), 'Hide settings');
    assert.deepEqual(storage.writes, ['{"settings":"open","legend":"open"}']);
  });

  it('opens folded settings when generation fails', () => {
    const { settings, store } = setup('{"settings":"folded","legend":"folded"}');
    store.setState({ generation: { kind: 'running', text: 'Generating pattern…' } });
    store.setState({ generation: { kind: 'error', text: 'Could not generate the pattern: boom' } });
    assert.equal(settings.getAttribute('aria-expanded'), 'true');
  });

  it('leaves folded settings folded when a pattern is ready', () => {
    const { settings, store, storage } = setup('{"settings":"folded","legend":"open"}');
    store.setState({ generation: { kind: 'running', text: 'Generating pattern…' } });
    store.setState({ generation: { kind: 'done', text: 'Pattern ready.' } });
    assert.equal(settings.getAttribute('aria-expanded'), 'false');
    assert.deepEqual(storage.writes, []);
  });
});
