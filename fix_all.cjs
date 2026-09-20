const fs = require('fs');
let content = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

// 1. Remove "Rivers Layer" title
content = content.replace(
  /<div className="flex items-center gap-1\.5 text-\[#121212\] dark:text-\[#FDFCF8\]">\s*<Waves size=\{13\} className="text-red-650" \/>\s*<span className="text-\[10px\] font-mono uppercase tracking-widest font-black">Rivers Layer<\/span>\s*<\/div>/g,
  ''
);

// 2. import locations default size to 1, minimum size to 1
content = content.replace(/const \[importSymbolSize, setImportSymbolSize\] = useState<number>\(8\);/g, 'const [importSymbolSize, setImportSymbolSize] = useState<number>(1);');
content = content.replace(/symbolSize: Number\(importSymbolSize\) \|\| 8/g, 'symbolSize: Number(importSymbolSize) || 1');

// 3. minimum name label font size renamed to "Label font size" and minimum to 1
content = content.replace(/<span className="opacity-60 uppercase">Name Label Font Size<\/span>/g, '<span className="opacity-60 uppercase">Label font size</span>');
content = content.replace(/id="rng-loc-label-size"\s*type="range"\s*min="6"/g, 'id="rng-loc-label-size"\n                  type="range"\n                  min="1"');

// Wait, let's check what sliders need to be unified.
const sliderRegex = /className="(w-full h-1[^"]*appearance-none cursor-pointer[^"]*)"/g;
let match;
while ((match = sliderRegex.exec(content)) !== null) {
  content = content.replace(match[1], "w-full h-1 bg-[#E5E5E0] dark:bg-[#2C2C28] appearance-none cursor-pointer accent-[#121212] dark:accent-red-655");
}

fs.writeFileSync('src/components/Sidebar.tsx', content);
