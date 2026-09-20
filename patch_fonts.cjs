const fs = require('fs');

const path = 'src/components/MapCanvas.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex1 = /if \(fontFam === 'roboto'\) return `bold \${sizePx}px "Roboto", "Inter", sans-serif`;\n/g;
const regex2 = /if \(fontFam === 'display'\) return `900 \${sizePx}px "Outfit", "Space Grotesk", "Arial Black", sans-serif`;\n/g;
const regex3 = /return `bold \${sizePx}px "Space Grotesk", "Inter", sans-serif`;/g;
const regex4 = /const fontFam = config.labelFontFamily \|\| 'sans';/g;

content = content.replace(regex1, '');
content = content.replace(regex2, '');
content = content.replace(regex3, 'return `bold ${sizePx}px "Georgia", serif`;');
content = content.replace(regex4, "const fontFam = config.labelFontFamily || 'georgia';");

fs.writeFileSync(path, content, 'utf8');
