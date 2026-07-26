/**
 * Git daemon-console e2e — the T7-automatable core (GIT_PLAN.md §10
 * Phase 7 / §11.5) on the REAL remote-wire stack: a headless daemon
 * serving the Workbench web bundle, browser tabs as its clients, the
 * admin console's Git card driving the daemon's bindings over the
 * `daemon.admin`-gated `oh.daemon.workspaceTree.dispatch` channel, and
 * contributor-authored commits resolved through the user directory.
 *
 *   D1  the daemon serves the web bundle entry document on its bind.
 *   D2  an operator-token tab joins, and the Backend pane's admin
 *       affordance opens the daemon-admin console.
 *   D3  the console Git card binds a daemon-side folder over the wire:
 *       repo auto-init on the daemon's disk, first commit lands.
 *   D4  directory users minted through the console: create, password,
 *       per-user Git email (the §11.5 knob), workspace grants.
 *   D5  a directory user signs in via password login; the granted
 *       workspace syncs down; the admin console stays denied to them.
 *   D6  sole-contributor authorship: the user's edit commits AUTHORED
 *       by them (directory displayName + email), committer = operator.
 *   D7  the Git-email override wins the attribution chain on the next
 *       commit.
 *   D8  a mixed batch (two directory users) lands operator-authored
 *       with one Co-Authored-By per contributor. (The users.noreply
 *       synthetic fallback needs an email-less user, which password
 *       login cannot admit — that chain link stays unit-covered.)
 *   D9  push/pull over a real bare remote: console Push establishes
 *       tracking, a peer clone's foreign edit converges on console
 *       Pull and reaches a live web client.
 *
 * Deliberately NOT here: the true two-machine droplet run (network,
 * ssh, packaged daemon) stays the manual T7 acceptance; this suite is
 * its single-machine honest core. The card's dirty count does not
 * stream live to remote console tabs (known P7 residual) — status here
 * is refreshed through real gestures, never asserted on live push.
 *
 * Requires builds: `pnpm turbo build --filter=@openheaders/daemon` and
 * `pnpm turbo build --filter=@openheaders/web`.
 */

import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import path from 'node:path';
import { type Browser, type BrowserContext, chromium, expect, type Locator, type Page, test } from '@playwright/test';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const DAEMON_MAIN = path.join(REPO_ROOT, 'apps/daemon/dist/main.js');
const WEB_ROOT = path.join(REPO_ROOT, 'apps/web/dist');
const electronBinary = createRequire(path.join(REPO_ROOT, 'packages/oracle-host-node/package.json'))(
  'electron',
) as string;

// Port etiquette: off every prior suite's ports (ledger through 19938).
const DAEMON_PORT = 20037;
const ORIGIN = `http://127.0.0.1:${DAEMON_PORT}`;

const OPERATOR_NAME = 'OH Operator';
const OPERATOR_EMAIL = 'operator@openheaders.io';
const DANA_NAME = 'Dana Reyes';
const DANA_EMAIL = 'dana@openheaders.io';
const DANA_GIT_EMAIL = 'dana.git@openheaders.io';
const DANA_PASSWORD = 'dana-console-pass';
const ELI_NAME = 'Eli Moran';
const ELI_EMAIL = 'eli@openheaders.io';
const ELI_PASSWORD = 'eli-console-pass';

let daemonProc: ChildProcess;
let daemonExited: Promise<number | null>;
const daemonLog: string[] = [];
let browser: Browser;
let adminContext: BrowserContext;
let adminPage: Page;
let danaContext: BrowserContext;
let danaPage: Page;
let eliContext: BrowserContext;
let eliPage: Page;
const consoleErrors: string[] = [];

let root: string;
let wsDir: string;
let remoteDir: string;
let cloneDir: string;
let daemonGitConfig: string;
let cloneGitConfig: string;
let operatorToken: string;
let workspaceId: string;
let workspaceName: string;

// ── git helpers (hermetic identity via GIT_CONFIG_GLOBAL) ───────────

