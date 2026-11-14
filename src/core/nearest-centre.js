// Exact nearest-centre search in CIELAB, used by k-means (./kmeans.js) and by the final
// assignment of every stitch to a cluster (./pattern-generator.js).
//
// Why not a plain loop over all centres: with up to 489 centres and up to 100 M stitches that
// is 49 G distance computations. Sorting the centres by L* once lets a query look only at
// centres whose L* is close enough to beat the best distance found so far: (ΔL*)² alone is a
// lower bound of the squared distance. The answer is exactly the brute-force answer.

// Prepares the search over centres, a Float64Array (or array) of 3 × k numbers: L, a, b of
// each centre in turn, k ≥ 1. The centres are copied; later changes to the array are ignored.
// Returns nearestCentre(L, a, b) → the index 0…k−1 of the centre with the smallest squared
// Euclidean Lab distance to (L, a, b); on a tie the lowest index wins.
// Throws RangeError if centres is empty or its length is not a multiple of 3.
export function createNearestCentreSearch(centres) {
  if (centres.length === 0 || centres.length % 3 !== 0) {
    throw new RangeError(`centres must hold one or more L, a, b triples, got ${centres.length} numbers`);
  }
  const count = centres.length / 3;
  const order = Array.from({ length: count }, (_, index) => index);
  order.sort((first, second) => centres[first * 3] - centres[second * 3] || first - second);
  const sortedL = Float64Array.from(order, (index) => centres[index * 3]);
  const sortedA = Float64Array.from(order, (index) => centres[index * 3 + 1]);
  const sortedB = Float64Array.from(order, (index) => centres[index * 3 + 2]);
  const originalIndex = Int32Array.from(order);

  // First position in sortedL whose L* is at least L.
  function firstAtLeast(L) {
    let low = 0;
    let high = count;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (sortedL[middle] < L) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    return low;
  }

  return function nearestCentre(L, a, b) {
    let best = -1;
    let bestDistance = Infinity;
    let below = firstAtLeast(L) - 1;
    let above = below + 1;
    // Walk outwards from L*, always taking the side with the smaller ΔL*. A side stops once
    // its ΔL*² alone exceeds the best distance; equal is still examined for the tie rule.
    while (below >= 0 || above < count) {
      const deltaBelow = below >= 0 ? L - sortedL[below] : Infinity;
      const deltaAbove = above < count ? sortedL[above] - L : Infinity;
      const isBelow = deltaBelow <= deltaAbove;
      const position = isBelow ? below : above;
      const deltaL = isBelow ? deltaBelow : deltaAbove;
      if (deltaL * deltaL > bestDistance) {
        break; // the other side is at least as far in L*
      }
      const deltaA = a - sortedA[position];
      const deltaB = b - sortedB[position];
      const distance = deltaL * deltaL + deltaA * deltaA + deltaB * deltaB;
      const index = originalIndex[position];
      if (distance < bestDistance || (distance === bestDistance && index < best)) {
        best = index;
        bestDistance = distance;
      }
      if (isBelow) {
        below -= 1;
      } else {
        above += 1;
      }
    }
    return best;
  };
}
