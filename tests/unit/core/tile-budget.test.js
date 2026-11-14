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
  buildPlan,
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
  it('keeps 48 MiB of tiles per layer and reads at most 524,288 stitches per frame', () => {
    assert.equal(TILE_CACHE_BUDGET_BYTES, 50331648);
    assert.equal(BUILD_BUDGET_STITCHES, 524288);
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

describe('buildPlan', () => {
  const TILE_STITCHES_PER_ROW = 512;
  const OVERVIEW_STITCHES_PER_ROW = 80000; // 8 stitch rows × 10000 stitches at overview level 3

  // The 9 visible level-0 tiles of "Zoomed into the middle", then the 1250-row overview.
  function zoomedJobs() {
    const jobs = [];
    for (let i = 1; i <= 9; i++) {
      jobs.push({ key: `tile${i}`, stitchesPerRow: TILE_STITCHES_PER_ROW, rowsLeft: 512 });
    }
    jobs.push({ key: 'overview', stitchesPerRow: OVERVIEW_STITCHES_PER_ROW, rowsLeft: 1250 });
    return jobs;
  }

  // Applies one frame's plan; returns the jobs still unfinished.
  function afterFrame(jobs, plan) {
    const rowsByKey = new Map(plan.map((step) => [step.key, step.rows]));
    return jobs
      .map((job) => ({ ...job, rowsLeft: job.rowsLeft - (rowsByKey.get(job.key) ?? 0) }))
      .filter((job) => job.rowsLeft > 0);
  }

  it('builds the 9 level-0 tiles of a 10000² pattern in pairs, the ninth with 3 overview rows', () => {
    let jobs = zoomedJobs();
    const plans = [];
    for (let frame = 1; frame <= 5; frame++) {
      const plan = buildPlan(jobs, BUILD_BUDGET_STITCHES);
      plans.push(plan);
      jobs = afterFrame(jobs, plan);
    }
    for (let frame = 0; frame < 4; frame++) {
      assert.deepEqual(plans[frame], [
        { key: `tile${2 * frame + 1}`, rows: 512 },
        { key: `tile${2 * frame + 2}`, rows: 512 },
      ]);
    }
    assert.deepEqual(plans[4], [
      { key: 'tile9', rows: 512 },
      { key: 'overview', rows: 3 },
    ]);
  });

  it('completes the 10000² overview at Fit in 209 frames of 6 rows', () => {
    let jobs = [{ key: 'overview', stitchesPerRow: OVERVIEW_STITCHES_PER_ROW, rowsLeft: 1250 }];
    const rowsPerFrame = [];
    while (jobs.length > 0) {
      const plan = buildPlan(jobs, BUILD_BUDGET_STITCHES);
      rowsPerFrame.push(plan[0].rows);
      jobs = afterFrame(jobs, plan);
    }
    assert.equal(rowsPerFrame.length, 209);
    assert.ok(rowsPerFrame.slice(0, 208).every((rows) => rows === 6));
    assert.equal(rowsPerFrame[208], 2);
  });

  it('gives one row to a job whose row exceeds the budget and nothing to later jobs', () => {
    const jobs = [
      { key: 'wide', stitchesPerRow: 5000000, rowsLeft: 10 },
      { key: 'next', stitchesPerRow: 1, rowsLeft: 10 },
    ];
    assert.deepEqual(buildPlan(jobs, 100), [{ key: 'wide', rows: 1 }]);
  });

  it('plans nothing without jobs', () => {
    assert.deepEqual(buildPlan([], BUILD_BUDGET_STITCHES), []);
  });

  it('does not modify the jobs', () => {
    const jobs = zoomedJobs();
    const before = JSON.stringify(jobs);
    buildPlan(jobs, BUILD_BUDGET_STITCHES);
    assert.equal(JSON.stringify(jobs), before);
  });
});