function runGit(cwd: string, config: string, args: string[], attempt = 0): string {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf-8',
      env: { ...process.env, GIT_CONFIG_GLOBAL: config, GIT_TERMINAL_PROMPT: '0' },
    }).trim();
  } catch (err) {
    // A test-side git command can race the daemon's own passes on the
    // shared repo (index.lock) — git refuses cleanly; retry.
    const detail = String((err as { stderr?: unknown; message?: unknown }).stderr ?? (err as Error).message);
    if (detail.includes('index.lock') && attempt < 20) {
      execFileSync('sleep', ['0.25']);
      return runGit(cwd, config, args, attempt + 1);
    }
    throw err;
  }
}

/** The daemon-side workspace repo (read-side assertions + remote add). */
function ws(...args: string[]): string {
  return runGit(wsDir, daemonGitConfig, args);
}

/** The peer clone — the "second machine" — under its own identity. */
function clone(...args: string[]): string {
  return runGit(cloneDir, cloneGitConfig, args);
}

/** The bare remote (read-only queries). */
function remote(...args: string[]): string {
  return runGit(root, daemonGitConfig, ['--git-dir', remoteDir, ...args]);
}

/** Commit count on the daemon repo's current branch (0 while HEAD is unborn). */
function commitCount(): number {
  try {
    return Number(ws('rev-list', '--count', 'HEAD'));
  } catch {
    return 0;
  }
}

// ── tree helpers ────────────────────────────────────────────────────

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

/** Whether any yaml file in the tree carries `text`. */
function treeContains(rootDir: string, text: string): boolean {
  if (!existsSync(rootDir)) return false;
  return walkYamlFiles(rootDir).some((file) => readFileSync(file, 'utf-8').includes(text));
}

/** The yaml file in `rootDir` whose `name:` line carries `name`, or null. */
function entityFileByName(rootDir: string, name: string): string | null {
  if (!existsSync(rootDir)) return null;
  for (const file of walkYamlFiles(rootDir)) {
    if (readFileSync(file, 'utf-8').includes(`name: ${name}`)) return file;
  }
  return null;
}

// ── daemon rig ──────────────────────────────────────────────────────

async function spawnDaemon(): Promise<void> {
  const dataDir = path.join(root, 'daemon-data');
  mkdirSync(dataDir);
  const tokenHash = createHash('sha256').update(operatorToken).digest('hex');
  await writeFile(
    path.join(dataDir, 'storage.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: {
        'oh.settings.user': { 'mcp.enabled': true, 'mcp.allowWrite': true },
        'oh.daemonAuthTokens': [
          {
            id: 'git-console-bootstrap',
            tokenHash,
            label: 'git console e2e',
            createdAt: Date.now(),
            lastUsedAt: null,
            revokedAt: null,
          },
        ],
      },
      secrets: {},
    }),
  );
  daemonProc = spawn(
    electronBinary,
    [
      DAEMON_MAIN,
      '--data-dir',
      dataDir,
      '--bind-address',
      '127.0.0.1',
      '--bind-port',
      String(DAEMON_PORT),
      '--web-root',
      WEB_ROOT,
    ],
    { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', GIT_CONFIG_GLOBAL: daemonGitConfig } },
  );
  for (const stream of [daemonProc.stdout, daemonProc.stderr]) {
    stream?.on('data', (chunk: Buffer) => daemonLog.push(chunk.toString()));
  }
  daemonExited = new Promise<number | null>((resolve) => daemonProc.once('exit', (code) => resolve(code)));
  await expect
    .poll(
      async () => {
        try {
          return (await fetch(`${ORIGIN}/healthz`)).status;
        } catch {
          return 0;
        }
      },
      { timeout: 30_000 },
    )
    .toBe(200);
}

// ── MCP helpers (operator token; assertions only) ───────────────────

