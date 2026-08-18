/**
 * Agent traffic S2 E2E — the grant model against the real dual-app
 * stack (the agent-traffic plan §7.2 `agent-traffic/unarmed` +
 * `agent-traffic/secrets-bearing` — the epic's most important test).
 *
 *   1. Launch the built desktop app isolated on a fresh daemon port;
 *      launch Chromium with the built extension and open TWO playground
 *      pages: the secrets generator and a sibling that stays unarmed.
 *   2. Unarmed = ABSENT: before any arm the status surface is empty and
 *      a well-formed uid for the unarmed tab reads null; after arming
 *      the secrets tab (only), traffic on the unarmed tab changes
 *      nothing — its source has no row and no records, indistinguishable
 *      from a uid that never existed.
 *   3. Secrets nowhere: the armed tab sends a bearer JWT (twice), a
 *      token-shaped API key, browser cookies both directions, and a
 *      token query parameter. NO raw secret appears anywhere in any
 *      operator surface; each secret arrives as the stable
 *      `[redacted:<sha256-prefix>]` marker — identical for the same
 *      value across requests AND positions (header vs query), distinct
 *      across values. That marker algebra is the origin session's
 *      "same token on both requests" reasoning, kept without the secret.
 *   4. Idle expiry: an arm with a tiny ttl and no observe reads lapses
 *      into ABSENCE on its own — an armed source streams, so a
 *      forgotten arm must stop costing wire and battery.
 *
 * Requires builds: `pnpm --filter @openheaders/desktop build` and the
 * extension `dist/chrome` (built separately). The playground dev server
 * is started by the playwright `webServer` block.
 */

import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
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
import { createExtensionSeedHarness } from './agent-traffic-harness';

const APP_ROOT = path.resolve(__dirname, '../..');
const EXTENSION_PATH = path.resolve(APP_ROOT, '../extension/dist/chrome');
// Port etiquette: fresh port off every prior suite (ledger through 20137).
const DAEMON_PORT = 20237;
const MCP_URL = `http://127.0.0.1:${DAEMON_PORT}/mcp`;
const SECRETS_PAGE_URL = 'http://127.0.0.1:3000/src/agent-traffic/secrets-bearing.html';
const UNARMED_PAGE_URL = 'http://127.0.0.1:3000/src/agent-traffic/unarmed.html';

// The secret values under test. The JWT rides two requests and one
// query parameter; the API key is a second distinct token; the cookie
// value crosses the browser cookie plane in both directions.
const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlMmUtZ3JhbnQiLCJuYW1lIjoiT3BlbiBIZWFkZXJzIn0.ZTJlLXNpZ25hdHVyZS1ieXRlcy0wMTIzNDU2Nzg5YWJjZGVm';
const API_KEY = 'oh_e2e_api_9f8e7d6c5b4a39281706f5e4';
const COOKIE_VALUE = 'oh_e2e_cookie_0123456789abcdef0123';
const MARKER = /^\[redacted:[0-9a-f]{8}\]$/;

interface TrafficHeader {
  name: string;
  value: string;
}

interface TrafficRecord {
  url: string;
  requestHeaders?: TrafficHeader[];
  responseHeaders?: TrafficHeader[];
}

interface TrafficSourceStatus {
  uid: string;
  kind: string;
  state: string;
  expiresAtMs: number;
}

let electronApp: ElectronApplication;
let workbench: Page;
let token: string;
let context: BrowserContext | undefined;
let extensionId: string;
let secretsPage: Page;
let unarmedPage: Page;
let peerNodeId: string;
let secretsTabId: number;
let unarmedTabId: number;
let armedUid: string;

const harness = createExtensionSeedHarness({
  context: () => context,
  extensionId: () => extensionId,
  token: () => token,
  daemonPort: DAEMON_PORT,
  recordId: 'agent-traffic-grant-e2e-backend',
  recordLabel: 'agent-traffic grant e2e desktop',
  logTag: 'agent-traffic-grant setup',
});

/** Invoke one operator-plane RPC through the Workbench bridge. */
async function invoke(message: Record<string, unknown>): Promise<Record<string, unknown>> {
  return workbench.evaluate(async (msg) => {
    const bridge = (window as unknown as { oh: { invoke(m: Record<string, unknown>): Promise<unknown> } }).oh;
    return (await bridge.invoke(msg)) as Record<string, unknown>;
  }, message);
}

