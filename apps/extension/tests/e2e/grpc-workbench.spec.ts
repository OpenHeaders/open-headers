/**
 * gRPC workbench close-out legs — the combined live-pass G-legs
 * (G1–G3) plus the Save Response leg as a permanent gate, on the
 * daemon-join harness: real Chromium with the built extension, a
 * spawned headless daemon as the real backend (peer execute ON from
 * boot — the opt-in refusal is grpc-forwarded's E2 leg), and the real
 * playground gRPC probe as an own tsx child.
 *
 *   G1  Generate Collection on a protobuf spec: single-service lands
 *       FLAT (no folder rows), one GrpcRequest per rpc with the
 *       example message pre-filled; a two-service spec folders per
 *       service full name. The spec editor's Collections popover
 *       lists the link with the in-sync badge, Update stays disabled
 *       with the proto tooltip, and an edit + Save flips the badge to
 *       drifted (hash-based drift law).
 *   G2  a generated request invokes against the probe with only the
 *       authority filled — decoded reply proves the specLink binding.
 *   G3  Docs tab round-trip: write markdown → Save → reload → the tab
 *       reopens in Preview rendering it; clear → Save → reload → the
 *       tab reopens in Write (read-first law).
 *   SR  Save Response from BOTH result panes: a unary capture opens
 *       the example viewer (decoded reply + captured method label),
 *       lands a sidebar leaf, and "Open in Request" hands the EDITED
 *       example draft to the parent editor as unsaved draft edits
 *       (prefill bus); a settled stream capture renders the recorded
 *       interleave — "Response received" at `headAtMessage`, both
 *       directions kept, NO timestamps (the session-only law).
 *
 * Deliberately NOT here (covered elsewhere): the forwarded-posture
 * E-legs (grpc-forwarded.spec.ts), D-legs (desktop in-process), the
 * ⌘⇧↵/⌘⇧E chords (jsdom editor matrix), and generation-plan edge
 * cases (proto-collection-plan unit matrix).
 *
 * Requires builds: extension `dist/chrome` and
 * `pnpm turbo build --filter=@openheaders/daemon`.
 *
 * Seeding: the daemon boots once to mint its default workspace (MCP
 * write, the daemon-join recipe), then its storage.json gains the two
 * protobuf specs + a collection + two gRPC requests (built and
 * schema-validated by `fixtures/grpc-workbench-seed.ts` under tsx)
 * and the daemon reboots on them. The extension joins and the
 * entities replicate down the WS pipe; generation/save writes made in
 * the workbench land locally and up-sync the same pipe.
 */

import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import path from 'node:path';
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test';
import { WorkbenchPage } from './pages/workbench-page';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const EXT_ROOT = path.resolve(__dirname, '../..');
const EXTENSION_PATH = path.resolve(__dirname, '../../dist/chrome');
const DAEMON_MAIN = path.join(REPO_ROOT, 'apps/daemon/dist/main.js');
const electronBinary = createRequire(path.join(REPO_ROOT, 'packages/oracle-host-node/package.json'))(
  'electron',
) as string;

// Off every other suite's ports (daemon 8137/18137/18238/18337/18338-9/
// 18438/18537/19137/19237/19537-8/19737-8; gRPC probes 3130/3230).
const DAEMON_PORT = 18738;
const GRPC_PORT = 3330;
const MCP_URL = `http://127.0.0.1:${DAEMON_PORT}/mcp`;

const INITIALIZE_PARAMS = {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'openheaders-grpc-workbench-e2e', version: '0.0.0' },
};

const PROBE_URL = `127.0.0.1:${GRPC_PORT}`;

let daemon: ChildProcess | undefined;
let daemonExited: Promise<number | null> | undefined;
let probe: ChildProcess | undefined;
let dataDir: string;
let token: string;
let workspaceId: string;
let extensionContext: BrowserContext | undefined;
let extensionId: string;
let workbench: WorkbenchPage;
let page: Page;
const daemonLog: string[] = [];

async function rpc(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  expect(response.status).toBe(200);
  return (await response.json()) as Record<string, unknown>;
}

async function callTool(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const json = await rpc('tools/call', { name, arguments: args });
  const result = json.result as { isError?: boolean; content: Array<{ text: string }> };
  expect(result.isError, result.content[0]?.text).toBeFalsy();
  return JSON.parse(result.content[0]?.text ?? '{}') as Record<string, unknown>;
}

