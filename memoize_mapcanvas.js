const fs = require('fs');

const file = 'src/components/MapCanvas.tsx';
let code = fs.readFileSync(file, 'utf8');

// Replace export default function MapCanvas with const MapCanvas = React.memo(function MapCanvas
code = code.replace(/export default function MapCanvas\(\s*\{/, 'const MapCanvas = React.memo(function MapCanvas({');

// Replace final } with } from the component, add the comparator and export
const endReplace = `
  );
});

export default MapCanvas;
`;

// we need to replace the last `  );\n}` with our code.
const parts = code.split(/  \);\n\}/);
if (parts.length < 2) {
  console.log("Could not find the end of MapCanvas");
  process.exit(1);
}

// Join back the parts, except the last one.
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
