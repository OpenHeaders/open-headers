/**
 * Session scripts on the desktop host — the WebSocket hooks driven
 * through the REAL spine: the built app's shared workbench UI, the
 * node WebSocket transport, the desktop's sandboxed script runtime,
 * and the playground's `/net/ws-probe` (its greeting mirrors the
 * handshake's request-target; it echoes every text frame). The
 * seeded collection carries a Before connect slot of its own, so the
 * chain composes the collection's level ahead of each request's.
 *
 *   S1  Before connect at the dial, ancestors first: the greeting's
 *       request-target carries the collection's param AND the
 *       request's; the timeline shows the script mark naming both
 *       levels; the Scripts view's console holds the hook's log.
 *   S2  Before send rewrites the compose text (the echo proves what
 *       left); On message counts frames in `oh.session` and replies
 *       through `oh.send` — the reply is captured as an ↑ frame and
 *       echoed back, without re-entering Before send; the strip's
 *       Scripts tag counts the runs.
 *   S3  A Before send drop keeps the compose text off the wire and the
 *       Send reports the dropping level; After close runs once at
 *       settle and its assertions land in the Tests view.
 *
 * Requires `pnpm turbo build --filter=@openheaders/desktop` first; the
 * playground boots as Playwright's webServer.
 *
 * Seeding: the app boots once to mint its default workspace, quits,
 * its storage gains the collection + the requests (built and
 * schema-validated by `fixtures/session-scripts-desktop-seed.ts`
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
const DAEMON_PORT = 21537;
const WS_PROBE_PORT = 3000;

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
  const collection = workbench.locator('[data-item-id="req-col-e2esccol"]');
  await collection.waitFor({ state: 'visible', timeout: 10_000 });
  await collection.click();
}

function connectButton(): Locator {
  return workbench.getByTestId('websocket-connect-button').filter({ visible: true }).first();
}

function sendButton(): Locator {
  return workbench.getByTestId('websocket-send-message').filter({ visible: true }).first();
}

function liveBadge(): Locator {
  return workbench.getByTestId('ws-session-live-badge').filter({ visible: true }).first();
}

function closeTag(): Locator {
  return workbench.getByTestId('ws-session-close-tag').filter({ visible: true }).first();
}

function timelineMessageRows(): Locator {
  return workbench.getByTestId('ws-timeline-message-row').filter({ visible: true });
}

function scriptRows(): Locator {
  return workbench.getByTestId('ws-timeline-script-row').filter({ visible: true });
}

function scriptsTag(): Locator {
  return workbench.getByTestId('ws-session-scripts-tag').filter({ visible: true }).first();
}

async function openWebsocketRequest(uid: string): Promise<void> {
  const row = workbench.locator(`[data-item-id="websocket-request-${uid}"]`);
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
  await closeTag().filter({ hasText: 'Disconnected' }).waitFor({ state: 'visible', timeout: 20_000 });
}

/** Switch the session pane to its Scripts view (present once a hook ran). */
async function showScriptsView(): Promise<void> {
  await workbench.getByTestId('ws-session-view-scripts').filter({ visible: true }).first().click();
  await workbench
    .getByTestId('ws-session-scripts-view')
    .filter({ visible: true })
    .first()
    .waitFor({ state: 'visible' });
}

async function showTimelineView(): Promise<void> {
  await workbench.getByTestId('ws-session-view-timeline').filter({ visible: true }).first().click();
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  test.setTimeout(180_000);
  userData = await mkdtemp(path.join(tmpdir(), 'oh-session-scripts-desktop-e2e-'));
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
      path.join(__dirname, 'fixtures/session-scripts-desktop-seed.ts'),
    ],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        OH_E2E_WS_PROBE_PORT: String(WS_PROBE_PORT),
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
  await workbench.locator('[data-item-id="req-col-e2esccol"]').waitFor({ state: 'visible', timeout: 15_000 });
});

test.afterAll(async () => {
  await electronApp?.close();
});

// ── S1: Before connect, ancestors first ─────────────────────────────