function spawnDaemon(): void {
  daemon = spawn(
    electronBinary,
    [DAEMON_MAIN, '--data-dir', dataDir, '--bind-address', '127.0.0.1', '--bind-port', String(DAEMON_PORT)],
    { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } },
  );
  for (const stream of [daemon.stdout, daemon.stderr]) {
    stream?.on('data', (chunk: Buffer) => daemonLog.push(chunk.toString()));
  }
  const child = daemon;
  daemonExited = new Promise((resolve) => child.once('exit', (code) => resolve(code)));
}

async function waitDaemonHealthy(): Promise<void> {
  await expect
    .poll(
      async () => {
        try {
          return (await fetch(`http://127.0.0.1:${DAEMON_PORT}/healthz`)).status;
        } catch {
          return 0;
        }
      },
      { timeout: 30000 },
    )
    .toBe(200);
}

async function stopDaemon(): Promise<void> {
  if (daemon && daemon.exitCode === null) {
    daemon.kill('SIGTERM');
    await daemonExited;
  }
  daemon = undefined;
}

// ── Workbench readbacks + gRPC editor locators (visible-scoped —
//    background tabs stay mounted) ──────────────────────────────────

interface SlotEntity {
  uid: string;
  name: string;
  path: string;
}

/** Read a replicated `oh.ws.<id>.<slot>` entity array from the
 *  workbench page's own storage realm. */
async function wsSlot(slot: string): Promise<SlotEntity[]> {
  return page.evaluate(
    async ({ wsId, slotName }: { wsId: string; slotName: string }) =>
      new Promise<SlotEntity[]>((resolve) => {
        chrome.storage.local.get(`oh.ws.${wsId}.${slotName}`, (items) => {
          resolve((items[`oh.ws.${wsId}.${slotName}`] ?? []) as SlotEntity[]);
        });
      }),
    { wsId: workspaceId, slotName: slot },
  );
}

function invokeButton() {
  return page.getByTestId('grpc-invoke-button').filter({ visible: true }).first();
}

function statusTag() {
  return page.getByTestId('grpc-status-tag').filter({ visible: true }).first();
}

function timelineMessageRows() {
  return page.getByTestId('grpc-timeline-message-row').filter({ visible: true });
}

async function openWorkbenchViews(): Promise<void> {
  await workbench.showRequestsView();
  await workbench.collapseDocsPanel();
}

async function openGrpcRequest(uid: string, collectionUid = 'e2ecol01'): Promise<void> {
  const row = page.locator(`[data-item-id="grpc-request-${uid}"]`);
  if (!(await row.isVisible().catch(() => false))) {
    const collection = page.locator(`[data-item-id="req-col-${collectionUid}"]`);
    await collection.waitFor({ state: 'visible', timeout: 10000 });
    await collection.click();
  }
  await row.waitFor({ state: 'visible', timeout: 5000 });
  await row.click();
  await invokeButton().waitFor({ state: 'visible', timeout: 10000 });
}

/** Expand the SPECS sidebar section and open a spec's editor tab. */
async function openSpec(specUid: string): Promise<void> {
  const header = page.getByRole('button', { name: /SPECS/ }).filter({ visible: true }).first();
  await header.waitFor({ state: 'visible', timeout: 10000 });
  if ((await header.getAttribute('aria-expanded')) !== 'true') {
    await header.click();
  }
  const row = page.locator(`[data-item-id="spec-${specUid}"]`);
  await row.waitFor({ state: 'visible', timeout: 10000 });
  await row.click();
}

/** Wait until the live invoke gate settles on the expected enablement. */
async function waitInvokeEnabled(enabled: boolean): Promise<void> {
  await expect.poll(async () => invokeButton().isEnabled(), { timeout: 30000 }).toBe(enabled);
}

async function invokeAndAwaitOk(): Promise<void> {
  await waitInvokeEnabled(true);
  // The first invoke can race the WS join settling — retry on a
  // degraded snapshot (the grpc-forwarded recipe).
  await expect
    .poll(
      async () => {
        await invokeButton().click();
        const ok = await statusTag()
          .filter({ hasText: '0 OK' })
          .isVisible()
          .catch(() => false);
        if (ok) return true;
        await page.waitForTimeout(2000);
        return statusTag()
          .filter({ hasText: '0 OK' })
          .isVisible()
          .catch(() => false);
      },
      { timeout: 60000 },
    )
    .toBe(true);
}

