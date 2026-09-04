/**
 * Git desktop e2e — the P2→P6 combined pass's automatable core on the
 * REAL stack: the built desktop app, the Commit tool window (the
 * checkable changes tree + message box + the row menu's Git ▸ verbs),
 * the Git tool window's ref rail, the Version Control › Git settings
 * pages (Folder: bind / unbind / quarantine issues; Automation: cadence
 * and hook bypass), real repos on disk (a bare remote + a peer clone
 * standing in for the teammate), the system git binary under a
 * hermetic GIT_CONFIG_GLOBAL identity.
 *
 *   G1   bind on the Folder page: repo auto-init (.git, .gitattributes,
 *        .gitignore, workspace.yaml), seeded entities materialize, the
 *        Commit window counts them unversioned.
 *   G2   the Commit window lands a real commit under the configured git
 *        identity; `git status` stays clean after the commit.
 *   G3   a hand edit while the app runs sweeps in: the file's row joins
 *        the Changes group, the counter reads modified, an explicit
 *        message commits it.
 *   G4   a failing pre-commit blocks with its output in the window; the
 *        Automation page's bypass-hooks switch (with its standing
 *        warning) lets the same commit land.
 *   G5   Commit and Push establishes tracking on the lone remote; the
 *        bare remote holds the local head.
 *   G6   a foreign push fast-forwards on Pull — no merge bubble, the
 *        local head IS the foreign sha, the edit reaches the worktree.
 *   G7   both sides edited → Pull lands a TWO-PARENT merge commit with
 *        a Co-Authored-By trailer and zero conflict markers; Push
 *        converges the remote.
 *   G8   a schema-broken foreign file quarantines on Pull (issue row on
 *        the Folder page, foreign bytes preserved on disk) and clears
 *        once the peer pushes a fix.
 *   G9   pushing behind the remote raises the push refusal in the
 *        window; pull then push converges.
 *   G14  New Branch with checkout carries a dirty tree onto the new
 *        branch; the rail's star moves.
 *   G16  a terminal `git checkout` while the app runs reconciles the
 *        rail — including a bare HEAD move between identical trees.
 *   G18  live watcher conflict chip: with the request editor holding a
 *        local edit on a header value, a hand edit to the same leaf
 *        sweeps in and raises the chip; Use saved adopts it.
 *   G19  a terminal `git revert` of an app commit round-trips into app
 *        state (§10 P4 acceptance): the sidebar label reverts, the
 *        tree stays clean without a counter-write.
 *   G20  cadence `auto`: pauses while the user's own index is staged
 *        (the staged file survives, no commit lands), and lands after
 *        ~2s quiescence once the index clears.
 *   G21  cadence `on-blur` via the `oh.workspaceTree.appBlur` RPC —
 *        the spine + runtime leg (real cmd-tab blur stays manual).
 *   G22  a mid-`git rebase` repo holds reconcile — Pull refuses with
 *        the in-progress marker, a held hand edit never reaches the
 *        sidebar — and `--abort` resumes the plane.
 *   G23  close-app → vim-edit → reopen: the cold-boot tree-wins sweep
 *        lands the offline edit in the UI (sidebar label) and dirty.
 *   G24  unbind on the Folder page: clean detach (lock released, repo +
 *        tree intact), the bind form returns, the Commit window flips
 *        to its bind posture.
 *
 * BLOCKED until the Git epic's residual-verb migration lands (no
 * desktop surface drives these verbs — the settings card that carried
 * them retired 2026-08-27): G10 push-as-new-branch (`pushNewBranch`),
 * G11 / G12 / G13 the force-push trichotomy (`resolveForcePush`), G15
 * the dirty-switch Commit / Stash / Discard trio (`switchBranch`), G17
 * merge (`mergeBranch`). They return with that migration.
 *
 * Deliberately NOT here (the manual live pass): the native folder
 * picker, real cmd-tab blur cadence, the ~5m fetch/commit timers
 * (`every-5m` shares `enqueueAutoCommit` with G20/G21 — the wall-clock
 * trigger has no compression seam and stays manual), and
 * packaged-build behavior.
 *
 * The Commit window's Git ▸ verbs (Push, Pull, Fetch, New Branch…) live
 * on a change row's context menu, so every window-driven pull rides a
 * local hand edit (the pull commits it first under the engine's draft,
 * then merges — G7's own contract) and every push rides Commit and
 * Push. A clean tree has no row: G6's fast-forward pull calls the verb
 * the menu calls over the bridge (the spine leg, the appBlur idiom).
 * An untracked file cannot stand in as the row — the engine's own
 * commits sweep the whole tree.
 *
 * The Electron window shows on screen for the whole run.
 *
 * Requires `pnpm turbo build --filter=@openheaders/desktop` first.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { _electron, type ElectronApplication, expect, type Locator, type Page, test } from '@playwright/test';

const APP_ROOT = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(__dirname, '../../../..');
// Port etiquette: off every prior suite's ports (18137, 18337–18339,
// 18443, 18537, 18637, 18737, 18747, 18937, 19037, 19039, 19137,
// 19237, 19337, 19437, 19637, 19737–19738, 19937–19938).
const DAEMON_PORT = 19837;

let electronApp: ElectronApplication;
let workbench: Page;
let userData: string;
let workspaceId: string;

let root: string;
let wsDir: string;
let remoteDir: string;
let cloneDir: string;
let appGitConfig: string;
let cloneGitConfig: string;

// ── git helpers (hermetic identity via GIT_CONFIG_GLOBAL) ───────────

function runGit(cwd: string, config: string, args: string[], attempt = 0): string {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, GIT_CONFIG_GLOBAL: config, GIT_TERMINAL_PROMPT: '0' },
    }).trim();
  } catch (err) {
    // A terminal git command can race the engine's own passes on the
    // shared repo (index.lock) — git refuses cleanly; retry like a
    // human would.
    const detail = String((err as { stderr?: unknown; message?: unknown }).stderr ?? (err as Error).message);
    if (detail.includes('index.lock') && attempt < 20) {
      execFileSync('sleep', ['0.25']);
      return runGit(cwd, config, args, attempt + 1);
    }
    throw err;
  }
}

/** The app-side workspace repo, under the app's own identity. */
function ws(...args: string[]): string {
  return runGit(wsDir, appGitConfig, args);
}

