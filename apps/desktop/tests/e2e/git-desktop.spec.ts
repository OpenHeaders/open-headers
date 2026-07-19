/**
 * Git desktop e2e — the P2→P6 combined pass's automatable core on the
 * REAL stack: the built desktop app, the settings Git card driving the
 * workspace-tree runtime, real repos on disk (a bare remote + a peer
 * clone standing in for the teammate), the system git binary under a
 * hermetic GIT_CONFIG_GLOBAL identity.
 *
 *   G1   bind via the path input: repo auto-init (.git, .gitattributes,
 *        .gitignore, workspace.yaml), seeded entities materialize, the
 *        card reads dirty.
 *   G2   Commit lands a real commit under the configured git identity;
 *        `git status` stays clean after the engine commit.
 *   G3   a hand edit while the app runs sweeps in: dirty count moves,
 *        the semantic draft reads "Update request", the status pill's
 *        popover carries the uncommitted slot, committing the draft
 *        uses it as the message.
 *   G4   a failing pre-commit blocks with its output in the card; the
 *        bypass-hooks switch (with its standing warning) lets the same
 *        commit land.
 *   G5   Push establishes tracking on the lone remote; the remote line
 *        settles on "in sync"; the bare remote holds the local head.
 *   G6   a foreign push fast-forwards on Pull — no merge bubble, the
 *        local head IS the foreign sha, the edit reaches the worktree.
 *   G7   both sides edited → Pull lands a TWO-PARENT merge commit with
 *        a Co-Authored-By trailer and zero conflict markers.
 *   G8   a schema-broken foreign file quarantines on Pull (issue row in
 *        the card, foreign bytes preserved on disk) and clears once the
 *        peer pushes a fix.
 *   G9   pushing behind the remote raises the pull-first nudge; pull
 *        then push converges.
 *   G10  a rejecting pre-receive classifies as "No push access";
 *        Push-as-New-Branch lands refs/heads/<name> once the hook is
 *        gone.
 *   G11  force-pushed remote → RED pill + trichotomy alert, Pull/Push
 *        held; Abandon converges onto the rewritten history.
 *   G12  trichotomy: Preserve mints an oh-rescue-* branch carrying the
 *        pre-rewrite work (including just-uncommitted edits).
 *   G13  trichotomy: Re-apply lands "Re-apply local changes" on top of
 *        the new history with both sides' edits live.
 *   G14  Create & Switch carries a dirty tree onto the new branch.
 *   G15  switching with a dirty tree raises the Commit / Stash /
 *        Discard modal — all three contracts (commit on the OLD branch,
 *        stash recoverable, discard total while .oh/ survives).
 *   G16  a terminal `git checkout` while the app runs reconciles the
 *        card — including a bare HEAD move between identical trees.
 *   G17  the card's merge select: diverged branches land a clean
 *        two-parent commit; merging back fast-forwards.
 *   G18  live watcher conflict chip: with the request editor holding a
 *        local edit on a header value, a hand edit to the same leaf
 *        sweeps in and raises the chip; Use saved adopts it.
 *   G19  a terminal `git revert` of an app commit round-trips into app
 *        state (§10 P4 acceptance): the sidebar label reverts, the
 *        semantic draft re-arms, the tree stays clean.
 *   G20  cadence `auto`: commits after ~2s quiescence, pauses while
 *        the user's own index is staged (card indexBusy line), and
 *        lands once the index clears.
 *   G21  cadence `on-blur` via the `oh.workspaceTree.appBlur` RPC —
 *        the spine + runtime leg (real cmd-tab blur stays manual).
 *   G22  a mid-`git rebase` repo holds reconcile — gestures refuse
 *        with op-in-progress, held hand edits are never ingested —
 *        and `--abort` resumes the plane.
 *   G23  close-app → vim-edit → reopen: the cold-boot tree-wins sweep
 *        lands the offline edit in the UI (sidebar label) and dirty.
 *   G24  unbind: clean detach (lock released, repo + tree intact),
 *        the card returns to the bind form, the pill git slot drops.
 *
 * Deliberately NOT here (the manual live pass): the native folder
 * picker, real cmd-tab blur cadence, the ~5m fetch/commit timers
 * (`every-5m` shares `enqueueAutoCommit` with G20/G21 — the wall-clock
 * trigger has no compression seam and stays manual), and
 * packaged-build behavior.
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

/** Commit count on the app repo's current branch. */
function commitCount(): number {
  return Number(ws('rev-list', '--count', 'HEAD'));
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
      { timeout: 45_000 },
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

async function openGitPane(): Promise<void> {
  await workbench.getByRole('button', { name: 'Settings menu' }).click();
  await workbench.getByRole('button', { name: 'Settings…' }).click();
  await workbench.locator('.settings-category-nav').getByText('Git', { exact: true }).click();
}

/** Pick an option in an antd select by its exact title. */
async function chooseSelectOption(testId: string, label: string): Promise<void> {
  await pane(testId).click();
  await workbench
    .locator(`.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option[title="${label}"]`)
    .click();
}

/**
 * Click a button inside the §6.2 switch modal. The dialog zoom-animates
 * in; a click dispatched mid-motion lands on the moving layer and the
 * handler never fires — wait for rc-motion's transient classes to drop
 * before clicking.
 */
async function clickSwitchChoice(testId: string): Promise<void> {
  await pane(testId).waitFor({ state: 'visible', timeout: 15_000 });
  await expect(workbench.locator('.ant-modal[class*="zoom-"]')).toHaveCount(0, { timeout: 10_000 });
  await pane(testId).click();
}

async function waitDirty(): Promise<void> {
  await expect(pane('git-pane-dirty-count')).toContainText('uncommitted', { timeout: 30_000 });
}

async function waitClean(): Promise<void> {
  await expect(pane('git-pane-dirty-count')).toContainText('Working tree clean', { timeout: 30_000 });
}

/** The status pill's popover message rows (any subsystem). */
function popoverMessages(): Locator {
  return workbench.locator('[data-testid^="status-popover-message-"]');
}

/**
 * Close the settings modal. Closed antd modals keep their container in
 * the DOM, so assert on visible wraps rather than container presence.
 */
async function closeSettings(): Promise<void> {
  await workbench.keyboard.press('Escape');
  await expect(workbench.locator('.ant-modal-wrap:visible')).toHaveCount(0, { timeout: 10_000 });
}

/**
 * The statusbar pill sits UNDER the settings modal — close settings,
 * assert the pill popover carries `text`, reopen the Git pane.
 */
async function expectPillMessage(text: string): Promise<void> {
  await closeSettings();
  await workbench.getByTestId('status-pill').click();
  await expect(popoverMessages().filter({ hasText: text })).toBeVisible({ timeout: 15_000 });
  await workbench.getByTestId('status-pill').click();
  await openGitPane();
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
  await sectionHeader.waitFor({ state: 'visible', timeout: 15_000 });
  if ((await sectionHeader.getAttribute('aria-expanded')) !== 'true') {
    await sectionHeader.click();
  }
  const collectionRow = workbench.locator('[data-item-id="req-col-e2egcol1"]');
  await collectionRow.waitFor({ state: 'visible', timeout: 15_000 });
  const requestRow = workbench.locator('[data-item-id="request-e2egreq1"]');
  if (!(await requestRow.isVisible().catch(() => false))) {
    await collectionRow.click();
    await requestRow.waitFor({ state: 'visible', timeout: 15_000 });
  }
}

/** Literal text of a TemplateInput grid cell (contentEditable; NBSP-normalized). */
async function cellText(cell: Locator): Promise<string> {
  return (await cell.locator('.oh-template-input-editable').innerText()).replace(/\u00a0/g, ' ').trim();
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
      await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 5_000 });
      return;
    } catch {
      // Overlay ate the click — try again.
    }
  }
  await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 5_000 });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  test.setTimeout(240_000);
  root = await mkdtemp(path.join(tmpdir(), 'oh-git-desktop-e2e-'));
  userData = path.join(root, 'user-data');
  wsDir = path.join(root, 'ws');
  remoteDir = path.join(root, 'remote.git');
  cloneDir = path.join(root, 'clone');
  appGitConfig = path.join(root, 'app-gitconfig');
  cloneGitConfig = path.join(root, 'clone-gitconfig');
  mkdirSync(userData);
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
    path.join(userData, 'storage.json'),
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
  const storagePath = path.join(userData, 'storage.json');
  const envelope = JSON.parse(readFileSync(storagePath, 'utf-8')) as { values: Record<string, unknown> };
  Object.assign(envelope.values, JSON.parse(seeded.stdout) as Record<string, unknown>);
  writeFileSync(storagePath, JSON.stringify(envelope));

  // Phase 2: relaunch on the seeded slots and open the Git card.
  await launchApp();
  await openGitPane();
});

