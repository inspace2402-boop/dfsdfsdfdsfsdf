const fs = require('fs');
const content = fs.readFileSync('src/components/MapCanvas.tsx', 'utf8');
const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('animationFrameId = requestAnimationFrame(render);')) {
     console.log(`requestAnimationFrame at ${i}`);
  }
}
