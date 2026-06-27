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
import { API_CLIENT_COMBOS, API_ECHO_URL, type ApiClientCombo } from '../../../../playground/scripts/api-client-matrix';

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

/** The `/api/echo` reflection shape (mirrors `playground/server/api-echo.ts`). */
interface EchoResponse {
  method: string;
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
    | { kind: 'multipart'; contentType: string | null; parts: Array<{ name: string; value?: string; filename?: string }> };
}

interface ExecSnapshot {
  status: number;
  body: string;
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

function assertAuth(echo: EchoResponse, expected: ApiClientCombo['expected']['auth']): void {
  switch (expected.kind) {
    case 'none':
      expect(echo.auth.kind).toBe('none');
      break;
    case 'basic':
      expect(echo.auth).toMatchObject({ kind: 'basic', username: expected.username, password: expected.password });
      break;
    case 'bearer':
      expect(echo.auth).toMatchObject({ kind: 'bearer', token: expected.token });
      break;
    case 'header':
      // api-key in a header — no Authorization, the key rides its own header.
      expect(echo.auth.kind).toBe('none');
      expect(echo.headers[expected.name]).toBe(expected.value);
      break;
    case 'query':
      // api-key in the query string.
      expect(echo.query[expected.name]).toBe(expected.value);
      break;
    case 'deferred':
      // oauth2 with no seeded token — nothing attached.
      expect(echo.auth.kind).toBe('none');
      expect(echo.query.access_token).toBeUndefined();
      break;
  }
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
      assertAuth(echo, combo.expected.auth);
      assertBody(echo, combo.expected.body);
    });
  }
});
