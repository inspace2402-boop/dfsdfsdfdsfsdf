const fs = require('fs');
let code = fs.readFileSync('src/components/MapCanvas.tsx', 'utf8');

code = code.replace(
  "if (config.projection === 'orthographic') {\n      try {\n        proj.clipAngle(90);\n      } catch (e) {}",
  "if (config.projection === 'orthographic') {\n      try {\n        const Z = Math.max(0.01, config.zoom);\n        const angle = Z <= 1 ? 90 : (Math.asin(1 / Z) * 180) / Math.PI;\n        proj.clipAngle(angle);\n      } catch (e) {}"
);

fs.writeFileSync('src/components/MapCanvas.tsx', code);
