import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertClose, assertCloseFields } from '../../helpers/assert-close.js';
import {
  pinchViewport,
  trackpadPinchFactor,
  emptyGesture,
  startPointer,
  movePointer,
  endPointer,
} from '../../../src/core/pinch-zoom.js';

const TOLERANCE = 1e-9;
const LIMITS = { minScale: 0.5, maxScale: 64 };
const VIEWPORT_KEYS = ['scale', 'offsetX', 'offsetY'];
const START_POINTS = [{ x: 100, y: 100 }, { x: 200, y: 100 }];

function viewport(scale, offsetX, offsetY) {
  return { scale, offsetX, offsetY };
}

function points(x1, y1, x2, y2) {
  return [{ x: x1, y: y1 }, { x: x2, y: y2 }];
}

describe('pinchViewport', () => {
  it('doubles the scale around the midpoint when the fingers spread to twice the distance', () => {
    const result = pinchViewport(viewport(1, 0, 0), START_POINTS, points(50, 100, 250, 100), LIMITS);
    assertCloseFields(result, viewport(2, -150, -100), VIEWPORT_KEYS, TOLERANCE);
  });

  it('pans by the midpoint shift when both fingers move together', () => {
    const result = pinchViewport(viewport(1, 0, 0), START_POINTS, points(130, 140, 230, 140), LIMITS);
    assertCloseFields(result, viewport(1, 30, 40), VIEWPORT_KEYS, TOLERANCE);
  });

  it('carries the point under the old midpoint to the new midpoint while zooming', () => {
    const result = pinchViewport(viewport(1, 0, 0), START_POINTS, points(80, 150, 280, 150), LIMITS);
    assertCloseFields(result, viewport(2, -120, -50), VIEWPORT_KEYS, TOLERANCE);
  });

  it('clamps at the upper limit and keeps the midpoint point in place', () => {
    const result = pinchViewport(viewport(40, 0, 0), START_POINTS, points(50, 100, 250, 100), LIMITS);
    assertCloseFields(result, viewport(64, -90, -60), VIEWPORT_KEYS, TOLERANCE);
  });

  it('clamps at the lower limit', () => {
    const result = pinchViewport(viewport(0.8, 0, 0), START_POINTS, points(125, 100, 175, 100), LIMITS);
    assertCloseFields(result, viewport(0.5, 56.25, 37.5), VIEWPORT_KEYS, TOLERANCE);
  });

  it('only pans when the previous points are at the same position', () => {
    const result = pinchViewport(
      viewport(1, 0, 0), points(100, 100, 100, 100), points(100, 100, 120, 120), LIMITS,
    );
    assertCloseFields(result, viewport(1, 10, 10), VIEWPORT_KEYS, TOLERANCE);
  });

  it('only pans when the current points are at the same position', () => {
    const result = pinchViewport(
      viewport(1, 0, 0), points(100, 100, 120, 120), points(120, 120, 120, 120), LIMITS,
    );
    assertCloseFields(result, viewport(1, 10, 10), VIEWPORT_KEYS, TOLERANCE);
  });

  it('rejects one point', () => {
    assert.throws(
      () => pinchViewport(viewport(1, 0, 0), [{ x: 0, y: 0 }], START_POINTS, LIMITS),
      { name: 'RangeError', message: /got 1/ },
    );
  });

  it('rejects three points', () => {
    const three = [...START_POINTS, { x: 0, y: 0 }];
    assert.throws(
      () => pinchViewport(viewport(1, 0, 0), START_POINTS, three, LIMITS),
      { name: 'RangeError', message: /got 3/ },
    );
  });

  it('does not modify its arguments', () => {
    const start = viewport(1, 0, 0);
    const previous = points(100, 100, 200, 100);
    const current = points(50, 100, 250, 100);
    pinchViewport(start, previous, current, LIMITS);
    assert.deepEqual(start, viewport(1, 0, 0));
    assert.deepEqual(previous, points(100, 100, 200, 100));
    assert.deepEqual(current, points(50, 100, 250, 100));
  });
});

describe('trackpadPinchFactor', () => {
  const FACTOR_TOLERANCE = 1e-6;

  it('zooms in by e^0.4 for a delta of −40 px', () => {
    assertClose(trackpadPinchFactor(-40), 1.4918247, FACTOR_TOLERANCE, 'factor');
  });

  it('limits a delta of +100 px to +50 px', () => {
    assertClose(trackpadPinchFactor(100), 0.6065307, FACTOR_TOLERANCE, 'factor');
  });

  it('limits a delta of −100 px to −50 px', () => {
    assertClose(trackpadPinchFactor(-100), 1.6487213, FACTOR_TOLERANCE, 'factor');
  });

  it('does not zoom for a delta of 0', () => {
    assert.equal(trackpadPinchFactor(0), 1);
  });

  it('zooms in by e^0.1 for a small delta of −10 px', () => {
    assertClose(trackpadPinchFactor(-10), 1.1051709, FACTOR_TOLERANCE, 'factor');
  });
});

