/**
 * Request-executor request-headers e2e — the wire-confirmation gate for
 * the `headers` dimension of a draft Request.
 *
 * The auth × body matrix (`request-executor.spec.ts`) drives every
 * request with `headers: []`. This spec drives the header axis: the
 * enabled-row filter, repeated header names (which the browser's
 * `Headers` collapses to one comma-joined value), and the interaction
 * with the executor's body-driven default `Content-Type` — a user
 * header always wins, case-insensitively.
 *
 * Assertions read `echo.headers` from the playground decoder, which
 * surfaces the Node-side `req.headers` (lowercased names), so a green
 * run means the executor put each header on the actual wire. Positive
 * `{{var}}` resolution is proven in `request-scripts.spec.ts`; here we
 * assert only that the resolvability gate rejects an unresolved ref.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';
import { API_ECHO_URL } from '../../../../playground/scripts/api-client-matrix';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

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

interface EchoResponse {
  method: string;
  headers: Record<string, string | string[] | undefined>;
  body: { kind: string; contentType: string | null; parsed?: unknown; raw?: string };
}

interface ExecSnapshot {
  status: number;
  body: string;
  error?: string | null;
}

let nextUid = 0;
function header(key: string, value: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  nextUid += 1;
  return { uid: `hdr-${nextUid}`, key, value, ...extra };
}

function draft(
  headers: Array<Record<string, unknown>>,
  body: Record<string, unknown> = { type: 'none' },
  method = 'POST',
): Record<string, unknown> {
  nextUid += 1;
  return {
    schemaVersion: 5,
    uid: `req-headers-${nextUid}`,
    path: `requests/headers-e2e/req-${nextUid}`,
    name: 'headers e2e',
    method,
    url: API_ECHO_URL,
    headers,
    params: [],
    auth: { type: 'none' },
    body,
  };
}

async function send(d: Record<string, unknown>): Promise<EchoResponse> {
  const exec = await rpc<{ success: boolean; snapshot?: ExecSnapshot; error?: string }>('executeRequest', { draft: d });
  expect(exec.success, exec.error).toBe(true);
  const snapshot = exec.snapshot!;
  expect(snapshot.error ?? null).toBeNull();
  expect(snapshot.status).toBe(200);
  return JSON.parse(snapshot.body) as EchoResponse;
}

test.describe('Request executor — request headers on the wire', () => {
  test('only enabled, non-empty-key rows are sent', async () => {
    const echo = await send(
      draft([
        header('X-Enabled', 'yes', { enabled: true }),
        header('X-Disabled', 'no', { enabled: false }),
        header('X-Default-On', 'implicit'), // enabled omitted ⇒ enabled
        header('   ', 'blank-key'), // whitespace-only key ⇒ dropped
      ]),
    );
    expect(echo.headers['x-enabled']).toBe('yes');
    expect(echo.headers['x-default-on']).toBe('implicit');
    expect(echo.headers['x-disabled']).toBeUndefined();
  });

  test('header names are case-insensitive; the server sees them lowercased', async () => {
    const echo = await send(draft([header('X-MiXeD-CaSe', 'v1')]));
    // Node lowercases incoming header names — the row keeps the user's
    // casing on disk, but the wire + server view is the lowercase form.
    expect(echo.headers['x-mixed-case']).toBe('v1');
  });

  test('repeated header names collapse to one comma-joined value', async () => {
    const echo = await send(draft([header('X-Repeat', 'a'), header('X-Repeat', 'b'), header('X-Repeat', 'c')]));
    // The browser's Headers object joins same-name appends with ", "
    // before the request leaves the SW.
    expect(echo.headers['x-repeat']).toBe('a, b, c');
  });

  test('a user Content-Type overrides the body-driven default', async () => {
    // A json body would default to application/json; the user header wins.
    const echo = await send(
      draft([header('Content-Type', 'application/vnd.api+json')], { type: 'json', content: '{"ok":true}' }),
    );
    expect(echo.headers['content-type']).toBe('application/vnd.api+json');
    expect(echo.body.kind).toBe('json');
    expect(echo.body.parsed).toEqual({ ok: true });
  });

  test('the user Content-Type wins even with lowercase key and a mismatched type', async () => {
    // Lowercase `content-type` still suppresses the default (the executor
    // matches case-insensitively), and the user's type is honored verbatim
    // — here text/plain on json bytes, so the decoder reads it as text.
    const echo = await send(
      draft([header('content-type', 'text/plain')], { type: 'json', content: '{"shape":"json"}' }),
    );
    expect(echo.headers['content-type']).toBe('text/plain');
    expect(echo.body.kind).toBe('text');
    expect(echo.body.raw).toBe('{"shape":"json"}');
  });

  test('a json body with no user Content-Type gets the executor default', async () => {
    // Baseline for the override cases above: without a user header, the
    // executor injects application/json so the body is typed.
    const echo = await send(draft([], { type: 'json', content: '{"a":1}' }));
    expect(echo.headers['content-type']).toContain('application/json');
    expect(echo.body.kind).toBe('json');
  });

  test('an unresolved {{ref}} in a header value is rejected before the wire', async () => {
    const exec = await rpc<{ success: boolean; snapshot?: ExecSnapshot; error?: string }>('executeRequest', {
      draft: draft([header('X-Token', '{{undefined_header_var}}')]),
    });
    expect(exec.success).toBe(true);
    expect(exec.snapshot!.status).toBe(0);
    expect(exec.snapshot!.error ?? '').toMatch(/unresolved variables/i);
  });
});
