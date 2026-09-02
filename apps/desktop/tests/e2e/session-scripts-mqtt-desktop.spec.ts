/**
 * Session scripts on the desktop host — the MQTT hooks driven through
 * the REAL spine: the built app's shared workbench UI, the node
 * byte-stream transport, the desktop's sandboxed script runtime, and
 * the playground's aedes probe broker on TCP 3131 (it republishes
 * every `probe/echo` payload on `probe/echo/reply`). The seeded
 * collection carries a Before connect slot of its own that subscribes
 * the reply topic, so the chain composes the collection's level ahead
 * of each request's (the requests seed no Topics rows).
 *
 *   S1  Before connect at the dial, ancestors first: the collection's
 *       subscription lands as the Subscribed row, the request's client
 *       id rides the CONNECT (the Connection tab reads it back), the
 *       timeline shows the script mark naming both levels, the Scripts
 *       tab's console holds the hook's log with the level prefix.
 *   S2  Before publish rewrites the compose payload (the echo proves
 *       what left); On message counts in `oh.session` and replies
 *       through `oh.publish` — the reply is captured as an ↑ message
 *       and echoed back, without re-entering Before publish; the
 *       strip's Scripts tag counts the runs.
 *   S3  A Before publish drop keeps the compose off the wire and the
 *       Send reports the dropping level; After close runs once at
 *       settle and its assertions land in the Tests view.
 *
 * Requires `pnpm turbo build --filter=@openheaders/desktop` first; the
 * playground boots as Playwright's webServer.
 *
 * Seeding: the app boots once to mint its default workspace, quits,
 * its storage gains the collection + the requests (built and
 * schema-validated by `fixtures/session-scripts-mqtt-desktop-seed.ts`
 * under the extension package's tsx), and the app relaunches on them.
 */

import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { _electron, type ElectronApplication, expect, type Locator, test } from '@playwright/test';

const APP_ROOT = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(__dirname, '../../../..');
// Port etiquette: off every prior suite's ports.
const DAEMON_PORT = 21637;
// The playground webServer runs the aedes probe broker's TCP listener.
const MQTT_PROBE_PORT = 3131;

let electronApp: ElectronApplication;
let workbench: Page;
let userData: string;
let workspaceId: string;

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
    },
  });
  workbench = await electronApp.firstWindow();
  // The MQTT editor's compose strip carries nine tabs — at the default
  // window width antd folds the trailing ones (Scripts among them) into
  // its overflow menu; a wide viewport keeps every tab on the strip.
  await workbench.setViewportSize({ width: 1720, height: 1000 });
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

// ── Workbench DOM helpers (the shared UI's selectors; visible-scoped —
//    background tabs stay mounted) ───────────────────────────────────

async function showRequestsView(): Promise<void> {
  const viewTab = workbench.locator('[data-tool-window="api-requests"]').first();
  if ((await viewTab.getAttribute('aria-selected')) !== 'true') {
    await viewTab.click();
  }
  const sectionHeader = workbench
    .getByRole('button', { name: /REQUESTS/ })
    .filter({ visible: true })
    .first();
  await sectionHeader.waitFor({ state: 'visible', timeout: 10_000 });
  if ((await sectionHeader.getAttribute('aria-expanded')) !== 'true') {
    await sectionHeader.click();
  }
}

async function collapseDocsPanel(): Promise<void> {
  const docsTab = workbench.locator('[data-tool-window="docs"]').first();
  if ((await docsTab.getAttribute('aria-selected')) === 'true') {
    await docsTab.click();
  }
}

async function expandCollection(): Promise<void> {
  const collection = workbench.locator('[data-item-id="req-col-e2esmcol"]');
  await collection.waitFor({ state: 'visible', timeout: 10_000 });
  await collection.click();
}

function connectButton(): Locator {
  return workbench.getByTestId('mqtt-connect-button').filter({ visible: true }).first();
}

function sendButton(): Locator {
  return workbench.getByTestId('mqtt-send-message').filter({ visible: true }).first();
}

