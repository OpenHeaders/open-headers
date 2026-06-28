/**
 * Request-executor variable-resolution e2e (RPC) — proves the executor's
 * `buildResolver` actually reads every variable scope on the wire, and
 * that flat `{{NAME}}` precedence (vault > environment > collection >
 * workspace) holds when a name is defined in two scopes at once.
 *
 * The resolver's per-scope logic + the precedence chain are unit-covered
 * in `@openheaders/core/variables`; this suite does NOT re-test resolution.
 * It is the integration gate that (a) `buildResolver` feeds each store,
 * (b) `resolveStr` runs on every templatable field (url / params /
 * headers / body / auth), and (c) precedence picks the right winner when
 * the same flat name exists in two scopes.
 *
 * Seeding goes through the REAL workspace-import pipeline. Vault secrets
 * and request-collection variables have NO write RPC, and a raw
 * `chrome.storage` write to those entity arrays never reaches the SW's
 * in-memory mirror (only the env/active pointer keys re-subscribe). One
 * `importWorkspace` into the current workspace writes all four scopes
 * AND re-hydrates the SW caches the executor reads (orchestrator's
 * `isActive` branch) — so a single structured envelope seeds env +
 * collection + workspace + vault at once, with a few duplicate names
 * spanning two scopes each so the precedence winner is asserted directly
 * against the playground's `/api/echo` reflection.
 *
 * The envelope is hand-built as plain JSON (the orchestrator trusts the
 * typed `incoming`, so no `@openheaders/core` runtime import is needed —
 * its `import` export condition points at TS source Playwright can't
 * transform). Non-colliding entities import under `new-uid`, so the
 * collection + environment are read back by name to recover their final
 * uid / path.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';
import { API_ECHO_URL } from '../../../../playground/scripts/api-client-matrix';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

let context: BrowserContext;
let extensionId: string;
let rpcPage: Page;

/** Collection path recovered after import (uid is remapped by `new-uid`). */
let collPath: string;
/** Environment uid recovered after import — pinned per-send via `environmentId`. */
let envUid: string;

// ── Seed data ──────────────────────────────────────────────────────
//
// Each `*Only` name lives in exactly one scope (proves that scope is
// read). Each `dup*` name spans two scopes with distinct values (proves
// the precedence winner). The duplicate ladder covers every adjacent
// rung of the chain plus the vault↔workspace extremes:
//   dupVaultEnv  → vault beats a present environment value
//   dupEnvColl   → environment beats collection
//   dupCollWs    → collection beats workspace
//   dupVaultWs   → vault beats workspace

const ENV_VARS = [
  variable('envOnly', 'env-value'),
  variable('dupVaultEnv', 'from-env'),
  variable('dupEnvColl', 'from-env'),
];
const COLL_VARS = [
  variable('collOnly', 'coll-value'),
  variable('dupEnvColl', 'from-coll'),
  variable('dupCollWs', 'from-coll'),
];
const WS_VARS = [variable('wsOnly', 'ws-value'), variable('dupCollWs', 'from-ws'), variable('dupVaultWs', 'from-ws')];
const VAULT_SECRETS = [
  vaultString('vaultOnly', 'vault-value'),
  vaultString('dupVaultEnv', 'from-vault'),
  vaultString('dupVaultWs', 'from-vault'),
];

const COLLECTION_NAME = 'varcoll';
const ENVIRONMENT_NAME = 'VarEnv';

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

  // One import seeds vault + env + collection + workspace into the active
  // workspace and re-hydrates the SW caches the executor reads.
  const imported = await rpc<{ success: boolean; error?: string }>('importWorkspace', {
    incoming: buildSeedEnvelope(),
    strategies: {},
    target: { mode: 'current' },
    sourceHash: 'sha256:request-vars-e2e-seed',
  });
  expect(imported.success, imported.error).toBe(true);

  // Recover the collection path + env uid (both remapped under `new-uid`).
  const colls = await rpc<{ collections: Array<{ uid: string; name: string; path: string }> }>(
    'getLocalRequestCollections',
  );
  const seededColl = colls.collections.find((c) => c.name === COLLECTION_NAME);
  expect(seededColl, 'seeded collection landed').toBeDefined();
  collPath = seededColl!.path;

  const envs = await rpc<{ environments: Array<{ uid: string; name: string }> }>('listEnvironments');
  const seededEnv = envs.environments.find((e) => e.name === ENVIRONMENT_NAME);
  expect(seededEnv, 'seeded environment landed').toBeDefined();
  envUid = seededEnv!.uid;
});

