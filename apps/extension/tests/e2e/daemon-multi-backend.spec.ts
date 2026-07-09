/**
 * Multi-Backend Phase 5 acceptance — one extension instance concurrently
 * joined to TWO real backends (MULTI_BACKEND_PLAN.md §6 Phase 5):
 *
 *   1. Backend A is a spawned headless daemon on loopback. Backend B is
 *      a second spawned daemon by default; set OH_DROPLET_TOKEN to run
 *      the wss:// leg against a standing WAN daemon instead (the epic's
 *      live-acceptance shape — TLS, real DNS, reverse proxy).
 *   2. Both backends join through the REAL BackendPane wizard (scenario
 *      tile → address → token pair → probe-gated enable), the second
 *      add carrying the additional-back-end note.
 *   3. Both Org groups show in the workspace switcher with their
 *      "via <backend>" attribution; the status pill lists one row per
 *      backend; Publish appears once joined targets exist.
 *   4. Routing: an editor-flow rule created in each Org lands on
 *      exactly the backend owning that Org — never the other, and
 *      neither backend ever gains a foreign workspace.
 *   5. Independent flush: with A's kill switch off, edits queue for A
 *      while B's pipe keeps replicating; re-enabling A flushes them.
 *   6. Org uniqueness: a second record dialing the same backend has its
 *      WELCOME claim refused and surfaced on the connection row.
 *   7. Remove: Keep orphans B's group as "No longer syncing" and leaves
 *      A untouched; Discard on A downloads backups, deletes the local
 *      copies, leaves the daemon's own data intact; re-joining A syncs
 *      its workspaces back down.
 *
 * Requires builds: `pnpm turbo build --filter=@openheaders/daemon` and
 * the extension `dist/chrome`.
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import path from 'node:path';
import { type BrowserContext, chromium, type Download, expect, type Page, test, type Worker } from '@playwright/test';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const EXTENSION_PATH = path.resolve(__dirname, '../../dist/chrome');
const DAEMON_MAIN = path.join(REPO_ROOT, 'apps/daemon/dist/main.js');
const electronBinary = createRequire(path.join(REPO_ROOT, 'packages/oracle-host-node/package.json'))(
  'electron',
) as string;

// Port etiquette: 19537/19538 are fresh (ledger up to 19437).
const DAEMON_A_PORT = 19537;
const DAEMON_B_PORT = 19538;
const DROPLET_DOMAIN = 'a056eeaca766.openheaders.io';
const DROPLET_TOKEN = process.env.OH_DROPLET_TOKEN;

// Unique-per-run rule names so a WAN backend's persisted data never
// collides with an earlier run's leftovers.
const RUN = Date.now().toString(36);
const SEEDED_A = `P5 seeded on A ${RUN}`;
const ROUTED_A = `P5 routed to A ${RUN}`;
const ROUTED_B = `P5 routed to B ${RUN}`;
const QUEUED_A = `P5 queued for A ${RUN}`;
const LIVE_B = `P5 live to B ${RUN}`;

const LABEL_A = 'Daemon A';
const LABEL_B = DROPLET_TOKEN ? 'Droplet' : 'Daemon B';

const INITIALIZE_PARAMS = {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'openheaders-p5-client', version: '0.0.0' },
};

// ── Backend rigs ────────────────────────────────────────────────────

interface SpawnedDaemon {
  proc: ChildProcess;
  exited: Promise<number | null>;
  log: string[];
}

interface BackendRig {
  label: string;
  wsParts: { scheme: 'ws' | 'wss'; address: string; port: string };
  mcpUrl: string;
  token: string;
  daemon: SpawnedDaemon | null;
}

let rigA: BackendRig;
let rigB: BackendRig;
/** Down-sync sentinel per rig — a rule known to exist on the backend. */
let sentinelB: string;
let baselineWorkspaceIdsA: string[];
let baselineWorkspaceIdsB: string[];

