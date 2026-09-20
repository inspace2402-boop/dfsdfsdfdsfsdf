const fs = require('fs');
const file = 'src/components/MapCanvas.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add selectedCountryRef
code = code.replace(
  /const hoveredCountryRef = useRef<CountryFeature \| null>\(null\);/,
  "const hoveredCountryRef = useRef<CountryFeature | null>(null);\n  const selectedCountryRef = useRef<CountryFeature | null>(null);\n  useEffect(() => {\n    selectedCountryRef.current = selectedCountry;\n  }, [selectedCountry]);"
);

// 2. Replace selectedCountry inside the render function (near lines 7660)
code = code.replace(
  /if \(selectedCountry\) \{\n\s*drawSingleHighlightOnscreen\(selectedCountry/g,
  "if (selectedCountryRef.current) {\n        drawSingleHighlightOnscreen(selectedCountryRef.current"
);
code = code.replace(
  /if \(selectedCountry\) \{\n\s*drawSingleBorderHighlightOnscreen\(selectedCountry/g,
  "if (selectedCountryRef.current) {\n        drawSingleBorderHighlightOnscreen(selectedCountryRef.current"
);

// 3. Remove selectedCountry from the big useEffect dependencies
// The dependency array is around line 7734.
// Let's use a regex to match the dependency array item
code = code.replace(
  /    features,\n    selectedCountry,\n    viewportPan,/g,
  "    features,\n    viewportPan,"
);

fs.writeFileSync(file, code);
console.log("Fixed selectedCountry ref in MapCanvas.");
