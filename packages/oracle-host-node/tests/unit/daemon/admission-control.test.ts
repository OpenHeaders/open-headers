/**
 * Admission enforcement at the HTTP-composition seam (Phase 3) —
 * exercised against a real bound socket: matrix 403s with the
 * single-line `(peer=…)` log contract, brute-force counting off
 * response statuses (pairing 404 / mcp 401), the 429 + Retry-After
 * blocked path, WS-hook verdicts, and trusted-proxy peer resolution
 * from `X-Forwarded-For`.
 */

import { createServer, request as httpRequest, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { setHostLogger } from '@openheaders/core/logger';
import { MCP_HTTP_PATH } from '@openheaders/core/protocol';
import { logger as consoleLogger } from '@openheaders/core/utils';
import { afterEach, describe, expect, it } from 'vitest';
import { type AdmissionControl, createAdmissionControl } from '../../../src/daemon/admission-control';

setHostLogger(consoleLogger);

interface Harness {
  baseUrl: string;
  server: Server;
}

const servers: Server[] = [];

/**
 * Compose the admission wrapper over a stub chain: `/pair/*` answers
 * 404 (an unknown-code guess), `/mcp` and `/metrics` answer 401 (a bad
 * bearer), `/healthz` 200 — the status shapes the real handlers produce
 * on the routes the limiter watches.
 */
async function startHarness(admission: AdmissionControl): Promise<Harness> {
  const wrapped = admission.wrapHttpHandler((req, res) => {
    const path = (req.url ?? '').split('?', 1)[0];
    if (path === '/healthz') {
      res.statusCode = 200;
      res.end('{"ok":true}');
      return true;
    }
    if (path === '/metrics') {
      res.statusCode = 401;
      res.end('bad token');
      return true;
    }
    if (path.startsWith('/pair/')) {
      res.statusCode = 404;
      res.end('unknown code');
      return true;
    }
    if (path === MCP_HTTP_PATH) {
      res.statusCode = 401;
      res.end('bad token');
      return true;
    }
    return false;
  });
  const server = createServer((req, res) => {
    if (wrapped(req, res)) return;
    res.statusCode = 400;
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  const { port } = server.address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${port}`, server };
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve()))));
});

describe('wrapHttpHandler', () => {
  it('rejects a cross-origin pairing request with 403 and lets same-origin through', async () => {
    const { baseUrl } = await startHarness(createAdmissionControl());
    const cross = await fetch(`${baseUrl}/pair/123456`, { headers: { origin: 'https://evil.example.com' } });
    expect(cross.status).toBe(403);
    const plain = await fetch(`${baseUrl}/pair/123456`);
    expect(plain.status).toBe(404); // reached the stub chain
  });

  it('rejects any Origin on /mcp', async () => {
    const { baseUrl } = await startHarness(createAdmissionControl());
    const response = await fetch(`${baseUrl}${MCP_HTTP_PATH}`, {
      headers: { origin: 'http://127.0.0.1:8137' },
    });
    expect(response.status).toBe(403);
  });

  it('rejects an undeclared Host on pairing and accepts a declared one', async () => {
    // fetch (undici) refuses to override Host, so drive node:http directly.
    const { baseUrl } = await startHarness(createAdmissionControl({ allowedHosts: ['oh.openheaders.io'] }));
    function statusWithHost(host: string): Promise<number> {
      return new Promise((resolve, reject) => {
        const req = httpRequest(`${baseUrl}/pair/123456`, { headers: { host } }, (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        });
        req.on('error', reject);
        req.end();
      });
    }
    expect(await statusWithHost('rebound.example.com')).toBe(403);
    expect(await statusWithHost('oh.openheaders.io')).toBe(404);
  });

  it('throttles a peer after repeated pairing-code guesses with 429 + Retry-After', async () => {
    const admission = createAdmissionControl({ limiter: { maxFailures: 3, windowMs: 60_000, blockMs: 120_000 } });
    const { baseUrl } = await startHarness(admission);
    for (let i = 0; i < 3; i++) {
      const guess = await fetch(`${baseUrl}/pair/${100000 + i}`);
      expect(guess.status).toBe(404);
    }
    const blocked = await fetch(`${baseUrl}/pair/999999`);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
    // A blocked peer is also refused on the other rate-limited planes…
    const mcp = await fetch(`${baseUrl}${MCP_HTTP_PATH}`);
    expect(mcp.status).toBe(429);
    // …but never on /healthz.
    const healthz = await fetch(`${baseUrl}/healthz`);
    expect(healthz.status).toBe(200);
  });

  it('counts /mcp 401s toward the same budget', async () => {
    const admission = createAdmissionControl({ limiter: { maxFailures: 2, windowMs: 60_000, blockMs: 120_000 } });
    const { baseUrl } = await startHarness(admission);
    expect((await fetch(`${baseUrl}${MCP_HTTP_PATH}`)).status).toBe(401);
    expect((await fetch(`${baseUrl}${MCP_HTTP_PATH}`)).status).toBe(401);
    expect((await fetch(`${baseUrl}${MCP_HTTP_PATH}`)).status).toBe(429);
  });

  it('counts /metrics 401s toward the same budget as /mcp (finish-hook feed)', async () => {
    const admission = createAdmissionControl({ limiter: { maxFailures: 2, windowMs: 60_000, blockMs: 120_000 } });
    const { baseUrl } = await startHarness(admission);
    // One bad bearer on each surface — the `on('finish')` hook must feed
    // the limiter from BOTH routes into one per-peer budget, so the
    // third attempt is refused before reaching either handler.
    expect((await fetch(`${baseUrl}/metrics`)).status).toBe(401);
    expect((await fetch(`${baseUrl}${MCP_HTTP_PATH}`)).status).toBe(401);
    expect((await fetch(`${baseUrl}/metrics`)).status).toBe(429);
    expect((await fetch(`${baseUrl}${MCP_HTTP_PATH}`)).status).toBe(429);
  });
});

describe('live webEnabled getter', () => {
  it('consults the getter per request — desktop toggles posture without a re-boot', async () => {
    let webEnabled = false;
    const { baseUrl } = await startHarness(createAdmissionControl({ webEnabled: () => webEnabled }));
    const ownOrigin = `http://${new URL(baseUrl).host}`;
    // Off: an unclaimed path keeps the `default` posture — a browser
    // Origin (even the own served one) is rejected, exactly the
    // web-less daemon/desktop baseline.
    const off = await fetch(`${baseUrl}/`, { headers: { origin: ownOrigin } });
    expect(off.status).toBe(403);
    // On (no new admission control): the same request takes the `web`
    // posture and reaches the handler chain (400 = the harness fallback).
    webEnabled = true;
    const on = await fetch(`${baseUrl}/`, { headers: { origin: ownOrigin } });
    expect(on.status).toBe(400);
    // …and back off.
    webEnabled = false;
    const offAgain = await fetch(`${baseUrl}/`, { headers: { origin: ownOrigin } });
    expect(offAgain.status).toBe(403);
  });
});