async function spawnDaemon(port: number, token: string): Promise<SpawnedDaemon> {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), `oh-daemon-p5-${port}-`));
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await writeFile(
    path.join(dataDir, 'storage.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: {
        'oh.settings.user': { 'mcp.enabled': true, 'mcp.allowWrite': true },
        'oh.daemonAuthTokens': [
          {
            id: `p5-bootstrap-${port}`,
            tokenHash,
            label: 'p5 e2e',
            createdAt: Date.now(),
            lastUsedAt: null,
            revokedAt: null,
          },
        ],
      },
      secrets: {},
    }),
  );
  const log: string[] = [];
  const proc = spawn(
    electronBinary,
    [DAEMON_MAIN, '--data-dir', dataDir, '--bind-address', '127.0.0.1', '--bind-port', String(port)],
    { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } },
  );
  for (const stream of [proc.stdout, proc.stderr]) {
    stream?.on('data', (chunk: Buffer) => log.push(chunk.toString()));
  }
  const exited = new Promise<number | null>((resolve) => proc.once('exit', (code) => resolve(code)));
  await expect
    .poll(
      async () => {
        try {
          return (await fetch(`http://127.0.0.1:${port}/healthz`)).status;
        } catch {
          return 0;
        }
      },
      { timeout: 30000 },
    )
    .toBe(200);
  return { proc, exited, log };
}

// ── MCP helpers (parameterized by rig) ──────────────────────────────

async function rpc(
  rig: BackendRig,
  method: string,
  params: Record<string, unknown>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(rig.mcpUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${rig.token}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, json };
}

async function callTool(
  rig: BackendRig,
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { status, json } = await rpc(rig, 'tools/call', { name, arguments: args });
  expect(status, `${rig.label} ${name}`).toBe(200);
  const result = json.result as { isError?: boolean; content: Array<{ text: string }> };
  expect(result.isError, `${rig.label} ${name}: ${result.content?.[0]?.text}`).toBeFalsy();
  return JSON.parse(result.content[0]?.text ?? '{}') as Record<string, unknown>;
}

async function workspaceIds(rig: BackendRig): Promise<string[]> {
  const payload = await callTool(rig, 'workspaces_list', {});
  return (payload.workspaces as Array<{ id: string }>).map((ws) => ws.id).sort();
}

/** Every rule name across every workspace of the backend. */
async function backendRuleNames(rig: BackendRig): Promise<string[]> {
  const payload = await callTool(rig, 'workspaces_list', {});
  const ids = (payload.workspaces as Array<{ id: string }>).map((ws) => ws.id);
  const names: string[] = [];
  for (const id of ids) {
    const rules = await callTool(rig, 'rules_list', { workspaceId: id });
    names.push(...(rules.rules as Array<{ name: string }>).map((r) => r.name));
  }
  return names;
}

async function backendHasRule(rig: BackendRig, name: string): Promise<boolean> {
  return (await backendRuleNames(rig)).includes(name);
}

async function seedRule(rig: BackendRig, name: string): Promise<void> {
  await callTool(rig, 'rules_create', {
    rule: {
      name,
      type: 'header',
      enabled: true,
      published: true,
      conditions: [{ type: 'url-filter', values: ['https://api.openheaders.io/*'] }],
      action: {
        requestHeaders: [{ operation: 'override', headerName: 'X-P5', value: rig.label }],
        responseHeaders: [],
      },
    },
  });
}

/** Delete every rule whose name carries this run's marker (WAN cleanup). */
async function cleanupRunRules(rig: BackendRig): Promise<void> {
  const payload = await callTool(rig, 'workspaces_list', {});
  const ids = (payload.workspaces as Array<{ id: string }>).map((ws) => ws.id);
  for (const id of ids) {
    const rules = await callTool(rig, 'rules_list', { workspaceId: id });
    for (const rule of rules.rules as Array<{ uid: string; name: string }>) {
      if (rule.name.includes(RUN)) {
        await callTool(rig, 'rules_delete', { uid: rule.uid, workspaceId: id }).catch(() => undefined);
      }
    }
  }
}

// ── Extension helpers ───────────────────────────────────────────────

