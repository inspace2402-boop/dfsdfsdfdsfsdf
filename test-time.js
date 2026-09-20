import fs from 'fs';
import * as topojson from 'topojson-client';
import * as d3 from 'd3';

const data = JSON.parse(fs.readFileSync('public/mapdata/world.json', 'utf8'));

const start = performance.now();
const features = [];
for (const key of Object.keys(data.objects)) {
  const geojson = topojson.feature(data, data.objects[key]);
  if (geojson.type === 'FeatureCollection') {
    features.push(...geojson.features);
  }
}
const topoTime = performance.now();
console.log(`TopoJSON extract: ${topoTime - start}ms`);

// Emulate sanitizeFeatures
let validCount = 0;
for (const f of features) {
  if (f.geometry && f.geometry.type === 'Polygon') {
     f.geometry.coordinates.forEach((ring, rIdx) => {
       const area = d3.geoArea({ type: 'Polygon', coordinates: [ring] });
     });
  } else if (f.geometry && f.geometry.type === 'MultiPolygon') {
     f.geometry.coordinates.forEach(poly => poly.forEach((ring, rIdx) => {
       const area = d3.geoArea({ type: 'Polygon', coordinates: [ring] });
     }));
  }
  validCount++;
}
const sanitizeTime = performance.now();
console.log(`Sanitize: ${sanitizeTime - topoTime}ms`);

