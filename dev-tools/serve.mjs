import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PublicContentService } from './public-content-service.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const demo = process.argv.includes('--demo');
const port = Number(process.env.PORT || 4180);
const labels = { authors: [{ publicId: 'author_sample', displayName: 'Sample Writer' }, { publicId: 'author_guest', displayName: 'Guest Writer' }], tags: [{ id: 'craft', label: 'Writing craft' }, { id: 'fiction', label: 'Fiction' }, { id: 'community', label: 'Community' }] };
const titles = ['Finding time to write', 'The last light on the river', 'A place to begin', 'Listening to your characters', 'The notebook by the door', 'Resources for a writing life'];
const rows = Array.from({ length: 27 }, (_, index) => ({ id: 'sample-' + (index + 1), type: ['ARTICLE', 'STORY', 'LINK'][index % 3], title: titles[index % titles.length] + (index >= 6 ? ' · ' + (index + 1) : ''), shortDescription: 'Fictional sample content for testing the KCW collection. Explore a new idea, a quiet story, or a useful resource.', author: labels.authors[index % 2], tags: [labels.tags[index % 3].id, 'community'].filter((v,i,a) => a.indexOf(v) === i), publishedAt: new Date(Date.UTC(2026,8,26 - index,14)).toISOString(), updatedAt: '2026-09-26T14:00:00.000Z', sensitive: index === 4, externalUrl: 'https://example.com/', heroImage: '', heroImageAltText: '' }));
const markdown = '# A small beginning\nMake room for **writing** each day. A sentence can open a door.\n\n> Every story begins with noticing.\n\n- Choose a quiet moment.\n- Listen to the world around you.\n\n---\n\n```verse\n  Along the river\n    the light lingers.\n```\n\nThis is fictional demonstration content.';
const service = new PublicContentService({ labels: () => labels, listPublic: () => rows, getPublic: id => { const metadata = rows.find(row => row.id === id); return metadata ? { metadata, body: { bodyMarkdown: markdown } } : null; } });
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json' };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('Cache-Control', 'no-store');
    if (demo && url.pathname === '/data/content.js') {
      res.setHeader('Content-Type', 'text/javascript');
      res.end('export default ' + JSON.stringify({ enabled: true, publicApiUrl: `http://127.0.0.1:${port}/api/content`, timezone: 'America/Toronto', pageSize: 12, refreshMs: 30000, timeoutMs: 15000 }) + ';'); return;
    }
    if (demo && url.pathname === '/api/content') {
      const params = {}; for (const key of url.searchParams.keys()) params[key] = url.searchParams.getAll(key);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(url.searchParams.get('action') === 'public.get' ? service.get(url.searchParams.get('id')) : service.list(params))); return;
    }
    const requested = decodeURIComponent(url.pathname === '/' ? '/browse.html' : url.pathname);
    const target = path.resolve(root, '.' + requested);
    if (!target.startsWith(root) || requested.split('/').some(segment => segment.startsWith('.')) || requested.startsWith('/dev-tools/')) { res.writeHead(404); res.end('Not found'); return; }
    let body = await fs.readFile(target);
    if (demo && path.extname(target) === '.html') body = body.toString().replace('<body>', '<body><div style="padding:.6rem;text-align:center;background:#fff0bd;color:#273c30;font:16px Georgia">Local demo — fictional sample content</div>');
    res.setHeader('Content-Type', (mime[path.extname(target)] || 'application/octet-stream') + '; charset=utf-8'); res.end(body);
  } catch (error) { res.writeHead(error.code === 'ENOENT' ? 404 : 400); res.end('Unable to serve this request.'); }
});
server.listen(port, '127.0.0.1', () => console.log(`KCW ${demo ? 'fictional demo' : 'local preview'}: http://127.0.0.1:${port}/browse.html`));
