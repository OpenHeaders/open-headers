/**
 * Traffic Monitor Debug-mode Live E2E — the S8 per-tab Debug-mode
 * affordance against the real dual-app stack (OBSERVABILITY_PLAN.md §7
 * actuation over the telemetry control verb), on the proxy-live chassis:
 *
 *   1. The rail lists the connected Chrome peer with the Debug-mode
 *      master switch on its header row and the per-tab bug affordance on
 *      its tab rows.
 *   2. Pinning a tab with Debug mode OFF records the pin (pushpin
 *      state) without flipping the master switch — the reconciler
 *      carries pins while disabled.
 *   3. Flipping the master switch from the rail writes the extension's
 *      `inspection.cdpEnabled` SETTING (single-effector path — the
 *      popup pill follows), and the pinned tab attaches: the rail
 *      converges to the filled-bug state.
 *   4. The watched tab's traffic upgrades to CDP fidelity — the
 *      Response tab serves the body over the lazy pull, which the
 *      heuristic plane cannot.
 *   5. Un-pinning from the rail detaches and returns the row to the
 *      hover-ghost state.
 *   6. The demoted routing popover still drives `routing.set`: the
 *      switch inside the popover flips routing, the trigger grows the
 *      "On" tag, and the ack alert renders.
 *
 * Phase 3 storage legs (S10): the stacked storage pane observes the
 * watched tab's localStorage over the relay, a row opens as a
 * storage-document editor tab, a desktop-side delete actuates in the
 * page (the extension executes — the actuator model), and the pane's
 * collapse state survives dock switches.
 *
 * Deliberately NOT covered (manual live-pass items): the debugger
 * banner's look and its Cancel fall-back (browser chrome, unreachable
 * from Playwright), tooltip copy on hover, and the Firefox peer's
 * affordance ABSENCE (Playwright cannot load our extension in Firefox).
 *
 * Requires builds: `pnpm --filter @openheaders/desktop build` and the
 * extension `dist/chrome` (built separately). The playground dev server
 * is started by the playwright `webServer` block.
 */

