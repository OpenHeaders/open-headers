/**
 * Agent traffic S5 E2E — `traffic_graph` against the real dual-app
 * stack (the agent-traffic plan §7.2 `redirect-chain`, §8 S5),
 * MCP-driven over HTTP `/mcp` per the S3/S4 pattern:
 *
 *   1. Redirect chains on a heuristic tab: a 3-hop and a 1-hop
 *      `/net/redirect-chain` probe resolve with per-hop URLs and 302
 *      statuses and the final stop — and hops mint NO rows of their
 *      own (one requestId = one exchange, the no-double-counting law).
 *   2. Failure clusters: bursts on two fixed gate paths fold to two
 *      clusters with honest counts and status sets; the heuristic
 *      partition's origin-only initiators join NOTHING (approximate
 *      join honesty — absent, never fabricated).
 *   3. Initiator chains + critical path on a CDP-pinned tab: a fresh
 *      load's parser tree joins page → entry module → imported module
 *      (depth 3) and page → slow image; the critical path terminates
 *      at the slow image with the window span to match.
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
// Port etiquette: fresh port off every prior suite (ledger through 20437).
const DAEMON_PORT = 20537;
const MCP_URL = `http://127.0.0.1:${DAEMON_PORT}/mcp`;
const PAGE_URL = 'http://127.0.0.1:3000/src/agent-traffic/redirect-chain.html';
const HEURISTIC_PAGE_URL = `${PAGE_URL}?role=heuristic`;
const CDP_PAGE_URL = `${PAGE_URL}?role=cdp`;

interface RedirectChainRow {
  requestId: string;
  method: string;
  hops: Array<{ url: string; statusCode?: number }>;
  finalUrl: string;
  finalStatusCode?: number;
  hopCount: number;
  truncated: boolean;
}

interface InitiatorChainRow {
  urls: string[];
  requestIds: string[];
  depth: number;
}

interface FailureClusterRow {
  failureKind: string;
  path: string;
  count: number;
  statusCodes: number[];
  errorCodes: string[];
  sampleRequestIds: string[];
}

interface CriticalPathRow {
  chain: Array<{ requestId: string; url: string; durationMs?: number }>;
  windowStartedAtMs: number;
  windowEndedAtMs: number;
  windowSpanMs: number;
}

let electronApp: ElectronApplication;
let workbench: Page;
let token: string;
let context: BrowserContext | undefined;
let extensionId: string;
let heuristicPage: Page;
let cdpPage: Page;
let peerNodeId: string;
let heuristicTabId: number;
let cdpTabId: number;
let heuristicUid: string;

const harness = createExtensionSeedHarness({
  context: () => context,
  extensionId: () => extensionId,
  token: () => token,
  daemonPort: DAEMON_PORT,
  recordId: 'agent-traffic-graph-e2e-backend',
  recordLabel: 'agent-traffic graph e2e desktop',
  logTag: 'agent-traffic-graph setup',
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

/** Pin one tab into the CDP attach scope and wait for the attach —
 *  initiator URLs (script/module fidelity) need the CDP correlator. */
