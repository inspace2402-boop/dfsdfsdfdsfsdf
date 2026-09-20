const fs = require('fs');
const code = fs.readFileSync('src/components/MapCanvas.tsx', 'utf8');
const i = 102876;
console.log(code.substring(i - 100, i + 100));
