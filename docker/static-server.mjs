import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');
const indexFile = path.join(distDir, 'index.html');
const port = Number(process.env.PORT || 8080);

const routeAliases = new Map([
  ['/oauth-home', '/oauth-home.html'],
  ['/privacy', '/privacy.html'],
  ['/terms', '/terms.html'],
]);

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const isFile = async (targetPath) => {
  try {
    const details = await stat(targetPath);
    return details.isFile();
  } catch {
    return false;
  }
};

const toSafeFilePath = (requestPathname) => {
  const normalized = path.posix.normalize(requestPathname);
  const absolute = path.resolve(distDir, `.${normalized}`);
  const distPrefix = `${distDir}${path.sep}`;
  if (absolute !== distDir && !absolute.startsWith(distPrefix)) return '';
  return absolute;
};

const sendFile = async (req, res, filePath) => {
  let details;
  try {
    details = await stat(filePath);
    if (!details.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[extension] || 'application/octet-stream';
  const headers = {
    'Content-Length': String(details.size),
    'Content-Type': contentType,
  };

  if (extension === '.html') {
    headers['Cache-Control'] = 'no-store';
  }

  res.writeHead(200, headers);
  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  const stream = createReadStream(filePath);
  stream.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    res.end('Internal Server Error');
  });
  stream.pipe(res);
};

const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method Not Allowed');
    return;
  }

  let pathname = '/';
  try {
    const parsed = new URL(req.url || '/', 'http://localhost');
    pathname = decodeURIComponent(parsed.pathname || '/');
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }

  if (routeAliases.has(pathname)) {
    pathname = routeAliases.get(pathname);
  }

  if (pathname === '/') {
    pathname = '/index.html';
  } else if (pathname.endsWith('/')) {
    pathname = `${pathname}index.html`;
  }

  const candidate = toSafeFilePath(pathname);
  if (candidate && (await isFile(candidate))) {
    await sendFile(req, res, candidate);
    return;
  }

  const hasExtension = path.extname(pathname) !== '';
  if (!hasExtension) {
    await sendFile(req, res, indexFile);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Static server running on port ${port}`);
});
