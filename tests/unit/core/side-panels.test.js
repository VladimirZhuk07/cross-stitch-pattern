// Unit tests for src/core/side-panels.js (see openspec/specs/responsive-layout/spec.md,
// "Folded state is remembered across page loads").

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SIDE_PANEL_DEFAULTS, parseSidePanelState } from '../../../src/core/side-panels.js';

describe('parseSidePanelState', () => {
  it('opens both panels when nothing is stored', () => {
    assert.deepEqual(parseSidePanelState(null), { settings: 'open', legend: 'open' });
  });

  it('reads a stored state', () => {
    assert.deepEqual(
      parseSidePanelState('{"settings":"open","legend":"folded"}'),
      { settings: 'open', legend: 'folded' },
    );
  });

  it('opens both panels for text that is not a JSON object', () => {
    for (const text of ['not json', '[]', 'null', '42', '"folded"', '']) {
      assert.deepEqual(parseSidePanelState(text), { settings: 'open', legend: 'open' }, `for ${JSON.stringify(text)}`);
    }
  });

  it('opens a panel whose stored value is unknown or missing', () => {
    assert.deepEqual(parseSidePanelState('{"settings":"sideways"}'), { settings: 'open', legend: 'open' });
  });

  it('keeps only the two panel fields', () => {
    assert.deepEqual(
      parseSidePanelState('{"legend":"folded","extra":1}'),
      { settings: 'open', legend: 'folded' },
    );
  });

  it('returns a fresh object that does not share the defaults', () => {
    const state = parseSidePanelState(null);
    state.settings = 'folded';
    assert.equal(SIDE_PANEL_DEFAULTS.settings, 'open');
    assert.deepEqual(parseSidePanelState(null), { settings: 'open', legend: 'open' });
  });
});
