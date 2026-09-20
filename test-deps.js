const fs = require('fs');
const content = fs.readFileSync('src/components/MapCanvas.tsx', 'utf8');
const lines = content.split('\n');
let insideUseEffect = false;
let useEffectStart = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('useEffect(() => {') && lines[i+1] && lines[i+1].includes('needsBaseRedrawRef.current = true;')) {
     console.log(`Base redraw effect around line ${i}`);
  }
}