test.afterAll(async () => {
  if (electronApp) await quit();
});

// ── G1: bind + repo auto-init + materialization ─────────────────────

test('G1 — bind auto-inits the repo and materializes the seeded tree dirty', async () => {
  test.setTimeout(120_000);
  await pane('git-pane-path-input').fill(wsDir);
  await pane('git-pane-bind-button').click();

  await expect(pane('git-pane-dirty-count')).toBeVisible({ timeout: 45_000 });
  expect(existsSync(path.join(wsDir, '.git'))).toBe(true);
  expect(existsSync(path.join(wsDir, '.gitattributes'))).toBe(true);
  expect(existsSync(path.join(wsDir, '.gitignore'))).toBe(true);
  expect(existsSync(path.join(wsDir, 'workspace.yaml'))).toBe(true);

  await expect.poll(() => entityFileOf(wsDir, 'e2egreq1') !== null, { timeout: 30_000 }).toBe(true);
  await expect.poll(() => entityFileOf(wsDir, 'e2egreq2') !== null, { timeout: 30_000 }).toBe(true);
  await expect.poll(() => entityFileOf(wsDir, 'e2egcol1') !== null, { timeout: 30_000 }).toBe(true);
  await waitDirty();
});

// ── G2: real commit under the real identity ─────────────────────────

