const fs = require('fs');
let content = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

const regex = /<div className="flex justify-between text-\[9px\] font-mono">\s*<span className="opacity-60 uppercase">Size<\/span>\s*<span className="font-bold">\{importSymbolSize\}<\/span>\s*<\/div>\s*<input\s*type="range"\s*min="2"/g;

content = content.replace(regex, `<div className="flex justify-between text-[9px] font-mono">\n                      <span className="opacity-60 uppercase">Size</span>\n                      <span className="font-bold">{importSymbolSize}</span>\n                    </div>\n                    <input\n                      type="range"\n                      min="1"`);

fs.writeFileSync('src/components/Sidebar.tsx', content);