/** The active editor's Save button (dirty state); flips to "Saved". */
function saveButton() {
  return page.getByRole('button', { name: /Save$/ }).filter({ visible: true }).first();
}

async function saveAndSettle(): Promise<void> {
  await saveButton().click();
  await page
    .getByRole('button', { name: /Saved$/ })
    .filter({ visible: true })
    .first()
    .waitFor({ state: 'visible', timeout: 10000 });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  // Real probe on its own port — a tsx child because the probe imports
  // core TS source the Playwright loader can't resolve in-process.
  probe = spawn('pnpm', ['exec', 'tsx', path.join(__dirname, 'fixtures/grpc-probe-launch.ts')], {
    cwd: EXT_ROOT,
    env: { ...process.env, OH_E2E_GRPC_PORT: String(GRPC_PORT) },
  });
  const probeReady = new Promise<void>((resolve, reject) => {
    probe?.stdout?.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes('grpc-probe-ready')) resolve();
    });
    probe?.once('exit', (code) => reject(new Error(`grpc probe exited early (${code})`)));
  });
  await probeReady;

  // Offline admin bootstrap — the daemon-join recipe. Peer execute is
  // ON from boot: the refusal posture is grpc-forwarded's leg.
  dataDir = await mkdtemp(path.join(os.tmpdir(), 'oh-grpc-wb-e2e-'));
  token = `oh_${randomBytes(32).toString('base64url')}`;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await writeFile(
    path.join(dataDir, 'storage.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: {
        'oh.settings.user': { 'mcp.enabled': true, 'mcp.allowWrite': true, 'backend.allowPeerExecute': true },
        'oh.daemonAuthTokens': [
          {
            id: 'grpc-wb-e2e-token',
            tokenHash,
            label: 'grpc workbench e2e',
            createdAt: Date.now(),
            lastUsedAt: null,
            revokedAt: null,
          },
        ],
      },
      secrets: {},
    }),
  );
});

test.afterAll(async () => {
  await extensionContext?.close();
  await stopDaemon();
  if (probe && probe.exitCode === null) probe.kill('SIGTERM');
  if (test.info().status !== test.info().expectedStatus) {
    console.log(`daemon log:\n${daemonLog.join('')}`);
  }
});

// ── Boot + seed ─────────────────────────────────────────────────────

test('the daemon mints its workspace and reboots on the seeded gRPC entities', async () => {
  spawnDaemon();
  await waitDaemonHealthy();

  // Force the default workspace into existence (MCP write — the
  // daemon-join recipe), then learn its identity.
  await rpc('initialize', INITIALIZE_PARAMS);
  await callTool('rules_create', {
    rule: {
      name: 'gRPC workbench e2e marker rule',
      type: 'header',
      enabled: false,
      published: false,
      conditions: [{ type: 'url-filter', values: ['https://api.openheaders.io/*'] }],
      action: {
        requestHeaders: [{ operation: 'override', headerName: 'X-Grpc-Wb-E2E', value: 'marker' }],
        responseHeaders: [],
      },
    },
  });
  const workspaces = await callTool('workspaces_list', {});
  const first = (workspaces.workspaces as Array<{ id: string }>)[0];
  expect(first).toBeTruthy();
  workspaceId = first.id;

  // Seed the workspace slots with schema-validated entities and reboot.
  await stopDaemon();
  const seeded = spawnSync('pnpm', ['exec', 'tsx', path.join(__dirname, 'fixtures/grpc-workbench-seed.ts')], {
    cwd: EXT_ROOT,
    env: {
      ...process.env,
      OH_E2E_GRPC_PORT: String(GRPC_PORT),
      OH_E2E_WORKSPACE_ID: workspaceId,
    },
    encoding: 'utf-8',
  });
  expect(seeded.status, seeded.stderr).toBe(0);
  const storagePath = path.join(dataDir, 'storage.json');
  const envelope = JSON.parse(await readFile(storagePath, 'utf-8')) as { values: Record<string, unknown> };
  Object.assign(envelope.values, JSON.parse(seeded.stdout) as Record<string, unknown>);
  await writeFile(storagePath, JSON.stringify(envelope));
  spawnDaemon();
  await waitDaemonHealthy();
});

