/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { simplifyGeometry } from './simplification';
import { parseAnyMapData, sanitizeFeatures } from './geoUtils';

self.onmessage = async (e: MessageEvent) => {
  const { mapFile, rawData } = e.data;
  try {
    let data;
    if (rawData) {
      data = rawData;
    } else {
      const url = mapFile.startsWith('http') 
        ? mapFile 
        : `https://cdn.jsdelivr.net/gh/johnnull6967/MapPainterAssets@main/mapdata/${mapFile.replace(/^mapdata\//i, '')}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${mapFile} from asset repository.`);
      }
      data = await response.json();
    }
    
    let collection: any;
    const parsedResult = parseAnyMapData(data);

    if (parsedResult && parsedResult.features && parsedResult.features.length > 0) {
      collection = {
        type: 'FeatureCollection',
        features: parsedResult.features,
      };
    } else if (data && data.features) {
      collection = {
        type: 'FeatureCollection',
        features: sanitizeFeatures(data.features),
      };
    } else {
      throw new Error('Unable to extract map geometries from data file.');
    }

    if (collection && collection.features) {
      collection.features = collection.features.map((feature: any, index: number) => {
        const props: any = {};
        for (const key in feature.properties) {
          props[key.toLowerCase()] = feature.properties[key];
        }

        // Standardize English localized name for ADM1 subdivisions and other custom names
        const namesCommon = props['names.common'];
        const namesPrimary = props['names.primary'];
        let englishName = '';

        if (namesCommon && typeof namesCommon === 'object' && namesCommon.en) {
          englishName = namesCommon.en;
        } else if (namesPrimary) {
          englishName = namesPrimary;
        } else if (namesCommon && typeof namesCommon === 'object') {
          const keys = Object.keys(namesCommon);
          if (keys.length > 0) {
            englishName = namesCommon[keys[0]];
          }
        }

        let finalName = englishName || props.name || props.eco_name || props.econame || props.label || props.title || '';
        if (typeof finalName === 'string') {
          finalName = finalName.replace(/\s*\(region\)/gi, '').trim();
        }
        props.name = finalName || `Region #${index + 1}`;

        // Standardize IDs and country codes for ADM1
        if (props.id && !props.adm1_code) {
          props.adm1_code = props.id;
        }
        if (props.region && !props.iso_3166_2) {
          props.iso_3166_2 = props.region;
        }
        if (props.country && !props.admin) {
          props.admin = props.country;
        }
        if (props.country_code && !props.adm0_a3) {
          props.adm0_a3 = props.country_code;
        }
        if (props.country && !props.adm0_a3) {
          props.adm0_a3 = props.country;
        }

        // Ensure every feature has a stable unique ID
        const rawId = props.id || feature.id || props.adm1_code || props.iso_3166_2 || props.adm0_a3 || props.objectid || props.eco_id || props.eco_code;
        if (rawId !== undefined && rawId !== null && rawId !== '' && rawId !== '-99') {
          props.id = String(rawId);
          if (!props.adm1_code) props.adm1_code = props.id;
        } else {
          props.id = `region_id_${index + 1}`;
          if (!props.adm1_code) props.adm1_code = props.id;
        }

        if (props.gdp_md !== undefined && props.gdp_md_est === undefined) {
          props.gdp_md_est = props.gdp_md;
        }
        if (props.gdp_md_est !== undefined && props.gdp_md === undefined) {
          props.gdp_md = props.gdp_md_est;
        }
        if (props.pop_est !== undefined) {
          props.pop_est = Number(props.pop_est);
        }
        if (props.gdp_md_est !== undefined) {
          props.gdp_md_est = Number(props.gdp_md_est);
        }

        // Precalculate geographic bounding box off main thread
        let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
        const calcBBox = (coords: any) => {
          if (Array.isArray(coords) && typeof coords[0] === 'number') {
            const x = coords[0];
            const y = coords[1];
            if (x < minLon) minLon = x;
            if (x > maxLon) maxLon = x;
            if (y < minLat) minLat = y;
            if (y > maxLat) maxLat = y;
          } else if (Array.isArray(coords)) {
            for (let i = 0; i < coords.length; i++) {
              calcBBox(coords[i]);
            }
          }
        };
        if (feature.geometry && feature.geometry.coordinates) {
          calcBBox(feature.geometry.coordinates);
        }
        const bbox: [number, number, number, number] = minLon !== Infinity ? [minLon, minLat, maxLon, maxLat] : [-180, -90, 180, 90];

        const cleanedFeature = {
          ...feature,
          properties: props,
          bbox,
        };

        // Pre-simplify the default zoom level (low detail, zoom 1) for small datasets to make initial render instant
        if (collection.features.length <= 500) {
          const simplified: Record<string, any> = {};
          const tolLow = Math.max(0.02, 0.40 / 1);
          simplified['low_z1'] = simplifyGeometry(feature.geometry, tolLow);
          cleanedFeature.simplified = simplified;
        }

        return cleanedFeature;
      });
    }

    self.postMessage({ status: 'success', collection });
  } catch (err: any) {
    self.postMessage({ status: 'error', error: err.message || 'Unknown background loading error' });
  }
};
