const fs = require('fs');
let content = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

// Replace class names for <select>
content = content.replace(/className="flex-1 text-(?:xs|\[11px\]) font-mono uppercase px-[23] py-(?:1|1\.5|2) bg-\[#FDFCF8\] dark:bg-\[#181816\] border border-\[#121212\] dark:border-\[#2C2C28\] text-\[#121212\] dark:text-\[#FDFCF8\] outline-none cursor-pointer"/g, 
  'className="flex-1 text-[11px] font-mono uppercase px-2 py-1.5 bg-[#FDFCF8] dark:bg-[#181816] border border-[#121212] dark:border-[#2C2C28] text-[#121212] dark:text-[#FDFCF8] outline-none cursor-pointer"');

// Replace class names for <input type="color">
content = content.replace(/className="w-[678] h-[678] (?:p-[01] )?(?:border-0 )?(?:border border-\[#121212\](?:\/20)? dark:border-\[#2C2C28\] )?(?:bg-transparent )?(?:bg-\[#FDFCF8\] dark:bg-\[#181816\] )?p-0 cursor-pointer rounded(?:-sm|-none)? shrink-0"/g,
  'className="w-7 h-7 border border-[#121212]/20 dark:border-[#2C2C28] bg-transparent p-0 cursor-pointer rounded shrink-0"');

// Wait, the river color had className="w-6 h-6 p-0 border-0 cursor-pointer rounded-sm bg-transparent"
content = content.replace(/className="w-6 h-6 p-0 border-0 cursor-pointer rounded-sm bg-transparent"/g,
  'className="w-7 h-7 border border-[#121212]/20 dark:border-[#2C2C28] bg-transparent p-0 cursor-pointer rounded shrink-0"');

content = content.replace(/className="w-8 h-8 p-1 border border-\[#121212\] dark:border-\[#2C2C28\] bg-\[#FDFCF8\] dark:bg-\[#181816\] cursor-pointer rounded-none"/g,
  'className="w-7 h-7 border border-[#121212]/20 dark:border-[#2C2C28] bg-transparent p-0 cursor-pointer rounded shrink-0"');

content = content.replace(/className="w-8 h-8 border border-\[#121212\]\/20 dark:border-\[#2C2C28\] bg-transparent p-0 cursor-pointer rounded shrink-0"/g,
  'className="w-7 h-7 border border-[#121212]/20 dark:border-[#2C2C28] bg-transparent p-0 cursor-pointer rounded shrink-0"');

fs.writeFileSync('src/components/Sidebar.tsx', content);
