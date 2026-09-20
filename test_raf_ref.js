const fs = require('fs');
const file = 'src/components/MapCanvas.tsx';
let code = fs.readFileSync(file, 'utf8');

console.log(code.substring(4500, 4800));
