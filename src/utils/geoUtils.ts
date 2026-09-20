/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as topojson from 'topojson-client';
import * as d3 from 'd3';
import { CountryFeature, MapDataCollection } from '../types';

/**
 * Checks if a map feature represents ocean, water body, sea, or background.
 */
export function isOceanFeature(feature: CountryFeature | any): boolean {
  if (!feature || !feature.properties) return false;
  const props = feature.properties;

  if (
    props.is_ocean === true || props.is_ocean === 1 || props.is_ocean === 'true' ||
    props.is_water === true || props.is_water === 1 || props.is_water === 'true' ||
    props.ocean === true || props.ocean === 1 || props.ocean === 'true' ||
    props.water === true || props.water === 1 || props.water === 'true'
  ) {
    return true;
  }

  const name = String(props.name || props.NAME || props.label || props.LABEL || props.title || props.NAME_LONG || '').toLowerCase().trim();
  const id = String(props.id || feature.id || props.adm0_a3 || props.ADM0_A3 || props.adm1_code || props.iso_a3 || props.ISO_A3 || '').toLowerCase().trim();
  const featurecla = String(props.featurecla || props.FEATURECLA || '').toLowerCase().trim();
  const type = String(props.type || props.TYPE || props.category || props.CATEGORY || props.terrain || props.TERRAIN || '').toLowerCase().trim();
  const admin = String(props.admin || props.ADMIN || props.country || props.sovereignt || props.SOVEREIGNT || '').toLowerCase().trim();
  const sov_a3 = String(props.sov_a3 || props.SOV_A3 || '').toLowerCase().trim();

  if (sov_a3 === 'oce' || sov_a3 === 'web' || sov_a3 === 'gaa') {
    return true;
  }

  // 1. Explicit featurecla or type
  if (
    featurecla === 'ocean' || featurecla === 'water' || featurecla === 'sea' || 
    featurecla === 'marine' || featurecla === 'background' || featurecla === 'sphere' || featurecla === 'outline' || featurecla === 'lake' ||
    type === 'ocean' || type === 'water' || type === 'sea' || type === 'background' || type === 'marine'
  ) {
    return true;
  }

  // 2. Exact or matching IDs
  if (
    id === 'ocean' || id === 'sea' || id === 'water' || id === 'background' ||
    id === 'bbox' || id === 'outline' || id === 'sphere' || id.startsWith('ocean_') ||
    id.startsWith('sea_') || id.startsWith('water_') || id.startsWith('background_')
  ) {
    return true;
  }

  // 3. Name or Admin contains clear ocean/sea indicators
  if (
    name === 'ocean' || name === 'sea' || name === 'water' || name === 'background' ||
    name === 'world ocean' || name === 'pacific ocean' || name === 'atlantic ocean' ||
    name === 'indian ocean' || name === 'arctic ocean' || name === 'southern ocean' ||
    name === 'sea / ocean' || name === 'oceans' || name === 'oceania water' ||
    admin === 'ocean' || admin === 'sea' || admin === 'water' || admin === 'background'
  ) {
    return true;
  }

  // Check if name includes ocean or waterbody (excluding false positives like "Oceania" continent)
  if (name.includes('ocean') || name.includes('background') || name.includes('waterbody')) {
    if (name === 'oceania' || name.includes('oceania land') || name.includes('ocean city')) {
      return false;
    }
    return true;
  }

  return false;
}

/**
 * Checks if a map dataset's coordinates fall within standard WGS84 geographical limits (-180..180 lon, -90..90 lat).
 */
