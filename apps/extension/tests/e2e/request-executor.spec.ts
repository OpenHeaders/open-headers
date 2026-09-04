/**
 * Request-executor e2e — the regression gate for the standalone HTTP
 * Request executor (the workbench "send a request" feature).
 *
 * For every auth × body combo in the shared matrix
 * (`playground/scripts/api-client-matrix.ts`), this drives the real
 * executor through the SW — `executeRequest` resolves the draft, folds
 * auth into headers/params, serializes the body, and fetches — against
 * the playground's `/api/echo` decoder. The decoded reflection is then
 * asserted against the combo's `expected`, so a green run means the
 * executor put each combination on the wire correctly (auth scheme, body
 * bytes, Content-Type), not that a parser round-tripped.
 *
 * The matrix is imported, not inlined: it is the single source of truth
 * the importable export fixture is also generated from, so the executor
 * test and the hand-import flow can never drift.
 *
 * Playwright boots the playground as a `webServer` (see
 * `playwright.config.ts`), so `/api/echo` is up at 127.0.0.1:3000 when
 * these specs run; the extension already holds host access for it (the
 * live-orchestration specs fetch the same origin from the SW).
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';
import {
  API_CLIENT_COMBOS,
  API_ECHO_URL,
  type ApiClientCombo,
  OAUTH2_SEED_AUTH,
} from '../../../../playground/scripts/api-client-matrix';
import { AUTH_TYPE_CASES } from '../../../../playground/scripts/auth-type-suite';
import { API_PDF_BYTE_LENGTH } from '../../../../playground/server/api-pdf';
import { assertEchoAuth } from './pages/echo-auth';
import { seedOAuthSuite } from './pages/oauth-seed';

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

  // Seed the oauth2 tokens once via the real flows: the SW POSTs to the
  // playground IdP and persists each bundle under its `credentialRef`,
  // so the header / query combos, the assertion cases and the device
  // case attach a genuine bearer. Same active workspace as
  // executeRequest (both default to it), so the executor reads the
  // seeded tokens.
  await seedOAuthSuite(rpc);
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

/** The `/api/echo` reflection shape (mirrors `playground/server/api-echo.ts`). */
interface EchoResponse {
  method: string;
  url: string;
  query: Record<string, string | string[]>;
  headers: Record<string, string | string[] | undefined>;
  auth:
    | { kind: 'none' }
    | { kind: 'basic'; username: string; password: string }
    | { kind: 'bearer'; token: string }
    | { kind: 'scheme'; scheme: string; token: string };
  body:
    | { kind: 'none'; contentType: string | null }
    | { kind: 'json'; contentType: string | null; parsed: unknown }
    | { kind: 'xml'; contentType: string | null; raw: string }
    | { kind: 'text'; contentType: string | null; raw: string }
    | { kind: 'urlencoded'; contentType: string | null; parsed: Record<string, string | string[]> }
    | {
        kind: 'multipart';
        contentType: string | null;
        parts: Array<{ name: string; value?: string; filename?: string }>;
      };
}

interface ExecSnapshot {
  status: number;
  headers: Array<{ key: string; value: string }>;
  body: string;
  bodyEncoding?: 'base64';
  bodyBytes: number;
  bodyTruncated: boolean;
  requestBodyOmitted?: boolean;
  error?: string | null;
}

/** Build a full draft Request from a combo (executor sends drafts unsaved). */
function buildDraft(combo: ApiClientCombo): Record<string, unknown> {
  return {
    schemaVersion: 5,
    uid: combo.uid,
    path: `requests/api-echo-e2e/${combo.uid}`,
    name: combo.name,
    method: combo.method,
    url: API_ECHO_URL,
    headers: [],
    params: [],
    auth: combo.auth,
    body: combo.body,
  };
}

function assertBody(echo: EchoResponse, expected: ApiClientCombo['expected']['body']): void {
  expect(echo.body.kind).toBe(expected.kind === 'none' ? 'none' : expected.kind);
  switch (expected.kind) {
    case 'none':
      break;
    case 'json': {
      const body = echo.body as Extract<EchoResponse['body'], { kind: 'json' }>;
      expect(body.contentType).toContain(expected.contentType);
      expect(body.parsed).toEqual(expected.parsed);
      break;
    }
    case 'xml': {
      const body = echo.body as Extract<EchoResponse['body'], { kind: 'xml' }>;
      expect(body.contentType).toContain(expected.contentType);
      break;
    }
    case 'text': {
      const body = echo.body as Extract<EchoResponse['body'], { kind: 'text' }>;
      expect(body.contentType).toContain(expected.contentType);
      break;
    }
    case 'urlencoded': {
      const body = echo.body as Extract<EchoResponse['body'], { kind: 'urlencoded' }>;
      expect(body.contentType).toContain(expected.contentType);
      expect(body.parsed).toEqual(expected.parsed);
      break;
    }
    case 'multipart': {
      const body = echo.body as Extract<EchoResponse['body'], { kind: 'multipart' }>;
      // The host (FormData) sets the boundary; assert the type, not the boundary.
      expect(body.contentType ?? '').toContain('multipart/form-data');
      expect(body.parts).toEqual(expected.parts);
      break;
    }
  }
}