async function trafficSources(): Promise<TrafficSourceStatus[]> {
  const { sources } = (await invoke({ type: 'oh.daemon.traffic.status' })) as unknown as {
    sources: TrafficSourceStatus[];
  };
  return sources ?? [];
}

async function trafficRecords(uid: string): Promise<TrafficRecord[] | null> {
  const { records } = (await invoke({ type: 'oh.daemon.traffic.records', uid })) as unknown as {
    records: TrafficRecord[] | null;
  };
  return records;
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const userData = await mkdtemp(path.join(os.tmpdir(), 'oh-agent-traffic-grant-e2e-'));
  await mkdir(path.join(userData, 'data'), { recursive: true });
  await writeFile(
    path.join(userData, 'data', 'settings.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: {
        'oh.settings.user': {
          'mcp.enabled': true,
          'backend.bindPort': DAEMON_PORT,
        },
      },
      secrets: {},
    }),
  );

  electronApp = await _electron.launch({
    args: [APP_ROOT],
    env: { ...process.env, OPENHEADERS_USER_DATA_DIR: userData, OH_DISABLE_UPDATE_CHECKS: '1' },
  });
  workbench = await electronApp.firstWindow();

  // Engine-ready gate: 401 = bound + MCP enabled, token missing.
  await expect
    .poll(
      async () => {
        try {
          const res = await fetch(MCP_URL, { method: 'POST', body: '{}' });
          return res.status;
        } catch {
          return 0;
        }
      },
      { timeout: 45000 },
    )
    .toBe(401);

  const minted = (await invoke({ type: 'oh.daemon.tokens.mint', label: 'agent-traffic-grant-e2e' })) as {
    ok: boolean;
    secret?: string;
  };
  expect(minted.ok).toBe(true);
  token = minted.secret ?? '';

  context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`, '--no-sandbox'],
  });
  const bootWorker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  extensionId = bootWorker.url().split('/')[2] ?? '';
  await harness.extensionPage();
  await harness.seedBackendRetrying({ enabled: true });

  secretsPage = await context.newPage();
  await secretsPage.goto(SECRETS_PAGE_URL);
  unarmedPage = await context.newPage();
  await unarmedPage.goto(UNARMED_PAGE_URL);
  // Background the playground tabs so every request in the watched
  // partitions is one of this spec's own probes.
  await (await harness.extensionPage()).bringToFront();
});

test.afterAll(async () => {
  await context?.close();
  await electronApp?.close();
});

// ── Inventory gate ──────────────────────────────────────────────────

test('the daemon inventories both playground tabs', async () => {
  await expect
    .poll(
      async () => {
        const { peers } = (await invoke({ type: 'oh.daemon.telemetry.tabs.list' })) as unknown as {
          peers?: Array<{ nodeId: string; tabs: Array<{ tabId: number; url: string }> }>;
        };
        for (const peer of peers ?? []) {
          const secrets = peer.tabs.find((t) => t.url.startsWith(SECRETS_PAGE_URL));
          const unarmed = peer.tabs.find((t) => t.url.startsWith(UNARMED_PAGE_URL));
          if (secrets && unarmed) {
            peerNodeId = peer.nodeId;
            secretsTabId = secrets.tabId;
            unarmedTabId = unarmed.tabId;
            return true;
          }
        }
        return false;
      },
      { timeout: 30000 },
    )
    .toBe(true);
});

// ── Unarmed = absent, not unreadable ────────────────────────────────

test('an unarmed source is absent from status and unreadable by uid', async () => {
  // Nothing armed yet: the status surface is empty and a well-formed
  // uid for the (live, traffic-bearing) unarmed tab answers null.
  expect(await trafficSources()).toEqual([]);
  expect(await trafficRecords(`browser-tab:${peerNodeId}:${unarmedTabId}`)).toBeNull();

  // Arm ONLY the secrets tab.
  const armed = (await invoke({
    type: 'oh.daemon.traffic.arm',
    kind: 'browser-tab',
    nodeId: peerNodeId,
    tabId: secretsTabId,
    maxRecords: 50,
    maxBytes: 512 * 1024,
  })) as { ok: boolean; uid?: string; error?: string };
  expect(armed.ok, armed.error).toBe(true);
  armedUid = armed.uid ?? '';

  // Traffic on the unarmed tab changes nothing: its source stays
  // absent while the armed sibling is the ONLY row.
  await unarmedPage.evaluate(async () => {
    await (window as unknown as { __ohFireBurst(o: { count: number; tag: string }): Promise<number> }).__ohFireBurst({
      count: 3,
      tag: 'unarmed',
    });
  });
  const sources = await trafficSources();
  expect(sources.map((s) => s.uid)).toEqual([armedUid]);
  expect(await trafficRecords(`browser-tab:${peerNodeId}:${unarmedTabId}`)).toBeNull();
});

// ── Secrets bearing — the epic's most important test ────────────────

test('raw secrets appear nowhere; markers are stable per value and distinct across values', async () => {
  // The subscribe round-trips through the extension; wait for the ready.
  await expect
    .poll(
      async () => {
        const source = (await trafficSources()).find((s) => s.uid === armedUid);
        return source !== undefined;
      },
      { timeout: 15000 },
    )
    .toBe(true);

  await secretsPage.evaluate(
    async (secrets) => {
      await (
        window as unknown as {
          __ohFireSecrets(o: { jwt: string; apiKey: string; cookieValue: string }): Promise<number>;
        }
      ).__ohFireSecrets(secrets);
    },
    { jwt: JWT, apiKey: API_KEY, cookieValue: COOKIE_VALUE },
  );

  await expect
    .poll(async () => (await trafficRecords(armedUid))?.length ?? 0, { timeout: 15000 })
    .toBeGreaterThanOrEqual(4);

  const records = (await trafficRecords(armedUid)) ?? [];
  const sources = await trafficSources();

  // THE assertion: no raw secret anywhere in any operator surface.
  const everything = JSON.stringify({ records, sources });
  expect(everything).not.toContain(JWT);
  expect(everything).not.toContain(API_KEY);
  expect(everything).not.toContain(COOKIE_VALUE);

  const byProbe = (n: number) => records.find((r) => r.url.includes(`n=${n}`));
  const header = (record: TrafficRecord | undefined, name: string) =>
    record?.requestHeaders?.find((h) => h.name.toLowerCase() === name)?.value;

  // Marker stability: the SAME JWT on two requests → the SAME marker,
  // scheme preserved.
  const auth1 = header(byProbe(1), 'authorization');
  const auth2 = header(byProbe(2), 'authorization');
  expect(auth1).toBeDefined();
  expect(auth1).toBe(auth2);
  const jwtMarker = (auth1 ?? '').replace(/^Bearer /, '');
  expect(jwtMarker).toMatch(MARKER);

  // Marker distinctness: a different token → a different marker.
  const apiKeyMarker = header(byProbe(2), 'x-api-key');
  expect(apiKeyMarker).toMatch(MARKER);
  expect(apiKeyMarker).not.toBe(jwtMarker);

  // Stability across POSITIONS: the same JWT as a query parameter
  // carries the same marker the Authorization header carries.
  expect(byProbe(3)?.url).toContain(`access_token=${jwtMarker}`);

  // Cookie planes (browser-attached): whenever captured, the values
  // must be markers with names/attributes preserved.
  const cookieHeader = header(byProbe(4), 'cookie');
  if (cookieHeader !== undefined) {
    expect(cookieHeader).toMatch(/oh_probe_sid=\[redacted:[0-9a-f]{8}\]/);
  }
  const setCookie = byProbe(4)?.responseHeaders?.find((h) => h.name.toLowerCase() === 'set-cookie')?.value;
  if (setCookie !== undefined) {
    expect(setCookie).toMatch(/^oh_probe_session=\[redacted:[0-9a-f]{8}\]; Path=\//);
  }
});

// ── Idle expiry — a forgotten arm stops streaming on its own ────────

test('an idle arm lapses into absence', async () => {
  expect(((await invoke({ type: 'oh.daemon.traffic.disarm', uid: armedUid })) as { ok: boolean }).ok).toBe(true);

  const armed = (await invoke({
    type: 'oh.daemon.traffic.arm',
    kind: 'browser-tab',
    nodeId: peerNodeId,
    tabId: secretsTabId,
    ttlMs: 2500,
  })) as { ok: boolean; uid?: string };
  expect(armed.ok).toBe(true);
  expect((await trafficSources()).map((s) => s.uid)).toEqual([armed.uid]);

  // No observe reads: the arm lapses and the source becomes ABSENT
  // (the status read itself sweeps; it never extends the arm).
  await expect.poll(async () => (await trafficSources()).length, { timeout: 15000 }).toBe(0);
  expect(await trafficRecords(armed.uid ?? '')).toBeNull();
});
