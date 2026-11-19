// Unit tests for src/core/tap.js (see openspec/specs/stitch-progress/spec.md, "A tap or click
// toggles a stitch").

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TAP_SLOP, idleTap, startTap, moveTap, endTap, cancelTap } from '../../../src/core/tap.js';

const POINTER = 1;
const OTHER = 2;

// Runs a press: start at `from`, move through `moves`, end at the last point.
function press(from, moves = []) {
  let tracker = startTap(idleTap(), POINTER, from);
  for (const point of moves) {
    tracker = moveTap(tracker, POINTER, point);
  }
  return endTap(tracker, POINTER, moves.at(-1) ?? from);
}

describe('tap tracker', () => {
  it('allows 8 CSS px of movement', () => {
    assert.equal(TAP_SLOP, 8);
  });

  it('reports a press that does not move as a tap at its point', () => {
    assert.deepEqual(press({ x: 50, y: 30 }).tapPoint, { x: 50, y: 30 });
  });

  it('still reports a tap after a small wobble, at the release point', () => {
    assert.deepEqual(press({ x: 50, y: 30 }, [{ x: 56, y: 34 }]).tapPoint, { x: 56, y: 34 });
  });

  it('counts a movement of exactly 8 px as a tap', () => {
    assert.deepEqual(press({ x: 50, y: 30 }, [{ x: 58, y: 30 }]).tapPoint, { x: 58, y: 30 });
  });

  it('is no tap once the pointer went further than 8 px, even if it comes back', () => {
    assert.equal(press({ x: 50, y: 30 }, [{ x: 58.5, y: 30 }, { x: 50, y: 30 }]).tapPoint, null);
  });

  it('is no tap when a second pointer touches before the first lifts', () => {
    let tracker = startTap(idleTap(), POINTER, { x: 50, y: 30 });
    tracker = startTap(tracker, OTHER, { x: 90, y: 30 });
    const first = endTap(tracker, POINTER, { x: 50, y: 30 });
    assert.equal(first.tapPoint, null);
    assert.equal(endTap(first.tracker, OTHER, { x: 90, y: 30 }).tapPoint, null);
  });

  it('ignores the end of a pointer it does not track', () => {
    const tracker = startTap(idleTap(), POINTER, { x: 50, y: 30 });
    const result = endTap(tracker, OTHER, { x: 50, y: 30 });
    assert.equal(result.tapPoint, null);
    assert.deepEqual(result.tracker, tracker);
  });

  it('ignores moves of other pointers', () => {
    let tracker = startTap(idleTap(), POINTER, { x: 50, y: 30 });
    tracker = moveTap(tracker, OTHER, { x: 200, y: 200 });
    assert.deepEqual(endTap(tracker, POINTER, { x: 50, y: 30 }).tapPoint, { x: 50, y: 30 });
  });

  it('goes back to idle when cancelled or after an end', () => {
    const tracker = startTap(idleTap(), POINTER, { x: 50, y: 30 });
    assert.deepEqual(cancelTap(tracker), idleTap());
    assert.deepEqual(endTap(tracker, POINTER, { x: 50, y: 30 }).tracker, idleTap());
  });

  it('does not modify the tracker it is given', () => {
    const tracker = startTap(idleTap(), POINTER, { x: 50, y: 30 });
    const copy = structuredClone(tracker);
    moveTap(tracker, POINTER, { x: 80, y: 30 });
    assert.deepEqual(tracker, copy);
  });
});
