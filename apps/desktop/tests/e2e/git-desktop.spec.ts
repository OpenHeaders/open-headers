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
 *   G7   both sides committed → Pull lands a TWO-PARENT merge commit
 *        with a Co-Authored-By trailer and zero conflict markers, the
 *        merge carries the pull's own file and an uncommitted edit
 *        elsewhere stays uncommitted; Push converges the remote.
 *   G8   a schema-broken foreign file quarantines on Pull (issue row on
 *        the Folder page, foreign bytes preserved on disk) and clears
 *        once the peer pushes a fix.
 *   G9   pushing behind the remote raises the push refusal in the
 *        window; pull then push converges.
 *   G10  a rejecting pre-receive raises the Commit window's
 *        no-push-access recovery (§8.2); Push as New Branch lands the
 *        export ref and main converges once the hook is gone.
 *   G11  a force-pushed remote: the pull refuses `force-push` (over the
 *        bridge, the G6 idiom), both tool windows raise the rewrite
 *        banner, Commit and Push refuses naming the rewrite; Abandon
 *        converges onto the rewrite and drops the banner.
 *   G12  Preserve on a rescue branch (from the Git window's banner)
 *        mints `oh-rescue-*` carrying the pre-rewrite commit.
 *   G13  Re-apply on top lands the local commit as a fresh commit on
 *        the rewritten history; an uncommitted edit in the same file is
 *        committed first and said in a toast.
 *   G14  New Branch with checkout carries a dirty tree onto the new
 *        branch; the rail's star moves.
 *   G15  Checkout on a rail row's context menu with a dirty tree
 *        raises the §6.2 prompt; Stash, Commit and switch (the edit
 *        lands on the OLD branch) and Discard (danger-confirmed, total,
 *        `.oh/` survives) each land their contract.
 *   G16  a terminal `git checkout` while the app runs reconciles the
 *        rail — including a bare HEAD move between identical trees.
 *   G17  Merge into Current on a rail row lands a clean two-parent
 *        commit with zero markers; after a clean Checkout, merging the
 *        other way fast-forwards.
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
 *   G25  detached HEAD (§3.4): the rail's HEAD row names the sha, the
 *        Commit window warns; a detached→detached checkout still
 *        sweeps; a commit made there stays off main; New Branch from
 *        HEAD keeps it and clears the warning.
 *   G26  a conflicted `git revert` holds reconcile like a rebase: Pull
 *        refuses `op-in-progress`, a held edit never ingests, `--abort`
 *        resumes on the hold's retry.
 *   G27  a linked worktree (gitfile layout, §3.4) binds like a clone:
 *        a mid-rebase worktree holds, a terminal checkout inside it
 *        moves the rail, commits land on its branch.
 *   G28  a `--depth 1` clone binds with the header's shallow tag; a
 *        pull whose fork point sits behind the boundary writes the
 *        file that holds the local edit, so it asks first; on the word
 *        that edit is committed alone, the two-parent merge lands and
 *        the toast says why.
 *   G29  open a clone as a workspace (§3.5 gap K): a clone whose
 *        manifest uid the host has never seen refuses the bind with
 *        the identity-mismatch line AND the offer; the offer mints the
 *        workspace under the manifest's uid + name, binds the folder,
 *        the workbench jumps to it and the sweep fills it; a clone
 *        whose uid the host already holds keeps the plain collision
 *        refusal with no offer.
 *
 * The residual verbs' desktop homes (the S28 migration off the retired
 * settings card): the force-push trichotomy is the banner both tool
 * windows raise from the status frame; Push as New Branch is the
 * Commit window's `no-permission` recovery; Checkout and Merge into
 * Current live on the ref rail's row context menu; Show History on a
 * log entry's file row is unit-pinned (no leg drives it here).
 *
 * Deliberately NOT here (the manual live pass): the native folder
 * picker, real cmd-tab blur cadence, the ~5m fetch/commit timers
 * (`every-5m` shares `enqueueAutoCommit` with G20/G21 — the wall-clock
 * trigger has no compression seam and stays manual), and
 * packaged-build behavior.
 *
 * The Commit window's Git ▸ verbs (Push, Pull, Fetch, New Branch…) live
 * on a change row's context menu, so every window-driven pull rides a
 * local hand edit. The pull leaves that edit alone — it records the
 * files it wrote and no other — so the row is still there afterwards
 * (G7's own contract), and every push rides Commit and Push. A clean
 * tree has no row: G6's fast-forward pull calls the verb the menu
 * calls over the bridge (the spine leg, the appBlur idiom).
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
let wtDir: string;
let shallowDir: string;
let adoptDir: string;
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

/** Any other checkout under the app's identity (the linked worktree, the shallow clone). */
function at(dir: string, ...args: string[]): string {
  return runGit(dir, appGitConfig, args);
}

/** Whether a git command exits zero (`git rebase` stopping on a conflict, `merge-base` finding none). */
function tryAt(dir: string, ...args: string[]): boolean {
  try {
    at(dir, ...args);
    return true;
  } catch {
    return false;
  }
}

/** Commit count on a bound checkout's current HEAD (0 while HEAD is unborn). */
function commitCount(dir: string = wsDir): number {
  try {
    return Number(at(dir, 'rev-list', '--count', 'HEAD'));
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

/** The entity name a commit's tree holds for a file (the committed truth, not the working copy). */
function committedName(sha: string, file: string, dir: string = wsDir): string {
  const match = at(dir, 'show', `${sha}:${relPosix(file, dir)}`).match(/^name: (.*)$/m);
  return match ? match[1].trim() : '';
}

/** Rewrite the seeded header row's value in a request manifest. */
function setHeaderValue(file: string, value: string): void {
  const text = readFileSync(file, 'utf-8');
  writeFileSync(file, text.replace(/^(\s+)value: .*$/m, `$1value: ${value}`));
}

function relPosix(file: string, rootDir: string = wsDir): string {
  return path.relative(rootDir, file).split(path.sep).join('/');
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

/** Bind a folder on the Folder page; the page flips to its bound posture. */
async function bindOnFolderPage(dir: string): Promise<void> {
  await openGitSettingsPage('Folder');
  await pane('git-pane-path-input').fill(dir);
  await pane('git-pane-bind-button').click();
  await expect(pane('git-pane-unbind-button')).toBeVisible();
}

/** Unbind on the Folder page through its confirm popover; the bind form returns. */
async function unbindOnFolderPage(): Promise<void> {
  await openGitSettingsPage('Folder');
  await pane('git-pane-unbind-button').click();
  await workbench.locator('.ant-popover:not(.ant-popover-hidden)').getByRole('button', { name: 'Unbind' }).click();
  await expect(pane('git-pane-path-input')).toBeVisible();
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

/** The Commit window's row for a tracked file (path relative to the bound checkout). */
function changeRow(file: string, rootDir: string = wsDir): Locator {
  return workbench.locator(`[data-testid="commit-tool-file"][data-path="${relPosix(file, rootDir)}"]`);
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
  await confirmPushWindow();
  await expect.poll(() => commitCount(), { timeout: 5_000 }).toBe(before + 1);
  await expect.poll(() => remoteMain(), { timeout: 5_000 }).toBe(ws('rev-parse', 'HEAD'));
  await waitClean();
}

/**
 * Commit and Push… and the Push… verbs land in the Push window (the
 * reference anatomy): the commits that would go on the left, Push in
 * the footer. Press it once the list has arrived (the button holds
 * while the list loads) and wait for the window to leave.
 */
async function confirmPushWindow(): Promise<void> {
  // The window's testid sits on antd's modal root, a box-less wrapper
  // that reads hidden — the footer button is the visibility fact, and
  // the window destroys its content on close.
  await pane('git-push-confirm').waitFor({ state: 'visible' });
  await pane('git-push-confirm').click();
  await expect(pane('git-push-confirm')).toHaveCount(0);
}

/** Fill the message box and Commit; the commit lands on the bound checkout and the window settles clean. */
async function commitWithMessage(message: string, dir: string = wsDir): Promise<void> {
  const before = commitCount(dir);
  await pane('commit-tool-message').fill(message);
  await expect(pane('commit-tool-commit')).toBeEnabled();
  await pane('commit-tool-commit').click();
  await expect.poll(() => commitCount(dir), { timeout: 5_000 }).toBe(before + 1);
  await waitClean();
}

/**
 * The row menu's Git ▸ verbs: right-click a change row, walk the
 * keyboard to the Git submenu (the menu auto-focuses; End lands on its
 * last title, ArrowRight opens the popup and focuses its first item),
 * click the verb in the popup. A hover slide opened the submenu on a
 * timed pointer path that a stray real pointer over the window could
 * close again; the keyboard route is the menu's own accessibility
 * contract and has no delay to race.
 */
async function rowMenuGit(
  verb: 'push' | 'pull' | 'fetch' | 'new-branch',
  file: string,
  rootDir: string = wsDir,
): Promise<void> {
  await changeRow(file, rootDir).click({ button: 'right' });
  const title = workbench
    .locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu-submenu-title')
    .filter({ hasText: /^Git$/ });
  await title.waitFor({ state: 'visible' });
  await expect(workbench.locator('.ant-dropdown[class*="-appear"], .ant-dropdown[class*="-enter"]')).toHaveCount(0);
  await workbench.keyboard.press('End');
  await expect(title.locator('..')).toHaveClass(/ant-dropdown-menu-submenu-active/);
  await workbench.keyboard.press('ArrowRight');
  await pane(`commit-tool-menu-${verb}`).click();
}

/**
 * The rail row's context menu: right-click the local branch row in the
 * Git window, click the verb in the popup. The popup is scoped to the
 * visible dropdown — antd keeps a closed row's popup mounted, so a
 * bare testid would match every row opened before.
 */
async function railRowMenu(verb: 'checkout' | 'merge', branch: string): Promise<void> {
  await openToolWindow('git');
  await workbench
    .locator(`[data-testid="git-tool-ref-row"][data-kind="local"][data-ref="${branch}"]`)
    .click({ button: 'right' });
  await expect(workbench.locator('.ant-dropdown[class*="-appear"], .ant-dropdown[class*="-enter"]')).toHaveCount(0);
  await workbench.locator('.ant-dropdown:not(.ant-dropdown-hidden)').getByTestId(`git-tool-ref-menu-${verb}`).click();
}

/** Answer the §6.2 dirty-switch prompt once it is up and its zoom motion has settled. */
async function chooseSwitch(choice: 'commit' | 'stash' | 'discard'): Promise<void> {
  const button = pane(`git-tool-switch-${choice}`);
  await button.waitFor({ state: 'visible' });
  await settleModal();
  await button.click();
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

// Every leg starts with the API Requests view tucked away: it shares
// the Commit window's dock column, and with an Alert above the changes
// tree (the rewrite banner, the push recovery) the rows lose their
// room. Legs that need the sidebar open it themselves.
test.beforeEach(async () => {
  await hideToolWindow('api-requests');
});

test.beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'oh-git-desktop-e2e-'));
  userData = path.join(root, 'user-data');
  wsDir = path.join(root, 'ws');
  remoteDir = path.join(root, 'remote.git');
  cloneDir = path.join(root, 'clone');
  wtDir = path.join(root, 'wt');
  shallowDir = path.join(root, 'shallow');
  adoptDir = path.join(root, 'adopt');
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
  await bindOnFolderPage(wsDir);
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

test('G7 — both sides committed: Pull lands a two-parent merge with Co-Authored-By and zero markers, an uncommitted edit stays uncommitted; Push converges', async () => {
  const req2 = entityFileOf(wsDir, 'e2egreq2') as string;
  // The local side of the divergence is a commit of its own: a pull
  // never commits work it does not write.
  setEntityName(req2, 'Local Edit');
  await waitDirty();
  await commitWithMessage('git e2e: local edit');
  // An uncommitted edit the pull has no business with — the row its
  // menu opens from.
  setEntityName(req2, 'Local Edit Two');
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
  const req1 = entityFileOf(wsDir, 'e2egreq1') as string;
  expect(readFileSync(req1, 'utf-8')).toContain('Foreign Edit Two');
  expect(readFileSync(req2, 'utf-8')).toContain('Local Edit Two');
  // The merge recorded the pull's own file; the local edit is still a row.
  expect(ws('diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD^1', 'HEAD')).toBe(relPosix(req1));
  expect(ws('status', '--porcelain')).toBe(`M ${relPosix(req2)}`);
  await expect(changeRow(req2)).toBeVisible();

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
  await confirmPushWindow();
  await expect.poll(() => commitCount(), { timeout: 5_000 }).toBe(before + 1);
  // The non-fast-forward refusal is the Push Rejected prompt, never an
  // error line; Cancel keeps the commit local.
  await pane('git-push-rejected-cancel').click();
  await expect(pane('git-push-rejected-merge')).toHaveCount(0);
  await expect(pane('commit-tool-error')).toHaveCount(0);
  expect(remoteMain()).not.toBe(ws('rev-parse', 'HEAD'));

  setEntityName(req2, 'Nudge Local Two');
  await waitDirty();
  await rowMenuGit('pull', req2);
  await expect.poll(() => ws('rev-list', '--parents', '-1', 'HEAD').split(' ').length, { timeout: 5_000 }).toBe(3);
  // The edit the menu opened from is not the pull's — it is still uncommitted.
  expect(ws('status', '--porcelain')).toBe(`M ${relPosix(req2)}`);
  await editCommitPush(req2, 'Nudge Local Three', 'git e2e: nudge converge');

  // The prompt's Merge: the clone moves again, Commit and Push is
  // refused, Merge pulls (a two-parent merge) and pushes again.
  clone('pull');
  setEntityName(cReq1, 'Nudge Foreign Two');
  clone('commit', '-a', '-m', 'clone: nudge edit two');
  clone('push');
  setEntityName(req2, 'Nudge Local Four');
  await waitDirty();
  await pane('commit-tool-message').fill('git e2e: nudge merge');
  await pane('commit-tool-commit-push').click();
  await confirmPushWindow();
  await pane('git-push-rejected-merge').click();
  // HEAD moves with the merge — compare both sides live on every poll.
  await expect.poll(() => remoteMain() === ws('rev-parse', 'HEAD'), { timeout: 10_000 }).toBe(true);
  expect(ws('rev-list', '--parents', '-1', 'HEAD').split(' ').length).toBe(3);
  await waitClean();
});

// ── G10: §8.2 read-only remote — Push as New Branch from the window ─

test('G10 — a rejecting pre-receive raises the no-push-access recovery; Push as New Branch lands the export ref', async () => {
  const preReceive = path.join(remoteDir, 'hooks', 'pre-receive');
  writeFileSync(preReceive, '#!/bin/sh\necho "protected"\nexit 1\n');
  chmodSync(preReceive, 0o755);

  const req2 = entityFileOf(wsDir, 'e2egreq2') as string;
  setEntityName(req2, 'Protected Local');
  await waitDirty();
  const before = commitCount();
  await pane('commit-tool-message').fill('git e2e: protected local');
  await pane('commit-tool-commit-push').click();
  await confirmPushWindow();
  await expect.poll(() => commitCount(), { timeout: 5_000 }).toBe(before + 1);
  // The commit landed; the push answered no-permission, which is a
  // recovery, never an error line.
  await expect(pane('commit-tool-push-no-permission')).toBeVisible();
  await expect(pane('commit-tool-error')).toHaveCount(0);
  expect(remoteMain()).not.toBe(ws('rev-parse', 'HEAD'));
  await waitClean();

  rmSync(preReceive);
  await pane('commit-tool-export-branch-input').fill('oh-e2e-export');
  await pane('commit-tool-export-branch-button').click();
  await expect
    .poll(
      () => {
        try {
          return remote('rev-parse', 'refs/heads/oh-e2e-export');
        } catch {
          return null;
        }
      },
      { timeout: 5_000 },
    )
    .toBe(ws('rev-parse', 'HEAD'));
  await expect(pane('commit-tool-push-no-permission')).toHaveCount(0);

  // The hook gone, main converges on the next Commit and Push.
  await editCommitPush(req2, 'Protected Local Two', 'git e2e: protected converge');
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

/**
 * The pull meets the rewrite: it fetches, refuses `force-push` with
 * the dirty edit left as it was, and the status frame it publishes
 * raises the banner in BOTH tool windows. The pull rides the verb the row menu
 * calls (the G6 spine idiom) — with the banner up the row menu's Git
 * submenu would open below the window edge.
 */
async function meetRewrite(): Promise<void> {
  const pulled = await invoke<{ ok: boolean; reason?: string }>({ type: 'oh.workspaceTree.pull', workspaceId });
  expect(pulled).toMatchObject({ ok: false, reason: 'force-push' });
  await expect(pane('commit-tool-force-push')).toBeVisible();
  await openToolWindow('git');
  await expect(pane('git-tool-force-push')).toBeVisible();
}

test('G11 — a rewritten remote holds pull and push behind the banner in both windows; Abandon converges onto the rewrite', async () => {
  const req2 = entityFileOf(wsDir, 'e2egreq2') as string;
  setEntityName(req2, 'Abandon Me');
  await waitDirty();
  const rewrittenSha = forcePushRewrite('Rewritten A');
  await meetRewrite();

  // Push refuses in the window while the banner stands: the commit
  // lands, the push names the rewrite.
  setEntityName(req2, 'Abandon Me Too');
  await waitDirty();
  const before = commitCount();
  await pane('commit-tool-message').fill('git e2e: abandon me too');
  await pane('commit-tool-commit-push').click();
  await confirmPushWindow();
  await expect.poll(() => commitCount(), { timeout: 5_000 }).toBe(before + 1);
  await expect(pane('commit-tool-error')).toContainText('The remote history was rewritten');
  await dismissError();

  await pane('commit-tool-force-push-abandon').click();
  await workbench.getByRole('button', { name: 'Abandon', exact: true }).click();
  await expect(pane('commit-tool-force-push')).toHaveCount(0);
  await openToolWindow('git');
  await expect(pane('git-tool-force-push')).toHaveCount(0);
  await expect
    .poll(() => tryAt(wsDir, 'merge-base', '--is-ancestor', rewrittenSha, 'HEAD'), { timeout: 5_000 })
    .toBe(true);
  expect(readFileSync(entityFileOf(wsDir, 'e2egreq1') as string, 'utf-8')).toContain('Rewritten A');
  expect(readFileSync(req2, 'utf-8')).not.toContain('Abandon Me');
  await waitClean();
});

test('G12 — Preserve on a rescue branch from the Git window banner mints oh-rescue-* carrying the pre-rewrite work', async () => {
  const req2 = entityFileOf(wsDir, 'e2egreq2') as string;
  // The local history the rescue ref preserves is a commit of its own.
  setEntityName(req2, 'Pre-rescue Local');
  await waitDirty();
  await commitWithMessage('git e2e: pre-rescue local');
  forcePushRewrite('Rewritten B');
  await meetRewrite();

  await pane('git-tool-force-push-rescue').click();
  await expect(pane('git-tool-force-push')).toHaveCount(0);
  await expect(pane('commit-tool-force-push')).toHaveCount(0);
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

test('G13 — Re-apply on top lands the local work as a fresh commit on the rewritten history', async () => {
  const req2 = entityFileOf(wsDir, 'e2egreq2') as string;
  setEntityName(req2, 'Reapply Local');
  await waitDirty();
  await commitWithMessage('git e2e: reapply local');
  // A further edit no commit has, in a file the two heads now hold
  // differently: the resolution commits it first and says so.
  setEntityName(req2, 'Reapply Local Two');
  await waitDirty();
  forcePushRewrite('Rewritten C');
  await meetRewrite();

  await pane('commit-tool-force-push-reapply').click();
  await expect(pane('commit-tool-force-push')).toHaveCount(0);
  await expect(workbench.getByText(/were committed first/)).toBeVisible();
  await expect.poll(() => ws('log', '-1', '--format=%s'), { timeout: 5_000 }).toContain('Re-apply');
  expect(readFileSync(req2, 'utf-8')).toContain('Reapply Local Two');
  expect(readFileSync(entityFileOf(wsDir, 'e2egreq1') as string, 'utf-8')).toContain('Rewritten C');
  await waitClean();
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

// ── G15: the §6.2 Commit / Stash / Discard trio from the rail ───────

test('G15 — Checkout on a rail row with a dirty tree raises the prompt; Stash, Commit and switch, and Discard land their contracts', async () => {
  const req2 = entityFileOf(wsDir, 'e2egreq2') as string;

  // Stash: G14's dirty work goes onto the user's own stash stack.
  await railRowMenu('checkout', 'main');
  await chooseSwitch('stash');
  await expectCurrentBranch('main');
  expect(ws('stash', 'list')).not.toBe('');
  expect(readFileSync(req2, 'utf-8')).not.toContain('Branch Dirty Work');
  ws('stash', 'drop');

  // Commit: the edit lands on the OLD branch (main), then the switch.
  setEntityName(req2, 'Commit Choice Work');
  await waitDirty();
  await railRowMenu('checkout', 'local-test');
  await chooseSwitch('commit');
  await expectCurrentBranch('local-test');
  expect(ws('show', `main:${relPosix(req2)}`)).toContain('Commit Choice Work');
  expect(readFileSync(req2, 'utf-8')).not.toContain('Commit Choice Work');

  // Discard: danger-confirmed and total; .oh/ survives.
  setEntityName(req2, 'Discard Me');
  writeFileSync(path.join(wsDir, 'scratch.txt'), 'stray\n');
  await waitDirty();
  await railRowMenu('checkout', 'main');
  await chooseSwitch('discard');
  await workbench.getByRole('button', { name: 'Discard', exact: true }).click();
  await expectCurrentBranch('main');
  expect(existsSync(path.join(wsDir, 'scratch.txt'))).toBe(false);
  expect(readFileSync(req2, 'utf-8')).not.toContain('Discard Me');
  expect(existsSync(path.join(wsDir, '.oh'))).toBe(true);
});

// ── G16: terminal checkout reconciles, incl. the bare HEAD move ─────

test('G16 — a terminal git checkout while the app runs moves the rail, including between identical trees', async () => {
  ws('checkout', 'local-test');
  await expectCurrentBranch('local-test');

  // Give the branch its own commit for G17's divergence.
  const req1 = entityFileOf(wsDir, 'e2egreq1') as string;
  setEntityName(req1, 'Branch Side Edit');
  await waitDirty();
  await commitWithMessage('git e2e: branch side edit');

  // Bare HEAD move: twin points at the same commit — identical trees.
  ws('branch', 'twin');
  ws('checkout', 'twin');
  await expectCurrentBranch('twin');
  ws('checkout', 'main');
  await expectCurrentBranch('main');
});

// ── G17: Merge into Current from the rail — two-parent, then ff back ─

test('G17 — Merge into Current on a rail row lands a clean two-parent commit; after a clean Checkout the other way fast-forwards', async () => {
  await railRowMenu('merge', 'local-test');
  await expect.poll(() => ws('rev-list', '--parents', '-1', 'HEAD').split(' ').length, { timeout: 5_000 }).toBe(3);
  for (const file of walkYamlFiles(wsDir)) {
    expect(readFileSync(file, 'utf-8')).not.toContain('<<<<<<<');
  }
  expect(readFileSync(entityFileOf(wsDir, 'e2egreq1') as string, 'utf-8')).toContain('Branch Side Edit');
  expect(readFileSync(entityFileOf(wsDir, 'e2egreq2') as string, 'utf-8')).toContain('Commit Choice Work');
  await waitClean();

  // A clean tree checks out without the prompt; local-test is now a
  // pure ancestor of main — a true fast-forward.
  await railRowMenu('checkout', 'local-test');
  await expectCurrentBranch('local-test');
  await railRowMenu('merge', 'main');
  await expect.poll(() => ws('rev-parse', 'local-test'), { timeout: 5_000 }).toBe(ws('rev-parse', 'main'));
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
  // G17 leaves the rig on local-test; the fixture forks from main.
  ws('checkout', 'main');
  await expectCurrentBranch('main');
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

  expect(tryAt(wsDir, 'rebase', 'main')).toBe(false);
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

// ── G25: detached HEAD — named in the rail and the window, swept, kept ──

test('G25 — a detached HEAD names its sha in the rail and the Commit window, a detached→detached checkout sweeps, New Branch from HEAD keeps the work off main', async () => {
  const req2 = entityFileOf(wsDir, 'e2egreq2') as string;
  // Two commits with distinct names so each detached stop has its own
  // tree — the second stop proves the HEAD-identity sweep with no
  // branch name on either side.
  setEntityName(req2, 'Detach One');
  await waitDirty();
  await commitWithMessage('git e2e: detach one');
  setEntityName(req2, 'Detach Two');
  await waitDirty();
  await commitWithMessage('git e2e: detach two');
  const mainTip = ws('rev-parse', 'main');
  const one = ws('rev-parse', 'main~1');
  const two = ws('rev-parse', 'main~2');
  const request = workbench.locator('[data-item-id="request-e2egreq2"]');
  const headRow = pane('git-tool-ref-head');

  await openToolWindow('git');
  await expect(headRow).not.toHaveAttribute('data-detached', 'true');

  ws('checkout', '--detach', one);
  await expect(headRow).toHaveAttribute('data-detached', 'true');
  await expect(headRow).toContainText(one.slice(0, 8));
  await expect(pane('commit-tool-detached')).toContainText(one.slice(0, 8));
  await openApiRequestsSidebar();
  await expect(request).toContainText(committedName(one, req2));

  ws('checkout', '--detach', two);
  await expect(headRow).toContainText(two.slice(0, 8));
  await expect(request).toContainText(committedName(two, req2));

  // An edit made here commits onto the detached HEAD — no branch moves.
  setEntityName(req2, 'Detached Edit');
  await waitDirty();
  await commitWithMessage('git e2e: detached commit');
  const detachedCommit = ws('rev-parse', 'HEAD');
  expect(detachedCommit).not.toBe(two);
  expect(tryAt(wsDir, 'symbolic-ref', '-q', 'HEAD')).toBe(false);
  expect(ws('rev-parse', 'main')).toBe(mainTip);

  // The warning's way out: New Branch from HEAD checks out a named
  // branch at the detached commit and the warning clears.
  await pane('commit-tool-detached-new-branch').click();
  await settleModal();
  await pane('git-tool-create-branch-name').fill('from-detached');
  await expect(pane('git-tool-create-branch-checkout')).toBeChecked();
  await workbench.getByRole('button', { name: 'Create', exact: true }).click();
  await expectCurrentBranch('from-detached');
  expect(ws('symbolic-ref', 'HEAD')).toBe('refs/heads/from-detached');
  expect(ws('rev-parse', 'HEAD')).toBe(detachedCommit);
  await expect(pane('commit-tool-detached')).toHaveCount(0);
  await expect(headRow).not.toHaveAttribute('data-detached', 'true');

  // Back on main the detached work is in neither the view nor the tree.
  ws('checkout', 'main');
  await expectCurrentBranch('main');
  await expect(request).toContainText('Detach Two');
  expect(readFileSync(req2, 'utf-8')).toContain('Detach Two');
  await waitClean();
  ws('branch', '-D', 'from-detached');
});

// ── G26: a conflicted revert holds reconcile until --abort ──────────

test('G26 — a conflicted git revert holds reconcile: Pull refuses, a held edit never ingests, --abort resumes on the retry', async () => {
  // Cheap conflict fixture: revert a README commit a later commit
  // overwrote (README is tracked since G22).
  const readme = path.join(wsDir, 'README.md');
  writeFileSync(readme, 'revert one\n');
  ws('commit', '-a', '-m', 'readme revert one');
  const target = ws('rev-parse', 'HEAD');
  writeFileSync(readme, 'revert two\n');
  ws('commit', '-a', '-m', 'readme revert two');

  expect(tryAt(wsDir, 'revert', '--no-edit', target)).toBe(false);
  expect(existsSync(path.join(wsDir, '.git', 'REVERT_HEAD'))).toBe(true);

  const req2 = entityFileOf(wsDir, 'e2egreq2') as string;
  const request = workbench.locator('[data-item-id="request-e2egreq2"]');
  const before = readEntityName(req2);
  setEntityName(req2, 'Revert Held');
  await workbench.waitForTimeout(3_000);
  await expect(request).toContainText(before);
  await expect(request).not.toContainText('Revert Held');

  await hideToolWindow('api-requests');
  await hideToolWindow('git');
  await rowMenuGit('pull', req2);
  await expect(pane('commit-tool-error')).toContainText('Pull failed: op-in-progress');
  await dismissError();

  // The hold re-checks on a 5 s retry timer; the held edit lands on
  // the first retry after the abort.
  ws('revert', '--abort');
  expect(existsSync(path.join(wsDir, '.git', 'REVERT_HEAD'))).toBe(false);
  await expect(request).toContainText('Revert Held', { timeout: 7_000 });
  await openToolWindow('git');
  await commitWithMessage('git e2e: after revert abort');
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

  await unbindOnFolderPage();

  // The folder stays a valid tree.
  await expect.poll(() => existsSync(path.join(wsDir, '.oh', 'lock')), { timeout: 5_000 }).toBe(false);
  expect(existsSync(path.join(wsDir, '.git'))).toBe(true);
  expect(readFileSync(req2, 'utf-8')).toContain('Unbind Dirty');

  // The Commit window flips to its bind posture with the binding gone.
  await closeSettings();
  await expect(pane('commit-tool-not-bound')).toBeVisible();
  await expect(pane('commit-tool-bind-path-input')).toBeVisible();
});

// ── G27: a linked worktree binds like a clone ───────────────────────

test('G27 — a linked worktree binds: the hold reads the per-worktree dir, a checkout inside it moves the rail, commits land on its branch', async () => {
  ws('worktree', 'add', '-b', 'wt-branch', wtDir, 'main');
  expect(statSync(path.join(wtDir, '.git')).isFile()).toBe(true);
  const wtGitDir = path.join(wsDir, '.git', 'worktrees', path.basename(wtDir));

  await bindOnFolderPage(wtDir);
  await closeSettings();
  await openToolWindow('commit');
  await expect(pane('commit-tool-panel')).toBeVisible();
  await openToolWindow('git');
  await expectCurrentBranch('wt-branch');
  const req2 = entityFileOf(wtDir, 'e2egreq2') as string;
  const request = workbench.locator('[data-item-id="request-e2egreq2"]');
  await openApiRequestsSidebar();
  await expect(request).toContainText(readEntityName(req2));

  // A rebase stopped on a conflict inside the worktree: the marker
  // lives under the main repo's worktrees dir, never `<wt>/.git/`.
  const readme = path.join(wtDir, 'README.md');
  at(wtDir, 'checkout', '-b', 'wt-side');
  await expectCurrentBranch('wt-side');
  writeFileSync(readme, 'worktree side\n');
  at(wtDir, 'commit', '-a', '-m', 'readme worktree side');
  at(wtDir, 'checkout', 'wt-branch');
  await expectCurrentBranch('wt-branch');
  writeFileSync(readme, 'worktree trunk\n');
  at(wtDir, 'commit', '-a', '-m', 'readme worktree trunk');
  at(wtDir, 'checkout', 'wt-side');
  await expectCurrentBranch('wt-side');
  expect(tryAt(wtDir, 'rebase', 'wt-branch')).toBe(false);
  expect(existsSync(path.join(wtGitDir, 'rebase-merge'))).toBe(true);

  const before = readEntityName(req2);
  setEntityName(req2, 'Worktree Held');
  await workbench.waitForTimeout(3_000);
  await expect(request).toContainText(before);
  await expect(request).not.toContainText('Worktree Held');

  await hideToolWindow('api-requests');
  await hideToolWindow('git');
  await rowMenuGit('pull', req2, wtDir);
  await expect(pane('commit-tool-error')).toContainText('Pull failed: op-in-progress');
  await dismissError();

  // `rebase --abort` resets the worktree hard to the pre-rebase head,
  // so git itself discards the held edit; the view agrees once the
  // plane resumes instead of resurrecting bytes git threw away.
  at(wtDir, 'rebase', '--abort');
  expect(existsSync(path.join(wtGitDir, 'rebase-merge'))).toBe(false);
  expect(readEntityName(req2)).toBe(before);
  // A terminal checkout inside the worktree moves the per-worktree
  // HEAD — the watcher follows the gitfile and the rail reconciles.
  at(wtDir, 'checkout', 'wt-branch');
  await openToolWindow('git');
  await expectCurrentBranch('wt-branch');
  await expect(request).toContainText(before);

  // The plane is live again: an edit sweeps in and commits on the
  // worktree's own branch, never on main.
  setEntityName(req2, 'Worktree Edit');
  await waitDirty();
  await expect(request).toContainText('Worktree Edit');
  await commitWithMessage('git e2e: worktree commit', wtDir);
  expect(at(wtDir, 'log', '-1', '--format=%s')).toBe('git e2e: worktree commit');
  expect(ws('rev-parse', 'main')).not.toBe(at(wtDir, 'rev-parse', 'HEAD'));

  await unbindOnFolderPage();
  await closeSettings();
  await expect(pane('commit-tool-not-bound')).toBeVisible();
});

// ── G28: a shallow clone binds with its tag; a pull past the boundary says why ──

test('G28 — a depth-1 clone binds with the shallow tag; a pull whose fork point sits behind the boundary merges and the toast names the shallow history', async () => {
  at(root, 'clone', '--depth', '1', `file://${remoteDir}`, shallowDir);
  expect(at(shallowDir, 'rev-parse', '--is-shallow-repository')).toBe('true');

  await bindOnFolderPage(shallowDir);
  await closeSettings();
  await openToolWindow('commit');
  await expect(pane('commit-tool-panel')).toBeVisible();
  await openToolWindow('git');
  await expectCurrentBranch('main');
  await expect(pane('git-tool-shallow-note')).toBeVisible();

  // The teammate forks from a commit the shallow clone cannot see and
  // publishes it; the clone takes that ref as its upstream (`--depth`
  // implies `--single-branch`, so the ref joins the remote's fetch set
  // first — tracking refuses a ref no fetch refspec maps).
  clone('fetch');
  clone('checkout', '-b', 'deep-side', 'origin/main~2');
  const cReq1 = entityFileOf(cloneDir, 'e2egreq1') as string;
  setEntityName(cReq1, 'Deep Side');
  clone('commit', '-a', '-m', 'clone: deep side rename');
  clone('push', 'origin', 'deep-side');
  const sideSha = clone('rev-parse', 'HEAD');
  at(shallowDir, 'remote', 'set-branches', '--add', 'origin', 'deep-side');
  at(shallowDir, 'fetch', 'origin');
  at(shallowDir, 'branch', '--set-upstream-to=origin/deep-side', 'main');
  expect(tryAt(shallowDir, 'merge-base', 'HEAD', 'origin/deep-side')).toBe(false);

  const req2 = entityFileOf(shallowDir, 'e2egreq2') as string;
  setEntityName(req2, 'Shallow Local');
  await waitDirty();
  await hideToolWindow('api-requests');
  await hideToolWindow('git');
  await rowMenuGit('pull', req2, shallowDir);
  // With no base every foreign file is the pull's to write — the edited
  // one among them, so the pull asks before that edit is committed.
  const commitAndPull = workbench.getByRole('button', { name: 'Commit and Pull' });
  await commitAndPull.waitFor({ state: 'visible' });
  await settleModal();
  await expect(pane('git-tool-local-changes-first-files')).toHaveText(relPosix(req2, shallowDir));
  expect(at(shallowDir, 'status', '--porcelain')).toBe(`M ${relPosix(req2, shallowDir)}`);
  await pane('git-tool-local-changes-first-message').fill('git e2e: shallow local');
  await commitAndPull.click();
  await expect(workbench.getByText('The shallow clone hides the common history', { exact: false })).toBeVisible();

  await expect
    .poll(() => at(shallowDir, 'rev-list', '--parents', '-1', 'HEAD').split(' ').length, { timeout: 5_000 })
    .toBe(3);
  expect(at(shallowDir, 'rev-parse', 'HEAD^2')).toBe(sideSha);
  expect(readFileSync(entityFileOf(shallowDir, 'e2egreq1') as string, 'utf-8')).toContain('Deep Side');
  // The cost the toast names: with no base every file the foreign side
  // carries is tree-authored, so its bytes win — the local edit stands
  // committed on the first parent and is overridden in the merge result.
  expect(committedName(at(shallowDir, 'rev-parse', 'HEAD^1'), req2, shallowDir)).toBe('Shallow Local');
  expect(at(shallowDir, 'log', '-1', '--format=%s', 'HEAD^1')).toBe('git e2e: shallow local');
  expect(readEntityName(req2)).toBe(committedName(sideSha, req2, shallowDir));
  for (const file of walkYamlFiles(shallowDir)) {
    expect(readFileSync(file, 'utf-8')).not.toContain('<<<<<<<');
  }
  await waitClean();
  expect(at(shallowDir, 'status', '--porcelain')).toBe('');
});

// ── G29: open a clone as a workspace (gap K) ─────────────────────────

test('G29 — a clone under an unseen manifest uid offers Open as workspace: the offer mints + binds + jumps, the sweep fills it; a held uid keeps the plain collision refusal', async () => {
  // A teammate's clone whose workspace this host has never seen: the
  // remote's tree under a fresh manifest identity, one entity renamed
  // so the adopted content is tellable from the default workspace's.
  at(root, 'clone', '-q', `file://${remoteDir}`, adoptDir);
  const manifest = path.join(adoptDir, 'workspace.yaml');
  writeFileSync(
    manifest,
    readFileSync(manifest, 'utf-8')
      .replace(/^uid: .*$/m, 'uid: wsadopt1')
      .replace(/^name: .*$/m, 'name: Adopted Team'),
  );
  setEntityName(entityFileOf(adoptDir, 'e2egreq1') as string, 'Adopted Request');
  at(adoptDir, 'commit', '-q', '-a', '-m', 'teammate: own identity');
  const adoptHead = at(adoptDir, 'rev-parse', 'HEAD');

  await unbindOnFolderPage();
  await pane('git-pane-path-input').fill(adoptDir);
  await pane('git-pane-bind-button').click();
  await expect(workbench.getByText('This folder belongs to a different workspace (wsadopt1).')).toBeVisible();
  await expect(pane('git-pane-adopt-offer')).toBeVisible();
  await expect(pane('git-pane-adopt-button')).toHaveText('Open as workspace “Adopted Team”');

  await pane('git-pane-adopt-button').click();
  await expect
    .poll(
      async () =>
        (await invoke<{ activeWorkspaceId: string | null }>({ type: 'getActiveWorkspaceId' })).activeWorkspaceId,
      { timeout: 10_000 },
    )
    .toBe('wsadopt1');
  // The Folder page now shows the adopted workspace's binding.
  await expect(pane('git-pane-unbind-button')).toBeVisible();
  await expect(workbench.locator('.settings-modal').getByText(adoptDir, { exact: true })).toBeVisible();
  await closeSettings();
  await openApiRequestsSidebar();
  await expect(workbench.locator('[data-item-id="request-e2egreq1"]')).toContainText('Adopted Request');
  // The sweep filled the workspace from the clone: nothing to commit,
  // no branch moved, the engine's lock is the only new file.
  await expect.poll(() => at(adoptDir, 'status', '--porcelain'), { timeout: 5_000 }).toBe('');
  expect(at(adoptDir, 'rev-parse', 'HEAD')).toBe(adoptHead);
  expect(existsSync(path.join(adoptDir, '.oh', 'lock'))).toBe(true);

  // The default workspace's clone names a uid this host already holds
  // (the default workspace itself): the §3.5 collision, no offer.
  await unbindOnFolderPage();
  await pane('git-pane-path-input').fill(cloneDir);
  await pane('git-pane-bind-button').click();
  await expect(
    workbench.getByText('This folder holds a workspace that already exists on this host via another source.'),
  ).toBeVisible();
  await expect(pane('git-pane-adopt-offer')).toHaveCount(0);
  // Leave the rig bound to the adopted tree (the page is still open).
  await pane('git-pane-path-input').fill(adoptDir);
  await pane('git-pane-bind-button').click();
  await expect(pane('git-pane-unbind-button')).toBeVisible();
  await closeSettings();
});
