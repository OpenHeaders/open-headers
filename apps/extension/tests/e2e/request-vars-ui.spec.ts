/**
 * Request-editor variable-resolution UI e2e — the DOM counterpart to
 * `request-vars.spec.ts`.
 *
 * `request-vars.spec.ts` proves the EXECUTOR's resolver (the SW's
 * `buildResolver`, fed from chrome.storage mirrors) reads every scope on
 * the wire. This suite proves the *renderer's* resolver — a DIFFERENT
 * implementation (`useVariableResolver`, fed from React context, not the
 * SW stores) that drives the editor's reactive unresolved-flagging loop:
 * a `{{ref}}` that resolves nowhere flags the owning section (a red tab
 * dot) and disables Send (the wire-facing gate, equivalent to the DNR
 * compile gate for rules); a ref that resolves clears the flag, re-enables
 * Send, and the value rides the actual wire (read back from the
 * `/api/echo` reflection in the response panel).
 *
 * One namespaced `{{ns.X}}` per scope (env / collection / workspace /
 * vault-string / vault-TOTP / file / live) proves the renderer resolver
 * sees each store. Namespaced (not flat) refs keep every case single-scope
 * — precedence is the executor suite's concern. A trailing negative case
 * (an undefined ref) keeps the gate honest.
 *
 * Seeding reuses the proven import harness from `request-vars.spec.ts`:
 * one `importWorkspace` seeds env + collection + workspace + vault (string
 * + TOTP), and the reload re-hydrates the renderer's context. File + live
 * are seeded through their own RPCs. The active-environment pointer is set
 * directly in `chrome.storage` (no setter RPC exists), and the live
 * workflow is refreshed UNDER that env — the executor's live registry
 * keys runs by the active env with NO null fallback, so a run keyed to any
 * other env would resolve in the renderer yet fail the wire-side gate.
 */

import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';
import { API_ECHO_URL } from '../../../../playground/scripts/api-client-matrix';
import { WorkbenchPage } from './pages/workbench-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');

/** Matches the Headers bulk-edit textarea placeholder. */
const HEADERS_BULK = /Content-Type: application/;

let context: BrowserContext;
let extensionId: string;
let workbench: WorkbenchPage;
let page: Page;

/** Shared collection-parented probe request, reused by every scope test
 *  (collection scope needs the request owned by the seeded collection;
 *  the other scopes resolve regardless of the owning collection). */
let reqUid: string;
/** Imported file's content hash — `{{file.probe.txt}}` resolves to this. */
let fileHash: string;

// ── Seed data (copied from `request-vars.spec.ts` so the renderer is
//    proven against the SAME import harness the executor suite uses) ────

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

const TOTP_NAME = 'totpSecret';
/** RFC 6238 test seed (base32). `{{vault.totpSecret}}` reports resolvable
 *  in the editor (deferred mode) and resolves to a rolling 6-digit code on
 *  the wire. */