test('the extension joins and the gRPC entities replicate down', async () => {
  test.setTimeout(150000);
  extensionContext = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`, '--no-sandbox'],
  });
  const bootWorker = extensionContext.serviceWorkers()[0] ?? (await extensionContext.waitForEvent('serviceworker'));
  extensionId = bootWorker.url().split('/')[2];

  await bootWorker.evaluate(
    async () =>
      new Promise<void>((resolve) => {
        chrome.storage.local.set({ onboardingCompleted: true }, () => resolve());
      }),
  );

  // Keep a client page attached so the MV3 SW never idles out mid-test.
  const popup = await extensionContext.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);

  // Point the extension at the daemon — the daemon-join seed recipe
  // (registry record encrypted with the SW's own at-rest key; the SW
  // can restart between acquire and evaluate, so retry).
  const seedBackend = async (): Promise<void> => {
    const worker = extensionContext?.serviceWorkers().at(-1) ?? (await extensionContext?.waitForEvent('serviceworker'));
    if (!worker) throw new Error('no extension service worker');
    await worker.evaluate(
      async ({ backendUrl, authToken }: { backendUrl: string; authToken: string }) => {
        const key = await new Promise<CryptoKey>((resolve, reject) => {
          const open = indexedDB.open('oh-secret-cipher', 1);
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const db = open.result;
            const request = db.transaction('keys', 'readonly').objectStore('keys').get('at-rest-aes-gcm-v1');
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result as CryptoKey);
          };
        });
        const record = {
          id: 'grpc-wb-e2e-backend',
          label: 'grpc workbench e2e daemon',
          url: backendUrl,
          authToken,
          autoConnect: true,
          enabled: true,
          addedAt: new Date().toISOString(),
          lastConnectedAt: null,
        };
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ciphertext = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv },
          key,
          new TextEncoder().encode(JSON.stringify([record])),
        );
        const packed = new Uint8Array(iv.length + ciphertext.byteLength);
        packed.set(iv, 0);
        packed.set(new Uint8Array(ciphertext), iv.length);
        let binary = '';
        for (const byte of packed) binary += String.fromCharCode(byte);
        await new Promise<void>((resolve) => {
          chrome.storage.local.set({ onboardingCompleted: true, 'oh.backends': `v1:${btoa(binary)}` }, () => resolve());
        });
      },
      { backendUrl: `ws://127.0.0.1:${DAEMON_PORT}`, authToken: token },
    );
  };
  let seedError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await seedBackend();
      seedError = undefined;
      break;
    } catch (err) {
      seedError = err;
      await popup.waitForTimeout(1000);
    }
  }
  expect(seedError, String(seedError)).toBeUndefined();

  const replicated = async (): Promise<boolean> => {
    const worker = extensionContext?.serviceWorkers().at(-1);
    if (!worker) return false;
    return worker.evaluate(
      async (wsId: string) =>
        new Promise<boolean>((resolve) => {
          chrome.storage.local.get(null, (items) => {
            resolve(
              JSON.stringify(items[`oh.ws.${wsId}.grpcRequests`] ?? '').includes('e2egrpc1') &&
                JSON.stringify(items[`oh.ws.${wsId}.specs`] ?? '').includes('e2espec2'),
            );
          });
        }),
      workspaceId,
    );
  };
  await expect
    .poll(replicated, {
      timeout: 45000,
      message: 'the seeded gRPC entities never replicated — the extension did not join the WS backend',
    })
    .toBe(true);
});

test('the workbench opens on the joined workspace', async () => {
  if (!extensionContext) throw new Error('extension context missing');
  page = await extensionContext.newPage();

  // Pin the tab to the daemon workspace via the URL hash — the per-tab
  // binding contract (`#/ws/<wsId>`), deterministic where driving the
  // switcher dropdown is not (the daemon's default workspace shares the
  // local one's name).
  await page.goto(`chrome-extension://${extensionId}/workbench.html#/ws/${workspaceId}`);
  await page.waitForFunction(
    () => {
      const root = document.getElementById('root');
      return root !== null && root.children.length > 0;
    },
    { timeout: 15000 },
  );
  workbench = new WorkbenchPage(page);
  await openWorkbenchViews();
  await page.locator('[data-item-id="req-col-e2ecol01"]').waitFor({ state: 'visible', timeout: 15000 });
});

