import { getWasmEngine } from './wasmEngine';

export interface DecodedRaster {
  width: number;
  height: number;
  data: Uint8ClampedArray; // RGBA data
}

// Persistent global registry to store heavy background image pixel data.
// By holding the raw TypedArray globally and passing lightweight descriptors
// through React state and props, we prevent iframe communication and React DevTools
// from serializing/cloning large datasets, completely eliminating DataCloneError.
export const globalDecodedBgRegistry = new Map<string, Uint8ClampedArray>();

export interface DecodedBgDescriptor {
  cacheKey: string;
  width: number;
  height: number;
  isTiled?: boolean;
}

/**
 * Helper to ensure an image source is safe for <img> loading,
 * converting raw.githubusercontent nosniff streams or octet-stream blobs into proper image/png ObjectURLs.
 */
async function prepareImageSource(fileOrUrl: File | string): Promise<{ src: string; cleanup: () => void }> {
  if (typeof fileOrUrl === 'string') {
    if (fileOrUrl.includes('raw.githubusercontent.com')) {
      try {
        const res = await fetch(fileOrUrl);
        if (res.ok) {
          const rawBlob = await res.blob();
          const imgBlob = new Blob([rawBlob], { type: 'image/png' });
          const url = URL.createObjectURL(imgBlob);
          return { src: url, cleanup: () => URL.revokeObjectURL(url) };
        }
      } catch (e) {
        console.warn('Failed to pre-fetch raw.githubusercontent image, using direct URL fallback', e);
      }
    }
    return { src: fileOrUrl, cleanup: () => {} };
  }

  let blobToUse: Blob = fileOrUrl;
  if (!fileOrUrl.type || fileOrUrl.type === 'application/octet-stream' || !fileOrUrl.type.startsWith('image/')) {
    let guessedType = 'image/png';
    const name = (fileOrUrl as File).name || '';
    if (/\.jpe?g$/i.test(name)) guessedType = 'image/jpeg';
    else if (/\.webp$/i.test(name)) guessedType = 'image/webp';
    else if (/\.svg$/i.test(name)) guessedType = 'image/svg+xml';
    blobToUse = new Blob([fileOrUrl], { type: guessedType });
  }
  const objUrl = URL.createObjectURL(blobToUse);
  return { src: objUrl, cleanup: () => URL.revokeObjectURL(objUrl) };
}

/**
 * Decodes a standard image file (PNG/JPG/etc.) into RGBA pixel data.
 * Automatically downscales large images to prevent WebAssembly memory crashes.
 */
