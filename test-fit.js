function computeHorizontalFitInsidePolygon(screenRing, cx, cy, screenBBox) {
  const bbW = Math.max(0.1, screenBBox[2] - screenBBox[0]);
  const bbH = Math.max(0.1, screenBBox[3] - screenBBox[1]);

  if (!screenRing || screenRing.length < 3) {
    return { availW: bbW * 0.85, availH: bbH * 0.70, adjustedX: cx, adjustedY: cy };
  }

  const n = screenRing.length;
  
  let bestW = -1;
  let bestChordLeft = cx;
  let bestChordRight = cx;
  let bestY = cy;

  const yOffsets = [0, -0.1, 0.1, -0.2, 0.2, -0.3, 0.3, -0.4, 0.4];

  for (const offset of yOffsets) {
    const yScan = cy + offset * bbH;
    if (yScan < screenBBox[1] || yScan > screenBBox[3]) continue;

    const xIntersects = [];
    for (let i = 0; i < n; i++) {
      const p1 = screenRing[i];
      const p2 = screenRing[(i + 1) % n];
      const y1 = p1[1], y2 = p2[1];
      if ((y1 <= yScan && y2 > yScan) || (y2 <= yScan && y1 > yScan)) {
        const t = (yScan - y1) / (y2 - y1 + 1e-12);
        const xInt = p1[0] + t * (p2[0] - p1[0]);
        xIntersects.push(xInt);
      }
    }
    xIntersects.sort((a, b) => a - b);

    let maxChordScore = -1;
    let chordL = cx;
    let chordR = cx;
    
    for (let i = 0; i < xIntersects.length - 1; i += 2) {
      const left = xIntersects[i];
      const right = xIntersects[i + 1];
      const w = right - left;
      const containsCx = cx >= left - 0.5 && cx <= right + 0.5;
      const score = w * (containsCx ? 1.2 : 1.0); 
      if (score > maxChordScore) {
        maxChordScore = score;
        chordL = left;
        chordR = right;
      }
    }

    if (maxChordScore > bestW) {
      bestW = maxChordScore;
      bestChordLeft = chordL;
      bestChordRight = chordR;
      bestY = yScan;
    }
  }

  let adjX = cx;
  let adjY = cy;
  let availW = bbW * 0.85;

  if (bestW >= 0) {
    adjX = (bestChordLeft + bestChordRight) / 2;
    adjY = bestY;
    availW = (bestChordRight - bestChordLeft) * 0.88;
  }

  const yIntersects = [];
  for (let i = 0; i < n; i++) {
    const p1 = screenRing[i];
    const p2 = screenRing[(i + 1) % n];
    const x1 = p1[0], x2 = p2[0];
    if ((x1 <= adjX && x2 > adjX) || (x2 <= adjX && x1 > adjX)) {
      const t = (adjX - x1) / (x2 - x1 + 1e-12);
      const yInt = p1[1] + t * (p2[1] - p1[1]);
      yIntersects.push(yInt);
    }
  }

  yIntersects.sort((a, b) => a - b);
  let bestChordTop = adjY;
  let bestChordBottom = adjY;
  let maxVertScore = -1;

  for (let i = 0; i < yIntersects.length - 1; i += 2) {
    const top = yIntersects[i];
    const bottom = yIntersects[i + 1];
    const h = bottom - top;
    const containsCy = adjY >= top - 0.5 && adjY <= bottom + 0.5;
    const score = h * (containsCy ? 1.2 : 1.0);
    if (score > maxVertScore) {
      maxVertScore = score;
      bestChordTop = top;
      bestChordBottom = bottom;
    }
  }

  let availH = bbH * 0.85;
  if (maxVertScore >= 0) {
    adjY = (bestChordTop + bestChordBottom) / 2;
    availH = (bestChordBottom - bestChordTop) * 0.85;
  }

  return { availW, availH, adjustedX: adjX, adjustedY: adjY };
}

const square = [[0,0], [100,0], [100,100], [0,100]];
console.log(computeHorizontalFitInsidePolygon(square, 50, 50, [0, 0, 100, 100]));
