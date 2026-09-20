const GITHUB_MAPDATA_BASE_URL = 'https://raw.githubusercontent.com/johnnull6967/MapPainterAssets/main/mapdata';
const JSDELIVR_MAPDATA_BASE_URL = 'https://cdn.jsdelivr.net/gh/johnnull6967/MapPainterAssets@main/mapdata';
const FLAGCDN_BASE_URL = 'https://flagcdn.com';

// Map virtual path back to standardized lookup keys
function normalizePath(path: string): string {
  let cleaned = path.replace(/^\//, ''); // remove leading slash
  cleaned = cleaned.replace(/^mapdata\//i, ''); // remove mapdata/ prefix
  return cleaned;
}

/**
 * Resolves an asset path to a direct URL (GitHub mapdata primary, jsDelivr CDN fallback, or FlagCDN).
 */
export async function getMapAssetUrl(path: string): Promise<string> {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const clean = normalizePath(path);

  if (clean.toLowerCase().startsWith('flags/')) {
    const sub = clean.substring(6); // e.g. "af.svg"
    const code = sub.replace(/\.svg$/i, '').toLowerCase();
    return `${FLAGCDN_BASE_URL}/${code}.svg`;
  }

  return `${JSDELIVR_MAPDATA_BASE_URL}/${clean}`;
}

/**
 * Gets alternative fallback URL if primary CDN fails
 */
export function getMapAssetFallbackUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const clean = normalizePath(path);
  if (clean.toLowerCase().startsWith('flags/')) {
    const sub = clean.substring(6);
    const code = sub.replace(/\.svg$/i, '').toLowerCase();
    return `${FLAGCDN_BASE_URL}/${code}.svg`;
  }
  return `${GITHUB_MAPDATA_BASE_URL}/${clean}`;
}

const blobMemoryCache = new Map<string, Blob>();

/**
 * Fetches a map asset as a Blob with retries and CDN fallback.
 * Uses in-memory and CacheStorage caching for instant loading on subsequent requests.
 */
export async function getMapAssetBlob(path: string): Promise<Blob> {
  const clean = normalizePath(path);
  if (blobMemoryCache.has(clean)) {
    return blobMemoryCache.get(clean)!;
  }

  // Check persistent CacheStorage API if available
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open('map-assets-cache-v1');
      const cachedResponse = await cache.match(`/cached-asset/${clean}`);
      if (cachedResponse) {
        const cachedBlob = await cachedResponse.blob();
        if (cachedBlob && cachedBlob.size > 100) {
          blobMemoryCache.set(clean, cachedBlob);
          return cachedBlob;
        }
      }
    } catch (e) {
      // Ignore cache match errors and fallback to network
    }
  }

  const primaryUrl = await getMapAssetUrl(path);
  const fallbackUrl = getMapAssetFallbackUrl(path);

  const urlsToTry: string[] = [];
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    urlsToTry.push(`/api/map-asset?path=${encodeURIComponent(clean)}`);
  }
  // Try jsDelivr fallback first for CDN reliability & proper image MIME types
  if (fallbackUrl && !urlsToTry.includes(fallbackUrl)) {
    urlsToTry.push(fallbackUrl);
  }
  if (!urlsToTry.includes(primaryUrl)) {
    urlsToTry.push(primaryUrl);
  }

  let lastErr: any = null;

  for (const url of urlsToTry) {
    let retries = 2;
    while (retries > 0) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const contentType = (response.headers.get('content-type') || '').toLowerCase();
          // Guard against SPA fallback index.html masquerading as an asset
          if (contentType.includes('text/html')) {
            throw new Error(`Received HTML instead of binary asset from ${url}`);
          }
          const rawBlob = await response.blob();
          if (rawBlob.size > 100) {
            // Determine correct MIME type for images
            let targetType = rawBlob.type;
            if (!targetType || targetType === 'application/octet-stream') {
              if (clean.endsWith('.png')) targetType = 'image/png';
              else if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) targetType = 'image/jpeg';
              else if (clean.endsWith('.webp')) targetType = 'image/webp';
              else if (clean.endsWith('.svg')) targetType = 'image/svg+xml';
            }
            const finalBlob = targetType && targetType !== rawBlob.type
              ? new Blob([rawBlob], { type: targetType })
              : rawBlob;

            blobMemoryCache.set(clean, finalBlob);

            // Store in CacheStorage asynchronously
            if (typeof caches !== 'undefined') {
              caches.open('map-assets-cache-v1').then((cache) => {
                cache.put(`/cached-asset/${clean}`, new Response(finalBlob));
              }).catch(() => {});
            }

            return finalBlob;
          }
        }
        lastErr = new Error(`Failed to download asset ${path} from ${url}: ${response.statusText}`);
      } catch (err) {
        lastErr = err;
      }
      retries--;
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
  }

  throw lastErr || new Error(`Failed to download asset ${path}`);
}

/**
 * Fetches a map asset as parsed JSON with retries and CDN fallback.
 */
export async function getMapAssetJson(path: string): Promise<any> {
  const clean = normalizePath(path);
  const primaryUrl = await getMapAssetUrl(path);
  const fallbackUrl = getMapAssetFallbackUrl(path);

  const urlsToTry: string[] = [];
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    urlsToTry.push(`/api/map-asset?path=${encodeURIComponent(clean)}`);
  }
  if (fallbackUrl && !urlsToTry.includes(fallbackUrl)) {
    urlsToTry.push(fallbackUrl);
  }
  if (!urlsToTry.includes(primaryUrl)) {
    urlsToTry.push(primaryUrl);
  }

  let lastErr: any = null;

  for (const url of urlsToTry) {
    let retries = 2;
    while (retries > 0) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const contentType = (response.headers.get('content-type') || '').toLowerCase();
          if (contentType.includes('text/html')) {
            throw new Error(`Received HTML instead of JSON from ${url}`);
          }
          const json = await response.json();
          if (json && (json.type || json.features || json.objects)) {
            return json;
          }
          throw new Error(`Invalid or empty JSON payload from ${url}`);
        }
        lastErr = new Error(`Failed to fetch JSON ${path} from ${url}: ${response.statusText}`);
      } catch (err) {
        lastErr = err;
      }
      retries--;
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
  }

  throw lastErr || new Error(`Failed to fetch JSON ${path}`);
}

export function hasMapAsset(path: string): boolean {
  return true;
}

export function getAvailableMaps(): string[] {
  return ['world.json', 'world_adm1.json', 'mappa_mundi_hoi4.json', 'world_ecoregions.json'];
}

export function getAvailableBackgrounds(): string[] {
  return ['NASA_8km.png', 'NASA_topo_bathy_8km.png', 'climate_1991_2020.png'];
}