/** The peer clone — the "teammate" — under its own foreign identity. */
function clone(...args: string[]): string {
  return runGit(cloneDir, cloneGitConfig, args);
}

/** The bare remote (read-only queries). */
function remote(...args: string[]): string {
  return runGit(root, appGitConfig, ['--git-dir', remoteDir, ...args]);
}

/** App-repo git that tolerates a non-zero exit (`git rebase` stopping on a conflict). */
function wsTry(...args: string[]): boolean {
  try {
    ws(...args);
    return true;
  } catch {
    return false;
  }
}

/** Commit count on the app repo's current branch (0 while HEAD is unborn). */
function commitCount(): number {
  try {
    return Number(ws('rev-list', '--count', 'HEAD'));
  } catch {
    return 0;
  }
}

/** The bare remote's `main` tip, or null before the first push. */
function remoteMain(): string | null {
  try {
    return remote('rev-parse', 'refs/heads/main');
  } catch {
    return null;
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

/** Locate an entity's manifest file by its uid, or null before it materializes. */
function entityFileOf(rootDir: string, uid: string): string | null {
  if (!existsSync(rootDir)) return null;
  for (const file of walkYamlFiles(rootDir)) {
    if (readFileSync(file, 'utf-8').includes(`uid: ${uid}`)) return file;
  }
  return null;
}

function setEntityName(file: string, name: string): void {
  const text = readFileSync(file, 'utf-8');
  writeFileSync(file, text.replace(/^name: .*$/m, `name: ${name}`));
}

function readEntityName(file: string): string {
  const match = readFileSync(file, 'utf-8').match(/^name: (.*)$/m);
  return match ? match[1].trim() : '';
}

/** Rewrite the seeded header row's value in a request manifest. */
function setHeaderValue(file: string, value: string): void {
  const text = readFileSync(file, 'utf-8');
  writeFileSync(file, text.replace(/^(\s+)value: .*$/m, `$1value: ${value}`));
}

function relPosix(file: string): string {
  return path.relative(wsDir, file).split(path.sep).join('/');
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
  electronApp.process().stdout?.on('data', (chunk: Buffer) => process.stdout.write(`[app] ${chunk}`));
  electronApp.process().stderr?.on('data', (chunk: Buffer) => process.stderr.write(`[app!] ${chunk}`));
  workbench = await electronApp.firstWindow();
  workbench.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') console.log(`[renderer:${msg.type()}] ${msg.text()}`);
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
      { timeout: 20_000 },
    )
    .toBe(true);
}

/** Quit through the app (a window close would only hide to tray). */
async function quit(): Promise<void> {
  await electronApp
    .evaluate(({ app }) => {
      app.quit();
    })
    .catch(() => undefined);
  await electronApp.close().catch(() => undefined);
}

function pane(testId: string): Locator {
  return workbench.getByTestId(testId);
}

/**
 * Open Settings → Version Control › Git › <page>. Git is a group node
 * whose children appear in the tree only around an active descendant,
 * so the walk goes through the landing pages (the mcp / daemon-console
 * idiom).
 */
async function openGitSettingsPage(page: 'Folder' | 'Automation'): Promise<void> {
  await workbench.getByRole('button', { name: 'Settings menu' }).click();
  await workbench.getByRole('button', { name: 'Settings…' }).click();
  await workbench
    .locator('.settings-category-nav')
    .getByRole('button', { name: 'Version Control', exact: true })
    .click();
  await workbench.getByRole('button', { name: 'Git', exact: true }).filter({ visible: true }).click();
  await workbench.getByRole('button', { name: page, exact: true }).filter({ visible: true }).click();
}

/**
 * Close the settings modal when one is open through the shell's own
 * Close button (a select left focused by an option pick swallows
 * Escape). Closed antd modals keep their container in the DOM, so
 * assert on visible wraps rather than container presence.
 */
async function closeSettings(): Promise<void> {
  const open = workbench.locator('.ant-modal-wrap:visible');
  if ((await open.count()) === 0) return;
  await workbench.locator('.settings-modal').getByRole('button', { name: 'close', exact: true }).click();
  await expect(open).toHaveCount(0);
}

/** State-driven dock-strip toggle — click only when the state is wrong. */
async function openToolWindow(id: 'commit' | 'git'): Promise<void> {
  const tab = workbench.locator(`[data-tool-window="${id}"]`).first();
  if ((await tab.getAttribute('aria-selected')) !== 'true') {
    await tab.click();
  }
}

/** Tuck a tool window away so the Commit window's changes tree keeps its room. */
async function hideToolWindow(id: 'git' | 'api-requests'): Promise<void> {
  const tab = workbench.locator(`[data-tool-window="${id}"]`).first();
  if ((await tab.getAttribute('aria-selected')) === 'true') {
    await tab.click();
  }
}

/** Pick an option in an antd select by its exact title. */
async function chooseSelectOption(testId: string, label: string): Promise<void> {
  await pane(testId).click();
  await workbench
    .locator(`.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option[title="${label}"]`)
    .click();
}

/** Wait for antd modal zoom motion to settle before clicking inside it. */
async function settleModal(): Promise<void> {
  await expect(workbench.locator('.ant-modal[class*="zoom-"]')).toHaveCount(0);
}

/** The Commit window's counter carries a tracked change (modified / added / deleted). */
async function waitDirty(): Promise<void> {
  await expect(pane('commit-tool-counter')).toContainText(/modified|added|deleted/);
}

/** No tracked change left in the Commit window — the counter is gone or reads unversioned only. */
async function waitClean(): Promise<void> {
  await expect
    .poll(
      async () => {
        const counter = pane('commit-tool-counter');
        if ((await counter.count()) === 0) return true;
        return !/modified|added|deleted/.test(await counter.innerText());
      },
      { timeout: 5_000 },
    )
    .toBe(true);
}

/** The Commit window's row for a tracked file (repo-relative path). */
function changeRow(file: string): Locator {
  return workbench.locator(`[data-testid="commit-tool-file"][data-path="${relPosix(file)}"]`);
}

/** Close the window's error alert — open, it takes the tree's room and covers the rows. */
async function dismissError(): Promise<void> {
  await pane('commit-tool-error').locator('.ant-alert-close-icon').click();
  await expect(pane('commit-tool-error')).toHaveCount(0);
}

/** Edit an entity's name, Commit and Push it; the bare remote takes the new head. */
async function editCommitPush(file: string, name: string, message: string): Promise<void> {
  setEntityName(file, name);
  await waitDirty();
  const before = commitCount();
  await pane('commit-tool-message').fill(message);
  await expect(pane('commit-tool-commit-push')).toBeEnabled();
  await pane('commit-tool-commit-push').click();
  await expect.poll(() => commitCount(), { timeout: 5_000 }).toBe(before + 1);
  await expect.poll(() => remoteMain(), { timeout: 5_000 }).toBe(ws('rev-parse', 'HEAD'));
  await waitClean();
}

/** Fill the message box and Commit; the commit lands and the window settles clean. */
async function commitWithMessage(message: string): Promise<void> {
  const before = commitCount();
  await pane('commit-tool-message').fill(message);
  await expect(pane('commit-tool-commit')).toBeEnabled();
  await pane('commit-tool-commit').click();
  await expect.poll(() => commitCount(), { timeout: 5_000 }).toBe(before + 1);
  await waitClean();
}

/**
 * The row menu's Git ▸ verbs: right-click a change row, slide the
 * pointer into the Git submenu title (rc-menu opens a submenu on a
 * real mouse path, not on a teleported hover; the title's arrow icon
 * joins its accessible name, so it is matched by its own text), click
 * the verb in the popup.
 */
async function rowMenuGit(verb: 'push' | 'pull' | 'fetch' | 'new-branch', file: string): Promise<void> {
  await changeRow(file).click({ button: 'right' });
  const title = workbench
    .locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-submenu-title')
    .filter({ hasText: /^Git$/ });
  await title.waitFor({ state: 'visible' });
  // The dropdown slides in scaled — a box read mid-motion lands the
  // pointer on the wrong row; wait for rc-motion's classes to drop.
  await expect(workbench.locator('.ant-dropdown[class*="-appear"], .ant-dropdown[class*="-enter"]')).toHaveCount(0);
  const box = await title.boundingBox();
  if (box === null) throw new Error('Git submenu title has no box');
  const midY = box.y + box.height / 2;
  await workbench.mouse.move(box.x - 40, midY);
  await workbench.mouse.move(box.x + box.width / 2, midY, { steps: 12 });
  await pane(`commit-tool-menu-${verb}`).click();
}

/** The rail's local branch row carrying the current-branch star. */
async function expectCurrentBranch(name: string): Promise<void> {
  await expect(
    workbench.locator(
      `[data-testid="git-tool-ref-row"][data-kind="local"][data-ref="${name}"] [data-testid="git-tool-ref-star"]`,
    ),
  ).toBeVisible();
}

/**
 * Bring the API Requests sidebar view up with the seeded collection
 * expanded, outside the settings modal. State-driven, never
 * toggle-and-hope (the extension WorkbenchPage idiom): the dock tab
 * carries `aria-selected`, the REQUESTS section header `aria-expanded`.
 */
async function openApiRequestsSidebar(): Promise<void> {
  // Collapse the Docs panel first — its first-run tour overlay can
  // swallow synthetic clicks aimed at the editor tabs.
  const docsTab = workbench.locator('[data-tool-window="docs"]').first();
  if ((await docsTab.getAttribute('aria-selected').catch(() => null)) === 'true') {
    await docsTab.click();
  }
  const viewTab = workbench.locator('[data-tool-window="api-requests"]').first();
  if ((await viewTab.getAttribute('aria-selected')) !== 'true') {
    await viewTab.click();
  }
  const sectionHeader = workbench
    .getByRole('button', { name: /REQUESTS/ })
    .filter({ visible: true })
    .first();
  await sectionHeader.waitFor({ state: 'visible', timeout: 5_000 });
  if ((await sectionHeader.getAttribute('aria-expanded')) !== 'true') {
    await sectionHeader.click();
  }
  const collectionRow = workbench.locator('[data-item-id="req-col-e2egcol1"]');
  await collectionRow.waitFor({ state: 'visible', timeout: 5_000 });
  const requestRow = workbench.locator('[data-item-id="request-e2egreq1"]');
  if (!(await requestRow.isVisible().catch(() => false))) {
    await collectionRow.click();
    await requestRow.waitFor({ state: 'visible', timeout: 5_000 });
  }
}

/** Literal text of a TemplateInput grid cell (contentEditable; NBSP-normalized). */
async function cellText(cell: Locator): Promise<string> {
  return (await cell.locator('.oh-template-input-editable').innerText()).replace(/ /g, ' ').trim();
}

/** Replace a TemplateInput grid cell's content (select-all + insertText). */
async function fillCell(cell: Locator, text: string): Promise<void> {
  await cell.locator('.oh-template-input-editable').click();
  await workbench.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await workbench.keyboard.press('Backspace');
  await workbench.keyboard.insertText(text);
}

/** Activate a request-editor tab and VERIFY it took (retrying once). */
async function selectEditorTab(name: RegExp): Promise<void> {
  const tab = workbench.getByRole('tab', { name }).filter({ visible: true }).first();
  for (let attempt = 0; attempt < 3; attempt++) {
    await tab.click();
    try {
      await expect(tab).toHaveAttribute('aria-selected', 'true');
      return;
    } catch {
      // Overlay ate the click — try again.
    }
  }
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'oh-git-desktop-e2e-'));
  userData = path.join(root, 'user-data');
  wsDir = path.join(root, 'ws');
  remoteDir = path.join(root, 'remote.git');
  cloneDir = path.join(root, 'clone');
  appGitConfig = path.join(root, 'app-gitconfig');
  cloneGitConfig = path.join(root, 'clone-gitconfig');
  mkdirSync(userData);
  mkdirSync(path.join(userData, 'data'));
  mkdirSync(wsDir);
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
      values: { 'oh.settings.user': { 'backend.bindPort': DAEMON_PORT } },
      secrets: {},
    }),
  );

  // Phase 1: boot once to mint the default workspace and learn its id.
  await launchApp();
  const res = await invoke<{ activeWorkspaceId: string | null }>({ type: 'getActiveWorkspaceId' });
  expect(res.activeWorkspaceId).toBeTruthy();
  workspaceId = res.activeWorkspaceId as string;
  await quit();

  // Seed the workspace slots with schema-validated entities (tsx via
  // the extension package — the one that carries the tsx devDep).
  const seeded = spawnSync(
    'pnpm',
    ['--filter', '@openheaders/extension', 'exec', 'tsx', path.join(__dirname, 'fixtures/git-desktop-seed.ts')],
    {
      cwd: REPO_ROOT,
      env: { ...process.env, OH_E2E_WORKSPACE_ID: workspaceId },
      encoding: 'utf-8',
    },
  );
  expect(seeded.status, seeded.stderr).toBe(0);
  const storagePath = path.join(userData, 'data', 'settings.json');
  const envelope = JSON.parse(readFileSync(storagePath, 'utf-8')) as { values: Record<string, unknown> };
  Object.assign(envelope.values, JSON.parse(seeded.stdout) as Record<string, unknown>);
  writeFileSync(storagePath, JSON.stringify(envelope));

  // Phase 2: relaunch on the seeded slots.
  await launchApp();
});