test('G2 — Commit lands a real commit under the configured identity and leaves git status clean', async () => {
  test.setTimeout(120_000);
  await pane('git-pane-commit-message').fill('git e2e: initial tree');
  await pane('git-pane-commit-button').click();

  await waitClean();
  expect(ws('status', '--porcelain')).toBe('');
  expect(ws('rev-list', '--count', 'HEAD')).toBe('1');
  expect(ws('log', '-1', '--format=%an <%ae>')).toBe('OH E2E <e2e@openheaders.io>');
  expect(ws('log', '-1', '--format=%s')).toBe('git e2e: initial tree');
});

// ── G3: hand edit → sweep → dirty + draft + pill ────────────────────

test('G3 — a live hand edit sweeps in: dirty count, semantic draft, pill slot, draft commit', async () => {
  test.setTimeout(120_000);
  const req1 = entityFileOf(wsDir, 'e2egreq1') as string;
  setEntityName(req1, 'Status Probe Renamed');

  await waitDirty();
  await expect
    .poll(async () => await pane('git-pane-commit-message').getAttribute('placeholder'), { timeout: 30_000 })
    .toBe('Update request');

  // The pill's git slot joins the status popover while dirty.
  await expectPillMessage('uncommitted');

  // Committing with an empty message uses the semantic draft.
  await pane('git-pane-commit-button').click();
  await waitClean();
  expect(ws('log', '-1', '--format=%s')).toBe('Update request');
});

// ── G4: hooks block, bypass lets through ────────────────────────────

test('G4 — a failing pre-commit blocks with its output; bypass-hooks lets the commit land', async () => {
  test.setTimeout(120_000);
  const hook = path.join(wsDir, '.git', 'hooks', 'pre-commit');
  writeFileSync(hook, '#!/bin/sh\necho "pre-commit says no"\nexit 1\n');
  chmodSync(hook, 0o755);

  const req2 = entityFileOf(wsDir, 'e2egreq2') as string;
  setEntityName(req2, 'Health Probe Hooked');
  await waitDirty();

  await pane('git-pane-commit-button').click();
  await expect(pane('git-pane-commit-error')).toContainText('pre-commit says no', { timeout: 30_000 });

  await pane('git-pane-bypass-hooks-switch').click();
  await expect(pane('git-pane-bypass-hooks-warning')).toBeVisible({ timeout: 15_000 });
  await pane('git-pane-commit-button').click();
  await waitClean();

  await pane('git-pane-bypass-hooks-switch').click();
  await expect(pane('git-pane-bypass-hooks-warning')).toBeHidden({ timeout: 15_000 });
  rmSync(hook);
});

// ── G5: first push establishes tracking on the lone remote ──────────

test('G5 — Push establishes tracking and the remote line settles on in-sync', async () => {
  test.setTimeout(120_000);
  runGit(root, appGitConfig, ['init', '--bare', remoteDir]);
  ws('remote', 'add', 'origin', remoteDir);

  await pane('git-pane-push-button').click();
  await expect(pane('git-pane-remote-line')).toContainText('in sync', { timeout: 30_000 });
  expect(remote('rev-parse', 'refs/heads/main')).toBe(ws('rev-parse', 'HEAD'));
});

// ── G6: foreign push → true fast-forward pull ───────────────────────

test('G6 — a foreign push fast-forwards on Pull with no merge bubble', async () => {
  test.setTimeout(120_000);
  runGit(root, cloneGitConfig, ['clone', remoteDir, cloneDir]);
  const cReq1 = entityFileOf(cloneDir, 'e2egreq1') as string;
  setEntityName(cReq1, 'Foreign Edit');
  clone('commit', '-a', '-m', 'clone: rename status probe');
  clone('push');
  const foreignSha = clone('rev-parse', 'HEAD');

  await invoke({ type: 'oh.workspaceTree.appFocus' });
  await expect(pane('git-pane-remote-line')).toContainText('behind', { timeout: 60_000 });

  await pane('git-pane-pull-button').click();
  await expect(pane('git-pane-remote-line')).toContainText('in sync', { timeout: 30_000 });
  expect(ws('rev-parse', 'HEAD')).toBe(foreignSha);
  const req1 = entityFileOf(wsDir, 'e2egreq1') as string;
  expect(readFileSync(req1, 'utf-8')).toContain('Foreign Edit');
  await waitClean();
});

// ── G7: divergence → two-parent merge with trailers ─────────────────

