const fs = require('fs');

const file = 'src/components/MapCanvas.tsx';
let code = fs.readFileSync(file, 'utf8');

// Replace export default function MapCanvas with const MapCanvas = React.memo(function MapCanvas
code = code.replace(/export default function MapCanvas\(\s*\{/, 'const MapCanvas = React.memo(function MapCanvas({');

const parts = code.split(/  \);\n\}/);
if (parts.length < 2) {
  console.log("Could not find the end of MapCanvas");
  process.exit(1);
}

let newCode = parts.slice(0, -1).join('  );\n}') + `  );
}, (prevProps, nextProps) => {
  for (const key in nextProps) {
    if (typeof nextProps[key] !== 'function') {
      if (prevProps[key] !== nextProps[key]) {
        return false;
      }
    }
  }
  return true;
});

export default MapCanvas;
` + parts[parts.length - 1];

fs.writeFileSync(file, newCode);
console.log("MapCanvas memoized.");
