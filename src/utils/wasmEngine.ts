// WebAssembly Raster Remapping Engine
// Interfaces and manages WASM linear memory and executescompiled remapper functions.

import { WASM_BASE64 } from './wasmBinary';

export interface MapPainterWasm {
  remapRaster: (
    outputOffset: number,
    inputOffset: number,
    bgW: number,
    bgH: number,
    dimensionsWidth: number,
    dimensionsHeight: number,
    srcW: number,
    srcH: number,
    projectionType: number,
    centerLon: number,
    centerLat: number,
    aspect: number,
    zoom: number,
    globeRadius: number,
    globeCenterX: number,
    globeCenterY: number,
    opacity: number,
    panX: number,
    panY: number,
    viewportZoom: number,
    rowStart: number,
    rowCount: number
  ) => void;
  memory: WebAssembly.Memory;
}

let wasmInstance: MapPainterWasm | null = null;
let wasmPromise: Promise<MapPainterWasm> | null = null;
const lastCopiedSrcDataMap = new WeakMap<object, Uint8ClampedArray>();

/**
 * Loads and instantiates the compiled WebAssembly remapper module.
 */
export async function getWasmEngine(): Promise<MapPainterWasm> {
  if (wasmInstance) return wasmInstance;
  if (!wasmPromise) {
    wasmPromise = (async () => {
      let bytes: ArrayBuffer;
      try {
        // Try fetching the compiled binary file directly (for development and standard builds)
        const res = await fetch('/map_painter.wasm');
        if (!res.ok) {
          throw new Error(`HTTP status ${res.status}`);
        }
        bytes = await res.arrayBuffer();
      } catch (fetchErr) {
        console.warn("Could not fetch /map_painter.wasm directly, falling back to embedded base64:", fetchErr);
        // Fallback: Decode the embedded Base64 WebAssembly binary directly in-memory!
        const binaryString = atob(WASM_BASE64);
        const len = binaryString.length;
        const u8 = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          u8[i] = binaryString.charCodeAt(i);
        }
        bytes = u8;
      }

      try {
        const obj = await WebAssembly.instantiate(bytes, {});
        wasmInstance = obj.instance.exports as unknown as MapPainterWasm;
        return wasmInstance;
      } catch (err) {
        console.error("Failed to instantiate WebAssembly binary:", err);
        throw err;
      }
    })();
  }
  return wasmPromise;
}

/**
 * Runs the WebAssembly-compiled projection and raster mapping loop.
 * This function dynamically scales the WASM linear memory buffer to fit the image and canvas sizes.
 */
export function executeWasmRemap(
  wasm: MapPainterWasm,
  srcData: Uint8ClampedArray | null,
  srcW: number,
  srcH: number,
  bgW: number,
  bgH: number,
  dimensionsWidth: number,
  dimensionsHeight: number,
  projectionType: number, // 0=equirectangular, 1=mercator, 2=orthographic, 3=azimuthalEqualArea, 4=gnomonic, 5=mollweide, 6=miller, 7=winkel3
  centerLon: number,
  centerLat: number,
  aspect: number,
  zoom: number,
  globeRadius: number,
  globeCenterX: number,
  globeCenterY: number,
  opacity: number,
  panX: number,
  panY: number,
  viewportZoom: number,
  rowStart: number,
  rowCount: number
): Uint8ClampedArray {
  const inSize = srcW * srcH * 4;
  const outSize = bgW * bgH * 4;

  const inputOffset = 16777216; // 16MB offset to protect WebAssembly runtime structures and static memory
  const outputOffset = inputOffset + inSize; // place output immediately after input in linear memory

  const totalBytesNeeded = outputOffset + outSize;
  const pagesNeeded = Math.ceil(totalBytesNeeded / 65536);

  // Dynamic memory scaling
  const currentPages = wasm.memory.buffer.byteLength / 65536;
  let memoryGrew = false;
  if (pagesNeeded > currentPages) {
    try {
      wasm.memory.grow(pagesNeeded - currentPages + 8); // grow with extra pages padding
      memoryGrew = true;
    } catch (e) {
      console.error("[wasmEngine] WASM Memory grow failed. System may be out of memory or reached limit:", e);
    }
  }

  // Check if WebAssembly memory is actually sufficient before accessing it
  const wasmMemoryBuffer = wasm.memory.buffer;
  if (wasmMemoryBuffer.byteLength < totalBytesNeeded) {
    throw new Error(`Insufficient WASM linear memory buffer (needed ${totalBytesNeeded} bytes, but only has ${wasmMemoryBuffer.byteLength} bytes). The background map might be too large.`);
  }

  // Copy raw source image pixels into WASM linear memory ONLY if srcData is provided and changed or memory grew
  if (srcData) {
    if (lastCopiedSrcDataMap.get(wasm) !== srcData || memoryGrew) {
      const inputView = new Uint8Array(wasmMemoryBuffer, inputOffset, inSize);
      inputView.set(srcData);
      lastCopiedSrcDataMap.set(wasm, srcData);
    }
  }

  // Invoke the WebAssembly compiled projection remapping loop
  wasm.remapRaster(
    outputOffset,
    inputOffset,
    bgW,
    bgH,
    dimensionsWidth,
    dimensionsHeight,
    srcW,
    srcH,
    projectionType,
    centerLon,
    centerLat,
    aspect,
    zoom,
    globeRadius,
    globeCenterX,
    globeCenterY,
    opacity,
    panX,
    panY,
    viewportZoom,
    rowStart,
    rowCount
  );

  // Retrieve rendered pixel buffer from WASM linear memory as a direct view
  return new Uint8ClampedArray(wasm.memory.buffer, outputOffset, outSize);
}
