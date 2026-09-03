/**
 * Session scripts on the desktop host — the gRPC hooks driven through
 * the REAL spine: the built app's shared workbench UI, the node HTTP/2
 * transport, the desktop's sandboxed script runtime, and the
 * playground's h2c gRPC probe on 3130 (it mirrors the call's
 * `authorization` metadata back as `x-echo-authorization`). The
 * seeded collection carries a Before invoke slot of its own that sets
 * that metadata, so the chain composes the collection's level ahead
 * of each request's (the requests seed no metadata rows).
 *
 *   S1  Before invoke once before the wire, ancestors first: the
 *       collection's metadata rewrite reaches the wire (the probe's
 *       echo in the Metadata tab), the request's level logs the call
 *       it saw with the level prefix; On message reads the decoded
 *       reply; After response asserts land in the unary pane's Scripts
 *       tab; the strip's Scripts tag counts the three runs.
 *   S2  A server stream: On message runs on the ↑ request frame and
 *       every ↓ book, `oh.session` counts across them, the marks
 *       interleave the timeline at their capture positions and the
 *       stream pane's Scripts tab lists the console lines.
 *   S3  A bidi call: the rider's send has no hook, On message counts
 *       the echo, Stop mid-stream settles After response with the stop
 *       recorded — its assertions read PASS.
 *
 * Requires `pnpm turbo build --filter=@openheaders/desktop` first; the
 * playground boots as Playwright's webServer.
 *
 * Seeding: the app boots once to mint its default workspace, quits,
 * its storage gains the spec + the collection + the requests (built
 * and schema-validated by `fixtures/session-scripts-grpc-desktop-seed.ts`
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
const DAEMON_PORT = 21737;
// The playground webServer's h2c gRPC probe.
const GRPC_PORT = 3130;

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
  // The gRPC editor's compose strip carries seven tabs — at the default
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
  const collection = workbench.locator('[data-item-id="req-col-e2esgcol"]');
  await collection.waitFor({ state: 'visible', timeout: 10_000 });
  await collection.click();
}

function invokeButton(): Locator {
  return workbench.getByTestId('grpc-invoke-button').filter({ visible: true }).first();
}

function statusTag(): Locator {
  return workbench.getByTestId('grpc-status-tag').filter({ visible: true }).first();
}

function responsePane(): Locator {
  return workbench.getByTestId('grpc-response-pane').filter({ visible: true }).first();
}

function streamPane(): Locator {
  return workbench.getByTestId('grpc-stream-pane').filter({ visible: true }).first();
}

function timelineMessageRows(): Locator {
  return workbench.getByTestId('grpc-timeline-message-row').filter({ visible: true });
}

function scriptRows(): Locator {
  return workbench.getByTestId('grpc-timeline-script-row').filter({ visible: true });
}

function scriptsTag(): Locator {
  return workbench.getByTestId('grpc-session-scripts-tag').filter({ visible: true }).first();
}

/** Switch the visible result pane to one of its tabs. */
async function showResultTab(name: RegExp): Promise<void> {
  await workbench.locator('.rules-response-tabs').filter({ visible: true }).getByRole('tab', { name }).first().click();
}

async function openGrpcRequest(uid: string): Promise<void> {
  const row = workbench.locator(`[data-item-id="grpc-request-${uid}"]`);
  if (!(await row.isVisible().catch(() => false))) await expandCollection();
  await row.waitFor({ state: 'visible', timeout: 5000 });
  await row.click();
  await invokeButton().waitFor({ state: 'visible', timeout: 10_000 });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  test.setTimeout(180_000);
  userData = await mkdtemp(path.join(tmpdir(), 'oh-session-scripts-grpc-desktop-e2e-'));
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
      path.join(__dirname, 'fixtures/session-scripts-grpc-desktop-seed.ts'),
    ],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        OH_E2E_GRPC_PORT: String(GRPC_PORT),
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
  await workbench.locator('[data-item-id="req-col-e2esgcol"]').waitFor({ state: 'visible', timeout: 15_000 });
});

test.afterAll(async () => {
  await electronApp?.close();
});

// ── S1: unary — Before invoke, On message, After response ───────────

