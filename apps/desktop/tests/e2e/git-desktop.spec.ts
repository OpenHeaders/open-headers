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
 *
 * Deliberately NOT here (the manual live pass or the full-automation
 * slice): the native folder picker, real cmd-tab blur cadence, the ~5m
 * timers, packaged-build behavior, `git revert` round-trip, the
 * mid-rebase hold, and every workbench-sidebar assertion (the card and
 * the repo are the wiring under test).
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
 * The statusbar pill sits UNDER the settings modal — close settings,
 * assert the pill popover carries `text`, reopen the Git pane.
 */
async function expectPillMessage(text: string): Promise<void> {
  await workbench.keyboard.press('Escape');
  await expect(workbench.locator('.ant-modal-container')).toBeHidden({ timeout: 10_000 });
  await workbench.getByTestId('status-pill').click();
  await expect(popoverMessages().filter({ hasText: text })).toBeVisible({ timeout: 15_000 });
  await workbench.getByTestId('status-pill').click();
  await openGitPane();
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