test('G7 — both sides edited: Pull lands a two-parent merge with Co-Authored-By and zero markers', async () => {
  test.setTimeout(120_000);
  const req2 = entityFileOf(wsDir, 'e2egreq2') as string;
  setEntityName(req2, 'Local Edit');
  await waitDirty();

  const cReq1 = entityFileOf(cloneDir, 'e2egreq1') as string;
  setEntityName(cReq1, 'Foreign Edit Two');
  clone('commit', '-a', '-m', 'clone: second rename');
  clone('push');

  await pane('git-pane-pull-button').click();
  await expect.poll(() => ws('rev-list', '--parents', '-1', 'HEAD').split(' ').length, { timeout: 45_000 }).toBe(3);
  expect(ws('log', '-1', '--format=%B')).toContain('Co-Authored-By: Clone Author <clone@openheaders.io>');
  for (const file of walkYamlFiles(wsDir)) {
    expect(readFileSync(file, 'utf-8')).not.toContain('<<<<<<<');
  }
  expect(readFileSync(entityFileOf(wsDir, 'e2egreq1') as string, 'utf-8')).toContain('Foreign Edit Two');
  expect(readFileSync(entityFileOf(wsDir, 'e2egreq2') as string, 'utf-8')).toContain('Local Edit');
  await waitClean();

  await pane('git-pane-push-button').click();
  await expect(pane('git-pane-remote-line')).toContainText('in sync', { timeout: 30_000 });
});

// ── G8: schema-broken foreign file quarantines, then clears ─────────

test('G8 — a schema-invalid foreign file quarantines on Pull and clears after the peer fixes it', async () => {
  test.setTimeout(120_000);
  clone('pull');
  const cReq1 = entityFileOf(cloneDir, 'e2egreq1') as string;
  const valid = readFileSync(cReq1, 'utf-8');
  writeFileSync(cReq1, valid.replace(/^method: .*$/m, 'method: connect'));
  clone('commit', '-a', '-m', 'clone: break the schema');
  clone('push');

  await pane('git-pane-pull-button').click();
  await expect(pane('git-pane-issues-alert')).toBeVisible({ timeout: 45_000 });
  await expect(pane('git-pane-issues-alert')).toContainText('request.yaml');
  // The foreign bytes stand on disk for revert-or-fix.
  expect(readFileSync(entityFileOf(wsDir, 'e2egreq1') as string, 'utf-8')).toContain('method: connect');

  const broken = readFileSync(cReq1, 'utf-8');
  writeFileSync(cReq1, broken.replace(/^method: .*$/m, 'method: GET'));
  clone('commit', '-a', '-m', 'clone: fix the schema');
  clone('push');

  await pane('git-pane-pull-button').click();
  await expect(pane('git-pane-issues-alert')).toBeHidden({ timeout: 45_000 });
  await expect
    .poll(() => readFileSync(entityFileOf(wsDir, 'e2egreq1') as string, 'utf-8').includes('method: GET'), {
      timeout: 30_000,
    })
    .toBe(true);
});

// ── G9: pull-first nudge on a stale push ────────────────────────────

test('G9 — pushing behind the remote raises the pull-first nudge; pull then push converges', async () => {
  test.setTimeout(120_000);
  clone('pull');
  const cReq1 = entityFileOf(cloneDir, 'e2egreq1') as string;
  setEntityName(cReq1, 'Nudge Foreign');
  clone('commit', '-a', '-m', 'clone: nudge edit');
  clone('push');

  const req2 = entityFileOf(wsDir, 'e2egreq2') as string;
  setEntityName(req2, 'Nudge Local');
  await waitDirty();
  await pane('git-pane-commit-button').click();
  await waitClean();

  await pane('git-pane-push-button').click();
  await expect(pane('git-pane-push-rejected')).toBeVisible({ timeout: 30_000 });

  await pane('git-pane-pull-button').click();
  await expect.poll(() => ws('rev-list', '--parents', '-1', 'HEAD').split(' ').length, { timeout: 45_000 }).toBe(3);
  await pane('git-pane-push-button').click();
  await expect(pane('git-pane-remote-line')).toContainText('in sync', { timeout: 30_000 });
});

// ── G10: read-only remote → §8.2 alert + Push-as-New-Branch ─────────

test('G10 — a rejecting pre-receive raises No-push-access; Push-as-New-Branch lands the export ref', async () => {
  test.setTimeout(120_000);
  const preReceive = path.join(remoteDir, 'hooks', 'pre-receive');
  writeFileSync(preReceive, '#!/bin/sh\necho "protected"\nexit 1\n');
  chmodSync(preReceive, 0o755);

  const req2 = entityFileOf(wsDir, 'e2egreq2') as string;
  setEntityName(req2, 'Protected Local');
  await waitDirty();
  await pane('git-pane-commit-button').click();
  await waitClean();

  await pane('git-pane-push-button').click();
  await expect(pane('git-pane-push-no-permission')).toBeVisible({ timeout: 30_000 });

  rmSync(preReceive);
  await pane('git-pane-export-branch-input').fill('oh-e2e-export');
  await pane('git-pane-export-branch-button').click();
  await expect
    .poll(
      () => {
        try {
          return remote('rev-parse', 'refs/heads/oh-e2e-export');
        } catch {
          return null;
        }
      },
      { timeout: 30_000 },
    )
    .toBe(ws('rev-parse', 'HEAD'));

  await pane('git-pane-push-button').click();
  await expect(pane('git-pane-remote-line')).toContainText('in sync', { timeout: 30_000 });
});

