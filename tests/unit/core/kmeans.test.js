import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { KMEANS_SEED, MAX_KMEANS_ITERATIONS, kMeansLab } from '../../../src/core/kmeans.js';
import { createSeededRandom } from '../../../src/core/random.js';
import { assertClose } from '../../helpers/assert-close.js';
import { assertThrowsWith } from '../../helpers/assert-throws-with.js';

// Points are Lab colors packed as L, a, b triples.
function labPoints(labs) {
  return new Float64Array(labs.flat());
}

// 200 reproducible Lab points spread over L 0–100, a and b −50..50.
function syntheticPoints(count = 200) {
  const random = createSeededRandom(5);
  const labs = [];
  for (let i = 0; i < count; i++) {
    labs.push([random() * 100, random() * 100 - 50, random() * 100 - 50]);
  }
  return labPoints(labs);
}

function sortedCentres(centres) {
  return [...centres].sort((x, y) => x.L - y.L || x.a - y.a || x.b - y.b);
}

describe('kMeansLab', () => {
  it('uses the documented seed and iteration limit', () => {
    assert.equal(KMEANS_SEED, 20261113);
    assert.equal(MAX_KMEANS_ITERATIONS, 30);
  });

  it('uses only as many clusters as there are distinct colors', () => {
    const points = labPoints([[0, 0, 0], [100, 0, 0], [0, 0, 0], [100, 0, 0]]);
    const { centres, assignments } = kMeansLab(points, 24);
    assert.deepEqual(sortedCentres(centres), [{ L: 0, a: 0, b: 0 }, { L: 100, a: 0, b: 0 }]);
    assert.equal(assignments.length, 4);
    assert.equal(assignments[0], assignments[2]);
    assert.equal(assignments[1], assignments[3]);
    assert.notEqual(assignments[0], assignments[1]);
    assert.deepEqual(centres[assignments[0]], { L: 0, a: 0, b: 0 });
  });

  it('puts the single centre at the mean when one cluster is allowed', () => {
    const points = labPoints([[0, 0, 0], [100, 10, -20], [50, 2, 2]]);
    const { centres, assignments } = kMeansLab(points, 1);
    assert.equal(centres.length, 1);
    assertClose(centres[0].L, 50, 1e-12, 'L');
    assertClose(centres[0].a, 4, 1e-12, 'a');
    assertClose(centres[0].b, -6, 1e-12, 'b');
    assert.deepEqual([...assignments], [0, 0, 0]);
  });

  it('returns no centres for no points', () => {
    const { centres, assignments } = kMeansLab(new Float64Array(0), 8);
    assert.deepEqual(centres, []);
    assert.equal(assignments.length, 0);
  });

  it('keeps within the cluster limit and assigns every point to a valid centre', () => {
    const { centres, assignments } = kMeansLab(syntheticPoints(), 8);
    assert.ok(centres.length >= 1 && centres.length <= 8, `got ${centres.length} centres`);
    assert.equal(assignments.length, 200);
    for (const index of assignments) {
      assert.ok(Number.isInteger(index) && index >= 0 && index < centres.length, `bad index ${index}`);
    }
  });

  it('places every used centre at the mean of its points', () => {
    const points = syntheticPoints();
    const { centres, assignments } = kMeansLab(points, 8);
    centres.forEach((centre, index) => {
      const members = [];
      assignments.forEach((assigned, point) => {
        if (assigned === index) {
          members.push(point);
        }
      });
      if (members.length === 0) {
        return;
      }
      for (const [channel, offset] of [['L', 0], ['a', 1], ['b', 2]]) {
        const mean = members.reduce((sum, point) => sum + points[point * 3 + offset], 0) / members.length;
        assertClose(centre[channel], mean, 1e-9, `centre ${index} ${channel}`);
      }
    });
  });

  it('gives the same result for the same input', () => {
    const first = kMeansLab(syntheticPoints(), 8);
    const second = kMeansLab(syntheticPoints(), 8);
    assert.deepEqual(first, second);
  });

  it('gives a valid result for another seed', () => {
    const { centres, assignments } = kMeansLab(syntheticPoints(), 8, 99);
    assert.ok(centres.length <= 8);
    assert.ok([...assignments].every((index) => index >= 0 && index < centres.length));
  });

  it('rejects a cluster limit that is not a positive integer', () => {
    assertThrowsWith(() => kMeansLab(syntheticPoints(), 0), RangeError, 'maxClusters', '0');
    assertThrowsWith(() => kMeansLab(syntheticPoints(), 1.5), RangeError, 'maxClusters', '1.5');
  });

  it('rejects points that are not whole L, a, b triples', () => {
    assertThrowsWith(() => kMeansLab(new Float64Array(4), 2), RangeError, '4');
  });

  it('reports each iteration in order, at most MAX_KMEANS_ITERATIONS times', () => {
    const iterations = [];
    kMeansLab(syntheticPoints(), 8, KMEANS_SEED, (iteration) => iterations.push(iteration));
    assert.ok(iterations.length >= 1 && iterations.length <= MAX_KMEANS_ITERATIONS, `${iterations.length} iterations`);
    assert.deepEqual(iterations, iterations.map((_, index) => index + 1));
  });

  it('gives the same result with and without the iteration callback', () => {
    const withCallback = kMeansLab(syntheticPoints(), 8, KMEANS_SEED, () => {});
    assert.deepEqual(withCallback, kMeansLab(syntheticPoints(), 8));
  });

  it('handles 489 clusters on 2000 points', () => {
    const { centres, assignments } = kMeansLab(syntheticPoints(2000), 489);
    assert.ok(centres.length <= 489);
    assert.ok([...assignments].every((index) => index >= 0 && index < centres.length));
  });

  it('does not modify the input points', () => {
    const points = syntheticPoints();
    const before = [...points];
    kMeansLab(points, 8);
    assert.deepEqual([...points], before);
  });
});
