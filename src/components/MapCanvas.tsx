/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
// @ts-ignore
import { geoStitch, geoWinkel3, geoMollweide, geoMiller, geoRobinson, geoEckert1, geoEckert2, geoEckert3, geoEckert4, geoEckert5, geoEckert6, geoAitoff, geoTimes, geoVanDerGrinten4, geoSinusoidal } from 'd3-geo-projection';

// Custom Winkel I projection (Oswald Winkel, 1914)
function geoWinkel1() {
  const phi1 = Math.acos(2 / Math.PI);
  const cosPhi1 = Math.cos(phi1);
  function forward(lambda: number, phi: number): [number, number] {
    return [(lambda * cosPhi1 + lambda * Math.cos(phi)) / 2, phi];
  }
  forward.invert = function(x: number, y: number): [number, number] {
    const phi = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, y));
    const denom = cosPhi1 + Math.cos(phi);
    if (Math.abs(denom) < 1e-6) return [0, phi];
    const lambda = Math.max(-Math.PI * 2, Math.min(Math.PI * 2, (2 * x) / denom));
    return [lambda, phi];
  };
  return d3.geoProjection(forward).scale(150);
}

// Custom Winkel II projection (Oswald Winkel, 1914)
function geoWinkel2() {
  const phi1 = Math.acos(2 / Math.PI);
  const cosPhi1 = Math.cos(phi1);
  const cx = (2 * Math.SQRT2) / Math.PI;
  const cy = Math.SQRT2;

  function forward(lambda: number, phi: number): [number, number] {
    let theta = phi;
    for (let i = 0; i < 25; ++i) {
      const sin2t = Math.sin(2 * theta);
      const cos2t = Math.cos(2 * theta);
      const delta = (2 * theta + sin2t - Math.PI * Math.sin(phi)) / (2 + 2 * cos2t || 1e-12);
      theta -= delta;
      if (Math.abs(delta) < 1e-9) break;
    }
    const xm = cx * lambda * Math.cos(theta);
    const ym = cy * Math.sin(theta);
    return [(lambda * cosPhi1 + xm) / 2, (phi + ym) / 2];
  }

  forward.invert = function(x: number, y: number): [number, number] {
    let low = -Math.PI / 2;
    let high = Math.PI / 2;
    let theta = y / 1.2;
    if (theta < low) theta = low;
    if (theta > high) theta = high;

    for (let i = 0; i < 30; ++i) {
      const sin2t = Math.sin(2 * theta);
      const u = (2 * theta + sin2t) / Math.PI;
      const clampedU = Math.max(-1, Math.min(1, u));
      const phi = Math.asin(clampedU);
      const ym = cy * Math.sin(theta);
      const fy = (phi + ym) / 2;
      const fDiff = fy - y;
      if (Math.abs(fDiff) < 1e-9) break;

      const du = (2 + 2 * Math.cos(2 * theta)) / Math.PI;
      const denom = Math.sqrt(Math.max(1e-12, 1 - clampedU * clampedU));
      const dPhi = du / denom;
      const dYm = cy * Math.cos(theta);
      const dfy = (dPhi + dYm) / 2;

      const step = fDiff / (dfy || 1);
      theta -= step;

      if (fDiff > 0) high = theta + step;
      else low = theta + step;

      if (theta < low || theta > high || Number.isNaN(theta)) {
        theta = (low + high) / 2;
      }
    }

    const sin2t = Math.sin(2 * theta);
    const u = Math.max(-1, Math.min(1, (2 * theta + sin2t) / Math.PI));
    const phi = Math.asin(u);
    const denom = cosPhi1 + cx * Math.cos(theta);
    const lambda = Math.max(-Math.PI * 2, Math.min(Math.PI * 2, (2 * x) / (denom || 1e-12)));
    return [lambda, phi];
  };

  return d3.geoProjection(forward).scale(150);
}

// Custom Gall-Peters projection
function geoGallPeters() {
  const sqrt2 = Math.SQRT2;
  function forward(lambda: number, phi: number): [number, number] {
    return [lambda / sqrt2, Math.sin(phi) * sqrt2];
  }
  forward.invert = function(x: number, y: number): [number, number] {
    return [x * sqrt2, Math.asin(Math.min(1, Math.max(-1, y / sqrt2)))];
  };
  return d3.geoProjection(forward).scale(150);
}

// Custom Collignon projection
function geoCollignonCustom() {
  const sqrtPi = Math.sqrt(Math.PI);
  const twoOverSqrtPi = 2 / sqrtPi;
  function forward(lambda: number, phi: number): [number, number] {
    const alpha = Math.sqrt(Math.max(0, 1 - Math.sin(phi)));
    return [twoOverSqrtPi * lambda * alpha, sqrtPi * (1 - alpha)];
  }
  forward.invert = function(x: number, y: number): [number, number] {
    const alpha = 1 - y / sqrtPi;
    if (alpha < 0 || alpha > Math.SQRT2) return [0, 0];
    const sinPhi = Math.min(1, Math.max(-1, 1 - alpha * alpha));
    const phi = Math.asin(sinPhi);
    const lam = alpha > 1e-6 ? (sqrtPi * x) / (2 * alpha) : 0;
    return [lam, phi];
  };
  return d3.geoProjection(forward).scale(150);
}

// Custom Gall Stereographic projection
function geoGallStereographicCustom() {
  const sqrt2 = Math.SQRT2;
  const c1 = 1 + 1 / sqrt2;
  const k = 2 - sqrt2;
  function forward(lambda: number, phi: number): [number, number] {
    return [lambda / sqrt2, c1 * Math.tan(phi / 2)];
  }
  forward.invert = function(x: number, y: number): [number, number] {
    return [x * sqrt2, 2 * Math.atan(y * k)];
  };
  return d3.geoProjection(forward).scale(150);
}

// Custom Lambert Cylindrical Equal-Area projection
function geoLambertCylindrical() {
  function forward(lambda: number, phi: number): [number, number] {
    return [lambda, Math.sin(phi)];
  }
  forward.invert = function(x: number, y: number): [number, number] {
    return [x, Math.asin(Math.min(1, Math.max(-1, y)))];
  };
  return d3.geoProjection(forward).scale(150);
}

// Custom Central Cylindrical projection
function geoCentralCylindrical() {
  function forward(lambda: number, phi: number): [number, number] {
    const clampedPhi = Math.max((-78 * Math.PI) / 180, Math.min((78 * Math.PI) / 180, phi));
    return [lambda, Math.tan(clampedPhi)];
  }
  forward.invert = function(x: number, y: number): [number, number] {
    return [x, Math.atan(y)];
  };
  return d3.geoProjection(forward).scale(150);
}
// @ts-ignore
import { geoAirocean } from 'd3-geo-polygon';
import { MapConfig, CountryFeature, AppliedCustomBorder, BorderSelectionMode, MapLocation } from '../types';
import { MAP_BRUSH_GROUPS } from '../utils/mapMetadata';
import { RotateCcw, Download } from 'lucide-react';
import { getWasmEngine, executeWasmRemap, MapPainterWasm } from '../utils/wasmEngine';
import { getWebGPUEngine, WebGPURemasterEngine } from '../utils/webgpuEngine';
import { WebGLMapEngine } from '../utils/webglMapEngine';
import { simplifyGeometry } from '../utils/simplification';
import { DecodedBgDescriptor, globalDecodedBgRegistry } from '../utils/bgDecoder';
import { isOceanFeature, checkIsGeoreferenced, getParentCountryId, getContinentId, detectMapHierarchy, getFeatureName, getCountryId } from '../utils/geoUtils';
import { computeDynamicLabelPlacementMode } from '../utils/labelPlacementEngine';

const WWF_REALM_NAMES: Record<string, string> = {
  'AA': 'Australasia (AA)',
  'AN': 'Antarctic (AN)',
  'AT': 'Afrotropic (AT)',
  'IM': 'Indomalaya (IM)',
  'NA': 'Nearctic (NA)',
  'NT': 'Neotropics (NT)',
  'OC': 'Oceania (OC)',
  'PAL': 'Palearctic (PAL)',
};

const WWF_BIOME_NAMES: Record<number | string, string> = {
  1: 'Tropical & Subtropical Moist Broadleaf Forests',
  2: 'Tropical & Subtropical Dry Broadleaf Forests',
  3: 'Tropical & Subtropical Coniferous Forests',
  4: 'Temperate Broadleaf & Mixed Forests',
  5: 'Temperate Coniferous Forests',
  6: 'Boreal Forests / Taiga',
  7: 'Tropical & Subtropical Grasslands, Savannas & Shrublands',
  8: 'Temperate Grasslands, Savannas & Shrublands',
  9: 'Flooded Grasslands & Savannas',
  10: 'Montane Grasslands & Shrublands',
  11: 'Tundra',
  12: 'Mediterranean Forests, Woodlands & Scrub',
  13: 'Deserts & Xeric Shrublands',
  14: 'Mangroves',
};

// Pre-load WebAssembly remapper engine globally at module-load time!
// This guarantees that the WebAssembly engine is instantiated and ready 
// immediately, eliminating any temporary JavaScript fallbacks.
let globalWasmEngine: MapPainterWasm | null = null;
getWasmEngine()
  .then((engine) => {
    globalWasmEngine = engine;
  })
  .catch((err) => {
    console.error("Failed to pre-load WebAssembly engine globally:", err);
  });

// Pre-load WebGPU hardware acceleration engine globally if supported!
let globalWebGPUEngine: WebGPURemasterEngine | null = null;
getWebGPUEngine()
  .then((engine) => {
    globalWebGPUEngine = engine;
    if (engine) {
      console.log("⚡ WebGPU hardware accelerated remapping engine loaded!");
    }
  })
  .catch((err) => {
    console.warn("WebGPU hardware acceleration not available, using WASM CPU engine fallback:", err);
  });

interface MapCanvasProps {
  config: MapConfig;
  features: CountryFeature[];
  selectedCountry: CountryFeature | null;
  onSelectCountry: (feature: CountryFeature | null) => void;
  onUpdateConfig: (updater: (prev: MapConfig) => MapConfig) => void;

  // Map Painting system parameters
  customColors: Record<string, string>;
  legendLabels?: Record<string, string>;
  onPaintCountry: (countryId: string, color: string | null, feature?: CountryFeature) => void;
  onStartPaintStroke?: () => void;
  onEndPaintStroke?: () => void;
  paintColor: string;
  setPaintColor: (color: string) => void;
  activeTool: 'paint' | 'eraser' | 'picker';
  setActiveTool: (tool: 'paint' | 'eraser' | 'picker') => void;

  // Metadata map lookup
  countryMetadataMap?: Record<string, {
    continent?: string;
    income_grp?: string;
    pop_est?: number;
    gdp_md_est?: number;
    name?: string;
  }>;

  // Right-click boundary custom style parameters
  selectedBorderCountryIds?: string[];
  onRightClickCountry?: (feature: CountryFeature, isShift: boolean) => void;
  customBorderSettings?: {
    style: 'solid' | 'dashed';
    dashLength: number;
    gapLength: number;
    borderSelectionMode: BorderSelectionMode;
    color: string;
    width: number;
  };
  appliedCustomBorders?: AppliedCustomBorder[];
  viewport?: { zoom: number; pan: { x: number; y: number } };
  setViewport?: React.Dispatch<React.SetStateAction<{ zoom: number; pan: { x: number; y: number } }>>;
  decodedBgDescriptor?: DecodedBgDescriptor | null;
  bgProgress?: number;
  brushScope?: string;
  selectedMapFile?: string;
  importedLocations: any[];
  showLocations: boolean;
  showLocationLabels: boolean;
  admin0Shape: string;
  admin0Color?: string;
  admin0Size: number;
  admin1Shape: string;
  admin1Color?: string;
  admin1Size: number;
  popUnder50kShape: string;
  popUnder50kColor?: string;
  popUnder50kSize: number;
  pop50kTo100kShape: string;
  pop50kTo100kColor?: string;
  pop50kTo100kSize: number;
  pop100kTo1MShape: string;
  riversData?: any;
  pop100kTo1MColor?: string;
  pop100kTo1MSize: number;
  pop1MTo10MShape: string;
  pop1MTo10MColor?: string;
  pop1MTo10MSize: number;
  popAbove10MShape: string;
  popAbove10MColor?: string;
  popAbove10MSize: number;
  locationLabelSize: number;
  locationLabelOutlineRatio: number;
  stylizeAdmin1?: boolean;
  onRegisterExportHandlers?: (handlers: { exportPNG: (scale?: number) => void }) => void;
  uiZoom?: number;
}



// Flag SVG image cache and loading status trackers for dynamic coloring
const flagImageCache = new Map<string, HTMLImageElement | null>();
const flagLoadingStatus = new Map<string, 'loading' | 'loaded' | 'error'>();

const a3ToA2: Record<string, string> = {
  AFG: 'af', AGO: 'ao', ALB: 'al', AND: 'ad', ARE: 'ae', ARG: 'ar', ARM: 'am', ASM: 'as', ATA: 'aq', ATF: 'tf', ATG: 'ag', AUS: 'au', AUT: 'at', AZE: 'az', BDI: 'bi', BEL: 'be', BEN: 'bf', BFA: 'bf', BGD: 'bd', BGR: 'bg', BHR: 'bh', BHS: 'bs', BIH: 'ba', BLR: 'by', BLZ: 'bz', BMU: 'bm', BOL: 'bo', BRA: 'br', BRB: 'bb', BRN: 'bn', BTN: 'bt', BWA: 'bw', CAF: 'cf', CAN: 'ca', CHE: 'ch', CHL: 'cl', CHN: 'cn', CIV: 'ci', CMR: 'cm', COD: 'cd', COG: 'cg', COK: 'ck', COL: 'co', COM: 'km', CPV: 'cv', CRI: 'cr', CUB: 'cu', CUW: 'cw', CYM: 'ky', CYP: 'cy', CZE: 'cz', DEU: 'de', DJI: 'dj', DMA: 'dm', DNK: 'dk', DOM: 'do', DZA: 'dz', ECU: 'ec', EGY: 'eg', ERI: 'er', ESH: 'eh', ESP: 'es', EST: 'ee', ETH: 'et', FIN: 'fi', FJI: 'fj', FLK: 'fk', FRA: 'fr', FRO: 'fo', FSM: 'fm', GAB: 'ga', GBR: 'gb', GEO: 'ge', GHA: 'gh', GIB: 'gi', GIN: 'gn', GLP: 'gp', GMB: 'gm', GNB: 'gw', GNQ: 'gq', GRC: 'gr', GRD: 'gd', GRL: 'gl', GTM: 'gt', GUF: 'gf', GUM: 'gu', GUY: 'gy', HKG: 'hk', HMD: 'hm', HND: 'hn', HRV: 'hr', HTI: 'ht', HUN: 'hu', IDN: 'id', IMN: 'im', IND: 'in', IOT: 'io', IRL: 'ie', IRN: 'ir', IRQ: 'iq', ISL: 'is', ISR: 'il', ITA: 'it', JAM: 'jm', JEY: 'je', JOR: 'jo', JPN: 'jp', KAZ: 'kz', KEN: 'ke', KGZ: 'kg', KHM: 'kh', KIR: 'ki', KNA: 'kn', KOR: 'kr', KWT: 'kw', LAO: 'la', LBN: 'lb', LBR: 'lr', LBY: 'ly', LCA: 'lc', LIE: 'li', LKA: 'lk', LSO: 'ls', LTU: 'lt', LUX: 'lu', LVA: 'lv', MAC: 'mo', MAF: 'mf', MAR: 'ma', MCO: 'mc', MDA: 'md', MDG: 'mg', MDV: 'mv', MEX: 'mx', MHL: 'mh', MKD: 'mk', MLI: 'ml', MLT: 'mt', MMR: 'mm', MNE: 'me', MNG: 'mn', MNP: 'mp', MOZ: 'mz', MRT: 'mr', MSR: 'ms', MTQ: 'mq', MUS: 'mu', MWI: 'mw', MYS: 'my', MYT: 'yt', PRIV: 'um', UM: 'um', NAM: 'na', NCL: 'nc', NER: 'ne', NFK: 'nf', NGA: 'ng', NIC: 'ni', NIU: 'nu', NLD: 'nl', NOR: 'no', NPL: 'np', NRU: 'nr', NZL: 'nz', OMN: 'om', PAK: 'pk', PAN: 'pa', PCN: 'pn', PER: 'pe', PHL: 'ph', PLW: 'pw', PNG: 'pg', POL: 'pl', PRI: 'pr', PRK: 'kp', PRT: 'pt', PRY: 'py', PSE: 'ps', PYF: 'pf', QAT: 'qa', REU: 're', ROU: 'ro', RUS: 'ru', RWA: 'rw', SAU: 'sa', SDN: 'sd', SEN: 'sn', SGP: 'sg', SGS: 'gs', SHN: 'sh', SJM: 'sj', SLB: 'sb', SLE: 'sl', SLV: 'sv', SMR: 'sm', SOM: 'so', SPM: 'pm', SRB: 'rs', SSD: 'ss', STP: 'st', SUR: 'sr', SVK: 'sk', SVN: 'si', SWE: 'se', SWZ: 'sz', SXM: 'sx', SYC: 'sc', SYR: 'sy', TCA: 'tc', TCD: 'td', TGO: 'tg', THA: 'th', TJK: 'tj', TKL: 'tk', TKM: 'tm', TLS: 'tl', TON: 'to', TTO: 'tt', TUN: 'tn', TUR: 'tr', TUV: 'tv', TWN: 'tw', TZA: 'tz', UGA: 'ug', UKR: 'ua', UMY: 'um', URY: 'uy', USA: 'us', UZB: 'uz', VAT: 'va', VCT: 'vc', VEN: 've', VGB: 'vg', VIR: 'vi', VNM: 'vn', VUT: 'vu', WLF: 'wf', WSM: 'ws', YEM: 'ye', ZAF: 'za', ZMB: 'zm', ZWE: 'zw'
};

function getFeatureIsoA2(feature: CountryFeature): string {
  if (!feature || !feature.properties) return '';
  const p = feature.properties;

  const rawName = String(p.name || p.NAME || p.name_long || p.NAME_LONG || p.admin || p.ADMIN || '').trim().toLowerCase();
  if (rawName && NAME_TO_ISO[rawName]) {
    return NAME_TO_ISO[rawName].toUpperCase();
  }

  // 1. Direct 2-letter ISO attributes
  const a2Candidates = [
    p.ISO_A2, p.iso_a2,
    p.ISO_A2_EH, p.iso_a2_eh,
    p.WB_A2, p.wb_a2,
    p.country
  ];

  for (const cand of a2Candidates) {
    if (cand && typeof cand === 'string') {
      const trimmed = cand.trim();
      if (trimmed !== '-99' && trimmed.length === 2) {
        return trimmed.toUpperCase();
      }
    }
  }

  const iso3166_2 = p.iso_3166_2 || p.ISO_3166_2;
  if (iso3166_2 && typeof iso3166_2 === 'string' && iso3166_2.includes('-')) {
    const part = iso3166_2.split('-')[0].trim();
    if (part.length === 2) return part.toUpperCase();
  }

  // 2. 3-letter ISO attributes mapped via authoritative lookup
  const a3Candidates = [
    p.ADM0_A3, p.adm0_a3,
    p.ISO_A3, p.iso_a3,
    p.ISO_A3_EH, p.iso_a3_eh,
    p.GU_A3, p.gu_a3,
    p.SOV_A3, p.sov_a3,
    p.SU_A3, p.su_a3,
    p.BRK_A3, p.brk_a3,
    p.WB_A3, p.wb_a3,
    p.A3, p.a3
  ];

  for (const candidate of a3Candidates) {
    if (candidate && typeof candidate === 'string' && candidate !== '-99') {
      const upper = candidate.trim().toUpperCase();
      if (a3ToA2[upper]) {
        return a3ToA2[upper].toUpperCase();
      }
    }
  }

  // 3. Fallback for sub-regions only
  const isSubRegion = !!(p.adm1_code || p.iso_3166_2 || p.ADM1_CODE || p.ISO_3166_2);
  if (isSubRegion && p.POSTAL && typeof p.POSTAL === 'string' && p.POSTAL.trim().length === 2) {
    return p.POSTAL.trim().toUpperCase();
  }

  return '';
}

const NAME_TO_ISO: Record<string, string> = {
  'western sahara': 'EH',
  'w. sahara': 'EH',
  'sahrawi arab democratic republic': 'EH',
  samoa: 'WS',
  'western samoa': 'WS',
  'american samoa': 'AS',
  vatican: 'VA',
  'vatican city': 'VA',
  'holy see': 'VA',
  monaco: 'MC',
  singapore: 'SG',
  'san marino': 'SM',
  liechtenstein: 'LI',
  andorra: 'AD',
  malta: 'MT',
  bahrain: 'BH',
  maldives: 'MV',
  'hong kong': 'HK',
  macau: 'MO',
  macao: 'MO',
  gibraltar: 'GI',
  nauru: 'NR',
  tuvalu: 'TV',
  palau: 'PW',
  'marshall islands': 'MH',
  'st. kitts and nevis': 'KN',
  'saint kitts and nevis': 'KN',
  'st. vincent and the grenadines': 'VC',
  'saint vincent and the grenadines': 'VC',
  barbados: 'BB',
  grenada: 'GD',
  'antigua and barbuda': 'AG',
  dominica: 'DM',
  'st. lucia': 'LC',
  'saint lucia': 'LC',
  seychelles: 'SC',
  mauritius: 'MU',
  comoros: 'KM',
  'sao tome and principe': 'ST',
  'cape verde': 'CV',
  'cabo verde': 'CV',
  luxembourg: 'LU',
};

function getFeatureIsoCode(feature: CountryFeature, mapFile?: string): string {
  if (!feature || !feature.properties) return '';
  const p = feature.properties;
  const isSubRegion = !!(p.adm1_code || p.iso_3166_2 || p.ADM1_CODE || p.ISO_3166_2);

  if (isSubRegion) {
    if (mapFile === 'world_adm1.json') {
      return ''; // Skip ISO codes for world sub-regions to fall back to normal names
    }
    const subCode = (
      p.postal || p.POSTAL ||
      p.abbrev || p.ABBREV ||
      p.iso_3166_2 || p.ISO_3166_2 ||
      p.code || p.CODE ||
      ''
    ).toString().trim();
    if (subCode && subCode !== '-99' && subCode.length >= 2) return subCode.toUpperCase();
  }

  const rawName = String(p.name || p.NAME || p.name_long || p.NAME_LONG || p.admin || p.ADMIN || '').trim().toLowerCase();
  if (rawName && NAME_TO_ISO[rawName]) {
    return NAME_TO_ISO[rawName].toUpperCase();
  }

  const a2 = getFeatureIsoA2(feature);
  if (a2 && a2.length === 2) {
    return a2.toUpperCase();
  }

  const a3Candidates = [
    p.ADM0_A3, p.adm0_a3,
    p.ISO_A3, p.iso_a3,
    p.ISO_A3_EH, p.iso_a3_eh,
    p.BRK_A3, p.brk_a3,
    p.WB_A3, p.wb_a3
  ];

  for (const candidate of a3Candidates) {
    if (candidate && typeof candidate === 'string' && candidate !== '-99') {
      const upper = candidate.trim().toUpperCase();
      if (upper.length === 3) return upper;
    }
  }

  return '';
}

function getOrLoadFlag(isoCode: string, triggerRedraw: () => void): HTMLImageElement | null {
  const isUrl = isoCode.startsWith('http://') || isoCode.startsWith('https://') || isoCode.startsWith('data:');
  const cacheKey = isUrl ? isoCode : isoCode.toLowerCase();

  if (flagImageCache.has(cacheKey)) {
    return flagImageCache.get(cacheKey) || null;
  }

  if (flagLoadingStatus.get(cacheKey) === 'loading') {
    return null;
  }

  flagLoadingStatus.set(cacheKey, 'loading');
  const img = new Image();

  img.onload = () => {
    flagImageCache.set(cacheKey, img);
    flagLoadingStatus.set(cacheKey, 'loaded');
    triggerRedraw();
  };

  img.onerror = () => {
    flagImageCache.set(cacheKey, null);
    flagLoadingStatus.set(cacheKey, 'error');
  };

  if (isUrl) {
    img.crossOrigin = 'anonymous';
    img.src = isoCode;
  } else {
    img.src = `https://flagcdn.com/${cacheKey}.svg`;
  }

  return null;
}

function drawLocationSymbol(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  shape: string,
  size: number,
  currentZoom: number,
  isDark: boolean,
  customColor?: string
) {
  // size represents the overall bounding diameter / box size (in px), mathematically aligned with font size (px)
  const r = size * 0.5;
  ctx.beginPath();
  
  // High contrast outline scaled with size
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = Math.min(0.8, Math.max(0.15, size * 0.1));

  const color = customColor || (
    shape === 'black_dot' || shape === 'dot' ? '#000000' :
    shape.includes('white') ? '#ffffff' :
    shape.includes('blue') ? '#3b82f6' :
    shape.includes('green') ? '#22c55e' :
    shape.includes('yellow') ? '#eab308' :
    shape.includes('purple') ? '#a855f7' : '#ef4444'
  );

  if (shape === 'triangle') {
    ctx.moveTo(x, y - r * 1.15);
    ctx.lineTo(x + r * 1.0, y + r * 0.85);
    ctx.lineTo(x - r * 1.0, y + r * 0.85);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.stroke();
  } else if (shape === 'diamond') {
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.stroke();
  } else if (shape === 'star') {
    const numPoints = 5;
    const outerRadius = r;
    const innerRadius = r * 0.45;
    for (let i = 0; i < numPoints * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i * Math.PI) / numPoints - Math.PI / 2;
      const sx = x + radius * Math.cos(angle);
      const sy = y + radius * Math.sin(angle);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.stroke();
  } else if (shape === 'pin') {
    ctx.arc(x, y - r * 0.4, r * 0.6, Math.PI * 0.8, Math.PI * 0.2, false);
    ctx.lineTo(x, y + r);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.stroke();
    // Inner dot
    ctx.beginPath();
    ctx.arc(x, y - r * 0.4, r * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  } else if (shape === 'cross') {
    const w = Math.max(0.3, r * 0.35);
    ctx.rect(x - w, y - r, w * 2, r * 2);
    ctx.rect(x - r, y - w, r * 2, w * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.stroke();
  } else if (shape.includes('square') || shape === 'square') {
    ctx.rect(x - r, y - r, 2 * r, 2 * r);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.stroke();
  } else {
    // Circle or dot (default)
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    if (color === '#000000' && isDark) {
      ctx.strokeStyle = '#ffffff';
    }
    ctx.stroke();
  }
}

interface GeometryItem {
  geom: any;
  feat: any;
  bounds: [[number, number], [number, number]];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  geoMinLon: number;
  geoMinLat: number;
  geoMaxLon: number;
  geoMaxLat: number;
}

function getGeographicBounds(geom: any): { minLon: number; minLat: number; maxLon: number; maxLat: number } {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  const processRing = (ring: any) => {
    if (!Array.isArray(ring)) return;
    for (let i = 0; i < ring.length; i++) {
      const pt = ring[i];
      if (!Array.isArray(pt) || pt.length < 2) continue;
      const lon = pt[0];
      const lat = pt[1];
      if (lon < minLon) minLon = lon;
      if (lat < minLat) minLat = lat;
      if (lon > maxLon) maxLon = lon;
      if (lat > maxLat) maxLat = lat;
    }
  };

  if (geom.type === 'Polygon') {
    const coords = geom.coordinates;
    if (Array.isArray(coords)) {
      coords.forEach(processRing);
    }
  } else if (geom.type === 'MultiPolygon') {
    const coords = geom.coordinates;
    if (Array.isArray(coords)) {
      coords.forEach((poly) => {
        if (Array.isArray(poly)) {
          poly.forEach(processRing);
        }
      });
    }
  }

  if (minLon === Infinity) {
    return { minLon: 0, minLat: 0, maxLon: 0, maxLat: 0 };
  }

  return { minLon, minLat, maxLon, maxLat };
}

function getGeoBoxDistance(a: GeometryItem, b: GeometryItem): number {
  let dLon = 0;
  if (a.geoMaxLon < b.geoMinLon) {
    dLon = b.geoMinLon - a.geoMaxLon;
  } else if (b.geoMaxLon < a.geoMinLon) {
    dLon = a.geoMinLon - b.geoMaxLon;
  }

  let dLat = 0;
  if (a.geoMaxLat < b.geoMinLat) {
    dLat = b.geoMinLat - a.geoMaxLat;
  } else if (b.geoMaxLat < a.geoMinLat) {
    dLat = a.geoMinLat - b.geoMaxLat;
  }

  return Math.sqrt(dLon * dLon + dLat * dLat);
}

function clusterGeometryItems(items: GeometryItem[], maxDistance: number): GeometryItem[][] {
  const visited = new Set<number>();
  const clusters: GeometryItem[][] = [];

  for (let i = 0; i < items.length; i++) {
    if (visited.has(i)) continue;

    const cluster: GeometryItem[] = [];
    const queue = [i];
    visited.add(i);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      cluster.push(items[curr]);

      for (let j = 0; j < items.length; j++) {
        if (!visited.has(j)) {
          if (getGeoBoxDistance(items[curr], items[j]) < maxDistance) {
            visited.add(j);
            queue.push(j);
          }
        }
      }
    }
    clusters.push(cluster);
  }

  return clusters;
}

// Mapchart-style repeating texture pattern generator and cache
const patternCache = new Map<string, CanvasPattern>();

function getOrCreatePattern(ctx: CanvasRenderingContext2D, patternStr: string, currentZoom: number = 1): CanvasPattern | string {
  if (!patternStr.startsWith('pattern:')) return patternStr;
  
  const key = patternStr;
  let pattern = patternCache.get(key);
  
  if (!pattern) {
    const parts = patternStr.split(':');
    const type = parts[1];
    
    let baseColor = '#ffffff';
    let patternColor = '#3b82f6';
    let hasBaseColor = false;
    
    if (parts.length >= 4) {
      baseColor = parts[2] || '#ffffff';
      patternColor = parts[3] || '#3b82f6';
      hasBaseColor = true;
    } else {
      // Legacy 3-part format: pattern:${type}:${color}
      patternColor = parts[2] || '#3b82f6';
      hasBaseColor = false;
    }
    
    const size = 24;
    const pCanvas = document.createElement('canvas');
    pCanvas.width = size;
    pCanvas.height = size;
    const pCtx = pCanvas.getContext('2d')!;
    
    if (hasBaseColor) {
      pCtx.fillStyle = baseColor;
      pCtx.fillRect(0, 0, size, size);
    } else {
      pCtx.clearRect(0, 0, size, size);
    }
    
    pCtx.strokeStyle = patternColor;
    pCtx.fillStyle = patternColor;
    pCtx.lineWidth = 1.5;
    pCtx.lineCap = 'square';
    
    if (type === 'stripes-45') {
      pCtx.beginPath();
      const step = 6;
      for (let offset = -size; offset < size * 2; offset += step) {
        pCtx.moveTo(offset, 0);
        pCtx.lineTo(offset - size, size);
      }
      pCtx.stroke();
    } else if (type === 'stripes-135') {
      pCtx.beginPath();
      const step = 6;
      for (let offset = -size; offset < size * 2; offset += step) {
        pCtx.moveTo(offset, 0);
        pCtx.lineTo(offset + size, size);
      }
      pCtx.stroke();
    } else if (type === 'dots') {
      const step = 8;
      for (let x = 4; x < size; x += step) {
        for (let y = 4; y < size; y += step) {
          pCtx.beginPath();
          pCtx.arc(x, y, 1.6, 0, Math.PI * 2);
          pCtx.fill();
        }
      }
    } else if (type === 'grid') {
      pCtx.lineWidth = 1.2;
      pCtx.beginPath();
      const step = 8;
      for (let pos = 0; pos <= size; pos += step) {
        pCtx.moveTo(pos, 0); pCtx.lineTo(pos, size);
        pCtx.moveTo(0, pos); pCtx.lineTo(size, pos);
      }
      pCtx.stroke();
    } else if (type === 'cross') {
      pCtx.lineWidth = 1.2;
      pCtx.beginPath();
      const step = 8;
      for (let offset = -size; offset < size * 2; offset += step) {
        pCtx.moveTo(offset, 0); pCtx.lineTo(offset - size, size);
        pCtx.moveTo(offset, 0); pCtx.lineTo(offset + size, size);
      }
      pCtx.stroke();
    } else {
      pCtx.beginPath();
      const step = 6;
      for (let offset = -size; offset < size * 2; offset += step) {
        pCtx.moveTo(offset, 0); pCtx.lineTo(offset - size, size);
      }
      pCtx.stroke();
    }
    
    const createdPattern = ctx.createPattern(pCanvas, 'repeat');
    if (createdPattern) {
      pattern = createdPattern;
      patternCache.set(key, pattern);
    } else {
      return patternColor;
    }
  }
  
  if (pattern && typeof (pattern as any).setTransform === 'function') {
    try {
      const scale = 1 / Math.max(0.001, currentZoom);
      (pattern as any).setTransform({ a: scale, b: 0, c: 0, d: scale, e: 0, f: 0 });
    } catch (e) {}
  }
  
  return pattern;
}

function drawSpacedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  extraSpacing: number,
  isDark: boolean,
  viewportZoom: number,
  fontPx: number = 12,
  customTextColor?: string,
  customHaloColor?: string,
  customHaloRatio?: number
) {
  const haloRatio = customHaloRatio !== undefined ? customHaloRatio : 0.15;
  const strokeWidth = fontPx * haloRatio;
  ctx.lineWidth = Math.max(0.01, strokeWidth);
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  const resolvedTextColor = (customTextColor && customTextColor !== 'default')
    ? customTextColor
    : (isDark ? '#fdfcf8' : '#111e35');

  const resolvedHaloColor = (customHaloColor && customHaloColor !== 'default')
    ? customHaloColor
    : (isDark ? '#111e35' : '#fdfcf8');

  if (extraSpacing <= 0) {
    if (strokeWidth > 0.01) {
      ctx.strokeStyle = resolvedHaloColor;
      ctx.strokeText(text, x, y);
    }

    ctx.fillStyle = resolvedTextColor;
    ctx.fillText(text, x, y);
    return;
  }

  const origAlign = ctx.textAlign;
  ctx.textAlign = 'left';

  const chars = text.split('');
  const charWidths = chars.map(c => ctx.measureText(c).width);
  const totalWidth = charWidths.reduce((sum, w) => sum + w, 0) + (chars.length - 1) * extraSpacing;
  const startX = x - totalWidth / 2;

  if (strokeWidth > 0.01) {
    ctx.strokeStyle = resolvedHaloColor;
    let currentX = startX;
    chars.forEach((c, idx) => {
      ctx.strokeText(c, currentX, y);
      currentX += charWidths[idx] + extraSpacing;
    });
  }

  ctx.fillStyle = resolvedTextColor;
  let currentX = startX;
  chars.forEach((c, idx) => {
    ctx.fillText(c, currentX, y);
    currentX += charWidths[idx] + extraSpacing;
  });

  ctx.textAlign = origAlign;
}

function isPointInScreenPolygon(pt: [number, number], polygon: [number, number][]): boolean {
  const x = pt[0], y = pt[1];
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function isLabelContainedInPolygon(
  x: number,
  y: number,
  textW: number,
  fontPx: number,
  angleRad: number,
  screenPolygon: [number, number][],
  padding: number = 1.0
): boolean {
  if (!screenPolygon || screenPolygon.length < 3) return true;

  const halfW = textW / 2 + padding;
  const halfH = fontPx * 0.50 + padding;

  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);

  const localPoints: [number, number][] = [
    [-halfW, -halfH],
    [halfW, -halfH],
    [halfW, halfH],
    [-halfW, halfH],
    [0, -halfH],
    [0, halfH],
    [-halfW, 0],
    [halfW, 0],
  ];

  for (let i = 0; i < localPoints.length; i++) {
    const [lx, ly] = localPoints[i];
    const px = x + lx * cosA - ly * sinA;
    const py = y + lx * sinA + ly * cosA;

    if (!isPointInScreenPolygon([px, py], screenPolygon)) {
      return false;
    }
  }

  return true;
}

interface LabelAdjustmentParams {
  x: number;
  y: number;
  label: string;
  isoCode?: string;
  nameStyle?: string;
  fontPx: number;
  baseFontPx?: number;
  angle: number;
  extraSpacing: number;
  isSpherical: boolean;
  gcX: number;
  gcY: number;
  gRadius: number;
  mapMinX: number;
  mapMinY: number;
  mapMaxX: number;
  mapMaxY: number;
  polyMinX?: number;
  polyMinY?: number;
  polyMaxX?: number;
  polyMaxY?: number;
  borderMargin?: number;
  currentZoom?: number;
  isCityState?: boolean;
  minFontPx?: number;
  screenPoly?: [number, number][];
  measureWidth: (text: string, fontPx: number) => number;
}

interface LabelAdjustmentResult {
  visible: boolean;
  x: number;
  y: number;
  label: string;
  fontPx: number;
  extraSpacing: number;
}

function validateAndAdjustLabelPlacement(params: LabelAdjustmentParams): LabelAdjustmentResult {
  const {
    x: origX,
    y: origY,
    label: initialLabel,
    isoCode,
    nameStyle = 'full-name',
    fontPx: initialFontPx,
    baseFontPx,
    angle,
    extraSpacing: initialSpacing,
    isSpherical,
    gcX,
    gcY,
    gRadius,
    mapMinX,
    mapMinY,
    mapMaxX,
    mapMaxY,
    polyMinX,
    polyMinY,
    polyMaxX,
    polyMaxY,
    borderMargin = 2.0,
    currentZoom = 1.0,
    isCityState = false,
    minFontPx = 1,
    screenPoly,
    measureWidth,
  } = params;

  let x = origX;
  let y = origY;

  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  // Helper to check if a label configuration at (posX, posY) fits strictly inside map/globe borders AND land polygon/extent
  const testFit = (posX: number, posY: number, textStr: string, fPx: number, spacing: number) => {
    const rawW = measureWidth(textStr, fPx);
    const totalW = textStr.length > 1 ? rawW + spacing * (textStr.length - 1) : rawW;
    const margin = Math.min(1.0, fPx * 0.15);
    const halfW = totalW / 2 + margin;
    const halfH = fPx * 0.55 + margin;

    // 1. Outer map / globe boundary checks
    const localCorners = [
      [-halfW, -halfH],
      [halfW, -halfH],
      [-halfW, halfH],
      [halfW, halfH],
    ];

    for (let i = 0; i < 4; i++) {
      const [lx, ly] = localCorners[i];
      const cx = posX + lx * cosA - ly * sinA;
      const cy = posY + lx * sinA + ly * cosA;

      if (isSpherical && gRadius > 0) {
        const distToCenter = Math.hypot(cx - gcX, cy - gcY);
        if (distToCenter > gRadius - borderMargin) {
          return false;
        }
      }

      if (
        cx < mapMinX + borderMargin ||
        cx > mapMaxX - borderMargin ||
        cy < mapMinY + borderMargin ||
        cy > mapMaxY - borderMargin
      ) {
        return false;
      }
    }

    // 2. Country Extent boundary check with tight polygon boundary tolerance
    if (
      polyMinX !== undefined && polyMaxX !== undefined &&
      polyMinY !== undefined && polyMaxY !== undefined &&
      isFinite(polyMinX) && isFinite(polyMaxX)
    ) {
      const tolX = Math.min(1.0, halfW * 0.08);
      const tolY = Math.min(1.0, halfH * 0.08);
      if (
        posX - halfW < polyMinX - tolX ||
        posX + halfW > polyMaxX + tolX ||
        posY - halfH < polyMinY - tolY ||
        posY + halfH > polyMaxY + tolY
      ) {
        return false;
      }
    }

    return true;
  };

  const candidateLabels: string[] = [];
  if (nameStyle === 'short-code') {
    candidateLabels.push((isoCode && isoCode.length >= 2) ? isoCode : initialLabel);
  } else if (nameStyle === 'dynamic-adaptive') {
    candidateLabels.push(initialLabel);
    if (isoCode && isoCode.length >= 2 && isoCode !== initialLabel) {
      candidateLabels.push(isoCode);
    }
  } else {
    // Default 'full-name': strictly preserve full name
    candidateLabels.push(initialLabel);
  }

  const startFontPx = Math.max(minFontPx, initialFontPx);
  const targetMinFontPx = Math.max(0.5, minFontPx);

  if (isCityState) {
    const cityLabel = (isoCode && isoCode.length >= 2) ? isoCode : initialLabel;
    return {
      visible: true,
      x: origX,
      y: origY,
      label: cityLabel,
      fontPx: Math.max(minFontPx, initialFontPx),
      extraSpacing: 0,
    };
  }

  for (let cIdx = 0; cIdx < candidateLabels.length; cIdx++) {
    const candLabel = candidateLabels[cIdx];
    let currentFontPx = startFontPx;

    while (currentFontPx >= targetMinFontPx - 0.001) {
      const scaleRatio = currentFontPx / startFontPx;
      const currentSpacing = Math.max(0, initialSpacing * scaleRatio);

      // Clamp position within map borders before testing fit
      const rawW = measureWidth(candLabel, currentFontPx);
      const totalW = candLabel.length > 1 ? rawW + currentSpacing * (candLabel.length - 1) : rawW;
      const halfW = totalW / 2 + 1;
      const halfH = currentFontPx * 0.55 + 1;

      if (!isSpherical) {
        if (x - halfW < mapMinX + borderMargin) x = mapMinX + borderMargin + halfW;
        if (x + halfW > mapMaxX - borderMargin) x = mapMaxX - borderMargin - halfW;
        if (y - halfH < mapMinY + borderMargin) y = mapMinY + borderMargin + halfH;
        if (y + halfH > mapMaxY - borderMargin) y = mapMaxY - borderMargin - halfH;
      }

      if (testFit(x, y, candLabel, currentFontPx, currentSpacing)) {
        return {
          visible: true,
          x,
          y,
          label: candLabel,
          fontPx: currentFontPx,
          extraSpacing: currentSpacing,
        };
      }

      // Step down smoothly from max font size down to min font size
      if (currentFontPx > 24) {
        currentFontPx -= 1.0;
      } else if (currentFontPx > 12) {
        currentFontPx -= 0.5;
      } else {
        currentFontPx -= 0.25;
      }
    }
  }

  // Fallback respecting user's configured name style:
  const fallbackLabel = (nameStyle === 'short-code' && isoCode && isoCode.length >= 2) ? isoCode : initialLabel;
  return {
    visible: true,
    x,
    y,
    label: fallbackLabel,
    fontPx: targetMinFontPx,
    extraSpacing: 0,
  };
}

export function getLabelFontString(fontFam: string, sizePx: number): string {
  if (fontFam === 'cinzel') return `700 ${sizePx}px "Cinzel", "Marcellus", "Georgia", serif`;
  if (fontFam === 'cinzel-dec') return `700 ${sizePx}px "Cinzel Decorative", "Cinzel", serif`;
  if (fontFam === 'gothic') return `${sizePx}px "UnifrakturMaguntia", "Germania One", serif`;
  if (fontFam === 'medieval') return `${sizePx}px "MedievalSharp", "Almendra", "Georgia", serif`;
  if (fontFam === 'engraved') return `italic ${sizePx}px "IM Fell English", "Georgia", serif`;
  if (fontFam === 'marcellus') return `${sizePx}px "Marcellus", "Cinzel", serif`;
  if (fontFam === 'almendra') return `700 ${sizePx}px "Almendra", "MedievalSharp", serif`;
  if (fontFam === 'pirata') return `${sizePx}px "Pirata One", "UnifrakturMaguntia", serif`;
  if (fontFam === 'cormorant') return `italic bold ${sizePx}px "Cormorant Garamond", serif`;
  if (fontFam === 'serif') return `italic bold ${sizePx}px "Playfair Display", "Cinzel", "Georgia", serif`;
  if (fontFam === 'bodoni' || fontFam === 'hoi4') return `900 ${sizePx}px "Bodoni Moda", "Cinzel", "Georgia", serif`;
  if (fontFam === 'mono') return `${sizePx}px "JetBrains Mono", "Fira Code", monospace`;
  if (fontFam === 'roboto') return `bold ${sizePx}px "Roboto", "Inter", sans-serif`;
  if (fontFam === 'display') return `900 ${sizePx}px "Outfit", "Space Grotesk", sans-serif`;
  if (fontFam === 'sans') return `bold ${sizePx}px "Space Grotesk", "Inter", sans-serif`;
  return `${sizePx}px "Georgia", serif`;
}

export function getWatermarkFontString(fontFam: string, sizePx: number = 11): string {
  if (fontFam === 'cinzel') return `700 ${sizePx}px "Cinzel", "Marcellus", "Georgia", serif`;
  if (fontFam === 'cinzel-dec') return `700 ${sizePx}px "Cinzel Decorative", "Cinzel", serif`;
  if (fontFam === 'gothic') return `bold ${sizePx}px "UnifrakturMaguntia", "Germania One", serif`;
  if (fontFam === 'medieval') return `bold ${sizePx}px "MedievalSharp", "Almendra", "Georgia", serif`;
  if (fontFam === 'engraved') return `italic bold ${sizePx}px "IM Fell English", "Georgia", serif`;
  if (fontFam === 'marcellus') return `bold ${sizePx}px "Marcellus", "Cinzel", serif`;
  if (fontFam === 'almendra') return `700 ${sizePx}px "Almendra", "MedievalSharp", serif`;
  if (fontFam === 'pirata') return `bold ${sizePx}px "Pirata One", "UnifrakturMaguntia", serif`;
  if (fontFam === 'cormorant') return `italic bold ${sizePx}px "Cormorant Garamond", serif`;
  if (fontFam === 'serif') return `italic bold ${sizePx}px "Playfair Display", "Cinzel", "Georgia", serif`;
  if (fontFam === 'bodoni' || fontFam === 'hoi4') return `900 ${sizePx}px "Bodoni Moda", "Cinzel", "Georgia", serif`;
  if (fontFam === 'mono') return `600 ${sizePx}px "JetBrains Mono", "Fira Code", monospace`;
  if (fontFam === 'roboto') return `bold ${sizePx}px "Roboto", "Inter", sans-serif`;
  if (fontFam === 'display') return `900 ${sizePx}px "Outfit", "Space Grotesk", sans-serif`;
  if (fontFam === 'sans') return `600 ${sizePx}px "Space Grotesk", "Inter", sans-serif`;
  return `bold ${sizePx}px "Georgia", serif`;
}

export function getLegendTitleFontString(fontFam: string, sizePx: number = 9.5): string {
  if (fontFam === 'cinzel') return `700 ${sizePx}px "Cinzel", "Marcellus", "Georgia", serif`;
  if (fontFam === 'cinzel-dec') return `700 ${sizePx}px "Cinzel Decorative", "Cinzel", serif`;
  if (fontFam === 'gothic') return `bold ${sizePx}px "UnifrakturMaguntia", "Germania One", serif`;
  if (fontFam === 'medieval') return `bold ${sizePx}px "MedievalSharp", "Almendra", "Georgia", serif`;
  if (fontFam === 'engraved') return `italic bold ${sizePx}px "IM Fell English", "Georgia", serif`;
  if (fontFam === 'marcellus') return `bold ${sizePx}px "Marcellus", "Cinzel", serif`;
  if (fontFam === 'almendra') return `700 ${sizePx}px "Almendra", "MedievalSharp", serif`;
  if (fontFam === 'pirata') return `bold ${sizePx}px "Pirata One", "UnifrakturMaguntia", serif`;
  if (fontFam === 'cormorant') return `italic bold ${sizePx}px "Cormorant Garamond", serif`;
  if (fontFam === 'serif') return `italic bold ${sizePx}px "Playfair Display", "Cinzel", "Georgia", serif`;
  if (fontFam === 'bodoni' || fontFam === 'hoi4') return `900 ${sizePx}px "Bodoni Moda", "Cinzel", "Georgia", serif`;
  if (fontFam === 'mono') return `bold ${sizePx}px "JetBrains Mono", monospace`;
  if (fontFam === 'roboto') return `bold ${sizePx}px "Roboto", "Inter", sans-serif`;
  if (fontFam === 'display') return `900 ${sizePx}px "Outfit", "Space Grotesk", sans-serif`;
  if (fontFam === 'sans') return `700 ${sizePx}px "Space Grotesk", "Inter", sans-serif`;
  return `bold ${sizePx}px "Georgia", serif`;
}

export function getLegendItemFontString(fontFam: string, sizePx: number = 9.5): string {
  if (fontFam === 'cinzel') return `600 ${sizePx}px "Cinzel", "Georgia", serif`;
  if (fontFam === 'cinzel-dec') return `600 ${sizePx}px "Cinzel Decorative", "Cinzel", serif`;
  if (fontFam === 'gothic') return `${sizePx}px "UnifrakturMaguntia", serif`;
  if (fontFam === 'medieval') return `${sizePx}px "MedievalSharp", serif`;
  if (fontFam === 'engraved') return `italic ${sizePx}px "IM Fell English", serif`;
  if (fontFam === 'marcellus') return `${sizePx}px "Marcellus", serif`;
  if (fontFam === 'almendra') return `600 ${sizePx}px "Almendra", serif`;
  if (fontFam === 'pirata') return `${sizePx}px "Pirata One", serif`;
  if (fontFam === 'cormorant') return `italic ${sizePx}px "Cormorant Garamond", serif`;
  if (fontFam === 'serif') return `${sizePx}px "Playfair Display", "Georgia", serif`;
  if (fontFam === 'bodoni' || fontFam === 'hoi4') return `600 ${sizePx}px "Bodoni Moda", "Georgia", serif`;
  if (fontFam === 'mono') return `${sizePx}px "JetBrains Mono", monospace`;
  if (fontFam === 'roboto') return `${sizePx}px "Roboto", sans-serif`;
  if (fontFam === 'display') return `600 ${sizePx}px "Outfit", "Space Grotesk", sans-serif`;
  if (fontFam === 'sans') return `500 ${sizePx}px "Space Grotesk", "Inter", sans-serif`;
  return `${sizePx}px "Georgia", serif`;
}

function getSVGFontProperties(fontFam: string) {
  let fontFamily = '"Georgia", serif';
  let fontWeight = 'bold';
  let fontStyle = 'normal';

  if (fontFam === 'cinzel') {
    fontFamily = '"Cinzel", "Marcellus", "Georgia", serif';
    fontWeight = '700';
  } else if (fontFam === 'cinzel-dec') {
    fontFamily = '"Cinzel Decorative", "Cinzel", serif';
    fontWeight = '700';
  } else if (fontFam === 'gothic') {
    fontFamily = '"UnifrakturMaguntia", "Germania One", serif';
    fontWeight = 'normal';
  } else if (fontFam === 'medieval') {
    fontFamily = '"MedievalSharp", "Almendra", "Georgia", serif';
    fontWeight = 'normal';
  } else if (fontFam === 'engraved') {
    fontFamily = '"IM Fell English", "Georgia", serif';
    fontStyle = 'italic';
    fontWeight = 'normal';
  } else if (fontFam === 'marcellus') {
    fontFamily = '"Marcellus", "Cinzel", serif';
    fontWeight = 'normal';
  } else if (fontFam === 'almendra') {
    fontFamily = '"Almendra", "MedievalSharp", serif';
    fontWeight = '700';
  } else if (fontFam === 'pirata') {
    fontFamily = '"Pirata One", "UnifrakturMaguntia", serif';
    fontWeight = 'normal';
  } else if (fontFam === 'cormorant') {
    fontFamily = '"Cormorant Garamond", serif';
    fontStyle = 'italic';
    fontWeight = 'bold';
  } else if (fontFam === 'serif') {
    fontFamily = '"Playfair Display", "Cinzel", "Georgia", serif';
    fontStyle = 'italic';
    fontWeight = 'bold';
  } else if (fontFam === 'bodoni' || fontFam === 'hoi4') {
    fontFamily = '"Bodoni Moda", "Cinzel", "Georgia", serif';
    fontWeight = '900';
  } else if (fontFam === 'roboto') {
    fontFamily = '"Roboto", "Inter", sans-serif';
    fontWeight = 'bold';
  } else if (fontFam === 'mono') {
    fontFamily = '"JetBrains Mono", "Fira Code", monospace';
    fontWeight = 'normal';
  } else if (fontFam === 'display') {
    fontFamily = '"Outfit", "Space Grotesk", "Arial Black", sans-serif';
    fontWeight = '900';
  } else if (fontFam === 'sans') {
    fontFamily = '"Space Grotesk", "Inter", sans-serif';
    fontWeight = 'bold';
  } else {
    fontFamily = '"Georgia", serif';
    fontWeight = 'bold';
  }

  return { fontFamily: `'${fontFamily}'`, rawFontFamily: fontFamily, fontWeight, fontStyle };
}

// Bounding box cache for fast lat/lon boundary pre-checks (extremely fast)
const bboxCache = new Map<string, [number, number, number, number]>(); // [minLon, minLat, maxLon, maxLat]

function getSegmentKey(x1: number, y1: number, x2: number, y2: number): string {
  const p1 = `${x1.toFixed(5)},${y1.toFixed(5)}`;
  const p2 = `${x2.toFixed(5)},${y2.toFixed(5)}`;
  return p1 < p2 ? `${p1}_${p2}` : `${p2}_${p1}`;
}

function chainSegments(segments: [number, number, number, number][]): [number, number][][] {
  if (segments.length === 0) return [];

  const toKey = (x: number, y: number) => `${x.toFixed(5)},${y.toFixed(5)}`;

  const adj = new Map<string, number[]>();
  segments.forEach((seg, idx) => {
    const k1 = toKey(seg[0], seg[1]);
    const k2 = toKey(seg[2], seg[3]);
    if (!adj.has(k1)) adj.set(k1, []);
    if (!adj.has(k2)) adj.set(k2, []);
    adj.get(k1)!.push(idx);
    adj.get(k2)!.push(idx);
  });

  const visited = new Set<number>();
  const paths: [number, number][][] = [];

  for (let i = 0; i < segments.length; i++) {
    if (visited.has(i)) continue;

    const seg = segments[i];
    visited.add(i);

    let pathPoints: [number, number][] = [[seg[0], seg[1]], [seg[2], seg[3]]];

    // Extend forward
    let canExtend = true;
    while (canExtend) {
      const endPt = pathPoints[pathPoints.length - 1];
      const endKey = toKey(endPt[0], endPt[1]);
      const neighbors = adj.get(endKey) || [];
      const nextIdx = neighbors.find(idx => !visited.has(idx));
      if (nextIdx !== undefined) {
        const nextSeg = segments[nextIdx];
        const nextK1 = toKey(nextSeg[0], nextSeg[1]);
        const nextPt: [number, number] = nextK1 === endKey ? [nextSeg[2], nextSeg[3]] : [nextSeg[0], nextSeg[1]];

        // Guard against antimeridian jumps during chaining
        if (Math.abs(endPt[0] - nextPt[0]) > 180 || Math.abs(endPt[1] - nextPt[1]) > 90) {
          canExtend = false;
        } else {
          visited.add(nextIdx);
          pathPoints.push(nextPt);
        }
      } else {
        canExtend = false;
      }
    }

    // Extend backward
    canExtend = true;
    while (canExtend) {
      const startPt = pathPoints[0];
      const startKey = toKey(startPt[0], startPt[1]);
      const neighbors = adj.get(startKey) || [];
      const nextIdx = neighbors.find(idx => !visited.has(idx));
      if (nextIdx !== undefined) {
        const nextSeg = segments[nextIdx];
        const nextK1 = toKey(nextSeg[0], nextSeg[1]);
        const nextPt: [number, number] = nextK1 === startKey ? [nextSeg[2], nextSeg[3]] : [nextSeg[0], nextSeg[1]];

        // Guard against antimeridian jumps during chaining
        if (Math.abs(startPt[0] - nextPt[0]) > 180 || Math.abs(startPt[1] - nextPt[1]) > 90) {
          canExtend = false;
        } else {
          visited.add(nextIdx);
          pathPoints.unshift(nextPt);
        }
      } else {
        canExtend = false;
      }
    }

    paths.push(pathPoints);
  }

  return paths.filter((p) => {
    if (p.length < 2) return false;
    for (let k = 0; k < p.length - 1; k++) {
      if (Math.abs(p[k + 1][0] - p[k][0]) > 1e-7 || Math.abs(p[k + 1][1] - p[k][1]) > 1e-7) {
        return true;
      }
    }
    return false;
  });
}

function getFeatureBBox(feature: CountryFeature): [number, number, number, number] {
  if (!(feature as any)._enlarged && (feature as any).bbox) return (feature as any).bbox;
  const countryId = getCountryId(feature) + ((feature as any)._enlarged ? '_enlarged' : '');
  let bbox = bboxCache.get(countryId);
  if (bbox) return bbox;

  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;

  const traverse = (coords: any) => {
    if (Array.isArray(coords) && typeof coords[0] === 'number') {
      const lon = coords[0];
      const lat = coords[1];
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    } else if (Array.isArray(coords)) {
      for (let i = 0; i < coords.length; i++) {
        traverse(coords[i]);
      }
    }
  };

  const geom = feature.geometry as any;
  if (geom && geom.coordinates) {
    traverse(geom.coordinates);
  }

  if (minLon === Infinity) {
    bbox = [-180, -90, 180, 90];
  } else {
    bbox = [minLon, minLat, maxLon, maxLat];
  }
  
  bboxCache.set(countryId, bbox);
  return bbox;
}

const projectedBBoxGlobalCache = new Map<string, [number, number, number, number]>();

function getFeatureProjectedBounds(
  feature: CountryFeature,
  projection: d3.GeoProjection,
  projKey: string,
  isNoGeoref: boolean
): [number, number, number, number] | null {
  const countryId = getCountryId(feature);
  const cacheKey = `${projKey}_${countryId}`;
  let pBbox = projectedBBoxGlobalCache.get(cacheKey);
  if (pBbox) return pBbox;

  const [minLon, minLat, maxLon, maxLat] = getFeatureBBox(feature);

  if (isNoGeoref) {
    const p1 = projection([minLon, minLat]);
    const p2 = projection([maxLon, maxLat]);
    if (!p1 || !p2 || isNaN(p1[0]) || isNaN(p2[0])) return null;
    pBbox = [
      Math.min(p1[0], p2[0]),
      Math.min(p1[1], p2[1]),
      Math.max(p1[0], p2[0]),
      Math.max(p1[1], p2[1])
    ];
  } else {
    const corners: [number, number][] = [
      [minLon, minLat],
      [maxLon, minLat],
      [maxLon, maxLat],
      [minLon, maxLat],
      [(minLon + maxLon) / 2, (minLat + maxLat) / 2]
    ];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let validCount = 0;
    for (let i = 0; i < corners.length; i++) {
      const pt = projection(corners[i]);
      if (pt && !isNaN(pt[0]) && !isNaN(pt[1])) {
        if (pt[0] < minX) minX = pt[0];
        if (pt[0] > maxX) maxX = pt[0];
        if (pt[1] < minY) minY = pt[1];
        if (pt[1] > maxY) maxY = pt[1];
        validCount++;
      }
    }
    if (validCount === 0) return null;
    pBbox = [minX, minY, maxX, maxY];
  }

  if (projectedBBoxGlobalCache.size > 8000) {
    const firstKey = projectedBBoxGlobalCache.keys().next().value;
    if (firstKey) projectedBBoxGlobalCache.delete(firstKey);
  }
  projectedBBoxGlobalCache.set(cacheKey, pBbox);
  return pBbox;
}

// Spatial Grid Index for rapid candidate O(1) lookup on mouse hover/click (zero string allocation)
class SpatialGridIndex {
  private grid: (CountryFeature[] | undefined)[];
  private minX = -180;
  private minY = -90;
  private cellSizeX = 10;
  private cellSizeY = 10;
  private numCols = 36;
  private numRows = 18;
  private isNoGeoref = false;

  constructor(features: CountryFeature[], isNoGeoref?: boolean) {
    this.isNoGeoref = !!isNoGeoref;
    if (isNoGeoref && features.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      features.forEach(f => {
        const bbox = getFeatureBBox(f);
        if (bbox[0] < minX) minX = bbox[0];
        if (bbox[1] < minY) minY = bbox[1];
        if (bbox[2] > maxX) maxX = bbox[2];
        if (bbox[3] > maxY) maxY = bbox[3];
      });
      
      this.minX = minX;
      this.minY = minY;
      const width = maxX - minX;
      const height = maxY - minY;
      
      this.numCols = 40;
      this.numRows = 40;
      this.cellSizeX = Math.max(0.0001, width / this.numCols);
      this.cellSizeY = Math.max(0.0001, height / this.numRows);
    }

    const totalCells = this.numCols * this.numRows;
    this.grid = new Array(totalCells);

    for (let fIdx = 0; fIdx < features.length; fIdx++) {
      const feature = features[fIdx];
      const [minLon, minLat, maxLon, maxLat] = getFeatureBBox(feature);
      
      const minCol = Math.floor((minLon - this.minX) / this.cellSizeX);
      const maxCol = Math.floor((maxLon - this.minX) / this.cellSizeX);
      const minRow = Math.floor((minLat - this.minY) / this.cellSizeY);
      const maxRow = Math.floor((maxLat - this.minY) / this.cellSizeY);

      const cols: number[] = [];
      if (this.isNoGeoref) {
        for (let c = minCol; c <= maxCol; c++) {
          if (c >= 0 && c < this.numCols) cols.push(c);
        }
      } else {
        if (minCol <= maxCol) {
          for (let c = minCol; c <= maxCol; c++) {
            if (c >= 0 && c < this.numCols) cols.push(c);
          }
        } else {
          // Antimeridian wrapping
          for (let c = minCol; c < this.numCols; c++) {
            if (c >= 0 && c < this.numCols) cols.push(c);
          }
          for (let c = 0; c <= maxCol; c++) {
            if (c >= 0 && c < this.numCols) cols.push(c);
          }
        }
      }

      for (let r = minRow; r <= maxRow; r++) {
        if (r < 0 || r >= this.numRows) continue;
        const rowOffset = r * this.numCols;
        for (let ci = 0; ci < cols.length; ci++) {
          const c = cols[ci];
          const cellIdx = rowOffset + c;
          let list = this.grid[cellIdx];
          if (!list) {
            list = [];
            this.grid[cellIdx] = list;
          }
          list.push(feature);
        }
      }
    }
  }

  public getCandidates(lon: number, lat: number): CountryFeature[] {
    if (isNaN(lon) || !isFinite(lon) || isNaN(lat) || !isFinite(lat)) {
      return [];
    }
    
    let normLon = lon;
    let normLat = lat;
    
    if (!this.isNoGeoref) {
      // Safe, loop-free longitude normalization to [-180, 180]
      normLon = lon - 360 * Math.floor((lon + 180) / 360);
      normLat = Math.max(-90, Math.min(90, lat));
    }

    const col = Math.min(this.numCols - 1, Math.max(0, Math.floor((normLon - this.minX) / this.cellSizeX)));
    const row = Math.min(this.numRows - 1, Math.max(0, Math.floor((normLat - this.minY) / this.cellSizeY)));
    
    const cellIdx = row * this.numCols + col;
    return this.grid[cellIdx] || [];
  }
}

// Planar 2D point-in-polygon ray-casting helper for unprojected (no-georef) map coordinate hit testing
function isPointInPolygon2D(point: [number, number], polygon: number[][][]): boolean {
  const [px, py] = point;
  if (polygon.length === 0) return false;
  
  const isInsideRing = (ring: number[][]) => {
    let oddNodes = false;
    let j = ring.length - 1;
    for (let i = 0; i < ring.length; i++) {
      const xi = ring[i][0];
      const yi = ring[i][1];
      const xj = ring[j][0];
      const yj = ring[j][1];
      
      if (((yi < py && yj >= py) || (yj < py && yi >= py)) &&
          (xi + (py - yi) / (yj - yi) * (xj - xi) < px)) {
        oddNodes = !oddNodes;
      }
      j = i;
    }
    return oddNodes;
  };
  
  if (!isInsideRing(polygon[0])) return false;
  
  for (let h = 1; h < polygon.length; h++) {
    if (isInsideRing(polygon[h])) {
      return false; // Point lies in a hole
    }
  }
  
  return true;
}

function isPointInFeature2D(point: [number, number], feature: any): boolean {
  const geom = feature.geometry;
  if (!geom) return false;
  if (geom.type === 'Polygon') {
    return isPointInPolygon2D(point, geom.coordinates);
  } else if (geom.type === 'MultiPolygon') {
    for (let i = 0; i < geom.coordinates.length; i++) {
      if (isPointInPolygon2D(point, geom.coordinates[i])) {
        return true;
      }
    }
    return false;
  }
  return false;
}

const CITY_STATE_CODES = new Set([
  'VAT', 'MCO', 'SGP', 'SMR', 'LIE', 'AND', 'MLT', 'BHR', 'MDV', 'NRU', 'TUV', 'PLW', 'MHL', 
  'KNA', 'VCT', 'BRB', 'GRD', 'ATG', 'DMA', 'LCA', 'SYC', 'MUS', 'COM', 'STP', 'CPV', 'HKG', 'MAC', 'LUX',
  'VA', 'MC', 'SG', 'SM', 'LI', 'AD', 'MT', 'BH', 'MV', 'NR', 'TV', 'PW', 'MH', 'KN', 'VC', 'BB', 'GD',
  'AG', 'DM', 'LC', 'SC', 'MU', 'KM', 'ST', 'CV', 'HK', 'MO', 'LU'
]);

function isCityStateOrMicrostate(feature: CountryFeature): boolean {
  if (!feature || !feature.properties) return false;
  if (isOceanFeature(feature)) return false;

  const iso = getFeatureIsoCode(feature);
  // Major or medium countries must NEVER be treated as microstates/city-states
  const NOT_MICROSTATES = new Set([
    'PHL', 'IDN', 'MYS', 'TWN', 'JPN', 'GBR', 'NZL', 'GRC', 'ITA', 'ESP', 'FRA', 'DEU', 'KOR', 'PRK', 'VNM', 'THA', 'MMR', 'KHM', 'LAO', 'CHN', 'IND', 'USA', 'CAN', 'MEX', 'BRA', 'ARG', 'AUS', 'RUS', 'CUB', 'MDG', 'PNG', 'CHL', 'COL', 'PER', 'VEN', 'PH', 'TW', 'MY', 'ID', 'JP', 'VN', 'TH'
  ]);
  if (NOT_MICROSTATES.has(iso)) return false;

  const p = feature.properties;
  
  const code = String(
    p.adm0_a3 || p.ADM0_A3 || p.iso_a3 || p.ISO_A3 || p.iso_a2 || p.ISO_A2 || p.id || feature.id || ''
  ).toUpperCase().trim();

  const name = String(p.name || p.NAME || p.admin || p.ADMIN || '').toLowerCase();

  if (CITY_STATE_CODES.has(code)) return true;

  if (
    name.includes('vatican') ||
    name.includes('monaco') ||
    name.includes('singapore') ||
    name.includes('san marino') ||
    name.includes('liechtenstein') ||
    name.includes('andorra') ||
    name.includes('malta') ||
    name.includes('bahrain') ||
    name.includes('maldives') ||
    name.includes('hong kong') ||
    name.includes('macau') ||
    name.includes('luxembourg')
  ) {
    return true;
  }

  const geom = feature.geometry as any;
  if (geom && geom.coordinates) {
    let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
    const processCoords = (coords: any[]) => {
      if (typeof coords[0] === 'number') {
        const [lon, lat] = coords;
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      } else {
        coords.forEach(processCoords);
      }
    };
    processCoords(geom.coordinates);
    if (maxLon > minLon && maxLat > minLat) {
      if ((maxLon - minLon < 0.8) && (maxLat - minLat < 0.8)) {
        return true;
      }
    }
  }

  return false;
}

const SMALL_COUNTRY_ISO_CODES = new Set([
  // Microstates & City States
  'VAT', 'MCO', 'SGP', 'SMR', 'LIE', 'AND', 'MLT', 'BHR', 'MDV', 'NRU', 'TUV', 'PLW', 'MHL', 
  'KNA', 'VCT', 'BRB', 'GRD', 'ATG', 'DMA', 'LCA', 'SYC', 'MUS', 'COM', 'STP', 'CPV', 'HKG', 'MAC', 'LUX',
  'VA', 'MC', 'SG', 'SM', 'LI', 'AD', 'MT', 'BH', 'MV', 'NR', 'TV', 'PW', 'MH', 'KN', 'VC', 'BB', 'GD',
  'AG', 'DM', 'LC', 'SC', 'MU', 'KM', 'ST', 'CV', 'HK', 'MO', 'LU',
  // Countries <= Bangladesh / Azerbaijan size (~150,000 km²)
  'BGD', 'NPL', 'TJK', 'GRC', 'NIC', 'PRK', 'MWI', 'ERI', 'BEN', 'HND', 'LBR', 'BGR', 'CUB', 'GTM', 'ISL',
  'KOR', 'HUN', 'PRT', 'JOR', 'SRB', 'AZE', 'AUT', 'ARE', 'CZE', 'PAN', 'SLE', 'IRL', 'GEO', 'LKA', 'LTU',
  'LVA', 'TGO', 'HRV', 'BIH', 'CRI', 'SVK', 'DOM', 'EST', 'DNK', 'NLD', 'CHE', 'BTN', 'TWN', 'MDA', 'BEL',
  'ARM', 'ALB', 'SLB', 'GNQ', 'HTI', 'RWA', 'MKD', 'DJI', 'BLZ', 'SLV', 'ISR', 'SVN', 'FJI', 'KWT', 'SWZ',
  'TLS', 'BHS', 'MNE', 'VUT', 'QAT', 'GMB', 'JAM', 'XKX', 'CYP', 'BRN', 'TTO', 'WSM', 'PSE',
  // 2-letter ISO equivalents
  'BD', 'NP', 'TJ', 'GR', 'NI', 'KP', 'MW', 'ER', 'BJ', 'HN', 'LR', 'BG', 'CU', 'GT', 'IS',
  'KR', 'HU', 'PT', 'JO', 'RS', 'AZ', 'AT', 'AE', 'CZ', 'PA', 'SL', 'IE', 'GE', 'LK', 'LT',
  'LV', 'TG', 'HR', 'BA', 'CR', 'SK', 'DO', 'EE', 'DK', 'NL', 'CH', 'BT', 'TW', 'MD', 'BE',
  'AM', 'AL', 'SB', 'GQ', 'HT', 'RW', 'MK', 'DJ', 'BZ', 'SV', 'IL', 'SI', 'FJ', 'KW', 'SZ',
  'TL', 'BS', 'ME', 'VU', 'QA', 'GM', 'JM', 'XK', 'CY', 'BN', 'TT', 'WS', 'PS'
]);

const MAX_SMALL_COUNTRY_STERADIANS = 0.0042; // ~170,000 km² (up to Bangladesh/Nepal/Greece/Tajikistan size)

function getFeatureSphericalArea(feature: CountryFeature): number {
  try {
    if (!feature || !feature.geometry) return 0;
    const a = d3.geoArea(feature as any);
    if (isNaN(a) || a <= 0) return 0;
    // D3 geoArea returns area on unit sphere (0 to 4*pi steradians)
    // Handle potential inverted winding order
    return Math.min(a, 4 * Math.PI - a);
  } catch (e) {
    return 0;
  }
}

function isSmallCountryOrPolygonForIso(feature: CountryFeature): boolean {
  if (!feature || !feature.properties) return false;
  if (isOceanFeature(feature)) return false;

  if (isCityStateOrMicrostate(feature)) return true;

  // 1. Calculate actual spherical land surface area of the entire shape using D3 spherical geometry
  const areaSteradians = getFeatureSphericalArea(feature);
  if (areaSteradians > 0) {
    if (areaSteradians <= MAX_SMALL_COUNTRY_STERADIANS) {
      return true;
    }
    return false;
  }

  // Fallback if spherical area calculation returns 0
  const p = feature.properties;
  const code = String(
    p.adm0_a3 || p.ADM0_A3 || p.iso_a3 || p.ISO_A3 || p.iso_a2 || p.ISO_A2 || p.id || feature.id || ''
  ).toUpperCase().trim();

  if (SMALL_COUNTRY_ISO_CODES.has(code)) return true;

  const [minLon, minLat, maxLon, maxLat] = getFeatureBBox(feature);
  if (maxLon > minLon && maxLat > minLat) {
    const centerLatRad = ((minLat + maxLat) / 2) * (Math.PI / 180);
    const cosLat = Math.max(0.01, Math.cos(centerLatRad));
    const widthDeg = (maxLon - minLon) * cosLat;
    const heightDeg = maxLat - minLat;
    const degreeArea = widthDeg * heightDeg;

    if (degreeArea <= 25.0) {
      return true;
    }
  }

  return false;
}

function createCircularPolygon(centerLon: number, centerLat: number, radiusDeg: number = 0.4): GeoJSON.Polygon {
  const points: [number, number][] = [];
  const numPoints = 32;
  const latRad = centerLat * (Math.PI / 180);
  const cosLat = Math.max(0.15, Math.cos(latRad));
  
  // Clockwise order for D3 spherical polygon convention (exterior ring area < 2*PI)
  for (let i = 0; i <= numPoints; i++) {
    const angle = -(i % numPoints) * (2 * Math.PI / numPoints);
    const dLon = (radiusDeg * Math.cos(angle)) / cosLat;
    const dLat = radiusDeg * Math.sin(angle);
    points.push([centerLon + dLon, centerLat + dLat]);
  }

  const polygon: GeoJSON.Polygon = {
    type: 'Polygon',
    coordinates: [points]
  };

  try {
    if (d3.geoArea(polygon) > 2 * Math.PI) {
      points.reverse();
    }
  } catch (e) {}

  return polygon;
}

function getFeatureCenter(feature: CountryFeature): [number, number] | null {
  const geom = feature.geometry as any;
  if (!geom || !geom.coordinates) return null;

  if (geom.type === 'Polygon' && geom.coordinates.length > 0) {
    const ring = geom.coordinates[0];
    return computePolygonCenterOfMass(ring);
  } else if (geom.type === 'MultiPolygon' && geom.coordinates.length > 0) {
    let maxArea = -1;
    let bestRing: [number, number][] | null = null;
    
    geom.coordinates.forEach((poly: any) => {
      const ring = poly[0];
      if (ring && ring.length >= 3) {
        let area = 0;
        const refLon = ring[0][0];
        for (let i = 0; i < ring.length - 1; i++) {
          let x1 = ring[i][0] - refLon;
          while (x1 > 180) x1 -= 360;
          while (x1 < -180) x1 += 360;
          let x2 = ring[i+1][0] - refLon;
          while (x2 > 180) x2 -= 360;
          while (x2 < -180) x2 += 360;
          const y1 = ring[i][1];
          const y2 = ring[i+1][1];
          area += (x1 * y2 - x2 * y1);
        }
        area = Math.abs(area) / 2;
        if (area > maxArea) {
          maxArea = area;
          bestRing = ring;
        }
      }
    });
    if (bestRing) return computePolygonCenterOfMass(bestRing);
  }

  try {
    const c = d3.geoCentroid(feature as any);
    if (c && !isNaN(c[0]) && !isNaN(c[1]) && isFinite(c[0]) && isFinite(c[1])) {
      return c;
    }
  } catch (e) {}

  return null;
}

function getCountryCentroid(feature: CountryFeature, cache: Map<string, [number, number]>): [number, number] | null {
  const countryId = getCountryId(feature);
  if (cache.has(countryId)) {
    return cache.get(countryId)!;
  }
  
  try {
    const geom = feature.geometry as any;
    if (geom && geom.coordinates) {
      let ring: [number, number][] | null = null;
      if (geom.type === 'Polygon') {
        ring = geom.coordinates[0];
      } else if (geom.type === 'MultiPolygon' && geom.coordinates.length > 0) {
        let maxPts = 0;
        geom.coordinates.forEach((polyCoords: any) => {
          if (polyCoords && polyCoords[0] && polyCoords[0].length > maxPts) {
            maxPts = polyCoords[0].length;
            ring = polyCoords[0];
          }
        });
      }
      if (ring) {
        const centroid = computePolygonCenterOfMass(ring);
        if (centroid && !isNaN(centroid[0]) && !isNaN(centroid[1])) {
          cache.set(countryId, centroid);
          return centroid;
        }
      }
    }
  } catch (e) {}

  return null;
}

export interface PolygonLabelTarget {
  centroid: [number, number];
  centerOfMass: [number, number];
  angle: number; // in radians, principal orientation of this polygon ring
  ringBBox: [number, number, number, number] | null; // [minLon, minLat, maxLon, maxLat]
  ring: [number, number][];
  area: number;
  isHighlyIrregular: boolean;
}

export interface CountryLabelGeometry {
  centroid: [number, number];
  angle: number; // in radians, principal orientation of the largest polygon ring
  ringBBox: [number, number, number, number] | null; // [minLon, minLat, maxLon, maxLat] of largestRing
  largestRing: [number, number][] | null;
  targets: PolygonLabelTarget[];
  isArchipelago: boolean;
  overallBBox: [number, number, number, number] | null;
}

function isPointInPolygon(pt: [number, number], ring: [number, number][]): boolean {
  if (!ring || ring.length < 3) return true;
  let inside = false;
  const refLon = ring[0][0];

  let x = pt[0] - refLon;
  while (x > 180) x -= 360;
  while (x < -180) x += 360;
  const y = pt[1];

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    let xi = ring[i][0] - refLon;
    while (xi > 180) xi -= 360;
    while (xi < -180) xi += 360;
    const yi = ring[i][1];

    let xj = ring[j][0] - refLon;
    while (xj > 180) xj -= 360;
    while (xj < -180) xj += 360;
    const yj = ring[j][1];

    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function isScreenPointInPolygon(px: number, py: number, projRing: [number, number][]): boolean {
  if (!projRing || projRing.length < 3) return true;
  let inside = false;
  for (let i = 0, j = projRing.length - 1; i < projRing.length; j = i++) {
    const xi = projRing[i][0];
    const yi = projRing[i][1];
    const xj = projRing[j][0];
    const yj = projRing[j][1];

    const intersect = ((yi > py) !== (yj > py)) &&
      (px < (xj - xi) * (py - yi) / (yj - yi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function isTextBoxInsidePolygon(
  cx: number,
  cy: number,
  textWidth: number,
  textHeight: number,
  projRing: [number, number][]
): boolean {
  if (!projRing || projRing.length < 3) return true;
  const hw = textWidth / 2;
  const hh = textHeight / 2;

  // Sample 8 boundary points around the bounding box of the label
  const testPoints: [number, number][] = [
    [cx - hw, cy - hh], // Top-Left
    [cx + hw, cy - hh], // Top-Right
    [cx - hw, cy + hh], // Bottom-Left
    [cx + hw, cy + hh], // Bottom-Right
    [cx - hw, cy],      // Mid-Left
    [cx + hw, cy],      // Mid-Right
    [cx, cy - hh],      // Top-Mid
    [cx, cy + hh],      // Bottom-Mid
  ];

  for (let i = 0; i < testPoints.length; i++) {
    if (!isScreenPointInPolygon(testPoints[i][0], testPoints[i][1], projRing)) {
      return false;
    }
  }
  return true;
}

export function computePolygonCenterOfMass(ring: [number, number][]): [number, number] {
  if (!ring || ring.length < 3) return [0, 0];
  const n = ring.length;
  const refLon = ring[0][0];

  let area = 0;
  let cx = 0;
  let cy = 0;

  for (let i = 0; i < n; i++) {
    const p1 = ring[i];
    const p2 = ring[(i + 1) % n];

    let x1 = p1[0] - refLon;
    while (x1 > 180) x1 -= 360;
    while (x1 < -180) x1 += 360;

    let x2 = p2[0] - refLon;
    while (x2 > 180) x2 -= 360;
    while (x2 < -180) x2 += 360;

    const y1 = p1[1];
    const y2 = p2[1];

    const cross = (x1 * y2 - x2 * y1);
    area += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }

  area = area / 2;

  let centroidLon = 0;
  let centroidLat = 0;

  if (Math.abs(area) < 1e-9) {
    let sumX = 0, sumY = 0;
    ring.forEach(p => {
      let x = p[0] - refLon;
      while (x > 180) x -= 360;
      while (x < -180) x += 360;
      sumX += x;
      sumY += p[1];
    });
    centroidLon = refLon + sumX / n;
    centroidLat = sumY / n;
  } else {
    cx = cx / (6 * area);
    cy = cy / (6 * area);
    centroidLon = refLon + cx;
    centroidLat = cy;
  }

  while (centroidLon > 180) centroidLon -= 360;
  while (centroidLon < -180) centroidLon += 360;

  const res: [number, number] = [centroidLon, centroidLat];

  // If the computed center of mass is outside the polygon, adjust towards average interior point
  if (!isPointInPolygon(res, ring)) {
    let sumX = 0, sumY = 0;
    ring.forEach(p => {
      let x = p[0] - refLon;
      while (x > 180) x -= 360;
      while (x < -180) x += 360;
      sumX += x;
      sumY += p[1];
    });
    const avgPoint: [number, number] = [refLon + sumX / n, sumY / n];

    for (let t = 0.1; t <= 1.0; t += 0.1) {
      let candidateLon = centroidLon + (avgPoint[0] - centroidLon) * t;
      let candidateLat = centroidLat + (avgPoint[1] - centroidLat) * t;
      if (isPointInPolygon([candidateLon, candidateLat], ring)) {
        return [candidateLon, candidateLat];
      }
    }
  }

  return res;
}

interface FeatureDebugGeometryMetrics {
  totalPolygons: number;
  totalApparentArea: number;
  avgDistanceBetweenSubPolygons: number | null;
  avgSizeDifferencePct: number;
}

function minDistanceBetweenRings(ringA: [number, number][], ringB: [number, number][]): number {
  if (!ringA || !ringB || ringA.length < 2 || ringB.length < 2) return 0;

  // Downsample rings if they have too many points to keep hover calculation performant
  const stepA = Math.max(1, Math.floor(ringA.length / 80));
  const stepB = Math.max(1, Math.floor(ringB.length / 80));

  const ptsA: [number, number][] = [];
  for (let i = 0; i < ringA.length; i += stepA) {
    ptsA.push(ringA[i]);
  }
  const ptsB: [number, number][] = [];
  for (let i = 0; i < ringB.length; i += stepB) {
    ptsB.push(ringB[i]);
  }

  let minDistSq = Infinity;

  // Check vertices of A against edge segments of B
  const lenB = ptsB.length;
  for (let i = 0; i < ptsA.length; i++) {
    const [px, py] = ptsA[i];
    for (let j = 0; j < lenB; j++) {
      const [ax, ay] = ptsB[j];
      const [bx, by] = ptsB[(j + 1) % lenB];
      const dSq = pointToSegmentDistSq(px, py, ax, ay, bx, by);
      if (dSq < minDistSq) {
        minDistSq = dSq;
        if (minDistSq === 0) return 0;
      }
    }
  }

  // Check vertices of B against edge segments of A
  const lenA = ptsA.length;
  for (let j = 0; j < ptsB.length; j++) {
    const [px, py] = ptsB[j];
    for (let i = 0; i < lenA; i++) {
      const [ax, ay] = ptsA[i];
      const [bx, by] = ptsA[(i + 1) % lenA];
      const dSq = pointToSegmentDistSq(px, py, ax, ay, bx, by);
      if (dSq < minDistSq) {
        minDistSq = dSq;
        if (minDistSq === 0) return 0;
      }
    }
  }

  return Math.sqrt(minDistSq);
}

function calculateFeatureDebugMetrics(
  feature: CountryFeature,
  projection: any,
  currentZoom: number
): FeatureDebugGeometryMetrics {
  const geom = feature.geometry as any;
  if (!geom) {
    return {
      totalPolygons: 0,
      totalApparentArea: 0,
      avgDistanceBetweenSubPolygons: null,
      avgSizeDifferencePct: 0,
    };
  }

  const rings: [number, number][][] = [];
  const processGeom = (g: any) => {
    if (!g) return;
    if (g.type === 'Polygon') {
      if (g.coordinates && g.coordinates[0]) {
        rings.push(g.coordinates[0] as [number, number][]);
      }
    } else if (g.type === 'MultiPolygon') {
      if (g.coordinates) {
        g.coordinates.forEach((poly: any) => {
          if (poly && poly[0]) {
            rings.push(poly[0] as [number, number][]);
          }
        });
      }
    } else if (g.type === 'GeometryCollection' && g.geometries) {
      g.geometries.forEach((subG: any) => processGeom(subG));
    }
  };

  processGeom(geom);

  const subPolygonAreas: number[] = [];
  const projRings: [number, number][][] = [];
  let totalApparentArea = 0;

  rings.forEach((ring) => {
    if (!ring || ring.length < 3) return;
    
    // Convert ring points to projected points in base map projection coordinates
    const projPoints: [number, number][] = [];
    for (let i = 0; i < ring.length; i++) {
      const p = projection(ring[i]);
      if (p && !isNaN(p[0]) && !isNaN(p[1])) {
        projPoints.push([p[0], p[1]]);
      }
    }

    if (projPoints.length >= 3) {
      // Shoelace formula for apparent area in screen pixels
      let area = 0;
      for (let i = 0; i < projPoints.length; i++) {
        const [x1, y1] = projPoints[i];
        const [x2, y2] = projPoints[(i + 1) % projPoints.length];
        area += (x1 * y2 - x2 * y1);
      }
      const apparentArea = Math.abs(area) / 2;
      subPolygonAreas.push(apparentArea);
      totalApparentArea += apparentArea;
      projRings.push(projPoints);
    }
  });

  const totalPolygons = subPolygonAreas.length;
  let avgSizeDifferencePct = 0;

  if (totalPolygons > 1) {
    let totalDiff = 0;
    let pairCount = 0;
    const maxSample = Math.min(subPolygonAreas.length, 6);
    for (let i = 0; i < maxSample; i++) {
      for (let j = i + 1; j < maxSample; j++) {
        const a1 = subPolygonAreas[i];
        const a2 = subPolygonAreas[j];
        const minA = Math.min(a1, a2);
        if (minA > 0) {
          totalDiff += (Math.abs(a1 - a2) / minA) * 100;
        } else if (Math.max(a1, a2) > 0) {
          totalDiff += 100;
        }
        pairCount++;
      }
    }
    if (pairCount > 0) {
      avgSizeDifferencePct = totalDiff / pairCount;
    }
  }

  let avgDistanceBetweenSubPolygons: number | null = null;

  if (totalPolygons > 2 && projRings.length > 2) {
    let totalDist = 0;
    let pairCount = 0;
    const maxRings = Math.min(projRings.length, 4);
    for (let i = 0; i < maxRings; i++) {
      for (let j = i + 1; j < maxRings; j++) {
        const edgeDist = minDistanceBetweenRings(projRings[i], projRings[j]);
        totalDist += edgeDist;
        pairCount++;
      }
    }
    if (pairCount > 0) {
      avgDistanceBetweenSubPolygons = totalDist / pairCount;
    }
  }

  return {
    totalPolygons,
    totalApparentArea,
    avgDistanceBetweenSubPolygons,
    avgSizeDifferencePct,
  };
}

function pointToSegmentDistSq(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) {
    const x = px - ax;
    const y = py - ay;
    return x * x + y * y;
  }
  const t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
  const tClamped = Math.max(0, Math.min(1, t));
  const nearestX = ax + tClamped * dx;
  const nearestY = ay + tClamped * dy;
  const rx = px - nearestX;
  const ry = py - nearestY;
  return rx * rx + ry * ry;
}

function getPointToRingDistance(pt: [number, number], ring: [number, number][], refLon: number): number {
  let px = pt[0] - refLon;
  while (px > 180) px -= 360;
  while (px < -180) px += 360;
  const py = pt[1];

  const cosLat = Math.max(0.1, Math.cos(py * Math.PI / 180));
  px *= cosLat;

  let minDistSq = Infinity;
  const n = ring.length;
  for (let i = 0; i < n - 1; i++) {
    let ax = ring[i][0] - refLon;
    while (ax > 180) ax -= 360;
    while (ax < -180) ax += 360;
    const ay = ring[i][1];

    let bx = ring[i + 1][0] - refLon;
    while (bx > 180) bx -= 360;
    while (bx < -180) bx += 360;
    const by = ring[i + 1][1];

    const dSq = pointToSegmentDistSq(px, py, ax * cosLat, ay, bx * cosLat, by);
    if (dSq < minDistSq) {
      minDistSq = dSq;
    }
  }
  return Math.sqrt(minDistSq);
}

export function evaluateHitboxAccessibility(
  pt: [number, number],
  ring: [number, number][],
  refLon: number,
  aspect: number = 3.5
): number {
  if (!ring || ring.length < 3) return -1;
  if (!isPointInPolygon(pt, ring)) return -1;
  const centerDist = getPointToRingDistance(pt, ring, refLon);
  if (centerDist <= 0) return -1;

  const cosLat = Math.max(0.2, Math.cos((pt[1] * Math.PI) / 180));
  let low = 0;
  let high = centerDist;

  // Test if a label hitbox of height 2*s and width 2*s*aspect/cosLat centered at pt fits inside the polygon
  for (let iter = 0; iter < 6; iter++) {
    const s = (low + high) / 2;
    const halfW = (s * aspect) / cosLat;
    const halfH = s;
    const testPts: [number, number][] = [
      [pt[0] - halfW, pt[1] - halfH],
      [pt[0] + halfW, pt[1] - halfH],
      [pt[0] + halfW, pt[1] + halfH],
      [pt[0] - halfW, pt[1] + halfH],
      [pt[0] - halfW, pt[1]],
      [pt[0] + halfW, pt[1]],
      [pt[0], pt[1] - halfH],
      [pt[0], pt[1] + halfH],
    ];
    let inside = true;
    for (let i = 0; i < testPts.length; i++) {
      if (!isPointInPolygon(testPts[i], ring)) {
        inside = false;
        break;
      }
    }
    if (inside) low = s;
    else high = s;
  }

  // Weighted score prioritizing the maximum fitting hitbox size with center clearance
  return low * 0.85 + centerDist * 0.15;
}

function computePolygonPoleOfInaccessibility(ring: [number, number][], hitboxAspect: number = 3.5): [number, number] {
  if (!ring || ring.length < 3) return [0, 0];

  const n = ring.length;
  const refLon = ring[0][0];

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (let i = 0; i < n; i++) {
    let x = ring[i][0] - refLon;
    while (x > 180) x -= 360;
    while (x < -180) x += 360;
    const y = ring[i][1];

    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  // 1. Center of mass as initial candidate
  const centroid = computePolygonCenterOfMass(ring);
  let bestPt = centroid;
  let bestScore = evaluateHitboxAccessibility(centroid, ring, refLon, hitboxAspect);

  // 2. Coarse grid search across bounding box
  const width = maxX - minX;
  const height = maxY - minY;
  let cellSize = Math.max(width, height) / 24;

  let found = bestScore > 0;
  for (let attempts = 0; attempts < 3; attempts++) {
    if (cellSize > 1e-5) {
      for (let x = minX + cellSize / 2; x <= maxX; x += cellSize) {
        for (let y = minY + cellSize / 2; y <= maxY; y += cellSize) {
          let candidateLon = refLon + x;
          while (candidateLon > 180) candidateLon -= 360;
          while (candidateLon < -180) candidateLon += 360;
          const candidatePt: [number, number] = [candidateLon, y];

          const score = evaluateHitboxAccessibility(candidatePt, ring, refLon, hitboxAspect);
          if (score > bestScore) {
            bestScore = score;
            bestPt = candidatePt;
            found = true;
          }
        }
      }
    }
    if (found) break;
    cellSize /= 3; // Make grid 3x denser if we haven't found any point inside yet
  }

  // 3. Medium pass around best candidate
  if (bestScore > 0) {
      const medStep = cellSize / 3;
      let bX = bestPt[0] - refLon;
      while (bX > 180) bX -= 360;
      while (bX < -180) bX += 360;
      const bY = bestPt[1];

      for (let dx = -cellSize; dx <= cellSize; dx += medStep) {
        for (let dy = -cellSize; dy <= cellSize; dy += medStep) {
          let candidateLon = refLon + bX + dx;
          while (candidateLon > 180) candidateLon -= 360;
          while (candidateLon < -180) candidateLon += 360;
          const candidatePt: [number, number] = [candidateLon, bY + dy];

          const score = evaluateHitboxAccessibility(candidatePt, ring, refLon, hitboxAspect);
          if (score > bestScore) {
            bestScore = score;
            bestPt = candidatePt;
          }
        }
      }

      // 4. Fine pass around best candidate
      const fineStep = medStep / 3;
      bX = bestPt[0] - refLon;
      while (bX > 180) bX -= 360;
      while (bX < -180) bX += 360;
      const fY = bestPt[1];

      for (let dx = -medStep; dx <= medStep; dx += fineStep) {
        for (let dy = -medStep; dy <= medStep; dy += fineStep) {
          let candidateLon = refLon + bX + dx;
          while (candidateLon > 180) candidateLon -= 360;
          while (candidateLon < -180) candidateLon += 360;
          const candidatePt: [number, number] = [candidateLon, fY + dy];

          const score = evaluateHitboxAccessibility(candidatePt, ring, refLon, hitboxAspect);
          if (score > bestScore) {
            bestScore = score;
            bestPt = candidatePt;
          }
        }
      }
    }

  return bestPt;
}

function computePolygonLabelTarget(
  polyCoords: any,
  hitboxAspect: number = 3.5
): PolygonLabelTarget | null {
  if (!polyCoords || !polyCoords[0] || polyCoords[0].length < 3) return null;
  const ring: [number, number][] = polyCoords[0];
  const polyGeo = { type: 'Polygon', coordinates: polyCoords };

  let area = 0;
  try {
    area = d3.geoArea(polyGeo as any);
  } catch (e) {
    area = 0;
  }
  if (isNaN(area) || area <= 0) {
    area = 1e-12;
  }

  const refLon = ring[0][0];

  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  ring.forEach(p => {
    if (p[0] < minLon) minLon = p[0];
    if (p[0] > maxLon) maxLon = p[0];
    if (p[1] < minLat) minLat = p[1];
    if (p[1] > maxLat) maxLat = p[1];
  });

  const ringBBox: [number, number, number, number] | null = (minLon !== Infinity)
    ? [minLon, minLat, maxLon, maxLat]
    : null;

  // 1. Calculate standard geometric center of mass (centroid)
  const rawCentroid = computePolygonCenterOfMass(ring);

  // 2. Check if centroid is inside the polygon and evaluate its hitbox accessibility
  const isCentroidInside = isPointInPolygon(rawCentroid, ring);
  const centroidScore = isCentroidInside ? evaluateHitboxAccessibility(rawCentroid, ring, refLon, hitboxAspect) : -1;

  let labelPoint = rawCentroid;
  let isHighlyIrregular = false;

  // Truly massive continental convex landmasses (e.g. Russia, USA, Brazil, Canada, Australia, China, India, etc.)
  // with area >= 0.05 strictly center on their geographic centroid unless their centroid falls outside.
  const isMassiveContinentalCountry = area >= 0.05;

  if (!isCentroidInside || centroidScore <= 0) {
    // If centroid is outside (e.g. C-shaped/L-shaped/crescent/curved polygon like Mali, Vietnam, Croatia, Norway, Gambia),
    // use pole of inaccessibility to find an interior point in the widest open area.
    labelPoint = computePolygonPoleOfInaccessibility(ring, hitboxAspect);
    isHighlyIrregular = true;
  } else if (isMassiveContinentalCountry) {
    // Massive continental countries strictly use their natural geographic center of mass
    labelPoint = rawCentroid;
    isHighlyIrregular = false;
  } else {
    // For smaller, narrow, or irregular shapes (like Italy, Norway, Chile, etc.),
    // calculate the zone of accessibility considering the name's hitbox clearance
    const polePt = computePolygonPoleOfInaccessibility(ring, hitboxAspect);
    const poleScore = evaluateHitboxAccessibility(polePt, ring, refLon, hitboxAspect);

    const ratio = poleScore / Math.max(1e-4, centroidScore);
    const shift = Math.hypot(polePt[0] - rawCentroid[0], polePt[1] - rawCentroid[1]);
    const maxDim = Math.max(maxLon - minLon, maxLat - minLat);
    const relShift = shift / Math.max(1e-4, maxDim);

    // If pole offers significantly better hitbox clearance (e.g. Italy where North provides the zone of accessibility,
    // or narrow corridor/boot shapes where centroid is pinched), place at the zone of accessibility
    if ((ratio > 1.35 && relShift > 0.08) || (ratio > 1.8) || (centroidScore < 0.12 && poleScore > 0.25)) {
      labelPoint = polePt;
      isHighlyIrregular = true;
    } else {
      labelPoint = rawCentroid;
      isHighlyIrregular = false;
    }
  }

  const centroid = labelPoint;

  return {
    centroid,
    centerOfMass: rawCentroid,
    angle: 0, // Strictly horizontal
    ringBBox,
    ring,
    area,
    isHighlyIrregular
  };
}

function findMaxHorizontalFreeSpacePlacement(
  ring: [number, number][],
  projection: any,
  defaultCenterProj: [number, number]
): { bestPoint: [number, number]; maxTextW: number; maxTextH: number } {
  if (!ring || ring.length < 3) {
    return { bestPoint: defaultCenterProj, maxTextW: 60, maxTextH: 30 };
  }

  const len = ring.length;
  const step = Math.max(1, Math.floor(len / 150));
  const projPoints: [number, number][] = [];
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (let i = 0; i < len; i += step) {
    const p = projection(ring[i]);
    if (p && !isNaN(p[0]) && !isNaN(p[1])) {
      projPoints.push(p);
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    }
  }

  if (projPoints.length < 3 || maxX <= minX || maxY <= minY) {
    return { bestPoint: defaultCenterProj, maxTextW: 60, maxTextH: 30 };
  }

  const n = projPoints.length;
  const polyWidth = maxX - minX;
  const polyHeight = maxY - minY;
  const numScanlines = 45;

  let bestScore = -1;
  let bestPoint: [number, number] = defaultCenterProj;
  let bestW = polyWidth * 0.8;
  let bestH = polyHeight * 0.5;

  for (let s = 1; s < numScanlines; s++) {
    const yScan = minY + (s / numScanlines) * polyHeight;

    const xIntersects: number[] = [];
    for (let i = 0; i < n; i++) {
      const [x1, y1] = projPoints[i];
      const [x2, y2] = projPoints[(i + 1) % n];

      if ((y1 <= yScan && y2 > yScan) || (y2 <= yScan && y1 > yScan)) {
        const t = (yScan - y1) / (y2 - y1 + 1e-12);
        const xInt = x1 + t * (x2 - x1);
        xIntersects.push(xInt);
      }
    }

    xIntersects.sort((a, b) => a - b);

    for (let k = 0; k < xIntersects.length - 1; k += 2) {
      const xStart = xIntersects[k];
      const xEnd = xIntersects[k + 1];
      const sliceWidth = xEnd - xStart;

      if (sliceWidth <= 0) continue;

      const xCandidates = [
        xStart + sliceWidth * 0.5,
        xStart + sliceWidth * 0.35,
        xStart + sliceWidth * 0.65,
        xStart + sliceWidth * 0.25,
        xStart + sliceWidth * 0.75,
      ];

      for (const cx of xCandidates) {
        const leftClearance = cx - xStart;
        const rightClearance = xEnd - cx;
        const availW = 2 * Math.min(leftClearance, rightClearance);

        // Find exact vertical interval on line x = cx containing yScan
        const yIntersects: number[] = [];
        for (let i = 0; i < n; i++) {
          const [x1, y1] = projPoints[i];
          const [x2, y2] = projPoints[(i + 1) % n];

          if ((x1 <= cx && x2 > cx) || (x2 <= cx && x1 > cx)) {
            const t = (cx - x1) / (x2 - x1 + 1e-12);
            const yInt = y1 + t * (y2 - y1);
            yIntersects.push(yInt);
          }
        }

        yIntersects.sort((a, b) => a - b);

        let availH = 0;
        for (let m = 0; m < yIntersects.length - 1; m += 2) {
          const yStart = yIntersects[m];
          const yEnd = yIntersects[m + 1];
          if (yScan >= yStart && yScan <= yEnd) {
            const topClearance = yScan - yStart;
            const bottomClearance = yEnd - yScan;
            availH = 2 * Math.min(topClearance, bottomClearance);
            break;
          }
        }

        if (availW <= 0 || availH <= 0) continue;

        // Space score is the area of the centered inscribed box
        const score = availW * availH;

        if (score > bestScore) {
          bestScore = score;
          bestPoint = [cx, yScan];
          bestW = availW;
          bestH = availH;
        }
      }
    }
  }

  return {
    bestPoint,
    maxTextW: Math.max(0.1, bestW * 0.85),
    maxTextH: Math.max(0.1, bestH * 0.80),
  };
}

function getScreenPolygonSpanAtPoint(
  ring: [number, number][],
  projection: any,
  screenCenter: [number, number]
): { maxTextW: number; maxTextH: number } {
  if (!ring || ring.length < 3) {
    return { maxTextW: 0, maxTextH: 0 };
  }

  const [cx, cy] = screenCenter;

  const len = ring.length;
  const step = Math.max(1, Math.floor(len / 32));
  const projPoints: [number, number][] = [];
  for (let i = 0; i < len; i += step) {
    const p = projection(ring[i]);
    if (p && !isNaN(p[0]) && !isNaN(p[1])) {
      projPoints.push(p);
    }
  }

  if (projPoints.length < 3) {
    return { maxTextW: 0, maxTextH: 0 };
  }

  let leftDist = Infinity;
  let rightDist = Infinity;
  let topDist = Infinity;
  let bottomDist = Infinity;

  const n = projPoints.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = projPoints[i];
    const [x2, y2] = projPoints[(i + 1) % n];

    // Horizontal ray slicing at y = cy
    if ((y1 <= cy && y2 > cy) || (y2 <= cy && y1 > cy)) {
      const t = (cy - y1) / (y2 - y1 + 1e-12);
      const xIntersect = x1 + t * (x2 - x1);
      if (xIntersect <= cx) {
        const d = cx - xIntersect;
        if (d < leftDist) leftDist = d;
      }
      if (xIntersect >= cx) {
        const d = xIntersect - cx;
        if (d < rightDist) rightDist = d;
      }
    }

    // Vertical ray slicing at x = cx
    if ((x1 <= cx && x2 > cx) || (x2 <= cx && x1 > cx)) {
      const t = (cx - x1) / (x2 - x1 + 1e-12);
      const yIntersect = y1 + t * (y2 - y1);
      if (yIntersect <= cy) {
        const d = cy - yIntersect;
        if (d < topDist) topDist = d;
      }
      if (yIntersect >= cy) {
        const d = yIntersect - cy;
        if (d < bottomDist) bottomDist = d;
      }
    }
  }

  if (leftDist === Infinity || rightDist === Infinity || topDist === Infinity || bottomDist === Infinity) {
    let minDistSq = Infinity;
    for (let i = 0; i < n; i++) {
      const [x1, y1] = projPoints[i];
      const [x2, y2] = projPoints[(i + 1) % n];
      const dSq = pointToSegmentDistSq(cx, cy, x1, y1, x2, y2);
      if (dSq < minDistSq) minDistSq = dSq;
    }
    const r = Math.sqrt(minDistSq);
    return {
      maxTextW: r * 2.5,
      maxTextH: r * 1.5,
    };
  }

  return {
    maxTextW: 2 * Math.min(leftDist, rightDist) * 0.85,
    maxTextH: 2 * Math.min(topDist, bottomDist) * 0.80,
  };
}

export function computeHorizontalFitInsidePolygon(
  screenRing: [number, number][],
  cx: number,
  cy: number,
  screenBBox: [number, number, number, number]
): { availW: number; availH: number; adjustedX: number; adjustedY: number } {
  const bbW = Math.max(0.1, screenBBox[2] - screenBBox[0]);
  const bbH = Math.max(0.1, screenBBox[3] - screenBBox[1]);

  let adjX = cx;
  let adjY = cy;

  if (!screenRing || screenRing.length < 3) {
    return { availW: bbW * 0.85, availH: bbH * 0.70, adjustedX: cx, adjustedY: cy };
  }

  // 1. Find horizontal chord at Y = cy inside the polygon
  const xIntersects: number[] = [];
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

  let snappedToDifferentChord = false;

  // If cx was somehow slightly outside (e.g. concave floating point drift), find the closest chord
  if (!foundChord && xIntersects.length >= 2) {
    let bestDist = Infinity;
    for (let i = 0; i < xIntersects.length - 1; i += 2) {
      const left = xIntersects[i];
      const right = xIntersects[i + 1];
      const mid = (left + right) / 2;
      const d = Math.abs(mid - cx);
      if (d < bestDist) {
        bestDist = d;
        chordLeft = left;
        chordRight = right;
        foundChord = true;
        snappedToDifferentChord = true;
      }
    }
  }

  if (foundChord) {
    const chordMid = (chordLeft + chordRight) / 2;
    if (snappedToDifferentChord) {
      adjX = chordMid;
    } else {
      // Gently nudge text center towards the chord midpoint (up to 40%) so text centers well
      adjX = cx + (chordMid - cx) * 0.40;
    }
  }

  // Available centered width: distance to closest boundary * 2
  const leftDist = Math.max(0.05, adjX - chordLeft);
  const rightDist = Math.max(0.05, chordRight - adjX);
  
  // For highly slanted/irregular countries (e.g. Norway, Chile), the strict horizontal chord 
  // might be artificially small. We guarantee at least 35% of the bounding box width.
  const centeredMaxW = Math.max(2 * Math.min(leftDist, rightDist), bbW * 0.35);

  // 2. Find vertical chord at X = adjX inside the polygon
  const yIntersects: number[] = [];
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
  let foundYChord = false;
  
  yIntersects.sort((a, b) => a - b);
  for (let i = 0; i < yIntersects.length - 1; i += 2) {
    const top = yIntersects[i];
    const bottom = yIntersects[i + 1];
    if (cy >= top - 0.5 && cy <= bottom + 0.5) {
      chordTop = top;
      chordBottom = bottom;
      foundYChord = true;
      break;
    }
  }

  let snappedY = false;

  if (!foundYChord && yIntersects.length >= 2) {
    let bestDist = Infinity;
    for (let i = 0; i < yIntersects.length - 1; i += 2) {
      const top = yIntersects[i];
      const bottom = yIntersects[i + 1];
      const mid = (top + bottom) / 2;
      const d = Math.abs(mid - cy);
      if (d < bestDist) {
        bestDist = d;
        chordTop = top;
        chordBottom = bottom;
        foundYChord = true;
        snappedY = true;
      }
    }
  }

  if (foundYChord) {
    const chordMid = (chordTop + chordBottom) / 2;
    if (snappedY) {
      adjY = chordMid;
    } else {
      adjY = cy + (chordMid - cy) * 0.40;
    }
  }

  const topDist = Math.max(0.05, adjY - chordTop);
  const bottomDist = Math.max(0.05, chordBottom - adjY);
  const centeredMaxH = Math.max(2 * Math.min(topDist, bottomDist), bbH * 0.35);

  const availW = Math.max(0.1, Math.min(bbW * 0.88, centeredMaxW * 0.88));
  const availH = Math.max(0.1, Math.min(bbH * 0.85, centeredMaxH * 0.85));

  return { availW, availH, adjustedX: adjX, adjustedY: adjY };
}

function computePolygonScreenOrientationAndSpan(
  ring: [number, number][],
  projection: any,
  screenCenter: [number, number],
  _archipelagoBBox?: [number, number, number, number] | null,
  _explicitGeoAngle?: number
): { angle: number; span: number } {
  if (!ring || ring.length < 2) {
    return { angle: 0, span: 0 };
  }

  let minX = Infinity, maxX = -Infinity;
  const step = Math.max(1, Math.floor(ring.length / 40));
  for (let i = 0; i < ring.length; i += step) {
    const pt = ring[i];
    let px = pt[0];
    if (Math.abs(pt[0]) <= 180 && Math.abs(pt[1]) <= 90 && projection) {
      const p = projection(pt);
      if (p && !isNaN(p[0])) px = p[0];
    }
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
  }

  const span = (maxX !== -Infinity && minX !== Infinity) ? (maxX - minX) : 0;
  return { angle: 0, span };
}

export function computePolygonCurvature(
  _ring: [number, number][],
  _projection: d3.GeoProjection,
  _center: [number, number],
  _angle: number,
  _totalWidth: number,
  _fontPx: number,
  _isoCode?: string
): number {
  return 0; // Scrap dynamic curved text - strictly horizontal
}

export function getCountryLabelGeometry(
  feature: CountryFeature,
  cache: Map<string, CountryLabelGeometry>
): CountryLabelGeometry {
  const countryId = getCountryId(feature);
  if (cache.has(countryId)) {
    return cache.get(countryId)!;
  }

  const geom = feature.geometry as any;
  if (!geom || !geom.coordinates) {
    const emptyTarget: PolygonLabelTarget = { centroid: [0, 0], centerOfMass: [0, 0], angle: 0, ringBBox: null, ring: [], area: 0, isHighlyIrregular: false };
    const res: CountryLabelGeometry = { centroid: [0, 0], angle: 0, ringBBox: null, largestRing: null, targets: [emptyTarget], isArchipelago: false, overallBBox: null };
    cache.set(countryId, res);
    return res;
  }

  const candidates: PolygonLabelTarget[] = [];
  const name = getFeatureName(feature) || '';
  const hitboxAspect = Math.max(2.5, Math.min(6.0, (name.length || 4) * 0.65));

  if (geom.type === 'Polygon') {
    const t = computePolygonLabelTarget(geom.coordinates, hitboxAspect);
    if (t) candidates.push(t);
  } else if (geom.type === 'MultiPolygon') {
    geom.coordinates.forEach((polyCoords: any) => {
      const t = computePolygonLabelTarget(polyCoords, hitboxAspect);
      if (t) candidates.push(t);
    });
  }

  if (candidates.length === 0) {
    const emptyTarget: PolygonLabelTarget = { centroid: [0, 0], centerOfMass: [0, 0], angle: 0, ringBBox: null, ring: [], area: 0, isHighlyIrregular: false };
    const res: CountryLabelGeometry = { centroid: [0, 0], angle: 0, ringBBox: null, largestRing: null, targets: [emptyTarget], isArchipelago: false, overallBBox: null };
    cache.set(countryId, res);
    return res;
  }

  // Sort candidates by area descending
  candidates.sort((a, b) => b.area - a.area);

  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  candidates.forEach(c => {
    if (c.ringBBox) {
      if (c.ringBBox[0] < minLon) minLon = c.ringBBox[0];
      if (c.ringBBox[1] < minLat) minLat = c.ringBBox[1];
      if (c.ringBBox[2] > maxLon) maxLon = c.ringBBox[2];
      if (c.ringBBox[3] > maxLat) maxLat = c.ringBBox[3];
    }
  });

  const overallBBox: [number, number, number, number] | null = (minLon !== Infinity)
    ? [minLon, minLat, maxLon, maxLat]
    : null;

  const primary = candidates[0];
  const mainCenter = primary.centroid || primary.centerOfMass || [0, 0];

  const validTargets = candidates.filter(c => c && c.ring && c.ring.length >= 3 && c.area > 1e-11);
  const targets = validTargets.length > 0 ? validTargets : [primary];

  const totalArea = candidates.reduce((sum, c) => sum + (c.area || 0), 0);
  const primaryArea = primary.area || 0;
  const isArchipelago = candidates.length >= 2 && (
    (candidates.length >= 3 && primaryArea / Math.max(1e-12, totalArea) < 0.75) ||
    (candidates.length === 2 && primaryArea / Math.max(1e-12, totalArea) < 0.60)
  );

  const res: CountryLabelGeometry = {
    centroid: mainCenter,
    angle: 0, // Strictly horizontal
    ringBBox: primary.ringBBox,
    largestRing: primary.ring || [],
    targets,
    isArchipelago,
    overallBBox
  };

  cache.set(countryId, res);
  return res;
}

function getRotatedRingBounds(
  ring: [number, number][],
  projection: any,
  centroid: [number, number],
  angleRad: number
): { uSpan: number; vSpan: number } {
  if (!ring || ring.length < 3) return { uSpan: 60, vSpan: 30 };

  const centerProj = projection(centroid);
  if (!centerProj) return { uSpan: 60, vSpan: 30 };
  const [cx, cy] = centerProj;

  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);

  let minU = Infinity, maxU = -Infinity;
  let minV = Infinity, maxV = -Infinity;

  const step = Math.max(1, Math.floor(ring.length / 50));

  for (let i = 0; i < ring.length; i += step) {
    const pt = projection(ring[i]);
    if (pt) {
      const dx = pt[0] - cx;
      const dy = pt[1] - cy;
      const u = dx * cosA + dy * sinA;
      const v = -dx * sinA + dy * cosA;

      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
  }

  if (minU === Infinity) return { uSpan: 60, vSpan: 30 };

  return {
    uSpan: Math.max(10, maxU - minU),
    vSpan: Math.max(6, maxV - minV)
  };
}

interface CentroidTrig {
  lonRad: number;
  latRad: number;
  sin_lat: number;
  cos_lat: number;
  lon: number;
  lat: number;
}

function getCentroidTrig(
  feature: CountryFeature,
  cache: Map<string, CentroidTrig>,
  centroidCache: Map<string, [number, number]>
): CentroidTrig | null {
  const countryId = getCountryId(feature);
  const cached = cache.get(countryId);
  if (cached) return cached;

  const centroid = getCountryCentroid(feature, centroidCache);
  if (!centroid) return null;

  const [lon, lat] = centroid;
  const lonRad = (lon * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;
  const result: CentroidTrig = {
    lonRad,
    latRad,
    sin_lat: Math.sin(latRad),
    cos_lat: Math.cos(latRad),
    lon,
    lat,
  };
  cache.set(countryId, result);
  return result;
}

const geoRadiusCache = new Map<string, number>();

function getFeatureGeoRadius(feature: CountryFeature, trig: CentroidTrig, isNoGeoref?: boolean): number {
  const countryId = getCountryId(feature);
  const cached = geoRadiusCache.get(countryId);
  if (cached !== undefined) return cached;

  let maxDistSq = 0;
  const cLon = trig.lon;
  const cLat = trig.lat;

  const traverse = (coords: any) => {
    if (Array.isArray(coords) && typeof coords[0] === 'number') {
      const lon = coords[0];
      const lat = coords[1];
      let dLon = Math.abs(lon - cLon);
      if (!isNoGeoref && dLon > 180) dLon = 360 - dLon;
      const dLat = lat - cLat;
      const distSq = dLon * dLon + dLat * dLat;
      if (distSq > maxDistSq) {
        maxDistSq = distSq;
      }
    } else if (Array.isArray(coords)) {
      for (let i = 0; i < coords.length; i++) {
        traverse(coords[i]);
      }
    }
  };

  const geom = feature.geometry as any;
  if (geom && geom.coordinates) {
    traverse(geom.coordinates);
  }

  const radius = Math.sqrt(maxDistSq);
  geoRadiusCache.set(countryId, radius);
  return radius;
}

export function formatPopShort(n: number): string {
  if (n >= 1000000000) {
    const v = n / 1000000000;
    return v >= 10 || Number.isInteger(v) ? `${Math.round(v)}B` : `${+v.toFixed(1)}B`;
  }
  if (n >= 1000000) {
    const v = n / 1000000;
    return v >= 10 || Number.isInteger(v) ? `${Math.round(v)}M` : `${+v.toFixed(1)}M`;
  }
  if (n >= 1000) {
    const v = n / 1000;
    return v >= 10 || Number.isInteger(v) ? `${Math.round(v)}K` : `${+v.toFixed(1)}K`;
  }
  return n.toLocaleString();
}

export function snapPopThreshold(val: number): number {
  if (val >= 45000 && val <= 65000) return 50000;
  if (val >= 90000 && val <= 130000) return 100000;
  if (val >= 900000 && val <= 1300000) return 1000000;
  if (val >= 9000000 && val <= 13000000) return 10000000;
  return val;
}

export interface LegendRowItem {
  kind: 'color' | 'locationGroup';
  color: string;
  text: string;
  shape?: string;
  size?: number;
}

export function buildLocationLegendRows(
  importedLocations: MapLocation[],
  admin0Size = 8,
  admin1Size = 8
): LegendRowItem[] {
  if (!importedLocations || importedLocations.length === 0) return [];

  type GroupInfo = {
    baseLabel: string;
    shape: string;
    color: string;
    size: number;
    classType: string;
    pops: number[];
    minThreshold?: number;
  };

  const categoryMap = new Map<string, GroupInfo>();

  importedLocations.forEach((loc) => {
    let baseLabel = 'Populated Places';
    if (loc.classType === 'admin0') {
      baseLabel = 'National Capitals';
    } else if (loc.classType === 'admin1') {
      baseLabel = 'State/Provincial Capitals';
    } else if (loc.isCustom) {
      baseLabel = 'Custom Locations';
    }

    if (loc.group && loc.group !== 'Imported Locations' && loc.group !== 'Custom Points') {
      const cleanGroup = loc.group
        .replace(/__.*$/, '')
        .replace(/\s*[\(\[]\s*([>≥>=]?\s*\d+(\.\d+)?[KMkmBb]?\+?|above|>=|between|with|all|\d+).*?[\)\]]/gi, '')
        .replace(/\s*[-–—:]\s*\d+(\.\d+)?[KMkmBb]?\+?/gi, '')
        .trim();
      if (cleanGroup) {
        baseLabel = cleanGroup;
      }
    }

    const shape = loc.symbolShape || 'dot';
    const color = loc.symbolColor || '#ef4444';
    const size = loc.symbolSize || (loc.classType === 'admin0' ? admin0Size : (loc.classType === 'admin1' ? admin1Size : 2));
    const classType = loc.classType || 'populated';

    const explicitTh = loc.popMinThreshold;
    const key = `${loc.group || ''}__${baseLabel}__${shape}__${color}__${size}__${explicitTh || ''}`;

    if (!categoryMap.has(key)) {
      categoryMap.set(key, {
        baseLabel,
        shape,
        color,
        size,
        classType,
        pops: [],
        minThreshold: explicitTh,
      });
    }

    const entry = categoryMap.get(key)!;
    if (loc.popMax && loc.popMax > 0) {
      entry.pops.push(loc.popMax);
    }
    if (loc.popMinThreshold && !entry.minThreshold) {
      entry.minThreshold = loc.popMinThreshold;
    }
  });

  // For categories without an explicit minThreshold, determine if points were filtered by population
  categoryMap.forEach((group) => {
    if (!group.minThreshold && group.pops.length > 0) {
      const rawMin = Math.min(...group.pops);
      if (rawMin >= 45000) {
        group.minThreshold = snapPopThreshold(rawMin);
      }
    }
  });

  // Group by family
  const familyMap = new Map<string, GroupInfo[]>();
  categoryMap.forEach((group) => {
    const familyKey = (group.classType && group.classType !== 'custom') ? group.classType : group.baseLabel;
    if (!familyMap.has(familyKey)) {
      familyMap.set(familyKey, []);
    }
    familyMap.get(familyKey)!.push(group);
  });

  const locationRows: LegendRowItem[] = [];

  familyMap.forEach((groups) => {
    const thresholds = Array.from(
      new Set(
        groups
          .map((g) => g.minThreshold)
          .filter((t): t is number => t !== undefined && t > 0)
      )
    ).sort((a, b) => a - b);

    groups.forEach((group) => {
      const cleanBaseLabel = group.baseLabel
        .replace(/__.*$/, '')
        .replace(/\s*[\(\[]\s*([>≥>=]?\s*\d+(\.\d+)?[KMkmBb]?\+?|above|>=|between|with|all|\d+).*?[\)\]]/gi, '')
        .replace(/\s*[-–—:]\s*\d+(\.\d+)?[KMkmBb]?\+?/gi, '')
        .trim();
      let text = cleanBaseLabel;
      if (group.minThreshold !== undefined && group.minThreshold > 0) {
        const t = group.minThreshold;
        const idx = thresholds.indexOf(t);
        if (idx !== -1 && idx < thresholds.length - 1) {
          const nextT = thresholds[idx + 1];
          text += ` (between ${formatPopShort(t)} and ${formatPopShort(nextT)} population)`;
        } else {
          text += ` (with equal or above ${formatPopShort(t)} population)`;
        }
      }

      locationRows.push({
        kind: 'locationGroup',
        color: group.color,
        text,
        shape: group.shape,
        size: group.size,
      });
    });
  });

  return locationRows;
}

const MapCanvas = React.memo(function MapCanvas({
  config,
  features: rawFeatures,
  selectedCountry,
  onSelectCountry,
  onUpdateConfig,
  customColors,
  legendLabels = {},
  onPaintCountry,
  onStartPaintStroke,
  onEndPaintStroke,
  paintColor,
  setPaintColor,
  activeTool,
  setActiveTool,
  countryMetadataMap,
  selectedBorderCountryIds = [],
  onRightClickCountry,
  customBorderSettings,
  appliedCustomBorders = [],
  viewport: incomingViewport,
  setViewport: incomingSetViewport,
  decodedBgDescriptor,
  bgProgress,
  brushScope = 'single',
  selectedMapFile,
  importedLocations = [],
  showLocations,
  showLocationLabels,
  admin0Shape,
  admin0Color,
  admin0Size,
  admin1Shape,
  admin1Color,
  admin1Size,
  riversData,
  popUnder50kShape,
  popUnder50kColor,
  popUnder50kSize,
  pop50kTo100kShape,
  pop50kTo100kColor,
  pop50kTo100kSize,
  pop100kTo1MShape,
  pop100kTo1MColor,
  pop100kTo1MSize,
  pop1MTo10MShape,
  pop1MTo10MColor,
  pop1MTo10MSize,
  popAbove10MShape,
  popAbove10MColor,
  popAbove10MSize,
  locationLabelSize,
  locationLabelOutlineRatio,
  stylizeAdmin1 = true,
  onRegisterExportHandlers,
  uiZoom = 0.9,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [wasmEngine, setWasmEngine] = useState<MapPainterWasm | null>(globalWasmEngine);

  // Temporary debug placement logic overrides & debug context menu
  const [placementOverrides, setPlacementOverrides] = useState<Record<string, 'center-of-mass' | 'center' | 'most-space'>>({});
  const [debugPlacementMenu, setDebugPlacementMenu] = useState<{
    x: number;
    y: number;
    feature: CountryFeature;
    isoCode: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    if (!wasmEngine) {
      getWasmEngine()
        .then((engine) => {
          setWasmEngine(engine);
        })
        .catch((err) => {
          console.error("Failed to initialize WebAssembly engine:", err);
        });
    }
  }, [wasmEngine]);

  // Preload all custom map font families so HTML5 canvas can draw text accurately immediately
  useEffect(() => {
    const fontSpecs = [
      '700 12px "Cinzel"',
      '700 12px "Cinzel Decorative"',
      '12px "UnifrakturMaguntia"',
      '12px "MedievalSharp"',
      'italic 12px "IM Fell English"',
      '12px "Marcellus"',
      '700 12px "Almendra"',
      '12px "Pirata One"',
      'italic bold 12px "Cormorant Garamond"',
      'italic bold 12px "Playfair Display"',
      '12px "JetBrains Mono"',
      '900 12px "Outfit"',
      'bold 12px "Space Grotesk"',
    ];

    if (typeof document !== 'undefined' && document.fonts) {
      if (document.fonts.load) {
        Promise.all(fontSpecs.map((spec) => document.fonts.load(spec).catch(() => {})))
          .then(() => {
            needsBaseRedrawRef.current = true;
          });
      }

      const handleFontLoad = () => {
        needsBaseRedrawRef.current = true;
      };

      document.fonts.addEventListener('loadingdone', handleFontLoad);
      return () => {
        document.fonts.removeEventListener('loadingdone', handleFontLoad);
      };
    }
  }, []);

  useEffect(() => {
    needsBaseRedrawRef.current = true;
  }, [config.labelFontFamily]);

  const getSimplifiedGeometryCached = (key: string, geom: any, tolerance: number) => {
    let cached = simplifiedGeomCacheRef.current.get(key);
    if (!cached) {
      cached = simplifyGeometry(geom, tolerance);
      simplifiedGeomCacheRef.current.set(key, cached);
    }
    return cached;
  };

  const getSimplifiedFeature = (
    feature: CountryFeature,
    totalZoom: number,
    forceLevel?: string
  ): CountryFeature => {
    if (!feature || !feature.geometry) return feature;

    // Never simplify ocean features
    if (isOceanFeature(feature)) {
      return feature;
    }

    const isChangingProjectionParams =
      isDraggingGlobe.current ||
      isSliderPanningRef.current ||
      isDragging.current ||
      isWheelingRef.current ||
      isPinchingRef.current;
    if (!isChangingProjectionParams && !forceLevel && (!config.simplificationLevel || config.simplificationLevel === 'off')) {
      return feature;
    }

    const level = forceLevel || (config.simplificationLevel && config.simplificationLevel !== 'off' ? config.simplificationLevel : 'low');

    if (level === 'off') {
      return feature;
    }

    const rawBucket = Math.pow(2, Math.floor(Math.log2(Math.max(1, totalZoom))));
    const zoomBucket = Math.min(8, rawBucket);

    const levelKey = level === 'medium' ? 'med' : level;
    const zKey = `${levelKey}_z${zoomBucket}`;

    // 1. Check pre-simplified from background worker
    const preSimplified = (feature as any).simplified;
    if (preSimplified && preSimplified[zKey]) {
      return {
        ...feature,
        geometry: preSimplified[zKey]
      };
    }

    // 2. Memory cache or fallback to simplifyGeometry
    const countryId = getCountryId(feature);
    const cacheKey = `${countryId}_lvl_${level}_z${zoomBucket}`;
    let simplifiedGeom = simplifiedGeomCacheRef.current.get(cacheKey);
    if (!simplifiedGeom) {
      let baseTol = 0.85;
      if (level === 'low') baseTol = 0.40;
      else if (level === 'medium') baseTol = 0.85;
      else if (level === 'high') baseTol = 1.80;
      else if (level === 'ultra') baseTol = 3.50;

      const tolerance = Math.max(0.01, baseTol / Math.pow(zoomBucket, 0.35));

      simplifiedGeom = simplifyGeometry(feature.geometry, tolerance);
      simplifiedGeomCacheRef.current.set(cacheKey, simplifiedGeom);
    }

    return {
      ...feature,
      geometry: simplifiedGeom
    };
  };

  const [dimensions, setDimensions] = useState(() => {
    if (typeof window !== 'undefined') {
      const w = window.innerWidth || 800;
      const h = window.innerHeight ? (window.innerHeight - 50) : 600;
      return {
        width: Math.max(w, 280),
        height: Math.max(h, 250),
      };
    }
    return { width: 800, height: 600 };
  });

  const tooltipRef = useRef<HTMLDivElement>(null);


  // Viewport camera controls for panning & zooming
  const [localViewport, setLocalViewport] = useState({ zoom: 1, pan: { x: 0, y: 0 } });
  const viewport = incomingViewport || localViewport;
  const setViewport = incomingSetViewport || setLocalViewport;
  const viewportZoom = viewport.zoom;
  const viewportPan = viewport.pan;

  const isNoGeoref = !!(
    (selectedMapFile && selectedMapFile.includes('no_georef')) ||
    (config.projection as any) === 'identity' ||
    (config.projection as any) === 'none' ||
    !checkIsGeoreferenced({ features: rawFeatures })
  );
  const isOrthographicProj = config.projection === 'orthographic' && !isNoGeoref;

  // Memoize pre-processed features (e.g. enlarged city-states for simple world map)
  const baseFeatures = React.useMemo(() => {
    let processed = rawFeatures;
    const isSimpleWorldMap = (!selectedMapFile || selectedMapFile === 'world.json') && rawFeatures.length <= 500;

    if (config.enlargeCityStates && isSimpleWorldMap && rawFeatures.length > 0) {
      const normalList: CountryFeature[] = [];
      const candidateList: {
        feature: CountryFeature;
        center: [number, number];
        maxGeoDistRad: number;
        radiusRad: number;
      }[] = [];

      // Scale factor: on a reference 1200-width map, scale is 1200 / (2 * PI) = ~190.986 px/rad
      // Base circle radius is 0.55 pixels -> radiusRad = 0.55 / (1200 / (2 * PI))
      const RAD_TO_PX = 1200 / (2 * Math.PI);
      const BASE_RADIUS_PX = 0.55;
      const BASE_RADIUS_RAD = BASE_RADIUS_PX / RAD_TO_PX;

      rawFeatures.forEach((f) => {
        if (isCityStateOrMicrostate(f)) {
          const center = getFeatureCenter(f);
          if (center) {
            // Check maximum spherical distance from center to all vertices of the country's original polygon
            let maxGeoDistRad = 0;
            const visitCoords = (coords: any[]) => {
              if (typeof coords[0] === 'number') {
                const d = d3.geoDistance(center, coords as [number, number]);
                if (d > maxGeoDistRad) maxGeoDistRad = d;
              } else {
                coords.forEach(visitCoords);
              }
            };
            if (f.geometry && (f.geometry as any).coordinates) {
              visitCoords((f.geometry as any).coordinates);
            }

            // User requirement 1: "If the circles do not completely cover a country's original polygon, just use the original polygon."
            if (maxGeoDistRad <= BASE_RADIUS_RAD) {
              candidateList.push({
                feature: f,
                center,
                maxGeoDistRad,
                radiusRad: BASE_RADIUS_RAD
              });
              return;
            }
          }
        }
        normalList.push(f);
      });

      // User requirement 2: "If two circles overlap, decrease the size of both circles until they don't. Don't make it overboard."
      let activeCandidates = candidateList.slice(0, 35);
      let changed = true;
      let iter = 0;
      while (changed && iter < 12) {
        changed = false;
        iter++;

        // Reset radii of all current active circles to base radius
        for (const c of activeCandidates) {
          c.radiusRad = BASE_RADIUS_RAD;
        }

        // Pairwise decrease radii until no two circles overlap
        let pairOverlap = true;
        let shrinkIter = 0;
        while (pairOverlap && shrinkIter < 12) {
          pairOverlap = false;
          shrinkIter++;
          for (let i = 0; i < activeCandidates.length; i++) {
            for (let j = i + 1; j < activeCandidates.length; j++) {
              const a = activeCandidates[i];
              const b = activeCandidates[j];
              const d = d3.geoDistance(a.center, b.center);
              if (d < a.radiusRad + b.radiusRad) {
                // Circles overlap: decrease both circles until they don't without going overboard
                const excess = (a.radiusRad + b.radiusRad) - d;
                const targetA = Math.min(a.radiusRad, Math.max(0, a.radiusRad - excess / 2));
                const targetB = Math.min(b.radiusRad, Math.max(0, b.radiusRad - excess / 2));
                if (a.radiusRad > targetA || b.radiusRad > targetB) {
                  a.radiusRad = targetA;
                  b.radiusRad = targetB;
                  pairOverlap = true;
                }
              }
            }
          }
        }

        // Rule 1: Check if each circle still completely covers its original polygon
        const nextActive: typeof activeCandidates = [];
        for (const c of activeCandidates) {
          if (c.radiusRad >= c.maxGeoDistRad) {
            nextActive.push(c);
          } else {
            // Circle shrunk smaller than polygon: revert to original polygon!
            normalList.push(c.feature);
            changed = true;
          }
        }
        activeCandidates = nextActive;
      }

      const enlargedList: CountryFeature[] = activeCandidates.map((c) => ({
        ...c.feature,
        _enlargedCenter: c.center,
        _circleRadius: Math.round(c.radiusRad * RAD_TO_PX * 1000) / 1000,
        _enlarged: true
      }));

      // Enlarged city-states MUST be placed at the end of the features array so they render on top of neighbors
      processed = [...normalList, ...enlargedList];
    }
    return processed;
  }, [rawFeatures, config.enlargeCityStates, selectedMapFile]);

  // Memoize rotated features for Airocean (only recalculates for Dymaxion)
  const features = React.useMemo(() => {
    if (config.projection as any !== 'airocean') {
      return baseFeatures;
    }

    try {
      const rot = d3.geoRotation([-config.centerLon, -config.centerLat, 0]);

      // Recursive helper to safely rotate coordinates of any geometry type on the sphere
      const rotateGeometry = (geometry: any): any => {
        if (!geometry) return null;
        if (geometry.type === 'GeometryCollection') {
          return {
            ...geometry,
            geometries: geometry.geometries.map((g: any) => rotateGeometry(g))
          };
        }

        const rotateCoords = (coords: any, depth: number): any => {
          if (depth === 0) {
            try {
              const r = rot(coords as [number, number]);
              return [r[0], r[1]];
            } catch (e) {
              return coords;
            }
          }
          return coords.map((c: any) => rotateCoords(c, depth - 1));
        };

        let depth = 0;
        if (geometry.type === 'Point') depth = 0;
        else if (geometry.type === 'MultiPoint' || geometry.type === 'LineString') depth = 1;
        else if (geometry.type === 'MultiLineString' || geometry.type === 'Polygon') depth = 2;
        else if (geometry.type === 'MultiPolygon') depth = 3;
        else return geometry;

        return {
          ...geometry,
          coordinates: rotateCoords(geometry.coordinates, depth)
        };
      };

      return baseFeatures.map((feature) => {
        try {
          const rotatedGeom = rotateGeometry(feature.geometry);
          if (!rotatedGeom) return feature;
          
          const tempFeature = {
            ...feature,
            geometry: rotatedGeom
          };
          
          // Use geoStitch to cleanly cut/split polygons crossing the antimeridian of the rotated coordinate system
          const stitched = geoStitch(tempFeature);
          return stitched || tempFeature;
        } catch (e) {
          return feature;
        }
      });
    } catch (e) {
      console.warn('Failed to pre-rotate and stitch features for Dymaxion projection:', e);
      return baseFeatures;
    }
  }, [baseFeatures, config.projection, config.centerLon, config.centerLat]);

  // Memoize pre-rotated and stitched graticule for Airocean (Dymaxion) projection
  const rotatedGraticule = React.useMemo(() => {
    if (config.projection as any !== 'airocean' || !config.showGraticule) {
      return null;
    }

    try {
      const graticuleStep = Math.max(0.1, config.graticuleInterval && !isNaN(config.graticuleInterval) ? config.graticuleInterval : 10);
      const rot = d3.geoRotation([-config.centerLon, -config.centerLat, 0]);
      const graticuleGeom = d3.geoGraticule().step([graticuleStep, graticuleStep])();

      const rotateGeometry = (geometry: any): any => {
        if (!geometry) return null;
        if (geometry.type === 'GeometryCollection') {
          return {
            ...geometry,
            geometries: geometry.geometries.map((g: any) => rotateGeometry(g))
          };
        }

        const rotateCoords = (coords: any, depth: number): any => {
          if (depth === 0) {
            try {
              const r = rot(coords as [number, number]);
              return [r[0], r[1]];
            } catch (e) {
              return coords;
            }
          }
          return coords.map((c: any) => rotateCoords(c, depth - 1));
        };

        let depth = 0;
        if (geometry.type === 'Point') depth = 0;
        else if (geometry.type === 'MultiPoint' || geometry.type === 'LineString') depth = 1;
        else if (geometry.type === 'MultiLineString' || geometry.type === 'Polygon') depth = 2;
        else if (geometry.type === 'MultiPolygon') depth = 3;
        else return geometry;

        return {
          ...geometry,
          coordinates: rotateCoords(geometry.coordinates, depth)
        };
      };

      const rotatedGeom = rotateGeometry(graticuleGeom);
      return rotatedGeom || graticuleGeom;
    } catch (e) {
      console.warn('Failed to pre-rotate graticule for Dymaxion projection:', e);
      return null;
    }
  }, [config.projection, config.showGraticule, config.centerLon, config.centerLat, config.graticuleInterval]);

  // Memoize global segment counts across all features to correctly classify "separating" (international shared) vs "outer" (coastline) borders
  const globalSegmentCounts = React.useMemo(() => {
    if (features.length > 2000) {
      return new Map<string, number>();
    }
    const counts = new Map<string, number>();

    const extractSegments = (feat: CountryFeature): [number, number, number, number][] => {
      const segs: [number, number, number, number][] = [];
      const geom = feat.geometry;
      if (!geom) return segs;

      const processPolygon = (coords: number[][][]) => {
        coords.forEach((ring) => {
          for (let i = 0; i < ring.length - 1; i++) {
            const p1 = ring[i];
            const p2 = ring[i + 1];
            if (p1 && p2) {
              segs.push([p1[0], p1[1], p2[0], p2[1]]);
            }
          }
        });
      };

      if (geom.type === 'Polygon') {
        processPolygon(geom.coordinates as number[][][]);
      } else if (geom.type === 'MultiPolygon') {
        (geom.coordinates as number[][][][]).forEach((poly) => {
          processPolygon(poly);
        });
      }
      return segs;
    };

    features.forEach((feat) => {
      const segs = extractSegments(feat);
      segs.forEach(([x1, y1, x2, y2]) => {
        const key = getSegmentKey(x1, y1, x2, y2);
        counts.set(key, (counts.get(key) || 0) + 1);
      });
    });

    return counts;
  }, [features]);

  // Memoize all distinct segments of the map for ultra-fast border caching
  const allSegments = React.useMemo(() => {
    if (features.length > 2000) {
      return [];
    }
    const segmentMap = new Map<string, {
      p1: [number, number];
      p2: [number, number];
      key: string;
      countries: string[];
      parents: string[];
      continents: string[];
    }>();

    const extractSegments = (feat: CountryFeature): [number, number, number, number][] => {
      const segs: [number, number, number, number][] = [];
      const geom = feat.geometry;
      if (!geom) return segs;

      const processPolygon = (coords: number[][][]) => {
        coords.forEach((ring) => {
          for (let i = 0; i < ring.length - 1; i++) {
            const p1 = ring[i];
            const p2 = ring[i + 1];
            if (p1 && p2) {
              const dx = Math.abs(p1[0] - p2[0]);
              const dy = Math.abs(p1[1] - p2[1]);
              // Skip zero-length duplicate point segments and artificial antimeridian closing seams
              if ((dx > 1e-7 || dy > 1e-7) && dx <= 180 && dy <= 90) {
                segs.push([p1[0], p1[1], p2[0], p2[1]]);
              }
            }
          }
        });
      };

      if (geom.type === 'Polygon') {
        processPolygon(geom.coordinates as number[][][]);
      } else if (geom.type === 'MultiPolygon') {
        (geom.coordinates as number[][][][]).forEach((poly) => {
          processPolygon(poly);
        });
      }
      return segs;
    };

    features.forEach((feat) => {
      const countryId = getCountryId(feat);
      const parentId = getParentCountryId(feat);
      const contId = getContinentId(feat);
      const segs = extractSegments(feat);
      segs.forEach(([x1, y1, x2, y2]) => {
        const key = getSegmentKey(x1, y1, x2, y2);
        let existing = segmentMap.get(key);
        if (!existing) {
          existing = {
            p1: [x1, y1],
            p2: [x2, y2],
            key,
            countries: [],
            parents: [],
            continents: []
          };
          segmentMap.set(key, existing);
        }
        if (!existing.countries.includes(countryId)) {
          existing.countries.push(countryId);
        }
        if (parentId && !existing.parents.includes(parentId)) {
          existing.parents.push(parentId);
        }
        if (contId && !existing.continents.includes(contId)) {
          existing.continents.push(contId);
        }
      });
    });

    const segmentsList: {
      p1: [number, number];
      p2: [number, number];
      key: string;
      globalCount: number;
      countries: string[];
      parents: string[];
      continents: string[];
    }[] = [];

    segmentMap.forEach((seg, key) => {
      const globalCount = globalSegmentCounts.get(key) || 1;
      segmentsList.push({
        p1: seg.p1,
        p2: seg.p2,
        key,
        globalCount,
        countries: seg.countries,
        parents: seg.parents,
        continents: seg.continents
      });
    });

    return segmentsList;
  }, [features, globalSegmentCounts]);

  const getSegmentsForBorder = useCallback((
    countryIds: string[],
    mode: BorderSelectionMode
  ): [number, number, number, number][] => {
    if (!countryIds || countryIds.length === 0) return [];

    const targetSet = new Set(countryIds);
    const isMulti = countryIds.length > 1;

    let hasInternalSeams = false;
    let hasLandBorders = false;
    let hasCoastline = false;

    if (isMulti) {
      if (mode === 'separating' || mode === 'outer') {
        for (let i = 0; i < allSegments.length; i++) {
          const seg = allSegments[i];
          let cnt = 0;
          for (let j = 0; j < seg.countries.length; j++) {
            if (targetSet.has(seg.countries[j])) {
              cnt++;
              if (cnt >= 2) {
                hasInternalSeams = true;
                break;
              }
            }
          }
          if (hasInternalSeams) break;
        }
      }
    } else {
      const singleId = countryIds[0];
      if (mode === 'separating' || mode === 'outer') {
        for (let i = 0; i < allSegments.length; i++) {
          const seg = allSegments[i];
          if (seg.countries.includes(singleId)) {
            if (seg.countries.length > 1) hasLandBorders = true;
            if (seg.countries.length === 1 || seg.globalCount === 1) hasCoastline = true;
            if (hasLandBorders && hasCoastline) break;
          }
        }
      }
    }

    const result: [number, number, number, number][] = [];
    for (let i = 0; i < allSegments.length; i++) {
      const seg = allSegments[i];
      let matchCount = 0;
      for (let j = 0; j < seg.countries.length; j++) {
        if (targetSet.has(seg.countries[j])) {
          matchCount++;
        }
      }
      if (matchCount === 0) continue;

      let include = true;
      if (mode === 'both') {
        include = true;
      } else if (isMulti) {
        if (mode === 'separating') {
          include = hasInternalSeams ? (matchCount >= 2) : (seg.countries.length > 1);
        } else if (mode === 'outer') {
          include = hasInternalSeams ? (matchCount < 2) : true;
        }
      } else {
        if (mode === 'separating') {
          include = hasLandBorders ? (seg.countries.length > 1) : true;
        } else if (mode === 'outer') {
          include = hasCoastline ? (seg.countries.length === 1 || seg.globalCount === 1) : true;
        }
      }

      if (include) {
        result.push([seg.p1[0], seg.p1[1], seg.p2[0], seg.p2[1]]);
      }
    }

    return result;
  }, [allSegments]);

  const customizedBordersData = React.useMemo(() => {
    const subWidth = config.borderWidth !== undefined ? config.borderWidth : 0.2;
    const countryWidth = config.countryBorderWidth !== undefined ? config.countryBorderWidth : (config.borderWidth !== undefined ? config.borderWidth : 0.2);
    const contWidth = config.continentBorderWidth !== undefined ? config.continentBorderWidth : 0.2;

    const detectedHierarchy = detectMapHierarchy(features, selectedMapFile);

    // If ALL border settings are set to 0px, or if this is a large map without applied custom borders, skip all segment iteration
    const hasAppliedCustom = appliedCustomBorders && appliedCustomBorders.some(b => (b.width ?? 0.4) > 0);

    if ((subWidth <= 0 && countryWidth <= 0 && contWidth <= 0 && !hasAppliedCustom) || (features.length > 2000 && !hasAppliedCustom)) {
      return {
        customizedKeys: new Set<string>(),
        baseBordersGeometry: null,
        baseSubnationalGeometry: null,
        baseCountryGeometry: null,
        baseContinentGeometry: null,
        customBordersList: [],
        previewBorder: null,
        detectedHierarchy
      };
    }

    const customizedKeys = new Set<string>();

    const collectKeys = (countryIds: string[], mode: BorderSelectionMode) => {
      if (!countryIds || countryIds.length === 0) return;
      const targetSet = new Set(countryIds);
      const isMulti = countryIds.length > 1;

      let hasInternalSeams = false;
      let hasLandBorders = false;
      let hasCoastline = false;

      if (isMulti) {
        if (mode === 'separating' || mode === 'outer') {
          for (let i = 0; i < allSegments.length; i++) {
            const seg = allSegments[i];
            let cnt = 0;
            for (let j = 0; j < seg.countries.length; j++) {
              if (targetSet.has(seg.countries[j])) {
                cnt++;
                if (cnt >= 2) {
                  hasInternalSeams = true;
                  break;
                }
              }
            }
            if (hasInternalSeams) break;
          }
        }
      } else {
        const singleId = countryIds[0];
        if (mode === 'separating' || mode === 'outer') {
          for (let i = 0; i < allSegments.length; i++) {
            const seg = allSegments[i];
            if (seg.countries.includes(singleId)) {
              if (seg.countries.length > 1) hasLandBorders = true;
              if (seg.countries.length === 1 || seg.globalCount === 1) hasCoastline = true;
              if (hasLandBorders && hasCoastline) break;
            }
          }
        }
      }

      for (let i = 0; i < allSegments.length; i++) {
        const seg = allSegments[i];
        let matchCount = 0;
        for (let j = 0; j < seg.countries.length; j++) {
          if (targetSet.has(seg.countries[j])) {
            matchCount++;
          }
        }
        if (matchCount === 0) continue;

        let include = true;
        if (mode === 'both') {
          include = true;
        } else if (isMulti) {
          if (mode === 'separating') {
            include = hasInternalSeams ? (matchCount >= 2) : (seg.countries.length > 1);
          } else if (mode === 'outer') {
            include = hasInternalSeams ? (matchCount < 2) : true;
          }
        } else {
          if (mode === 'separating') {
            include = hasLandBorders ? (seg.countries.length > 1) : true;
          } else if (mode === 'outer') {
            include = hasCoastline ? (seg.countries.length === 1 || seg.globalCount === 1) : true;
          }
        }

        if (include) {
          customizedKeys.add(seg.key);
        }
      }
    };

    if (appliedCustomBorders && appliedCustomBorders.length > 0) {
      appliedCustomBorders.forEach((b) => {
        if ((b.width ?? 0.4) > 0) {
          collectKeys(b.countryIds, b.borderSelectionMode);
        }
      });
    }

    const baseSubnationalSegs: [number, number, number, number][] = [];
    const baseCountrySegs: [number, number, number, number][] = [];
    const baseContinentSegs: [number, number, number, number][] = [];

    if (subWidth > 0 || countryWidth > 0 || contWidth > 0) {
      allSegments.forEach((seg) => {
        if (!customizedKeys.has(seg.key)) {
          if (detectedHierarchy.hasContinents && seg.continents.length > 1) {
            if (contWidth > 0) {
              baseContinentSegs.push([seg.p1[0], seg.p1[1], seg.p2[0], seg.p2[1]]);
            }
          } else if (detectedHierarchy.hasSubnational) {
            if (seg.parents.length > 1 || seg.globalCount === 1) {
              if (countryWidth > 0) {
                baseCountrySegs.push([seg.p1[0], seg.p1[1], seg.p2[0], seg.p2[1]]);
              }
            } else {
              if (subWidth > 0) {
                baseSubnationalSegs.push([seg.p1[0], seg.p1[1], seg.p2[0], seg.p2[1]]);
              }
            }
          } else {
            if (subWidth > 0) {
              baseSubnationalSegs.push([seg.p1[0], seg.p1[1], seg.p2[0], seg.p2[1]]);
            }
          }
        }
      });
    }

    const formatBaseSegs = (segs: [number, number, number, number][]) => {
      if (segs.length === 0) return [];
      if (segs.length > 1200) {
        return segs.map(s => [[s[0], s[1]], [s[2], s[3]]]);
      }
      return chainSegments(segs);
    };

    const baseSubnationalGeometry: any = {
      type: 'MultiLineString',
      coordinates: subWidth > 0 && baseSubnationalSegs.length > 0 ? formatBaseSegs(baseSubnationalSegs) : []
    };
    const baseCountryGeometry: any = {
      type: 'MultiLineString',
      coordinates: countryWidth > 0 && baseCountrySegs.length > 0 ? formatBaseSegs(baseCountrySegs) : []
    };
    const baseContinentGeometry: any = {
      type: 'MultiLineString',
      coordinates: contWidth > 0 && baseContinentSegs.length > 0 ? formatBaseSegs(baseContinentSegs) : []
    };
    const baseBordersGeometry: any = baseSubnationalGeometry;

    const customBordersList = (appliedCustomBorders || [])
      .filter((b) => (b.width ?? 0.4) > 0 && b.countryIds && b.countryIds.length > 0)
      .map((b) => {
        const segsToChain = getSegmentsForBorder(b.countryIds, b.borderSelectionMode);
        const chained = segsToChain.length > 0 ? chainSegments(segsToChain) : [];
        const geom: any = {
          type: 'MultiLineString',
          coordinates: chained
        };

        return {
          id: b.id,
          geometry: geom,
          style: b.style,
          dashLength: b.dashLength,
          gapLength: b.gapLength,
          color: b.color,
          width: b.width
        };
      });

    return {
      customizedKeys,
      baseBordersGeometry,
      baseSubnationalGeometry,
      baseCountryGeometry,
      baseContinentGeometry,
      customBordersList,
      previewBorder: null,
      detectedHierarchy
    };
  }, [allSegments, appliedCustomBorders, config.borderWidth, config.countryBorderWidth, config.continentBorderWidth, features, getSegmentsForBorder]);

  const previewBorder = React.useMemo(() => {
    if (!selectedBorderCountryIds || selectedBorderCountryIds.length === 0 || !customBorderSettings || (customBorderSettings.width ?? 0.4) <= 0) {
      return null;
    }
    const segsToChain = getSegmentsForBorder(selectedBorderCountryIds, customBorderSettings.borderSelectionMode);
    const chained = segsToChain.length > 0 ? chainSegments(segsToChain) : [];
    return {
      geometry: {
        type: 'MultiLineString',
        coordinates: chained
      },
      style: customBorderSettings.style,
      dashLength: customBorderSettings.dashLength,
      gapLength: customBorderSettings.gapLength,
      color: customBorderSettings.color,
      width: customBorderSettings.width
    };
  }, [selectedBorderCountryIds, customBorderSettings, getSegmentsForBorder]);

  const previewBorderRef = useRef<any>(previewBorder);
  previewBorderRef.current = previewBorder;

  const selectedBorderCountryIdsRef = useRef<string[]>(selectedBorderCountryIds || []);
  selectedBorderCountryIdsRef.current = selectedBorderCountryIds || [];

  // Custom setter helpers to keep full compatibility with single-variable state updates
  const setViewportZoom = (val: number | ((prev: number) => number)) => {
    setViewport((prev) => {
      const nextZoom = typeof val === 'function' ? val(prev.zoom) : val;
      return { ...prev, zoom: nextZoom };
    });
  };

  const setViewportPan = (val: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => {
    setViewport((prev) => {
      const nextPan = typeof val === 'function' ? val(prev.pan) : val;
      return { ...prev, pan: nextPan };
    });
  };

  // Interaction tracking state
  const isDragging = useRef(false);
  const isDraggingGlobe = useRef(false);
  const localRotationRef = useRef({ lon: config.centerLon, lat: config.centerLat });
  const interactiveViewportRef = useRef({ zoom: viewport.zoom, pan: viewport.pan });
  const lastDrawnRotationRef = useRef({ lon: config.centerLon, lat: config.centerLat, aspect: config.aspect || 0 });
  const lastDrawnViewportRef = useRef({ zoom: viewport.zoom, pan: { ...viewport.pan } });

  const isWheelingRef = useRef(false);
  const renderMapToContextRef = useRef<((ctx: CanvasRenderingContext2D, renderDpr: number, isExport?: boolean) => void) | null>(null);
  const isPinchingRef = useRef(false);
  const wheelTimeoutRef = useRef<any>(null);

  // Keep local refs in sync with incoming props/state when not dragging/panning
  useEffect(() => {
    if (!isDragging.current && !isDraggingGlobe.current) {
      localRotationRef.current = { lon: config.centerLon, lat: config.centerLat };
    }
  }, [config.centerLon, config.centerLat]);

  useEffect(() => {
    if (!isDragging.current && !isWheelingRef.current && !isPinchingRef.current && !wheelTimeoutRef.current) {
      interactiveViewportRef.current = { zoom: viewport.zoom, pan: { ...viewport.pan } };
    }
  }, [viewport.zoom, viewport.pan.x, viewport.pan.y]);

  const isMountedRef = useRef(false);
  const isSliderPanningRef = useRef(false);
  const lastSwipedCountryIdRef = useRef<string | null>(null);
  const isRightDragging = useRef(false);
  const rightDragMoved = useRef(false);
  const rightClickStartPos = useRef({ x: 0, y: 0 });
  const lastRightSwipedCountryIdRef = useRef<string | null>(null);
  const lastRightClickHandledTimeRef = useRef<number>(0);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragStartPan = useRef({ x: 0, y: 0 });
  const dragStartCenter = useRef({ lon: 0, lat: 0 });

  // FPS calculation refs
  const lastRenderTimeRef = useRef<number>(0);
  const fpsHistoryRef = useRef<number[]>([]);
  const lastRedrawTimeRef = useRef<number>(0);
  const redrawFpsHistoryRef = useRef<number[]>([]);
  const lastMapDrawDurationRef = useRef<number>(0);
  const centroidCacheRef = useRef<Map<string, [number, number]>>(new Map());
  const centroidTrigCacheRef = useRef<Map<string, CentroidTrig>>(new Map());
  const labelGeomCacheRef = useRef<Map<string, CountryLabelGeometry>>(new Map());
  const areaCacheRef = useRef<Map<string, number>>(new Map());
  const path2DCacheRef = useRef<Map<string, Path2D>>(new Map());
  const projectedBBoxCacheRef = useRef<Map<string, [number, number, number, number]>>(new Map());
  const graticulePath2DRef = useRef<Path2D | null>(null);
  const baseBordersPath2DRef = useRef<Path2D | null>(null);
  const baseBordersCacheKeyRef = useRef<string | null>(null);
  const customBordersPath2DRef = useRef<Map<string, Path2D>>(new Map());
  const previewBorderPath2DRef = useRef<Path2D | null>(null);
  const simplifiedGeomCacheRef = useRef<Map<string, any>>(new Map());
  const geomBoundsCacheRef = useRef<WeakMap<any, { minLon: number; minLat: number; maxLon: number; maxLat: number }>>(new WeakMap());
  const geomProjectedBoundsCacheRef = useRef<WeakMap<any, [[number, number], [number, number]]>>(new WeakMap());
  const cachedLabelsToRenderRef = useRef<any[] | null>(null);
  const cachedLabelsKeyRef = useRef<string | null>(null);
  const labelRenderCacheMapRef = useRef<Map<string, any[]>>(new Map());
  const graticuleCacheRef = useRef<Map<string, Path2D>>(new Map());
  const featureMapRef = useRef<Map<string, CountryFeature>>(new Map());

  // Synchronize featureMapRef for O(1) selection/border rendering
  useEffect(() => {
    const map = new Map<string, CountryFeature>();
    features.forEach((f) => {
      const id = getCountryId(f);
      if (id) map.set(id, f);
    });
    featureMapRef.current = map;
  }, [features]);

  // Clear cached centroids and vector paths when features change to prevent memory leaks or mismatched lookups
  useEffect(() => {
    cachedLabelsToRenderRef.current = null;
    cachedLabelsKeyRef.current = null;
    labelRenderCacheMapRef.current.clear();
    graticuleCacheRef.current.clear();
    centroidCacheRef.current.clear();
    centroidTrigCacheRef.current.clear();
    labelGeomCacheRef.current.clear();
    areaCacheRef.current.clear();
    path2DCacheRef.current.clear();
    projectedBBoxCacheRef.current.clear();
    simplifiedGeomCacheRef.current.clear();
    bboxCache.clear();
    geoRadiusCache.clear();
    geomBoundsCacheRef.current = new WeakMap();
    geomProjectedBoundsCacheRef.current = new WeakMap();
    graticulePath2DRef.current = null;
    baseBordersPath2DRef.current = null;
    customBordersPath2DRef.current.clear();
    previewBorderPath2DRef.current = null;
    if (webglEngineRef.current) {
      webglEngineRef.current.clearMeshCache();
    }
    needsBaseRedrawRef.current = true;
  }, [features]);

  // Touch gesture state
  const touchStartDist = useRef(0);
  const pinchStartZoom = useRef(1);
  const pinchStartPan = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pinchStartCenter = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastTouchTimeRef = useRef<number>(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressTriggeredRef = useRef<boolean>(false);

  // Responsive container matching and mobile viewport observer with smooth debouncing
  useEffect(() => {
    if (!containerRef.current) return;

    let rAFId: number | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const commitDimensions = (w: number, h: number) => {
      const nextW = Math.max(Math.round(w), 200);
      const nextH = Math.max(Math.round(h), 200);
      setDimensions(prev => {
        if (Math.abs(prev.width - nextW) < 2 && Math.abs(prev.height - nextH) < 2) return prev;
        return { width: nextW, height: nextH };
      });
    };

    const updateSizeImmediate = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const parentRect = containerRef.current.parentElement?.getBoundingClientRect();
      const w = rect.width || parentRect?.width || containerRef.current.clientWidth || window.innerWidth || 800;
      const h = rect.height || parentRect?.height || containerRef.current.clientHeight || (window.innerHeight - 50) || 600;
      commitDimensions(w, h);
    };

    const scheduleDebouncedUpdate = (targetW?: number, targetH?: number) => {
      if (rAFId !== null) cancelAnimationFrame(rAFId);
      rAFId = requestAnimationFrame(() => {
        rAFId = null;
        if (debounceTimer !== null) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          if (targetW !== undefined && targetH !== undefined) {
            commitDimensions(targetW, targetH);
          } else {
            updateSizeImmediate();
          }
        }, 40); // 40ms debounce prevents CPU freezing from continuous layout/expand updates
      });
    };

    // First render is immediate for instant responsiveness
    updateSizeImmediate();

    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        scheduleDebouncedUpdate(width, height);
      } else {
        scheduleDebouncedUpdate();
      }
    });

    const handleWindowResize = () => scheduleDebouncedUpdate();

    observer.observe(containerRef.current);
    window.addEventListener('resize', handleWindowResize);
    window.addEventListener('orientationchange', handleWindowResize);

    return () => {
      if (rAFId !== null) cancelAnimationFrame(rAFId);
      if (debounceTimer !== null) clearTimeout(debounceTimer);
      observer.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      window.removeEventListener('orientationchange', handleWindowResize);
    };
  }, []);

  const projDimensions = (dimensions.width > 0 && dimensions.height > 0)
    ? dimensions
    : { width: 1200, height: 800 };

  // Set up D3 geographic projection from configuration
  const projection = React.useMemo(() => {
    if (isNoGeoref) {
      const proj = d3.geoIdentity() as any;
      proj.reflectY(true);
      
      if (features && features.length > 0) {
        proj.fitSize([projDimensions.width, projDimensions.height], {
          type: 'FeatureCollection',
          features: features
        });
        
        const baseScale = proj.scale() || 1;
        const baseTranslate = proj.translate() || [projDimensions.width / 2, projDimensions.height / 2];
        
        proj.scale(baseScale * config.zoom);
        
        const cx = projDimensions.width / 2;
        const cy = projDimensions.height / 2;
        proj.translate([
          cx + (baseTranslate[0] - cx) * config.zoom,
          cy + (baseTranslate[1] - cy) * config.zoom
        ]);
      }
      return proj as unknown as d3.GeoProjection;
    }

    let proj: d3.GeoProjection;

    switch (config.projection as any) {
      case 'orthographic':
        proj = d3.geoOrthographic();
        break;
      case 'mercator':
        proj = d3.geoMercator();
        break;
      case 'equirectangular':
        proj = d3.geoEquirectangular();
        break;
      case 'azimuthalEqualArea':
        proj = d3.geoAzimuthalEqualArea();
        break;
      case 'gnomonic':
        proj = d3.geoGnomonic().clipAngle(85);
        break;
      case 'winkel1':
        proj = geoWinkel1();
        break;
      case 'winkel2':
        proj = geoWinkel2();
        break;
      case 'winkel3':
        proj = geoWinkel3();
        break;
      case 'mollweide':
        proj = geoMollweide();
        break;
      case 'equalEarth':
        proj = d3.geoEqualEarth();
        break;
      case 'robinson':
        proj = geoRobinson();
        break;
      case 'sinusoidal':
        proj = geoSinusoidal();
        break;
      case 'eckert1':
        proj = geoEckert1();
        break;
      case 'eckert2':
        proj = geoEckert2();
        break;
      case 'eckert3':
        proj = geoEckert3();
        break;
      case 'eckert4':
        proj = geoEckert4();
        break;
      case 'eckert5':
        proj = geoEckert5();
        break;
      case 'eckert6':
        proj = geoEckert6();
        break;
      case 'aitoff':
        proj = geoAitoff();
        break;
      case 'times':
        proj = geoTimes();
        break;
      case 'vandergrinten4':
        proj = geoVanDerGrinten4();
        break;
      case 'miller':
        proj = geoMiller();
        break;
      case 'gallPeters':
        proj = geoGallPeters();
        break;
      case 'collignon':
        proj = geoCollignonCustom();
        break;
      case 'gallStereographic':
        proj = geoGallStereographicCustom();
        break;
      case 'lambert':
        proj = geoLambertCylindrical();
        break;
      case 'centralCylindrical':
        proj = geoCentralCylindrical();
        break;
      case 'airocean':
        proj = geoAirocean();
        break;
      default:
        proj = d3.geoEquirectangular();
    }

    if (config.projection as any === 'airocean') {
      const defaultScale = Math.min(projDimensions.width, projDimensions.height) / (2 * Math.PI);
      try {
        proj.scale(defaultScale * config.zoom);
      } catch (e) {}
      try {
        proj.translate([projDimensions.width / 2, projDimensions.height / 2]);
      } catch (e) {}
      return proj;
    }

    const defaultScale = config.projection === 'orthographic' 
      ? Math.min(projDimensions.width, projDimensions.height) * 0.45
      : Math.min(projDimensions.width, projDimensions.height) / (2 * Math.PI);

    let orthoMagnification = 1;
    if (config.projection === 'orthographic') {
      const edgeAngle = Math.max(1, Math.min(90, config.edgeAngle !== undefined ? config.edgeAngle : 90));
      const edgeAngleRad = (edgeAngle * Math.PI) / 180;
      orthoMagnification = 1 / Math.sin(edgeAngleRad);
    }

    try {
      proj.scale(defaultScale * config.zoom * orthoMagnification);
    } catch (e) {}

    try {
      proj.translate([projDimensions.width / 2, projDimensions.height / 2]);
    } catch (e) {}

    try {
      proj.rotate([-config.centerLon, -config.centerLat, config.aspect || 0]);
    } catch (e) {}

    if (config.projection === 'orthographic') {
      try {
        proj.clipAngle(90);
      } catch (e) {}
    } else if (config.projection === 'gnomonic') {
      try {
        proj.clipAngle(85);
      } catch (e) {}
    } else if (config.projection === 'azimuthalEqualArea') {
      try {
        proj.clipAngle(179.9);
      } catch (e) {}
    } else {
      try {
        proj.clipAngle(null);
        proj.preclip(d3.geoClipAntimeridian);
      } catch (e) {}
    }

    return proj;
  }, [config.projection, config.zoom, config.edgeAngle, config.centerLon, config.centerLat, config.aspect, projDimensions.width, projDimensions.height, features, isNoGeoref]);

  // When simplification level changes, clear simplified geometries and path2D caches
  useEffect(() => {
    simplifiedGeomCacheRef.current.clear();
    path2DCacheRef.current.clear();
    needsBaseRedrawRef.current = true;
  }, [config.simplificationLevel]);

  // When projection, graticule interval, edge angle, or aspect changes, signal redraw and refresh projection caches
  useEffect(() => {
    path2DCacheRef.current.clear();
    projectedBBoxCacheRef.current.clear();
    geomProjectedBoundsCacheRef.current = new WeakMap();
    graticulePath2DRef.current = null;
    graticuleCacheRef.current.clear();
    baseBordersPath2DRef.current = null;
    customBordersPath2DRef.current.clear();
    previewBorderPath2DRef.current = null;
    cachedLabelsToRenderRef.current = null;
    cachedLabelsKeyRef.current = null;
    labelRenderCacheMapRef.current.clear();
    needsBaseRedrawRef.current = true;
  }, [projection, config.graticuleInterval, config.edgeAngle, config.aspect]);

  // Invalidate single-label cache and force base redraw whenever edgeAngle changes
  useEffect(() => {
    cachedLabelsToRenderRef.current = null;
    cachedLabelsKeyRef.current = null;
    needsBaseRedrawRef.current = true;
  }, [config.edgeAngle]);

  // When border configuration or applied borders change, only invalidate border paths, never the country fill path2D cache
  useEffect(() => {
    baseBordersPath2DRef.current = null;
    customBordersPath2DRef.current.clear();
    previewBorderPath2DRef.current = null;
    needsBaseRedrawRef.current = true;
  }, [customizedBordersData]);

  // Redraw canvas when background image loaded/changed
  useEffect(() => {
    needsBaseRedrawRef.current = true;
  }, [decodedBgDescriptor, bgProgress]);

  // Spatial Index construction for fast country O(1) hover lookups
  const spatialIndex = React.useMemo(() => {
    return new SpatialGridIndex(features, isNoGeoref);
  }, [features, isNoGeoref]);

  // Exact Projected Bounding Box calculator for perfect and non-laggy viewport frustum culling
  const getOrCreateProjectedBBox = (feature: CountryFeature): [number, number, number, number] | null => {
    const countryId = getCountryId(feature);
    const scaleKey = Math.round(projection.scale());
    const rotLonKey = Math.round(localRotationRef.current ? localRotationRef.current.lon : (config.centerLon || 0));
    const rotLatKey = Math.round(localRotationRef.current ? localRotationRef.current.lat : (config.centerLat || 0));
    const aspectKey = Math.round((config.aspect || 0) * 10) / 10;
    const cacheKey = `${config.projection}_${countryId}_s${scaleKey}_r${rotLonKey}_${rotLatKey}_a${aspectKey}`;
    let cached = projectedBBoxCacheRef.current.get(cacheKey);
    if (cached) return cached;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let hasPoints = false;

    const traverse = (coords: any) => {
      if (Array.isArray(coords) && typeof coords[0] === 'number') {
        const p = projection(coords as [number, number]);
        if (p && !isNaN(p[0]) && !isNaN(p[1])) {
          if (p[0] < minX) minX = p[0];
          if (p[0] > maxX) maxX = p[0];
          if (p[1] < minY) minY = p[1];
          if (p[1] > maxY) maxY = p[1];
          hasPoints = true;
        }
      } else if (Array.isArray(coords)) {
        for (let i = 0; i < coords.length; i++) {
          traverse(coords[i]);
        }
      }
    };

    const geom = feature.geometry as any;
    if (geom && geom.coordinates) {
      traverse(geom.coordinates);
    }

    if (hasPoints) {
      const bbox: [number, number, number, number] = [minX, minY, maxX, maxY];
      if (projectedBBoxCacheRef.current.size > 3000) {
        const firstKey = projectedBBoxCacheRef.current.keys().next().value;
        if (firstKey) projectedBBoxCacheRef.current.delete(firstKey);
      }
      projectedBBoxCacheRef.current.set(cacheKey, bbox);
      return bbox;
    }
    return null;
  };

  // Fast approximate projected bounding box by projecting 9 sampled points of the geographic bounding box
  const getFastProjectedBBox = (feature: CountryFeature): [number, number, number, number] | null => {
    const isEnlarged = !!(feature as any)._enlarged;
    const countryId = getCountryId(feature) + (isEnlarged ? '_enlarged' : '');
    const scaleKey = Math.round(projection.scale());
    const rotLonKey = Math.round(localRotationRef.current ? localRotationRef.current.lon : (config.centerLon || 0));
    const rotLatKey = Math.round(localRotationRef.current ? localRotationRef.current.lat : (config.centerLat || 0));
    const aspectKey = Math.round((config.aspect || 0) * 10) / 10;
    const cacheKey = `${config.projection}_${countryId}_s${scaleKey}_r${rotLonKey}_${rotLatKey}_a${aspectKey}`;
    let cached = projectedBBoxCacheRef.current.get(cacheKey);
    if (cached) return cached;

    if (isEnlarged) {
      const center = (feature as any)._enlargedCenter || getFeatureCenter(feature);
      if (center) {
        const p = projection(center);
        if (p && !isNaN(p[0]) && !isNaN(p[1])) {
          const circleRadius = (feature as any)._circleRadius !== undefined ? (feature as any)._circleRadius : 0.55;
          const r = (circleRadius * config.zoom) + 4;
          const res: [number, number, number, number] = [p[0] - r, p[1] - r, p[0] + r, p[1] + r];
          if (projectedBBoxCacheRef.current.size > 3000) {
            const firstKey = projectedBBoxCacheRef.current.keys().next().value;
            if (firstKey) projectedBBoxCacheRef.current.delete(firstKey);
          }
          projectedBBoxCacheRef.current.set(cacheKey, res);
          return res;
        }
      }
    }

    const bbox = getFeatureBBox(feature); // [minLon, minLat, maxLon, maxLat]
    const [minLon, minLat, maxLon, maxLat] = bbox;

    const midLon = (minLon + maxLon) / 2;
    const midLat = (minLat + maxLat) / 2;

    const lons = [minLon, midLon, maxLon];
    const lats = [minLat, midLat, maxLat];

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let hasPoints = false;

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const p = projection([lons[i], lats[j]]);
        if (p && !isNaN(p[0]) && !isNaN(p[1])) {
          if (p[0] < minX) minX = p[0];
          if (p[0] > maxX) maxX = p[0];
          if (p[1] < minY) minY = p[1];
          if (p[1] > maxY) maxY = p[1];
          hasPoints = true;
        }
      }
    }

    if (hasPoints) {
      const res: [number, number, number, number] = [minX, minY, maxX, maxY];
      projectedBBoxCacheRef.current.set(countryId, res);
      return res;
    }
    return null;
  };

  // Offscreen base map canvas (holds static background, fills, borders, labels) and redraw flags for buttery-smooth rendering performance
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const webgpuCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const webglCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const webglEngineRef = useRef<WebGLMapEngine | null>(null);
  const [webglActive, setWebglActive] = useState<boolean>(false);
  const bgExportCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastProjectedStateRef = useRef<{
    projection: string;
    zoom: number;
    currentZoom?: number;
    rotationLon: number;
    rotationLat: number;
    aspect: number;
    width: number;
    height: number;
    decodedBgImage: any;
    bgProgress: number;
    opacity: number;
  } | null>(null);

  const baseCanvasZoomRef = useRef<number>(1);
  const baseCanvasPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const needsBaseRedrawRef = useRef<boolean>(true);
  const baseRedrawTimeoutRef = useRef<any>(null);
  const wasInteractingLastRef = useRef<boolean>(false);
  const wasDraggingGlobeLastRef = useRef<boolean>(false);
  const wasChangingProjectionParamsRef = useRef<boolean>(false);
  const hoveredCountryRef = useRef<CountryFeature | null>(null);
  const lastDrawnStateRef = useRef({
    panX: 0,
    panY: 0,
    zoom: 0,
    width: 0,
    height: 0,
    hoveredId: '',
    selectedId: '',
    dpr: 1,
    isInteracting: false,
  });
  const lastMouseMoveTimeRef = useRef<number>(0);
  const selectedCountryRef = useRef<CountryFeature | null>(selectedCountry);
  selectedCountryRef.current = selectedCountry;
  useEffect(() => {
    selectedCountryRef.current = selectedCountry;
  }, [selectedCountry]);

  // Set base map redraw trigger on state/prop change (excluding hoveredCountry/selectedCountry overlays for ultra-high FPS)
  useEffect(() => {
    // Completely clear all geometry, border, and label caches when features, configuration, or datasets change
    path2DCacheRef.current.clear();
    projectedBBoxCacheRef.current.clear();
    geomProjectedBoundsCacheRef.current = new WeakMap();
    graticulePath2DRef.current = null;
    graticuleCacheRef.current.clear();
    baseBordersPath2DRef.current = null;
    customBordersPath2DRef.current.clear();
    previewBorderPath2DRef.current = null;
    cachedLabelsToRenderRef.current = null;
    cachedLabelsKeyRef.current = null;
    labelRenderCacheMapRef.current.clear();

    needsBaseRedrawRef.current = true;
  }, [
    dimensions,
    config,
    features,
    projection,
    decodedBgDescriptor,
    bgProgress,
    importedLocations,
    showLocations,
    showLocationLabels,
    admin0Shape,
    admin0Color,
    admin0Size,
    admin1Shape,
    admin1Color,
    admin1Size,
    riversData,
    popUnder50kShape,
    popUnder50kColor,
    popUnder50kSize,
    pop50kTo100kShape,
    pop50kTo100kColor,
    pop50kTo100kSize,
    pop100kTo1MShape,
    pop100kTo1MColor,
    pop100kTo1MSize,
    pop1MTo10MShape,
    pop1MTo10MColor,
    pop1MTo10MSize,
    popAbove10MShape,
    popAbove10MColor,
    popAbove10MSize,
    locationLabelOutlineRatio,
    locationLabelSize,
    stylizeAdmin1,
  ]);

  // Painting, legend labels, or border customization triggers a base map redraw without wiping geometry Path2D caches
  useEffect(() => {
    previewBorderPath2DRef.current = null;
    needsBaseRedrawRef.current = true;
  }, [customColors, legendLabels, countryMetadataMap, customizedBordersData, selectedBorderCountryIds, appliedCustomBorders, customBorderSettings, decodedBgDescriptor, config.showFlags]);

  // Initialize Hardware-Accelerated WebGL Map Engine
  useEffect(() => {
    const canvas = webglCanvasRef.current;
    if (!canvas) return;

    if (!webglEngineRef.current) {
      try {
        const engine = new WebGLMapEngine();
        if (engine.init(canvas)) {
          webglEngineRef.current = engine;
          setWebglActive(true);
        }
      } catch (err) {
        console.warn('WebGLMapEngine initialization fallback to 2D:', err);
      }
    }

    return () => {
      if (webglEngineRef.current) {
        webglEngineRef.current.destroy();
        webglEngineRef.current = null;
        setWebglActive(false);
      }
    };
  }, []);

  // Synchronize WebGL Engine viewport and DPR
  useEffect(() => {
    if (webglEngineRef.current) {
      const dpr = window.devicePixelRatio || 1;
      webglEngineRef.current.resize(dimensions.width, dimensions.height, dpr);
    }
  }, [dimensions]);

  // Synchronize WebGL GPU Vertex Buffer mesh and color palette with instant cache recall & async deferral
  useEffect(() => {
    if (webglEngineRef.current && features && features.length > 0) {
      const scaleKey = Math.round(projection.scale());
      const rotLonKey = Math.round(config.centerLon || 0);
      const rotLatKey = Math.round(config.centerLat || 0);
      const aspectKey = Math.round((config.aspect || 0) * 10) / 10;
      const mapIdKey = selectedMapFile || (features[0]?.properties?.name || 'custom');
      const projKey = `${mapIdKey}_${features.length}_${config.projection}_s${scaleKey}_r${rotLonKey}_${rotLatKey}_a${aspectKey}`;
      const isDark = config.colorTheme === 'dark';
      const defaultLand = isDark ? '#262624' : '#fdfcf8';

      if (webglEngineRef.current.hasCachedMesh(projKey)) {
        webglEngineRef.current.loadFeatures(features, projection, projKey);
        webglEngineRef.current.updatePalette(customColors, defaultLand, isDark);
      } else {
        const timeoutId = setTimeout(() => {
          if (!webglEngineRef.current) return;
          webglEngineRef.current.loadFeatures(features, projection, projKey);
          webglEngineRef.current.updatePalette(customColors, defaultLand, isDark);
        }, 0);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [features, projection, selectedMapFile]);

  // Synchronize WebGL color palette for instant recoloring
  useEffect(() => {
    if (webglEngineRef.current) {
      const isDark = config.colorTheme === 'dark';
      const defaultLand = isDark ? '#262624' : '#fdfcf8';
      webglEngineRef.current.updatePalette(customColors, defaultLand, isDark);
    }
  }, [customColors, config.colorTheme]);

  // Instant Zero-Latency GPU Recoloring (Pax Historia style) + State Dispatch
  const triggerPaintCountry = React.useCallback((countryId: string, color: string | null, feature?: CountryFeature) => {
    if (webglEngineRef.current) {
      const isDark = config.colorTheme === 'dark';
      const defaultLand = isDark ? '#262624' : '#fdfcf8';
      webglEngineRef.current.updateSingleCountryColor(countryId, color, defaultLand, isDark);
    }
    onPaintCountry(countryId, color, feature);
  }, [config.colorTheme, onPaintCountry]);

  const renderRef = useRef<(() => void) | null>(null);

  renderRef.current = () => {
    try {
        const startDraw = performance.now();
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

      // 1. Update projection's rotation based on local interactive rotation ref
      const isSwiping = isDragging.current && (config.swipeSelection || activeTool === 'paint' || activeTool === 'eraser');
      const isInteracting = (isDragging.current || isWheelingRef.current || isPinchingRef.current || isSliderPanningRef.current) && !isSwiping;

      const rotChanged = 
        localRotationRef.current.lon !== lastDrawnRotationRef.current.lon ||
        localRotationRef.current.lat !== lastDrawnRotationRef.current.lat ||
        (config.aspect || 0) !== ((lastDrawnRotationRef.current as any).aspect || 0);

      if (rotChanged) {
        try {
          projection.rotate([-localRotationRef.current.lon, -localRotationRef.current.lat, config.aspect || 0]);
        } catch (e) {}
        
        // Clear rotation-dependent path caches
        path2DCacheRef.current.clear();
        if (!isDraggingGlobe.current) {
          projectedBBoxCacheRef.current.clear();
        }
        geomProjectedBoundsCacheRef.current = new WeakMap();
        graticulePath2DRef.current = null;
        graticuleCacheRef.current.clear();
        baseBordersPath2DRef.current = null;
        customBordersPath2DRef.current.clear();
        previewBorderPath2DRef.current = null;
        cachedLabelsToRenderRef.current = null;
        cachedLabelsKeyRef.current = null;
        labelRenderCacheMapRef.current.clear();
        
        needsBaseRedrawRef.current = true;
        lastDrawnRotationRef.current = {
          lon: localRotationRef.current.lon,
          lat: localRotationRef.current.lat,
          aspect: config.aspect || 0,
        };
      }

      const currentPan = interactiveViewportRef.current.pan;
      const currentZoom = interactiveViewportRef.current.zoom;

      const dpr = window.devicePixelRatio || 1;
      const currentHover = hoveredCountryRef.current;
      const hoverId = currentHover ? getCountryId(currentHover) : '';
      const selectId = selectedCountryRef.current ? getCountryId(selectedCountryRef.current) : '';

      const hasChanged = 
        needsBaseRedrawRef.current ||
        currentPan.x !== lastDrawnStateRef.current.panX ||
        currentPan.y !== lastDrawnStateRef.current.panY ||
        currentZoom !== lastDrawnStateRef.current.zoom ||
        dimensions.width !== lastDrawnStateRef.current.width ||
        dimensions.height !== lastDrawnStateRef.current.height ||
        hoverId !== lastDrawnStateRef.current.hoveredId ||
        selectId !== lastDrawnStateRef.current.selectedId ||
        dpr !== lastDrawnStateRef.current.dpr ||
        isInteracting !== lastDrawnStateRef.current.isInteracting;

      if (!hasChanged) {
        return;
      }

      const targetWidth = Math.floor(dimensions.width * dpr);
      const targetHeight = Math.floor(dimensions.height * dpr);

      const isChangingProjectionParams = isDraggingGlobe.current || isSliderPanningRef.current;
      if (!isChangingProjectionParams && wasChangingProjectionParamsRef.current) {
        path2DCacheRef.current.clear();
        customBordersPath2DRef.current.clear();
        needsBaseRedrawRef.current = true;
      }
      if (!isInteracting && wasInteractingLastRef.current) {
        if (baseRedrawTimeoutRef.current) {
          clearTimeout(baseRedrawTimeoutRef.current);
        }
        baseRedrawTimeoutRef.current = setTimeout(() => {
          needsBaseRedrawRef.current = true;
          baseRedrawTimeoutRef.current = null;
        }, 50);
      }

      wasChangingProjectionParamsRef.current = isChangingProjectionParams;
      wasInteractingLastRef.current = isInteracting;
      wasDraggingGlobeLastRef.current = isDraggingGlobe.current;

      const overscanFactor = 1.5;
      const marginX = dimensions.width * 0.25;
      const marginY = dimensions.height * 0.25;
      const rawBaseWidth = Math.max(1, Math.floor(dimensions.width * overscanFactor * dpr));
      const rawBaseHeight = Math.max(1, Math.floor(dimensions.height * overscanFactor * dpr));
      // Safe maximum dimension for mobile GPUs and canvas memory limits (2048px on standard, 4096px on high-end)
      const maxBaseDim = 2048;
      const baseScale = Math.min(1, maxBaseDim / Math.max(rawBaseWidth, rawBaseHeight));
      const targetBaseWidth = Math.max(1, Math.floor(rawBaseWidth * baseScale));
      const targetBaseHeight = Math.max(1, Math.floor(rawBaseHeight * baseScale));
      const baseDpr = dpr * baseScale;

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        needsBaseRedrawRef.current = true;
      }

      if (webglCanvasRef.current && (webglCanvasRef.current.width !== targetWidth || webglCanvasRef.current.height !== targetHeight)) {
        webglCanvasRef.current.width = targetWidth;
        webglCanvasRef.current.height = targetHeight;
        if (webglEngineRef.current) {
          webglEngineRef.current.resize(dimensions.width, dimensions.height, dpr);
        }
      }

      // Initialize or retrieve offscreen base canvas representing the full map
      if (!baseCanvasRef.current) {
        baseCanvasRef.current = document.createElement('canvas');
      }
      const baseCanvas = baseCanvasRef.current;
      if (baseCanvas.width !== targetBaseWidth || baseCanvas.height !== targetBaseHeight) {
        baseCanvas.width = targetBaseWidth;
        baseCanvas.height = targetBaseHeight;
        needsBaseRedrawRef.current = true;
      }

      const baseCtx = baseCanvas.getContext('2d');
      let wasRedrawn = false;

      const isDark = config.colorTheme === 'dark';
      
      // 2. Determine Ocean Water Color
      const oceanColor = (config.customOceanColor && config.customOceanColor !== 'default')
        ? config.customOceanColor
        : (isDark ? '#111e35' : '#bae6fd');

      // 1. Determine Map Background Color (canvas background)
      const mapBgColor = (config.customOceanColor && config.customOceanColor !== 'default')
        ? config.customOceanColor
        : ((config.customBgColor && config.customBgColor !== 'default')
          ? config.customBgColor
          : oceanColor);
      const bgColor = mapBgColor;

      // 3. Determine Skybox Color (outside globe in orthographic mode)
      let skyboxColor = isDark ? '#09090b' : '#f8fafc';
      if (config.customSkyboxColor && config.customSkyboxColor !== 'default') {
        skyboxColor = config.customSkyboxColor;
      }

      const drawMapContent = (offscreenCtx: CanvasRenderingContext2D, renderDpr: number, isExport: boolean = false) => {
        const dpr = renderDpr;
        const fontFam = config.labelFontFamily || 'georgia';
        const getFontString = (sizePx: number) => getLabelFontString(fontFam, sizePx);
        const currentZoom = isExport ? 1 : (interactiveViewportRef.current.zoom || 1);
        const currentPan = isExport ? { x: 0, y: 0 } : (interactiveViewportRef.current.pan || { x: 0, y: 0 });
        const curBaseW = isExport ? projDimensions.width : Math.floor(dimensions.width * overscanFactor);
        const curBaseH = isExport ? projDimensions.height : Math.floor(dimensions.height * overscanFactor);
        const curMarginX = isExport ? 0 : marginX;
        const curMarginY = isExport ? 0 : marginY;

        // Always reset transform matrix first so scaling never compounds on errors or re-renders
        offscreenCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        offscreenCtx.imageSmoothingEnabled = true;
        offscreenCtx.imageSmoothingQuality = 'high';
        offscreenCtx.lineJoin = 'round';
        offscreenCtx.lineCap = 'round';
        try {
          (offscreenCtx as any).textRendering = 'geometricPrecision';
        } catch (e) {}
        offscreenCtx.save();
        offscreenCtx.setLineDash([]);
        offscreenCtx.clearRect(0, 0, curBaseW, curBaseH);

        // 3. Determine Boundary (Border) Color
        const boundaryColor = config.borderColor && config.borderColor !== 'default'
          ? config.borderColor
          : (isDark ? '#334155' : '#94a3b8');
        
        const graticuleColor = config.graticuleColor && config.graticuleColor !== 'default'
          ? config.graticuleColor
          : (isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.12)');

        // Clear background: workspace bgColor for overall canvas; if not orthographic, fill mapBgColor
        offscreenCtx.fillStyle = bgColor;
        offscreenCtx.fillRect(0, 0, curBaseW, curBaseH);

        if (!isOrthographicProj) {
          offscreenCtx.fillStyle = mapBgColor;
          offscreenCtx.fillRect(0, 0, curBaseW, curBaseH);
        }

        offscreenCtx.save();
        if (!isExport) {
          offscreenCtx.translate(curMarginX, curMarginY);
        }
        offscreenCtx.translate(currentPan.x, currentPan.y);
        offscreenCtx.scale(currentZoom, currentZoom);

        const globeRadius90 = Math.min(projDimensions.width, projDimensions.height) * 0.45 * config.zoom;
        const globeCenterX = projDimensions.width / 2;
        const globeCenterY = projDimensions.height / 2;

        const edgeAngle = Math.max(1, Math.min(90, config.edgeAngle !== undefined ? config.edgeAngle : 90));
        const edgeAngleRad = (edgeAngle * Math.PI) / 180;
        const orthoMagnification = 1 / Math.sin(edgeAngleRad);
        const globeRadius = globeRadius90 * orthoMagnification;

        const rectWidth = globeRadius90 * 2;
        const rectHeight = globeRadius90 * 2;
        const rectX = globeCenterX - globeRadius90;
        const rectY = globeCenterY - globeRadius90;

        let hasOrthoRectClip = false;
        if (isOrthographicProj) {
          // Confine orthographic map inside the second rectangular map border
          offscreenCtx.save();
          offscreenCtx.beginPath();
          offscreenCtx.rect(rectX, rectY, rectWidth, rectHeight);
          offscreenCtx.clip();
          hasOrthoRectClip = true;

          // Fill skybox inside the second rectangular map border
          offscreenCtx.fillStyle = skyboxColor;
          offscreenCtx.fillRect(rectX, rectY, rectWidth, rectHeight);
        }

        const pathGenerator = d3.geoPath(projection, offscreenCtx);

        // Fast O(1) projected bounding box retriever with automatic caching to guarantee buttery-smooth 60fps panning & zooming
        const getOrCreateGeomProjectedBounds = (geom: any): [[number, number], [number, number]] | null => {
          let cached = geomProjectedBoundsCacheRef.current.get(geom);
          if (cached) return cached;

          try {
            const bounds = pathGenerator.bounds(geom);
            if (bounds && isFinite(bounds[0][0]) && isFinite(bounds[0][1]) && isFinite(bounds[1][0]) && isFinite(bounds[1][1])) {
              geomProjectedBoundsCacheRef.current.set(geom, bounds);
              return bounds;
            }
          } catch (e) {}
          return null;
        };

        // 1. If orthographic, draw beautiful solid ocean background globe disc using oceanColor
        if (isOrthographicProj) {
          offscreenCtx.beginPath();
          offscreenCtx.arc(globeCenterX, globeCenterY, globeRadius, 0, Math.PI * 2);
          offscreenCtx.fillStyle = oceanColor;
          offscreenCtx.fill();
        } else if (!isNoGeoref) {
          // For flat maps, fill the sphere boundary with oceanColor
          try {
            offscreenCtx.beginPath();
            pathGenerator({ type: 'Sphere' });
            offscreenCtx.fillStyle = oceanColor;
            offscreenCtx.fill();
          } catch (e) {}
        }

        let hasSphereClip = false;
        if (isOrthographicProj) {
          offscreenCtx.save();
          offscreenCtx.beginPath();
          offscreenCtx.arc(globeCenterX, globeCenterY, globeRadius + 0.5, 0, Math.PI * 2);
          offscreenCtx.clip();
          hasSphereClip = true;
        } else if (!isNoGeoref) {
          try {
            offscreenCtx.save();
            offscreenCtx.beginPath();
            pathGenerator({ type: 'Sphere' });
            offscreenCtx.clip();
            hasSphereClip = true;
          } catch (e) {}
        }

        // Resolve the raw background pixel data using the lightweight descriptor
        let decodedBgImage: { width: number; height: number; data: Uint8ClampedArray | null } | null = null;
        if (decodedBgDescriptor && !isNoGeoref) {
          const rawBgData = globalDecodedBgRegistry.get(decodedBgDescriptor.cacheKey);
          decodedBgImage = {
            width: decodedBgDescriptor.width,
            height: decodedBgDescriptor.height,
            data: rawBgData || null,
          };
        }

        // 1b. Draw projected raster background map image if loaded
        if (decodedBgImage) {
          const baseW = isExport ? projDimensions.width : (dimensions.width > 0 ? dimensions.width : 600);
          const baseH = isExport ? projDimensions.height : (dimensions.height > 0 ? dimensions.height : 400);
          const isInteracting = isDragging.current || isDraggingGlobe.current || isWheelingRef.current || isPinchingRef.current;
          const totalZoom = config.zoom * currentZoom;

          const webgpuEngine = null; // Bypassed: 2D Canvas context cannot draw WebGPU canvas context via drawImage
          let webgpuRendered = false;

          // Attempt WebGPU hardware acceleration rendering pass first
          if (webgpuEngine && decodedBgImage && decodedBgImage.data) {
            let projType = -1;
            if (config.projection === 'equirectangular') projType = 0;
            else if (config.projection === 'mercator') projType = 1;
            else if (config.projection === 'orthographic') projType = 2;
            else if (config.projection === 'azimuthalEqualArea') projType = 3;
            else if (config.projection === 'gnomonic') projType = 4;
            else if (config.projection === 'mollweide') projType = 5;
            else if (config.projection === 'miller') projType = 6;
            else if (config.projection === 'winkel1' || config.projection === 'winkel2' || config.projection === 'winkel3') projType = 7;
            else if (config.projection === 'equalEarth') projType = 8;
            else if (config.projection === 'robinson') projType = 9;
            else if (config.projection === 'sinusoidal') projType = 10;
            else if (config.projection === 'eckert1') projType = 11;
            else if (config.projection === 'eckert4') projType = 12;
            else if (config.projection === 'times') projType = 13;
            else if (config.projection === 'aitoff') projType = 14;
            else if (config.projection === 'eckert2') projType = 15;
            else if (config.projection === 'eckert3') projType = 16;
            else if (config.projection === 'eckert5') projType = 17;
            else if (config.projection === 'eckert6') projType = 18;
            else if (config.projection === 'gallPeters') projType = 19;
            else if (config.projection === 'collignon') projType = 20;
            else if (config.projection === 'gallStereographic') projType = 21;
            else if (config.projection === 'lambert') projType = 22;
            else if (config.projection === 'centralCylindrical') projType = 23;

            if (projType !== -1) {
              const targetCanvas = webgpuCanvasRef.current || bgCanvasRef.current || document.createElement('canvas');
              const baseW = isExport ? projDimensions.width : (dimensions.width > 0 ? dimensions.width : 600);
              const baseH = isExport ? projDimensions.height : (dimensions.height > 0 ? dimensions.height : 400);
              const quality = isExport ? 3.0 : Math.min(2.0, Math.max(dpr, 1.25));
              const rawBgW = Math.max(1, Math.round(baseW * quality));
              const rawBgH = Math.max(1, Math.round(baseH * quality));
              const maxBgDim = isExport ? 6000 : 2048;
              const bgAspectScale = Math.min(1, maxBgDim / Math.max(rawBgW, rawBgH));
              const bgW = Math.max(1, Math.round(rawBgW * bgAspectScale));
              const bgH = Math.max(1, Math.round(rawBgH * bgAspectScale));

              webgpuRendered = webgpuEngine.renderToCanvas(targetCanvas, decodedBgImage, {
                bgW,
                bgH,
                dimensionsWidth: baseW,
                dimensionsHeight: baseH,
                srcW: decodedBgImage.width,
                srcH: decodedBgImage.height,
                projectionType: projType,
                centerLon: localRotationRef.current.lon,
                centerLat: localRotationRef.current.lat,
                zoom: config.zoom,
                globeRadius,
                globeCenterX,
                globeCenterY,
                opacity: config.bgImageOpacity ?? 1.0,
                panX: currentPan.x,
                panY: currentPan.y,
                viewportZoom: currentZoom,
                aspect: config.aspect || 0,
              });

              if (webgpuRendered) {
                lastProjectedStateRef.current = {
                  projection: config.projection,
                  zoom: config.zoom,
                  currentZoom,
                  currentPanX: currentPan.x,
                  currentPanY: currentPan.y,
                  rotationLon: localRotationRef.current.lon,
                  rotationLat: localRotationRef.current.lat,
                  aspect: config.aspect || 0,
                  width: isExport ? projDimensions.width : curBaseW,
                  height: isExport ? projDimensions.height : curBaseH,
                  decodedBgImage: decodedBgDescriptor,
                  bgProgress: bgProgress ?? 0,
                  opacity: config.bgImageOpacity ?? 1.0,
                  isInteracting: false,
                };
              }
            }
          }

          // Fallback to AssemblyScript WebAssembly CPU Engine if WebGPU is unsupported or context lost
          if (!webgpuRendered) {
            const baseW = isExport ? projDimensions.width : (dimensions.width > 0 ? dimensions.width : 600);
            const baseH = isExport ? projDimensions.height : (dimensions.height > 0 ? dimensions.height : 400);
            const currentViewportZoom = currentZoom || 1;

            const isInteractingLocally = isDragging.current || isDraggingGlobe.current || isWheelingRef.current || isPinchingRef.current || isSliderPanningRef.current;

            let qualityFactor: number;
            if (isExport) {
              qualityFactor = Math.max(dpr, 3.0);
            } else if (isInteractingLocally) {
              // Lightweight preview during interactive navigation for responsive 60fps tracking
              qualityFactor = 0.35;
            } else {
              // Crisp, full screen raster resolution when zoomed out (no artificial downscaling penalty)
              qualityFactor = Math.min(2.0, Math.max(dpr, 1.35));
            }

            const rawW = Math.max(1, Math.round(baseW * qualityFactor));
            const rawH = Math.max(1, Math.round(baseH * qualityFactor));
            const maxBgDim = isExport ? 6000 : 2048;
            const bgScale = Math.min(1, maxBgDim / Math.max(rawW, rawH));
            const bgW = Math.max(1, Math.round(rawW * bgScale));
            const bgH = Math.max(1, Math.round(rawH * bgScale));

            const lastState = lastProjectedStateRef.current;
            const zoomRatio = lastState ? Math.max(currentViewportZoom / (lastState.currentZoom || 1), (lastState.currentZoom || 1) / currentViewportZoom) : 1;
            const panDist = lastState ? Math.hypot(currentPan.x - (lastState.currentPanX ?? currentPan.x), currentPan.y - (lastState.currentPanY ?? currentPan.y)) : 0;

            const isInteracting = isDragging.current || isDraggingGlobe.current || isWheelingRef.current || isPinchingRef.current || isSliderPanningRef.current;

            // During 2D interactive panning or zooming, GPU hardware canvas affine transform tracks the mouse at 60fps with zero lag
            const is2DInteraction = isInteracting && config.projection !== 'orthographic' && !!lastState;

            const highResNeeded = !is2DInteraction && (isExport || ((!lastState ||
              lastState.projection !== config.projection ||
              lastState.zoom !== config.zoom ||
              zoomRatio !== 1 ||
              panDist > 0.5 ||
              lastState.rotationLon !== localRotationRef.current.lon ||
              lastState.rotationLat !== localRotationRef.current.lat ||
              lastState.aspect !== (config.aspect || 0) ||
              lastState.width !== (isExport ? projDimensions.width : baseW) ||
              lastState.height !== (isExport ? projDimensions.height : baseH) ||
              lastState.decodedBgImage !== decodedBgDescriptor ||
              lastState.bgProgress !== bgProgress ||
              lastState.opacity !== (config.bgImageOpacity ?? 1.0)) && (!isInteracting || !lastState)));

            if (highResNeeded) {
              let projType = -1;
              if (config.projection === 'equirectangular') projType = 0;
              else if (config.projection === 'mercator') projType = 1;
              else if (config.projection === 'orthographic') projType = 2;
              else if (config.projection === 'azimuthalEqualArea') projType = 3;
              else if (config.projection === 'gnomonic') projType = 4;
              else if (config.projection === 'mollweide') projType = 5;
              else if (config.projection === 'miller') projType = 6;
              else if (config.projection === 'winkel1' || config.projection === 'winkel2' || config.projection === 'winkel3') projType = 7;
              else if (config.projection === 'equalEarth') projType = 8;
              else if (config.projection === 'robinson') projType = 9;
              else if (config.projection === 'sinusoidal') projType = 10;
              else if (config.projection === 'eckert1') projType = 11;
              else if (config.projection === 'eckert4') projType = 12;
              else if (config.projection === 'times') projType = 13;
              else if (config.projection === 'aitoff') projType = 14;
              else if (config.projection === 'eckert2') projType = 15;
              else if (config.projection === 'eckert3') projType = 16;
              else if (config.projection === 'eckert5') projType = 17;
              else if (config.projection === 'eckert6') projType = 18;
              else if (config.projection === 'gallPeters') projType = 19;
              else if (config.projection === 'collignon') projType = 20;
              else if (config.projection === 'gallStereographic') projType = 21;
              else if (config.projection === 'lambert') projType = 22;
              else if (config.projection === 'centralCylindrical') projType = 23;

              if (projType !== -1 && wasmEngine) {
                if (!bgCanvasRef.current) {
                  bgCanvasRef.current = document.createElement('canvas');
                }
                const bgCanvas = bgCanvasRef.current;
                
                const isProjectionChange = lastState && lastState.projection !== config.projection;

                if (bgCanvas.width !== bgW || bgCanvas.height !== bgH) {
                  bgCanvas.width = bgW;
                  bgCanvas.height = bgH;
                }

                const bgCtx = bgCanvas.getContext('2d');
                if (bgCtx) {
                  if (isProjectionChange) {
                    bgCtx.clearRect(0, 0, bgW, bgH);
                  }

                  // Render 100% of rows synchronously in WASM for instant, complete frame
                  try {
                    const wasmPixels = executeWasmRemap(
                      wasmEngine,
                      decodedBgImage.data,
                      decodedBgImage.width,
                      decodedBgImage.height,
                      bgW,
                      bgH,
                      baseW,
                      baseH,
                      projType,
                      localRotationRef.current.lon,
                      localRotationRef.current.lat,
                      config.aspect || 0,
                      config.zoom,
                      globeRadius,
                      globeCenterX,
                      globeCenterY,
                      config.bgImageOpacity ?? 1.0,
                      currentPan.x,
                      currentPan.y,
                      currentViewportZoom,
                      0,
                      bgH
                    );

                    const fullBytes = bgW * bgH * 4;
                    const fullImgData = new ImageData(
                      new Uint8ClampedArray(wasmPixels.buffer, wasmPixels.byteOffset, fullBytes),
                      bgW,
                      bgH
                    );
                    bgCtx.putImageData(fullImgData, 0, 0);
                  } catch (e) {
                    console.error("WASM remapper execution failed:", e);
                  }
                }
              }

              // Update the cache state
              lastProjectedStateRef.current = {
                projection: config.projection,
                zoom: config.zoom,
                currentZoom: currentViewportZoom,
                currentPanX: currentPan.x,
                currentPanY: currentPan.y,
                rotationLon: localRotationRef.current.lon,
                rotationLat: localRotationRef.current.lat,
                aspect: config.aspect || 0,
                width: isExport ? projDimensions.width : baseW,
                height: isExport ? projDimensions.height : baseH,
                decodedBgImage: decodedBgDescriptor,
                bgProgress: bgProgress ?? 0,
                opacity: config.bgImageOpacity ?? 1.0,
              };
            }
          }

          const activeBgCanvas = webgpuRendered
            ? (webgpuCanvasRef.current || bgCanvasRef.current)
            : bgCanvasRef.current;

          if (activeBgCanvas) {
            // Keep a 2D copy of the active background frame for SVG exports
            try {
              if (!bgExportCanvasRef.current) {
                bgExportCanvasRef.current = document.createElement('canvas');
              }
              const bgExportCanvas = bgExportCanvasRef.current;
              if (bgExportCanvas.width !== baseW || bgExportCanvas.height !== baseH) {
                bgExportCanvas.width = baseW;
                bgExportCanvas.height = baseH;
              }
              const bgExportCtx = bgExportCanvas.getContext('2d');
              if (bgExportCtx) {
                bgExportCtx.clearRect(0, 0, baseW, baseH);
                bgExportCtx.drawImage(activeBgCanvas, 0, 0, baseW, baseH);
              }
            } catch (e) {
              console.warn("Could not copy background canvas for export:", e);
            }

            // Draw the projected background canvas onto our main offscreenCtx in screen space!
            offscreenCtx.save();
            offscreenCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

            // Position at viewport origin within baseCanvas (accounting for overscan margins)
            if (!isExport) {
              offscreenCtx.translate(curMarginX, curMarginY);
            }

            // OPTIMIZATION FIX: Apply an affine transform (scale & translate) to the cached background
            // frame so that it tracks perfectly with the vector features during 2D panning and zooming,
            // completely eliminating the "lagging behind" effect when the user drags the map!
            if (lastProjectedStateRef.current && config.projection !== 'orthographic') {
              const last = lastProjectedStateRef.current;
              const curZoom = currentZoom || 1;
              const curPan = currentPan || { x: 0, y: 0 };
              const ratio = curZoom / (last.currentZoom || 1);
              const tx = curPan.x - (last.currentPanX ?? 0) * ratio;
              const ty = curPan.y - (last.currentPanY ?? 0) * ratio;
              offscreenCtx.translate(tx, ty);
              offscreenCtx.scale(ratio, ratio);
            }

            const isInteractingNow = isDragging.current || isDraggingGlobe.current || isWheelingRef.current || isPinchingRef.current || isSliderPanningRef.current;
            offscreenCtx.imageSmoothingEnabled = true;
            offscreenCtx.imageSmoothingQuality = isInteractingNow ? 'medium' : 'high';
            offscreenCtx.drawImage(activeBgCanvas, 0, 0, baseW, baseH);
            offscreenCtx.restore();
          }
        }

        // 2. Perform precise viewport frustum culling using cached exact projected bounding box (Mapshaper / GIS standard)
        const visibleFeatures: CountryFeature[] = [];
        
        const lon0Rad = (localRotationRef.current.lon * Math.PI) / 180;
        const lat0Rad = (localRotationRef.current.lat * Math.PI) / 180;
        const sin_lat0 = Math.sin(lat0Rad);
        const cos_lat0 = Math.cos(lat0Rad);

        const projScaleKey = Math.round(projection.scale());
        const projAspectKey = Math.round((config.aspect || 0) * 10) / 10;
        const projCacheKey = `${config.projection}_s${projScaleKey}_r${Math.round(localRotationRef.current.lon)}_${Math.round(localRotationRef.current.lat)}_a${projAspectKey}`;

        // Viewport bounding box with generous overscan safety buffer
        const viewMinX = -marginX - 40;
        const viewMinY = -marginY - 40;
        const viewMaxX = dimensions.width + marginX + 40;
        const viewMaxY = dimensions.height + marginY + 40;

        features.forEach((feature) => {
          if (isOrthographicProj) {
            const trig = getCentroidTrig(feature, centroidTrigCacheRef.current, centroidCacheRef.current);
            if (trig) {
              const cos_c = sin_lat0 * trig.sin_lat + cos_lat0 * trig.cos_lat * Math.cos(trig.lonRad - lon0Rad);
              const geoRadiusRad = (getFeatureGeoRadius(feature, trig, isNoGeoref) * Math.PI) / 180;
              const limit = -Math.sin(geoRadiusRad) - 0.05; // 0.05 safe buffer margin
              if (cos_c < limit) return; // Behind 3D globe sphere
            }
          } else if (config.projection === 'gnomonic' && !isNoGeoref) {
            const trig = getCentroidTrig(feature, centroidTrigCacheRef.current, centroidCacheRef.current);
            if (trig) {
              const cos_c = sin_lat0 * trig.sin_lat + cos_lat0 * trig.cos_lat * Math.cos(trig.lonRad - lon0Rad);
              const geoRadiusRad = (getFeatureGeoRadius(feature, trig, isNoGeoref) * Math.PI) / 180;
              const maxAngleRad = (85 * Math.PI) / 180;
              const limit = Math.cos(Math.min(Math.PI - 0.01, maxAngleRad + geoRadiusRad));
              if (cos_c < limit) return; // Behind horizon
            }
          } else {
            // Planar 2D viewport frustum culling (Mapshaper / Pax Historia standard)
            const bounds = getFeatureProjectedBounds(feature, projection, projCacheKey, isNoGeoref);
            if (bounds) {
              const [bx0, by0, bx1, by1] = bounds;
              // Outside visible canvas overscan rect
              if (bx1 < viewMinX || bx0 > viewMaxX || by1 < viewMinY || by0 > viewMaxY) {
                return;
              }
              // Sub-pixel LOD pruning: if polygon bounding box is microscopic (< 0.25px), skip heavy rendering
              if ((bx1 - bx0) < 0.25 && (by1 - by0) < 0.25 && !(feature as any)._enlarged) {
                return;
              }
            }
          }

          visibleFeatures.push(feature);
        });

        // 3. Batch and draw land fills (hybrid strategy: direct draw when dragging, Path2D when static)
        // Helper to retrieve or create Path2D for selections/highlights
        const getOrCreatePath2D = (feature: CountryFeature): Path2D | null => {
          const countryId = getCountryId(feature) + ((feature as any)._enlarged ? '_enlarged' : '');
          const scaleKey = Math.round(projection.scale());
          const rotLonKey = Math.round(localRotationRef.current ? localRotationRef.current.lon : (config.centerLon || 0));
          const rotLatKey = Math.round(localRotationRef.current ? localRotationRef.current.lat : (config.centerLat || 0));
          const aspectKey = Math.round((config.aspect || 0) * 10) / 10;
          const cacheKey = `${config.projection}_${countryId}_s${scaleKey}_r${rotLonKey}_${rotLatKey}_a${aspectKey}`;
          let path2d = path2DCacheRef.current.get(cacheKey);
          if (!path2d) {
            try {
              const pathStr = d3.geoPath(projection)(feature);
              if (pathStr && !pathStr.includes('NaN') && !pathStr.includes('undefined')) {
                path2d = new Path2D(pathStr);
                if (path2DCacheRef.current.size > 3000) {
                  const firstKey = path2DCacheRef.current.keys().next().value;
                  if (firstKey) path2DCacheRef.current.delete(firstKey);
                }
                path2DCacheRef.current.set(cacheKey, path2d);
              }
            } catch (e) {
              console.warn('Error generating Path2D for feature:', countryId, e);
            }
          }
          return path2d || null;
        };

        // Draw land fills with projection safety guards and correct path isolation
        const savedGlobalAlpha = offscreenCtx.globalAlpha;
        const targetLandOpacity = config.landOpacity !== undefined ? config.landOpacity : 1.0;
        offscreenCtx.globalAlpha = targetLandOpacity * savedGlobalAlpha;

        const totalZoom = config.zoom * currentZoom;
        const enlargedFeatures: CountryFeature[] = [];

        // Partition visibleFeatures into customFlagGroups, enlargedFeatures, and normalFeatures
        const customFlagGroups = new Map<string, CountryFeature[]>();
        const normalFeatures: CountryFeature[] = [];

        visibleFeatures.forEach((feature) => {
          if (feature._enlarged) {
            enlargedFeatures.push(feature);
            return;
          }

          const countryId = getCountryId(feature);
          let fillColor = '';
          if (customColors) {
            if (customColors[countryId]) {
              fillColor = customColors[countryId];
            } else if (feature.properties.adm0_a3 && customColors[feature.properties.adm0_a3]) {
              fillColor = customColors[feature.properties.adm0_a3];
            } else if (feature.properties.admin && customColors[feature.properties.admin]) {
              fillColor = customColors[feature.properties.admin];
            }
          }

          if (fillColor && fillColor.startsWith('flag:')) {
            const rawCode = fillColor.substring(5).trim();
            const flagCode = (rawCode.startsWith('http://') || rawCode.startsWith('https://') || rawCode.startsWith('data:'))
              ? rawCode
              : rawCode.toLowerCase();
            if (flagCode) {
              let group = customFlagGroups.get(flagCode);
              if (!group) {
                group = [];
                customFlagGroups.set(flagCode, group);
              }
              group.push(feature);
              return;
            }
          }

          if (!fillColor && config.showFlags && selectedMapFile !== 'mappa_mundi_hoi4.json' && selectedMapFile !== 'world_ecoregions.json' && !isOceanFeature(feature)) {
            const isoA2 = getFeatureIsoA2(feature);
            if (isoA2) {
              let group = customFlagGroups.get(isoA2);
              if (!group) {
                group = [];
                customFlagGroups.set(isoA2, group);
              }
              group.push(feature);
              return;
            }
          }

          normalFeatures.push(feature);
        });

        // 1. Draw custom flag groups (continuous flag drawing rule!)
        customFlagGroups.forEach((groupFeatures, flagCode) => {
          const img = getOrLoadFlag(flagCode, () => {
            needsBaseRedrawRef.current = true;
          });

          // Collect all sub-geometries of all features in this group with their screen bounds
          const geomItems: GeometryItem[] = [];
          groupFeatures.forEach((feat) => {
            const activeFeat = getSimplifiedFeature(feat, totalZoom);
            if (activeFeat && activeFeat.geometry) {
              const subGeoms: any[] = [];
              if (activeFeat.geometry.type === 'Polygon') {
                subGeoms.push(activeFeat.geometry);
              } else if (activeFeat.geometry.type === 'MultiPolygon') {
                const coords = activeFeat.geometry.coordinates;
                if (Array.isArray(coords)) {
                  coords.forEach((polyCoords) => {
                    subGeoms.push({
                      type: 'Polygon',
                      coordinates: polyCoords
                    });
                  });
                }
              } else {
                subGeoms.push(activeFeat.geometry);
              }

              subGeoms.forEach((geom) => {
                const bounds = getOrCreateGeomProjectedBounds(geom);
                if (!bounds) return;

                let geoBounds = geomBoundsCacheRef.current.get(geom);
                if (!geoBounds) {
                  geoBounds = getGeographicBounds(geom);
                  geomBoundsCacheRef.current.set(geom, geoBounds);
                }

                geomItems.push({
                  geom,
                  feat,
                  bounds,
                  minX: bounds[0][0],
                  minY: bounds[0][1],
                  maxX: bounds[1][0],
                  maxY: bounds[1][1],
                  geoMinLon: geoBounds.minLon,
                  geoMinLat: geoBounds.minLat,
                  geoMaxLon: geoBounds.maxLon,
                  geoMaxLat: geoBounds.maxLat,
                });
              });
            }
          });

          // Cluster the sub-geometries by geographic distance (2.5 degrees) to avoid stretching across disconnected polygons (like Alaska or islands)
          const clusters = clusterGeometryItems(geomItems, 2.5);

          clusters.forEach((cluster) => {
            // Compute combined bounds for this cluster
            let combinedMinX = Infinity;
            let combinedMinY = Infinity;
            let combinedMaxX = -Infinity;
            let combinedMaxY = -Infinity;

            cluster.forEach((item) => {
              combinedMinX = Math.min(combinedMinX, item.minX);
              combinedMinY = Math.min(combinedMinY, item.minY);
              combinedMaxX = Math.max(combinedMaxX, item.maxX);
              combinedMaxY = Math.max(combinedMaxY, item.maxY);
            });

            const hasValidBounds = combinedMinX < combinedMaxX && combinedMinY < combinedMaxY;

            cluster.forEach((item) => {
              const geom = item.geom;

              if (img && hasValidBounds) {
                offscreenCtx.save();

                // Clip to this individual sub-polygon shape
                offscreenCtx.beginPath();
                pathGenerator(geom);
                offscreenCtx.clip();

                // Draw the flag using the combined bounding box coordinates of this cluster!
                const x = combinedMinX;
                const y = combinedMinY;
                const w = combinedMaxX - combinedMinX;
                const h = combinedMaxY - combinedMinY;

                if (w > 0 && h > 0) {
                  const imgW = img.width > 0 ? img.width : 3;
                  const imgH = img.height > 0 ? img.height : 2;
                  const imgRatio = imgW / imgH;
                  const boxRatio = w / h;

                  let drawW = w;
                  let drawH = h;
                  let drawX = x;
                  let drawY = y;

                  if (boxRatio > imgRatio) {
                    drawW = w;
                    drawH = w / imgRatio;
                    drawX = x;
                    drawY = y + (h - drawH) / 2;
                  } else {
                    drawW = h * imgRatio;
                    drawH = h;
                    drawX = x + (w - drawW) / 2;
                    drawY = y;
                  }

                  offscreenCtx.drawImage(img, drawX, drawY, drawW, drawH);
                }

                offscreenCtx.restore();
              } else {
                // Draw fallback solid fill (e.g. land fill color or standard light/dark background color)
                const fallbackFill = isDark ? '#262624' : '#fdfcf8';
                const resolvedFill = getOrCreatePattern(offscreenCtx, fallbackFill, currentZoom);
                offscreenCtx.fillStyle = resolvedFill;
                offscreenCtx.save();
                offscreenCtx.beginPath();
                pathGenerator(geom);
                offscreenCtx.fill();
                offscreenCtx.restore();
              }
            });
          });
        });

        // 2. Draw normal features
        const fillGroups = new Map<string | CanvasPattern, CountryFeature[]>();

        normalFeatures.forEach((feature) => {
          const countryId = getCountryId(feature);

          let fillColor = isOceanFeature(feature) ? oceanColor : (isDark ? '#262624' : '#fdfcf8'); // Default land or ocean fill
          if (customColors) {
            if (customColors[countryId]) {
              fillColor = customColors[countryId];
            } else if (feature.properties.adm0_a3 && customColors[feature.properties.adm0_a3]) {
              fillColor = customColors[feature.properties.adm0_a3];
            } else if (feature.properties.admin && customColors[feature.properties.admin]) {
              fillColor = customColors[feature.properties.admin];
            }
          }

          const resolvedFill = getOrCreatePattern(offscreenCtx, fillColor, currentZoom);
          let group = fillGroups.get(resolvedFill);
          if (!group) {
            group = [];
            fillGroups.set(resolvedFill, group);
          }
          group.push(feature);
        });

        fillGroups.forEach((groupFeatures, fillStyle) => {
          offscreenCtx.fillStyle = fillStyle;
          offscreenCtx.setLineDash([]);

          const compoundBatch = new Path2D();
          let hasBatchGeometry = false;

          groupFeatures.forEach((feature) => {
            try {
              const path2d = getOrCreatePath2D(feature);
              if (path2d) {
                compoundBatch.addPath(path2d);
                hasBatchGeometry = true;
              } else {
                const drawFeature = getSimplifiedFeature(feature, totalZoom);
                const pathStr = d3.geoPath(projection)(drawFeature);
                if (pathStr && !pathStr.includes('NaN') && !pathStr.includes('undefined')) {
                  compoundBatch.addPath(new Path2D(pathStr));
                  hasBatchGeometry = true;
                }
              }
            } catch (e) {}
          });

          if (hasBatchGeometry) {
            try {
              offscreenCtx.fill(compoundBatch);
            } catch (e) {}
          }
        });

        offscreenCtx.globalAlpha = savedGlobalAlpha;

        // 5. Draw Graticules if active (lies on top of land fill, beneath borders)
        if (config.showGraticule && !isNoGeoref) {
          offscreenCtx.setLineDash([]);
          offscreenCtx.lineWidth = 0.5;
          offscreenCtx.strokeStyle = graticuleColor;
          
          const graticuleStep = Math.max(0.1, config.graticuleInterval && !isNaN(config.graticuleInterval) ? config.graticuleInterval : 10);
          const rotLonKey = Math.round(localRotationRef.current ? localRotationRef.current.lon : (config.centerLon || 0));
          const rotLatKey = Math.round(localRotationRef.current ? localRotationRef.current.lat : (config.centerLat || 0));
          const aspectKey = Math.round((config.aspect || 0) * 10) / 10;
          const graticuleCacheKey = `${config.projection}_${graticuleStep}_${Math.round(projection.scale())}_r${rotLonKey}_${rotLatKey}_a${aspectKey}`;
          let graticulePath = graticuleCacheRef.current.get(graticuleCacheKey) || graticulePath2DRef.current;
          if (!graticulePath) {
            try {
              const maxLat = (config.projection === 'mercator' || (config.projection as any) === 'miller') ? 85 : 89.999;
              const baseGraticule = d3.geoGraticule().extent([[-180, -maxLat], [180, maxLat]]).step([graticuleStep, graticuleStep])();
              const geom = rotatedGraticule || baseGraticule;
              const pathStr = d3.geoPath(projection)(geom);
              if (pathStr && !pathStr.includes('NaN') && !pathStr.includes('undefined')) {
                graticulePath = new Path2D(pathStr);
                if (graticuleCacheRef.current.size > 20) {
                  const firstKey = graticuleCacheRef.current.keys().next().value;
                  if (firstKey) graticuleCacheRef.current.delete(firstKey);
                }
                graticuleCacheRef.current.set(graticuleCacheKey, graticulePath);
                graticulePath2DRef.current = graticulePath;
              }
            } catch (e) {}
          }

          if (graticulePath) {
            try {
              offscreenCtx.stroke(graticulePath);
            } catch (e) {}
          } else {
            try {
              offscreenCtx.beginPath();
              const maxLat = (config.projection === 'mercator' || (config.projection as any) === 'miller') ? 85 : 89.999;
              const baseGraticule = d3.geoGraticule().extent([[-180, -maxLat], [180, maxLat]]).step([graticuleStep, graticuleStep])();
              const geom = rotatedGraticule || baseGraticule;
              pathGenerator(geom);
              offscreenCtx.stroke();
            } catch (e) {}
          }
        }

        // Draw Rivers layer if enabled
        if (config.showRivers && riversData) {
          offscreenCtx.save();
          offscreenCtx.lineWidth = config.riverThickness !== undefined ? config.riverThickness : 0.2;
          offscreenCtx.strokeStyle = (!config.riverColor || config.riverColor === 'default') 
            ? (isDark ? 'rgba(82, 148, 226, 0.5)' : 'rgba(53, 117, 196, 0.5)') 
            : config.riverColor;
          offscreenCtx.setLineDash([]);
          
          try {
            offscreenCtx.beginPath();
            pathGenerator(riversData);
            offscreenCtx.stroke();
          } catch (e) {
            console.warn("Failed to render rivers:", e);
          }
          offscreenCtx.restore();
        }

        // 6. Draw Modular Base Borders for each detected hierarchy level
        const drawBaseBorderLayer = (geom: any, strokeWidth: number, layerKey: string, customColor?: string) => {
          if (!geom || !geom.coordinates || geom.coordinates.length === 0 || strokeWidth <= 0) return;
          offscreenCtx.lineWidth = strokeWidth;
          offscreenCtx.strokeStyle = (customColor && customColor !== 'default') ? customColor : boundaryColor;
          offscreenCtx.lineCap = 'butt';
          offscreenCtx.lineJoin = 'round';
          
          if (config.borderStyle === 'dashed') {
            const dl = config.dashLength || 6;
            const gl = config.gapLength || 4;
            offscreenCtx.setLineDash([dl, gl]);
          } else {
            offscreenCtx.setLineDash([]);
          }

          const scaleKey = Math.round(projection.scale());
          const rotLonKey = Math.round(localRotationRef.current ? localRotationRef.current.lon : (config.centerLon || 0));
          const rotLatKey = Math.round(localRotationRef.current ? localRotationRef.current.lat : (config.centerLat || 0));
          const aspectKey = Math.round((config.aspect || 0) * 10) / 10;
          const cacheKey = `border_${config.projection}_${layerKey}_s${scaleKey}_r${rotLonKey}_${rotLatKey}_a${aspectKey}`;
          let path2d = customBordersPath2DRef.current.get(cacheKey);
          if (!path2d) {
            try {
              const pathStr = d3.geoPath(projection)(geom);
              if (pathStr && !pathStr.includes('NaN') && !pathStr.includes('undefined')) {
                path2d = new Path2D(pathStr);
                if (customBordersPath2DRef.current.size > 200) {
                  const firstKey = customBordersPath2DRef.current.keys().next().value;
                  if (firstKey) customBordersPath2DRef.current.delete(firstKey);
                }
                customBordersPath2DRef.current.set(cacheKey, path2d);
              }
            } catch (e) {}
          }

          try {
            if (path2d) {
              offscreenCtx.stroke(path2d);
            } else {
              offscreenCtx.beginPath();
              pathGenerator(geom);
              offscreenCtx.stroke();
            }
          } catch (e) {}

          offscreenCtx.setLineDash([]);
        };

        const subWidth = config.borderWidth !== undefined ? config.borderWidth : 0.2;
        const countryWidth = config.countryBorderWidth !== undefined ? config.countryBorderWidth : (config.borderWidth !== undefined ? config.borderWidth : 0.2);
        const contWidth = config.continentBorderWidth !== undefined ? config.continentBorderWidth : 0.2;

        drawBaseBorderLayer(customizedBordersData?.baseSubnationalGeometry, subWidth, 'subnational', config.borderColor);
        drawBaseBorderLayer(customizedBordersData?.baseCountryGeometry, countryWidth, 'country', config.countryBorderColor || config.borderColor);
        drawBaseBorderLayer(customizedBordersData?.baseContinentGeometry, contWidth, 'continent', config.continentBorderColor || config.borderColor);

        // Fallback for polygon borders when baseCountryGeometry is not precomputed or empty
        if (!customizedBordersData?.baseCountryGeometry && countryWidth > 0) {
          offscreenCtx.save();
          offscreenCtx.lineWidth = countryWidth;
          offscreenCtx.strokeStyle = (config.countryBorderColor && config.countryBorderColor !== 'default') ? config.countryBorderColor : (config.borderColor && config.borderColor !== 'default' ? config.borderColor : boundaryColor);
          offscreenCtx.lineCap = 'butt';
          offscreenCtx.lineJoin = 'round';
          if (config.borderStyle === 'dashed') {
            const dl = config.dashLength || 6;
            const gl = config.gapLength || 4;
            offscreenCtx.setLineDash([dl, gl]);
          } else {
            offscreenCtx.setLineDash([]);
          }
          offscreenCtx.beginPath();
          visibleFeatures.forEach((feature) => {
            try {
              pathGenerator(feature);
            } catch (e) {}
          });
          try {
            offscreenCtx.stroke();
          } catch (e) {}
          offscreenCtx.restore();
        }

        // 6.5 Draw Pre-computed Custom and Preview Boundaries using lightning-fast pathGenerator
        const drawCustomBorderGroup = (
          geom: any,
          style: 'solid' | 'dashed',
          dashLength: number,
          gapLength: number,
          color: string,
          width: number,
          cacheKey?: string
        ) => {
          const strokeWidth = typeof width === 'number' ? width : 0.4;
          offscreenCtx.beginPath();
          offscreenCtx.strokeStyle = color;
          offscreenCtx.lineWidth = strokeWidth;
          if (style === 'dashed') {
            const dl = dashLength || 6;
            const gl = gapLength || 4;
            offscreenCtx.setLineDash([dl, gl]);
          } else {
            offscreenCtx.setLineDash([]);
          }

          try {
            pathGenerator(geom);
            offscreenCtx.stroke();
          } catch (e) {}
          offscreenCtx.setLineDash([]);
        };

        // Draw already applied custom borders
        if (!isDraggingGlobe.current) {
          customizedBordersData.customBordersList.forEach((b) => {
            drawCustomBorderGroup(
              b.geometry,
              b.style,
              b.dashLength || 6,
              b.gapLength || 4,
              b.color,
              b.width,
              b.id
            );
          });
        }

        offscreenCtx.setLineDash([]);

        // Draw enlarged microstate features on top of country borders as distinct opaque circles
        if (enlargedFeatures.length > 0) {
          enlargedFeatures.forEach((feature) => {
            const countryId = getCountryId(feature);
            const defaultLandFill = isDark ? '#262624' : '#fdfcf8';
            let fillColor = defaultLandFill;
            if (customColors) {
              if (customColors[countryId]) {
                fillColor = customColors[countryId];
              } else if (feature.properties?.adm0_a3 && customColors[feature.properties.adm0_a3]) {
                fillColor = customColors[feature.properties.adm0_a3];
              } else if (feature.properties?.admin && customColors[feature.properties.admin]) {
                fillColor = customColors[feature.properties.admin];
              }
            }

            const center = (feature as any)._enlargedCenter || getFeatureCenter(feature);
            if (!center) return;

            const projCenter = projection(center);
            if (!projCenter || isNaN(projCenter[0]) || isNaN(projCenter[1])) return;

            // For orthographic projection, check if on front hemisphere
            if (config.projection === 'orthographic' && !isNoGeoref) {
              const rotate = projection.rotate();
              const dist = d3.geoDistance(center, [-rotate[0], -rotate[1]]);
              if (dist > Math.PI / 2 + 0.15) return;
            }

            const [cx, cy] = projCenter;
            const circleRadius = (feature as any)._circleRadius !== undefined ? (feature as any)._circleRadius : 0.55;

            const resolvedFill = getOrCreatePattern(offscreenCtx, fillColor, currentZoom);
            offscreenCtx.save();
            const targetLandOpacity = config.landOpacity !== undefined ? Math.max(0, Math.min(1, config.landOpacity)) : 1;
            offscreenCtx.globalAlpha = targetLandOpacity * savedGlobalAlpha;
            offscreenCtx.fillStyle = resolvedFill;
            offscreenCtx.beginPath();
            offscreenCtx.arc(cx, cy, circleRadius, 0, Math.PI * 2);
            offscreenCtx.fill();

            // Draw crisp outline stroke around enlarged city-state circle using custom border thickness
            if (countryWidth > 0) {
              offscreenCtx.strokeStyle = boundaryColor;
              offscreenCtx.lineWidth = countryWidth;
              offscreenCtx.setLineDash([]);
              offscreenCtx.stroke();
            }
            offscreenCtx.restore();
          });
        }

        if (hasSphereClip) {
          offscreenCtx.restore();
        }

        // 6.8 Draw Map Outer Bounding Border (Projection / Sphere outline)
        const mapBorderThickness = config.mapBorderWidth !== undefined ? config.mapBorderWidth : 0.2;
        if (mapBorderThickness > 0 && !isNoGeoref) {
          const mapBorderColorResolved = config.mapBorderColor && config.mapBorderColor !== 'default'
            ? config.mapBorderColor
            : boundaryColor;

          offscreenCtx.save();
          offscreenCtx.setLineDash([]);
          offscreenCtx.lineWidth = mapBorderThickness;
          offscreenCtx.strokeStyle = mapBorderColorResolved;
          offscreenCtx.lineJoin = 'miter';
          offscreenCtx.miterLimit = 4;
          offscreenCtx.lineCap = 'square';
          try {
            offscreenCtx.beginPath();
            if (isOrthographicProj) {
              offscreenCtx.arc(globeCenterX, globeCenterY, globeRadius, 0, Math.PI * 2);
            } else {
              pathGenerator({ type: 'Sphere' });
            }
            offscreenCtx.stroke();
          } catch (e) {}
          offscreenCtx.restore();
        }

        // 8. Draw Imported Locations
        if (importedLocations && importedLocations.length > 0 && (showLocations || showLocationLabels)) {
          offscreenCtx.save();
          
          importedLocations.forEach((loc) => {
            const lon = loc.longitude;
            const lat = loc.latitude;
            
            // Backside clipping check for 3D projections (Orthographic and Gnomonic)
            if ((config.projection === 'orthographic' || config.projection === 'gnomonic') && !isNoGeoref) {
              const lonRad = (lon * Math.PI) / 180;
              const latRad = (lat * Math.PI) / 180;
              const cos_c = sin_lat0 * Math.sin(latRad) + cos_lat0 * Math.cos(latRad) * Math.cos(lonRad - lon0Rad);
              
              if (isOrthographicProj && cos_c < 0) {
                return; // Behind the globe sphere! Clipped.
              }
              if (config.projection === 'gnomonic' && cos_c < 0.25) {
                return; // Behind the gnomonic mathematical horizon! Clipped.
              }
            }
            
            const projected = projection([lon, lat]);
            if (projected) {
              const [x, y] = projected;
              
              const shape = loc.symbolShape || 'red_circle';
              const size = loc.symbolSize || (loc.classType === 'admin0' ? admin0Size : (loc.classType === 'admin1' ? admin1Size : 2));
              const color = loc.symbolColor || '#ef4444';

              // Draw customized pinpoint marker shape
              if (showLocations) {
                drawLocationSymbol(offscreenCtx, x, y, shape, size, currentZoom, isDark, color);
              }
                
                // Draw name label text
                if (showLocationLabels && loc.name) {
                  const fPx = locationLabelSize;
                  offscreenCtx.font = getFontString(fPx);
                  const textW = offscreenCtx.measureText(loc.name).width;
                  const r = size * 0.5;
                  const offset = r + Math.max(1, fPx * 0.33);
                  let labelX = x + offset;
                  let labelY = y;

                  const mapBorderWidth = config.mapBorderWidth !== undefined ? config.mapBorderWidth : 1.0;
                  const borderMargin = Math.max(2.0, (mapBorderWidth / 2) + 1.5);
                  const projTrans = projection.translate();
                  const projScale = projection.scale();
                  const gcX = projTrans ? projTrans[0] : curBaseW / 2;
                  const gcY = projTrans ? projTrans[1] : dimensions.height / 2;

                  let fits = true;
                  if (isOrthographicProj || config.projection === 'gnomonic' || config.projection === 'azimuthalEqualArea') {
                    const distRight = Math.hypot((labelX + textW) - gcX, labelY - gcY);
                    if (distRight > projScale - borderMargin) fits = false;
                  }

                  // Flip to left side if right side overflows edge
                  if (!fits) {
                    const altX = x - offset - textW;
                    let altFits = true;
                    if (isOrthographicProj || config.projection === 'gnomonic' || config.projection === 'azimuthalEqualArea') {
                      const distLeft = Math.hypot(altX - gcX, labelY - gcY);
                      if (distLeft > projScale - borderMargin) altFits = false;
                    }
                    if (altFits) {
                      labelX = altX;
                      fits = true;
                    }
                  }

                  if (fits) {
                    offscreenCtx.textAlign = 'left';
                    offscreenCtx.textBaseline = 'middle';
                    
                    // Custom or adaptive text and border styling
                    const locTextColor = (config.labelColor && config.labelColor !== 'default')
                      ? config.labelColor
                      : (isDark ? '#fdfcf8' : '#111e35');
                    const locHaloColor = ((config.labelHaloColor || config.labelBorderColor) && (config.labelHaloColor || config.labelBorderColor) !== 'default')
                      ? (config.labelHaloColor || config.labelBorderColor)
                      : (isDark ? '#111e35' : '#fdfcf8');
                    const locHaloRatio = locationLabelOutlineRatio !== undefined ? locationLabelOutlineRatio : 0.15;
                    const locStrokeWidth = fPx * locHaloRatio;

                    if (locStrokeWidth > 0.01) {
                      offscreenCtx.strokeStyle = locHaloColor!;
                      offscreenCtx.lineWidth = locStrokeWidth;
                      offscreenCtx.strokeText(loc.name, labelX, labelY);
                    }
                    
                    offscreenCtx.fillStyle = locTextColor;
                    offscreenCtx.fillText(loc.name, labelX, labelY);
                  }
                }
            }
          });
          
          offscreenCtx.restore();
        }

        // 8.5 Draw Elegant Cartographic Polygon Labels if enabled (rendered above locations)
        if (false && config.showLabels) {
          const minFontSize = config.minLabelFontSize !== undefined ? Math.max(1, config.minLabelFontSize) : 1;
          const sizingMode = config.labelSizingMode || 'fixed';
          const baseFontSize = config.labelFontSize || 14;
          const dynamicMax = Math.max(72, baseFontSize * 4);
          const maxFontSize = config.maxLabelFontSize !== undefined ? Math.max(1, config.maxLabelFontSize) : (sizingMode === 'fixed' ? baseFontSize : dynamicMax);
          const fontSize = baseFontSize;
          const isPanningActive = isDragging.current || isDraggingGlobe.current || isSliderPanningRef.current || isWheelingRef.current;

          offscreenCtx.textAlign = 'center';
          offscreenCtx.textBaseline = 'middle';

          interface ProcessedFeatureInfo {
            feature: CountryFeature;
            countryId: string;
            paintedColor?: string;
            normColor?: string;
            colorLabel?: string | null;
            fullName: string;
            isoCode?: string;
            bbox: [number, number, number, number];
            samples: [number, number][];
            allPoints: [number, number][];
            primaryTarget: PolygonLabelTarget;
          }

          const featureInfos: ProcessedFeatureInfo[] = [];

          features.forEach((feature) => {
            try {
              const countryId = getCountryId(feature);
              const paintedColor = customColors[countryId] || (feature.properties.adm0_a3 && customColors[feature.properties.adm0_a3]) || (feature.properties.admin && customColors[feature.properties.admin]);
              let colorLabel: string | null = null;
              let normColor: string | undefined = undefined;

              if (paintedColor) {
                normColor = paintedColor.toLowerCase();
                const customTxt = legendLabels ? (legendLabels[normColor] || legendLabels[paintedColor]) : null;
                colorLabel = (customTxt && customTxt.trim().length > 0) ? customTxt.trim() : paintedColor.toUpperCase();
              }

              const fullName = getFeatureName(feature);
              const isoCode = getFeatureIsoCode(feature, selectedMapFile);

              const labelGeom = getCountryLabelGeometry(feature, labelGeomCacheRef.current);

              if (labelGeom.centroid) {
                if (isOrthographicProj) {
                  const cLonRad = (labelGeom.centroid[0] * Math.PI) / 180;
                  const cLatRad = (labelGeom.centroid[1] * Math.PI) / 180;
                  const cos_c_label = sin_lat0 * Math.sin(cLatRad) + cos_lat0 * Math.cos(cLatRad) * Math.cos(cLonRad - lon0Rad);
                  if (cos_c_label < -0.05) return;
                } else if (config.projection === 'gnomonic' && !isNoGeoref) {
                  const cLonRad = (labelGeom.centroid[0] * Math.PI) / 180;
                  const cLatRad = (labelGeom.centroid[1] * Math.PI) / 180;
                  const cos_c_label = sin_lat0 * Math.sin(cLatRad) + cos_lat0 * Math.cos(cLatRad) * Math.cos(cLonRad - lon0Rad);
                  if (cos_c_label < 0.4) return;
                }

                if (isPanningActive && features.length > 80) {
                  const projPt = projection(labelGeom.centroid);
                  if (!projPt) return;
                  const screenX = projPt[0] * currentZoom + currentPan.x;
                  const screenY = projPt[1] * currentZoom + currentPan.y;
                  if (screenX < -150 || screenX > curBaseW + 150 || screenY < -150 || screenY > curBaseH + 150) {
                    return;
                  }
                  if (labelGeom.ringBBox) {
                    const dDeg = Math.max(Math.abs(labelGeom.ringBBox[2] - labelGeom.ringBBox[0]), Math.abs(labelGeom.ringBBox[3] - labelGeom.ringBBox[1]));
                    const projScale = (projection as any).scale ? (projection as any).scale() : 100;
                    if (!isCityStateOrMicrostate(feature) && dDeg * currentZoom * (projScale / 50) < 10) {
                      return;
                    }
                  }
                }
              }

              let targets = labelGeom.targets && labelGeom.targets.length > 0
                ? labelGeom.targets
                : [{ centroid: labelGeom.centroid, angle: labelGeom.angle, ringBBox: labelGeom.ringBBox, ring: labelGeom.largestRing || [], area: 0 }];

              const isEnlarged = !!(feature as any)._enlarged;
              const isCityState = isEnlarged;
              const microstateCenter = (feature as any)._enlargedCenter || getFeatureCenter(feature);

              if (isCityState && microstateCenter) {
                const circlePts: [number, number][] = [];
                const cRadius = (feature as any)._circleRadius !== undefined ? (feature as any)._circleRadius : 0.55;
                const rDeg = (cRadius / 0.55) * 0.225;
                for (let a = 0; a < 16; a++) {
                  const theta = (a / 16) * Math.PI * 2;
                  circlePts.push([
                    microstateCenter[0] + Math.cos(theta) * rDeg,
                    microstateCenter[1] + Math.sin(theta) * rDeg
                  ]);
                }
                targets = [{
                  centroid: microstateCenter,
                  angle: 0,
                  ringBBox: [microstateCenter[0] - rDeg, microstateCenter[1] - rDeg, microstateCenter[0] + rDeg, microstateCenter[1] + rDeg],
                  ring: circlePts,
                  area: Math.PI * rDeg * rDeg
                }];
              }

              targets.forEach((target, targetIdx) => {
                let points: [number, number][] = target.ring || [];
                if (points.length === 0 && labelGeom.largestRing) {
                  points = labelGeom.largestRing;
                }

                let bbox: [number, number, number, number] = target.ringBBox || [Infinity, Infinity, -Infinity, -Infinity];
                if (!target.ringBBox && points.length > 0) {
                  bbox = [Infinity, Infinity, -Infinity, -Infinity];
                  for (let i = 0; i < points.length; i++) {
                    const [lon, lat] = points[i];
                    if (lon < bbox[0]) bbox[0] = lon;
                    if (lat < bbox[1]) bbox[1] = lat;
                    if (lon > bbox[2]) bbox[2] = lon;
                    if (lat > bbox[3]) bbox[3] = lat;
                  }
                } else if (!target.ringBBox) {
                  bbox = [target.centroid[0] - 1, target.centroid[1] - 1, target.centroid[0] + 1, target.centroid[1] + 1];
                }

                const maxSamples = 30;
                let samples: [number, number][] = [];
                if (points.length <= maxSamples) {
                  samples = points;
                } else {
                  const step = Math.floor(points.length / maxSamples);
                  for (let i = 0; i < points.length; i += step) {
                    samples.push(points[i]);
                  }
                }

                const targetCountryId = `${countryId}_t${targetIdx}`;

                featureInfos.push({
                  feature,
                  countryId: targetCountryId,
                  paintedColor,
                  normColor,
                  colorLabel,
                  fullName,
                  isoCode,
                  bbox,
                  samples,
                  allPoints: points,
                  primaryTarget: target
                });
              });
            } catch (e) {}
          });

          // Group features by target country ID, or by color label when color labels are active AND color has a custom text label
          const groups = new Map<string, ProcessedFeatureInfo[]>();
          const isColorLabelActive = config.colorLabelMode === 'on-polygons' || config.colorLabelMode === 'on-map' || config.colorLabelMode === 'both';

          featureInfos.forEach((info) => {
            const nameKey = info.fullName ? info.fullName.trim().toLowerCase() : '';
            let groupKey = nameKey ? `name:${nameKey}` : info.countryId;
            const hasCustomLabel = !!(info.colorLabel && info.colorLabel.trim().length > 0);
            if (isColorLabelActive && info.normColor && hasCustomLabel) {
              groupKey = `color:${info.normColor}:${info.colorLabel}`;
            }
            if (!groups.has(groupKey)) {
              groups.set(groupKey, []);
            }
            groups.get(groupKey)!.push(info);
          });

          const areAdjacent = (f1: ProcessedFeatureInfo, f2: ProcessedFeatureInfo, thresholdDeg = 1.5): boolean => {
            if (
              f1.bbox[2] + thresholdDeg < f2.bbox[0] ||
              f1.bbox[0] - thresholdDeg > f2.bbox[2] ||
              f1.bbox[3] + thresholdDeg < f2.bbox[1] ||
              f1.bbox[1] - thresholdDeg > f2.bbox[3]
            ) {
              return false;
            }
            const threshSq = thresholdDeg * thresholdDeg;
            for (let i = 0; i < f1.samples.length; i++) {
              const p1 = f1.samples[i];
              for (let j = 0; j < f2.samples.length; j++) {
                const p2 = f2.samples[j];
                let dLon = Math.abs(p1[0] - p2[0]);
                if (dLon > 180) dLon = 360 - dLon;
                const dLat = p1[1] - p2[1];
                if (dLon * dLon + dLat * dLat <= threshSq) return true;
              }
            }
            return false;
          };

          interface FeatureCluster {
            items: ProcessedFeatureInfo[];
            centroid: [number, number];
            angle: number;
            labelText: string;
            allPoints: [number, number][];
          }

          const clusters: FeatureCluster[] = [];

          groups.forEach((items) => {
            if (items.length === 1) {
              const info = items[0];
              let labelText = info.fullName;
              const nameStyle = config.labelNameStyle || 'full-name';
              if (nameStyle === 'short-code' && info.isoCode) {
                labelText = info.isoCode;
              }

              const currentMode = config.colorLabelMode || 'on-legend';
              const hasCustomLabel = !!(info.colorLabel && info.colorLabel.trim().length > 0);
              if (hasCustomLabel && (currentMode === 'on-polygons' || currentMode === 'on-map' || currentMode === 'both')) {
                if (currentMode === 'on-polygons' || currentMode === 'on-map') {
                  labelText = info.colorLabel!;
                } else if (info.colorLabel!.trim().toLowerCase() !== labelText.trim().toLowerCase()) {
                  labelText = `${labelText}: ${info.colorLabel!}`;
                }
              }

              clusters.push({
                items: [info],
                centroid: info.primaryTarget.centroid,
                angle: info.primaryTarget.angle,
                labelText,
                allPoints: info.allPoints
              });
            } else {
              // High-performance Spatial Grid Bucketing for BFS connected components
              const visited = new Array(items.length).fill(false);
              const GRID_SIZE = 4; // 4-degree grid cell size
              const spatialGrid = new Map<string, number[]>();

              for (let idx = 0; idx < items.length; idx++) {
                const bbox = items[idx].bbox;
                const minCx = Math.floor((bbox[0] + 180) / GRID_SIZE);
                const maxCx = Math.floor((bbox[2] + 180) / GRID_SIZE);
                const minCy = Math.floor((bbox[1] + 90) / GRID_SIZE);
                const maxCy = Math.floor((bbox[3] + 90) / GRID_SIZE);

                for (let cx = minCx; cx <= maxCx; cx++) {
                  for (let cy = minCy; cy <= maxCy; cy++) {
                    const cellKey = `${cx},${cy}`;
                    let cellList = spatialGrid.get(cellKey);
                    if (!cellList) {
                      cellList = [];
                      spatialGrid.set(cellKey, cellList);
                    }
                    cellList.push(idx);
                  }
                }
              }

              const checkedCandidates = new Set<number>();

              for (let i = 0; i < items.length; i++) {
                if (visited[i]) continue;

                const component: ProcessedFeatureInfo[] = [];
                const queue: number[] = [i];
                visited[i] = true;

                while (queue.length > 0) {
                  const currIdx = queue.shift()!;
                  const currItem = items[currIdx];
                  component.push(currItem);

                  const bbox = currItem.bbox;
                  const minCx = Math.floor((bbox[0] - 1.5 + 180) / GRID_SIZE);
                  const maxCx = Math.floor((bbox[2] + 1.5 + 180) / GRID_SIZE);
                  const minCy = Math.floor((bbox[1] - 1.5 + 90) / GRID_SIZE);
                  const maxCy = Math.floor((bbox[3] + 1.5 + 90) / GRID_SIZE);

                  checkedCandidates.clear();

                  for (let cx = minCx; cx <= maxCx; cx++) {
                    for (let cy = minCy; cy <= maxCy; cy++) {
                      const cellList = spatialGrid.get(`${cx},${cy}`);
                      if (!cellList) continue;

                      for (let k = 0; k < cellList.length; k++) {
                        const j = cellList[k];
                        if (!visited[j] && !checkedCandidates.has(j)) {
                          checkedCandidates.add(j);
                          if (areAdjacent(currItem, items[j])) {
                            visited[j] = true;
                            queue.push(j);
                          }
                        }
                      }
                    }
                  }
                }

                let totalArea = 0;
                let weightedLon = 0;
                let weightedLat = 0;
                let maxArea = -1;
                let primaryItem = component[0];
                const combinedPoints: [number, number][] = [];

                component.forEach((item) => {
                  const area = Math.max(0.000001, item.primaryTarget.area || 1);
                  totalArea += area;
                  weightedLon += item.primaryTarget.centroid[0] * area;
                  weightedLat += item.primaryTarget.centroid[1] * area;
                  if (area > maxArea) {
                    maxArea = area;
                    primaryItem = item;
                  }
                  combinedPoints.push(...item.allPoints);
                });

                const isClusterCityState = component.some(item => !!(item.feature as any)._enlarged);
                let combinedCentroid: [number, number];

                if (isClusterCityState) {
                  const primaryFeat = primaryItem.feature;
                  const mCenter = (primaryFeat as any)._enlargedCenter || getFeatureCenter(primaryFeat) || primaryItem.primaryTarget.centroid;
                  combinedCentroid = mCenter;
                } else if (primaryItem.primaryTarget.centroid) {
                  combinedCentroid = component.length === 1
                    ? primaryItem.primaryTarget.centroid
                    : [
                        weightedLon / totalArea,
                        weightedLat / totalArea
                      ];
                } else {
                  combinedCentroid = [
                    weightedLon / totalArea,
                    weightedLat / totalArea
                  ];
                }

                let labelText = primaryItem.fullName;
                const nameStyle = config.labelNameStyle || 'full-name';
                if (nameStyle === 'short-code' && primaryItem.isoCode) {
                  labelText = primaryItem.isoCode;
                }

                const currentMode = config.colorLabelMode || 'on-legend';
                const hasCustomLabel = !!(primaryItem.colorLabel && primaryItem.colorLabel.trim().length > 0);
                if (hasCustomLabel && (currentMode === 'on-polygons' || currentMode === 'on-map' || currentMode === 'both')) {
                  if (currentMode === 'on-polygons' || currentMode === 'on-map') {
                    labelText = primaryItem.colorLabel!;
                  } else if (primaryItem.colorLabel!.trim().toLowerCase() !== labelText.trim().toLowerCase()) {
                    labelText = `${labelText}: ${primaryItem.colorLabel!}`;
                  }
                }

                clusters.push({
                  items: component,
                  centroid: combinedCentroid,
                  angle: primaryItem.primaryTarget.angle,
                  labelText,
                  allPoints: combinedPoints
                });
              }
            }
          });

          // Render labels for each cluster
          clusters.forEach((cluster) => {
            try {
              const { centroid, angle, labelText, allPoints } = cluster;
              if (!centroid || (centroid[0] === 0 && centroid[1] === 0)) return;

              if (isOrthographicProj) {
                const cLonRad = (centroid[0] * Math.PI) / 180;
                const cLatRad = (centroid[1] * Math.PI) / 180;
                const cos_c_label = sin_lat0 * Math.sin(cLatRad) + cos_lat0 * Math.cos(cLatRad) * Math.cos(cLonRad - lon0Rad);
                if (cos_c_label < 0) return;
              } else if (config.projection === 'gnomonic' && !isNoGeoref) {
                const cLonRad = (centroid[0] * Math.PI) / 180;
                const cLatRad = (centroid[1] * Math.PI) / 180;
                const cos_c_label = sin_lat0 * Math.sin(cLatRad) + cos_lat0 * Math.cos(cLatRad) * Math.cos(cLonRad - lon0Rad);
                if (cos_c_label < 0.5) return;
              }

              const isEnlarged = cluster.items.some(it => !!(it.feature as any)._enlarged);
              const isCityState = isEnlarged;

              const primaryItem = cluster.items[0];
              const isoCode = primaryItem ? primaryItem.isoCode : undefined;

              // 1. Collect projected screen polygon points & full country extent bounds
              const screenPoly: [number, number][] = [];
              let minU = Infinity, maxU = -Infinity;
              let minV = Infinity, maxV = -Infinity;

              const projectedCentroid = projection(centroid);
              if (!projectedCentroid) return;
              const x = projectedCentroid[0];
              const y = projectedCentroid[1];
              const refX = x;
              const mapWidth = curBaseW;

              if (cluster.items && cluster.items.length > 0) {
                for (const item of cluster.items) {
                  const pts = item.allPoints;
                  if (pts && pts.length > 0) {
                    const step = Math.max(1, Math.floor(pts.length / 80));
                    for (let i = 0; i < pts.length; i += step) {
                      const pt = projection(pts[i]);
                      if (pt && !isNaN(pt[0]) && !isNaN(pt[1])) {
                        let px = pt[0];
                        if (px - refX > mapWidth * 0.4) px -= mapWidth;
                        else if (refX - px > mapWidth * 0.4) px += mapWidth;

                        if (px < minU) minU = px;
                        if (px > maxU) maxU = px;
                        if (pt[1] < minV) minV = pt[1];
                        if (pt[1] > maxV) maxV = pt[1];
                      }
                    }
                  }
                }
              }

              const targetRing = primaryItem && primaryItem.primaryTarget ? primaryItem.primaryTarget.ring : null;
              const ptsToProject = (targetRing && targetRing.length >= 3) ? targetRing : (allPoints && allPoints.length >= 3 ? allPoints : []);

              if (ptsToProject.length >= 3) {
                const step = Math.max(1, Math.floor(ptsToProject.length / 150));
                for (let i = 0; i < ptsToProject.length; i += step) {
                  const pt = projection(ptsToProject[i]);
                  if (pt && !isNaN(pt[0]) && !isNaN(pt[1])) {
                    let px = pt[0];
                    let py = pt[1];
                    if (px - refX > mapWidth * 0.4) px -= mapWidth;
                    else if (refX - px > mapWidth * 0.4) px += mapWidth;
                    screenPoly.push([px, py]);
                  }
                }
              }

              const screenX = x * currentZoom + currentPan.x;
              const screenY = y * currentZoom + currentPan.y;

              const sizingMode = config.labelSizingMode || 'fixed';
              const nameStyle = config.labelNameStyle || 'full-name';

              let screenAngle = 0;
              if (sizingMode !== 'fixed' && angle !== 0) {
                const step = 0.5;
                let offsetLon = centroid[0] + Math.cos(angle) * step;
                let offsetLat = centroid[1] + Math.sin(angle) * step;
                if (offsetLon > 180) offsetLon -= 360;
                if (offsetLon < -180) offsetLon += 360;
                if (offsetLat > 90) offsetLat = 180 - offsetLat;
                if (offsetLat < -90) offsetLat = -180 - offsetLat;

                const projectedOffset = projection([offsetLon, offsetLat]);
                if (projectedOffset) {
                  const rawAngle = Math.atan2(projectedOffset[1] - y, projectedOffset[0] - x);
                  let normalized = rawAngle;
                  if (normalized > Math.PI / 2) normalized -= Math.PI;
                  else if (normalized < -Math.PI / 2) normalized += Math.PI;
                  screenAngle = normalized;
                }
              }

              // 3. Apparent projection width & height spans
              let uSpan = 60;
              let vSpan = 30;

              if (maxU > minU && maxV > minV) {
                uSpan = maxU - minU;
                vSpan = maxV - minV;
              }

              let label = labelText;
              if (!label || label.length === 0) return;

              if (isCityState && isoCode && isoCode.length >= 2) {
                label = isoCode;
              } else if (nameStyle === 'short-code' && isoCode && isoCode.length >= 2) {
                label = isoCode;
              }

              let fontPx = maxFontSize;
              let extraSpacing = 0;

              const projTrans = projection.translate();
              const projScale = projection.scale();
              const mapBorderWidth = config.mapBorderWidth !== undefined ? config.mapBorderWidth : 1.0;
              const borderMargin = Math.max(2.0, (mapBorderWidth / 2) + 1.5);

              let mapMinX = -Infinity;
              let mapMinY = -Infinity;
              let mapMaxX = Infinity;
              let mapMaxY = Infinity;
              try {
                const sb = d3.geoPath().projection(projection).bounds({ type: 'Sphere' });
                if (sb && isFinite(sb[0][0]) && isFinite(sb[0][1]) && isFinite(sb[1][0]) && isFinite(sb[1][1])) {
                  mapMinX = sb[0][0];
                  mapMinY = sb[0][1];
                  mapMaxX = sb[1][0];
                  mapMaxY = sb[1][1];
                }
              } catch (e) {}

              const adjusted = validateAndAdjustLabelPlacement({
                x,
                y,
                label,
                isoCode,
                fontPx,
                baseFontPx: baseFontSize,
                angle: screenAngle,
                extraSpacing,
                isSpherical: isOrthographicProj || config.projection === 'gnomonic' || config.projection === 'azimuthalEqualArea',
                gcX: projTrans ? projTrans[0] : curBaseW / 2,
                gcY: projTrans ? projTrans[1] : dimensions.height / 2,
                gRadius: projScale || 100,
                mapMinX,
                mapMinY,
                mapMaxX,
                mapMaxY,
                polyMinX: minU,
                polyMinY: minV,
                polyMaxX: maxU,
                polyMaxY: maxV,
                borderMargin,
                currentZoom,
                isCityState,
                minFontPx: minFontSize,
                screenPoly,
                measureWidth: (t, f) => {
                  offscreenCtx.font = getFontString(f);
                  return offscreenCtx.measureText(t).width;
                },
              });

              if (!adjusted.visible) return;

              label = adjusted.label;
              fontPx = adjusted.fontPx;
              extraSpacing = adjusted.extraSpacing;
              const finalX = adjusted.x;
              const finalY = adjusted.y;

              offscreenCtx.font = getFontString(fontPx);
              offscreenCtx.save();
              offscreenCtx.translate(finalX, finalY);
              offscreenCtx.rotate(screenAngle);

              drawSpacedText(
                offscreenCtx,
                label,
                0,
                0,
                extraSpacing,
                isDark,
                currentZoom,
                fontPx,
                config.labelColor,
                config.labelHaloColor || config.labelBorderColor,
                config.labelHaloRatio !== undefined ? config.labelHaloRatio : (config.labelBorderRatio !== undefined ? config.labelBorderRatio : 0.15)
              );

              offscreenCtx.restore();
            } catch (e) {}
          });
        }

        // 8.7 Draw Country / Region Labels
        offscreenCtx.save();
        if (config.showLabels && !isDraggingGlobe.current) {
            const minFontSize = config.minLabelFontSize !== undefined ? Math.max(1, config.minLabelFontSize) : 1;
            const nameStyle = config.labelNameStyle || 'full-name';
            const currentMode = config.colorLabelMode || 'on-legend';
            const textColor = (config.labelColor && config.labelColor !== 'default')
              ? config.labelColor
              : (isDark ? '#fdfcf8' : '#111e35');
            const haloColor = ((config.labelHaloColor || config.labelBorderColor) && (config.labelHaloColor || config.labelBorderColor) !== 'default')
              ? (config.labelHaloColor || config.labelBorderColor)
              : (isDark ? '#111e35' : '#fdfcf8');
            const haloRatio = config.labelHaloRatio !== undefined ? config.labelHaloRatio : (config.labelBorderRatio !== undefined ? config.labelBorderRatio : 0.15);

            const customColorsKey = customColors ? Object.keys(customColors).length + '_' + Object.values(customColors).join('') : '';
            const legendLabelsKey = legendLabels ? Object.keys(legendLabels).length + '_' + Object.values(legendLabels).join('') : '';

            const currentLabelCacheKey = [
              "v5_circular_iso",
              config.projection,
              config.zoom,
              config.edgeAngle !== undefined ? config.edgeAngle : 90,
              config.showLabels,
              config.labelSizingMode,
              config.labelFontSize,
              config.minLabelFontSize,
              config.maxLabelFontSize,
              config.labelNameStyle,
              config.colorLabelMode,
              config.labelColor,
              config.labelHaloColor,
              config.labelBorderColor,
              config.labelHaloRatio,
              config.labelBorderRatio,
              config.labelFontFamily,
              localRotationRef.current.lon,
              localRotationRef.current.lat,
              config.aspect || 0,
              isDark ? 'dark' : 'light',
              curBaseW,
              curBaseH,
              customColorsKey,
              legendLabelsKey,
              (features || []).length,
            ].join('|');

            let labelsToRender: {
              id: string;
              labelText: string;
              x: number;
              y: number;
              fontPx: number;
              dynAngle: number;
              dynLetterSpacing: number;
              strokeWidth: number;
              textColor: string;
              haloColor: string | null;
              totalWidth: number;
              charWidths?: number[];
              isDynamicMode: boolean;
              isCityState: boolean;
              area: number;
              curveKappa?: number;
              curveKappaSouth?: number;
            }[] = [];

            const cachedFromMap = labelRenderCacheMapRef.current.get(currentLabelCacheKey);
            if (cachedFromMap) {
              labelsToRender = cachedFromMap;
            } else if (cachedLabelsToRenderRef.current && cachedLabelsKeyRef.current === currentLabelCacheKey) {
              labelsToRender = cachedLabelsToRenderRef.current;
            } else {
            const rotLon = localRotationRef.current ? localRotationRef.current.lon : (config.centerLon || 0);
            const rotLat = localRotationRef.current ? localRotationRef.current.lat : (config.centerLat || 0);
            const lon0Rad = (rotLon * Math.PI) / 180;
            const lat0Rad = (rotLat * Math.PI) / 180;
            const sin_lat0 = Math.sin(lat0Rad);
            const cos_lat0 = Math.cos(lat0Rad);
            const isOrthographicProj = config.projection === 'orthographic' && !isNoGeoref;
            const isGnomonicProj = config.projection === 'gnomonic' && !isNoGeoref;

            // Helper to check if a 3D spherical coordinate is on the back of the globe
            const isPointBehindGlobe = (lon: number, lat: number): boolean => {
              if (isOrthographicProj) {
                const lonR = (lon * Math.PI) / 180;
                const latR = (lat * Math.PI) / 180;
                const cos_c = sin_lat0 * Math.sin(latR) + cos_lat0 * Math.cos(latR) * Math.cos(lonR - lon0Rad);
                return cos_c < 0; // Behind the globe!
              }
              if (isGnomonicProj) {
                const lonR = (lon * Math.PI) / 180;
                const latR = (lat * Math.PI) / 180;
                const cos_c = sin_lat0 * Math.sin(latR) + cos_lat0 * Math.cos(latR) * Math.cos(lonR - lon0Rad);
                return cos_c < 0.2; // Beyond gnomonic mathematical horizon!
              }
              return false;
            };

            interface ProcessedFeatureInfo {
              feature: CountryFeature;
              countryId: string;
              paintedColor?: string;
              normColor?: string;
              colorLabel?: string | null;
              fullName: string;
              isoCode?: string;
              isCityState: boolean;
              microstateCenter?: [number, number];
              labelGeom: any;
              targets: PolygonLabelTarget[];
              geoBbox: [number, number, number, number];
              allPoints: [number, number][];
              primaryTarget: PolygonLabelTarget;
              screenRing: [number, number][];
              screenBBox: [number, number, number, number];
              screenSamples: [number, number][];
              apparentPixelArea: number;
              screenCenter: [number, number];
            }

            const featureInfos: ProcessedFeatureInfo[] = [];

            (features || []).forEach((feature) => {
              try {
                const countryId = getCountryId(feature);
                const labelGeom = getCountryLabelGeometry(feature, labelGeomCacheRef.current);
                if (!labelGeom || !labelGeom.centroid) return;

                const isCityState = !!(feature as any)._enlarged;
                const microstateCenter = (feature as any)._enlargedCenter || getFeatureCenter(feature);
                if (isCityState && microstateCenter && isPointBehindGlobe(microstateCenter[0], microstateCenter[1])) {
                  return; // Microstate / City-state is behind the globe
                }

                const fullName = getFeatureName(feature);
                const isoCode = getFeatureIsoCode(feature, selectedMapFile);

                const paintedColor = customColors[countryId] || (feature.properties.adm0_a3 && customColors[feature.properties.adm0_a3]) || (feature.properties.admin && customColors[feature.properties.admin]);
                let colorLabel: string | null = null;
                let normColor: string | undefined = undefined;

                if (paintedColor) {
                  normColor = paintedColor.toLowerCase();
                  const isFlag = normColor.startsWith('flag:');
                  const customTxt = legendLabels ? (legendLabels[normColor] || legendLabels[paintedColor]) : null;
                  if (customTxt && customTxt.trim().length > 0 && !customTxt.trim().toLowerCase().startsWith('flag:')) {
                    colorLabel = customTxt.trim();
                  } else if (!isFlag) {
                    colorLabel = paintedColor.toUpperCase();
                  } else {
                    colorLabel = null; // Do NOT label based on flag name/code
                  }
                }

                let targetsToRender = (labelGeom.targets && labelGeom.targets.length > 0)
                  ? labelGeom.targets
                  : [{ centroid: labelGeom.centroid, centerOfMass: labelGeom.centroid, angle: labelGeom.angle, ringBBox: labelGeom.ringBBox, ring: labelGeom.largestRing || [], area: 0, isHighlyIrregular: false }];

                if (isCityState && microstateCenter) {
                  const circlePts: [number, number][] = [];
                  const cRadius = (feature as any)._circleRadius !== undefined ? (feature as any)._circleRadius : 0.55;
                  const rDeg = (cRadius / 0.55) * 0.225;
                  for (let a = 0; a < 16; a++) {
                    const theta = (a / 16) * Math.PI * 2;
                    circlePts.push([
                      microstateCenter[0] + Math.cos(theta) * rDeg,
                      microstateCenter[1] + Math.sin(theta) * rDeg
                    ]);
                  }
                  targetsToRender = [{
                    centroid: microstateCenter,
                    centerOfMass: microstateCenter,
                    angle: 0,
                    ringBBox: [microstateCenter[0] - rDeg, microstateCenter[1] - rDeg, microstateCenter[0] + rDeg, microstateCenter[1] + rDeg],
                    ring: circlePts,
                    area: Math.PI * rDeg * rDeg,
                    isHighlyIrregular: false
                  }];
                }

                targetsToRender.forEach((target, targetIdx) => {
                  const targetCenter = target.centerOfMass || target.centroid;
                  if (targetCenter && isPointBehindGlobe(targetCenter[0], targetCenter[1])) {
                    return; // Target center is behind the globe
                  }

                  let points: [number, number][] = target.ring || [];
                  if (points.length === 0 && labelGeom.largestRing) {
                    points = labelGeom.largestRing;
                  }

                  let geoBbox: [number, number, number, number] = target.ringBBox || [Infinity, Infinity, -Infinity, -Infinity];
                  if (!target.ringBBox && points.length > 0) {
                    geoBbox = [Infinity, Infinity, -Infinity, -Infinity];
                    for (let i = 0; i < points.length; i++) {
                      const [lon, lat] = points[i];
                      if (lon < geoBbox[0]) geoBbox[0] = lon;
                      if (lat < geoBbox[1]) geoBbox[1] = lat;
                      if (lon > geoBbox[2]) geoBbox[2] = lon;
                      if (lat > geoBbox[3]) geoBbox[3] = lat;
                    }
                  } else if (!target.ringBBox) {
                    const c = target.centerOfMass || target.centroid;
                    geoBbox = [c[0] - 1, c[1] - 1, c[0] + 1, c[1] + 1];
                  }

                  let sCenter = projection(target.centerOfMass || target.centroid);
                  const screenRing: [number, number][] = [];
                  let sMinX = Infinity, sMinY = Infinity, sMaxX = -Infinity, sMaxY = -Infinity;
                  let sAreaSum = 0;
                  const screenHalfW = curBaseW * 0.45;

                  const ptStep = points.length > 120 ? Math.max(1, Math.floor(points.length / 120)) : 1;
                  for (let i = 0; i < points.length; i += ptStep) {
                    const [pLon, pLat] = points[i];
                    if (isPointBehindGlobe(pLon, pLat)) {
                      continue; // Skip points on the backside of the globe
                    }
                    const p = projection(points[i]);
                    if (p && !isNaN(p[0]) && !isNaN(p[1])) {
                      // Filter out antimeridian wrap points that jump to the opposite side of the screen
                      if (sCenter && !isNaN(sCenter[0]) && Math.abs(p[0] - sCenter[0]) > screenHalfW) {
                        continue;
                      }
                      screenRing.push(p);
                      if (p[0] < sMinX) sMinX = p[0];
                      if (p[1] < sMinY) sMinY = p[1];
                      if (p[0] > sMaxX) sMaxX = p[0];
                      if (p[1] > sMaxY) sMaxY = p[1];
                    }
                  }

                  if (!isCityState && (screenRing.length < 3 || sMinX === Infinity)) {
                    return; // No visible surface on the front of the globe
                  }

                  if (screenRing.length >= 3) {
                    for (let i = 0; i < screenRing.length; i++) {
                      const p1 = screenRing[i];
                      const p2 = screenRing[(i + 1) % screenRing.length];
                      sAreaSum += (p1[0] * p2[1] - p2[0] * p1[1]);
                    }
                  }

                  let apparentPixelArea = Math.max(0.0001, Math.abs(sAreaSum / 2));
                  let screenBBox: [number, number, number, number] = (sMinX !== Infinity)
                    ? [sMinX, sMinY, sMaxX, sMaxY]
                    : [0, 0, 0, 0];

                  if (!sCenter || isNaN(sCenter[0]) || isNaN(sCenter[1])) {
                    if (sMinX !== Infinity && sMaxX !== -Infinity) {
                      sCenter = [(sMinX + sMaxX) / 2, (sMinY + sMaxY) / 2];
                    } else {
                      return;
                    }
                  }

                  const maxSamples = 35;
                  const screenSamples: [number, number][] = [];
                  if (screenRing.length <= maxSamples) {
                    screenRing.forEach(p => screenSamples.push(p));
                  } else {
                    const step = Math.max(1, Math.floor(screenRing.length / maxSamples));
                    for (let i = 0; i < screenRing.length; i += step) {
                      screenSamples.push(screenRing[i]);
                    }
                  }
                  if (screenSamples.length === 0 && sCenter) {
                    screenSamples.push(sCenter);
                    apparentPixelArea = Math.max(apparentPixelArea, 4);
                    screenBBox = [sCenter[0] - 2, sCenter[1] - 2, sCenter[0] + 2, sCenter[1] + 2];
                  }

                  const targetCountryId = targetsToRender.length > 1 ? `${countryId}_t${targetIdx}` : countryId;

                  featureInfos.push({
                    feature,
                    countryId: targetCountryId,
                    paintedColor,
                    normColor,
                    colorLabel,
                    fullName,
                    isoCode,
                    isCityState,
                    microstateCenter,
                    labelGeom,
                    targets: targetsToRender,
                    geoBbox,
                    allPoints: points,
                    primaryTarget: target,
                    screenRing,
                    screenBBox,
                    screenSamples,
                    apparentPixelArea,
                    screenCenter: sCenter || [0, 0],
                  });
                });
              } catch (e) {}
            });

            // Grouping: by country identity or color label
            const groups = new Map<string, ProcessedFeatureInfo[]>();
            const isColorLabelActive = currentMode === 'on-polygons' || currentMode === 'on-map' || currentMode === 'both';

            featureInfos.forEach((info) => {
              const nameKey = info.fullName ? info.fullName.trim().toLowerCase() : '';
              let groupKey = nameKey ? `name:${nameKey}` : info.countryId;
              const isFlag = !!(info.normColor && info.normColor.startsWith('flag:'));
              
              if (isColorLabelActive && info.normColor && !isFlag) {
                if (info.colorLabel && info.colorLabel.trim().length > 0) {
                  groupKey = `color:${info.normColor}:${info.colorLabel.trim().toLowerCase()}`;
                } else {
                  groupKey = `color:${info.normColor}`;
                }
              }
              if (!groups.has(groupKey)) {
                groups.set(groupKey, []);
              }
              groups.get(groupKey)!.push(info);
            });

            const areSubPolygonsAdjacent = (f1: ProcessedFeatureInfo, f2: ProcessedFeatureInfo): boolean => {
              // 1. Fast screen bounding box rejection with 3px buffer
              if (
                f1.screenBBox[0] - 3 > f2.screenBBox[2] ||
                f2.screenBBox[0] - 3 > f1.screenBBox[2] ||
                f1.screenBBox[1] - 3 > f2.screenBBox[3] ||
                f2.screenBBox[1] - 3 > f1.screenBBox[3]
              ) {
                return false;
              }

              const threshSq = 2.5 * 2.5; // 2.5px edge-to-edge threshold for physical contact
              const ptsA = f1.screenSamples;
              const ptsB = f2.screenSamples;

              if (ptsA.length === 0 || ptsB.length === 0) return false;

              // Direct point-to-point distance check (guarantees real edge proximity)
              for (let i = 0; i < ptsA.length; i++) {
                const ax = ptsA[i][0], ay = ptsA[i][1];
                for (let j = 0; j < ptsB.length; j++) {
                  const dx = ax - ptsB[j][0];
                  const dy = ay - ptsB[j][1];
                  if (dx * dx + dy * dy <= threshSq) return true;
                }
              }

              // Check distance from sampled points of A to short edge segments of B
              for (let i = 0; i < ptsA.length; i++) {
                const px = ptsA[i][0], py = ptsA[i][1];
                for (let j = 0; j < ptsB.length - 1; j++) {
                  const x1 = ptsB[j][0], y1 = ptsB[j][1];
                  const x2 = ptsB[j + 1][0], y2 = ptsB[j + 1][1];
                  const segLenSq = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
                  if (segLenSq > 40 * 40) continue; // Skip long chords / projection jumps
                  const dSq = pointToSegmentDistSq(px, py, x1, y1, x2, y2);
                  if (dSq <= threshSq) return true;
                }
              }

              // Check distance from sampled points of B to short edge segments of A
              for (let j = 0; j < ptsB.length; j++) {
                const px = ptsB[j][0], py = ptsB[j][1];
                for (let i = 0; i < ptsA.length - 1; i++) {
                  const x1 = ptsA[i][0], y1 = ptsA[i][1];
                  const x2 = ptsA[i + 1][0], y2 = ptsA[i + 1][1];
                  const segLenSq = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
                  if (segLenSq > 40 * 40) continue; // Skip long chords / projection jumps
                  const dSq = pointToSegmentDistSq(px, py, x1, y1, x2, y2);
                  if (dSq <= threshSq) return true;
                }
              }

              return false;
            };

            const clusters: { component: ProcessedFeatureInfo[], groupArea: number }[] = [];

            groups.forEach((items) => {
              let groupArea = 0;
              items.forEach(i => groupArea += Math.max(0.0001, i.apparentPixelArea));

              if (items.length === 1) {
                clusters.push({ component: items, groupArea });
              } else {
                const visited = new Array(items.length).fill(false);
                for (let i = 0; i < items.length; i++) {
                  if (visited[i]) continue;
                  const component: ProcessedFeatureInfo[] = [];
                  const queue: number[] = [i];
                  visited[i] = true;

                  while (queue.length > 0) {
                    const currIdx = queue.shift()!;
                    const currItem = items[currIdx];
                    component.push(currItem);

                    for (let j = 0; j < items.length; j++) {
                      if (!visited[j]) {
                        if (areSubPolygonsAdjacent(currItem, items[j])) {
                          visited[j] = true;
                          queue.push(j);
                        }
                      }
                    }
                  }
                  clusters.push({ component, groupArea });
                }
              }
            });

            // Process each cluster
            clusters.forEach((clusterObj) => {
              const component = clusterObj.component;
              const groupArea = clusterObj.groupArea;
              const isClusterCityState = component.some(item => item.isCityState);
              let totalPixelArea = 0;
              let weightedScreenX = 0;
              let weightedScreenY = 0;
              let maxItemArea = -1;
              let primaryItem = component[0];
              const combinedAllScreenPoints: [number, number][] = [];
              let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

              component.forEach((item) => {
                const area = Math.max(0.0001, item.apparentPixelArea);
                totalPixelArea += area;
                weightedScreenX += item.screenCenter[0] * area;
                weightedScreenY += item.screenCenter[1] * area;
                if (area > maxItemArea) {
                  maxItemArea = area;
                  primaryItem = item;
                }
                if (item.screenRing && item.screenRing.length > 0) {
                  combinedAllScreenPoints.push(...item.screenRing);
                }
                if (item.screenBBox[0] < minX) minX = item.screenBBox[0];
                if (item.screenBBox[1] < minY) minY = item.screenBBox[1];
                if (item.screenBBox[2] > maxX) maxX = item.screenBBox[2];
                if (item.screenBBox[3] > maxY) maxY = item.screenBBox[3];
              });

              let x = totalPixelArea > 0 ? (weightedScreenX / totalPixelArea) : primaryItem.screenCenter[0];
              let y = totalPixelArea > 0 ? (weightedScreenY / totalPixelArea) : primaryItem.screenCenter[1];

              if (minX === Infinity) {
                minX = x - 5; maxX = x + 5;
                minY = y - 5; maxY = y + 5;
              }
              const screenW = Math.max(1, maxX - minX);
              const screenH = Math.max(1, maxY - minY);

              // Skip labeling minor overseas territories only when grouping by sovereign country name (not when grouping by custom color label)
              if (!isColorLabelActive && totalPixelArea < groupArea * 0.15 && totalPixelArea < 4000 && !isClusterCityState) {
                return;
              }

              // Base label text
              let baseLabelText = primaryItem.fullName;
              const isoCode = primaryItem.isoCode;
              if (nameStyle === 'short-code' && isoCode) {
                baseLabelText = isoCode;
              }

              const hasCustomLabel = !!(primaryItem.colorLabel && primaryItem.colorLabel.trim().length > 0 && !primaryItem.colorLabel.trim().toLowerCase().startsWith('flag:'));
              if (hasCustomLabel && (currentMode === 'on-polygons' || currentMode === 'on-map' || currentMode === 'both')) {
                if (currentMode === 'on-polygons' || currentMode === 'on-map') {
                  baseLabelText = primaryItem.colorLabel!;
                } else if (component.length === 1 && primaryItem.colorLabel!.trim().toLowerCase() !== baseLabelText.trim().toLowerCase()) {
                  baseLabelText = `${baseLabelText}: ${primaryItem.colorLabel!}`;
                } else {
                  baseLabelText = primaryItem.colorLabel!;
                }
              }

              if (baseLabelText && (baseLabelText.toLowerCase().startsWith('flag:') || baseLabelText.toUpperCase().startsWith('FLAG:'))) {
                baseLabelText = primaryItem.fullName;
              }

              if (!baseLabelText || baseLabelText.trim().length === 0) return;

              const userMinFont = config.minLabelFontSize !== undefined ? Math.max(0.5, config.minLabelFontSize) : 1;
              const maxFontSize = config.maxLabelFontSize !== undefined ? config.maxLabelFontSize : 5;

              const isArchipelago = !isClusterCityState && (!!primaryItem.labelGeom?.isArchipelago || (component.length >= 3 && primaryItem.apparentPixelArea / Math.max(1, totalPixelArea) < 0.60));

              // 1. Determine anchor position (x, y)
              if (isClusterCityState && primaryItem.microstateCenter) {
                const targetPt = projection(primaryItem.microstateCenter);
                if (targetPt && !isNaN(targetPt[0]) && !isNaN(targetPt[1]) && isFinite(targetPt[0]) && isFinite(targetPt[1])) {
                  x = targetPt[0];
                  y = targetPt[1];
                }
              } else if (!isArchipelago && primaryItem.primaryTarget && primaryItem.primaryTarget.centroid) {
                const targetPt = projection(primaryItem.primaryTarget.centroid);
                if (targetPt && !isNaN(targetPt[0]) && !isNaN(targetPt[1]) && isFinite(targetPt[0]) && isFinite(targetPt[1])) {
                  x = targetPt[0];
                  y = targetPt[1];
                }
              }

              // Detect circular polygon (city-states or geometrically circular polygons)
              let isCircular = isClusterCityState;
              const featRadius = (primaryItem?.feature as any)?._circleRadius !== undefined
                ? (primaryItem.feature as any)._circleRadius
                : 0.55;
              let circleDiameter = isClusterCityState
                ? (featRadius * 2 * config.zoom)
                : Math.max(screenW, screenH);
              if (!isCircular) {
                const aspect = screenW / Math.max(1, screenH);
                if (aspect >= 0.75 && aspect <= 1.35) {
                  const ring = primaryItem.screenRing;
                  if (ring && ring.length >= 8) {
                    let totalR = 0;
                    const radii: number[] = [];
                    for (let i = 0; i < ring.length; i++) {
                      const r = Math.hypot(ring[i][0] - x, ring[i][1] - y);
                      radii.push(r);
                      totalR += r;
                    }
                    const avgR = totalR / ring.length;
                    if (avgR >= 3) {
                      let maxDiff = 0;
                      for (let i = 0; i < radii.length; i++) {
                        const diff = Math.abs(radii[i] - avgR);
                        if (diff > maxDiff) maxDiff = diff;
                      }
                      if (maxDiff / avgR <= 0.25) {
                        isCircular = true;
                        circleDiameter = avgR * 2;
                      }
                    }
                  }
                }
              }

              if (isCircular) {
                const mCenter = primaryItem.microstateCenter || (primaryItem.feature as any)?._enlargedCenter || (primaryItem.isCityState ? getFeatureCenter(primaryItem.feature) : null);
                if (mCenter) {
                  const targetPt = projection(mCenter);
                  if (targetPt && !isNaN(targetPt[0]) && !isNaN(targetPt[1]) && isFinite(targetPt[0]) && isFinite(targetPt[1])) {
                    x = targetPt[0];
                    y = targetPt[1];
                  }
                }
              }

              // 2. Measure available interior space
              let labelText = baseLabelText;
              let availW = screenW * 0.85;
              let availH = screenH * 0.70;

              if (!isArchipelago && !isClusterCityState && !isCircular) {
                const fit = computeHorizontalFitInsidePolygon(
                  primaryItem.screenRing,
                  x,
                  y,
                  primaryItem.screenBBox
                );
                x = fit.adjustedX;
                y = fit.adjustedY;
                availW = fit.availW;
                availH = fit.availH;
              }

              let fontPx = 10;
              if (isCircular) {
                // User requirement: circular polygon's label length must be 80% of the circle's length
                // The names for circular polygons must always be in ISO
                const isLabelReplaced = hasCustomLabel && (currentMode === 'on-polygons' || currentMode === 'on-map' || currentMode === 'both');
                const circularIso = (isoCode && isoCode.trim().length >= 2)
                  ? isoCode.trim()
                  : (
                      (primaryItem?.feature ? (getFeatureIsoCode(primaryItem.feature, selectedMapFile) || getFeatureIsoA2(primaryItem.feature)) : '') ||
                      (primaryItem?.feature?.properties?.adm0_a3 || primaryItem?.feature?.properties?.iso_a3 || primaryItem?.feature?.properties?.iso_a2 || primaryItem?.feature?.properties?.id || '').trim()
                    );

                if (isLabelReplaced) {
                  labelText = primaryItem.colorLabel!;
                } else {
                  labelText = (circularIso && circularIso.length >= 2) ? circularIso : baseLabelText;
                }
                const targetTextWidth = circleDiameter * 0.80;
                offscreenCtx.font = getFontString(16);
                const refWidth = offscreenCtx.measureText(labelText).width || 1;
                fontPx = Math.max(0.5, (targetTextWidth / refWidth) * 16);
              } else {
                // 3. Compute font size to guarantee text fits strictly within availW and availH
                offscreenCtx.font = getFontString(16);
                const refWidth = offscreenCtx.measureText(baseLabelText).width || 1;
                const fontForW = (availW * 0.90 / refWidth) * 16;
                const fontForH = availH * 0.80;
                const idealFontPx = Math.min(fontForW, fontForH);

                const isLabelReplaced = hasCustomLabel && (currentMode === 'on-polygons' || currentMode === 'on-map' || currentMode === 'both');
                if (isLabelReplaced) {
                  labelText = baseLabelText;
                  fontPx = Math.min(idealFontPx, maxFontSize);
                } else if (!isArchipelago) {
                  if (idealFontPx >= userMinFont) {
                    labelText = baseLabelText;
                    fontPx = Math.min(idealFontPx, maxFontSize);
                  } else if (isoCode && isoCode.trim().length >= 2) {
                    const isoText = isoCode.trim();
                    const isoRefW = offscreenCtx.measureText(isoText).width || 1;
                    const isoFontW = (availW * 0.90 / isoRefW) * 16;
                    const isoIdealFontPx = Math.min(isoFontW, fontForH);
                    if (isoIdealFontPx >= idealFontPx) {
                      labelText = isoText;
                      fontPx = Math.min(isoIdealFontPx, maxFontSize);
                    } else {
                      labelText = baseLabelText;
                      fontPx = Math.min(idealFontPx, maxFontSize);
                    }
                  } else {
                    labelText = baseLabelText;
                    fontPx = Math.min(idealFontPx, maxFontSize);
                  }
                } else {
                  // Archipelago
                  const maxAreaFont = Math.max(userMinFont, Math.sqrt(totalPixelArea) * 0.55);
                  const archIdeal = Math.min(fontForW, fontForH, maxAreaFont);
                  if (archIdeal >= userMinFont) {
                    labelText = baseLabelText;
                    fontPx = Math.min(archIdeal, maxFontSize);
                  } else {
                    labelText = (isoCode && isoCode.trim().length >= 2) ? isoCode.trim() : baseLabelText;
                    fontPx = Math.min(archIdeal, maxFontSize);
                  }
                }

                // 4. Strict verification: ensure measured text never exceeds available space
                offscreenCtx.font = getFontString(fontPx);
                let measuredW = offscreenCtx.measureText(labelText).width;
                if (measuredW > availW * 0.90 && measuredW > 0) {
                  fontPx = fontPx * ((availW * 0.90) / measuredW);
                  offscreenCtx.font = getFontString(fontPx);
                  measuredW = offscreenCtx.measureText(labelText).width;
                }
                if (fontPx > availH * 0.80) {
                  fontPx = availH * 0.80;
                  offscreenCtx.font = getFontString(fontPx);
                  measuredW = offscreenCtx.measureText(labelText).width;
                }
              }

              if (fontPx < 0.2) return;

              const dynAngle = 0; // Strictly horizontal
              const dynLetterSpacing = 0;
              const isDynamicMode = false;
              const curveKappa = 0;

              const strokeWidth = fontPx * haloRatio;

              offscreenCtx.font = getFontString(fontPx);
              let totalWidth = offscreenCtx.measureText(labelText).width;

              let areaVal = totalPixelArea;
              if (areaVal <= 0) {
                areaVal = screenW * screenH;
              }

              // Map boundary containment to prevent names from spilling out of map borders
              const mapBorderWidth = config.mapBorderWidth !== undefined ? config.mapBorderWidth : 1.0;
              const borderMargin = Math.max(2.0, (mapBorderWidth / 2) + 2.0);

              let mapMinX = -Infinity;
              let mapMinY = -Infinity;
              let mapMaxX = Infinity;
              let mapMaxY = Infinity;

              if (!isNoGeoref) {
                try {
                  const sb = pathGenerator.bounds({ type: 'Sphere' });
                  if (sb && isFinite(sb[0][0]) && isFinite(sb[0][1]) && isFinite(sb[1][0]) && isFinite(sb[1][1])) {
                    mapMinX = Math.max(mapMinX, sb[0][0] + borderMargin);
                    mapMinY = Math.max(mapMinY, sb[0][1] + borderMargin);
                    mapMaxX = Math.min(mapMaxX, sb[1][0] - borderMargin);
                    mapMaxY = Math.min(mapMaxY, sb[1][1] - borderMargin);
                  }
                } catch (e) {}
              }

              if (isOrthographicProj) {
                if (edgeAngle < 89.5) {
                  // When edgeAngle < 89.5, portion of globe is framed inside rectangular border
                  const minFrameX = globeCenterX - globeRadius90 + borderMargin;
                  const maxFrameX = globeCenterX + globeRadius90 - borderMargin;
                  const minFrameY = globeCenterY - globeRadius90 + borderMargin;
                  const maxFrameY = globeCenterY + globeRadius90 - borderMargin;

                  const halfW = totalWidth / 2;
                  const halfH = fontPx * 0.6;
                  if (x < minFrameX || x > maxFrameX || y < minFrameY || y > maxFrameY) return;

                  if (!isCircular) {
                    if (x - halfW < minFrameX) x = minFrameX + halfW;
                    if (x + halfW > maxFrameX) x = maxFrameX - halfW;
                    if (y - halfH < minFrameY) y = minFrameY + halfH;
                    if (y + halfH > maxFrameY) y = maxFrameY - halfH;
                  }

                  if (totalWidth > maxFrameX - minFrameX) {
                    const maxAllowedW = maxFrameX - minFrameX;
                    const scaleRatio = maxAllowedW / totalWidth;
                    fontPx = scaleRatio * fontPx;
                    offscreenCtx.font = getFontString(fontPx);
                    totalWidth = offscreenCtx.measureText(labelText).width;
                  }
                } else {
                  // Full globe hemisphere is framed inside circular boundary
                  const dist = Math.hypot(x - globeCenterX, y - globeCenterY);
                  const maxR = globeRadius90 - borderMargin;
                  if (dist > maxR) return;
                  if (dist + totalWidth / 2 > maxR) {
                    const maxAllowedW = Math.max(0, (maxR - dist) * 2);
                    if (maxAllowedW < 4) return;
                    const scaledFont = (maxAllowedW / totalWidth) * fontPx;
                    fontPx = Math.max(scaledFont, userMinFont * 0.7);
                    offscreenCtx.font = getFontString(fontPx);
                    totalWidth = offscreenCtx.measureText(labelText).width;
                  }
                }
              } else if (!isNoGeoref && !isClusterCityState && !isCircular) {
                const halfW = totalWidth / 2;
                const halfH = fontPx * 0.6;
                if (x - halfW < mapMinX) x = mapMinX + halfW;
                if (x + halfW > mapMaxX) x = mapMaxX - halfW;
                if (y - halfH < mapMinY) y = mapMinY + halfH;
                if (y + halfH > mapMaxY) y = mapMaxY - halfH;

                if (totalWidth > mapMaxX - mapMinX) {
                  const maxAllowedW = mapMaxX - mapMinX;
                  const scaleRatio = maxAllowedW / totalWidth;
                  fontPx = scaleRatio * fontPx;
                  offscreenCtx.font = getFontString(fontPx);
                  totalWidth = offscreenCtx.measureText(labelText).width;
                }
              }

              labelsToRender.push({
                id: primaryItem.countryId || isoCode || labelText,
                labelText,
                x,
                y,
                fontPx,
                dynAngle,
                dynLetterSpacing,
                strokeWidth,
                textColor,
                haloColor,
                totalWidth,
                isDynamicMode,
                isCityState: isClusterCityState,
                area: areaVal,
                curveKappa,
              });
            });

            cachedLabelsToRenderRef.current = labelsToRender;
            cachedLabelsKeyRef.current = currentLabelCacheKey;
            if (labelRenderCacheMapRef.current.size > 15) {
              const firstKey = labelRenderCacheMapRef.current.keys().next().value;
              if (firstKey) labelRenderCacheMapRef.current.delete(firstKey);
            }
            labelRenderCacheMapRef.current.set(currentLabelCacheKey, labelsToRender);
            }


            // Render all labels
            // Sort to render largest area first, so smaller labels drop out if they collide
            const sortedLabelsToRender = [...labelsToRender].sort((a, b) => (b.area || 0) - (a.area || 0));
            const drawnBoxes: [number, number, number, number][] = [];

            sortedLabelsToRender.forEach((item) => {
              if (
                item.x < -300 ||
                item.x > curBaseW + 300 ||
                item.y < -300 ||
                item.y > curBaseH + 300
              ) {
                return;
              }

              let renderFontPx = item.fontPx;
              let renderTotalW = item.totalWidth;

              // Check if tight collision with an already drawn label exists
              const w = renderTotalW * 0.75;
              const h = renderFontPx * 0.75;
              
              const itemBBox: [number, number, number, number] = [
                item.x - w / 2,
                item.y - h / 2,
                item.x + w / 2,
                item.y + h / 2
              ];
              
              let collision = false;
              for (const box of drawnBoxes) {
                if (
                  itemBBox[0] < box[2] &&
                  itemBBox[2] > box[0] &&
                  itemBBox[1] < box[3] &&
                  itemBBox[3] > box[1]
                ) {
                  collision = true;
                  break;
                }
              }
              
              // If there's an overlap, slightly shrink font to maintain legibility instead of hiding the name
              if (collision) {
                renderFontPx = renderFontPx * 0.82;
              }

              drawnBoxes.push(itemBBox);

              offscreenCtx.save();
              offscreenCtx.font = getFontString(renderFontPx);
              offscreenCtx.textAlign = 'center';
              offscreenCtx.textBaseline = 'middle';

              const strokeWidth = renderFontPx * haloRatio;
              if (strokeWidth > 0.01 && item.haloColor) {
                offscreenCtx.strokeStyle = item.haloColor;
                offscreenCtx.lineWidth = strokeWidth;
                offscreenCtx.lineJoin = 'round';
                offscreenCtx.strokeText(item.labelText, item.x, item.y);
              }

              offscreenCtx.fillStyle = item.textColor;
              offscreenCtx.fillText(item.labelText, item.x, item.y);

              offscreenCtx.restore();
            });
          }
        offscreenCtx.restore();

        // 9. If orthographic, render clean flat outer bezel ring border for depth (no radial shading/vignette)
        if (isOrthographicProj && edgeAngle >= 89.5) {
          offscreenCtx.beginPath();
          offscreenCtx.arc(globeCenterX, globeCenterY, globeRadius, 0, Math.PI * 2);
          offscreenCtx.lineWidth = 1.2;
          offscreenCtx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(0, 0, 0, 0.28)';
          offscreenCtx.stroke();
        }

        // Restore rectangular map clip if orthographic
        if (hasOrthoRectClip) {
          offscreenCtx.restore();
          hasOrthoRectClip = false;
        }

        // 9.1 Render SECOND RECTANGULAR map border around orthographic globe with same height and width as globe at 90 edge angle
        if (isOrthographicProj && mapBorderThickness > 0 && !isNoGeoref) {
          const mapBorderColorResolved = config.mapBorderColor && config.mapBorderColor !== 'default'
            ? config.mapBorderColor
            : boundaryColor;

          offscreenCtx.save();
          offscreenCtx.setLineDash([]);
          offscreenCtx.lineWidth = mapBorderThickness;
          offscreenCtx.strokeStyle = mapBorderColorResolved;
          offscreenCtx.lineJoin = 'miter';
          offscreenCtx.miterLimit = 4;
          offscreenCtx.lineCap = 'square';
          offscreenCtx.strokeRect(rectX, rectY, rectWidth, rectHeight);
          offscreenCtx.restore();
        }

        // Draw "Made with MapPainter" Watermark inside map viewport transform so it scales and moves 1:1 with the map
        offscreenCtx.save();
        let unzoomedMaxX = curBaseW - 16;
        let unzoomedMaxY = dimensions.height - 14;
        if (isOrthographicProj) {
          unzoomedMaxX = rectX + rectWidth;
          unzoomedMaxY = rectY + rectHeight;
        } else if (!isNoGeoref) {
          try {
            const sb = pathGenerator.bounds({ type: 'Sphere' });
            if (sb && isFinite(sb[1][0]) && isFinite(sb[1][1])) {
              unzoomedMaxX = sb[1][0];
              unzoomedMaxY = sb[1][1];
            }
          } catch (e) {}
        } else if (features && features.length > 0) {
          let mx = -Infinity;
          let my = -Infinity;
          features.forEach((f) => {
            try {
              const fb = pathGenerator.bounds(f);
              if (fb && isFinite(fb[1][0]) && isFinite(fb[1][1])) {
                mx = Math.max(mx, fb[1][0]);
                my = Math.max(my, fb[1][1]);
              }
            } catch (e) {}
          });
          if (isFinite(mx) && isFinite(my)) {
            unzoomedMaxX = mx;
            unzoomedMaxY = my;
          }
        }

        const watermarkText = 'Made with MapPainter';
        const wmX = unzoomedMaxX - 16;
        const wmY = unzoomedMaxY - 14;
        offscreenCtx.font = getWatermarkFontString(fontFam, 11);
        offscreenCtx.textAlign = 'right';
        offscreenCtx.textBaseline = 'bottom';
        offscreenCtx.lineWidth = 3;
        offscreenCtx.lineJoin = 'round';
        offscreenCtx.strokeStyle = isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(255, 255, 255, 0.75)';
        offscreenCtx.strokeText(watermarkText, wmX, wmY);
        offscreenCtx.fillStyle = isDark ? 'rgba(253, 252, 248, 0.85)' : 'rgba(18, 18, 18, 0.85)';
        offscreenCtx.fillText(watermarkText, wmX, wmY);
        offscreenCtx.restore();

        // 10. Render Cartographic Map Legend Box Overlay directly on map graphic
        if (config.showMapLegend === true || config.colorLabelMode === 'on-legend') {
          // Collect legend entries ONLY for colors actively painted/used on the map
          const activeColorsSet = new Set<string>();
          const originalColorMap = new Map<string, string>();

          if (customColors) {
            Object.values(customColors).forEach((c) => {
              if (c && !c.startsWith('flag:')) {
                const norm = c.toLowerCase();
                activeColorsSet.add(norm);
                if (!originalColorMap.has(norm)) {
                  originalColorMap.set(norm, c);
                }
              }
            });
          }

          // Build case-insensitive lookup dictionary for legendLabels
          const normLegendLabels: Record<string, string> = {};
          if (legendLabels) {
            Object.entries(legendLabels).forEach(([col, txt]) => {
              if (col && txt) {
                normLegendLabels[col.toLowerCase()] = txt.trim();
              }
            });
          }

          const colorRows: LegendRowItem[] = [];
          activeColorsSet.forEach((normColor) => {
            const actualColor = originalColorMap.get(normColor) || normColor;
            const labelText = normLegendLabels[normColor] || normLegendLabels[actualColor] || actualColor.toUpperCase();
            colorRows.push({ kind: 'color', color: actualColor, text: labelText });
          });

          let locationRows: LegendRowItem[] = [];
          if (showLocations && importedLocations && importedLocations.length > 0 && config.showLocationGroupsInLegend !== false) {
            locationRows = buildLocationLegendRows(importedLocations, admin0Size, admin1Size);
          }

          // No fallback default legend entries for oceans or uncolored land

          if (colorRows.length > 0 || locationRows.length > 0) {
            offscreenCtx.save();
            
            const titleText = (config.legendTitle && config.legendTitle.trim()) ? config.legendTitle.trim() : 'MAP LEGEND';
            const pos = config.legendPosition || 'below';

            // Get base map bounding box on canvas (unzoomed base identity)
            const mapCrop = getMapBoundingBoxScreen(true);

            // Compute exact outer map width and height including outer borders
            let mapOuterMinX = 12;
            let mapOuterMaxX = curBaseW - 12;
            let mapOuterMinY = 12;
            let mapOuterMaxY = dimensions.height - 12;

            if (isOrthographicProj) {
              mapOuterMinX = rectX;
              mapOuterMaxX = rectX + rectWidth;
              mapOuterMinY = rectY;
              mapOuterMaxY = rectY + rectHeight;
            } else if (!isNoGeoref) {
              try {
                const sb = pathGenerator.bounds({ type: 'Sphere' });
                if (sb && isFinite(sb[0][0]) && isFinite(sb[1][0]) && sb[1][0] > sb[0][0]) {
                  mapOuterMinX = sb[0][0];
                  mapOuterMaxX = sb[1][0];
                  mapOuterMinY = sb[0][1];
                  mapOuterMaxY = sb[1][1];
                }
              } catch (e) {}
            } else if (features && features.length > 0) {
              let minF = Infinity;
              let maxF = -Infinity;
              let minFY = Infinity;
              let maxFY = -Infinity;
              features.forEach((f) => {
                try {
                  const fb = pathGenerator.bounds(f);
                  if (fb && isFinite(fb[0][0]) && isFinite(fb[1][0])) {
                    minF = Math.min(minF, fb[0][0]);
                    maxF = Math.max(maxF, fb[1][0]);
                    minFY = Math.min(minFY, fb[0][1]);
                    maxFY = Math.max(maxFY, fb[1][1]);
                  }
                } catch (e) {}
              });
              if (isFinite(minF) && isFinite(maxF) && maxF > minF) {
                mapOuterMinX = minF;
                mapOuterMaxX = maxF;
                mapOuterMinY = minFY;
                mapOuterMaxY = maxFY;
              }
            }

            mapOuterMinX = Math.max(0, mapOuterMinX);
            mapOuterMaxX = Math.min(curBaseW, mapOuterMaxX);

            const cardX = mapOuterMinX;
            const cardWidth = Math.max(160, mapOuterMaxX - mapOuterMinX);

            // Compute horizontal wrapping item positions
            offscreenCtx.font = getLegendItemFontString(fontFam, 9.5);
            const itemPaddingX = 16;
            const rowHeight = 20;
            const headerHeight = 24;

            interface PlacedLegendItem {
              row: LegendRowItem;
              x: number;
              relY: number;
              width: number;
              text: string;
            }

            const placedColorItems: PlacedLegendItem[] = [];
            const placedLocationItems: PlacedLegendItem[] = [];

            let currRowX = cardX + 12;
            let currRelY = headerHeight + 6;

            // 1. Layout color rows
            if (colorRows.length > 0) {
              colorRows.forEach((row) => {
                const textMetrics = offscreenCtx.measureText(row.text);
                const textWidth = textMetrics.width;
                const itemWidth = 16 + 6 + textWidth + itemPaddingX;

                if (currRowX > cardX + 12 && currRowX + itemWidth > cardX + cardWidth - 12) {
                  currRowX = cardX + 12;
                  currRelY += rowHeight;
                }

                placedColorItems.push({
                  row,
                  x: currRowX,
                  relY: currRelY,
                  width: itemWidth,
                  text: row.text,
                });

                currRowX += itemWidth;
              });
            }

            // 2. Section divider if both colors and location labels exist
            let sectionDividerRelY: number | null = null;
            if (colorRows.length > 0 && locationRows.length > 0) {
              sectionDividerRelY = currRelY + rowHeight + 4;
              currRelY = sectionDividerRelY + 8;
              currRowX = cardX + 12;
            } else if (colorRows.length === 0 && locationRows.length > 0) {
              currRelY = headerHeight + 6;
              currRowX = cardX + 12;
            }

            // 3. Layout location rows
            if (locationRows.length > 0) {
              locationRows.forEach((row) => {
                const textMetrics = offscreenCtx.measureText(row.text);
                const textWidth = textMetrics.width;
                const itemWidth = 16 + 6 + textWidth + itemPaddingX;

                if (currRowX > cardX + 12 && currRowX + itemWidth > cardX + cardWidth - 12) {
                  currRowX = cardX + 12;
                  currRelY += rowHeight;
                }

                placedLocationItems.push({
                  row,
                  x: currRowX,
                  relY: currRelY,
                  width: itemWidth,
                  text: row.text,
                });

                currRowX += itemWidth;
              });
            }

            const cardHeight = currRelY + rowHeight + 6;

            const isAbove = pos === 'above' || pos === 'top-left' || pos === 'top-right';
            let cardY = 12;

            if (isAbove) {
              // Above Map: position directly bordering top of map
              const baseMinY = mapOuterMinY !== undefined ? mapOuterMinY : (mapCrop.mapMinY !== undefined ? mapCrop.mapMinY : mapCrop.minY);
              cardY = baseMinY - cardHeight;
            } else {
              // Below Map: strictly borders the map's lower borders
              const baseMaxY = mapOuterMaxY !== undefined ? mapOuterMaxY : (mapCrop.mapMaxY !== undefined ? mapCrop.mapMaxY : mapCrop.maxY);
              cardY = baseMaxY;
            }

            // Draw background card (completely rectangular, strictly bordering map's lower borders)
            offscreenCtx.fillStyle = isDark ? 'rgba(24, 24, 22, 0.96)' : 'rgba(253, 252, 248, 0.96)';
            offscreenCtx.beginPath();
            offscreenCtx.rect(cardX, cardY, cardWidth, cardHeight);
            offscreenCtx.fill();

            const effMapBorderThickness = config.mapBorderWidth !== undefined ? config.mapBorderWidth : 0.2;
            const effMapBorderColor = (config.mapBorderColor && config.mapBorderColor !== 'default')
              ? config.mapBorderColor
              : boundaryColor;

            const effLegendBorderWidth = (config.legendBorderWidth !== undefined && config.legendBorderWidth !== null)
              ? config.legendBorderWidth
              : effMapBorderThickness;
            const effLegendBorderColor = (config.legendBorderColor && config.legendBorderColor !== 'default')
              ? config.legendBorderColor
              : effMapBorderColor;

            if (effLegendBorderWidth > 0) {
              offscreenCtx.save();
              offscreenCtx.strokeStyle = effLegendBorderColor;
              offscreenCtx.lineWidth = effLegendBorderWidth;
              offscreenCtx.lineJoin = 'miter';
              offscreenCtx.miterLimit = 4;
              offscreenCtx.lineCap = 'square';
              offscreenCtx.setLineDash([]);
              offscreenCtx.beginPath();
              offscreenCtx.rect(cardX, cardY, cardWidth, cardHeight);
              offscreenCtx.stroke();
              offscreenCtx.restore();
            }

            // Draw Header
            offscreenCtx.fillStyle = isDark ? '#fdfcf8' : '#121212';
            offscreenCtx.font = getLegendTitleFontString(fontFam, 9.5);
            offscreenCtx.textAlign = 'left';
            offscreenCtx.textBaseline = 'top';
            offscreenCtx.fillText(titleText.toUpperCase(), cardX + 12, cardY + 7);

            // Title Divider line
            offscreenCtx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)';
            offscreenCtx.lineWidth = 1;
            offscreenCtx.beginPath();
            offscreenCtx.moveTo(cardX + 12, cardY + 22);
            offscreenCtx.lineTo(cardX + cardWidth - 12, cardY + 22);
            offscreenCtx.stroke();

            // Section Divider line between colors and location labels
            if (sectionDividerRelY !== null) {
              offscreenCtx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)';
              offscreenCtx.lineWidth = 1;
              offscreenCtx.beginPath();
              offscreenCtx.moveTo(cardX + 12, cardY + sectionDividerRelY);
              offscreenCtx.lineTo(cardX + cardWidth - 12, cardY + sectionDividerRelY);
              offscreenCtx.stroke();
            }

            // Draw Color Items
            placedColorItems.forEach((item) => {
              const itemAbsY = cardY + item.relY;
              // Color Swatch
              offscreenCtx.fillStyle = item.row.color;
              offscreenCtx.beginPath();
              offscreenCtx.rect(item.x, itemAbsY, 12, 12);
              offscreenCtx.fill();
              offscreenCtx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)';
              offscreenCtx.lineWidth = 0.8;
              offscreenCtx.stroke();

              // Text Label
              offscreenCtx.fillStyle = isDark ? '#e2e2e2' : '#262626';
              offscreenCtx.font = getLegendItemFontString(fontFam, 9.5);
              offscreenCtx.textAlign = 'left';
              offscreenCtx.textBaseline = 'middle';
              offscreenCtx.fillText(item.text, item.x + 18, itemAbsY + 6);
            });

            // Draw Location Items
            placedLocationItems.forEach((item) => {
              const itemAbsY = cardY + item.relY;
              // Location Group Symbol
              drawLocationSymbol(offscreenCtx, item.x + 6, itemAbsY + 6, item.row.shape || 'red_circle', 10, 1, isDark, item.row.color);

              // Text Label
              offscreenCtx.fillStyle = isDark ? '#e2e2e2' : '#262626';
              offscreenCtx.font = getLegendItemFontString(fontFam, 9.5);
              offscreenCtx.textAlign = 'left';
              offscreenCtx.textBaseline = 'middle';
              offscreenCtx.fillText(item.text, item.x + 18, itemAbsY + 6);
            });

            offscreenCtx.restore();
          }
        }

        offscreenCtx.restore(); // Restore inner content save

        offscreenCtx.restore(); // Restore outer scale(dpr, dpr) save
      };
      renderMapToContextRef.current = drawMapContent;

      if (needsBaseRedrawRef.current && baseCtx) {
        wasRedrawn = true;
        try {
          drawMapContent(baseCtx, baseDpr);
        } catch (err) {
          console.error("Error rendering base map canvas:", err);
        } finally {
          try {
            baseCtx.setTransform(1, 0, 0, 1, 0, 0);
          } catch (e) {}
          baseCanvasZoomRef.current = currentZoom;
          baseCanvasPanRef.current = { ...currentPan };
          needsBaseRedrawRef.current = false;
        }
      }

      // 1. Hardware WebGL GPU compositor rendering pass (120 FPS GPU quad blit with bilinear filtering)
      let webglRenderedSuccessfully = false;
      if (webglEngineRef.current && webglCanvasRef.current && baseCanvas) {
        try {
          const baseZoom = baseCanvasZoomRef.current || 1;
          const basePan = baseCanvasPanRef.current || { x: 0, y: 0 };
          webglEngineRef.current.renderCompositedBase(
            baseCanvas,
            currentPan,
            currentZoom,
            basePan,
            baseZoom,
            overscanFactor,
            marginX,
            marginY,
            isOrthographicProj ? skyboxColor : bgColor,
            wasRedrawn
          );
          webglRenderedSuccessfully = true;
        } catch (e) {
          // Fallback to 2D canvas blit
        }
      }

      if (webglRenderedSuccessfully) {
        // Clear 2D context so GPU WebGL canvas shines through smoothly with zero CPU overhead
        ctx.clearRect(0, 0, targetWidth, targetHeight);
      } else {
        // Fallback: 2D hardware-accelerated drawImage blit
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        if (baseCanvas) {
          const baseZoom = baseCanvasZoomRef.current || 1;
          const s = currentZoom / baseZoom;
          const basePan = baseCanvasPanRef.current || { x: 0, y: 0 };
          const tx = currentPan.x - basePan.x * s;
          const ty = currentPan.y - basePan.y * s;

          ctx.save();
          ctx.scale(dpr, dpr);
          ctx.save();
          ctx.translate(tx, ty);
          ctx.scale(s, s);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(
            baseCanvas,
            -marginX,
            -marginY,
            dimensions.width * overscanFactor,
            dimensions.height * overscanFactor
          );
          ctx.restore();
          ctx.restore();
        }
      }

      // Draw dynamic interactive highlights (fills and borders) directly onscreen for maximum performance
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.save();
      ctx.translate(currentPan.x, currentPan.y);
      ctx.scale(currentZoom, currentZoom);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      let hasOnscreenSphereClip = false;
      if (isOrthographicProj) {
        const globeRadius90 = Math.min(projDimensions.width, projDimensions.height) * 0.45 * config.zoom;
        const globeCenterX = projDimensions.width / 2;
        const globeCenterY = projDimensions.height / 2;
        ctx.save();
        ctx.beginPath();
        ctx.rect(globeCenterX - globeRadius90, globeCenterY - globeRadius90, globeRadius90 * 2, globeRadius90 * 2);
        ctx.clip();
        hasOnscreenSphereClip = true;
      }

      const pathGeneratorOnscreen = d3.geoPath(projection, ctx);

      // Helper to retrieve or create Path2D for selections/highlights (uses the exact same cached paths!)
      const getOrCreatePath2DOnscreen = (feature: CountryFeature): Path2D | null => {
        const countryId = getCountryId(feature) + ((feature as any)._enlarged ? '_enlarged' : '');
        const scaleKey = Math.round(projection.scale());
        const rotLonKey = Math.round(localRotationRef.current ? localRotationRef.current.lon : (config.centerLon || 0));
        const rotLatKey = Math.round(localRotationRef.current ? localRotationRef.current.lat : (config.centerLat || 0));
        const aspectKey = Math.round((config.aspect || 0) * 10) / 10;
        const cacheKey = `${config.projection}_${countryId}_s${scaleKey}_r${rotLonKey}_${rotLatKey}_a${aspectKey}`;
        let path2d = path2DCacheRef.current.get(cacheKey);
        if (!path2d && !isDraggingGlobe.current) {
          try {
            const pathStr = d3.geoPath(projection)(feature);
            if (pathStr && !pathStr.includes('NaN') && !pathStr.includes('undefined')) {
              path2d = new Path2D(pathStr);
              path2DCacheRef.current.set(cacheKey, path2d);
            }
          } catch (e) {
            console.warn('Error generating Path2D for feature:', countryId, e);
          }
        }
        return path2d || null;
      };

      const isFeatureOccluded = (feature: CountryFeature): boolean => {
        if (!isOrthographicProj && config.projection !== 'gnomonic') return false;
        const trig = getCentroidTrig(feature, centroidTrigCacheRef.current, centroidCacheRef.current);
        if (!trig) return false;
        const lon0Rad = (localRotationRef.current.lon * Math.PI) / 180;
        const lat0Rad = (localRotationRef.current.lat * Math.PI) / 180;
        const sin_lat0 = Math.sin(lat0Rad);
        const cos_lat0 = Math.cos(lat0Rad);
        const cos_c = sin_lat0 * trig.sin_lat + cos_lat0 * trig.cos_lat * Math.cos(trig.lonRad - lon0Rad);
        if (isOrthographicProj) {
          const geoRadiusRad = (getFeatureGeoRadius(feature, trig, isNoGeoref) * Math.PI) / 180;
          const limit = -Math.sin(geoRadiusRad) - 0.05;
          return cos_c < limit;
        }
        if (config.projection === 'gnomonic' && !isNoGeoref) {
          return cos_c < 0.5;
        }
        return false;
      };

      const drawSingleHighlightOnscreen = (feature: CountryFeature, fillStyle: string) => {
        if (isFeatureOccluded(feature)) return;
        if ((feature as any)._enlarged) {
          const center = (feature as any)._enlargedCenter || getFeatureCenter(feature);
          if (center) {
            const projCenter = projection(center);
            if (projCenter && !isNaN(projCenter[0]) && !isNaN(projCenter[1])) {
              const circleRadius = (feature as any)._circleRadius !== undefined ? (feature as any)._circleRadius : 0.55;
              ctx.save();
              ctx.fillStyle = fillStyle;
              ctx.beginPath();
              ctx.arc(projCenter[0], projCenter[1], circleRadius, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
          }
          return;
        }
        ctx.fillStyle = fillStyle;
        try {
          const path2d = getOrCreatePath2DOnscreen(feature);
          if (path2d) {
            ctx.fill(path2d);
          } else {
            ctx.beginPath();
            pathGeneratorOnscreen(feature);
            ctx.fill();
          }
        } catch (e) {}
      };

      const drawSingleBorderHighlightOnscreen = (feature: CountryFeature, strokeStyle: string, lineWidth: number) => {
        if (isFeatureOccluded(feature)) return;
        if ((feature as any)._enlarged) {
          const center = (feature as any)._enlargedCenter || getFeatureCenter(feature);
          if (center) {
            const projCenter = projection(center);
            if (projCenter && !isNaN(projCenter[0]) && !isNaN(projCenter[1])) {
              const circleRadius = (feature as any)._circleRadius !== undefined ? (feature as any)._circleRadius : 0.55;
              ctx.save();
              ctx.lineWidth = lineWidth;
              ctx.strokeStyle = strokeStyle;
              ctx.beginPath();
              ctx.arc(projCenter[0], projCenter[1], circleRadius, 0, Math.PI * 2);
              ctx.stroke();
              ctx.restore();
            }
          }
          return;
        }
        ctx.save();
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = strokeStyle;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.setLineDash([]);
        try {
          const path2d = getOrCreatePath2DOnscreen(feature);
          if (path2d) {
            ctx.stroke(path2d);
          } else {
            ctx.beginPath();
            pathGeneratorOnscreen(feature);
            ctx.stroke();
          }
        } catch (e) {}
        ctx.restore();
      };

      const baseBorderW = config.countryBorderWidth !== undefined ? config.countryBorderWidth : (config.borderWidth !== undefined ? config.borderWidth : 0.2);
      const hoverBorderWidth = Math.max(0.05, baseBorderW * 1.3);
      const selectedBorderWidth = Math.max(0.05, baseBorderW * 1.8);

      if (selectedCountryRef.current) {
        drawSingleHighlightOnscreen(selectedCountryRef.current, 'rgba(239, 68, 68, 0.18)');
      }
      const activeHover = hoveredCountryRef.current;
      if (activeHover && !isInteracting) {
        const groupFeats = getHoveredGroupFeatures(activeHover);
        if (groupFeats && groupFeats.length > 0) {
          ctx.save();
          ctx.fillStyle = 'rgba(59, 130, 246, 0.22)';
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = hoverBorderWidth;
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          ctx.setLineDash([]);

          const fillBatch = new Path2D();
          let hasBatch = false;
          for (let i = 0; i < groupFeats.length; i++) {
            const f = groupFeats[i];
            if (isFeatureOccluded(f)) continue;
            const p2d = getOrCreatePath2DOnscreen(f);
            if (p2d) {
              fillBatch.addPath(p2d);
              hasBatch = true;
            }
          }
          if (hasBatch) {
            ctx.fill(fillBatch);
            ctx.stroke(fillBatch);
          }
          ctx.restore();
        } else {
          drawSingleHighlightOnscreen(activeHover, 'rgba(59, 130, 246, 0.22)');
          drawSingleBorderHighlightOnscreen(activeHover, '#3b82f6', hoverBorderWidth);
        }
      }
      if (selectedCountryRef.current) {
        drawSingleBorderHighlightOnscreen(selectedCountryRef.current, '#ef4444', selectedBorderWidth);
      }

      // Real-time interactive overlay for selected border polygons & preview border
      if (selectedBorderCountryIdsRef.current && selectedBorderCountryIdsRef.current.length > 0) {
        if (previewBorderRef.current) {
          const pb = previewBorderRef.current;
          ctx.save();
          ctx.lineWidth = pb.width || 0.4;
          ctx.strokeStyle = pb.color || '#ff0000';
          if (pb.style === 'dashed') {
            ctx.setLineDash([pb.dashLength || 6, pb.gapLength || 4]);
          } else {
            ctx.setLineDash([]);
          }
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          try {
            ctx.beginPath();
            pathGeneratorOnscreen(pb.geometry);
            ctx.stroke();
          } catch (e) {}
          ctx.restore();
        } else {
          const selBorderW = Math.max(0.6, Math.min(1.2, baseBorderW * 2.0));
          ctx.save();
          ctx.lineWidth = selBorderW;
          ctx.strokeStyle = '#06b6d4';
          ctx.setLineDash([5, 2.5]);
          selectedBorderCountryIdsRef.current.forEach((id) => {
            const feat = featureMapRef.current.get(id);
            if (feat && !isFeatureOccluded(feat)) {
              try {
                const path2d = getOrCreatePath2DOnscreen(feat);
                if (path2d) {
                  ctx.stroke(path2d);
                } else {
                  ctx.beginPath();
                  pathGeneratorOnscreen(feat);
                  ctx.stroke();
                }
              } catch (e) {}
            }
          });
          ctx.restore();
        }
      }

      if (hasOnscreenSphereClip) {
        ctx.restore();
      }

      ctx.restore();
      ctx.restore();

      const endDraw = performance.now();
      const currentFrameDrawDuration = endDraw - startDraw;

      const now = performance.now();
      
      // Calculate authentic and honest interactive FPS
      if (wasRedrawn) {
        lastMapDrawDurationRef.current = currentFrameDrawDuration;

        if (lastRedrawTimeRef.current > 0) {
          const delta = now - lastRedrawTimeRef.current;
          if (delta > 0) {
            const currentFps = 1000 / delta;
            // Cap at 60 to prevent browser loop scheduling artifacts
            const cappedFps = Math.min(60, currentFps);
            redrawFpsHistoryRef.current.push(cappedFps);
            if (redrawFpsHistoryRef.current.length > 30) {
              redrawFpsHistoryRef.current.shift();
            }
          }
        }
        lastRedrawTimeRef.current = now;
      }

      const isStatic = (now - lastRedrawTimeRef.current) > 1000;
      
      const avgFps = redrawFpsHistoryRef.current.length > 0
        ? Math.round(redrawFpsHistoryRef.current.reduce((a, b) => a + b, 0) / redrawFpsHistoryRef.current.length)
        : 60;

      // Display actual average FPS
      const displayFps = isStatic ? 60 : Math.max(1, avgFps);
      const displayMs = lastMapDrawDurationRef.current > 0 ? lastMapDrawDurationRef.current : currentFrameDrawDuration;

      // Save last drawn state
      lastDrawnStateRef.current = {
        panX: currentPan.x,
        panY: currentPan.y,
        zoom: currentZoom,
        width: dimensions.width,
        height: dimensions.height,
        hoveredId: hoverId,
        selectedId: selectId,
        dpr,
        isInteracting,
      };
    } catch (err) {
      console.error("MapCanvas render frame error:", err);
    }
  };

  // Continuous High performance Canvas 2D Render loop
  useEffect(() => {
    let animationFrameId: number;

    const loop = () => {
      try {
        if (renderRef.current) {
          renderRef.current();
        }
      } finally {
        animationFrameId = requestAnimationFrame(loop);
      }
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const enlargedFeaturesList = React.useMemo(() => {
    if (features.length > 500) return [];
    return features.filter((f) => (f as any)._enlarged);
  }, [features]);

  // High-performance precomputed group stats index for O(1) hover tooltip queries
  const groupStatsIndex = React.useMemo(() => {
    if (!brushScope || brushScope === 'single' || !features.length) return null;
    const index = new Map<string, { count: number; popSum: number; gdpSum: number; areaSum: number }>();
    
    for (let i = 0; i < features.length; i++) {
      const f = features[i];
      if (!f.properties) continue;
      let val = f.properties[brushScope];
      if (val === undefined) {
        const fRawKeys = Object.keys(f.properties);
        const fMatchedKey = fRawKeys.find(k => k.toLowerCase() === brushScope.toLowerCase()) || brushScope;
        val = f.properties[fMatchedKey];
      }
      if (val !== undefined && val !== null) {
        const key = String(val);
        let entry = index.get(key);
        if (!entry) {
          entry = { count: 0, popSum: 0, gdpSum: 0, areaSum: 0 };
          index.set(key, entry);
        }
        entry.count++;

        const fCode = (f.properties.adm0_a3 || f.properties.iso_a3 || '').toLowerCase();
        const fMeta = countryMetadataMap?.[fCode];
        let fPop = f.properties.pop_est;
        let fGdp = f.properties.gdp_md_est;
        if (fPop === undefined && fMeta?.pop_est !== undefined) fPop = fMeta.pop_est;
        if (fGdp === undefined && fMeta?.gdp_md_est !== undefined) fGdp = fMeta.gdp_md_est;

        if (typeof fPop === 'number' && !isNaN(fPop)) entry.popSum += fPop;
        if (typeof fGdp === 'number' && !isNaN(fGdp)) entry.gdpSum += fGdp;

        const fArea = f.properties.area_km2 ?? f.properties.area ?? f.properties.AREA ?? f.properties.shape_area ?? f.properties.Shape_Area;
        if (typeof fArea === 'number' && !isNaN(fArea)) entry.areaSum += fArea;
        else if (typeof fArea === 'string' && !isNaN(Number(fArea))) entry.areaSum += Number(fArea);
      }
    }
    return index;
  }, [features, brushScope, countryMetadataMap]);

  // High-performance precomputed group features index for instant O(1) group brush queries
  const groupFeaturesIndex = React.useMemo(() => {
    if (!brushScope || brushScope === 'single' || !features.length) return null;
    const index = new Map<string, CountryFeature[]>();
    for (let i = 0; i < features.length; i++) {
      const f = features[i];
      if (!f.properties) continue;
      let val = f.properties[brushScope];
      if (val === undefined) {
        const fRawKeys = Object.keys(f.properties);
        const fMatchedKey = fRawKeys.find(k => k.toLowerCase() === brushScope.toLowerCase()) || brushScope;
        val = f.properties[fMatchedKey];
      }
      if (val !== undefined && val !== null) {
        const key = String(val);
        let list = index.get(key);
        if (!list) {
          list = [];
          index.set(key, list);
        }
        list.push(f);
      }
    }
    return index;
  }, [features, brushScope]);

  const getHoveredGroupFeatures = React.useCallback((hovered: CountryFeature | null): CountryFeature[] | null => {
    if (!hovered || !brushScope || brushScope === 'single' || !hovered.properties || !groupFeaturesIndex) {
      return null;
    }
    const rawKeys = Object.keys(hovered.properties);
    const matchedKey = rawKeys.find(k => k.toLowerCase() === brushScope.toLowerCase()) || brushScope;
    const hoveredVal = hovered.properties[matchedKey];
    if (hoveredVal === undefined || hoveredVal === null) return null;
    return groupFeaturesIndex.get(String(hoveredVal)) || null;
  }, [brushScope, groupFeaturesIndex]);

  const findFeatureAtScreenPos = React.useCallback((
    px: number,
    py: number,
    geoCoordinate: [number, number] | null
  ): CountryFeature | null => {
    if (config.projection === 'orthographic') {
      const globeRadius90 = Math.min(projDimensions.width, projDimensions.height) * 0.45 * config.zoom;
      const globeCenterX = projDimensions.width / 2;
      const globeCenterY = projDimensions.height / 2;
      const rx0 = globeCenterX - globeRadius90;
      const ry0 = globeCenterY - globeRadius90;
      const rx1 = globeCenterX + globeRadius90;
      const ry1 = globeCenterY + globeRadius90;
      if (px < rx0 || px > rx1 || py < ry0 || py > ry1) {
        return null;
      }
    }

    if (config.enlargeCityStates && enlargedFeaturesList.length > 0) {
      for (let i = enlargedFeaturesList.length - 1; i >= 0; i--) {
        const feature = enlargedFeaturesList[i];
        const center = (feature as any)._enlargedCenter || getFeatureCenter(feature);
        if (!center) continue;
        const projCenter = projection(center);
        if (!projCenter || isNaN(projCenter[0]) || isNaN(projCenter[1])) continue;

        if (config.projection === 'orthographic' && !isNoGeoref) {
          const rotate = projection.rotate();
          const dist = d3.geoDistance(center, [-rotate[0], -rotate[1]]);
          if (dist > Math.PI / 2 + 0.15) continue;
        }

        const dx = px - projCenter[0];
        const dy = py - projCenter[1];
        // Visual circle radius is _circleRadius * config.zoom plus stroke padding
        const cRadius = (feature as any)._circleRadius !== undefined ? (feature as any)._circleRadius : 0.55;
        const hitRadius = (cRadius * config.zoom) + 0.8;
        if (dx * dx + dy * dy <= hitRadius * hitRadius) {
          return feature;
        }
      }
    }

    // High-performance GPU Color-Picking (0.05ms O(1) query)
    if (webglEngineRef.current && webglEngineRef.current.isReady()) {
      const gpuHit = webglEngineRef.current.pickFeatureAt(px, py);
      if (gpuHit) return gpuHit;
    }

    if (geoCoordinate && !isNaN(geoCoordinate[0]) && !isNaN(geoCoordinate[1])) {
      const [lon, lat] = geoCoordinate;
      const candidates = spatialIndex.getCandidates(lon, lat);
      for (let i = 0; i < candidates.length; i++) {
        const feature = candidates[i];
        const [minLon, minLat, maxLon, maxLat] = getFeatureBBox(feature);
        if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) {
          continue;
        }
        try {
          if (isNoGeoref) {
            if (isPointInFeature2D(geoCoordinate, feature)) {
              return feature;
            }
          } else {
            if (isPointInFeature2D(geoCoordinate, feature)) {
              return feature;
            }
            if (d3.geoContains(feature, geoCoordinate)) {
              return feature;
            }
          }
        } catch {
          // Continue search
        }
      }
    }

    return null;
  }, [config.enlargeCityStates, config.projection, enlargedFeaturesList, isNoGeoref, projection, spatialIndex]);

  // Handle Drag/Rotation mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    // Suppress synthetic mouse events generated by touch taps on mobile
    if (Date.now() - lastTouchTimeRef.current < 650) {
      return;
    }

    if (e.button === 2) {
      if (e.altKey) {
        // Alt + Right Click is reserved for debug placement override menu
        return;
      }
      isRightDragging.current = true;
      rightDragMoved.current = false;
      rightClickStartPos.current = { x: e.clientX, y: e.clientY };
      lastRightSwipedCountryIdRef.current = null;

      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const px = (x - interactiveViewportRef.current.pan.x) / interactiveViewportRef.current.zoom;
        const py = (y - interactiveViewportRef.current.pan.y) / interactiveViewportRef.current.zoom;
        const geoCoordinate = typeof projection.invert === 'function' ? projection.invert([px, py]) : null;

        const hit = findFeatureAtScreenPos(px, py, geoCoordinate);
        if (hit) {
          const countryId = getCountryId(hit);
          lastRightSwipedCountryIdRef.current = countryId;
          onRightClickCountry?.(hit, e.shiftKey);
          lastRightClickHandledTimeRef.current = Date.now();
        }
      }
      return;
    }

    if (e.button !== 0) {
      // Ignore non-left click for panning/dragging
      return;
    }
    if (activeTool === 'paint' || activeTool === 'eraser') {
      onStartPaintStroke?.();
    }
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    dragStartPan.current = { ...interactiveViewportRef.current.pan };
    dragStartCenter.current = { lon: localRotationRef.current.lon, lat: localRotationRef.current.lat };

    // Reset last swiped ID on mouse down
    lastSwipedCountryIdRef.current = null;

    if (config.swipeSelection) {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const px = (x - interactiveViewportRef.current.pan.x) / interactiveViewportRef.current.zoom;
        const py = (y - interactiveViewportRef.current.pan.y) / interactiveViewportRef.current.zoom;
        const geoCoordinate = typeof projection.invert === 'function' ? projection.invert([px, py]) : null;

        const hit = findFeatureAtScreenPos(px, py, geoCoordinate);

        if (hit) {
          const countryId = getCountryId(hit);
          lastSwipedCountryIdRef.current = countryId;
          if (activeTool === 'paint') {
            triggerPaintCountry(countryId, paintColor, hit);
          } else if (activeTool === 'eraser') {
            triggerPaintCountry(countryId, null, hit);
          } else {
            selectedCountryRef.current = hit;
            onSelectCountry(hit);
          }
        }
      }
    }
    
    isDraggingGlobe.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Suppress synthetic mouse events generated by touch taps on mobile
    if (Date.now() - lastTouchTimeRef.current < 650) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Skip hover calculations while zooming/pinching
    if (isWheelingRef.current || isPinchingRef.current || isSliderPanningRef.current) {
      return;
    }

    const now = Date.now();
    lastMouseMoveTimeRef.current = now;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isRightDragging.current) {
      const dx = Math.abs(e.clientX - rightClickStartPos.current.x);
      const dy = Math.abs(e.clientY - rightClickStartPos.current.y);
      if (dx > 4 || dy > 4) {
        rightDragMoved.current = true;
      }
      const px = (x - interactiveViewportRef.current.pan.x) / interactiveViewportRef.current.zoom;
      const py = (y - interactiveViewportRef.current.pan.y) / interactiveViewportRef.current.zoom;
      const geoCoordinate = typeof projection.invert === 'function' ? projection.invert([px, py]) : null;

      const hit = findFeatureAtScreenPos(px, py, geoCoordinate);
      if (hit) {
        const countryId = getCountryId(hit);
        if (lastRightSwipedCountryIdRef.current !== countryId) {
          lastRightSwipedCountryIdRef.current = countryId;
          // Holding right-click and dragging across polygons adds them to selection
          onRightClickCountry?.(hit, true);
        }
      }
      return;
    }

    if (isDragging.current) {
      if (config.swipeSelection) {
        const px = (x - interactiveViewportRef.current.pan.x) / interactiveViewportRef.current.zoom;
        const py = (y - interactiveViewportRef.current.pan.y) / interactiveViewportRef.current.zoom;
        const geoCoordinate = typeof projection.invert === 'function' ? projection.invert([px, py]) : null;

        const hit = findFeatureAtScreenPos(px, py, geoCoordinate);

        if (hit) {
          const countryId = getCountryId(hit);
          if (lastSwipedCountryIdRef.current !== countryId) {
            lastSwipedCountryIdRef.current = countryId;
            if (activeTool === 'paint') {
              triggerPaintCountry(countryId, paintColor, hit);
            } else if (activeTool === 'eraser') {
              triggerPaintCountry(countryId, null, hit);
            } else {
              selectedCountryRef.current = hit;
              onSelectCountry(hit);
            }
          }
        }
        return;
      }

      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;

      // 2D viewport pan
      interactiveViewportRef.current.pan = {
        x: dragStartPan.current.x + dx,
        y: dragStartPan.current.y + dy,
      };
      return;
    }

    // Hover tooltip/highlight logic
    const px = (x - interactiveViewportRef.current.pan.x) / interactiveViewportRef.current.zoom;
    const py = (y - interactiveViewportRef.current.pan.y) / interactiveViewportRef.current.zoom;

    const geoCoordinate = typeof projection.invert === 'function' ? projection.invert([px, py]) : null;

    const hit = findFeatureAtScreenPos(px, py, geoCoordinate);

    if (hit) {
        hoveredCountryRef.current = hit;
        const code = (hit.properties.adm0_a3 || '').toLowerCase();
        const meta = countryMetadataMap?.[code];
        
        let pop = hit.properties.pop_est;
        let gdp = hit.properties.gdp_md_est;
        if (pop === undefined && meta?.pop_est !== undefined) {
          pop = meta.pop_est;
        }
        if (gdp === undefined && meta?.gdp_md_est !== undefined) {
          gdp = meta.gdp_md_est;
        }

        let nameLine = hit.properties.ECO_NAME || hit.properties.name || hit.properties.NAME || '';
        let subtitleLine = '';
        let areaVal: number | undefined;

        const rawArea = hit.properties.area_km2 ?? hit.properties.area ?? hit.properties.AREA ?? hit.properties.shape_area ?? hit.properties.Shape_Area;
        if (rawArea !== undefined && rawArea !== null && !isNaN(Number(rawArea)) && Number(rawArea) > 0) {
          areaVal = Number(rawArea);
        }

        if (brushScope && brushScope !== 'single') {
          const rawKeys = Object.keys(hit.properties);
          const matchedKey = rawKeys.find(k => k.toLowerCase() === brushScope.toLowerCase()) || brushScope;
          const hoveredVal = hit.properties[matchedKey];
          
          if (hoveredVal !== undefined && hoveredVal !== null) {
            // Find the label for this brush scope
            const activeGroupOption = selectedMapFile ? MAP_BRUSH_GROUPS[selectedMapFile]?.find(g => g.key.toLowerCase() === brushScope.toLowerCase()) : undefined;
            const groupLabel = activeGroupOption?.label || brushScope.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            
            if (matchedKey.toUpperCase() === 'BIOME' && WWF_BIOME_NAMES[hoveredVal]) {
              nameLine = `Biome ${hoveredVal}: ${WWF_BIOME_NAMES[hoveredVal]}`;
            } else if (matchedKey.toUpperCase() === 'REALM' && WWF_REALM_NAMES[hoveredVal]) {
              nameLine = `Realm: ${WWF_REALM_NAMES[hoveredVal]}`;
            } else {
              nameLine = String(hoveredVal);
            }
            
            // Rapid O(1) lookup of precomputed group aggregate data
            const targetValStr = String(hoveredVal);
            const cachedStats = groupStatsIndex?.get(targetValStr);
            
            const groupCount = cachedStats?.count || 1;
            subtitleLine = `${groupLabel} • ${groupCount} region${groupCount !== 1 ? 's' : ''}`;
            pop = cachedStats?.popSum || 0;
            gdp = cachedStats?.gdpSum || 0;
            if (cachedStats?.areaSum && cachedStats.areaSum > 0) {
              areaVal = cachedStats.areaSum;
            }
          }
        } else {
          // Individual mode
          if (hit.properties.ECO_NAME) {
            nameLine = hit.properties.ECO_NAME;
            const rStr = WWF_REALM_NAMES[hit.properties.REALM] || hit.properties.REALM || '';
            const bStr = WWF_BIOME_NAMES[hit.properties.BIOME] || hit.properties.BIOME || '';
            if (rStr || bStr) {
              subtitleLine = [rStr && `Realm: ${rStr}`, bStr && `Biome: ${bStr}`].filter(Boolean).join(' • ');
            }
          } else if (hit.properties.adm1_code) {
            const provinceType = hit.properties.type_en;
            if (provinceType && provinceType.toLowerCase() !== 'region') {
              nameLine = `${hit.properties.name} (${provinceType})`;
            } else {
              nameLine = hit.properties.name || '';
            }
          }
        }

        const hasPop = pop !== undefined && pop !== null && pop !== 0;
        const hasGdp = gdp !== undefined && gdp !== null && gdp !== 0;

        if (tooltipRef.current) {
          const lines = [nameLine];
          if (subtitleLine) lines.push(subtitleLine.trim());
          
          const popFormatted = hasPop && pop ? (pop / 1000000).toFixed(2) + ' M' : null;
          const gdpFormatted = hasGdp && gdp ? '$' + (gdp / 1000).toFixed(1) + ' B' : null;
          const areaFormatted = areaVal && areaVal > 0 ? `${Math.round(areaVal).toLocaleString()} km²` : null;

          const statsParts: string[] = [];
          if (popFormatted) statsParts.push(`Pop: ${popFormatted}`);
          if (gdpFormatted) statsParts.push(`GDP: ${gdpFormatted}`);
          if (areaFormatted) statsParts.push(`Area: ${areaFormatted}`);

          if (statsParts.length > 0) {
            lines.push(statsParts.join(' | '));
          }
          
          tooltipRef.current.innerHTML = lines.map((line, idx) => {
            const className = idx === 0 
              ? "font-serif italic font-bold text-xs border-b border-[#121212]/20 dark:border-[#FDFCF8]/20 pb-1 mb-1" 
              : "opacity-80";
            return `<div class="${className}">${line}</div>`;
          }).join('');
          tooltipRef.current.style.left = `${e.clientX - rect.left + 10}px`;
          tooltipRef.current.style.top = `${e.clientY - rect.top + 10}px`;
          tooltipRef.current.classList.remove('hidden');
        }
      } else {
        hoveredCountryRef.current = null;
        if (tooltipRef.current) {
          tooltipRef.current.classList.add('hidden');
        }
      }
  };

  const handleMouseUpOrLeave = (e: React.MouseEvent) => {
    // Suppress synthetic mouse events generated by touch taps on mobile
    if (Date.now() - lastTouchTimeRef.current < 650) {
      isDragging.current = false;
      isDraggingGlobe.current = false;
      isRightDragging.current = false;
      return;
    }

    if (tooltipRef.current) {
      tooltipRef.current.classList.add('hidden');
    }
    let wasDrag = false;
    if (isDragging.current) {
      const dx = Math.abs(e.clientX - dragStart.current.x);
      const dy = Math.abs(e.clientY - dragStart.current.y);
      if (dx > 4 || dy > 4) {
        wasDrag = true;
      }
    }

    const isSwiping = !!config.swipeSelection;
    if (isDragging.current && wasDrag && !isSwiping) {
      setViewport({
        zoom: interactiveViewportRef.current.zoom,
        pan: { ...interactiveViewportRef.current.pan },
      });
      if (baseRedrawTimeoutRef.current) {
        clearTimeout(baseRedrawTimeoutRef.current);
      }
      baseRedrawTimeoutRef.current = setTimeout(() => {
        needsBaseRedrawRef.current = true;
        baseRedrawTimeoutRef.current = null;
      }, 50);
    }

    if (e.button === 2 || !e.buttons || (e.buttons & 2) === 0) {
      isRightDragging.current = false;
      lastRightSwipedCountryIdRef.current = null;
    }

    isDragging.current = false;
    isDraggingGlobe.current = false;

    if (!wasDrag && e.type === 'mouseup' && canvasRef.current) {
      const isRightClick = e.button === 2;
      const isLeftClick = e.button === 0;

      if (isLeftClick || isRightClick) {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const px = (x - interactiveViewportRef.current.pan.x) / interactiveViewportRef.current.zoom;
        const py = (y - interactiveViewportRef.current.pan.y) / interactiveViewportRef.current.zoom;

        const geoCoordinate = typeof projection.invert === 'function' ? projection.invert([px, py]) : null;

        const hit = findFeatureAtScreenPos(px, py, geoCoordinate);

        if (hit) {
          if (!isRightClick) {
            const countryId = getCountryId(hit);
            if (activeTool === 'paint') {
              triggerPaintCountry(countryId, paintColor, hit);
            } else if (activeTool === 'eraser') {
              triggerPaintCountry(countryId, null, hit);
            } else if (activeTool === 'picker') {
              const currentColor = customColors[countryId] || '#ffffff';
              setPaintColor(currentColor);
              setActiveTool('paint');
            } else {
              selectedCountryRef.current = hit;
              onSelectCountry(hit);
            }
          } else {
            // Fallback right-click handler if not already processed on mousedown
            if (Date.now() - lastRightClickHandledTimeRef.current > 300) {
              onRightClickCountry?.(hit, e.shiftKey);
              lastRightClickHandledTimeRef.current = Date.now();
            }
          }
        } else {
          if (isLeftClick) {
            selectedCountryRef.current = null;
            onSelectCountry(null);
          }
        }
      }
    }

    onEndPaintStroke?.();
  };

  // Touch Support for Mobile Gesture Interaction
  const handleTouchStart = (e: React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    lastTouchTimeRef.current = Date.now();
    isLongPressTriggeredRef.current = false;
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (e.touches.length === 1) {
      if (activeTool === 'paint' || activeTool === 'eraser') {
        onStartPaintStroke?.();
      }
      isDragging.current = true;
      const touch = e.touches[0];
      dragStart.current = { x: touch.clientX, y: touch.clientY };
      dragStartPan.current = { ...interactiveViewportRef.current.pan };
      dragStartCenter.current = { lon: localRotationRef.current.lon, lat: localRotationRef.current.lat };

      // Reset last swiped ID on touch down
      lastSwipedCountryIdRef.current = null;

      // Start long-press timer (500ms) for mobile secondary click / border selection
      const startTouchX = touch.clientX;
      const startTouchY = touch.clientY;
      longPressTimerRef.current = setTimeout(() => {
        isLongPressTriggeredRef.current = true;
        if (canvasRef.current) {
          const rect = canvasRef.current.getBoundingClientRect();
          const x = startTouchX - rect.left;
          const y = startTouchY - rect.top;
          const px = (x - interactiveViewportRef.current.pan.x) / interactiveViewportRef.current.zoom;
          const py = (y - interactiveViewportRef.current.pan.y) / interactiveViewportRef.current.zoom;
          const geoCoordinate = typeof projection.invert === 'function' ? projection.invert([px, py]) : null;
          const hit = findFeatureAtScreenPos(px, py, geoCoordinate);
          if (hit) {
            try {
              if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate(40);
              }
            } catch (_) {}
            onRightClickCountry?.(hit, false);
          }
        }
      }, 500);

      if (config.swipeSelection && (activeTool === 'paint' || activeTool === 'eraser')) {
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        const px = (x - interactiveViewportRef.current.pan.x) / interactiveViewportRef.current.zoom;
        const py = (y - interactiveViewportRef.current.pan.y) / interactiveViewportRef.current.zoom;
        const geoCoordinate = typeof projection.invert === 'function' ? projection.invert([px, py]) : null;

        const hit = findFeatureAtScreenPos(px, py, geoCoordinate);

        if (hit) {
          const countryId = getCountryId(hit);
          lastSwipedCountryIdRef.current = countryId;
          if (activeTool === 'paint') {
            triggerPaintCountry(countryId, paintColor, hit);
          } else if (activeTool === 'eraser') {
            triggerPaintCountry(countryId, null, hit);
          }
        }
      }
      
      const isPainting = config.swipeSelection && (activeTool === 'paint' || activeTool === 'eraser');
      if (config.projection === 'orthographic' && !isPainting && !isNoGeoref) {
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        const defaultScale = Math.min(dimensions.width, dimensions.height) * 0.45;
        const rScreen = defaultScale * config.zoom * interactiveViewportRef.current.zoom;
        const cxScreen = interactiveViewportRef.current.pan.x + (dimensions.width / 2) * interactiveViewportRef.current.zoom;
        const cyScreen = interactiveViewportRef.current.pan.y + (dimensions.height / 2) * interactiveViewportRef.current.zoom;

        const dist = Math.hypot(x - cxScreen, y - cyScreen);
        isDraggingGlobe.current = dist <= rScreen;
      } else if (config.projection as any === 'airocean') {
        isDraggingGlobe.current = true;
      } else {
        isDraggingGlobe.current = false;
      }
    } else if (e.touches.length === 2) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      // Pinch to zoom initialization
      isDragging.current = false;
      isDraggingGlobe.current = false;
      isPinchingRef.current = true;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      touchStartDist.current = dist > 0 ? dist : 1;
      pinchStartZoom.current = interactiveViewportRef.current.zoom;
      pinchStartPan.current = { ...interactiveViewportRef.current.pan };
      const rect = canvas.getBoundingClientRect();
      pinchStartCenter.current = {
        x: (t1.clientX + t2.clientX) / 2 - rect.left,
        y: (t1.clientY + t2.clientY) / 2 - rect.top,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    lastTouchTimeRef.current = Date.now();

    if (e.touches.length === 1 && isDragging.current) {
      const touch = e.touches[0];
      const distFromStart = Math.hypot(touch.clientX - dragStart.current.x, touch.clientY - dragStart.current.y);
      if (distFromStart > 12 && longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      if (config.swipeSelection && (activeTool === 'paint' || activeTool === 'eraser')) {
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        const px = (x - interactiveViewportRef.current.pan.x) / interactiveViewportRef.current.zoom;
        const py = (y - interactiveViewportRef.current.pan.y) / interactiveViewportRef.current.zoom;
        const geoCoordinate = typeof projection.invert === 'function' ? projection.invert([px, py]) : null;

        const hit = findFeatureAtScreenPos(px, py, geoCoordinate);

        if (hit) {
          const countryId = getCountryId(hit);
          if (lastSwipedCountryIdRef.current !== countryId) {
            lastSwipedCountryIdRef.current = countryId;
            if (activeTool === 'paint') {
              triggerPaintCountry(countryId, paintColor, hit);
            } else if (activeTool === 'eraser') {
              triggerPaintCountry(countryId, null, hit);
            }
          }
        }
        return;
      }

      const dx = touch.clientX - dragStart.current.x;
      const dy = touch.clientY - dragStart.current.y;

      if (isDraggingGlobe.current) {
        const sensitivity = 0.25 / (config.zoom * interactiveViewportRef.current.zoom);
        let nextLon = dragStartCenter.current.lon - dx * sensitivity;
        let nextLat = dragStartCenter.current.lat + dy * sensitivity;

        if (nextLon > 180) nextLon -= 360;
        if (nextLon < -180) nextLon += 360;
        nextLat = Math.max(-85, Math.min(85, nextLat));

        localRotationRef.current = {
          lon: parseFloat(nextLon.toFixed(4)),
          lat: parseFloat(nextLat.toFixed(4)),
        };
        needsBaseRedrawRef.current = true;
      } else {
        interactiveViewportRef.current.pan = {
          x: dragStartPan.current.x + dx,
          y: dragStartPan.current.y + dy,
        };
      }
    } else if (e.touches.length === 2) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      // Apply real-time pinch zoom & pan
      isPinchingRef.current = true;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      
      const ratio = dist / touchStartDist.current;
      const targetZoom = Math.min(500, Math.max(0.05, pinchStartZoom.current * ratio));
      const scaleFactor = targetZoom / pinchStartZoom.current;

      const rect = canvas.getBoundingClientRect();
      const currCenterX = (t1.clientX + t2.clientX) / 2 - rect.left;
      const currCenterY = (t1.clientY + t2.clientY) / 2 - rect.top;

      const nextX = currCenterX - (pinchStartCenter.current.x - pinchStartPan.current.x) * scaleFactor;
      const nextY = currCenterY - (pinchStartCenter.current.y - pinchStartPan.current.y) * scaleFactor;

      interactiveViewportRef.current = {
        zoom: targetZoom,
        pan: { x: nextX, y: nextY }
      };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    lastTouchTimeRef.current = Date.now();

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    if (isLongPressTriggeredRef.current) {
      isLongPressTriggeredRef.current = false;
      isDragging.current = false;
      isDraggingGlobe.current = false;
      isPinchingRef.current = false;
      onEndPaintStroke?.();
      return;
    }

    // Check if one finger is still down after a pinch gesture
    if (e.touches.length === 1) {
      const remainingTouch = e.touches[0];
      isDragging.current = true;
      isPinchingRef.current = false;
      dragStart.current = { x: remainingTouch.clientX, y: remainingTouch.clientY };
      dragStartPan.current = { ...interactiveViewportRef.current.pan };
      return;
    }

    const TAP_THRESHOLD = 15; // pixels (standard mobile touch slop)
    let isTap = false;
    let touchEndCoord: { clientX: number; clientY: number } | null = null;

    if (isDragging.current && e.changedTouches.length === 1) {
      const touch = e.changedTouches[0];
      touchEndCoord = { clientX: touch.clientX, clientY: touch.clientY };
      const dist = Math.hypot(touch.clientX - dragStart.current.x, touch.clientY - dragStart.current.y);
      if (dist <= TAP_THRESHOLD) {
        isTap = true;
      }
    }

    if (isTap && touchEndCoord && canvasRef.current) {
      // Revert slight touch micro-shift so the canvas does not drift on tap
      interactiveViewportRef.current.pan = { ...dragStartPan.current };

      const rect = canvasRef.current.getBoundingClientRect();
      const x = touchEndCoord.clientX - rect.left;
      const y = touchEndCoord.clientY - rect.top;

      const px = (x - interactiveViewportRef.current.pan.x) / interactiveViewportRef.current.zoom;
      const py = (y - interactiveViewportRef.current.pan.y) / interactiveViewportRef.current.zoom;

      const geoCoordinate = typeof projection.invert === 'function' ? projection.invert([px, py]) : null;

      const hit = findFeatureAtScreenPos(px, py, geoCoordinate);

      if (hit) {
        const countryId = getCountryId(hit);
        if (activeTool === 'paint') {
          triggerPaintCountry(countryId, paintColor, hit);
        } else if (activeTool === 'eraser') {
          triggerPaintCountry(countryId, null, hit);
        } else if (activeTool === 'picker') {
          const currentColor = customColors[countryId] || '#ffffff';
          setPaintColor(currentColor);
          setActiveTool('paint');
        } else {
          selectedCountryRef.current = hit;
          onSelectCountry(hit);
        }
      } else {
        selectedCountryRef.current = null;
        onSelectCountry(null);
      }
    } else if (isDragging.current || isPinchingRef.current) {
      if (isDraggingGlobe.current) {
        onUpdateConfig((prev) => ({
          ...prev,
          centerLon: localRotationRef.current.lon,
          centerLat: localRotationRef.current.lat,
        }));
      } else {
        setViewport({
          zoom: interactiveViewportRef.current.zoom,
          pan: { ...interactiveViewportRef.current.pan }
        });
      }

      if (baseRedrawTimeoutRef.current) {
        clearTimeout(baseRedrawTimeoutRef.current);
      }
      baseRedrawTimeoutRef.current = setTimeout(() => {
        needsBaseRedrawRef.current = true;
        baseRedrawTimeoutRef.current = null;
      }, 50);
    }

    isDragging.current = false;
    isDraggingGlobe.current = false;
    isPinchingRef.current = false;
    onEndPaintStroke?.();
  };

  // Set up native non-passive wheel zoom listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      isWheelingRef.current = true;
      if (wheelTimeoutRef.current) {
        clearTimeout(wheelTimeoutRef.current);
      }
      wheelTimeoutRef.current = setTimeout(() => {
        wheelTimeoutRef.current = null;
        isWheelingRef.current = false;
        needsBaseRedrawRef.current = true;
        // Commit viewport to React state so other components synchronize!
        setViewport({
          zoom: interactiveViewportRef.current.zoom,
          pan: { ...interactiveViewportRef.current.pan }
        });
      }, 120);

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const normDelta = e.deltaMode === 1 ? e.deltaY * 18 : (e.deltaMode === 2 ? e.deltaY * 300 : e.deltaY);
      const zoomFactor = Math.exp(-normDelta * 0.0015);

      const targetZoom = Math.min(500, Math.max(0.05, interactiveViewportRef.current.zoom * zoomFactor));
      const nextX = mouseX - (mouseX - interactiveViewportRef.current.pan.x) * (targetZoom / interactiveViewportRef.current.zoom);
      const nextY = mouseY - (mouseY - interactiveViewportRef.current.pan.y) * (targetZoom / interactiveViewportRef.current.zoom);
      
      interactiveViewportRef.current = {
        zoom: targetZoom,
        pan: { x: nextX, y: nextY }
      };
    };

    canvas.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleNativeWheel);
      if (wheelTimeoutRef.current) {
        clearTimeout(wheelTimeoutRef.current);
      }
    };
  }, []);

  const handlePan = (direction: 'N' | 'S' | 'W' | 'E') => {
    const step = 40;
    setViewportPan((prev) => {
      let nextX = prev.x;
      let nextY = prev.y;
      if (direction === 'N') nextY = prev.y + step;
      if (direction === 'S') nextY = prev.y - step;
      if (direction === 'W') nextX = prev.x + step;
      if (direction === 'E') nextX = prev.x - step;
      return { x: nextX, y: nextY };
    });
  };

  const handleReset = () => {
    onUpdateConfig((prev) => ({
      ...prev,
      centerLon: 0,
      centerLat: 0,
      zoom: 1,
    }));
    setViewport({ zoom: 1, pan: { x: 0, y: 0 } });
    selectedCountryRef.current = null;
    onSelectCountry(null);
  };

  // Selected country centroid coordinate overlay tracking
  const selectedCentroidCoords = React.useMemo(() => {
    if (!selectedCountry) return null;
    try {
      const centroid = getCountryCentroid(selectedCountry, centroidCacheRef.current);
      if (centroid && !isNaN(centroid[0]) && !isNaN(centroid[1])) {
        const coords = projection(centroid);
        if (coords) {
          const screenX = coords[0] * viewportZoom + viewportPan.x;
          const screenY = coords[1] * viewportZoom + viewportPan.y;
          if (screenX >= 0 && screenX <= dimensions.width && screenY >= 0 && screenY <= dimensions.height) {
            return { x: screenX, y: screenY };
          }
        }
      }
    } catch (e) {}
    return null;
  }, [selectedCountry, projection, viewportZoom, viewportPan, dimensions]);

  const isDark = config.colorTheme === 'dark';

  const oceanColor = (config.customOceanColor && config.customOceanColor !== 'default')
    ? config.customOceanColor
    : (isDark ? '#111e35' : '#bae6fd');

  const bgColor = (config.customOceanColor && config.customOceanColor !== 'default')
    ? config.customOceanColor
    : ((config.customBgColor && config.customBgColor !== 'default')
      ? config.customBgColor
      : oceanColor);

  let skyboxColor = isDark ? '#09090b' : '#f8fafc';
  if (config.customSkyboxColor && config.customSkyboxColor !== 'default') {
    skyboxColor = config.customSkyboxColor;
  }

  const effectiveBgColor = isOrthographicProj ? skyboxColor : bgColor;

  const getMapBoundingBoxScreen = React.useCallback((useBaseIdentity: boolean = false) => {
    const zoom = useBaseIdentity ? 1.0 : (interactiveViewportRef.current.zoom || 1.0);
    const pan = useBaseIdentity ? { x: 0, y: 0 } : (interactiveViewportRef.current.pan || { x: 0, y: 0 });
    const width = projDimensions.width || 1200;
    const height = projDimensions.height || 800;

    if (!projection) {
      return { minX: 0, minY: 0, maxX: width, maxY: height, cropWidth: width, cropHeight: height };
    }

    const d3Path = d3.geoPath().projection(projection);

    let bMinX = Infinity;
    let bMinY = Infinity;
    let bMaxX = -Infinity;
    let bMaxY = -Infinity;

    if (config.projection === 'orthographic') {
      const globeRadius90 = Math.min(projDimensions.width, projDimensions.height) * 0.45 * config.zoom;
      const globeCenterX = projDimensions.width / 2;
      const globeCenterY = projDimensions.height / 2;
      const rx0 = (globeCenterX - globeRadius90) * zoom + pan.x;
      const ry0 = (globeCenterY - globeRadius90) * zoom + pan.y;
      const rx1 = (globeCenterX + globeRadius90) * zoom + pan.x;
      const ry1 = (globeCenterY + globeRadius90) * zoom + pan.y;
      bMinX = rx0;
      bMinY = ry0;
      bMaxX = rx1;
      bMaxY = ry1;
    } else if (!isNoGeoref) {
      // 1. Primary map boundary: Sphere outline bounds (exact outer contour of projection/globe)
      try {
        const sphereBounds = d3Path.bounds({ type: 'Sphere' });
        if (
          sphereBounds &&
          isFinite(sphereBounds[0][0]) &&
          isFinite(sphereBounds[0][1]) &&
          isFinite(sphereBounds[1][0]) &&
          isFinite(sphereBounds[1][1])
        ) {
          const sx0 = sphereBounds[0][0] * zoom + pan.x;
          const sy0 = sphereBounds[0][1] * zoom + pan.y;
          const sx1 = sphereBounds[1][0] * zoom + pan.x;
          const sy1 = sphereBounds[1][1] * zoom + pan.y;

          if (sx1 > sx0 && sy1 > sy0) {
            bMinX = sx0;
            bMinY = sy0;
            bMaxX = sx1;
            bMaxY = sy1;
          }
        }
      } catch (e) {}
    } else {
      // For non-georeferenced maps (custom SVG/JSON maps), compute bounds from features
      if (features && features.length > 0) {
        features.forEach((feature) => {
          try {
            const fb = d3Path.bounds(feature);
            if (
              fb &&
              isFinite(fb[0][0]) &&
              isFinite(fb[0][1]) &&
              isFinite(fb[1][0]) &&
              isFinite(fb[1][1])
            ) {
              const fx0 = fb[0][0] * zoom + pan.x;
              const fy0 = fb[0][1] * zoom + pan.y;
              const fx1 = fb[1][0] * zoom + pan.x;
              const fy1 = fb[1][1] * zoom + pan.y;

              bMinX = Math.min(bMinX, fx0);
              bMinY = Math.min(bMinY, fy0);
              bMaxX = Math.max(bMaxX, fx1);
              bMaxY = Math.max(bMaxY, fy1);
            }
          } catch (e) {}
        });
      }
    }

    // 2. Check imported location markers if present
    if ((showLocations || showLocationLabels) && importedLocations && importedLocations.length > 0) {
      importedLocations.forEach((loc) => {
        try {
          const pt = projection([loc.longitude, loc.latitude]);
          if (pt && isFinite(pt[0]) && isFinite(pt[1])) {
            const lx = pt[0] * zoom + pan.x;
            const ly = pt[1] * zoom + pan.y;
            bMinX = Math.min(bMinX, lx - 12);
            bMinY = Math.min(bMinY, ly - 12);
            bMaxX = Math.max(bMaxX, lx + 12);
            bMaxY = Math.max(bMaxY, ly + 12);
          }
        } catch (e) {}
      });
    }

    // 3. Border stroke margin padding (half of stroke width)
    const mapBorderWidth = config.mapBorderWidth !== undefined ? config.mapBorderWidth : 0.2;
    const strokeHalf = Math.max(0.1, mapBorderWidth / 2);

    bMinX -= strokeHalf;
    bMinY -= strokeHalf;
    bMaxX += strokeHalf;
    bMaxY += strokeHalf;

    const mapMinY = bMinY;
    const mapMaxY = bMaxY;

    // 4. Include Legend box bounds if legend overlay is visible
    if (config.showMapLegend === true || config.colorLabelMode === 'on-legend') {
      const colorRows: LegendRowItem[] = [];

      if (customColors) {
        const activeColorsSet = new Set<string>();
        const originalColorMap = new Map<string, string>();
        Object.values(customColors).forEach((c) => {
          if (c && !c.startsWith('flag:')) {
            const norm = c.toLowerCase();
            activeColorsSet.add(norm);
            if (!originalColorMap.has(norm)) {
              originalColorMap.set(norm, c);
            }
          }
        });

        const normLegendLabels: Record<string, string> = {};
        if (legendLabels) {
          Object.entries(legendLabels).forEach(([col, txt]) => {
            if (col && txt) {
              normLegendLabels[col.toLowerCase()] = txt.trim();
            }
          });
        }

        activeColorsSet.forEach((normColor) => {
          const actualColor = originalColorMap.get(normColor) || normColor;
          const labelText = normLegendLabels[normColor] || normLegendLabels[actualColor] || actualColor.toUpperCase();
          colorRows.push({ kind: 'color', color: actualColor, text: labelText });
        });
      }

      let locationRows: LegendRowItem[] = [];
      if (showLocations && importedLocations && importedLocations.length > 0 && config.showLocationGroupsInLegend !== false) {
        locationRows = buildLocationLegendRows(importedLocations, admin0Size, admin1Size);
      }

      if (colorRows.length > 0 || locationRows.length > 0) {
        let mapOuterMinX = 12;
        let mapOuterMaxX = width - 12;

        if (config.projection === 'orthographic') {
          const globeRadius90 = Math.min(projDimensions.width, projDimensions.height) * 0.45 * config.zoom;
          const globeCenterX = projDimensions.width / 2;
          mapOuterMinX = (globeCenterX - globeRadius90) * zoom + pan.x;
          mapOuterMaxX = (globeCenterX + globeRadius90) * zoom + pan.x;
        } else if (!isNoGeoref) {
          try {
            const sb = d3Path.bounds({ type: 'Sphere' });
            if (sb && isFinite(sb[0][0]) && isFinite(sb[1][0]) && sb[1][0] > sb[0][0]) {
              mapOuterMinX = sb[0][0] * zoom + pan.x;
              mapOuterMaxX = sb[1][0] * zoom + pan.x;
            }
          } catch (e) {}
        } else if (features && features.length > 0) {
          let minF = Infinity;
          let maxF = -Infinity;
          features.forEach((f) => {
            try {
              const fb = d3Path.bounds(f);
              if (fb && isFinite(fb[0][0]) && isFinite(fb[1][0])) {
                minF = Math.min(minF, fb[0][0] * zoom + pan.x);
                maxF = Math.max(maxF, fb[1][0] * zoom + pan.x);
              }
            } catch (e) {}
          });
          if (isFinite(minF) && isFinite(maxF) && maxF > minF) {
            mapOuterMinX = minF;
            mapOuterMaxX = maxF;
          }
        }

        mapOuterMinX = Math.max(0, mapOuterMinX);
        mapOuterMaxX = Math.min(width, mapOuterMaxX);

        const cardX = mapOuterMinX;
        const cardWidth = Math.max(160, mapOuterMaxX - mapOuterMinX);

        const headerHeight = 24;
        const rowHeight = 20;
        const itemPaddingX = 16;

        let currRowX = cardX + 12;
        let currRelY = headerHeight + 6;

        if (colorRows.length > 0) {
          colorRows.forEach((row) => {
            const textWidth = row.text.length * 6.5;
            const itemWidth = 16 + 6 + textWidth + itemPaddingX;

            if (currRowX > cardX + 12 && currRowX + itemWidth > cardX + cardWidth - 12) {
              currRowX = cardX + 12;
              currRelY += rowHeight;
            }
            currRowX += itemWidth;
          });
        }

        if (colorRows.length > 0 && locationRows.length > 0) {
          const sectionDividerRelY = currRelY + rowHeight + 4;
          currRelY = sectionDividerRelY + 8;
          currRowX = cardX + 12;
        } else if (colorRows.length === 0 && locationRows.length > 0) {
          currRelY = headerHeight + 6;
          currRowX = cardX + 12;
        }

        if (locationRows.length > 0) {
          locationRows.forEach((row) => {
            const textWidth = row.text.length * 6.5;
            const itemWidth = 16 + 6 + textWidth + itemPaddingX;

            if (currRowX > cardX + 12 && currRowX + itemWidth > cardX + cardWidth - 12) {
              currRowX = cardX + 12;
              currRelY += rowHeight;
            }
            currRowX += itemWidth;
          });
        }

        const cardHeight = currRelY + rowHeight + 6;
        const pos = config.legendPosition || 'below';
        const isAbove = pos === 'above' || pos === 'top-left' || pos === 'top-right';

        let cardY = 12;
        if (isAbove) {
          cardY = (mapMinY !== undefined ? mapMinY : bMinY) - cardHeight;
        } else {
          cardY = mapMaxY !== undefined ? mapMaxY : bMaxY;
        }

        const effLegendStroke = (config.legendBorderWidth !== undefined && config.legendBorderWidth !== null)
          ? config.legendBorderWidth
          : (config.mapBorderWidth !== undefined ? config.mapBorderWidth : 0.2);
        const legStrokeHalf = effLegendStroke / 2;

        bMinX = Math.min(bMinX, cardX - legStrokeHalf);
        bMinY = Math.min(bMinY, cardY - legStrokeHalf);
        bMaxX = Math.max(bMaxX, cardX + cardWidth + legStrokeHalf);
        bMaxY = Math.max(bMaxY, cardY + cardHeight + legStrokeHalf);
      }
    }

    // Fallback if bounds are invalid
    if (!isFinite(bMinX) || !isFinite(bMinY) || !isFinite(bMaxX) || !isFinite(bMaxY) || bMaxX <= bMinX || bMaxY <= bMinY) {
      return { minX: 0, minY: 0, maxX: width, maxY: height, cropWidth: width, cropHeight: height, mapMinY: 0, mapMaxY: height };
    }

    // Clamp to canvas boundaries
    const minX = Math.floor(Math.max(0, bMinX));
    const minY = Math.floor(Math.max(0, bMinY));
    const maxX = Math.ceil(Math.min(width, bMaxX));
    const maxY = Math.ceil(Math.min(height, bMaxY));

    const cropWidth = Math.max(1, maxX - minX);
    const cropHeight = Math.max(1, maxY - minY);

    return { minX, minY, maxX, maxY, cropWidth, cropHeight, mapMinY, mapMaxY };
  }, [dimensions, projection, features, config.mapBorderWidth, config.showMapLegend, config.colorLabelMode, config.legendTitle, config.legendPosition, config.legendBorderWidth, config.legendBorderColor, config.labelFontFamily, customColors, legendLabels, isNoGeoref, showLocations, showLocationLabels, importedLocations]);

  const handleExportPNG = React.useCallback((scaleMultiplier?: number | React.MouseEvent | any) => {
    const mult = typeof scaleMultiplier === 'number' && !isNaN(scaleMultiplier) ? Math.max(0.1, Math.min(20, scaleMultiplier)) : 4;
    const baseDpr = window.devicePixelRatio || 1;

    const width = projDimensions.width > 0 ? projDimensions.width : 1200;
    const height = projDimensions.height > 0 ? projDimensions.height : 800;

    let exportDpr = baseDpr * mult;

    const maxCanvasDim = 16384;
    if (width * exportDpr > maxCanvasDim || height * exportDpr > maxCanvasDim) {
      exportDpr = Math.min(maxCanvasDim / width, maxCanvasDim / height);
    }

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = Math.ceil(width * exportDpr);
    exportCanvas.height = Math.ceil(height * exportDpr);
    const exportCtx = exportCanvas.getContext('2d');
    if (!exportCtx) return;

    if (renderMapToContextRef.current) {
      renderMapToContextRef.current(exportCtx, exportDpr, true);
    } else if (canvasRef.current) {
      // Fallback: draw current canvas if render ref is unavailable
      exportCtx.drawImage(canvasRef.current, 0, 0, exportCanvas.width, exportCanvas.height);
    }

    const crop = getMapBoundingBoxScreen(true);

    const cropX = Math.floor(Math.max(0, crop.minX * exportDpr));
    const cropY = Math.floor(Math.max(0, crop.minY * exportDpr));
    const cropMaxX = Math.ceil(Math.min(exportCanvas.width, crop.maxX * exportDpr));
    const cropMaxY = Math.ceil(Math.min(exportCanvas.height, crop.maxY * exportDpr));
    const cropW = Math.max(1, cropMaxX - cropX);
    const cropH = Math.max(1, cropMaxY - cropY);

    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = cropW;
    finalCanvas.height = cropH;
    const finalCtx = finalCanvas.getContext('2d');
    if (!finalCtx) return;

    finalCtx.imageSmoothingEnabled = true;
    finalCtx.imageSmoothingQuality = 'high';
    finalCtx.drawImage(exportCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    const dataUrl = finalCanvas.toDataURL('image/png');
    const link = document.createElement('a');
    const baseName = selectedMapFile ? selectedMapFile.replace(/\.[^/.]+$/, '') : 'map';
    const multSuffix = mult !== 1 ? `_${mult}x` : '';
    link.download = `${baseName}_export${multSuffix}_${Date.now()}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [dimensions, getMapBoundingBoxScreen, selectedMapFile]);

  const _unusedSVGExport = () => {
    return;
  };
  /*
    const crop = getMapBoundingBoxScreen();
    const { minX, minY, cropWidth, cropHeight } = crop;

    const d3Path = d3.geoPath().projection(proj);

    const zoom = interactiveViewportRef.current.zoom || 1.0;
    const pan = interactiveViewportRef.current.pan || { x: 0, y: 0 };

    const isDarkTheme = config.colorTheme === 'dark';
    const oceanColor = (config.customOceanColor && config.customOceanColor !== 'default')
      ? config.customOceanColor
      : (isDarkTheme ? '#111e35' : '#bae6fd');

    const mapBgColor = (config.customOceanColor && config.customOceanColor !== 'default')
      ? config.customOceanColor
      : ((config.customBgColor && config.customBgColor !== 'default')
        ? config.customBgColor
        : oceanColor);

    const sbColor = (config.customSkyboxColor && config.customSkyboxColor !== 'default')
      ? config.customSkyboxColor
      : (isDarkTheme ? '#09090b' : '#f8fafc');

    const isOrtho = config.projection === 'orthographic';
    const effBgColor = isOrtho ? sbColor : mapBgColor;

    const defaultBorderColor = (config.borderColor && config.borderColor !== 'default')
      ? config.borderColor
      : (isDarkTheme ? '#334155' : '#94a3b8');

    const defaultLandColor = isDarkTheme ? '#2C2C28' : '#FDFCF8';

    const defaultGraticuleColor = (config.graticuleColor && config.graticuleColor !== 'default')
      ? config.graticuleColor
      : (isDarkTheme ? '#334155' : '#e2e8f0');

    const effMapBorderColor = (config.mapBorderColor && config.mapBorderColor !== 'default')
      ? config.mapBorderColor
      : (isDarkTheme ? '#FDFCF8' : '#121212');

    const effMapBorderWidth = config.mapBorderWidth !== undefined ? config.mapBorderWidth : 0.2;

    const sphereD = !isNoGeoref ? d3Path({ type: 'Sphere' }) : null;

    let svgContent = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    svgContent += `<svg xmlns="http://www.w3.org/2000/svg" width="${cropWidth}" height="${cropHeight}" viewBox="${minX} ${minY} ${cropWidth} ${cropHeight}">\n`;
    svgContent += `  <defs>\n`;
    svgContent += `    <style type="text/css">\n`;
    svgContent += `      @import url('https://fonts.googleapis.com/css2?family=Almendra:ital,wght@0,400;0,700;1,400&amp;family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..900;1,6..96,400..900&amp;family=Cinzel+Decorative:wght@700&amp;family=Cinzel:wght@400;600;700;900&amp;family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,700&amp;family=IM+Fell+English:ital@0;1&amp;family=Inter:wght@400;500;600;700&amp;family=JetBrains+Mono:wght@400;500;600&amp;family=Marcellus&amp;family=MedievalSharp&amp;family=Outfit:wght@400;600;800;900&amp;family=Pirata+One&amp;family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&amp;family=Roboto:ital,wght@0,400;0,500;0,700;0,900;1,400;1,700&amp;family=Space+Grotesk:wght@400;500;600;700&amp;family=UnifrakturMaguntia&amp;display=swap');\n`;
    svgContent += `    </style>\n`;
    if (sphereD) {
      svgContent += `    <clipPath id="sphere-clip"><path d="${sphereD}" /></clipPath>\n`;
    }
    svgContent += `  </defs>\n`;

    const fontFam = config.labelFontFamily || 'georgia';
    const svgFontAttrs = getSVGFontProperties(fontFam);

    // Background fill rect
    svgContent += `  <rect x="${minX}" y="${minY}" width="${cropWidth}" height="${cropHeight}" fill="${effBgColor}" />\n`;

    // Embed background image if present (drawn in 2D screen space coordinates using bgExportCanvasRef or bgCanvasRef)
    const activeBgCanvas = bgExportCanvasRef.current || bgCanvasRef.current;
    if (activeBgCanvas && config.bgImageFile && config.bgImageFile !== 'none') {
      try {
        const bgDataUrl = activeBgCanvas.toDataURL('image/png');
        if (bgDataUrl && bgDataUrl.length > 100) {
          if (sphereD) {
            svgContent += `  <clipPath id="sphere-screen-clip"><path d="${sphereD}" transform="translate(${pan.x}, ${pan.y}) scale(${zoom})" /></clipPath>\n`;
            svgContent += `  <g clip-path="url(#sphere-screen-clip)">\n`;
            svgContent += `    <image x="0" y="0" width="${width}" height="${height}" href="${bgDataUrl}" preserveAspectRatio="none" opacity="${config.bgImageOpacity ?? 1.0}" />\n`;
            svgContent += `  </g>\n`;
          } else {
            svgContent += `  <image x="0" y="0" width="${width}" height="${height}" href="${bgDataUrl}" preserveAspectRatio="none" opacity="${config.bgImageOpacity ?? 1.0}" />\n`;
          }
        }
      } catch (e) {
        console.warn("Could not embed background image in SVG:", e);
      }
    }

    // Start viewport group with interactive pan and zoom transform
    svgContent += `  <g id="map-viewport" transform="translate(${pan.x}, ${pan.y}) scale(${zoom})">\n`;

    // Sphere ocean fill (for orthographic or curved global projections)
    if (sphereD) {
      svgContent += `    <path d="${sphereD}" fill="${oceanColor}" />\n`;
    }

    // Land / Country Features
    svgContent += `    <g id="land-features">\n`;
    for (const feature of features) {
      if ((feature as any)._enlarged) {
        continue;
      }

      const pathD = d3Path(feature);
      if (!pathD) continue;

      const fId = feature.id || feature.properties?.adm1_code || feature.properties?.iso_3166_2 || feature.properties?.adm0_a3 || feature.properties?.name || '';
      const fillColor = customColors[fId] || defaultLandColor;
      const strokeWidth = config.borderWidth !== undefined ? config.borderWidth : 0.5;

      svgContent += `      <path d="${pathD}" fill="${fillColor}" stroke="${defaultBorderColor}" stroke-width="${strokeWidth}" />\n`;
    }
    svgContent += `    </g>\n`;

    // Graticules (rendered above backgrounds)
    if (config.showGraticule) {
      const interval = config.graticuleInterval || 10;
      const graticuleGeo = d3.geoGraticule().step([interval, interval])();
      const gratD = d3Path(graticuleGeo);
      if (gratD) {
        svgContent += `    <path d="${gratD}" fill="none" stroke="${defaultGraticuleColor}" stroke-width="0.5" opacity="0.6" />\n`;
      }
    }

    // Base Hierarchy Borders
    if (customizedBordersData) {
      svgContent += `    <g id="base-borders">\n`;
      const subWidth = config.borderWidth !== undefined ? config.borderWidth : 0.2;
      const countryWidth = config.countryBorderWidth !== undefined ? config.countryBorderWidth : (config.borderWidth !== undefined ? config.borderWidth : 0.2);
      const contWidth = config.continentBorderWidth !== undefined ? config.continentBorderWidth : 0.2;

      const subColor = (config.borderColor && config.borderColor !== 'default') ? config.borderColor : defaultBorderColor;
      const countryColor = (config.countryBorderColor && config.countryBorderColor !== 'default') ? config.countryBorderColor : subColor;
      const contColor = (config.continentBorderColor && config.continentBorderColor !== 'default') ? config.continentBorderColor : subColor;

      if (subWidth > 0 && customizedBordersData.baseSubnationalGeometry) {
        const pathD = d3Path(customizedBordersData.baseSubnationalGeometry);
        if (pathD) {
          svgContent += `      <path d="${pathD}" fill="none" stroke="${subColor}" stroke-width="${subWidth}" />\n`;
        }
      }

      if (countryWidth > 0 && customizedBordersData.baseCountryGeometry) {
        const pathD = d3Path(customizedBordersData.baseCountryGeometry);
        if (pathD) {
          svgContent += `      <path d="${pathD}" fill="none" stroke="${countryColor}" stroke-width="${countryWidth}" />\n`;
        }
      }

      if (contWidth > 0 && customizedBordersData.baseContinentGeometry) {
        const pathD = d3Path(customizedBordersData.baseContinentGeometry);
        if (pathD) {
          svgContent += `      <path d="${pathD}" fill="none" stroke="${contColor}" stroke-width="${contWidth}" />\n`;
        }
      }
      svgContent += `    </g>\n`;
    }

    // Custom Applied Borders
    if (customizedBordersData?.customBordersList && customizedBordersData.customBordersList.length > 0) {
      svgContent += `    <g id="custom-borders">\n`;
      for (const cb of customizedBordersData.customBordersList) {
        if (cb.geometry) {
          const pathD = d3Path(cb.geometry);
          if (pathD) {
            const dashArray = cb.style === 'dashed' ? ` stroke-dasharray="${cb.dashLength || 6},${cb.gapLength || 4}"` : '';
            svgContent += `      <path d="${pathD}" fill="none" stroke="${cb.color}" stroke-width="${cb.width || 1.0}"${dashArray} />\n`;
          }
        }
      }
      svgContent += `    </g>\n`;
    }

    // Map Outer Bounding Border (Sphere outline / Projection boundary)
    if (effMapBorderWidth > 0) {
      if (sphereD) {
        svgContent += `    <path d="${sphereD}" fill="none" stroke="${effMapBorderColor}" stroke-width="${effMapBorderWidth}" />\n`;
      } else {
        svgContent += `    <rect x="0" y="0" width="${width}" height="${height}" fill="none" stroke="${effMapBorderColor}" stroke-width="${effMapBorderWidth * 2}" />\n`;
      }
    }

    // Enlarged Microstate Circles (drawn after country borders so opaque fill covers underlying border lines)
    if (enlargedFeaturesList.length > 0) {
      svgContent += `    <g id="enlarged-microstates">\n`;
      for (const feature of enlargedFeaturesList) {
        const center = (feature as any)._enlargedCenter || getFeatureCenter(feature);
        if (!center) continue;
        const proj = projection(center);
        if (!proj || isNaN(proj[0]) || isNaN(proj[1])) continue;
        if (config.projection === 'orthographic' && !isNoGeoref) {
          const rotate = projection.rotate();
          const dist = d3.geoDistance(center, [-rotate[0], -rotate[1]]);
          if (dist > Math.PI / 2 + 0.05) continue;
        }
        const fId = getCountryId(feature);
        const defaultLandColor = isDarkTheme ? '#2C2C28' : '#FDFCF8';
        const fillColor = customColors[fId] || defaultLandColor;
        const strokeWidth = config.countryBorderWidth !== undefined ? config.countryBorderWidth : (config.borderWidth !== undefined ? config.borderWidth : 0.2);
        const cRadius = (feature as any)._circleRadius !== undefined ? (feature as any)._circleRadius : 0.55;
        if (strokeWidth > 0) {
          svgContent += `      <circle cx="${proj[0].toFixed(2)}" cy="${proj[1].toFixed(2)}" r="${cRadius.toFixed(3)}" fill="${fillColor}" stroke="${defaultBorderColor}" stroke-width="${strokeWidth}" />\n`;
        } else {
          svgContent += `      <circle cx="${proj[0].toFixed(2)}" cy="${proj[1].toFixed(2)}" r="${cRadius.toFixed(3)}" fill="${fillColor}" />\n`;
        }
      }
      svgContent += `    </g>\n`;
    }

    const haloColor = ((config.labelHaloColor || config.labelBorderColor) && (config.labelHaloColor || config.labelBorderColor) !== 'default')
      ? (config.labelHaloColor || config.labelBorderColor)
      : (isDarkTheme ? '#111e35' : '#fdfcf8');
    const textColor = (config.labelColor && config.labelColor !== 'default')
      ? config.labelColor
      : (isDarkTheme ? '#fdfcf8' : '#111e35');
    const labelBorderRatio = config.labelHaloRatio !== undefined ? config.labelHaloRatio : (config.labelBorderRatio !== undefined ? config.labelBorderRatio : 0.15);

    // Map Locations
    if (showLocations && importedLocations && importedLocations.length > 0) {
      svgContent += `    <g id="map-locations">\n`;
      for (const loc of importedLocations) {
        const pt = proj([loc.longitude, loc.latitude]);
        if (pt && !isNaN(pt[0]) && !isNaN(pt[1])) {
          const x = pt[0];
          const y = pt[1];

          const color = loc.symbolColor || (loc.classType === 'admin0' ? admin0Color : admin1Color);
          const size = loc.symbolSize || (loc.classType === 'admin0' ? admin0Size : (loc.classType === 'admin1' ? admin1Size : 2));
          const r = size * 0.5;
          const locStrokeW = Math.min(0.8, Math.max(0.15, size * 0.1));
          svgContent += `      <circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${r.toFixed(2)}" fill="${color}" stroke="#000000" stroke-width="${locStrokeW.toFixed(2)}" />\n`;
          if (showLocationLabels && loc.name) {
            const safeName = loc.name.replace(/[<>&'"]/g, (c) => {
              switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case "'": return '&apos;';
                case '"': return '&quot;';
                default: return c;
              }
            });
            const fontSize = locationLabelSize || 2;
            const offset = r + Math.max(1, fontSize * 0.33);
            let offsetX = x + offset;
            let offsetY = y;

            const mapBorderWidth = config.mapBorderWidth !== undefined ? config.mapBorderWidth : 1.0;
            const borderMargin = Math.max(2.0, (mapBorderWidth / 2) + 1.5);
            const projTrans = proj.translate();
            const projScale = proj.scale();
            const gcX = projTrans ? projTrans[0] : width / 2;
            const gcY = projTrans ? projTrans[1] : height / 2;

            const textW = loc.name.length * fontSize * 0.55;

            let fits = true;
            if (isOrthographicProj || config.projection === 'gnomonic' || config.projection === 'azimuthalEqualArea') {
              const distRight = Math.hypot((offsetX + textW) - gcX, offsetY - gcY);
              if (distRight > projScale - borderMargin) fits = false;
            }

            if (!fits) {
              const altX = x - offset - textW;
              let altFits = true;
              if (isOrthographicProj || config.projection === 'gnomonic' || config.projection === 'azimuthalEqualArea') {
                const distLeft = Math.hypot(altX - gcX, offsetY - gcY);
                if (distLeft > projScale - borderMargin) altFits = false;
              }
              if (altFits) {
                offsetX = altX;
                fits = true;
              }
            }

            if (fits) {
              const locHaloWidth = fontSize * (locationLabelOutlineRatio !== undefined ? locationLabelOutlineRatio : 0.15);
              svgContent += `      <text x="${offsetX.toFixed(2)}" y="${offsetY.toFixed(2)}" dominant-baseline="central" font-family=${svgFontAttrs.fontFamily} font-size="${fontSize.toFixed(2)}px" font-weight="${svgFontAttrs.fontWeight}" font-style="${svgFontAttrs.fontStyle}" fill="${textColor}" stroke="${haloColor}" stroke-width="${locHaloWidth.toFixed(2)}px" paint-order="stroke fill" stroke-linejoin="round" stroke-linecap="round">${safeName}</text>\n`;
            }
          }
        }
      }
      svgContent += `    </g>\n`;
    }

    // Map Labels (Cluster-based, Rotated, Styled, Halo-Stroked)
    if (config.showLabels) {
      const getFontString = (sizePx: number) => getLabelFontString(fontFam, sizePx);

      const rot = localRotationRef.current || { lon: config.centerLon || 0, lat: config.centerLat || 0 };
      const lon0Rad = (rot.lon * Math.PI) / 180;
      const lat0Rad = (rot.lat * Math.PI) / 180;
      const sin_lat0 = Math.sin(lat0Rad);
      const cos_lat0 = Math.cos(lat0Rad);
      const isOrthographicProj = config.projection === 'orthographic';

      const measureCanvas = document.createElement('canvas');
      const measureCtx = measureCanvas.getContext('2d')!;

      interface ProcessedFeatureInfo {
        feature: CountryFeature;
        countryId: string;
        paintedColor?: string;
        normColor?: string;
        colorLabel?: string | null;
        fullName: string;
        isoCode?: string;
        bbox: [number, number, number, number];
        samples: [number, number][];
        allPoints: [number, number][];
        primaryTarget: PolygonLabelTarget;
      }

      const featureInfos: ProcessedFeatureInfo[] = [];

      features.forEach((feature) => {
        try {
          const countryId = getCountryId(feature);
          const paintedColor = customColors[countryId] || (feature.properties.adm0_a3 && customColors[feature.properties.adm0_a3]) || (feature.properties.admin && customColors[feature.properties.admin]);
          let colorLabel: string | null = null;
          let normColor: string | undefined = undefined;

          if (paintedColor) {
            normColor = paintedColor.toLowerCase();
            const isFlag = normColor.startsWith('flag:');
            const customTxt = legendLabels ? (legendLabels[normColor] || legendLabels[paintedColor]) : null;
            if (customTxt && customTxt.trim().length > 0 && !customTxt.trim().toLowerCase().startsWith('flag:')) {
              colorLabel = customTxt.trim();
            } else if (!isFlag) {
              colorLabel = paintedColor.toUpperCase();
            } else {
              colorLabel = null; // Do NOT label based on flag name
            }
          }

          const fullName = getFeatureName(feature);
          const isoCode = getFeatureIsoCode(feature, selectedMapFile);

          const labelGeom = getCountryLabelGeometry(feature, labelGeomCacheRef.current);
          const targets = labelGeom.targets && labelGeom.targets.length > 0
            ? labelGeom.targets
            : [{ centroid: labelGeom.centroid, angle: labelGeom.angle, ringBBox: labelGeom.ringBBox, ring: labelGeom.largestRing || [], area: 0 }];

          targets.forEach((target, targetIdx) => {
            if (isOrthographicProj) {
              const cPt = target.centroid;
              if (cPt) {
                const cLonRad = (cPt[0] * Math.PI) / 180;
                const cLatRad = (cPt[1] * Math.PI) / 180;
                const cos_c_target = sin_lat0 * Math.sin(cLatRad) + cos_lat0 * Math.cos(cLatRad) * Math.cos(cLonRad - lon0Rad);
                if (cos_c_target < 0) return; // Target center is behind the globe!
              }
            }

            let points: [number, number][] = target.ring || [];
            if (points.length === 0 && labelGeom.largestRing) {
              points = labelGeom.largestRing;
            }

            let bbox: [number, number, number, number] = target.ringBBox || [Infinity, Infinity, -Infinity, -Infinity];
            if (!target.ringBBox && points.length > 0) {
              bbox = [Infinity, Infinity, -Infinity, -Infinity];
              for (let i = 0; i < points.length; i++) {
                const [lon, lat] = points[i];
                if (lon < bbox[0]) bbox[0] = lon;
                if (lat < bbox[1]) bbox[1] = lat;
                if (lon > bbox[2]) bbox[2] = lon;
                if (lat > bbox[3]) bbox[3] = lat;
              }
            } else if (!target.ringBBox) {
              bbox = [target.centroid[0] - 1, target.centroid[1] - 1, target.centroid[0] + 1, target.centroid[1] + 1];
            }

            const maxSamples = 30;
            let samples: [number, number][] = [];
            if (points.length <= maxSamples) {
              samples = points;
            } else {
              const step = Math.floor(points.length / maxSamples);
              for (let i = 0; i < points.length; i += step) {
                samples.push(points[i]);
              }
            }

            const targetCountryId = `${countryId}_t${targetIdx}`;

            featureInfos.push({
              feature,
              countryId: targetCountryId,
              paintedColor,
              normColor,
              colorLabel,
              fullName,
              isoCode,
              bbox,
              samples,
              allPoints: points,
              primaryTarget: target
            });
          });
        } catch (e) {}
      });

      const groups = new Map<string, ProcessedFeatureInfo[]>();
      const isColorLabelActive = config.colorLabelMode === 'on-polygons' || config.colorLabelMode === 'on-map' || config.colorLabelMode === 'both';

      featureInfos.forEach((info) => {
        const nameKey = info.fullName ? info.fullName.trim().toLowerCase() : '';
        let groupKey = nameKey ? `name:${nameKey}` : info.countryId;
        const isFlag = !!(info.normColor && info.normColor.startsWith('flag:'));
        if (isColorLabelActive && info.normColor && !isFlag) {
          if (info.colorLabel && info.colorLabel.trim().length > 0) {
            groupKey = `color:${info.normColor}:${info.colorLabel.trim().toLowerCase()}`;
          } else {
            groupKey = `color:${info.normColor}`;
          }
        }
        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }
        groups.get(groupKey)!.push(info);
      });

      const areAdjacent = (f1: ProcessedFeatureInfo, f2: ProcessedFeatureInfo, thresholdDeg = 0.15): boolean => {
        if (
          f1.bbox[2] + thresholdDeg < f2.bbox[0] ||
          f1.bbox[0] - thresholdDeg > f2.bbox[2] ||
          f1.bbox[3] + thresholdDeg < f2.bbox[1] ||
          f1.bbox[1] - thresholdDeg > f2.bbox[3]
        ) {
          return false;
        }
        const threshSq = thresholdDeg * thresholdDeg;
        for (let i = 0; i < f1.samples.length; i++) {
          const p1 = f1.samples[i];
          for (let j = 0; j < f2.samples.length; j++) {
            const p2 = f2.samples[j];
            let dLon = Math.abs(p1[0] - p2[0]);
            if (dLon > 180) dLon = 360 - dLon;
            const dLat = p1[1] - p2[1];
            if (dLon * dLon + dLat * dLat <= threshSq) return true;
          }
        }
        return false;
      };

      interface FeatureCluster {
        items: ProcessedFeatureInfo[];
        centroid: [number, number];
        angle: number;
        labelText: string;
        allPoints: [number, number][];
      }

      const clusters: FeatureCluster[] = [];

      groups.forEach((items) => {
        if (items.length === 1) {
          const info = items[0];
          let labelText = info.fullName;
          const nameStyle = config.labelNameStyle || 'full-name';
          if (nameStyle === 'short-code' && info.isoCode) {
            labelText = info.isoCode;
          }

          const currentMode = config.colorLabelMode || 'on-legend';
          const hasCustomLabel = !!(info.colorLabel && info.colorLabel.trim().length > 0);
          if (hasCustomLabel && (currentMode === 'on-polygons' || currentMode === 'on-map' || currentMode === 'both')) {
            if (currentMode === 'on-polygons' || currentMode === 'on-map') {
              labelText = info.colorLabel!;
            } else if (info.colorLabel!.trim().toLowerCase() !== labelText.trim().toLowerCase()) {
              labelText = `${labelText}: ${info.colorLabel!}`;
            }
          }

          clusters.push({
            items: [info],
            centroid: info.primaryTarget.centroid,
            angle: info.primaryTarget.angle,
            labelText,
            allPoints: info.allPoints
          });
        } else {
          const visited = new Array(items.length).fill(false);
          const GRID_SIZE = 4;
          const spatialGrid = new Map<string, number[]>();

          for (let idx = 0; idx < items.length; idx++) {
            const bbox = items[idx].bbox;
            const minCx = Math.floor((bbox[0] + 180) / GRID_SIZE);
            const maxCx = Math.floor((bbox[2] + 180) / GRID_SIZE);
            const minCy = Math.floor((bbox[1] + 90) / GRID_SIZE);
            const maxCy = Math.floor((bbox[3] + 90) / GRID_SIZE);

            for (let cx = minCx; cx <= maxCx; cx++) {
              for (let cy = minCy; cy <= maxCy; cy++) {
                const cellKey = `${cx},${cy}`;
                let cellList = spatialGrid.get(cellKey);
                if (!cellList) {
                  cellList = [];
                  spatialGrid.set(cellKey, cellList);
                }
                cellList.push(idx);
              }
            }
          }

          const checkedCandidates = new Set<number>();

          for (let i = 0; i < items.length; i++) {
            if (visited[i]) continue;

            const component: ProcessedFeatureInfo[] = [];
            const queue: number[] = [i];
            visited[i] = true;

            while (queue.length > 0) {
              const currIdx = queue.shift()!;
              const currItem = items[currIdx];
              component.push(currItem);

              const bbox = currItem.bbox;
              const minCx = Math.floor((bbox[0] - 0.2 + 180) / GRID_SIZE);
              const maxCx = Math.floor((bbox[2] + 0.2 + 180) / GRID_SIZE);
              const minCy = Math.floor((bbox[1] - 0.2 + 90) / GRID_SIZE);
              const maxCy = Math.floor((bbox[3] + 0.2 + 90) / GRID_SIZE);

              checkedCandidates.clear();

              for (let cx = minCx; cx <= maxCx; cx++) {
                for (let cy = minCy; cy <= maxCy; cy++) {
                  const cellList = spatialGrid.get(`${cx},${cy}`);
                  if (!cellList) continue;

                  for (let k = 0; k < cellList.length; k++) {
                    const j = cellList[k];
                    if (!visited[j] && !checkedCandidates.has(j)) {
                      checkedCandidates.add(j);
                      if (areAdjacent(currItem, items[j])) {
                        visited[j] = true;
                        queue.push(j);
                      }
                    }
                  }
                }
              }
            }

            let totalArea = 0;
            let weightedLon = 0;
            let weightedLat = 0;
            let maxArea = -1;
            let primaryItem = component[0];
            const combinedPoints: [number, number][] = [];

            component.forEach((item) => {
              const area = Math.max(0.000001, item.primaryTarget.area || 1);
              totalArea += area;
              weightedLon += item.primaryTarget.centroid[0] * area;
              weightedLat += item.primaryTarget.centroid[1] * area;
              if (area > maxArea) {
                maxArea = area;
                primaryItem = item;
              }
              combinedPoints.push(...item.allPoints);
            });

            const isClusterCityState = component.some(item => !!(item.feature as any)._enlarged);
            let combinedCentroid: [number, number];
            if (isClusterCityState) {
              const primaryFeat = primaryItem.feature;
              const mCenter = (primaryFeat as any)._enlargedCenter || getFeatureCenter(primaryFeat) || primaryItem.primaryTarget.centroid;
              combinedCentroid = mCenter;
            } else {
              combinedCentroid = [
                weightedLon / totalArea,
                weightedLat / totalArea
              ];
            }

            let labelText = primaryItem.fullName;
            const nameStyle = config.labelNameStyle || 'full-name';
            if (nameStyle === 'short-code' && primaryItem.isoCode) {
              labelText = primaryItem.isoCode;
            }

            const currentMode = config.colorLabelMode || 'on-legend';
            const hasCustomLabel = !!(primaryItem.colorLabel && primaryItem.colorLabel.trim().length > 0 && !primaryItem.colorLabel.trim().toLowerCase().startsWith('flag:'));
            if (hasCustomLabel && (currentMode === 'on-polygons' || currentMode === 'on-map' || currentMode === 'both')) {
              if (currentMode === 'on-polygons' || currentMode === 'on-map') {
                labelText = primaryItem.colorLabel!;
              } else if (component.length === 1 && primaryItem.colorLabel!.trim().toLowerCase() !== labelText.trim().toLowerCase()) {
                labelText = `${labelText}: ${primaryItem.colorLabel!}`;
              } else {
                labelText = primaryItem.colorLabel!;
              }
            }

            if (labelText && (labelText.toLowerCase().startsWith('flag:') || labelText.toUpperCase().startsWith('FLAG:'))) {
              labelText = primaryItem.fullName;
            }

            clusters.push({
              items: component,
              centroid: combinedCentroid,
              angle: primaryItem.primaryTarget.angle,
              labelText,
              allPoints: combinedPoints
            });
          }
        }
      });

      const haloWidth = 3.5;

      svgContent += `    <g id="map-labels">\n`;

      clusters.forEach((cluster) => {
        try {
          const { centroid, angle, labelText, allPoints } = cluster;
          if (!centroid || (centroid[0] === 0 && centroid[1] === 0)) return;

          if (isOrthographicProj) {
            const cLonRad = (centroid[0] * Math.PI) / 180;
            const cLatRad = (centroid[1] * Math.PI) / 180;
            const cos_c_label = sin_lat0 * Math.sin(cLatRad) + cos_lat0 * Math.cos(cLatRad) * Math.cos(cLonRad - lon0Rad);
            if (cos_c_label < 0) return;
          } else if (config.projection === 'gnomonic' && !isNoGeoref) {
            const cLonRad = (centroid[0] * Math.PI) / 180;
            const cLatRad = (centroid[1] * Math.PI) / 180;
            const cos_c_label = sin_lat0 * Math.sin(cLatRad) + cos_lat0 * Math.cos(cLatRad) * Math.cos(cLonRad - lon0Rad);
            if (cos_c_label < 0.5) return;
          }

          const projected = projection(centroid);
          if (!projected) return;

          let [x, y] = projected;
          const screenX = x * zoom + pan.x;
          const screenY = y * zoom + pan.y;

          const sizingMode = config.labelSizingMode || 'fixed';
          const nameStyle = config.labelNameStyle || 'full-name';

          const screenAngle = 0; // Strictly horizontal

          let uSpan = 60;
          let vSpan = 30;

          const primaryItem = cluster.items[0];
          const isoCode = primaryItem ? primaryItem.isoCode : undefined;

          const screenPoly: [number, number][] = [];
          let minU = Infinity, maxU = -Infinity;
          let minV = Infinity, maxV = -Infinity;

          const refX = x;
          const mapWidth = width;

          if (cluster.items && cluster.items.length > 0) {
            for (const item of cluster.items) {
              const pts = item.allPoints;
              if (pts && pts.length > 0) {
                const step = Math.max(1, Math.floor(pts.length / 80));
                for (let i = 0; i < pts.length; i += step) {
                  const pt = projection(pts[i]);
                  if (pt && !isNaN(pt[0]) && !isNaN(pt[1])) {
                    let px = pt[0];
                    if (px - refX > mapWidth * 0.4) px -= mapWidth;
                    else if (refX - px > mapWidth * 0.4) px += mapWidth;

                    if (px < minU) minU = px;
                    if (px > maxU) maxU = px;
                    if (pt[1] < minV) minV = pt[1];
                    if (pt[1] > maxV) maxV = pt[1];
                  }
                }
              }
            }
          }

          const itemLabelGeom = primaryItem ? getCountryLabelGeometry(primaryItem.feature, labelGeomCacheRef.current) : null;
          const isArchipelago = itemLabelGeom ? itemLabelGeom.isArchipelago : false;

          if (isArchipelago && itemLabelGeom && itemLabelGeom.overallBBox) {
            const [bMinLon, bMinLat, bMaxLon, bMaxLat] = itemLabelGeom.overallBBox;
            const bboxCorners: [number, number][] = [
              [bMinLon, bMinLat], [bMaxLon, bMinLat], [bMinLon, bMaxLat], [bMaxLon, bMaxLat],
              [(bMinLon + bMaxLon) / 2, bMinLat], [(bMinLon + bMaxLon) / 2, bMaxLat],
              [bMinLon, (bMinLat + bMaxLat) / 2], [bMaxLon, (bMinLat + bMaxLat) / 2],
            ];
            for (const c of bboxCorners) {
              const pt = projection(c);
              if (pt && !isNaN(pt[0]) && !isNaN(pt[1])) {
                let px = pt[0];
                if (px - refX > mapWidth * 0.4) px -= mapWidth;
                else if (refX - px > mapWidth * 0.4) px += mapWidth;
                if (px < minU) minU = px;
                if (px > maxU) maxU = px;
                if (pt[1] < minV) minV = pt[1];
                if (pt[1] > maxV) maxV = pt[1];
              }
            }
          } else if (!isArchipelago && primaryItem && primaryItem.primaryTarget && primaryItem.primaryTarget.ringBBox) {
            const [bMinLon, bMinLat, bMaxLon, bMaxLat] = primaryItem.primaryTarget.ringBBox;
            const bboxCorners: [number, number][] = [
              [bMinLon, bMinLat], [bMaxLon, bMinLat], [bMinLon, bMaxLat], [bMaxLon, bMaxLat],
              [(bMinLon + bMaxLon) / 2, bMinLat], [(bMinLon + bMaxLon) / 2, bMaxLat],
              [bMinLon, (bMinLat + bMaxLat) / 2], [bMaxLon, (bMinLat + bMaxLat) / 2],
            ];
            for (const c of bboxCorners) {
              const pt = projection(c);
              if (pt && !isNaN(pt[0]) && !isNaN(pt[1])) {
                let px = pt[0];
                if (px - refX > mapWidth * 0.4) px -= mapWidth;
                else if (refX - px > mapWidth * 0.4) px += mapWidth;
                if (px < minU) minU = px;
                if (px > maxU) maxU = px;
                if (pt[1] < minV) minV = pt[1];
                if (pt[1] > maxV) maxV = pt[1];
              }
            }
          }

          const targetRing = primaryItem && primaryItem.primaryTarget ? primaryItem.primaryTarget.ring : null;
          const ptsToProject = (!isArchipelago && targetRing && targetRing.length >= 3) ? targetRing : (!isArchipelago && allPoints && allPoints.length >= 3 ? allPoints : []);

          if (ptsToProject.length >= 3) {
            const step = Math.max(1, Math.floor(ptsToProject.length / 150));
            for (let i = 0; i < ptsToProject.length; i += step) {
              const pt = projection(ptsToProject[i]);
              if (pt && !isNaN(pt[0]) && !isNaN(pt[1])) {
                let px = pt[0];
                let py = pt[1];
                if (px - refX > mapWidth * 0.4) px -= mapWidth;
                else if (refX - px > mapWidth * 0.4) px += mapWidth;
                screenPoly.push([px, py]);
              }
            }
          }

          if (allPoints && allPoints.length >= 3) {
            const centerProj = projection(centroid);
            if (centerProj) {
              const [cx, cy] = centerProj;
              const cosA = Math.cos(screenAngle);
              const sinA = Math.sin(screenAngle);

              let minU = Infinity, maxU = -Infinity;
              let minV = Infinity, maxV = -Infinity;

              const step = Math.max(1, Math.floor(allPoints.length / 80));
              for (let i = 0; i < allPoints.length; i += step) {
                const pt = projection(allPoints[i]);
                if (pt) {
                  const dx = pt[0] - cx;
                  const dy = pt[1] - cy;
                  const u = dx * cosA + dy * sinA;
                  const v = -dx * sinA + dy * cosA;
                  if (u < minU) minU = u;
                  if (u > maxU) maxU = u;
                  if (v < minV) minV = v;
                  if (v > maxV) maxV = v;
                }
              }
              if (maxU > minU) uSpan = maxU - minU;
              if (maxV > minV) vSpan = maxV - minV;
            }
          }

          const isEnlarged = cluster.items.some(it => !!(it.feature as any)._enlarged);
          const isCityState = isEnlarged;

          const screenSpan = uSpan;
          const screenHeight = vSpan;

          let isCircular = isCityState;
          const featRadius = (primaryItem?.feature as any)?._circleRadius !== undefined
            ? (primaryItem.feature as any)._circleRadius
            : 0.55;
          let circleDiameter = isCityState
            ? (featRadius * 2 * config.zoom)
            : Math.max(screenSpan, screenHeight);
          if (!isCircular && screenPoly.length >= 8) {
            const aspect = screenSpan / Math.max(1, screenHeight);
            if (aspect >= 0.75 && aspect <= 1.35) {
              let totalR = 0;
              const radii: number[] = [];
              for (let i = 0; i < screenPoly.length; i++) {
                const r = Math.hypot(screenPoly[i][0] - x, screenPoly[i][1] - y);
                radii.push(r);
                totalR += r;
              }
              const avgR = totalR / screenPoly.length;
              if (avgR >= 3) {
                let maxDiff = 0;
                for (let i = 0; i < radii.length; i++) {
                  const diff = Math.abs(radii[i] - avgR);
                  if (diff > maxDiff) maxDiff = diff;
                }
                if (maxDiff / avgR <= 0.25) {
                  isCircular = true;
                  circleDiameter = avgR * 2;
                }
              }
            }
          }

          let label = labelText;
          if (!label || label.length === 0) return;

          const minFontSize = config.minLabelFontSize !== undefined ? Math.max(1, config.minLabelFontSize) : 1;
          const baseFontSize = config.labelFontSize || 14;
          const dynamicMax = Math.max(72, baseFontSize * 4);
          const maxFontSize = config.maxLabelFontSize !== undefined ? Math.max(1, config.maxLabelFontSize) : (sizingMode === 'fixed' ? baseFontSize : dynamicMax);

          let fontPx = maxFontSize;
          if (isCircular) {
            // The names for circular polygons must always be in ISO
            const hasCustomLabel = !!(primaryItem?.colorLabel && primaryItem.colorLabel.trim().length > 0 && !primaryItem.colorLabel.trim().toLowerCase().startsWith('flag:'));
            const currentMode = config.colorLabelMode || 'on-legend';
            const isLabelReplaced = hasCustomLabel && (currentMode === 'on-polygons' || currentMode === 'on-map' || currentMode === 'both');
            if (isLabelReplaced) {
              label = primaryItem.colorLabel!;
            } else {
              const circularIso = (isoCode && isoCode.trim().length >= 2)
                ? isoCode.trim()
                : (
                    (primaryItem?.feature ? (getFeatureIsoCode(primaryItem.feature, selectedMapFile) || getFeatureIsoA2(primaryItem.feature)) : '') ||
                    (primaryItem?.feature?.properties?.adm0_a3 || primaryItem?.feature?.properties?.iso_a3 || primaryItem?.feature?.properties?.iso_a2 || primaryItem?.feature?.properties?.id || '').trim()
                  );
              if (circularIso && circularIso.length >= 2) {
                label = circularIso;
              }
            }
            const targetTextWidth = circleDiameter * 0.80;
            measureCtx.font = getFontString(16);
            const refWidth = measureCtx.measureText(label).width || 1;
            fontPx = Math.max(0.5, (targetTextWidth / refWidth) * 16);
          } else if (isArchipelago) {
            const archW = Math.max(uSpan, maxU - minU);
            const archH = Math.max(vSpan, maxV - minV);
            measureCtx.font = getFontString(16);
            const refWidth = measureCtx.measureText(label).width || 1;
            if (archW > 0 && refWidth > 0) {
              const fontForW = (archW * 0.85 / refWidth) * 16;
              const fontForH = archH * 0.80;
              fontPx = Math.min(fontForW, fontForH, maxFontSize);
            } else {
              fontPx = maxFontSize;
            }
          } else if (screenPoly.length >= 3 && !isCityState) {
            const fit = computeHorizontalFitInsidePolygon(screenPoly, x, y, [minU, minV, maxU, maxV]);
            x = fit.adjustedX;
            y = fit.adjustedY;
            measureCtx.font = getFontString(16);
            const refWidth = measureCtx.measureText(label).width || 1;
            const fontForW = (fit.availW * 0.90 / refWidth) * 16;
            const fontForH = fit.availH * 0.80;
            fontPx = Math.min(fontForW, fontForH, maxFontSize);
          }
          if (!isCircular) {
            fontPx = Math.max(fontPx, minFontSize);
            fontPx = Math.min(fontPx, maxFontSize);
          } else {
            fontPx = Math.max(0.5, fontPx);
          }
          let extraSpacing = 0;

          const projTrans = projection.translate();
          const projScale = projection.scale();
          const mapBorderWidth = config.mapBorderWidth !== undefined ? config.mapBorderWidth : 1.0;
          const borderMargin = Math.max(2.0, (mapBorderWidth / 2) + 1.5);

          let mapMinX = -Infinity;
          let mapMinY = -Infinity;
          let mapMaxX = Infinity;
          let mapMaxY = Infinity;
          try {
            const sb = d3Path.bounds({ type: 'Sphere' });
            if (sb && isFinite(sb[0][0]) && isFinite(sb[0][1]) && isFinite(sb[1][0]) && isFinite(sb[1][1])) {
              mapMinX = sb[0][0];
              mapMinY = sb[0][1];
              mapMaxX = sb[1][0];
              mapMaxY = sb[1][1];
            }
          } catch (e) {}

          const adjusted = validateAndAdjustLabelPlacement({
            x,
            y,
            label,
            isoCode,
            nameStyle,
            fontPx,
            baseFontPx: baseFontSize,
            angle: screenAngle,
            extraSpacing,
            isSpherical: isOrthographicProj || config.projection === 'gnomonic' || config.projection === 'azimuthalEqualArea',
            gcX: projTrans ? projTrans[0] : width / 2,
            gcY: projTrans ? projTrans[1] : height / 2,
            gRadius: projScale || 100,
            mapMinX,
            mapMinY,
            mapMaxX,
            mapMaxY,
            polyMinX: minU,
            polyMinY: minV,
            polyMaxX: maxU,
            polyMaxY: maxV,
            borderMargin,
            currentZoom: zoom,
            isCityState: isCircular,
            minFontPx: minFontSize,
            screenPoly,
            measureWidth: (t, f) => {
              measureCtx.font = getFontString(f);
              return measureCtx.measureText(t).width;
            },
          });

          if (!adjusted.visible) return;

          label = adjusted.label;
          fontPx = adjusted.fontPx;
          extraSpacing = adjusted.extraSpacing;
          const finalX = adjusted.x;
          const finalY = adjusted.y;

          const safeLabel = label.replace(/[<>&'"]/g, (c) => {
            switch (c) {
              case '<': return '&lt;';
              case '>': return '&gt;';
              case '&': return '&amp;';
              case "'": return '&apos;';
              case '"': return '&quot;';
              default: return c;
            }
          });

          const angleDeg = (screenAngle * 180) / Math.PI;
          const spacingAttr = extraSpacing > 0 ? ` letter-spacing="${extraSpacing.toFixed(2)}px"` : '';

          const strokeHaloWidth = fontPx * labelBorderRatio;
          svgContent += `      <g transform="translate(${finalX.toFixed(2)}, ${finalY.toFixed(2)}) rotate(${angleDeg.toFixed(2)})">\n`;
          svgContent += `        <text x="0" y="0" text-anchor="middle" dominant-baseline="central" font-family=${svgFontAttrs.fontFamily} font-size="${fontPx.toFixed(2)}px" font-weight="${svgFontAttrs.fontWeight}" font-style="${svgFontAttrs.fontStyle}"${spacingAttr} fill="${textColor}" stroke="${haloColor}" stroke-width="${strokeHaloWidth.toFixed(2)}px" paint-order="stroke fill" stroke-linejoin="round" stroke-linecap="round">${safeLabel}</text>\n`;
          svgContent += `      </g>\n`;
        } catch (e) {}
      });

      svgContent += `    </g>\n`;
    }

    // Draw "Made with MapPainter" Watermark inside map viewport
    let unzoomedMaxX = width - 16;
    let unzoomedMaxY = height - 14;
    if (!isNoGeoref) {
      try {
        const sb = d3Path.bounds({ type: 'Sphere' });
        if (sb && isFinite(sb[1][0]) && isFinite(sb[1][1])) {
          unzoomedMaxX = sb[1][0];
          unzoomedMaxY = sb[1][1];
        }
      } catch (e) {}
    } else if (features && features.length > 0) {
      let mx = -Infinity;
      let my = -Infinity;
      features.forEach((f) => {
        try {
          const fb = d3Path.bounds(f);
          if (fb && isFinite(fb[1][0]) && isFinite(fb[1][1])) {
            mx = Math.max(mx, fb[1][0]);
            my = Math.max(my, fb[1][1]);
          }
        } catch (e) {}
      });
      if (isFinite(mx) && isFinite(my)) {
        unzoomedMaxX = mx;
        unzoomedMaxY = my;
      }
    }

    const svgWmX = unzoomedMaxX - 16;
    const svgWmY = unzoomedMaxY - 14;
    const wmTextColor = isDarkTheme ? 'rgba(253, 252, 248, 0.85)' : 'rgba(18, 18, 18, 0.85)';
    const wmStrokeColor = isDarkTheme ? 'rgba(0, 0, 0, 0.75)' : 'rgba(255, 255, 255, 0.75)';

    svgContent += `    <g id="map-watermark">\n`;
    svgContent += `      <text x="${svgWmX}" y="${svgWmY}" text-anchor="end" dominant-baseline="auto" font-family=${svgFontAttrs.fontFamily} font-size="11px" font-weight="${svgFontAttrs.fontWeight}" font-style="${svgFontAttrs.fontStyle}" fill="${wmTextColor}" stroke="${wmStrokeColor}" stroke-width="2.5px" paint-order="stroke fill" stroke-linejoin="round">Made with MapPainter</text>\n`;
    svgContent += `    </g>\n`;

    // End viewport group
    svgContent += `  </g>\n`;

    // Map Legend Overlay (fixed screen overlay)
    if (config.showMapLegend === true) {
      const activeColorsSet = new Set<string>();
      const originalColorMap = new Map<string, string>();

      if (customColors) {
        Object.values(customColors).forEach((c) => {
          if (c && !c.startsWith('flag:')) {
            const norm = c.toLowerCase();
            activeColorsSet.add(norm);
            if (!originalColorMap.has(norm)) {
              originalColorMap.set(norm, c);
            }
          }
        });
      }

      const normLegendLabels: Record<string, string> = {};
      if (legendLabels) {
        Object.entries(legendLabels).forEach(([col, txt]) => {
          if (col && txt) {
            normLegendLabels[col.toLowerCase()] = txt.trim();
          }
        });
      }

      const svgColorRows: LegendRowItem[] = [];
      activeColorsSet.forEach((normColor) => {
        const actualColor = originalColorMap.get(normColor) || normColor;
        const labelText = normLegendLabels[normColor] || normLegendLabels[actualColor] || actualColor.toUpperCase();
        svgColorRows.push({ kind: 'color', color: actualColor, text: labelText });
      });

      let svgLocationRows: LegendRowItem[] = [];
      if (showLocations && importedLocations && importedLocations.length > 0 && config.showLocationGroupsInLegend !== false) {
        svgLocationRows = buildLocationLegendRows(importedLocations, admin0Size, admin1Size);
      }

      // No fallback default legend entries for oceans or uncolored land

      if (svgColorRows.length > 0 || svgLocationRows.length > 0) {
        const titleText = (config.legendTitle && config.legendTitle.trim()) ? config.legendTitle.trim() : 'MAP LEGEND';
        const pos = config.legendPosition || 'below';

        let mapOuterMinX = 12;
        let mapOuterMaxX = width - 12;

        if (!isNoGeoref) {
          try {
            const sb = d3Path.bounds({ type: 'Sphere' });
            if (sb && isFinite(sb[0][0]) && isFinite(sb[1][0]) && sb[1][0] > sb[0][0]) {
              mapOuterMinX = sb[0][0];
              mapOuterMaxX = sb[1][0];
            }
          } catch (e) {}
        } else if (features && features.length > 0) {
          let minF = Infinity;
          let maxF = -Infinity;
          features.forEach((f) => {
            try {
              const fb = d3Path.bounds(f);
              if (fb && isFinite(fb[0][0]) && isFinite(fb[1][0])) {
                minF = Math.min(minF, fb[0][0]);
                maxF = Math.max(maxF, fb[1][0]);
              }
            } catch (e) {}
          });
          if (isFinite(minF) && isFinite(maxF) && maxF > minF) {
            mapOuterMinX = minF;
            mapOuterMaxX = maxF;
          }
        }

        mapOuterMinX = Math.max(0, mapOuterMinX);
        mapOuterMaxX = Math.min(width, mapOuterMaxX);

        const cardX = mapOuterMinX;
        const cardWidth = Math.max(160, mapOuterMaxX - mapOuterMinX);

        const headerHeight = 24;
        const rowHeight = 20;

        // Layout items horizontally
        const placedSvgColorItems: { row: LegendRowItem; x: number; relY: number; text: string }[] = [];
        const placedSvgLocationItems: { row: LegendRowItem; x: number; relY: number; text: string }[] = [];
        let currRowX = cardX + 12;
        let currRelY = headerHeight + 6;

        if (svgColorRows.length > 0) {
          for (const row of svgColorRows) {
            const textWidth = row.text.length * 7;
            const itemWidth = 16 + 6 + textWidth + 16;

            if (currRowX > cardX + 12 && currRowX + itemWidth > cardX + cardWidth - 12) {
              currRowX = cardX + 12;
              currRelY += rowHeight;
            }

            placedSvgColorItems.push({
              row,
              x: currRowX,
              relY: currRelY,
              text: row.text,
            });

            currRowX += itemWidth;
          }
        }

        let sectionDividerRelY: number | null = null;
        if (svgColorRows.length > 0 && svgLocationRows.length > 0) {
          sectionDividerRelY = currRelY + rowHeight + 4;
          currRelY = sectionDividerRelY + 8;
          currRowX = cardX + 12;
        } else if (svgColorRows.length === 0 && svgLocationRows.length > 0) {
          currRelY = headerHeight + 6;
          currRowX = cardX + 12;
        }

        if (svgLocationRows.length > 0) {
          for (const row of svgLocationRows) {
            const textWidth = row.text.length * 7;
            const itemWidth = 16 + 6 + textWidth + 16;

            if (currRowX > cardX + 12 && currRowX + itemWidth > cardX + cardWidth - 12) {
              currRowX = cardX + 12;
              currRelY += rowHeight;
            }

            placedSvgLocationItems.push({
              row,
              x: currRowX,
              relY: currRelY,
              text: row.text,
            });

            currRowX += itemWidth;
          }
        }

        const cardHeight = currRelY + rowHeight + 6;
        const isAbove = pos === 'above' || pos === 'top-left' || pos === 'top-right';

        let cardY = 12;
        if (isAbove) {
          cardY = (crop.mapMinY !== undefined ? crop.mapMinY : crop.minY) - cardHeight;
        } else {
          cardY = crop.mapMaxY !== undefined ? crop.mapMaxY : crop.maxY;
        }

        const bgCard = isDarkTheme ? '#181816' : '#FDFCF8';
        const effMapBorderThickness = config.mapBorderWidth !== undefined ? config.mapBorderWidth : 0.2;
        const effMapBorderColor = (config.mapBorderColor && config.mapBorderColor !== 'default')
          ? config.mapBorderColor
          : (config.borderColor && config.borderColor !== 'default' ? config.borderColor : (isDarkTheme ? '#334155' : '#94a3b8'));

        const effLegendBorderWidth = (config.legendBorderWidth !== undefined && config.legendBorderWidth !== null)
          ? config.legendBorderWidth
          : effMapBorderThickness;
        const effLegendBorderColor = (config.legendBorderColor && config.legendBorderColor !== 'default')
          ? config.legendBorderColor
          : effMapBorderColor;
        const textColor = isDarkTheme ? '#FDFCF8' : '#121212';

        svgContent += `  <g id="map-legend">\n`;
        svgContent += `    <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" fill="${bgCard}" stroke="${effLegendBorderColor}" stroke-width="${effLegendBorderWidth}" opacity="0.95" />\n`;
        
        const safeTitle = titleText.replace(/[<>&'"]/g, (c) => {
          switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case "'": return '&apos;';
            case '"': return '&quot;';
            default: return c;
          }
        }).toUpperCase();

        svgContent += `    <text x="${cardX + 12}" y="${cardY + 16}" font-family=${svgFontAttrs.fontFamily} font-size="9.5px" font-weight="${svgFontAttrs.fontWeight}" font-style="${svgFontAttrs.fontStyle}" fill="${textColor}">${safeTitle}</text>\n`;
        svgContent += `    <line x1="${cardX + 12}" y1="${cardY + 22}" x2="${cardX + cardWidth - 12}" y2="${cardY + 22}" stroke="${borderCard}" stroke-width="1" />\n`;

        if (sectionDividerRelY !== null) {
          svgContent += `    <line x1="${cardX + 12}" y1="${cardY + sectionDividerRelY}" x2="${cardX + cardWidth - 12}" y2="${cardY + sectionDividerRelY}" stroke="${borderCard}" stroke-width="1" />\n`;
        }

        for (const item of placedSvgColorItems) {
          const itemAbsY = cardY + item.relY;
          const safeText = item.text.replace(/[<>&'"]/g, (c) => {
            switch (c) {
              case '<': return '&lt;';
              case '>': return '&gt;';
              case '&': return '&amp;';
              case "'": return '&apos;';
              case '"': return '&quot;';
              default: return c;
            }
          });

          svgContent += `    <rect x="${item.x}" y="${itemAbsY}" width="12" height="12" fill="${item.row.color}" stroke="#000000" stroke-width="0.5" />\n`;
          svgContent += `    <text x="${item.x + 18}" y="${itemAbsY + 10}" font-family=${svgFontAttrs.fontFamily} font-size="9.5px" font-style="${svgFontAttrs.fontStyle}" fill="${textColor}">${safeText}</text>\n`;
        }

        for (const item of placedSvgLocationItems) {
          const itemAbsY = cardY + item.relY;
          const safeText = item.text.replace(/[<>&'"]/g, (c) => {
            switch (c) {
              case '<': return '&lt;';
              case '>': return '&gt;';
              case '&': return '&amp;';
              case "'": return '&apos;';
              case '"': return '&quot;';
              default: return c;
            }
          });

          svgContent += `    <circle cx="${item.x + 6}" cy="${itemAbsY + 6}" r="5" fill="${item.row.color}" stroke="#000000" stroke-width="1" />\n`;
          svgContent += `    <text x="${item.x + 18}" y="${itemAbsY + 10}" font-family=${svgFontAttrs.fontFamily} font-size="9.5px" font-style="${svgFontAttrs.fontStyle}" fill="${textColor}">${safeText}</text>\n`;
        }

        svgContent += `  </g>\n`;
      }
    }

    svgContent += `</svg>`;

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const baseName = selectedMapFile ? selectedMapFile.replace(/\.[^/.]+$/, '') : 'map';
    link.download = `${baseName}_export_${Date.now()}.svg`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  */

  const handleExportPlacementLogicsTxt = () => {
    const lines: string[] = [];

    const isoMap = new Map<string, string>();

    rawFeatures.forEach((feat) => {
      const isoCode = getFeatureIsoCode(feat, selectedMapFile) || feat.properties?.adm0_a3 || feat.properties?.iso_a3 || feat.properties?.id || feat.properties?.postal || feat.properties?.name || '';
      if (!isoCode) return;

      const override = placementOverrides[isoCode];

      let logic = '';
      if (override) {
        logic = override;
      } else {
        const labelGeom = getCountryLabelGeometry(feat, labelGeomCacheRef.current);
        const targetRing = (labelGeom.targets && labelGeom.targets[0]?.ring) || labelGeom.largestRing || [];
        let polygonPixelArea = 0;
        let screenW = 0;
        let screenH = 0;
        if (targetRing && targetRing.length >= 3) {
          let areaSum = 0;
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          const step = Math.max(1, Math.floor(targetRing.length / 80));
          for (let i = 0; i < targetRing.length; i++) {
            const p1 = projection(targetRing[i]);
            const p2 = projection(targetRing[(i + 1) % targetRing.length]);
            if (p1 && p2 && !isNaN(p1[0]) && !isNaN(p1[1]) && !isNaN(p2[0]) && !isNaN(p2[1])) {
              areaSum += (p1[0] * p2[1] - p2[0] * p1[1]);
            }
          }
          for (let i = 0; i < targetRing.length; i += step) {
            const pt = projection(targetRing[i]);
            if (pt && !isNaN(pt[0]) && !isNaN(pt[1])) {
              if (pt[0] < minX) minX = pt[0];
              if (pt[0] > maxX) maxX = pt[0];
              if (pt[1] < minY) minY = pt[1];
              if (pt[1] > maxY) maxY = pt[1];
            }
          }
          polygonPixelArea = Math.abs(areaSum / 2);
          if (minX !== Infinity) {
            screenW = maxX - minX;
            screenH = maxY - minY;
          }
        }

        const isLargePolygon = polygonPixelArea >= 3900;
        if (isLargePolygon || labelGeom.isArchipelago) {
          logic = 'center-of-mass';
        } else {
          logic = computeDynamicLabelPlacementMode(feat);
        }
      }

      if (!isoMap.has(isoCode) || override) {
        isoMap.set(isoCode, logic);
      }
    });

    const sortedIsoCodes = Array.from(isoMap.keys()).sort();

    sortedIsoCodes.forEach((code) => {
      lines.push(`${code}: ${isoMap.get(code)}`);
    });

    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `country_label_placement_logics.txt`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (onRegisterExportHandlers) {
      onRegisterExportHandlers({
        exportPNG: handleExportPNG,
      });
    }
  }, [onRegisterExportHandlers, handleExportPNG]);

  return (
    <div 
      id="map-canvas-container" 
      className="relative flex-1 w-full h-full min-h-0 transition-colors duration-300" 
      style={{ backgroundColor: effectiveBgColor, minHeight: '100%', minWidth: '100%' }}
      ref={containerRef}
    >
      {/* Floating Tactical Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute z-20 pointer-events-none bg-[#FDFCF8] dark:bg-[#1C1C1A] text-[#121212] dark:text-[#FDFCF8] text-[10px] p-2.5 shadow-xl font-mono border-2 border-[#121212] dark:border-[#3A3A36] max-w-[220px] hidden whitespace-pre-line"
        style={{ left: '0px', top: '0px' }}
      />


      {/* Selected country tracking locator ripple */}
      {selectedCentroidCoords && (
        <div
          id="selection-ripple-locator"
          className="absolute z-10 pointer-events-none -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${selectedCentroidCoords.x}px`, top: `${selectedCentroidCoords.y}px` }}
        >
          <span className="absolute inline-flex h-6 w-6 rounded-full bg-red-500 opacity-75 animate-ping"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600 border border-white shadow-sm"></span>
        </div>
      )}

      {/* Hardware-Accelerated WebGPU Background Canvas Layer */}
      <canvas
        id="webgpu-map-background"
        ref={webgpuCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none block z-0"
        style={{ display: decodedBgDescriptor ? 'block' : 'none' }}
      />

      {/* Hardware-Accelerated WebGL Map Layer (Hybrid Compositor + GPU Mesh) */}
      <canvas
        id="webgl-map-surface"
        ref={webglCanvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none block z-[5]"
      />

      {/* Primary 2D Interactive Map Canvas */}
      <canvas
        id="geojson-map-surface"
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block z-10 cursor-grab active:cursor-grabbing touch-none transition-colors duration-300"
        style={{ backgroundColor: 'transparent' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onContextMenu={(e) => {
          e.preventDefault();
          isRightDragging.current = false;
          lastRightSwipedCountryIdRef.current = null;

          if (e.altKey) {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const px = (x - interactiveViewportRef.current.pan.x) / interactiveViewportRef.current.zoom;
            const py = (y - interactiveViewportRef.current.pan.y) / interactiveViewportRef.current.zoom;

            const geoCoordinate = typeof projection.invert === 'function' ? projection.invert([px, py]) : null;

            const hit = findFeatureAtScreenPos(px, py, geoCoordinate);

            if (hit) {
              const hitIso = getFeatureIsoCode(hit, selectedMapFile) || hit.properties?.adm0_a3 || hit.properties?.iso_a3 || hit.properties?.name || '';
              const hitName = hit.properties?.name || hit.properties?.name_long || hit.properties?.NAME || hitIso;

              setDebugPlacementMenu({
                x: e.clientX,
                y: e.clientY,
                feature: hit,
                isoCode: hitIso,
                name: hitName,
              });
            }
            return;
          }

          // Fallback if browser didn't fire mousedown/mouseup before contextmenu
          if (Date.now() - lastRightClickHandledTimeRef.current > 300) {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const px = (x - interactiveViewportRef.current.pan.x) / interactiveViewportRef.current.zoom;
            const py = (y - interactiveViewportRef.current.pan.y) / interactiveViewportRef.current.zoom;

            const geoCoordinate = typeof projection.invert === 'function' ? projection.invert([px, py]) : null;

            const hit = findFeatureAtScreenPos(px, py, geoCoordinate);
            if (hit) {
              onRightClickCountry?.(hit, e.shiftKey);
              lastRightClickHandledTimeRef.current = Date.now();
            }
          }
        }}
      />

      {/* Debug Placement Override Context Menu */}
      {debugPlacementMenu && (
        <div
          className="fixed z-50 bg-[#FDFCF8] dark:bg-[#1C1C1A] text-[#121212] dark:text-[#FDFCF8] p-3.5 rounded-lg shadow-2xl border-2 border-[#121212] dark:border-[#3A3A36] font-sans w-72 backdrop-blur select-none"
          style={{
            left: `${Math.min(window.innerWidth - 300, Math.max(10, debugPlacementMenu.x))}px`,
            top: `${Math.min(window.innerHeight - 320, Math.max(10, debugPlacementMenu.y))}px`,
          }}
        >
          <div className="flex items-center justify-between pb-2 border-b border-neutral-200 dark:border-neutral-700 mb-2.5">
            <div className="flex flex-col">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Placement Logic Override
              </span>
              <span className="text-xs font-bold font-serif truncate max-w-[200px]">
                {debugPlacementMenu.name} ({debugPlacementMenu.isoCode})
              </span>
            </div>
            <button
              onClick={() => setDebugPlacementMenu(null)}
              className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded text-xs font-mono font-bold text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              ✕
            </button>
          </div>

          <div className="space-y-1.5 mb-3 text-xs font-medium">
            <label className="flex items-center gap-2 p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer border border-transparent hover:border-neutral-300 dark:hover:border-neutral-700">
              <input
                type="radio"
                name="placement-mode"
                checked={placementOverrides[debugPlacementMenu.isoCode] === 'center-of-mass'}
                onChange={() => {
                  setPlacementOverrides((prev) => ({
                    ...prev,
                    [debugPlacementMenu.isoCode]: 'center-of-mass',
                  }));
                  needsBaseRedrawRef.current = true;
                }}
                className="accent-blue-600"
              />
              <span>Center-of-Mass</span>
            </label>

            <label className="flex items-center gap-2 p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer border border-transparent hover:border-neutral-300 dark:hover:border-neutral-700">
              <input
                type="radio"
                name="placement-mode"
                checked={placementOverrides[debugPlacementMenu.isoCode] === 'center'}
                onChange={() => {
                  setPlacementOverrides((prev) => ({
                    ...prev,
                    [debugPlacementMenu.isoCode]: 'center',
                  }));
                  needsBaseRedrawRef.current = true;
                }}
                className="accent-blue-600"
              />
              <span>Center (Bounding Box)</span>
            </label>

            <label className="flex items-center gap-2 p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer border border-transparent hover:border-neutral-300 dark:hover:border-neutral-700">
              <input
                type="radio"
                name="placement-mode"
                checked={placementOverrides[debugPlacementMenu.isoCode] === 'most-space'}
                onChange={() => {
                  setPlacementOverrides((prev) => ({
                    ...prev,
                    [debugPlacementMenu.isoCode]: 'most-space',
                  }));
                  needsBaseRedrawRef.current = true;
                }}
                className="accent-blue-600"
              />
              <span>Most Horiz + Vert Space</span>
            </label>

            {placementOverrides[debugPlacementMenu.isoCode] && (
              <button
                onClick={() => {
                  setPlacementOverrides((prev) => {
                    const copy = { ...prev };
                    delete copy[debugPlacementMenu.isoCode];
                    return copy;
                  });
                  needsBaseRedrawRef.current = true;
                }}
                className="text-[10px] font-mono text-red-500 hover:underline pt-1 block"
              >
                Reset to Engine Default
              </button>
            )}
          </div>

          <div className="pt-2 border-t border-neutral-200 dark:border-neutral-700 flex flex-col gap-2">
            <button
              onClick={handleExportPlacementLogicsTxt}
              className="w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-mono text-[10px] font-bold uppercase rounded shadow-sm flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Download size={12} />
              <span>Export Placement Logics (.txt)</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
}, (prevProps, nextProps) => {
  for (const key in nextProps) {
    if (typeof nextProps[key] !== 'function') {
      if (prevProps[key] !== nextProps[key]) {
        return false;
      }
    }
  }
  return true;
});

export default MapCanvas;

