/**
 * Tree order on the desktop host — the built app on a workspace seeded
 * with one interleaved request collection (`r1, Folder A, r2, Folder
 * B, r3`, a request inside Folder A, a merged tree-order record) and
 * a second, empty collection:
 *
 *   D1  the boot renders the record's interleave — a folder between
 *       two requests, nothing floats to the top by kind;
 *   D2  a request dragged onto the upper band of a folder lands
 *       between the folders; a folder created from the container's `+`
 *       lands last;
 *   D3  Alt+↑ / Alt+↓ move a request across a folder; Alt+← lands the
 *       inner request right after its folder;
 *   D4  a mixed folder + request selection dropped on the other
 *       collection lands together, first;
 *   D5  git: bind materializes `order:` on `_collection.yaml` in the
 *       sidebar's order; the commit reaches a clone; the clone rewrites
 *       `order:`, pushes, and Pull re-keys the sidebar to match;
 *   D6  `oh run collection` and MCP `runs_execute` run the collection
 *       in sidebar order;
 *   D7  the export stamps `order:`; importing it into a fresh workspace
 *       reproduces the interleave on new uids;
 *   D8  a collection delete follows the sets: a request dragged out
 *       survives, one dragged in goes with it, nothing rehomes.
 *
 * Reads are the sidebar's document order (`data-item-id`), the YAML on
 * disk, the run reports, and a workspace export. Requires
 * `pnpm turbo build --filter=@openheaders/desktop` (the CLI dist rides
 * the same graph).
 */

import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { _electron, type ElectronApplication, expect, type Locator, type Page, test } from '@playwright/test';
import { type Rig, startHttpRig } from './request-settings-rigs';

const APP_ROOT = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const CLI_BIN = path.resolve(APP_ROOT, '../cli/dist/cli.js');
const SEED_SCRIPT = path.resolve(REPO_ROOT, 'apps/extension/tests/e2e/fixtures/tree-order-seed.ts');
// Port etiquette: off every prior suite's ports (…, 19837, 19937, 19938).
const DAEMON_PORT = 20037;
const DAEMON_URL = `http://127.0.0.1:${DAEMON_PORT}`;
const MCP_URL = `${DAEMON_URL}/mcp`;

// The seed's fixed uids (`fixtures/tree-order-ids.ts`, inlined: the
// desktop spec loader resolves no extension-side module).
const SEED = {
  collection: 'e2etocol',
  other: 'e2etooth',
  folderA: 'e2etofa1',
  folderB: 'e2etofb2',
  r1: 'e2etorq1',
  r2: 'e2etorq2',
  r3: 'e2etorq3',
  inFolder: 'e2etorq4',
} as const;

const COL = `req-col-${SEED.collection}`;
const OTHER = `req-col-${SEED.other}`;
const FA = `req-folder-${SEED.folderA}`;
const FB = `req-folder-${SEED.folderB}`;
const R1 = `request-${SEED.r1}`;
const R2 = `request-${SEED.r2}`;
const R3 = `request-${SEED.r3}`;
const R4 = `request-${SEED.inFolder}`;
const CHILDREN = [FA, FB, R1, R2, R3];

let electronApp: ElectronApplication;
let workbench: Page;
let userData: string;
let workspaceId: string;
let token: string;
let configHome: string;
let httpRig: Rig;

let root: string;
let wsDir: string;
let remoteDir: string;
let cloneDir: string;
let appGitConfig: string;
let cloneGitConfig: string;
let newFolderUid = '';

// ── git helpers (hermetic identity via GIT_CONFIG_GLOBAL) ───────────

function runGit(cwd: string, config: string, args: string[], attempt = 0): string {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf-8',
      env: { ...process.env, GIT_CONFIG_GLOBAL: config, GIT_TERMINAL_PROMPT: '0' },
    }).trim();
  } catch (err) {
    const detail = String((err as { stderr?: unknown; message?: unknown }).stderr ?? (err as Error).message);
    if (detail.includes('index.lock') && attempt < 20) {
      execFileSync('sleep', ['0.25']);
      return runGit(cwd, config, args, attempt + 1);
    }
    throw err;
  }
}

