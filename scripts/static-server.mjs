import http from 'node:http';
import {readFile, realpath, stat} from 'node:fs/promises';
import path from 'node:path';

// This project deliberately supports one Pages rule, covering every URL.
export function parseGlobalHeaders(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim() && !line.trim().startsWith('#'));
  if (lines.shift() !== '/*') throw new Error('Expected one global Pages headers rule');
  const headers = {};
  for (const line of lines) {
    const match = line.match(/^\s+([\w-]+):\s*(\S.*)$/);
    if (!match || Object.hasOwn(headers, match[1].toLowerCase())) throw new Error('Invalid or duplicate Pages header');
    headers[match[1].toLowerCase()] = match[2];
  }
  return headers;
}

export async function createStaticServer(directory, {githubPages = false, basePath = '/'} = {}) {
  const root = await realpath(directory);
  const headers = githubPages ? {} : parseGlobalHeaders(await readFile(path.join(root, '_headers'), 'utf8'));
  const notFound = await readFile(path.join(root, '404.html'));
  const types = {'.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.glb':'model/gltf-binary', '.webp':'image/webp', '.txt':'text/plain; charset=utf-8'};
  const inside = file => file === root || file.startsWith(root + path.sep);
  return http.createServer(async (req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, {...headers, Allow:'GET, HEAD'}); res.end(); return;
    }
    try {
      const requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (!requested.startsWith(basePath)) throw new Error('Outside site base path');
      const pathname = '/' + requested.slice(basePath.length);
      if (pathname === '/_headers') throw new Error('Configuration is not a public asset');
      let file = path.resolve(root, '.' + pathname);
      if (!inside(file)) throw new Error('Outside public directory');
      if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
      file = await realpath(file);
      if (!inside(file) || file === path.join(root, '_headers')) throw new Error('Not a public asset');
      const body = await readFile(file);
      res.writeHead(200, {...headers, 'Content-Type':types[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-cache'});
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      res.writeHead(404, {...headers, 'Content-Type':'text/html; charset=utf-8'});
      res.end(req.method === 'HEAD' ? undefined : notFound);
    }
  });
}