function liveBadge(): Locator {
  return workbench.getByTestId('mqtt-session-live-badge').filter({ visible: true }).first();
}

function endTag(): Locator {
  return workbench.getByTestId('mqtt-session-end-tag').filter({ visible: true }).first();
}

function timelineMessageRows(): Locator {
  return workbench.getByTestId('mqtt-timeline-message-row').filter({ visible: true });
}

function scriptRows(): Locator {
  return workbench.getByTestId('mqtt-timeline-script-row').filter({ visible: true });
}

function scriptsTag(): Locator {
  return workbench.getByTestId('mqtt-session-scripts-tag').filter({ visible: true }).first();
}

async function openMqttRequest(uid: string): Promise<void> {
  const row = workbench.locator(`[data-item-id="mqtt-request-${uid}"]`);
  if (!(await row.isVisible().catch(() => false))) await expandCollection();
  await row.waitFor({ state: 'visible', timeout: 5000 });
  await row.click();
  await connectButton().waitFor({ state: 'visible', timeout: 10_000 });
}

async function connectAndAwaitOpen(): Promise<void> {
  await expect.poll(async () => connectButton().isEnabled(), { timeout: 15_000 }).toBe(true);
  await connectButton().click();
  await liveBadge().filter({ hasText: 'Connected' }).waitFor({ state: 'visible', timeout: 20_000 });
}

async function disconnectAndAwaitClose(): Promise<void> {
  await connectButton().filter({ hasText: 'Disconnect' }).click();
  await endTag().filter({ hasText: 'Disconnected' }).waitFor({ state: 'visible', timeout: 20_000 });
}

/** Switch the session pane to one of its tabs (Scripts is present once a hook ran). */
async function showSessionTab(name: 'Timeline' | 'Connection' | 'Scripts'): Promise<void> {
  const pane = workbench.getByTestId('mqtt-session-pane').filter({ visible: true }).first();
  await pane.getByRole('tab', { name, exact: true }).click();
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  test.setTimeout(180_000);
  userData = await mkdtemp(path.join(tmpdir(), 'oh-session-scripts-mqtt-desktop-e2e-'));
  await mkdir(path.join(userData, 'data'), { recursive: true });
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
  await electronApp.close();

  const seeded = spawnSync(
    'pnpm',
    [
      '--filter',
      '@openheaders/extension',
      'exec',
      'tsx',
      path.join(__dirname, 'fixtures/session-scripts-mqtt-desktop-seed.ts'),
    ],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
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

  // Phase 2: relaunch on the seeded slots and open the requests view.
  await launchApp();
  await showRequestsView();
  await collapseDocsPanel();
  await workbench.locator('[data-item-id="req-col-e2esmcol"]').waitFor({ state: 'visible', timeout: 15_000 });
});

test.afterAll(async () => {
  await electronApp?.close();
});

// ── S1: Before connect, ancestors first ─────────────────────────────

