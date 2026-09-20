/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FeatureCollection, Feature, Geometry } from 'geojson';

export type ProjectionType = 'orthographic' | 'mercator' | 'equirectangular' | 'azimuthalEqualArea' | 'gnomonic' | 'winkel1' | 'winkel2' | 'winkel3' | 'mollweide' | 'miller' | 'robinson' | 'eckert1' | 'eckert2' | 'eckert3' | 'eckert4' | 'eckert5' | 'eckert6' | 'aitoff' | 'equalEarth' | 'times' | 'sinusoidal' | 'gallPeters' | 'collignon' | 'gallStereographic' | 'lambert' | 'centralCylindrical';

export interface MapConfig {
  centerLon: number;
  centerLat: number;
  aspect?: number;
  zoom: number;
  edgeAngle?: number;
  projection: ProjectionType;
  showGraticule: boolean;
  graticuleInterval?: number;
  graticuleColor?: string;
  colorTheme: string;
  choroplethMode: ChoroplethMode;
  showLabels?: boolean;
  labelFontSize?: number;
  minLabelFontSize?: number;
  maxLabelFontSize?: number;
  borderWidth?: number;
  countryBorderWidth?: number;
  continentBorderWidth?: number;
  mapBorderWidth?: number;
  borderColor?: string;
  countryBorderColor?: string;
  continentBorderColor?: string;
  mapBorderColor?: string;
  borderStyle?: 'solid' | 'dashed';
  dashLength?: number;
  gapLength?: number;
  customOceanColor?: string;
  customBgColor?: string;
  customSkyboxColor?: string;
  landOpacity?: number;
  occludeBehindGlobe?: boolean;
  labelFontFamily?: 'sans' | 'serif' | 'mono' | 'display' | 'cinzel' | 'cinzel-dec' | 'gothic' | 'medieval' | 'engraved' | 'marcellus' | 'almendra' | 'pirata' | 'cormorant' | string;
  labelNameStyle?: 'full-name' | 'short-code' | 'dynamic-adaptive';
  labelSizingMode?: 'fixed' | 'enlarge' | 'spread' | 'dynamic';
  labelColor?: string;
  labelHaloColor?: string;
  labelBorderColor?: string;
  labelHaloRatio?: number;
  labelBorderRatio?: number;
  swipeSelection?: boolean;
  bgImageFile?: string;
  bgImageOpacity?: number;
  showFlags?: boolean;
  simplificationLevel?: 'off' | 'low' | 'medium' | 'high' | 'ultra';
  showMapLegend?: boolean;
  showLocationGroupsInLegend?: boolean;
  legendTitle?: string;
  legendPosition?: 'above' | 'below' | 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  legendBorderWidth?: number;
  legendBorderColor?: string;
  colorLabelMode?: 'none' | 'on-map' | 'on-legend' | 'on-polygons' | 'both';
  enlargeCityStates?: boolean;
  showRivers?: boolean;
  riverColor?: string;
  riverThickness?: number;
}

export type ChoroplethMode = 'none' | 'population' | 'gdp' | 'income_group' | 'continent';

export interface CountryProperties {
  scalerank?: number;
  featurecla?: string;
  labelrank?: number;
  sovereignt?: string;
  sov_a3?: string;
  admin?: string;
  adm0_a3?: string;
  name: string;
  name_long?: string;
  abbrev?: string;
  postal?: string;
  pop_est?: number;
  gdp_md_est?: number;
  continent?: string;
  region_un?: string;
  subregion?: string;
  economy?: string;
  income_grp?: string;
  [key: string]: any;
}

export type CountryFeature = Feature<Geometry, CountryProperties> & {
  _enlarged?: boolean;
  _enlargedCenter?: [number, number];
  _circleRadius?: number;
};

export type BorderSelectionMode = 'separating' | 'outer' | 'both';

export interface AppliedCustomBorder {
  id: string;
  countryIds: string[];
  style: 'solid' | 'dashed';
  dashLength: number;
  gapLength: number;
  borderSelectionMode: BorderSelectionMode;
  color: string;
  width: number;
}

export interface HistoryState {
  customColors: Record<string, string>;
  appliedCustomBorders: AppliedCustomBorder[];
  showFlags?: boolean;
  legendLabels?: Record<string, string>;
  importedLocations?: MapLocation[];
}

export type MapDataCollection = FeatureCollection<Geometry, CountryProperties>;

/**
 * Calculate the actual edge angle (in degrees) from the total zoom factor (config.zoom * viewport.zoom)
 * for a given map projection type, as defined by professional map projection softwares (like G.Projector).
 */
export function zoomToEdgeAngle(projection: string, zoom: number): number {
  const Z = Math.max(0.01, zoom);
  switch (projection) {
    case 'orthographic': {
      // Globe is zoomed out when edge angle is smaller: zoom = sin(theta) => theta = asin(zoom)
      if (Z >= 1) return 90;
      return (Math.asin(Math.min(1, Math.max(0.0001, Z))) * 180) / Math.PI;
    }
    case 'gnomonic': {
      // theta = arctan(tan(85°) / Z)
      const tan85 = Math.tan((85 * Math.PI) / 180);
      return (Math.atan(tan85 / Z) * 180) / Math.PI;
    }
    case 'azimuthalEqualArea': {
      // theta = 2 * arcsin(1/Z)
      if (Z <= 1) return 180;
      return (2 * Math.asin(1 / Z) * 180) / Math.PI;
    }
    default: {
      // For cylindrical/global/compromise projections, edge angle represents the visible half-longitude span
      return Math.min(180, 180 / Z);
    }
  }
}

/**
 * Calculate the total zoom factor from the edge angle (in degrees)
 * for a given map projection type.
 */
export function edgeAngleToZoom(projection: string, angle: number): number {
  const theta = Math.max(0.01, angle);
  switch (projection) {
    case 'orthographic': {
      // Max angle for orthographic is 90. Smaller edge angle zooms OUT
      const safeAngle = Math.min(90, theta);
      const rad = (safeAngle * Math.PI) / 180;
      return Math.sin(rad);
    }
    case 'gnomonic': {
      // Max angle for gnomonic is 85
      const safeAngle = Math.min(85, theta);
      const rad = (safeAngle * Math.PI) / 180;
      const tan85 = Math.tan((85 * Math.PI) / 180);
      return tan85 / Math.tan(rad);
    }
    case 'azimuthalEqualArea': {
      // Max angle for azimuthal equal area is 180
      const safeAngle = Math.min(180, theta);
      const rad = (safeAngle * Math.PI) / 180;
      return 1 / Math.sin(rad / 2);
    }
    default: {
      const safeAngle = Math.min(180, theta);
      return 180 / safeAngle;
    }
  }
}

export interface MapLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  popMax: number;
  featureClass: string;
  countryName?: string;
  classType?: 'admin0' | 'admin1' | 'populated';
  isCustom?: boolean;
  symbolShape?: string;
  symbolColor?: string;
  symbolSize?: number;
  group?: string;
  popMinThreshold?: number;
}