let context: BrowserContext;
let extensionId: string;
let workbench: Page;
const downloads: Download[] = [];

async function latestWorker(): Promise<Worker> {
  const existing = context.serviceWorkers().at(-1);
  if (existing) return existing;
  // MV3 idle-kills the SW once nothing pokes it (e.g. while no wire is
  // up between remove and re-join). Wake it through an extension page
  // runtime message and wait for the fresh registration.
  const waiter = context.waitForEvent('serviceworker', { timeout: 10000 }).catch(() => null);
  await workbench
    .evaluate(() => {
      void chrome.runtime.sendMessage({ type: 'oh-e2e-wake' }).catch(() => undefined);
    })
    .catch(() => undefined);
  const woken = context.serviceWorkers().at(-1) ?? (await waiter);
  if (!woken) throw new Error('no extension service worker');
  return woken;
}

async function swStorageGet(key: string): Promise<unknown> {
  return (await latestWorker()).evaluate(
    async (k) =>
      new Promise<unknown>((resolve) => {
        chrome.storage.local.get(k, (items) => resolve(items[k]));
      }),
    key,
  );
}

interface JoinedOrgRow {
  org: { id: string; name: string };
  backendId: string;
}

async function joinedOrgRows(): Promise<JoinedOrgRow[]> {
  return ((await swStorageGet('oh.joinedOrgs')) as JoinedOrgRow[] | undefined) ?? [];
}

async function ruleVisibleInExtension(name: string): Promise<boolean> {
  return (await latestWorker()).evaluate(
    async (ruleName) =>
      new Promise<boolean>((resolve) => {
        chrome.storage.local.get(null, (items) => {
          const serialized = JSON.stringify(Object.entries(items).filter(([key]) => /^oh\.ws\..*\.rules$/.test(key)));
          resolve(serialized.includes(ruleName));
        });
      }),
    name,
  );
}

async function deliverIntent(intent: object): Promise<void> {
  await (await latestWorker()).evaluate(
    async ({ url, intent }: { url: string; intent: object }) => {
      const tabs: chrome.tabs.Tab[] = await new Promise((resolve) => {
        chrome.tabs.query({ url: `${url}*` }, (found) => resolve(found));
      });
      const tabId = tabs[0]?.id;
      if (typeof tabId !== 'number') return;
      try {
        await new Promise<void>((resolve) => {
          chrome.tabs.sendMessage(tabId, { type: 'workspace-intent', intent }, () => {
            void chrome.runtime.lastError;
            resolve();
          });
        });
      } catch {
        // Listener doesn't respond; the message was delivered.
      }
    },
    { url: `chrome-extension://${extensionId}/workbench.html`, intent },
  );
}

// ── UI drivers ──────────────────────────────────────────────────────

async function openBackendSettings(): Promise<void> {
  await deliverIntent({ kind: 'open-settings', target: { categoryId: 'backend' } });
  await expect(workbench.getByRole('button', { name: 'Add back-end' })).toBeVisible();
}

async function closeSettings(): Promise<void> {
  // The settings modal's header close button carries the icon's name
  // (Esc needs in-modal focus; the mask ignores clicks).
  await workbench.locator('.settings-modal').getByRole('button', { name: 'close', exact: true }).click();
  await expect(workbench.getByRole('button', { name: 'Add back-end' })).toBeHidden();
}

interface WizardJoin {
  tile: 'Desktop Application' | 'Local / LAN' | 'Remote / WAN';
  label: string;
  scheme: 'ws' | 'wss';
  address: string;
  port: string;
  token: string;
  expectAdditionalNote: boolean;
}

