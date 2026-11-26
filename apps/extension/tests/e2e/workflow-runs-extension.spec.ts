/**
 * Workflow runs in the extension — a workflow whose steps open an MQTT
 * session, run IN the workbench page beside the session it holds: real
 * Chromium with the built extension, no daemon, the page's own
 * MQTT-over-WebSocket transport, each `call` step crossing to the service
 * worker, and the playground's device scenario (a backend's HTTP api
 * beside the aedes probe broker on its `/net/mqtt` upgrade path: a reboot
 * is commanded over HTTP and the device answers on its status topic with
 * the command's id; a name the device publishes is stored by the backend
 * a moment later).
 *
 *   X1  A reboot commanded over HTTP, acknowledged over MQTT: one
 *       workflow, the answer matched by the id of THIS run's command.
 *   X2  A name published over MQTT, read back over HTTP: the only wait
 *       is the call's poll.
 *   X3  A message that never comes fails its step at the deadline, by
 *       the address and the wait.
 *   X4  A run the page refuses before its first step, by the check's own
 *       sentence: an expect that passes over stored messages on a row
 *       that keeps the retain flag.
 *   X5  A listen on a raw TCP broker url is refused before the run: a
 *       browser page cannot open that socket.
 *   X6  A listen that runs its request's scripts, on the page's sandbox:
 *       the run passes, and the Listen row says what the hooks did not
 *       do cleanly.
 *   X7  A Before connect that throws fails the listen before the dial;
 *       nothing after it runs.
 *
 * Every call goes to the playground's one origin, and the worker holds a
 * sixth start to an origin inside a minute: X1, X2 and X6 are the three
 * that call. A leg added here that calls counts against the five.
 *
 * Requires the extension `dist/chrome` build; the playground boots as
 * Playwright's webServer.
 *
 * Seeding: the extension boots once to mint its default workspace, its
 * `chrome.storage` gains the collection, the requests and the workflows
 * (built and schema-validated by `fixtures/workflow-runs-extension-seed.ts`
 * under tsx) from a workbench PAGE evaluate, and the browser relaunches
 * on the same profile.
 */

import { spawnSync } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { type BrowserContext, expect, type Locator, type Page, test } from '@playwright/test';
import { launchExtensionContext } from './fixtures/launch-extension';
import { WorkbenchPage } from './pages/workbench-page';

const extensionPath = path.resolve(__dirname, '../../dist/chrome');
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const SEED_SCRIPT = path.join(__dirname, 'fixtures/workflow-runs-extension-seed.ts');
// The playground webServer: the device api, the probe broker's WebSocket
// path and its TCP listener.
const DEVICES_ORIGIN = 'http://127.0.0.1:3000';
const MQTT_WS_PROBE_URL = 'ws://127.0.0.1:3000/net/mqtt';
const MQTT_PROBE_PORT = 3131;

let profileDir: string;
let context: BrowserContext;
let page: Page;
let workbench: WorkbenchPage;

async function launch(): Promise<void> {
  context = await launchExtensionContext(profileDir, extensionPath);
  const sw = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const extensionId = sw.url().split('/')[2]!;
  page = await context.newPage();
  workbench = await WorkbenchPage.open(page, extensionId);
}

async function storageGet<T>(key: string): Promise<T | undefined> {
  return page.evaluate(
    (k: string) => new Promise<T | undefined>((resolve) => chrome.storage.local.get(k, (items) => resolve(items[k]))),
    key,
  );
}

function workflowView(): Locator {
  return page.getByTestId('wf-view').filter({ visible: true }).first();
}

function runRow(stepId: string): Locator {
  return page.getByTestId(`wf-run-row-${stepId}`).filter({ visible: true }).first();
}

/** Open a workflow's tab — its panel says no run was seen yet — and press the header's Refresh. */
async function runWorkflow(uid: string): Promise<void> {
  await page.locator(`[data-item-id="workflow-${uid}"]`).click();
  await page.getByTestId('wf-run-empty').filter({ visible: true }).first().waitFor({ state: 'visible' });
  await page
    .getByRole('button', { name: /Refresh$/ })
    .filter({ visible: true })
    .first()
    .click();
}