const ws = (...args: string[]): string => runGit(wsDir, appGitConfig, args);
const clone = (...args: string[]): string => runGit(cloneDir, cloneGitConfig, args);

function walkYamlFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === '.git' || entry === '.oh') continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walkYamlFiles(full));
    else if (entry.endsWith('.yaml')) out.push(full);
  }
  return out;
}

/** The `_collection.yaml` of the seeded collection under `rootDir`, or null before it materializes. */
function collectionManifest(rootDir: string): string | null {
  if (!existsSync(rootDir)) return null;
  for (const file of walkYamlFiles(rootDir)) {
    if (file.endsWith('_collection.yaml') && readFileSync(file, 'utf-8').includes(`uid: ${SEED.collection}`))
      return file;
  }
  return null;
}

/** The `order:` list of a manifest as uid tails, or null when absent. */
function manifestOrder(file: string): string[] | null {
  const text = readFileSync(file, 'utf-8');
  const match = text.match(/^order:\n((?:\s+- .*\n)+)/m);
  if (!match) return null;
  return match[1]
    .split('\n')
    .filter((line) => line.trim().startsWith('- '))
    .map((line) => line.trim().slice(2).trim().slice(-8));
}

function setManifestOrder(file: string, segments: string[]): void {
  const text = readFileSync(file, 'utf-8');
  const block = `order:\n${segments.map((segment) => `  - ${segment}`).join('\n')}\n`;
  writeFileSync(file, text.replace(/^order:\n(?:\s+- .*\n)+/m, block));
}

function manifestSegments(file: string): string[] {
  const text = readFileSync(file, 'utf-8');
  const match = text.match(/^order:\n((?:\s+- .*\n)+)/m);
  return match
    ? match[1]
        .split('\n')
        .filter((l) => l.trim().startsWith('- '))
        .map((l) => l.trim().slice(2).trim())
    : [];
}

// ── app helpers ─────────────────────────────────────────────────────

async function invoke<T>(message: Record<string, unknown>): Promise<T> {
  return (await workbench.evaluate(async (msg) => {
    const bridge = (window as unknown as { oh: { invoke(m: Record<string, unknown>): Promise<unknown> } }).oh;
    return await bridge.invoke(msg);
  }, message)) as T;
}

async function launchApp(): Promise<void> {
  electronApp = await _electron.launch({
    args: [APP_ROOT],
    env: {
      ...process.env,
      OPENHEADERS_USER_DATA_DIR: userData,
      OH_DISABLE_UPDATE_CHECKS: '1',
      GIT_CONFIG_GLOBAL: appGitConfig,
    },
  });
  workbench = await electronApp.firstWindow();
  workbench.on('console', (msg) => {
    if (msg.type() === 'error' || msg.text().includes('same key'))
      console.log(`[renderer:${msg.type()}] ${msg.text()}`);
  });
  await expect
    .poll(
      async () => {
        try {
          const res = await invoke<{ activeWorkspaceId: string | null }>({ type: 'getActiveWorkspaceId' });
          return typeof res.activeWorkspaceId === 'string';
        } catch {
          return false;
        }
      },
      { timeout: 45_000 },
    )
    .toBe(true);
}

async function quit(): Promise<void> {
  await electronApp
    .evaluate(({ app }) => {
      app.quit();
    })
    .catch(() => undefined);
  await electronApp.close().catch(() => undefined);
}

/** The API Requests sidebar with the seeded collection's row visible. */
async function openApiRequestsSidebar(): Promise<void> {
  const docsTab = workbench.locator('[data-tool-window="docs"]').first();
  if ((await docsTab.getAttribute('aria-selected').catch(() => null)) === 'true') await docsTab.click();
  const viewTab = workbench.locator('[data-tool-window="api-requests"]').first();
  if ((await viewTab.getAttribute('aria-selected')) !== 'true') await viewTab.click();
  const sectionHeader = workbench
    .getByRole('button', { name: /REQUESTS/ })
    .filter({ visible: true })
    .first();
  await sectionHeader.waitFor({ state: 'visible', timeout: 15_000 });
  if ((await sectionHeader.getAttribute('aria-expanded')) !== 'true') await sectionHeader.click();
  await workbench.locator(`[data-item-id="${COL}"]`).waitFor({ state: 'visible', timeout: 15_000 });
}

