const fs = require('fs');
let content = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

const regex = /\{\/\* Show Rivers Checkbox \*\/\}[\s\S]*?className="w-7 h-7 border border-\[#121212\]\/20 dark:border-\[#2C2C28\] bg-transparent p-0 cursor-pointer rounded shrink-0"\s*\/>\s*<\/div>\s*<\/div>\s*<\/div>\s*\)\}\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*\)\}/;

const startIdx = content.indexOf('{/* Show Rivers Checkbox */}');
if (startIdx === -1) throw new Error("Could not find start");

const endIdx = content.indexOf('        {/* Tab 3: LOCATIONS IMPORT & RENDERING SYSTEM */}');
if (endIdx === -1) throw new Error("Could not find end");

let before = content.substring(0, startIdx);
let chunk = content.substring(startIdx, endIdx);

// The chunk looks like:
//               {/* Show Rivers Checkbox */}
//               <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-[#121212]/10 dark:border-white/10">
// ...
//                 )}
//               </div>
//
//             </div>
//           </div>
//         )}

const chunkReplaced = chunk.replace(
  /\{\/\* Show Rivers Checkbox \*\/\}[\s\S]*?(?=<\/div>\s*<\/div>\s*<\/div>\s*\}\))/,
  `</div>
              {/* 4. RIVERS LAYER */}
              <div className="flex flex-col gap-1.5 pt-4 border-t border-[#121212]/10 dark:border-[#2C2C28]/20">
                <div className="flex items-center gap-1.5 text-[#121212] dark:text-[#FDFCF8]">
                  <Waves size={13} className="text-red-650" />
                  <span className="text-[10px] font-mono uppercase tracking-widest font-black">Rivers Layer</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="checkbox"
                    id="chk-show-rivers"
                    checked={!!config.showRivers}
                    onChange={(e) => onUpdateConfig((p) => ({ ...p, showRivers: e.target.checked }))}
                    className="accent-red-650 cursor-pointer"
                  />
                  <label htmlFor="chk-show-rivers" className="text-[10px] font-mono uppercase tracking-widest font-black text-[#121212] dark:text-[#FDFCF8] cursor-pointer">
                    Show Rivers
                  </label>
                </div>
                {config.showRivers && (
                  <div className="flex flex-col gap-2 pt-2 border-t border-[#121212]/5 dark:border-white/5">
                    <div className="flex justify-between items-center text-[10px] font-mono">
                      <span className="font-bold tracking-wide uppercase opacity-75">Thickness</span>
                      <span className="font-bold">{(config.riverThickness !== undefined ? config.riverThickness : 0.2).toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="3.0"
                      step="0.1"
                      value={config.riverThickness !== undefined ? config.riverThickness : 0.2}
                      onChange={(e) => onUpdateConfig((p) => ({ ...p, riverThickness: parseFloat(e.target.value) }))}
                      className="w-full h-1 bg-[#E5E5E0] dark:bg-[#2C2C28] appearance-none cursor-pointer accent-[#121212] dark:accent-red-655"
                    />
                    <div className="flex flex-col gap-1 pt-1.5 border-t border-[#121212]/10 dark:border-[#2C2C28]/30">
                      <label className="text-[10px] font-bold font-mono opacity-60 tracking-wide uppercase">
                        River Color
                      </label>
                      <div className="flex items-center gap-2">
                        <select
                          value={
                            !config.riverColor || config.riverColor === 'default'
                              ? 'default'
                              : ['#bae6fd', '#111e35', '#0d9488', '#e8e4d9', '#1c2024', '#06b6d4', '#2563eb'].includes(config.riverColor)
                              ? config.riverColor
                              : 'default'
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            onUpdateConfig((p) => ({ ...p, riverColor: val }));
                          }}
                          className="flex-1 text-[11px] font-mono uppercase px-2 py-1.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212] dark:border-[#2C2C28] text-[#121212] dark:text-[#FDFCF8] outline-none cursor-pointer"
                        >
                          <option value="default">Default River Color</option>
                          <option value="#bae6fd">Light Azure Blue</option>
                          <option value="#111e35">Deep Abyssal Navy</option>
                          <option value="#0d9488">Classic Nautical Teal</option>
                          <option value="#e8e4d9">Vintage Parchment Beige</option>
                          <option value="#1c2024">Dark Charcoal Ocean</option>
                          <option value="#06b6d4">Caribbean Cyan</option>
                          <option value="#2563eb">Royal Sapphire Blue</option>
                        </select>
                        <input
                          type="color"
                          value={config.riverColor && config.riverColor.startsWith('#') && config.riverColor.length === 7 ? config.riverColor : '#bae6fd'}
                          onChange={(e) => onUpdateConfig((p) => ({ ...p, riverColor: e.target.value }))}
                          className="w-7 h-7 border border-[#121212]/20 dark:border-[#2C2C28] bg-transparent p-0 cursor-pointer rounded shrink-0"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>`
);

content = before + chunkReplaced + content.substring(endIdx);
fs.writeFileSync('src/components/Sidebar.tsx', content);
