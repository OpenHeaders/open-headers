/**
 * Agent traffic C7 E2E — the MCP session tier against the real dual-app
 * stack (the agent-traffic plan §11.5/§11.6
 * `agent-traffic/session-redaction-at-read` — the pin C3 owed C7):
 *
 *   1. Record a secrets-bearing session on a CDP-pinned tab (the
 *      recorder's completion pulls put the echoed JWT-bearing bodies IN
 *      the sealed log), let the event stream plateau, seal it, then
 *      close the tab and disarm — everything read from here on comes
 *      from the archive, with the wire long gone.
 *   2. `traffic_sessions` lists the sealed session over real `/mcp`
 *      (index facts only); `traffic_session_list` and
 *      `traffic_session_get` read it REDACTED by default: the planted
 *      JWT IS in the store (raw at rest — the inverted S7 law, pinned
 *      by the archive spec's ciphertext leg) yet appears NOWHERE in
 *      tool output — one stable marker replaces it across the header,
 *      the URL query, and the echoed body.
 *   3. The persistent Settings grant (`trafficMonitor.
 *      sessionAgentRawReads`, default OFF) flips projection to RAW
 *      live — no restart — and every raw read lands in the Activity
 *      Feed flagged `raw`; flipping it back restores markers.
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
// Port etiquette: fresh port for a new daemon spec (ledger through 21137).
const DAEMON_PORT = 21237;
const MCP_URL = `http://127.0.0.1:${DAEMON_PORT}/mcp`;
const PAGE_URL = 'http://127.0.0.1:3000/src/agent-traffic/secrets-bearing.html';

/** The planted secrets — the JWT rides two Authorization headers, one
 *  access_token query param, and every echoed response body. */
const JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJzZXNzaW9uLXRvb2xzIiwibmFtZSI6Ik9wZW4gSGVhZGVycyJ9.c2Vzc2lvbnRvb2xzZTJlMDEyMzQ1Njc4OWFiY2RlZg';
const API_KEY = 'oh_e2e_session_9f8e7d6c5b4a392817';
const COOKIE = 'oh_e2e_session_cookie_0123456789ab';
const MARKER = /\[redacted:[0-9a-f]{8}\]/;

interface CaptureSessionRow {
  sessionId: string;
  state: string;
  requests: number;
  events: number;
}

interface SessionIndexRow {
  sessionId: string;
  name: string;
  state: string;
  requests: number;
  fidelity: string;
  encrypted: boolean;
}

interface SessionToolRow {
  requestId: string;
  url: string;
  method: string;
  phase: string;
  statusCode?: number;
  requestHeaders?: Array<{ name: string; value: string }>;
}

let electronApp: ElectronApplication;
let workbench: Page;
let token: string;
let context: BrowserContext | undefined;
let extensionId: string;
let secretsPage: Page;
let peerNodeId: string;
let secretsTabId: number;
let armedUid: string;
let recordedSessionId: string;
let archiveId: string;

