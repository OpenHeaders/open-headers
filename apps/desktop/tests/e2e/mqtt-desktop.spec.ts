/**
 * MQTT desktop in-process legs — the Phase C session-plane gate on the
 * REAL stack: the built desktop app (isolated userData, off-default
 * daemon port), the shared workbench UI driving a live session through
 * the node byte-stream transport, against the playground's aedes probe
 * broker on TCP 3131 (the Playwright webServer boots the playground;
 * the broker rides its own listener beside the dev server).
 *
 * Every leg runs the `protocolVersion: '3.1.1'` knob — aedes speaks
 * 3.1.1 only (the epic's recorded fact), so the knob IS the honest
 * real-broker coverage; 5.0 wire behavior is unit-gated in the
 * codec/driver matrices.
 *
 *   M1  full session walk: Connect morphs to Disconnect, the Connected
 *       row expands to the verbatim CONNACK facts, the enabled topic row
 *       subscribes at open (Subscribed row with the SUBACK grant),
 *       Send publishes the echo topic and the probe's republish lands
 *       on the subscribed reply topic (↑ then ↓ with topic chips),
 *       Disconnect settles the clean success tag with the newest-first
 *       sequence intact.
 *   M2  retained delivery: the pre-seeded retained message arrives on
 *       subscribe carrying the Retained fact tag.
 *   M3  ticker live batches: subscribing starts 5 deterministic timed
 *       publishes that land in the live timeline.
 *   M4  refused dial: a dead port settles as the classified error row
 *       at the timeline's edge with the Connect failed pill.
 *   M5  live Subscribe toggle: a row seeded OFF subscribes mid-session
 *       through the rider — the SUBACK grant marks the row and the
 *       Subscribed lifecycle row lands at its position.
 *   M6  severed end: publishing the probe's close topic makes the
 *       broker destroy the connection — the session settles on the
 *       error-tinted severed tag, never a synthesized close.
 *   M7  Save Response (Phase E): a settled session freezes into an
 *       MqttResponseExample — viewer tab with the captured end pill,
 *       sidebar example leaf under the parent request, "Open in
 *       Request" returns to the parent editor.
 *   M8  Basic auth (Phase F): the probe identity on CONNECT opens the
 *       session; a wrong password settles as the verbatim CONNACK
 *       refusal (Bad user name or password, code 4).
 *   M9  the 5.0 knob against the 3.1.1-only broker: aedes answers a
 *       3.1.1-form CONNACK return code 0x01 — the refusal reads
 *       verbatim (Unacceptable protocol version), never an open
 *       session the broker is closing.
 *
 * Deliberately NOT here (covered elsewhere): the entity/editor
 * lifecycle + honest browser posture (extension
 * `mqtt-workbench.spec.ts`), the ⌘/Ctrl+Enter chords (jsdom editor
 * matrix — platform-modifier dispatch is not portable under
 * Playwright), and the rider unit surfaces (oracle/host-node suites).
 *
 * Requires `pnpm turbo build --filter=@openheaders/desktop` first.
 *
 * Seeding: the app boots once to mint its default workspace, quits,
 * its storage.json gains the probe collection + the M-leg requests
 * (built and schema-validated by `fixtures/mqtt-desktop-seed.ts` under
 * the extension package's tsx), and the app relaunches on them.
 */

import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { _electron, type ElectronApplication, expect, type Locator, test } from '@playwright/test';

const APP_ROOT = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(__dirname, '../../../..');
// Port etiquette: off every prior suite's ports (18137, 18337–18339,
// 18443, 18537, 18637, 18737, 18747, 18937, 19037, 19039, 19137,
// 19237, 19337, 19437, 19637).
const DAEMON_PORT = 19737;
// The playground webServer runs the aedes probe broker's TCP listener.
const MQTT_PROBE_PORT = 3131;
// Nothing listens here — the refused-dial leg (19997 is the WS suite's).
const MQTT_DEAD_PORT = 19998;

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

async function openMqttRequest(uid: string): Promise<void> {
  const row = workbench.locator(`[data-item-id="mqtt-request-${uid}"]`);
  if (!(await row.isVisible().catch(() => false))) {
    const collection = workbench.locator('[data-item-id="req-col-e2emqcol"]');
    await collection.waitFor({ state: 'visible', timeout: 10_000 });
    await collection.click();
  }
  await row.waitFor({ state: 'visible', timeout: 5000 });
  await row.click();
  await connectButton().waitFor({ state: 'visible', timeout: 10_000 });
}