test.afterAll(async () => {
  if (electronApp) await quit();
});

// ── G1: bind + repo auto-init + materialization ─────────────────────

test('G1 — bind on the Folder page auto-inits the repo; the Commit window counts the seeded tree unversioned', async () => {
  await openGitSettingsPage('Folder');
  await pane('git-pane-path-input').fill(wsDir);
  await pane('git-pane-bind-button').click();
  await expect(pane('git-pane-unbind-button')).toBeVisible();
  expect(existsSync(path.join(wsDir, '.git'))).toBe(true);
  expect(existsSync(path.join(wsDir, '.gitattributes'))).toBe(true);
  expect(existsSync(path.join(wsDir, '.gitignore'))).toBe(true);
  expect(existsSync(path.join(wsDir, 'workspace.yaml'))).toBe(true);

  await expect.poll(() => entityFileOf(wsDir, 'e2egreq1') !== null, { timeout: 5_000 }).toBe(true);
  await expect.poll(() => entityFileOf(wsDir, 'e2egreq2') !== null, { timeout: 5_000 }).toBe(true);
  await expect.poll(() => entityFileOf(wsDir, 'e2egcol1') !== null, { timeout: 5_000 }).toBe(true);

  await closeSettings();
  await openToolWindow('commit');
  await expect(pane('commit-tool-counter')).toContainText('unversioned');
});