/** The playground's binary probe (see `playground/server/api-pdf.ts`). */
const API_PDF_URL = 'http://127.0.0.1:3000/api/pdf';

test.describe('Request executor — binary response (/api/pdf)', () => {
  test('PDF body reaches the snapshot: status, Content-Type, document structure', async () => {
    const exec = await rpc<{ success: boolean; snapshot?: ExecSnapshot; error?: string }>('executeRequest', {
      draft: {
        schemaVersion: 5,
        uid: 'req-api-pdf-e2e',
        path: 'requests/api-echo-e2e/req-api-pdf-e2e',
        name: 'GET a generated PDF',
        method: 'GET',
        url: API_PDF_URL,
        headers: [],
        params: [],
        auth: { type: 'none' },
        body: { type: 'none' },
      },
    });

    expect(exec.success, exec.error).toBe(true);
    const snapshot = exec.snapshot!;
    expect(snapshot.error ?? null).toBeNull();
    expect(snapshot.status).toBe(200);

    const contentType = snapshot.headers.find((h) => h.key.toLowerCase() === 'content-type')?.value ?? '';
    expect(contentType).toContain('application/pdf');

    // Byte-faithful capture: the PDF is not valid UTF-8 (binary-marker
    // comment bytes), so the executor stores it base64 with the
    // encoding stamped, `bodyBytes` matches the wire exactly, and the
    // decoded bytes reproduce the document verbatim.
    expect(snapshot.bodyTruncated).toBe(false);
    expect(snapshot.bodyEncoding).toBe('base64');
    expect(snapshot.bodyBytes).toBe(API_PDF_BYTE_LENGTH);
    const decoded = Buffer.from(snapshot.body, 'base64');
    expect(decoded.byteLength).toBe(API_PDF_BYTE_LENGTH);
    const text = decoded.toString('latin1');
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('(Open Headers PDF probe) Tj');
    expect(text).toContain('startxref');
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  });
});

test.describe('Request executor — GET with a body is permissive', () => {
  test('send succeeds; the body is omitted from the wire and stamped on the snapshot', async () => {
    const exec = await rpc<{ success: boolean; snapshot?: ExecSnapshot; error?: string }>('executeRequest', {
      draft: {
        schemaVersion: 5,
        uid: 'req-get-body-e2e',
        path: 'requests/api-echo-e2e/req-get-body-e2e',
        name: 'GET with a JSON body',
        method: 'GET',
        url: API_ECHO_URL,
        headers: [],
        params: [],
        auth: { type: 'none' },
        body: { type: 'json', content: '{"q":"openheaders"}' },
      },
    });

    expect(exec.success, exec.error).toBe(true);
    const snapshot = exec.snapshot!;
    // The old behavior was a hard failure before any wire activity
    // ("Request with GET/HEAD method cannot have body"). Now the send
    // goes out bodiless, with honest attribution.
    expect(snapshot.error ?? null).toBeNull();
    expect(snapshot.status).toBe(200);
    expect(snapshot.requestBodyOmitted).toBe(true);

    const echo = JSON.parse(snapshot.body) as EchoResponse;
    expect(echo.method).toBe('GET');
    expect(echo.body.kind).toBe('none');
  });
});

/** The `Authorization` value RFC 7617 prescribes for a credential pair —
 *  UTF-8 bytes of `user:pass`, base64. Independent of the executor's
 *  encoder (node's Buffer, not the SW's TextEncoder + btoa). */
const basicHeader = (username: string, password: string) =>
  `Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}`;

/** A bodiless GET draft carrying an auth config and optional user header rows. */
function authDraft(
  uid: string,
  auth: ApiClientCombo['auth'],
  headers: Array<{ uid: string; key: string; value: string }> = [],
): Record<string, unknown> {
  return {
    schemaVersion: 5,
    uid,
    path: `requests/api-echo-e2e/${uid}`,
    name: `auth leg ${uid}`,
    method: 'GET',
    url: API_ECHO_URL,
    headers,
    params: [],
    auth,
    body: { type: 'none' },
  };
}