export function checkIsGeoreferenced(collection: MapDataCollection | any): boolean {
  if (!collection || !collection.features || collection.features.length === 0) {
    return true;
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let count = 0;

  const checkCoords = (coords: any) => {
    if (count > 500) return;
    if (Array.isArray(coords) && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      const x = coords[0];
      const y = coords[1];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      count++;
    } else if (Array.isArray(coords)) {
      for (let i = 0; i < coords.length; i++) {
        checkCoords(coords[i]);
      }
    }
  };

  for (const feat of collection.features) {
    if (feat && feat.geometry && feat.geometry.coordinates) {
      checkCoords(feat.geometry.coordinates);
    }
    if (count > 500) break;
  }

  if (minX === Infinity) return true;

  // Standard WGS84 bounds with small safe tolerance
  return minX >= -185 && maxX <= 185 && minY >= -95 && maxY <= 95;
}

/**
 * Gets parent country ID for a feature (e.g. admin, adm0_a3, sovereignt, country).
 */
export function getParentCountryId(feature: CountryFeature | any): string {
  if (!feature || !feature.properties) return '';
  const p = feature.properties;
  return String(
    p.admin || p.ADMIN ||
    p.adm0_a3 || p.ADM0_A3 ||
    p.sovereignt || p.SOVEREIGNT ||
    p.country || p.COUNTRY ||
    p.adm0_name || p.ADM0_NAME ||
    p.country_code || p.COUNTRY_CODE ||
    p.parent || p.PARENT ||
    p.parent_id || p.PARENT_ID ||
    p.sovereign || p.SOVEREIGN ||
    (p.biome !== undefined ? `biome_${p.biome}` : (p.BIOME !== undefined ? `biome_${p.BIOME}` : '')) ||
    ''
  ).toLowerCase().trim();
}

/**
 * Gets continent/macro-region ID for a feature.
 */
export function getContinentId(feature: CountryFeature | any): string {
  if (!feature || !feature.properties) return '';
  const p = feature.properties;
  return String(
    p.continent || p.CONTINENT ||
    p.continent_code || p.CONTINENT_CODE ||
    p.region_un || p.REGION_UN ||
    p.region_wb || p.REGION_WB ||
    p.realm || p.REALM ||
    ''
  ).toLowerCase().trim();
}

export interface DetectedHierarchy {
  hasSubnational: boolean;
  hasCountries: boolean;
  hasContinents: boolean;
  subnationalCount: number;
  countryCount: number;
  continentCount: number;
}

/**
 * Detects hierarchy levels present in a feature collection (e.g. Subnational -> Country -> Continent).
 */
export function detectMapHierarchy(features: CountryFeature[], selectedMapFile?: string): DetectedHierarchy {
  if (!features || features.length === 0) {
    return {
      hasSubnational: false,
      hasCountries: false,
      hasContinents: false,
      subnationalCount: 0,
      countryCount: 0,
      continentCount: 0,
    };
  }

  if (selectedMapFile === 'mappa_mundi_hoi4.json' || features.length > 2000) {
    return {
      hasSubnational: false,
      hasCountries: true,
      hasContinents: false,
      subnationalCount: features.length,
      countryCount: features.length,
      continentCount: 0,
    };
  }

  const parentMap = new Map<string, number>();
  const continentMap = new Map<string, number>();
  let distinctSubnationalFeaturesCount = 0;

  features.forEach((f) => {
    const p: any = f.properties || {};
    const featId = String(
      f.id || p.id || p.adm1_code || p.ADM1_CODE || p.iso_3166_2 || p.ISO_3166_2 || p.adm1 || p.ADM1 || p.eco_code || p.ECO_CODE || p.eco_id || p.ECO_ID || ''
    ).toLowerCase().trim();

    const parentId = getParentCountryId(f);

    // Check if feature has explicit subnational level indicators distinct from parent country
    const isExplicitSubnational = !!(
      p.adm1_code || p.ADM1_CODE ||
      p.iso_3166_2 || p.ISO_3166_2 ||
      p.adm1 || p.ADM1 ||
      p.admin1 || p.ADMIN1 ||
      p.region_code || p.REGION_CODE ||
      p.eco_code || p.ECO_CODE || p.eco_id || p.ECO_ID
    );

    if (isExplicitSubnational && featId && parentId && featId !== parentId) {
      distinctSubnationalFeaturesCount++;
    }

    if (parentId) {
      parentMap.set(parentId, (parentMap.get(parentId) || 0) + 1);
    }

    const contId = getContinentId(f);
    if (contId) {
      continentMap.set(contId, (continentMap.get(contId) || 0) + 1);
    }
  });

  let parentsWithMultipleFeatures = 0;
  parentMap.forEach((count) => {
    if (count > 1) parentsWithMultipleFeatures++;
  });

  // A map has subnational hierarchy ONLY IF parent countries contain multiple sub-polygons (e.g., ADM1 states/provinces)
  const hasSubnational = (parentsWithMultipleFeatures > 0) && (distinctSubnationalFeaturesCount > 0 || parentsWithMultipleFeatures >= 2);

  let continentsWithMultipleFeatures = 0;
  continentMap.forEach((count) => {
    if (count > 1) continentsWithMultipleFeatures++;
  });
  const hasContinents = continentsWithMultipleFeatures > 0 && continentMap.size > 1 && continentMap.size < features.length / 2;

  return {
    hasSubnational,
    hasCountries: parentMap.size > 0,
    hasContinents,
    subnationalCount: features.length,
    countryCount: parentMap.size,
    continentCount: continentMap.size,
  };
}

/**
 * Sanitizes GeoJSON features:
 * 1. Filters out null/undefined features or missing geometry.
 * 2. Ensures linear rings are closed (first point === last point) and free of NaNs.
 * 3. Rewinds inverted polygon exterior rings (where spherical area > 2 * Math.PI) without corrupting interior holes.
 */
export function sanitizeFeatures(features: any[]): any[] {
  if (!Array.isArray(features)) return [];
  const validFeatures: any[] = [];

  for (let i = 0; i < features.length; i++) {
    const f = features[i];
    if (!f || typeof f !== 'object') continue;
    if (!f.geometry || typeof f.geometry !== 'object') continue;

    const geom = f.geometry;
    if (!geom.type || !geom.coordinates) continue;

    try {
      const cleanRing = (ring: number[][]): number[][] | null => {
        if (!Array.isArray(ring) || ring.length < 3) return null;
        const validPts: number[][] = [];
        for (let j = 0; j < ring.length; j++) {
          const pt = ring[j];
          if (Array.isArray(pt) && pt.length >= 2 && !isNaN(pt[0]) && !isNaN(pt[1]) && isFinite(pt[0]) && isFinite(pt[1])) {
            validPts.push([pt[0], pt[1]]);
          }
        }
        if (validPts.length < 3) return null;

        const p0 = validPts[0];
        const pN = validPts[validPts.length - 1];
        if (p0[0] !== pN[0] || p0[1] !== pN[1]) {
          validPts.push([p0[0], p0[1]]);
        }
        return validPts;
      };

      const isOcean = isOceanFeature(f);

      const sanitizePolygonRings = (rings: number[][][]): number[][][] => {
        const cleanedRings: number[][][] = [];
        for (let rIdx = 0; rIdx < rings.length; rIdx++) {
          const ring = cleanRing(rings[rIdx]);
          if (!ring || ring.length < 4) continue;

          // Check spherical area of this specific ring
          let ringArea = 0;
          try {
            ringArea = d3.geoArea({ type: 'Polygon', coordinates: [ring] });
          } catch (e) {
            ringArea = 0;
          }

          // Exterior ring is at rIdx === 0. If area > 2*Math.PI and it's not ocean, rewind this ring
          if (rIdx === 0) {
            if (ringArea > 2 * Math.PI && !isOcean) {
              ring.reverse();
            }
          } else {
            // Interior hole ring: should be opposite winding of exterior ring (i.e. area as exterior <= 2*Math.PI)
            if (ringArea > 2 * Math.PI) {
              ring.reverse();
            }
          }

          cleanedRings.push(ring);
        }
        return cleanedRings;
      };

      if (geom.type === 'Polygon' && Array.isArray(geom.coordinates)) {
        const polygonRings = sanitizePolygonRings(geom.coordinates);
        if (polygonRings.length === 0) continue;
        geom.coordinates = polygonRings;
      } else if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates)) {
        const cleanedPolygons: number[][][][] = [];
        for (let pIdx = 0; pIdx < geom.coordinates.length; pIdx++) {
          const poly = geom.coordinates[pIdx];
          if (Array.isArray(poly)) {
            const polygonRings = sanitizePolygonRings(poly);
            if (polygonRings.length > 0) {
              cleanedPolygons.push(polygonRings);
            }
          }
        }
        if (cleanedPolygons.length === 0) continue;
        geom.coordinates = cleanedPolygons;
      }

      validFeatures.push(f);
    } catch (e) {
      console.warn('Error sanitizing feature:', e);
    }
  }

  return validFeatures;
}