// ── G2: real commit under the real identity ─────────────────────────

test('G2 — the Commit window lands a real commit under the configured identity and leaves git status clean', async () => {
  await pane('commit-tool-group-unversioned-check').click();
  await commitWithMessage('git e2e: initial tree');

  expect(ws('status', '--porcelain')).toBe('');
  expect(ws('rev-list', '--count', 'HEAD')).toBe('1');
  expect(ws('log', '-1', '--format=%an <%ae>')).toBe('OH E2E <e2e@openheaders.io>');
  expect(ws('log', '-1', '--format=%s')).toBe('git e2e: initial tree');
});

// ── G3: hand edit → sweep → the Changes row + counter ───────────────

test('G3 — a live hand edit sweeps in: the file joins Changes, the counter reads modified, a message commits it', async () => {
  const req1 = entityFileOf(wsDir, 'e2egreq1') as string;
  setEntityName(req1, 'Status Probe Renamed');

  await waitDirty();
  await expect(changeRow(req1)).toBeVisible();
  await expect(pane('commit-tool-counter')).toContainText('1 modified');

  await commitWithMessage('git e2e: status probe renamed');
  expect(ws('log', '-1', '--format=%s')).toBe('git e2e: status probe renamed');
  expect(ws('status', '--porcelain')).toBe('');
});

