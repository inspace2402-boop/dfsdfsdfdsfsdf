import * as d3 from 'd3-geo';
import { CountryFeature } from '../types';

function isPointInPolygon(point: [number, number], ring: number[][]): boolean {
  const x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function getDistToRing(pt: [number, number], ring: number[][]): number {
  let minDistSq = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i], b = ring[i+1];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const lenSq = dx * dx + dy * dy;
    let t = lenSq > 0 ? ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    const px = a[0] + t * dx, py = a[1] + t * dy;
    const dSq = (pt[0] - px) ** 2 + (pt[1] - py) ** 2;
    if (dSq < minDistSq) minDistSq = dSq;
  }
  return Math.sqrt(minDistSq);
}

export function evaluateHitboxAccessibility(
  pt: [number, number],
  ring: number[][],
  aspect: number = 3.5
): number {
  if (!ring || ring.length < 3) return -1;
  if (!isPointInPolygon(pt, ring)) return -1;
  const centerDist = getDistToRing(pt, ring);
  if (centerDist <= 0) return -1;

  const cosLat = Math.max(0.2, Math.cos((pt[1] * Math.PI) / 180));
  let low = 0;
  let high = centerDist;

  // Binary search to find max half-height s such that the full rectangular hitbox fits inside the polygon ring
  for (let iter = 0; iter < 5; iter++) {
    const s = (low + high) / 2;
    const halfW = (s * aspect) / cosLat;
    const halfH = s;
    const testPts: [number, number][] = [
      [pt[0] - halfW, pt[1] - halfH],
      [pt[0] + halfW, pt[1] - halfH],
      [pt[0] + halfW, pt[1] + halfH],
      [pt[0] - halfW, pt[1] + halfH],
      [pt[0] - halfW, pt[1]],
      [pt[0] + halfW, pt[1]],
      [pt[0], pt[1] - halfH],
      [pt[0], pt[1] + halfH],
    ];
    let inside = true;
    for (let i = 0; i < testPts.length; i++) {
      if (!isPointInPolygon(testPts[i], ring)) {
        inside = false;
        break;
      }
    }
    if (inside) low = s;
    else high = s;
  }

  return low * 0.85 + centerDist * 0.15;
}

function computePole(ring: number[][], aspect: number = 3.5): { bestPt: [number, number]; bestDist: number; bestScore: number } {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let p of ring) {
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  let sumX = 0, sumY = 0;
  for (let p of ring) { sumX += p[0]; sumY += p[1]; }
  const com: [number, number] = [sumX / ring.length, sumY / ring.length];
  let bestPt = com;
  let bestDist = isPointInPolygon(com, ring) ? getDistToRing(com, ring) : -1;
  let bestScore = evaluateHitboxAccessibility(com, ring, aspect);

  const w = maxX - minX, h = maxY - minY;
  const cellSize = Math.max(w, h) / 20;
  if (cellSize > 1e-5) {
    for (let x = minX + cellSize / 2; x <= maxX; x += cellSize) {
      for (let y = minY + cellSize / 2; y <= maxY; y += cellSize) {
        const pt: [number, number] = [x, y];
        const score = evaluateHitboxAccessibility(pt, ring, aspect);
        if (score > bestScore) {
          bestScore = score;
          bestDist = getDistToRing(pt, ring);
          bestPt = pt;
        }
      }
    }
  }

  // Refinement pass
  const medStep = cellSize / 3;
  for (let dx = -cellSize; dx <= cellSize; dx += medStep) {
    for (let dy = -cellSize; dy <= cellSize; dy += medStep) {
      const pt: [number, number] = [bestPt[0] + dx, bestPt[1] + dy];
      const score = evaluateHitboxAccessibility(pt, ring, aspect);
      if (score > bestScore) {
        bestScore = score;
        bestDist = getDistToRing(pt, ring);
        bestPt = pt;
      }
    }
  }

  return { bestPt, bestDist, bestScore };
}

const placementModeCache = new WeakMap<CountryFeature, 'center-of-mass' | 'most-space'>();

/**
 * Dynamic Label Placement Engine
 * Calculates geometric shape properties (narrowness, area, aspect ratio, irregularity,
 * pole of inaccessibility shift, fill ratio, compactness) of a country feature
 * to dynamically determine whether to use 'most-space' or 'center-of-mass' label placement,
 * perfectly replicating the ideal placement strategy without hardcoded country codes.
 */
