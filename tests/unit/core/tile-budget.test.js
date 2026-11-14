// Memory and per-frame build budgets (openspec/specs/large-pattern-rendering/spec.md:
// "Tile memory stays within a budget", "Building is spread over frames").
// Large sizes are checked with sizes only.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertThrowsWith } from '../../helpers/assert-throws-with.js';
import {
  TILE_CACHE_BUDGET_BYTES,
  BUILD_BUDGET_STITCHES,
  tilesToEvict,
  rowsWithinBudget,
} from '../../../src/core/tile-budget.js';

const MIB = 1024 * 1024;

// T1 … T50 of 1 MiB, drawn one per frame; T1 and T50 drawn again in frame 51.
function fiftyTiles() {
  const entries = [];
  for (let i = 1; i <= 50; i++) {
    entries.push({ key: `T${i}`, bytes: MIB, lastDrawn: i === 1 || i === 50 ? 51 : i });
  }
  return entries;
}

describe('budget constants', () => {
  it('keeps 48 MiB of tiles per layer and reads at most 2,097,152 stitches per frame', () => {
    assert.equal(TILE_CACHE_BUDGET_BYTES, 50331648);
    assert.equal(BUILD_BUDGET_STITCHES, 2097152);
  });
});

describe('tilesToEvict', () => {
  it('releases T2 and T3, the tiles drawn longest ago, to get back to 48 MiB', () => {
    assert.deepEqual(tilesToEvict(fiftyTiles(), 48 * MIB, ['T1', 'T50']), ['T2', 'T3']);
  });

  it('releases nothing while the total is within the budget', () => {
    assert.deepEqual(tilesToEvict(fiftyTiles().slice(0, 48), 48 * MIB, []), []);
  });

  it('never releases a tile drawn in the current frame, even over budget', () => {
    const entries = [];
    for (let i = 1; i <= 56; i++) {
      entries.push({ key: `T${i}`, bytes: MIB, lastDrawn: 7 });
    }
    assert.deepEqual(tilesToEvict(entries, 48 * MIB, entries.map((entry) => entry.key)), []);
  });

  it('releases tiles drawn in the same frame in their input order', () => {
    const entries = [
      { key: 'B', bytes: MIB, lastDrawn: 3 },
      { key: 'A', bytes: MIB, lastDrawn: 3 },
      { key: 'C', bytes: MIB, lastDrawn: 4 },
    ];
    assert.deepEqual(tilesToEvict(entries, MIB, ['C']), ['B', 'A']);
  });

  it('does not modify its input', () => {
    const entries = fiftyTiles();
    const before = JSON.stringify(entries);
    tilesToEvict(entries, 48 * MIB, ['T1']);
    assert.equal(JSON.stringify(entries), before);
  });
});

describe('rowsWithinBudget', () => {
  it('gives the 10000² overview 26 rows of 80,000 stitches per frame', () => {
    assert.equal(rowsWithinBudget(80000, 2097152, 1250), 26);
  });

  it('gives no more rows than are left', () => {
    assert.equal(rowsWithinBudget(80000, 2097152, 2), 2);
  });

  it('builds a whole 512 × 512 level-0 tile within the budget', () => {
    assert.equal(rowsWithinBudget(512, 2097152, 512), 512);
  });

  it('gives at least one row when a single row is larger than the budget left', () => {
    assert.equal(rowsWithinBudget(5000000, 100, 10), 1);
  });

  it('gives no row once the budget is spent', () => {
    assert.equal(rowsWithinBudget(512, 0, 10), 0);
  });

  it('rejects a row of 0 stitches', () => {
    assertThrowsWith(() => rowsWithinBudget(0, 100, 10), RangeError, 'stitchesPerRow', '0');
  });
});
