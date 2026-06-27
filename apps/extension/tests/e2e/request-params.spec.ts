/**
 * Request-executor query-params e2e — the wire-confirmation gate for
 * the `params` dimension of a draft Request.
 *
 * The auth × body matrix (`request-executor.spec.ts`) drives every
 * request with `params: []`. This spec drives the OTHER axis: how the
 * executor folds a draft's structured `params` list onto the wire —
 * the enabled-row filter, repeated keys, empty values, encoding, and
 * the merge with a query string the user already typed into the URL.
 *
 * Like the matrix spec it asserts against the playground's `/api/echo`
 * decoder (`echo.query`), so a green run means the executor put each
 * param shape on the wire as a real URL query — not that a parser
 * round-tripped it. Positive `{{var}}` template resolution is proven in
 * `request-scripts.spec.ts` (which seeds a workspace variable first);
 * here we only assert the resolvability GATE rejects an unresolved ref.
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
  query: Record<string, string | string[]>;
  headers: Record<string, string | string[] | undefined>;
}

interface ExecSnapshot {
  status: number;
  body: string;
  error?: string | null;
}

interface ParamRow {
  key: string;
  value: string;
  enabled?: boolean;
  hasEquals?: boolean;
}

let nextUid = 0;
function param(key: string, value: string, extra: Partial<ParamRow> = {}): Record<string, unknown> {
  nextUid += 1;
  return { uid: `param-${nextUid}`, key, value, ...extra };
}

/** Build a GET draft against /api/echo with the given params + url. */
function draft(params: Array<Record<string, unknown>>, url: string = API_ECHO_URL): Record<string, unknown> {
  nextUid += 1;
  return {
    schemaVersion: 5,
    uid: `req-params-${nextUid}`,
    path: `requests/params-e2e/req-${nextUid}`,
    name: 'params e2e',
    method: 'GET',
    url,
    headers: [],
    params,
    auth: { type: 'none' },
    body: { type: 'none' },
  };
}

/** Run a draft through the executor; assert it reached the wire and decode. */
async function send(d: Record<string, unknown>): Promise<EchoResponse> {
  const exec = await rpc<{ success: boolean; snapshot?: ExecSnapshot; error?: string }>('executeRequest', { draft: d });
  expect(exec.success, exec.error).toBe(true);
  const snapshot = exec.snapshot!;
  expect(snapshot.error ?? null).toBeNull();
  expect(snapshot.status).toBe(200);
  return JSON.parse(snapshot.body) as EchoResponse;
}

test.describe('Request executor — query params on the wire', () => {
  test('only enabled, non-empty-key rows are sent', async () => {
    const echo = await send(
      draft([
        param('alpha', '1', { enabled: true }),
        param('beta', '2', { enabled: false }),
        param('gamma', '3'), // enabled omitted ⇒ treated as enabled
        param('   ', 'blank-key'), // whitespace-only key ⇒ dropped
      ]),
    );
    expect(echo.query).toEqual({ alpha: '1', gamma: '3' });
  });

  test('repeated keys ride the wire as an ordered array', async () => {
    const echo = await send(draft([param('tag', 'a'), param('tag', 'b'), param('tag', 'c')]));
    expect(echo.query.tag).toEqual(['a', 'b', 'c']);
  });

  test('empty value sends key= ; the hasEquals distinction is dropped at the wire', async () => {
    // Structured params always serialize as `key=value`. An empty value
    // becomes a bare `key=`, and the schema's `hasEquals` flag (which only
    // governs the renderer's URL round-trip) has no effect on the executor:
    // both forms produce the same wire bytes.
    const echo = await send(draft([param('flag', '', { hasEquals: false }), param('mark', '', { hasEquals: true })]));
    expect(echo.query.flag).toBe('');
    expect(echo.query.mark).toBe('');
  });

  test('keys and values are percent-encoded, then decoded back intact', async () => {
    const echo = await send(
      draft([
        param('q', 'a b&c=d'), // spaces + reserved chars must survive
        param('a key', 'plain'), // space in the key name
        param('emoji', 'café 🚀'),
      ]),
    );
    expect(echo.query.q).toBe('a b&c=d');
    expect(echo.query['a key']).toBe('plain');
    expect(echo.query.emoji).toBe('café 🚀');
  });

  test('structured params merge with a query string already in the URL', async () => {
    const echo = await send(draft([param('extra', 'no')], `${API_ECHO_URL}?fixed=yes`));
    expect(echo.query.fixed).toBe('yes');
    expect(echo.query.extra).toBe('no');
  });

  test('a URL-embedded key collides with a structured key as a repeated param', async () => {
    // `?dup=url` already in the URL + a structured `dup=param` both reach
    // the server, so the decoder sees a repeated key (URL value first).
    const echo = await send(draft([param('dup', 'param')], `${API_ECHO_URL}?dup=url`));
    expect(echo.query.dup).toEqual(['url', 'param']);
  });

  test('an unresolved {{ref}} in a param is rejected before the wire', async () => {
    const exec = await rpc<{ success: boolean; snapshot?: ExecSnapshot; error?: string }>('executeRequest', {
      draft: draft([param('p', '{{undefined_param_var}}')]),
    });
    // The resolvability gate turns the unresolved ref into a structured
    // error snapshot (status 0) rather than shipping a literal `{{…}}`.
    expect(exec.success).toBe(true);
    expect(exec.snapshot!.status).toBe(0);
    expect(exec.snapshot!.error ?? '').toMatch(/unresolved variables/i);
  });
});
