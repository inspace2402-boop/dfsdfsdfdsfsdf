// Ramer-Douglas-Peucker (RDP) & Mapshaper Visvalingam-Whyatt polygon simplification algorithms
// with antimeridian unwrapping, area weighting, and spike artifact suppression.

/**
 * Unwraps longitudes continuously along a ring to eliminate 180° meridian jumps during math operations.
 */
function unwrapRingLongitudes(ring: [number, number][]): [number, number][] {
  if (!ring || ring.length === 0) return [];
  const unwrapped: [number, number][] = [[ring[0][0], ring[0][1]]];

  for (let i = 1; i < ring.length; i++) {
    const prevLon = unwrapped[i - 1][0];
    let currLon = ring[i][0];
    let dLon = currLon - (ring[i - 1][0] % 360);

    // Normalize longitude step to [-180, 180]
    while (dLon > 180) dLon -= 360;
    while (dLon < -180) dLon += 360;

    unwrapped.push([prevLon + dLon, ring[i][1]]);
  }

  return unwrapped;
}

/**
 * Normalizes unwrapped longitudes back into standard GeoJSON range [-180, 180].
 */
function wrapLon(lon: number): number {
  if (isNaN(lon) || !isFinite(lon)) return 0;
  let normalized = (lon + 180) % 360;
  if (normalized < 0) normalized += 360;
  return normalized - 180;
}

/**
 * Calculates effective triangle area for three 2D points (Visvalingam metric).
 */
function triangleArea(a: [number, number], b: [number, number], c: [number, number]): number {
  return Math.abs((a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1])) * 0.5);
}

/**
 * High-speed Mapshaper-style Visvalingam-Whyatt simplification with an Indexed Binary Min-Heap.
 * Complexity: O(N log N) using flat TypedArrays for optimal memory and cache locality.
 */
export function simplifyVisvalingam(points: [number, number][], areaTolerance: number): [number, number][] {
  const len = points.length;
  if (len <= 4) return points;

  const areas = new Float64Array(len);
  const next = new Int32Array(len);
  const prev = new Int32Array(len);

  for (let i = 0; i < len; i++) {
    next[i] = i + 1;
    prev[i] = i - 1;
  }
  prev[0] = -1;
  next[len - 1] = -1;

  for (let i = 1; i < len - 1; i++) {
    areas[i] = triangleArea(points[prev[i]], points[i], points[next[i]]);
  }
  areas[0] = Infinity;
  areas[len - 1] = Infinity;

  // Indexed Binary Min-Heap
  const heap = new Int32Array(len);
  const heapPos = new Int32Array(len);
  heapPos.fill(-1);
  let heapSize = 0;

  const swap = (i: number, j: number) => {
    const vi = heap[i];
    const vj = heap[j];
    heap[i] = vj;
    heap[j] = vi;
    heapPos[vj] = i;
    heapPos[vi] = j;
  };

  const siftUp = (idx: number) => {
    let curr = idx;
    while (curr > 0) {
      const parent = (curr - 1) >> 1;
      if (areas[heap[curr]] < areas[heap[parent]]) {
        swap(curr, parent);
        curr = parent;
      } else {
        break;
      }
    }
  };

  const siftDown = (idx: number) => {
    let curr = idx;
    while (true) {
      const left = (curr << 1) + 1;
      const right = left + 1;
      let smallest = curr;

      if (left < heapSize && areas[heap[left]] < areas[heap[smallest]]) {
        smallest = left;
      }
      if (right < heapSize && areas[heap[right]] < areas[heap[smallest]]) {
        smallest = right;
      }

      if (smallest !== curr) {
        swap(curr, smallest);
        curr = smallest;
      } else {
        break;
      }
    }
  };

  const pushHeap = (vertex: number) => {
    const pos = heapSize++;
    heap[pos] = vertex;
    heapPos[vertex] = pos;
    siftUp(pos);
  };

  const updateHeap = (vertex: number) => {
    const pos = heapPos[vertex];
    if (pos !== -1) {
      siftUp(pos);
      siftDown(pos);
    }
  };

  const popMin = (): number => {
    if (heapSize === 0) return -1;
    const minVertex = heap[0];
    heapPos[minVertex] = -1;
    heapSize--;
    if (heapSize > 0) {
      heap[0] = heap[heapSize];
      heapPos[heap[0]] = 0;
      siftDown(0);
    }
    return minVertex;
  };

  // Populate heap with interior points
  for (let i = 1; i < len - 1; i++) {
    pushHeap(i);
  }

  let removed = 0;
  const maxRemovable = len - 4;

  while (removed < maxRemovable && heapSize > 0) {
    const minIdx = popMin();
    if (minIdx === -1 || areas[minIdx] > areaTolerance) {
      break;
    }

    const p = prev[minIdx];
    const n = next[minIdx];
    if (p === -1 || n === -1) continue;

    // Remove minIdx from the linked chain
    next[p] = n;
    prev[n] = p;
    prev[minIdx] = -1;
    next[minIdx] = -1;
    removed++;

    // Recompute areas of direct neighbors and update heap in O(log N)
    if (p > 0 && prev[p] !== -1) {
      areas[p] = triangleArea(points[prev[p]], points[p], points[next[p]]);
      updateHeap(p);
    }
    if (n < len - 1 && next[n] !== -1) {
      areas[n] = triangleArea(points[prev[n]], points[n], points[next[n]]);
      updateHeap(n);
    }
  }

  const result: [number, number][] = [];
  let curr: number | -1 = 0;
  while (curr !== -1) {
    result.push(points[curr]);
    curr = next[curr];
  }

  return result;
}

