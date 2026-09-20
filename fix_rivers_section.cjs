const fs = require('fs');
let content = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

// The original section
//               {/* Show Rivers Checkbox */}
//               <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-[#121212]/10 dark:border-white/10">
// ...
//               </div>
//             </div>
//           </div>
//         )}

const sectionToExtractStart = content.indexOf('{/* Show Rivers Checkbox */}');
// find the matching closing tag for this div
// well, it's easier to just use string manipulation.
content = content.replace(
  /\{\/\* Show Rivers Checkbox \*\/\}[\s\S]*?(?=<\/div>\s*<\/div>\s*<\/div>\s*\{\/\* Tab 3: LOCATIONS IMPORT)/,
  `</div>\n              {/* 4. RIVERS */}\n              <div className="flex flex-col gap-1.5">\n                <div className="flex items-center gap-1.5 text-[#121212] dark:text-[#FDFCF8]">\n                  <span className="text-[10px] font-mono uppercase tracking-widest font-black">Rivers Layer</span>\n                </div>\n                $&`
);
// wait, the $& includes the Show Rivers Checkbox comment. 
// let's adjust it so it's a separate block.

fs.writeFileSync('src/components/Sidebar.tsx.tmp', content);
