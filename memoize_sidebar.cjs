const fs = require('fs');

const file = 'src/components/Sidebar.tsx';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('import React')) {
  code = "import React from 'react';\n" + code;
}

code = code.replace(/export default function Sidebar\(\s*\{/, 'const Sidebar = React.memo(function Sidebar({');

const parts = code.split(/  \);\n\}/);
if (parts.length < 2) {
  console.log("Could not find the end of Sidebar");
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

export default Sidebar;
` + parts[parts.length - 1];

fs.writeFileSync(file, newCode);
console.log("Sidebar memoized.");
