const fs = require('fs');
const d3 = require('d3-geo');

const data = JSON.parse(fs.readFileSync('public/ne_110m_admin_0_countries.geojson', 'utf8'));
const norway = data.features.find(f => f.properties.NAME === 'Norway');

if (norway) {
  let geom = norway.geometry;
  const candidates = [];
  if (geom.type === 'MultiPolygon') {
    geom.coordinates.forEach(polyCoords => {
      let area = d3.geoArea({ type: 'Polygon', coordinates: polyCoords });
      candidates.push(area);
    });
  }
  candidates.sort((a, b) => b - a);
  const totalArea = candidates.reduce((a, b) => a + b, 0);
  const primaryArea = candidates[0];
  console.log("Norway candidates:", candidates.length, "Total:", totalArea, "Primary:", primaryArea, "Ratio:", primaryArea/totalArea);
  
  const isArchipelago = candidates.length >= 2 && (
    (candidates.length >= 3 && primaryArea / Math.max(1e-12, totalArea) < 0.75) ||
    (candidates.length === 2 && primaryArea / Math.max(1e-12, totalArea) < 0.60)
  );
  console.log("Is archipelago?", isArchipelago);
}
