import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./public/', import.meta.url));
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.png':'image/png', '.svg':'image/svg+xml', '.jpg':'image/jpeg', '.wav':'audio/wav', '.mp3':'audio/mpeg', '.webm':'video/webm', '.mp4':'video/mp4', '.vtt':'text/vtt; charset=utf-8', '.pdf':'application/pdf', '.ico':'image/x-icon' };

export function createApp() {
  return createServer(async (req, res) => {
    const reply = (status, message) => { res.writeHead(status, {'Content-Type':'text/plain; charset=utf-8'}); res.end(req.method === 'HEAD' ? undefined : message); };
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow','GET, HEAD'); return reply(405, 'Método no permitido'); }
    let route;
    try { route = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { return reply(400, 'Ruta no válida'); }
    if (route === '/health') return reply(200, 'ok');
    if (route.includes('\0') || route.includes('\\') || route.split('/').some(p => p.startsWith('.'))) return reply(404, 'No encontrado');
    let file = resolve(root, '.' + route);
    if (file !== resolve(root) && !file.startsWith(resolve(root) + sep)) return reply(404, 'No encontrado');
    try {
      let info = await stat(file);
      if (info.isDirectory()) { file = resolve(file, 'index.html'); info = await stat(file); }
      if (!info.isFile()) return reply(404, 'No encontrado');
      const headers = { 'Content-Type':types[extname(file).toLowerCase()] || 'application/octet-stream', 'Accept-Ranges':'bytes', 'Cache-Control': /\.(html|js|css)$/.test(file) ? 'no-cache' : 'public, max-age=86400' };
      let start = 0, end = info.size - 1, status = 200;
      if (req.headers.range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        if (!match || (!match[1] && !match[2])) { res.setHeader('Content-Range',`bytes */${info.size}`); return reply(416, 'Rango no válido'); }
        start = match[1] ? Number(match[1]) : Math.max(0, info.size - Number(match[2]));
        end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end;
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= info.size) { res.setHeader('Content-Range',`bytes */${info.size}`); return reply(416, 'Rango no válido'); }
        status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
      }
      headers['Content-Length'] = Math.max(0, end - start + 1);
      res.writeHead(status, headers);
      if (req.method === 'HEAD' || !info.size) return res.end();
      const stream = createReadStream(file, {start, end});
      stream.on('error', () => res.destroy());
      res.on('close', () => stream.destroy());
      stream.pipe(res);
    } catch (error) { reply(['ENOENT','ENOTDIR'].includes(error.code) ? 404 : 500, 'No se pudo cargar el recurso'); }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createApp().listen(Number(process.env.PORT || 3000), '0.0.0.0', () => console.log('La última pieza: servidor listo'));
}