// ── tree rows (the extension page object's gestures, on the desktop window) ──

const row = (id: string): Locator => workbench.locator(`[data-item-id="${id}"]`);

async function order(): Promise<string[]> {
  return workbench
    .locator('[data-item-id]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-item-id') ?? ''));
}

async function orderOf(ids: readonly string[]): Promise<string[]> {
  return (await order()).filter((id) => ids.includes(id));
}

async function expandIfCollapsed(id: string): Promise<void> {
  const target = row(id);
  await target.waitFor({ state: 'visible', timeout: 10000 });
  const caret = target.locator('.rules-sidebar-item-caret .anticon');
  const expanded = await caret
    .evaluate((el) => (el as HTMLElement).style.transform.includes('90deg'))
    .catch(() => false);
  if (!expanded) await target.click();
}

async function drag(source: Locator, target: Locator, band: number): Promise<void> {
  await source.hover();
  const from = (await source.boundingBox())!;
  await workbench.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await workbench.mouse.down();
  await workbench.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 12, { steps: 4 });
  const to = (await target.boundingBox())!;
  await workbench.mouse.move(to.x + to.width / 2, to.y + to.height * band, { steps: 8 });
  // The moving rows collapse once a landing spot resolves and the rows
  // below shift up under the pointer; settle on the target's new box
  // the way a hand keeps tracking it.
  await workbench.waitForTimeout(150);
  const settled = (await target.boundingBox())!;
  await workbench.mouse.move(settled.x + settled.width / 2 + 1, settled.y + settled.height * band, { steps: 3 });
  await workbench.mouse.up();
}

async function keyboardMove(id: string, key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft'): Promise<void> {
  await row(id).click();
  await workbench.keyboard.press(`Alt+${key}`);
}

/** The container row's hover `⋯` → "Delete", through the confirm modal when the setting asks for one. */
async function deleteContainer(id: string): Promise<void> {
  const container = row(id);
  await container.hover();
  await container.locator('.rules-sidebar-collection-actions .anticon-ellipsis').click();
  await workbench
    .locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item', { hasText: 'Delete' })
    .click();
  const confirm = workbench.locator('.ant-modal-confirm .ant-btn-dangerous');
  if (await confirm.isVisible({ timeout: 1500 }).catch(() => false)) await confirm.click();
}

/**
 * A row id should never repeat. Intermittently, after a cross-parent
 * move, the sidebar renders the moved request twice while the host's
 * tree is correct (tree containment S12, open finding). The check is
 * strict so the failure carries the evidence.
 */
async function expectUniqueRows(): Promise<void> {
  const rows = await order();
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const id of rows) {
    if (seen.has(id)) duplicates.push(id);
    seen.add(id);
  }
  if (duplicates.length === 0) return;
  const evidence = { duplicates, rows };
  expect(duplicates, `duplicate rows ${JSON.stringify(evidence)}`).toEqual([]);
}

async function expectMovedToast(count: number): Promise<void> {
  const text = count === 1 ? '1 item moved' : `${count} items moved`;
  await expect(workbench.locator('.ant-message-notice-title', { hasText: text }).last()).toBeVisible({
    timeout: 5000,
  });
}

// ── daemon / CLI ────────────────────────────────────────────────────

async function callTool(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  });
  expect(response.status).toBe(200);
  const json = (await response.json()) as { result: { isError?: boolean; content: Array<{ text: string }> } };
  expect(json.result.isError, json.result.content[0]?.text).toBeFalsy();
  return JSON.parse(json.result.content[0]?.text ?? '{}') as Record<string, unknown>;
}

