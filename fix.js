const fs = require('fs');
const file = 'src/components/MapCanvas.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  "    return () => {\n      cancelAnimationFrame(animationFrameId);\n    };\n  const enlargedFeaturesList = React.useMemo(() => {",
  "    return () => {\n      cancelAnimationFrame(animationFrameId);\n    };\n  }, []);\n\n  const enlargedFeaturesList = React.useMemo(() => {"
);

fs.writeFileSync(file, code);