async function expectVerdict(verdict: 'passed' | 'failed' | 'cannot-run'): Promise<void> {
  await expect(workflowView()).toHaveAttribute('data-run-verdict', verdict, { timeout: 10_000 });
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(20_000);

test.beforeAll(async () => {
  test.setTimeout(90_000);
  profileDir = await mkdtemp(path.join(tmpdir(), 'oh-workflow-runs-extension-e2e-'));

  // Boot once to mint the default workspace and learn its id.
  await launch();
  const active = await workbench.rpc<{ workspace: { id: string } | null }>('getActiveWorkspace');
  expect(active.workspace).toBeTruthy();
  const workspaceId = active.workspace!.id;
  // The registry persists asynchronously; closing before it lands would
  // let the relaunch mint a fresh default workspace under a new id.
  await expect
    .poll(
      async () => {
        const registry = await storageGet<Array<{ id: string }>>('oh.workspaces');
        return registry?.some((workspace) => workspace.id === workspaceId) ?? false;
      },
      { timeout: 20_000 },
    )
    .toBe(true);

  const seeded = spawnSync('pnpm', ['--filter', '@openheaders/extension', 'exec', 'tsx', SEED_SCRIPT], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      OH_E2E_DEVICES_ORIGIN: DEVICES_ORIGIN,
      OH_E2E_MQTT_WS_URL: MQTT_WS_PROBE_URL,
      OH_E2E_MQTT_PROBE_PORT: String(MQTT_PROBE_PORT),
      OH_E2E_WORKSPACE_ID: workspaceId,
    },
    encoding: 'utf-8',
  });
  expect(seeded.status, seeded.stderr).toBe(0);
  await page.evaluate(
    (items: Record<string, unknown>) => new Promise<void>((resolve) => chrome.storage.local.set(items, resolve)),
    { ...(JSON.parse(seeded.stdout) as Record<string, unknown>), onboardingCompleted: true },
  );
  await context.close();

  // Relaunch on the seeded slots: the service worker rebuilds its stores from them.
  await launch();
  await workbench.showWorkflowsView();
  await workbench.collapseRightSidebar();
  await page.locator('[data-item-id="workflow-e2ewxwf1"]').waitFor({ state: 'visible', timeout: 15_000 });
});

test.afterAll(async () => {
  await context?.close();
});

test('X1 — a reboot commanded over HTTP is acknowledged over MQTT: the answer to this run’s command is the match', async () => {
  await runWorkflow('e2ewxwf1');
  await expectVerdict('passed');
  await expect(runRow('probe')).toContainText('Ready in');
  await expect(runRow('probe')).toContainText('closed after');
  await expect(runRow('reboot')).toContainText('202');
  await expect(runRow('status')).toContainText('Matched after');

  // The step opens to its window: the one message on the address, and it matched.
  await runRow('status').click();
  const message = page.getByTestId('wf-run-message').filter({ visible: true }).first();
  await expect(message.getByTestId('wf-run-message-row-0')).toContainText('Matched');
  await expect(message.getByTestId('wf-run-message-fields')).toContainText('devices/dev-1/status');
});

test('X2 — a name published over MQTT is read back over HTTP: the send is acknowledged, the call polls until it holds', async () => {
  await runWorkflow('e2ewxwf2');
  await expectVerdict('passed');
  await expect(runRow('rename')).toContainText('Sent');
  await expect(runRow('rename')).toContainText('Acknowledged in');
  await expect(runRow('device')).toContainText(/Passed on attempt \d+ of 10/);
});

test('X3 — a message that never comes fails its step at the deadline, naming the address and the wait', async () => {
  await runWorkflow('e2ewxwf3');
  await expectVerdict('failed');
  await expect(runRow('health')).toContainText(
    'No message on devices/dev-1/health matched within 1.5 s of "probe" starting.',
  );
  await expect(runRow('probe')).toContainText('closed after');
});

test('X4 — an expect that passes over stored messages is refused before the run on a row that keeps the retain flag', async () => {
  await runWorkflow('e2ewxwf4');
  await expectVerdict('cannot-run');
  await expect(runRow('status')).toContainText(
    'Step "status" passes over stored messages, but "Probe MQTT 5" subscribes to devices/dev-1/# with Retain As Published on, so a live message can look stored.',
  );
  await expect(runRow('probe')).toContainText('Not run');
  await expect(runRow('reboot')).toContainText('Not run');
});

test('X5 — a listen on a raw TCP broker url is refused before the run, naming the request and the socket', async () => {
  await runWorkflow('e2ewxwf5');
  await expectVerdict('cannot-run');
  await expect(runRow('probe')).toContainText(
    'Step "probe" cannot run here: "Probe MQTT tcp" opens a raw TCP socket (mqtt:// or mqtts://), which a browser page cannot; the desktop app can run it.',
  );
  await expect(runRow('reboot')).toContainText('Not run');
  await expect(runRow('status')).toContainText('Not run');
});

test('X6 — a listen that runs its request’s scripts passes, and its row says what the hooks left', async () => {
  await runWorkflow('e2ewxwf6');
  await expectVerdict('passed');
  await expect(runRow('status')).toContainText('Matched after');
  // The failed test is a note; the refused oh.sendRequest is that one On message run erroring.
  await expect(runRow('probe')).toContainText('1 script test failed · On message script failed 1 time');
});

test('X7 — a Before connect that throws fails the listen before the dial; nothing after it runs', async () => {
  await runWorkflow('e2ewxwf7');
  await expectVerdict('failed');
  await expect(runRow('probe')).toContainText('Before connect script failed at Request: no key');
  await expect(runRow('reboot')).toContainText('Not run');
  await expect(runRow('status')).toContainText('Not run');
});
