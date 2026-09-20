const fs = require('fs');
let content = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

content = content.replace(/\}px<\/span>/g, '}</span>');
content = content.replace(/\}px\)/g, '})');
content = content.replace(/\}px</g, '}<');
content = content.replace(/: (.*)\}px/g, ': $1}');

fs.writeFileSync('src/components/Sidebar.tsx', content);
