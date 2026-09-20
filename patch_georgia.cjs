const fs = require('fs');
const path = 'src/components/Sidebar.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /<option value="serif" style=\{\{ fontFamily: '"Playfair Display", serif' \}\}>Playfair Display<\/option>\s*/,
  `<option value="serif" style={{ fontFamily: '"Playfair Display", serif' }}>Playfair Display</option>
                      <option value="georgia" style={{ fontFamily: 'Georgia, serif' }}>Georgia</option>\n                      `
);

fs.writeFileSync(path, content, 'utf8');