// ── G11–G13: the force-push trichotomy ──────────────────────────────

/** Rewind the remote by one commit and force-push a divergent edit from the clone. */
function forcePushRewrite(marker: string): string {
  clone('fetch');
  clone('reset', '--hard', 'origin/main');
  clone('reset', '--hard', 'HEAD~1');
  const cReq1 = entityFileOf(cloneDir, 'e2egreq1') as string;
  setEntityName(cReq1, marker);
  clone('commit', '-a', '-m', `clone: rewrite ${marker}`);
  clone('push', '--force');
  return clone('rev-parse', 'HEAD');
}

test('G11 — force-push detection holds Pull/Push, RED pill; Abandon converges onto the rewrite', async () => {
  test.setTimeout(180_000);
  const req2 = entityFileOf(wsDir, 'e2egreq2') as string;
  setEntityName(req2, 'Abandon Me');
  await waitDirty();
  const rewrittenSha = forcePushRewrite('Rewritten A');

  // The pull pass fetches, detects the rewrite, and refuses.
  await pane('git-pane-pull-button').click();
  await expect(pane('git-pane-force-push-alert')).toBeVisible({ timeout: 45_000 });
  await expect(pane('git-pane-pull-button')).toBeDisabled();
  await expect(pane('git-pane-push-button')).toBeDisabled();

  await expectPillMessage('Remote history was rewritten');
  await expect(pane('git-pane-force-push-alert')).toBeVisible({ timeout: 15_000 });

  await pane('git-pane-force-push-abandon').click();
  await workbench.getByRole('button', { name: 'Abandon', exact: true }).click();
  await expect(pane('git-pane-force-push-alert')).toBeHidden({ timeout: 45_000 });

  await expect
    .poll(
      () => {
        try {
          ws('merge-base', '--is-ancestor', rewrittenSha, 'HEAD');
          return true;
        } catch {
          return false;
        }
      },
      { timeout: 30_000 },
    )
    .toBe(true);
  expect(readFileSync(entityFileOf(wsDir, 'e2egreq1') as string, 'utf-8')).toContain('Rewritten A');
  expect(readFileSync(entityFileOf(wsDir, 'e2egreq2') as string, 'utf-8')).not.toContain('Abandon Me');
  await waitClean();
});

test('G12 — trichotomy Preserve mints an oh-rescue-* branch carrying the pre-rewrite work', async () => {
  test.setTimeout(180_000);
  const req2 = entityFileOf(wsDir, 'e2egreq2') as string;
  setEntityName(req2, 'Pre-rescue Local');
  await waitDirty();
  forcePushRewrite('Rewritten B');

  await pane('git-pane-pull-button').click();
  await expect(pane('git-pane-force-push-alert')).toBeVisible({ timeout: 45_000 });
  await pane('git-pane-force-push-rescue').click();
  await expect(pane('git-pane-force-push-alert')).toBeHidden({ timeout: 45_000 });

  const rescueLines = ws('branch', '--list', 'oh-rescue-*')
    .split('\n')
    .map((line) => line.replace('*', '').trim())
    .filter((line) => line !== '');
  expect(rescueLines.length).toBeGreaterThan(0);
  const rescue = rescueLines[rescueLines.length - 1];
  expect(ws('show', `${rescue}:${relPosix(req2)}`)).toContain('Pre-rescue Local');
  expect(readFileSync(entityFileOf(wsDir, 'e2egreq1') as string, 'utf-8')).toContain('Rewritten B');
  await waitClean();
});

test('G13 — trichotomy Re-apply lands local work on top of the rewritten history', async () => {
  test.setTimeout(180_000);
  const req2 = entityFileOf(wsDir, 'e2egreq2') as string;
  setEntityName(req2, 'Reapply Local');
  await waitDirty();
  forcePushRewrite('Rewritten C');

  await pane('git-pane-pull-button').click();
  await expect(pane('git-pane-force-push-alert')).toBeVisible({ timeout: 45_000 });
  await pane('git-pane-force-push-reapply').click();
  await expect(pane('git-pane-force-push-alert')).toBeHidden({ timeout: 45_000 });

  await expect.poll(() => ws('log', '-1', '--format=%s'), { timeout: 30_000 }).toContain('Re-apply');
  expect(readFileSync(entityFileOf(wsDir, 'e2egreq2') as string, 'utf-8')).toContain('Reapply Local');
  expect(readFileSync(entityFileOf(wsDir, 'e2egreq1') as string, 'utf-8')).toContain('Rewritten C');
  await waitClean();
});

// ── G14: Create & Switch rides dirty work along ─────────────────────

