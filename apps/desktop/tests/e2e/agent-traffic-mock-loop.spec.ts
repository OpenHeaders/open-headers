/**
 * Agent traffic S6 E2E — the ACCEPTANCE test (AGENT_TRAFFIC_PLAN.md
 * §7.2 `mock-loop`, §8 S6): the origin session, mechanized, MCP-driven
 * over HTTP `/mcp` end to end:
 *
 *   1. A probe hits an endpoint that always fails server-side
 *      (`/net/gate/mock?status=503`) → `traffic_failures` finds the 503
 *      WITH its eagerly-captured body (CDP-pinned tab).
 *   2. `traffic_to_rule` mints a response-override DRAFT from the
 *      observed exchange — `published: false` (never auto-published),
 *      the observed CORS headers copied, the status/body overridden to
 *      the fix — and an explicit `published` arg is refused.
 *   3. Publishing is the separate, explicit write gesture
 *      (`rules_update`), after which the rule syncs into the connected
 *      browser extension (the mcp.spec.ts propagation idiom).
 *   4. A re-probe of the SAME endpoint now succeeds page-visibly (the
 *      override serves in the extension) and `traffic_wait` observes
 *      the success — closing the loop in one spec.
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
// Port etiquette: fresh port off every prior suite (ledger through 20537).
const DAEMON_PORT = 20637;
const MCP_URL = `http://127.0.0.1:${DAEMON_PORT}/mcp`;
const PAGE_URL = 'http://127.0.0.1:3000/src/agent-traffic/mock-loop.html';
const GATE_PATH = '/net/gate/mock';
const MOCK_BODY = '{"gate":"mock","status":200,"detail":"served-by-rule"}';

let electronApp: ElectronApplication;
let workbench: Page;
let token: string;
let context: BrowserContext | undefined;
let extensionId: string;
let loopPage: Page;
let peerNodeId: string;
let loopTabId: number;
let sourceUid: string;
let failureRequestId: string;
let ruleUid: string;
let ruleName: string;

const harness = createExtensionSeedHarness({
  context: () => context,
  extensionId: () => extensionId,
  token: () => token,
  daemonPort: DAEMON_PORT,
  recordId: 'agent-traffic-mock-loop-e2e-backend',
  recordLabel: 'agent-traffic mock-loop e2e desktop',
  logTag: 'agent-traffic-mock-loop setup',
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

/** Pin one tab into the CDP attach scope and wait for the attach — the
 *  failure-body mint leg needs body fidelity (CDP or proxy only). */
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