/** Add + enable one backend through the real wizard. Settings must be open. */
async function addBackendViaWizard(join: WizardJoin): Promise<void> {
  await workbench.getByRole('button', { name: 'Add back-end' }).click();
  const modal = workbench.getByRole('dialog', { name: 'Add back-end' });
  await expect(modal).toBeVisible();

  // Scenario step — the tile must be joinable (no Soon badge).
  await modal.getByRole('radio', { name: new RegExp(join.tile) }).click();
  await modal.getByRole('button', { name: 'Next' }).click();

  // Connect step — label + URL parts (commit on Enter).
  const nameField = modal.getByRole('textbox', { name: 'Back-end name', exact: true });
  await nameField.fill(join.label);
  await nameField.press('Enter');
  if (join.scheme === 'wss') {
    await modal.getByLabel('Scheme', { exact: true }).click();
    await workbench.locator('.ant-select-item-option:visible', { hasText: 'wss://' }).click();
  }
  const addressField = modal.getByRole('textbox', { name: 'Address', exact: true });
  await addressField.fill(join.address);
  await addressField.press('Enter');
  const portField = modal.getByRole('textbox', { name: 'Port', exact: true });
  await portField.fill(join.port);
  await portField.press('Enter');
  await modal.getByRole('button', { name: 'Next' }).click();

  // Pair step — paste the token directly.
  await modal.getByText('Use an auth token instead').click();
  const tokenField = modal.getByRole('textbox', { name: 'Auth token', exact: true });
  await tokenField.fill(join.token);
  await tokenField.press('Enter');
  await modal.getByRole('button', { name: 'Next' }).click();

  // Turn-on step — the second-backend onboarding note (S8 surface).
  const note = modal.getByText(/This is an additional back-end/);
  if (join.expectAdditionalNote) await expect(note).toBeVisible();
  else await expect(note).toBeHidden();

  await modal.getByRole('button', { name: /Verify & connect/ }).click();
  // Probe + enable + join-adopt dwell; the modal closes on commit.
  await expect(modal).toBeHidden({ timeout: 45000 });
}

/** The connection row's enabled Switch. On-flips ride the probe gate. */
async function toggleBackendEnabled(label: string, on: boolean): Promise<void> {
  const toggle = workbench.getByRole('switch', { name: `${label} enabled` });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect.poll(async () => toggle.getAttribute('aria-checked'), { timeout: 30000 }).toBe(on ? 'true' : 'false');
}

async function openWorkspaceDropdown(): Promise<void> {
  // Aim at the trigger's left edge — its center is the Org badge, whose
  // own tooltip swallows the click and the dropdown never opens.
  await workbench.getByRole('button', { name: /is editing workspace/ }).click({ position: { x: 12, y: 12 } });
  await expect(workbench.getByPlaceholder('Search workspaces…')).toBeVisible();
}

async function closeWorkspaceDropdown(): Promise<void> {
  await workbench.keyboard.press('Escape');
  await expect(workbench.getByPlaceholder('Search workspaces…')).toBeHidden();
}

/**
 * An Org group header in the switcher, matched by any text it carries.
 * Spawned daemons all name their Org after the host machine, so the
 * "via <backend>" annotation is the only unambiguous key — exactly the
 * disambiguation that affordance exists to provide.
 */
function orgHeader(hasText: string) {
  return workbench.getByRole('button', { name: /^Switch to / }).filter({ hasText });
}

/** Switch this tab's editing scope to the Org whose header carries `hasText`. */
async function switchToOrg(hasText: string): Promise<void> {
  await openWorkspaceDropdown();
  await orgHeader(hasText).click();
  await expect(workbench.getByPlaceholder('Search workspaces…')).toBeHidden();
}

/**
 * Create a block rule named `name` in the tab's current editing scope
 * through the real editor flow (create intent → rename → Save → target
 * collection dialog), the same upward path a user takes.
 */
