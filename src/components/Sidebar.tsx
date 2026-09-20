/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import * as topojson from 'topojson-client';
import { MapConfig, CountryFeature, ProjectionType, AppliedCustomBorder, BorderSelectionMode, zoomToEdgeAngle, edgeAngleToZoom, MapLocation } from '../types';
import { MAP_BRUSH_GROUPS } from '../utils/mapMetadata';
import { 
  Sliders, Globe, Upload, Moon, Sun,
  Paintbrush, Eraser, Pipette, Trash2, 
  Palette, RefreshCw, FileText, Download, Play,
  Undo2, Redo2, Database, MapPin, Image,
  Loader2, Search, Flag, Plus, X, Settings,
  Compass, Eye, Maximize, Waves
} from 'lucide-react';
import FlagImage from './FlagImage';
import { getMapAssetJson, getAvailableMaps, getAvailableBackgrounds } from '../utils/mapAssets';
import { extractFeaturesFromTopoJSON, detectMapHierarchy, getCountryId, parseAnyMapData } from '../utils/geoUtils';

function PointSymbolPreview({ shape, color, size = 14 }: { shape: string; color?: string; size?: number }) {
  const s = shape || 'red_circle';
  const fill = color || (
    s === 'black_dot' || s === 'dot' ? '#000000' :
    s.includes('white') ? '#ffffff' :
    s.includes('blue') ? '#3b82f6' :
    s.includes('green') ? '#22c55e' :
    s.includes('yellow') ? '#eab308' :
    s.includes('purple') ? '#a855f7' : '#ef4444'
  );

  if (s === 'black_dot' || s === 'dot') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" className="shrink-0 overflow-visible inline-block align-middle">
        <circle cx="8" cy="8" r="5" fill={fill} stroke="#000000" strokeWidth="1.2" />
      </svg>
    );
  }
  if (s === 'triangle') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" className="shrink-0 overflow-visible inline-block align-middle">
        <polygon points="8,1.5 14.5,14 1.5,14" fill={fill} stroke="#000000" strokeWidth="1.2" />
      </svg>
    );
  }
  if (s === 'diamond') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" className="shrink-0 overflow-visible inline-block align-middle">
        <polygon points="8,1 15,8 8,15 1,8" fill={fill} stroke="#000000" strokeWidth="1.2" />
      </svg>
    );
  }
  if (s === 'star') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" className="shrink-0 overflow-visible inline-block align-middle">
        <polygon points="8,1 10,6 15.5,6 11,9.5 12.5,15 8,12 3.5,15 5,9.5 0.5,6 6,6" fill={fill} stroke="#000000" strokeWidth="1.2" />
      </svg>
    );
  }
  if (s === 'pin') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" className="shrink-0 overflow-visible inline-block align-middle">
        <path d="M8 1C5.2 1 3 3.2 3 6c0 4 5 9 5 9s5-5 5-9c0-2.8-2.2-5-5-5z" fill={fill} stroke="#000000" strokeWidth="1.2" />
        <circle cx="8" cy="6" r="2" fill="#ffffff" />
      </svg>
    );
  }
  if (s === 'cross') {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" className="shrink-0 overflow-visible inline-block align-middle">
        <path d="M6 1h4v5h5v4h-5v5h-4v-5h-5v-4h5z" fill={fill} stroke="#000000" strokeWidth="1.2" />
      </svg>
    );
  }
  if (s.includes('square')) {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" className="shrink-0 overflow-visible inline-block align-middle">
        <rect x="2" y="2" width="12" height="12" fill={fill} stroke="#000000" strokeWidth="1.2" />
      </svg>
    );
  }
  // Default circle / white_circle / red_circle
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className="shrink-0 overflow-visible inline-block align-middle">
      <circle cx="8" cy="8" r="6" fill={fill} stroke="#000000" strokeWidth="1.2" />
    </svg>
  );
}

interface SidebarProps {
  config: MapConfig;
  features: CountryFeature[];
  onSelectCountry: (feature: CountryFeature | null) => void;
  onUpdateConfig: (updater: (prev: MapConfig) => MapConfig) => void;
  onUploadGeoJSON: (collection: any, fileName: string) => void;
  currentFileName: string;

  // Painting states
  customColors: Record<string, string>;
  setCustomColors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  paintColor: string;
  setPaintColor: (color: string) => void;
  activeTool: 'paint' | 'eraser' | 'picker';
  setActiveTool: (tool: 'paint' | 'eraser' | 'picker') => void;
  legendLabels: Record<string, string>;
  setLegendLabels: React.Dispatch<React.SetStateAction<Record<string, string>>>;

  // History system props for Sidebar
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClearAll?: () => void;

  // Dynamic Map Selector props
  selectedMapFile?: string;
  onSelectMapFile?: (fileName: string) => void;

  // New countryMetadataMap
  countryMetadataMap?: Record<string, {
    continent?: string;
    income_grp?: string;
    pop_est?: number;
    gdp_md_est?: number;
    name?: string;
  }>;

  // Mode select
  brushScope?: string;
  setBrushScope?: (val: string) => void;

  // Selection & Renaming props
  selectedBorderCountryIds?: string[];
  setSelectedBorderCountryIds?: React.Dispatch<React.SetStateAction<string[]>>;
  onRenamePolygons?: (ids: string[], newName: string) => void;
  customBorderSettings?: {
    style: 'solid' | 'dashed';
    dashLength: number;
    gapLength: number;
    borderSelectionMode: BorderSelectionMode;
    color: string;
    width: number;
  };
  setCustomBorderSettings?: React.Dispatch<React.SetStateAction<{
    style: 'solid' | 'dashed';
    dashLength: number;
    gapLength: number;
    borderSelectionMode: BorderSelectionMode;
    color: string;
    width: number;
  }>>;
  appliedCustomBorders?: AppliedCustomBorder[];
  setAppliedCustomBorders?: (
    value: AppliedCustomBorder[] | ((prev: AppliedCustomBorder[]) => AppliedCustomBorder[])
  ) => void;
  viewport?: { zoom: number; pan: { x: number; y: number } };
  setViewport?: React.Dispatch<React.SetStateAction<{ zoom: number; pan: { x: number; y: number } }>>;
  customBgFile?: File | null;
  setCustomBgFile?: (file: File | null) => void;
  bgLoading?: boolean;
  bgError?: string | null;

  // Locations System Props
  importedLocations: MapLocation[];
  setImportedLocations: React.Dispatch<React.SetStateAction<MapLocation[]>>;
  showLocations: boolean;
  setShowLocations: (val: boolean) => void;
  showLocationLabels: boolean;
  setShowLocationLabels: (val: boolean) => void;
  admin0Shape: string;
  setAdmin0Shape: (val: string) => void;
  admin0Color?: string;
  setAdmin0Color?: (val: string) => void;
  admin0Size: number;
  setAdmin0Size: (val: number) => void;
  admin1Shape: string;
  setAdmin1Shape: (val: string) => void;
  admin1Color?: string;
  setAdmin1Color?: (val: string) => void;
  admin1Size: number;
  setAdmin1Size: (val: number) => void;
  popUnder50kShape: string;
  setPopUnder50kShape: (val: string) => void;
  popUnder50kColor?: string;
  setPopUnder50kColor?: (val: string) => void;
  popUnder50kSize: number;
  setPopUnder50kSize: (val: number) => void;
  pop50kTo100kShape: string;
  setPop50kTo100kShape: (val: string) => void;
  pop50kTo100kColor?: string;
  setPop50kTo100kColor?: (val: string) => void;
  pop50kTo100kSize: number;
  setPop50kTo100kSize: (val: number) => void;
  pop100kTo1MShape: string;
  setPop100kTo1MShape: (val: string) => void;
  pop100kTo1MColor?: string;
  setPop100kTo1MColor?: (val: string) => void;
  pop100kTo1MSize: number;
  setPop100kTo1MSize: (val: number) => void;
  pop1MTo10MShape: string;
  setPop1MTo10MShape: (val: string) => void;
  pop1MTo10MColor?: string;
  setPop1MTo10MColor?: (val: string) => void;
  pop1MTo10MSize: number;
  setPop1MTo10MSize: (val: number) => void;
  popAbove10MShape: string;
  setPopAbove10MShape: (val: string) => void;
  popAbove10MColor?: string;
  setPopAbove10MColor?: (val: string) => void;
  popAbove10MSize: number;
  setPopAbove10MSize: (val: number) => void;
  locationLabelSize: number;
  locationLabelOutlineRatio: number;
  setLocationLabelOutlineRatio: (val: number) => void;
  setLocationLabelSize: (val: number) => void;
  stylizeAdmin1: boolean;
  setStylizeAdmin1: (val: boolean) => void;
  onExportPNG?: (scale?: number) => void;
  onExportTopoJSON?: () => void;
  onImportTopoJSON?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  
}

const PRESET_PALETTES = {
  vibrant: [
    '#ef4444', // Red
    '#3b82f6', // Blue
    '#22c55e', // Green
    '#eab308', // Yellow
    '#a855f7', // Purple
    '#f97316', // Orange
    '#14b8a6', // Teal
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#84cc16', // Lime
    '#10b981', // Emerald
    '#6366f1', // Indigo
  ],
  pastels: [
    '#fca5a5', // Soft Red
    '#93c5fd', // Soft Blue
    '#86efac', // Soft Green
    '#fef08a', // Soft Yellow
    '#c084fc', // Soft Purple
    '#fdba74', // Soft Orange
    '#99f6e4', // Soft Teal
    '#fbcfe8', // Soft Pink
    '#67e8f9', // Soft Cyan
    '#bef264', // Soft Lime
    '#a7f3d0', // Soft Emerald
    '#c7d2fe', // Soft Indigo
  ],
  vintage: [
    '#b91c1c', // Deep Dark Red
    '#1d4ed8', // Deep Navy
    '#15803d', // Forest Green
    '#a16207', // Gold/Ochre
    '#6b21a8', // Rich Purple
    '#c2410c', // Terracotta
    '#0f766e', // Deep Teal
    '#be185d', // Deep Violet Red
    '#0369a1', // Steel Blue
    '#4d7c0f', // Olive
    '#047857', // Pine Green
    '#4338ca', // Royal Indigo
  ]
};

const FLAG_COUNTRIES = [
  { code: 'af', name: 'Afghanistan' },
  { code: 'ao', name: 'Angola' },
  { code: 'al', name: 'Albania' },
  { code: 'ad', name: 'Andorra' },
  { code: 'ae', name: 'United Arab Emirates' },
  { code: 'ar', name: 'Argentina' },
  { code: 'am', name: 'Armenia' },
  { code: 'as', name: 'American Samoa' },
  { code: 'aq', name: 'Antarctica' },
  { code: 'ag', name: 'Antigua and Barbuda' },
  { code: 'au', name: 'Australia' },
  { code: 'at', name: 'Austria' },
  { code: 'az', name: 'Azerbaijan' },
  { code: 'bi', name: 'Burundi' },
  { code: 'be', name: 'Belgium' },
  { code: 'bf', name: 'Burkina Faso' },
  { code: 'bd', name: 'Bangladesh' },
  { code: 'bg', name: 'Bulgaria' },
  { code: 'bh', name: 'Bahrain' },
  { code: 'bs', name: 'Bahamas' },
  { code: 'ba', name: 'Bosnia and Herzegovina' },
  { code: 'by', name: 'Belarus' },
  { code: 'bz', name: 'Belize' },
  { code: 'bm', name: 'Bermuda' },
  { code: 'bo', name: 'Bolivia' },
  { code: 'br', name: 'Brazil' },
  { code: 'bb', name: 'Barbados' },
  { code: 'bn', name: 'Brunei' },
  { code: 'bt', name: 'Bhutan' },
  { code: 'bw', name: 'Botswana' },
  { code: 'cf', name: 'Central African Republic' },
  { code: 'ca', name: 'Canada' },
  { code: 'ch', name: 'Switzerland' },
  { code: 'cl', name: 'Chile' },
  { code: 'cn', name: 'China' },
  { code: 'ci', name: 'Ivory Coast' },
  { code: 'cm', name: 'Cameroon' },
  { code: 'cd', name: 'Congo (DRC)' },
  { code: 'cg', name: 'Congo (Republic)' },
  { code: 'co', name: 'Colombia' },
  { code: 'km', name: 'Comoros' },
  { code: 'cv', name: 'Cape Verde' },
  { code: 'cr', name: 'Costa Rica' },
  { code: 'cu', name: 'Cuba' },
  { code: 'cw', name: 'Curaçao' },
  { code: 'ky', name: 'Cayman Islands' },
  { code: 'cy', name: 'Cyprus' },
  { code: 'cz', name: 'Czechia' },
  { code: 'de', name: 'Germany' },
  { code: 'dj', name: 'Djibouti' },
  { code: 'dm', name: 'Dominica' },
  { code: 'dk', name: 'Denmark' },
  { code: 'do', name: 'Dominican Republic' },
  { code: 'dz', name: 'Algeria' },
  { code: 'ec', name: 'Ecuador' },
  { code: 'eg', name: 'Egypt' },
  { code: 'er', name: 'Eritrea' },
  { code: 'es', name: 'Spain' },
  { code: 'ee', name: 'Estonia' },
  { code: 'et', name: 'Ethiopia' },
  { code: 'fi', name: 'Finland' },
  { code: 'fj', name: 'Fiji' },
  { code: 'fk', name: 'Falkland Islands' },
  { code: 'fr', name: 'France' },
  { code: 'fo', name: 'Faroe Islands' },
  { code: 'fm', name: 'Micronesia' },
  { code: 'ga', name: 'Gabon' },
  { code: 'gb', name: 'United Kingdom' },
  { code: 'ge', name: 'Georgia' },
  { code: 'gh', name: 'Ghana' },
  { code: 'gi', name: 'Gibraltar' },
  { code: 'gn', name: 'Guinea' },
  { code: 'gp', name: 'Guadeloupe' },
  { code: 'gm', name: 'Gambia' },
  { code: 'gw', name: 'Guinea-Bissau' },
  { code: 'gq', name: 'Equatorial Guinea' },
  { code: 'gr', name: 'Greece' },
  { code: 'gd', name: 'Grenada' },
  { code: 'gl', name: 'Greenland' },
  { code: 'gt', name: 'Guatemala' },
  { code: 'gf', name: 'French Guiana' },
  { code: 'gu', name: 'Guam' },
  { code: 'gy', name: 'Guyana' },
  { code: 'hk', name: 'Hong Kong' },
  { code: 'hn', name: 'Honduras' },
  { code: 'hr', name: 'Croatia' },
  { code: 'ht', name: 'Haiti' },
  { code: 'hu', name: 'Hungary' },
  { code: 'id', name: 'Indonesia' },
  { code: 'im', name: 'Isle of Man' },
  { code: 'in', name: 'India' },
  { code: 'ie', name: 'Ireland' },
  { code: 'ir', name: 'Iran' },
  { code: 'iq', name: 'Iraq' },
  { code: 'is', name: 'Iceland' },
  { code: 'il', name: 'Israel' },
  { code: 'it', name: 'Italy' },
  { code: 'jm', name: 'Jamaica' },
  { code: 'je', name: 'Jersey' },
  { code: 'jo', name: 'Jordan' },
  { code: 'jp', name: 'Japan' },
  { code: 'kz', name: 'Kazakhstan' },
  { code: 'ke', name: 'Kenya' },
  { code: 'kg', name: 'Kyrgyzstan' },
  { code: 'kh', name: 'Cambodia' },
  { code: 'ki', name: 'Kiribati' },
  { code: 'kn', name: 'Saint Kitts and Nevis' },
  { code: 'kr', name: 'South Korea' },
  { code: 'kw', name: 'Kuwait' },
  { code: 'la', name: 'Laos' },
  { code: 'lb', name: 'Lebanon' },
  { code: 'lr', name: 'Liberia' },
  { code: 'ly', name: 'Libya' },
  { code: 'lc', name: 'Saint Lucia' },
  { code: 'li', name: 'Liechtenstein' },
  { code: 'lk', name: 'Sri Lanka' },
  { code: 'ls', name: 'Lesotho' },
  { code: 'lt', name: 'Lithuania' },
  { code: 'lu', name: 'Luxembourg' },
  { code: 'lv', name: 'Latvia' },
  { code: 'mo', name: 'Macau' },
  { code: 'ma', name: 'Morocco' },
  { code: 'mc', name: 'Monaco' },
  { code: 'md', name: 'Moldova' },
  { code: 'mg', name: 'Madagascar' },
  { code: 'mv', name: 'Maldives' },
  { code: 'mx', name: 'Mexico' },
  { code: 'mh', name: 'Marshall Islands' },
  { code: 'mk', name: 'North Macedonia' },
  { code: 'ml', name: 'Mali' },
  { code: 'mt', name: 'Malta' },
  { code: 'mm', name: 'Myanmar' },
  { code: 'me', name: 'Montenegro' },
  { code: 'mn', name: 'Mongolia' },
  { code: 'mz', name: 'Mozambique' },
  { code: 'mr', name: 'Mauritania' },
  { code: 'mu', name: 'Mauritius' },
  { code: 'mw', name: 'Malawi' },
  { code: 'my', name: 'Malaysia' },
  { code: 'na', name: 'Namibia' },
  { code: 'nc', name: 'New Caledonia' },
  { code: 'ne', name: 'Niger' },
  { code: 'ng', name: 'Nigeria' },
  { code: 'ni', name: 'Nicaragua' },
  { code: 'nl', name: 'Netherlands' },
  { code: 'no', name: 'Norway' },
  { code: 'np', name: 'Nepal' },
  { code: 'nz', name: 'New Zealand' },
  { code: 'om', name: 'Oman' },
  { code: 'pk', name: 'Pakistan' },
  { code: 'pa', name: 'Panama' },
  { code: 'pe', name: 'Peru' },
  { code: 'ph', name: 'Philippines' },
  { code: 'pw', name: 'Palau' },
  { code: 'pg', name: 'Papua New Guinea' },
  { code: 'pl', name: 'Poland' },
  { code: 'pr', name: 'Puerto Rico' },
  { code: 'kp', name: 'North Korea' },
  { code: 'pt', name: 'Portugal' },
  { code: 'py', name: 'Paraguay' },
  { code: 'ps', name: 'Palestine' },
  { code: 'pf', name: 'French Polynesia' },
  { code: 'qa', name: 'Qatar' },
  { code: 'ro', name: 'Romania' },
  { code: 'ru', name: 'Russia' },
  { code: 'rw', name: 'Rwanda' },
  { code: 'sa', name: 'Saudi Arabia' },
  { code: 'sd', name: 'Sudan' },
  { code: 'sn', name: 'Senegal' },
  { code: 'sg', name: 'Singapore' },
  { code: 'sb', name: 'Solomon Islands' },
  { code: 'sl', name: 'Sierra Leone' },
  { code: 'sv', name: 'El Salvador' },
  { code: 'sm', name: 'San Marino' },
  { code: 'so', name: 'Somalia' },
  { code: 'rs', name: 'Serbia' },
  { code: 'ss', name: 'South Sudan' },
  { code: 'st', name: 'São Tomé and Príncipe' },
  { code: 'sr', name: 'Suriname' },
  { code: 'sk', name: 'Slovakia' },
  { code: 'si', name: 'Slovenia' },
  { code: 'se', name: 'Sweden' },
  { code: 'sz', name: 'Eswatini' },
  { code: 'sc', name: 'Seychelles' },
  { code: 'sy', name: 'Syria' },
  { code: 'td', name: 'Chad' },
  { code: 'tg', name: 'Togo' },
  { code: 'th', name: 'Thailand' },
  { code: 'tj', name: 'Tajikistan' },
  { code: 'tm', name: 'Turkmenistan' },
  { code: 'tl', name: 'Timor-Leste' },
  { code: 'to', name: 'Tonga' },
  { code: 'tt', name: 'Trinidad and Tobago' },
  { code: 'tn', name: 'Tunisia' },
  { code: 'tr', name: 'Turkey' },
  { code: 'tv', name: 'Tuvalu' },
  { code: 'tw', name: 'Taiwan' },
  { code: 'tz', name: 'Tanzania' },
  { code: 'ug', name: 'Uganda' },
  { code: 'ua', name: 'Ukraine' },
  { code: 'uy', name: 'Uruguay' },
  { code: 'us', name: 'United States' },
  { code: 'uz', name: 'Uzbekistan' },
  { code: 'va', name: 'Vatican City' },
  { code: 'vc', name: 'Saint Vincent and the Grenadines' },
  { code: 've', name: 'Venezuela' },
  { code: 'vn', name: 'Vietnam' },
  { code: 'vu', name: 'Vanuatu' },
  { code: 'ws', name: 'Samoa' },
  { code: 'ye', name: 'Yemen' },
  { code: 'za', name: 'South Africa' },
  { code: 'zm', name: 'Zambia' },
  { code: 'zw', name: 'Zimbabwe' },
];

