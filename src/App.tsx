/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as topojson from 'topojson-client';
import { MapConfig, CountryFeature, MapDataCollection, AppliedCustomBorder, HistoryState, BorderSelectionMode, zoomToEdgeAngle, MapLocation } from './types';
import Sidebar from './components/Sidebar';
import MapCanvas from './components/MapCanvas';
import { Loader2, Globe, Database, Compass, AlertCircle, Undo2, Redo2, Sun, Moon, SlidersHorizontal, X, ChevronDown, ChevronUp, Paintbrush, Eraser, Pipette, Info, ExternalLink, Monitor, Smartphone, Tablet, Sparkles, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { loadAndTileBackground, decodeBackgroundFile, DecodedRaster, DecodedBgDescriptor, globalDecodedBgRegistry } from './utils/bgDecoder';
import { getMapAssetJson, getMapAssetUrl, getMapAssetBlob, getMapAssetFallbackUrl } from './utils/mapAssets';
import { extractFeaturesFromTopoJSON, checkIsGeoreferenced, sanitizeFeatures, getCountryId } from './utils/geoUtils';
import { detectDeviceMode, DeviceMode, LayoutPreference } from './utils/deviceDetection';

// Persistent client-side memory cache to make switching maps completely instantaneous
const globalMapCache = new Map<string, MapDataCollection>();

const emptyFeatures = [];

export default function App() {
  const [config, setConfig] = useState<MapConfig>({
    centerLon: 0,
    centerLat: 0,
    aspect: 0,
    zoom: 1,
    projection: 'equirectangular',
    showGraticule: true,
    graticuleInterval: 10,
    graticuleColor: 'default',
    colorTheme: 'light', // Light theme default for traditional paper map aesthetic
    choroplethMode: 'none', // Blank/uncolored land by default
    showLabels: true,
    labelFontSize: 12,
    minLabelFontSize: 1,
    maxLabelFontSize: 5,
    labelColor: 'default',
    labelHaloColor: 'default',
    labelBorderColor: 'default',
    labelHaloRatio: 0.15,
    labelBorderRatio: 0.15,
    borderWidth: 0.2,
    countryBorderWidth: 0.2,
    continentBorderWidth: 0.2,
    mapBorderWidth: 0.2,
    enlargeCityStates: true,
    mapBorderColor: 'default',
    customOceanColor: 'default',
    customBgColor: 'default',
    customSkyboxColor: 'default',
    landOpacity: 1.0,
    borderColor: 'default',
    occludeBehindGlobe: true,
    swipeSelection: false,
    bgImageFile: 'none',
    bgImageOpacity: 1.0,
    showFlags: false,
    simplificationLevel: 'low',
    colorLabelMode: 'on-legend',
    labelNameStyle: 'full-name',
    showMapLegend: true,
    showLocationGroupsInLegend: true,
    legendPosition: 'below',
    legendBorderWidth: undefined,
    legendBorderColor: 'default',
  });

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isMobileExpanded, setIsMobileExpanded] = useState<boolean>(false);

  // Hardware & Viewport Device Detection: dynamically determines 'pc', 'tablet', or 'mobile'
  const [detectedMode, setDetectedMode] = useState<DeviceMode>(() => detectDeviceMode());

  // User preference: 'auto' (default) follows accurate device detection, or can be forced to 'pc' | 'tablet' | 'mobile'
  const [layoutPreference, setLayoutPreference] = useState<LayoutPreference>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mappainter_layout_mode');
      if (saved === 'pc' || saved === 'tablet' || saved === 'mobile' || saved === 'auto') return saved;
      if (saved === 'desktop') return 'pc';
    }
    return 'auto';
  });

  const [isModeMenuOpen, setIsModeMenuOpen] = useState<boolean>(false);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // Active effective mode based on preference or live device detection
  const effectiveMode: DeviceMode = layoutPreference === 'auto' ? detectedMode : layoutPreference;

  // Window width tracking for responsive layout determination
  const [windowWidth, setWindowWidth] = useState<number>(() => typeof window !== 'undefined' ? window.innerWidth : 1200);

  // Tablet mode uses desktop side-by-side layout when screen width >= 768px, or drawer layout when narrower
  const isDesktopLayout = effectiveMode === 'pc' || (effectiveMode === 'tablet' && windowWidth >= 768);

  useEffect(() => {
    const handleResizeOrOrientation = () => {
      if (typeof window !== 'undefined') {
        setWindowWidth(window.innerWidth);
        const nextDetected = detectDeviceMode();
        setDetectedMode(nextDetected);
      }
    };

    handleResizeOrOrientation();
    window.addEventListener('resize', handleResizeOrOrientation);
    window.addEventListener('orientationchange', handleResizeOrOrientation);
    return () => {
      window.removeEventListener('resize', handleResizeOrOrientation);
      window.removeEventListener('orientationchange', handleResizeOrOrientation);
    };
  }, []);

  // Close mode menu on click outside
  useEffect(() => {
    if (!isModeMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) {
        setIsModeMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isModeMenuOpen]);

  const handleSelectLayoutMode = useCallback((mode: LayoutPreference) => {
    setLayoutPreference(mode);
    setIsModeMenuOpen(false);
    try {
      localStorage.setItem('mappainter_layout_mode', mode);
    } catch {}
  }, []);

  const cycleLayoutMode = useCallback(() => {
    const modes: LayoutPreference[] = ['auto', 'pc', 'tablet', 'mobile'];
    const curIdx = modes.indexOf(layoutPreference);
    const next = modes[(curIdx + 1) % modes.length];
    handleSelectLayoutMode(next);
  }, [layoutPreference, handleSelectLayoutMode]);

  const [mapData, setMapData] = useState<MapDataCollection | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<CountryFeature | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedMapFile, setSelectedMapFile] = useState<string>('world.json');
  const [currentFileName, setCurrentFileName] = useState('world.json');

  // Viewport camera controls for panning & zooming
  const [viewport, setViewport] = useState({ zoom: 1, pan: { x: 0, y: 0 } });

  // Custom painting tool states
  const [customColors, setCustomColors] = useState<Record<string, string>>({});
  const [paintColor, setPaintColor] = useState<string>('#3b82f6');
  const [activeTool, setActiveTool] = useState<'paint' | 'eraser' | 'picker'>('paint');
  const [brushScope, setBrushScope] = useState<string>('single');
  const [legendLabels, setLegendLabels] = useState<Record<string, string>>({});

  // Undo / Redo history engine
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryState[]>([]);

  // Right-click custom boundary style states
  const [selectedBorderCountryIds, setSelectedBorderCountryIds] = useState<string[]>([]);
  const [appliedCustomBorders, setAppliedCustomBorders] = useState<AppliedCustomBorder[]>([]);
  const [customBorderSettings, setCustomBorderSettings] = useState<{
    style: 'solid' | 'dashed';
    dashLength: number;
    gapLength: number;
    borderSelectionMode: BorderSelectionMode;
    color: string;
    width: number;
  }>({
    style: 'solid',
    dashLength: 6,
    gapLength: 4,
    borderSelectionMode: 'both',
    color: '#ff0000',
    width: 0.4,
  });

  // Background map image loading states
  const [customBgFile, setCustomBgFile] = useState<File | null>(null);
  const [decodedBgDescriptor, setDecodedBgDescriptor] = useState<DecodedBgDescriptor | null>(null);
  const [bgLoading, setBgLoading] = useState<boolean>(false);
  const [bgProgress, setBgProgress] = useState<number>(0);
  const [bgError, setBgError] = useState<string | null>(null);
  const lastLoadedBgSourceRef = useRef<File | string | null>(null);
  const [riversData, setRiversData] = useState<any>(null);

  // Independent Viewport Quick Guide Box state
  const [isGuideCollapsed, setIsGuideCollapsed] = useState<boolean>(false);

  // Map Location States
  const [importedLocations, setImportedLocations] = useState<MapLocation[]>([]);
  const [showLocations, setShowLocations] = useState<boolean>(true);
  const [showLocationLabels, setShowLocationLabels] = useState<boolean>(true);
  const [admin0Shape, setAdmin0Shape] = useState<string>('red_circle');
  const [admin0Color, setAdmin0Color] = useState<string>('#059669');
  const [admin0Size, setAdmin0Size] = useState<number>(3);
  const [admin1Shape, setAdmin1Shape] = useState<string>('white_circle');
  const [admin1Color, setAdmin1Color] = useState<string>('#2563eb');
  const [admin1Size, setAdmin1Size] = useState<number>(2.5);
  const [popUnder50kShape, setPopUnder50kShape] = useState<string>('black_dot');
  const [popUnder50kColor, setPopUnder50kColor] = useState<string>('#d97706');
  const [popUnder50kSize, setPopUnder50kSize] = useState<number>(1.5);
  const [pop50kTo100kShape, setPop50kTo100kShape] = useState<string>('black_dot');
  const [pop50kTo100kColor, setPop50kTo100kColor] = useState<string>('#ea580c');
  const [pop50kTo100kSize, setPop50kTo100kSize] = useState<number>(1.8);
  const [pop100kTo1MShape, setPop100kTo1MShape] = useState<string>('white_circle');
  const [pop100kTo1MColor, setPop100kTo1MColor] = useState<string>('#e11d48');
  const [pop100kTo1MSize, setPop100kTo1MSize] = useState<number>(2.2);
  const [pop1MTo10MShape, setPop1MTo10MShape] = useState<string>('white_circle');
  const [pop1MTo10MColor, setPop1MTo10MColor] = useState<string>('#9333ea');
  const [pop1MTo10MSize, setPop1MTo10MSize] = useState<number>(2.6);
  const [popAbove10MShape, setPopAbove10MShape] = useState<string>('white_square');
  const [popAbove10MColor, setPopAbove10MColor] = useState<string>('#0d9488');
  const [popAbove10MSize, setPopAbove10MSize] = useState<number>(3.0);
  const [locationLabelSize, setLocationLabelSize] = useState<number>(2);
  const [locationLabelOutlineRatio, setLocationLabelOutlineRatio] = useState<number>(0.15);
  const [stylizeAdmin1, setStylizeAdmin1] = useState<boolean>(true);

  useEffect(() => {
    let active = true;

    if (!config.bgImageFile || config.bgImageFile === 'none') {
      setDecodedBgDescriptor(null);
      setBgError(null);
      setBgProgress(0);
      lastLoadedBgSourceRef.current = null;
      // Clean up globalDecodedBgRegistry to free memory
      globalDecodedBgRegistry.clear();
      return;
    }

    const loadBg = async () => {
      let fileOrUrl: File | string;

      if (config.bgImageFile === 'custom' && customBgFile) {
        fileOrUrl = customBgFile;
      } else {
        let assetPath = '';
        if (config.bgImageFile === 'NASA_8km.tif' || config.bgImageFile === 'NASA_8km.png') {
          assetPath = 'bg/NASA_8km.png';
        } else if (config.bgImageFile === 'NASA_topo_bathy_8km.png' || config.bgImageFile === 'NASA_topo_bathy_8km.tif') {
          assetPath = 'bg/NASA_topo_bathy_8km.png';
        } else if (config.bgImageFile === 'climate_1991_2020.tif' || config.bgImageFile === 'climate_1991_2020.png') {
          assetPath = 'bg/climate_1991_2020.png';
        } else if (config.bgImageFile === 'climate_1991_2020_hires.tif' || config.bgImageFile === 'climate_1991_2020_hires.png') {
          assetPath = 'bg/climate_1991_2020_hires.png';
        } else {
          assetPath = `bg/${config.bgImageFile}`;
        }

        try {
          const blob = await getMapAssetBlob(assetPath);
          let mime = blob.type;
          if (!mime || mime === 'application/octet-stream') {
            if (config.bgImageFile.endsWith('.jpg') || config.bgImageFile.endsWith('.jpeg')) mime = 'image/jpeg';
            else if (config.bgImageFile.endsWith('.webp')) mime = 'image/webp';
            else mime = 'image/png';
          }
          fileOrUrl = new File([blob], config.bgImageFile, { type: mime });
        } catch (err) {
          console.warn('Failed to download background image blob, falling back to direct URL:', err);
          try {
            fileOrUrl = getMapAssetFallbackUrl(assetPath) || await getMapAssetUrl(assetPath);
          } catch (urlErr) {
            console.error('Failed to resolve direct background image URL:', urlErr);
            if (active) {
              setBgError('Failed to load background image.');
              setDecodedBgDescriptor(null);
            }
            return;
          }
        }
      }

      const cacheKey = typeof fileOrUrl === 'string' ? fileOrUrl : fileOrUrl.name;

      // If this map is already successfully loaded, skip re-decoding entirely!
      if (lastLoadedBgSourceRef.current === cacheKey) {
        return;
      }

      setBgLoading(true);
      setBgProgress(0);
      setBgError(null);
      try {
        const descriptor = await loadAndTileBackground(fileOrUrl, (percent, desc) => {
          if (active) {
            setBgProgress(percent);
            if (desc) {
              setDecodedBgDescriptor(desc);
            }
          }
        });

        if (active) {
          setDecodedBgDescriptor(descriptor);
          lastLoadedBgSourceRef.current = cacheKey;
        }
      } catch (err: any) {
        console.error("Background map load error:", err);
        if (active) {
          setBgError(err.message || "Failed to load background map.");
          setDecodedBgDescriptor(null);
          lastLoadedBgSourceRef.current = null;
        }
      } finally {
        if (active) {
          setBgLoading(false);
          setBgProgress(0);
        }
      }
    };

    loadBg();

    return () => {
      active = false;
    };
  }, [config.bgImageFile, customBgFile]);

  const exportHandlersRef = useRef<{ exportPNG: (scale?: number) => void } | null>(null);


  const handleExportTopoJSON = async () => {
    if (!mapData) return;
    try {
      const { topology } = await import('topojson-server');
      const topo = topology({ map: mapData });
      (topo as any).mapPainterSettings = {
        config,
        selectedMapFile,
        customColors,
        paintColor,
        legendLabels,
        appliedCustomBorders,
        customBorderSettings,
        importedLocations,
        showLocations,
        showLocationLabels,
        admin0Shape, admin0Color, admin0Size,
        admin1Shape, admin1Color, admin1Size,
        popUnder50kShape, popUnder50kColor, popUnder50kSize,
        pop50kTo100kShape, pop50kTo100kColor, pop50kTo100kSize,
        pop100kTo1MShape, pop100kTo1MColor, pop100kTo1MSize,
        pop1MTo10MShape, pop1MTo10MColor, pop1MTo10MSize,
        popAbove10MShape, popAbove10MColor, popAbove10MSize,
        locationLabelSize, locationLabelOutlineRatio, stylizeAdmin1
      };
      
      const blob = new Blob([JSON.stringify(topo)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedMapFile.replace(/\.[^/.]+$/, '')}_save_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export TopoJSON failed:", err);
    }
  };

  const handleImportTopoJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.mapPainterSettings) {
          const settings = data.mapPainterSettings;
          if (settings.config) setConfig(settings.config);
          if (settings.customColors) setCustomColors(settings.customColors);
          if (settings.paintColor) setPaintColor(settings.paintColor);
          if (settings.legendLabels) setLegendLabels(settings.legendLabels);
          if (settings.appliedCustomBorders) setAppliedCustomBorders(settings.appliedCustomBorders);
          if (settings.customBorderSettings) setCustomBorderSettings(settings.customBorderSettings);
          if (settings.importedLocations) setImportedLocations(settings.importedLocations);
          if (settings.showLocations !== undefined) setShowLocations(settings.showLocations);
          if (settings.showLocationLabels !== undefined) setShowLocationLabels(settings.showLocationLabels);
          
          if (settings.admin0Shape) setAdmin0Shape(settings.admin0Shape);
          if (settings.admin0Color) setAdmin0Color(settings.admin0Color);
          if (settings.admin0Size !== undefined) setAdmin0Size(settings.admin0Size);
          
          if (settings.admin1Shape) setAdmin1Shape(settings.admin1Shape);
          if (settings.admin1Color) setAdmin1Color(settings.admin1Color);
          if (settings.admin1Size !== undefined) setAdmin1Size(settings.admin1Size);
          
          if (settings.popUnder50kShape) setPopUnder50kShape(settings.popUnder50kShape);
          if (settings.popUnder50kColor) setPopUnder50kColor(settings.popUnder50kColor);
          if (settings.popUnder50kSize !== undefined) setPopUnder50kSize(settings.popUnder50kSize);
          
          if (settings.pop50kTo100kShape) setPop50kTo100kShape(settings.pop50kTo100kShape);
          if (settings.pop50kTo100kColor) setPop50kTo100kColor(settings.pop50kTo100kColor);
          if (settings.pop50kTo100kSize !== undefined) setPop50kTo100kSize(settings.pop50kTo100kSize);
          
          if (settings.pop100kTo1MShape) setPop100kTo1MShape(settings.pop100kTo1MShape);
          if (settings.pop100kTo1MColor) setPop100kTo1MColor(settings.pop100kTo1MColor);
          if (settings.pop100kTo1MSize !== undefined) setPop100kTo1MSize(settings.pop100kTo1MSize);
          
          if (settings.pop1MTo10MShape) setPop1MTo10MShape(settings.pop1MTo10MShape);
          if (settings.pop1MTo10MColor) setPop1MTo10MColor(settings.pop1MTo10MColor);
          if (settings.pop1MTo10MSize !== undefined) setPop1MTo10MSize(settings.pop1MTo10MSize);
          
          if (settings.popAbove10MShape) setPopAbove10MShape(settings.popAbove10MShape);
          if (settings.popAbove10MColor) setPopAbove10MColor(settings.popAbove10MColor);
          if (settings.popAbove10MSize !== undefined) setPopAbove10MSize(settings.popAbove10MSize);
          
          if (settings.locationLabelSize !== undefined) setLocationLabelSize(settings.locationLabelSize);
          if (settings.locationLabelOutlineRatio !== undefined) setLocationLabelOutlineRatio(settings.locationLabelOutlineRatio);
          if (settings.stylizeAdmin1 !== undefined) setStylizeAdmin1(settings.stylizeAdmin1);
        }

        setLoading(true);
        const worker = new Worker(new URL('./utils/mapLoaderWorker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (msg) => {
          if (msg.data.status === 'success') {
            const collection = msg.data.collection;
            globalMapCache.set(file.name, collection);
            setSelectedMapFile(file.name);
            setCurrentFileName(file.name);
            setMapData(collection);
            setSelectedCountry(null);
            setSelectedBorderCountryIds([]);
            if (!checkIsGeoreferenced(collection)) {
              setConfig((prev) => ({
                ...prev,
                centerLon: 0,
                centerLat: 0,
                zoom: 1,
                projection: 'identity',
              }));
            }
          } else {
            console.error("Worker error on import", msg.data.error);
          }
          setLoading(false);
          worker.terminate();
        };
        worker.onerror = () => {
          setLoading(false);
          worker.terminate();
        };
        worker.postMessage({ mapFile: file.name, rawData: data });
      } catch (err) {
        console.error('Error importing:', err);
        setLoading(false);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleRegisterExportHandlers = useCallback((handlers: { exportPNG: (scale?: number) => void }) => {
    exportHandlersRef.current = handlers;
  }, []);

  const handleRightClickCountry = (feature: CountryFeature, isShift: boolean) => {
    if (!feature) return;
    const id = getCountryId(feature);
    if (!id) return;
    setSelectedBorderCountryIds((prev) => {
      const exists = prev.includes(id);
      if (isShift) {
        if (exists) {
          return prev.filter((x) => x !== id);
        } else {
          return [...prev, id];
        }
      } else {
        if (exists && prev.length === 1) {
          return [];
        } else {
          return [id];
        }
      }
    });
  };

  const handleRenamePolygons = (ids: string[], newName: string) => {
    if (!ids || ids.length === 0 || !newName) return;
    setMapData((prev) => {
      if (!prev) return prev;
      const idSet = new Set(ids);
      const newFeatures = prev.features.map((feature) => {
        const featureId = getCountryId(feature);
        if (idSet.has(featureId)) {
          return {
            ...feature,
            properties: {
              ...feature.properties,
              name: newName,
              name_en: newName,
              name_long: newName,
            },
          };
        }
        return feature;
      });
      return {
        ...prev,
        features: newFeatures,
      };
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedBorderCountryIds([]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Country metadata map for fallback lookups (continent, income, population) in provinces mode
  const [countryMetadataMap, setCountryMetadataMap] = useState<Record<string, {
    continent?: string;
    income_grp?: string;
    pop_est?: number;
    gdp_md_est?: number;
    name?: string;
  }>>({});

  // Load Rivers Data
  useEffect(() => {
    if (config.showRivers && !riversData) {
      getMapAssetJson('bg/rivers.geojson')
        .then((data) => {
          setRiversData(data);
        })
        .catch((err) => {
          console.error('Failed to load rivers data:', err);
        });
    }
  }, [config.showRivers, riversData]);

  useEffect(() => {
    getMapAssetJson('world.json')
      .then((data) => {
        if (data && data.type === 'Topology') {
          const firstKey = Object.keys(data.objects)[0];
          if (firstKey) {
            const geojson: any = topojson.feature(data, data.objects[firstKey]);
            const features = geojson.features || [];
            const meta: Record<string, any> = {};
            features.forEach((f: any) => {
              const props: Record<string, any> = {};
              if (f.properties) {
                for (const key in f.properties) {
                  props[key.toLowerCase()] = f.properties[key];
                }
              }
              const code = (props.adm0_a3 || '').toLowerCase();
              const codeA2 = (props.iso_a2 || '').toLowerCase();
              const metaEntry = {
                continent: props.continent,
                income_grp: props.income_grp,
                pop_est: props.pop_est ? Number(props.pop_est) : undefined,
                gdp_md_est: props.gdp_md_est ? Number(props.gdp_md_est) : undefined,
                name: props.name,
              };
              if (code) {
                meta[code] = metaEntry;
              }
              if (codeA2) {
                meta[codeA2] = metaEntry;
              }
            });
            setCountryMetadataMap(meta);
          }
        }
      })
      .catch((err) => console.error('Error loading country metadata lookups:', err));
  }, []);

  // Maintain a synchronized ref to the latest state snapshot
  const currentHistoryStateRef = useRef<HistoryState>({
    customColors,
    appliedCustomBorders,
    showFlags: config.showFlags,
    legendLabels,
    importedLocations,
  });

  useEffect(() => {
    currentHistoryStateRef.current = {
      customColors,
      appliedCustomBorders,
      showFlags: config.showFlags,
      legendLabels,
      importedLocations,
    };
  }, [customColors, appliedCustomBorders, config.showFlags, legendLabels, importedLocations]);

  // Helper function to check if two HistoryStates are functionally identical
  const isHistoryStateEqual = (a: HistoryState, b: HistoryState): boolean => {
    if (a === b) return true;
    if (!a || !b) return false;

    if (a.showFlags !== b.showFlags) return false;

    if (a.appliedCustomBorders !== b.appliedCustomBorders) {
      if (a.appliedCustomBorders.length !== b.appliedCustomBorders.length) return false;
      if (a.appliedCustomBorders.length > 0) {
        if (JSON.stringify(a.appliedCustomBorders) !== JSON.stringify(b.appliedCustomBorders)) return false;
      }
    }

    if (a.customColors !== b.customColors) {
      const keysA = Object.keys(a.customColors);
      const keysB = Object.keys(b.customColors);
      if (keysA.length !== keysB.length) return false;
      for (let i = 0; i < keysA.length; i++) {
        const k = keysA[i];
        if (a.customColors[k] !== b.customColors[k]) return false;
      }
    }

    if (a.legendLabels !== b.legendLabels) {
      const legA = a.legendLabels || {};
      const legB = b.legendLabels || {};
      const legKeysA = Object.keys(legA);
      const legKeysB = Object.keys(legB);
      if (legKeysA.length !== legKeysB.length) return false;
      for (let i = 0; i < legKeysA.length; i++) {
        const k = legKeysA[i];
        if (legA[k] !== legB[k]) return false;
      }
    }

    if (a.importedLocations !== b.importedLocations) {
      const locsA = a.importedLocations || [];
      const locsB = b.importedLocations || [];
      if (locsA.length !== locsB.length) return false;
      if (locsA.length > 0) {
        if (JSON.stringify(locsA) !== JSON.stringify(locsB)) return false;
      }
    }

    return true;
  };

  // Push state to history with strict deduplication against the top of the stack
  const pushToHistory = (stateToSave: HistoryState) => {
    setHistory((prevHistory) => {
      const last = prevHistory[prevHistory.length - 1];
      if (last && isHistoryStateEqual(last, stateToSave)) {
        return prevHistory;
      }
      return [...prevHistory, stateToSave];
    });
    setRedoStack([]);
  };

  // Memoized O(1) index for property-based multi-feature brush scoping (provinces, states, nations, continents)
  const brushScopeIndex = React.useMemo(() => {
    const features = mapData?.features;
    if (!features || features.length === 0) return null;
    const index = new Map<string, string[]>();

    for (let i = 0; i < features.length; i++) {
      const f = features[i];
      if (!f.properties) continue;
      const fId = f.properties?.adm1_code || f.properties?.iso_3166_2 || f.properties?.adm0_a3 || f.properties?.name || '';
      if (!fId) continue;

      const keys = Object.keys(f.properties);
      for (let k = 0; k < keys.length; k++) {
        const key = keys[k];
        const val = f.properties[key];
        if (val !== undefined && val !== null && val !== '') {
          const mapKey = `${key.toLowerCase()}:${String(val).toLowerCase()}`;
          let list = index.get(mapKey);
          if (!list) {
            list = [];
            index.set(mapKey, list);
          }
          list.push(fId);
        }
      }
    }
    return index;
  }, [mapData?.features]);

  // Drag stroke state ref for grouping paint/eraser gestures into single undo items
  const strokeStartStateRef = useRef<HistoryState | null>(null);
  const strokeHasChangesRef = useRef<boolean>(false);

  const handleStartPaintStroke = () => {
    if (!strokeStartStateRef.current) {
      strokeStartStateRef.current = { ...currentHistoryStateRef.current };
      strokeHasChangesRef.current = false;
    }
  };

  const handleEndPaintStroke = () => {
    if (strokeStartStateRef.current) {
      const startState = strokeStartStateRef.current;
      const hasChanges = strokeHasChangesRef.current;
      strokeStartStateRef.current = null;
      strokeHasChangesRef.current = false;
      
      if (hasChanges) {
        pushToHistory(startState);
      }
    }
  };

  const handleUpdateConfig = (
    value: MapConfig | ((prev: MapConfig) => MapConfig)
  ) => {
    setConfig((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      if (next.showFlags !== prev.showFlags) {
        const prevState = currentHistoryStateRef.current;
        pushToHistory(prevState);
      }
      return next;
    });
  };

  const handleUpdateCustomColors = (
    value: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)
  ) => {
    setCustomColors((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      if (strokeStartStateRef.current) {
        strokeHasChangesRef.current = true;
      } else {
        const prevState = currentHistoryStateRef.current;
        const proposedState: HistoryState = {
          ...prevState,
          customColors: next,
        };
        if (!isHistoryStateEqual(prevState, proposedState)) {
          pushToHistory(prevState);
        }
      }
      return next;
    });
  };

  const handleUpdateAppliedBorders = (
    value: AppliedCustomBorder[] | ((prev: AppliedCustomBorder[]) => AppliedCustomBorder[])
  ) => {
    setAppliedCustomBorders((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      if (strokeStartStateRef.current) {
        strokeHasChangesRef.current = true;
      } else {
        const prevState = currentHistoryStateRef.current;
        const proposedState: HistoryState = {
          ...prevState,
          appliedCustomBorders: next,
        };
        if (!isHistoryStateEqual(prevState, proposedState)) {
          pushToHistory(prevState);
        }
      }
      return next;
    });
  };

  const handleUpdateLegendLabels = (
    value: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)
  ) => {
    setLegendLabels((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      if (strokeStartStateRef.current) {
        strokeHasChangesRef.current = true;
      } else {
        const prevState = currentHistoryStateRef.current;
        const proposedState: HistoryState = {
          ...prevState,
          legendLabels: next,
        };
        if (!isHistoryStateEqual(prevState, proposedState)) {
          pushToHistory(prevState);
        }
      }
      return next;
    });
  };

  const handleUpdateImportedLocations = (
    value: MapLocation[] | ((prev: MapLocation[]) => MapLocation[])
  ) => {
    setImportedLocations((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      if (strokeStartStateRef.current) {
        strokeHasChangesRef.current = true;
      } else {
        const prevState = currentHistoryStateRef.current;
        const proposedState: HistoryState = {
          ...prevState,
          importedLocations: next,
        };
        if (!isHistoryStateEqual(prevState, proposedState)) {
          pushToHistory(prevState);
        }
      }
      return next;
    });
  };

  const handleUndo = () => {
    strokeStartStateRef.current = null;
    strokeHasChangesRef.current = false;

    setHistory((prevHistory) => {
      if (prevHistory.length === 0) return prevHistory;

      const newHistory = [...prevHistory];
      const currentState = currentHistoryStateRef.current;

      // Pop until we find a state that is DIFFERENT from currentState
      let targetState: HistoryState | null = null;
      while (newHistory.length > 0) {
        const candidate = newHistory.pop()!;
        if (!isHistoryStateEqual(candidate, currentState)) {
          targetState = candidate;
          break;
        }
      }

      if (!targetState) {
        return [];
      }

      setRedoStack((r) => [currentState, ...r]);

      setCustomColors(targetState.customColors);
      setAppliedCustomBorders(targetState.appliedCustomBorders);
      if (targetState.legendLabels) {
        setLegendLabels(targetState.legendLabels);
      }
      if (targetState.showFlags !== undefined && targetState.showFlags !== config.showFlags) {
        setConfig((c) => ({ ...c, showFlags: targetState.showFlags }));
      }
      if (targetState.importedLocations !== undefined) {
        setImportedLocations(targetState.importedLocations);
      }

      return newHistory;
    });
  };

  const handleRedo = () => {
    strokeStartStateRef.current = null;
    strokeHasChangesRef.current = false;

    setRedoStack((prevRedo) => {
      if (prevRedo.length === 0) return prevRedo;

      const newRedo = [...prevRedo];
      const currentState = currentHistoryStateRef.current;

      let targetState: HistoryState | null = null;
      while (newRedo.length > 0) {
        const candidate = newRedo.shift()!;
        if (!isHistoryStateEqual(candidate, currentState)) {
          targetState = candidate;
          break;
        }
      }

      if (!targetState) {
        return [];
      }

      pushToHistory(currentState);

      setCustomColors(targetState.customColors);
      setAppliedCustomBorders(targetState.appliedCustomBorders);
      if (targetState.legendLabels) {
        setLegendLabels(targetState.legendLabels);
      }
      if (targetState.showFlags !== undefined && targetState.showFlags !== config.showFlags) {
        setConfig((c) => ({ ...c, showFlags: targetState.showFlags }));
      }
      if (targetState.importedLocations !== undefined) {
        setImportedLocations(targetState.importedLocations);
      }

      return newRedo;
    });
  };

  const handleClearAll = () => {
    strokeStartStateRef.current = null;
    strokeHasChangesRef.current = false;

    const prevState = currentHistoryStateRef.current;
    const nextState: HistoryState = {
      customColors: {},
      appliedCustomBorders: [],
      showFlags: false,
      legendLabels: {},
      importedLocations: [],
    };

    if (!isHistoryStateEqual(prevState, nextState)) {
      pushToHistory(prevState);
    }

    setCustomColors({});
    setLegendLabels({});
    setAppliedCustomBorders([]);
    setImportedLocations([]);
    if (config.showFlags) {
      setConfig((c) => ({ ...c, showFlags: false }));
    }
  };

  // Keyboard shortcut listener for Ctrl+Z / Ctrl+Y and ESC to clear selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedBorderCountryIds([]);
        return;
      }

      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      const isMac = navigator.userAgent.includes('Mac');
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (
        (modifier && e.shiftKey && e.key.toLowerCase() === 'z') ||
        (modifier && e.key.toLowerCase() === 'y')
      ) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history, redoStack, customColors, appliedCustomBorders, config.showFlags]);

  const handleSelectMapFile = useCallback((file: string) => {
    setSelectedCountry(null);
    setSelectedBorderCountryIds([]);

    if (file === 'mappa_mundi_hoi4.json' || file === 'world_adm1.json') {
      setConfig((prev) => ({ ...prev, showLabels: false }));
    }

    if (globalMapCache.has(file)) {
      const cached = globalMapCache.get(file)!;
      setSelectedMapFile(file);
      setCurrentFileName(file);
      setMapData(cached);
      if (!checkIsGeoreferenced(cached)) {
        setConfig((prev) => ({
          ...prev,
          centerLon: 0,
          centerLat: 0,
          zoom: 1,
          projection: 'identity',
        }));
      }
      setLoading(false);
      return;
    }

    setSelectedMapFile(file);
  }, []);

  // Load the initial world map data asynchronously
  useEffect(() => {
    if (selectedMapFile === 'custom') {
      return;
    }

    // Check if the requested map is already available in the instantaneous global memory cache
    if (globalMapCache.has(selectedMapFile)) {
      const cached = globalMapCache.get(selectedMapFile)!;
      setMapData(cached);
      setCurrentFileName(selectedMapFile);
      if (!checkIsGeoreferenced(cached)) {
        setConfig((prev) => ({
          ...prev,
          centerLon: 0,
          centerLat: 0,
          zoom: 1,
          projection: 'identity',
        }));
      }
      setLoading(false);
      return;
    }

    // Immediately trigger loading state so UI reacts instantly without freeze
    setLoading(true);
    setErrorMessage(null);

    // Mappa Mundi and World Subdivisions maps have polygon labels disabled by default
    if (selectedMapFile === 'mappa_mundi_hoi4.json' || selectedMapFile === 'world_adm1.json') {
      setConfig((prev) => (prev.showLabels ? { ...prev, showLabels: false } : prev));
    }

    let active = true;

    // Fetch JSON from repository asset CDN, then use background Web Worker or fallback parsing
    getMapAssetJson(selectedMapFile)
      .then((rawData) => {
        if (!active) return;
        let finished = false;
        let worker: Worker | null = null;

        // Generous safety timer (30s) only in case the worker process abruptly crashes
        const safetyTimer = setTimeout(() => {
          if (!finished && active) {
            finished = true;
            try {
              worker?.terminate();
            } catch (e) {}
            runFallback(rawData);
          }
        }, 30000);

        try {
          worker = new Worker(new URL('./utils/mapLoaderWorker.ts', import.meta.url), { type: 'module' });

          worker.onmessage = (e: MessageEvent) => {
            if (finished || !active) return;
            finished = true;
            clearTimeout(safetyTimer);
            const { status, collection, error } = e.data;
            if (status === 'success') {
              // Store in the global memory cache so future swaps are 100% instant!
              globalMapCache.set(selectedMapFile, collection);
              setMapData(collection);
              setCurrentFileName(selectedMapFile);
              if (!checkIsGeoreferenced(collection)) {
                setConfig((prev) => ({
                  ...prev,
                  centerLon: 0,
                  centerLat: 0,
                  zoom: 1,
                  projection: 'identity',
                }));
              }
              setLoading(false);
            } else {
              console.error('Worker background load error:', error);
              runFallback(rawData);
            }
            worker?.terminate();
          };

          worker.onerror = (err) => {
            if (finished || !active) return;
            finished = true;
            clearTimeout(safetyTimer);
            console.warn('Worker initialization or execution failed, falling back to main-thread parse:', err);
            runFallback(rawData);
            worker?.terminate();
          };

          worker.postMessage({ mapFile: selectedMapFile, rawData });
        } catch (workerErr) {
          if (!finished && active) {
            finished = true;
            clearTimeout(safetyTimer);
            runFallback(rawData);
          }
        }
      })
      .catch((err) => {
        if (!active) return;
        console.error('Failed to load map data from repository assets:', err);
        setErrorMessage(
          `Failed to load the ${selectedMapFile} map data. Please check your internet connection.`
        );
        setLoading(false);
      });

    const runFallback = (data: any) => {
      try {
        let collection: MapDataCollection;

        if (data && data.type === 'Topology') {
          // Parse TopoJSON topology objects across all layers
          const features = extractFeaturesFromTopoJSON(data);
          if (features.length > 0) {
            collection = {
              type: 'FeatureCollection',
              features,
            };
          } else {
            throw new Error('TopoJSON topology has no parseable object layers.');
          }
        } else {
          collection = data;
          if (collection && collection.features) {
            collection.features = sanitizeFeatures(collection.features);
          }
        }

        if (collection && collection.features) {
          collection.features = collection.features.map((feature, index) => {
            const props: any = {};
            for (const key in feature.properties) {
              props[key.toLowerCase()] = (feature.properties as any)[key];
            }

            // Standardize English localized name for ADM1 subdivisions and custom ecoregions
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
            return {
              ...feature,
              properties: props,
            };
          });
        }
        globalMapCache.set(selectedMapFile, collection);
        setMapData(collection);
        setCurrentFileName(selectedMapFile);
        if (!checkIsGeoreferenced(collection)) {
          setConfig((prev) => ({
            ...prev,
            centerLon: 0,
            centerLat: 0,
            zoom: 1,
            projection: 'identity',
          }));
        }
        setLoading(false);
      } catch (fallbackErr) {
        console.error('Fallback static mapdata parse error:', fallbackErr);
        setErrorMessage(
          `Failed to parse the loaded ${selectedMapFile} map data.`
        );
        setLoading(false);
      }
    };

    return () => {
      active = false;
    };
  }, [selectedMapFile]);

  const handleSelectCountry = useCallback((feature: CountryFeature | null) => {
    setSelectedCountry(feature);
  }, []);

  // Custom File Uploader callback hook
  const handleUploadGeoJSON = (rawCollection: MapDataCollection, fileName: string) => {
    const collection = { ...rawCollection };
    if (collection && collection.features) {
      collection.features = sanitizeFeatures(collection.features).map((feature, index) => {
        const props: any = {};
        for (const key in feature.properties) {
          props[key.toLowerCase()] = (feature.properties as any)[key];
        }

        // Standardize English localized name for ADM1 subdivisions and custom ecoregions
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
        return {
          ...feature,
          properties: props,
        };
      });
    }
    setMapData(collection);
    setCurrentFileName(fileName);
    setSelectedCountry(null);
    setSelectedMapFile('custom');
    
    // Auto center map and set appropriate projection for custom map data
    if (collection.features && collection.features.length > 0) {
      try {
        const isGeo = checkIsGeoreferenced(collection);
        setConfig(prev => ({
          ...prev,
          centerLon: 0,
          centerLat: 0,
          zoom: 1,
          projection: !isGeo ? 'identity' : (prev.projection === 'identity' ? 'equirectangular' : prev.projection),
        }));
      } catch (e) {
        // Fallback gracefully
      }
    }
  };

  // Track browser page zoom dynamically so UI stays at 100% scale
  const [pageZoom, setPageZoom] = useState(1);
  const initialDPRRef = useRef<number>(window.devicePixelRatio || 1);

  useEffect(() => {
    const updateZoom = () => {
      const dpr = window.devicePixelRatio || 1;
      const baseDPR = initialDPRRef.current || 1;
      const visualScale = window.visualViewport?.scale || 1;
      const computedZoom = (dpr / baseDPR) * visualScale;
      setPageZoom(computedZoom > 0 ? computedZoom : 1);
    };

    updateZoom();

    window.addEventListener('resize', updateZoom);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateZoom);
    }
    return () => {
      window.removeEventListener('resize', updateZoom);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateZoom);
      }
    };
  }, []);

  const effectiveUIZoom = 1.0;

  // Resizable sidebar width (desktop layout)
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mappainter_sidebar_width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 300 && parsed <= 1200) {
          return parsed;
        }
      }
      if (window.innerWidth >= 1536) return 520;
      if (window.innerWidth >= 1280) return 480;
      return 440;
    }
    return 480;
  });

  const [isResizingSidebar, setIsResizingSidebar] = useState<boolean>(false);

  const handleSplitterPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startWidth = sidebarWidth;
    const zoom = effectiveUIZoom || 1;
    setIsResizingSidebar(true);

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = (moveEvent.clientX - startX) / zoom;
      const minW = 300;
      const maxW = Math.min(Math.round((window.innerWidth * 0.75) / zoom), 950);
      const nextW = Math.max(minW, Math.min(maxW, Math.round(startWidth + deltaX)));
      if (sidebarRef.current) {
        sidebarRef.current.style.width = `${nextW}px`;
        sidebarRef.current.style.minWidth = `${nextW}px`;
        sidebarRef.current.style.maxWidth = `${nextW}px`;
      }
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setIsResizingSidebar(false);

      const deltaX = (upEvent.clientX - startX) / zoom;
      const minW = 300;
      const maxW = Math.min(Math.round((window.innerWidth * 0.75) / zoom), 950);
      const finalW = Math.max(minW, Math.min(maxW, Math.round(startWidth + deltaX)));
      setSidebarWidth(finalW);
      try {
        localStorage.setItem('mappainter_sidebar_width', finalW.toString());
      } catch {}
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  }, [sidebarWidth, effectiveUIZoom]);

  // Setup thematic HTML class values
  const themeClass = config.colorTheme === 'dark' ? 'dark' : '';

  return (
    <div className={`${themeClass} h-screen h-[100dvh] w-screen overflow-hidden`}>
      <div className="w-full h-full bg-[#FDFCF8] dark:bg-[#181816] text-[#121212] dark:text-[#FDFCF8] flex flex-col overflow-hidden font-sans transition-colors duration-300">
        
        {/* Inner Content Area */}
        <div className={`flex-1 min-h-0 h-full w-full flex ${isDesktopLayout ? 'flex-row' : 'flex-col'} overflow-hidden relative`}>
          
          {/* Mobile Backdrop Overlay */}
          {!isDesktopLayout && isMobileSidebarOpen && (
            <div
              onClick={() => setIsMobileSidebarOpen(false)}
              className="fixed inset-0 bg-black/50 z-20 backdrop-blur-[1px] transition-opacity"
            />
          )}

          {/* Mobile Bottom Quick Dock (Active when in mobile mode and full drawer is closed) */}
          {!isDesktopLayout && !isMobileSidebarOpen && (
            <div className="fixed bottom-3 left-3 right-3 z-30 pointer-events-none flex flex-col items-center gap-2 max-w-lg mx-auto">
              {/* Selected Country Indicator Chip */}
              {selectedCountry && (
                <div className="pointer-events-auto bg-[#FDFCF8]/95 dark:bg-[#1C1C1A]/95 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#121212]/20 dark:border-[#3A3A36] shadow-lg flex items-center gap-2 text-xs font-mono">
                  <span className="font-bold truncate max-w-[150px] text-[#121212] dark:text-[#FDFCF8]">
                    {selectedCountry.properties?.name || selectedCountry.properties?.NAME || 'Selected Country'}
                  </span>
                  <button
                    onClick={() => handleSelectCountry(null)}
                    className="text-[#121212]/60 dark:text-[#FDFCF8]/60 hover:text-red-500 p-0.5 rounded cursor-pointer"
                    title="Clear selection"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}

              {/* Primary Mobile Quick Toolbar */}
              <div className="pointer-events-auto w-full bg-[#FDFCF8]/95 dark:bg-[#1C1C1A]/95 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-[#121212]/25 dark:border-[#3A3A36] shadow-2xl flex items-center justify-between gap-1.5">
                {/* Tool Switcher: Paint / Eraser / Picker */}
                <div className="flex items-center gap-0.5 bg-[#121212]/5 dark:bg-[#FDFCF8]/5 p-0.5 rounded-lg border border-[#121212]/10 dark:border-[#FDFCF8]/10 shrink-0">
                  <button
                    onClick={() => setActiveTool('paint')}
                    className={`p-1.5 rounded-md transition cursor-pointer ${
                      activeTool === 'paint'
                        ? 'bg-[#121212] dark:bg-[#FDFCF8] text-[#FDFCF8] dark:text-[#121212] shadow-sm'
                        : 'text-[#121212]/70 dark:text-[#FDFCF8]/70 hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                    title="Paint Tool"
                  >
                    <Paintbrush size={15} />
                  </button>
                  <button
                    onClick={() => setActiveTool('eraser')}
                    className={`p-1.5 rounded-md transition cursor-pointer ${
                      activeTool === 'eraser'
                        ? 'bg-[#121212] dark:bg-[#FDFCF8] text-[#FDFCF8] dark:text-[#121212] shadow-sm'
                        : 'text-[#121212]/70 dark:text-[#FDFCF8]/70 hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                    title="Eraser Tool"
                  >
                    <Eraser size={15} />
                  </button>
                  <button
                    onClick={() => setActiveTool('picker')}
                    className={`p-1.5 rounded-md transition cursor-pointer ${
                      activeTool === 'picker'
                        ? 'bg-[#121212] dark:bg-[#FDFCF8] text-[#FDFCF8] dark:text-[#121212] shadow-sm'
                        : 'text-[#121212]/70 dark:text-[#FDFCF8]/70 hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                    title="Color Eyedropper"
                  >
                    <Pipette size={15} />
                  </button>
                </div>

                {/* Quick Color Swatches */}
                <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 px-1 scrollbar-none">
                  <label className="relative cursor-pointer shrink-0" title="Custom color">
                    <input
                      type="color"
                      value={paintColor}
                      onChange={(e) => {
                        setPaintColor(e.target.value);
                        setActiveTool('paint');
                      }}
                      className="sr-only"
                    />
                    <div
                      className="w-6 h-6 rounded-full border-2 border-[#121212] dark:border-[#FDFCF8] shadow-sm flex items-center justify-center transition active:scale-95"
                      style={{ backgroundColor: paintColor }}
                    />
                  </label>
                  {['#e11d48', '#2563eb', '#16a34a', '#ca8a04', '#9333ea', '#ea580c', '#18181b'].map((hex) => (
                    <button
                      key={hex}
                      onClick={() => {
                        setPaintColor(hex);
                        setActiveTool('paint');
                      }}
                      className={`w-5 h-5 rounded-full border shrink-0 transition active:scale-90 ${
                        paintColor.toLowerCase() === hex.toLowerCase() && activeTool === 'paint'
                          ? 'ring-2 ring-offset-1 ring-[#121212] dark:ring-[#FDFCF8] scale-110'
                          : 'border-black/20 dark:border-white/20'
                      }`}
                      style={{ backgroundColor: hex }}
                      title={hex}
                    />
                  ))}
                </div>

                {/* Mode Cycle & Menu Buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={cycleLayoutMode}
                    className="p-1.5 px-2 bg-[#121212]/10 dark:bg-[#FDFCF8]/10 hover:bg-[#121212]/20 dark:hover:bg-[#FDFCF8]/20 text-[#121212] dark:text-[#FDFCF8] font-mono font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 rounded-lg border border-[#121212]/20 dark:border-[#FDFCF8]/20 transition cursor-pointer"
                    title={`Layout Mode: ${layoutPreference.toUpperCase()} (Detected: ${detectedMode.toUpperCase()}) - Tap to cycle`}
                  >
                    {layoutPreference === 'auto' ? (
                      <Sparkles size={13} className="text-amber-500" />
                    ) : layoutPreference === 'tablet' ? (
                      <Tablet size={13} />
                    ) : layoutPreference === 'mobile' ? (
                      <Smartphone size={13} />
                    ) : (
                      <Monitor size={13} />
                    )}
                    <span className="hidden xs:inline">
                      {layoutPreference === 'auto' ? `Auto:${detectedMode.toUpperCase()}` : layoutPreference.toUpperCase()}
                    </span>
                  </button>

                  <button
                    onClick={() => setIsMobileSidebarOpen(true)}
                    className="px-2.5 py-1.5 bg-[#121212] dark:bg-[#FDFCF8] text-[#FDFCF8] dark:text-[#121212] font-mono font-bold text-[10px] uppercase tracking-wider shadow-md flex items-center gap-1.5 rounded-lg border border-white/20 active:scale-95 transition cursor-pointer shrink-0"
                    title="Open full controls"
                  >
                    <SlidersHorizontal size={13} />
                    <span className="hidden xs:inline">Menu</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Left Control Sidebar Container */}
          <div
            ref={sidebarRef}
            style={{
              zoom: effectiveUIZoom,
              width: isDesktopLayout && !isSidebarCollapsed ? `${effectiveMode === 'tablet' ? Math.min(sidebarWidth, 340) : sidebarWidth}px` : undefined,
              minWidth: isDesktopLayout && !isSidebarCollapsed ? `${effectiveMode === 'tablet' ? Math.min(sidebarWidth, 340) : sidebarWidth}px` : undefined,
              maxWidth: isDesktopLayout && !isSidebarCollapsed ? `${effectiveMode === 'tablet' ? Math.min(sidebarWidth, 340) : sidebarWidth}px` : undefined,
            }}
            className={
              isDesktopLayout
                ? (isSidebarCollapsed ? "hidden" : "static flex flex-col h-full max-h-none z-auto rounded-none shadow-none border-t-0 shrink-0 min-h-0")
                : `${isMobileSidebarOpen ? `fixed bottom-0 left-0 right-0 ${isMobileExpanded ? 'h-[92dvh] max-h-[92dvh]' : 'h-[80dvh] max-h-[80dvh] sm:h-[75vh] sm:max-h-[75vh]'} z-30 flex flex-col bg-[#F9F8F4] dark:bg-[#1C1C19] rounded-t-2xl shadow-2xl border-t border-[#121212]/20 dark:border-[#2C2C28] overflow-hidden min-h-0 transition-[height,transform] duration-200 ease-out` : 'hidden'} shrink-0 min-h-0`
            }
          >
            {/* Tablet / PC Sidebar Header Strip with Collapse Toggle */}
            {isDesktopLayout && !isSidebarCollapsed && (
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#121212]/10 dark:border-[#2C2C28] bg-[#FDFCF8] dark:bg-[#1C1C1A] text-xs font-mono select-none shrink-0">
                <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[#121212] dark:text-[#FDFCF8]">
                  {effectiveMode === 'tablet' ? (
                    <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                      <Tablet size={13} />
                      <span>Tablet Panel</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Monitor size={13} />
                      <span>Tools & Layers</span>
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setIsSidebarCollapsed(true)}
                  className="p-1 px-1.5 text-[#121212]/60 dark:text-[#FDFCF8]/60 hover:text-[#121212] dark:hover:text-[#FDFCF8] hover:bg-black/5 dark:hover:bg-white/5 rounded cursor-pointer transition flex items-center gap-1 text-[10px]"
                  title="Collapse sidebar for full map painting view"
                >
                  <ChevronLeft size={13} />
                  <span>Collapse</span>
                </button>
              </div>
            )}

            {/* Mobile Header Close & Expand Bar (Only shown in mobile drawer mode) */}
            {!isDesktopLayout && (
              <div className="flex flex-col border-b border-[#121212] dark:border-[#2C2C28] bg-[#FDFCF8] dark:bg-[#1c1c1a] shrink-0 select-none">
                {/* Grab bar */}
                <div
                  onClick={() => setIsMobileExpanded(prev => !prev)}
                  className="w-full pt-2 pb-1 flex items-center justify-center cursor-pointer hover:opacity-80 active:opacity-60"
                  title={isMobileExpanded ? "Collapse height" : "Expand to full height"}
                >
                  <div className="w-10 h-1.5 rounded-full bg-[#121212]/25 dark:bg-[#FDFCF8]/25 hover:bg-[#121212]/40 dark:hover:bg-[#FDFCF8]/40 transition" />
                </div>
                <div className="flex items-center justify-between px-4 pb-2.5 pt-0.5">
                  <span className="font-mono text-xs font-bold uppercase tracking-wider">MapPainter Controls</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={cycleLayoutMode}
                      className="p-1 px-2 text-[#121212] dark:text-[#FDFCF8] hover:bg-black/5 dark:hover:bg-white/5 font-mono text-[10px] uppercase flex items-center gap-1 font-bold border border-black/10 dark:border-white/10 rounded cursor-pointer transition"
                      title="Cycle display mode"
                    >
                      {layoutPreference === 'auto' ? <Sparkles size={13} className="text-amber-500" /> : layoutPreference === 'tablet' ? <Tablet size={13} /> : layoutPreference === 'mobile' ? <Smartphone size={13} /> : <Monitor size={13} />}
                      <span>{layoutPreference === 'auto' ? `Auto (${detectedMode.toUpperCase()})` : `${layoutPreference.toUpperCase()} Mode`}</span>
                    </button>
                    <button
                      onClick={() => setIsMobileExpanded(prev => !prev)}
                      className="p-1 px-2 text-[#121212] dark:text-[#FDFCF8] hover:bg-black/5 dark:hover:bg-white/5 font-mono text-[10px] uppercase flex items-center gap-1 font-bold border border-black/10 dark:border-white/10 rounded cursor-pointer transition"
                      title={isMobileExpanded ? "Compact height" : "Expand height"}
                    >
                      {isMobileExpanded ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                      <span>{isMobileExpanded ? 'Compact' : 'Expand'}</span>
                    </button>
                    <button
                      onClick={() => setIsMobileSidebarOpen(false)}
                      className="p-1 px-2 text-[#121212] dark:text-[#FDFCF8] hover:bg-black/5 dark:hover:bg-white/5 font-mono text-[10px] uppercase flex items-center gap-1 font-bold border border-black/10 dark:border-white/10 rounded cursor-pointer transition"
                    >
                      <X size={13} />
                      <span>Close</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <Sidebar
            onExportTopoJSON={handleExportTopoJSON}
            onImportTopoJSON={handleImportTopoJSON}
            sidebarWidth={isDesktopLayout ? sidebarWidth : undefined}
            config={config}
            features={mapData?.features || emptyFeatures}
            onSelectCountry={handleSelectCountry}
            onUpdateConfig={handleUpdateConfig}
            onUploadGeoJSON={handleUploadGeoJSON}
            currentFileName={currentFileName}
            customColors={customColors}
            setCustomColors={handleUpdateCustomColors}
            paintColor={paintColor}
            setPaintColor={setPaintColor}
            activeTool={activeTool}
            setActiveTool={setActiveTool}
            legendLabels={legendLabels}
            setLegendLabels={handleUpdateLegendLabels}
            canUndo={history.length > 0}
            canRedo={redoStack.length > 0}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onClearAll={handleClearAll}
            selectedMapFile={currentFileName || selectedMapFile}
            onSelectMapFile={handleSelectMapFile}
            countryMetadataMap={countryMetadataMap}
            brushScope={brushScope}
            setBrushScope={setBrushScope}
            selectedBorderCountryIds={selectedBorderCountryIds}
            setSelectedBorderCountryIds={setSelectedBorderCountryIds}
            onRenamePolygons={handleRenamePolygons}
            customBorderSettings={customBorderSettings}
            setCustomBorderSettings={setCustomBorderSettings}
            appliedCustomBorders={appliedCustomBorders}
            setAppliedCustomBorders={handleUpdateAppliedBorders}
            viewport={viewport}
            setViewport={setViewport}
            customBgFile={customBgFile}
            setCustomBgFile={setCustomBgFile}
            bgLoading={bgLoading}
            bgError={bgError}
            importedLocations={importedLocations}
            setImportedLocations={handleUpdateImportedLocations}
            showLocations={showLocations}
            setShowLocations={setShowLocations}
            showLocationLabels={showLocationLabels}
            setShowLocationLabels={setShowLocationLabels}
            admin0Shape={admin0Shape}
            setAdmin0Shape={setAdmin0Shape}
            admin0Color={admin0Color}
            setAdmin0Color={setAdmin0Color}
            admin0Size={admin0Size}
            setAdmin0Size={setAdmin0Size}
            admin1Shape={admin1Shape}
            setAdmin1Shape={setAdmin1Shape}
            admin1Color={admin1Color}
            setAdmin1Color={setAdmin1Color}
            admin1Size={admin1Size}
            setAdmin1Size={setAdmin1Size}
            popUnder50kShape={popUnder50kShape}
            setPopUnder50kShape={setPopUnder50kShape}
            popUnder50kColor={popUnder50kColor}
            setPopUnder50kColor={setPopUnder50kColor}
            popUnder50kSize={popUnder50kSize}
            setPopUnder50kSize={setPopUnder50kSize}
            pop50kTo100kShape={pop50kTo100kShape}
            setPop50kTo100kShape={setPop50kTo100kShape}
            pop50kTo100kColor={pop50kTo100kColor}
            setPop50kTo100kColor={setPop50kTo100kColor}
            pop50kTo100kSize={pop50kTo100kSize}
            setPop50kTo100kSize={setPop50kTo100kSize}
            pop100kTo1MShape={pop100kTo1MShape}
            setPop100kTo1MShape={setPop100kTo1MShape}
            pop100kTo1MColor={pop100kTo1MColor}
            setPop100kTo1MColor={setPop100kTo1MColor}
            pop100kTo1MSize={pop100kTo1MSize}
            setPop100kTo1MSize={setPop100kTo1MSize}
            pop1MTo10MShape={pop1MTo10MShape}
            setPop1MTo10MShape={setPop1MTo10MShape}
            pop1MTo10MColor={pop1MTo10MColor}
            setPop1MTo10MColor={setPop1MTo10MColor}
            pop1MTo10MSize={pop1MTo10MSize}
            setPop1MTo10MSize={setPop1MTo10MSize}
            popAbove10MShape={popAbove10MShape}
            setPopAbove10MShape={setPopAbove10MShape}
            popAbove10MColor={popAbove10MColor}
            setPopAbove10MColor={setPopAbove10MColor}
            popAbove10MSize={popAbove10MSize}
            setPopAbove10MSize={setPopAbove10MSize}
            locationLabelSize={locationLabelSize}
            locationLabelOutlineRatio={locationLabelOutlineRatio}
            setLocationLabelOutlineRatio={setLocationLabelOutlineRatio}
            setLocationLabelSize={setLocationLabelSize}
            stylizeAdmin1={stylizeAdmin1}
            setStylizeAdmin1={setStylizeAdmin1}
            onExportPNG={(scale) => exportHandlersRef.current?.exportPNG(scale)}
          />
          </div>

          {/* Desktop Resizable Splitter Handle */}
          {isDesktopLayout && !isSidebarCollapsed && (
            <div
              onPointerDown={handleSplitterPointerDown}
              onDoubleClick={() => {
                setSidebarWidth(480);
                try {
                  localStorage.setItem('mappainter_sidebar_width', '480');
                } catch {}
              }}
              className="w-2.5 hover:w-3 active:w-3 bg-transparent hover:bg-[#121212]/10 active:bg-[#121212]/20 dark:hover:bg-[#FDFCF8]/10 dark:active:bg-[#FDFCF8]/20 transition-all cursor-col-resize shrink-0 relative z-30 select-none group flex items-center justify-center -ml-[5px] -mr-[5px]"
              title="Drag to resize tabs panel width (Double-click to reset)"
            >
              {/* Visual Splitter Line */}
              <div className={`w-[2px] h-full ${isResizingSidebar ? 'bg-[#121212] dark:bg-[#FDFCF8]' : 'bg-[#121212]/15 dark:bg-[#2C2C28] group-hover:bg-[#121212]/70 dark:group-hover:bg-[#FDFCF8]/70'} transition-colors`} />
              
              {/* Grip Handle Center Pill */}
              <div className={`absolute top-1/2 -translate-y-1/2 w-1.5 h-8 rounded-full ${isResizingSidebar ? 'bg-[#121212] dark:bg-[#FDFCF8] scale-y-125' : 'bg-[#121212]/30 dark:bg-[#FDFCF8]/30 group-hover:bg-[#121212]/80 dark:group-hover:bg-[#FDFCF8]/80'} group-hover:scale-y-125 transition-all flex flex-col items-center justify-center pointer-events-none shadow-sm`} />
            </div>
          )}

          {/* Right Active Visualization Area */}
          <main
            className={`flex-1 min-h-0 h-full w-full relative flex flex-col overflow-hidden bg-[#E5E5E0] dark:bg-[#121211] ${isResizingSidebar ? 'pointer-events-none select-none' : ''}`}
            style={{ minHeight: '100%' }}
          >
            <div className="absolute inset-0 opacity-[0.14] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#121212 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
            
            {/* Header dashboard stats & Quick Guide info overlay (only visible if loaded successfully) */}
            {!loading && !errorMessage && (
              <div style={{ zoom: effectiveUIZoom }} className="contents-or-overlay">
                {/* Polygon Count badge and Sidebar expander in top left */}
                <div className="absolute top-4 left-4 z-20 pointer-events-auto flex items-center gap-2 select-none">
                  {isDesktopLayout && isSidebarCollapsed && (
                    <button
                      onClick={() => setIsSidebarCollapsed(false)}
                      className="bg-[#FDFCF8]/95 dark:bg-[#1C1C1A]/95 p-1.5 px-3 border border-[#121212] dark:border-[#3A3A36] backdrop-blur flex items-center gap-1.5 shadow-md text-[#121212] dark:text-[#FDFCF8] font-mono text-[10px] font-bold uppercase hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer rounded"
                      title="Show sidebar controls"
                    >
                      <ChevronRight size={13} />
                      <span>Show Controls</span>
                    </button>
                  )}
                  <div className="bg-[#FDFCF8]/95 dark:bg-[#1C1C1A]/95 p-1.5 px-3 border border-[#121212] dark:border-[#3A3A36] backdrop-blur flex items-center gap-2.5 shadow-sm text-[#121212] dark:text-[#FDFCF8]">
                    <div className="p-0.5 px-1.5 border border-[#121212] dark:border-[#3A3A36] bg-[#121212] dark:bg-[#FDFCF8] text-[#FDFCF8] dark:text-[#121212] text-[9px] font-mono uppercase font-black">
                      DB
                    </div>
                    <div>
                      <h4 className="text-[8.5px] uppercase font-mono tracking-wider opacity-60">
                        Polygon Count
                      </h4>
                      <span className="text-[11px] font-bold font-mono">
                        {mapData?.features.length || 0} Polygons
                      </span>
                    </div>
                  </div>
                </div>

                {/* Viewport Info Box in bottom left (only on desktop/tablet layout to keep mobile canvas uncluttered) */}
                {isDesktopLayout && (
                  <div className="absolute bottom-4 left-4 z-20 pointer-events-auto flex flex-col gap-2 max-w-[320px] sm:max-w-[360px] select-text">
                    <div 
                      id="viewport-guide-box"
                      className="bg-[#FDFCF8]/95 dark:bg-[#1C1C1A]/95 border border-[#121212] dark:border-[#3A3A36] backdrop-blur-md shadow-md text-[#121212] dark:text-[#FDFCF8] p-3 text-xs transition-all"
                    >
                      <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[#121212]/15 dark:border-[#3A3A36]">
                        <div className="flex items-center gap-1.5 text-[#121212] dark:text-[#FDFCF8]">
                          <Info size={13} className="shrink-0" />
                        </div>
                        <button
                          onClick={() => setIsGuideCollapsed(!isGuideCollapsed)}
                          className="p-0.5 hover:bg-[#121212]/10 dark:hover:bg-white/10 transition text-[#121212] dark:text-[#FDFCF8]"
                          title={isGuideCollapsed ? "Expand guide" : "Collapse guide"}
                          aria-label="Toggle Guide Box"
                        >
                          {isGuideCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                        </button>
                      </div>

                      {!isGuideCollapsed ? (
                        <div className="space-y-1.5 font-sans text-[11px] leading-relaxed">
                          <p className="font-semibold text-[#121212] dark:text-[#FDFCF8]">
                            Right-click to select. Shift-Right-click to select.
                          </p>
                          <p className="text-[#333330] dark:text-[#D4D4D0] leading-snug">
                            <strong className="font-bold text-[#121212] dark:text-[#FDFCF8]">Features:</strong> Legend customization (Paint tab), Flag coloring (Paint tab), border customization (Right-click), map projection customization (Projection tab), map background customization (BG tab), label customization (View tab), and more.
                          </p>
                          <div className="pt-1.5 mt-1 border-t border-[#121212]/10 dark:border-[#3A3A36]/60 flex items-center justify-between">
                            <a
                              href="https://github.com/johnnull6967/MapPainterAssets/issues"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10.5px] font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline"
                              title="Report issues on GitHub"
                            >
                              <span>Report issues on GitHub</span>
                              <ExternalLink size={11} className="shrink-0" />
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div 
                          onClick={() => setIsGuideCollapsed(false)}
                          className="cursor-pointer text-[10.5px] text-[#121212]/70 dark:text-[#FDFCF8]/70 hover:opacity-100 font-mono flex items-center justify-between"
                        >
                          <span>Right-click to select...</span>
                          <span className="text-[9px] uppercase tracking-wider text-blue-650 dark:text-blue-400">Expand</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* "MapPainter Demo" badge in top right with aligned baselines */}
                <div className="absolute top-4 right-4 z-20 flex items-center gap-2 pointer-events-auto">
                  <div className="bg-[#121212] text-white py-1.5 px-3 border border-white/20 shadow-md flex items-baseline gap-1.5 select-none rounded">
                    <span className="text-xs font-serif italic font-bold tracking-tight text-white leading-none">
                      MapPainter
                    </span>
                    <span className="text-[10px] font-mono font-bold text-white/90 leading-none">
                      Demo
                    </span>
                  </div>

                  {/* Layout Mode Selector (Auto / PC / Tablet / Mobile) */}
                  <div className="relative" ref={modeMenuRef}>
                    <button
                      onClick={() => setIsModeMenuOpen(prev => !prev)}
                      className="p-2 bg-[#FDFCF8]/95 dark:bg-[#1C1C1A]/95 border border-[#121212] dark:border-[#3A3A36] backdrop-blur shadow-sm cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition flex items-center gap-1.5 font-mono text-[10px] uppercase font-black tracking-wider text-[#121212] dark:text-[#FDFCF8]"
                      title={`Layout Mode: ${layoutPreference.toUpperCase()} (Detected: ${detectedMode.toUpperCase()}) - Click to change`}
                    >
                      {layoutPreference === 'auto' ? (
                        <Sparkles size={13} className="text-amber-500 shrink-0" />
                      ) : layoutPreference === 'tablet' ? (
                        <Tablet size={13} className="shrink-0" />
                      ) : layoutPreference === 'mobile' ? (
                        <Smartphone size={13} className="shrink-0" />
                      ) : (
                        <Monitor size={13} className="shrink-0" />
                      )}
                      <span className="hidden sm:inline">
                        {layoutPreference === 'auto'
                          ? `Auto: ${detectedMode.toUpperCase()}`
                          : layoutPreference === 'tablet'
                          ? 'Tablet'
                          : layoutPreference === 'mobile'
                          ? 'Mobile'
                          : 'PC'}
                      </span>
                      <ChevronDown size={11} className={`opacity-60 transition-transform ${isModeMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isModeMenuOpen && (
                      <div className="absolute right-0 top-full mt-1.5 w-64 bg-[#FDFCF8] dark:bg-[#1C1C1A] border border-[#121212] dark:border-[#3A3A36] shadow-xl rounded-md z-50 p-1.5 flex flex-col gap-1 text-left font-sans select-none">
                        <div className="px-2.5 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[#121212]/60 dark:text-[#FDFCF8]/60 border-b border-[#121212]/10 dark:border-[#3A3A36]">
                          Display Layout Mode
                        </div>

                        {/* Auto option */}
                        <button
                          onClick={() => handleSelectLayoutMode('auto')}
                          className={`w-full text-left px-2.5 py-2 rounded flex items-center justify-between text-xs transition cursor-pointer ${
                            layoutPreference === 'auto'
                              ? 'bg-[#121212] text-white dark:bg-[#FDFCF8] dark:text-[#121212] font-semibold'
                              : 'hover:bg-black/5 dark:hover:bg-white/5 text-[#121212] dark:text-[#FDFCF8]'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Sparkles size={14} className={layoutPreference === 'auto' ? 'text-amber-400' : 'text-amber-500'} />
                            <div>
                              <div className="font-bold flex items-center gap-1.5">
                                Auto Detect
                                <span className="text-[9px] font-mono px-1.5 py-0.2 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded font-normal">
                                  {detectedMode.toUpperCase()}
                                </span>
                              </div>
                              <div className="text-[10px] opacity-75 font-normal">
                                Accurate auto-switch for phone, tablet & PC
                              </div>
                            </div>
                          </div>
                          {layoutPreference === 'auto' && <Check size={14} className="shrink-0" />}
                        </button>

                        {/* PC option */}
                        <button
                          onClick={() => handleSelectLayoutMode('pc')}
                          className={`w-full text-left px-2.5 py-2 rounded flex items-center justify-between text-xs transition cursor-pointer ${
                            layoutPreference === 'pc'
                              ? 'bg-[#121212] text-white dark:bg-[#FDFCF8] dark:text-[#121212] font-semibold'
                              : 'hover:bg-black/5 dark:hover:bg-white/5 text-[#121212] dark:text-[#FDFCF8]'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Monitor size={14} />
                            <div>
                              <div className="font-bold">PC / Desktop Mode</div>
                              <div className="text-[10px] opacity-75 font-normal">
                                Dual-pane layout with resizable sidebar
                              </div>
                            </div>
                          </div>
                          {layoutPreference === 'pc' && <Check size={14} className="shrink-0" />}
                        </button>

                        {/* Tablet option */}
                        <button
                          onClick={() => handleSelectLayoutMode('tablet')}
                          className={`w-full text-left px-2.5 py-2 rounded flex items-center justify-between text-xs transition cursor-pointer ${
                            layoutPreference === 'tablet'
                              ? 'bg-[#121212] text-white dark:bg-[#FDFCF8] dark:text-[#121212] font-semibold'
                              : 'hover:bg-black/5 dark:hover:bg-white/5 text-[#121212] dark:text-[#FDFCF8]'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Tablet size={14} />
                            <div>
                              <div className="font-bold">Tablet Mode</div>
                              <div className="text-[10px] opacity-75 font-normal">
                                Touch-optimized compact sidebar & canvas
                              </div>
                            </div>
                          </div>
                          {layoutPreference === 'tablet' && <Check size={14} className="shrink-0" />}
                        </button>

                        {/* Mobile option */}
                        <button
                          onClick={() => handleSelectLayoutMode('mobile')}
                          className={`w-full text-left px-2.5 py-2 rounded flex items-center justify-between text-xs transition cursor-pointer ${
                            layoutPreference === 'mobile'
                              ? 'bg-[#121212] text-white dark:bg-[#FDFCF8] dark:text-[#121212] font-semibold'
                              : 'hover:bg-black/5 dark:hover:bg-white/5 text-[#121212] dark:text-[#FDFCF8]'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Smartphone size={14} />
                            <div>
                              <div className="font-bold">Mobile Mode</div>
                              <div className="text-[10px] opacity-75 font-normal">
                                Bottom quick dock & slide-up drawer
                              </div>
                            </div>
                          </div>
                          {layoutPreference === 'mobile' && <Check size={14} className="shrink-0" />}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Floating Undo/Redo Controls over the map area */}
                  <button
                    onClick={handleUndo}
                    disabled={history.length === 0}
                    className={`p-2 bg-[#FDFCF8]/95 dark:bg-[#1C1C1A]/95 border border-[#121212] dark:border-[#3A3A36] backdrop-blur shadow-sm cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition flex items-center gap-1.5 font-mono text-[10px] uppercase font-black tracking-wider ${
                      history.length === 0 ? 'opacity-40 cursor-not-allowed' : ''
                    }`}
                    title="Undo last paint action (Ctrl+Z / Cmd+Z)"
                  >
                    <Undo2 size={13} className="text-red-500" />
                    <span className="hidden sm:inline">Undo</span>
                  </button>
                  <button
                    onClick={handleRedo}
                    disabled={redoStack.length === 0}
                    className={`p-2 bg-[#FDFCF8]/95 dark:bg-[#1C1C1A]/95 border border-[#121212] dark:border-[#3A3A36] backdrop-blur shadow-sm cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition flex items-center gap-1.5 font-mono text-[10px] uppercase font-black tracking-wider ${
                      redoStack.length === 0 ? 'opacity-40 cursor-not-allowed' : ''
                    }`}
                    title="Redo previous action (Ctrl+Y / Cmd+Shift+Z)"
                  >
                    <Redo2 size={13} className="text-green-500" />
                    <span className="hidden sm:inline">Redo</span>
                  </button>
                </div>
              </div>
            )}

            {/* Loading Indicator Spinner screen */}
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center bg-[#F9F8F4] dark:bg-[#1F1E1B] text-[#121212] dark:text-[#FDFCF8] gap-3 select-none">
                <Loader2 className="w-10 h-10 text-red-600 dark:text-[#FDFCF8] animate-spin" />
                <div className="text-center font-mono">
                  <span className="text-sm font-bold block mb-1 uppercase tracking-wider">RENDERING VECTORS...</span>
                  <span className="text-[10px] opacity-60">Parsing geometries and caching projections</span>
                </div>
              </div>
            ) : errorMessage ? (
              /* Warning/error screen */
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none bg-[#FDFCF8] dark:bg-[#181816]">
                <AlertCircle className="w-12 h-12 text-red-600 mb-3 animate-pulse" />
                <h3 className="text-base font-serif italic font-bold text-[#121212] dark:text-[#FDFCF8] mb-1">
                  Data Loading Failure
                </h3>
                <p className="text-xs text-[#121212]/80 dark:text-[#FDFCF8]/80 max-w-sm mb-4 font-sans">
                  {errorMessage}
                </p>
                <div className="p-4 border border-[#121212] dark:border-[#3A3A36] bg-[#F9F8F4] dark:bg-[#1F1E1B] max-w-sm">
                  <p className="text-[10px] text-[#121212]/70 dark:text-[#FDFCF8]/70 leading-relaxed uppercase tracking-tight font-black">
                    You can drag & drop or upload any custom <strong>.geojson</strong> or <strong>.json</strong> files via the side directory to render them.
                  </p>
                </div>
              </div>
            ) : (
              /* Interactive Canvas Renderer view */
              <div className="flex-1 min-h-0 w-full h-full relative overflow-hidden flex flex-col" style={{ minHeight: '100%' }}>
                {bgLoading && (
                  <div style={{ zoom: effectiveUIZoom }} className="absolute bottom-4 right-4 z-10 bg-[#FDFCF8]/95 dark:bg-[#1C1C1A]/95 p-2 px-3 border border-[#121212] dark:border-[#3A3A36] backdrop-blur flex items-center gap-2 shadow-sm text-[#121212] dark:text-[#FDFCF8]">
                    <Loader2 size={12} className="animate-spin text-blue-600 animate-duration-1000" />
                    <span className="text-[10px] font-mono uppercase tracking-wider font-bold">
                      {bgProgress > 0 ? `Loading Map: ${bgProgress}%` : "Decoding background map..."}
                    </span>
                  </div>
                )}

                {bgError && (
                  <div style={{ zoom: effectiveUIZoom }} className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-10 bg-red-50 dark:bg-red-950/90 border border-red-600 p-3 max-w-sm flex flex-col gap-1.5 shadow-sm text-red-900 dark:text-red-100">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase font-mono tracking-wider">
                      <AlertCircle size={14} className="text-red-600 dark:text-red-400" />
                      <span>Background Image Error</span>
                    </div>
                    <p className="text-[10px] leading-relaxed opacity-95">{bgError}</p>
                    <button 
                      onClick={() => handleUpdateConfig(prev => ({ ...prev, bgImageFile: 'none' }))}
                      className="text-[9px] font-mono font-bold uppercase underline text-left mt-0.5 hover:opacity-80"
                    >
                      Disable background image
                    </button>
                  </div>
                )}

                <MapCanvas
                  uiZoom={effectiveUIZoom}
                  config={config}
                  features={mapData?.features || emptyFeatures}
                  selectedCountry={selectedCountry}
                  
                  onSelectCountry={handleSelectCountry}
                  onUpdateConfig={handleUpdateConfig}
                  customColors={customColors}
                  legendLabels={legendLabels}
                  onStartPaintStroke={handleStartPaintStroke}
                  onEndPaintStroke={handleEndPaintStroke}
                  onPaintCountry={(countryId, color, feature) => {
                    handleUpdateCustomColors(prev => {
                      const copy = { ...prev };
                      
                      if (brushScope && brushScope !== 'single' && feature?.properties) {
                        const rawKeys = Object.keys(feature.properties);
                        const matchedKey = rawKeys.find(k => k.toLowerCase() === brushScope.toLowerCase()) || brushScope;
                        const clickedValue = feature.properties[matchedKey];

                        if (clickedValue !== undefined && clickedValue !== null) {
                          const mapKey = `${matchedKey.toLowerCase()}:${String(clickedValue).toLowerCase()}`;
                          const targetIds = brushScopeIndex?.get(mapKey);

                          if (targetIds && targetIds.length > 0) {
                            for (let i = 0; i < targetIds.length; i++) {
                              const fId = targetIds[i];
                              if (color === null) {
                                delete copy[fId];
                              } else {
                                copy[fId] = color;
                              }
                            }
                            return copy;
                          }
                        }
                      }

                      if (color === null) {
                        delete copy[countryId];
                      } else {
                        copy[countryId] = color;
                      }
                      return copy;
                    });
                  }}
                  paintColor={paintColor}
                  setPaintColor={setPaintColor}
                  activeTool={activeTool}
                  setActiveTool={setActiveTool}
                  brushScope={brushScope}
                  selectedMapFile={currentFileName || selectedMapFile}
                  selectedBorderCountryIds={selectedBorderCountryIds}
                  onRightClickCountry={handleRightClickCountry}
                  customBorderSettings={customBorderSettings}
                  appliedCustomBorders={appliedCustomBorders}
                  viewport={viewport}
                  setViewport={setViewport}
                  decodedBgDescriptor={decodedBgDescriptor}
                  bgProgress={bgProgress}
                  importedLocations={importedLocations}
                  showLocations={showLocations}
                  showLocationLabels={showLocationLabels}
                  admin0Shape={admin0Shape}
                  admin0Color={admin0Color}
                  admin0Size={admin0Size}
                  admin1Shape={admin1Shape}
                  admin1Color={admin1Color}
                  admin1Size={admin1Size}
                  riversData={riversData}
                  popUnder50kShape={popUnder50kShape}
                  popUnder50kColor={popUnder50kColor}
                  popUnder50kSize={popUnder50kSize}
                  pop50kTo100kShape={pop50kTo100kShape}
                  pop50kTo100kColor={pop50kTo100kColor}
                  pop50kTo100kSize={pop50kTo100kSize}
                  pop100kTo1MShape={pop100kTo1MShape}
                  pop100kTo1MColor={pop100kTo1MColor}
                  pop100kTo1MSize={pop100kTo1MSize}
                  pop1MTo10MShape={pop1MTo10MShape}
                  pop1MTo10MColor={pop1MTo10MColor}
                  pop1MTo10MSize={pop1MTo10MSize}
                  popAbove10MShape={popAbove10MShape}
                  popAbove10MColor={popAbove10MColor}
                  popAbove10MSize={popAbove10MSize}
                  locationLabelSize={locationLabelSize}
            locationLabelOutlineRatio={locationLabelOutlineRatio}
                  stylizeAdmin1={stylizeAdmin1}
                  onRegisterExportHandlers={handleRegisterExportHandlers}
                />
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Hidden Font Preloader DOM elements to force browser HTTP font fetch on app load */}
      <div className="sr-only pointer-events-none opacity-0 fixed -z-50 top-0 left-0 w-0 h-0 overflow-hidden" aria-hidden="true">
        <span style={{ fontFamily: '"Bodoni Moda"' }}>Bodoni Moda</span>
        <span style={{ fontFamily: '"Cinzel"' }}>Cinzel</span>
        <span style={{ fontFamily: '"Cinzel Decorative"' }}>Cinzel Decorative</span>
        <span style={{ fontFamily: '"UnifrakturMaguntia"' }}>UnifrakturMaguntia</span>
        <span style={{ fontFamily: '"MedievalSharp"' }}>MedievalSharp</span>
        <span style={{ fontFamily: '"IM Fell English"' }}>IM Fell English</span>
        <span style={{ fontFamily: '"Marcellus"' }}>Marcellus</span>
        <span style={{ fontFamily: '"Almendra"' }}>Almendra</span>
        <span style={{ fontFamily: '"Pirata One"' }}>Pirata One</span>
        <span style={{ fontFamily: '"Cormorant Garamond"' }}>Cormorant Garamond</span>
        <span style={{ fontFamily: '"Playfair Display"' }}>Playfair Display</span>
        <span style={{ fontFamily: '"Roboto"' }}>Roboto</span>
        <span style={{ fontFamily: '"JetBrains Mono"' }}>JetBrains Mono</span>
        <span style={{ fontFamily: '"Outfit"' }}>Outfit</span>
        <span style={{ fontFamily: '"Space Grotesk"' }}>Space Grotesk</span>
      </div>
    </div>
  );
}
