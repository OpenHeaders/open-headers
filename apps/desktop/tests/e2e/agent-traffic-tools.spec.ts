/**
 * Agent traffic S3 E2E — the first observe-tier MCP tools against the
 * real dual-app stack (the agent-traffic plan §7.2 `known-shape` +
 * `failure-mix` + `body-shapes`, §8 S3), driven over HTTP `/mcp` like
 * an agent client:
 *
 *   1. Tier gate, live: with `mcp.allowObserve` off the traffic_* tools
 *      are absent from tools/list and denied on call; flipping the
 *      setting exposes them without a restart (the S2 leg that had to
 *      wait for S3 to mint a tool to drive).
 *   2. `traffic_sources` — absence before any arm; the armed source
 *      with stats and expiry after.
 *   3. `traffic_list` over the known-shape burst — projection fidelity,
 *      host-side filters, pagination; the heuristic tab's honest
 *      `bodyUnavailable` on traffic_get.
 *   4. The FIRST live `agent-observe` Activity Feed entries — observe
 *      reads must be visible after the fact.
 *   5. `traffic_failures` over the failure mix on a CDP-pinned tab —
 *      classification (http-4xx / http-5xx / network-error), eagerly
 *      captured failure bodies, and BODY-PLANE redaction: the planted
 *      secret appears nowhere; its stable marker appears in the URL
 *      and the body alike.
 *   6. `traffic_get` over the body shapes — JSON/text fidelity, binary
 *      as uncorrupted base64, and `bodyTruncated` exactly at the cap.
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
// Port etiquette: fresh port off every prior suite (ledger through 20237).
const DAEMON_PORT = 20337;
const MCP_URL = `http://127.0.0.1:${DAEMON_PORT}/mcp`;
const KNOWN_PAGE_URL = 'http://127.0.0.1:3000/src/agent-traffic/known-shape.html';
const FAILURE_PAGE_URL = 'http://127.0.0.1:3000/src/agent-traffic/failure-mix.html';
const BODY_PAGE_URL = 'http://127.0.0.1:3000/src/agent-traffic/body-shapes.html';

/** Planted in the 503 body AND (percent-encoded) its query knob — the
 *  spec asserts one stable marker across both positions and the raw
 *  value nowhere. */
const SECRET = 'oh_e2e_failure_9f8e7d6c5b4a39281706';
const MARKER = /\[redacted:[0-9a-f]{8}\]/;
const BODY_CAP_CHARS = 100_000;

interface ToolRow {
  requestId: string;
  url: string;
  method: string;
  resourceType: string;
  phase: string;
  statusCode?: number;
  error?: { code: string; reason: string };
  startedAtMs: number;
  provenance: string;
  failureKind?: string;
  body?: { content: string; encoding: string; truncated: boolean };
  bodyUnavailable?: string;
  responseHeaders?: Array<{ name: string; value: string }>;
}

let electronApp: ElectronApplication;
let workbench: Page;
let token: string;
let context: BrowserContext | undefined;
let extensionId: string;
let knownPage: Page;
let failurePage: Page;
let bodyPage: Page;
let peerNodeId: string;
let knownTabId: number;
let failureTabId: number;
let bodyTabId: number;
let knownUid: string;