function oh(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    OH_DAEMON_URL: DAEMON_URL,
    OH_TOKEN: token,
    XDG_CONFIG_HOME: configHome,
  };
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI_BIN, ...args], { env });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf-8');
    child.stderr.setEncoding('utf-8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

/** Run the tsx seed/parse helper (core schemas are TS source the Playwright loader cannot resolve). */
function helper(args: string[], input?: string, env: Record<string, string> = {}): string {
  const result = spawnSync('pnpm', ['--filter', '@openheaders/extension', 'exec', 'tsx', SEED_SCRIPT, ...args], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
    encoding: 'utf-8',
    input,
  });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout;
}

interface ExportEnvelope {
  entities: {
    collections: Array<{ uid: string; name: string; order?: string[] }>;
    folders: Array<{ uid: string; name: string; order?: string[] }>;
    requests: Array<{ uid: string; name: string }>;
  };
}

const uidOf = (segment: string): string => segment.slice(-8);
const slugOf = (segment: string): string => segment.slice(0, -9);

async function exportOf(
  scope: Record<string, unknown>,
  id?: string,
): Promise<{ yaml: string; envelope: ExportEnvelope }> {
  const res = await invoke<{ success: boolean; yaml?: string; error?: string }>({
    type: 'exportWorkspace',
    ...(id ? { workspaceId: id } : {}),
    scope,
  });
  expect(res.success, res.error).toBe(true);
  return { yaml: res.yaml!, envelope: JSON.parse(helper(['parse'], res.yaml!)) as ExportEnvelope };
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  test.setTimeout(240_000);
  httpRig = await startHttpRig();
  root = await mkdtemp(path.join(tmpdir(), 'oh-tree-order-desktop-e2e-'));
  userData = path.join(root, 'user-data');
  wsDir = path.join(root, 'ws');
  remoteDir = path.join(root, 'remote.git');
  cloneDir = path.join(root, 'clone');
  appGitConfig = path.join(root, 'app-gitconfig');
  cloneGitConfig = path.join(root, 'clone-gitconfig');
  configHome = path.join(root, 'config');
  mkdirSync(userData);
  mkdirSync(path.join(userData, 'data'));
  mkdirSync(wsDir);
  mkdirSync(configHome);
  writeFileSync(
    appGitConfig,
    '[user]\n\tname = OH E2E\n\temail = e2e@openheaders.io\n[init]\n\tdefaultBranch = main\n',
  );
  writeFileSync(
    cloneGitConfig,
    '[user]\n\tname = Clone Author\n\temail = clone@openheaders.io\n[init]\n\tdefaultBranch = main\n',
  );
  await writeFile(
    path.join(userData, 'data', 'settings.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: {
        'oh.settings.user': {
          'mcp.enabled': true,
          'mcp.allowWrite': true,
          'mcp.allowExecute': true,
          'backend.bindPort': DAEMON_PORT,
        },
      },
      secrets: {},
    }),
  );

  // Phase 1: boot once to mint the default workspace and learn its id.
  await launchApp();
  const res = await invoke<{ activeWorkspaceId: string | null }>({ type: 'getActiveWorkspaceId' });
  expect(res.activeWorkspaceId).toBeTruthy();
  workspaceId = res.activeWorkspaceId as string;
  await quit();

  // Seed the workspace slots with schema-validated entities and the
  // merged tree-order record; the requests aim at the rig so the runs
  // have a wire to hit.
  const seeded = helper(['seed', 'merged'], undefined, {
    OH_E2E_WORKSPACE_ID: workspaceId,
    OH_E2E_REQUEST_URL: `http://127.0.0.1:${httpRig.port}/echo`,
  });
  const storagePath = path.join(userData, 'data', 'settings.json');
  const envelope = JSON.parse(readFileSync(storagePath, 'utf-8')) as { values: Record<string, unknown> };
  Object.assign(envelope.values, JSON.parse(seeded) as Record<string, unknown>);
  writeFileSync(storagePath, JSON.stringify(envelope));

  // Phase 2: relaunch on the seeded slots.
  await launchApp();
  await expect
    .poll(
      async () => {
        try {
          return (await fetch(MCP_URL, { method: 'POST', body: '{}' })).status;
        } catch {
          return 0;
        }
      },
      { timeout: 45_000 },
    )
    .toBe(401);
  const minted = await workbench.evaluate(async () => {
    const bridge = (window as unknown as { oh: { invoke(msg: Record<string, unknown>): Promise<unknown> } }).oh;
    return (await bridge.invoke({ type: 'oh.daemon.tokens.mint', label: 'tree-order-e2e' })) as {
      ok: boolean;
      secret?: string;
    };
  });
  expect(minted.ok).toBe(true);
  token = minted.secret ?? '';
  await openApiRequestsSidebar();
  await expandIfCollapsed(COL);
});

