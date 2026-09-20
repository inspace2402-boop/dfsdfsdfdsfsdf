const fs = require('fs');
let content = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

const oceanTemplates = `
                          <option value="default">Default River Color</option>
                          <option value="#bae6fd">Light Azure Blue</option>
                          <option value="#111e35">Deep Abyssal Navy</option>
                          <option value="#0d9488">Classic Nautical Teal</option>
                          <option value="#e8e4d9">Vintage Parchment Beige</option>
                          <option value="#1c2024">Dark Charcoal Ocean</option>
                          <option value="#06b6d4">Caribbean Cyan</option>
                          <option value="#2563eb">Royal Sapphire Blue</option>
`;

// Find the <select> for riverColor and replace options
content = content.replace(/<option value="default">Default Adaptive<\/option>\s*<option value="#121212">Jet Black[^<]*<\/option>\s*<option value="#FDFCF8">Off-White[^<]*<\/option>\s*<option value="#475569">Slate Gray[^<]*<\/option>\s*<option value="#94a3b8">Light Gray[^<]*<\/option>\s*<option value="#d97706">Gold \/ Brass[^<]*<\/option>\s*<option value="#ef4444">Bright Red[^<]*<\/option>\s*<option value="#3b82f6">Ocean Blue[^<]*<\/option>/, 
  oceanTemplates.trim());

content = content.replace(/\['#121212', '#FDFCF8', '#475569', '#94a3b8', '#d97706', '#ef4444', '#3b82f6'\]\.includes\(config\.riverColor\)/,
  "['#bae6fd', '#111e35', '#0d9488', '#e8e4d9', '#1c2024', '#06b6d4', '#2563eb'].includes(config.riverColor)");

content = content.replace(/config\.riverColor \? config\.riverColor : '#3b82f6'/g, "config.riverColor ? config.riverColor : '#bae6fd'");

fs.writeFileSync('src/components/Sidebar.tsx', content);
