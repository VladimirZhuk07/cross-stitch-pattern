import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createNearestCentreSearch } from '../../../src/core/nearest-centre.js';
import { createSeededRandom } from '../../../src/core/random.js';
import { assertThrowsWith } from '../../helpers/assert-throws-with.js';

// Brute force: smallest squared Euclidean distance, lowest index on a tie.
function bruteForceNearest(centres, L, a, b) {
  let nearest = 0;
  let nearestDistance = Infinity;
  for (let c = 0; c < centres.length / 3; c++) {
    const dL = L - centres[c * 3];
    const da = a - centres[c * 3 + 1];
    const db = b - centres[c * 3 + 2];
    const distance = dL * dL + da * da + db * db;
    if (distance < nearestDistance) {
      nearest = c;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function randomLab(random) {
  return [random() * 100, random() * 200 - 100, random() * 200 - 100];
}

describe('createNearestCentreSearch', () => {
  it('finds the same centre as a brute-force search (489 centres, 10,000 queries)', () => {
    const random = createSeededRandom(7);
    const centres = new Float64Array(489 * 3);
    for (let c = 0; c < 489; c++) {
      centres.set(randomLab(random), c * 3);
    }
    const nearestCentre = createNearestCentreSearch(centres);
    for (let query = 0; query < 10000; query++) {
      const [L, a, b] = randomLab(random);
      assert.equal(nearestCentre(L, a, b), bruteForceNearest(centres, L, a, b), `query ${query}: ${L}, ${a}, ${b}`);
    }
  });

  it('picks the lower index of two identical centres', () => {
    const nearestCentre = createNearestCentreSearch(new Float64Array([80, 0, 0, 50, 10, 10, 50, 10, 10]));
    assert.equal(nearestCentre(50, 10, 10), 1);
    assert.equal(nearestCentre(52, 9, 11), 1);
  });

  it('picks the lower index of two equally distant centres', () => {
    // Centres 2 and 5 are both at distance 10 from (50, 0, 0); 2 lies on the L* axis, 5 does not.
    const centres = new Float64Array([
      0, 0, 0,
      100, 0, 0,
      60, 0, 0,
      0, 50, 50,
      20, 90, 0,
      50, 10, 0,
    ]);
    assert.equal(createNearestCentreSearch(centres)(50, 0, 0), 2);
  });

  it('returns 0 for a single centre', () => {
    assert.equal(createNearestCentreSearch(new Float64Array([10, 20, 30]))(90, -50, 70), 0);
  });

  it('rejects an empty centre list or one that is not made of L, a, b triples', () => {
    assertThrowsWith(() => createNearestCentreSearch(new Float64Array(0)), RangeError, 'centres', '0');
    assertThrowsWith(() => createNearestCentreSearch(new Float64Array(4)), RangeError, 'centres', '4');
  });
});