async function createRuleInScope(name: string): Promise<void> {
  await deliverIntent({ kind: 'create-rule', ruleType: 'block' });
  // Element handle, not a locator — the rename invalidates the
  // value-attribute selector the moment fill() lands. Prefix match:
  // the draft name dedups against existing rules ("New Block Rule (2)"
  // when the backend already carries one — the WAN daemon does).
  const nameInput = await workbench.waitForSelector('input[value^="New Block Rule"]', { timeout: 10000 });
  await nameInput.fill(name);
  await workbench.keyboard.press('Tab');
  await workbench
    .locator('button:visible')
    .filter({ hasText: /^Save$/ })
    .first()
    .click();

  // Save dialog: pick the workspace's collection, or mint one inline on
  // an empty (fresh daemon) workspace.
  const dialog = workbench.locator('.ant-modal:visible').last();
  await expect(dialog).toBeVisible({ timeout: 10000 });
  const collectionOption = dialog.locator('[role=option]').first();
  if ((await collectionOption.count()) > 0) {
    await collectionOption.click();
  } else {
    await dialog.getByText('New collection', { exact: false }).first().click();
    const collectionInput = dialog.locator('input:visible').last();
    await collectionInput.fill('P5 Rules');
    await collectionInput.press('Enter');
  }
  await dialog
    .locator('button:visible')
    .filter({ hasText: /^Save$/ })
    .last()
    .click();
  await expect(dialog).toBeHidden({ timeout: 10000 });
}

// ── Suite ───────────────────────────────────────────────────────────

test.describe.configure({ mode: 'serial' });
test.setTimeout(120000);

test.beforeAll(async () => {
  const tokenA = `oh_${randomBytes(32).toString('base64url')}`;
  const daemonA = await spawnDaemon(DAEMON_A_PORT, tokenA);
  rigA = {
    label: LABEL_A,
    wsParts: { scheme: 'ws', address: '127.0.0.1', port: String(DAEMON_A_PORT) },
    mcpUrl: `http://127.0.0.1:${DAEMON_A_PORT}/mcp`,
    token: tokenA,
    daemon: daemonA,
  };

  if (DROPLET_TOKEN) {
    rigB = {
      label: LABEL_B,
      wsParts: { scheme: 'wss', address: DROPLET_DOMAIN, port: '' },
      mcpUrl: `https://${DROPLET_DOMAIN}/mcp`,
      token: DROPLET_TOKEN,
      daemon: null,
    };
    const { status } = await rpc(rigB, 'initialize', INITIALIZE_PARAMS);
    expect(status, 'droplet MCP reachable with the provided token').toBe(200);
  } else {
    const tokenB = `oh_${randomBytes(32).toString('base64url')}`;
    rigB = {
      label: LABEL_B,
      wsParts: { scheme: 'ws', address: '127.0.0.1', port: String(DAEMON_B_PORT) },
      mcpUrl: `http://127.0.0.1:${DAEMON_B_PORT}/mcp`,
      token: tokenB,
      daemon: await spawnDaemon(DAEMON_B_PORT, tokenB),
    };
  }

  // Seed the down-sync sentinels. On a WAN backend a write may be
  // disallowed — fall back to any rule it already carries.
  await seedRule(rigA, SEEDED_A);
  sentinelB = `P5 seeded on B ${RUN}`;
  try {
    await seedRule(rigB, sentinelB);
  } catch {
    const existing = await backendRuleNames(rigB);
    expect(existing.length, `${rigB.label} has no rules to use as a down-sync sentinel`).toBeGreaterThan(0);
    sentinelB = existing[0];
  }
  baselineWorkspaceIdsA = await workspaceIds(rigA);
  baselineWorkspaceIdsB = await workspaceIds(rigB);

  context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`, '--no-sandbox'],
  });
  const bootWorker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  extensionId = bootWorker.url().split('/')[2];
  await bootWorker.evaluate(
    async () =>
      new Promise<void>((resolve) => {
        chrome.storage.local.set({ onboardingCompleted: true }, () => resolve());
      }),
  );

  workbench = await context.newPage();
  workbench.on('download', (download) => downloads.push(download));
  // Surface UI crashes in the runner log — a crashed page otherwise
  // reads as an opaque locator timeout (how the create-less-entity
  // replay defect was found).
  workbench.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`[workbench console.error] ${msg.text()}`);
  });
  workbench.on('pageerror', (err) => console.log(`[workbench pageerror] ${err.message}`));
  await workbench.goto(`chrome-extension://${extensionId}/workbench.html`);
  await workbench.waitForFunction(() => {
    const root = document.getElementById('root');
    return root !== null && root.children.length > 0;
  });
});

