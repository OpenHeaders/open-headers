/**
 * Agent traffic S4 E2E — `traffic_diff` + `traffic_wait` against the
 * real dual-app stack (AGENT_TRAFFIC_PLAN.md §7.2 `two-sessions` +
 * `wait-predicate`, §8 S4), MCP-driven over HTTP `/mcp` per the S3
 * pattern:
 *
 *   1. `traffic_diff` across two tabs playing the origin session's
 *      roles: the divergent-status pair proves IDENTICAL request
 *      headers (marker-equal — the negative result), a changed
 *      credential shows as two distinct markers with the raw secrets
 *      NOWHERE, a presence delta and the request-set remainder land on
 *      the right sides.
 *   2. `traffic_diff` across two time windows of ONE source — the
 *      only change (a header value) is the only delta.
 *   3. `traffic_wait` resolving on a delayed matching request; on a
 *      refinement (the 5xx class arrives after admission); timing out
 *      CLEANLY as a normal result; and leaking no watch (pendingWaits
 *      visible while waiting, zero after every outcome).
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
// Port etiquette: fresh port off every prior suite (ledger through 20337).
const DAEMON_PORT = 20437;
const MCP_URL = `http://127.0.0.1:${DAEMON_PORT}/mcp`;
const SESSIONS_URL = 'http://127.0.0.1:3000/src/agent-traffic/two-sessions.html';
const WORKING_PAGE_URL = `${SESSIONS_URL}?role=working`;
const BROKEN_PAGE_URL = `${SESSIONS_URL}?role=broken`;
const WAIT_PAGE_URL = 'http://127.0.0.1:3000/src/agent-traffic/wait-predicate.html';

/** Token-shaped so redaction fires; planted from here so the spec can
 *  assert the raw values appear NOWHERE in any tool result. */
const SHARED_TOKEN = 'oh_e2e_shared_cred_1a2b3c4d5e6f7890abcd';
const WORKING_TOKEN = 'oh_e2e_working_cred_9f8e7d6c5b4a30211fed';
const BROKEN_TOKEN = 'oh_e2e_broken_cred_0011223344556677aabb';
const MARKER = /^\[redacted:[0-9a-f]{8}\]$/;

interface DiffPair {
  method: string;
  path: string;
  a: { requestId: string; statusCode?: number };
  b: { requestId: string; statusCode?: number };
  statusDiverges: boolean;
  requestHeaders: {
    identical: boolean;
    onlyInA: string[];
    onlyInB: string[];
    valueChanged: Array<{ name: string; a: string; b: string }>;
  };
}

let electronApp: ElectronApplication;
let workbench: Page;
let token: string;
let context: BrowserContext | undefined;
let extensionId: string;
let workingPage: Page;
let brokenPage: Page;
let waitPage: Page;
let peerNodeId: string;
let workingTabId: number;
let brokenTabId: number;
let waitTabId: number;
let workingUid: string;
let brokenUid: string;
let waitUid: string;

const harness = createExtensionSeedHarness({
  context: () => context,
  extensionId: () => extensionId,
  token: () => token,
  daemonPort: DAEMON_PORT,
  recordId: 'agent-traffic-diff-wait-e2e-backend',
  recordLabel: 'agent-traffic diff+wait e2e desktop',
  logTag: 'agent-traffic-diff-wait setup',
});

/** Invoke one operator-plane RPC through the Workbench bridge. */
async function invoke(message: Record<string, unknown>): Promise<Record<string, unknown>> {
  return workbench.evaluate(async (msg) => {
    const bridge = (window as unknown as { oh: { invoke(m: Record<string, unknown>): Promise<unknown> } }).oh;
    return (await bridge.invoke(msg)) as Record<string, unknown>;
  }, message);
}

async function rpc(
  method: string,
  params: Record<string, unknown>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, json };
}

interface McpToolResult {
  isError?: boolean;
  payload: Record<string, unknown>;
  text: string;
}

/** tools/call wrapper — unwraps the JSON text content block. */
async function callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
  const { status, json } = await rpc('tools/call', { name, arguments: args });
  expect(status).toBe(200);
  const result = json.result as { isError?: boolean; content: Array<{ text: string }> };
  const text = result.content[0]?.text ?? '';
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(text) as Record<string, unknown>;
  } catch {
    // error results carry plain text — callers assert on `text`.
  }
  return { isError: result.isError, payload, text };
}

