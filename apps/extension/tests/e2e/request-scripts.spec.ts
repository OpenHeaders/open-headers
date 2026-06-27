/**
 * Request-executor scripts e2e — the integration gate for pre-request
 * and post-response scripts.
 *
 * Unlike params / headers / body (pure wire serialization that unit
 * tests already cover), scripts run in a REAL offscreen-document
 * sandbox: the SW spawns `offscreen.html`, brokers `postMessage` to the
 * sandboxed `sandbox.html` iframe, compiles the user source with
 * `new Function`, and reflects every `oh.*` call back across the bridge.
 * None of that is faithfully unit-testable — this spec drives the whole
 * chain through the `executeRequest` RPC and asserts both:
 *   - what the script put on the wire (via the playground `/api/echo`
 *     decoder), and
 *   - the `snapshot.scripts` summary the executor returns (mutation,
 *     assertions, console, error).
 *
 * Offscreen guard: every scripted send asserts `snapshot.scripts` is
 * non-null. If `isOffscreenSupported()` were false the hooks would be
 * silent no-ops and `scripts` would stay null — so these assertions
 * fail loudly instead of passing-as-skipped.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';
import { API_ECHO_URL, OAUTH2_SEED_AUTH } from '../../../../playground/scripts/api-client-matrix';

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

  // Seed an OAuth bundle under the shared credentialRef so a post-/pre-
  // request script's `oh.vault.get('cred-api-echo')` reads a real access
  // token (the host falls back to the OAuth token store for a ref that
  // isn't a named vault secret).
  const seed = await rpc<{ success: boolean; error?: string }>('oauthClientCredentials', { config: OAUTH2_SEED_AUTH });
  expect(seed.success, seed.error).toBe(true);
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
  body: { kind: string; contentType: string | null; parsed?: unknown; raw?: string };
}

type ScriptConsoleEntry = { level: string; args: string[]; timeMs: number };
type TestAssertion = { name: string; passed: boolean; message?: string };
type RequestMutation = {
  method?: string;
  url?: string;
  headers?: Array<{ key: string; value: string }>;
  body?: unknown;
};

interface ExecSnapshot {
  status: number;
  body: string;
  error?: string | null;
  scripts?: {
    preRequest?: {
      succeeded: boolean;
      error?: { name: string; message: string };
      consoleLog: ScriptConsoleEntry[];
      mutation?: RequestMutation;
    };
    postResponse?: {
      succeeded: boolean;
      error?: { name: string; message: string };
      assertions: TestAssertion[];
      consoleLog: ScriptConsoleEntry[];
    };
  } | null;
}

let nextUid = 0;
function draft(over: Record<string, unknown>): Record<string, unknown> {
  nextUid += 1;
  return {
    schemaVersion: 5,
    uid: `req-scripts-${nextUid}`,
    path: `requests/scripts-e2e/req-${nextUid}`,
    name: 'scripts e2e',
    method: 'POST',
    url: API_ECHO_URL,
    headers: [],
    params: [],
    auth: { type: 'none' },
    body: { type: 'none' },
    ...over,
  };
}

async function exec(d: Record<string, unknown>): Promise<ExecSnapshot> {
  const res = await rpc<{ success: boolean; snapshot?: ExecSnapshot; error?: string }>('executeRequest', { draft: d });
  expect(res.success, res.error).toBe(true);
  return res.snapshot!;
}

/**
 * Send a scripted draft, assert the wire fetch succeeded AND a script
 * outcome was produced (offscreen is up), and return both the decoded
 * echo and the script summary. A failing SCRIPT still completes the
 * wire fetch (200) — script errors don't abort the send.
 */
async function execScripted(d: Record<string, unknown>): Promise<{ snapshot: ExecSnapshot; echo: EchoResponse }> {
  const snapshot = await exec(d);
  expect(snapshot.error ?? null).toBeNull();
  expect(snapshot.status).toBe(200);
  expect(snapshot.scripts, 'offscreen sandbox produced no script outcome').not.toBeNull();
  return { snapshot, echo: JSON.parse(snapshot.body) as EchoResponse };
}