describe('wsHooks', () => {
  /**
   * Probe server OUTSIDE the HTTP wrapper — each request's live
   * `IncomingMessage` is handed to the hook under test and the verdict
   * (or a recordAuthFailure acknowledgment) is echoed back, so the
   * hooks see real sockets and real headers.
   */
  async function startWsProbe(admission: AdmissionControl): Promise<string> {
    const server = createServer((req, res) => {
      if ((req.url ?? '') === '/auth-failure') {
        admission.wsHooks.recordAuthFailure(req);
        res.statusCode = 200;
        res.end('{"recorded":true}');
        return;
      }
      res.statusCode = 200;
      res.end(JSON.stringify(admission.wsHooks.admitUpgrade(req)));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    servers.push(server);
    const { port } = server.address() as AddressInfo;
    return `http://127.0.0.1:${port}`;
  }

  it('admits extension origins and refuses page origins on the upgrade', async () => {
    const probeUrl = await startWsProbe(createAdmissionControl());
    const ext = await fetch(`${probeUrl}/verdict`, { headers: { origin: 'chrome-extension://abcdefgh' } });
    expect(await ext.json()).toEqual({ ok: true });
    const page = await fetch(`${probeUrl}/verdict`, { headers: { origin: 'https://evil.example.com' } });
    expect(await page.json()).toEqual({ ok: false, reason: 'origin-forbidden' });
  });

  it('refuses the upgrade for a peer blocked by HELLO auth failures', async () => {
    const admission = createAdmissionControl({ limiter: { maxFailures: 2, windowMs: 60_000, blockMs: 120_000 } });
    const probeUrl = await startWsProbe(admission);
    await fetch(`${probeUrl}/auth-failure`);
    await fetch(`${probeUrl}/auth-failure`);
    const verdict = await fetch(`${probeUrl}/verdict`);
    expect(await verdict.json()).toEqual({ ok: false, reason: 'rate-limited' });
  });
});

describe('trusted-proxy peer resolution', () => {
  it('ignores X-Forwarded-For by default', async () => {
    const admission = createAdmissionControl({ limiter: { maxFailures: 2, windowMs: 60_000, blockMs: 120_000 } });
    const { baseUrl } = await startHarness(admission);
    // Both "clients" spoof different XFF values; without trustedProxy the
    // socket address is the key, so the budget is shared and the third
    // request is blocked regardless of the header.
    await fetch(`${baseUrl}/pair/111111`, { headers: { 'x-forwarded-for': '203.0.113.1' } });
    await fetch(`${baseUrl}/pair/222222`, { headers: { 'x-forwarded-for': '203.0.113.2' } });
    const blocked = await fetch(`${baseUrl}/pair/333333`, { headers: { 'x-forwarded-for': '203.0.113.3' } });
    expect(blocked.status).toBe(429);
  });

  it('keys peers by the last X-Forwarded-For entry behind a trusted proxy', async () => {
    const admission = createAdmissionControl({
      trustedProxy: true,
      limiter: { maxFailures: 2, windowMs: 60_000, blockMs: 120_000 },
    });
    const { baseUrl } = await startHarness(admission);
    await fetch(`${baseUrl}/pair/111111`, { headers: { 'x-forwarded-for': '203.0.113.1' } });
    await fetch(`${baseUrl}/pair/222222`, { headers: { 'x-forwarded-for': '203.0.113.1' } });
    // Same client (per the proxy) → blocked; a different client is not.
    const blocked = await fetch(`${baseUrl}/pair/333333`, { headers: { 'x-forwarded-for': '203.0.113.1' } });
    expect(blocked.status).toBe(429);
    const other = await fetch(`${baseUrl}/pair/444444`, { headers: { 'x-forwarded-for': '203.0.113.9' } });
    expect(other.status).toBe(404);
    // The client-supplied prefix is forgeable; only the last (proxy-appended) entry counts.
    const spoofPrefix = await fetch(`${baseUrl}/pair/555555`, {
      headers: { 'x-forwarded-for': '198.51.100.7, 203.0.113.1' },
    });
    expect(spoofPrefix.status).toBe(429);
  });
});