test.afterAll(async () => {
  await context.close();
});

// ── Seed builders ──────────────────────────────────────────────────

/** 8-char `[a-z0-9]` uid matching `UidSchema`. */
function mkUid(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function variable(name: string, value: string): { uid: string; name: string; value: string; type: 'default' } {
  return { uid: mkUid(), name, value, type: 'default' };
}

function vaultString(name: string, value: string): { uid: string; kind: 'string'; name: string; value: string } {
  return { uid: mkUid(), kind: 'string', name, value };
}

/**
 * Hand-built `WorkspaceExport` envelope. Paths are pre-canonicalized
 * (`requests/<slug>-<uid>`) so they survive the importer verbatim; the
 * orchestrator runs its own diff and doesn't validate the envelope
 * against the schema, so this plain object is sufficient.
 */
function buildSeedEnvelope(): Record<string, unknown> {
  const collUid = mkUid();
  return {
    kind: 'workspace-export',
    schemaVersion: 5,
    exportFormatVersion: 1,
    exportId: mkUid(),
    exportedAt: '2026-01-01T00:00:00.000Z',
    source: { app: 'extension', appVersion: '2026.1.0', platform: 'chrome' },
    scope: 'workspace',
    workspace: { uid: mkUid(), name: 'Var Seed' },
    entities: {
      collections: [
        {
          schemaVersion: 5,
          uid: collUid,
          path: `requests/${COLLECTION_NAME}-${collUid}`,
          name: COLLECTION_NAME,
          variables: COLL_VARS,
        },
      ],
      folders: [],
      rules: [],
      requests: [],
      templates: [],
      environments: [{ schemaVersion: 5, uid: mkUid(), name: ENVIRONMENT_NAME, variables: ENV_VARS }],
      workspaceVars: { schemaVersion: 5, variables: WS_VARS },
      liveWorkflows: [],
      liveVariables: [],
      vault: { schemaVersion: 5, secrets: VAULT_SECRETS },
    },
    meta: {
      redactions: { vault: 'plaintext', liveCache: 'omitted', oauthTokens: 'omitted', totpCooldowns: 'omitted' },
      counts: {
        rules: 0,
        requests: 0,
        environments: 1,
        liveWorkflows: 0,
        liveVariables: 0,
        templates: 0,
        secrets: VAULT_SECRETS.length,
      },
    },
  };
}

// ── RPC + send helpers ─────────────────────────────────────────────

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

/** The subset of the `/api/echo` reflection these specs assert on. */
interface EchoResponse {
  query: Record<string, string | string[]>;
  headers: Record<string, string | string[] | undefined>;
  auth:
    | { kind: 'none' }
    | { kind: 'basic'; username: string; password: string }
    | { kind: 'bearer'; token: string }
    | { kind: 'scheme'; scheme: string; token: string };
  body: { kind: 'none'; contentType: string | null } | { kind: 'json'; contentType: string | null; parsed: unknown };
}

interface DraftSpec {
  /** Defaults to a floating path (no owning collection). Set under
   *  `collPath` to bring collection scope into resolution. */
  path?: string;
  method?: string;
  url?: string;
  headers?: Array<{ key: string; value: string }>;
  params?: Array<{ key: string; value: string }>;
  auth?: Record<string, unknown>;
  body?: Record<string, unknown>;
}

/** Build a draft, send it through the executor, and return the decoded echo. */
async function sendDraft(spec: DraftSpec): Promise<EchoResponse> {
  const draft = {
    schemaVersion: 5,
    uid: mkUid(),
    path: spec.path ?? 'requests/_floating',
    name: 'var-probe',
    method: spec.method ?? 'GET',
    url: spec.url ?? API_ECHO_URL,
    headers: (spec.headers ?? []).map((h) => ({ key: h.key, value: h.value, enabled: true })),
    params: (spec.params ?? []).map((p) => ({ key: p.key, value: p.value, enabled: true })),
    auth: spec.auth ?? { type: 'none' },
    body: spec.body ?? { type: 'none' },
  };
  const exec = await rpc<{
    success: boolean;
    snapshot?: { status: number; body: string; error?: string | null };
    error?: string;
  }>('executeRequest', { draft, environmentId: envUid });
  expect(exec.success, exec.error).toBe(true);
  const snapshot = exec.snapshot!;
  expect(snapshot.error ?? null, 'executor returned no error').toBeNull();
  expect(snapshot.status).toBe(200);
  return JSON.parse(snapshot.body) as EchoResponse;
}

/** Resolve a single reference through a probe header and read it back. */
async function resolveViaHeader(ref: string, opts: { underCollection?: boolean } = {}): Promise<string> {
  const echo = await sendDraft({
    headers: [{ key: 'X-Probe', value: ref }],
    ...(opts.underCollection ? { path: `${collPath}/probe-${mkUid()}` } : {}),
  });
  return (echo.headers['x-probe'] as string | undefined) ?? '';
}

// ── Per-scope resolution (buildResolver reads each store) ──────────

test.describe('Request executor — per-scope variable resolution', () => {
  test('environment scope resolves (namespaced + flat)', async () => {
    expect(await resolveViaHeader('{{env.envOnly}}')).toBe('env-value');
    expect(await resolveViaHeader('{{envOnly}}')).toBe('env-value');
  });

  test('collection scope resolves (namespaced + flat)', async () => {
    expect(await resolveViaHeader('{{collection.collOnly}}', { underCollection: true })).toBe('coll-value');
    expect(await resolveViaHeader('{{collOnly}}', { underCollection: true })).toBe('coll-value');
  });

  test('workspace scope resolves (namespaced + flat)', async () => {
    expect(await resolveViaHeader('{{workspace.wsOnly}}')).toBe('ws-value');
    expect(await resolveViaHeader('{{wsOnly}}')).toBe('ws-value');
  });

  test('vault scope resolves (namespaced + flat)', async () => {
    expect(await resolveViaHeader('{{vault.vaultOnly}}')).toBe('vault-value');
    expect(await resolveViaHeader('{{vaultOnly}}')).toBe('vault-value');
  });
});

// ── Every templatable field runs resolveStr (one scope) ────────────
//
// One draft references the same vault value from URL query, structured
// param, header, JSON body, and basic-auth — proving resolveStr fires on
// each channel, not just headers.

test.describe('Request executor — resolveStr on every field', () => {
  test('url / param / header / body / auth all resolve', async () => {
    const echo = await sendDraft({
      method: 'POST',
      url: `${API_ECHO_URL}?u={{vault.vaultOnly}}`,
      params: [{ key: 'p', value: '{{vault.vaultOnly}}' }],
      headers: [{ key: 'X-H', value: '{{vaultOnly}}' }],
      body: { type: 'json', content: '{"b":"{{vault.vaultOnly}}"}' },
      auth: { type: 'basic', username: '{{vaultOnly}}', password: 'pw' },
    });

    expect(echo.query.u).toBe('vault-value');
    expect(echo.query.p).toBe('vault-value');
    expect(echo.headers['x-h']).toBe('vault-value');
    expect(echo.body.kind).toBe('json');
    expect((echo.body as Extract<EchoResponse['body'], { kind: 'json' }>).parsed).toEqual({ b: 'vault-value' });
    expect(echo.auth).toMatchObject({ kind: 'basic', username: 'vault-value' });
  });
});

// ── Precedence (flat {{NAME}} in two scopes) ───────────────────────
//
// Precedence only applies to FLAT references — namespaced refs are
// single-scope by construction. The real chain is
// vault > environment > collection > workspace (resolver.resolve order).

test.describe('Request executor — flat-reference precedence', () => {
  test('vault beats environment', async () => {
    expect(await resolveViaHeader('{{dupVaultEnv}}')).toBe('from-vault');
  });

  test('environment beats collection', async () => {
    expect(await resolveViaHeader('{{dupEnvColl}}', { underCollection: true })).toBe('from-env');
  });

  test('collection beats workspace', async () => {
    expect(await resolveViaHeader('{{dupCollWs}}', { underCollection: true })).toBe('from-coll');
  });

  test('vault beats workspace', async () => {
    expect(await resolveViaHeader('{{dupVaultWs}}')).toBe('from-vault');
  });
});
