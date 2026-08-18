/**
 * Request-executor error-path e2e — the regression gate for what the
 * executor reports when a send does NOT come back as a clean 2xx.
 *
 * Three planes, all driven through the real SW executor (`executeRequest`
 * RPC with an unsaved draft, same rig as `request-executor.spec.ts`):
 *
 *   1. HTTP statuses — the playground's `/net/status/{code}` responder.
 *      A non-2xx is NOT an executor error: the snapshot carries the
 *      status verbatim with `error: null`.
 *   2. Redirect policy — follow (default) chases 3xx to the final
 *      target; `followRedirects: false` surfaces the hop as an
 *      opaqueredirect (status 0, no error); a redirect loop dies in the
 *      net stack with `net::ERR_TOO_MANY_REDIRECTS`.
 *   3. Net-stack failures — `fetch()` opaques these into "Failed to
 *      fetch", so these specs are the live proof of the wire-capture
 *      recovery: the snapshot's `error` must lead with the real
 *      Chromium net code (the same string the browser's own Network
 *      panel shows) plus the classifier's per-family guidance.
 *      Scenarios: DNS (`.invalid` TLD ⇒ guaranteed NXDOMAIN), refused
 *      port, socket destroyed pre-response (`/net/abort-headers`),
 *      HTTPS against the playground's plain-HTTP port, mid-body abort
 *      (`/net/abort-mid-body`), and a redirect loop.
 *
 * Pre-flight validation (empty / malformed URLs) and the CORS bypass
 * for permitted hosts ride along — both are executor-owned surfaces a
 * user hits on the same error panel.
 *
 * Certificate-family failures (ERR_CERT_AUTHORITY_INVALID + the
 * open-in-tab hint) are intentionally absent: the playground serves
 * plain HTTP only, and minting a self-signed HTTPS listener inside the
 * webServer is a rig change — the classifier's cert branch is covered
 * by unit tests (`request-executor-failure-classify.test.ts`).
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

const BASE = 'http://127.0.0.1:3000';

let context: BrowserContext;
let extensionId: string;
let rpcPage: Page;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    headless: false,
    slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO, 10) : undefined,
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`, '--no-sandbox'],
  });
  const sw = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  extensionId = sw.url().split('/')[2]!;

  rpcPage = await context.newPage();
  await rpcPage.goto(`chrome-extension://${extensionId}/popup.html`);
  await rpcPage.waitForFunction(
    () => {
      const root = document.getElementById('root');
      return root !== null && root.children.length > 0;
    },
    { timeout: 15000 },
  );

  // The wire-recovery plane (webRequest → extension-traffic channel)
  // comes up async after SW boot; until then net-stack failures
  // classify WITHOUT the recovered code — the documented degradation.
  // Warm it up so the recovered-code suite asserts the steady state.
  await expect
    .poll(async () => (await send('http://127.0.0.1:59117/echo')).error ?? '', { timeout: 30000 })
    .toContain('net::');
});

test.afterAll(async () => {
  await context.close();
});

async function rpc<T = unknown>(type: string, payload: Record<string, unknown> = {}): Promise<T> {
  return rpcPage.evaluate(
    ({ type: t, payload: p }: { type: string; payload: Record<string, unknown> }) =>
      new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: t, ...p }, (response) => {
          void chrome.runtime.lastError;
          resolve(response);
        });
      }),
    { type, payload },
  ) as Promise<T>;
}

interface ExecSnapshot {
  status: number;
  statusText: string;
  url: string;
  body: string;
  error: string | null;
  errorHint?: { kind: string; url: string };
}

let draftSeq = 0;

/** Minimal GET draft — the error planes are all reachable with no auth,
 *  no body, no headers; only the URL (and redirect policy) vary. */
function draft(url: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  draftSeq++;
  return {
    schemaVersion: 5,
    uid: `rqerr${String(draftSeq).padStart(3, '0')}`,
    path: `requests/net-errors-e2e/rqerr${String(draftSeq).padStart(3, '0')}`,
    name: `net-errors-e2e ${draftSeq}`,
    method: 'GET',
    url,
    headers: [],
    params: [],
    auth: { type: 'none' },
    body: { type: 'none' },
    ...overrides,
  };
}

async function send(url: string, overrides: Record<string, unknown> = {}): Promise<ExecSnapshot> {
  const exec = await rpc<{ success: boolean; snapshot?: ExecSnapshot; error?: string }>('executeRequest', {
    draft: draft(url, overrides),
  });
  expect(exec.success, exec.error).toBe(true);
  return exec.snapshot!;
}

test.describe('HTTP statuses are results, not errors', () => {
  // Every family the /net/status responder can mint (3xx excluded —
  // those Location-redirect to /echo and belong to the redirect plane).
  const STATUS_CODES = [200, 201, 204, 400, 401, 403, 404, 405, 409, 418, 429, 500, 502, 503];

  for (const code of STATUS_CODES) {
    test(`status ${code} lands in the snapshot verbatim`, async () => {
      const snapshot = await send(`${BASE}/net/status/${code}`);
      expect(snapshot.error).toBeNull();
      expect(snapshot.status).toBe(code);
      if (code !== 204) {
        expect(JSON.parse(snapshot.body)).toEqual({ status: code });
      } else {
        expect(snapshot.body).toBe('');
      }
    });
  }
});

