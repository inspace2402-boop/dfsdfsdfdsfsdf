const fs = require('fs');
let content = fs.readFileSync('src/components/MapCanvas.tsx', 'utf8');

const regex = /const color = loc\.classType === 'admin0' \? admin0Color : admin1Color;\s*const rawSize = loc\.classType === 'admin0' \? admin0Size : admin1Size;\s*const size = rawSize;\s*svgContent \+= \`      <circle cx="\$\{x\}" cy="\$\{y\}" r="\$\{size\}" fill="\$\{color\}" stroke="#ffffff" stroke-width="1" \/>\\n\`;/;

const newStr = `          const color = loc.symbolColor || (loc.classType === 'admin0' ? admin0Color : admin1Color);
          const size = loc.symbolSize || (loc.classType === 'admin0' ? admin0Size : admin1Size);
          const locStrokeW = Math.max(0.3, size * 0.15);
          svgContent += \`      <circle cx="\${x}" cy="\${y}" r="\${size}" fill="\${color}" stroke="#000000" stroke-width="\${locStrokeW.toFixed(2)}" />\\n\`;`;

content = content.replace(regex, newStr);
fs.writeFileSync('src/components/MapCanvas.tsx', content);
