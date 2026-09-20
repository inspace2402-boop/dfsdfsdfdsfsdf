const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const exportFns = `
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
      a.download = \`\${selectedMapFile.replace(/\\.[^/.]+$/, '')}_save_\${Date.now()}.json\`;
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
`;

code = code.replace(
  `  const handleRegisterExportHandlers = useCallback((handlers: { exportPNG: (scale?: number) => void }) => {`,
  exportFns + `\n  const handleRegisterExportHandlers = useCallback((handlers: { exportPNG: (scale?: number) => void }) => {`
);

fs.writeFileSync('src/App.tsx', code);
console.log('App patched.');