// ── G3: Docs tab round-trip ─────────────────────────────────────────

test('Docs: written markdown saves and reopens in Preview after a reload', async () => {
  await openGrpcRequest('e2egrpc1');
  await page.getByRole('tab', { name: 'Docs' }).filter({ visible: true }).first().click();

  // Empty docs open in Write mode — the read-first law's other half.
  await expect(page.locator('.ant-segmented-item-selected').filter({ visible: true }).first()).toHaveText('Write');
  await workbench.fillMonaco(0, '# E2E gRPC probe notes');
  await saveAndSettle();

  // A reload discards session state — the persisted description is
  // what the reopened tab renders, and it lands in Preview.
  await workbench.reload();
  await openWorkbenchViews();
  await openGrpcRequest('e2egrpc1');
  await page.getByRole('tab', { name: 'Docs' }).filter({ visible: true }).first().click();
  await expect(page.locator('.ant-segmented-item-selected').filter({ visible: true }).first()).toHaveText('Preview');
  await expect(
    page.getByRole('heading', { name: 'E2E gRPC probe notes' }).filter({ visible: true }).first(),
  ).toBeVisible();
});

test('Docs: cleared markdown saves and reopens in Write', async () => {
  await page.locator('.ant-segmented-item').filter({ hasText: 'Write' }).filter({ visible: true }).first().click();
  await workbench.fillMonaco(0, '');
  await saveAndSettle();

  await workbench.reload();
  await openWorkbenchViews();
  await openGrpcRequest('e2egrpc1');
  await page.getByRole('tab', { name: 'Docs' }).filter({ visible: true }).first().click();
  await expect(page.locator('.ant-segmented-item-selected').filter({ visible: true }).first()).toHaveText('Write');
});

// ── G1: generation — single service lands flat ──────────────────────

test('Generate Collection on the single-service spec lands flat with pre-filled examples', async () => {
  await openSpec('e2espec1');
  await page.getByTestId('spec-generate-collection').filter({ visible: true }).first().click();
  const nameInput = page.getByTestId('spec-generate-name').filter({ visible: true }).first();
  await expect(nameInput).toHaveValue('BookService');
  await page.getByTestId('spec-generate-confirm').filter({ visible: true }).first().click();

  // One request per rpc: the 5 generated join the 2 seeded.
  await expect.poll(async () => (await wsSlot('grpcRequests')).length, { timeout: 15000 }).toBe(7);
  const requests = await wsSlot('grpcRequests');
  const generated = requests.filter((r) => r.uid !== 'e2egrpc1' && r.uid !== 'e2egrpc2');
  expect(new Set(generated.map((r) => r.name))).toEqual(
    new Set(['GetBook', 'DelayedBook', 'WatchBooks', 'UploadBooks', 'Chat']),
  );

  // Flat landing: every generated request is a DIRECT child of the
  // collection — no service folder for a single-service spec.
  const collections = await wsSlot('requestCollections');
  const generatedCol = collections.find((c) => c.name === 'BookService');
  expect(generatedCol).toBeTruthy();
  const colPath = (generatedCol as SlotEntity).path;
  for (const r of generated) {
    expect(r.path.startsWith(`${colPath}/`)).toBe(true);
    expect(r.path.slice(colPath.length + 1).includes('/')).toBe(false);
  }

  // Sidebar: the collection expands to gRPC leaves, no folder rows.
  const colRow = page.locator(`[data-item-id="req-col-${(generatedCol as SlotEntity).uid}"]`);
  await colRow.waitFor({ state: 'visible', timeout: 10000 });
  await colRow.click();
  const genGetBook = generated.find((r) => r.name === 'GetBook') as SlotEntity;
  await page.locator(`[data-item-id="grpc-request-${genGetBook.uid}"]`).waitFor({ state: 'visible', timeout: 10000 });
  expect(await page.locator('[data-item-id^="req-folder-"]').filter({ visible: true }).count()).toBe(0);

  // The example message pre-fill: field-aware synthesis echoes the
  // field's JSON name.
  await openGrpcRequest(genGetBook.uid, (generatedCol as SlotEntity).uid);
  expect(await workbench.monacoText(0)).toContain('"name": "name"');
});