async function sendDraft(draft: Record<string, unknown>): Promise<EchoResponse> {
  const exec = await rpc<{ success: boolean; snapshot?: ExecSnapshot; error?: string }>('executeRequest', { draft });
  expect(exec.success, exec.error).toBe(true);
  const snapshot = exec.snapshot!;
  expect(snapshot.error ?? null).toBeNull();
  expect(snapshot.status).toBe(200);
  return JSON.parse(snapshot.body) as EchoResponse;
}

test.describe('Request executor — auth type suite, one draft per concrete type', () => {
  for (const c of AUTH_TYPE_CASES) {
    // A draft has no ancestor chain to inherit from — the DOM spec sends
    // the seeded `inherit` request against the collection's pool.
    if (c.auth.type === 'inherit') continue;
    test(c.name, async () => {
      const echo = await sendDraft(authDraft(c.uid, c.auth));
      assertEchoAuth(echo, c.expected);
    });
  }
});

test.describe('Request executor — oauth2 headerPrefix wire leg', () => {
  test("a set Header Prefix replaces the bundle's token_type on the Authorization value", async () => {
    const echo = await sendDraft(
      authDraft('rqoa2hpx', { ...OAUTH2_SEED_AUTH, headerPrefix: 'Token' } as ApiClientCombo['auth']),
    );
    expect(echo.auth).toMatchObject({ kind: 'scheme', scheme: 'Token', token: 'oh-oauth-cc-token' });
  });
});

test.describe('Request executor — basic auth wire legs', () => {
  test("replaces a user's same-key Authorization row: exactly one Basic value on the wire", async () => {
    const echo = await sendDraft(
      authDraft('rqbascol', { type: 'basic', username: 'alice@openheaders.io', password: 'p4ssw0rd' }, [
        { uid: 'stalehdr', key: 'Authorization', value: 'Bearer stale-user-token' },
      ]),
    );
    // The raw header, not the decode: a comma-joined pair would still
    // decode as `basic` with garbage in the password.
    expect(echo.headers.authorization).toBe(basicHeader('alice@openheaders.io', 'p4ssw0rd'));
    expect(echo.auth).toMatchObject({ kind: 'basic', username: 'alice@openheaders.io', password: 'p4ssw0rd' });
  });

  test('UTF-8 credentials ride as RFC 7617 bytes and decode back intact', async () => {
    const echo = await sendDraft(authDraft('rqbasutf', { type: 'basic', username: 'ünicode', password: 'pässwörd' }));
    expect(echo.headers.authorization).toBe(basicHeader('ünicode', 'pässwörd'));
    expect(echo.auth).toMatchObject({ kind: 'basic', username: 'ünicode', password: 'pässwörd' });
  });

  test('a blank password is legal: username-only credential with the trailing colon', async () => {
    const echo = await sendDraft(
      authDraft('rqbasnop', { type: 'basic', username: 'alice@openheaders.io', password: '' }),
    );
    expect(echo.headers.authorization).toBe(basicHeader('alice@openheaders.io', ''));
    expect(echo.auth).toMatchObject({ kind: 'basic', username: 'alice@openheaders.io', password: '' });
  });

  test('a disabled config contributes nothing — no Authorization header at all', async () => {
    const echo = await sendDraft(
      authDraft('rqbasoff', { type: 'basic', username: 'alice@openheaders.io', password: 'p4ssw0rd', disabled: true }),
    );
    expect(echo.auth.kind).toBe('none');
    expect(echo.headers.authorization).toBeUndefined();
  });
});

test.describe('Request executor — auth × body combos against /api/echo', () => {
  for (const combo of API_CLIENT_COMBOS) {
    test(combo.name, async () => {
      const exec = await rpc<{ success: boolean; snapshot?: ExecSnapshot; error?: string }>('executeRequest', {
        draft: buildDraft(combo),
      });

      expect(exec.success, exec.error).toBe(true);
      const snapshot = exec.snapshot!;
      expect(snapshot.error ?? null).toBeNull();
      expect(snapshot.status).toBe(200);

      const echo = JSON.parse(snapshot.body) as EchoResponse;
      assertEchoAuth(echo, combo.expected.auth);
      assertBody(echo, combo.expected.body);
    });
  }
});
