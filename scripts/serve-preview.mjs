#!/usr/bin/env node
// Preview server that correctly handles Expo baseUrl (/App1) for Arena preview.
// Serves dist/ with rewrite: /App1/* -> dist/* and also handles SPA HTML extensions.
// Binds to 0.0.0.0 and allows any host/origin (required for e2b.app preview).
// Injects mobile frame (390x844) for desktop preview as requested.

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

// Mobile frame CSS injected into every HTML for desktop preview
// - On desktop (>=520px) shows 390x844 phone frame centered with notch & shadow
// - On real mobile (<520px) full-screen without frame
// Includes toggle button to switch frame on/off
const MOBILE_FRAME_INJECTION = `
<style id="arena-mobile-frame">
  /* --- Mobile resolution emulation for Arena web preview --- */
  @media (min-width: 520px) {
    html:not(.arena-frame-disabled), body:not(.arena-frame-disabled) {
      background: #0f172a !important;
      background-color: #0f172a !important;
      display: flex !important;
      justify-content: center !important;
      align-items: flex-start !important;
      min-height: 100vh !important;
      margin: 0 !important;
      padding: 18px 0 60px 0 !important;
      overflow-y: auto !important;
    }
    html:not(.arena-frame-disabled) #root,
    body:not(.arena-frame-disabled) #root {
      width: 390px !important;
      height: 844px !important;
      max-width: 390px !important;
      max-height: 844px !important;
      min-height: 844px !important;
      flex: none !important;
      border-radius: 32px !important;
      overflow: hidden !important;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6), 0 0 0 8px #1e293b, 0 0 0 9px #334155 !important;
      position: relative !important;
      background: #f6f8fb !important;
    }
    /* Notch / Dynamic Island */
    html:not(.arena-frame-disabled) #root::before {
      content: '';
      position: absolute;
      top: 8px;
      left: 50%;
      transform: translateX(-50%);
      width: 92px;
      height: 26px;
      background: #0f172a;
      border-radius: 9999px;
      z-index: 9999;
      pointer-events: none;
    }
    /* Badge */
    html:not(.arena-frame-disabled) body::after {
      content: '📱 390 × 844 — نمایش موبایل';
      position: fixed;
      bottom: 14px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(15,23,42,0.92);
      color: #e2e8f0;
      font-family: Vazirmatn, system-ui, sans-serif;
      font-size: 12px;
      padding: 6px 14px;
      border-radius: 9999px;
      z-index: 10000;
      pointer-events: none;
      border: 1px solid rgba(255,255,255,0.14);
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      direction: rtl;
    }
  }
  @media (max-width: 519px) {
    html, body {
      background: #f6f8fb !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    #root {
      width: 100% !important;
      height: 100% !important;
      min-height: 100vh !important;
      border-radius: 0 !important;
      box-shadow: none !important;
    }
  }
  /* Toggle button - always visible on desktop */
  @media (min-width: 520px) {
    #arena-frame-toggle {
      position: fixed;
      top: 12px;
      left: 12px;
      z-index: 10001;
      background: rgba(255,255,255,0.96);
      color: #0f172a;
      border: 1px solid #e2e8f0;
      border-radius: 9999px;
      padding: 7px 14px;
      font-family: Vazirmatn, system-ui, sans-serif;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(0,0,0,0.18);
      direction: rtl;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }
    #arena-frame-toggle:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(0,0,0,0.22);
    }
  }
  @media (max-width: 519px) {
    #arena-frame-toggle { display: none !important; }
  }
  /* When frame disabled, reset to full width even on desktop */
  html.arena-frame-disabled, html.arena-frame-disabled body {
    background: #f6f8fb !important;
    display: block !important;
    padding: 0 !important;
  }
  html.arena-frame-disabled #root {
    width: 100% !important;
    max-width: 100% !important;
    height: 100% !important;
    min-height: 100vh !important;
    max-height: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
  }
  html.arena-frame-disabled #root::before { display: none !important; }
  html.arena-frame-disabled body::after { display: none !important; }
</style>
<script id="arena-mobile-viewport-hint">
  try {
    var m = document.querySelector('meta[name="viewport"]');
    if (!m) {
      m = document.createElement('meta');
      m.name = 'viewport';
      document.head.appendChild(m);
    }
    m.content = 'width=device-width, initial-scale=1, viewport-fit=cover';
  } catch(e) {}
  // Frame toggle logic
  (function() {
    try {
      var KEY = 'arena-mobile-frame-disabled';
      var isDisabled = localStorage.getItem(KEY) === '1';
      if (isDisabled) document.documentElement.classList.add('arena-frame-disabled');
      document.addEventListener('DOMContentLoaded', function() {
        var btn = document.createElement('button');
        btn.id = 'arena-frame-toggle';
        function updateLabel() {
          var disabled = document.documentElement.classList.contains('arena-frame-disabled');
          btn.textContent = disabled ? '📱 حالت موبایل' : '🖥️ حالت دسکتاپ (تمام عرض)';
        }
        btn.addEventListener('click', function() {
          var html = document.documentElement;
          html.classList.toggle('arena-frame-disabled');
          var nowDisabled = html.classList.contains('arena-frame-disabled');
          localStorage.setItem(KEY, nowDisabled ? '1' : '0');
          updateLabel();
        });
        updateLabel();
        document.body.appendChild(btn);
      });
    } catch(e) {}
  })();
</script>
`;

function injectMobileFrame(html) {
  if (html.includes('id="arena-mobile-frame"')) return html;
  if (html.includes('</head>')) {
    return html.replace('</head>', MOBILE_FRAME_INJECTION + '</head>');
  }
  return html;
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

    // Resolve file
    let resolved = null;
    let stat = null;
    try { stat = fs.statSync(filePath); } catch {}

    if (stat && stat.isDirectory()) {
      const index = path.join(filePath, 'index.html');
      if (fs.existsSync(index)) resolved = index;
    } else if (stat && stat.isFile()) {
      resolved = filePath;
    } else {
      const withHtml = filePath + '.html';
      if (fs.existsSync(withHtml)) resolved = withHtml;
      else {
        const indexInFolder = path.join(filePath, 'index.html');
        if (fs.existsSync(indexInFolder)) resolved = indexInFolder;
      }
    }

    if (!resolved) {
      const notFound = path.join(dist, '+not-found.html');
      if (fs.existsSync(notFound)) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        let html = fs.readFileSync(notFound, 'utf8');
        html = injectMobileFrame(html);
        res.end(html);
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

    const isHtml = resolved.endsWith('.html');

    if (isHtml) {
      // Read and inject mobile frame
      let html = fs.readFileSync(resolved, 'utf8');
      html = injectMobileFrame(html);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=UTF-8');
      res.setHeader('Cache-Control', 'public, max-age=0');
      res.end(html);
      return;
    }

    // Non-HTML static asset
    const stream = fs.createReadStream(resolved);
    res.statusCode = 200;
    res.setHeader('Content-Type', contentType(resolved));
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
  console.log(`Preview server running at http://0.0.0.0:${port} serving ${dist} with baseUrl ${baseUrl} (also /) + mobile frame 390x844`);
});