test('S1 — Before connect runs at the dial, collection first: the subscription lands, the client id rides the CONNECT, the mark names both levels', async () => {
  await openMqttRequest('e2esmq01');
  // The Scripts tab draws the request's four MQTT slots flat with the
  // "Runs after" line naming the collection ahead of Before connect.
  await workbench.getByRole('tab', { name: 'Scripts', exact: true }).filter({ visible: true }).first().click();
  const rail = workbench.getByTestId('oh-script-rail').filter({ visible: true }).first();
  await expect(rail).toContainText('Before connect');
  await expect(rail).toContainText('Before publish');
  await expect(rail).not.toContainText('Before send');
  await expect(workbench.getByTestId('oh-scripts-runs-after').filter({ visible: true }).first()).toContainText(
    'Scripted Brokers',
  );

  await connectAndAwaitOpen();
  // The collection's level subscribed the reply topic — the request
  // seeds no Topics rows, so the Subscribed row is the chain's proof.
  await workbench
    .getByTestId('mqtt-timeline-subscribed-row')
    .filter({ visible: true })
    .filter({ hasText: 'probe/echo/reply' })
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 });
  const mark = scriptRows().first();
  await mark.waitFor({ state: 'visible', timeout: 10_000 });
  await expect(mark).toContainText('Before connect');
  await expect(mark).toContainText('Scripted Brokers');
  await expect(mark).toContainText('Request');
  await expect(scriptsTag()).toHaveText('Scripts · 1');

  // The request level renamed the client id — the CONNECT carried it,
  // the Connection tab reads it back.
  await showSessionTab('Connection');
  await expect(workbench.getByTestId('mqtt-connection-tab').filter({ visible: true }).first()).toContainText(
    'scripted-probe',
  );

  // The Scripts tab carries the hook's console line, live — the request
  // level's log carries its level prefix (two levels ran) and the dial
  // as composed: the broker URL and the client id it had set.
  await showSessionTab('Scripts');
  await expect(workbench.getByTestId('mqtt-script-console-block').filter({ visible: true }).first()).toContainText(
    `[Request] dialing mqtt://127.0.0.1:${MQTT_PROBE_PORT} scripted-probe`,
  );
  await showSessionTab('Timeline');
  await disconnectAndAwaitClose();
});

// ── S2: Before publish and On message ───────────────────────────────

test('S2 — Before publish rewrites the compose, On message counts in oh.session and replies through oh.publish', async () => {
  await openMqttRequest('e2esmq02');
  await connectAndAwaitOpen();
  await workbench
    .getByTestId('mqtt-timeline-subscribed-row')
    .filter({ visible: true })
    .filter({ hasText: 'probe/echo/reply' })
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 });
  await expect(sendButton()).toBeEnabled();
  await sendButton().click();
  // The rewritten payload left and the probe echoed it on the reply
  // topic; the On message hook's reply went out as its own ↑ message
  // and was echoed too.
  await timelineMessageRows()
    .filter({ has: workbench.getByTestId('mqtt-timeline-topic-chip').filter({ hasText: 'probe/echo/reply' }) })
    .filter({ hasText: 'ping-rewritten' })
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 });
  await timelineMessageRows()
    .filter({ has: workbench.getByTestId('mqtt-timeline-topic-chip').filter({ hasText: 'probe/echo/reply' }) })
    .filter({ hasText: 'reply-1' })
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 });
  // ↑ ping-rewritten, ↓ its echo (1) → reply-1, ↓ the reply's echo (2).
  await expect.poll(async () => timelineMessageRows().count(), { timeout: 15_000 }).toBe(4);
  // The collection's Before connect, one Before publish, two On message
  // runs (the echo, the reply's echo).
  await expect(scriptsTag()).toHaveText('Scripts · 4');
  await disconnectAndAwaitClose();
  await expect(scriptsTag()).toHaveText('Scripts · 4');
});

// ── S3: a Before publish drop and After close ───────────────────────

test('S3 — a Before publish drop keeps the message off the wire; After close asserts on the end record', async () => {
  await openMqttRequest('e2esmq03');
  await connectAndAwaitOpen();
  await workbench
    .getByTestId('mqtt-timeline-subscribed-row')
    .filter({ visible: true })
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 });
  await sendButton().click();
  // The drop: a script mark names the level, no ↑ message lands.
  await scriptRows()
    .filter({ hasText: 'Before publish dropped the message — Request' })
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });
  await expect(timelineMessageRows()).toHaveCount(0);

  await disconnectAndAwaitClose();
  await scriptRows().filter({ hasText: 'After close' }).first().waitFor({ state: 'visible', timeout: 10_000 });
  await showSessionTab('Scripts');
  const tests = workbench.getByTestId('mqtt-script-test-row').filter({ visible: true });
  await expect(tests).toHaveCount(2);
  await expect(tests.nth(0)).toContainText('disconnected cleanly');
  await expect(tests.nth(0)).toContainText('PASS');
  await expect(tests.nth(1)).toContainText('nothing was published');
  await expect(tests.nth(1)).toContainText('PASS');
});