/**
 * Authoritative feature name extraction adhering strictly to standard TopoJSON / GeoJSON property structures.
 */
export function getFeatureName(feature: CountryFeature | any): string {
  if (!feature || !feature.properties) return '';
  const p = feature.properties;

  // 1. Direct custom name or standard name properties
  if (p.customName && typeof p.customName === 'string' && p.customName.trim()) return p.customName.trim();
  if (p.name && typeof p.name === 'string' && p.name.trim() && p.name !== '-99') return p.name.trim();
  if (p.NAME && typeof p.NAME === 'string' && p.NAME.trim() && p.NAME !== '-99') return p.NAME.trim();

  // 2. Standard TopoJSON / Natural Earth long or english names
  if (p.name_long && typeof p.name_long === 'string' && p.name_long.trim()) return p.name_long.trim();
  if (p.NAME_LONG && typeof p.NAME_LONG === 'string' && p.NAME_LONG.trim()) return p.NAME_LONG.trim();
  if (p.name_en && typeof p.name_en === 'string' && p.name_en.trim()) return p.name_en.trim();
  if (p.NAME_EN && typeof p.NAME_EN === 'string' && p.NAME_EN.trim()) return p.NAME_EN.trim();
  if (p.admin && typeof p.admin === 'string' && p.admin.trim() && p.admin !== '-99') return p.admin.trim();
  if (p.ADMIN && typeof p.ADMIN === 'string' && p.ADMIN.trim() && p.ADMIN !== '-99') return p.ADMIN.trim();
  if (p.geounit && typeof p.geounit === 'string' && p.geounit.trim() && p.geounit !== '-99') return p.geounit.trim();
  if (p.GEOUNIT && typeof p.GEOUNIT === 'string' && p.GEOUNIT.trim() && p.GEOUNIT !== '-99') return p.GEOUNIT.trim();
  if (p.subunit && typeof p.subunit === 'string' && p.subunit.trim() && p.subunit !== '-99') return p.subunit.trim();
  if (p.SUBUNIT && typeof p.SUBUNIT === 'string' && p.SUBUNIT.trim() && p.SUBUNIT !== '-99') return p.SUBUNIT.trim();
  if (p.sovereignt && typeof p.sovereignt === 'string' && p.sovereignt.trim()) return p.sovereignt.trim();
  if (p.SOVEREIGNT && typeof p.SOVEREIGNT === 'string' && p.SOVEREIGNT.trim()) return p.SOVEREIGNT.trim();
  if (p.brk_name && typeof p.brk_name === 'string' && p.brk_name.trim()) return p.brk_name.trim();
  if (p.BRK_NAME && typeof p.BRK_NAME === 'string' && p.BRK_NAME.trim()) return p.BRK_NAME.trim();
  if (p.title && typeof p.title === 'string' && p.title.trim()) return p.title.trim();
  if (p.label && typeof p.label === 'string' && p.label.trim()) return p.label.trim();

  // 3. Postal / Abbreviation codes
  if (p.postal && typeof p.postal === 'string' && p.postal.trim()) return p.postal.trim();
  if (p.POSTAL && typeof p.POSTAL === 'string' && p.POSTAL.trim()) return p.POSTAL.trim();
  if (p.abbrev && typeof p.abbrev === 'string' && p.abbrev.trim()) return p.abbrev.trim();
  if (p.ABBREV && typeof p.ABBREV === 'string' && p.ABBREV.trim()) return p.ABBREV.trim();

  // 4. ISO codes / IDs
  if (p.adm1_code && typeof p.adm1_code === 'string' && p.adm1_code.trim()) return p.adm1_code.trim();
  if (p.ADM1_CODE && typeof p.ADM1_CODE === 'string' && p.ADM1_CODE.trim()) return p.ADM1_CODE.trim();
  if (p.iso_3166_2 && typeof p.iso_3166_2 === 'string' && p.iso_3166_2.trim()) return p.iso_3166_2.trim();
  if (p.adm0_a3 && typeof p.adm0_a3 === 'string' && p.adm0_a3.trim() && p.adm0_a3 !== '-99') return p.adm0_a3.trim();
  if (p.ADM0_A3 && typeof p.ADM0_A3 === 'string' && p.ADM0_A3.trim() && p.ADM0_A3 !== '-99') return p.ADM0_A3.trim();
  if (p.iso_a3 && typeof p.iso_a3 === 'string' && p.iso_a3.trim() && p.iso_a3 !== '-99') return p.iso_a3.trim();

  if (p.id !== undefined && p.id !== null) return String(p.id).trim();
  if (p.ID !== undefined && p.ID !== null) return String(p.ID).trim();
  if (feature.id !== undefined && feature.id !== null) return String(feature.id).trim();

  return '';
}

