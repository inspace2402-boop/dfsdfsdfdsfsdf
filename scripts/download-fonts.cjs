const fs = require('fs');
const path = require('path');
const https = require('https');

const fontsDir = path.join(process.cwd(), 'public', 'fonts');
if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
}

const googleFontsUrl = 'https://fonts.googleapis.com/css2?family=Almendra:ital,wght@0,400;0,700;1,400&family=Cinzel+Decorative:wght@700&family=Cinzel:wght@400;600;700;900&family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,700&family=IM+Fell+English:ital@0;1&family=JetBrains+Mono:wght@400;500;600&family=Marcellus&family=MedievalSharp&family=Outfit:wght@400;600;800;900&family=Pirata+One&family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Space+Grotesk:wght@400;500;600;700&family=UnifrakturMaguntia&family=Inter:wght@400;500;600;700&display=swap';

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
  });
}

function downloadBinary(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, res => {
      res.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', err => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function run() {
  console.log('Fetching CSS from Google Fonts...');
  const css = await fetchText(googleFontsUrl);
  
  const fontFaceRegex = /@font-face\s*\{([^}]+)\}/g;
  let match;
  let fontIndex = 0;
  let localCss = '';

  while ((match = fontFaceRegex.exec(css)) !== null) {
    const block = match[1];
    const familyMatch = block.match(/font-family:\s*['"]?([^'"]+)['"]?;/);
    const styleMatch = block.match(/font-style:\s*([^;]+);/);
    const weightMatch = block.match(/font-weight:\s*([^;]+);/);
    const srcMatch = block.match(/src:\s*url\(([^)]+)\)/);

    if (familyMatch && srcMatch) {
      const family = familyMatch[1].trim();
      const style = styleMatch ? styleMatch[1].trim() : 'normal';
      const weight = weightMatch ? weightMatch[1].trim() : '400';
      const rawUrl = srcMatch[1].trim().replace(/^['"]|['"]$/g, '');
      const rangeMatch = block.match(/unicode-range:\s*([^;]+);/);
      const unicodeRange = rangeMatch ? rangeMatch[1].trim() : null;

      const sanitizeName = family.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const filename = `${sanitizeName}_w${weight}_${style}_${fontIndex}.woff2`;
      const destPath = path.join(fontsDir, filename);

      console.log(`Downloading font file ${filename} for ${family}...`);
      await downloadBinary(rawUrl, destPath);

      localCss += `@font-face {\n  font-family: "${family}";\n  font-style: ${style};\n  font-weight: ${weight};\n  font-display: swap;\n  src: url("/fonts/${filename}") format("woff2");\n${unicodeRange ? `  unicode-range: ${unicodeRange};\n` : ''}}\n\n`;
      fontIndex++;
    }
  }

  fs.writeFileSync(path.join(process.cwd(), 'src', 'fonts.css'), localCss);
  console.log(`Successfully downloaded ${fontIndex} font files and saved src/fonts.css!`);
}

run().catch(console.error);
