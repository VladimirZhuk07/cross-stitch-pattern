// Color reduction: k-means clustering of Lab colors, started with k-means++ from a fixed seed
// so the same colors always give the same clusters.
//
// Why Euclidean distance in Lab here, and not CIEDE2000: k-means moves each centre to the
// mean of its points, and the mean is exactly the point that minimizes the squared Euclidean
// distance, which is what makes the iterations converge. ΔE00 has no such mean and costs far
// more per comparison. The final choice of a DMC floss for each centre still uses ΔE00
// (see ./pattern-generator.js).

import { createSeededRandom } from './random.js';

// Fixed seed of the k-means++ start; not a user setting.
export const KMEANS_SEED = 20261113;

// Upper bound on assignment steps; most inputs settle (no point changes cluster) earlier.
export const MAX_KMEANS_ITERATIONS = 30;

// Groups Lab points into at most maxClusters clusters.
// points       Float64Array (or array) of 3 × n numbers: L, a, b of each point in turn
// maxClusters  positive integer; fewer clusters are used when there are fewer distinct points
// seed         integer seed of the k-means++ start (default KMEANS_SEED)
// Returns KMeansResult { centres, assignments }:
//   centres      list of Lab colors { L, a, b }, between 1 and maxClusters ([] when n = 0);
//                each centre that has points is the mean of its points
//   assignments  Int32Array of n centre indexes, one per point
// Steps: k-means++ start (Arthur & Vassilvitskii 2007): first centre a random point, each
// next centre a point drawn with probability proportional to its squared distance to the
// nearest centre so far; then Lloyd iterations (assign each point to the nearest centre, ties
// to the lowest index; move each centre to the mean of its points; a centre without points
// stays where it is) until no point changes cluster or MAX_KMEANS_ITERATIONS is reached.
// Deterministic for equal input. Does not modify points.
// Throws RangeError if maxClusters is not a positive integer or points.length is not a
// multiple of 3.
export function kMeansLab(points, maxClusters, seed = KMEANS_SEED) {
  if (!Number.isInteger(maxClusters) || maxClusters <= 0) {
    throw new RangeError(`maxClusters must be a positive integer, got ${String(maxClusters)}`);
  }
  if (points.length % 3 !== 0) {
    throw new RangeError(`points must hold L, a, b triples (a multiple of 3 numbers), got ${points.length} numbers`);
  }
  const pointCount = points.length / 3;
  if (pointCount === 0) {
    return { centres: [], assignments: new Int32Array(0) };
  }
  const centres = chooseInitialCentres(points, maxClusters, createSeededRandom(seed));
  const assignments = new Int32Array(pointCount).fill(-1);
  for (let iteration = 0; iteration < MAX_KMEANS_ITERATIONS; iteration++) {
    const hasChanged = assignToNearestCentres(points, centres, assignments);
    if (!hasChanged) {
      break; // the centres are already the means of these assignments
    }
    moveCentresToMeans(points, assignments, centres);
  }
  return { centres: toLabColors(centres), assignments };
}

// k-means++ start. Returns a Float64Array of 3 × (number of centres) Lab values.
function chooseInitialCentres(points, maxClusters, random) {
  const pointCount = points.length / 3;
  const chosen = [Math.floor(random() * pointCount)];
  const distances = new Float64Array(pointCount).fill(Infinity);
  updateNearestDistances(points, chosen[0], distances);
  while (chosen.length < maxClusters) {
    const next = drawProportionalToDistance(distances, random);
    if (next === -1) {
      break; // every point already coincides with a centre
    }
    chosen.push(next);
    updateNearestDistances(points, next, distances);
  }
  const centres = new Float64Array(chosen.length * 3);
  chosen.forEach((point, index) => {
    centres[index * 3] = points[point * 3];
    centres[index * 3 + 1] = points[point * 3 + 1];
    centres[index * 3 + 2] = points[point * 3 + 2];
  });
  return centres;
}

// Lowers distances[i] to the squared distance from point i to point centrePoint if closer.
function updateNearestDistances(points, centrePoint, distances) {
  const L = points[centrePoint * 3];
  const a = points[centrePoint * 3 + 1];
  const b = points[centrePoint * 3 + 2];
  for (let i = 0; i < distances.length; i++) {
    const dL = points[i * 3] - L;
    const da = points[i * 3 + 1] - a;
    const db = points[i * 3 + 2] - b;
    const distance = dL * dL + da * da + db * db;
    if (distance < distances[i]) {
      distances[i] = distance;
    }
  }
}

// Picks a point index with probability proportional to its distance; -1 if all are 0.
function drawProportionalToDistance(distances, random) {
  let total = 0;
  for (const distance of distances) {
    total += distance;
  }
  if (total === 0) {
    return -1;
  }
  const target = random() * total;
  let cumulative = 0;
  let lastCandidate = -1;
  for (let i = 0; i < distances.length; i++) {
    if (distances[i] === 0) {
      continue;
    }
    cumulative += distances[i];
    lastCandidate = i;
    if (cumulative > target) {
      return i;
    }
  }
  return lastCandidate; // only reached through rounding at the very end of the sum
}

// Writes the nearest centre of every point into assignmentsOut (ties: lowest centre index).
// Returns true if any assignment changed.
function assignToNearestCentres(points, centres, assignmentsOut) {
  const centreCount = centres.length / 3;
  let hasChanged = false;
  for (let i = 0; i < assignmentsOut.length; i++) {
    const L = points[i * 3];
    const a = points[i * 3 + 1];
    const b = points[i * 3 + 2];
    let nearest = 0;
    let nearestDistance = Infinity;
    for (let c = 0; c < centreCount; c++) {
      const dL = L - centres[c * 3];
      const da = a - centres[c * 3 + 1];
      const db = b - centres[c * 3 + 2];
      const distance = dL * dL + da * da + db * db;
      if (distance < nearestDistance) {
        nearest = c;
        nearestDistance = distance;
      }
    }
    if (assignmentsOut[i] !== nearest) {
      assignmentsOut[i] = nearest;
      hasChanged = true;
    }
  }
  return hasChanged;
}

// Moves every centre in centresOut to the mean of its points; centres without points stay.
function moveCentresToMeans(points, assignments, centresOut) {
  const centreCount = centresOut.length / 3;
  const sums = new Float64Array(centreCount * 3);
  const counts = new Int32Array(centreCount);
  for (let i = 0; i < assignments.length; i++) {
    const c = assignments[i];
    sums[c * 3] += points[i * 3];
    sums[c * 3 + 1] += points[i * 3 + 1];
    sums[c * 3 + 2] += points[i * 3 + 2];
    counts[c] += 1;
  }
  for (let c = 0; c < centreCount; c++) {
    if (counts[c] === 0) {
      continue;
    }
    centresOut[c * 3] = sums[c * 3] / counts[c];
    centresOut[c * 3 + 1] = sums[c * 3 + 1] / counts[c];
    centresOut[c * 3 + 2] = sums[c * 3 + 2] / counts[c];
  }
}

function toLabColors(centres) {
  const colors = [];
  for (let c = 0; c < centres.length / 3; c++) {
    colors.push({ L: centres[c * 3], a: centres[c * 3 + 1], b: centres[c * 3 + 2] });
  }
  return colors;
}