/**
 * Unique identifier extraction for styling, selection, borders, and coloring.
 */
export function getCountryId(feature: CountryFeature | any): string {
  if (!feature || !feature.properties) return '';
  const p = feature.properties;

  const isSubRegion = !!(
    p.adm1_code || p.ADM1_CODE ||
    p.iso_3166_2 || p.ISO_3166_2 ||
    p.hasc_maybe || p.code_hasc || p.HASC_1 || p.postal || p.POSTAL ||
    p.state_id || p.STATE_ID || p.prov_id || p.PROV_ID ||
    p.adm1_name || p.ADM1_NAME
  );

  if (isSubRegion) {
    return String(
      p.id || p.ID || feature.id ||
      p.adm1_code || p.ADM1_CODE ||
      p.state_id || p.STATE_ID ||
      p.prov_id || p.PROV_ID ||
      p.iso_3166_2 || p.ISO_3166_2 ||
      p.code_hasc || p.HASC_1 ||
      p.postal || p.POSTAL ||
      p.name || p.NAME ||
      p.state_name || p.STATE_NAME ||
      ''
    ).trim();
  }

  return String(
    p.id || p.ID || feature.id ||
    p.adm0_a3 || p.ADM0_A3 ||
    p.tag || p.TAG ||
    p.iso_a3_eh || p.ISO_A3_EH ||
    p.iso_a3 || p.ISO_A3 ||
    p.iso_a2 || p.ISO_A2 ||
    p.name || p.NAME ||
    p.admin || p.ADMIN ||
    p.sovereignt || p.SOVEREIGNT ||
    p.country || p.COUNTRY ||
    ''
  ).trim();
}