test('G14 — Create & Switch carries the dirty tree onto the new branch', async () => {
  test.setTimeout(120_000);
  const req2 = entityFileOf(wsDir, 'e2egreq2') as string;
  setEntityName(req2, 'Branch Dirty Work');
  await waitDirty();

  await pane('git-pane-branch-create-input').fill('local-test');
  await pane('git-pane-branch-create-button').click();
  await expect(pane('git-pane-branch-current')).toContainText('local-test', { timeout: 30_000 });
  expect(ws('symbolic-ref', 'HEAD')).toBe('refs/heads/local-test');
  expect(ws('status', '--porcelain')).not.toBe('');
  expect(readFileSync(req2, 'utf-8')).toContain('Branch Dirty Work');
});

// ── G15: the §6.2 Commit / Stash / Discard trio ─────────────────────

test('G15 — switching dirty raises the modal; stash, commit-on-old-branch, and discard all land their contracts', async () => {
  test.setTimeout(180_000);
  const req2 = entityFileOf(wsDir, 'e2egreq2') as string;

  // Stash: the dirty work from G14 goes onto the user's stash stack.
  await chooseSelectOption('git-pane-branch-select', 'main');
  await clickSwitchChoice('git-pane-switch-stash');
  await expect(pane('git-pane-branch-current')).toContainText('On branch main', { timeout: 30_000 });
  expect(ws('stash', 'list')).not.toBe('');
  expect(readFileSync(req2, 'utf-8')).not.toContain('Branch Dirty Work');
  ws('stash', 'drop');

  // Commit: the edit lands on the OLD branch (main), then we switch.
  setEntityName(req2, 'Commit Choice Work');
  await waitDirty();
  await chooseSelectOption('git-pane-branch-select', 'local-test');
  await clickSwitchChoice('git-pane-switch-commit');
  await expect(pane('git-pane-branch-current')).toContainText('local-test', { timeout: 30_000 });
  expect(ws('show', `main:${relPosix(req2)}`)).toContain('Commit Choice Work');
  expect(readFileSync(req2, 'utf-8')).not.toContain('Commit Choice Work');

  // Discard: danger-confirmed and total; .oh/ survives.
  setEntityName(req2, 'Discard Me');
  writeFileSync(path.join(wsDir, 'scratch.txt'), 'stray\n');
  await waitDirty();
  await chooseSelectOption('git-pane-branch-select', 'main');
  await clickSwitchChoice('git-pane-switch-discard');
  await workbench.getByRole('button', { name: 'Discard', exact: true }).click();
  await expect(pane('git-pane-branch-current')).toContainText('On branch main', { timeout: 30_000 });
  expect(existsSync(path.join(wsDir, 'scratch.txt'))).toBe(false);
  expect(readFileSync(req2, 'utf-8')).not.toContain('Discard Me');
  expect(existsSync(path.join(wsDir, '.oh'))).toBe(true);
});

// ── G16: terminal checkout reconciles, incl. the bare HEAD move ─────

test('G16 — a terminal git checkout while the app runs moves the card, including between identical trees', async () => {
  test.setTimeout(180_000);
  ws('checkout', 'local-test');
  await expect(pane('git-pane-branch-current')).toContainText('local-test', { timeout: 30_000 });

  // Give the branch its own commit for G17's divergence.
  const req1 = entityFileOf(wsDir, 'e2egreq1') as string;
  setEntityName(req1, 'Branch Side Edit');
  await waitDirty();
  await pane('git-pane-commit-button').click();
  await waitClean();

  // Bare HEAD move: twin points at the same commit — identical trees.
  ws('branch', 'twin');
  ws('checkout', 'twin');
  await expect(pane('git-pane-branch-current')).toContainText('twin', { timeout: 30_000 });
  ws('checkout', 'main');
  await expect(pane('git-pane-branch-current')).toContainText('On branch main', { timeout: 30_000 });
});

// ── G17: card merge — diverged two-parent, then fast-forward back ───

test('G17 — merging a diverged branch lands a clean two-parent commit; merging back fast-forwards', async () => {
  test.setTimeout(180_000);
  await chooseSelectOption('git-pane-merge-select', 'local-test');
  await pane('git-pane-merge-button').click();
  await expect.poll(() => ws('rev-list', '--parents', '-1', 'HEAD').split(' ').length, { timeout: 45_000 }).toBe(3);
  for (const file of walkYamlFiles(wsDir)) {
    expect(readFileSync(file, 'utf-8')).not.toContain('<<<<<<<');
  }
  expect(readFileSync(entityFileOf(wsDir, 'e2egreq1') as string, 'utf-8')).toContain('Branch Side Edit');
  expect(readFileSync(entityFileOf(wsDir, 'e2egreq2') as string, 'utf-8')).toContain('Commit Choice Work');
  await waitClean();

  // Merge back: local-test is now a pure ancestor — a true fast-forward.
  await chooseSelectOption('git-pane-branch-select', 'local-test');
  await expect(pane('git-pane-branch-current')).toContainText('local-test', { timeout: 30_000 });
  await chooseSelectOption('git-pane-merge-select', 'main');
  await pane('git-pane-merge-button').click();
  await expect.poll(() => ws('rev-parse', 'local-test'), { timeout: 45_000 }).toBe(ws('rev-parse', 'main'));
});