/** Connect and wait for the CONNACK to settle on the live badge. */
async function connectAndAwaitOpen(): Promise<void> {
  await expect.poll(async () => connectButton().isEnabled(), { timeout: 15_000 }).toBe(true);
  await connectButton().click();
  await liveBadge().filter({ hasText: 'Connected' }).waitFor({ state: 'visible', timeout: 20_000 });
}

/** Disconnect (the clean DISCONNECT + close) and wait for the settled tag. */
async function disconnectAndAwaitClose(text: string): Promise<void> {
  await connectButton().filter({ hasText: 'Disconnect' }).click();
  await endTag().filter({ hasText: text }).waitFor({ state: 'visible', timeout: 20_000 });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  test.setTimeout(180_000);
  userData = await mkdtemp(path.join(tmpdir(), 'oh-mqtt-desktop-e2e-'));
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

  // Seed the workspace slots with schema-validated entities (tsx via
  // the extension package — the one that carries the tsx devDep).
  const seeded = spawnSync(
    'pnpm',
    ['--filter', '@openheaders/extension', 'exec', 'tsx', path.join(__dirname, 'fixtures/mqtt-desktop-seed.ts')],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        OH_E2E_MQTT_PROBE_PORT: String(MQTT_PROBE_PORT),
        OH_E2E_MQTT_DEAD_PORT: String(MQTT_DEAD_PORT),
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
  await workbench.locator('[data-item-id="req-col-e2emqcol"]').waitFor({ state: 'visible', timeout: 15_000 });
});

test.afterAll(async () => {
  await electronApp?.close();
});

// ── M1: full session walk ───────────────────────────────────────────

test('M1 — Connect carries CONNACK, open-time SUBACK grant, echo publishes land, Disconnect reads clean', async () => {
  await openMqttRequest('e2emqd01');
  await connectAndAwaitOpen();

  // Connect has morphed into Disconnect while the session is open.
  await expect(connectButton()).toHaveText(/Disconnect/);

  // The version knob locks while the session is in flight — the open
  // session speaks the version it connected with.
  await expect(
    workbench.getByTestId('mqtt-version-select').filter({ visible: true }).first(),
  ).toHaveClass(/ant-select-disabled/);

  // The Connected lifecycle row reads plain; expanding it shows the
  // verbatim CONNACK facts — the 3.1.1 return-code name beside the
  // code — as key: value rows.
  const connectedRow = workbench
    .getByTestId('mqtt-timeline-connected-row')
    .filter({ visible: true })
    .filter({ hasText: 'Connected' })
    .first();
  await connectedRow.waitFor({ state: 'visible', timeout: 10_000 });
  await connectedRow.click();
  const connackDetails = workbench.getByTestId('mqtt-timeline-connack-details').filter({ visible: true }).first();
  await connackDetails.waitFor({ state: 'visible', timeout: 10_000 });
  await expect(connackDetails).toContainText('cmd: connack');
  // aedes frames the 3.1.1 CONNACK with Remaining Length 2 — recorded
  // at decode, rendered verbatim.
  await expect(connackDetails).toContainText('length: 2');
  await expect(connackDetails).toContainText('reasonCode: 0 (Connection Accepted)');
  await expect(connackDetails).toContainText('sessionPresent: false');
  await connectedRow.click();
  await connackDetails.waitFor({ state: 'hidden', timeout: 10_000 });

  // The enabled topic row subscribed at open: the Subscribed lifecycle
  // row names the topic plain — success grants render as silence.
  await workbench
    .getByTestId('mqtt-timeline-subscribed-row')
    .filter({ visible: true })
    .filter({ hasText: 'Subscribed to' })
    .filter({ hasText: 'probe/echo/reply' })
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });

  // Send publishes the compose: the ↑ frame and the probe's republish
  // ↓ land, each with its topic chip.
  await expect(sendButton()).toBeEnabled();
  await sendButton().click();
  await timelineMessageRows()
    .filter({ has: workbench.getByTestId('mqtt-timeline-topic-chip').filter({ hasText: 'probe/echo/reply' }) })
    .filter({ hasText: 'echo-me-desktop' })
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 });
  await timelineMessageRows()
    .filter({ has: workbench.getByTestId('mqtt-timeline-topic-chip').filter({ hasText: /^probe\/echo$/ }) })
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });
  await expect.poll(async () => timelineMessageRows().count(), { timeout: 15_000 }).toBe(2);

  // Live-session rows carry timestamps (the session-only law).
  expect(await workbench.getByTestId('mqtt-timeline-message-time').filter({ visible: true }).count()).toBeGreaterThan(
    0,
  );

  await disconnectAndAwaitClose('Disconnected');

  // The settled timeline reads newest-first: Disconnected at the new
  // edge, the echo ↓ above the publish ↑, the Subscribed row, then
  // Connected and Connecting at the old edge.
  const rows = workbench
    .locator(
      '[data-testid="mqtt-timeline-sent-row"], [data-testid="mqtt-timeline-connected-row"], ' +
        '[data-testid="mqtt-timeline-ended-row"], [data-testid="mqtt-timeline-subscribed-row"], ' +
        '[data-testid="mqtt-timeline-message-row"]',
    )
    .filter({ visible: true });
  const sequence = await rows.evaluateAll((els) =>
    els.map((el) => {
      const id = el.getAttribute('data-testid') ?? '';
      if (id !== 'mqtt-timeline-message-row') return id.replace('mqtt-timeline-', '').replace('-row', '');
      return el.querySelector('.anticon-arrow-up') !== null ? 'up' : 'down';
    }),
  );
  expect(sequence).toEqual(['ended', 'down', 'up', 'subscribed', 'connected', 'sent']);
});