import { mkdtemp, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import path from 'node:path';
import {
  _electron,
  type BrowserContext,
  chromium,
  type ElectronApplication,
  expect,
  type Page,
  test,
} from '@playwright/test';

const APP_ROOT = path.resolve(__dirname, '../..');
const EXTENSION_PATH = path.resolve(APP_ROOT, '../extension/dist/chrome');
// Port etiquette: fresh ports off every prior suite (ledger through 19939).
const DAEMON_PORT = 19940;
const PROXY_PORT = 19941;
const PLAYGROUND_URL = 'http://127.0.0.1:3000/';
const PLAYGROUND_TITLE = 'Open Headers Playground';

interface ExtensionPeer {
  context: BrowserContext;
  /** Lazily-(re)created extension page — always reach it via {@link peerPage}. */
  popup: Page | null;
  extensionId: string;
}

let electronApp: ElectronApplication;
let workbench: Page;
let token: string;
let peerA: ExtensionPeer | undefined;
let playground: Page;

/** Invoke a daemon admin channel through the Workbench bridge. */
async function bridgeInvoke<T>(message: Record<string, unknown>): Promise<T> {
  return workbench.evaluate(async (msg) => {
    const bridge = (window as unknown as { oh: { invoke(m: Record<string, unknown>): Promise<unknown> } }).oh;
    return (await bridge.invoke(msg)) as never;
  }, message) as Promise<T>;
}

/** State-driven dock-strip toggle — click only when the state is wrong. */
async function setToolWindowOpen(open: boolean): Promise<void> {
  const tab = workbench.locator('[data-tool-window="traffic-monitor"]').first();
  if (((await tab.getAttribute('aria-selected')) === 'true') !== open) {
    await tab.click();
  }
}

/** Re-pull the rail's tab inventory through its refresh affordance. */
async function refreshRail(): Promise<void> {
  await workbench.locator('[data-testid="traffic-monitor-refresh"]').first().click();
}

/** The playground tab's rail row, identified by the page title. */
function playgroundRow() {
  return workbench.locator('[data-testid="traffic-monitor-source-tab"]').filter({ hasText: PLAYGROUND_TITLE }).first();
}

/** The playground row's Debug-mode affordance span. */
function playgroundDebugAffordance() {
  return playgroundRow().locator('[data-testid="traffic-monitor-tab-debug"]');
}

/** Launch the extension profile. */
async function launchExtensionPeer(): Promise<ExtensionPeer> {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`, '--no-sandbox'],
  });
  const bootWorker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const extensionId = bootWorker.url().split('/')[2];

  const peer: ExtensionPeer = { context, popup: null, extensionId };
  await peerPage(peer);
  return peer;
}

/**
 * The peer's live extension page — created on demand, recreated when the
 * app kills it (no extension page is immortal; nothing ever evaluates in
 * the WORKER context — the live-network harness law).
 */
async function peerPage(peer: ExtensionPeer): Promise<Page> {
  if (peer.popup && !peer.popup.isClosed()) return peer.popup;
  const page = await peer.context.newPage();
  await page.goto(`chrome-extension://${peer.extensionId}/merge-showcase.html`);
  await page.waitForLoadState('load');
  peer.popup = page;
  return page;
}

/** The extension's persisted user-settings dict (`oh.settings.user`). */
async function extensionUserSettings(peer: ExtensionPeer): Promise<Record<string, unknown>> {
  const page = await peerPage(peer);
  return page.evaluate(
    async () =>
      new Promise<Record<string, unknown>>((resolve) => {
        chrome.storage.local.get('oh.settings.user', (items) => {
          resolve((items?.['oh.settings.user'] as Record<string, unknown>) ?? {});
        });
      }),
  );
}

/**
 * (Re-)seed the peer's backend registry record — same encrypted blob
 * format and page-context posture as the live-network suite.
 */
async function seedBackend(
  peer: ExtensionPeer,
  seed: { backendUrl: string; authToken: string; enabled: boolean },
): Promise<void> {
  const page = await peerPage(peer);
  await page.evaluate(async ({ backendUrl, authToken, enabled }) => {
    const key = await new Promise<CryptoKey>((resolve, reject) => {
      const open = indexedDB.open('oh-secret-cipher', 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const request = db.transaction('keys', 'readonly').objectStore('keys').get('at-rest-aes-gcm-v1');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result as CryptoKey);
      };
    });
    const record = {
      id: 'debug-live-e2e-backend',
      label: 'debug-live e2e desktop',
      url: backendUrl,
      authToken,
      autoConnect: true,
      enabled,
      addedAt: new Date().toISOString(),
      lastConnectedAt: null,
    };
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(JSON.stringify([record])),
    );
    const packed = new Uint8Array(iv.length + ciphertext.byteLength);
    packed.set(iv, 0);
    packed.set(new Uint8Array(ciphertext), iv.length);
    let binary = '';
    for (const byte of packed) binary += String.fromCharCode(byte);
    await new Promise<void>((resolve) => {
      chrome.storage.local.set({ onboardingCompleted: true, 'oh.backends': `v1:${btoa(binary)}` }, () => resolve());
    });
  }, seed);
}

/** Whether the peer's storage already holds a backends blob. */
async function backendsSeeded(peer: ExtensionPeer): Promise<boolean> {
  const page = await peerPage(peer);
  return page.evaluate(
    async () =>
      new Promise<boolean>((resolve) => {
        chrome.storage.local.get('oh.backends', (items) => {
          resolve(typeof items?.['oh.backends'] === 'string' && (items['oh.backends'] as string).length > 0);
        });
      }),
  );
}

/** Seed with retry + read-back verification (the write can land even
 *  when the evaluate context dies to the app's own reaction). */
async function seedBackendRetrying(
  peer: ExtensionPeer,
  seed: { backendUrl: string; authToken: string; enabled: boolean },
): Promise<void> {
  let seedError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await seedBackend(peer, seed);
      return;
    } catch (err) {
      seedError = err;
      console.log(`[debug-live setup] seed attempt ${attempt} failed: ${String(err).split('\n')[0]}`);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const landed = await backendsSeeded(peer).catch(() => false);
      if (landed) return;
    }
  }
  throw new Error(`seedBackend failed: ${String(seedError)}`);
}