// ── G4: hooks block, bypass lets through ────────────────────────────

test('G4 — a failing pre-commit blocks with its output; the Automation bypass-hooks switch lets the commit land', async () => {
  const hook = path.join(wsDir, '.git', 'hooks', 'pre-commit');
  writeFileSync(hook, '#!/bin/sh\necho "pre-commit says no"\nexit 1\n');
  chmodSync(hook, 0o755);

  const req2 = entityFileOf(wsDir, 'e2egreq2') as string;
  setEntityName(req2, 'Health Probe Hooked');
  await waitDirty();

  await pane('commit-tool-message').fill('git e2e: hooked');
  await pane('commit-tool-commit').click();
  await expect(pane('commit-tool-error')).toContainText('pre-commit says no');

  await openGitSettingsPage('Automation');
  await pane('git-pane-bypass-hooks-switch').click();
  await expect(pane('git-pane-bypass-hooks-warning')).toBeVisible();
  await closeSettings();
  await pane('commit-tool-commit').click();
  await waitClean();
  expect(ws('log', '-1', '--format=%s')).toBe('git e2e: hooked');

  await openGitSettingsPage('Automation');
  await pane('git-pane-bypass-hooks-switch').click();
  await expect(pane('git-pane-bypass-hooks-warning')).toBeHidden();
  await closeSettings();
  rmSync(hook);
});

// ── G5: Commit and Push establishes tracking on the lone remote ─────

test('G5 — Commit and Push establishes tracking; the bare remote holds the local head', async () => {
  runGit(root, appGitConfig, ['init', '--bare', remoteDir]);
  ws('remote', 'add', 'origin', remoteDir);

  const req2 = entityFileOf(wsDir, 'e2egreq2') as string;
  await editCommitPush(req2, 'Push Me', 'git e2e: push me');
  expect(ws('rev-parse', '--abbrev-ref', '@{upstream}')).toBe('origin/main');
  expect(ws('log', '-1', '--format=%s')).toBe('git e2e: push me');
});

// ── G6: foreign push → true fast-forward pull ───────────────────────

test('G6 — a foreign push fast-forwards on Pull with no merge bubble', async () => {
  runGit(root, cloneGitConfig, ['clone', remoteDir, cloneDir]);
  const cReq1 = entityFileOf(cloneDir, 'e2egreq1') as string;
  setEntityName(cReq1, 'Foreign Edit');
  clone('commit', '-a', '-m', 'clone: rename status probe');
  clone('push');
  const foreignSha = clone('rev-parse', 'HEAD');

  // A clean tree has no change row to open the window's Git ▸ menu
  // from — the pull rides the verb the menu calls (the spine leg).
  const pulled = await invoke<{ ok: boolean; reason?: string; detail?: string }>({
    type: 'oh.workspaceTree.pull',
    workspaceId,
  });
  expect(pulled.ok, JSON.stringify(pulled)).toBe(true);
  await expect.poll(() => ws('rev-parse', 'HEAD'), { timeout: 5_000 }).toBe(foreignSha);
  const req1 = entityFileOf(wsDir, 'e2egreq1') as string;
  expect(readFileSync(req1, 'utf-8')).toContain('Foreign Edit');
  await waitClean();
  expect(ws('status', '--porcelain')).toBe('');
});

// ── G7: divergence → two-parent merge with trailers ─────────────────