async function pinCdpAndWait(tabId: number): Promise<void> {
  await invoke({
    type: 'oh.daemon.telemetry.debug.control',
    nodeId: peerNodeId,
    command: { kind: 'enable', enabled: true },
  });
  await invoke({
    type: 'oh.daemon.telemetry.debug.control',
    nodeId: peerNodeId,
    command: { kind: 'pin', tabId, pinned: true },
  });
  await expect
    .poll(
      async () => {
        const { peers } = (await invoke({ type: 'oh.daemon.telemetry.tabs.list' })) as unknown as {
          peers?: Array<{ nodeId: string; debug: { attachedTabs: number[] } }>;
        };
        const peer = (peers ?? []).find((p) => p.nodeId === peerNodeId);
        return peer?.debug.attachedTabs.includes(tabId) ?? false;
      },
      { timeout: 20000 },
    )
    .toBe(true);
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

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const userData = await mkdtemp(path.join(os.tmpdir(), 'oh-agent-traffic-graph-e2e-'));
  await mkdir(path.join(userData, 'data'), { recursive: true });
  await writeFile(
    path.join(userData, 'data', 'settings.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: {
        'oh.settings.user': {
          // The tier gate is S3's live-proven leg — this suite seeds
          // observe on from the start and drives the S5 tool.
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

  const minted = (await invoke({ type: 'oh.daemon.tokens.mint', label: 'agent-traffic-graph-e2e' })) as {
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

  heuristicPage = await context.newPage();
  await heuristicPage.goto(HEURISTIC_PAGE_URL);
  cdpPage = await context.newPage();
  await cdpPage.goto(CDP_PAGE_URL);
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
          const heuristic = peer.tabs.find((t) => t.url.startsWith(HEURISTIC_PAGE_URL));
          const cdp = peer.tabs.find((t) => t.url.startsWith(CDP_PAGE_URL));
          if (heuristic && cdp) {
            peerNodeId = peer.nodeId;
            heuristicTabId = heuristic.tabId;
            cdpTabId = cdp.tabId;
            return true;
          }
        }
        return false;
      },
      { timeout: 30000 },
    )
    .toBe(true);
});

// ── Redirect chains — hops resolve, and never mint rows ─────────────

test('traffic_graph resolves redirect chains with per-hop URLs and one row per requestId', async () => {
  test.setTimeout(120000);
  heuristicUid = await armAndWait(heuristicTabId);

  const fireChain = (tag: string, hops: number) =>
    heuristicPage.evaluate(
      async ({ tag: t, hops: h }) => {
        await (
          window as unknown as { __ohFireRedirectChain(o: { tag: string; hops: number }): Promise<number> }
        ).__ohFireRedirectChain({ tag: t, hops: h });
      },
      { tag, hops },
    );
  await fireChain('rc1', 3);
  await fireChain('rc2', 1);

  // Both chains land as their FINAL urls — the hop URLs never become
  // rows of their own (the requestId-dedup law across hops).
  await expect.poll(() => matchedCount(heuristicUid, '/echo/chain-end'), { timeout: 20000 }).toBe(2);
  expect(await matchedCount(heuristicUid, '/net/redirect-chain')).toBe(0);

  const { isError, payload } = await callTool('traffic_graph', { uid: heuristicUid });
  expect(isError).toBeFalsy();
  expect(payload.redirectChainsTotal).toBe(2);
  const chains = payload.redirectChains as RedirectChainRow[];

  const threeHop = chains.find((c) => c.hops[0]?.url.includes('tag=rc1'));
  expect(threeHop).toBeDefined();
  expect(threeHop).toMatchObject({ hopCount: 3, truncated: false, finalStatusCode: 200 });
  expect(threeHop?.finalUrl).toContain('/echo/chain-end');
  expect(threeHop?.hops.map((h) => new URL(h.url).pathname)).toEqual([
    '/net/redirect-chain/3',
    '/net/redirect-chain/2',
    '/net/redirect-chain/1',
  ]);
  expect(threeHop?.hops.every((h) => h.statusCode === 302)).toBe(true);

  const oneHop = chains.find((c) => c.hops[0]?.url.includes('tag=rc2'));
  expect(oneHop).toMatchObject({ hopCount: 1, truncated: false });
  expect(oneHop?.hops.map((h) => new URL(h.url).pathname)).toEqual(['/net/redirect-chain/1']);

  // The trail rides traffic_get's full projection too.
  const got = await callTool('traffic_get', { uid: heuristicUid, requestId: threeHop?.requestId ?? '' });
  const record = got.payload.record as { redirectTrail?: Array<{ url: string }>; redirectHopCount: number };
  expect(record.redirectHopCount).toBe(3);
  expect(record.redirectTrail).toHaveLength(3);
});