test.describe.configure({ mode: 'serial' });

function setupStep(message: string): void {
  console.log(`[debug-live setup ${new Date().toISOString()}] ${message}`);
}

test.beforeAll(async () => {
  const userData = await mkdtemp(path.join(os.tmpdir(), 'oh-debug-live-e2e-'));
  await writeFile(
    path.join(userData, 'storage.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: {
        'oh.settings.user': {
          'backend.bindPort': DAEMON_PORT,
        },
      },
      secrets: {},
    }),
  );

  setupStep('userData seeded');
  electronApp = await _electron.launch({
    args: [APP_ROOT],
    env: { ...process.env, OPENHEADERS_USER_DATA_DIR: userData, OH_DISABLE_UPDATE_CHECKS: '1' },
  });
  workbench = await electronApp.firstWindow();
  setupStep('desktop launched');

  // The daemon's WS/HTTP port answers (401 on a bare POST) once up.
  await expect
    .poll(
      async () => {
        try {
          const res = await fetch(`http://127.0.0.1:${DAEMON_PORT}/mcp`, { method: 'POST', body: '{}' });
          return res.status;
        } catch {
          return 0;
        }
      },
      { timeout: 45000 },
    )
    .not.toBe(0);

  const minted = await bridgeInvoke<{ ok: boolean; secret?: string }>({
    type: 'oh.daemon.tokens.mint',
    label: 'debug-live-e2e',
  });
  expect(minted.ok).toBe(true);
  token = minted.secret ?? '';
  setupStep('daemon token minted');

  // The wire partition runs so the routing popover leg acts on a live
  // capture (routing without a proxy has nothing to route to).
  const started = await bridgeInvoke<{ ok: boolean; error?: string }>({
    type: 'oh.daemon.proxy.start',
    port: PROXY_PORT,
  });
  expect(started.ok, started.error).toBe(true);
  setupStep('capture proxy started');

  peerA = await launchExtensionPeer();
  setupStep('peer A launched');
  await seedBackendRetrying(peerA, {
    backendUrl: `ws://127.0.0.1:${DAEMON_PORT}`,
    authToken: token,
    enabled: true,
  });
  setupStep('peer A seeded');

  playground = await peerA.context.newPage();
  await playground.goto(PLAYGROUND_URL);
  setupStep('playground open');
  await (await peerPage(peerA)).bringToFront();
});

test.afterAll(async () => {
  await peerA?.context.close();
  await electronApp?.close();
});

// ── Leg 1: rail inventory + affordances ─────────────────────────────

test('the rail lists the Chrome peer with the Debug-mode switch and per-tab bug affordance', async () => {
  await setToolWindowOpen(true);

  // The peer lands in the inventory once its wire is up — re-pull until
  // it does.
  await expect
    .poll(
      async () => {
        const count = await workbench.locator('[data-testid="traffic-monitor-peer"]').count();
        if (count === 0) await refreshRail();
        return count;
      },
      { timeout: 30000 },
    )
    .toBeGreaterThan(0);

  // Chrome reports `debug.available` — the master switch renders on the
  // peer header, ON (the Chromium host-aware default).
  const masterSwitch = workbench.locator('[data-testid="traffic-monitor-peer-debug"]').first();
  await expect(masterSwitch).toBeVisible();
  await expect(masterSwitch).toHaveAttribute('aria-checked', 'true');

  // The playground tab row carries the hover affordance, un-pressed.
  await expect(playgroundRow()).toBeVisible();
  await playgroundRow().hover();
  const affordance = playgroundDebugAffordance();
  await expect(affordance).toBeVisible();
  await expect(affordance).toHaveAttribute('aria-pressed', 'false');

  // Drive the master switch OFF from the rail — the `enable:false`
  // command path — so the pin-while-off leg starts from a known state.
  await masterSwitch.click();
  await expect(masterSwitch).toHaveAttribute('aria-checked', 'false');
  await expect
    .poll(async () => (await extensionUserSettings(peerA as ExtensionPeer))['inspection.cdpEnabled'], {
      timeout: 10000,
    })
    .toBe(false);
});

// ── Leg 2: pin with Debug mode OFF ──────────────────────────────────