test.afterAll(async () => {
  if (electronApp) await quit();
  await httpRig?.close();
});

test('D1 — the boot renders the record interleave: a folder between two requests', async () => {
  await expect.poll(() => orderOf(CHILDREN)).toEqual([R1, FA, R2, FB, R3]);
  await expandIfCollapsed(FA);
  await expect.poll(() => orderOf([FA, R4, R2])).toEqual([FA, R4, R2]);
});

test('D2 — a request lands between two folders; a folder from + lands last', async () => {
  // r2 already sits between the folders; r1 joins it right above Folder B.
  await drag(row(R1), row(FB), 0.2);
  await expectMovedToast(1);
  await workbench.waitForTimeout(800);
  await expectUniqueRows();
  await expect.poll(() => orderOf(CHILDREN)).toEqual([FA, R2, R1, FB, R3]);

  const container = row(COL);
  await container.hover();
  await container.locator('.rules-sidebar-collection-actions .anticon-plus').click();
  await workbench
    .locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-item', { hasText: 'Add Folder' })
    .click();
  await expect
    .poll(async () => {
      const rows = await order();
      const at = rows.indexOf(R3);
      const next = rows[at + 1] ?? '';
      return next.startsWith('req-folder-') && next !== FA && next !== FB ? next : null;
    })
    .not.toBeNull();
  const rows = await order();
  newFolderUid = rows[rows.indexOf(R3) + 1].slice('req-folder-'.length);
  await expect
    .poll(() => orderOf([...CHILDREN, `req-folder-${newFolderUid}`]))
    .toEqual([FA, R2, R1, FB, R3, `req-folder-${newFolderUid}`]);
});

test('D3 — Alt+Arrow moves cross kinds; Alt+Left lands right after the folder', async () => {
  await keyboardMove(R2, 'ArrowUp');
  await expectMovedToast(1);
  await workbench.waitForTimeout(800);
  await expectUniqueRows();
  await expect.poll(() => orderOf([FA, R1, FB, R2, R3])).toEqual([R2, FA, R1, FB, R3]);
  await keyboardMove(R2, 'ArrowDown');
  await expectMovedToast(1);
  await workbench.waitForTimeout(800);
  await expectUniqueRows();
  await expect.poll(() => orderOf([FA, R1, FB, R2, R3])).toEqual([FA, R2, R1, FB, R3]);

  await expandIfCollapsed(FA);
  await keyboardMove(R4, 'ArrowLeft');
  await expectMovedToast(1);
  await workbench.waitForTimeout(800);
  await expectUniqueRows();
  await expect.poll(() => orderOf([FA, R4, R2, R1, FB])).toEqual([FA, R4, R2, R1, FB]);
});

test('D4 — a mixed folder + request selection dropped on the other collection lands together, first', async () => {
  await drag(row(R3), row(OTHER), 0.5);
  await expectMovedToast(1);
  await workbench.waitForTimeout(800);
  await expectUniqueRows();
  await expandIfCollapsed(OTHER);
  await expect.poll(() => orderOf([OTHER, R3])).toEqual([OTHER, R3]);

  // r2 reads above Folder B; the pair lands in that order, ahead of r3.
  await row(FB).click();
  await row(R2).click({ modifiers: ['Meta'] });
  await row(FB).click({ modifiers: ['Meta'] });
  await drag(row(R2), row(OTHER), 0.5);
  await expectMovedToast(2);
  await workbench.waitForTimeout(800);
  await expectUniqueRows();
  await expandIfCollapsed(OTHER);
  await expect.poll(() => orderOf([FB, R2, R3])).toEqual([R2, FB, R3]);
  // The seeded collection now reads Folder A, r4, r1, New Folder.
  await expect
    .poll(() => orderOf([FA, R4, R1, `req-folder-${newFolderUid}`]))
    .toEqual([FA, R4, R1, `req-folder-${newFolderUid}`]);
});

