import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { Readable } from 'stream';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Add CORS headers
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // API route to proxy map asset downloads from GitHub repository or FlagCDN
  app.get(['/api/map-asset', '/api/drive-file'], async (req, res) => {
    const filePath = (req.query.path as string) || (req.query.id as string);
    if (!filePath) {
      res.status(400).json({ error: 'Missing file path or id' });
      return;
    }

    try {
      // Set no-cache to ensure browser fetches latest assets immediately upon update
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

      // Check local public/mapdata first for ultra-fast instantaneous serving
      const clean = filePath.replace(/^\//, '').replace(/^mapdata\//i, '');
      const localDiskPath = path.join(process.cwd(), 'public', 'mapdata', clean);
      if (fs.existsSync(localDiskPath)) {
        let contentType = 'application/octet-stream';
        if (clean.endsWith('.png')) contentType = 'image/png';
        else if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) contentType = 'image/jpeg';
        else if (clean.endsWith('.svg')) contentType = 'image/svg+xml';
        else if (clean.endsWith('.json') || clean.endsWith('.geojson')) contentType = 'application/json';
        else if (clean.endsWith('.wasm')) contentType = 'application/wasm';
        res.setHeader('Content-Type', contentType);
        fs.createReadStream(localDiskPath).pipe(res);
        return;
      }

      let targetUrl = '';
      let fallbackUrl = '';
      if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        targetUrl = filePath;
      } else if (filePath.toLowerCase().startsWith('flags/')) {
        const code = filePath.substring(6).replace(/\.svg$/i, '').toLowerCase();
        targetUrl = `https://flagcdn.com/${code}.svg`;
      } else {
        // Use jsdelivr as primary for speed, raw.githubusercontent as fallback
        targetUrl = `https://cdn.jsdelivr.net/gh/johnnull6967/MapPainterAssets@main/mapdata/${clean}`;
        fallbackUrl = `https://raw.githubusercontent.com/johnnull6967/MapPainterAssets/main/mapdata/${clean}`;
      }

      let response = await fetch(targetUrl);
      
      // If primary fails, try fallback
      if (!response.ok && fallbackUrl) {
        const fallbackRes = await fetch(fallbackUrl);
        if (fallbackRes.ok) {
          response = fallbackRes;
        }
      }

      if (!response.ok) {
        res.status(response.status).send(`Failed to fetch map asset from ${targetUrl}`);
        return;
      }

      let contentType = response.headers.get('content-type');
      // Fix generic octet-stream MIME types from GitHub raw for images & data
      if (!contentType || contentType === 'application/octet-stream') {
        if (clean.endsWith('.png')) contentType = 'image/png';
        else if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) contentType = 'image/jpeg';
        else if (clean.endsWith('.webp')) contentType = 'image/webp';
        else if (clean.endsWith('.svg')) contentType = 'image/svg+xml';
        else if (clean.endsWith('.json') || clean.endsWith('.geojson')) contentType = 'application/json';
        else if (clean.endsWith('.wasm')) contentType = 'application/wasm';
      }
      if (contentType) res.setHeader('Content-Type', contentType);
      
      const contentLength = response.headers.get('content-length');
      if (contentLength) res.setHeader('Content-Length', contentLength);

      if (response.body) {
        const nodeStream = Readable.fromWeb(response.body as any);
        nodeStream.pipe(res);
      } else {
        res.status(500).send('Empty body from asset source');
      }
    } catch (error: any) {
      console.error('Error proxying asset:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });

  // Serve static files from public directory (map data, wasm, images)
  app.use(express.static(path.join(process.cwd(), 'public')));

  // Ensure missing /mapdata/* files return 404 instead of falling through to Vite SPA index.html
  app.use('/mapdata', (req, res) => {
    res.status(404).json({ error: 'Map asset not found on local disk' });
  });

  // Serve map_painter.wasm
  app.get('/map_painter.wasm', (req, res) => {
    res.setHeader('Content-Type', 'application/wasm');
    const pubPath = path.join(process.cwd(), 'public', 'map_painter.wasm');
    const rootPath = path.join(process.cwd(), 'map_painter.wasm');
    if (fs.existsSync(pubPath)) {
      res.sendFile(pubPath);
    } else if (fs.existsSync(rootPath)) {
      res.sendFile(rootPath);
    } else {
      res.status(404).send('WASM file not found');
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
