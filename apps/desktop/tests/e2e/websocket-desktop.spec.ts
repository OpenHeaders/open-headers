/**
 * WebSocket desktop in-process legs — the Phase C session-plane gate
 * on the REAL stack: the built desktop app (isolated userData,
 * off-default daemon port), the shared workbench UI driving a live
 * session through the node transport, against the playground's
 * `/net/ws-probe` (the Playwright webServer boots the playground; the
 * probe rides its dev server's upgrade handler).
 *
 *   W1  full session walk: Connect morphs to Disconnect, the greeting
 *       frame proves the subprotocol offer AND the custom handshake
 *       header made the wire, Send echoes (↑ then ↓ in call order),
 *       live rows carry session timestamps, Disconnect settles the
 *       clean Closed 1000 with the Disconnected lifecycle row at the
 *       recorded edge.
 *   W2  `?push=` live batches: enabled param rows reach the wire
 *       (appendQueryParams) and unsolicited server messages land in
 *       the live timeline.
 *   W3  close-code menu: a server close with a foreign code renders
 *       VERBATIM — code + reason on the warning tint, never
 *       synthesized (the capture law's display twin).
 *   W4  refused dial: a dead port settles as a classified pre-open
 *       error state, not a timeline.
 *   W5  socketio flavor (Phase E): the hand-rolled engine.io/socket.io
 *       framing against the REAL socket.io server at `/net/sio-probe` —
 *       namespace CONNECT, decoded event rows (greeting), an acked
 *       `echo` emit whose EVENT / reply / ACK all land, control frames
 *       subdued, clean Disconnect.
 *
 * Deliberately NOT here (covered elsewhere): the entity/editor
 * lifecycle + honest browser posture (extension
 * `websocket-workbench.spec.ts`), the ⌘/Ctrl+Enter chords (jsdom
 * editor matrix — platform-modifier dispatch is not portable under
 * Playwright), and the rider unit surfaces (oracle/host-node suites).
 *
 * Requires `pnpm turbo build --filter=@openheaders/desktop` first.
 *
 * Seeding: the app boots once to mint its default workspace, quits,
 * its storage.json gains the probe collection + four W-leg requests
 * (built and schema-validated by `fixtures/websocket-desktop-seed.ts`
 * under the extension package's tsx), and the app relaunches on them.
 */

import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { _electron, type ElectronApplication, expect, type Locator, test } from '@playwright/test';

const APP_ROOT = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(__dirname, '../../../..');
// Port etiquette: off every prior suite's ports (18137, 18337–18339,
// 18443, 18537, 18637, 18737, 18747, 18937, 19037, 19039, 19137,
// 19237, 19337, 19437).
const DAEMON_PORT = 19637;
// The playground webServer carries the ws-probe upgrade on its own port.
const WS_PROBE_PORT = 3000;
// Nothing listens here — the refused-dial leg.
const WS_DEAD_PORT = 19997;

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
  // Engine-ready gate: the pre-engine rpc queue answers once the spine
  // is up, so one bridge round-trip is the readiness probe.
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

async function openWebsocketRequest(uid: string): Promise<void> {
  const row = workbench.locator(`[data-item-id="websocket-request-${uid}"]`);
  if (!(await row.isVisible().catch(() => false))) {
    const collection = workbench.locator('[data-item-id="req-col-e2ewscol"]');
    await collection.waitFor({ state: 'visible', timeout: 10_000 });
    await collection.click();
  }
  await row.waitFor({ state: 'visible', timeout: 5000 });
  await row.click();
  await connectButton().waitFor({ state: 'visible', timeout: 10_000 });
}

/** Connect and wait for the handshake to settle on the live badge. */
async function connectAndAwaitOpen(): Promise<void> {
  await expect.poll(async () => connectButton().isEnabled(), { timeout: 15_000 }).toBe(true);
  await connectButton().click();
  await liveBadge().filter({ hasText: 'CONNECTED' }).waitFor({ state: 'visible', timeout: 20_000 });
}