// ── G18: live watcher conflict chip in the request editor ───────────

test('G18 — a hand edit against a locally edited field raises the conflict chip; Use saved adopts it', async () => {
  test.setTimeout(180_000);
  // The chip lives in the workbench proper — leave the settings modal.
  await closeSettings();

  await openApiRequestsSidebar();
  await workbench.locator('[data-item-id="request-e2egreq1"]').click();
  await selectEditorTab(/Headers/);

  // Local uncommitted edit on the seeded header's value.
  const valueCell = workbench.locator('[data-field-path="headers.e2eghdr1.value"]').filter({ visible: true }).first();
  await expect.poll(() => cellText(valueCell), { timeout: 15_000 }).toBe('probe-one');
  await fillCell(valueCell, 'probe-mine');

  // The teammate-shaped hand edit to the same leaf sweeps in.
  const req1 = entityFileOf(wsDir, 'e2egreq1') as string;
  setHeaderValue(req1, 'probe-theirs');

  const chip = valueCell.getByTestId('conflict-diff-chip');
  await expect(chip).toBeVisible({ timeout: 30_000 });
  await chip.click();
  await workbench.getByRole('button', { name: 'Use saved' }).click();
  await expect.poll(() => cellText(valueCell), { timeout: 15_000 }).toBe('probe-theirs');
  await expect(chip).toBeHidden({ timeout: 15_000 });
});

// ── G19: terminal `git revert` round-trips into app state ───────────

test('G19 — a terminal git revert of an app commit reverts the entity in the UI and stays clean', async () => {
  test.setTimeout(180_000);
  await openGitPane();
  ws('checkout', 'main');
  await expect(pane('git-pane-branch-current')).toContainText('On branch main', { timeout: 30_000 });

  // Commit the G18 residue (the swept-in header value) first.
  await waitDirty();
  await pane('git-pane-commit-message').fill('git e2e: chip residue');
  await pane('git-pane-commit-button').click();
  await waitClean();

  const req2 = entityFileOf(wsDir, 'e2egreq2') as string;
  const before = readEntityName(req2);
  setEntityName(req2, 'Revert Target');
  await waitDirty();
  await pane('git-pane-commit-message').fill('git e2e: revert target');
  await pane('git-pane-commit-button').click();
  await waitClean();
  const count = commitCount();

  ws('revert', '--no-edit', 'HEAD');
  expect(commitCount()).toBe(count + 1);
  expect(readFileSync(req2, 'utf-8')).not.toContain('Revert Target');

  // The sweep ingests the reverted bytes: the semantic draft re-arms
  // and the engine converges without a counter-write.
  await expect
    .poll(async () => await pane('git-pane-commit-message').getAttribute('placeholder'), { timeout: 30_000 })
    .toBe('Update request');
  await waitClean();
  expect(commitCount()).toBe(count + 1);

  // The UI shows the reverted name.
  await closeSettings();
  await openApiRequestsSidebar();
  await expect(workbench.locator('[data-item-id="request-e2egreq2"]')).toContainText(before, { timeout: 30_000 });
});

// ── G20: cadence auto — quiescence commit + user-index pause ────────

test('G20 — cadence auto commits after quiescence and pauses while the user index is staged', async () => {
  test.setTimeout(180_000);
  await openGitPane();
  await chooseSelectOption('git-pane-cadence-select', 'After quiet edits');

  // Stage something as "the user" — auto-commit must stand down.
  const staged = path.join(wsDir, 'user-staged.txt');
  writeFileSync(staged, 'wip\n');
  ws('add', 'user-staged.txt');
  const count = commitCount();

  const req2 = entityFileOf(wsDir, 'e2egreq2') as string;
  setEntityName(req2, 'Cadence Paused');
  await expect(pane('git-pane-index-busy')).toBeVisible({ timeout: 30_000 });
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
  await expect.poll(() => commitCount(), { timeout: 45_000 }).toBe(count + 1);
  await waitClean();
  await expect(pane('git-pane-index-busy')).toBeHidden({ timeout: 15_000 });
  expect(readFileSync(req2, 'utf-8')).toContain('Cadence Landed');

  await chooseSelectOption('git-pane-cadence-select', 'Off — commit manually');
});

// ── G21: cadence on-blur through the appBlur RPC ────────────────────

test('G21 — cadence on-blur commits when the appBlur RPC fires', async () => {
  test.setTimeout(120_000);
  await chooseSelectOption('git-pane-cadence-select', 'When focus leaves the app');

  const req2 = entityFileOf(wsDir, 'e2egreq2') as string;
  setEntityName(req2, 'Blur Pending');
  await waitDirty();
  const count = commitCount();

  await invoke({ type: 'oh.workspaceTree.appBlur' });
  await expect.poll(() => commitCount(), { timeout: 45_000 }).toBe(count + 1);
  await waitClean();
  expect(readFileSync(req2, 'utf-8')).toContain('Blur Pending');

  await chooseSelectOption('git-pane-cadence-select', 'Off — commit manually');
});