test('D5 — git: order: materializes in sidebar order, reaches a clone, and a foreign rewrite pulls back into the sidebar', async () => {
  test.setTimeout(180_000);
  const bound = await invoke<{ ok: boolean; reason?: string }>({
    type: 'oh.workspaceTree.bind',
    workspaceId,
    rootDir: wsDir,
  });
  expect(bound.ok, bound.reason).toBe(true);
  await expect.poll(() => collectionManifest(wsDir) !== null, { timeout: 30_000 }).toBe(true);
  const manifest = collectionManifest(wsDir) as string;
  await expect
    .poll(() => manifestOrder(manifest), { timeout: 30_000 })
    .toEqual([SEED.folderA, SEED.inFolder, SEED.r1, newFolderUid]);

  const committed = await invoke<{ ok: boolean; reason?: string }>({
    type: 'oh.workspaceTree.commit',
    workspaceId,
    message: 'tree order e2e: initial tree',
  });
  expect(committed.ok, committed.reason).toBe(true);
  await expect.poll(() => ws('status', '--porcelain'), { timeout: 30_000 }).toBe('');
  expect(ws('log', '-1', '--format=%s')).toBe('tree order e2e: initial tree');
  runGit(root, appGitConfig, ['init', '--bare', remoteDir]);
  ws('remote', 'add', 'origin', remoteDir);
  const pushed = await invoke<{ ok: boolean; reason?: string }>({ type: 'oh.workspaceTree.push', workspaceId });
  expect(pushed.ok, pushed.reason).toBe(true);

  runGit(root, cloneGitConfig, ['clone', remoteDir, cloneDir]);
  const cloned = collectionManifest(cloneDir) as string;
  expect(manifestOrder(cloned)).toEqual([SEED.folderA, SEED.inFolder, SEED.r1, newFolderUid]);

  // The teammate reverses the order by hand and pushes; Pull re-keys.
  setManifestOrder(cloned, [...manifestSegments(cloned)].reverse());
  clone('commit', '-a', '-m', 'clone: reverse the order');
  clone('push');
  const fetched = await invoke<{ ok: boolean; reason?: string }>({ type: 'oh.workspaceTree.fetch', workspaceId });
  expect(fetched.ok, fetched.reason).toBe(true);
  const pulled = await invoke<{ ok: boolean; reason?: string }>({ type: 'oh.workspaceTree.pull', workspaceId });
  expect(pulled.ok, pulled.reason).toBe(true);
  expect(manifestOrder(manifest)).toEqual([newFolderUid, SEED.r1, SEED.inFolder, SEED.folderA]);
  await expect
    .poll(() => orderOf([FA, R4, R1, `req-folder-${newFolderUid}`]), { timeout: 30_000 })
    .toEqual([`req-folder-${newFolderUid}`, R1, R4, FA]);
});

test('D6 — oh run and MCP runs_execute run the collection in sidebar order', async () => {
  test.setTimeout(120_000);
  // Other reads r2, Folder B, r3; put r3 inside Folder B so the walk is depth-first.
  await expandIfCollapsed(OTHER);
  await drag(row(R3), row(FB), 0.5);
  await expectMovedToast(1);
  await workbench.waitForTimeout(800);
  await expectUniqueRows();
  await expandIfCollapsed(FB);
  await expect.poll(() => orderOf([R2, FB, R3])).toEqual([R2, FB, R3]);

  const run = await oh(['run', 'collection', 'Other', '--reporter', 'json']);
  expect(run.code, run.stderr).toBe(0);
  const report = JSON.parse(run.stdout) as { items: Array<{ name: string }> };
  expect(report.items.map((item) => item.name)).toEqual(['Root Two', 'Root Three']);

  const mcp = (await callTool('runs_execute', { kind: 'collection', ref: 'Other' })) as {
    items: Array<{ name: string }>;
  };
  expect(mcp.items.map((item) => item.name)).toEqual(['Root Two', 'Root Three']);
});