/** Disconnect (the clean close 1000) and wait for the settled tag. */
async function disconnectAndAwaitClose(text: string): Promise<void> {
  await connectButton().filter({ hasText: 'Disconnect' }).click();
  await closeTag().filter({ hasText: text }).waitFor({ state: 'visible', timeout: 20_000 });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  test.setTimeout(180_000);
  userData = await mkdtemp(path.join(tmpdir(), 'oh-websocket-desktop-e2e-'));
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
  await electronApp.close();

  // Seed the workspace slots with schema-validated entities (tsx via
  // the extension package — the one that carries the tsx devDep).
  const seeded = spawnSync(
    'pnpm',
    ['--filter', '@openheaders/extension', 'exec', 'tsx', path.join(__dirname, 'fixtures/websocket-desktop-seed.ts')],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        OH_E2E_WS_PROBE_PORT: String(WS_PROBE_PORT),
        OH_E2E_WS_DEAD_PORT: String(WS_DEAD_PORT),
        OH_E2E_WORKSPACE_ID: workspaceId,
      },
      encoding: 'utf-8',
    },
  );
  expect(seeded.status, seeded.stderr).toBe(0);
  const storagePath = path.join(userData, 'storage.json');
  const envelope = JSON.parse(await readFile(storagePath, 'utf-8')) as { values: Record<string, unknown> };
  Object.assign(envelope.values, JSON.parse(seeded.stdout) as Record<string, unknown>);
  await writeFile(storagePath, JSON.stringify(envelope));

  // Phase 2: relaunch on the seeded slots and open the requests view.
  await launchApp();
  await showRequestsView();
  await collapseDocsPanel();
  await workbench.locator('[data-item-id="req-col-e2ewscol"]').waitFor({ state: 'visible', timeout: 15_000 });
});

test.afterAll(async () => {
  await electronApp?.close();
});

// ── W1: full session walk ───────────────────────────────────────────

test('W1 — Connect morphs, the greeting proves subprotocol + header, Send echoes, Disconnect reads Closed 1000', async () => {
  await openWebsocketRequest('e2ewsd01');
  await connectAndAwaitOpen();

  // Connect has morphed into Disconnect while the session is open.
  await expect(connectButton()).toHaveText(/Disconnect/);

  // The greeting frame mirrors the `x-probe-client` header — the
  // custom handshake header made the wire.
  const greetingRow = timelineMessageRows().filter({ hasText: 'oh-desktop-e2e' }).first();
  await greetingRow.waitFor({ state: 'visible', timeout: 15_000 });

  // The Connected lifecycle row names the negotiated subprotocol.
  await workbench
    .getByTestId('ws-timeline-connected-row')
    .filter({ visible: true })
    .filter({ hasText: 'Connected — subprotocol oh-e2e-proto' })
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });

  // Send the compose text: the ↑ frame and the probe's echo ↓ land.
  await expect(sendButton()).toBeEnabled();
  await sendButton().click();
  await timelineMessageRows()
    .filter({ hasText: 'echo:hello probe' })
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 });
  await expect.poll(async () => timelineMessageRows().count(), { timeout: 15_000 }).toBe(3);

  // Live-session rows carry timestamps (the session-only law).
  expect(await workbench.getByTestId('ws-timeline-message-time').filter({ visible: true }).count()).toBeGreaterThan(0);

  await disconnectAndAwaitClose('Closed 1000');

  // The settled timeline reads newest-first: Disconnected at the new
  // edge, echo ↓ above hello ↑ (call order reversed), the greeting ↓,
  // Connected, then Connecting at the old edge.
  const rows = workbench
    .locator(
      '[data-testid="ws-timeline-sent-row"], [data-testid="ws-timeline-connected-row"], ' +
        '[data-testid="ws-timeline-ended-row"], [data-testid="ws-timeline-message-row"]',
    )
    .filter({ visible: true });
  const sequence = await rows.evaluateAll((els) =>
    els.map((el) => {
      const id = el.getAttribute('data-testid') ?? '';
      if (id !== 'ws-timeline-message-row') return id.replace('ws-timeline-', '').replace('-row', '');
      return el.querySelector('.anticon-arrow-up') !== null ? 'up' : 'down';
    }),
  );
  expect(sequence).toEqual(['ended', 'down', 'up', 'down', 'connected', 'sent']);
  await workbench
    .getByTestId('ws-timeline-ended-row')
    .filter({ visible: true })
    .filter({ hasText: 'Disconnected' })
    .first()
    .waitFor({ state: 'visible' });
});

