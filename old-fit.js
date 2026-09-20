function computeHorizontalFitInsidePolygonOld(screenRing, cx, cy, screenBBox) {
  const bbW = Math.max(0.1, screenBBox[2] - screenBBox[0]);
  const bbH = Math.max(0.1, screenBBox[3] - screenBBox[1]);

  let adjX = cx;

  if (!screenRing || screenRing.length < 3) {
    return { availW: bbW * 0.85, availH: bbH * 0.70, adjustedX: cx };
  }

  // 1. Find horizontal chord at Y = cy inside the polygon
  const xIntersects = [];
  const n = screenRing.length;
  for (let i = 0; i < n; i++) {
    const p1 = screenRing[i];
    const p2 = screenRing[(i + 1) % n];
    const y1 = p1[1], y2 = p2[1];
    if ((y1 <= cy && y2 > cy) || (y2 <= cy && y1 > cy)) {
      const t = (cy - y1) / (y2 - y1 + 1e-12);
      const xInt = p1[0] + t * (p2[0] - p1[0]);
      xIntersects.push(xInt);
    }
  }

  let chordLeft = screenBBox[0];
  let chordRight = screenBBox[2];
  let foundChord = false;

  xIntersects.sort((a, b) => a - b);
  for (let i = 0; i < xIntersects.length - 1; i += 2) {
    const left = xIntersects[i];
    const right = xIntersects[i + 1];
    if (cx >= left - 0.5 && cx <= right + 0.5) {
      chordLeft = left;
      chordRight = right;
      foundChord = true;
      break;
    }
  }

  if (foundChord) {
    const chordMid = (chordLeft + chordRight) / 2;
    // Gently nudge text center towards the chord midpoint (up to 40%) so text centers well
    adjX = cx + (chordMid - cx) * 0.40;
  }

  // Available centered width: distance to closest boundary * 2
  const leftDist = Math.max(0.05, adjX - chordLeft);
  const rightDist = Math.max(0.05, chordRight - adjX);
  const centeredMaxW = 2 * Math.min(leftDist, rightDist);

  // 2. Find vertical chord at X = adjX inside the polygon
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

  let chordTop = screenBBox[1];
  let chordBottom = screenBBox[3];
  yIntersects.sort((a, b) => a - b);
  for (let i = 0; i < yIntersects.length - 1; i += 2) {
    const top = yIntersects[i];
    const bottom = yIntersects[i + 1];
    if (cy >= top - 0.5 && cy <= bottom + 0.5) {
      chordTop = top;
      chordBottom = bottom;
      break;
    }
  }

  const topDist = Math.max(0.05, cy - chordTop);
  const bottomDist = Math.max(0.05, chordBottom - cy);
  const centeredMaxH = 2 * Math.min(topDist, bottomDist);

  const availW = Math.max(0.1, Math.min(bbW * 0.88, centeredMaxW * 0.88));
  const availH = Math.max(0.1, Math.min(bbH * 0.85, centeredMaxH * 0.85));

  return { availW, availH, adjustedX: adjX, adjustedY: cy };
}