test('pinning a tab with Debug mode off records the pin without enabling', async () => {
  if (!peerA) throw new Error('peer A not launched');
  await playgroundRow().hover();
  await playgroundDebugAffordance().click();

  // The control reply's snapshot patches the rail immediately: pinned,
  // not attached (the master switch is off).
  const affordance = playgroundDebugAffordance();
  await expect(affordance).toHaveAttribute('aria-pressed', 'true');
  await expect(affordance.locator('.anticon-pushpin')).toBeVisible();

  // The master switch stayed off — on the rail AND in the extension's
  // persisted setting.
  await expect(workbench.locator('[data-testid="traffic-monitor-peer-debug"]').first()).toHaveAttribute(
    'aria-checked',
    'false',
  );
  const settings = await extensionUserSettings(peerA);
  expect(settings['inspection.cdpEnabled'] ?? false).toBe(false);
});

// ── Leg 3: master switch from the rail — single-effector + attach ───

test('flipping Debug mode from the rail writes the extension setting and attaches the pin', async () => {
  if (!peerA) throw new Error('peer A not launched');
  await workbench.locator('[data-testid="traffic-monitor-peer-debug"]').first().click();
  await expect(workbench.locator('[data-testid="traffic-monitor-peer-debug"]').first()).toHaveAttribute(
    'aria-checked',
    'true',
  );

  // Single-effector proof: the relayed command wrote the SETTING, so the
  // extension's persisted `inspection.cdpEnabled` flips (the popup pill
  // reads the same key).
  await expect
    .poll(async () => (await extensionUserSettings(peerA as ExtensionPeer))['inspection.cdpEnabled'] === true, {
      timeout: 10000,
    })
    .toBe(true);

  // The popup pill follows: its footer switch reads checked.
  const pill = await (peerA as ExtensionPeer).context.newPage();
  await pill.goto(`chrome-extension://${(peerA as ExtensionPeer).extensionId}/popup.html`);
  await expect(pill.locator('[aria-label="Toggle debug mode"]').first()).toHaveAttribute('aria-checked', 'true', {
    timeout: 10000,
  });
  await pill.close();

  // The pinned tab attaches (banner handshake commits async) — the rail
  // converges to the filled-bug state on re-pull.
  await expect
    .poll(
      async () => {
        const attached = await playgroundDebugAffordance()
          .locator('.anticon-bug')
          .count()
          .catch(() => 0);
        if (attached === 0) await refreshRail();
        return attached;
      },
      { timeout: 30000 },
    )
    .toBeGreaterThan(0);
  await expect(playgroundDebugAffordance()).toHaveAttribute('aria-pressed', 'true');
});

// ── Leg 4: CDP fidelity on the watched tab ──────────────────────────

test('the attached tab serves response bodies — CDP fidelity end to end', async () => {
  // Select the playground tab source — the watch itself turns ingestion on.
  await playgroundRow().click();

  // Traffic minted AFTER the attach carries CDP provenance from the
  // first hop; the body is read so the lifecycle completes.
  const echoed = await playground.evaluate(
    (url) => fetch(url).then((r) => r.text()),
    `${PLAYGROUND_URL}api/echo?probe=debug-live-1`,
  );
  expect(echoed).toContain('debug-live-1');

  await expect(workbench.locator('.dt-row').filter({ hasText: 'debug-live-1' }).first()).toBeVisible({
    timeout: 15000,
  });

  // Inspect the row; the Response tab pulls the body lazily — a serve
  // only the CDP plane can answer (the heuristic plane has no bodies).
  await workbench.locator('.dt-row').filter({ hasText: 'debug-live-1' }).first().click();
  // The editor-tab label ellipsizes mid-string ("GET echo?…ug-live-1") —
  // match the surviving tail, the proxy-live suite's idiom.
  const editorTab = workbench.getByRole('tab', { name: /ug-live-1/ }).first();
  await expect(editorTab).toHaveAttribute('aria-selected', 'true');
  await workbench.getByRole('tab', { name: 'Response', exact: true }).first().click();
  await expect(editorTab).toHaveAttribute('aria-selected', 'true');
  await expect(workbench.locator('.view-line').filter({ hasText: 'debug-live-1' }).first()).toBeVisible({
    timeout: 15000,
  });
});