async function mcpRpc(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch(`${ORIGIN}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${operatorToken}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  expect(response.status, method).toBe(200);
  return (await response.json()) as Record<string, unknown>;
}

async function callTool(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const json = await mcpRpc('tools/call', { name, arguments: args });
  const result = json.result as { isError?: boolean; content: Array<{ text: string }> };
  expect(result.isError, `${name}: ${result.content?.[0]?.text}`).toBeFalsy();
  return JSON.parse(result.content[0]?.text ?? '{}') as Record<string, unknown>;
}

// ── page helpers ────────────────────────────────────────────────────

function watchConsole(target: Page, label: string): void {
  target.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`[${label}] ${msg.text()}`);
  });
  target.on('pageerror', (err) => consoleErrors.push(`[${label}] pageerror: ${err.message}`));
}

/** Read one `oh.host-storage` kv slot from the page's origin IDB. */
function readHostSlot(target: Page, key: string): Promise<unknown> {
  return target.evaluate(
    (k) =>
      new Promise((resolve) => {
        const open = indexedDB.open('oh.host-storage');
        open.onsuccess = () => {
          const db = open.result;
          const req = db.transaction('kv', 'readonly').objectStore('kv').get(k);
          req.onsuccess = () => resolve(req.result?.value ?? null);
          req.onerror = () => resolve(null);
        };
        open.onerror = () => resolve(null);
      }),
    key,
  );
}

/** Whether any per-workspace rule slot in the page's origin IDB carries `name`. */
function ruleInTabIdb(target: Page, name: string): Promise<boolean> {
  return target.evaluate(
    (n) =>
      new Promise<boolean>((resolve) => {
        const open = indexedDB.open('oh.host-storage');
        open.onsuccess = () => {
          const db = open.result;
          const req = db.transaction('kv', 'readonly').objectStore('kv').getAll();
          req.onsuccess = () =>
            resolve(
              JSON.stringify(
                (req.result as Array<{ key: string }>).filter((r) => /^oh\.ws\..*\.rules$/.test(r.key)),
              ).includes(n),
            );
          req.onerror = () => resolve(false);
        };
        open.onerror = () => resolve(false);
      }),
    name,
  );
}

/** Wait for antd modal zoom motion to settle before clicking inside it. */
async function settleModal(target: Page): Promise<void> {
  await expect(target.locator('.ant-modal[class*="zoom-"]')).toHaveCount(0, { timeout: 10_000 });
}

/** Pick an option by exact title in the one open antd select dropdown. */
async function pickDropdownOption(target: Page, label: string): Promise<void> {
  await target
    .locator(`.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option[title="${label}"]`)
    .click();
}

/** Join through the token leg of the login gate (the operator tab). */
async function joinWithToken(target: Page, token: string): Promise<void> {
  await target.goto(`${ORIGIN}/`);
  await target.waitForSelector('[data-testid=login-gate]', { timeout: 15_000 });
  await target.fill('input[data-testid=login-gate-token], [data-testid=login-gate-token] input', token);
  await target.click('[data-testid=login-gate-submit]');
  await target.waitForSelector('[data-testid=login-gate]', { state: 'detached', timeout: 30_000 });
}

/** Sign in through the password leg of the login gate (directory users). */
async function joinWithPassword(target: Page, email: string, password: string): Promise<void> {
  await target.goto(`${ORIGIN}/`);
  await target.waitForSelector('[data-testid=login-gate-password]', { timeout: 15_000 });
  await target.fill('input[data-testid=login-gate-email], [data-testid=login-gate-email] input', email);
  await target.fill('input[data-testid=login-gate-password], [data-testid=login-gate-password] input', password);
  await target.click('[data-testid=login-gate-password-submit]');
  await target.waitForSelector('[data-testid=login-gate]', { state: 'detached', timeout: 30_000 });
}

/** Open Settings → Backend on a workbench tab. */
async function openBackendPane(target: Page): Promise<void> {
  await target.getByRole('button', { name: 'Settings menu' }).click();
  await target.getByRole('button', { name: 'Settings…' }).click();
  await target.locator('.settings-category-nav').getByText('Backend', { exact: true }).click();
}

/**
 * The daemon-side card has no live status stream to remote console
 * tabs (P7 residual) — refresh it through a real gesture: the
 * bypass-hooks switch dispatches twice and refetches status each time.
 */
async function nudgeCardStatus(): Promise<void> {
  await adminPage.getByTestId('git-pane-bypass-hooks-switch').click();
  await expect(adminPage.getByTestId('git-pane-bypass-hooks-warning')).toBeVisible({ timeout: 15_000 });
  await adminPage.getByTestId('git-pane-bypass-hooks-switch').click();
  await expect(adminPage.getByTestId('git-pane-bypass-hooks-warning')).toBeHidden({ timeout: 15_000 });
}

/** Commit whatever the daemon tree holds through the console card. */
async function commitViaConsole(message: string): Promise<void> {
  const before = commitCount();
  await nudgeCardStatus();
  await expect(adminPage.getByTestId('git-pane-commit-button')).toBeEnabled({ timeout: 15_000 });
  await adminPage.getByTestId('git-pane-commit-message').fill(message);
  await adminPage.getByTestId('git-pane-commit-button').click();
  await expect.poll(() => commitCount(), { timeout: 45_000 }).toBe(before + 1);
  await expect.poll(() => ws('status', '--porcelain'), { timeout: 30_000 }).toBe('');
}

/** The console directory row for a user, located by display name. */
function userRow(name: string): Locator {
  return adminPage.locator('[data-testid^="server-admin-user-"]').filter({ hasText: name });
}

/** Create a directory user through the console form. */
async function createUser(name: string, email: string): Promise<void> {
  await adminPage.getByTestId('server-admin-add-name').fill(name);
  await adminPage.locator('input[placeholder*="mail" i]').first().fill(email);
  await adminPage.getByTestId('server-admin-add-user').click();
  await expect(userRow(name)).toBeVisible({ timeout: 15_000 });
}

/** Set a user's password through the console modal. */
async function setUserPassword(name: string, password: string): Promise<void> {
  await userRow(name).getByRole('button', { name: 'Set password' }).click();
  await settleModal(adminPage);
  await adminPage.getByTestId('server-admin-password-input').fill(password);
  await adminPage.getByTestId('server-admin-password-save').click();
  await expect(adminPage.getByTestId('server-admin-password-input')).toBeHidden({ timeout: 15_000 });
}

/**
 * Grant `role` on the seeded workspace through the row's grant editor.
 * The Grant button is located by text, never by ARIA name — an antd
 * button's accessible name grows a "loading" prefix mid-flight, which
 * makes a `getByRole` name-match hang on any re-resolution.
 */
async function grantWorkspace(name: string, role: string): Promise<void> {
  const row = userRow(name);
  await row.locator('.ant-select').first().click();
  await pickDropdownOption(adminPage, workspaceName);
  await row.locator('.ant-select').nth(1).click();
  await pickDropdownOption(adminPage, role);
  await row.locator('button').filter({ hasText: 'Grant' }).click();
  await expect(row.locator('.ant-tag').filter({ hasText: role })).toBeVisible({ timeout: 15_000 });
}

/**
 * Create a rule through the real editor flow of a joined web tab and
 * wait for it to reach the daemon's materialized git tree.
 */
async function createRuleViaEditor(target: Page, name: string): Promise<void> {
  // Collapse the Docs panel first — its website copy carries the same
  // rule-flavored text the flow's matchers target.
  const docsTab = target.locator('[data-tool-window="docs"]').first();
  if ((await docsTab.getAttribute('aria-selected').catch(() => null)) === 'true') {
    await docsTab.click();
  }
  // Bring the HTTP Rules view up — a fresh workspace opens on a
  // welcome surface.
  const rulesTab = target.locator('[data-tool-window="http-rules"]').first();
  if ((await rulesTab.getAttribute('aria-selected')) !== 'true') {
    await rulesTab.click();
    await expect(rulesTab).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 });
  }
  // The sidebar's New-rule button is always present; the welcome tab's
  // Create-rule CTA disappears once the workspace has content.
  await target.getByRole('button', { name: 'New rule', exact: true }).first().click();
  const blockItem = target.getByRole('menuitem', { name: /Block Requests/ }).first();
  await blockItem.waitFor({ timeout: 10_000 });
  await blockItem.click();

  // The editor's name field is a controlled input — its value lives on
  // the DOM property, so match by inputValue, not a [value=] selector.
  const inputs = target.locator('input:visible');
  const findNameInput = async (): Promise<number> => {
    const count = await inputs.count();
    for (let i = 0; i < count; i++) {
      if (
        (await inputs
          .nth(i)
          .inputValue()
          .catch(() => '')) === 'New Block Rule'
      )
        return i;
    }
    return -1;
  };
  await expect.poll(findNameInput, { timeout: 10_000 }).toBeGreaterThan(-1);
  await inputs.nth(await findNameInput()).fill(name);
  await target
    .locator('button:visible')
    .filter({ hasText: /^Save$/ })
    .first()
    .click();

  // Save dialog: Save arms only once a target collection is chosen.
  await target.waitForSelector('.ant-modal', { timeout: 10_000 });
  await settleModal(target);
  const collectionOption = target.locator('.ant-modal [role=option]').first();
  if ((await collectionOption.count()) > 0) {
    await collectionOption.click();
  } else {
    await target.locator('.ant-modal').getByText('New collection', { exact: false }).first().click();
    const collectionInput = target.locator('.ant-modal input:visible').last();
    await collectionInput.fill('T7 Rules');
    await collectionInput.press('Enter');
  }
  await target
    .locator('.ant-modal button:visible')
    .filter({ hasText: /^Save$/ })
    .last()
    .click();

  await expect.poll(() => treeContains(wsDir, name), { timeout: 45_000 }).toBe(true);
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  test.setTimeout(120_000);
  root = await mkdtemp(path.join(os.tmpdir(), 'oh-git-daemon-console-'));
  wsDir = path.join(root, 'ws');
  remoteDir = path.join(root, 'remote.git');
  cloneDir = path.join(root, 'clone');
  daemonGitConfig = path.join(root, 'daemon-gitconfig');
  cloneGitConfig = path.join(root, 'clone-gitconfig');
  mkdirSync(wsDir);
  writeFileSync(
    daemonGitConfig,
    `[user]\n\tname = ${OPERATOR_NAME}\n\temail = ${OPERATOR_EMAIL}\n[init]\n\tdefaultBranch = main\n`,
  );
  writeFileSync(
    cloneGitConfig,
    '[user]\n\tname = Clone Author\n\temail = clone@openheaders.io\n[init]\n\tdefaultBranch = main\n',
  );

  operatorToken = `oh_gitconsole_${randomBytes(24).toString('hex')}`;
  await spawnDaemon();

  // A distinctly-named workspace: every joined tab also carries its own
  // local "Workspace", so name-keyed pickers need an unambiguous target.
  workspaceName = 'T7 Git Workspace';
  const created = await callTool('workspaces_create', { name: workspaceName, activate: true });
  workspaceId = (created.workspace as { id: string }).id;

  browser = await chromium.launch();
});

test.afterAll(async () => {
  await browser?.close();
  if (daemonProc && !daemonProc.killed) {
    daemonProc.kill('SIGTERM');
    await daemonExited;
  }
  // Triage context on failures — the daemon's own stdout/stderr tail.
  process.stdout.write(`[daemon] ${daemonLog.join('').split('\n').slice(-40).join('\n[daemon] ')}\n`);
});

// ── D1: the daemon is the web front door ────────────────────────────

test('D1 — the daemon serves the web bundle entry document on its bind', async () => {
  const res = await fetch(`${ORIGIN}/`);
  expect(res.status).toBe(200);
  expect(await res.text()).toContain('<div id="root">');
});

// ── D2: operator joins, the admin console opens ─────────────────────

test('D2 — an operator tab joins and the Backend pane opens the daemon-admin console', async () => {
  adminContext = await browser.newContext();
  adminPage = await adminContext.newPage();
  watchConsole(adminPage, 'admin');
  await joinWithToken(adminPage, operatorToken);

  await openBackendPane(adminPage);
  await adminPage.getByTestId('open-daemon-admin').click();
  await expect(adminPage.getByTestId('server-admin-console')).toBeVisible({ timeout: 15_000 });
});

// ── D3: bind + first commit over the dispatch wire ──────────────────

test('D3 — the console Git card binds a daemon-side folder and lands the first commit', async () => {
  test.setTimeout(120_000);
  await expect(adminPage.getByTestId('server-admin-git-workspace')).toBeVisible({ timeout: 15_000 });
  await adminPage.getByTestId('server-admin-git-workspace').click();
  await pickDropdownOption(adminPage, workspaceName);
  await adminPage.getByTestId('git-pane-path-input').fill(wsDir);
  await adminPage.getByTestId('git-pane-bind-button').click();

  await expect.poll(() => existsSync(path.join(wsDir, '.git')), { timeout: 45_000 }).toBe(true);
  await expect.poll(() => existsSync(path.join(wsDir, 'workspace.yaml')), { timeout: 30_000 }).toBe(true);

  await commitViaConsole('daemon console: initial tree');
  expect(ws('log', '-1', '--format=%s')).toBe('daemon console: initial tree');
});

// ── D4: directory users through the console ─────────────────────────

test('D4 — the console mints two directory users with passwords, grants, and one Git email', async () => {
  test.setTimeout(120_000);
  await createUser(DANA_NAME, DANA_EMAIL);
  await setUserPassword(DANA_NAME, DANA_PASSWORD);
  await grantWorkspace(DANA_NAME, 'Editor');

  await createUser(ELI_NAME, ELI_EMAIL);
  await setUserPassword(ELI_NAME, ELI_PASSWORD);
  await grantWorkspace(ELI_NAME, 'Editor');
});

// ── D5: password login + RBAC posture ───────────────────────────────

test('D5 — Dana signs in via password, the granted workspace syncs down, admin stays denied', async () => {
  test.setTimeout(120_000);
  danaContext = await browser.newContext();
  danaPage = await danaContext.newPage();
  watchConsole(danaPage, 'dana');
  await joinWithPassword(danaPage, DANA_EMAIL, DANA_PASSWORD);

  await expect.poll(() => readHostSlot(danaPage, 'oh.runtimeActive.active'), { timeout: 30_000 }).toBe(workspaceId);

  // The admin affordance is probe-gated per session — a directory user
  // sees no console entry (the server re-gates every call regardless).
  await openBackendPane(danaPage);
  await expect(danaPage.getByTestId('open-daemon-admin')).toHaveCount(0);
  await danaPage.keyboard.press('Escape');
  await expect(danaPage.locator('.ant-modal-wrap:visible')).toHaveCount(0, { timeout: 10_000 });
});

// ── D6: sole-contributor authorship ─────────────────────────────────

test('D6 — a directory user edit commits AUTHORED by them; the committer stays the operator', async () => {
  test.setTimeout(120_000);
  await createRuleViaEditor(danaPage, 'Dana pipeline rule');
  await commitViaConsole('daemon console: dana sole edit');

  // §11.5: sole contributor = git author (directory displayName +
  // email chain), committer = operator — the web-commit split.
  expect(ws('log', '-1', '--format=%an <%ae>')).toBe(`${DANA_NAME} <${DANA_EMAIL}>`);
  expect(ws('log', '-1', '--format=%cn <%ce>')).toBe(`${OPERATOR_NAME} <${OPERATOR_EMAIL}>`);
  expect(ws('log', '-1', '--format=%B')).not.toContain('Co-Authored-By');
});

// ── D7: the per-user Git-email knob wins the chain ──────────────────

test('D7 — a Git-email override set in the console wins attribution on the next commit', async () => {
  test.setTimeout(120_000);
  await userRow(DANA_NAME).getByRole('button', { name: 'Set Git email' }).click();
  await settleModal(adminPage);
  await adminPage.getByTestId('server-admin-git-email-input').fill(DANA_GIT_EMAIL);
  await adminPage.getByTestId('server-admin-git-email-save').click();
  await expect(adminPage.getByTestId('server-admin-git-email-input')).toBeHidden({ timeout: 15_000 });

  await createRuleViaEditor(danaPage, 'Dana override rule');
  await commitViaConsole('daemon console: dana gitEmail edit');
  expect(ws('log', '-1', '--format=%an <%ae>')).toBe(`${DANA_NAME} <${DANA_GIT_EMAIL}>`);
});

// ── D8: mixed batch → operator author + trailers ────────────────────

test('D8 — a two-user batch lands operator-authored with one Co-Authored-By per contributor', async () => {
  test.setTimeout(120_000);
  eliContext = await browser.newContext();
  eliPage = await eliContext.newPage();
  watchConsole(eliPage, 'eli');
  await joinWithPassword(eliPage, ELI_EMAIL, ELI_PASSWORD);
  await expect.poll(() => readHostSlot(eliPage, 'oh.runtimeActive.active'), { timeout: 30_000 }).toBe(workspaceId);

  await createRuleViaEditor(danaPage, 'Dana mixed rule');
  await createRuleViaEditor(eliPage, 'Eli mixed rule');
  await commitViaConsole('daemon console: mixed batch');

  const author = ws('log', '-1', '--format=%an');
  expect(author).not.toBe(DANA_NAME);
  expect(author).not.toBe(ELI_NAME);
  const body = ws('log', '-1', '--format=%B');
  expect(body).toContain(`Co-Authored-By: ${DANA_NAME} <${DANA_GIT_EMAIL}>`);
  expect(body).toContain(`Co-Authored-By: ${ELI_NAME} <${ELI_EMAIL}>`);
});

// ── D9: push/pull over a real bare remote ───────────────────────────

test('D9 — console Push establishes tracking; a foreign clone edit converges on Pull and reaches a live client', async () => {
  test.setTimeout(180_000);
  runGit(root, daemonGitConfig, ['init', '--bare', remoteDir]);
  ws('remote', 'add', 'origin', remoteDir);

  await adminPage.getByTestId('git-pane-push-button').click();
  await expect
    .poll(
      () => {
        try {
          return remote('rev-parse', 'refs/heads/main');
        } catch {
          return null;
        }
      },
      { timeout: 30_000 },
    )
    .toBe(ws('rev-parse', 'HEAD'));
  await expect(adminPage.getByTestId('git-pane-remote-line')).toContainText('in sync', { timeout: 15_000 });

  // The "second machine": a peer clone renames Dana's rule and pushes.
  runGit(root, cloneGitConfig, ['clone', remoteDir, cloneDir]);
  const ruleFile = entityFileByName(cloneDir, 'Dana pipeline rule');
  expect(ruleFile).not.toBeNull();
  const text = readFileSync(ruleFile as string, 'utf-8');
  writeFileSync(ruleFile as string, text.replace('name: Dana pipeline rule', 'name: Renamed by clone'));
  clone('commit', '-a', '-m', 'clone: rename dana rule');
  clone('push');
  const foreignSha = clone('rev-parse', 'HEAD');

  await adminPage.getByTestId('git-pane-pull-button').click();
  await expect.poll(() => ws('rev-parse', 'HEAD'), { timeout: 45_000 }).toBe(foreignSha);
  await expect.poll(() => ws('status', '--porcelain'), { timeout: 30_000 }).toBe('');

  // The full T7 loop: the foreign edit swept into the engine and
  // reached a LIVE web client over the daemon's wire.
  await expect.poll(() => ruleInTabIdb(danaPage, 'Renamed by clone'), { timeout: 45_000 }).toBe(true);
});

// ── Hygiene ─────────────────────────────────────────────────────────

test('zero console errors across every leg', async () => {
  expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
  await danaContext?.close();
  await eliContext?.close();
  await adminContext?.close();
});
