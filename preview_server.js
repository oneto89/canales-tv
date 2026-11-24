const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8' };

http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, 'http://127.0.0.1:8765');
  if (requestUrl.pathname === '/tv-preview') requestUrl.pathname = '/';
  if (requestUrl.pathname === '/_mi_tv_guide') {
    const offset = Number(requestUrl.searchParams.get('offset') || 0);
    if (!Number.isFinite(offset) || Math.abs(offset) > 840) {
      res.writeHead(400, { 'Access-Control-Allow-Origin': '*' }).end('Invalid timezone offset');
      return;
    }
    try {
      const upstream = await fetch('https://mi.tv/cl/async/guide/all/' + offset, {
        headers: { 'User-Agent': 'CanalesTV-Preview/1.0', 'X-Requested-With': 'XMLHttpRequest', 'Referer': 'https://mi.tv/cl/programacion' },
        signal: AbortSignal.timeout(20000)
      });
      const payload = Buffer.from(await upstream.arrayBuffer());
      res.writeHead(upstream.status, { 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(payload);
    } catch (error) {
      res.writeHead(502, { 'Access-Control-Allow-Origin': '*' }).end(String(error));
    }
    return;
  }
  if (requestUrl.pathname === '/_proxy') {
    const target = requestUrl.searchParams.get('url');
    if (!target || !['http:', 'https:'].includes(new URL(target).protocol)) {
      res.writeHead(400).end('Invalid URL');
      return;
    }
    try {
      const upstream = await fetch(target, { headers: { 'User-Agent': 'CanalesTV-Preview/1.0' }, signal: AbortSignal.timeout(20000) });
      const payload = Buffer.from(await upstream.arrayBuffer());
      if (payload.length > 8 * 1024 * 1024) {
        res.writeHead(413).end('Playlist too large');
        return;
      }
      res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'application/vnd.apple.mpegurl; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(payload);
    } catch (error) {
      res.writeHead(502, { 'Access-Control-Allow-Origin': '*' }).end(String(error));
    }
    return;
  }
  const targetPath = requestUrl.pathname === '/' ? path.join(root, 'index.html') : path.resolve(root, '.' + decodeURIComponent(requestUrl.pathname));
  if (!targetPath.startsWith(root + path.sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  const file = targetPath;
  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(404).end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(8765, '127.0.0.1', () => console.log('Canales TV preview: http://127.0.0.1:8765/'));