test.describe('Request executor — pre-request scripts', () => {
  test('offscreen is up: a trivial pre-request script reports a non-null outcome', async () => {
    const { snapshot, echo } = await execScripted(draft({ preRequestScript: `oh.setHeader('X-Smoke', '1');` }));
    expect(snapshot.scripts!.preRequest!.succeeded).toBe(true);
    expect(echo.headers['x-smoke']).toBe('1');
  });

  test('mutates the method on the wire', async () => {
    const { snapshot, echo } = await execScripted(draft({ preRequestScript: `oh.setMethod('PUT');` }));
    expect(echo.method).toBe('PUT');
    expect(snapshot.scripts!.preRequest!.mutation!.method).toBe('PUT');
  });

  test('mutates the URL on the wire', async () => {
    const { snapshot, echo } = await execScripted(
      draft({ preRequestScript: `oh.setUrl('${API_ECHO_URL}?via=script');` }),
    );
    expect(echo.query.via).toBe('script');
    expect(snapshot.scripts!.preRequest!.mutation!.url).toBe(`${API_ECHO_URL}?via=script`);
  });

  test('adds and removes headers', async () => {
    const { snapshot, echo } = await execScripted(
      draft({
        headers: [{ uid: 'h1', key: 'X-Pre', value: 'remove-me', enabled: true }],
        preRequestScript: `oh.setHeader('X-From-Script', 'yes'); oh.removeHeader('X-Pre');`,
      }),
    );
    expect(echo.headers['x-from-script']).toBe('yes');
    expect(echo.headers['x-pre']).toBeUndefined();
    expect(snapshot.scripts!.preRequest!.mutation!.headers).toBeDefined();
  });

  test('replaces the body on the wire', async () => {
    const { snapshot, echo } = await execScripted(
      draft({ preRequestScript: `oh.setBody({ type: 'text', content: 'mutated body text' });` }),
    );
    expect(echo.body.kind).toBe('text');
    expect(echo.body.raw).toBe('mutated body text');
    expect(snapshot.scripts!.preRequest!.mutation!.body).toEqual({ type: 'text', content: 'mutated body text' });
  });

  test('captures console output', async () => {
    const { snapshot } = await execScripted(
      draft({ preRequestScript: `console.log('hello', 42, { a: 1 }); oh.setHeader('X-Logged', 'yes');` }),
    );
    const log = snapshot.scripts!.preRequest!.consoleLog;
    const entry = log.find((e) => e.args.includes('hello'));
    expect(entry, 'expected a console.log entry').toBeDefined();
    expect(entry!.level).toBe('log');
    expect(entry!.args).toEqual(['hello', '42', '{"a":1}']);
  });

  test('oh.variables.set then get round-trips through the host', async () => {
    const { echo } = await execScripted(
      draft({
        preRequestScript: `
          await oh.variables.set('e2e_script_var', 'set-by-script');
          const v = await oh.variables.get('e2e_script_var');
          oh.setHeader('X-Var', v == null ? 'NULL' : v);
        `,
      }),
    );
    expect(echo.headers['x-var']).toBe('set-by-script');
  });

  test('oh.vault.get reads a seeded OAuth token and returns null for an unknown ref', async () => {
    const { echo } = await execScripted(
      draft({
        preRequestScript: `
          const tok = await oh.vault.get('${OAUTH2_SEED_AUTH.credentialRef}');
          const unknown = await oh.vault.get('no-such-credential-ref');
          oh.setHeader('X-Vault-Present', tok ? 'yes' : 'no');
          oh.setHeader('X-Vault-Unknown', unknown == null ? 'null' : 'value');
        `,
      }),
    );
    expect(echo.headers['x-vault-present']).toBe('yes');
    expect(echo.headers['x-vault-unknown']).toBe('null');
  });

  test('a variable set by a script resolves a {{ref}} in a later request', async () => {
    // Positive end-to-end {{var}} resolution: a workspace variable seeded
    // by one request's script is visible to a separate request's template.
    await execScripted(draft({ preRequestScript: `await oh.variables.set('e2e_tpl_var', 'tpl-value');` }));

    const followUp = await exec(
      draft({ method: 'GET', body: { type: 'none' }, params: [{ uid: 'p1', key: 'p', value: '{{e2e_tpl_var}}' }] }),
    );
    expect(followUp.error ?? null).toBeNull();
    expect(followUp.status).toBe(200);
    const echo = JSON.parse(followUp.body) as EchoResponse;
    expect(echo.query.p).toBe('tpl-value');
  });

  test('a thrown error is reported but does NOT abort the wire fetch', async () => {
    const { snapshot } = await execScripted(draft({ preRequestScript: `throw new Error('prereq boom');` }));
    const pre = snapshot.scripts!.preRequest!;
    expect(pre.succeeded).toBe(false);
    expect(pre.error!.message).toBe('prereq boom');
    // The request still reached the wire (status asserted 200 in execScripted).
  });

  test('a syntax error surfaces as a failed outcome', async () => {
    const { snapshot } = await execScripted(draft({ preRequestScript: `const broken = ;` }));
    const pre = snapshot.scripts!.preRequest!;
    expect(pre.succeeded).toBe(false);
    expect(pre.error).toBeDefined();
  });

  test('a script that never settles is killed by the timeout', async () => {
    const { snapshot } = await execScripted(
      draft({ preRequestScript: `await new Promise((resolve) => setTimeout(resolve, 999999));` }),
    );
    const pre = snapshot.scripts!.preRequest!;
    expect(pre.succeeded).toBe(false);
    expect(pre.error!.message).toMatch(/timeout/i);
  });

  test('params are NOT visible to scripts, yet still reach the wire (known limitation)', async () => {
    // resolvedToSnapshot hardcodes `params: []` and the sandbox exposes no
    // param-mutation API, so a script can neither read nor write query
    // params — the executor folds them into the URL before the script
    // runs. This asserts the CURRENT behavior: the param rides the wire,
    // but the script sees an empty params list.
    const { echo } = await execScripted(
      draft({
        method: 'GET',
        body: { type: 'none' },
        params: [{ uid: 'p1', key: 'real', value: '1' }],
        preRequestScript: `oh.setHeader('X-Param-Count', String(oh.request.params.length));`,
      }),
    );
    expect(echo.query.real).toBe('1');
    expect(echo.headers['x-param-count']).toBe('0');
  });
});

