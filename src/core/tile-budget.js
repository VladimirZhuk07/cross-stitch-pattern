// Budgets of the pattern pictures: how much tile memory a layer keeps and how many stitches it
// may read per frame to build pictures. Pure: no DOM, no canvas, no timers. The authoritative
// description is openspec/specs/large-pattern-rendering/spec.md; the numbers are justified in
// the design of the change tile-large-pattern-rendering (D6, D8).

const MIB = 1024 * 1024;

/**
 * Tile memory one layer keeps: 48 MiB = 48 tiles of 512 × 512 RGBA. Covers the largest set of
 * tiles visible at once in a 1000 × 800 CSS px frame at device pixel ratio 2 (42 tiles) and in
 * a 390 × 600 phone frame at ratio 3 (30), so panning back and forth does not rebuild.
 */
export const TILE_CACHE_BUDGET_BYTES = 48 * MIB;

/**
 * Stitches a layer may read per frame to build pictures: 2^19 = 524,288, exactly 2 level-0
 * tiles of 512 × 512. Measured in Node 22 (V8): about 2–3 ns per stitch at level 0 and up to
 * 7–8 ns at level 1, where only 4 stitches share an averaged pixel. So a frame spends at most
 * about 4.5 ms on desktop and, with phones 2–3 times slower, about 9–13 ms there, leaving
 * room in a 16.7 ms frame for drawing (design D6).
 */
export const BUILD_BUDGET_STITCHES = 2 ** 19;

// EvictionEntry (input of tilesToEvict):
//   key        the tile's cache key, any string
//   bytes      memory the tile holds
//   lastDrawn  number of the frame in which the tile was last drawn (larger = more recent)

/**
 * Returns the keys of the tiles to release so the remaining tiles hold at most budgetBytes:
 * least recently drawn first (equal lastDrawn in input order), never a key in keepKeys
 * (the tiles drawn in the current frame), so the result may leave the total over budget.
 * entries      list of EvictionEntry; not modified
 * budgetBytes  bytes to keep at most
 * keepKeys     keys that must not be released
 */
export function tilesToEvict(entries, budgetBytes, keepKeys) {
  const kept = new Set(keepKeys);
  let total = 0;
  for (const entry of entries) {
    total += entry.bytes;
  }
  // Array.prototype.sort is stable, so equal lastDrawn keep their input order.
  const candidates = entries
    .filter((entry) => !kept.has(entry.key))
    .sort((a, b) => a.lastDrawn - b.lastDrawn);
  const evicted = [];
  for (const entry of candidates) {
    if (total <= budgetBytes) {
      break;
    }
    evicted.push(entry.key);
    total -= entry.bytes;
  }
  return evicted;
}

/**
 * Returns how many rows of a picture to build with the stitches left in this frame:
 * as many whole rows as fit, at least one while any budget is left (so building always
 * progresses, even when one row is larger than the budget), at most rowsLeft, 0 when the
 * budget is spent.
 * stitchesPerRow  stitches read to build one picture row (> 0)
 * budgetLeft      stitches still allowed in this frame
 * rowsLeft        rows of the picture not built yet (≥ 0)
 * Throws RangeError if stitchesPerRow is not a positive number.
 */
export function rowsWithinBudget(stitchesPerRow, budgetLeft, rowsLeft) {
  if (!Number.isFinite(stitchesPerRow) || stitchesPerRow <= 0) {
    throw new RangeError(`stitchesPerRow must be a positive number, got ${String(stitchesPerRow)}`);
  }
  if (budgetLeft <= 0 || rowsLeft <= 0) {
    return 0;
  }
  const rowsThatFit = Math.max(1, Math.floor(budgetLeft / stitchesPerRow));
  return Math.min(rowsLeft, rowsThatFit);
}

// BuildJob (input of buildPlan): a picture still being built.
//   key             the picture's key, any string
//   stitchesPerRow  stitches read to build one of its rows
//   rowsLeft        rows not built yet (> 0)
// BuildStep (output): { key, rows }, the rows of that picture to build in this frame.

/**
 * Shares one frame's build budget among the pictures being built, in the given order
 * (visible tiles first, then the overview): each job gets rowsWithinBudget rows of what is
 * left, until the budget is spent. Returns the BuildSteps of the jobs that get rows, in order.
 * jobs            list of BuildJob; not modified
 * budgetStitches  stitches allowed in this frame (BUILD_BUDGET_STITCHES in the app)
 */
export function buildPlan(jobs, budgetStitches) {
  const plan = [];
  let budgetLeft = budgetStitches;
  for (const job of jobs) {
    const rows = rowsWithinBudget(job.stitchesPerRow, budgetLeft, job.rowsLeft);
    if (rows === 0) {
      break;
    }
    plan.push({ key: job.key, rows });
    budgetLeft -= rows * job.stitchesPerRow;
  }
  return plan;
}
