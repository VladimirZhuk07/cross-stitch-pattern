// Unit tests for src/core/side-panels.js (see openspec/specs/responsive-layout/spec.md,
// "Folded state is remembered across page loads").

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SIDE_PANEL_DEFAULTS, parseSidePanelState, serializeSidePanelState, shouldOpenSettings } from '../../../src/core/side-panels.js';

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

describe('serializeSidePanelState', () => {
  it('writes both panels as JSON', () => {
    assert.equal(
      serializeSidePanelState({ settings: 'folded', legend: 'open' }),
      '{"settings":"folded","legend":"open"}',
    );
  });

  it('drops fields other than the two panels', () => {
    assert.equal(
      serializeSidePanelState({ settings: 'open', legend: 'folded', extra: 1 }),
      '{"settings":"open","legend":"folded"}',
    );
  });

  it('rejects an unknown panel value, naming the panel and the value', () => {
    assert.throws(
      () => serializeSidePanelState({ settings: 'closed', legend: 'open' }),
      (error) => error instanceof TypeError && /settings/.test(error.message) && /closed/.test(error.message),
    );
  });

  it('round-trips every combination through parseSidePanelState', () => {
    for (const settings of ['open', 'folded']) {
      for (const legend of ['open', 'folded']) {
        const state = { settings, legend };
        assert.deepEqual(parseSidePanelState(serializeSidePanelState(state)), state);
      }
    }
  });
});

describe('shouldOpenSettings', () => {
  it('opens the settings when a large pattern starts waiting for Generate', () => {
    assert.equal(shouldOpenSettings('running', 'awaiting-confirmation'), true);
    assert.equal(shouldOpenSettings('idle', 'awaiting-confirmation'), true);
  });

  it('opens the settings when generation fails', () => {
    assert.equal(shouldOpenSettings('running', 'error'), true);
  });

  it('does not reopen them while the status stays the same', () => {
    assert.equal(shouldOpenSettings('error', 'error'), false);
    assert.equal(shouldOpenSettings('awaiting-confirmation', 'awaiting-confirmation'), false);
  });

  it('leaves them alone for every other status', () => {
    assert.equal(shouldOpenSettings('running', 'done'), false);
    assert.equal(shouldOpenSettings('idle', 'running'), false);
    assert.equal(shouldOpenSettings('running', 'stopped'), false);
  });
});
