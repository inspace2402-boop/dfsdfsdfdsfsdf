import fs from 'fs';
import * as topojson from 'topojson-client';
import { simplifyGeometry } from './src/utils/simplification.ts'; // Wait, tsx can't import ts directly without a loader, we'll use tsx

const data = JSON.parse(fs.readFileSync('public/mapdata/world.json', 'utf8'));
const features = [];
for (const key of Object.keys(data.objects)) {
  const geojson = topojson.feature(data, data.objects[key]);
  if (geojson.type === 'FeatureCollection') {
    features.push(...geojson.features);
  }
}

const start = performance.now();
const zoomBuckets = [1, 2, 4, 8];
let simplifications = 0;

for (const feature of features) {
    const simplified = {};
    zoomBuckets.forEach((zb) => {
        const zFactor = Math.pow(zb, 0.35);
        const tolLow = Math.max(0.02, 0.40 / zFactor);
        const tolMed = Math.max(0.04, 0.85 / zFactor);
        const tolHigh = Math.max(0.08, 1.80 / zFactor);
        const tolUltra = Math.max(0.15, 3.50 / zFactor);

        simplified[`low_z${zb}`] = simplifyGeometry(feature.geometry, tolLow);
        simplified[`med_z${zb}`] = simplifyGeometry(feature.geometry, tolMed);
        simplified[`medium_z${zb}`] = simplified[`med_z${zb}`];
        simplified[`high_z${zb}`] = simplifyGeometry(feature.geometry, tolHigh);
        simplified[`ultra_z${zb}`] = simplifyGeometry(feature.geometry, tolUltra);
        simplifications += 4;
    });
}
const end = performance.now();
console.log(`Simplify ${simplifications} times took: ${end - start}ms`);