test('G7 — both sides edited: Pull lands a two-parent merge with Co-Authored-By and zero markers; Push converges', async () => {
  const req2 = entityFileOf(wsDir, 'e2egreq2') as string;
  setEntityName(req2, 'Local Edit');
  await waitDirty();

  const cReq1 = entityFileOf(cloneDir, 'e2egreq1') as string;
  setEntityName(cReq1, 'Foreign Edit Two');
  clone('commit', '-a', '-m', 'clone: second rename');
  clone('push');

  await rowMenuGit('pull', req2);
  await expect.poll(() => ws('rev-list', '--parents', '-1', 'HEAD').split(' ').length, { timeout: 5_000 }).toBe(3);
  expect(ws('log', '-1', '--format=%B')).toContain('Co-Authored-By: Clone Author <clone@openheaders.io>');
  for (const file of walkYamlFiles(wsDir)) {
    expect(readFileSync(file, 'utf-8')).not.toContain('<<<<<<<');
  }
  expect(readFileSync(entityFileOf(wsDir, 'e2egreq1') as string, 'utf-8')).toContain('Foreign Edit Two');
  expect(readFileSync(entityFileOf(wsDir, 'e2egreq2') as string, 'utf-8')).toContain('Local Edit');
  await waitClean();

  await editCommitPush(req2, 'Local Edit Pushed', 'git e2e: local edit pushed');
});

// ── G8: schema-broken foreign file quarantines, then clears ─────────

test('G8 — a schema-invalid foreign file quarantines on Pull (Folder page issue) and clears after the peer fixes it', async () => {
  clone('pull');
  const cReq1 = entityFileOf(cloneDir, 'e2egreq1') as string;
  const valid = readFileSync(cReq1, 'utf-8');
  writeFileSync(cReq1, valid.replace(/^method: .*$/m, 'method: connect'));
  clone('commit', '-a', '-m', 'clone: break the schema');
  clone('push');

  const req2 = entityFileOf(wsDir, 'e2egreq2') as string;
  setEntityName(req2, 'Quarantine Local');
  await waitDirty();
  await rowMenuGit('pull', req2);
  await expect
    .poll(() => readFileSync(entityFileOf(wsDir, 'e2egreq1') as string, 'utf-8').includes('method: connect'), {
      timeout: 5_000,
    })
    .toBe(true);
  // The foreign bytes stand on disk for revert-or-fix; the Folder page
  // lists the quarantined document.
  await openGitSettingsPage('Folder');
  await expect(pane('git-pane-issues-alert')).toBeVisible();
  await expect(pane('git-pane-issues-alert')).toContainText('request.yaml');
  await closeSettings();

  const broken = readFileSync(cReq1, 'utf-8');
  writeFileSync(cReq1, broken.replace(/^method: .*$/m, 'method: GET'));
  clone('commit', '-a', '-m', 'clone: fix the schema');
  clone('push');

  setEntityName(req2, 'Quarantine Local Two');
  await waitDirty();
  await rowMenuGit('pull', req2);
  await expect
    .poll(() => readFileSync(entityFileOf(wsDir, 'e2egreq1') as string, 'utf-8').includes('method: GET'), {
      timeout: 5_000,
    })
    .toBe(true);
  await openGitSettingsPage('Folder');
  await expect(pane('git-pane-unbind-button')).toBeVisible();
  await expect(pane('git-pane-issues-alert')).toHaveCount(0);
  await closeSettings();
});

// ── G9: the push refusal on a stale push ────────────────────────────

test('G9 — pushing behind the remote is refused in the window; pull then push converges', async () => {
  clone('pull');
  const cReq1 = entityFileOf(cloneDir, 'e2egreq1') as string;
  setEntityName(cReq1, 'Nudge Foreign');
  clone('commit', '-a', '-m', 'clone: nudge edit');
  clone('push');

  const req2 = entityFileOf(wsDir, 'e2egreq2') as string;
  setEntityName(req2, 'Nudge Local');
  await waitDirty();
  const before = commitCount();
  await pane('commit-tool-message').fill('git e2e: nudge local');
  await pane('commit-tool-commit-push').click();
  await expect.poll(() => commitCount(), { timeout: 5_000 }).toBe(before + 1);
  await expect(pane('commit-tool-error')).toContainText('Push failed');
  expect(remoteMain()).not.toBe(ws('rev-parse', 'HEAD'));
  await dismissError();

  setEntityName(req2, 'Nudge Local Two');
  await waitDirty();
  await rowMenuGit('pull', req2);
  await expect.poll(() => ws('rev-list', '--parents', '-1', 'HEAD').split(' ').length, { timeout: 5_000 }).toBe(3);
  await waitClean();
  await editCommitPush(req2, 'Nudge Local Three', 'git e2e: nudge converge');
});

// ── G14: New Branch with checkout rides dirty work along ────────────

