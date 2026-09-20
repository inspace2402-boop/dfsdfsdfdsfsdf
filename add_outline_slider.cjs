const fs = require('fs');
let content = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

const anchor = `              {/* Label Font size slider */}
              <div className="flex flex-col gap-1.5 py-1.5 border-t border-[#121212]/5 dark:border-white/5">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="opacity-60 uppercase">Label font size</span>
                  <span className="font-bold">{locationLabelSize}</span>
                </div>
                <input
                  id="rng-loc-label-size"
                  type="range"
                  min="1"
                  max="18"
                  step="0.5"
                  value={locationLabelSize}
                  onChange={(e) => setLocationLabelSize(parseFloat(e.target.value))}
                  className="w-full h-1 bg-[#E5E5E0] dark:bg-[#2C2C28] appearance-none cursor-pointer accent-[#121212] dark:accent-red-655"
                />
              </div>`;

const newSlider = `              {/* Outline font size slider (Location labels) */}
              <div className="flex flex-col gap-1.5 py-1.5 border-t border-[#121212]/5 dark:border-white/5">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="opacity-60 uppercase">Outline font size</span>
                  <span className="font-bold">{Math.round(locationLabelOutlineRatio * 100)}%</span>
                </div>
                <input
                  id="rng-loc-label-outline-size"
                  type="range"
                  min="0.00"
                  max="0.50"
                  step="0.01"
                  value={locationLabelOutlineRatio}
                  onChange={(e) => setLocationLabelOutlineRatio(parseFloat(e.target.value))}
                  className="w-full h-1 bg-[#E5E5E0] dark:bg-[#2C2C28] appearance-none cursor-pointer accent-[#121212] dark:accent-red-655"
                />
              </div>`;

content = content.replace(anchor, anchor + '\n' + newSlider);

// Also rename the view tab's LABEL BORDER RATIO to Outline font size
content = content.replace(/<span className="opacity-60 uppercase">LABEL BORDER RATIO<\/span>/g, '<span className="opacity-60 uppercase">Outline font size</span>');

fs.writeFileSync('src/components/Sidebar.tsx', content);