export async function decodeBackgroundFile(
  fileOrUrl: File | string
): Promise<DecodedRaster> {
  const { src, cleanup } = await prepareImageSource(fileOrUrl);

  return new Promise((resolve, reject) => {
    const img = new Image();
    if (src.startsWith('http://') || src.startsWith('https://')) {
      img.crossOrigin = 'anonymous'; // Only use crossOrigin for external URLs
    }
    img.onload = () => {
      cleanup();
      try {
        if (img.width === 0 || img.height === 0) {
          reject(new Error('Loaded background image has invalid empty dimensions (0x0).'));
          return;
        }

        // Safe maximum dimension to prevent high memory usage and WebAssembly memory growth limits.
        // 4096 width is a beautiful sweet spot (4K UHD width) that provides stellar, ultra-sharp high-fidelity details
        // while remaining highly stable and fast under WebAssembly memory management.
        const MAX_DIMENSION = 4096;
        let targetWidth = img.width;
        let targetHeight = img.height;

        if (targetWidth > MAX_DIMENSION || targetHeight > MAX_DIMENSION) {
          const ratio = Math.min(MAX_DIMENSION / targetWidth, MAX_DIMENSION / targetHeight);
          targetWidth = Math.round(targetWidth * ratio);
          targetHeight = Math.round(targetHeight * ratio);
          console.log(`[bgDecoder] Downscaling large background image from ${img.width}x${img.height} to ${targetWidth}x${targetHeight} for optimal WASM stability.`);
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not initialize 2D context for image decoding.'));
          return;
        }

        // Enable high quality scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);

        // Explicitly clear and resize canvas to 0 to free GPU and system resources immediately
        canvas.width = 0;
        canvas.height = 0;

        resolve({
          width: targetWidth,
          height: targetHeight,
          data: imgData.data,
        });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      cleanup();
      reject(new Error('Failed to decode image file. Make sure it is a valid JPEG, PNG, or GIF.'));
    };

    img.src = src;
  });
}

/**
 * Loads and decodes an image progressively in tiles, copying each tile's raw data
 * directly into WebAssembly linear memory. This bypasses the browser's large canvas size
 * limits, avoids high heap memory allocations, and keeps the UI responsive via frame-by-frame yields.
 */
export async function loadAndTileBackground(
  fileOrUrl: File | string,
  onProgress: (percent: number, descriptor?: DecodedBgDescriptor) => void
): Promise<DecodedBgDescriptor> {
  const cacheKey = typeof fileOrUrl === 'string' ? fileOrUrl : fileOrUrl.name;

  // Fast path: use native createImageBitmap for hardware-accelerated, non-blocking decoding
  if (typeof createImageBitmap === 'function') {
    try {
      let blob: Blob;
      if (fileOrUrl instanceof Blob) {
        blob = fileOrUrl;
      } else {
        const resp = await fetch(fileOrUrl);
        blob = await resp.blob();
      }

      const bitmap = await createImageBitmap(blob);
      const srcW = bitmap.width;
      const srcH = bitmap.height;

      if (srcW > 0 && srcH > 0 && srcW <= 16384 && srcH <= 16384) {
        const descriptor: DecodedBgDescriptor = {
          cacheKey,
          width: srcW,
          height: srcH,
          isTiled: true,
        };

        const offCanvas = typeof OffscreenCanvas !== 'undefined'
          ? new OffscreenCanvas(srcW, srcH)
          : document.createElement('canvas');
        offCanvas.width = srcW;
        offCanvas.height = srcH;
        const ctx = (offCanvas.getContext('2d', { willReadFrequently: true }) ||
          offCanvas.getContext('2d')) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;

        if (ctx) {
          ctx.drawImage(bitmap, 0, 0);
          bitmap.close();
          const imgData = ctx.getImageData(0, 0, srcW, srcH);
          offCanvas.width = 0;
          offCanvas.height = 0;

          const wasm = await getWasmEngine();
          const inSize = srcW * srcH * 4;
          const outSize = 2560 * 1600 * 4;
          const inputOffset = 16777216;
          const outputOffset = inputOffset + inSize;
          const totalBytesNeeded = outputOffset + outSize;
          const pagesNeeded = Math.ceil(totalBytesNeeded / 65536);
          const currentPages = wasm.memory.buffer.byteLength / 65536;

          if (pagesNeeded > currentPages) {
            wasm.memory.grow(pagesNeeded - currentPages + 8);
          }

          const wasmU8 = new Uint8Array(wasm.memory.buffer);
          wasmU8.set(imgData.data, inputOffset);
          globalDecodedBgRegistry.set(cacheKey, imgData.data);

          onProgress(100, descriptor);
          return descriptor;
        }
      }
      bitmap.close();
    } catch (fastErr) {
      console.warn("[bgDecoder] Fast native bitmap decoder fallback to progressive tile loader:", fastErr);
    }
  }

  const { src, cleanup } = await prepareImageSource(fileOrUrl);

  return new Promise((resolve, reject) => {
    const img = new Image();
    if (src.startsWith('http://') || src.startsWith('https://')) {
      img.crossOrigin = 'anonymous'; // Enable CORS for external URLs
    }
    img.onload = async () => {
      cleanup();
      try {
        if (img.width === 0 || img.height === 0) {
          reject(new Error('Loaded background image has invalid empty dimensions (0x0).'));
          return;
        }

        const srcW = img.width;
        const srcH = img.height;

        // Prevent ridiculous resolutions beyond 16K (which is the hardware boundary for most modern systems)
        const MAX_DIMENSION = 16384;
        if (srcW > MAX_DIMENSION || srcH > MAX_DIMENSION) {
          reject(new Error(`Background map resolution (${srcW}x${srcH}) exceeds the maximum supported 16K limit (16384x16384).`));
          return;
        }

        console.log(`[bgDecoder] Progressive Tile-Loader initialized for ${srcW}x${srcH} map.`);

        const cacheKey = typeof fileOrUrl === 'string' ? fileOrUrl : fileOrUrl.name;
        const descriptor: DecodedBgDescriptor = {
          cacheKey,
          width: srcW,
          height: srcH,
          isTiled: true,
        };

        // Send descriptor immediately to allow progressive rendering of tiles as they copy
        onProgress(0, descriptor);

        // Instantiate WASM engine so we can directly access its linear memory
        const wasm = await getWasmEngine();

        // Dynamically scale WASM memory to comfortably fit the source image and viewport canvas buffers
        const estBgW = 2048;
        const estBgH = 1280;
        const inSize = srcW * srcH * 4;
        const outSize = estBgW * estBgH * 4;
        const inputOffset = 16777216; // 16MB offset
        const outputOffset = inputOffset + inSize;
        const totalBytesNeeded = outputOffset + outSize;
        const pagesNeeded = Math.ceil(totalBytesNeeded / 65536);

        const currentPages = wasm.memory.buffer.byteLength / 65536;
        if (pagesNeeded > currentPages) {
          try {
            wasm.memory.grow(pagesNeeded - currentPages + 8);
            console.log(`[bgDecoder] Expanded WASM memory to ${wasm.memory.buffer.byteLength / (1024 * 1024)} MB for high-res map.`);
          } catch (e) {
            reject(new Error(`Failed to allocate WebAssembly memory for full-resolution ${srcW}x${srcH} map. Please use a slightly smaller image.`));
            return;
          }
        }

        // Divide the image into a grid of tiles
        const TILE_SIZE = 2048;
        const cols = Math.ceil(srcW / TILE_SIZE);
        const rows = Math.ceil(srcH / TILE_SIZE);
        const totalTiles = cols * rows;

        const tileCanvas = document.createElement('canvas');
        tileCanvas.width = TILE_SIZE;
        tileCanvas.height = TILE_SIZE;
        const tileCtx = tileCanvas.getContext('2d', { willReadFrequently: true });
        if (!tileCtx) {
          reject(new Error("Could not initialize 2D context for tile extraction."));
          return;
        }

        let tilesProcessed = 0;
        let lastYieldTime = performance.now();
        
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const startX = c * TILE_SIZE;
            const startY = r * TILE_SIZE;
            const tileW = Math.min(TILE_SIZE, srcW - startX);
            const tileH = Math.min(TILE_SIZE, srcH - startY);

            // Clean the tile canvas area
            tileCtx.clearRect(0, 0, TILE_SIZE, TILE_SIZE);
            // Draw this specific tile segment of the full image
            tileCtx.drawImage(img, startX, startY, tileW, tileH, 0, 0, tileW, tileH);
            const imgData = tileCtx.getImageData(0, 0, tileW, tileH);
            const tileData = imgData.data;

            // Direct memory copy row-by-row into the WASM buffer
            const wasmMemoryBuffer = wasm.memory.buffer;
            const wasmU8 = new Uint8Array(wasmMemoryBuffer);

            for (let ty = 0; ty < tileH; ty++) {
              const fullY = startY + ty;
              const wasmDestIdx = inputOffset + (fullY * srcW + startX) * 4;
              const tileSrcIdx = (ty * tileW) * 4;
              // Copy individual row
              const sourceSlice = tileData.subarray(tileSrcIdx, tileSrcIdx + tileW * 4);
              wasmU8.set(sourceSlice, wasmDestIdx);
            }

            tilesProcessed++;
            
            // Time-based yielding to process multiple tiles per frame if possible, significantly speeding up load times
            if (performance.now() - lastYieldTime > 16 || tilesProcessed === totalTiles) {
              onProgress(Math.round((tilesProcessed / totalTiles) * 100), descriptor);
              await new Promise((res) => requestAnimationFrame(res));
              lastYieldTime = performance.now();
            }
          }
        }

        // Clean up offscreen canvas immediately
        tileCanvas.width = 0;
        tileCanvas.height = 0;

        // Store full pixel array in globalDecodedBgRegistry so WebGPU hardware accelerator can upload it to VRAM
        try {
          const fullU8 = new Uint8ClampedArray(wasm.memory.buffer, inputOffset, inSize).slice();
          globalDecodedBgRegistry.set(cacheKey, fullU8);
        } catch (e) {
          console.warn("[bgDecoder] Could not extract full Uint8ClampedArray slice for WebGPU:", e);
        }

        resolve(descriptor);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      cleanup();
      reject(new Error('Failed to load image file. Make sure it is a valid JPEG, PNG, or WebP.'));
    };

    img.src = src;
  });
}
