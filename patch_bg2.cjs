const fs = require('fs');
let content = fs.readFileSync('src/components/MapCanvas.tsx', 'utf8');

const target = `            if (lastProjectedStateRef.current) {
              const last = lastProjectedStateRef.current;
              const ratio = currentViewportZoom / (last.currentZoom || 1);
              const tx = currentPan.x - (last.currentPanX ?? 0) * ratio;
              const ty = currentPan.y - (last.currentPanY ?? 0) * ratio;
              offscreenCtx.translate(tx, ty);
              offscreenCtx.scale(ratio, ratio);
            }`;

const replacement = `            if (lastProjectedStateRef.current && config.projection !== 'orthographic') {
              const last = lastProjectedStateRef.current;
              const curZoom = interactiveViewportRef.current.zoom || 1;
              const curPan = interactiveViewportRef.current.pan || { x: 0, y: 0 };
              const ratio = curZoom / (last.currentZoom || 1);
              const tx = curPan.x - (last.currentPanX ?? 0) * ratio;
              const ty = curPan.y - (last.currentPanY ?? 0) * ratio;
              offscreenCtx.translate(tx, ty);
              offscreenCtx.scale(ratio, ratio);
            }`;

content = content.replace(target, replacement);
fs.writeFileSync('src/components/MapCanvas.tsx', content, 'utf8');
console.log("Patched successfully!");
