#!/usr/bin/env node
// Preview server that correctly handles Expo baseUrl (/App1) for Arena preview.
// Serves dist/ with rewrite: /App1/* -> dist/* and also handles SPA HTML extensions.
// Binds to 0.0.0.0 and allows any host/origin (required for e2b.app preview).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const port = parseInt(process.env.PORT || '8081', 10);
const baseUrl = '/App1';

function contentType(p) {
  if (p.endsWith('.html')) return 'text/html; charset=UTF-8';
  if (p.endsWith('.js')) return 'application/javascript; charset=UTF-8';
  if (p.endsWith('.css')) return 'text/css; charset=UTF-8';
  if (p.endsWith('.json')) return 'application/json';
  if (p.endsWith('.ico')) return 'image/x-icon';
  if (p.endsWith('.png')) return 'image/png';
  if (p.endsWith('.svg')) return 'image/svg+xml';
  if (p.endsWith('.ttf')) return 'font/ttf';
  if (p.endsWith('.woff2')) return 'font/woff2';
  if (p.endsWith('.woff')) return 'font/woff';
  return 'application/octet-stream';
}

const server = http.createServer((req, res) => {
  // CORS + iframe embedding allowed
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, expo-platform');
  // Allow embedding in iframe for Arena preview
  res.removeHeader('X-Frame-Options');
  res.setHeader('Content-Security-Policy', "frame-ancestors *");
  
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    let pathname = decodeURIComponent(url.pathname);

    // Strip baseUrl prefix if present (/App1/... -> /...), also handle /App1 without slash
    if (pathname === baseUrl) pathname = '/';
    else if (pathname.startsWith(baseUrl + '/')) pathname = pathname.slice(baseUrl.length);

    // Security: prevent directory traversal
    pathname = pathname.replace(/\0/g, '');

    // Normalize
    let filePath = path.join(dist, pathname);

    // If pathname ends with '/', serve index.html
    // If filePath is a directory, serve its index.html
    // Also handle extensions: /languages -> /languages.html
    // Use filesystem checks

    // Resolve file
    let resolved = null;
    let stat = null;
    try { stat = fs.statSync(filePath); } catch {}

    if (stat && stat.isDirectory()) {
      // directory -> index.html
      const index = path.join(filePath, 'index.html');
      if (fs.existsSync(index)) resolved = index;
    } else if (stat && stat.isFile()) {
      resolved = filePath;
    } else {
      // Try with .html extension
      const withHtml = filePath + '.html';
      if (fs.existsSync(withHtml)) resolved = withHtml;
      else {
        // Try index.html inside folder
        const indexInFolder = path.join(filePath, 'index.html');
        if (fs.existsSync(indexInFolder)) resolved = indexInFolder;
        else {
          // For SPA fallback, check if file exists without extension but with html in dist
          // e.g., /languages already handled, but /learn/... etc. are in subfolders?
          // Try to see if pathname corresponds to a html file directly
          // Also handle clean URLs without trailing slash: strip and see
          // Check if there's a file at dist + pathname + '/index.html' variations already done
          // Finally, try to serve 404 html or index.html as fallback for SPA?
          // Expo static export has specific html files, so if not found, return 404
        }
      }
    }

    if (!resolved) {
      // Try fallback to 404 page for unknown routes that are supposed to be SPA?
      // For expo-router static export, every route has html file, but dynamic like /learn/[language] maps to /learn/[language].html ? Actually dynamic routes generate _not-found?
      // Let's check if pathname without exact file should fallback to index.html or +not-found.html
      // We will send 404 with +not-found if available
      const notFound = path.join(dist, '+not-found.html');
      if (fs.existsSync(notFound)) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        fs.createReadStream(notFound).pipe(res);
        return;
      }
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }

    // Security check: resolved must be inside dist
    if (!resolved.startsWith(dist)) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }

    const stream = fs.createReadStream(resolved);
    res.statusCode = 200;
    res.setHeader('Content-Type', contentType(resolved));
    // Cache headers for assets
    if (resolved.includes('/_expo/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=0');
    }
    stream.on('error', () => {
      res.statusCode = 500;
      res.end('Internal Server Error');
    });
    stream.pipe(res);
  } catch (e) {
    res.statusCode = 500;
    res.end('Internal Server Error: ' + String(e));
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Preview server running at http://0.0.0.0:${port} serving ${dist} with baseUrl ${baseUrl} (also /)`);
});