// ── G2: a generated request invokes against the probe ───────────────

test('a generated request invokes with only the authority filled', async () => {
  // Still on the generated GetBook tab. The seed factory defaults are
  // url '' + TLS on; the probe is plaintext h2c.
  await page.getByTestId('grpc-url-input').filter({ visible: true }).first().fill(PROBE_URL);
  await page.getByLabel('TLS on — click to switch to plaintext').filter({ visible: true }).first().click();
  await invokeAndAwaitOk();
  const responsePane = page.getByTestId('grpc-response-pane').filter({ visible: true }).first();
  await expect(responsePane).toContainText('The Open Headers Field Guide');
});

// ── G1: Collections popover + drift badge ───────────────────────────

test('the Collections popover lists the link in sync; Update is disabled with the proto tooltip', async () => {
  await openSpec('e2espec1');
  await page.getByTestId('spec-collections-popover').filter({ visible: true }).first().click();
  await page
    .locator('[data-testid^="spec-link-in-sync-"]')
    .filter({ visible: true })
    .first()
    .waitFor({ state: 'visible', timeout: 10000 });

  const updateButton = page.locator('[data-testid^="spec-link-update-"]').filter({ visible: true }).first();
  await expect(updateButton).toBeDisabled();
  await updateButton.hover();
  await page
    .locator('.ant-tooltip')
    .filter({ visible: true })
    .getByText(/Updating from a Protobuf spec is not available yet/)
    .first()
    .waitFor({ state: 'visible', timeout: 10000 });

  // Inside clicks keep the popover open; re-clicking the trigger
  // closes it (the toolbar-popover law).
  await page.getByTestId('spec-collections-popover').filter({ visible: true }).first().click();
});

test('editing and saving the spec flips the drift badge', async () => {
  // Append a comment to the buffer — content change, still parseable.
  const editor = page.locator('.monaco-editor').filter({ visible: true }).first();
  await editor.click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+ArrowDown' : 'Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.insertText('// e2e drift marker');
  await saveAndSettle();

  await page.getByTestId('spec-collections-popover').filter({ visible: true }).first().click();
  await page
    .locator('[data-testid^="spec-link-drifted-"]')
    .filter({ visible: true })
    .first()
    .waitFor({ state: 'visible', timeout: 10000 });
  await page.getByTestId('spec-collections-popover').filter({ visible: true }).first().click();
});

// ── G1: generation — two services folder per service ────────────────

test('Generate Collection on the two-service spec folders per service full name', async () => {
  await openSpec('e2espec2');
  await page.getByTestId('spec-generate-collection').filter({ visible: true }).first().click();
  const nameInput = page.getByTestId('spec-generate-name').filter({ visible: true }).first();
  await expect(nameInput).toHaveValue('ShelfSuite');
  await page.getByTestId('spec-generate-confirm').filter({ visible: true }).first().click();

  await expect.poll(async () => (await wsSlot('grpcRequests')).length, { timeout: 15000 }).toBe(9);

  const collections = await wsSlot('requestCollections');
  const shelfCol = collections.find((c) => c.name === 'ShelfSuite') as SlotEntity;
  expect(shelfCol).toBeTruthy();
  const colRow = page.locator(`[data-item-id="req-col-${shelfCol.uid}"]`);
  await colRow.waitFor({ state: 'visible', timeout: 10000 });
  await colRow.click();

  const folderRows = page.locator('[data-item-id^="req-folder-"]').filter({ visible: true });
  await expect.poll(async () => folderRows.count(), { timeout: 10000 }).toBe(2);
  await expect(folderRows.filter({ hasText: 'openheaders.e2e.LibraryService' }).first()).toBeVisible();
  await expect(folderRows.filter({ hasText: 'openheaders.e2e.ShelfService' }).first()).toBeVisible();

  // Leaves live INSIDE the folders.
  await folderRows.filter({ hasText: 'openheaders.e2e.LibraryService' }).first().click();
  const requests = await wsSlot('grpcRequests');
  const getShelf = requests.find((r) => r.name === 'GetShelf') as SlotEntity;
  expect(getShelf).toBeTruthy();
  await page.locator(`[data-item-id="grpc-request-${getShelf.uid}"]`).waitFor({ state: 'visible', timeout: 10000 });
});