// ── Failure clusters + heuristic initiator honesty ──────────────────

test('traffic_graph folds failure bursts into endpoint clusters; origin-only initiators join nothing', async () => {
  test.setTimeout(120000);
  await heuristicPage.evaluate(async () => {
    await (window as unknown as { __ohFireFailureCluster(o: { tag: string }): Promise<number> }).__ohFireFailureCluster(
      { tag: 'fc1' },
    );
  });
  await expect.poll(() => matchedCount(heuristicUid, 'tag=fc1'), { timeout: 20000 }).toBe(6);

  const { payload } = await callTool('traffic_graph', { uid: heuristicUid });
  expect(payload.failureClustersTotal).toBe(2);
  const clusters = payload.failureClusters as FailureClusterRow[];

  // Biggest first: 4 × 500 on ONE endpoint read as one problem.
  expect(clusters[0]).toMatchObject({ failureKind: 'http-5xx', count: 4, statusCodes: [500] });
  expect(clusters[0]?.path.endsWith('/net/gate/cluster')).toBe(true);
  expect(clusters[0]?.sampleRequestIds).toHaveLength(3);
  expect(clusters[1]).toMatchObject({ failureKind: 'http-4xx', count: 2, statusCodes: [404] });
  expect(clusters[1]?.path.endsWith('/net/gate/lesser')).toBe(true);

  // The heuristic correlator records only an ORIGIN as the initiator,
  // which joins no record URL — the graph reports the absence honestly
  // instead of fabricating chains.
  expect(payload.initiatorChainsTotal).toBe(0);
});

// ── Initiator chains + critical path (CDP-pinned tab) ───────────────

test('traffic_graph joins the parser tree and walks the critical path to the slow image', async () => {
  test.setTimeout(180000);
  await pinCdpAndWait(cdpTabId);
  const cdpUid = await armAndWait(cdpTabId);

  // A fresh load AFTER the arm mints the whole parser tree: document →
  // entry module → imported module, document → slow image.
  await cdpPage.reload();

  await expect
    .poll(
      async () => {
        const { payload } = await callTool('traffic_list', { uid: cdpUid, urlContains: '/net/slow/800' });
        const rows = (payload.rows as Array<{ durationMs?: number }>) ?? [];
        return rows.some((r) => r.durationMs !== undefined);
      },
      { timeout: 30000 },
    )
    .toBe(true);

  const { payload } = await callTool('traffic_graph', { uid: cdpUid });
  const chains = payload.initiatorChains as InitiatorChainRow[];

  // Depth 3: page (parser) → entry module (script import) → leaf module.
  const moduleChain = chains.find((c) => c.urls[c.urls.length - 1]?.includes('redirect-chain-tree.ts'));
  expect(moduleChain).toBeDefined();
  expect(moduleChain?.depth).toBe(3);
  expect(moduleChain?.urls[0]).toContain('redirect-chain.html');
  expect(moduleChain?.urls[1]).toContain('redirect-chain.ts');

  // Depth 2: page → the parser-initiated slow image.
  const imageChain = chains.find((c) => c.urls[c.urls.length - 1]?.includes('/net/slow/800'));
  expect(imageChain).toBeDefined();
  expect(imageChain?.urls[0]).toContain('redirect-chain.html');

  // The critical path terminates at the LAST exchange to complete —
  // the 800 ms image — and walks back to the page that loaded it.
  const critical = payload.criticalPath as CriticalPathRow;
  const terminal = critical.chain[critical.chain.length - 1];
  expect(terminal?.url).toContain('/net/slow/800');
  expect(terminal?.durationMs ?? 0).toBeGreaterThanOrEqual(600);
  expect(critical.chain[0]?.url).toContain('redirect-chain.html');
  expect(critical.windowSpanMs).toBeGreaterThanOrEqual(700);
  expect(critical.windowEndedAtMs).toBeGreaterThan(critical.windowStartedAtMs);
});