test('G14 — New Branch with checkout carries the dirty tree onto the new branch; the rail star moves', async () => {
  const req2 = entityFileOf(wsDir, 'e2egreq2') as string;
  setEntityName(req2, 'Branch Dirty Work');
  await waitDirty();

  await openToolWindow('git');
  await expectCurrentBranch('main');
  await pane('git-tool-rail-new-branch').click();
  await settleModal();
  await pane('git-tool-create-branch-name').fill('local-test');
  await expect(pane('git-tool-create-branch-checkout')).toBeChecked();
  await workbench.getByRole('button', { name: 'Create', exact: true }).click();

  await expectCurrentBranch('local-test');
  expect(ws('symbolic-ref', 'HEAD')).toBe('refs/heads/local-test');
  expect(ws('status', '--porcelain')).not.toBe('');
  expect(readFileSync(req2, 'utf-8')).toContain('Branch Dirty Work');
});

// ── G16: terminal checkout reconciles, incl. the bare HEAD move ─────

test('G16 — a terminal git checkout while the app runs moves the rail, including between identical trees', async () => {
  // Land the branch's dirty work on the branch, then move HEAD by hand.
  await commitWithMessage('git e2e: branch side edit');
  ws('checkout', 'main');
  await expectCurrentBranch('main');

  // Bare HEAD move: twin points at the same commit — identical trees.
  ws('branch', 'twin');
  ws('checkout', 'twin');
  await expectCurrentBranch('twin');
  ws('checkout', 'main');
  await expectCurrentBranch('main');
});

// ── G18: live watcher conflict chip in the request editor ───────────

test('G18 — a hand edit against a locally edited field raises the conflict chip; Use saved adopts it', async () => {
  await openApiRequestsSidebar();
  await workbench.locator('[data-item-id="request-e2egreq1"]').click();
  await selectEditorTab(/Headers/);

  // Local uncommitted edit on the seeded header's value.
  const valueCell = workbench.locator('[data-field-path="headers.e2eghdr1.value"]').filter({ visible: true }).first();
  await expect.poll(() => cellText(valueCell), { timeout: 5_000 }).toBe('probe-one');
  await fillCell(valueCell, 'probe-mine');

  // The teammate-shaped hand edit to the same leaf sweeps in.
  const req1 = entityFileOf(wsDir, 'e2egreq1') as string;
  setHeaderValue(req1, 'probe-theirs');

  const chip = valueCell.getByTestId('conflict-diff-chip');
  await expect(chip).toBeVisible();
  await chip.click();
  await workbench.getByRole('button', { name: 'Use saved' }).click();
  await expect.poll(() => cellText(valueCell), { timeout: 5_000 }).toBe('probe-theirs');
  await expect(chip).toBeHidden();
});

// ── G19: terminal `git revert` round-trips into app state ───────────

test('G19 — a terminal git revert of an app commit reverts the entity in the UI and stays clean', async () => {
  // Commit the G18 residue (the swept-in header value) first.
  await waitDirty();
  await commitWithMessage('git e2e: chip residue');

  const req2 = entityFileOf(wsDir, 'e2egreq2') as string;
  const before = readEntityName(req2);
  setEntityName(req2, 'Revert Target');
  await waitDirty();
  await commitWithMessage('git e2e: revert target');
  const count = commitCount();

  ws('revert', '--no-edit', 'HEAD');
  expect(commitCount()).toBe(count + 1);
  expect(readFileSync(req2, 'utf-8')).not.toContain('Revert Target');

  // The sweep ingests the reverted bytes: the UI shows the reverted name
  // and the engine converges without a counter-write.
  await openApiRequestsSidebar();
  await expect(workbench.locator('[data-item-id="request-e2egreq2"]')).toContainText(before);
  await waitClean();
  expect(commitCount()).toBe(count + 1);
});

// ── G20: cadence auto — user-index pause + quiescence commit ────────

test('G20 — cadence auto pauses while the user index is staged and commits after quiescence once it clears', async () => {
  await openGitSettingsPage('Automation');
  await chooseSelectOption('git-pane-cadence-select', 'After quiet edits');
  await closeSettings();

  // Stage something as "the user" — auto-commit must stand down.
  const staged = path.join(wsDir, 'user-staged.txt');
  writeFileSync(staged, 'wip\n');
  ws('add', 'user-staged.txt');
  const count = commitCount();

  const req2 = entityFileOf(wsDir, 'e2egreq2') as string;
  setEntityName(req2, 'Cadence Paused');
  await waitDirty();
  // Quiescence (2s) passes with the index busy — no commit may land,
  // and the user's staged file must survive untouched throughout.
  for (let tick = 1; tick <= 8; tick++) {
    await workbench.waitForTimeout(500);
    expect(existsSync(staged), `user-staged.txt vanished at t=${tick * 500}ms`).toBe(true);
    expect(commitCount()).toBe(count);
  }

  // Clearing the index and editing again resumes the cadence.
  ws('reset');
  rmSync(staged);
  setEntityName(req2, 'Cadence Landed');
  await expect.poll(() => commitCount(), { timeout: 5_000 }).toBe(count + 1);
  await waitClean();
  expect(readFileSync(req2, 'utf-8')).toContain('Cadence Landed');

  await openGitSettingsPage('Automation');
  await chooseSelectOption('git-pane-cadence-select', 'Off — commit manually');
  await closeSettings();
});

// ── G21: cadence on-blur through the appBlur RPC ────────────────────