/** Arm one tab and wait for its source row to stream. */
async function armAndWait(tabId: number): Promise<string> {
  const armed = (await invoke({
    type: 'oh.daemon.traffic.arm',
    kind: 'browser-tab',
    nodeId: peerNodeId,
    tabId,
  })) as { ok: boolean; uid?: string; error?: string };
  expect(armed.ok, armed.error).toBe(true);
  const uid = armed.uid ?? '';
  await expect
    .poll(async () => {
      const { payload } = await callTool('traffic_sources', {});
      const sources = (payload.sources as Array<{ uid: string; state: string }>) ?? [];
      return sources.some((s) => s.uid === uid && s.state === 'streaming');
    })
    .toBe(true);
  return uid;
}

async function matchedCount(uid: string, urlContains: string): Promise<number> {
  const { payload } = await callTool('traffic_list', { uid, urlContains });
  return (payload.matched as number) ?? 0;
}

async function pendingWaits(uid: string): Promise<number> {
  const { payload } = await callTool('traffic_sources', {});
  const sources = (payload.sources as Array<{ uid: string; pendingWaits: number }>) ?? [];
  return sources.find((s) => s.uid === uid)?.pendingWaits ?? -1;
}

const gatePair = (pairs: DiffPair[], name: string) => pairs.find((p) => p.path.endsWith(`/net/gate/${name}`));

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const userData = await mkdtemp(path.join(os.tmpdir(), 'oh-agent-traffic-diff-wait-e2e-'));
  await mkdir(path.join(userData, 'data'), { recursive: true });
  await writeFile(
    path.join(userData, 'data', 'settings.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: {
        'oh.settings.user': {
          // The tier gate is S3's live-proven leg — this suite seeds
          // observe on from the start and drives the S4 tools.
          'mcp.enabled': true,
          'mcp.allowObserve': true,
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

  const minted = (await invoke({ type: 'oh.daemon.tokens.mint', label: 'agent-traffic-diff-wait-e2e' })) as {
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

  workingPage = await context.newPage();
  await workingPage.goto(WORKING_PAGE_URL);
  brokenPage = await context.newPage();
  await brokenPage.goto(BROKEN_PAGE_URL);
  waitPage = await context.newPage();
  await waitPage.goto(WAIT_PAGE_URL);
  // Background the playground tabs so every request in the watched
  // partitions is one of this spec's own probes.
  await (await harness.extensionPage()).bringToFront();
});

test.afterAll(async () => {
  await context?.close();
  await electronApp?.close();
});

// ── Inventory gate ──────────────────────────────────────────────────

test('the daemon inventories all three playground tabs', async () => {
  await expect
    .poll(
      async () => {
        const { peers } = (await invoke({ type: 'oh.daemon.telemetry.tabs.list' })) as unknown as {
          peers?: Array<{ nodeId: string; tabs: Array<{ tabId: number; url: string }> }>;
        };
        for (const peer of peers ?? []) {
          const working = peer.tabs.find((t) => t.url.startsWith(WORKING_PAGE_URL));
          const broken = peer.tabs.find((t) => t.url.startsWith(BROKEN_PAGE_URL));
          const wait = peer.tabs.find((t) => t.url.startsWith(WAIT_PAGE_URL));
          if (working && broken && wait) {
            peerNodeId = peer.nodeId;
            workingTabId = working.tabId;
            brokenTabId = broken.tabId;
            waitTabId = wait.tabId;
            return true;
          }
        }
        return false;
      },
      { timeout: 30000 },
    )
    .toBe(true);
});

// ── traffic_diff across two sessions — the origin session's shape ───

test('traffic_diff proves identical headers on the divergent pair and localizes every planted delta', async () => {
  test.setTimeout(120000);
  workingUid = await armAndWait(workingTabId);
  brokenUid = await armAndWait(brokenTabId);

  const fire = (page: Page, role: 'working' | 'broken') =>
    page.evaluate(
      async ({ tag, role: r, sharedToken, workingToken, brokenToken }) => {
        await (
          window as unknown as {
            __ohFireTwoSessions(o: {
              tag: string;
              role: 'working' | 'broken';
              sharedToken: string;
              workingToken: string;
              brokenToken: string;
            }): Promise<number>;
          }
        ).__ohFireTwoSessions({ tag, role: r, sharedToken, workingToken, brokenToken });
      },
      { tag: 'ts1', role, sharedToken: SHARED_TOKEN, workingToken: WORKING_TOKEN, brokenToken: BROKEN_TOKEN },
    );
  await fire(workingPage, 'working');
  await fire(brokenPage, 'broken');

  await expect.poll(() => matchedCount(workingUid, 'tag=ts1'), { timeout: 20000 }).toBe(4);
  await expect.poll(() => matchedCount(brokenUid, 'tag=ts1'), { timeout: 20000 }).toBe(3);

  const { isError, payload } = await callTool('traffic_diff', {
    a: { uid: workingUid },
    b: { uid: brokenUid },
    urlContains: 'tag=ts1',
  });
  expect(isError).toBeFalsy();

  // The host computed the delta: three pairs, one divergent status.
  expect(payload.comparedPairs).toBe(3);
  expect(payload.divergentStatusPairs).toBe(1);
  const pairs = payload.differingPairs as DiffPair[];

  // THE NEGATIVE RESULT: the status diverges while the request headers
  // are provably identical — marker-equal without any secret.
  const account = gatePair(pairs, 'account');
  expect(account).toBeDefined();
  expect(account).toMatchObject({ statusDiverges: true });
  expect(account?.a.statusCode).toBe(200);
  expect(account?.b.statusCode).toBe(503);
  expect(account?.requestHeaders.identical).toBe(true);
  expect((payload.identicalRequestHeaderPairs as number) >= 1).toBe(true);

  // A changed credential is visible as two DISTINCT stable markers.
  const tokenPair = gatePair(pairs, 'token');
  const authChange = tokenPair?.requestHeaders.valueChanged.find((c) => c.name === 'authorization');
  expect(authChange).toBeDefined();
  const markerOf = (value: string) => value.replace(/^Bearer /, '');
  expect(markerOf(authChange?.a ?? '')).toMatch(MARKER);
  expect(markerOf(authChange?.b ?? '')).toMatch(MARKER);
  expect(authChange?.a).not.toBe(authChange?.b);

  // Presence delta on the right side (a = working).
  const flag = gatePair(pairs, 'flag');
  expect(flag?.requestHeaders.onlyInA).toContain('x-oh-feature-flag');
  expect(flag?.statusDiverges).toBe(false);

  // Request-set remainder: only the working side fired /net/gate/extra.
  const onlyInA = payload.onlyInA as Array<{ method: string; path: string; count: number }>;
  expect(onlyInA.some((r) => r.path.endsWith('/net/gate/extra') && r.count === 1)).toBe(true);
  expect(payload.onlyInB).toEqual([]);

  // The raw secrets appear NOWHERE in the whole report.
  const everything = JSON.stringify(payload);
  expect(everything).not.toContain(SHARED_TOKEN);
  expect(everything).not.toContain(WORKING_TOKEN);
  expect(everything).not.toContain(BROKEN_TOKEN);
});

// ── traffic_diff across two time windows of ONE source ──────────────

test('traffic_diff isolates a header change between two windows of the same source', async () => {
  test.setTimeout(120000);
  const burst = (headerValue: string, tag: string) =>
    workingPage.evaluate(
      async ({ tag: t, headerValue: v }) => {
        await (
          window as unknown as { __ohFireWindowBurst(o: { tag: string; headerValue: string }): Promise<number> }
        ).__ohFireWindowBurst({ tag: t, headerValue: v });
      },
      { tag, headerValue },
    );

  await burst('one', 'w1');
  await expect.poll(() => matchedCount(workingUid, 'tag=w1'), { timeout: 20000 }).toBe(1);
  // The boundary comes from the retained row's own clock domain — no
  // host-vs-browser clock skew can misplace the window split.
  const { payload: w1 } = await callTool('traffic_list', { uid: workingUid, urlContains: 'tag=w1' });
  const w1Started = ((w1.rows as Array<{ startedAtMs: number }>)[0]?.startedAtMs ?? 0) + 1;

  await burst('two', 'w2');
  await expect.poll(() => matchedCount(workingUid, 'tag=w2'), { timeout: 20000 }).toBe(1);

  const { payload } = await callTool('traffic_diff', {
    a: { uid: workingUid, untilMs: w1Started },
    b: { uid: workingUid, sinceMs: w1Started },
    urlContains: '/net/gate/window',
  });
  expect((payload.a as { rows: number }).rows).toBe(1);
  expect((payload.b as { rows: number }).rows).toBe(1);
  expect(payload.comparedPairs).toBe(1);
  const [pair] = payload.differingPairs as DiffPair[];
  expect(pair?.statusDiverges).toBe(false);
  expect(pair?.requestHeaders.valueChanged).toEqual([{ name: 'x-oh-phase', a: 'one', b: 'two' }]);
});

// ── traffic_wait — the "reload and tell me what breaks" move ────────

test('traffic_wait blocks until a delayed matching request lands', async () => {
  test.setTimeout(120000);
  waitUid = await armAndWait(waitTabId);

  const wait = callTool('traffic_wait', { uid: waitUid, urlContains: 'tag=wp1', timeoutMs: 30000 });
  await waitPage.evaluate(() => {
    (window as unknown as { __ohFireDelayed(o: { tag: string; delayMs: number }): boolean }).__ohFireDelayed({
      tag: 'wp1',
      delayMs: 1500,
    });
  });
  const { isError, payload } = await wait;
  expect(isError).toBeFalsy();
  expect(payload.matched).toBe(true);
  expect((payload.row as { url: string }).url).toContain('tag=wp1');
  // The call genuinely blocked across the delay.
  expect(payload.waitedMs as number).toBeGreaterThanOrEqual(1000);
  await expect.poll(() => pendingWaits(waitUid)).toBe(0);
});

test('traffic_wait settles on a refinement — the failure class arrives after admission', async () => {
  test.setTimeout(120000);
  const wait = callTool('traffic_wait', {
    uid: waitUid,
    urlContains: 'tag=wp2',
    statusClass: '5xx',
    timeoutMs: 30000,
  });
  await waitPage.evaluate(() => {
    (
      window as unknown as { __ohFireDelayed(o: { tag: string; delayMs: number; path?: string }): boolean }
    ).__ohFireDelayed({ tag: 'wp2', delayMs: 1000, path: '/net/status/503' });
  });
  const { payload } = await wait;
  expect(payload.matched).toBe(true);
  expect((payload.row as { statusCode: number }).statusCode).toBe(503);
  await expect.poll(() => pendingWaits(waitUid)).toBe(0);
});

test('a never-matching wait is visible while pending and times out into a clean result', async () => {
  test.setTimeout(120000);
  const wait = callTool('traffic_wait', { uid: waitUid, urlContains: 'never-match-xyz', timeoutMs: 8000 });
  // The watch is operator-visible while pending…
  await expect.poll(() => pendingWaits(waitUid), { timeout: 6000 }).toBe(1);
  const { isError, payload } = await wait;
  // …and a timeout is a RESULT, not an error.
  expect(isError).toBeFalsy();
  expect(payload).toMatchObject({ matched: false, reason: 'timeout', timeoutMs: 8000 });
  expect(payload.waitedMs as number).toBeGreaterThanOrEqual(7500);
  // No leaked watch after the timeout — and a subsequent wait behaves
  // exactly like the first (nothing lingered to satisfy or block it).
  expect(await pendingWaits(waitUid)).toBe(0);
  const again = callTool('traffic_wait', { uid: waitUid, urlContains: 'tag=wp3', timeoutMs: 30000 });
  await waitPage.evaluate(() => {
    (window as unknown as { __ohFireDelayed(o: { tag: string; delayMs: number }): boolean }).__ohFireDelayed({
      tag: 'wp3',
      delayMs: 800,
    });
  });
  expect((await again).payload.matched).toBe(true);
  expect(await pendingWaits(waitUid)).toBe(0);
});