test('D7 — the export stamps order: and a fresh-workspace import reproduces it on new uids', async () => {
  const { yaml, envelope } = await exportOf({ kind: 'selection', selection: { collections: [SEED.other] } });
  const other = envelope.entities.collections.find((c) => c.uid === SEED.other);
  expect(other?.order?.map(uidOf)).toEqual([SEED.r2, SEED.folderB]);
  const folderB = envelope.entities.folders.find((f) => f.uid === SEED.folderB);
  expect(folderB?.order?.map(uidOf)).toEqual([SEED.r3]);

  const res = await invoke<{ success: boolean; targetWorkspaceId?: string; error?: string }>({
    type: 'importWorkspace',
    incoming: envelope,
    strategies: {},
    target: { mode: 'new', name: 'Imported Order' },
    sourceHash: `sha256:${createHash('sha256').update(yaml).digest('hex')}`,
  });
  expect(res.success, res.error).toBe(true);
  await expect
    .poll(async () => {
      const imported = await exportOf({ kind: 'workspace' }, res.targetWorkspaceId);
      const collection = imported.envelope.entities.collections.find((c) => c.name === 'Other');
      const folder = imported.envelope.entities.folders.find((f) => f.name === 'Folder B');
      return [collection?.order?.map(slugOf) ?? null, folder?.order?.map(slugOf) ?? null];
    })
    .toEqual([(other?.order ?? []).map(slugOf), (folderB?.order ?? []).map(slugOf)]);
});

test('D8 — a collection delete follows the sets: dragged out survives, dragged in goes, nothing rehomes', async () => {
  // The seeded collection reads New Folder, r1, r4, Folder A; Other reads
  // r2, Folder B (r3). r1 goes INTO Other, r2 comes OUT to the seeded
  // collection, then Other is deleted from its row's ⋯ menu.
  const NF = `req-folder-${newFolderUid}`;
  await expandIfCollapsed(OTHER);
  await expandIfCollapsed(COL);
  await drag(row(R1), row(OTHER), 0.5);
  await expectMovedToast(1);
  await workbench.waitForTimeout(800);
  await expectUniqueRows();
  await expandIfCollapsed(OTHER);
  await expect.poll(() => orderOf([R1, R2, FB])).toEqual([R1, R2, FB]);
  await drag(row(R2), row(COL), 0.5);
  await expectMovedToast(1);
  await workbench.waitForTimeout(800);
  await expectUniqueRows();
  await expandIfCollapsed(COL);
  await expect.poll(() => orderOf([R2, NF, R4, FA])).toEqual([R2, NF, R4, FA]);

  await deleteContainer(OTHER);
  await expect.poll(() => row(OTHER).count()).toBe(0);
  await expect.poll(() => orderOf([R2, NF, R4, FA, R1, FB, R3])).toEqual([R2, NF, R4, FA]);
  // Past the reconciler's rehome grace nothing comes back.
  await workbench.waitForTimeout(3000);
  expect(await orderOf([R2, NF, R4, FA, R1, FB, R3])).toEqual([R2, NF, R4, FA]);
  const { envelope } = await exportOf({ kind: 'workspace' });
  expect(envelope.entities.collections.map((c) => c.uid)).not.toContain(SEED.other);
  expect(envelope.entities.folders.map((f) => f.uid)).not.toContain(SEED.folderB);
  const requests = envelope.entities.requests.map((r) => r.uid);
  expect(requests).toContain(SEED.r2);
  expect(requests).not.toContain(SEED.r1);
  expect(requests).not.toContain(SEED.r3);
});