const TOTP_SECRET = {
  uid: mkUid(),
  kind: 'totp' as const,
  name: TOTP_NAME,
  seed: 'JBSWY3DPEHPK3PXP',
  algorithm: 'SHA1' as const,
  digits: 6,
  period: 30,
};
const VAULT_SECRETS = [
  vaultString('vaultOnly', 'vault-value'),
  vaultString('dupVaultEnv', 'from-vault'),
  vaultString('dupVaultWs', 'from-vault'),
  TOTP_SECRET,
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

  page = await context.newPage();
  workbench = await WorkbenchPage.open(page, extensionId);

  // One import seeds env + collection + workspace + vault (string + TOTP)
  // into the active workspace and re-hydrates the SW caches the executor
  // reads; the reload below re-hydrates the renderer's resolver context.
  const imported = await workbench.rpc<{ success: boolean; error?: string }>('importWorkspace', {
    incoming: buildSeedEnvelope(),
    strategies: {},
    target: { mode: 'current' },
    sourceHash: 'sha256:request-vars-ui-seed',
  });
  expect(imported.success, imported.error).toBe(true);

  // Recover the collection uid (remapped under `new-uid` on import) so the
  // probe request can be parented under it, and the env uid so it can be
  // pinned as the active environment.
  const colls = await workbench.rpc<{ collections: Array<{ uid: string; name: string }> }>(
    'getLocalRequestCollections',
  );
  const seededColl = colls.collections.find((c) => c.name === COLLECTION_NAME);
  expect(seededColl, 'seeded collection landed').toBeDefined();
  const collUid = seededColl!.uid;

  const envs = await workbench.rpc<{ environments: Array<{ uid: string; name: string }> }>('listEnvironments');
  const seededEnv = envs.environments.find((e) => e.name === ENVIRONMENT_NAME);
  expect(seededEnv, 'seeded environment landed').toBeDefined();
  const envUid = seededEnv!.uid;

  // Pin the active environment. No setter RPC exists, so write the pointer
  // key directly — the SW re-subscribes via `bindActivePointerSubscriptions`
  // and the renderer reads it on reload. `{{env.X}}` resolution (renderer +
  // executor) needs this set.
  const ws = await workbench.rpc<{ workspace: { id: string } }>('getActiveWorkspace');
  const wsId = ws.workspace.id;
  await page.evaluate(
    ({ key, value }: { key: string; value: string }) =>
      new Promise<void>((resolve) => {
        chrome.storage.local.set({ [key]: value }, () => resolve());
      }),
    { key: `oh.ws.${wsId}.activeEnvironmentId`, value: envUid },
  );

  // The shared probe request, parented under the seeded collection.
  reqUid = await createCollectionRequest(collUid);

  // File scope — `{{file.probe.txt}}` resolves to the content hash.
  fileHash = await seedFile();

  // Live scope — `{{live.liveScopeToken}}` resolves to the refreshed
  // workflow capture. Refresh UNDER `envUid`: the executor's live registry
  // keys runs by the active env with no null fallback.
  await seedLiveVariable(envUid);

  await workbench.reload();
  await workbench.showRequestsView();
  await workbench.collapseRightSidebar();
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

/** Hand-built `WorkspaceExport` envelope — same shape the executor suite
 *  imports (the orchestrator trusts the typed `incoming` and runs its own
 *  diff, so a plain object is sufficient). */
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
    workspace: { uid: mkUid(), name: 'UI Var Seed' },
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
      specs: [],
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
        specs: 0,
      },
    },
  };
}

/** Create the shared probe request under the seeded collection. */
async function createCollectionRequest(collUid: string): Promise<string> {
  const res = await workbench.rpc<{ success: boolean; request?: { uid: string }; error?: string }>(
    'createLocalRequest',
    {
      name: 'ui-var-probe',
      collectionUid: collUid,
      seed: {
        method: 'GET',
        url: API_ECHO_URL,
        headers: [],
        params: [],
        auth: { type: 'none' },
        body: { type: 'none' },
      },
    },
  );
  expect(res.success, res.error).toBe(true);
  return res.request!.uid;
}

/** Upload a file and return its content hash. */
async function seedFile(): Promise<string> {
  const bytesBase64 = Buffer.from('open-headers file scope probe').toString('base64');
  const put = await workbench.rpc<{ success: boolean; fileRef?: { hash: string }; error?: string }>('putFile', {
    filename: 'probe.txt',
    mimeType: 'text/plain',
    bytesBase64,
  });
  expect(put.success, put.error).toBe(true);
  return put.fileRef!.hash;
}

/** Stand up a published Live Workflow + Variable and refresh it once under
 *  `envUid`, so `{{live.liveScopeToken}}` resolves in both resolvers. */
async function seedLiveVariable(envUid: string): Promise<void> {
  const reqRes = await workbench.rpc<{ success: boolean; request?: { uid: string }; error?: string }>(
    'createLocalRequest',
    { name: 'live-refresh-src', seed: { method: 'GET', url: 'http://127.0.0.1:3000/live/refresh' } },
  );
  expect(reqRes.success, reqRes.error).toBe(true);
  const requestUid = reqRes.request!.uid;

  const wfRes = await workbench.rpc<{ success: boolean; workflow?: { uid: string }; error?: string }>(
    'createLiveWorkflow',
    {
      name: 'live-var-scope-wf',
      enabled: true,
      refresh: { kind: 'manual' },
      steps: [
        {
          uid: 'wfstep01',
          id: 'fetch',
          requestUid,
          captures: [{ uid: 'wfcap001', name: 'token', extractor: { kind: 'json-path', path: '$.access_token' } }],
        },
      ],
    },
  );
  expect(wfRes.success, wfRes.error).toBe(true);
  const workflowUid = wfRes.workflow!.uid;

  const lvRes = await workbench.rpc<{ success: boolean; variable?: { uid: string }; error?: string }>(
    'createLiveVariable',
    { name: 'liveScopeToken', workflowUid, stepId: 'fetch', captureName: 'token', enabled: true },
  );
  expect(lvRes.success, lvRes.error).toBe(true);
  const lvUid = lvRes.variable!.uid;

  // The create lands through the oracle and the store cache refreshes
  // on broadcast — wait for visibility before the publish writes, then
  // publish both (the effective registry gates on `published`).
  await expect
    .poll(
      async () => {
        const res = await workbench.rpc<{ workflows?: Array<{ uid: string }> }>('listLiveWorkflows');
        return (res.workflows ?? []).some((w) => w.uid === workflowUid);
      },
      { timeout: 10000 },
    )
    .toBe(true);
  const wfPub = await workbench.rpc<{ success: boolean; error?: string }>('updateLiveWorkflow', {
    uid: workflowUid,
    updates: { published: true },
  });
  expect(wfPub.success, wfPub.error).toBe(true);
  await expect
    .poll(
      async () => {
        const res = await workbench.rpc<{ variables?: Array<{ uid: string }> }>('listLiveVariables');
        return (res.variables ?? []).some((v) => v.uid === lvUid);
      },
      { timeout: 10000 },
    )
    .toBe(true);
  const lvPub = await workbench.rpc<{ success: boolean; error?: string }>('updateLiveVariable', {
    uid: lvUid,
    updates: { published: true },
  });
  expect(lvPub.success, lvPub.error).toBe(true);

  const refreshed = await workbench.rpc<{ success: boolean; error?: string }>('refreshLiveWorkflowNow', {
    workflowUid,
    environmentId: envUid,
  });
  expect(refreshed.success, refreshed.error).toBe(true);
}