describe('pointer gesture', () => {
  function twoFingers() {
    const one = startPointer(emptyGesture(), 1, { x: 100, y: 100 });
    return startPointer(one, 2, { x: 200, y: 100 });
  }

  it('starts with no pointers', () => {
    assert.deepEqual(emptyGesture(), { pointers: [] });
  });

  it('tracks two pointers in touch-down order', () => {
    assert.deepEqual(twoFingers(), {
      pointers: [{ id: 1, x: 100, y: 100 }, { id: 2, x: 200, y: 100 }],
    });
  });

  it('ignores a third pointer', () => {
    const gesture = twoFingers();
    assert.equal(startPointer(gesture, 3, { x: 300, y: 300 }), gesture);
  });

  it('ignores a pointer id that is already tracked', () => {
    const gesture = startPointer(emptyGesture(), 1, { x: 100, y: 100 });
    assert.equal(startPointer(gesture, 1, { x: 150, y: 150 }), gesture);
  });

  it('pans by the movement of a single pointer', () => {
    const gesture = startPointer(emptyGesture(), 1, { x: 100, y: 100 });
    const result = movePointer(gesture, 1, { x: 130, y: 80 }, viewport(1, 16, 158), LIMITS);
    assertCloseFields(result.viewport, viewport(1, 46, 138), VIEWPORT_KEYS, TOLERANCE);
    assert.deepEqual(result.gesture.pointers, [{ id: 1, x: 130, y: 80 }]);
  });

  it('pinches when two pointers move one after the other', () => {
    const first = movePointer(twoFingers(), 1, { x: 50, y: 100 }, viewport(1, 0, 0), LIMITS);
    const second = movePointer(first.gesture, 2, { x: 250, y: 100 }, first.viewport, LIMITS);
    assertCloseFields(second.viewport, viewport(2, -150, -100), VIEWPORT_KEYS, TOLERANCE);
  });

  it('pans from the remaining pointer after one of two is lifted, without a jump', () => {
    const first = movePointer(twoFingers(), 1, { x: 50, y: 100 }, viewport(1, 0, 0), LIMITS);
    const second = movePointer(first.gesture, 2, { x: 250, y: 100 }, first.viewport, LIMITS);
    const lifted = endPointer(second.gesture, 1);
    const result = movePointer(lifted, 2, { x: 270, y: 90 }, second.viewport, LIMITS);
    assertCloseFields(result.viewport, viewport(2, -130, -110), VIEWPORT_KEYS, TOLERANCE);
  });

  it('only pans while two pointers at the same position move apart and together', () => {
    const one = startPointer(emptyGesture(), 1, { x: 100, y: 100 });
    const both = startPointer(one, 2, { x: 100, y: 100 });
    const first = movePointer(both, 1, { x: 120, y: 120 }, viewport(1, 0, 0), LIMITS);
    const second = movePointer(first.gesture, 2, { x: 120, y: 120 }, first.viewport, LIMITS);
    assertCloseFields(second.viewport, viewport(1, 20, 20), VIEWPORT_KEYS, TOLERANCE);
  });

  it('returns the same gesture and viewport when an untracked pointer moves', () => {
    const gesture = twoFingers();
    const start = viewport(1, 0, 0);
    const result = movePointer(gesture, 3, { x: 340, y: 300 }, start, LIMITS);
    assert.equal(result.gesture, gesture);
    assert.equal(result.viewport, start);
  });

  it('removes a lifted pointer', () => {
    assert.deepEqual(endPointer(twoFingers(), 1), { pointers: [{ id: 2, x: 200, y: 100 }] });
  });

  it('returns the same gesture when an unknown pointer is lifted', () => {
    const gesture = twoFingers();
    assert.equal(endPointer(gesture, 3), gesture);
  });

  it('never modifies its inputs', () => {
    const gesture = twoFingers();
    const start = viewport(1, 0, 0);
    const point = { x: 50, y: 100 };
    const result = movePointer(gesture, 1, point, start, LIMITS);
    endPointer(result.gesture, 2);
    startPointer(gesture, 3, { x: 0, y: 0 });
    assert.deepEqual(gesture, {
      pointers: [{ id: 1, x: 100, y: 100 }, { id: 2, x: 200, y: 100 }],
    });
    assert.deepEqual(start, viewport(1, 0, 0));
    assert.deepEqual(point, { x: 50, y: 100 });
    assert.equal(result.gesture.pointers.length, 2);
  });
});