/**
 * Extracts features from ALL object layers in a TopoJSON Topology object.
 */
export function extractFeaturesFromTopoJSON(data: any): any[] {
  if (!data || !data.objects) return [];
  const keys = Object.keys(data.objects);
  if (keys.length === 0) return [];

  let bestFeatures: any[] = [];
  const allFeatures: any[] = [];

  for (const key of keys) {
    try {
      const geojson: any = topojson.feature(data, data.objects[key]);
      if (geojson) {
        let fList: any[] = [];
        if (geojson.type === 'FeatureCollection' && Array.isArray(geojson.features)) {
          fList = geojson.features;
        } else if (geojson.type === 'Feature') {
          fList = [geojson];
        }
        if (fList.length > bestFeatures.length) {
          bestFeatures = fList;
        }
        allFeatures.push(...fList);
      }
    } catch (e) {
      console.warn(`Failed to extract TopoJSON layer "${key}":`, e);
    }
  }

  // If there's a primary layer with granular features (e.g. provinces/countries with 200+ features vs 1 land boundary),
  // prefer the primary layer unless total features are needed.
  const featuresToUse = (keys.length > 1 && bestFeatures.length > 1) ? bestFeatures : (allFeatures.length > 0 ? allFeatures : bestFeatures);
  return sanitizeFeatures(featuresToUse);
}

