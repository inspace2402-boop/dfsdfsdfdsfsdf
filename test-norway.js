const fs = require('fs');
const data = JSON.parse(fs.readFileSync('public/ne_110m_admin_0_countries.geojson', 'utf8'));
const d3 = require('d3-geo');

const norway = data.features.find(f => f.properties.NAME === 'Norway' || f.properties.ISO_A2 === 'NO');

if (norway) {
  let geom = norway.geometry;
  const candidates = [];
  if (geom.type === 'MultiPolygon') {
    geom.coordinates.forEach(polyCoords => {
      const area = d3.geoArea({ type: 'Polygon', coordinates: polyCoords });
      candidates.push(area);
    });
  }
  candidates.sort((a, b) => b - a);
  const totalArea = candidates.reduce((a, b) => a + b, 0);
  const primaryArea = candidates[0];
  console.log("Norway totalArea:", totalArea, "primaryArea:", primaryArea, "ratio:", primaryArea/totalArea, "candidates:", candidates.length);
} else {
  console.log("Norway not found");
}
