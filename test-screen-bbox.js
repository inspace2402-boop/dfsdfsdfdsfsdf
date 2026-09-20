const cx = 100, cy = 100;
const screenBBox = [NaN, NaN, NaN, NaN]; // wait, what happens if minU minV maxU maxV are all +/- Infinity
console.log(Math.max(0.1, screenBBox[2] - screenBBox[0]));