const harness = createExtensionSeedHarness({
  context: () => context,
  extensionId: () => extensionId,
  token: () => token,
  daemonPort: DAEMON_PORT,
  recordId: 'agent-traffic-session-tools-e2e-backend',
  recordLabel: 'agent-traffic session-tools e2e desktop',
  logTag: 'agent-traffic-session-tools setup',
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

async function captureSessions(): Promise<CaptureSessionRow[]> {
  const { sessions } = (await invoke({ type: 'oh.daemon.traffic.capture.status' })) as unknown as {
    sessions: CaptureSessionRow[];
  };
  return sessions ?? [];
}

const rowByProbe = (rows: SessionToolRow[], n: number) => rows.find((r) => r.url.includes(`n=${n}`));

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const userData = await mkdtemp(path.join(os.tmpdir(), 'oh-agent-traffic-session-tools-e2e-'));
  await mkdir(path.join(userData, 'data'), { recursive: true });
  await writeFile(
    path.join(userData, 'data', 'settings.json'),
    JSON.stringify({
      schemaVersion: 1,
      values: {
        'oh.settings.user': {
          'mcp.enabled': true,
          // The observe tier is on from boot — the tier gate itself is
          // the tools spec's pin; this spec pins the session tier.
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

  const minted = (await invoke({ type: 'oh.daemon.tokens.mint', label: 'agent-traffic-session-tools-e2e' })) as {
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
  await secretsPage.goto(PAGE_URL);
  // Background the playground tab so every request in the watched
  // partition is one of this spec's own probes.
  await (await harness.extensionPage()).bringToFront();
});

test.afterAll(async () => {
  await context?.close();
  await electronApp?.close();
});

// ── Record + seal the secrets-bearing session, then kill the wire ───

test('a CDP-fidelity secrets session records, seals, and outlives its tab', async () => {
  test.setTimeout(180000);
  await expect
    .poll(
      async () => {
        const { peers } = (await invoke({ type: 'oh.daemon.telemetry.tabs.list' })) as unknown as {
          peers?: Array<{ nodeId: string; tabs: Array<{ tabId: number; url: string }> }>;
        };
        for (const peer of peers ?? []) {
          const tab = peer.tabs.find((t) => t.url.startsWith(PAGE_URL));
          if (tab) {
            peerNodeId = peer.nodeId;
            secretsTabId = tab.tabId;
            return true;
          }
        }
        return false;
      },
      { timeout: 30000 },
    )
    .toBe(true);

  const armed = (await invoke({
    type: 'oh.daemon.traffic.arm',
    kind: 'browser-tab',
    nodeId: peerNodeId,
    tabId: secretsTabId,
  })) as { ok: boolean; uid?: string; error?: string };
  expect(armed.ok, armed.error).toBe(true);
  armedUid = armed.uid ?? '';

  // Debug fidelity: the recorder's completion-time body pulls serve
  // only on a CDP-fed (or proxy) partition — pin and wait for attach.
  await invoke({
    type: 'oh.daemon.telemetry.debug.control',
    nodeId: peerNodeId,
    command: { kind: 'enable', enabled: true },
  });
  await invoke({
    type: 'oh.daemon.telemetry.debug.control',
    nodeId: peerNodeId,
    command: { kind: 'pin', tabId: secretsTabId, pinned: true },
  });
  await expect
    .poll(
      async () => {
        const { peers } = (await invoke({ type: 'oh.daemon.telemetry.tabs.list' })) as unknown as {
          peers?: Array<{ nodeId: string; debug: { attachedTabs: number[] } }>;
        };
        const peer = (peers ?? []).find((p) => p.nodeId === peerNodeId);
        return peer?.debug.attachedTabs.includes(secretsTabId) ?? false;
      },
      { timeout: 20000 },
    )
    .toBe(true);

  const started = (await invoke({
    type: 'oh.daemon.traffic.capture.start',
    uid: armedUid,
    name: 'secrets session',
  })) as { ok: boolean; error?: string; session?: CaptureSessionRow };
  expect(started.ok, started.error).toBe(true);
  recordedSessionId = started.session?.sessionId ?? '';

  await secretsPage.evaluate(
    async ({ jwt, apiKey, cookieValue }) => {
      await (
        window as unknown as {
          __ohFireSecrets(o: { jwt: string; apiKey: string; cookieValue: string }): Promise<number>;
        }
      ).__ohFireSecrets({ jwt, apiKey, cookieValue });
    },
    { jwt: JWT, apiKey: API_KEY, cookieValue: COOKIE },
  );

  await expect
    .poll(async () => (await captureSessions()).find((s) => s.sessionId === recordedSessionId)?.requests ?? 0, {
      timeout: 20000,
    })
    .toBeGreaterThanOrEqual(4);

  // Recording-window law (finding 29): let the event stream plateau
  // before stopping — the echoed bodies must be IN the sealed log.
  let lastEvents = -1;
  await expect
    .poll(
      async () => {
        const events = (await captureSessions()).find((s) => s.sessionId === recordedSessionId)?.events ?? 0;
        const stable = events > 0 && events === lastEvents;
        lastEvents = events;
        return stable;
      },
      { timeout: 30000, intervals: [1500] },
    )
    .toBe(true);
  await invoke({ type: 'oh.daemon.traffic.capture.stop', uid: armedUid });
  await expect
    .poll(async () => (await captureSessions()).find((s) => s.sessionId === recordedSessionId)?.state, {
      timeout: 20000,
    })
    .toBe('sealed');

  // The wire is gone: the tab closes and the source disarms. Every
  // read below answers from the sealed archive alone.
  await secretsPage.close();
  await invoke({ type: 'oh.daemon.traffic.disarm', uid: armedUid });
});

// ── traffic_sessions — the archive index over real /mcp ─────────────

test('traffic_sessions lists the sealed session with index facts only', async () => {
  await expect
    .poll(
      async () => {
        const { payload } = await callTool('traffic_sessions', {});
        const rows = (payload.sessions as SessionIndexRow[]) ?? [];
        const row = rows.find((r) => r.name.includes('127.0.0.1') || r.requests >= 4);
        if (row?.state === 'sealed') {
          archiveId = row.sessionId;
          return true;
        }
        return false;
      },
      { timeout: 15000 },
    )
    .toBe(true);

  const { payload } = await callTool('traffic_sessions', {});
  const row = (payload.sessions as SessionIndexRow[]).find((r) => r.sessionId === archiveId);
  expect(row).toMatchObject({ state: 'sealed', fidelity: 'cdp', encrypted: true });
  expect(row?.requests).toBeGreaterThanOrEqual(4);
  // Index facts only — and no secret anywhere on this surface.
  expect(JSON.stringify(payload)).not.toContain(JWT);
  expect(JSON.stringify(payload)).not.toContain(API_KEY);
});

// ── THE INVERTED PIN: raw at rest, markers in every tool read ───────

test('session reads project stable markers — the planted secrets appear nowhere', async () => {
  const list = await callTool('traffic_session_list', { sessionId: archiveId, urlContains: 'echo/secrets' });
  expect(list.isError).toBeFalsy();
  expect(list.payload.projection).toBe('redacted');
  expect(list.payload.fidelity).toBe('cdp');
  const rows = list.payload.rows as SessionToolRow[];
  expect(rows.length).toBeGreaterThanOrEqual(4);

  // The token-bearing query knob carries a marker, not the JWT.
  const tokenRow = rowByProbe(rows, 3);
  expect(tokenRow?.url).toMatch(MARKER);
  const urlMarker = tokenRow?.url.match(MARKER)?.[0];
  expect(urlMarker).toBeDefined();

  // The full exchange: header, URL and echoed body speak ONE marker
  // algebra — the same value yields the same marker across positions.
  const authedRow = rowByProbe(rows, 1);
  const got = await callTool('traffic_session_get', { sessionId: archiveId, requestId: authedRow?.requestId ?? '' });
  expect(got.isError).toBeFalsy();
  expect(got.payload.projection).toBe('redacted');
  const record = got.payload.record as SessionToolRow;
  const auth = record.requestHeaders?.find((h) => h.name.toLowerCase() === 'authorization');
  expect(auth?.value).toMatch(/^Bearer \[redacted:[0-9a-f]{8}\]$/);
  expect(auth?.value).toContain(urlMarker ?? 'marker-missing');

  // The archived body serves with the tab long gone — echoed JSON with
  // the authorization value redacted to the SAME marker.
  const body = got.payload.body as { content: string; encoding: string } | undefined;
  expect(body, got.payload.bodyUnavailable as string).toBeDefined();
  expect(body?.content).toContain('/echo/secrets');
  expect(body?.content).toContain(urlMarker ?? 'marker-missing');

  // The raw values appear NOWHERE in any redacted tool output.
  for (const everything of [JSON.stringify(list.payload), JSON.stringify(got.payload)]) {
    expect(everything).not.toContain(JWT);
    expect(everything).not.toContain(API_KEY);
    expect(everything).not.toContain(COOKIE);
  }
});

// ── The grant: live flip to raw, logged, revocable ──────────────────

test('the Settings grant flips projection to raw, logs the read, and revokes live', async () => {
  test.setTimeout(120000);
  const listRows = await callTool('traffic_session_list', { sessionId: archiveId, urlContains: 'n=1' });
  const requestId = (listRows.payload.rows as SessionToolRow[])[0]?.requestId ?? '';
  expect(requestId).not.toBe('');

  await setUserSetting('trafficMonitor.sessionAgentRawReads', true);
  await expect
    .poll(async () => {
      const { payload } = await callTool('traffic_session_get', { sessionId: archiveId, requestId });
      return payload.projection;
    })
    .toBe('raw');

  const raw = await callTool('traffic_session_get', { sessionId: archiveId, requestId });
  const auth = (raw.payload.record as SessionToolRow).requestHeaders?.find(
    (h) => h.name.toLowerCase() === 'authorization',
  );
  expect(auth?.value).toBe(`Bearer ${JWT}`);
  expect((raw.payload.body as { content: string }).content).toContain(JWT);

  // Every raw read is a flagged Activity Feed entry; redacted-era
  // reads never carry the flag.
  await expect
    .poll(async () => {
      const { payload } = await callTool('activity_list', { limit: 100 });
      const entries =
        (payload.entries as Array<{ kind: string; context?: { toolName?: string; raw?: boolean } }>) ?? [];
      const observed = entries.filter((e) => e.kind === 'agent-observe');
      const rawReads = observed.filter((e) => e.context?.raw === true);
      const redactedReads = observed.filter((e) => e.context?.toolName === 'traffic_sessions');
      return (
        rawReads.some((e) => e.context?.toolName === 'traffic_session_get') &&
        redactedReads.length > 0 &&
        redactedReads.every((e) => e.context?.raw === undefined)
      );
    })
    .toBe(true);

  // Revocation is live too: markers return on the next read.
  await setUserSetting('trafficMonitor.sessionAgentRawReads', false);
  await expect
    .poll(async () => {
      const { payload } = await callTool('traffic_session_get', { sessionId: archiveId, requestId });
      return payload.projection;
    })
    .toBe('redacted');
});