// ── M2: retained delivery carries the Retained tag ──────────────────

test('M2 — the pre-seeded retained message arrives on subscribe with the Retained fact tag', async () => {
  await openMqttRequest('e2emqd02');
  await connectAndAwaitOpen();

  const retainedRow = timelineMessageRows().filter({ hasText: 'retained-hello' }).first();
  await retainedRow.waitFor({ state: 'visible', timeout: 15_000 });
  await retainedRow
    .getByTestId('mqtt-timeline-retained-tag')
    .filter({ hasText: 'Retained' })
    .waitFor({ state: 'visible' });

  await disconnectAndAwaitClose('Disconnected');
});

// ── M3: ticker live batches ─────────────────────────────────────────

test('M3 — subscribing the ticker topic lands the deterministic timed batch live', async () => {
  await openMqttRequest('e2emqd03');
  await connectAndAwaitOpen();

  await expect.poll(async () => timelineMessageRows().count(), { timeout: 20_000 }).toBe(5);
  await timelineMessageRows().filter({ hasText: 'tick 5/5' }).first().waitFor({ state: 'visible' });

  await disconnectAndAwaitClose('Disconnected');
});

// ── M4: refused dial — classified pre-open error ────────────────────

test('M4 — a dead port settles as the classified refused-dial error state', async () => {
  await openMqttRequest('e2emqd04');
  await expect.poll(async () => connectButton().isEnabled(), { timeout: 15_000 }).toBe(true);
  await connectButton().click();

  const errorState = workbench.getByTestId('mqtt-timeline-error-row').filter({ visible: true }).first();
  await errorState.waitFor({ state: 'visible', timeout: 20_000 });
  await expect(workbench.getByTestId('mqtt-session-error-detail').filter({ visible: true }).first()).toContainText(
    `Connection refused by 127.0.0.1:${MQTT_DEAD_PORT}`,
  );
  // The meta strip pills the failed open on the error tint.
  await expect(endTag()).toHaveText('Connect failed');
});

// ── M5: live Subscribe toggle mid-session ───────────────────────────

test('M5 — a row seeded OFF subscribes mid-session: grant mark on the row, Subscribed row at its position', async () => {
  await openMqttRequest('e2emqd05');
  await connectAndAwaitOpen();

  // No open-time subscription — the seeded row is OFF.
  expect(await workbench.getByTestId('mqtt-timeline-subscribed-row').filter({ visible: true }).count()).toBe(0);

  // The Topics grid holds the live toggle; flipping it rides the
  // rider and resolves on the broker's SUBACK.
  await workbench.getByRole('tab', { name: 'Topics' }).filter({ visible: true }).first().click();
  await workbench.getByTestId('mqtt-topic-subscribe').filter({ visible: true }).first().click();

  // Success grants render as silence (no grid tag) — the Subscribed
  // timeline row landing is the toggle's confirmation.
  await workbench
    .getByTestId('mqtt-timeline-subscribed-row')
    .filter({ visible: true })
    .filter({ hasText: 'Subscribed to' })
    .filter({ hasText: 'probe/echo/reply' })
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 });

  await disconnectAndAwaitClose('Disconnected');
});