test.describe('Redirect policy', () => {
  for (const code of [301, 302, 303, 307, 308]) {
    test(`follows a ${code} to the final target by default`, async () => {
      const snapshot = await send(`${BASE}/net/status/${code}`);
      expect(snapshot.error).toBeNull();
      expect(snapshot.status).toBe(200);
      expect(snapshot.url).toContain('/echo/redirected');
    });
  }

  test('follows a multi-hop chain to the end', async () => {
    const snapshot = await send(`${BASE}/net/redirect-chain/3`);
    expect(snapshot.error).toBeNull();
    expect(snapshot.status).toBe(200);
    expect(snapshot.url).toContain('/echo/chain-end');
  });

  test('followRedirects:false surfaces the hop without chasing it', async () => {
    // fetch redirect:'manual' resolves with an opaqueredirect — the
    // browser withholds status/headers, so the snapshot reads status 0
    // with NO error: "a redirect happened here" rendered honestly.
    const snapshot = await send(`${BASE}/net/status/302`, { followRedirects: false });
    expect(snapshot.error).toBeNull();
    expect(snapshot.status).toBe(0);
  });

  test('a redirect loop fails with the real net code', async () => {
    const snapshot = await send(`${BASE}/net/redirect-loop`);
    expect(snapshot.status).toBe(0);
    expect(snapshot.error).toContain('net::ERR_TOO_MANY_REDIRECTS');
  });
});

test.describe('Net-stack failures carry the recovered net code', () => {
  test('DNS failure — hostname does not resolve', async () => {
    // RFC 2606 reserves .invalid: guaranteed NXDOMAIN, no network luck.
    const snapshot = await send('https://does-not-exist.invalid/');
    expect(snapshot.status).toBe(0);
    expect(snapshot.error).toContain('net::ERR_NAME_NOT_RESOLVED');
    expect(snapshot.error).toContain('Could not resolve does-not-exist.invalid');
  });

  test('connection refused — nothing listening on the port', async () => {
    // 59117 is in the dynamic range and nothing in the rig binds it.
    const snapshot = await send('http://127.0.0.1:59117/echo');
    expect(snapshot.status).toBe(0);
    expect(snapshot.error).toContain('net::ERR_CONNECTION_REFUSED');
    expect(snapshot.error).toContain('refused the connection on port 59117');
  });

  test('socket destroyed before the response line', async () => {
    const snapshot = await send(`${BASE}/net/abort-headers`);
    expect(snapshot.status).toBe(0);
    expect(snapshot.error).toContain('net::ERR_EMPTY_RESPONSE');
    expect(snapshot.error).toContain('closed the connection without a response');
  });

  test('HTTPS against a plain-HTTP port suggests the http:// spelling', async () => {
    const snapshot = await send('https://127.0.0.1:3000/api/echo');
    expect(snapshot.status).toBe(0);
    expect(snapshot.error).toContain('net::ERR_SSL_PROTOCOL_ERROR');
    expect(snapshot.error).toContain('try http://127.0.0.1:3000');
  });

  test('socket destroyed mid-body delivers the partial read', async () => {
    // Headers arrive (200, Content-Length: 1000), then the server kills
    // the socket after 200 bytes. Current Chromium treats the close as
    // end of stream: fetch resolves 200 with the partial body instead of
    // failing the read (older Chromium raised a net error here).
    const snapshot = await send(`${BASE}/net/abort-mid-body`);
    expect(snapshot.status).toBe(200);
    expect(snapshot.error).toBeNull();
    expect(snapshot.bodyBytes).toBeGreaterThan(0);
    expect(snapshot.bodyBytes).toBeLessThan(1000);
  });
});

test.describe('Pre-flight validation and permitted-host CORS', () => {
  test('empty URL is rejected before any fetch', async () => {
    const snapshot = await send('');
    expect(snapshot.status).toBe(0);
    expect(snapshot.error).toBe('URL is empty');
  });

  test('malformed URL is rejected before any fetch', async () => {
    // A non-numeric port fails URL parsing outright — the executor's
    // pre-flight surfaces "Invalid URL: <reason>" instead of letting
    // fetch produce an opaque failure. (Softer malformations don't get
    // here: Chrome's parser normalizes `http:///x` to host `x` and
    // percent-encodes a space in the host, so those spellings go out on
    // the wire and land in the DNS plane above.)
    const snapshot = await send('http://127.0.0.1:not-a-port/');
    expect(snapshot.status).toBe(0);
    expect(snapshot.error).toContain('Invalid URL');
  });

  test('a response without CORS headers still succeeds (host permission)', async () => {
    // /net/no-cors omits Access-Control-Allow-Origin entirely; the SW
    // holds <all_urls> host access, so the executor is not subject to
    // CORS on permitted hosts and the body is fully readable.
    const snapshot = await send(`${BASE}/net/no-cors`);
    expect(snapshot.error).toBeNull();
    expect(snapshot.status).toBe(200);
    expect(JSON.parse(snapshot.body)).toEqual({ noCors: true });
  });
});