function simplifyPointList(points: [number, number][], sqTolerance: number): [number, number][] {
  const len = points.length;
  if (len <= 2) return points;

  const markers = new Uint8Array(len);
  markers[0] = 1;
  markers[len - 1] = 1;

  const stack: number[] = [0, len - 1];

  while (stack.length > 0) {
    const end = stack.pop()!;
    const start = stack.pop()!;

    let maxSqDist = 0;
    let index = start;

    const p1 = points[start];
    const p2 = points[end];
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const lenSq = dx * dx + dy * dy;

    for (let i = start + 1; i < end; i++) {
      const p = points[i];
      let sqDist = 0;
      if (lenSq < 1e-12) {
        const d1 = p[0] - p1[0];
        const d2 = p[1] - p1[1];
        sqDist = d1 * d1 + d2 * d2;
      } else {
        let t = ((p[0] - p1[0]) * dx + (p[1] - p1[1]) * dy) / lenSq;
        if (t < 0) t = 0;
        else if (t > 1) t = 1;
        const projX = p1[0] + t * dx;
        const projY = p1[1] + t * dy;
        const d1 = p[0] - projX;
        const d2 = p[1] - projY;
        sqDist = d1 * d1 + d2 * d2;
      }

      if (sqDist > maxSqDist) {
        maxSqDist = sqDist;
        index = i;
      }
    }

    if (maxSqDist > sqTolerance) {
      markers[index] = 1;
      stack.push(start, index);
      stack.push(index, end);
    }
  }

  const result: [number, number][] = [];
  for (let i = 0; i < len; i++) {
    if (markers[i]) {
      result.push(points[i]);
    }
  }
  return result;
}

/**
 * Post-pass filter to remove hairpin spike artifacts (vertices that shoot out and immediately double back).
 */
