/**
 * Workflow runs on the desktop host — a workflow whose steps open an MQTT
 * session, driven through the REAL spine: the built app's workflow view and
 * the built `oh` CLI against the same app, the node byte-stream
 * transport, the desktop's sandboxed script runtime, and the playground's
 * device scenario (a backend's HTTP api beside the aedes probe broker on
 * TCP 3131: a reboot is commanded over HTTP and the device answers on its
 * status topic with the command's id; a name the device publishes is
 * stored by the backend a moment later).
 *
 *   R1  A reboot commanded over HTTP, acknowledged over MQTT: one
 *       workflow, the answer matched by the id of THIS run's command.
 *   R2  A name published over MQTT, read back over HTTP: the only wait
 *       is the call's poll.
 *   R3  A message that never comes fails its step at the deadline, by
 *       the address and the wait.
 *   R4  A listen that runs its request's scripts: the run passes, and
 *       the Listen row says what the hooks did not do cleanly.
 *   R5  A Before connect that throws fails the listen before the dial;
 *       nothing after it runs.
 *   R6  A run this host refuses before its first step, by the check's
 *       own sentence.
 *   H1  A run pressed in the workflow's History is drawn on the whole
 *       view while a newer one goes; Back to latest and a new run both
 *       return the view to the latest.
 *   B1  Open request stands the request's own tab in a group beside the
 *       workflow; the workflow keeps an unsaved edit through the split
 *       and the fold.
 *   C1  `oh run workflow` reports a row per step and exits 0.
 *   C2  A failed run writes its JUnit failure and exits 1.
 *
 * Every call goes to the playground's one origin, and the app holds a
 * sixth start to an origin inside a minute: R1, R2, R4 and C1 are the
 * four that call. A leg added here that calls counts against the five.
 *
 * Requires `pnpm turbo build --filter=@openheaders/desktop
 * --filter=@openheaders/cli` first; the playground boots as Playwright's
 * webServer.
 *
 * Seeding: the app boots once to mint its default workspace, quits, its
 * storage gains the collection, the requests and the workflows (built
 * and schema-validated by `fixtures/workflow-runs-desktop-seed.ts` under
 * the extension package's tsx), and the app relaunches on them.
 */

import { spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { type ElectronApplication, expect, type Locator, test } from '@playwright/test';
import { WorkbenchPage } from '../../../extension/tests/e2e/pages/workbench-page';
import { launchDesktopApp } from './fixtures/launch-app';

const APP_ROOT = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const CLI_BIN = path.resolve(APP_ROOT, '../cli/dist/cli.js');
// Port etiquette: fresh port off every prior suite (ledger through 22437).
const DAEMON_PORT = 22537;
const DAEMON_URL = `http://127.0.0.1:${DAEMON_PORT}`;
// The playground webServer: the device api, and the probe broker's TCP listener.
const DEVICES_ORIGIN = 'http://127.0.0.1:3000';
const MQTT_PROBE_PORT = 3131;

let electronApp: ElectronApplication;
let workbench: Page;
let userData: string;
let workspaceId: string;
let token: string;
let configHome: string;
let outputDir: string;

async function invoke<T>(message: Record<string, unknown>): Promise<T> {
  return (await workbench.evaluate(async (msg) => {
    const bridge = (window as unknown as { oh: { invoke(m: Record<string, unknown>): Promise<unknown> } }).oh;
    return await bridge.invoke(msg);
  }, message)) as T;
}

async function launchApp(): Promise<void> {
  electronApp = await launchDesktopApp(APP_ROOT, userData);
  workbench = await electronApp.firstWindow();
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

interface CliRun {
  code: number;
  stdout: string;
  stderr: string;
}

/** One `oh` invocation — env-resolved connection (the CI path). */
function oh(args: string[]): Promise<CliRun> {
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

// ── Workbench DOM helpers (the shared UI's selectors; visible-scoped —
//    background tabs stay mounted) ───────────────────────────────────

async function showWorkflowsView(): Promise<void> {
  const viewTab = workbench.locator('[data-tool-window="workflows"]').first();
  if ((await viewTab.getAttribute('aria-selected')) !== 'true') {
    await viewTab.click();
  }
  const sectionHeader = workbench
    .getByRole('button', { name: /WORKFLOWS/ })
    .filter({ visible: true })
    .first();
  await sectionHeader.waitFor({ state: 'visible', timeout: 10_000 });
  if ((await sectionHeader.getAttribute('aria-expanded')) !== 'true') {
    await sectionHeader.click();
  }
}

function visible(testId: string): Locator {
  return workbench.getByTestId(testId).filter({ visible: true }).first();
}

function workflowView(): Locator {
  return visible('wf-view');
}

function runRow(stepId: string): Locator {
  return workbench.getByTestId(`wf-run-row-${stepId}`).filter({ visible: true }).first();
}

/** A step's state glyph on the graph. */
function nodeMark(stepId: string): Locator {
  return workbench.getByTestId(`wf-graph-run-${stepId}`).filter({ visible: true }).first();
}

/** Open a workflow's tab — its panel says no run was seen yet — and press the header's Run. */
async function runWorkflow(uid: string): Promise<void> {
  await workbench.locator(`[data-item-id="workflow-${uid}"]`).click();
  await workbench.getByTestId('wf-run-empty').filter({ visible: true }).first().waitFor({ state: 'visible' });
  await workbench.getByTestId('wf-run').filter({ visible: true }).first().click();
}

async function expectVerdict(verdict: 'passed' | 'failed' | 'cannot-run'): Promise<void> {
  await expect(workflowView()).toHaveAttribute('data-run-verdict', verdict, { timeout: 10_000 });
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(20_000);

test.beforeAll(async () => {
  test.setTimeout(180_000);
  userData = await mkdtemp(path.join(tmpdir(), 'oh-workflow-runs-desktop-e2e-'));
  configHome = await mkdtemp(path.join(tmpdir(), 'oh-workflow-runs-desktop-e2e-config-'));
  outputDir = await mkdtemp(path.join(tmpdir(), 'oh-workflow-runs-desktop-e2e-out-'));
  await mkdir(path.join(userData, 'data'), { recursive: true });
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
  await electronApp.close();

  const seeded = spawnSync(
    'pnpm',
    [
      '--filter',
      '@openheaders/extension',
      'exec',
      'tsx',
      path.join(__dirname, 'fixtures/workflow-runs-desktop-seed.ts'),
    ],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        OH_E2E_DEVICES_ORIGIN: DEVICES_ORIGIN,
        OH_E2E_MQTT_PROBE_PORT: String(MQTT_PROBE_PORT),
        OH_E2E_WORKSPACE_ID: workspaceId,
      },
      encoding: 'utf-8',
    },
  );
  expect(seeded.status, seeded.stderr).toBe(0);
  const storagePath = path.join(userData, 'data', 'settings.json');
  const envelope = JSON.parse(await readFile(storagePath, 'utf-8')) as { values: Record<string, unknown> };
  Object.assign(envelope.values, JSON.parse(seeded.stdout) as Record<string, unknown>);
  await writeFile(storagePath, JSON.stringify(envelope));

  // Phase 2: relaunch on the seeded slots, open the workflows view — the right sidebar closed,
  // the graph and the panel side by side as in the extension's specs — and mint the CLI's token.
  await launchApp();
  await new WorkbenchPage(workbench).collapseRightSidebar();
  await showWorkflowsView();
  await workbench.locator('[data-item-id="workflow-e2ewrwf1"]').waitFor({ state: 'visible', timeout: 15_000 });
  const minted = await invoke<{ ok: boolean; secret?: string }>({
    type: 'oh.daemon.tokens.mint',
    label: 'workflow-runs-e2e',
  });
  expect(minted.ok).toBe(true);
  token = minted.secret ?? '';
});

test.afterAll(async () => {
  await electronApp?.close();
});

// ── A run in the workflow's view ────────────────────────────────────

test('R1 — a reboot commanded over HTTP is acknowledged over MQTT: the answer to this run’s command is the match', async () => {
  await runWorkflow('e2ewrwf1');
  await expectVerdict('passed');
  await expect(runRow('probe')).toContainText('Ready in');
  await expect(runRow('probe')).toContainText('closed after');
  await expect(runRow('reboot')).toContainText('202');
  await expect(runRow('status')).toContainText('Matched after');

  // The row opens its step, and the step's Last run tab shows its window: the one message on the address, and it matched.
  await runRow('status').click();
  await expect(workbench.locator('[data-step-card="status"]').filter({ visible: true })).toBeVisible();
  await workbench.getByTestId('wf-step-tab-last-run').filter({ visible: true }).first().click();
  const message = workbench.getByTestId('wf-run-message').filter({ visible: true }).first();
  await expect(message.getByTestId('wf-run-message-row-0')).toContainText('Matched');
  await expect(message.getByTestId('wf-run-message-fields')).toContainText('devices/dev-1/status');
});

test('R2 — a name published over MQTT is read back over HTTP: the send is acknowledged, the call polls until it holds', async () => {
  await runWorkflow('e2ewrwf2');
  await expectVerdict('passed');
  await expect(runRow('rename')).toContainText('Sent');
  await expect(runRow('rename')).toContainText('Acknowledged in');
  await expect(runRow('device')).toContainText(/Passed on attempt \d+ of 10/);
});

test('R3 — a message that never comes fails its step at the deadline, naming the address and the wait', async () => {
  await runWorkflow('e2ewrwf3');
  await expectVerdict('failed');
  await expect(runRow('health')).toContainText(
    'No message on devices/dev-1/health matched within 1.5 s of "probe" starting.',
  );
  await expect(runRow('health')).toContainText('Timed out');
  await expect(runRow('probe')).toContainText('closed after');
  // The graph says the same: the wait timed out, and the listen that had been open is closed.
  await expect(nodeMark('health')).toHaveAttribute('data-run-state', 'timed-out');
  await expect(nodeMark('probe')).toHaveAttribute('data-run-state', 'passed');
});

test('R4 — a listen that runs its request’s scripts passes, and its row says what the hooks left', async () => {
  await runWorkflow('e2ewrwf4');
  await expectVerdict('passed');
  await expect(runRow('status')).toContainText('Matched after');
  // The failed test is a note; the refused oh.sendRequest is that one On message run erroring.
  await expect(runRow('probe')).toContainText('1 script test failed · On message script failed 1 time');
});

test('R5 — a Before connect that throws fails the listen before the dial; nothing after it runs', async () => {
  await runWorkflow('e2ewrwf5');
  await expectVerdict('failed');
  await expect(runRow('probe')).toContainText('Before connect script failed at Request: no key');
  await expect(runRow('reboot')).toContainText('Not run');
  await expect(runRow('status')).toContainText('Not run');
  await expect(nodeMark('probe')).toHaveAttribute('data-run-state', 'failed');
  await expect(nodeMark('reboot')).toHaveAttribute('data-run-state', 'not-run');
});

test('R6 — an expect that passes over stored messages is refused before the run on a row that keeps the retain flag', async () => {
  await runWorkflow('e2ewrwf6');
  await expectVerdict('cannot-run');
  await expect(runRow('status')).toContainText(
    'Step "status" passes over stored messages, but "Probe MQTT 5" subscribes to devices/dev-1/# with Retain As Published on, so a live message can look stored.',
  );
  await expect(runRow('probe')).toContainText('Not run');
  await expect(runRow('reboot')).toContainText('Not run');
});

// ── A run picked from the workflow's History ────────────────────────

test('H1 — a run pressed in History is drawn on the whole view while a newer one goes; Back to latest and a new run return to the latest', async () => {
  // R3 left one run of this workflow, failed at its deadline. It calls nothing: no start is counted here.
  await workbench.locator('[data-item-id="workflow-e2ewrwf3"]').click();
  await visible('wf-panel-tab-history').click();
  const rows = workbench.locator('[data-testid^="wf-history-row-"]').filter({ visible: true });
  const shownRun = workbench.getByTestId('wf-shown-run').filter({ visible: true });
  await expect(visible('wf-history-count')).toHaveText('1');
  await expect(rows.first()).toHaveAttribute('data-shown', 'true');

  // A second run goes for its 1.5 s; the first is pressed while it does.
  await visible('wf-run').click();
  await expect(rows.first()).toHaveAttribute('data-run-verdict', 'running');
  await rows.nth(1).click();
  await expect(shownRun).toContainText('Failed');
  await expect(rows.nth(1)).toHaveAttribute('data-shown', 'true');
  await expect(workflowView()).toHaveAttribute('data-run-verdict', 'failed');
  await expect(nodeMark('health')).toHaveAttribute('data-run-state', 'timed-out');
  // The latest is still going: its row says so, and the header's phrase is its own.
  await expect(rows.first()).toHaveAttribute('data-run-verdict', 'running');
  await expect(visible('wf-header-status')).toContainText('Running');

  // The latest ends; the view still draws the pressed run until Back to latest.
  await expect(rows.first()).toHaveAttribute('data-run-verdict', 'failed', { timeout: 10_000 });
  await expect(visible('wf-header-status')).toHaveText('Failed at health');
  await expect(shownRun).toHaveCount(1);
  await visible('wf-shown-run-latest').click();
  await expect(shownRun).toHaveCount(0);
  await expect(rows.first()).toHaveAttribute('data-shown', 'true');

  // A run pressed, then a new run: the view is the new run's.
  await rows.nth(1).click();
  await expect(shownRun).toHaveCount(1);
  await visible('wf-run').click();
  await expect(shownRun).toHaveCount(0);
  await expect(visible('wf-history-count')).toHaveText('3');
  await expect(rows.first()).toHaveAttribute('data-shown', 'true');
  await expect(rows.first()).toHaveAttribute('data-run-verdict', 'failed', { timeout: 10_000 });
});

// ── A step's request, beside the workflow ───────────────────────────

test('B1 — Open request stands the request’s own tab beside the workflow, and an unsaved edit stays through the split and the fold', async () => {
  // Sends nothing: no start is counted here.
  const groups = workbench.locator('.rules-editor-leaf');
  // A group's own tabs — an editor in it has a row of tabs of its own.
  const tabsOf = (group: Locator) => group.locator('.rules-tabs-bar [role="tab"]');
  const tabIn = (group: Locator, tabId: string) => group.locator(`.rules-tabs-bar [data-tab-id="${tabId}"]`);
  const workflowTab = tabIn(groups.first(), 'live-wf-e2ewrwf1');
  const stepNote = visible('wf-step-1-description').locator('textarea');
  const openStep = async (stepId: string): Promise<void> => {
    await visible('wf-graph-fit').click();
    await visible(`wf-graph-node-${stepId}`).click();
    await visible('wf-step-tab-setup').click();
  };
  await workbench.locator('[data-item-id="workflow-e2ewrwf1"]').click();
  await expect(groups).toHaveCount(1);

  // An unsaved note on the call.
  await openStep('reboot');
  await stepNote.fill('Sent once the session is ready.');
  await expect(workflowTab.locator('.rules-tab-unsaved')).toHaveCount(1);

  // The call's request: a second group with its tab alone in it; the workflow is still in sight, as it was.
  await visible('wf-step-1-open-request').click();
  await expect(groups).toHaveCount(2);
  await expect(tabsOf(groups.nth(1))).toHaveCount(1);
  await expect(tabIn(groups.nth(1), 'request-e2ewrreb')).toHaveAttribute('aria-selected', 'true');
  await expect(workflowTab).toHaveAttribute('aria-selected', 'true');
  await expect(stepNote).toHaveValue('Sent once the session is ready.');
  await expect(workflowTab.locator('.rules-tab-unsaved')).toHaveCount(1);

  // The listen's request joins that group: no third one.
  await openStep('probe');
  await visible('wf-step-0-open-request').click();
  await expect(groups).toHaveCount(2);
  await expect(tabsOf(groups.nth(1))).toHaveCount(2);
  await expect(tabIn(groups.nth(1), 'mqtt-request-e2ewrmq1')).toHaveAttribute('aria-selected', 'true');

  // Both closed: one group again, the note still there. Undone, the workflow is as it was found.
  await tabIn(groups.nth(1), 'mqtt-request-e2ewrmq1').locator('.rules-tab-close').click();
  await tabIn(groups.nth(1), 'request-e2ewrreb').locator('.rules-tab-close').click();
  await expect(groups).toHaveCount(1);
  await openStep('reboot');
  await expect(stepNote).toHaveValue('Sent once the session is ready.');
  await visible('wf-graph-undo').click();
  await expect(workflowTab.locator('.rules-tab-unsaved')).toHaveCount(0);
});

// ── `oh run workflow` against the same app ──────────────────────────

test('C1 — oh run workflow prints a row per step, a session step led by its action, and exits 0', async () => {
  const run = await oh(['run', 'workflow', 'Device reboot']);
  expect(run.code, run.stderr).toBe(0);
  expect(run.stdout).toContain('pass  listen probe');
  expect(run.stdout).toMatch(/pass {2}.*reboot/);
  expect(run.stdout).toContain('pass  expect status');
});

test('C2 — a run that fails writes its JUnit failure by the step’s sentence and exits 1', async () => {
  const outFile = path.join(outputDir, 'results.xml');
  const run = await oh(['run', 'workflow', 'Device reboot unsigned', '--reporter', 'junit', '--output', outFile]);
  expect(run.code).toBe(1);
  const xml = await readFile(outFile, 'utf-8');
  expect(xml).toContain('<failure');
  expect(xml).toContain('Before connect script failed at Request: no key');
  expect(run.stderr).toMatch(/1 failed/);
});