test('G21 — cadence on-blur commits when the appBlur RPC fires', async () => {
  await openGitSettingsPage('Automation');
  await chooseSelectOption('git-pane-cadence-select', 'When focus leaves the app');
  await closeSettings();

  const req2 = entityFileOf(wsDir, 'e2egreq2') as string;
  setEntityName(req2, 'Blur Pending');
  await waitDirty();
  const count = commitCount();

  await invoke({ type: 'oh.workspaceTree.appBlur' });
  await expect.poll(() => commitCount(), { timeout: 5_000 }).toBe(count + 1);
  await waitClean();
  expect(readFileSync(req2, 'utf-8')).toContain('Blur Pending');

  await openGitSettingsPage('Automation');
  await chooseSelectOption('git-pane-cadence-select', 'Off — commit manually');
  await closeSettings();
});

// ── G22: a mid-rebase repo holds reconcile until --abort ────────────

test('G22 — a mid-rebase repo holds reconcile: Pull refuses, held edits never ingest, abort resumes', async () => {
  // Cheap conflict fixture: the same README line diverges on two branches.
  const readme = path.join(wsDir, 'README.md');
  writeFileSync(readme, 'base\n');
  ws('add', 'README.md');
  ws('commit', '-m', 'readme base');
  ws('checkout', '-b', 'rebase-side');
  await expectCurrentBranch('rebase-side');
  writeFileSync(readme, 'side\n');
  ws('commit', '-a', '-m', 'readme side');
  ws('checkout', 'main');
  await expectCurrentBranch('main');
  writeFileSync(readme, 'trunk\n');
  ws('commit', '-a', '-m', 'readme trunk');
  ws('checkout', 'rebase-side');
  await expectCurrentBranch('rebase-side');

  expect(wsTry('rebase', 'main')).toBe(false);
  expect(
    existsSync(path.join(wsDir, '.git', 'rebase-merge')) || existsSync(path.join(wsDir, '.git', 'rebase-apply')),
  ).toBe(true);

  // A held hand edit must never reach the engine: the sidebar keeps the
  // committed name.
  const req2 = entityFileOf(wsDir, 'e2egreq2') as string;
  const before = readEntityName(req2);
  setEntityName(req2, 'Held Edit');
  await workbench.waitForTimeout(3_000);
  await openApiRequestsSidebar();
  await expect(workbench.locator('[data-item-id="request-e2egreq2"]')).toContainText(before);
  await expect(workbench.locator('[data-item-id="request-e2egreq2"]')).not.toContainText('Held Edit');

  // Gestures refuse while the operation is in progress. The row gesture
  // needs the changes tree's room: tuck the sidebar view and the Git
  // window away first.
  await hideToolWindow('api-requests');
  await hideToolWindow('git');
  await rowMenuGit('pull', req2);
  await expect(pane('commit-tool-error')).toContainText('Pull failed: op-in-progress');
  await dismissError();

  ws('rebase', '--abort');
  expect(existsSync(path.join(wsDir, '.git', 'rebase-merge'))).toBe(false);
  ws('checkout', 'main');
  await openToolWindow('git');
  await expectCurrentBranch('main');
  ws('branch', '-D', 'rebase-side');

  // The plane is live again: an edit sweeps in and commits.
  setEntityName(req2, 'After Abort');
  await waitDirty();
  await expect(workbench.locator('[data-item-id="request-e2egreq2"]')).toContainText('After Abort');
  await commitWithMessage('git e2e: after abort');
});

// ── G23: close-app → vim-edit → reopen — the edit wins in the UI ────

test('G23 — an offline hand edit lands in the UI on relaunch via the cold-boot tree-wins sweep', async () => {
  const req1 = entityFileOf(wsDir, 'e2egreq1') as string;
  await quit();
  setEntityName(req1, 'Vim Offline Edit');
  await launchApp();

  await openApiRequestsSidebar();
  await expect(workbench.locator('[data-item-id="request-e2egreq1"]')).toContainText('Vim Offline Edit');

  await openToolWindow('commit');
  await waitDirty();
  await commitWithMessage('git e2e: offline edit');
  expect(ws('log', '-1', '--format=%s')).toBe('git e2e: offline edit');
});

// ── G24: unbind — clean detach, bind form returns, window flips ─────

test('G24 — unbind detaches cleanly: lock released, tree intact, bind form back, Commit window unbound', async () => {
  const req2 = entityFileOf(wsDir, 'e2egreq2') as string;
  setEntityName(req2, 'Unbind Dirty');
  await waitDirty();

  await openGitSettingsPage('Folder');
  await pane('git-pane-unbind-button').click();
  await workbench.locator('.ant-popover:not(.ant-popover-hidden)').getByRole('button', { name: 'Unbind' }).click();

  // The page returns to the bind form; the folder stays a valid tree.
  await expect(pane('git-pane-path-input')).toBeVisible();
  await expect.poll(() => existsSync(path.join(wsDir, '.oh', 'lock')), { timeout: 5_000 }).toBe(false);
  expect(existsSync(path.join(wsDir, '.git'))).toBe(true);
  expect(readFileSync(req2, 'utf-8')).toContain('Unbind Dirty');

  // The Commit window flips to its bind posture with the binding gone.
  await closeSettings();
  await expect(pane('commit-tool-not-bound')).toBeVisible();
  await expect(pane('commit-tool-bind-path-input')).toBeVisible();
});
