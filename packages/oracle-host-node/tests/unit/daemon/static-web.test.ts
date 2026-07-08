/**
 * Static web serving (Phase 4a) — exercised against a real bound socket
 * over a staged mini-bundle: index at `/`, SPA fallback on
 * extension-less paths, immutable caching under `/assets/`, asset-miss
 * 404s (never HTML under a `.js` URL), traversal/dotfile refusal, and
 * the GET/HEAD method gate.
 */

import * as fs from 'node:fs';
import { createServer, request as httpRequest, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createStaticWebHandler } from '../../../src/daemon/static-web';

let rootDir: string;
let baseUrl: string;
let server: Server;

beforeAll(async () => {
  rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-static-web-'));
  fs.writeFileSync(path.join(rootDir, 'index.html'), '<!doctype html><title>Open Headers</title>');
  fs.writeFileSync(path.join(rootDir, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  fs.mkdirSync(path.join(rootDir, 'assets'));
  fs.writeFileSync(path.join(rootDir, 'assets', 'index-abc123.js'), 'console.log("openheaders.io");');
  fs.writeFileSync(path.join(rootDir, '.secret'), 'never served');
  const handler = createStaticWebHandler({ rootDir });
  server = createServer((req, res) => {
    if (handler(req, res)) return;
    res.statusCode = 400;
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  fs.rmSync(rootDir, { recursive: true, force: true });
});

describe('createStaticWebHandler', () => {
  it('serves index.html at / with revalidation caching', async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(res.headers.get('cache-control')).toBe('no-cache');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await res.text()).toContain('Open Headers');
  });

  it('falls back to index.html on extension-less client routes', async () => {
    const res = await fetch(`${baseUrl}/workbench/rules`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(await res.text()).toContain('Open Headers');
  });

  it('serves hashed assets immutable with the right MIME', async () => {
    const res = await fetch(`${baseUrl}/assets/index-abc123.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(await res.text()).toContain('openheaders.io');
  });

  it('serves root-level assets with revalidation caching', async () => {
    const res = await fetch(`${baseUrl}/favicon.svg`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/svg+xml');
    expect(res.headers.get('cache-control')).toBe('no-cache');
  });

  it('404s an asset miss instead of falling back to HTML', async () => {
    const res = await fetch(`${baseUrl}/assets/index-stalehash.js`);
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8');
  });

  it('refuses traversal and dotfile paths without touching the filesystem', async () => {
    // fetch normalizes dot segments client-side, so drive node:http with
    // the raw paths — the server must reject them itself.
    function statusForRawPath(rawPath: string): Promise<number> {
      // Options form: a URL-string request would re-normalize the path.
      const { hostname, port } = new URL(baseUrl);
      return new Promise((resolve, reject) => {
        const req = httpRequest({ hostname, port, path: rawPath }, (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        });
        req.on('error', reject);
        req.end();
      });
    }
    expect(await statusForRawPath('/assets/%2e%2e/index.html')).toBe(404);
    expect(await statusForRawPath('/..%2f..%2fetc%2fpasswd')).toBe(404);
    expect(await statusForRawPath('/.secret')).toBe(404);
    expect(await statusForRawPath('/%00.js')).toBe(404);
  });

  it('answers HEAD with headers only and refuses other methods', async () => {
    const head = await fetch(`${baseUrl}/assets/index-abc123.js`, { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(Number(head.headers.get('content-length'))).toBeGreaterThan(0);
    expect(await head.text()).toBe('');
    const post = await fetch(`${baseUrl}/`, { method: 'POST' });
    expect(post.status).toBe(405);
    expect(post.headers.get('allow')).toBe('GET, HEAD');
  });
});