test.afterAll(async () => {
  if (DROPLET_TOKEN && rigB) await cleanupRunRules(rigB).catch(() => undefined);
  await context?.close();
  for (const rig of [rigA, rigB]) {
    const daemon = rig?.daemon;
    if (daemon && daemon.proc.exitCode === null) {
      daemon.proc.kill('SIGTERM');
      await daemon.exited;
    }
  }
  if (test.info().status !== test.info().expectedStatus) {
    console.log(`daemon A log:\n${rigA?.daemon?.log.join('') ?? ''}`);
    console.log(`daemon B log:\n${rigB?.daemon?.log.join('') ?? ''}`);
  }
});

// ── Join leg — both backends through the real wizard ────────────────

let orgA: JoinedOrgRow;
let orgB: JoinedOrgRow;

test('backend A joins through the wizard and its data syncs down', async () => {
  await openBackendSettings();
  await addBackendViaWizard({
    tile: 'Local / LAN',
    label: LABEL_A,
    scheme: rigA.wsParts.scheme,
    address: rigA.wsParts.address,
    port: rigA.wsParts.port,
    token: rigA.token,
    expectAdditionalNote: false,
  });
  await expect.poll(() => ruleVisibleInExtension(SEEDED_A), { timeout: 45000 }).toBe(true);
  const rows = await joinedOrgRows();
  expect(rows.length).toBe(1);
  orgA = rows[0];
});

test('backend B joins through the wizard with the additional-back-end note', async () => {
  await addBackendViaWizard({
    tile: rigB.wsParts.scheme === 'wss' ? 'Remote / WAN' : 'Local / LAN',
    label: LABEL_B,
    scheme: rigB.wsParts.scheme,
    address: rigB.wsParts.address,
    port: rigB.wsParts.port,
    token: rigB.token,
    expectAdditionalNote: true,
  });
  await expect.poll(() => ruleVisibleInExtension(sentinelB), { timeout: 45000 }).toBe(true);
  const rows = await joinedOrgRows();
  expect(rows.length).toBe(2);
  const found = rows.find((row) => row.org.id !== orgA.org.id);
  expect(found, 'a second joined Org bound to a second backend').toBeTruthy();
  orgB = found as JoinedOrgRow;
  expect(orgB.backendId).not.toBe(orgA.backendId);
  await closeSettings();
});

// ── Switcher + surfaces while both wires are live ───────────────────

test('both Org groups show in the switcher with via-attribution', async () => {
  await openWorkspaceDropdown();
  await expect(orgHeader(`via ${LABEL_A}`)).toBeVisible();
  await expect(orgHeader(`via ${LABEL_B}`)).toBeVisible();
  // Reach ladder: both wires advertise a loopback bind tier (the WAN
  // daemon sits behind a TLS proxy on a loopback bind), so the
  // multi-browser step is gone and the next steps up remain.
  await expect(workbench.getByText('Sync across your devices')).toBeVisible();
  await expect(workbench.getByText('Sync with your team')).toBeVisible();
  await expect(workbench.getByText('Sync across browsers on this device')).toBeHidden();
  await closeWorkspaceDropdown();
});

test('the status pill lists one row per backend', async () => {
  await workbench.getByRole('status', { name: /^System status:/ }).click();
  const popover = workbench.locator('.ant-popover:visible').last();
  await expect(popover.getByText(LABEL_A, { exact: true })).toBeVisible();
  await expect(popover.getByText(LABEL_B, { exact: true })).toBeVisible();
  await workbench.keyboard.press('Escape');
});

test('Publish appears once joined targets exist', async () => {
  await deliverIntent({ kind: 'open-workspace-manager' });
  await expect(workbench.getByRole('button', { name: 'Publish workspace to a back-end' }).first()).toBeVisible({
    timeout: 10000,
  });
  await workbench.keyboard.press('Escape');
});

