import fs from 'fs';
import path from 'path';

const wasmPath = path.join(process.cwd(), 'public/map_painter.wasm');
const rootWasmPath = path.join(process.cwd(), 'map_painter.wasm');
const outPath = path.join(process.cwd(), 'src/utils/wasmBinary.ts');

try {
  const wasm = fs.readFileSync(wasmPath);
  fs.writeFileSync(rootWasmPath, wasm);
  const base64 = wasm.toString('base64');
  fs.writeFileSync(outPath, `export const WASM_BASE64 = "${base64}";\n`);
  console.log('Successfully compiled and synchronized WASM binary to wasmBinary.ts and root map_painter.wasm!');
} catch (err) {
  console.error('Error synchronizing WASM binary:', err);
  process.exit(1);
}