// ── M6: severed end — the broker destroys the connection ────────────

test('M6 — publishing the close topic severs the connection: the error-tinted severed tag, never a synthesized close', async () => {
  await openMqttRequest('e2emqd06');
  await connectAndAwaitOpen();

  // The compose publishes `probe/close` — the broker destroys the raw
  // connection without a DISCONNECT.
  await expect(sendButton()).toBeEnabled();
  await sendButton().click();
  await endTag().filter({ hasText: 'Connection severed' }).waitFor({ state: 'visible', timeout: 20_000 });
});

// ── M7: Save Response — the settled session freezes into an example ──

test('M7 — Save Response mints the example: viewer end pill, sidebar leaf, Open in Request returns', async () => {
  // A fresh settled session on the M1 request — the capture target.
  await openMqttRequest('e2emqd01');
  await connectAndAwaitOpen();
  await disconnectAndAwaitClose('Disconnected');

  // Save Response lives in the session pane's ⋯ actions menu (first item).
  await workbench.getByTestId('mqtt-session-actions').filter({ visible: true }).first().click();
  await workbench.getByTestId('mqtt-save-response').filter({ visible: true }).first().click();

  // The minted example opens in its viewer tab: the captured end pill
  // + the read-only result pane.
  await workbench.getByTestId('mqtt-example-result-pane').filter({ visible: true }).first().waitFor({
    state: 'visible',
    timeout: 15_000,
  });
  await workbench
    .getByTestId('mqtt-example-end-tag')
    .filter({ visible: true })
    .filter({ hasText: 'Disconnected' })
    .first()
    .waitFor({ state: 'visible' });

  // The sidebar nests the example leaf under its parent request row.
  await workbench
    .locator('[data-item-id^="mqtt-example-"]')
    .filter({ visible: true })
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });

  // "Open in Request" returns to the parent editor with the captured
  // shape riding the prefill bus as unsaved draft edits.
  await workbench.getByTestId('mqtt-example-open-in-request').filter({ visible: true }).first().click();
  await connectButton().waitFor({ state: 'visible', timeout: 10_000 });
  await expect(workbench.getByTestId('mqtt-url-input').filter({ visible: true }).first()).toHaveValue(
    new RegExp(`mqtt://127\\.0\\.0\\.1:${MQTT_PROBE_PORT}`),
  );
});

// ── M8: Basic auth on CONNECT ───────────────────────────────────────

test('M8 — the probe identity opens the session; a wrong password refuses with the verbatim CONNACK code', async () => {
  await openMqttRequest('e2emqd07');
  await connectAndAwaitOpen();
  await disconnectAndAwaitClose('Disconnected');

  await openMqttRequest('e2emqd08');
  await expect.poll(async () => connectButton().isEnabled(), { timeout: 15_000 }).toBe(true);
  await connectButton().click();
  const errorState = workbench.getByTestId('mqtt-timeline-error-row').filter({ visible: true }).first();
  await errorState.waitFor({ state: 'visible', timeout: 20_000 });
  await expect(workbench.getByTestId('mqtt-session-error-detail').filter({ visible: true }).first()).toContainText(
    'Bad user name or password (code 4)',
  );
});

// ── M9: the 5.0 knob against the 3.1.1-only broker ──────────────────

test('M9 — a 5.0 CONNECT is refused with the 3.1.1-form return code verbatim', async () => {
  await openMqttRequest('e2emqd09');
  await expect.poll(async () => connectButton().isEnabled(), { timeout: 15_000 }).toBe(true);
  await connectButton().click();
  const errorState = workbench.getByTestId('mqtt-timeline-error-row').filter({ visible: true }).first();
  await errorState.waitFor({ state: 'visible', timeout: 20_000 });
  await expect(workbench.getByTestId('mqtt-session-error-detail').filter({ visible: true }).first()).toContainText(
    'Unacceptable protocol version (code 1)',
  );
});