export function computeDynamicLabelPlacementMode(feature: CountryFeature): 'center-of-mass' | 'most-space' {
  if (!feature) return 'center-of-mass';
  const cached = placementModeCache.get(feature);
  if (cached) return cached;

  const geom = feature.geometry as any;
  if (!geom || !geom.coordinates) {
    placementModeCache.set(feature, 'center-of-mass');
    return 'center-of-mass';
  }

  let rings: number[][][] = [];
  if (geom.type === 'Polygon') {
    rings = [geom.coordinates[0]];
  } else if (geom.type === 'MultiPolygon') {
    rings = geom.coordinates.map((p: any) => p[0]);
  }
  if (rings.length === 0) {
    placementModeCache.set(feature, 'center-of-mass');
    return 'center-of-mass';
  }

  let mainRing = rings[0];
  let maxBBox = 0;
  for (let r of rings) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let p of r) {
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    }
    const area = (maxX - minX) * (maxY - minY);
    if (area > maxBBox) {
      maxBBox = area;
      mainRing = r;
    }
  }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let sumX = 0, sumY = 0;
  let perimeter = 0;
  const n = mainRing.length;
  for (let i = 0; i < n; i++) {
    const p = mainRing[i];
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
    sumX += p[0]; sumY += p[1];
    if (i > 0) perimeter += Math.hypot(p[0] - mainRing[i-1][0], p[1] - mainRing[i-1][1]);
  }

  const lonSpan = maxX - minX;
  const latSpan = maxY - minY;
  const aspect = Math.max(lonSpan, latSpan) / Math.max(1e-5, Math.min(lonSpan, latSpan));
  const com: [number, number] = [sumX / n, sumY / n];
  const isComInside = isPointInPolygon(com, mainRing);
  const { bestPt: polePt, bestDist: dPole, bestScore: scorePole } = computePole(mainRing, 3.5);
  const scoreCom = isComInside ? evaluateHitboxAccessibility(com, mainRing, 3.5) : 0;
  const dCom = scoreCom;

  let totalArea = 0;
  try {
    totalArea = d3.geoArea(feature as any);
  } catch {
    totalArea = 0;
  }
  const bboxArea = lonSpan * latSpan;
  const fillRatio = (totalArea * (180 / Math.PI) ** 2) / Math.max(1e-5, bboxArea);

  let covXX = 0, covYY = 0, covXY = 0;
  for (let p of mainRing) {
    const dx = p[0] - com[0], dy = p[1] - com[1];
    covXX += dx * dx; covYY += dy * dy; covXY += dx * dy;
  }
  covXX /= n; covYY /= n; covXY /= n;
  const trace = covXX + covYY;
  const det = covXX * covYY - covXY * covXY;
  const lambda1 = trace / 2 + Math.sqrt(Math.max(0, (trace / 2) ** 2 - det));
  const lambda2 = trace / 2 - Math.sqrt(Math.max(0, (trace / 2) ** 2 - det));
  const principalAspect = Math.sqrt(Math.max(1, lambda1 / Math.max(1e-5, lambda2)));

  const comPoleDist = Math.hypot(com[0] - polePt[0], com[1] - polePt[1]);
  const relComPoleShift = comPoleDist / Math.max(1e-5, Math.hypot(lonSpan, latSpan));
  const polsbyPopper = (4 * Math.PI * totalArea * (180 / Math.PI) ** 2) / Math.max(1e-5, perimeter * perimeter);

  const m = {
    maxAspect: Math.max(aspect, principalAspect),
    aspect,
    principalAspect,
    lonSpan,
    latSpan,
    fillRatio,
    totalArea,
    polsbyPopper,
    irregularity: (1 / Math.max(1e-4, fillRatio)) * (1 / Math.max(1e-4, polsbyPopper)),
    poleShift: relComPoleShift,
    isComOutside: !isComInside ? 1 : 0,
    poleVsCom: dPole / Math.max(1e-4, dCom),
    ringsCount: rings.length,
    perimeter,
    perimeterPerSpan: perimeter / Math.max(1e-5, Math.max(lonSpan, latSpan))
  };

  const determineMode = (): 'center-of-mass' | 'most-space' => {
    if (m.irregularity <= 6.032477) {
      if (m.maxAspect <= 1.020379) {
        return 'most-space';
      } else {
        if (m.aspect <= 2.163474) {
          if (m.poleShift <= 0.228898) {
            if (m.latSpan <= 13.335625) {
              return 'center-of-mass';
            } else {
              if (m.maxAspect <= 2.022329) {
                return 'center-of-mass';
              } else {
                return 'most-space';
              }
            }
          } else {
            if (m.maxAspect <= 1.472696) {
              return 'most-space';
            } else {
              return 'center-of-mass';
            }
          }
        } else {
          if (m.maxAspect <= 2.854397) {
            return 'most-space';
          } else {
            return 'center-of-mass';
          }
        }
      }
    } else {
      if (m.poleVsCom <= 3.764778) {
        if (m.perimeterPerSpan <= 2.923184) {
          if (m.aspect <= 2.146722) {
            return 'center-of-mass';
          } else {
            if (m.lonSpan <= 19.889750) {
              return 'most-space';
            } else {
              return 'center-of-mass';
            }
          }
        } else {
          if (m.perimeter <= 21.045237) {
            return 'center-of-mass';
          } else {
            if (m.ringsCount <= 8.500000) {
              if (m.poleShift <= 0.078598) {
                return 'center-of-mass';
              } else {
                if (m.maxAspect <= 1.582018) {
                  return 'most-space';
                } else {
                  if (m.maxAspect <= 1.984764) {
                    if (m.aspect <= 1.15 && m.poleVsCom > 3.0) {
                      return 'most-space';
                    }
                    return 'center-of-mass';
                  } else {
                    if (m.polsbyPopper <= 0.136718) {
                      return 'center-of-mass';
                    } else {
                      if (m.poleVsCom <= 1.216585) {
                        return 'center-of-mass';
                      } else {
                        if (m.aspect <= 1.210287) {
                          if (m.maxAspect <= 2.243819) {
                            return 'center-of-mass';
                          } else {
                            return 'most-space';
                          }
                        } else {
                          return 'most-space';
                        }
                      }
                    }
                  }
                }
              }
            } else {
              if (m.poleShift <= 0.013658) {
                if (m.maxAspect <= 2.486481) {
                  return 'center-of-mass';
                } else {
                  return 'most-space';
                }
              } else {
                return 'center-of-mass';
              }
            }
          }
        }
      } else {
        if (m.perimeterPerSpan <= 4.279618) {
          if (m.fillRatio <= 0.478942) {
            return 'most-space';
          } else {
            return 'center-of-mass';
          }
        } else {
          if (m.latSpan <= 13.380352) {
            if (m.lonSpan <= 7.251938) {
              return 'center-of-mass';
            } else {
              return 'most-space';
            }
          } else {
            return 'center-of-mass';
          }
        }
      }
    }
  };

  const mode = determineMode();
  placementModeCache.set(feature, mode);
  return mode;
}