// ── Per-scope drive helper ─────────────────────────────────────────

interface Echo {
  headers: Record<string, string | string[] | undefined>;
}

/**
 * Drive one `{{ns.X}}` reference through the editor: type it into a probe
 * header, assert the renderer sees it resolve (no section flag + Send
 * enabled), send, and return the reflected header value.
 *
 * The echo readback polls rather than reading once — the request/response
 * panel is reused across tests, so a single read could return the prior
 * scope's body before this send lands. Every scope reflects a distinct
 * value, so polling for the expected value naturally waits for the fresh
 * response.
 */
async function resolvesInEditor(ref: string, expected: string | RegExp): Promise<void> {
  const sendButton = page.getByRole('button', { name: 'Send' }).filter({ visible: true }).first();
  const unresolvedDot = page.getByTestId('oh-section-unresolved').filter({ visible: true });

  await workbench.openRequest(reqUid);
  await workbench.openEditorTab(/Headers/);
  await workbench.fillBulkEdit(HEADERS_BULK, `X-Scope: ${ref}`);

  await expect(unresolvedDot).toHaveCount(0);
  await expect(sendButton).toBeEnabled();

  await workbench.send();
  const headerValue = expect.poll(
    async () => {
      const echo = await workbench.responseEcho<Echo>().catch(() => null);
      return (echo?.headers['x-scope'] as string | undefined) ?? '';
    },
    { timeout: 15000 },
  );
  if (expected instanceof RegExp) await headerValue.toMatch(expected);
  else await headerValue.toEqual(expected);
}

// ── Per-scope renderer resolution ──────────────────────────────────

test.describe('Request editor — per-scope resolution clears the flag and rides the wire', () => {
  test('environment scope', async () => {
    await resolvesInEditor('{{env.envOnly}}', 'env-value');
  });

  test('collection scope', async () => {
    await resolvesInEditor('{{collection.collOnly}}', 'coll-value');
  });

  test('workspace scope', async () => {
    await resolvesInEditor('{{workspace.wsOnly}}', 'ws-value');
  });

  test('vault string scope', async () => {
    await resolvesInEditor('{{vault.vaultOnly}}', 'vault-value');
  });

  test('vault TOTP scope (deferred in editor, real code on the wire)', async () => {
    await resolvesInEditor(`{{vault.${TOTP_NAME}}}`, /^\d{6}$/);
  });

  test('file scope (resolves to the content hash)', async () => {
    await resolvesInEditor('{{file.probe.txt}}', fileHash);
  });

  test('live scope (refreshed workflow capture)', async () => {
    await resolvesInEditor('{{live.liveScopeToken}}', 'live-e2e-refreshed-token');
  });
});

// ── Negative case (the gate fires) ─────────────────────────────────

test.describe('Request editor — unresolved flagging gates Send', () => {
  test('an undefined {{ref}} flags the section and disables Send', async () => {
    const sendButton = page.getByRole('button', { name: 'Send' }).filter({ visible: true }).first();
    const unresolvedDot = page.getByTestId('oh-section-unresolved').filter({ visible: true });

    await workbench.openRequest(reqUid);
    await workbench.openEditorTab(/Headers/);
    await workbench.fillBulkEdit(HEADERS_BULK, 'X-Scope: {{wsMissingVar}}');

    await expect(unresolvedDot).toBeVisible();
    await expect(sendButton).toBeDisabled();
  });
});
