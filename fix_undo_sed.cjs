const fs = require('fs');
let content = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

content = content.replace(/                <\/div>\n              <\/div>/g, '                </div>');
fs.writeFileSync('src/components/Sidebar.tsx', content);
