const fs = require('fs');
const file = 'src/components/MapCanvas.tsx';
let code = fs.readFileSync(file, 'utf8');
const match = code.match(/useEffect\(\(\) => \{\n\s*let animationFrameId: number;\n\s*let lastTime = 0;\n\s*const render = \(time: number\) => \{/);
console.log(match ? "Found render start" : "Not found");
