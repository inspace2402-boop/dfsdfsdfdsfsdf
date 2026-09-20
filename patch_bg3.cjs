const fs = require('fs');
let code = fs.readFileSync('src/components/MapCanvas.tsx', 'utf8');

const target = `            const currentViewportZoom = interactiveViewportRef.current.zoom || 1;
            const currentPan = interactiveViewportRef.current.pan || { x: 0, y: 0 };
            const qualityFactor = Math.min(2.5, Math.max(dpr * 1.25, 1.5) * Math.min(1.5, Math.sqrt(currentViewportZoom)));`;

const replacement = `            const currentViewportZoom = interactiveViewportRef.current.zoom || 1;
            const currentPan = interactiveViewportRef.current.pan || { x: 0, y: 0 };
            const isInteractingLocally = isDragging.current || isDraggingGlobe.current || isWheelingRef.current || isPinchingRef.current || isSliderPanningRef.current;
            const qualityFactor = isInteractingLocally ? 0.35 : Math.min(2.5, Math.max(dpr * 1.25, 1.5) * Math.min(1.5, Math.sqrt(currentViewportZoom)));`;

code = code.replace(target, replacement);

const target2 = `            const qualityFactor = Math.min(2.5, Math.max(dpr * 1.25, 1.5) * Math.min(1.5, Math.sqrt(currentViewportZoom)));`;
const replacement2 = `            const isInteractingLocally = isDragging.current || isDraggingGlobe.current || isWheelingRef.current || isPinchingRef.current || isSliderPanningRef.current;
            const qualityFactor = isInteractingLocally ? 0.35 : Math.min(2.5, Math.max(dpr * 1.25, 1.5) * Math.min(1.5, Math.sqrt(currentViewportZoom)));`;

if (!code.includes(replacement)) {
    code = code.replace(target2, replacement2);
}

fs.writeFileSync('src/components/MapCanvas.tsx', code);
console.log('patched');