test('S1 — Before invoke runs before the wire, collection first: the echoed metadata, the console with the level prefix, the assertions in the Scripts tab', async () => {
  await openGrpcRequest('e2esgr01');
  // The Scripts tab draws the request's three gRPC slots flat with the
  // "Runs after" line naming the collection ahead of Before invoke.
  await workbench.getByRole('tab', { name: 'Scripts', exact: true }).filter({ visible: true }).first().click();
  const rail = workbench.getByTestId('oh-script-rail').filter({ visible: true }).first();
  await expect(rail).toContainText('Before invoke');
  await expect(rail).toContainText('After response');
  await expect(rail).not.toContainText('Before connect');
  await expect(workbench.getByTestId('oh-scripts-runs-after').filter({ visible: true }).first()).toContainText(
    'Scripted Books',
  );

  await expect.poll(async () => invokeButton().isEnabled(), { timeout: 15_000 }).toBe(true);
  await invokeButton().click();
  await statusTag().filter({ hasText: '0 OK' }).waitFor({ state: 'visible', timeout: 20_000 });
  await expect(responsePane()).toContainText('The Open Headers Field Guide');
  // Before invoke (two levels), one On message, After response.
  await expect(scriptsTag()).toHaveText('Scripts · 3');

  // The collection's level set the authorization metadata — the probe
  // mirrored it back, so the wire carried the rewrite.
  await showResultTab(/Metadata/);
  await expect(responsePane()).toContainText('scripted-by-collection');

  // The Scripts tab: the request level's log carries its level prefix
  // (two levels ran) and the call as composed — the collection's row
  // already counted; the decoded reply's title; the two PASS rows.
  await showResultTab(/Scripts/);
  const consoleBlocks = workbench.getByTestId('grpc-script-console-block').filter({ visible: true });
  await expect(consoleBlocks.first()).toContainText('[Request] invoking GetBook unary 1');
  await expect(consoleBlocks.nth(1)).toContainText('decoded down The Open Headers Field Guide');
  const tests = workbench.getByTestId('grpc-script-test-row').filter({ visible: true });
  await expect(tests).toHaveCount(2);
  await expect(tests.nth(0)).toContainText('status is OK');
  await expect(tests.nth(0)).toContainText('PASS');
  await expect(tests.nth(1)).toContainText('one reply');
  await expect(tests.nth(1)).toContainText('PASS');
});

// ── S2: server stream — On message both directions ──────────────────

test('S2 — a server stream runs On message on the ↑ request and every ↓ book; the marks interleave the timeline', async () => {
  await openGrpcRequest('e2esgr02');
  await expect.poll(async () => invokeButton().isEnabled(), { timeout: 15_000 }).toBe(true);
  await invokeButton().click();
  await streamPane().waitFor({ state: 'visible', timeout: 15_000 });
  await expect.poll(async () => timelineMessageRows().count(), { timeout: 20_000 }).toBe(4);
  await statusTag().filter({ hasText: '0 OK' }).waitFor({ state: 'visible', timeout: 15_000 });
  // Before invoke (the collection's level), four On message, After response.
  await expect(scriptsTag()).toHaveText('Scripts · 6');
  await expect(scriptRows()).toHaveCount(6);
  await expect(scriptRows().first()).toContainText('After response');
  await expect(scriptRows().last()).toContainText('Before invoke');
  await expect(scriptRows().last()).toContainText('Scripted Books');

  await showResultTab(/Scripts/);
  const consoleBlocks = workbench.getByTestId('grpc-script-console-block').filter({ visible: true });
  await expect(consoleBlocks).toHaveCount(4);
  await expect(consoleBlocks.first()).toContainText('up 1');
  await expect(consoleBlocks.last()).toContainText('down 4 books/watch-3');
  const tests = workbench.getByTestId('grpc-script-test-row').filter({ visible: true });
  await expect(tests).toHaveCount(1);
  await expect(tests.first()).toContainText('four frames');
  await expect(tests.first()).toContainText('PASS');
});

// ── S3: bidi — no hook on the rider, After response on Stop ─────────

test('S3 — a bidi send has no hook, On message counts the echo, Stop settles After response with the stop recorded', async () => {
  await openGrpcRequest('e2esgr03');
  await expect.poll(async () => invokeButton().isEnabled(), { timeout: 15_000 }).toBe(true);
  await invokeButton().click();
  await workbench
    .getByTestId('grpc-timeline-sent-row')
    .filter({ visible: true })
    .first()
    .waitFor({ state: 'visible', timeout: 5000 });
  const sendButton = workbench.getByTestId('grpc-stream-send').filter({ visible: true }).first();
  await sendButton.click();
  // The ↑ frame and the probe's echo ↓ both land — and both ran On
  // message (live marks, the strip counting them).
  await expect.poll(async () => timelineMessageRows().count(), { timeout: 15_000 }).toBe(2);
  await expect(scriptsTag()).toHaveText('Scripts · 3');

  // Invoke has morphed into Stop — the call settles with the stop
  // recorded and After response runs on it.
  await invokeButton().click();
  await expect(statusTag()).toContainText('1 CANCELLED', { timeout: 15_000 });
  await expect(scriptsTag()).toHaveText('Scripts · 4');
  await showResultTab(/Scripts/);
  const tests = workbench.getByTestId('grpc-script-test-row').filter({ visible: true });
  await expect(tests).toHaveCount(2);
  await expect(tests.nth(0)).toContainText('stopped by the user');
  await expect(tests.nth(0)).toContainText('PASS');
  await expect(tests.nth(1)).toContainText('echo arrived');
  await expect(tests.nth(1)).toContainText('PASS');
});
