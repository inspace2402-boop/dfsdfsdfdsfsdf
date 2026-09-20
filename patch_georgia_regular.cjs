const fs = require('fs');
const path = 'src/components/MapCanvas.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/return `bold \$\{sizePx\}px "Georgia", serif`;/g, 'return `${sizePx}px "Georgia", serif`;');

fs.writeFileSync(path, content, 'utf8');