// ── W2: `?push=` live batches ───────────────────────────────────────

test('W2 — enabled param rows reach the wire and unsolicited pushes land live', async () => {
  await openWebsocketRequest('e2ewsd02');
  await connectAndAwaitOpen();

  // The greeting plus three timed pushes — the `?push=3&ms=60` params
  // only exist on the wire if appendQueryParams ran.
  await expect.poll(async () => timelineMessageRows().count(), { timeout: 20_000 }).toBe(4);
  await timelineMessageRows().filter({ hasText: 'probe push 3/3' }).first().waitFor({ state: 'visible' });

  await disconnectAndAwaitClose('Closed 1000');
});

// ── W3: close-code menu — verbatim foreign close ────────────────────

test('W3 — a server close with a foreign code renders code + reason verbatim', async () => {
  await openWebsocketRequest('e2ewsd03');
  await connectAndAwaitOpen();

  // The compose text IS the probe's close command — sending it makes
  // the server close 4321 "probe-menu"; the session settles without a
  // local Disconnect.
  await sendButton().click();
  await closeTag().filter({ hasText: 'Closed 4321' }).waitFor({ state: 'visible', timeout: 20_000 });
  await workbench
    .getByTestId('ws-timeline-ended-row')
    .filter({ visible: true })
    .filter({ hasText: '4321 probe-menu' })
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });
});

// ── W4: refused dial — classified pre-open error ────────────────────

test('W4 — a dead port settles as the classified refused-dial error state', async () => {
  await openWebsocketRequest('e2ewsd04');
  await expect.poll(async () => connectButton().isEnabled(), { timeout: 15_000 }).toBe(true);
  await connectButton().click();

  const errorState = workbench.getByTestId('ws-session-error').filter({ visible: true }).first();
  await errorState.waitFor({ state: 'visible', timeout: 20_000 });
  await expect(workbench.getByTestId('ws-session-error-detail').filter({ visible: true }).first()).toContainText(
    `Connection refused by 127.0.0.1:${WS_DEAD_PORT}`,
  );
});

// ── W5: socketio flavor against the real socket.io server ───────────

test('W5 — socketio handshake, namespace connect, acked echo event and decoded rows', async () => {
  await openWebsocketRequest('e2ewsd05');
  await connectAndAwaitOpen();

  // The greeting proves the whole handshake chain: engine.io open,
  // our namespace CONNECT, the server's connect ack, then the first
  // EVENT decoded by name.
  const eventNames = workbench.getByTestId('ws-sio-event-name').filter({ visible: true });
  await eventNames.filter({ hasText: 'probe:hello' }).first().waitFor({ state: 'visible', timeout: 15_000 });
  await timelineMessageRows().filter({ hasText: 'connect /probe' }).first().waitFor({ state: 'visible' });
  await timelineMessageRows().filter({ hasText: 'connected /probe' }).first().waitFor({ state: 'visible' });
  await timelineMessageRows().filter({ hasText: 'engine.io open' }).first().waitFor({ state: 'visible' });

  // Send emits the composed `echo` event with an ack id; the server's
  // reply event AND the correlated ACK land decoded.
  await expect(sendButton()).toBeEnabled();
  await sendButton().click();
  await eventNames.filter({ hasText: 'echo:reply' }).first().waitFor({ state: 'visible', timeout: 15_000 });
  const echoRow = timelineMessageRows().filter({ hasText: 'echo' }).filter({ hasText: '#1' }).first();
  await echoRow.waitFor({ state: 'visible', timeout: 10_000 });
  await timelineMessageRows()
    .filter({ hasText: 'ack' })
    .filter({ hasText: '#1' })
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });

  await disconnectAndAwaitClose('Closed 1000');
});