test('S1 — Before connect runs at the dial, collection first: both params reach the probe, the mark names both levels', async () => {
  await openWebsocketRequest('e2escws1');
  // The Scripts tab draws the request's four slots flat with the
  // "Runs after" line naming the collection ahead of Before connect.
  await workbench.getByRole('tab', { name: 'Scripts', exact: true }).filter({ visible: true }).first().click();
  const rail = workbench.getByTestId('oh-script-rail').filter({ visible: true }).first();
  await expect(rail).toContainText('Before connect');
  await expect(rail).toContainText('After close');
  await expect(rail).not.toContainText('Before request');
  await expect(workbench.getByTestId('oh-scripts-runs-after').filter({ visible: true }).first()).toContainText(
    'Scripted Sessions',
  );

  await connectAndAwaitOpen();
  // The greeting mirrors the request-target: the collection's param
  // then the request's, in chain order.
  await timelineMessageRows()
    .filter({ hasText: '"url":"/net/ws-probe?from=collection&tag=from-request"' })
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 });
  const mark = scriptRows().first();
  await mark.waitFor({ state: 'visible', timeout: 10_000 });
  await expect(mark).toContainText('Before connect');
  await expect(mark).toContainText('Scripted Sessions');
  await expect(mark).toContainText('Request');
  await expect(scriptsTag()).toHaveText('Scripts · 1');

  // The Scripts view carries the hook's console line, live — the
  // request level's log carries its level prefix (two levels ran) and
  // the dial as the collection's level left it: the chain composes
  // outer → inner, each level seeing the previous one's product.
  await showScriptsView();
  await expect(workbench.getByTestId('ws-script-console-block').filter({ visible: true }).first()).toContainText(
    '[Request] dialing ws://127.0.0.1:3000/net/ws-probe?from=collection',
  );
  await showTimelineView();
  await disconnectAndAwaitClose();
});

// ── S2: Before send and On message ──────────────────────────────────

test('S2 — Before send rewrites the compose, On message counts in oh.session and replies through oh.send', async () => {
  await openWebsocketRequest('e2escws2');
  await connectAndAwaitOpen();
  await expect(sendButton()).toBeEnabled();
  await sendButton().click();
  // The rewritten text left and the probe echoed it; the On message
  // hook's reply went out as its own ↑ frame and was echoed too.
  await timelineMessageRows()
    .filter({ hasText: 'echo:ping-rewritten' })
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 });
  await timelineMessageRows()
    .filter({ hasText: 'echo:reply-2' })
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 });
  // ↑ ping-rewritten, ↓ greeting (1), ↓ echo (2) → reply-2, ↓ echo of it.
  await expect.poll(async () => timelineMessageRows().count(), { timeout: 15_000 }).toBe(5);
  // The collection's Before connect, one Before send, three On message
  // runs (the greeting, the echo, the reply's echo).
  await expect(scriptsTag()).toHaveText('Scripts · 5');
  await disconnectAndAwaitClose();
  await expect(scriptsTag()).toHaveText('Scripts · 5');
});

// ── S3: a Before send drop and After close ──────────────────────────

test('S3 — a Before send drop keeps the message off the wire; After close asserts on the end record', async () => {
  await openWebsocketRequest('e2escws3');
  await connectAndAwaitOpen();
  await timelineMessageRows()
    .filter({ hasText: '"probe":"ws-probe"' })
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 });
  await sendButton().click();
  // The drop: a script mark names the level, no ↑ frame lands.
  await scriptRows()
    .filter({ hasText: 'Before send dropped the message — Request' })
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });
  await expect(timelineMessageRows()).toHaveCount(1);

  await disconnectAndAwaitClose();
  await scriptRows().filter({ hasText: 'After close' }).first().waitFor({ state: 'visible', timeout: 10_000 });
  await showScriptsView();
  const tests = workbench.getByTestId('ws-script-test-row').filter({ visible: true });
  await expect(tests).toHaveCount(2);
  await expect(tests.nth(0)).toContainText('closed cleanly');
  await expect(tests.nth(0)).toContainText('PASS');
  await expect(tests.nth(1)).toContainText('nothing was sent');
  await expect(tests.nth(1)).toContainText('PASS');
});