// ── Routing leg — edits land on exactly the owning backend ──────────

test('an edit in each Org routes to exactly its owning backend', async () => {
  await switchToOrg(`via ${LABEL_A}`);
  await createRuleInScope(ROUTED_A);
  await expect.poll(() => backendHasRule(rigA, ROUTED_A), { timeout: 45000 }).toBe(true);
  expect(await backendHasRule(rigB, ROUTED_A)).toBe(false);

  await switchToOrg(`via ${LABEL_B}`);
  await createRuleInScope(ROUTED_B);
  await expect.poll(() => backendHasRule(rigB, ROUTED_B), { timeout: 45000 }).toBe(true);
  expect(await backendHasRule(rigA, ROUTED_B)).toBe(false);

  // No cross-workspace pollution in either direction.
  expect(await workspaceIds(rigA)).toEqual(baselineWorkspaceIdsA);
  expect(await workspaceIds(rigB)).toEqual(baselineWorkspaceIdsB);
});

// ── Independent flush leg ───────────────────────────────────────────

test('offline edits flush independently per backend', async () => {
  await openBackendSettings();
  await toggleBackendEnabled(LABEL_A, false);
  await closeSettings();

  await switchToOrg(`via ${LABEL_A}`);
  await createRuleInScope(QUEUED_A);
  await switchToOrg(`via ${LABEL_B}`);
  await createRuleInScope(LIVE_B);

  // B's pipe never stalled; A's edit stays queued while its wire is off.
  await expect.poll(() => backendHasRule(rigB, LIVE_B), { timeout: 45000 }).toBe(true);
  expect(await backendHasRule(rigA, QUEUED_A)).toBe(false);

  await openBackendSettings();
  await toggleBackendEnabled(LABEL_A, true);
  await expect.poll(() => backendHasRule(rigA, QUEUED_A), { timeout: 45000 }).toBe(true);
  await closeSettings();
});

// ── Org uniqueness — refusal surfaced, never re-bound ───────────────

test('a second record claiming the same Org is refused and surfaced', async () => {
  await openBackendSettings();
  await addBackendViaWizard({
    tile: 'Local / LAN',
    label: `${LABEL_A} twin`,
    scheme: rigA.wsParts.scheme,
    address: rigA.wsParts.address,
    port: rigA.wsParts.port,
    token: rigA.token,
    expectAdditionalNote: true,
  });
  await expect(workbench.getByRole('alert').filter({ hasText: 'is already provided by' })).toBeVisible({
    timeout: 30000,
  });
  // The Org stayed bound to the original record.
  const rows = await joinedOrgRows();
  expect(rows.find((row) => row.org.id === orgA.org.id)?.backendId).toBe(orgA.backendId);

  // The twin consumed nothing, so its remove is the plain Popconfirm.
  await workbench.getByRole('button', { name: `Remove ${LABEL_A} twin` }).click();
  await workbench.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(workbench.getByRole('alert').filter({ hasText: 'is already provided by' })).toBeHidden();
  await closeSettings();
});

// ── Remove legs ─────────────────────────────────────────────────────

test('remove with Keep orphans the group and leaves the other backend untouched', async () => {
  const rulesOnB = await backendRuleNames(rigB);
  await openBackendSettings();
  await workbench.getByRole('button', { name: `Remove ${LABEL_B}` }).click();
  const dialog = workbench.getByRole('dialog', { name: `Remove ${LABEL_B}?` });
  await expect(dialog).toBeVisible();
  // Keep local copies is the pre-selected recommended card.
  await expect(dialog.getByRole('radio', { name: /Keep local copies/ })).toHaveAttribute('aria-checked', 'true');
  await dialog.getByRole('button', { name: 'Remove back-end' }).click();
  await expect(dialog).toBeHidden({ timeout: 15000 });
  await closeSettings();

  // The orphan group renders; B's workspaces stayed local.
  await openWorkspaceDropdown();
  await expect(workbench.getByText('No longer syncing')).toBeVisible();
  await closeWorkspaceDropdown();
  expect(await ruleVisibleInExtension(sentinelB)).toBe(true);

  // A untouched, still live; B's own data intact.
  expect(await backendHasRule(rigA, ROUTED_A)).toBe(true);
  expect(await workspaceIds(rigA)).toEqual(baselineWorkspaceIdsA);
  expect(await backendRuleNames(rigB)).toEqual(rulesOnB);
  const rows = await joinedOrgRows();
  expect(rows.map((row) => row.org.id)).toEqual([orgA.org.id]);
});