// ── Inspect-tab CTAs hand off in-place on the desktop ───────────────

test('inspect-tab CTAs hand off locally: rule draft + Create API request', async () => {
  // The inspect tab from the previous leg is focused; its breadcrumb
  // names the Traffic Monitor origin, not the Rules default.
  await expect(workbench.locator('.rules-breadcrumbs').filter({ hasText: 'Traffic Monitor' }).first()).toBeVisible();

  // The Headers tab hosts the CTAs.
  await workbench.getByRole('tab', { name: 'Headers', exact: true }).first().click();

  // Rule-draft handoff: the quick-editor popover's workspace link
  // stashes the draft (`createRuleDraft`) and routes the intent through
  // the local loop — a pre-filled rule-create tab opens.
  await workbench.getByRole('button', { name: 'Override query params' }).first().click();
  await workbench.getByText('Open in workspace').first().click();
  await expect(workbench.locator('.rules-breadcrumbs').filter({ hasText: 'Rules' }).first()).toBeVisible({
    timeout: 10000,
  });
  // The draft seeded the captured URL into the rule form's URL-pattern
  // editor. Keep-alive editor tabs hold the same URL text hidden, so
  // match the VISIBLE occurrence only.
  await expect(
    workbench.getByText('http://127.0.0.1:3000/api/echo?probe=debug-live-1').filter({ visible: true }).first(),
  ).toBeVisible();

  // Back on the inspect tab: Create API request opens a scratch
  // request tab seeded from the capture (`createRequestDraft`).
  await workbench
    .getByRole('tab', { name: /ug-live-1/ })
    .first()
    .click();
  await workbench.getByRole('tab', { name: 'Headers', exact: true }).first().click();
  await workbench.getByRole('button', { name: 'Create API request' }).first().click();
  await expect(workbench.locator('.rules-breadcrumbs').filter({ hasText: 'API Requests' }).first()).toBeVisible({
    timeout: 10000,
  });
});

// ── Phase 3: the stacked storage pane ───────────────────────────────

test("the storage pane lists the watched tab's localStorage over the relay", async () => {
  await setToolWindowOpen(true);
  await playgroundRow().click();

  // Seed an entry in the WATCHED page — the pane must observe it
  // through the relayed reads (never a desktop-side derivation).
  await playground.evaluate(() => localStorage.setItem('oh-e2e-storage-key', 'oh-e2e-storage-value'));

  const pane = workbench.locator('[data-testid="traffic-monitor-storage-pane"]');
  await expect(pane).toBeVisible();
  const row = pane.locator('.dt-storage-row').filter({ hasText: 'oh-e2e-storage-key' }).first();
  await expect(row).toBeVisible({ timeout: 20000 });
  await expect(row).toContainText('oh-e2e-storage-value');
});

test('a storage row opens as an editor tab and a desktop delete actuates in the page', async () => {
  const pane = workbench.locator('[data-testid="traffic-monitor-storage-pane"]');

  // Row click → storage-document editor tab: Traffic Monitor
  // breadcrumb, live value in the document body.
  await pane.locator('.dt-storage-row').filter({ hasText: 'oh-e2e-storage-key' }).first().click();
  const editorTab = workbench.getByRole('tab', { name: /storage-key/ }).first();
  await expect(editorTab).toHaveAttribute('aria-selected', 'true');
  await expect(workbench.locator('.rules-breadcrumbs').filter({ hasText: 'Traffic Monitor' }).first()).toBeVisible();
  await expect(workbench.locator('.view-line').filter({ hasText: 'oh-e2e-storage-value' }).first()).toBeVisible({
    timeout: 20000,
  });

  // Delete the row from the desktop — the verb executes IN the
  // extension (the actuator model), so the page's own localStorage
  // loses the key and the grid refetch drops the row.
  await setToolWindowOpen(true);
  const row = pane.locator('.dt-storage-row').filter({ hasText: 'oh-e2e-storage-key' }).first();
  await row.hover();
  await row.getByRole('button', { name: 'Delete oh-e2e-storage-key' }).click();
  await expect
    .poll(() => playground.evaluate(() => localStorage.getItem('oh-e2e-storage-key')), { timeout: 20000 })
    .toBeNull();
  await expect(pane.locator('.dt-storage-row').filter({ hasText: 'oh-e2e-storage-key' })).toHaveCount(0, {
    timeout: 20000,
  });
});

