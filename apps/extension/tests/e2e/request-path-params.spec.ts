/**
 * Request-executor path-params e2e — the wire-confirmation gate for the
 * `pathParams` dimension of a draft Request.
 *
 * `request-params.spec.ts` proves how the executor folds the query rows
 * onto the wire; this spec drives the path rows: a `:name` segment is
 * substituted with the row's resolved value as ONE percent-encoded
 * segment (a `/` in the value never splits the path), a literal suffix
 * on the segment survives, a name the URL repeats is substituted at
 * every position, the value is a template field like any other, and an
 * unfilled row sends the literal `:name` as written, named in the
 * snapshot's attribution — the posture an unresolved `{{ref}}` has.
 *
 * Asserts against the playground's `/api/echo` decoder, which reflects
 * the request's raw `path`, so a green run means the executor put each
 * segment on the wire as written here.
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
    { timeout: 5_000 },
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
  url: string;
  path: string;
}

interface ExecSnapshot {
  status: number;
  body: string;
  error?: string | null;
  scripts?: { preRequest?: { succeeded: boolean } | null } | null;
  sentAsWritten?: Array<{ reference: string; kind?: string; hint: string }>;
}

interface ExecResult {
  success: boolean;
  snapshot?: ExecSnapshot;
  error?: string;
}

let nextUid = 0;
function row(key: string, value: string): Record<string, unknown> {
  nextUid += 1;
  return { uid: `pp-${nextUid}`, key, value };
}

/** Build a GET draft whose URL extends /api/echo with `suffix` and carries the path rows. */
function draft(suffix: string, pathParams: Array<Record<string, unknown>>, extra: Record<string, unknown> = {}) {
  nextUid += 1;
  return {
    schemaVersion: 5,
    uid: `req-path-${nextUid}`,
    path: `requests/path-e2e/req-${nextUid}`,
    name: 'path params e2e',
    method: 'GET',
    url: `${API_ECHO_URL}${suffix}`,
    headers: [],
    params: [],
    pathParams,
    auth: { type: 'none' },
    body: { type: 'none' },
    ...extra,
  };
}

/** Run a draft through the executor; assert it reached the wire and decode. */
async function send(d: Record<string, unknown>): Promise<EchoResponse> {
  const exec = await rpc<ExecResult>('executeRequest', { draft: d });
  expect(exec.success, exec.error).toBe(true);
  const snapshot = exec.snapshot!;
  expect(snapshot.error ?? null).toBeNull();
  expect(snapshot.status).toBe(200);
  return JSON.parse(snapshot.body) as EchoResponse;
}

test.describe('Request executor — path parameters on the wire', () => {
  test('a filled row replaces its segment', async () => {
    const echo = await send(draft('/users/:id', [row('id', '42')]));
    expect(echo.path).toBe('/api/echo/users/42');
  });

  test('the value is a template field — a {{var}} resolves before substitution', async () => {
    // Seed a workspace variable through a script (the scripts spec's
    // idiom), then resolve it from a path row on a separate request. On
    // a fresh profile the host refuses the write until its sync service
    // is up, so poll until the script reports the set succeeded.
    await expect
      .poll(
        async () => {
          const seed = await rpc<ExecResult>('executeRequest', {
            draft: draft('', [], { preRequestScript: `await oh.variables.set('e2e_path_var', 'from-var');` }),
          });
          return seed.snapshot?.scripts?.preRequest?.succeeded === true;
        },
        { timeout: 20_000 },
      )
      .toBe(true);

    const echo = await send(draft('/users/:id', [row('id', '{{e2e_path_var}}')]));
    expect(echo.path).toBe('/api/echo/users/from-var');
  });

  test('a value holding a slash and a space stays ONE encoded segment', async () => {
    const echo = await send(draft('/users/:id', [row('id', 'a/b c')]));
    expect(echo.path).toBe('/api/echo/users/a%2Fb%20c');
  });

  test('a literal suffix on the segment is kept after the value', async () => {
    const echo = await send(draft('/users/:id.json', [row('id', '42')]));
    expect(echo.path).toBe('/api/echo/users/42.json');
  });

  test('a name the URL repeats is substituted at every position from one row', async () => {
    const echo = await send(draft('/users/:id/x/:id', [row('id', '7')]));
    expect(echo.path).toBe('/api/echo/users/7/x/7');
  });

  test('a blank value sends the literal :name as written and names it in the attribution', async () => {
    const exec = await rpc<ExecResult>('executeRequest', { draft: draft('/users/:id', [row('id', '  ')]) });
    expect(exec.success, exec.error).toBe(true);
    const snapshot = exec.snapshot!;
    expect(snapshot.error ?? null).toBeNull();
    expect(snapshot.status).toBe(200);
    expect((JSON.parse(snapshot.body) as EchoResponse).path).toBe('/api/echo/users/:id');
    expect(snapshot.sentAsWritten?.map((r) => [r.reference, r.kind])).toEqual([['id', 'path-param']]);
  });
});