const harness = createExtensionSeedHarness({
  context: () => context,
  extensionId: () => extensionId,
  token: () => token,
  daemonPort: DAEMON_PORT,
  recordId: 'agent-traffic-tools-e2e-backend',
  recordLabel: 'agent-traffic tools e2e desktop',
  logTag: 'agent-traffic-tools setup',
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

async function listToolNames(): Promise<string[]> {
  const { json } = await rpc('tools/list', {});
  return (json.result as { tools: Array<{ name: string }> }).tools.map((t) => t.name);
}

/** Flip one `oh.settings.user` key live through the storage bridge. */
async function setUserSetting(key: string, value: unknown): Promise<void> {
  await workbench.evaluate(
    async ({ settingKey, settingValue }) => {
      const bridge = (
        window as unknown as {
          oh: {
            storage: {
              get(req: { key: string }): Promise<{ value: unknown }>;
              set(req: { key: string; value: unknown }): Promise<unknown>;
            };
          };
        }
      ).oh;
      const current = await bridge.storage.get({ key: 'oh.settings.user' });
      await bridge.storage.set({
        key: 'oh.settings.user',
        value: { ...((current.value as Record<string, unknown>) ?? {}), [settingKey]: settingValue },
      });
    },
    { settingKey: key, settingValue: value },
  );
}

/** Pin one tab into the CDP attach scope and wait for the attach —
 *  bodies are servable only on a CDP-owned (or proxy) partition. */
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

const byProbe = (rows: ToolRow[], n: number) => rows.find((r) => r.url.includes(`n=${n}`));

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const userData = await mkdtemp(path.join(os.tmpdir(), 'oh-agent-traffic-tools-e2e-'));
  await mkdir(path.join(userData, 'data'), { recursive: true });
  await writeFile(
    path.join(userData, 'data', 'settings.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: {
        'oh.settings.user': {
          // Observe deliberately NOT enabled — the tier-gate leg flips
          // it live once the denial has been asserted.
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

  const minted = (await invoke({ type: 'oh.daemon.tokens.mint', label: 'agent-traffic-tools-e2e' })) as {
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

  knownPage = await context.newPage();
  await knownPage.goto(KNOWN_PAGE_URL);
  failurePage = await context.newPage();
  await failurePage.goto(FAILURE_PAGE_URL);
  bodyPage = await context.newPage();
  await bodyPage.goto(BODY_PAGE_URL);
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
          const known = peer.tabs.find((t) => t.url.startsWith(KNOWN_PAGE_URL));
          const failure = peer.tabs.find((t) => t.url.startsWith(FAILURE_PAGE_URL));
          const body = peer.tabs.find((t) => t.url.startsWith(BODY_PAGE_URL));
          if (known && failure && body) {
            peerNodeId = peer.nodeId;
            knownTabId = known.tabId;
            failureTabId = failure.tabId;
            bodyTabId = body.tabId;
            return true;
          }
        }
        return false;
      },
      { timeout: 30000 },
    )
    .toBe(true);
});

// ── Tier gate, live (the leg S2 had to unit-pin) ────────────────────

test('observe tools are hidden and denied until mcp.allowObserve flips on', async () => {
  const before = await listToolNames();
  expect(before).toContain('rules_list');
  expect(before).not.toContain('traffic_sources');
  expect(before).not.toContain('traffic_list');

  const denied = await callTool('traffic_sources', {});
  expect(denied.isError).toBe(true);
  expect(denied.text).toContain('Traffic observation tools are disabled');

  await setUserSetting('mcp.allowObserve', true);
  await expect.poll(listToolNames).toContain('traffic_sources');
  const after = await listToolNames();
  expect(after).toEqual(expect.arrayContaining(['traffic_sources', 'traffic_list', 'traffic_failures', 'traffic_get']));
});

// ── traffic_sources — absence, then the armed source ────────────────

test('traffic_sources reports absence before any arm and the armed source after', async () => {
  const empty = await callTool('traffic_sources', {});
  expect(empty.isError).toBeFalsy();
  expect(empty.payload.sources).toEqual([]);

  // A well-formed uid for a live-but-unarmed tab is an agent-readable
  // miss on every record tool — absent, not unreadable.
  const missUid = `browser-tab:${peerNodeId}:${knownTabId}`;
  const miss = await callTool('traffic_list', { uid: missUid });
  expect(miss.isError).toBe(true);
  expect(miss.text).toContain('traffic_sources');

  knownUid = await armAndWait(knownTabId);
  const { payload } = await callTool('traffic_sources', {});
  const sources = payload.sources as Array<Record<string, unknown>>;
  expect(sources.map((s) => s.uid)).toEqual([knownUid]);
  expect(sources[0]).toMatchObject({ kind: 'browser-tab', nodeId: peerNodeId, tabId: knownTabId, state: 'streaming' });
  expect(sources[0]?.expiresAtMs as number).toBeGreaterThan(Date.now());
  expect((sources[0]?.stats as Record<string, unknown>).maxRecords).toBeGreaterThan(0);
});

// ── traffic_list over the known-shape burst ─────────────────────────

test('traffic_list projects the known burst faithfully with host-side filters and pagination', async () => {
  await knownPage.evaluate(async () => {
    await (window as unknown as { __ohFireKnownShape(o: { tag: string }): Promise<number> }).__ohFireKnownShape({
      tag: 'ks1',
    });
  });

  await expect
    .poll(
      async () => {
        const { payload } = await callTool('traffic_list', { uid: knownUid, urlContains: 'tag=ks1' });
        return payload.matched as number;
      },
      { timeout: 20000 },
    )
    .toBe(6);

  const { payload } = await callTool('traffic_list', { uid: knownUid, urlContains: 'tag=ks1' });
  const rows = payload.rows as ToolRow[];

  // Ordering is oldest-first; the burst fired sequentially.
  expect(rows.map((r) => new URL(r.url).searchParams.get('n'))).toEqual(['1', '2', '3', '4', '5', '6']);
  // Projection fidelity: method, status, resourceType, provenance.
  expect(byProbe(rows, 3)?.method).toBe('POST');
  expect(byProbe(rows, 4)?.statusCode).toBe(404);
  expect(byProbe(rows, 5)?.statusCode).toBe(503);
  expect(byProbe(rows, 6)?.resourceType).toBe('image');
  expect(rows.every((r) => r.provenance === 'heuristic')).toBe(true);
  expect(rows.every((r) => r.startedAtMs > 0)).toBe(true);
  // Lean rows: never headers, never bodies.
  expect(JSON.stringify(rows)).not.toContain('responseHeaders');
  expect(JSON.stringify(rows)).not.toContain('failureBody');

  // Host-side filters.
  const post = await callTool('traffic_list', { uid: knownUid, urlContains: 'tag=ks1', method: 'post' });
  expect((post.payload.rows as ToolRow[]).map((r) => new URL(r.url).searchParams.get('n'))).toEqual(['3']);
  const fourxx = await callTool('traffic_list', { uid: knownUid, urlContains: 'tag=ks1', statusClass: '4xx' });
  expect((fourxx.payload.rows as ToolRow[]).map((r) => new URL(r.url).searchParams.get('n'))).toEqual(['4']);
  const images = await callTool('traffic_list', { uid: knownUid, urlContains: 'tag=ks1', resourceType: 'image' });
  expect((images.payload.rows as ToolRow[]).map((r) => new URL(r.url).searchParams.get('n'))).toEqual(['6']);

  // Pagination with an honest cursor.
  const page1 = await callTool('traffic_list', { uid: knownUid, urlContains: 'tag=ks1', limit: 4 });
  expect((page1.payload.rows as ToolRow[]).length).toBe(4);
  expect(page1.payload.hasMore).toBe(true);
  const page2 = await callTool('traffic_list', { uid: knownUid, urlContains: 'tag=ks1', limit: 4, offset: 4 });
  expect((page2.payload.rows as ToolRow[]).length).toBe(2);
  expect(page2.payload.hasMore).toBe(false);
});

test('traffic_get on a heuristic-owned source reports the body gap honestly', async () => {
  test.setTimeout(120000);
  const { payload } = await callTool('traffic_list', { uid: knownUid, urlContains: 'n=1' });
  const requestId = (payload.rows as ToolRow[])[0]?.requestId ?? '';
  expect(requestId).not.toBe('');

  const result = await callTool('traffic_get', { uid: knownUid, requestId });
  expect(result.isError).toBeFalsy();
  expect((result.payload.record as ToolRow).requestId).toBe(requestId);
  // A heuristic tab cannot serve bodies — the pull times out into the
  // honest reason, never an error.
  expect(result.payload.body).toBeUndefined();
  expect(result.payload.bodyUnavailable as string).toContain('cannot serve bodies');
});

// ── The first live agent-observe Activity Feed entries ──────────────

test('observe reads land as agent-observe entries in the Activity Feed', async () => {
  await expect
    .poll(async () => {
      const { payload } = await callTool('activity_list', { limit: 100 });
      const entries = (payload.entries as Array<{ kind: string; context?: { toolName?: string } }>) ?? [];
      const observed = entries.filter((e) => e.kind === 'agent-observe');
      const toolNames = new Set(observed.map((e) => e.context?.toolName));
      return toolNames.has('traffic_sources') && toolNames.has('traffic_list') && toolNames.has('traffic_get');
    })
    .toBe(true);
});

// ── traffic_failures over the failure mix (CDP-pinned tab) ──────────

test('traffic_failures classifies the mix and captures failure bodies eagerly, redacted', async () => {
  test.setTimeout(120000);
  await pinCdpAndWait(failureTabId);
  const failureUid = await armAndWait(failureTabId);

  await failurePage.evaluate(async (secret) => {
    await (
      window as unknown as { __ohFireFailureMix(o: { tag: string; secret: string }): Promise<number> }
    ).__ohFireFailureMix({ tag: 'fm1', secret });
  }, SECRET);

  // Five failures, with the two HTTP failures' bodies captured eagerly.
  await expect
    .poll(
      async () => {
        const { payload } = await callTool('traffic_failures', { uid: failureUid });
        const rows = (payload.rows as ToolRow[]).filter((r) => r.url.includes('tag=fm1'));
        const httpBodies = rows.filter((r) => r.failureKind?.startsWith('http-') && r.body !== undefined);
        return rows.length >= 5 && httpBodies.length >= 2;
      },
      { timeout: 30000 },
    )
    .toBe(true);

  const { payload } = await callTool('traffic_failures', { uid: failureUid, limit: 50 });
  const rows = (payload.rows as ToolRow[]).filter((r) => r.url.includes('tag=fm1'));

  // Classification per probe.
  expect(byProbe(rows, 1)?.failureKind).toBe('http-4xx');
  expect(byProbe(rows, 2)?.failureKind).toBe('http-5xx');
  expect(byProbe(rows, 3)?.failureKind).toBe('network-error');
  expect(byProbe(rows, 4)?.failureKind).toBe('network-error');
  expect(byProbe(rows, 5)?.failureKind).toBe('network-error');

  // HTTP failure bodies were captured at classification time.
  expect(byProbe(rows, 1)?.body?.content).toContain('"status":404');
  const brokenBody = byProbe(rows, 2)?.body?.content ?? '';
  expect(brokenBody).toContain('"status":503');

  // BODY-PLANE REDACTION: the secret appears NOWHERE; its marker is
  // stable across positions (the URL query knob and the body text).
  const everything = JSON.stringify(payload);
  expect(everything).not.toContain(SECRET);
  const bodyMarker = brokenBody.match(MARKER)?.[0];
  expect(bodyMarker).toBeDefined();
  expect(byProbe(rows, 2)?.url).toContain(`body=${bodyMarker}`);

  // Network-level failures carry the honest gap, and an error code.
  expect(byProbe(rows, 3)?.bodyUnavailable).toContain('failed before a response body existed');
  expect(byProbe(rows, 3)?.error?.code).toBeTruthy();
  expect(byProbe(rows, 4)?.bodyUnavailable).toBeTruthy();
  expect(byProbe(rows, 5)?.bodyUnavailable).toBeTruthy();

  // traffic_get answers the retained failure body without a re-pull.
  const brokenId = byProbe(rows, 2)?.requestId ?? '';
  const got = await callTool('traffic_get', { uid: failureUid, requestId: brokenId });
  expect((got.payload.body as { content: string }).content).toBe(brokenBody);
});

// ── traffic_get over the body shapes (CDP-pinned tab) ───────────────

test('traffic_get pulls JSON, text, uncorrupted binary, and caps oversized bodies', async () => {
  test.setTimeout(180000);
  await pinCdpAndWait(bodyTabId);
  const bodyUid = await armAndWait(bodyTabId);

  await bodyPage.evaluate(async () => {
    await (window as unknown as { __ohFireBodyShapes(o: { tag: string }): Promise<number> }).__ohFireBodyShapes({
      tag: 'bs1',
    });
  });

  await expect
    .poll(
      async () => {
        const { payload } = await callTool('traffic_list', { uid: bodyUid, urlContains: 'tag=bs1' });
        return payload.matched as number;
      },
      { timeout: 20000 },
    )
    .toBe(4);

  const { payload } = await callTool('traffic_list', { uid: bodyUid, urlContains: 'tag=bs1' });
  const rows = payload.rows as ToolRow[];
  const idOf = (n: number) => byProbe(rows, n)?.requestId ?? '';

  const json = await callTool('traffic_get', { uid: bodyUid, requestId: idOf(1) });
  expect((json.payload.body as { content: string; encoding: string }).encoding).toBe('text');
  expect((json.payload.body as { content: string }).content).toContain('OH_PROBE_JSON_OK');

  const text = await callTool('traffic_get', { uid: bodyUid, requestId: idOf(2) });
  expect((text.payload.body as { content: string }).content).toContain('OH_PROBE_TEXT_OK');

  // Binary: base64, and the decoded bytes still open with the PNG
  // signature — truncation or text-plane redaction would corrupt it.
  const png = await callTool('traffic_get', { uid: bodyUid, requestId: idOf(3) });
  const pngBody = png.payload.body as { content: string; encoding: string; truncated: boolean };
  expect(pngBody.encoding).toBe('base64');
  expect(pngBody.truncated).toBe(false);
  const bytes = Buffer.from(pngBody.content, 'base64');
  expect([...bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);

  // Oversized: truncated EXACTLY at the cap, flagged, never silent.
  const big = await callTool('traffic_get', { uid: bodyUid, requestId: idOf(4) });
  const bigBody = big.payload.body as { content: string; truncated: boolean };
  expect(bigBody.truncated).toBe(true);
  expect(bigBody.content.length).toBe(BODY_CAP_CHARS);

  // Unknown requestId — agent-correctable guidance.
  const ghost = await callTool('traffic_get', { uid: bodyUid, requestId: 'ghost-request' });
  expect(ghost.isError).toBe(true);
  expect(ghost.text).toContain('see traffic_list');
});
