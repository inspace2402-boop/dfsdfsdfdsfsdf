const fs = require('fs');
let code = fs.readFileSync('src/components/MapCanvas.tsx', 'utf8');

const target = `            offscreenCtx.imageSmoothingEnabled = true;
            offscreenCtx.imageSmoothingQuality = 'high';
            offscreenCtx.drawImage(activeBgCanvas, 0, 0, dimensions.width, dimensions.height);`;

const replacement = `            const isInteractingNow = isDragging.current || isDraggingGlobe.current || isWheelingRef.current || isPinchingRef.current || isSliderPanningRef.current;
            offscreenCtx.imageSmoothingEnabled = !isInteractingNow;
            offscreenCtx.imageSmoothingQuality = isInteractingNow ? 'low' : 'high';
            offscreenCtx.drawImage(activeBgCanvas, 0, 0, dimensions.width, dimensions.height);`;

code = code.replace(target, replacement);

fs.writeFileSync('src/components/MapCanvas.tsx', code);
console.log('patched');