const Sidebar = React.memo(function Sidebar({
  config,
  features,
  onSelectCountry,
  onUpdateConfig,
  onUploadGeoJSON,
  currentFileName,
  customColors,
  setCustomColors,
  paintColor,
  setPaintColor,
  activeTool,
  setActiveTool,
  legendLabels,
  setLegendLabels,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClearAll,
  selectedMapFile,
  onSelectMapFile,
  countryMetadataMap,
  brushScope = 'single',
  setBrushScope,
  selectedBorderCountryIds = [],
  setSelectedBorderCountryIds,
  onRenamePolygons,
  customBorderSettings = { style: 'solid', dashLength: 6, gapLength: 4, borderSelectionMode: 'both', color: '#ff0000', width: 0.4 },
  setCustomBorderSettings,
  appliedCustomBorders = [],
  setAppliedCustomBorders,
  viewport,
  setViewport,
  customBgFile,
  setCustomBgFile,
  bgLoading,
  bgError,
  importedLocations,
  setImportedLocations,
  showLocations,
  setShowLocations,
  showLocationLabels,
  setShowLocationLabels,
  admin0Shape,
  setAdmin0Shape,
  admin0Color,
  setAdmin0Color,
  admin0Size,
  setAdmin0Size,
  admin1Shape,
  setAdmin1Shape,
  admin1Color,
  setAdmin1Color,
  admin1Size,
  setAdmin1Size,
  popUnder50kShape,
  setPopUnder50kShape,
  popUnder50kColor,
  setPopUnder50kColor,
  popUnder50kSize,
  setPopUnder50kSize,
  pop50kTo100kShape,
  setPop50kTo100kShape,
  pop50kTo100kColor,
  setPop50kTo100kColor,
  pop50kTo100kSize,
  setPop50kTo100kSize,
  pop100kTo1MShape,
  setPop100kTo1MShape,
  pop100kTo1MColor,
  setPop100kTo1MColor,
  pop100kTo1MSize,
  setPop100kTo1MSize,
  pop1MTo10MShape,
  setPop1MTo10MShape,
  pop1MTo10MColor,
  setPop1MTo10MColor,
  pop1MTo10MSize,
  setPop1MTo10MSize,
  popAbove10MShape,
  setPopAbove10MShape,
  popAbove10MColor,
  setPopAbove10MColor,
  popAbove10MSize,
  setPopAbove10MSize,
  locationLabelSize,
  setLocationLabelSize,
  locationLabelOutlineRatio,
  setLocationLabelOutlineRatio,
  stylizeAdmin1,
  setStylizeAdmin1,
  onExportPNG,
  onExportTopoJSON,
  onImportTopoJSON,
  
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<'controls' | 'paint' | 'locations' | 'background' | 'view' | 'export'>('paint');
  const [exportScaleMultiplier, setExportScaleMultiplier] = useState<number>(4);
  const [renameSingleValue, setRenameSingleValue] = useState<string>('');
  const [renameBulkValue, setRenameBulkValue] = useState<string>('');

  // Local buffered states for Central Meridian, Parallel, Aspect, and Edge Angle inputs so projection only computes on Enter / blur
  const [tempLon, setTempLon] = useState<string>(String(config.centerLon ?? 0));
  const [tempLat, setTempLat] = useState<string>(String(config.centerLat ?? 0));
  const [tempAspect, setTempAspect] = useState<string>(String(config.aspect ?? 0));
  const [tempEdgeAngle, setTempEdgeAngle] = useState<string>(String(config.edgeAngle ?? 90));

  useEffect(() => {
    setTempLon(String(config.centerLon ?? 0));
  }, [config.centerLon]);

  useEffect(() => {
    setTempLat(String(config.centerLat ?? 0));
  }, [config.centerLat]);

  useEffect(() => {
    setTempAspect(String(config.aspect ?? 0));
  }, [config.aspect]);

  useEffect(() => {
    setTempEdgeAngle(String(config.edgeAngle ?? 90));
  }, [config.edgeAngle]);

  const prevSingleSelectedIdRef = useRef<string | null>(null);
  const currentSingleId = selectedBorderCountryIds.length === 1 ? selectedBorderCountryIds[0] : null;
  if (currentSingleId !== prevSingleSelectedIdRef.current) {
    prevSingleSelectedIdRef.current = currentSingleId;
    if (currentSingleId) {
      const targetFeat = features.find(f => getCountryId(f) === currentSingleId);
      const p = targetFeat?.properties as any;
      setRenameSingleValue(p?.name || p?.NAME || p?.name_long || p?.NAME_LONG || p?.name_en || p?.admin || p?.ADMIN || '');
    } else {
      setRenameSingleValue('');
    }
  }
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [paletteTheme, setPaletteTheme] = useState<'vibrant' | 'pastels' | 'vintage'>('vibrant');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgImageInputRef = useRef<HTMLInputElement>(null);
  const [activeColorTarget, setActiveColorTarget] = useState<'base' | 'pattern'>('pattern');
  const [flagSearch, setFlagSearch] = useState('');

  // Custom SVG Flag Upload states
  const [customSvgFlags, setCustomSvgFlags] = useState<{ id: string; name: string; url: string }[]>([]);
  const customFlagInputRef = useRef<HTMLInputElement>(null);

  const detectedHierarchy = React.useMemo(() => detectMapHierarchy(features, selectedMapFile), [features, selectedMapFile]);

  const handleCustomFlagUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.svg') && file.type !== 'image/svg+xml') {
      setErrorMsg('Please upload a valid .svg vector flag file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        const flagId = `custom_flag_${Date.now()}`;
        const flagName = file.name.replace(/\.svg$/i, '');
        const newFlag = { id: flagId, name: flagName, url: result };
        setCustomSvgFlags((prev) => [newFlag, ...prev]);
        setPaintColor(`flag:${result}`);
        setActiveTool('paint');
        setErrorMsg(null);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Wikimedia Commons SVG Flag Search states
  const [wikiFlagQuery, setWikiFlagQuery] = useState('');
  const [wikiFlagResults, setWikiFlagResults] = useState<{ title: string; url: string; thumbUrl?: string }[]>([]);
  const [wikiSearching, setWikiSearching] = useState(false);
  const [wikiSearchError, setWikiSearchError] = useState<string | null>(null);
  const [wikiHasSearched, setWikiHasSearched] = useState(false);

  const handleWikiFlagSearch = async (queryText?: string) => {
    const q = (queryText !== undefined ? queryText : wikiFlagQuery).trim();
    if (!q) return;

    setWikiSearching(true);
    setWikiSearchError(null);
    setWikiHasSearched(true);

    try {
      const searchQuery = q.toLowerCase().includes('flag') ? `${q} filetype:svg` : `Flag of ${q} filetype:svg`;
      const params = new URLSearchParams({
        action: 'query',
        generator: 'search',
        gsrsearch: searchQuery,
        gsrnamespace: '6',
        gsrlimit: '20',
        prop: 'imageinfo',
        iiprop: 'url|mime',
        format: 'json',
        origin: '*',
      });

      const resp = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`);
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const data = await resp.json();
      const pages = data?.query?.pages;
      if (!pages) {
        setWikiFlagResults([]);
        setWikiSearching(false);
        return;
      }

      const results: { title: string; url: string; thumbUrl?: string }[] = [];
      Object.values(pages).forEach((page: any) => {
        const title = page.title || '';
        const imgInfo = page.imageinfo?.[0];
        if (imgInfo && imgInfo.url) {
          const url = imgInfo.url;
          if (url.toLowerCase().endsWith('.svg') || title.toLowerCase().endsWith('.svg') || imgInfo.mime === 'image/svg+xml') {
            const cleanTitle = title
              .replace(/^File:/i, '')
              .replace(/\.svg$/i, '')
              .replace(/_/g, ' ');

            results.push({
              title: cleanTitle,
              url: url,
              thumbUrl: url,
            });
          }
        }
      });

      setWikiFlagResults(results);
    } catch (err: any) {
      console.error('Wikimedia search error:', err);
      setWikiSearchError('Failed to search Wikimedia Commons.');
    } finally {
      setWikiSearching(false);
    }
  };

  // Location import local settings
  const [importGroupName, setImportGroupName] = useState<string>('Imported Locations');
  const [importSymbolShape, setImportSymbolShape] = useState<string>('black_dot');
  const [importSymbolColor, setImportSymbolColor] = useState<string>('#059669');
  const [importSymbolSize, setImportSymbolSize] = useState<number>(2);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  const [importPopRange, setImportPopRange] = useState<string>('all');
  const [importClasses, setImportClasses] = useState({
    admin0: false,
    admin1: false,
  });
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Add / Remove custom location points state
  const [newPointName, setNewPointName] = useState('');
  const [newPointLat, setNewPointLat] = useState('');
  const [newPointLon, setNewPointLon] = useState('');
  const [newPointClass, setNewPointClass] = useState<'populated' | 'admin0' | 'admin1'>('populated');
  const [newPointShape, setNewPointShape] = useState<string>('red_circle');
  const [newPointColor, setNewPointColor] = useState<string>('#ef4444');
  const [newPointSize, setNewPointSize] = useState<number>(2);
  const [editingPointId, setEditingPointId] = useState<string | null>(null);
  const [pointSearchQuery, setPointSearchQuery] = useState('');

  const handleUpdateGroupStyle = (
    targetGroup: string,
    updates: { groupName?: string; symbolShape?: string; symbolColor?: string; symbolSize?: number }
  ) => {
    setImportedLocations(prev => prev.map(p => {
      const currentGroup = p.group || (p.isCustom ? 'Custom Points' : 'Imported Locations');
      if (currentGroup === targetGroup) {
        return {
          ...p,
          group: updates.groupName !== undefined && updates.groupName.trim() ? updates.groupName.trim() : p.group,
          symbolShape: updates.symbolShape !== undefined ? updates.symbolShape : p.symbolShape,
          symbolColor: updates.symbolColor !== undefined ? updates.symbolColor : p.symbolColor,
          symbolSize: updates.symbolSize !== undefined ? updates.symbolSize : p.symbolSize,
        };
      }
      return p;
    }));
  };

  const handleRemoveGroup = (targetGroup: string) => {
    setImportedLocations(prev => prev.filter(p => {
      const currentGroup = p.group || (p.isCustom ? 'Custom Points' : 'Imported Locations');
      return currentGroup !== targetGroup;
    }));
  };

  const handleAddCustomPoint = () => {
    if (!newPointName.trim()) return;
    const lat = parseFloat(newPointLat);
    const lon = parseFloat(newPointLon);
    if (isNaN(lat) || isNaN(lon)) return;

    const newPoint: MapLocation = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: newPointName.trim(),
      latitude: lat,
      longitude: lon,
      popMax: 500000,
      featureClass: 'Custom Point',
      classType: newPointClass,
      isCustom: true,
      symbolShape: newPointShape,
      symbolColor: newPointColor,
      symbolSize: Number(newPointSize) || 2,
      group: 'Custom Points',
    };

    setImportedLocations(prev => [newPoint, ...prev]);
    setNewPointName('');
    setNewPointLat('');
    setNewPointLon('');
  };

  const handleRemovePoint = (id: string) => {
    setImportedLocations(prev => prev.filter(p => p.id !== id));
  };

  const handleUpdatePointStyle = (id: string, updates: Partial<MapLocation>) => {
    setImportedLocations(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const handleImportLocations = async () => {
    setIsImporting(true);
    setImportStatus("Loading...");
    try {
      setImportStatus("Fetching from repository...");
      const topology = await getMapAssetJson('locations/populated_places.json');
      setImportStatus("Parsing...");
      
      const firstKey = Object.keys(topology.objects)[0];
      if (!firstKey) {
        throw new Error("Invalid TopoJSON format: objects key is missing.");
      }
      
      setImportStatus("Filtering points...");
      const geojson: any = topojson.feature(topology, topology.objects[firstKey]);
      const featuresList = geojson.features || [];
      
      const filtered: MapLocation[] = [];
      featuresList.forEach((f: any, idx: number) => {
        const props = f.properties || {};
        const coords = f.geometry?.coordinates || [0, 0];
        const pop = Number(props.POP_MAX || props.pop_max || 0);
        const featClass = props.FEATURECLA || props.featurecla || '';
        
        // Filter by population count range
        let matchesPop = false;
        if (importPopRange === 'all') {
          matchesPop = true;
        } else if (importPopRange === 'above50k' && pop >= 50000) {
          matchesPop = true;
        } else if (importPopRange === 'above100k' && pop >= 100000) {
          matchesPop = true;
        } else if (importPopRange === 'above1M' && pop >= 1000000) {
          matchesPop = true;
        } else if (importPopRange === 'above10M' && pop >= 10000000) {
          matchesPop = true;
        }
        
        if (!matchesPop) {
          return;
        }
        
        // Filter by feature class groupings
        const isCapitalAdmin0 = featClass.includes('Admin-0 capital');
        const isCapitalAdmin1 = featClass.includes('Admin-1 capital') || featClass.includes('Admin-1 region capital');
        const isPopulatedPlace = featClass.includes('Populated place') || (!isCapitalAdmin0 && !isCapitalAdmin1);
        
        const noneChecked = !importClasses.admin0 && !importClasses.admin1;
        if (!noneChecked) {
          if (isCapitalAdmin0 && !importClasses.admin0) return;
          if (isCapitalAdmin1 && !importClasses.admin1) return;
          if (isPopulatedPlace) return;
        }
        
        const popMinThreshold =
          importPopRange === 'above50k' ? 50000 :
          importPopRange === 'above100k' ? 100000 :
          importPopRange === 'above1M' ? 1000000 :
          importPopRange === 'above10M' ? 10000000 : undefined;

        const defaultBase = isCapitalAdmin0 ? 'National Capitals' : (isCapitalAdmin1 ? 'State Capitals' : 'Populated Places');
        const isCustomGroup = importGroupName && importGroupName.trim() !== '' && importGroupName.trim() !== 'Imported Locations';
        const groupName = isCustomGroup
          ? importGroupName.trim()
          : (popMinThreshold ? `${defaultBase} [${popMinThreshold}]` : defaultBase);
        
        filtered.push({
          id: props.GEONAMESID || props.geonamesid || `loc-${idx}`,
          name: props.NAME || props.name || 'Unknown Location',
          latitude: coords[1],
          longitude: coords[0],
          popMax: pop,
          featureClass: featClass,
          countryName: props.ADM0NAME || props.adm0name || props.COUNTRY || '',
          classType: isCapitalAdmin0 ? 'admin0' : (isCapitalAdmin1 ? 'admin1' : 'populated'),
          group: groupName,
          popMinThreshold,
          symbolShape: importSymbolShape,
          symbolColor: importSymbolColor,
          symbolSize: Number(importSymbolSize) || 2,
        });
      });
      
      // Preserve other location groups when re-importing locations
      setImportedLocations(prev => {
        const isCapitalAdmin0 = importClasses.admin0 && !importClasses.admin1;
        const isCapitalAdmin1 = importClasses.admin1 && !importClasses.admin0;
        const defaultBase = isCapitalAdmin0 ? 'National Capitals' : (isCapitalAdmin1 ? 'State Capitals' : 'Populated Places');
        const popMinThreshold =
          importPopRange === 'above50k' ? 50000 :
          importPopRange === 'above100k' ? 100000 :
          importPopRange === 'above1M' ? 1000000 :
          importPopRange === 'above10M' ? 10000000 : undefined;
        const isCustomGroup = importGroupName && importGroupName.trim() !== '' && importGroupName.trim() !== 'Imported Locations';
        const targetGroup = isCustomGroup
          ? importGroupName.trim()
          : (popMinThreshold ? `${defaultBase} [${popMinThreshold}]` : defaultBase);

        const remaining = prev.filter(p => {
          const pGroup = p.group || (p.isCustom ? 'Custom Points' : 'Imported Locations');
          return pGroup !== targetGroup;
        });
        return [...remaining, ...filtered];
      });
      setErrorMsg(null);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to load locations.");
    } finally {
      setIsImporting(false);
      setImportStatus(null);
    }
  };

  // Dynamically compute available hierarchies based on current rendered map
  const availableHierarchies = React.useMemo(() => {
    if (!features || features.length === 0 || features.length > 2000) return [];

    const metaGroups = selectedMapFile ? MAP_BRUSH_GROUPS[selectedMapFile] : undefined;

    if (metaGroups) {
      // Use the defined metadata file fields with fast direct property lookup
      const options: { key: string; label: string; uniqueCount: number }[] = [];

      metaGroups.forEach((group) => {
        const valSet = new Set<any>();
        const gKey = group.key;
        const gKeyLower = gKey.toLowerCase();
        const gKeyUpper = gKey.toUpperCase();

        for (let i = 0; i < features.length; i++) {
          const props: any = features[i]?.properties;
          if (!props) continue;
          const val = props[gKey] !== undefined ? props[gKey] : (props[gKeyUpper] !== undefined ? props[gKeyUpper] : props[gKeyLower]);
          if (val !== undefined && val !== null && typeof val !== 'object') {
            valSet.add(val);
          }
        }

        const uniqueCount = valSet.size;
        options.push({ key: group.key, label: group.label, uniqueCount });
      });

      return options;
    } else {
      // Fallback dynamic computation for custom files (sampled if large)
      const sampleSize = Math.min(features.length, 500);
      const totalFeatures = sampleSize;
      const keyStats = new Map<string, Set<any>>();

      for (let i = 0; i < sampleSize; i++) {
        const f = features[i];
        if (!f.properties) continue;
        for (const rawKey in f.properties) {
          const key = rawKey.toLowerCase();
          const val = f.properties[rawKey];
          if (val === undefined || val === null || typeof val === 'object') continue;

          if (!keyStats.has(key)) {
            keyStats.set(key, new Set());
          }
          keyStats.get(key)!.add(val);
        }
      }

      const options: { key: string; label: string; uniqueCount: number }[] = [];

      const friendlyNames: Record<string, string> = {
        adm0_a3: 'Country Code (ADM0_A3)',
        iso_a3: 'Country Code (ISO_A3)',
        admin: 'Country / Sovereignty',
        sovereignt: 'Sovereignty',
        continent: 'Continent',
        subregion: 'Subregion',
        region: 'Region',
        region_un: 'UN Region',
        income_grp: 'Income Group',
        economy: 'Economy Group',
        state: 'State',
        division: 'Division / Territory',
        region_wb: 'World Bank Region',
        type: 'Feature Type',
        status: 'Status Group',
        country: 'Country Group',
        postal: 'Postal Code Prefix',
        iso_3166_2: 'ISO Subdivision Code'
      };

      const ignoreKeys = new Set([
        'id', 'name', 'name_long', 'name_en', 'name_alt', 'name_local', 'name_sort',
        'fips', 'iso_3166_1', 'gns_id', 'wikidataid', 'wikipedia', 'iso_1', 'iso_2',
        'mapcolor7', 'mapcolor8', 'mapcolor9', 'mapcolor13', 'abbrev', 'postal', 'postal_code',
        'latitude', 'longitude', 'lat', 'lon', 'x', 'y', 'adm1_code', 'scalerank', 'labelrank',
        'gdp_md', 'gdp_md_est', 'pop_est', 'pop_year', 'gdp_year', 'area', 'perimeter', 'shape_length', 'shape_area',
        'min_zoom', 'max_zoom', 'min_label', 'max_label', 'ne_id', 'featurecla'
      ]);

      for (const [key, valSet] of keyStats.entries()) {
        if (ignoreKeys.has(key)) continue;

        const uniqueCount = valSet.size;

        if (uniqueCount > 1 && uniqueCount <= totalFeatures * 0.95) {
          let label = friendlyNames[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          options.push({ key, label, uniqueCount });
        }
      }

      const preferredOrder = ['continent', 'region_wb', 'subregion', 'region_un', 'income_grp', 'economy', 'admin', 'sovereignt', 'adm0_a3', 'iso_a3', 'state'];
      options.sort((a, b) => {
        const idxA = preferredOrder.indexOf(a.key);
        const idxB = preferredOrder.indexOf(b.key);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.uniqueCount - b.uniqueCount;
      });

      return options;
    }
  }, [features, selectedMapFile]);

  // Deduplicated and sorted country options for custom border customization (O(N) with Set)
  const borderCountryOptions = React.useMemo(() => {
    if (!features || features.length === 0) return [];
    if (features.length > 2000) {
      return [];
    }
    const seen = new Set<string>();
    const list: { id: string; name: string }[] = [];
    for (let i = 0; i < features.length; i++) {
      const f = features[i];
      const id = getCountryId(f);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const p = f.properties as any;
      const name = p?.name || p?.NAME || p?.name_long || p?.NAME_LONG || p?.name_en || p?.admin || p?.ADMIN || id;
      list.push({ id, name });
    }
    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [features]);

  const isNoGeoref = !!(selectedMapFile && selectedMapFile.includes('no_georef'));

  const displayedZoom = config.zoom * (viewport?.zoom || 1);
  const currentEdgeAngle = config.edgeAngle !== undefined ? config.edgeAngle : 90;

  const isPatternActive = paintColor.startsWith('pattern:');
  const currentPatternType = isPatternActive ? paintColor.split(':')[1] : '';

  let baseColorHex = '#ffffff';
  let patternColorHex = '#3b82f6';
  if (isPatternActive) {
    const parts = paintColor.split(':');
    if (parts.length >= 4) {
      baseColorHex = parts[2] || '#ffffff';
      patternColorHex = parts[3] || '#3b82f6';
    } else {
      patternColorHex = parts[2] || '#3b82f6';
      baseColorHex = '#ffffff';
    }
  } else {
    patternColorHex = paintColor;
  }

  const handleColorChange = (hex: string) => {
    if (isPatternActive) {
      if (activeColorTarget === 'base') {
        setPaintColor(`pattern:${currentPatternType}:${hex}:${patternColorHex}`);
      } else {
        setPaintColor(`pattern:${currentPatternType}:${baseColorHex}:${hex}`);
      }
    } else {
      setPaintColor(hex);
    }
    setActiveTool('paint');
  };

  const getFeatureProps = (f: CountryFeature) => {
    const code = (f.properties.adm0_a3 || '').toLowerCase();
    const meta = countryMetadataMap?.[code] || {};
    return {
      continent: f.properties.continent || meta.continent || '',
      income_grp: f.properties.income_grp || meta.income_grp || '',
      pop_est: f.properties.pop_est !== undefined ? Number(f.properties.pop_est) : (meta.pop_est || 0),
      gdp_md_est: f.properties.gdp_md_est !== undefined ? Number(f.properties.gdp_md_est) : (meta.gdp_md_est || 0),
      name: f.properties.name || meta.name || '',
    };
  };

  // Load custom loaded geojson/topojson file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.geojson') && !file.name.endsWith('.json') && !file.name.endsWith('.topojson')) {
      setErrorMsg('File must be a .json, .geojson, or .topojson structure.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const mapData = parseAnyMapData(parsed);

        if (mapData) {
          if (mapData.customColors && setCustomColors) {
            setCustomColors(mapData.customColors);
          }
          if (mapData.legendLabels && setLegendLabels) {
            setLegendLabels(mapData.legendLabels);
          }
          if (mapData.projection && onUpdateConfig) {
            onUpdateConfig((p) => ({ ...p, projection: mapData.projection as any }));
          }

          if (mapData.features && mapData.features.length > 0) {
            onUploadGeoJSON({
              type: 'FeatureCollection',
              features: mapData.features,
            }, file.name);
          } else if (!mapData.customColors && !mapData.legendLabels && !mapData.mapPainterSettings) {
            setErrorMsg('No valid map geometries found in uploaded file.');
          }
        } else {
          setErrorMsg('Invalid format schema. Must be GeoJSON, TopoJSON, or Map data.');
        }
      } catch (err) {
        setErrorMsg('Failed to parse file JSON contents.');
      }
    };
    reader.readAsText(file);
  };

  // Preset Template loader functions (Injecting precomputed data into Map Painter paint state)
  const applyContinentsTemplate = () => {
    const nextColors: Record<string, string> = {};
    const initializedLabels: Record<string, string> = { ...legendLabels };
    
    // Continent colors using the soft pastel group for visual elegance
    const continentColors: Record<string, string> = {
      'Asia': '#fdba74', // Soft Orange
      'Europe': '#93c5fd', // Soft Blue
      'Africa': '#fef08a', // Soft Yellow
      'North America': '#c084fc', // Soft Purple
      'South America': '#86efac', // Soft Green
      'Oceania': '#fbcfe8', // Soft Pink
      'Antarctica': '#99f6e4', // Soft Teal
    };

    features.forEach((f) => {
      const props = getFeatureProps(f);
      const cont = props.continent;
      const countryId = f.properties.adm0_a3 || f.properties.name || '';
      if (!countryId) return;

      if (cont && continentColors[cont]) {
        nextColors[countryId] = continentColors[cont];
      }
    });

    Object.entries(continentColors).forEach(([contName, colorHex]) => {
      initializedLabels[colorHex] = contName;
    });

    setCustomColors(nextColors);
    setLegendLabels(initializedLabels);
  };

  const applyIncomeTemplate = () => {
    const nextColors: Record<string, string> = {};
    const initializedLabels: Record<string, string> = { ...legendLabels };

    const incomeColors: Record<string, { color: string; label: string }> = {
      'High income': { color: '#10b981', label: 'High Income' },
      'Upper middle income': { color: '#34d399', label: 'Upper Middle Income' },
      'Lower middle income': { color: '#fbbf24', label: 'Lower Middle Income' },
      'Low income': { color: '#f87171', label: 'Low Income' },
    };

    features.forEach((f) => {
      const props = getFeatureProps(f);
      const inc = props.income_grp;
      const countryId = f.properties.adm0_a3 || f.properties.name || '';
      if (!countryId) return;

      let matchedKey = Object.keys(incomeColors).find(key => inc.toLowerCase().includes(key.toLowerCase()));
      if (matchedKey) {
        nextColors[countryId] = incomeColors[matchedKey].color;
      }
    });

    Object.values(incomeColors).forEach(({ color, label }) => {
      initializedLabels[color] = label;
    });

    setCustomColors(nextColors);
    setLegendLabels(initializedLabels);
  };

  const applyPopulationTemplate = () => {
    const nextColors: Record<string, string> = {};
    const initializedLabels: Record<string, string> = { ...legendLabels };

    const popBrackets = [
      { max: 5000000, color: '#fca5a5', label: '< 5M Population' },
      { max: 20000000, color: '#f87171', label: '5M - 20M' },
      { max: 50000000, color: '#ef4444', label: '20M - 50M' },
      { max: 100000000, color: '#dc2626', label: '50M - 100M' },
      { max: Infinity, color: '#991b1b', label: '> 100M Population' },
    ];

    features.forEach((f) => {
      const props = getFeatureProps(f);
      const pop = props.pop_est;
      const countryId = f.properties.adm0_a3 || f.properties.name || '';
      if (!countryId) return;

      if (pop > 0) {
        const bracket = popBrackets.find(b => pop < b.max);
        if (bracket) {
          nextColors[countryId] = bracket.color;
        }
      }
    });

    popBrackets.forEach(b => {
      initializedLabels[b.color] = b.label;
    });

    setCustomColors(nextColors);
    setLegendLabels(initializedLabels);
  };

  // Get unique colored entries actively paint marked in customColors
  const activeUsedColors = Array.from(new Set(Object.values(customColors)));

  const handleUpdateLegendText = (colorHex: string, text: string) => {
    const norm = colorHex.toLowerCase();
    setLegendLabels(prev => ({
      ...prev,
      [colorHex]: text,
      [norm]: text
    }));
  };

  const handleClearColorsOfThisSpec = (colorHex: string) => {
    // Paints all countries with this code to white (nullify them)
    const normTarget = colorHex.toLowerCase();
    setCustomColors(prev => {
      const next = { ...prev };
      Object.entries(next).forEach(([countryId, currentHex]) => {
        if (typeof currentHex === 'string' && currentHex.toLowerCase() === normTarget) {
          delete next[countryId];
        }
      });
      return next;
    });
  };

  // Fill all remaining blank countries on screen with current color
  const handleFillAllRemaining = () => {
    const next = { ...customColors };
    features.forEach((f) => {
      const countryId = f.properties.adm0_a3 || f.properties.name || '';
      if (!countryId) return;
      if (!next[countryId]) {
        next[countryId] = paintColor;
      }
    });
    setCustomColors(next);
  };

  return (
    <aside
      
      className={`w-full bg-[#F9F8F4] dark:bg-[#1C1C19] border-b sm:border-b-0 sm:border-r border-[#121212] dark:border-[#2C2C28] flex flex-col flex-1 min-h-0 h-full overflow-hidden select-text transition-colors duration-300`}
    >
      
      {/* Flat Editorial Sharp Tabs: Paint -> Bg -> Places -> Projection -> View -> Export */}
      <div className="grid grid-cols-6 border-b border-[#121212] dark:border-[#2C2C28] bg-[#FDFCF8] dark:bg-[#1c1c1a] shrink-0 select-none">
        <button
          onClick={() => setActiveTab('paint')}
          className={`py-2.5 px-1 flex flex-col items-center justify-center gap-1 border-b-2 cursor-pointer transition select-none ${
            activeTab === 'paint'
              ? 'border-[#121212] dark:border-[#FDFCF8] text-[#121212] dark:text-[#FDFCF8] font-bold bg-[#F9F8F4] dark:bg-[#1C1C19]'
              : 'border-transparent text-[#121212]/60 dark:text-[#FDFCF8]/60 hover:text-[#121212] dark:hover:text-[#FDFCF8]'
          }`}
        >
          <Paintbrush size={15} className="text-red-500 shrink-0" />
          <span className="text-[10px] sm:text-[11px] font-mono tracking-wider font-bold uppercase truncate max-w-full">Paint</span>
        </button>
        <button
          onClick={() => setActiveTab('background')}
          className={`py-2.5 px-1 flex flex-col items-center justify-center gap-1 border-b-2 cursor-pointer transition select-none ${
            activeTab === 'background'
              ? 'border-[#121212] dark:border-[#FDFCF8] text-[#121212] dark:text-[#FDFCF8] font-bold bg-[#F9F8F4] dark:bg-[#1C1C19]'
              : 'border-transparent text-[#121212]/60 dark:text-[#FDFCF8]/60 hover:text-[#121212] dark:hover:text-[#FDFCF8]'
          }`}
        >
          <Image size={15} className="text-blue-500 shrink-0" />
          <span className="text-[10px] sm:text-[11px] font-mono tracking-wider font-bold uppercase truncate max-w-full">Basemap</span>
        </button>
        <button
          onClick={() => setActiveTab('locations')}
          className={`py-2.5 px-1 flex flex-col items-center justify-center gap-1 border-b-2 cursor-pointer transition select-none ${
            activeTab === 'locations'
              ? 'border-[#121212] dark:border-[#FDFCF8] text-[#121212] dark:text-[#FDFCF8] font-bold bg-[#F9F8F4] dark:bg-[#1C1C19]'
              : 'border-transparent text-[#121212]/60 dark:text-[#FDFCF8]/60 hover:text-[#121212] dark:hover:text-[#FDFCF8]'
          }`}
        >
          <MapPin size={15} className="text-emerald-500 shrink-0" />
          <span className="text-[10px] sm:text-[11px] font-mono tracking-wider font-bold uppercase truncate max-w-full">Places</span>
        </button>
        <button
          onClick={() => setActiveTab('controls')}
          className={`py-2.5 px-1 flex flex-col items-center justify-center gap-1 border-b-2 cursor-pointer transition select-none ${
            activeTab === 'controls'
              ? 'border-[#121212] dark:border-[#FDFCF8] text-[#121212] dark:text-[#FDFCF8] font-bold bg-[#F9F8F4] dark:bg-[#1C1C19]'
              : 'border-transparent text-[#121212]/60 dark:text-[#FDFCF8]/60 hover:text-[#121212] dark:hover:text-[#FDFCF8]'
          }`}
        >
          <Compass size={15} className="text-[#121212] dark:text-[#FDFCF8] shrink-0" />
          <span className="text-[10px] sm:text-[11px] font-mono tracking-wider font-bold uppercase truncate max-w-full">
            <span className="inline sm:hidden">Proj</span>
            <span className="hidden sm:inline">Projection</span>
          </span>
        </button>
        <button
          onClick={() => setActiveTab('view')}
          className={`py-2.5 px-1 flex flex-col items-center justify-center gap-1 border-b-2 cursor-pointer transition select-none ${
            activeTab === 'view'
              ? 'border-[#121212] dark:border-[#FDFCF8] text-[#121212] dark:text-[#FDFCF8] font-bold bg-[#F9F8F4] dark:bg-[#1C1C19]'
              : 'border-transparent text-[#121212]/60 dark:text-[#FDFCF8]/60 hover:text-[#121212] dark:hover:text-[#FDFCF8]'
          }`}
        >
          <Eye size={15} className="text-amber-500 shrink-0" />
          <span className="text-[10px] sm:text-[11px] font-mono tracking-wider font-bold uppercase truncate max-w-full">View</span>
        </button>
        <button
          id="tab-btn-export"
          onClick={() => setActiveTab('export')}
          className={`py-2.5 px-1 flex flex-col items-center justify-center gap-1 border-b-2 cursor-pointer transition select-none ${
            activeTab === 'export'
              ? 'border-[#121212] dark:border-[#FDFCF8] text-[#121212] dark:text-[#FDFCF8] font-bold bg-[#F9F8F4] dark:bg-[#1C1C19]'
              : 'border-transparent text-[#121212]/60 dark:text-[#FDFCF8]/60 hover:text-[#121212] dark:hover:text-[#FDFCF8]'
          }`}
        >
          <Download size={15} className="text-purple-500 shrink-0" />
          <span className="text-[10px] sm:text-[11px] font-mono tracking-wider font-bold uppercase truncate max-w-full">Import/Export</span>
        </button>
      </div>

      {/* Tab Area Container */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 pb-24 sm:pb-16 custom-scrollbar flex flex-col gap-4 overscroll-contain touch-pan-y">

        {/* Tab 1: PROJECTION CONTROLS */}
        {activeTab === 'controls' && (
          <div className="flex flex-col gap-5 text-[#121212] dark:text-[#FDFCF8]">
            {/* Projections selection drop menu */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-mono tracking-widest uppercase font-black flex items-center gap-1.5">
                <Globe size={12} className="text-red-650" />
                <span>Map Projection</span>
              </label>
              {isNoGeoref ? (
                <div className="w-full text-xs font-mono uppercase px-3 py-2.5 bg-[#FDFCF8] dark:bg-[#181816]/50 opacity-60 border border-[#121212] dark:border-[#2C2C28] text-[#121212] dark:text-[#FDFCF8]">
                  Flat Map (No Projection)
                </div>
              ) : (
                <select
                  id="sel-projection"
                  value={config.projection}
                  onChange={(e) =>
                    onUpdateConfig((p) => ({
                      ...p,
                      projection: e.target.value as ProjectionType,
                    }))
                  }
                  className="w-full text-xs font-mono uppercase px-3 py-2.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212] dark:border-[#2C2C28] text-[#121212] dark:text-[#FDFCF8] outline-none focus:border-red-600 cursor-pointer"
                >
                  <option value="orthographic">3D Globe (Orthographic)</option>
                  <option value="aitoff">Aitoff</option>
                  <option value="azimuthalEqualArea">Azimuthal Equal Area</option>
                  <option value="centralCylindrical">Central Cylindrical</option>
                  <option value="collignon">Collignon</option>
                  <option value="eckert1">Eckert I</option>
                  <option value="eckert2">Eckert II</option>
                  <option value="eckert3">Eckert III</option>
                  <option value="eckert4">Eckert IV</option>
                  <option value="eckert5">Eckert V</option>
                  <option value="eckert6">Eckert VI</option>
                  <option value="equalEarth">Equal Earth</option>
                  <option value="equirectangular">Equirectangular (WGS84)</option>
                  <option value="gallPeters">Gall-Peters</option>
                  <option value="gallStereographic">Gall Stereographic</option>
                  <option value="gnomonic">Gnomonic</option>
                  <option value="lambert">Lambert Cylindrical Equal-Area</option>
                  <option value="miller">Miller</option>
                  <option value="mollweide">Mollweide</option>
                  <option value="robinson">Robinson</option>
                  <option value="sinusoidal">Sinusoidal</option>
                  <option value="times">Times</option>
                  <option value="mercator">Web Mercator</option>
                  <option value="winkel1">Winkel I</option>
                  <option value="winkel2">Winkel II</option>
                  <option value="winkel3">Winkel III</option>
                </select>
              )}
            </div>

            {/* Manual Lat/Lon center settings */}
            <div className="bg-[#FDFCF8] dark:bg-[#181816] p-4 border border-[#121212] dark:border-[#2C2C28] flex flex-col gap-4">

              {/* Lon */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="opacity-60">CENTRAL MERIDIAN</span>
                  <div className="flex items-center gap-1">
                    <input
                      id="txt-lon"
                      type="number"
                      min="-180"
                      max="180"
                      step="any"
                      value={tempLon}
                      onChange={(e) => setTempLon(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = parseFloat(tempLon);
                          const safeVal = isNaN(val) ? 0 : Math.max(-180, Math.min(180, val));
                          setTempLon(String(safeVal));
                          onUpdateConfig((p) => ({ ...p, centerLon: safeVal }));
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      onBlur={() => {
                        const val = parseFloat(tempLon);
                        const safeVal = isNaN(val) ? 0 : Math.max(-180, Math.min(180, val));
                        setTempLon(String(safeVal));
                        onUpdateConfig((p) => ({ ...p, centerLon: safeVal }));
                      }}
                      className="w-20 px-1.5 py-0.5 text-right bg-white dark:bg-[#121212] border border-[#121212] dark:border-[#2C2C28] text-xs font-bold rounded focus:outline-none focus:ring-1 focus:ring-[#121212] dark:focus:ring-[#FDFCF8]"
                    />
                    <span className="font-bold">°</span>
                  </div>
                </div>
              </div>

              {/* Lat */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="opacity-60">PARALLEL OF ORIGIN</span>
                  <div className="flex items-center gap-1">
                    <input
                      id="txt-lat"
                      type="number"
                      min="-85"
                      max="85"
                      step="any"
                      value={tempLat}
                      onChange={(e) => setTempLat(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = parseFloat(tempLat);
                          const safeVal = isNaN(val) ? 0 : Math.max(-85, Math.min(85, val));
                          setTempLat(String(safeVal));
                          onUpdateConfig((p) => ({ ...p, centerLat: safeVal }));
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      onBlur={() => {
                        const val = parseFloat(tempLat);
                        const safeVal = isNaN(val) ? 0 : Math.max(-85, Math.min(85, val));
                        setTempLat(String(safeVal));
                        onUpdateConfig((p) => ({ ...p, centerLat: safeVal }));
                      }}
                      className="w-20 px-1.5 py-0.5 text-right bg-white dark:bg-[#121212] border border-[#121212] dark:border-[#2C2C28] text-xs font-bold rounded focus:outline-none focus:ring-1 focus:ring-[#121212] dark:focus:ring-[#FDFCF8]"
                    />
                    <span className="font-bold">°</span>
                  </div>
                </div>
              </div>

              {/* Aspect */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="opacity-60">ASPECT</span>
                  <div className="flex items-center gap-1">
                    <input
                      id="txt-aspect"
                      type="number"
                      min="-180"
                      max="180"
                      step="any"
                      value={tempAspect}
                      onChange={(e) => setTempAspect(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = parseFloat(tempAspect);
                          const safeVal = isNaN(val) ? 0 : Math.max(-180, Math.min(180, val));
                          setTempAspect(String(safeVal));
                          onUpdateConfig((p) => ({ ...p, aspect: safeVal }));
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      onBlur={() => {
                        const val = parseFloat(tempAspect);
                        const safeVal = isNaN(val) ? 0 : Math.max(-180, Math.min(180, val));
                        setTempAspect(String(safeVal));
                        onUpdateConfig((p) => ({ ...p, aspect: safeVal }));
                      }}
                      className="w-20 px-1.5 py-0.5 text-right bg-white dark:bg-[#121212] border border-[#121212] dark:border-[#2C2C28] text-xs font-bold rounded focus:outline-none focus:ring-1 focus:ring-[#121212] dark:focus:ring-[#FDFCF8]"
                    />
                    <span className="font-bold">°</span>
                  </div>
                </div>
              </div>

              {/* Edge Angle (Globe Only - Portions of Globe) */}
              {config.projection === 'orthographic' && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="opacity-60">EDGE ANGLE</span>
                    <div className="flex items-center gap-1">
                      <input
                        id="txt-edge-angle"
                        type="number"
                        min="1"
                        max="90"
                        step="1"
                        value={tempEdgeAngle}
                        onChange={(e) => setTempEdgeAngle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = parseFloat(tempEdgeAngle);
                            const safeAngle = isNaN(val) ? 90 : Math.max(1, Math.min(90, Math.round(val)));
                            setTempEdgeAngle(String(safeAngle));
                            onUpdateConfig((p) => ({ ...p, edgeAngle: safeAngle }));
                            (e.target as HTMLInputElement).blur();
                          }
                        }}
                        onBlur={() => {
                          const val = parseFloat(tempEdgeAngle);
                          const safeAngle = isNaN(val) ? 90 : Math.max(1, Math.min(90, Math.round(val)));
                          setTempEdgeAngle(String(safeAngle));
                          onUpdateConfig((p) => ({ ...p, edgeAngle: safeAngle }));
                        }}
                        className="w-20 px-1.5 py-0.5 text-right bg-white dark:bg-[#121212] border border-[#121212] dark:border-[#2C2C28] text-xs font-bold rounded focus:outline-none focus:ring-1 focus:ring-[#121212] dark:focus:ring-[#FDFCF8]"
                      />
                      <span className="font-bold">°</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Zoom Scale (%) Controls */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="opacity-60">ZOOM LEVEL</span>
                  <div className="flex items-center gap-1">
                    <input
                      id="txt-zoom-percent"
                      type="number"
                      min="1"
                      max="50000"
                      step="1"
                      value={Math.round(displayedZoom * 100)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val > 0) {
                          const newZoom = Math.max(0.001, val / 100);
                          onUpdateConfig((p) => ({ ...p, zoom: newZoom }));
                          if (setViewport) {
                            setViewport({ zoom: 1, pan: { x: 0, y: 0 } });
                          }
                        }
                      }}
                      className="w-20 px-1.5 py-0.5 text-right bg-white dark:bg-[#121212] border border-[#121212] dark:border-[#2C2C28] text-xs font-bold rounded focus:outline-none focus:ring-1 focus:ring-[#121212] dark:focus:ring-[#FDFCF8]"
                    />
                    <span className="font-bold">%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Enlarge City-States Option (Simple World Map Only) */}
            {(!selectedMapFile || selectedMapFile === 'world.json') && (
              <div className="flex items-center justify-between py-3 border-b border-[#121212] dark:border-[#2C2C28]">
                <span className="text-xs font-bold font-mono tracking-wide">
                  ENLARGE CITY-STATES
                </span>
                <button
                  id="toggle-enlarge-city-states"
                  onClick={() =>
                    onUpdateConfig((p) => ({ ...p, enlargeCityStates: !p.enlargeCityStates }))
                  }
                  className="px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider border border-[#121212] dark:border-[#2C2C28] bg-[#FDFCF8] dark:bg-[#181816] text-[#121212] dark:text-[#FDFCF8] hover:bg-[#121212] hover:text-[#FDFCF8] dark:hover:bg-[#FDFCF8] dark:hover:text-[#121212] transition-all cursor-pointer"
                >
                  {config.enlargeCityStates ? 'DISABLE' : 'ENABLE'}
                </button>
              </div>
            )}

            {/* Show graticule toggle and controls */}
            <div className="flex flex-col gap-3 py-3 border-b border-[#121212] dark:border-[#2C2C28]">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-bold font-mono tracking-wide">
                    SHOW GRATICULE
                  </span>
                  <span className="text-[10px] opacity-60">
                    Render graticule coordinate guide lines
                  </span>
                </div>
                <button
                  id="toggle-graticule"
                  onClick={() =>
                    onUpdateConfig((p) => ({ ...p, showGraticule: !p.showGraticule }))
                  }
                  className="px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider border border-[#121212] dark:border-[#2C2C28] bg-[#FDFCF8] dark:bg-[#181816] text-[#121212] dark:text-[#FDFCF8] hover:bg-[#121212] hover:text-[#FDFCF8] dark:hover:bg-[#FDFCF8] dark:hover:text-[#121212] transition-all cursor-pointer"
                >
                  {config.showGraticule ? 'DISABLE' : 'ENABLE'}
                </button>
              </div>

              {config.showGraticule && (
                <div className="flex flex-col gap-3 pl-2 border-l border-[#121212]/20 dark:border-[#FDFCF8]/20">
                  {/* Graticule intervals */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="opacity-60 uppercase">GRATICULE INTERVALS</span>
                      <div className="flex items-center gap-1">
                        <input
                          id="txt-graticule-interval"
                          type="number"
                          min="0.5"
                          max="90"
                          step="0.5"
                          value={config.graticuleInterval !== undefined ? config.graticuleInterval : 10}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val) && val > 0) {
                              onUpdateConfig((p) => ({ ...p, graticuleInterval: Math.max(0.1, Math.min(90, val)) }));
                            }
                          }}
                          className="w-20 px-1.5 py-0.5 text-right bg-white dark:bg-[#121212] border border-[#121212] dark:border-[#2C2C28] text-xs font-bold rounded focus:outline-none focus:ring-1 focus:ring-[#121212] dark:focus:ring-[#FDFCF8]"
                        />
                        <span className="font-bold text-xs font-mono">°</span>
                      </div>
                    </div>
                  </div>

                  {/* Graticule color */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold font-mono opacity-65 tracking-wide uppercase">
                      Graticule Color
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        id="sel-graticule-color"
                        value={
                          !config.graticuleColor || config.graticuleColor === 'default'
                            ? 'default'
                            : ['#94a3b8', '#334155', '#000000', '#ffffff', '#ef4444', '#3b82f6', '#10b981'].includes(config.graticuleColor)
                            ? config.graticuleColor
                            : 'default'
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateConfig((p) => ({ ...p, graticuleColor: val }));
                        }}
                        className="flex-1 text-[11px] font-mono uppercase px-2 py-1.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212] dark:border-[#2C2C28] text-[#121212] dark:text-[#FDFCF8] outline-none cursor-pointer"
                      >
                        <option value="default">Default Adaptive</option>
                        <option value="#94a3b8">Light Gray (#94a3b8)</option>
                        <option value="#334155">Dark Slate (#334155)</option>
                        <option value="#000000">Black (#000000)</option>
                        <option value="#ffffff">White (#ffffff)</option>
                        <option value="#ef4444">Red (#ef4444)</option>
                        <option value="#3b82f6">Blue (#3b82f6)</option>
                        <option value="#10b981">Green (#10b981)</option>
                      </select>

                      <input
                        type="color"
                        value={
                          config.graticuleColor && config.graticuleColor.startsWith('#') && config.graticuleColor.length === 7
                            ? config.graticuleColor
                            : '#000000'
                        }
                        onChange={(e) => {
                          onUpdateConfig((p) => ({ ...p, graticuleColor: e.target.value }));
                        }}
                        className="w-7 h-7 border border-[#121212]/20 dark:border-[#2C2C28] bg-transparent p-0 cursor-pointer rounded shrink-0"
                        title="Choose custom graticule color"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 5: VIEW CONTROLS */}
        {activeTab === 'view' && (
          <div className="flex flex-col gap-5 text-[#121212] dark:text-[#FDFCF8]">
            {/* LABELS */}
            <div className="flex flex-col gap-3 py-3 border-b border-[#121212] dark:border-[#2C2C28]">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold font-mono tracking-wide">
                    POLYGON LABELS
                  </span>
                  <div className="text-[9px] font-mono opacity-50">
                    Polygon name labels only
                  </div>
                </div>
                <button
                  id="toggle-labels"
                  onClick={() =>
                    onUpdateConfig((p) => ({ ...p, showLabels: !p.showLabels }))
                  }
                  className="px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider border border-[#121212] dark:border-[#2C2C28] bg-[#FDFCF8] dark:bg-[#181816] text-[#121212] dark:text-[#FDFCF8] hover:bg-[#121212] hover:text-[#FDFCF8] dark:hover:bg-[#FDFCF8] dark:hover:text-[#121212] transition-all cursor-pointer"
                >
                  {config.showLabels ? 'DISABLE' : 'ENABLE'}
                </button>
              </div>

              {config.showLabels && (
                <div className="flex flex-col gap-3 pl-2 border-l border-[#121212]/20 dark:border-[#FDFCF8]/20">
                  {/* Minimum Label Font Size */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="opacity-60">MINIMUM LABEL FONT SIZE</span>
                      <span className="font-bold">{(config.minLabelFontSize !== undefined ? config.minLabelFontSize : 1.0).toFixed(1)}</span>
                    </div>
                    <input
                      id="rng-min-label-size"
                      type="range"
                      min="0.5"
                      max="2"
                      step="0.1"
                      value={config.minLabelFontSize !== undefined ? config.minLabelFontSize : 1.0}
                      onChange={(e) => {
                        const val = Math.max(0.5, Math.min(2, parseFloat(e.target.value) || 1));
                        onUpdateConfig((p) => ({ ...p, minLabelFontSize: val }));
                      }}
                      className="w-full h-1 bg-[#E5E5E0] dark:bg-[#2C2C28] appearance-none cursor-pointer accent-[#121212] dark:accent-red-655"
                    />
                  </div>

                  {/* Maximum Label Font Size */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="opacity-60">MAXIMUM LABEL FONT SIZE</span>
                      <span className="font-bold">{(config.maxLabelFontSize !== undefined ? config.maxLabelFontSize : 5.0).toFixed(1)}</span>
                    </div>
                    <input
                      id="rng-max-label-size"
                      type="range"
                      min="1"
                      max="10"
                      step="0.1"
                      value={config.maxLabelFontSize !== undefined ? config.maxLabelFontSize : 5.0}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(10, parseFloat(e.target.value) || 5));
                        onUpdateConfig((p) => ({ ...p, maxLabelFontSize: val }));
                      }}
                      className="w-full h-1 bg-[#E5E5E0] dark:bg-[#2C2C28] appearance-none cursor-pointer accent-[#121212] dark:accent-red-655"
                    />
                  </div>

                  {/* Font Family Selection */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold font-mono opacity-65 tracking-wide uppercase">
                      Label Font
                    </label>
                    <select
                      id="sel-label-font"
                      value={config.labelFontFamily || 'georgia'}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        onUpdateConfig((p) => ({ ...p, labelFontFamily: val }));
                      }}
                      className="w-full text-[11px] font-mono uppercase px-2 py-1.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212] dark:border-[#2C2C28] text-[#121212] dark:text-[#FDFCF8] outline-none cursor-pointer"
                    >
                      <option value="bodoni" style={{ fontFamily: '"Bodoni Moda", serif' }}>Bodoni Moda</option>
                      <option value="cinzel" style={{ fontFamily: '"Cinzel", serif' }}>Cinzel</option>
                      <option value="cinzel-dec" style={{ fontFamily: '"Cinzel Decorative", serif' }}>Cinzel Decorative</option>
                      <option value="gothic" style={{ fontFamily: '"UnifrakturMaguntia", serif' }}>Unifraktur Gothic</option>
                      <option value="medieval" style={{ fontFamily: '"MedievalSharp", serif' }}>MedievalSharp</option>
                      <option value="engraved" style={{ fontFamily: '"IM Fell English", serif' }}>IM Fell English</option>
                      <option value="marcellus" style={{ fontFamily: '"Marcellus", serif' }}>Marcellus</option>
                      <option value="almendra" style={{ fontFamily: '"Almendra", serif' }}>Almendra</option>
                      <option value="pirata" style={{ fontFamily: '"Pirata One", serif' }}>Pirata One</option>
                      <option value="cormorant" style={{ fontFamily: '"Cormorant Garamond", serif' }}>Cormorant Garamond</option>
                      <option value="serif" style={{ fontFamily: '"Playfair Display", serif' }}>Playfair Display</option>
                      <option value="georgia" style={{ fontFamily: 'Georgia, serif' }}>Georgia</option>
                      <option value="mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>JetBrains Mono</option>
                    </select>
                  </div>

                  

                  {/* Label Color */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold font-mono opacity-65 tracking-wide uppercase">
                      Label Color
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        id="sel-label-color"
                        value={
                          !config.labelColor || config.labelColor === 'default'
                            ? 'default'
                            : ['#121212', '#FDFCF8', '#475569', '#94a3b8', '#d97706', '#ef4444', '#3b82f6'].includes(config.labelColor)
                            ? config.labelColor
                            : 'default'
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateConfig((p) => ({ ...p, labelColor: val }));
                        }}
                        className="flex-1 text-[11px] font-mono uppercase px-2 py-1.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212] dark:border-[#2C2C28] text-[#121212] dark:text-[#FDFCF8] outline-none cursor-pointer"
                      >
                        <option value="default">Default River Color</option>
                          <option value="#bae6fd">Light Azure Blue</option>
                          <option value="#111e35">Deep Abyssal Navy</option>
                          <option value="#0d9488">Classic Nautical Teal</option>
                          <option value="#e8e4d9">Vintage Parchment Beige</option>
                          <option value="#1c2024">Dark Charcoal Ocean</option>
                          <option value="#06b6d4">Caribbean Cyan</option>
                          <option value="#2563eb">Royal Sapphire Blue</option>
                      </select>
                      <input
                        type="color"
                        value={config.labelColor && config.labelColor.startsWith('#') && config.labelColor.length === 7 ? config.labelColor : '#121212'}
                        onChange={(e) => onUpdateConfig((p) => ({ ...p, labelColor: e.target.value }))}
                        className="w-7 h-7 border border-[#121212]/20 dark:border-[#2C2C28] bg-transparent p-0 cursor-pointer rounded shrink-0"
                        title="Choose custom label text color"
                      />
                    </div>
                  </div>

                  {/* Label Border Ratio */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="opacity-60 uppercase">Outline font size</span>
                      <span className="font-bold">
                        {Math.round((config.labelHaloRatio !== undefined ? config.labelHaloRatio : (config.labelBorderRatio !== undefined ? config.labelBorderRatio : 0.15)) * 100)}%
                      </span>
                    </div>
                    <input
                      id="rng-label-border-ratio"
                      type="range"
                      min="0.00"
                      max="0.50"
                      step="0.01"
                      value={config.labelHaloRatio !== undefined ? config.labelHaloRatio : (config.labelBorderRatio !== undefined ? config.labelBorderRatio : 0.15)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        onUpdateConfig((p) => ({ ...p, labelHaloRatio: val, labelBorderRatio: val }));
                      }}
                      className="w-full h-1 bg-[#E5E5E0] dark:bg-[#2C2C28] appearance-none cursor-pointer accent-[#121212] dark:accent-red-655"
                    />
                  </div>

                  {/* Label Border Color */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold font-mono opacity-65 tracking-wide uppercase">
                      Label Border Color
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        id="sel-label-border-color"
                        value={
                          !(config.labelHaloColor || config.labelBorderColor) || (config.labelHaloColor || config.labelBorderColor) === 'default'
                            ? 'default'
                            : ['#FDFCF8', '#121212', '#475569', '#94a3b8', '#d97706', '#ef4444', '#3b82f6'].includes((config.labelHaloColor || config.labelBorderColor)!)
                            ? (config.labelHaloColor || config.labelBorderColor)
                            : 'default'
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateConfig((p) => ({ ...p, labelHaloColor: val, labelBorderColor: val }));
                        }}
                        className="flex-1 text-[11px] font-mono uppercase px-2 py-1.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212] dark:border-[#2C2C28] text-[#121212] dark:text-[#FDFCF8] outline-none cursor-pointer"
                      >
                        <option value="default">Default Adaptive</option>
                        <option value="#FDFCF8">Off-White (#FDFCF8)</option>
                        <option value="#121212">Jet Black (#121212)</option>
                        <option value="#475569">Slate Gray (#475569)</option>
                        <option value="#94a3b8">Light Gray (#94a3b8)</option>
                        <option value="#d97706">Gold / Brass (#d97706)</option>
                        <option value="#ef4444">Bright Red (#ef4444)</option>
                        <option value="#3b82f6">Ocean Blue (#3b82f6)</option>
                      </select>
                      <input
                        type="color"
                        value={(config.labelHaloColor || config.labelBorderColor) && (config.labelHaloColor || config.labelBorderColor)!.startsWith('#') && (config.labelHaloColor || config.labelBorderColor)!.length === 7 ? (config.labelHaloColor || config.labelBorderColor) : '#FDFCF8'}
                        onChange={(e) => onUpdateConfig((p) => ({ ...p, labelHaloColor: e.target.value, labelBorderColor: e.target.value }))}
                        className="w-7 h-7 border border-[#121212]/20 dark:border-[#2C2C28] bg-transparent p-0 cursor-pointer rounded shrink-0"
                        title="Choose custom label border color"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* BORDER STYLING (MODULAR HIERARCHY) */}
            <div className="flex flex-col gap-3 py-3 border-b border-[#121212] dark:border-[#2C2C28]">
              {detectedHierarchy.hasSubnational ? (
                <>
                  {/* REGION / SUBNATIONAL BORDER MODULE */}
                  <div className="flex flex-col gap-2 p-2.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212]/15 dark:border-[#2C2C28]">
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="text-xs font-bold font-mono tracking-wide uppercase">
                        {selectedMapFile === 'world_ecoregions.json' ? 'Ecoregion Border Thickness' : 'Region Border Thickness'}
                      </span>
                      <span className="font-bold">{(config.borderWidth !== undefined ? config.borderWidth : 0.2).toFixed(1)}</span>
                    </div>
                    <input
                      id="rng-border-width"
                      type="range"
                      min="0.0"
                      max="3.0"
                      step="0.1"
                      value={config.borderWidth !== undefined ? config.borderWidth : 0.2}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        onUpdateConfig((p) => ({ ...p, borderWidth: val }));
                      }}
                      className="w-full h-1 bg-[#E5E5E0] dark:bg-[#2C2C28] appearance-none cursor-pointer accent-[#121212] dark:accent-red-655"
                    />
                    <div className="flex flex-col gap-1 pt-1.5 border-t border-[#121212]/10 dark:border-[#2C2C28]/30">
                      <label className="text-[10px] font-bold font-mono opacity-60 tracking-wide uppercase">
                        {selectedMapFile === 'world_ecoregions.json' ? 'Ecoregion Border Color' : 'Region Border Color'}
                      </label>
                      <div className="flex items-center gap-2">
                        <select
                          value={
                            !config.borderColor || config.borderColor === 'default'
                              ? 'default'
                              : ['#121212', '#FDFCF8', '#475569', '#94a3b8', '#d97706', '#ef4444', '#3b82f6'].includes(config.borderColor)
                              ? config.borderColor
                              : 'default'
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            onUpdateConfig((p) => ({ ...p, borderColor: val }));
                          }}
                          className="flex-1 text-[11px] font-mono uppercase px-2 py-1.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212] dark:border-[#2C2C28] text-[#121212] dark:text-[#FDFCF8] outline-none cursor-pointer"
                        >
                          <option value="default">Default River Color</option>
                          <option value="#bae6fd">Light Azure Blue</option>
                          <option value="#111e35">Deep Abyssal Navy</option>
                          <option value="#0d9488">Classic Nautical Teal</option>
                          <option value="#e8e4d9">Vintage Parchment Beige</option>
                          <option value="#1c2024">Dark Charcoal Ocean</option>
                          <option value="#06b6d4">Caribbean Cyan</option>
                          <option value="#2563eb">Royal Sapphire Blue</option>
                        </select>
                        <input
                          type="color"
                          value={config.borderColor && config.borderColor.startsWith('#') && config.borderColor.length === 7 ? config.borderColor : '#94a3b8'}
                          onChange={(e) => onUpdateConfig((p) => ({ ...p, borderColor: e.target.value }))}
                          className="w-7 h-7 border border-[#121212]/20 dark:border-[#2C2C28] bg-transparent p-0 cursor-pointer rounded shrink-0"
                          title="Choose custom region border color"
                        />
                      </div>
                    </div>
                  </div>

                  {/* COUNTRY BORDER MODULE */}
                  <div className="flex flex-col gap-2 p-2.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212]/15 dark:border-[#2C2C28]">
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="text-xs font-bold font-mono tracking-wide uppercase">
                        {selectedMapFile === 'world_ecoregions.json' ? 'Biome Border Thickness' : 'Country Border Thickness'}
                      </span>
                      <span className="font-bold">{(config.countryBorderWidth !== undefined ? config.countryBorderWidth : 0.2).toFixed(1)}</span>
                    </div>
                    <input
                      id="rng-country-border-width"
                      type="range"
                      min="0.0"
                      max="4.0"
                      step="0.1"
                      value={config.countryBorderWidth !== undefined ? config.countryBorderWidth : 0.2}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        onUpdateConfig((p) => ({ ...p, countryBorderWidth: val }));
                      }}
                      className="w-full h-1 bg-[#E5E5E0] dark:bg-[#2C2C28] appearance-none cursor-pointer accent-[#121212] dark:accent-red-655"
                    />
                    <div className="flex flex-col gap-1 pt-1.5 border-t border-[#121212]/10 dark:border-[#2C2C28]/30">
                      <label className="text-[10px] font-bold font-mono opacity-60 tracking-wide uppercase">
                        {selectedMapFile === 'world_ecoregions.json' ? 'Biome Border Color' : 'Country Border Color'}
                      </label>
                      <div className="flex items-center gap-2">
                        <select
                          value={
                            !config.countryBorderColor || config.countryBorderColor === 'default'
                              ? 'default'
                              : ['#121212', '#FDFCF8', '#475569', '#94a3b8', '#d97706', '#ef4444', '#3b82f6'].includes(config.countryBorderColor)
                              ? config.countryBorderColor
                              : 'default'
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            onUpdateConfig((p) => ({ ...p, countryBorderColor: val }));
                          }}
                          className="flex-1 text-[11px] font-mono uppercase px-2 py-1.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212] dark:border-[#2C2C28] text-[#121212] dark:text-[#FDFCF8] outline-none cursor-pointer"
                        >
                          <option value="default">Default Adaptive</option>
                          <option value="#121212">Jet Black (#121212)</option>
                          <option value="#FDFCF8">Off-White (#FDFCF8)</option>
                          <option value="#475569">Slate Gray (#475569)</option>
                          <option value="#94a3b8">Light Gray (#94a3b8)</option>
                          <option value="#d97706">Gold / Brass (#d97706)</option>
                          <option value="#ef4444">Bright Red (#ef4444)</option>
                          <option value="#3b82f6">Ocean Blue (#3b82f6)</option>
                        </select>
                        <input
                          type="color"
                          value={config.countryBorderColor && config.countryBorderColor.startsWith('#') && config.countryBorderColor.length === 7 ? config.countryBorderColor : '#121212'}
                          onChange={(e) => onUpdateConfig((p) => ({ ...p, countryBorderColor: e.target.value }))}
                          className="w-7 h-7 border border-[#121212]/20 dark:border-[#2C2C28] bg-transparent p-0 cursor-pointer rounded shrink-0"
                          title="Choose custom country border color"
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                /* BASE BORDER MODULE */
                <div className="flex flex-col gap-2 p-2.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212]/15 dark:border-[#2C2C28]">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-xs font-bold font-mono tracking-wide uppercase">Border Thickness</span>
                    <span className="font-bold">{(config.borderWidth !== undefined ? config.borderWidth : 0.2).toFixed(1)}</span>
                  </div>
                  <input
                    id="rng-border-width"
                    type="range"
                    min="0.0"
                    max="3.0"
                    step="0.1"
                    value={config.borderWidth !== undefined ? config.borderWidth : 0.2}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      onUpdateConfig((p) => ({ 
                        ...p, 
                        borderWidth: val,
                        countryBorderWidth: val,
                        continentBorderWidth: val
                      }));
                    }}
                    className="w-full h-1 bg-[#E5E5E0] dark:bg-[#2C2C28] appearance-none cursor-pointer accent-[#121212] dark:accent-red-655"
                  />
                  <div className="flex flex-col gap-1 pt-1.5 border-t border-[#121212]/10 dark:border-[#2C2C28]/30">
                    <label className="text-[10px] font-bold font-mono opacity-60 tracking-wide uppercase">
                      Border Color
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        id="sel-border-color"
                        value={
                          !config.borderColor || config.borderColor === 'default'
                            ? 'default'
                            : ['#121212', '#FDFCF8', '#475569', '#94a3b8', '#d97706', '#ef4444', '#3b82f6'].includes(config.borderColor)
                            ? config.borderColor
                            : 'default'
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateConfig((p) => ({ 
                            ...p, 
                            borderColor: val,
                            countryBorderColor: val,
                            continentBorderColor: val
                          }));
                        }}
                        className="flex-1 text-[11px] font-mono uppercase px-2 py-1.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212] dark:border-[#2C2C28] text-[#121212] dark:text-[#FDFCF8] outline-none cursor-pointer"
                      >
                        <option value="default">Default Adaptive</option>
                        <option value="#121212">Jet Black (#121212)</option>
                        <option value="#FDFCF8">Off-White (#FDFCF8)</option>
                        <option value="#475569">Slate Gray (#475569)</option>
                        <option value="#94a3b8">Light Gray (#94a3b8)</option>
                        <option value="#d97706">Gold / Brass (#d97706)</option>
                        <option value="#ef4444">Bright Red (#ef4444)</option>
                        <option value="#3b82f6">Ocean Blue (#3b82f6)</option>
                      </select>
                      <input
                        type="color"
                        value={config.borderColor && config.borderColor.startsWith('#') && config.borderColor.length === 7 ? config.borderColor : '#94a3b8'}
                        onChange={(e) => onUpdateConfig((p) => ({ 
                          ...p, 
                          borderColor: e.target.value,
                          countryBorderColor: e.target.value,
                          continentBorderColor: e.target.value 
                        }))}
                        className="w-7 h-7 border border-[#121212]/20 dark:border-[#2C2C28] bg-transparent p-0 cursor-pointer rounded shrink-0"
                        title="Choose custom border color"
                      />
                    </div>
                  </div>
                </div>
              )}

              {detectedHierarchy.hasContinents && (
                /* CONTINENT / REALM BORDER MODULE */
                <div className="flex flex-col gap-2 p-2.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212]/15 dark:border-[#2C2C28]">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-xs font-bold font-mono tracking-wide uppercase">
                      {selectedMapFile === 'world_ecoregions.json' ? 'Realm Border Thickness' : 'Continent Border Thickness'}
                    </span>
                    <span className="font-bold">{(config.continentBorderWidth !== undefined ? config.continentBorderWidth : 0.2).toFixed(1)}</span>
                  </div>
                  <input
                    id="rng-continent-border-width"
                    type="range"
                    min="0.0"
                    max="5.0"
                    step="0.1"
                    value={config.continentBorderWidth !== undefined ? config.continentBorderWidth : 0.2}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      onUpdateConfig((p) => ({ ...p, continentBorderWidth: val }));
                    }}
                    className="w-full h-1 bg-[#E5E5E0] dark:bg-[#2C2C28] appearance-none cursor-pointer accent-[#121212] dark:accent-red-655"
                  />
                  <div className="flex flex-col gap-1 pt-1.5 border-t border-[#121212]/10 dark:border-[#2C2C28]/30">
                    <label className="text-[10px] font-bold font-mono opacity-60 tracking-wide uppercase">
                      {selectedMapFile === 'world_ecoregions.json' ? 'Realm Border Color' : 'Continent Border Color'}
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={
                          !config.continentBorderColor || config.continentBorderColor === 'default'
                            ? 'default'
                            : ['#121212', '#FDFCF8', '#475569', '#94a3b8', '#d97706', '#ef4444', '#3b82f6'].includes(config.continentBorderColor)
                            ? config.continentBorderColor
                            : 'default'
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateConfig((p) => ({ ...p, continentBorderColor: val }));
                        }}
                        className="flex-1 text-[11px] font-mono uppercase px-2 py-1.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212] dark:border-[#2C2C28] text-[#121212] dark:text-[#FDFCF8] outline-none cursor-pointer"
                      >
                        <option value="default">Default Adaptive</option>
                        <option value="#121212">Jet Black (#121212)</option>
                        <option value="#FDFCF8">Off-White (#FDFCF8)</option>
                        <option value="#475569">Slate Gray (#475569)</option>
                        <option value="#94a3b8">Light Gray (#94a3b8)</option>
                        <option value="#d97706">Gold / Brass (#d97706)</option>
                        <option value="#ef4444">Bright Red (#ef4444)</option>
                        <option value="#3b82f6">Ocean Blue (#3b82f6)</option>
                      </select>
                      <input
                        type="color"
                        value={config.continentBorderColor && config.continentBorderColor.startsWith('#') && config.continentBorderColor.length === 7 ? config.continentBorderColor : '#121212'}
                        onChange={(e) => onUpdateConfig((p) => ({ ...p, continentBorderColor: e.target.value }))}
                        className="w-7 h-7 border border-[#121212]/20 dark:border-[#2C2C28] bg-transparent p-0 cursor-pointer rounded shrink-0"
                        title="Choose custom continent border color"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* MAP OUTER BORDER MODULE */}
              <div className="flex flex-col gap-2 p-2.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212]/15 dark:border-[#2C2C28]">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-xs font-bold font-mono tracking-wide uppercase">Map Border Thickness</span>
                  <span className="font-bold">{(config.mapBorderWidth !== undefined ? config.mapBorderWidth : 0.2).toFixed(1)}</span>
                </div>
                <input
                  id="rng-map-border-width"
                  type="range"
                  min="0.0"
                  max="6.0"
                  step="0.1"
                  value={config.mapBorderWidth !== undefined ? config.mapBorderWidth : 0.2}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    onUpdateConfig((p) => ({ ...p, mapBorderWidth: val }));
                  }}
                  className="w-full h-1 bg-[#E5E5E0] dark:bg-[#2C2C28] appearance-none cursor-pointer accent-[#121212] dark:accent-red-655"
                />

                <div className="flex flex-col gap-1 pt-1.5 border-t border-[#121212]/10 dark:border-[#2C2C28]/30">
                  <label className="text-[10px] font-bold font-mono opacity-60 tracking-wide uppercase">
                    Map Border Color
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      id="sel-map-border-color"
                      value={
                        !config.mapBorderColor || config.mapBorderColor === 'default'
                          ? 'default'
                          : ['#121212', '#FDFCF8', '#475569', '#94a3b8', '#d97706', '#ef4444', '#3b82f6'].includes(config.mapBorderColor)
                          ? config.mapBorderColor
                          : 'default'
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateConfig((p) => ({ ...p, mapBorderColor: val }));
                      }}
                      className="flex-1 text-[11px] font-mono uppercase px-2 py-1.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212] dark:border-[#2C2C28] text-[#121212] dark:text-[#FDFCF8] outline-none cursor-pointer"
                    >
                      <option value="default">Default Adaptive</option>
                      <option value="#121212">Jet Black (#121212)</option>
                      <option value="#FDFCF8">Off-White (#FDFCF8)</option>
                      <option value="#475569">Slate Gray (#475569)</option>
                      <option value="#94a3b8">Light Gray (#94a3b8)</option>
                      <option value="#d97706">Gold / Brass (#d97706)</option>
                      <option value="#ef4444">Bright Red (#ef4444)</option>
                      <option value="#3b82f6">Ocean Blue (#3b82f6)</option>
                    </select>

                    <input
                      type="color"
                      value={
                        config.mapBorderColor && config.mapBorderColor.startsWith('#') && config.mapBorderColor.length === 7
                          ? config.mapBorderColor
                          : '#121212'
                      }
                      onChange={(e) => {
                        onUpdateConfig((p) => ({ ...p, mapBorderColor: e.target.value }));
                      }}
                      className="w-7 h-7 border border-[#121212]/20 dark:border-[#2C2C28] bg-transparent p-0 cursor-pointer rounded shrink-0"
                      title="Choose custom map bounding border color"
                    />
                  </div>
                </div>
              </div>

              {/* LEGEND BORDER MODULE */}
              <div className="flex flex-col gap-2 p-2.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212]/15 dark:border-[#2C2C28]">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-xs font-bold font-mono tracking-wide uppercase">Legend Border Thickness</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateConfig((p) => ({
                          ...p,
                          legendBorderWidth: undefined,
                          legendBorderColor: 'default',
                        }));
                      }}
                      className="text-[9px] font-mono uppercase px-1.5 py-0.5 border border-[#121212]/20 dark:border-[#2C2C28] hover:bg-[#121212]/5 dark:hover:bg-[#2C2C28]/50 transition-colors"
                      title="Sync legend border thickness and color with map border"
                    >
                      Match Map Border
                    </button>
                    <span className="font-bold">
                      {(config.legendBorderWidth !== undefined ? config.legendBorderWidth : (config.mapBorderWidth !== undefined ? config.mapBorderWidth : 0.2)).toFixed(1)}
                    </span>
                  </div>
                </div>
                <input
                  id="rng-legend-border-width-borders"
                  type="range"
                  min="0.0"
                  max="6.0"
                  step="0.1"
                  value={config.legendBorderWidth !== undefined ? config.legendBorderWidth : (config.mapBorderWidth !== undefined ? config.mapBorderWidth : 0.2)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    onUpdateConfig((p) => ({ ...p, legendBorderWidth: val }));
                  }}
                  className="w-full h-1 bg-[#E5E5E0] dark:bg-[#2C2C28] appearance-none cursor-pointer accent-[#121212] dark:accent-red-655"
                />

                <div className="flex flex-col gap-1 pt-1.5 border-t border-[#121212]/10 dark:border-[#2C2C28]/30">
                  <label className="text-[10px] font-bold font-mono opacity-60 tracking-wide uppercase">
                    Legend Border Color
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      id="sel-legend-border-color-borders"
                      value={
                        !config.legendBorderColor || config.legendBorderColor === 'default'
                          ? 'default'
                          : ['#121212', '#FDFCF8', '#475569', '#94a3b8', '#d97706', '#ef4444', '#3b82f6'].includes(config.legendBorderColor)
                          ? config.legendBorderColor
                          : 'default'
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateConfig((p) => ({ ...p, legendBorderColor: val }));
                      }}
                      className="flex-1 text-[11px] font-mono uppercase px-2 py-1.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212] dark:border-[#2C2C28] text-[#121212] dark:text-[#FDFCF8] outline-none cursor-pointer"
                    >
                      <option value="default">Match Map Border (Default)</option>
                      <option value="#121212">Jet Black (#121212)</option>
                      <option value="#FDFCF8">Off-White (#FDFCF8)</option>
                      <option value="#475569">Slate Gray (#475569)</option>
                      <option value="#94a3b8">Light Gray (#94a3b8)</option>
                      <option value="#d97706">Gold / Brass (#d97706)</option>
                      <option value="#ef4444">Bright Red (#ef4444)</option>
                      <option value="#3b82f6">Ocean Blue (#3b82f6)</option>
                    </select>

                    <input
                      type="color"
                      value={
                        config.legendBorderColor && config.legendBorderColor.startsWith('#') && config.legendBorderColor.length === 7
                          ? config.legendBorderColor
                          : (config.mapBorderColor && config.mapBorderColor.startsWith('#') && config.mapBorderColor.length === 7
                              ? config.mapBorderColor
                              : (config.borderColor && config.borderColor.startsWith('#') && config.borderColor.length === 7
                                  ? config.borderColor
                                  : '#94a3b8'))
                      }
                      onChange={(e) => {
                        onUpdateConfig((p) => ({ ...p, legendBorderColor: e.target.value }));
                      }}
                      className="w-7 h-7 border border-[#121212]/20 dark:border-[#2C2C28] bg-transparent p-0 cursor-pointer rounded shrink-0"
                      title="Choose custom legend border color"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* LAND OPACITY / SOLIDITY */}
            <div className="flex flex-col gap-1.5 py-3">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-xs font-bold font-mono tracking-wide">LAND OPACITY / SOLIDITY</span>
                <span className="font-bold">{(config.landOpacity !== undefined ? config.landOpacity * 100 : 100).toFixed(0)}%</span>
              </div>
              <input
                id="rng-land-opacity"
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={config.landOpacity !== undefined ? config.landOpacity : 1.0}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onUpdateConfig((p) => ({ ...p, landOpacity: val }));
                }}
                className="w-full h-1 bg-[#E5E5E0] dark:bg-[#2C2C28] appearance-none cursor-pointer accent-[#121212] dark:accent-red-655"
              />
            </div>
          </div>
        )}

        {/* Tab Background: BACKGROUND & OCEAN CUSTOMIZATION */}
        {activeTab === 'background' && (
          <div className="flex flex-col gap-4 text-[#121212] dark:text-[#FDFCF8]">
            <div className="p-4 border border-[#121212] dark:border-[#2C2C28] bg-[#FDFCF8] dark:bg-[#181816] flex flex-col gap-4">
              
              {/* 1. MAP BACKGROUND COLOR CUSTOMIZATION */}
              <div className="flex flex-col gap-2 pb-3 border-b border-[#121212]/10 dark:border-[#2C2C28]/20">
                <label className="text-xs font-bold font-mono tracking-wide uppercase">
                  Map Background Color
                </label>
                <div className="flex items-center gap-2">
                  <select
                    id="sel-bg-color"
                    value={
                      !config.customBgColor || config.customBgColor === 'default'
                        ? 'default'
                        : ['#bae6fd', '#111e35', '#0d9488', '#f3f2ea', '#18181b', '#fdfcf8', '#ef4444'].includes(config.customBgColor)
                        ? config.customBgColor
                        : 'default'
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      onUpdateConfig((p) => ({ ...p, customBgColor: val }));
                    }}
                    className="flex-1 text-[11px] font-mono uppercase px-2 py-1.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212] dark:border-[#2C2C28] text-[#121212] dark:text-[#FDFCF8] outline-none cursor-pointer"
                  >
                    <option value="default">Default Theme Background</option>
                    <option value="#bae6fd">Light Azure Blue</option>
                    <option value="#111e35">Deep Abyssal Navy</option>
                    <option value="#0d9488">Classic Nautical Teal</option>
                    <option value="#f3f2ea">Vintage Cartographic Parchment</option>
                    <option value="#18181b">Minimal Zinc Charcoal</option>
                    <option value="#fdfcf8">Off-White Canvas</option>
                    <option value="#ef4444">Retro Heatmap Red</option>
                  </select>

                  <input
                    type="color"
                    value={
                      config.customBgColor && config.customBgColor.startsWith('#') && config.customBgColor.length === 7
                        ? config.customBgColor
                        : '#bae6fd'
                    }
                    onChange={(e) => {
                      onUpdateConfig((p) => ({ ...p, customBgColor: e.target.value }));
                    }}
                    className="w-7 h-7 border border-[#121212]/20 dark:border-[#2C2C28] bg-transparent p-0 cursor-pointer rounded shrink-0"
                    title="Choose custom background hex color"
                  />
                </div>
              </div>

              {/* 1B. OCEAN / WATER COLOR CUSTOMIZATION */}
              <div className="flex flex-col gap-2 pb-3 border-b border-[#121212]/10 dark:border-[#2C2C28]/20">
                <label className="text-xs font-bold font-mono tracking-wide uppercase">
                  Ocean / Water Color
                </label>
                <div className="flex items-center gap-2">
                  <select
                    id="sel-ocean-color"
                    value={
                      !config.customOceanColor || config.customOceanColor === 'default'
                        ? 'default'
                        : ['#bae6fd', '#111e35', '#0d9488', '#e8e4d9', '#1c2024', '#06b6d4', '#2563eb'].includes(config.customOceanColor)
                        ? config.customOceanColor
                        : 'default'
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      onUpdateConfig((p) => ({ ...p, customOceanColor: val }));
                    }}
                    className="flex-1 text-[11px] font-mono uppercase px-2 py-1.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212] dark:border-[#2C2C28] text-[#121212] dark:text-[#FDFCF8] outline-none cursor-pointer"
                  >
                    <option value="default">Default Ocean Color</option>
                    <option value="#bae6fd">Light Azure Blue</option>
                    <option value="#111e35">Deep Abyssal Navy</option>
                    <option value="#0d9488">Classic Nautical Teal</option>
                    <option value="#e8e4d9">Vintage Parchment Beige</option>
                    <option value="#1c2024">Dark Charcoal Ocean</option>
                    <option value="#06b6d4">Caribbean Cyan</option>
                    <option value="#2563eb">Royal Sapphire Blue</option>
                  </select>

                  <input
                    type="color"
                    value={
                      config.customOceanColor && config.customOceanColor.startsWith('#') && config.customOceanColor.length === 7
                        ? config.customOceanColor
                        : '#bae6fd'
                    }
                    onChange={(e) => {
                      onUpdateConfig((p) => ({ ...p, customOceanColor: e.target.value }));
                    }}
                    className="w-7 h-7 border border-[#121212]/20 dark:border-[#2C2C28] bg-transparent p-0 cursor-pointer rounded shrink-0"
                    title="Choose custom ocean hex color"
                  />
                </div>
              </div>

              {/* 2. SKYBOX COLOR (GLOBE ONLY) */}
              {config.projection === 'orthographic' && !isNoGeoref && (
                <div className="flex flex-col gap-2 pb-3 border-b border-[#121212]/10 dark:border-[#2C2C28]/20">
                  <label className="text-xs font-bold font-mono tracking-wide uppercase text-red-655">
                    Skybox Color (Globe Only)
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      id="sel-skybox-color"
                      value={
                        !config.customSkyboxColor || config.customSkyboxColor === 'default'
                          ? 'default'
                          : ['#09090b', '#030712', '#000000', '#f8fafc', '#ffffff'].includes(config.customSkyboxColor)
                          ? config.customSkyboxColor
                          : 'default'
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        onUpdateConfig((p) => ({ ...p, customSkyboxColor: val }));
                      }}
                      className="flex-1 text-[11px] font-mono uppercase px-2 py-1.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212] dark:border-[#2C2C28] text-[#121212] dark:text-[#FDFCF8] outline-none cursor-pointer"
                    >
                      <option value="default">Default Theme Skybox</option>
                      <option value="#09090b">Space Dark Zinc</option>
                      <option value="#030712">Midnight Dark Navy</option>
                      <option value="#000000">Deep Cosmic Black</option>
                      <option value="#f8fafc">Ambient Slate White</option>
                      <option value="#ffffff">Pure White</option>
                    </select>

                    <input
                      type="color"
                      value={
                        config.customSkyboxColor && config.customSkyboxColor.startsWith('#') && config.customSkyboxColor.length === 7
                          ? config.customSkyboxColor
                          : '#09090b'
                      }
                      onChange={(e) => {
                        onUpdateConfig((p) => ({ ...p, customSkyboxColor: e.target.value }));
                      }}
                      className="w-7 h-7 border border-[#121212]/20 dark:border-[#2C2C28] bg-transparent p-0 cursor-pointer rounded shrink-0"
                      title="Choose custom skybox hex color"
                    />
                  </div>
                </div>
              )}

              {/* 3. BASEMAP IMAGE (RASTER / GEOTIFF) */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 text-[#121212] dark:text-[#FDFCF8]">
                  <Globe size={13} className="text-red-650" />
                  <span className="text-[10px] font-mono uppercase tracking-widest font-black">Basemap Image</span>
                </div>
                <p className="text-[10px] opacity-60 leading-relaxed font-sans">
                  Custom uploading supports equirectangular maps in .png format.
                </p>
                <select
                  id="sel-bg-image"
                  value={config.bgImageFile || 'none'}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'custom') {
                      bgImageInputRef.current?.click();
                    } else {
                      onUpdateConfig((p) => ({ ...p, bgImageFile: val }));
                    }
                  }}
                  className="w-full p-2 border border-[#121212] dark:border-[#2C2C28] bg-[#FDFCF8] dark:bg-[#181816] text-[#121212] dark:text-[#FDFCF8] font-mono text-[10px] uppercase tracking-wider outline-none cursor-pointer"
                >
                  <option value="none">No Background Image</option>
                  <option value="NASA_8km.png">Blue Marble - NASA Earth Observatory</option>
                  <option value="NASA_topo_bathy_8km.png">Blue Marble (w. Topography and Bathymetry) - NASA Earth Observatory</option>
                  <option value="climate_1991_2020.png">Climate (1991 - 2020) - Beck et al. (2023)</option>
                  <option value="custom">Upload Custom File...</option>
                </select>

                <input
                  id="inp-bg-image-upload"
                  ref={bgImageInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (setCustomBgFile) setCustomBgFile(file);
                      onUpdateConfig((p) => ({ ...p, bgImageFile: 'custom' }));
                    }
                  }}
                />

                {config.bgImageFile === 'custom' && customBgFile && (
                  <div className="text-[10px] font-mono opacity-80 flex justify-between items-center bg-[#121212]/5 dark:bg-white/5 p-1.5 px-2 border border-dotted border-[#121212]/25 dark:border-white/25 mt-1">
                    <span className="truncate max-w-[150px]">{customBgFile.name}</span>
                    <button
                      onClick={() => bgImageInputRef.current?.click()}
                      className="text-red-655 hover:underline font-bold uppercase text-[9px]"
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>

              </div>
              
              {/* 4. RIVERS LAYER */}
              <div className="flex flex-col gap-1.5 pt-4 border-t border-[#121212]/10 dark:border-[#2C2C28]/20">
                
                
                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="chk-show-rivers"
                      checked={!!config.showRivers}
                      onChange={(e) => onUpdateConfig((p) => ({ ...p, showRivers: e.target.checked }))}
                      className="accent-red-650 cursor-pointer"
                    />
                    <label htmlFor="chk-show-rivers" className="text-[10px] font-mono uppercase tracking-widest font-black text-[#121212] dark:text-[#FDFCF8] cursor-pointer">
                      Show Rivers
                    </label>
                  </div>
                  {config.showRivers && (
                    <div className="flex flex-col gap-2 pt-2 border-t border-[#121212]/5 dark:border-white/5">
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="font-bold tracking-wide uppercase opacity-75">Thickness</span>
                        <span className="font-bold">{(config.riverThickness !== undefined ? config.riverThickness : 0.2).toFixed(1)}</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="3.0"
                        step="0.1"
                        value={config.riverThickness !== undefined ? config.riverThickness : 0.2}
                        onChange={(e) => onUpdateConfig((p) => ({ ...p, riverThickness: parseFloat(e.target.value) }))}
                        className="w-full h-1 bg-[#E5E5E0] dark:bg-[#2C2C28] appearance-none cursor-pointer accent-[#121212] dark:accent-red-655"
                      />
                      <div className="flex flex-col gap-1 pt-1.5 border-t border-[#121212]/10 dark:border-[#2C2C28]/30">
                        <label className="text-[10px] font-bold font-mono opacity-60 tracking-wide uppercase">
                          River Color
                        </label>
                        <div className="flex items-center gap-2">
                          <select
                            value={
                              !config.riverColor || config.riverColor === 'default'
                                ? 'default'
                                : ['#bae6fd', '#111e35', '#0d9488', '#e8e4d9', '#1c2024', '#06b6d4', '#2563eb'].includes(config.riverColor)
                                ? config.riverColor
                                : 'default'
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              onUpdateConfig((p) => ({ ...p, riverColor: val }));
                            }}
                            className="flex-1 text-[11px] font-mono uppercase px-2 py-1.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212] dark:border-[#2C2C28] text-[#121212] dark:text-[#FDFCF8] outline-none cursor-pointer"
                          >
                            <option value="default">Default River Color</option>
                            <option value="#bae6fd">Light Azure Blue</option>
                            <option value="#111e35">Deep Abyssal Navy</option>
                            <option value="#0d9488">Classic Nautical Teal</option>
                            <option value="#e8e4d9">Vintage Parchment Beige</option>
                            <option value="#1c2024">Dark Charcoal Ocean</option>
                            <option value="#06b6d4">Caribbean Cyan</option>
                            <option value="#2563eb">Royal Sapphire Blue</option>
                          </select>
                          <input
                            type="color"
                            value={config.riverColor && config.riverColor.startsWith('#') && config.riverColor.length === 7 ? config.riverColor : '#bae6fd'}
                            onChange={(e) => onUpdateConfig((p) => ({ ...p, riverColor: e.target.value }))}
                            className="w-7 h-7 border border-[#121212]/20 dark:border-[#2C2C28] bg-transparent p-0 cursor-pointer rounded shrink-0"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>              </div>

          </div>
        )}

        {/* Tab 3: LOCATIONS IMPORT & RENDERING SYSTEM */}
        {activeTab === 'locations' && (
          <div className="flex flex-col gap-4 text-[#121212] dark:text-[#FDFCF8]">

            {/* Add Custom Point Block */}
            <div className="bg-[#FDFCF8] dark:bg-[#181816] p-4 border border-[#121212] dark:border-[#2C2C28] flex flex-col gap-3">
              <div className="flex items-center justify-between text-[#121212] dark:text-[#FDFCF8]">
                <div className="flex items-center gap-1.5">
                  <Plus size={13} className="text-red-650" />
                  <span className="text-[10px] font-mono uppercase tracking-widest font-black">ADD NEW LOCATION</span>
                </div>
                <PointSymbolPreview shape={newPointShape} color={newPointColor} size={14} />
              </div>

              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="Name"
                  value={newPointName}
                  onChange={(e) => setNewPointName(e.target.value)}
                  className="w-full text-xs font-mono px-2.5 py-1.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212] dark:border-[#2C2C28] text-[#121212] dark:text-[#FDFCF8] outline-none"
                />
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="number"
                    step="any"
                    placeholder="Latitude"
                    value={newPointLat}
                    onChange={(e) => setNewPointLat(e.target.value)}
                    className="w-full text-xs font-mono px-2 py-1.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212] dark:border-[#2C2C28] text-[#121212] dark:text-[#FDFCF8] outline-none"
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="Longitude"
                    value={newPointLon}
                    onChange={(e) => setNewPointLon(e.target.value)}
                    className="w-full text-xs font-mono px-2 py-1.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212] dark:border-[#2C2C28] text-[#121212] dark:text-[#FDFCF8] outline-none"
                  />
                </div>

                {/* Assign Shape, Color, and Size in faint box */}
                <div className="bg-[#E5E5E0]/30 dark:bg-black/20 p-2.5 border border-[#121212]/10 dark:border-[#2C2C28] flex flex-col gap-2.5">
                  <div className="grid grid-cols-3 gap-2 items-end">
                    {/* Shape */}
                    <div className="flex flex-col gap-1 col-span-1">
                      <label className="text-[9px] font-mono opacity-60 uppercase">Shape</label>
                      <select
                        value={newPointShape}
                        onChange={(e) => setNewPointShape(e.target.value)}
                        className="w-full text-[10px] font-mono px-1 py-1 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212] dark:border-[#2C2C28] text-[#121212] dark:text-[#FDFCF8] outline-none cursor-pointer truncate"
                      >
                        <option value="dot">Dot</option>
                        <option value="black_dot">Black Dot</option>
                        <option value="red_circle">Circle</option>
                        <option value="white_circle">White Circle</option>
                        <option value="red_square">Square</option>
                        <option value="white_square">White Square</option>
                        <option value="triangle">Triangle</option>
                        <option value="diamond">Diamond</option>
                        <option value="star">Star</option>
                        <option value="pin">Map Pin</option>
                        <option value="cross">Cross</option>
                      </select>
                    </div>
                    {/* Color */}
                    <div className="flex flex-col gap-1 col-span-1">
                      <label className="text-[9px] font-mono opacity-60 uppercase">Color</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="color"
                          value={newPointColor}
                          onChange={(e) => setNewPointColor(e.target.value)}
                          className="w-5 h-6 rounded border border-black/20 p-0 cursor-pointer bg-transparent shrink-0"
                        />
                        <input
                          type="text"
                          value={newPointColor}
                          onChange={(e) => setNewPointColor(e.target.value)}
                          className="w-full text-[9px] font-mono px-1 py-0.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212] dark:border-[#2C2C28] text-[#121212] dark:text-[#FDFCF8] uppercase truncate"
                        />
                      </div>
                    </div>
                    {/* Size */}
                    <div className="flex flex-col gap-1 col-span-1">
                      <div className="flex justify-between text-[9px] font-mono">
                        <span className="opacity-60 uppercase">Size</span>
                        <span className="font-bold">{newPointSize}</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="18"
                        step="0.5"
                        value={newPointSize}
                        onChange={(e) => setNewPointSize(parseFloat(e.target.value))}
                        className="w-full h-1 bg-[#E5E5E0] dark:bg-[#2C2C28] appearance-none cursor-pointer accent-[#121212] dark:accent-red-655"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleAddCustomPoint}
                  disabled={!newPointName.trim() || newPointLat === '' || newPointLon === ''}
                  className="w-full mt-1 py-2 font-mono text-[10px] uppercase font-bold tracking-widest border border-[#121212] dark:border-[#2C2C28] bg-[#121212] dark:bg-[#FDFCF8] text-[#FDFCF8] dark:text-[#121212] hover:bg-[#333] dark:hover:bg-[#fff] disabled:opacity-40 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus size={12} />
                  <span>Add Point</span>
                </button>
              </div>
            </div>

            {/* Locations List Block */}
            <div className="bg-[#FDFCF8] dark:bg-[#181816] p-4 border border-[#121212] dark:border-[#2C2C28] flex flex-col gap-3">
              <div className="flex items-center justify-between text-[#121212] dark:text-[#FDFCF8]">
                <div className="flex items-center gap-1.5">
                  <MapPin size={13} className="text-red-650" />
                  <span className="text-[10px] font-mono uppercase tracking-widest font-black">LOCATIONS LIST</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono opacity-60">({importedLocations.length} TOTAL)</span>
                  {importedLocations.length > 0 && (
                    <button
                      id="btn-clear-locations"
                      onClick={() => setImportedLocations([])}
                      className="px-1.5 py-0.5 text-[9px] font-mono uppercase font-bold tracking-wider border border-red-600/30 text-red-650 hover:bg-red-650 hover:text-white transition cursor-pointer"
                      title="Clear all points"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {importedLocations.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-2.5 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="Search points..."
                      value={pointSearchQuery}
                      onChange={(e) => setPointSearchQuery(e.target.value)}
                      className="w-full text-xs font-mono pl-7 pr-2 py-1.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212] dark:border-[#2C2C28] text-[#121212] dark:text-[#FDFCF8] outline-none"
                    />
                  </div>

                  <div className="max-h-72 overflow-y-auto flex flex-col gap-2 border border-[#121212]/10 dark:border-white/10 p-1.5 bg-[#121212]/5 dark:bg-white/5">
                    {(() => {
                      const groupsMap: Record<string, MapLocation[]> = {};
                      importedLocations.forEach(loc => {
                        const gName = (loc.group || (loc.isCustom ? 'Custom Points' : 'Imported Locations')).trim();
                        if (!groupsMap[gName]) groupsMap[gName] = [];
                        groupsMap[gName].push(loc);
                      });

                      const groupEntries = Object.entries(groupsMap);

                      return groupEntries.map(([groupName, groupPoints]) => {
                        const filteredGroupPoints = groupPoints.filter(p => p.name.toLowerCase().includes(pointSearchQuery.toLowerCase()));
                        if (pointSearchQuery && filteredGroupPoints.length === 0) return null;

                        const samplePoint = groupPoints[0];
                        const groupShape = samplePoint?.symbolShape || 'black_dot';
                        const groupColor = samplePoint?.symbolColor || '#059669';
                        const groupSize = samplePoint?.symbolSize || 2;
                        const isEditingGroup = editingGroupId === groupName;

                        return (
                          <div
                            key={groupName}
                            className="flex flex-col border border-[#121212]/15 dark:border-white/15 bg-[#FDFCF8] dark:bg-[#181816]"
                          >
                            {/* Group Header Bar */}
                            <div className="flex items-center justify-between p-2 bg-[#121212]/5 dark:bg-white/5 border-b border-[#121212]/10 dark:border-white/10">
                              <div className="flex items-center gap-2 truncate pr-2">
                                <PointSymbolPreview shape={groupShape} color={groupColor} size={14} />
                                <span className="font-mono font-bold text-[11px] uppercase tracking-wider truncate">
                                  {groupName}
                                </span>
                                <span className="text-[9px] font-mono opacity-60 shrink-0">
                                  ({groupPoints.length})
                                </span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => setEditingGroupId(isEditingGroup ? null : groupName)}
                                  className={`p-1 transition cursor-pointer ${
                                    isEditingGroup
                                      ? 'text-red-650 bg-[#121212]/10 dark:bg-white/10'
                                      : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                                  }`}
                                  title="Customize group style & name"
                                >
                                  <Settings size={12} />
                                </button>
                                <button
                                  onClick={() => handleRemoveGroup(groupName)}
                                  title="Remove entire group"
                                  className="p-1 text-red-500 hover:bg-red-500/10 hover:text-red-600 transition cursor-pointer"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>

                            {/* Group Style Settings Panel */}
                            {isEditingGroup && (
                              <div className="flex flex-col gap-2 p-2.5 bg-[#121212]/5 dark:bg-white/5 border-b border-[#121212]/10 dark:border-white/10">
                                <div className="text-[9px] font-mono uppercase font-bold opacity-80">
                                  Group Style & Name Settings
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-[8px] font-mono opacity-70 uppercase font-bold">Group Name</label>
                                  <input
                                    type="text"
                                    value={groupName}
                                    onChange={(e) => handleUpdateGroupStyle(groupName, { groupName: e.target.value })}
                                    className="text-[10px] font-mono px-1.5 py-1 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212]/20 dark:border-white/20 text-[#121212] dark:text-[#FDFCF8]"
                                  />
                                </div>
                                <div className="grid grid-cols-3 gap-1.5 items-end">
                                  <div className="flex flex-col gap-0.5 col-span-1">
                                    <label className="text-[8px] font-mono opacity-70 uppercase font-bold">Shape</label>
                                    <select
                                      value={groupShape}
                                      onChange={(e) => handleUpdateGroupStyle(groupName, { symbolShape: e.target.value })}
                                      className="text-[10px] font-mono px-1 py-1 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212]/20 dark:border-white/20 text-[#121212] dark:text-[#FDFCF8] outline-none"
                                    >
                                      <option value="dot">Dot</option>
                                      <option value="black_dot">Black Dot</option>
                                      <option value="red_circle">Circle</option>
                                      <option value="white_circle">White Circle</option>
                                      <option value="red_square">Square</option>
                                      <option value="white_square">White Square</option>
                                      <option value="triangle">Triangle</option>
                                      <option value="diamond">Diamond</option>
                                      <option value="star">Star</option>
                                      <option value="pin">Map Pin</option>
                                      <option value="cross">Cross</option>
                                    </select>
                                  </div>
                                  <div className="flex flex-col gap-0.5 col-span-1">
                                    <label className="text-[8px] font-mono opacity-70 uppercase font-bold">Color</label>
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="color"
                                        value={groupColor}
                                        onChange={(e) => handleUpdateGroupStyle(groupName, { symbolColor: e.target.value })}
                                        className="w-5 h-5 cursor-pointer border border-[#121212]/20 dark:border-white/20 p-0 bg-transparent shrink-0"
                                      />
                                      <input
                                        type="text"
                                        value={groupColor}
                                        onChange={(e) => handleUpdateGroupStyle(groupName, { symbolColor: e.target.value })}
                                        className="w-full text-[9px] font-mono px-1 py-0.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212]/20 dark:border-white/20 uppercase"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex flex-col gap-0.5 col-span-1">
                                    <div className="flex justify-between text-[8px] font-mono">
                                      <span className="opacity-70 uppercase font-bold">Size</span>
                                      <span className="font-bold">{groupSize}</span>
                                    </div>
                                    <input
                                      type="range"
                                      min={0.5}
                                      max={18}
                                      step={0.5}
                                      value={groupSize}
                                      onChange={(e) => handleUpdateGroupStyle(groupName, { symbolSize: Number(e.target.value) })}
                                      className="w-full h-1 bg-[#E5E5E0] dark:bg-[#2C2C28] appearance-none cursor-pointer accent-[#121212] dark:accent-red-655"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Points inside Group */}
                            <div className="flex flex-col p-1 gap-1">
                              {filteredGroupPoints.slice(0, 50).map(loc => (
                                <div
                                  key={loc.id}
                                  className="flex flex-col gap-1 p-1.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212]/5 dark:border-white/5"
                                >
                                  <div className="flex items-center justify-between text-xs font-mono">
                                    <div className="flex items-center gap-2 truncate pr-2">
                                      <PointSymbolPreview
                                        shape={loc.symbolShape || groupShape}
                                        color={loc.symbolColor || groupColor}
                                        size={12}
                                      />
                                      <div className="flex flex-col truncate">
                                        <span className="font-bold truncate text-[10px]">
                                          {loc.name}
                                        </span>
                                        <span className="text-[8px] opacity-60">
                                          {loc.latitude.toFixed(2)}°, {loc.longitude.toFixed(2)}°
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        onClick={() => setEditingPointId(editingPointId === loc.id ? null : loc.id)}
                                        className={`p-1 transition cursor-pointer ${
                                          editingPointId === loc.id
                                            ? 'text-red-650 bg-[#121212]/10 dark:bg-white/10'
                                            : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                                        }`}
                                        title="Customize individual point style"
                                      >
                                        <Settings size={10} />
                                      </button>
                                      <button
                                        onClick={() => handleRemovePoint(loc.id)}
                                        title="Remove point"
                                        className="p-1 text-red-500 hover:bg-red-500/10 hover:text-red-600 transition cursor-pointer"
                                      >
                                        <Trash2 size={10} />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Individual Point Style Sub-Panel */}
                                  {editingPointId === loc.id && (
                                    <div className="flex flex-col gap-2 pt-2 mt-1 border-t border-[#121212]/10 dark:border-white/10 bg-[#121212]/5 dark:bg-white/5 p-2">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[9px] font-mono uppercase font-bold opacity-80">
                                          Point Override
                                        </span>
                                        <PointSymbolPreview
                                          shape={loc.symbolShape || groupShape}
                                          color={loc.symbolColor || groupColor}
                                          size={12}
                                        />
                                      </div>
                                      <div className="grid grid-cols-2 gap-1.5">
                                        <div className="flex flex-col gap-0.5">
                                          <label className="text-[8px] font-mono opacity-70 uppercase font-bold">Shape</label>
                                          <select
                                            value={loc.symbolShape || groupShape}
                                            onChange={(e) => handleUpdatePointStyle(loc.id, { symbolShape: e.target.value })}
                                            className="text-[10px] font-mono px-1.5 py-1 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212]/20 dark:border-white/20 text-[#121212] dark:text-[#FDFCF8]"
                                          >
                                            <option value="dot">Dot</option>
                                            <option value="black_dot">Black Dot</option>
                                            <option value="red_circle">Circle</option>
                                            <option value="white_circle">White Circle</option>
                                            <option value="red_square">Square</option>
                                            <option value="white_square">White Square</option>
                                            <option value="triangle">Triangle</option>
                                            <option value="diamond">Diamond</option>
                                            <option value="star">Star</option>
                                            <option value="pin">Map Pin</option>
                                            <option value="cross">Cross</option>
                                          </select>
                                        </div>
                                        <div className="flex flex-col gap-0.5">
                                          <label className="text-[8px] font-mono opacity-70 uppercase font-bold">Color</label>
                                          <div className="flex items-center gap-1">
                                            <input
                                              type="color"
                                              value={loc.symbolColor || groupColor}
                                              onChange={(e) => handleUpdatePointStyle(loc.id, { symbolColor: e.target.value })}
                                              className="w-5 h-5 cursor-pointer border border-[#121212]/20 dark:border-white/20 p-0 bg-transparent shrink-0"
                                            />
                                            <input
                                              type="text"
                                              value={loc.symbolColor || groupColor}
                                              onChange={(e) => handleUpdatePointStyle(loc.id, { symbolColor: e.target.value })}
                                              className="w-full text-[9px] font-mono px-1 py-0.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212]/20 dark:border-white/20 uppercase"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[8px] font-mono opacity-70 shrink-0">Size: {loc.symbolSize || groupSize}</span>
                                        <input
                                          type="range"
                                          min={0.5}
                                          max={18}
                                          step={0.5}
                                          value={loc.symbolSize || groupSize}
                                          onChange={(e) => handleUpdatePointStyle(loc.id, { symbolSize: Number(e.target.value) })}
                                          className="w-full h-1 bg-[#E5E5E0] dark:bg-[#2C2C28] appearance-none cursor-pointer accent-[#121212] dark:accent-red-655"
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              ) : (
                <div className="text-[10px] font-mono text-center opacity-60 py-2">
                  No locations in list.
                </div>
              )}
            </div>

            {/* Config Block */}
            <div className="bg-[#FDFCF8] dark:bg-[#181816] p-4 border border-[#121212] dark:border-[#2C2C28] flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 text-[#121212] dark:text-[#FDFCF8]">
                  <Download size={13} className="text-red-650" />
                  <span className="text-[10px] font-mono uppercase tracking-widest font-black">Import locations</span>
                </div>
                <p className="text-[10px] opacity-60 leading-relaxed font-sans">
                  Filter and import cities, towns, and capitals into your map dataset.
                </p>
              </div>

              {/* Assign Shape, Color, and Size */}
              <div className="bg-[#E5E5E0]/30 dark:bg-black/20 p-2.5 border border-[#121212]/10 dark:border-[#2C2C28] flex flex-col gap-2.5">
                <div className="grid grid-cols-3 gap-2 items-end">
                  {/* Shape */}
                  <div className="flex flex-col gap-1 col-span-1">
                    <label className="text-[9px] font-mono opacity-60 uppercase">Shape</label>
                    <select
                      value={importSymbolShape}
                      onChange={(e) => setImportSymbolShape(e.target.value)}
                      className="w-full text-[10px] font-mono px-1 py-1 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212] dark:border-[#2C2C28] text-[#121212] dark:text-[#FDFCF8] outline-none cursor-pointer truncate"
                    >
                      <option value="dot">Dot</option>
                      <option value="black_dot">Black Dot</option>
                      <option value="red_circle">Circle</option>
                      <option value="white_circle">White Circle</option>
                      <option value="red_square">Square</option>
                      <option value="white_square">White Square</option>
                      <option value="triangle">Triangle</option>
                      <option value="diamond">Diamond</option>
                      <option value="star">Star</option>
                      <option value="pin">Map Pin</option>
                      <option value="cross">Cross</option>
                    </select>
                  </div>
                  {/* Color */}
                  <div className="flex flex-col gap-1 col-span-1">
                    <label className="text-[9px] font-mono opacity-60 uppercase">Color</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="color"
                        value={importSymbolColor}
                        onChange={(e) => setImportSymbolColor(e.target.value)}
                        className="w-5 h-6 rounded border border-black/20 p-0 cursor-pointer bg-transparent shrink-0"
                      />
                      <input
                        type="text"
                        value={importSymbolColor}
                        onChange={(e) => setImportSymbolColor(e.target.value)}
                        className="w-full text-[9px] font-mono px-1 py-0.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212] dark:border-[#2C2C28] text-[#121212] dark:text-[#FDFCF8] uppercase truncate"
                      />
                    </div>
                  </div>
                  {/* Size */}
                  <div className="flex flex-col gap-1 col-span-1">
                    <div className="flex justify-between text-[9px] font-mono">
                      <span className="opacity-60 uppercase">Size</span>
                      <span className="font-bold">{importSymbolSize}</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="18"
                      step="0.5"
                      value={importSymbolSize}
                      onChange={(e) => setImportSymbolSize(parseFloat(e.target.value))}
                      className="w-full h-1 bg-[#E5E5E0] dark:bg-[#2C2C28] appearance-none cursor-pointer accent-[#121212] dark:accent-red-655"
                    />
                  </div>
                </div>
              </div>

              {/* Group / List Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono opacity-60 uppercase">Group / List name</label>
                <input
                  type="text"
                  placeholder="e.g. National Capitals"
                  value={importGroupName}
                  onChange={(e) => setImportGroupName(e.target.value)}
                  className="w-full text-xs font-mono px-2 py-1.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212] dark:border-[#2C2C28] text-[#121212] dark:text-[#FDFCF8] outline-none"
                />
              </div>

              {/* 1. Population Filter */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-mono opacity-60 uppercase">Population range</label>
                <select
                  id="sel-import-pop"
                  value={importPopRange}
                  onChange={(e) => setImportPopRange(e.target.value)}
                  className="w-full text-xs font-mono px-2 py-1.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212] dark:border-[#2C2C28] text-[#121212] dark:text-[#FDFCF8] outline-none cursor-pointer"
                >
                  <option value="all">All (No filter)</option>
                  <option value="above50k">&gt;= 50,000</option>
                  <option value="above100k">&gt;= 100,000</option>
                  <option value="above1M">&gt;= 1,000,000</option>
                  <option value="above10M">&gt;= 10,000,000</option>
                </select>
              </div>

              {/* 2. Groupings checkboxes */}
              <div className="flex flex-col gap-1 text-[11px] font-mono">
                <label className="flex items-center gap-2 cursor-pointer py-1">
                  <input
                    id="chk-cat-admin0"
                    type="checkbox"
                    checked={importClasses.admin0}
                    onChange={(e) => setImportClasses(prev => ({ ...prev, admin0: e.target.checked }))}
                    className="accent-[#121212] dark:accent-red-655 cursor-pointer shadow-none"
                  />
                  <span className="ml-1">National capitals only</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer py-1">
                  <input
                    id="chk-cat-admin1"
                    type="checkbox"
                    checked={importClasses.admin1}
                    onChange={(e) => setImportClasses(prev => ({ ...prev, admin1: e.target.checked }))}
                    className="accent-[#121212] dark:accent-red-655 cursor-pointer shadow-none"
                  />
                  <span className="ml-1">State/provincial capitals only</span>
                </label>
              </div>

              {/* 3. CTA Action Import Button */}
              <button
                id="btn-import-locations"
                onClick={handleImportLocations}
                disabled={isImporting}
                className={`w-full py-2.5 font-mono text-[10px] uppercase font-black tracking-widest border border-[#121212] dark:border-[#2C2C28] flex items-center justify-center gap-2 transition cursor-pointer ${
                  isImporting 
                    ? 'bg-neutral-100 dark:bg-zinc-800 text-neutral-400 cursor-not-allowed'
                    : 'bg-[#121212] dark:bg-[#FDFCF8] text-[#FDFCF8] dark:text-[#121212] hover:bg-[#333] dark:hover:bg-[#fff]'
                }`}
              >
                {isImporting ? (
                  <>
                    <RefreshCw size={12} className="animate-spin text-red-650" />
                    <span>{importStatus}</span>
                  </>
                ) : (
                  <>
                    <MapPin size={12} className="text-red-650" />
                    <span>{importedLocations.length > 0 ? 'IMPORT LOCATIONS' : 'IMPORT LOCATIONS'}</span>
                  </>
                )}
              </button>
            </div>

            {/* Display custom styles section */}
            <div className="bg-[#FDFCF8] dark:bg-[#181816] p-4 border border-[#121212] dark:border-[#2C2C28] flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 text-[#121212] dark:text-[#FDFCF8]">
                  <Sliders size={13} className="text-red-650" />
                  <span className="text-[10px] font-mono uppercase tracking-widest font-black">Display & Canvas Style</span>
                </div>
                <p className="text-[10px] opacity-60 leading-relaxed font-sans">
                  Customize visibility, label sizing, and text styling.
                </p>
              </div>

              {/* Toggle visibility of markers */}
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs font-bold font-mono tracking-wide">SHOW POINTS</span>
                <button
                  id="toggle-show-pins"
                  onClick={() => setShowLocations(!showLocations)}
                  className="px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider border border-[#121212] dark:border-[#2C2C28] bg-[#FDFCF8] dark:bg-[#181816] text-[#121212] dark:text-[#FDFCF8] hover:bg-[#121212] hover:text-[#FDFCF8] dark:hover:bg-[#FDFCF8] dark:hover:text-[#121212] transition-all cursor-pointer"
                >
                  {showLocations ? 'HIDE' : 'SHOW'}
                </button>
              </div>

              {/* Toggle visibility of labels */}
              <div className="flex items-center justify-between py-1.5 border-t border-[#121212]/5 dark:border-white/5">
                <span className="text-xs font-bold font-mono tracking-wide">SHOW LABELS</span>
                <button
                  id="toggle-show-loc-labels"
                  onClick={() => setShowLocationLabels(!showLocationLabels)}
                  className="px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider border border-[#121212] dark:border-[#2C2C28] bg-[#FDFCF8] dark:bg-[#181816] text-[#121212] dark:text-[#FDFCF8] hover:bg-[#121212] hover:text-[#FDFCF8] dark:hover:bg-[#FDFCF8] dark:hover:text-[#121212] transition-all cursor-pointer"
                >
                  {showLocationLabels ? 'HIDE' : 'SHOW'}
                </button>
              </div>

              {/* Label Font size slider */}
              <div className="flex flex-col gap-1.5 py-1.5 border-t border-[#121212]/5 dark:border-white/5">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="opacity-60 uppercase">Label font size</span>
                  <span className="font-bold">{locationLabelSize}</span>
                </div>
                <input
                  id="rng-loc-label-size"
                  type="range"
                  min="0.5"
                  max="18"
                  step="0.5"
                  value={locationLabelSize}
                  onChange={(e) => setLocationLabelSize(parseFloat(e.target.value))}
                  className="w-full h-1 bg-[#E5E5E0] dark:bg-[#2C2C28] appearance-none cursor-pointer accent-[#121212] dark:accent-red-655"
                />
              </div>
              {/* Outline font size slider (Location labels) */}
              <div className="flex flex-col gap-1.5 py-1.5 border-t border-[#121212]/5 dark:border-white/5">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="opacity-60 uppercase">Outline font size</span>
                  <span className="font-bold">{Math.round(locationLabelOutlineRatio * 100)}%</span>
                </div>
                <input
                  id="rng-loc-label-outline-size"
                  type="range"
                  min="0.00"
                  max="0.50"
                  step="0.01"
                  value={locationLabelOutlineRatio}
                  onChange={(e) => setLocationLabelOutlineRatio(parseFloat(e.target.value))}
                  className="w-full h-1 bg-[#E5E5E0] dark:bg-[#2C2C28] appearance-none cursor-pointer accent-[#121212] dark:accent-red-655"
                />
              </div>

            </div>
          </div>
        )}

        {/* Tab: EXPORT OPTIONS */}
        {activeTab === 'export' && (
          <div className="p-4 flex flex-col gap-4 text-[#121212] dark:text-[#FDFCF8]">
            
            {/* TopoJSON Save/Load Section */}
            <div className="p-4 border border-[#121212] dark:border-[#2C2C28] bg-[#FDFCF8] dark:bg-[#181816] flex flex-col gap-4 shadow-sm">
              <div className="flex items-center gap-2 text-[#121212] dark:text-[#FDFCF8]">
                <Database size={15} className="text-purple-650" />
                <span className="text-[11px] font-mono uppercase tracking-widest font-black">Save / Load Map</span>
              </div>
              
              <div className="flex flex-col gap-2 mt-1">
                <button
                  type="button"
                  onClick={onExportTopoJSON}
                  className="w-full py-3 px-4 bg-[#121212] dark:bg-[#FDFCF8] hover:bg-[#333] dark:hover:bg-[#e0e0e0] text-[#FDFCF8] dark:text-[#121212] transition text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.99]"
                >
                  <Download size={14} />
                  <span>Save TopoJSON Project</span>
                </button>
                <div className="relative w-full">
                  <input 
                    type="file"
                    accept=".json"
                    onChange={onImportTopoJSON}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <button
                    type="button"
                    className="w-full py-3 px-4 bg-transparent border border-[#121212] dark:border-[#FDFCF8] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[#121212] dark:text-[#FDFCF8] transition text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.99]"
                  >
                    <Download size={14} className="rotate-180" />
                    <span>Load TopoJSON Project</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 border border-[#121212] dark:border-[#2C2C28] bg-[#FDFCF8] dark:bg-[#181816] flex flex-col gap-4 shadow-sm">
              <div className="flex items-center gap-2 text-[#121212] dark:text-[#FDFCF8]">
                <Download size={15} className="text-red-650" />
                <span className="text-[11px] font-mono uppercase tracking-widest font-black">Export Image</span>
              </div>
              <p className="text-[10px] opacity-65 leading-relaxed font-sans">

                Export high-resolution PNG image of your map graphic.
              </p>

              {/* Resolution / Scale Multiplier Options */}
              <div className="flex flex-col gap-1.5 pt-2 border-t border-[#121212]/10 dark:border-[#2C2C28]/20">
                <label className="text-xs font-mono uppercase opacity-75">Export Resolution</label>
                <div className="grid grid-cols-4 gap-1 bg-white dark:bg-[#121212] p-1 border border-[#121212]/20 dark:border-[#2C2C28] rounded-sm">
                  {[1, 2, 4, 8].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setExportScaleMultiplier(s)}
                      className={`py-1.5 text-[11px] font-mono font-bold transition rounded-xs ${
                        exportScaleMultiplier === s
                          ? 'bg-[#121212] dark:bg-[#FDFCF8] text-[#FDFCF8] dark:text-[#121212]'
                          : 'text-[#121212]/70 dark:text-[#FDFCF8]/70 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 mt-1">
                <button
                  id="btn-export-png-tab"
                  onClick={() => onExportPNG?.(exportScaleMultiplier)}
                  className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white transition text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.99]"
                >
                  <Download size={14} />
                  <span>Export PNG ({exportScaleMultiplier}x)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: PAINT CANVAS AND PALETTE SELECTION (The main powerhouse!) */}
        {activeTab === 'paint' && (
          <div className="flex flex-col gap-4 text-[#121212] dark:text-[#FDFCF8]">
            
            {/* Map File Switcher Dropdown & Map Data Source Selector */}
            {selectedMapFile !== undefined && onSelectMapFile !== undefined && (
              <div className="p-4 border border-[#121212] dark:border-[#2C2C28] bg-[#FDFCF8] dark:bg-[#181816] flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-1.5 text-[#121212] dark:text-[#FDFCF8]">
                    <Database size={13} className="text-red-650" />
                    <span className="text-[10px] font-mono uppercase tracking-widest font-black">Map selection</span>
                  </div>
                  <p className="text-[10px] opacity-60 leading-relaxed font-sans">
                    Custom uploading supports .geojson and .topojson formats.
                  </p>
                  <select
                    id="sel-map-datasource"
                    value={selectedMapFile}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'custom') {
                        fileInputRef.current?.click();
                      } else {
                        onSelectMapFile(val);
                      }
                    }}
                    className="w-full p-2 border border-[#121212] dark:border-[#2C2C28] bg-[#FDFCF8] dark:bg-[#181816] text-[#121212] dark:text-[#FDFCF8] font-mono text-[10px] uppercase tracking-wider outline-none cursor-pointer"
                  >
                    <option value="world.json">World Map (Simple) - Natural Earth</option>
                    <option value="world_adm1.json">World Map (First-level Subdivisions) - Overture Maps Foundation</option>
                    <option value="mappa_mundi_hoi4.json">Mappa Mundi (HOI4 Mod - 20409 Polygons)</option>
                    <option value="world_ecoregions.json">World Ecoregions - World Wildlife Fund</option>
                    <option value="custom">Upload Custom File...</option>
                  </select>

                  <input
                    id="inp-geojson-upload"
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.geojson,.topojson"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {selectedMapFile === 'custom' && (
                    <div className="text-[10px] font-mono opacity-80 flex justify-between items-center bg-[#121212]/5 dark:bg-white/5 p-1.5 px-2 border border-dotted border-[#121212]/25 dark:border-white/25 mt-1">
                      <span className="truncate max-w-[150px]">{currentFileName || 'Custom File'}</span>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-red-650 hover:underline font-bold uppercase text-[9px]"
                      >
                        Change
                      </button>
                    </div>
                  )}

                  {errorMsg && (
                    <span className="text-[9px] text-red-650 font-mono mt-1 text-center font-semibold uppercase tracking-wider block">
                      ⚠️ {errorMsg}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Action Tool picker */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-mono tracking-wider uppercase opacity-80">Brush Tool</span>
              <div className="grid grid-cols-3 gap-1.5 bg-[#E5E5E0] dark:bg-[#181816] p-1.5 border border-[#121212] dark:border-[#2C2C28]">
                <button
                  onClick={() => setActiveTool('paint')}
                  className={`py-2.5 text-xs font-mono tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition ${
                    activeTool === 'paint'
                      ? 'bg-[#121212] dark:bg-[#FDFCF8] text-[#FDFCF8] dark:text-[#121212] font-bold shadow-sm'
                      : 'hover:bg-neutral-200 dark:hover:bg-zinc-800 text-neutral-700 dark:text-neutral-300'
                  }`}
                  title="Paint Mode: Color any land click"
                >
                  <Paintbrush size={14} />
                  <span>PAINT</span>
                </button>

                <button
                  onClick={() => setActiveTool('eraser')}
                  className={`py-2.5 text-xs font-mono tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition ${
                    activeTool === 'eraser'
                      ? 'bg-[#121212] dark:bg-[#FDFCF8] text-[#FDFCF8] dark:text-[#121212] font-bold shadow-sm'
                      : 'hover:bg-neutral-200 dark:hover:bg-zinc-800 text-neutral-700 dark:text-neutral-300'
                  }`}
                  title="Eraser: Reset clicked land to default white"
                >
                  <Eraser size={14} />
                  <span>ERASER</span>
                </button>

                <button
                  onClick={() => setActiveTool('picker')}
                  className={`py-2.5 text-xs font-mono tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition ${
                    activeTool === 'picker'
                      ? 'bg-[#121212] dark:bg-[#FDFCF8] text-[#FDFCF8] dark:text-[#121212] font-bold shadow-sm'
                      : 'hover:bg-neutral-200 dark:hover:bg-zinc-800 text-neutral-700 dark:text-neutral-300'
                  }`}
                  title="Eyedropper/Picker: Click land to pick up its color"
                >
                  <Pipette size={14} />
                  <span>PICKER</span>
                </button>
              </div>
            </div>

            {/* Swipe selection Toggle */}
            <div className="flex items-center justify-between p-2.5 bg-[#E5E5E0]/40 dark:bg-[#181816]/40 border border-[#121212]/10 dark:border-[#2C2C28]/25 rounded-sm">
              <span className="text-xs font-mono tracking-wider uppercase opacity-80">Swipe selection</span>
              <button
                type="button"
                onClick={() => onUpdateConfig(p => ({ ...p, swipeSelection: !p.swipeSelection }))}
                className={`px-3 py-1.5 text-xs font-mono tracking-wider border cursor-pointer uppercase transition-all ${
                  config.swipeSelection
                    ? 'bg-[#121212] border-[#121212] text-white dark:bg-[#FDFCF8] dark:border-[#FDFCF8] dark:text-[#121212]'
                    : 'bg-transparent border-[#121212]/20 text-[#121212]/70 dark:border-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-zinc-800'
                }`}
              >
                {config.swipeSelection ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            {/* Paint/Erase Scope / Mode Selector */}
            {setBrushScope && (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-mono tracking-wider uppercase opacity-80">Brush Group</span>
                <div className="flex flex-col gap-1">
                  <select
                    id="sel-brush-scope"
                    value={brushScope}
                    onChange={(e) => setBrushScope(e.target.value)}
                    className="w-full p-2 border border-[#121212] dark:border-[#2C2C28] bg-[#FDFCF8] dark:bg-[#181816] text-[#121212] dark:text-[#FDFCF8] font-mono text-xs uppercase tracking-wider outline-none cursor-pointer"
                  >
                    <option value="single">Individual</option>
                    {availableHierarchies.map((h) => (
                      <option key={h.key} value={h.key}>
                        {`Group by ${h.label} (${h.uniqueCount} groups)`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Custom Palette Swatches selector */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-mono tracking-widest uppercase font-bold">Color Swatches</span>
                <select
                  value={paletteTheme}
                  onChange={(e) => setPaletteTheme(e.target.value as any)}
                  className="text-xs font-mono uppercase bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212]/30 dark:border-[#2C2C28] py-0.5 px-1.5 cursor-pointer outline-none"
                >
                  <option value="vibrant">Vibrant Swatches</option>
                  <option value="pastels">Pastel Tones</option>
                  <option value="vintage">Legacy Vintage</option>
                </select>
              </div>

              {/* Grid of colors */}
              <div className="grid grid-cols-6 gap-2 bg-[#FDFCF8] dark:bg-[#181816] p-3 border border-[#121212] dark:border-[#2C2C28]">
                {PRESET_PALETTES[paletteTheme].map((hex) => {
                  const isSelected = isPatternActive 
                    ? (activeColorTarget === 'base' ? baseColorHex === hex : patternColorHex === hex)
                    : paintColor === hex;

                  return (
                    <button
                      key={hex}
                      onClick={() => handleColorChange(hex)}
                      style={{ backgroundColor: hex }}
                      className={`h-8 w-full border transition active:scale-95 cursor-pointer relative ${
                        isSelected && activeTool === 'paint'
                          ? 'border-black dark:border-white scale-110 ring-2 ring-red-500 z-10'
                          : 'border-[#121212]/15 hover:border-[#121212]'
                      }`}
                      title={hex}
                    >
                      {isSelected && activeTool === 'paint' && (
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-white mix-blend-difference font-black">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Flag Selection Indicator */}
              {paintColor.startsWith('flag:') && (
                <div className="flex items-center gap-2 bg-[#121212] text-white dark:bg-[#FDFCF8] dark:text-[#121212] p-2 mt-2 border border-[#121212]">
                  <FlagImage
                    code={paintColor.substring(5)}
                    className="w-6 h-4 object-cover border border-white/20 dark:border-black/20 rounded-sm"
                    alt="Active Flag"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-[8px] font-mono opacity-60 uppercase leading-none block">Active Brush (Custom Flag)</span>
                    <span className="text-xs font-mono font-bold uppercase truncate block">
                      {FLAG_COUNTRIES.find(c => c.code === paintColor.substring(5))?.name ||
                       customSvgFlags.find(f => f.url === paintColor.substring(5))?.name ||
                       (paintColor.startsWith('flag:data:') ? 'Custom Uploaded SVG Flag' : paintColor.substring(5).toUpperCase())}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPaintColor('#3b82f6');
                    }}
                    className="text-red-500 hover:text-red-400 font-bold px-1.5 font-mono text-xs cursor-pointer"
                    title="Clear Flag Brush"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            {/* Pattern Texture Brush Selection (Mapchart/QGIS feature) */}
            <div className="flex flex-col gap-2 p-3 bg-[#121212]/5 dark:bg-white/5 border border-[#121212] dark:border-[#2C2C28]">
              <span className="text-xs font-mono tracking-widest uppercase font-bold">
                Pattern Texture Brush
              </span>
              <p className="text-xs opacity-70 leading-normal font-sans">
                Choose a textured pattern fill and combine a base color with pattern color to paint details.
              </p>
              
              <div className="grid grid-cols-2 gap-2 mt-1">
                {[
                  { id: 'solid', label: 'Solid Color' },
                  { id: 'stripes-45', label: 'Diagonal L' },
                  { id: 'stripes-135', label: 'Diagonal R' },
                  { id: 'dots', label: 'Dotted Mesh' },
                  { id: 'grid', label: 'Grid Lines' },
                  { id: 'cross', label: 'Cross-Hatch' },
                ].map((item) => {
                  const isPattern = item.id !== 'solid';
                  const isSelected = isPattern ? paintColor.startsWith(`pattern:${item.id}:`) : !paintColor.startsWith('pattern:');

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (isPattern) {
                          setPaintColor(`pattern:${item.id}:${baseColorHex}:${patternColorHex}`);
                        } else {
                          setPaintColor(patternColorHex);
                        }
                        setActiveTool('paint');
                      }}
                      className={`py-2 px-2 border text-xs font-mono uppercase tracking-wider text-center transition cursor-pointer ${
                        isSelected && activeTool === 'paint'
                          ? 'border-black dark:border-white bg-[#121212] text-[#FDFCF8] dark:bg-[#FDFCF8] dark:text-[#121212] font-bold'
                          : 'border-[#121212]/15 bg-[#FDFCF8] dark:bg-[#181816] text-[#121212] dark:text-[#FDFCF8] hover:border-[#121212]'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Target Selection & Custom Color Hex Code (Placed RIGHT BELOW Pattern Texture Brush) */}
            {isPatternActive ? (
              <div className="flex flex-col gap-2.5 p-3 bg-[#121212]/5 dark:bg-white/5 border border-[#121212] dark:border-[#2C2C28]">
                {/* Target Toggle Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveColorTarget('base')}
                    className={`py-2 px-2.5 border text-xs font-mono uppercase tracking-wider flex items-center justify-between gap-2 cursor-pointer transition ${
                      activeColorTarget === 'base'
                        ? 'border-black dark:border-white bg-[#121212] text-[#FDFCF8] dark:bg-[#FDFCF8] dark:text-[#121212] font-bold shadow-sm'
                        : 'border-[#121212]/20 bg-[#FDFCF8] dark:bg-[#181816] text-[#121212]/70 dark:text-[#FDFCF8]/70 hover:border-[#121212]'
                    }`}
                  >
                    <span>Base color</span>
                    <div className="flex items-center gap-1.5">
                      <span 
                        className="w-4 h-4 border border-black/20 dark:border-white/20 inline-block rounded-sm shrink-0" 
                        style={{ backgroundColor: baseColorHex }}
                      />
                      <span className="text-xs font-mono font-bold">{baseColorHex}</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveColorTarget('pattern')}
                    className={`py-2 px-2.5 border text-xs font-mono uppercase tracking-wider flex items-center justify-between gap-2 cursor-pointer transition ${
                      activeColorTarget === 'pattern'
                        ? 'border-black dark:border-white bg-[#121212] text-[#FDFCF8] dark:bg-[#FDFCF8] dark:text-[#121212] font-bold shadow-sm'
                        : 'border-[#121212]/20 bg-[#FDFCF8] dark:bg-[#181816] text-[#121212]/70 dark:text-[#FDFCF8]/70 hover:border-[#121212]'
                    }`}
                  >
                    <span>Pattern color</span>
                    <div className="flex items-center gap-1.5">
                      <span 
                        className="w-4 h-4 border border-black/20 dark:border-white/20 inline-block rounded-sm shrink-0" 
                        style={{ backgroundColor: patternColorHex }}
                      />
                      <span className="text-xs font-mono font-bold">{patternColorHex}</span>
                    </div>
                  </button>
                </div>

                {/* Custom Hex Code Picker replacing old "Custom Pattern Hex Code" (No subtext, clean text-xs font-mono font-bold uppercase) */}
                {(() => {
                  const activeColorValue = activeColorTarget === 'base' ? baseColorHex : patternColorHex;
                  return (
                    <div className="flex items-center gap-2.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212] dark:border-[#2C2C28] p-2">
                      <input
                        type="color"
                        value={activeColorValue.startsWith('#') && activeColorValue.length === 7 ? activeColorValue : '#3b82f6'}
                        onChange={(e) => handleColorChange(e.target.value)}
                        className="w-8 h-8 rounded border border-[#121212]/20 bg-transparent p-0 cursor-pointer shrink-0"
                        title="Choose custom color"
                      />
                      <input
                        type="text"
                        value={activeColorValue}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val.startsWith('#') && val.length <= 7) {
                            handleColorChange(val);
                          }
                        }}
                        placeholder="#3b82f6"
                        className="w-full bg-transparent border-none text-xs text-[#121212] dark:text-[#FDFCF8] font-mono uppercase font-bold outline-none m-0 p-0"
                      />
                    </div>
                  );
                })()}
              </div>
            ) : (
              /* Solid Color Custom Hex Input (No subtext, clean text-xs font-mono font-bold uppercase) */
              <div className="flex items-center gap-2.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212] dark:border-[#2C2C28] p-2">
                <input
                  type="color"
                  value={paintColor.startsWith('#') && paintColor.length === 7 ? paintColor : '#3b82f6'}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="w-8 h-8 rounded border border-[#121212]/20 bg-transparent p-0 cursor-pointer shrink-0"
                  title="Choose custom color"
                />
                <input
                  type="text"
                  value={paintColor.startsWith('flag:') ? '#3b82f6' : paintColor}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.startsWith('#') && val.length <= 7) {
                      handleColorChange(val);
                    }
                  }}
                  placeholder="#3b82f6"
                  className="w-full bg-transparent border-none text-xs text-[#121212] dark:text-[#FDFCF8] font-mono uppercase font-bold outline-none m-0 p-0"
                />
              </div>
            )}

            {/* Custom Flag Selection */}
            <div className="flex flex-col gap-2 p-3 bg-[#121212]/5 dark:bg-white/5 border border-[#121212] dark:border-[#2C2C28]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono tracking-widest uppercase font-black">
                  Flag Color
                </span>
                {paintColor.startsWith('flag:') && (
                  <span className="text-[8px] font-mono uppercase bg-[#121212] dark:bg-white text-white dark:text-[#121212] px-1 py-0.5 font-bold">
                    Flag Active
                  </span>
                )}
              </div>
              <p className="text-[9px] opacity-60 leading-normal font-sans">
                Select a flag as your paint color. Clicking subdivision boundaries will color them with this flag!
              </p>
              
              {/* Quick Preset Flags (top countries) */}
              <div className="flex flex-wrap gap-1 mt-1">
                {[
                  { code: 'us', name: 'USA' },
                  { code: 'ca', name: 'Canada' },
                  { code: 'gb', name: 'UK' },
                  { code: 'fr', name: 'France' },
                  { code: 'de', name: 'Germany' },
                  { code: 'jp', name: 'Japan' },
                  { code: 'br', name: 'Brazil' },
                  { code: 'au', name: 'Australia' },
                ].map((c) => {
                  const isSelected = paintColor === `flag:${c.code}`;
                  return (
                    <button
                      key={c.code}
                      onClick={() => {
                        setPaintColor(`flag:${c.code}`);
                        setActiveTool('paint');
                      }}
                      className={`px-1.5 py-1 text-[8px] font-mono uppercase border rounded-sm flex items-center gap-1 transition cursor-pointer ${
                        isSelected && activeTool === 'paint'
                          ? 'border-black dark:border-white bg-[#121212] text-white dark:bg-[#FDFCF8] dark:text-[#121212] font-extrabold shadow-sm'
                          : 'border-[#121212]/15 bg-[#FDFCF8] dark:bg-[#181816] text-[#121212] dark:text-[#FDFCF8] hover:border-[#121212]'
                      }`}
                      title={c.name}
                    >
                      <FlagImage
                        code={c.code}
                        className="w-3.5 h-2.5 object-cover border border-black/10 rounded-sm"
                        alt={c.name}
                      />
                      <span>{c.code.toUpperCase()}</span>
                    </button>
                  );
                })}
              </div>

              {/* Search & Selector */}
              <div className="flex flex-col gap-1.5 mt-2">
                <input
                  type="text"
                  value={flagSearch}
                  onChange={(e) => setFlagSearch(e.target.value)}
                  placeholder="Search 150+ country flags..."
                  className="w-full text-[10px] font-mono uppercase px-2 py-1.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212] dark:border-[#2C2C28] text-[#121212] dark:text-[#FDFCF8] outline-none"
                />
                
                {/* Scrollable list of filtered flags */}
                <div className="max-h-32 overflow-y-auto custom-scrollbar border border-[#121212]/15 dark:border-[#2C2C28]/25 bg-[#FDFCF8] dark:bg-[#181816] rounded-sm flex flex-col divide-y divide-[#121212]/10 dark:divide-[#2C2C28]/10">
                  {(() => {
                    const filteredFlags = FLAG_COUNTRIES.filter(c => 
                      c.name.toLowerCase().includes(flagSearch.toLowerCase()) ||
                      c.code.toLowerCase().includes(flagSearch.toLowerCase())
                    );
                    
                    if (filteredFlags.length === 0) {
                      return (
                        <span className="p-2 text-[9px] font-mono text-center opacity-50 uppercase">
                          No matching flags found
                        </span>
                      );
                    }

                    return filteredFlags.map((c) => {
                      const isSelected = paintColor === `flag:${c.code}`;
                      return (
                        <button
                          key={c.code}
                          onClick={() => {
                            setPaintColor(`flag:${c.code}`);
                            setActiveTool('paint');
                          }}
                          className={`w-full p-1.5 text-left text-[9px] font-mono uppercase flex items-center gap-2 transition cursor-pointer ${
                            isSelected && activeTool === 'paint'
                              ? 'bg-[#121212] text-white dark:bg-[#FDFCF8] dark:text-[#121212] font-black'
                              : 'hover:bg-[#121212]/5 dark:hover:bg-white/5 text-[#121212] dark:text-[#FDFCF8]'
                          }`}
                        >
                          <FlagImage
                            code={c.code}
                            className="w-5 h-3.5 object-cover border border-black/10 rounded-sm"
                            alt={c.name}
                          />
                          <span className="flex-1 truncate">{c.name}</span>
                          <span className="text-[8px] opacity-50">{c.code.toUpperCase()}</span>
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Wikimedia Commons SVG Flag Search Engine */}
              <div className="flex flex-col gap-1.5 mt-3 pt-2.5 border-t border-[#121212]/15 dark:border-[#2C2C28]">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono font-black tracking-wider flex items-center gap-1.5 opacity-90">
                    <Globe className="w-3 h-3 text-blue-500" />
                    Search on Wikipedia Commons...
                  </span>
                </div>
                
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={wikiFlagQuery}
                    onChange={(e) => setWikiFlagQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleWikiFlagSearch();
                      }
                    }}
                    placeholder="Search historical, state, regional flags..."
                    className="flex-1 text-[10px] font-mono uppercase px-2 py-1.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212] dark:border-[#2C2C28] text-[#121212] dark:text-[#FDFCF8] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleWikiFlagSearch()}
                    disabled={wikiSearching || !wikiFlagQuery.trim()}
                    className="px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-wider bg-[#121212] text-white dark:bg-[#FDFCF8] dark:text-[#121212] hover:opacity-80 disabled:opacity-40 transition cursor-pointer font-bold flex items-center gap-1"
                  >
                    {wikiSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                  </button>
                </div>

                {/* Search Results / Status */}
                {wikiSearchError && (
                  <span className="text-[9px] font-mono text-red-500 uppercase px-1">
                    {wikiSearchError}
                  </span>
                )}

                {wikiSearching && (
                  <div className="p-3 text-[9px] font-mono text-center opacity-60 uppercase flex items-center justify-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                    <span>Searching Wikimedia Commons...</span>
                  </div>
                )}

                {!wikiSearching && wikiHasSearched && wikiFlagResults.length === 0 && !wikiSearchError && (
                  <span className="p-2 text-[9px] font-mono text-center opacity-50 uppercase">
                    No SVG flags found on Wikimedia Commons
                  </span>
                )}

                {!wikiSearching && wikiFlagResults.length > 0 && (
                  <div className="max-h-36 overflow-y-auto custom-scrollbar border border-[#121212]/15 dark:border-[#2C2C28]/25 bg-[#FDFCF8] dark:bg-[#181816] rounded-sm flex flex-col divide-y divide-[#121212]/10 dark:divide-[#2C2C28]/10">
                    {wikiFlagResults.map((item, idx) => {
                      const isSelected = paintColor === `flag:${item.url}`;
                      return (
                        <button
                          key={`${item.url}-${idx}`}
                          onClick={() => {
                            setPaintColor(`flag:${item.url}`);
                            setActiveTool('paint');
                          }}
                          className={`w-full p-1.5 text-left text-[9px] font-mono uppercase flex items-center gap-2 transition cursor-pointer ${
                            isSelected && activeTool === 'paint'
                              ? 'bg-[#121212] text-white dark:bg-[#FDFCF8] dark:text-[#121212] font-black'
                              : 'hover:bg-[#121212]/5 dark:hover:bg-white/5 text-[#121212] dark:text-[#FDFCF8]'
                          }`}
                          title={item.title}
                        >
                          <img
                            src={item.thumbUrl || item.url}
                            alt={item.title}
                            className="w-5 h-3.5 object-cover border border-black/10 rounded-sm bg-neutral-100 dark:bg-neutral-800"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                          <span className="flex-1 truncate">{item.title}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Upload Custom Flag SVG Section */}
              <div className="flex flex-col gap-1.5 mt-3 pt-2.5 border-t border-[#121212]/15 dark:border-[#2C2C28]">
                <input
                  ref={customFlagInputRef}
                  type="file"
                  accept=".svg,image/svg+xml"
                  onChange={handleCustomFlagUpload}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => customFlagInputRef.current?.click()}
                  className="w-full py-2 px-3 border border-dashed border-[#121212]/30 dark:border-white/30 bg-[#FDFCF8] dark:bg-[#181816] hover:bg-[#121212]/5 dark:hover:bg-white/5 text-[#121212] dark:text-[#FDFCF8] font-mono text-[9.5px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition rounded-sm"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Upload custom flag (.svg)</span>
                </button>

                {/* Display uploaded custom flags */}
                {customSvgFlags.length > 0 && (
                  <div className="flex flex-col gap-1 mt-1">
                    <span className="text-[8px] font-mono uppercase opacity-50 font-bold">Your Uploaded Flags</span>
                    <div className="flex flex-wrap gap-1">
                      {customSvgFlags.map((flag) => {
                        const isSelected = paintColor === `flag:${flag.url}`;
                        return (
                          <div
                            key={flag.id}
                            className={`px-2 py-1 text-[8.5px] font-mono uppercase border rounded-sm flex items-center gap-1.5 transition ${
                              isSelected && activeTool === 'paint'
                                ? 'border-black dark:border-white bg-[#121212] text-white dark:bg-[#FDFCF8] dark:text-[#121212] font-black'
                                : 'border-[#121212]/20 bg-[#FDFCF8] dark:bg-[#181816] text-[#121212] dark:text-[#FDFCF8]'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setPaintColor(`flag:${flag.url}`);
                                setActiveTool('paint');
                              }}
                              className="flex items-center gap-1.5 cursor-pointer max-w-[120px] truncate"
                              title={`Use ${flag.name}`}
                            >
                              <img
                                src={flag.url}
                                alt={flag.name}
                                className="w-4 h-3 object-cover border border-black/10 rounded-sm bg-neutral-100 dark:bg-neutral-800 shrink-0"
                              />
                              <span className="truncate">{flag.name}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCustomSvgFlags((prev) => prev.filter((f) => f.id !== flag.id));
                                if (paintColor === `flag:${flag.url}`) {
                                  setPaintColor('#3b82f6');
                                }
                              }}
                              className="text-red-500 hover:text-red-400 font-bold px-0.5 text-[10px] cursor-pointer ml-1"
                              title="Remove uploaded flag"
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

             {/* POLYGON SELECTION & RENAMING */}
            <div className="flex flex-col gap-2.5 p-3 bg-emerald-500/5 dark:bg-emerald-500/10 border border-[#121212] dark:border-[#2C2C28]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono tracking-wider uppercase font-bold text-[#121212] dark:text-[#FDFCF8]">
                  Selected Polygons
                </span>
                <span className={`text-xs px-2 py-0.5 font-mono font-bold rounded ${
                  selectedBorderCountryIds.length > 0 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                }`}>
                  {selectedBorderCountryIds.length} Selected
                </span>
              </div>

              {/* Country Selection Dropdown */}
              <div className="flex gap-1.5 items-center">
                <select
                  value=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val && setSelectedBorderCountryIds) {
                      setSelectedBorderCountryIds(prev => prev.includes(val) ? prev : [...prev, val]);
                    }
                  }}
                  className="w-full text-xs font-mono px-2 py-1.5 bg-white dark:bg-[#121212] border border-[#121212]/20 dark:border-[#2C2C28] text-[#121212] dark:text-[#FDFCF8] outline-none cursor-pointer rounded-xs"
                >
                  <option value="">+ Add country to customize...</option>
                  {features.length > 2000 ? (
                    <option value="" disabled>Right-click or Shift+Right-click map polygons to select</option>
                  ) : (
                    borderCountryOptions.map(c => (
                      <option key={c.id} value={c.id} disabled={selectedBorderCountryIds.includes(c.id)}>
                        {c.name} {selectedBorderCountryIds.includes(c.id) ? '✓' : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {selectedBorderCountryIds.length === 0 ? (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs opacity-75 leading-normal font-sans">
                    💡 <strong>Tip:</strong> Right-click on a country to select it, hold <strong>Shift + Right-click</strong> for multiple countries, or pick from the dropdown above.
                  </p>
                  <p className="text-xs opacity-50 font-mono italic">
                    Shortcut: Press ESC to clear selection at any time.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3 mt-1">
                  {/* Selected Polygon Badges */}
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar border border-[#121212]/15 dark:border-[#2C2C28]/30 p-2 bg-[#FDFCF8] dark:bg-[#181816] rounded-sm">
                    {selectedBorderCountryIds.map(id => {
                      const feat = features.find(f => getCountryId(f) === id);
                      const p = feat?.properties as any;
                      const featName = p?.name || p?.NAME || p?.name_long || p?.NAME_LONG || p?.name_en || p?.admin || p?.ADMIN || id;

                      return (
                        <span 
                          key={id}
                          className="text-xs font-mono bg-neutral-200 dark:bg-zinc-800 text-[#121212] dark:text-neutral-200 px-2 py-0.5 rounded flex items-center gap-1.5 font-bold"
                        >
                          <span className="truncate max-w-[140px]">{featName}</span>
                          <button 
                            type="button"
                            onClick={() => {
                              if (setSelectedBorderCountryIds) {
                                setSelectedBorderCountryIds(prev => prev.filter(x => x !== id));
                              }
                            }}
                            className="text-red-500 hover:text-red-700 font-bold ml-0.5 text-xs cursor-pointer"
                            title="Deselect"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>

                  {/* Single Polygon Renaming */}
                  {selectedBorderCountryIds.length === 1 && (
                    <div className="flex flex-col gap-1.5 bg-[#FDFCF8] dark:bg-[#181816] p-2.5 border border-[#121212]/20 dark:border-[#2C2C28]">
                      <label className="text-xs font-bold font-mono tracking-wider uppercase opacity-80">
                        Rename Polygon
                      </label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={renameSingleValue}
                          onChange={(e) => setRenameSingleValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && onRenamePolygons && renameSingleValue.trim()) {
                              onRenamePolygons([selectedBorderCountryIds[0]], renameSingleValue.trim());
                            }
                          }}
                          placeholder="Enter polygon name..."
                          className="flex-1 text-xs font-sans px-2.5 py-1.5 bg-white dark:bg-[#121212] border border-[#121212]/20 dark:border-[#2C2C28] text-[#121212] dark:text-[#FDFCF8] outline-none font-bold"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (onRenamePolygons && renameSingleValue.trim()) {
                              onRenamePolygons([selectedBorderCountryIds[0]], renameSingleValue.trim());
                            }
                          }}
                          className="px-3 py-1.5 font-mono text-xs uppercase tracking-wider bg-[#121212] text-white dark:bg-[#FDFCF8] dark:text-[#121212] hover:opacity-80 transition cursor-pointer font-bold"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Multi-Polygon Bulk Renaming */}
                  {selectedBorderCountryIds.length > 1 && (
                    <div className="flex flex-col gap-1.5 bg-[#FDFCF8] dark:bg-[#181816] p-2.5 border border-[#121212]/20 dark:border-[#2C2C28]">
                      <label className="text-xs font-bold font-mono tracking-wider uppercase opacity-80">
                        Bulk Name ({selectedBorderCountryIds.length} Polygons)
                      </label>
                      <p className="text-xs opacity-70 leading-normal font-sans">
                        Applying one name across all selected polygons merges them into a single unified region with shared labeling.
                      </p>
                      <div className="flex flex-col gap-2 mt-1">
                        <input
                          type="text"
                          value={renameBulkValue}
                          onChange={(e) => setRenameBulkValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && onRenamePolygons && renameBulkValue.trim()) {
                              onRenamePolygons(selectedBorderCountryIds, renameBulkValue.trim());
                            }
                          }}
                          placeholder="Enter unified name for selected polygons..."
                          className="w-full text-xs font-sans px-2.5 py-1.5 bg-white dark:bg-[#121212] border border-[#121212]/20 dark:border-[#2C2C28] text-[#121212] dark:text-[#FDFCF8] outline-none font-bold"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (onRenamePolygons && renameBulkValue.trim()) {
                              onRenamePolygons(selectedBorderCountryIds, renameBulkValue.trim());
                            }
                          }}
                          className="w-full py-2 font-mono text-xs uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition cursor-pointer rounded-sm"
                        >
                          Apply Name to All {selectedBorderCountryIds.length} Polygons
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Border Style Customization Section */}
                  <div className="flex flex-col gap-2.5 bg-[#FDFCF8] dark:bg-[#181816] p-2.5 border border-[#121212]/20 dark:border-[#2C2C28]">
                    <label className="text-xs font-bold font-mono tracking-wider uppercase opacity-80">
                      Border Customization
                    </label>

                    {/* Border Line Style */}
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-mono opacity-70 uppercase font-semibold">Line Style</span>
                      <select
                        value={customBorderSettings.style}
                        onChange={(e) => {
                          const style = e.target.value as 'solid' | 'dashed';
                          if (setCustomBorderSettings) {
                            setCustomBorderSettings(prev => ({ ...prev, style }));
                          }
                        }}
                        className="w-full text-xs font-mono uppercase px-2 py-1 bg-white dark:bg-[#121212] border border-[#121212]/20 dark:border-[#2C2C28] text-[#121212] dark:text-[#FDFCF8] outline-none cursor-pointer font-semibold"
                      >
                        <option value="solid">Solid Line</option>
                        <option value="dashed">Dashed Line</option>
                      </select>
                    </div>

                    {/* Dashed segment length options */}
                    {customBorderSettings.style === 'dashed' && (
                      <div className="flex flex-col gap-2 p-2 border border-[#121212]/10 dark:border-[#2C2C28]/30 bg-neutral-100/60 dark:bg-[#1A1A18]">
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between items-center text-xs font-mono uppercase">
                            <span className="opacity-70">Dash Length</span>
                            <span className="font-bold">{(customBorderSettings.dashLength || 6)}</span>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="25"
                            step="1"
                            value={customBorderSettings.dashLength || 6}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (setCustomBorderSettings) {
                                setCustomBorderSettings(prev => ({ ...prev, dashLength: val }));
                              }
                            }}
                            className="w-full h-1 bg-[#E5E5E0] dark:bg-[#2C2C28] appearance-none cursor-pointer accent-[#121212] dark:accent-red-655"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between items-center text-xs font-mono uppercase">
                            <span className="opacity-70">Gap Length</span>
                            <span className="font-bold">{(customBorderSettings.gapLength || 4)}</span>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="25"
                            step="1"
                            value={customBorderSettings.gapLength || 4}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (setCustomBorderSettings) {
                                setCustomBorderSettings(prev => ({ ...prev, gapLength: val }));
                              }
                            }}
                            className="w-full h-1 bg-[#E5E5E0] dark:bg-[#2C2C28] appearance-none cursor-pointer accent-[#121212] dark:accent-red-655"
                          />
                        </div>
                      </div>
                    )}

                    {/* Target Borders Mode */}
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-mono opacity-70 uppercase font-semibold">Borders to Style</span>
                      <div className="grid grid-cols-3 gap-1">
                        {(['both', 'outer', 'separating'] as BorderSelectionMode[]).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => {
                              if (setCustomBorderSettings) {
                                setCustomBorderSettings(prev => ({ ...prev, borderSelectionMode: mode }));
                              }
                            }}
                            className={`py-1 text-xs font-mono font-bold uppercase border transition-all cursor-pointer ${
                              customBorderSettings.borderSelectionMode === mode
                                ? 'bg-[#121212] border-[#121212] text-white dark:bg-[#FDFCF8] dark:border-[#FDFCF8] dark:text-[#121212]'
                                : 'bg-transparent border-[#121212]/20 text-[#121212]/70 dark:border-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-zinc-800'
                            }`}
                          >
                            {mode === 'both' ? 'All' : mode === 'outer' ? 'Outer' : 'Inner'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Border Color */}
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-mono opacity-70 uppercase font-semibold">Border Color</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={customBorderSettings.color}
                          onChange={(e) => {
                            if (setCustomBorderSettings) {
                              setCustomBorderSettings(prev => ({ ...prev, color: e.target.value }));
                            }
                          }}
                          className="w-8 h-7 border border-[#121212]/20 bg-transparent p-0 cursor-pointer rounded-sm"
                        />
                        <input
                          type="text"
                          value={customBorderSettings.color}
                          onChange={(e) => {
                            if (setCustomBorderSettings) {
                              setCustomBorderSettings(prev => ({ ...prev, color: e.target.value }));
                            }
                          }}
                          className="flex-1 bg-white dark:bg-[#121212] border border-[#121212]/20 dark:border-[#2C2C28] px-2 py-1 text-xs font-mono font-bold uppercase"
                        />
                      </div>
                    </div>

                    {/* Border Width */}
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center text-xs font-mono">
                        <span className="opacity-70 uppercase font-semibold">Border Width</span>
                        <span className="font-bold">{customBorderSettings.width.toFixed(1)}</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="5.0"
                        step="0.1"
                        value={customBorderSettings.width}
                        onChange={(e) => {
                          const width = parseFloat(e.target.value);
                          if (setCustomBorderSettings) {
                            setCustomBorderSettings(prev => ({ ...prev, width }));
                          }
                        }}
                        className="w-full h-1 bg-[#E5E5E0] dark:bg-[#2C2C28] appearance-none cursor-pointer accent-[#121212] dark:accent-red-655"
                      />
                    </div>

                    {/* Apply Custom Border Style */}
                    <button
                      type="button"
                      disabled={selectedBorderCountryIds.length === 0}
                      onClick={() => {
                        if (selectedBorderCountryIds.length === 0) return;
                        if (setAppliedCustomBorders) {
                          const newBorder: AppliedCustomBorder = {
                            id: `border-${Date.now()}`,
                            countryIds: [...selectedBorderCountryIds],
                            style: customBorderSettings.style,
                            dashLength: customBorderSettings.dashLength || 6,
                            gapLength: customBorderSettings.gapLength || 4,
                            borderSelectionMode: customBorderSettings.borderSelectionMode,
                            color: customBorderSettings.color,
                            width: customBorderSettings.width,
                          };
                          setAppliedCustomBorders(prev => {
                            // Cleanly replace any previous custom border with the exact same country selection
                            const filtered = prev.filter(b => {
                              const isSame = b.countryIds.length === selectedBorderCountryIds.length &&
                                b.countryIds.every(id => selectedBorderCountryIds.includes(id));
                              return !isSame;
                            });
                            return [...filtered, newBorder];
                          });
                        }
                        if (setSelectedBorderCountryIds) {
                          setSelectedBorderCountryIds([]);
                        }
                      }}
                      className="w-full py-2 text-center font-mono text-xs uppercase bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold tracking-wider rounded-sm border border-emerald-700 shadow-sm cursor-pointer transition-all mt-1"
                    >
                      Apply Custom Border to {selectedBorderCountryIds.length} {selectedBorderCountryIds.length === 1 ? 'Country' : 'Countries'}
                    </button>
                  </div>

                  {/* Clear Selection */}
                  <button
                    type="button"
                    onClick={() => {
                      if (setSelectedBorderCountryIds) {
                        setSelectedBorderCountryIds([]);
                      }
                    }}
                    className="w-full py-1.5 text-center font-mono text-xs uppercase border border-red-600/30 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 font-bold transition cursor-pointer rounded-sm"
                  >
                    Clear Selection (ESC)
                  </button>
                </div>
              )}
            </div>

            {/* APPLIED CUSTOM BORDERS MANAGER */}
            {appliedCustomBorders.length > 0 && (
              <div className="flex flex-col gap-2 p-3 bg-[#F5F4EE] dark:bg-[#1E1E1C] border border-[#121212] dark:border-[#2C2C28]">
                <div className="flex items-center justify-between border-b border-[#121212]/10 dark:border-[#2C2C28]/35 pb-1.5">
                  <span className="text-xs font-mono tracking-wider uppercase font-bold text-[#121212] dark:text-[#FDFCF8]">
                    Applied Custom Borders ({appliedCustomBorders.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (setAppliedCustomBorders) {
                        setAppliedCustomBorders([]);
                      }
                    }}
                    className="text-xs font-mono uppercase font-bold text-red-600 hover:underline cursor-pointer"
                  >
                    Remove All
                  </button>
                </div>
                <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                  {appliedCustomBorders.map((b) => {
                    const names = b.countryIds.map(id => {
                      const feat = features.find(f => getCountryId(f) === id);
                      const p = feat?.properties as any;
                      return p?.name || p?.NAME || p?.name_long || p?.NAME_LONG || p?.name_en || p?.admin || p?.ADMIN || id;
                    }).join(', ');

                    return (
                      <div 
                        key={b.id}
                        className="flex items-center justify-between gap-2 p-2 border border-[#121212]/10 dark:border-[#2C2C28]/20 bg-[#FDFCF8] dark:bg-[#181816] rounded-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {/* Color Swatch */}
                          <div 
                            className="w-4 h-4 border border-black/20 shrink-0 rounded-xs"
                            style={{ backgroundColor: b.color }}
                          />
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-xs font-mono font-bold truncate text-[#121212] dark:text-[#FDFCF8]">
                              {names}
                            </span>
                            <span className="text-xs opacity-60 font-mono">
                              {b.style.toUpperCase()} • {b.width.toFixed(1)} • {b.borderSelectionMode.toUpperCase()} {b.style === 'dashed' ? `(${b.dashLength}-${b.gapLength})` : ''}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (setAppliedCustomBorders) {
                              setAppliedCustomBorders(prev => prev.filter(x => x.id !== b.id));
                            }
                          }}
                          className="text-red-500 hover:text-red-700 font-bold px-1.5 text-xs cursor-pointer"
                          title="Remove custom border style"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick Paint Utility operations */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-mono tracking-wider uppercase opacity-80">Canvas Actions</span>
              
              <button
                type="button"
                onClick={onClearAll ? onClearAll : () => {
                  setCustomColors({});
                  if (config.showFlags) {
                    onUpdateConfig((p) => ({ ...p, showFlags: false }));
                  }
                }}
                className="w-full py-2.5 px-3 border border-[#121212] dark:border-[#2C2C28] bg-[#FDFCF8] dark:bg-[#181816] text-[#b91c1c] hover:bg-red-50 dark:hover:bg-red-950/20 transition cursor-pointer flex items-center justify-center gap-2 font-bold text-xs font-mono uppercase tracking-wide"
                title="Erase all painted colors and flags on the map"
              >
                <Trash2 size={14} />
                <span>Clear All</span>
              </button>
            </div>

            {/* History stack undo/redo actions */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-mono tracking-wider uppercase opacity-80">History Changes</span>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono uppercase tracking-wide">
                <button
                  type="button"
                  disabled={!canUndo}
                  onClick={onUndo}
                  className={`py-2.5 px-3 border transition cursor-pointer flex items-center justify-center gap-2 ${
                    canUndo
                      ? 'border-[#121212] dark:border-[#2C2C28] bg-[#FDFCF8] dark:bg-[#181816] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200'
                      : 'opacity-40 cursor-not-allowed border-neutral-300 dark:border-neutral-800 text-neutral-400 dark:text-neutral-600 bg-transparent'
                  }`}
                  title="Undo last change (Ctrl+Z / Cmd+Z)"
                >
                  <Undo2 size={14} className={canUndo ? "text-red-500" : ""} />
                  <span>Undo</span>
                </button>
                <button
                  type="button"
                  disabled={!canRedo}
                  onClick={onRedo}
                  className={`py-2.5 px-3 border transition cursor-pointer flex items-center justify-center gap-2 ${
                    canRedo
                      ? 'border-[#121212] dark:border-[#2C2C28] bg-[#FDFCF8] dark:bg-[#181816] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200'
                      : 'opacity-40 cursor-not-allowed border-neutral-300 dark:border-neutral-800 text-neutral-400 dark:text-neutral-600 bg-transparent'
                  }`}
                  title="Redo previous change (Ctrl+Y / Cmd+Shift+Z)"
                >
                  <Redo2 size={14} className={canRedo ? "text-green-500" : ""} />
                  <span>Redo</span>
                </button>
              </div>
            </div>

            {/* QUICK TEMPLATES LOADER */}
            <div className="p-3.5 border border-[#121212]/10 dark:border-[#2C2C28] bg-[#E5E5E0]/40 dark:bg-[#181816] flex flex-col gap-3">
              <div>
                <span className="text-xs font-mono tracking-wider uppercase opacity-80 block">Pre-made Outlines</span>
              </div>

              <div className="flex flex-col gap-2">
                {[
                  ...(selectedMapFile !== 'mappa_mundi_hoi4.json' && selectedMapFile !== 'world_ecoregions.json'
                    ? [{
                        id: 'toggle-flags',
                        label: 'FLAG-COLOR ALL COUNTRIES',
                        icon: <Flag size={13} />,
                        action: () => onUpdateConfig((p) => ({ ...p, showFlags: !p.showFlags })),
                      }]
                    : []),
                  {
                    label: 'CONTINENTS BLOCKS',
                    icon: <Globe size={13} />,
                    action: applyContinentsTemplate,
                  },
                  {
                    label: 'DEMOGRAPHICS GROUPING',
                    icon: <FileText size={13} />,
                    action: applyPopulationTemplate,
                  },
                  {
                    label: 'ECONOMIC WEALTH GROUPS',
                    icon: <Sliders size={13} />,
                    action: applyIncomeTemplate,
                  },
                ].map((tmpl, idx) => (
                  <button
                    key={idx}
                    id={tmpl.id}
                    type="button"
                    onClick={tmpl.action}
                    className="py-2 px-3 bg-[#FDFCF8] dark:bg-[#1C1C1A] hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-[#121212]/15 dark:border-[#2C2C28] text-xs font-mono uppercase text-left flex items-center gap-2.5 cursor-pointer transition-colors"
                  >
                    <span className="text-red-500">{tmpl.icon}</span>
                    <span>{tmpl.id === 'toggle-flags' ? tmpl.label : `LOAD ${tmpl.label}`}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* DYNAMIC MAP LEGEND BUILDER & COLOR LABELING */}
            <div className="mt-2 border-t border-[#121212]/10 dark:border-[#2C2C28]/10 pt-3 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-mono tracking-wider uppercase opacity-80">Map legend</span>
                <span className="text-xs opacity-60 uppercase font-mono">{activeUsedColors.length} colors used</span>
              </div>

              {/* Legend Configuration Controls */}
              <div className="flex flex-col gap-2.5 p-3 border border-[#121212]/15 dark:border-[#2C2C28] bg-[#FDFCF8] dark:bg-[#181816] rounded-sm">
                {/* Legend Title */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-mono uppercase opacity-75">Legend Header Title</label>
                  <input
                    type="text"
                    value={config.legendTitle || ''}
                    onChange={(e) => onUpdateConfig(p => ({ ...p, legendTitle: e.target.value }))}
                    placeholder="MAP LEGEND"
                    className="text-xs font-mono uppercase px-2.5 py-1.5 bg-white dark:bg-[#121212] border border-[#121212]/20 dark:border-[#2C2C28] text-[#121212] dark:text-[#FDFCF8] outline-none"
                  />
                </div>

                {/* Display Toggles */}
                <div className="flex flex-col gap-2.5 pt-2 border-t border-[#121212]/10 dark:border-[#2C2C28]/20">
                  {/* On-canvas legend box toggle */}
                  <div className="grid grid-cols-2 gap-2 items-center">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-mono uppercase">
                      <input
                        type="checkbox"
                        checked={config.showMapLegend === true}
                        onChange={(e) => onUpdateConfig(p => ({ ...p, showMapLegend: e.target.checked }))}
                        className="accent-[#121212] dark:accent-[#FDFCF8]"
                      />
                      <span>Display legend</span>
                    </label>

                    {/* Legend Position: Only Above or Below Map */}
                    <select
                      value={config.legendPosition === 'above' ? 'above' : 'below'}
                      onChange={(e) => onUpdateConfig(p => ({ ...p, legendPosition: e.target.value as any }))}
                      className="text-xs font-mono uppercase px-2 py-1 bg-white dark:bg-[#121212] border border-[#121212]/20 dark:border-[#2C2C28] text-[#121212] dark:text-[#FDFCF8] outline-none cursor-pointer"
                    >
                      <option value="below">Below Map</option>
                      <option value="above">Above Map</option>
                    </select>
                  </div>

                  {/* Color labels: Mutually Exclusive (Both | Map | Legend) */}
                  <div className="pt-2 border-t border-[#121212]/10 dark:border-[#2C2C28]/20 flex flex-col gap-1.5">
                    <label className="text-xs font-mono uppercase opacity-75">Color labels</label>
                    <div className="grid grid-cols-3 gap-1 bg-white dark:bg-[#121212] p-1 border border-[#121212]/20 dark:border-[#2C2C28] rounded-sm">
                      <button
                        type="button"
                        onClick={() => onUpdateConfig(p => ({ ...p, colorLabelMode: 'both', showMapLegend: true }))}
                        className={`py-1 text-[10px] font-mono font-bold uppercase transition rounded-xs ${
                          config.colorLabelMode === 'both'
                            ? 'bg-[#121212] dark:bg-[#FDFCF8] text-[#FDFCF8] dark:text-[#121212]'
                            : 'text-[#121212]/70 dark:text-[#FDFCF8]/70 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                        }`}
                        title="Display color labels on both Map and Legend"
                      >
                        Both
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateConfig(p => ({ ...p, colorLabelMode: 'on-map' }))}
                        className={`py-1 text-[10px] font-mono font-bold uppercase transition rounded-xs ${
                          (config.colorLabelMode === 'on-map' || config.colorLabelMode === 'on-polygons')
                            ? 'bg-[#121212] dark:bg-[#FDFCF8] text-[#FDFCF8] dark:text-[#121212]'
                            : 'text-[#121212]/70 dark:text-[#FDFCF8]/70 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                        }`}
                        title="Display color labels on Map only"
                      >
                        Map
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateConfig(p => ({ ...p, colorLabelMode: 'on-legend', showMapLegend: true }))}
                        className={`py-1 text-[10px] font-mono font-bold uppercase transition rounded-xs ${
                          (config.colorLabelMode === 'on-legend' || !config.colorLabelMode || config.colorLabelMode === 'none')
                            ? 'bg-[#121212] dark:bg-[#FDFCF8] text-[#FDFCF8] dark:text-[#121212]'
                            : 'text-[#121212]/70 dark:text-[#FDFCF8]/70 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                        }`}
                        title="Display color labels on Legend only"
                      >
                        Legend
                      </button>
                    </div>
                  </div>

                  {/* Legend Border Customization Module */}
                  <div className="pt-2 border-t border-[#121212]/10 dark:border-[#2C2C28]/20 flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="text-[10px] font-bold font-mono opacity-75 tracking-wide uppercase">Legend Border Thickness</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateConfig((p) => ({
                              ...p,
                              legendBorderWidth: undefined,
                              legendBorderColor: 'default',
                            }));
                          }}
                          className="text-[9px] font-mono uppercase px-1.5 py-0.5 border border-[#121212]/20 dark:border-[#2C2C28] hover:bg-[#121212]/5 dark:hover:bg-[#2C2C28]/50 transition-colors"
                          title="Sync legend border thickness and color with map border"
                        >
                          Match Map Border
                        </button>
                        <span className="font-bold font-mono text-[11px]">
                          {(config.legendBorderWidth !== undefined ? config.legendBorderWidth : (config.mapBorderWidth !== undefined ? config.mapBorderWidth : 0.2)).toFixed(1)}
                        </span>
                      </div>
                    </div>
                    <input
                      id="rng-legend-border-width"
                      type="range"
                      min="0.0"
                      max="6.0"
                      step="0.1"
                      value={config.legendBorderWidth !== undefined ? config.legendBorderWidth : (config.mapBorderWidth !== undefined ? config.mapBorderWidth : 0.2)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        onUpdateConfig((p) => ({ ...p, legendBorderWidth: val }));
                      }}
                      className="w-full h-1 bg-[#E5E5E0] dark:bg-[#2C2C28] appearance-none cursor-pointer accent-[#121212] dark:accent-red-655"
                    />

                    <div className="flex flex-col gap-1 pt-1 border-t border-[#121212]/10 dark:border-[#2C2C28]/20">
                      <label className="text-[10px] font-bold font-mono opacity-75 tracking-wide uppercase">
                        Legend Border Color
                      </label>
                      <div className="flex items-center gap-2">
                        <select
                          id="sel-legend-border-color"
                          value={
                            !config.legendBorderColor || config.legendBorderColor === 'default'
                              ? 'default'
                              : ['#121212', '#FDFCF8', '#475569', '#94a3b8', '#d97706', '#ef4444', '#3b82f6'].includes(config.legendBorderColor)
                              ? config.legendBorderColor
                              : 'default'
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            onUpdateConfig((p) => ({ ...p, legendBorderColor: val }));
                          }}
                          className="flex-1 text-[11px] font-mono uppercase px-2 py-1.5 bg-white dark:bg-[#121212] border border-[#121212]/20 dark:border-[#2C2C28] text-[#121212] dark:text-[#FDFCF8] outline-none cursor-pointer"
                        >
                          <option value="default">Match Map Border (Default)</option>
                          <option value="#121212">Jet Black (#121212)</option>
                          <option value="#FDFCF8">Off-White (#FDFCF8)</option>
                          <option value="#475569">Slate Gray (#475569)</option>
                          <option value="#94a3b8">Light Gray (#94a3b8)</option>
                          <option value="#d97706">Gold / Brass (#d97706)</option>
                          <option value="#ef4444">Bright Red (#ef4444)</option>
                          <option value="#3b82f6">Ocean Blue (#3b82f6)</option>
                        </select>

                        <input
                          type="color"
                          value={
                            config.legendBorderColor && config.legendBorderColor.startsWith('#') && config.legendBorderColor.length === 7
                              ? config.legendBorderColor
                              : (config.mapBorderColor && config.mapBorderColor.startsWith('#') && config.mapBorderColor.length === 7
                                  ? config.mapBorderColor
                                  : (config.borderColor && config.borderColor.startsWith('#') && config.borderColor.length === 7
                                      ? config.borderColor
                                      : '#94a3b8'))
                          }
                          onChange={(e) => {
                            onUpdateConfig((p) => ({ ...p, legendBorderColor: e.target.value }));
                          }}
                          className="w-7 h-7 border border-[#121212]/20 dark:border-[#2C2C28] bg-transparent p-0 cursor-pointer rounded shrink-0"
                          title="Choose custom legend border color"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Color Swatch Label Editors */}
              {activeUsedColors.length === 0 ? (
                <div className="text-center py-5 border border-dashed border-[#121212]/15 dark:border-[#2C2C28] rounded-sm text-xs opacity-60 font-mono leading-relaxed">
                  No colored territories yet.<br />Click on countries to populate color labels!
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <div className="flex justify-between items-center px-1 text-xs font-mono uppercase opacity-70 font-bold">
                    <span>Color Swatch</span>
                    <span>Custom Text Label</span>
                    <span>Action</span>
                  </div>

                  <div className="flex flex-col gap-2 max-h-56 overflow-y-auto custom-scrollbar p-1">
                    {activeUsedColors.map((color, idx) => (
                      <div
                        key={color}
                        className="flex items-center gap-2 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212]/15 dark:border-[#2C2C28] p-2 shadow-sm text-xs font-mono"
                      >
                        {/* Interactive legend select swatch */}
                        <button
                          type="button"
                          onClick={() => {
                            setPaintColor(color);
                            setActiveTool('paint');
                          }}
                          style={{ backgroundColor: color }}
                          className="h-6 w-6 border border-[#121212]/20 shrink-0 cursor-pointer hover:scale-105 active:scale-95 shadow-sm rounded-sm"
                          title="Select this color for painting"
                        />
                        
                        {/* Editable text label input */}
                        <input
                          type="text"
                          value={legendLabels[color] || legendLabels[color.toLowerCase()] || ''}
                          onChange={(e) => handleUpdateLegendText(color, e.target.value)}
                          placeholder={`Color Category ${idx + 1}...`}
                          className="flex-1 bg-transparent border-none text-xs px-1 outline-none text-[#121212] dark:text-[#FDFCF8] py-0.5 border-b border-transparent hover:border-[#121212]/20 focus:border-[#121212] dark:focus:border-white font-sans"
                        />

                        {/* Clear colors corresponding to this entry */}
                        <button
                          type="button"
                          onClick={() => handleClearColorsOfThisSpec(color)}
                          className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 text-[#b91c1c] rounded transition cursor-pointer"
                          title="Erase all countries of this color"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Auto Quick Label Generator */}
                  <button
                    type="button"
                    onClick={() => {
                      activeUsedColors.forEach((color, idx) => {
                        if (!legendLabels[color]) {
                          handleUpdateLegendText(color, `Group ${String.fromCharCode(65 + idx)}`);
                        }
                      });
                    }}
                    className="w-full py-2 px-3 border border-[#121212]/15 dark:border-[#2C2C28] bg-[#FDFCF8] dark:bg-[#181816] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-mono uppercase font-bold text-center cursor-pointer transition-colors"
                  >
                    Auto-Label Blank Colors (Group A, B, C...)
                  </button>
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </aside>
  );
}, (prevProps, nextProps) => {
  for (const key in nextProps) {
    if (typeof nextProps[key] !== 'function') {
      if (key === 'selectedBorderCountryIds') {
        const prev = prevProps.selectedBorderCountryIds || [];
        const next = nextProps.selectedBorderCountryIds || [];
        if (prev.length !== next.length) return false;
        if (prev.some((id, idx) => id !== next[idx])) return false;
        continue;
      }
      if (prevProps[key] !== nextProps[key]) {
        return false;
      }
    }
  }
  return true;
});

export default Sidebar;

