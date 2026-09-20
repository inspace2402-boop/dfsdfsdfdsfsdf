const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');

// The original URL contains:
// &family=Outfit:wght@400;600;800;900
// &family=Roboto:ital,wght@0,400;0,500;0,700;0,900;1,400;1,700
// &family=Space+Grotesk:wght@400;500;600;700

content = content.replace(/&family=Outfit[^&]*/g, '');
content = content.replace(/&family=Roboto[^&]*/g, '');
content = content.replace(/&family=Space\+Grotesk[^&]*/g, '');

fs.writeFileSync('index.html', content, 'utf8');