test('the storage pane collapses to the reopen strip and survives dock-tab switches', async () => {
  const pane = workbench.locator('[data-testid="traffic-monitor-storage-pane"]');
  // Hide via the pane's own header affordance → the slim reopen strip.
  await pane.getByRole('button', { name: 'Hide panel' }).first().click();
  await expect(pane).toHaveCount(0);
  const strip = workbench.locator('[data-testid="traffic-monitor-storage-strip"]');
  await expect(strip).toBeVisible();

  // The collapsed state survives the dispatcher unmount (dock switch).
  await workbench.locator('[data-tool-window="workflow-status"]').first().click();
  await setToolWindowOpen(true);
  await expect(workbench.locator('[data-testid="traffic-monitor-storage-strip"]')).toBeVisible();

  // Reopen from the strip.
  await workbench.locator('[data-testid="traffic-monitor-storage-strip"]').click();
  await expect(workbench.locator('[data-testid="traffic-monitor-storage-pane"]')).toBeVisible();
});

// ── Leg 5: unpin from the rail ──────────────────────────────────────

test('un-pinning from the rail detaches and returns the row to the ghost state', async () => {
  await setToolWindowOpen(true);
  await playgroundRow().hover();
  await playgroundDebugAffordance().click();

  // Snapshot patch drops the pin; the detach commits async — converge on
  // re-pull to the un-pressed hover-ghost state.
  await expect
    .poll(
      async () => {
        const pressed = await playgroundDebugAffordance().getAttribute('aria-pressed');
        if (pressed !== 'false') await refreshRail();
        return pressed;
      },
      { timeout: 30000 },
    )
    .toBe('false');
});

// ── Leg 6: the demoted routing popover ──────────────────────────────

test('the routing popover flips routing and shows the On tag + ack alert', async () => {
  // Wire source → the capture strip renders with the demoted trigger.
  const wire = workbench.locator('[data-testid="traffic-monitor-source-wire"]').first();
  await wire.click();
  const trigger = workbench.locator('[data-testid="proxy-routing-trigger"]').first();
  await expect(trigger).toBeVisible();

  await trigger.click();
  const routingSwitch = workbench.locator('[data-testid="proxy-routing-switch"]').first();
  await expect(routingSwitch).toBeVisible();
  await routingSwitch.click();

  // The trigger grows the green "On" tag and the ack alert renders once
  // the peer acks with an applied mode.
  await expect(trigger.locator('.ant-tag')).toBeVisible({ timeout: 15000 });
  await expect(workbench.locator('.ant-alert').filter({ hasText: 'PAC' }).first()).toBeVisible({ timeout: 20000 });

  // Off again — the tag and alert clear.
  await routingSwitch.click();
  await expect(trigger.locator('.ant-tag')).toHaveCount(0, { timeout: 15000 });
});

// ── Selection survives dock-tab switches ────────────────────────────

test('the panel keeps its source selection across dock-tab switches', async () => {
  // The wire source is selected from the routing leg. Switch the dock
  // to a sibling tool window and back — the dispatcher unmounts the
  // panel; the remount must re-seed the last selection instead of the
  // empty no-source hero.
  await workbench.locator('[data-tool-window="workflow-status"]').first().click();
  await setToolWindowOpen(true);
  await expect(workbench.locator('[data-testid="traffic-monitor-source-wire"]').first()).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(workbench.locator('[data-testid="proxy-routing-trigger"]').first()).toBeVisible();
});

// ── Manual-inspection hold ──────────────────────────────────────────

test('hold the stack open for manual inspection', async () => {
  test.skip(process.env.OH_E2E_HOLD !== '1', 'set OH_E2E_HOLD=1 to keep the stack open after the run');
  test.setTimeout(0);
  console.log('[debug-live] holding the desktop + extension + playground open — stop the runner to tear down');
  await new Promise(() => {});
});