// ── G22: a mid-rebase repo holds reconcile until --abort ────────────

test('G22 — a mid-rebase repo holds reconcile: gestures refuse, held edits never ingest, abort resumes', async () => {
  test.setTimeout(180_000);
  // Cheap conflict fixture: the same README line diverges on two branches.
  const readme = path.join(wsDir, 'README.md');
  writeFileSync(readme, 'base\n');
  ws('add', 'README.md');
  ws('commit', '-m', 'readme base');
  ws('checkout', '-b', 'rebase-side');
  await expect(pane('git-pane-branch-current')).toContainText('rebase-side', { timeout: 30_000 });
  writeFileSync(readme, 'side\n');
  ws('commit', '-a', '-m', 'readme side');
  ws('checkout', 'main');
  await expect(pane('git-pane-branch-current')).toContainText('On branch main', { timeout: 30_000 });
  writeFileSync(readme, 'trunk\n');
  ws('commit', '-a', '-m', 'readme trunk');
  ws('checkout', 'rebase-side');
  await expect(pane('git-pane-branch-current')).toContainText('rebase-side', { timeout: 30_000 });

  expect(wsTry('rebase', 'main')).toBe(false);
  expect(
    existsSync(path.join(wsDir, '.git', 'rebase-merge')) || existsSync(path.join(wsDir, '.git', 'rebase-apply')),
  ).toBe(true);

  // A held hand edit must never reach the engine: the draft stays unarmed.
  const req2 = entityFileOf(wsDir, 'e2egreq2') as string;
  setEntityName(req2, 'Held Edit');
  await workbench.waitForTimeout(3_000);
  expect(await pane('git-pane-commit-message').getAttribute('placeholder')).not.toBe('Update request');

  // Gestures refuse while the operation is in progress.
  await chooseSelectOption('git-pane-merge-select', 'main');
  await pane('git-pane-merge-button').click();
  await expect(pane('git-pane-branch-error')).toContainText('op-in-progress', { timeout: 30_000 });

  ws('rebase', '--abort');
  expect(existsSync(path.join(wsDir, '.git', 'rebase-merge'))).toBe(false);
  ws('checkout', 'main');
  await expect(pane('git-pane-branch-current')).toContainText('On branch main', { timeout: 30_000 });
  ws('branch', '-D', 'rebase-side');

  // The plane is live again: an edit sweeps in and commits.
  setEntityName(req2, 'After Abort');
  await expect
    .poll(async () => await pane('git-pane-commit-message').getAttribute('placeholder'), { timeout: 30_000 })
    .toBe('Update request');
  await waitDirty();
  await pane('git-pane-commit-button').click();
  await waitClean();
});

// ── G23: close-app → vim-edit → reopen — the edit wins in the UI ────

test('G23 — an offline hand edit lands in the UI on relaunch via the cold-boot tree-wins sweep', async () => {
  test.setTimeout(180_000);
  const req1 = entityFileOf(wsDir, 'e2egreq1') as string;
  await quit();
  setEntityName(req1, 'Vim Offline Edit');
  await launchApp();

  await openApiRequestsSidebar();
  await expect(workbench.locator('[data-item-id="request-e2egreq1"]')).toContainText('Vim Offline Edit', {
    timeout: 30_000,
  });

  await openGitPane();
  await waitDirty();
  await pane('git-pane-commit-message').fill('git e2e: offline edit');
  await pane('git-pane-commit-button').click();
  await waitClean();
});

// ── G24: unbind — clean detach, bind form returns, pill slot drops ──

test('G24 — unbind detaches cleanly: lock released, tree intact, bind form back, pill slot gone', async () => {
  test.setTimeout(120_000);
  const req2 = entityFileOf(wsDir, 'e2egreq2') as string;
  setEntityName(req2, 'Unbind Dirty');
  await waitDirty();
  // The pill's git slot is live right up to the detach.
  await expectPillMessage('uncommitted');

  await pane('git-pane-unbind-button').click();
  await workbench.locator('.ant-popover:not(.ant-popover-hidden)').getByRole('button', { name: 'Unbind' }).click();

  // The card returns to the bind form; the folder stays a valid tree.
  await expect(pane('git-pane-path-input')).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => existsSync(path.join(wsDir, '.oh', 'lock')), { timeout: 15_000 }).toBe(false);
  expect(existsSync(path.join(wsDir, '.git'))).toBe(true);
  expect(readFileSync(req2, 'utf-8')).toContain('Unbind Dirty');

  // The pill git slot dropped with the binding.
  await closeSettings();
  await workbench.getByTestId('status-pill').click();
  await expect(popoverMessages().first()).toBeVisible({ timeout: 15_000 });
  await expect(popoverMessages().filter({ hasText: 'uncommitted' })).toHaveCount(0);
  await workbench.getByTestId('status-pill').click();
});