function removeHairpinSpikes(ring: [number, number][]): [number, number][] {
  if (ring.length <= 4) return ring;

  let changed = true;
  let current = ring.slice();

  while (changed && current.length > 4) {
    changed = false;
    const filtered: [number, number][] = [];

    for (let i = 0; i < current.length - 1; i++) {
      const prev = i === 0 ? current[current.length - 2] : current[i - 1];
      const curr = current[i];
      const next = current[i + 1];

      const v1x = curr[0] - prev[0];
      const v1y = curr[1] - prev[1];
      const v2x = next[0] - curr[0];
      const v2y = next[1] - curr[1];

      const len1 = Math.hypot(v1x, v1y);
      const len2 = Math.hypot(v2x, v2y);

      if (len1 > 1e-7 && len2 > 1e-7) {
        const dot = (v1x * v2x + v1y * v2y) / (len1 * len2);
        // If dot < -0.92, current vertex forms a sharp hairpin spike returning on itself -> remove it!
        if (dot < -0.92) {
          changed = true;
          continue; // Skip curr
        }
      }

      filtered.push(curr);
    }

    // Ensure ring closure
    if (filtered.length > 0) {
      const first = filtered[0];
      const last = filtered[filtered.length - 1];
      if (Math.abs(first[0] - last[0]) > 1e-7 || Math.abs(first[1] - last[1]) > 1e-7) {
        filtered.push([first[0], first[1]]);
      }
    }

    if (filtered.length >= 4) {
      current = filtered;
    } else {
      break;
    }
  }

  return current;
}

function simplifyRing(ring: [number, number][], sqTolerance: number): [number, number][] {
  if (!ring || ring.length <= 4) return ring;

  // 1. Unwrap longitudes across 180° meridian for accurate continuous distance math
  const unwrapped = unwrapRingLongitudes(ring);

  // 2. Perform RDP simplification in continuous space
  const rawSimplified = simplifyPointList(unwrapped, sqTolerance);

  // 3. Deduplicate consecutive identical or near-identical vertices
  const cleaned: [number, number][] = [];
  for (let i = 0; i < rawSimplified.length; i++) {
    const pt = rawSimplified[i];
    if (cleaned.length === 0) {
      cleaned.push(pt);
    } else {
      const prev = cleaned[cleaned.length - 1];
      if (Math.abs(pt[0] - prev[0]) > 1e-7 || Math.abs(pt[1] - prev[1]) > 1e-7) {
        cleaned.push(pt);
      }
    }
  }

  if (cleaned.length < 2) return ring;

  // 4. Enforce closed ring
  const first = cleaned[0];
  const last = cleaned[cleaned.length - 1];
  if (Math.abs(first[0] - last[0]) > 1e-7 || Math.abs(first[1] - last[1]) > 1e-7) {
    cleaned.push([first[0], first[1]]);
  }

  // 5. Remove hairpin spike artifacts
  let spikeFree = removeHairpinSpikes(cleaned);

  if (spikeFree.length < 4) return ring;

  // 6. Wrap longitudes back to standard GeoJSON range [-180, 180]
  const finalRing: [number, number][] = spikeFree.map((pt) => [wrapLon(pt[0]), pt[1]]);

  // Final sanity check for NaNs or invalid points
  for (let i = 0; i < finalRing.length; i++) {
    if (isNaN(finalRing[i][0]) || isNaN(finalRing[i][1])) {
      return ring;
    }
  }

  return finalRing;
}

export function simplifyGeometry(geom: any, tolerance: number): any {
  if (!geom) return null;
  const sqTolerance = tolerance * tolerance;

  try {
    if (geom.type === 'Polygon') {
      const coordinates = geom.coordinates.map((ring: [number, number][]) => simplifyRing(ring, sqTolerance));
      return { ...geom, coordinates };
    } else if (geom.type === 'MultiPolygon') {
      const coordinates = geom.coordinates.map((polygon: [number, number][][]) =>
        polygon.map((ring: [number, number][]) => simplifyRing(ring, sqTolerance))
      );
      return { ...geom, coordinates };
    } else if (geom.type === 'LineString') {
      const coordinates = simplifyPointList(unwrapRingLongitudes(geom.coordinates), sqTolerance).map((pt) => [
        wrapLon(pt[0]),
        pt[1],
      ]);
      return { ...geom, coordinates };
    } else if (geom.type === 'MultiLineString') {
      const coordinates = geom.coordinates.map((line: [number, number][]) =>
        simplifyPointList(unwrapRingLongitudes(line), sqTolerance).map((pt) => [wrapLon(pt[0]), pt[1]])
      );
      return { ...geom, coordinates };
    }
  } catch (e) {
    return geom;
  }
  return geom;
}