// ── Save Response: unary capture + viewer + prefill hand-off ────────

test('Save Response freezes a unary result; the viewer opens and lands a sidebar leaf', async () => {
  await openGrpcRequest('e2egrpc1');
  await invokeAndAwaitOk();
  await page.getByTestId('grpc-save-response').filter({ visible: true }).first().click();
  await page
    .locator('.ant-message')
    .getByText(/Saved example/)
    .first()
    .waitFor({ state: 'visible', timeout: 10000 });

  // The viewer tab auto-opens on the captured facts.
  const examplePane = page.getByTestId('grpc-example-result-pane').filter({ visible: true }).first();
  await examplePane.waitFor({ state: 'visible', timeout: 10000 });
  await expect(examplePane).toContainText('The Open Headers Field Guide');
  await expect(page.getByTestId('grpc-example-method').filter({ visible: true }).first()).toHaveText(
    'BookService / GetBook',
  );

  // The example leaf nests under the request row.
  await page
    .locator('[data-item-id^="grpc-example-"]')
    .filter({ visible: true })
    .first()
    .waitFor({ state: 'visible', timeout: 10000 });
});

test('"Open in Request" hands the EDITED example draft to the parent editor', async () => {
  // Edit the captured url in the viewer draft — the hand-off must
  // carry the draft, not the persisted capture.
  const exampleUrl = page.getByTestId('grpc-example-url-input').filter({ visible: true }).first();
  await exampleUrl.fill('127.0.0.1:65530');
  await page.getByTestId('grpc-example-open-in-request').filter({ visible: true }).first().click();

  // The parent gRPC editor activates with the prefilled draft.
  const parentUrl = page.getByTestId('grpc-url-input').filter({ visible: true }).first();
  await expect(parentUrl).toHaveValue('127.0.0.1:65530');

  // Restore the probe target — the draft returns to canonical.
  await parentUrl.fill(PROBE_URL);
});

// ── Save Response: settled stream capture — recorded interleave ─────

test('a settled stream capture renders the recorded interleave without timestamps', async () => {
  await openGrpcRequest('e2egrpc2');
  await waitInvokeEnabled(true);
  await invokeButton().click();
  // The ↑ composed request frame plus three ↓ books, then settle.
  await expect.poll(async () => timelineMessageRows().count(), { timeout: 20000 }).toBe(4);
  await statusTag().filter({ hasText: '0 OK' }).waitFor({ state: 'visible', timeout: 15000 });

  // The e.g. chip appears only once the snapshot settles.
  await page.getByTestId('grpc-save-response').filter({ visible: true }).first().click();
  await page
    .locator('.ant-message')
    .getByText(/Saved example/)
    .first()
    .waitFor({ state: 'visible', timeout: 10000 });

  const examplePane = page.getByTestId('grpc-example-result-pane').filter({ visible: true }).first();
  await examplePane.waitFor({ state: 'visible', timeout: 10000 });

  // Both directions captured, no session timestamps (the session-only
  // law — a reopened capture shows messages without times).
  await expect
    .poll(async () => examplePane.getByTestId('grpc-timeline-message-row').count(), { timeout: 10000 })
    .toBe(4);
  expect(await examplePane.getByTestId('grpc-timeline-message-time').count()).toBe(0);

  // Recorded head position: `headAtMessage` = 1 (the composed ↑
  // request preceded the response head in call order). Newest-first
  // default renders the log reversed: ended, ↓×3, head, ↑, sent.
  const rows = examplePane.locator(
    '[data-testid="grpc-timeline-sent-row"], [data-testid="grpc-timeline-connected-row"], ' +
      '[data-testid="grpc-timeline-ended-row"], [data-testid="grpc-timeline-message-row"]',
  );
  const sequence = await rows.evaluateAll((els) =>
    els.map((el) => {
      const id = el.getAttribute('data-testid') ?? '';
      if (id !== 'grpc-timeline-message-row') return id.replace('grpc-timeline-', '').replace('-row', '');
      return el.querySelector('.anticon-arrow-up') !== null ? 'up' : 'down';
    }),
  );
  expect(sequence).toEqual(['ended', 'down', 'down', 'down', 'connected', 'up', 'sent']);
});