test.describe('Request executor — post-response scripts', () => {
  test('a passing oh.test surfaces as a passed assertion', async () => {
    const { snapshot } = await execScripted(
      draft({ postResponseScript: `oh.test('status is 200', () => { oh.expect(oh.response.status).toBe(200); });` }),
    );
    const post = snapshot.scripts!.postResponse!;
    expect(post.succeeded).toBe(true);
    expect(post.assertions).toContainEqual(expect.objectContaining({ name: 'status is 200', passed: true }));
  });

  test('a failing oh.test surfaces as a failed assertion without failing the script', async () => {
    const { snapshot } = await execScripted(
      draft({ postResponseScript: `oh.test('intentional fail', () => { oh.expect(1).toBe(2); });` }),
    );
    const post = snapshot.scripts!.postResponse!;
    // A failed assertion is recorded; the script itself still "succeeded"
    // (no uncaught error).
    expect(post.succeeded).toBe(true);
    const failed = post.assertions.find((a) => a.name === 'intentional fail');
    expect(failed).toBeDefined();
    expect(failed!.passed).toBe(false);
    expect(failed!.message).toBeTruthy();
  });

  test('reads the response status, body, and headers', async () => {
    const { snapshot } = await execScripted(
      draft({
        postResponseScript: `
          const body = JSON.parse(oh.response.body);
          oh.test('echoed method is POST', () => oh.expect(body.method).toBe('POST'));
          oh.test('echo marker header present', () =>
            oh.expect(oh.response.headers.some((h) => h.key.toLowerCase() === 'x-oh-echo')).toBeTruthy());
        `,
      }),
    );
    const post = snapshot.scripts!.postResponse!;
    expect(post.assertions).toContainEqual(expect.objectContaining({ name: 'echoed method is POST', passed: true }));
    expect(post.assertions).toContainEqual(
      expect.objectContaining({ name: 'echo marker header present', passed: true }),
    );
  });

  test('assertions registered before a throw still surface', async () => {
    const { snapshot } = await execScripted(
      draft({
        postResponseScript: `
          oh.test('runs before throw', () => oh.expect(true).toBeTruthy());
          throw new Error('post boom');
        `,
      }),
    );
    const post = snapshot.scripts!.postResponse!;
    expect(post.succeeded).toBe(false);
    expect(post.error!.message).toBe('post boom');
    expect(post.assertions).toContainEqual(expect.objectContaining({ name: 'runs before throw', passed: true }));
  });

  test('oh.sendRequest dispatches a nested request through the executor', async () => {
    const { snapshot } = await execScripted(
      draft({
        postResponseScript: `
          const r = await oh.sendRequest({
            method: 'GET',
            url: '${API_ECHO_URL}?nested=hi',
            headers: [],
            params: [],
            body: { type: 'none' },
          });
          const nested = JSON.parse(r.body);
          oh.test('nested status 200', () => oh.expect(r.status).toBe(200));
          oh.test('nested echoed query', () => oh.expect(nested.query.nested).toBe('hi'));
        `,
      }),
    );
    const post = snapshot.scripts!.postResponse!;
    expect(post.assertions).toContainEqual(expect.objectContaining({ name: 'nested status 200', passed: true }));
    expect(post.assertions).toContainEqual(expect.objectContaining({ name: 'nested echoed query', passed: true }));
  });

  test('both hooks run on one request', async () => {
    const { snapshot, echo } = await execScripted(
      draft({
        preRequestScript: `oh.setHeader('X-Both', 'pre');`,
        postResponseScript: `oh.test('saw both', () => oh.expect(oh.response.status).toBe(200));`,
      }),
    );
    expect(echo.headers['x-both']).toBe('pre');
    expect(snapshot.scripts!.preRequest!.succeeded).toBe(true);
    expect(snapshot.scripts!.postResponse!.assertions).toContainEqual(
      expect.objectContaining({ name: 'saw both', passed: true }),
    );
  });
});
