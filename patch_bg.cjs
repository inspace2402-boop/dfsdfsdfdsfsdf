const fs = require('fs');
let content = fs.readFileSync('src/components/MapCanvas.tsx', 'utf8');

const target = `            // Draw the projected background canvas onto our main offscreenCtx in screen space!
            offscreenCtx.save();
            offscreenCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
            offscreenCtx.imageSmoothingEnabled = true;`;

const replacement = `            // Draw the projected background canvas onto our main offscreenCtx in screen space!
            offscreenCtx.save();
            offscreenCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

            // OPTIMIZATION FIX: Apply an affine transform (scale & translate) to the cached background
            // frame so that it tracks perfectly with the vector features during 2D panning and zooming,
            // completely eliminating the "lagging behind" effect when the user drags the map!
            if (lastProjectedStateRef.current) {
              const last = lastProjectedStateRef.current;
              const ratio = currentViewportZoom / (last.currentZoom || 1);
              const tx = currentPan.x - (last.currentPanX ?? 0) * ratio;
              const ty = currentPan.y - (last.currentPanY ?? 0) * ratio;
              offscreenCtx.translate(tx, ty);
              offscreenCtx.scale(ratio, ratio);
            }

            offscreenCtx.imageSmoothingEnabled = true;`;

if (!content.includes(replacement)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('src/components/MapCanvas.tsx', content, 'utf8');
    console.log("Patched successfully!");
} else {
    console.log("Already patched.");
}
