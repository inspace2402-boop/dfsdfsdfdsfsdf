import { topology } from 'topojson-server';
const geojson = {
  type: "FeatureCollection",
  features: [{
    type: "Feature",
    properties: { id: "test", name: "My Country" },
    geometry: { type: "Polygon", coordinates: [[[0,0], [0,1], [1,1], [0,0]]] }
  }]
};
console.log(JSON.stringify(topology({ map: geojson }), null, 2));
