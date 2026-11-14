import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertCloseFields } from '../../helpers/assert-close.js';
import { pinchViewport } from '../../../src/core/pinch-zoom.js';

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