async function probeMock(tag: string): Promise<{ ok: boolean; status: number }> {
  return loopPage.evaluate(async (t) => {
    return (
      window as unknown as { __ohProbeMock(tag: string): Promise<{ ok: boolean; status: number }> }
    ).__ohProbeMock(t);
  }, tag);
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const userData = await mkdtemp(path.join(os.tmpdir(), 'oh-agent-traffic-mock-loop-e2e-'));
  await mkdir(path.join(userData, 'data'), { recursive: true });
  await writeFile(
    path.join(userData, 'data', 'settings.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: {
        'oh.settings.user': {
          // The loop needs BOTH switches: observe for the read tools
          // (and traffic_to_rule's dual-switch guard) + write for the
          // mint and the publish gesture.
          'mcp.enabled': true,
          'mcp.allowObserve': true,
          'mcp.allowWrite': true,
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

  const minted = (await invoke({ type: 'oh.daemon.tokens.mint', label: 'agent-traffic-mock-loop-e2e' })) as {
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

  loopPage = await context.newPage();
  await loopPage.goto(PAGE_URL);
  // Background the playground tab so every request in the watched
  // partition is one of this spec's own probes.
  await (await harness.extensionPage()).bringToFront();
});

test.afterAll(async () => {
  await context?.close();
  await electronApp?.close();
});

// ── Inventory gate ──────────────────────────────────────────────────

test('the daemon inventories the mock-loop tab', async () => {
  await expect
    .poll(
      async () => {
        const { peers } = (await invoke({ type: 'oh.daemon.telemetry.tabs.list' })) as unknown as {
          peers?: Array<{ nodeId: string; tabs: Array<{ tabId: number; url: string }> }>;
        };
        for (const peer of peers ?? []) {
          const loop = peer.tabs.find((t) => t.url.startsWith(PAGE_URL));
          if (loop) {
            peerNodeId = peer.nodeId;
            loopTabId = loop.tabId;
            return true;
          }
        }
        return false;
      },
      { timeout: 30000 },
    )
    .toBe(true);
});

// ── 1. The failure, observed with its body ──────────────────────────

test('the failing probe lands in traffic_failures with its eagerly-captured body', async () => {
  test.setTimeout(120000);
  await pinCdpAndWait(loopTabId);
  sourceUid = await armAndWait(loopTabId);

  const probe = await probeMock('probe-1');
  expect(probe).toEqual({ ok: false, status: 503 });

  await expect
    .poll(
      async () => {
        const { payload } = await callTool('traffic_failures', { uid: sourceUid });
        const rows = (payload.rows as Array<Record<string, unknown>>) ?? [];
        const hit = rows.find((r) => (r.url as string).includes(GATE_PATH) && r.body !== undefined);
        if (hit) {
          failureRequestId = hit.requestId as string;
          return hit.failureKind;
        }
        return null;
      },
      { timeout: 30000 },
    )
    .toBe('http-5xx');

  const { payload } = await callTool('traffic_failures', { uid: sourceUid });
  const row = (payload.rows as Array<Record<string, unknown>>).find((r) => r.requestId === failureRequestId);
  expect(row).toMatchObject({ statusCode: 503 });
  expect((row?.body as { content: string }).content).toContain('"gate":"mock"');
  // The CORS signal the mint will copy is already on the failure row.
  const headerNames = (row?.responseHeaders as Array<{ name: string }>).map((h) => h.name.toLowerCase());
  expect(headerNames).toContain('access-control-allow-origin');
});

// ── 2. The mint — a draft, never a publish ──────────────────────────

test('traffic_to_rule mints a response-override DRAFT with the observed CORS headers', async () => {
  test.setTimeout(60000);

  // The draft law is enforced, not implicit: an explicit published arg
  // is refused outright.
  const refused = await callTool('traffic_to_rule', {
    uid: sourceUid,
    requestId: failureRequestId,
    published: true,
  });
  expect(refused.isError).toBe(true);
  expect(refused.text).toContain('human gesture');

  const { isError, payload } = await callTool('traffic_to_rule', {
    uid: sourceUid,
    requestId: failureRequestId,
    statusCode: 200,
    body: MOCK_BODY,
  });
  expect(isError).toBeFalsy();
  expect(payload.draft).toBe(true);

  const rule = payload.rule as {
    uid: string;
    name: string;
    type: string;
    enabled: boolean;
    published: boolean;
    conditions: Array<{ type: string; values: string[] }>;
    action: {
      responseSource: string;
      bodyType: string;
      statusCode: number;
      responseBody: string;
      contentType: string;
      responseHeaders: Record<string, string>;
    };
  };
  ruleUid = rule.uid;
  ruleName = rule.name;
  expect(rule.type).toBe('response');
  expect(rule.published).toBe(false);
  expect(rule.enabled).toBe(true);
  expect(rule.action).toMatchObject({
    responseSource: 'mock',
    bodyType: 'static',
    statusCode: 200,
    responseBody: MOCK_BODY,
  });
  expect(rule.action.contentType).toContain('application/json');
  // The condition matches the endpoint, not the status knob: origin +
  // path + `*`, query excluded — so it matches the re-fire on every
  // delivery plane (the CDP Fetch urlPattern is a full-URL glob).
  expect(rule.conditions[0]?.type).toBe('url-filter');
  expect(rule.conditions[0]?.values).toEqual([`http://127.0.0.1:3000${GATE_PATH}*`]);

  // CORS rode the mint, copied from the observed response (the origin
  // session's burned round-trip, made structural).
  const cors = payload.cors as { copied: string[]; synthesized: string[] };
  expect(cors.copied.map((n) => n.toLowerCase())).toContain('access-control-allow-origin');
  expect(cors.synthesized).toEqual([]);
  const headerNames = Object.keys(rule.action.responseHeaders).map((n) => n.toLowerCase());
  expect(headerNames).toContain('access-control-allow-origin');

  // The agent supplied the body, and the result says so honestly.
  expect(payload.body).toMatchObject({ source: 'argument', truncated: false });

  // The draft exists in the workspace — as a draft.
  const got = await callTool('rules_get', { uid: ruleUid });
  expect((got.payload.rule as { published?: boolean }).published).toBeFalsy();

  // A draft never affects live traffic: the endpoint still fails.
  const probe = await probeMock('probe-draft');
  expect(probe).toEqual({ ok: false, status: 503 });
});

// ── 3. Publish — the separate, explicit write gesture ───────────────

test('publishing via the write surface syncs the rule into the connected extension', async () => {
  test.setTimeout(60000);
  const { isError } = await callTool('rules_update', { uid: ruleUid, updates: { published: true } });
  expect(isError).toBeFalsy();

  // The workspace (and the rule inside it) replicates into
  // chrome.storage under the oh.ws.<id>.rules key family — the
  // mcp.spec.ts propagation idiom, driven from the harness page.
  const popup = await harness.extensionPage();
  await expect
    .poll(
      async () =>
        popup.evaluate(
          async (name) =>
            new Promise<boolean>((resolve) => {
              chrome.storage.local.get(null, (items) => {
                const serialized = JSON.stringify(
                  Object.entries(items).filter(([key]) => /^oh\.ws\..*\.rules$/.test(key)),
                );
                resolve(serialized.includes(name));
              });
            }),
          ruleName,
        ),
      { timeout: 30000 },
    )
    .toBe(true);
});

// ── 4. The loop closes ──────────────────────────────────────────────

test('the same endpoint now succeeds and traffic_wait observes the success', async () => {
  test.setTimeout(120000);
  const sinceMs = Date.now();

  // A fresh load picks the newly-published rule up at document start;
  // the arm and the CDP pin ride the tabId across the reload.
  await loopPage.reload();

  // The override serves in the extension: the SAME endpoint, page-visibly
  // healthy — the origin session's success criterion.
  await expect.poll(async () => (await probeMock('probe-2')).status, { timeout: 30000 }).toBe(200);
  await expect(loopPage.getByTestId('probe-state')).toHaveText('success 200');

  // And the agent can SEE the loop close: the post-publish success is
  // observable traffic on the same source.
  const { isError, payload } = await callTool('traffic_wait', {
    uid: sourceUid,
    statusClass: '2xx',
    urlContains: GATE_PATH,
    sinceMs,
  });
  expect(isError).toBeFalsy();
  expect(payload.matched).toBe(true);
  expect((payload.row as { statusCode: number; url: string }).statusCode).toBe(200);
  expect((payload.row as { url: string }).url).toContain(GATE_PATH);
});
