const fs = require('fs');
let content = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

const oldTemplates = `                          <option value="default">Default Adaptive</option>
                          <option value="#121212">Jet Black (#121212)</option>
                          <option value="#FDFCF8">Off-White (#FDFCF8)</option>
                          <option value="#475569">Slate Gray (#475569)</option>
                          <option value="#94a3b8">Light Gray (#94a3b8)</option>
                          <option value="#d97706">Gold / Brass (#d97706)</option>
                          <option value="#ef4444">Bright Red (#ef4444)</option>
                          <option value="#3b82f6">Ocean Blue (#3b82f6)</option>`;

const newTemplates = `                          <option value="default">Default River Color</option>
                          <option value="#bae6fd">Light Azure Blue</option>
                          <option value="#111e35">Deep Abyssal Navy</option>
                          <option value="#0d9488">Classic Nautical Teal</option>
                          <option value="#e8e4d9">Vintage Parchment Beige</option>
                          <option value="#1c2024">Dark Charcoal Ocean</option>
                          <option value="#06b6d4">Caribbean Cyan</option>
                          <option value="#2563eb">Royal Sapphire Blue</option>`;

content = content.replace(oldTemplates, newTemplates);
content = content.replace(/value=\{config\.riverColor && config\.riverColor\.startsWith\('#'\) && config\.riverColor\.length === 7 \? config\.riverColor : '#3b82f6'\}/, 
  "value={config.riverColor && config.riverColor.startsWith('#') && config.riverColor.length === 7 ? config.riverColor : '#bae6fd'}");

fs.writeFileSync('src/components/Sidebar.tsx', content);