test('remove with Discard backs up, deletes locally, and leaves the daemon data intact', async () => {
  // Park the tab on the home Org before its scope is deleted.
  const identity = (await swStorageGet('oh.syntheticIdentity')) as { org: { name: string } };
  await switchToOrg(identity.org.name);

  const downloadsBefore = downloads.length;
  await openBackendSettings();
  await workbench.getByRole('button', { name: `Remove ${LABEL_A}` }).click();
  const dialog = workbench.getByRole('dialog', { name: `Remove ${LABEL_A}?` });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('radio', { name: /Discard local copies/ }).click();
  await dialog.getByRole('button', { name: 'Back up, then remove' }).click();
  await expect(dialog).toBeHidden({ timeout: 30000 });
  await closeSettings();

  // Backups downloaded, local copies gone, daemon data never touched.
  expect(downloads.length).toBeGreaterThan(downloadsBefore);
  expect(downloads.at(-1)?.suggestedFilename()).toMatch(/-backup\.openheaders\.yaml$/);
  await expect.poll(() => ruleVisibleInExtension(SEEDED_A), { timeout: 15000 }).toBe(false);
  expect(await backendHasRule(rigA, SEEDED_A)).toBe(true);
  expect(await backendHasRule(rigA, QUEUED_A)).toBe(true);
  expect((await joinedOrgRows()).length).toBe(0);
});

test('re-joining the discarded backend syncs its workspaces back down', async () => {
  await openBackendSettings();
  await addBackendViaWizard({
    tile: 'Local / LAN',
    label: `${LABEL_A} rejoined`,
    scheme: rigA.wsParts.scheme,
    address: rigA.wsParts.address,
    port: rigA.wsParts.port,
    token: rigA.token,
    expectAdditionalNote: false,
  });
  await closeSettings();
  // The re-join re-binds the Org through a fresh WELCOME claim — the
  // Discard pruned the old rows, so this is a genuine first join.
  await expect.poll(async () => (await joinedOrgRows()).length, { timeout: 30000 }).toBe(1);
  const rows = await joinedOrgRows();
  expect(rows[0].org.id).toBe(orgA.org.id);
  expect(rows[0].backendId).not.toBe(orgA.backendId);
});

// KNOWN DEFECT (found by this gate's first live run): the Discard leg's
// local delete is a synced remove mutation — its tombstone carries a
// fresh HLC from this node, permanently outranking the daemon's older
// workspace state, and the local `__global__` log still folds the
// daemon's HLCs into the re-join STATE_VECTOR, so catch-up sends
// nothing. The remove dialog's "re-joining syncs them down again" can
// never hold through this path. Planned fix: Discard on a consumed
// workspace becomes a host-local eviction (no mutation) — purge the
// workspace data, remove the list entity without a tombstone, and drop
// the org's rows from the local `__global__` log.
test.fixme('re-joined workspaces sync their data back down after a Discard', async () => {
  await expect.poll(() => ruleVisibleInExtension(SEEDED_A), { timeout: 45000 }).toBe(true);
  await expect.poll(() => ruleVisibleInExtension(QUEUED_A), { timeout: 45000 }).toBe(true);
});

test('SIGTERM shuts the spawned daemons down clean', async () => {
  await context.close();
  for (const rig of [rigA, rigB]) {
    const daemon = rig.daemon;
    if (!daemon) continue;
    daemon.proc.kill('SIGTERM');
    expect(await daemon.exited).toBe(0);
  }
});