/**
 * Universal Map Data Parser (Supports Pax Historia, TopoJSON, GeoJSON, Scenario saves, and Custom formats)
 */
export function parseAnyMapData(data: any): {
  features: any[];
  customColors?: Record<string, string>;
  legendLabels?: Record<string, string>;
  projection?: string;
  mapPainterSettings?: any;
} | null {
  if (!data) return null;

  let customColors = data.customColors || data.mapPainterSettings?.customColors;
  let legendLabels = data.legendLabels || data.mapPainterSettings?.legendLabels;
  let projection = data.projection || data.mapPainterSettings?.config?.projection;
  let mapPainterSettings = data.mapPainterSettings;

  // 1. Direct TopoJSON format
  if (data.type === 'Topology' || (data.objects && typeof data.objects === 'object')) {
    const features = extractFeaturesFromTopoJSON(data);
    if (features.length > 0) {
      return { features, customColors, legendLabels, projection, mapPainterSettings };
    }
  }

  // 2. Nested TopoJSON / GeoJSON objects (Pax Historia scenarios, custom exports)
  const candidateKeys = ['topology', 'scenario', 'map', 'geo', 'data', 'world', 'provinces', 'countries'];
  for (const key of candidateKeys) {
    if (data[key] && typeof data[key] === 'object') {
      const nested = data[key];
      if (nested.type === 'Topology' || (nested.objects && typeof nested.objects === 'object')) {
        const features = extractFeaturesFromTopoJSON(nested);
        if (features.length > 0) {
          return { features, customColors: customColors || nested.customColors, legendLabels: legendLabels || nested.legendLabels, projection, mapPainterSettings };
        }
      }
      if (nested.type === 'FeatureCollection' && Array.isArray(nested.features)) {
        return { features: sanitizeFeatures(nested.features), customColors: customColors || nested.customColors, legendLabels: legendLabels || nested.legendLabels, projection, mapPainterSettings };
      }
      if (Array.isArray(nested.features)) {
        return { features: sanitizeFeatures(nested.features), customColors: customColors || nested.customColors, legendLabels: legendLabels || nested.legendLabels, projection, mapPainterSettings };
      }
    }
  }

  // 3. GeoJSON FeatureCollection
  if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
    return { features: sanitizeFeatures(data.features), customColors, legendLabels, projection, mapPainterSettings };
  }

  // 4. Object containing features array
  if (Array.isArray(data.features)) {
    return { features: sanitizeFeatures(data.features), customColors, legendLabels, projection, mapPainterSettings };
  }

  // 5. Array of Feature objects
  if (Array.isArray(data) && data.length > 0 && (data[0].geometry || data[0].properties || data[0].type === 'Feature')) {
    return { features: sanitizeFeatures(data), customColors, legendLabels, projection, mapPainterSettings };
  }

  // 6. Single Feature
  if (data.type === 'Feature' && data.geometry) {
    return { features: sanitizeFeatures([data]), customColors, legendLabels, projection, mapPainterSettings };
  }

  // 7. Pure draft settings without geometries
  if (customColors || legendLabels || mapPainterSettings) {
    return { features: [], customColors, legendLabels, projection, mapPainterSettings };
  }

  return null;
}
