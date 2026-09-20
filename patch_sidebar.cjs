const fs = require('fs');
let code = fs.readFileSync('src/components/Sidebar.tsx', 'utf-8');

const exportMapSection = `
            {/* TopoJSON Save/Load Section */}
            <div className="p-4 border border-[#121212] dark:border-[#2C2C28] bg-[#FDFCF8] dark:bg-[#181816] flex flex-col gap-4 shadow-sm">
              <div className="flex items-center gap-2 text-[#121212] dark:text-[#FDFCF8]">
                <Database size={15} className="text-purple-650" />
                <span className="text-[11px] font-mono uppercase tracking-widest font-black">Save / Load Map</span>
              </div>
              <p className="text-[10px] opacity-65 leading-relaxed font-sans">
                Export and import your entire map graphic, data topology, customization settings, palettes, and layouts to a single TopoJSON file.
              </p>
              
              <div className="flex flex-col gap-2 mt-1">
                <button
                  type="button"
                  onClick={onExportTopoJSON}
                  className="w-full py-3 px-4 bg-[#121212] dark:bg-[#FDFCF8] hover:bg-[#333] dark:hover:bg-[#e0e0e0] text-[#FDFCF8] dark:text-[#121212] transition text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.99]"
                >
                  <Download size={14} />
                  <span>Save TopoJSON Project</span>
                </button>
                <div className="relative w-full">
                  <input 
                    type="file"
                    accept=".json"
                    onChange={onImportTopoJSON}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <button
                    type="button"
                    className="w-full py-3 px-4 bg-transparent border border-[#121212] dark:border-[#FDFCF8] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[#121212] dark:text-[#FDFCF8] transition text-xs font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.99]"
                  >
                    <Download size={14} className="rotate-180" />
                    <span>Load TopoJSON Project</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 border border-[#121212] dark:border-[#2C2C28] bg-[#FDFCF8] dark:bg-[#181816] flex flex-col gap-4 shadow-sm">
              <div className="flex items-center gap-2 text-[#121212] dark:text-[#FDFCF8]">
                <Download size={15} className="text-red-650" />
                <span className="text-[11px] font-mono uppercase tracking-widest font-black">Export Image</span>
              </div>
              <p className="text-[10px] opacity-65 leading-relaxed font-sans">
`;

code = code.replace(
    `<div className="p-4 border border-[#121212] dark:border-[#2C2C28] bg-[#FDFCF8] dark:bg-[#181816] flex flex-col gap-4 shadow-sm">
              <div className="flex items-center gap-2 text-[#121212] dark:text-[#FDFCF8]">
                <Download size={15} className="text-red-650" />
                <span className="text-[11px] font-mono uppercase tracking-widest font-black">Export Map</span>
              </div>
              <p className="text-[10px] opacity-65 leading-relaxed font-sans">`,
    exportMapSection
);

fs.writeFileSync('src/components/Sidebar.tsx', code);
console.log('Sidebar patched.');
