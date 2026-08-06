/**
 * Traffic tools (AGENT_TRAFFIC_PLAN.md §5, slices S3–S6) over a fake
 * tap: host-side filters + pagination (the "host computes, agent
 * queries" law), failure classification with attached bodies and honest
 * `bodyUnavailable` reasons, unknown-source/unknown-request errors that
 * read as agent guidance, the mandatory workspace resolution the
 * observe-visibility seam depends on (STATUS finding 13), and the S6
 * `traffic_to_rule` mint: publish-by-default with the redaction-forced
 * draft (publishing a marker-bearing field would serve the literal
 * markers), CORS copy/synthesis, body-decay honesty, redacted-field
 * honesty, and the dual-switch observe guard. The mint rides the REAL
 * sync service (in-memory), like the write-tools suite.
 */

import { setHostLogger } from '@openheaders/core/logger';
import { setHostStorage } from '@openheaders/core/storage';
import type { TrafficRecordProjection } from '@openheaders/core/traffic';
import type { ResponseRule } from '@openheaders/core/types';
import { logger as consoleLogger } from '@openheaders/core/utils';
import {
  __initSyncServiceForTests,
  dispose as disposeSyncService,
  snapshotRulePostStates,
} from '@openheaders/oracle/sync/service';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { McpToolDefinition } from '../../src/mcp/registry';
import {
  createTrafficToolDefinitions,
  TRAFFIC_WAIT_TIMEOUT_DEFAULT_MS,
  TRAFFIC_WAIT_TIMEOUT_MAX_MS,
} from '../../src/mcp/tools/traffic-tools';
import type {
  TrafficBodyPullResult,
  TrafficRecordsOptions,
  TrafficSourceStatus,
  TrafficTap,
  TrafficWaitOptions,
  TrafficWaitResult,
} from '../../src/traffic';
import { createHostStorageFake } from './_host-storage-fake';

const WS = 'ws-traffic-tools';
const CTX = { tokenId: 'token-1', userId: 'user-1' };
const UID = 'browser-tab:ext-node-1:7';
const UID_A = 'browser-tab:ext-node-1:8';
const UID_B = 'browser-tab:ext-node-1:9';
const UID_W = 'browser-tab:ext-node-1:10';
const UID_G = 'browser-tab:ext-node-1:11';
const UID_M = 'browser-tab:ext-node-1:12';

function makeProjection(overrides: Partial<TrafficRecordProjection> = {}): TrafficRecordProjection {
  return {
    tabId: 7,
    requestId: 'req-1',
    url: 'https://api.openheaders.io/users',
    method: 'GET',
    resourceType: 'fetch',
    phase: 'completed',
    statusCode: 200,
    startedAtMs: 1_000,
    completedAtMs: 1_050,
    redirectHopCount: 0,
    provenance: 'cdp',
    ...overrides,
  };
}

const ROWS: TrafficRecordProjection[] = [
  makeProjection({ requestId: 'ok-1', startedAtMs: 1_000 }),
  makeProjection({ requestId: 'ok-2', method: 'POST', url: 'https://api.openheaders.io/renew', startedAtMs: 1_100 }),
  makeProjection({
    requestId: 'missing',
    statusCode: 404,
    statusText: 'Not Found',
    url: 'https://api.openheaders.io/ghost',
    startedAtMs: 1_200,
    responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
    failureBody: { content: '{"error":"not found"}', encoding: 'text', truncated: false },
  }),
  makeProjection({
    requestId: 'broken',
    statusCode: 503,
    statusText: 'Service Unavailable',
    startedAtMs: 1_300,
    resourceType: 'xhr',
  }),
  makeProjection({
    requestId: 'cors',
    phase: 'failed',
    statusCode: undefined,
    completedAtMs: undefined,
    error: { code: 'net::ERR_FAILED', reason: 'CORS' },
    startedAtMs: 1_400,
  }),
];

/** Side B for the diff suites — the origin-session shape against ROWS'
 *  UID: divergent status on identical headers, a changed credential
 *  marker, a header present on one side, and a request-set remainder. */
const HEADERS_SHARED = [
  { name: 'X-OH-Client', value: 'two-sessions' },
  { name: 'Authorization', value: 'Bearer [redacted:aaaa1111]' },
];

const DIFF_ROWS_A: TrafficRecordProjection[] = [
  makeProjection({
    requestId: 'a-login',
    url: 'https://api.openheaders.io/login?tag=w1',
    statusCode: 200,
    startedAtMs: 1_000,
    requestHeaders: HEADERS_SHARED,
    responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
  }),
  makeProjection({
    requestId: 'a-token',
    url: 'https://api.openheaders.io/token',
    statusCode: 200,
    startedAtMs: 1_100,
    requestHeaders: [{ name: 'Authorization', value: 'Bearer [redacted:aaaa1111]' }],
  }),
  makeProjection({
    requestId: 'a-flag',
    url: 'https://api.openheaders.io/flag',
    statusCode: 200,
    startedAtMs: 1_200,
    requestHeaders: [
      { name: 'X-OH-Client', value: 'two-sessions' },
      { name: 'X-OH-Feature-Flag', value: 'enabled' },
    ],
  }),
  makeProjection({ requestId: 'a-extra', url: 'https://api.openheaders.io/extra', startedAtMs: 1_300 }),
];

const DIFF_ROWS_B: TrafficRecordProjection[] = [
  makeProjection({
    requestId: 'b-login',
    url: 'https://api.openheaders.io/login?tag=w2',
    statusCode: 503,
    statusText: 'Service Unavailable',
    startedAtMs: 2_000,
    requestHeaders: HEADERS_SHARED,
    responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
  }),
  makeProjection({
    requestId: 'b-token',
    url: 'https://api.openheaders.io/token',
    statusCode: 200,
    startedAtMs: 2_100,
    requestHeaders: [{ name: 'Authorization', value: 'Bearer [redacted:bbbb2222]' }],
  }),
  makeProjection({
    requestId: 'b-flag',
    url: 'https://api.openheaders.io/flag',
    statusCode: 200,
    startedAtMs: 2_200,
    requestHeaders: [{ name: 'X-OH-Client', value: 'two-sessions' }],
  }),
  makeProjection({ requestId: 'b-only', url: 'https://api.openheaders.io/only-b', startedAtMs: 2_300 }),
];

/** One source across two time windows: the only change is a header
 *  value — the same-uid window-diff leg. */
const WINDOW_ROWS: TrafficRecordProjection[] = [
  makeProjection({
    requestId: 'w1-health',
    url: 'https://api.openheaders.io/health?tag=w1',
    startedAtMs: 1_000,
    requestHeaders: [{ name: 'X-OH-Phase', value: 'one' }],
  }),
  makeProjection({
    requestId: 'w2-health',
    url: 'https://api.openheaders.io/health?tag=w2',
    startedAtMs: 2_000,
    requestHeaders: [{ name: 'X-OH-Phase', value: 'two' }],
  }),
];

/** The graph suites' window: an initiator tree (page → script → dep →
 *  api call, page → img), two redirect chains, and failure clusters on
 *  one folded endpoint plus one network-error path. */
const PAGE_URL = 'https://app.openheaders.io/dashboard';
const SCRIPT_URL = 'https://app.openheaders.io/assets/app.js';
const DEP_URL = 'https://app.openheaders.io/assets/dep.js';

const GRAPH_ROWS: TrafficRecordProjection[] = [
  makeProjection({
    requestId: 'page',
    url: PAGE_URL,
    resourceType: 'document',
    startedAtMs: 1_000,
    completedAtMs: 1_040,
  }),
  makeProjection({
    requestId: 'redir',
    url: 'https://app.openheaders.io/welcome',
    startedAtMs: 1_010,
    completedAtMs: 1_030,
    redirectHopCount: 2,
    redirectTrail: [
      { url: 'https://app.openheaders.io/login', statusCode: 302 },
      { url: 'https://app.openheaders.io/auth', statusCode: 301 },
    ],
  }),
  makeProjection({
    requestId: 'redir-bare',
    url: 'https://app.openheaders.io/landed',
    startedAtMs: 1_020,
    completedAtMs: 1_035,
    redirectHopCount: 1,
  }),
  makeProjection({
    requestId: 'script',
    url: SCRIPT_URL,
    resourceType: 'script',
    initiator: PAGE_URL,
    startedAtMs: 1_050,
    completedAtMs: 1_080,
  }),
  makeProjection({
    requestId: 'img',
    url: 'https://app.openheaders.io/assets/logo.png',
    resourceType: 'image',
    initiator: PAGE_URL,
    startedAtMs: 1_060,
    completedAtMs: 1_070,
  }),
  makeProjection({
    requestId: 'dep',
    url: DEP_URL,
    resourceType: 'script',
    initiator: SCRIPT_URL,
    startedAtMs: 1_090,
    completedAtMs: 1_120,
  }),
  makeProjection({
    requestId: 'api-1',
    url: 'https://api.openheaders.io/api/users/123',
    initiator: DEP_URL,
    startedAtMs: 1_130,
    completedAtMs: 1_500,
  }),
  makeProjection({
    requestId: 'f1',
    url: 'https://api.openheaders.io/api/users/124',
    statusCode: 500,
    startedAtMs: 1_200,
  }),
  makeProjection({
    requestId: 'f2',
    url: 'https://api.openheaders.io/api/users/125',
    statusCode: 503,
    startedAtMs: 1_300,
  }),
  makeProjection({
    requestId: 'f3',
    url: 'https://api.openheaders.io/api/users/126',
    statusCode: 500,
    startedAtMs: 1_400,
  }),
  makeProjection({
    requestId: 'f4',
    url: 'https://api.openheaders.io/api/stream',
    phase: 'failed',
    statusCode: undefined,
    completedAtMs: undefined,
    error: { code: 'net::ERR_FAILED', reason: 'CORS' },
    startedAtMs: 1_450,
  }),
];

/** The S6 mint window: a failure with a retained (marker-bearing) body
 *  and observed CORS, a cross-origin success with NO CORS observed, a
 *  success whose body decayed, and a binary-body failure. */
const MINT_ROWS: TrafficRecordProjection[] = [
  makeProjection({
    requestId: 'm-fail',
    url: 'https://api.openheaders.io/net/gate/mock?status=503',
    statusCode: 503,
    statusText: 'Service Unavailable',
    startedAtMs: 1_000,
    initiator: 'https://app.openheaders.io/dashboard',
    responseHeaders: [
      { name: 'Content-Type', value: 'application/json' },
      { name: 'Access-Control-Allow-Origin', value: '*' },
    ],
    failureBody: { content: '{"status":503,"token":"[redacted:cafe1234]"}', encoding: 'text', truncated: false },
  }),
  makeProjection({
    requestId: 'm-cross',
    url: 'https://api.openheaders.io/plain',
    statusCode: 200,
    startedAtMs: 1_100,
    initiator: 'https://app.openheaders.io/dashboard',
    responseHeaders: [{ name: 'Content-Type', value: 'text/plain' }],
  }),
  makeProjection({
    requestId: 'm-nobody',
    url: 'https://api.openheaders.io/decayed',
    statusCode: 200,
    startedAtMs: 1_200,
    mimeType: 'application/json',
  }),
  makeProjection({
    requestId: 'm-binary',
    url: 'https://api.openheaders.io/image',
    statusCode: 500,
    startedAtMs: 1_300,
    failureBody: { content: 'iVBORw0KGgoAAAANSUhEUg==', encoding: 'base64', truncated: false },
  }),
];

interface FakeTapControls {
  pullCalls: string[];
  waitCalls: Array<{ timeoutMs: number }>;
  /** Forced miss for waits whose predicate finds nothing retained;
   *  `null` mimics a source vanishing between gate and wait. */
  waitMiss: TrafficWaitResult | null;
  /** Source uids reporting an ACTIVE capture session (S7) — drives the
   *  `capturing` marker on traffic_sources rows. */
  capturing: Set<string>;
}

function makeFakeTap(): TrafficTap & FakeTapControls {
  const pullCalls: string[] = [];
  const waitCalls: Array<{ timeoutMs: number }> = [];
  const capturing = new Set<string>();
  const captureProjection = (uid: string) => ({
    sessionId: 'cap-1',
    sourceUid: uid,
    name: 'fake session',
    dirPath: `/tmp/traffic-sessions/sessions/${uid}`,
    startedAtMs: 600,
    bounds: { maxBytes: 1_048_576, maxDurationMs: 3_600_000 },
    planes: ['lifecycle' as const],
    requests: 0,
    events: 0,
    bytesWritten: 128,
    encrypted: true,
    state: 'recording' as const,
  });
  const rowsByUid = new Map<string, TrafficRecordProjection[]>([
    [UID, ROWS],
    [UID_A, DIFF_ROWS_A],
    [UID_B, DIFF_ROWS_B],
    [UID_W, WINDOW_ROWS],
    [UID_G, GRAPH_ROWS],
    [UID_M, MINT_ROWS],
  ]);
  const sourceStatus = (uid: string, rows: TrafficRecordProjection[]): TrafficSourceStatus => ({
    uid,
    kind: 'browser-tab',
    label: `tab @ ${uid}`,
    nodeId: 'ext-node-1',
    tabId: 7,
    state: 'streaming',
    armedAtMs: 500,
    expiresAtMs: 999_999,
    pendingWaits: 0,
    ...(capturing.has(uid) ? { capture: captureProjection(uid) } : {}),
    stats: {
      recordCount: rows.length,
      byteSize: 4_096,
      maxRecords: 2_000,
      maxBytes: 8_388_608,
      evictedCount: 0,
      droppedPreArm: 0,
      droppedEvictedReplay: 0,
      readyEpochs: 1,
    },
  });
  const tap: TrafficTap & FakeTapControls = {
    pullCalls,
    waitCalls,
    waitMiss: { ok: false, reason: 'timeout' },
    capturing,
    armBrowserTab: () => UID,
    armProxy: () => 'proxy',
    disarm: () => true,
    // Capture control is the operator plane's, never a tool's — the
    // tool layer only ever READS capture state off status rows.
    captureStart: () => ({ ok: false, reason: 'capture-unavailable' }),
    captureStop: () => null,
    captureSessions: () => [...capturing].map(captureProjection),
    onStatusChanged: () => () => undefined,
    status: () => [...rowsByUid].map(([uid, rows]) => sourceStatus(uid, rows)),
    records: (uid: string, options?: TrafficRecordsOptions) => {
      const rows = rowsByUid.get(uid);
      if (rows === undefined) return null;
      if (options?.includeFailureBodies === true) return rows;
      return rows.map(({ failureBody: _body, ...rest }) => rest);
    },
    getRecord: (uid: string, requestId: string) =>
      rowsByUid.get(uid)?.find((row) => row.requestId === requestId) ?? null,
    pullBody: async (uid: string, requestId: string): Promise<TrafficBodyPullResult | null> => {
      if (uid !== UID && uid !== UID_M) return null;
      pullCalls.push(requestId);
      const row = rowsByUid.get(uid)?.find((r) => r.requestId === requestId);
      if (row === undefined) return { ok: false, reason: 'unknown-request' };
      if (row.failureBody !== undefined) return { ok: true, body: row.failureBody };
      if (row.phase === 'failed') return { ok: false, reason: 'no-response-body' };
      if (row.requestId === 'ok-1') {
        return { ok: true, body: { content: '{"users":[1]}', encoding: 'text', truncated: false } };
      }
      if (row.requestId === 'm-cross') {
        return { ok: true, body: { content: 'plain body text', encoding: 'text', truncated: false } };
      }
      return { ok: false, reason: 'gone' };
    },
    waitForRecord: async (
      uid: string,
      match: (record: TrafficRecordProjection) => boolean,
      options: TrafficWaitOptions,
    ): Promise<TrafficWaitResult | null> => {
      const rows = rowsByUid.get(uid);
      if (rows === undefined) return null;
      waitCalls.push({ timeoutMs: options.timeoutMs });
      const hit = rows.map(({ failureBody: _body, ...rest }) => rest).find(match);
      if (hit !== undefined) return { ok: true, record: hit };
      return tap.waitMiss;
    },
    escalate: () => false,
    dispose: () => {},
  };
  return tap;
}

let tap: ReturnType<typeof makeFakeTap>;
let tools: Map<string, McpToolDefinition>;
let observeEnabled: boolean;

function call(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const tool = tools.get(name);
  if (!tool) throw new Error(`missing tool ${name}`);
  // The seeded workspace rides explicitly — the arg-or-active default
  // itself is resolveWorkspaceIdArg's, pinned with the other tools.
  return tool.handler({ workspaceId: WS, ...args }, CTX) as Promise<Record<string, unknown>>;
}

beforeEach(() => {
  setHostLogger(consoleLogger);
  setHostStorage(createHostStorageFake());
  __initSyncServiceForTests(WS);
  tap = makeFakeTap();
  observeEnabled = true;
  tools = new Map(
    createTrafficToolDefinitions({ tap, isObserveEnabled: () => observeEnabled }).map((t) => [t.name, t]),
  );
});

afterEach(() => {
  disposeSyncService();
});

describe('registration contract', () => {
  it('read tools are observe-tier, the mint is write-tier, and every tool resolves the workspace', () => {
    expect([...tools.keys()]).toEqual([
      'traffic_sources',
      'traffic_list',
      'traffic_failures',
      'traffic_get',
      'traffic_diff',
      'traffic_graph',
      'traffic_wait',
      'traffic_to_rule',
    ]);
    for (const tool of tools.values()) {
      expect(tool.tier).toBe(tool.name === 'traffic_to_rule' ? 'write' : 'observe');
      expect(tool.resolveWorkspaceId({ workspaceId: WS })).toBe(WS);
    }
  });
});

describe('traffic_sources', () => {
  it('projects armed sources with stats and reports the workspace it lands in', async () => {
    const result = await call('traffic_sources', {});
    expect(result.workspaceId).toBe(WS);
    const sources = result.sources as Array<Record<string, unknown>>;
    expect(sources.map((s) => s.uid)).toEqual([UID, UID_A, UID_B, UID_W, UID_G, UID_M]);
    expect(sources[0]).toMatchObject({ uid: UID, kind: 'browser-tab', tabId: 7, state: 'streaming' });
    expect((sources[0]?.stats as Record<string, unknown>).recordCount).toBe(ROWS.length);
  });

  it('marks a capturing source with the honest boolean and nothing more (S7)', async () => {
    tap.capturing.add(UID);
    const result = await call('traffic_sources', {});
    const sources = result.sources as Array<Record<string, unknown>>;
    const capturingRow = sources.find((s) => s.uid === UID);
    const idleRow = sources.find((s) => s.uid === UID_A);
    expect(capturingRow?.capturing).toBe(true);
    expect(idleRow).not.toHaveProperty('capturing');
    // The marker is the WHOLE agent-visible surface: no session name,
    // path, bounds, or control ever rides a tool row.
    const serialized = JSON.stringify(sources);
    expect(serialized).not.toContain('filePath');
    expect(serialized).not.toContain('jsonl');
    expect(serialized).not.toContain('fake session');
  });
});

describe('traffic_list', () => {
  it('answers lean rows — no headers, no bodies', async () => {
    const result = await call('traffic_list', { uid: UID });
    const rows = result.rows as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(ROWS.length);
    expect(result.total).toBe(ROWS.length);
    expect(rows[0]).toMatchObject({ requestId: 'ok-1', method: 'GET', statusCode: 200, durationMs: 50 });
    const serialized = JSON.stringify(rows);
    expect(serialized).not.toContain('failureBody');
    expect(serialized).not.toContain('responseHeaders');
    expect(serialized).not.toContain('not found');
  });

  it('computes filters host-side: statusClass, method, urlContains, resourceType, sinceMs', async () => {
    const errors = await call('traffic_list', { uid: UID, statusClass: 'error' });
    expect((errors.rows as Array<{ requestId: string }>).map((r) => r.requestId)).toEqual(['cors']);
    const fourxx = await call('traffic_list', { uid: UID, statusClass: '4xx' });
    expect((fourxx.rows as Array<{ requestId: string }>).map((r) => r.requestId)).toEqual(['missing']);
    const post = await call('traffic_list', { uid: UID, method: 'post' });
    expect((post.rows as Array<{ requestId: string }>).map((r) => r.requestId)).toEqual(['ok-2']);
    const url = await call('traffic_list', { uid: UID, urlContains: '/renew' });
    expect((url.rows as Array<{ requestId: string }>).map((r) => r.requestId)).toEqual(['ok-2']);
    const xhr = await call('traffic_list', { uid: UID, resourceType: 'xhr' });
    expect((xhr.rows as Array<{ requestId: string }>).map((r) => r.requestId)).toEqual(['broken']);
    const since = await call('traffic_list', { uid: UID, sinceMs: 1_250 });
    expect((since.rows as Array<{ requestId: string }>).map((r) => r.requestId)).toEqual(['broken', 'cors']);
    expect(since.matched).toBe(2);
    expect(since.total).toBe(ROWS.length);
  });

  it('paginates with offset/limit and an honest hasMore', async () => {
    const page1 = await call('traffic_list', { uid: UID, limit: 2 });
    expect((page1.rows as unknown[]).length).toBe(2);
    expect(page1.hasMore).toBe(true);
    const page3 = await call('traffic_list', { uid: UID, limit: 2, offset: 4 });
    expect((page3.rows as Array<{ requestId: string }>).map((r) => r.requestId)).toEqual(['cors']);
    expect(page3.hasMore).toBe(false);
  });

  it('rejects an unknown statusClass with agent-readable guidance', async () => {
    await expect(call('traffic_list', { uid: UID, statusClass: '6xx' })).rejects.toThrow(/invalid statusClass/);
  });
});

describe('traffic_failures', () => {
  it('classifies failures and attaches captured bodies with honest gaps', async () => {
    const result = await call('traffic_failures', { uid: UID });
    expect(result.failures).toBe(3);
    const rows = result.rows as Array<Record<string, unknown>>;
    expect(rows.map((r) => [r.requestId, r.failureKind])).toEqual([
      ['missing', 'http-4xx'],
      ['broken', 'http-5xx'],
      ['cors', 'network-error'],
    ]);
    expect((rows[0]?.body as Record<string, unknown>).content).toBe('{"error":"not found"}');
    expect(rows[0]?.responseHeaders).toBeDefined();
    expect(rows[1]?.body).toBeUndefined();
    expect(rows[1]?.bodyUnavailable).toContain('traffic_get');
    expect(rows[2]?.bodyUnavailable).toContain('failed before a response body existed');
    expect((rows[2]?.error as Record<string, unknown>).code).toBe('net::ERR_FAILED');
  });
});

describe('traffic_get', () => {
  it('returns the full record with an on-demand body', async () => {
    const result = await call('traffic_get', { uid: UID, requestId: 'ok-1' });
    expect((result.record as Record<string, unknown>).requestId).toBe('ok-1');
    expect((result.body as Record<string, unknown>).content).toBe('{"users":[1]}');
    expect(tap.pullCalls).toEqual(['ok-1']);
  });

  it('keeps the body in ONE spot for retained failure bodies', async () => {
    const result = await call('traffic_get', { uid: UID, requestId: 'missing' });
    expect((result.body as Record<string, unknown>).content).toBe('{"error":"not found"}');
    expect(JSON.stringify(result.record)).not.toContain('failureBody');
  });

  it('reports decay and network-failure gaps honestly', async () => {
    const decayed = await call('traffic_get', { uid: UID, requestId: 'ok-2' });
    expect(decayed.body).toBeUndefined();
    expect(decayed.bodyUnavailable).toContain('decayed');
    const netError = await call('traffic_get', { uid: UID, requestId: 'cors' });
    expect(netError.bodyUnavailable).toContain('has no response body');
  });

  it('surfaces unknown requestIds as agent-correctable errors', async () => {
    await expect(call('traffic_get', { uid: UID, requestId: 'ghost' })).rejects.toThrow(/see traffic_list/);
  });
});

describe('traffic_diff', () => {
  it('computes the two-source structural delta — the origin-session shape', async () => {
    const result = await call('traffic_diff', { a: { uid: UID_A }, b: { uid: UID_B } });
    expect(result.workspaceId).toBe(WS);
    expect(result.comparedPairs).toBe(3);
    expect(result.divergentStatusPairs).toBe(1);
    // The NEGATIVE result, first-class: the divergent-status pair has
    // provably identical request headers (marker-equal).
    expect(result.identicalRequestHeaderPairs).toBe(1);
    const pairs = result.differingPairs as Array<Record<string, unknown>>;
    const byPath = (path: string) => pairs.find((p) => (p.path as string).endsWith(path));

    const login = byPath('/login');
    expect(login).toMatchObject({ statusDiverges: true });
    expect((login?.a as Record<string, unknown>).statusCode).toBe(200);
    expect((login?.b as Record<string, unknown>).statusCode).toBe(503);
    expect((login?.requestHeaders as Record<string, unknown>).identical).toBe(true);

    // A changed credential shows as a value change between two DISTINCT
    // markers — visible without any secret.
    const token = byPath('/token');
    const tokenDelta = token?.requestHeaders as { valueChanged: Array<{ name: string; a: string; b: string }> };
    expect(tokenDelta.valueChanged).toEqual([
      { name: 'authorization', a: 'Bearer [redacted:aaaa1111]', b: 'Bearer [redacted:bbbb2222]' },
    ]);

    // Presence delta + the request-set remainders.
    const flag = byPath('/flag');
    expect((flag?.requestHeaders as Record<string, unknown>).onlyInA).toEqual(['x-oh-feature-flag']);
    expect(result.onlyInA).toEqual([{ method: 'GET', path: 'https://api.openheaders.io/extra', count: 1 }]);
    expect(result.onlyInB).toEqual([{ method: 'GET', path: 'https://api.openheaders.io/only-b', count: 1 }]);
  });

  it('diffs two time windows of ONE source', async () => {
    const result = await call('traffic_diff', {
      a: { uid: UID_W, untilMs: 1_500 },
      b: { uid: UID_W, sinceMs: 1_500 },
    });
    expect((result.a as Record<string, unknown>).rows).toBe(1);
    expect((result.b as Record<string, unknown>).rows).toBe(1);
    expect(result.comparedPairs).toBe(1);
    const [pair] = result.differingPairs as Array<Record<string, unknown>>;
    expect((pair?.requestHeaders as { valueChanged: unknown[] }).valueChanged).toEqual([
      { name: 'x-oh-phase', a: 'one', b: 'two' },
    ]);
    expect(pair?.statusDiverges).toBe(false);
  });

  it('an all-identical diff answers with counts, never rows', async () => {
    const result = await call('traffic_diff', { a: { uid: UID_A }, b: { uid: UID_A } });
    expect(result.comparedPairs).toBe(4);
    expect(result.differingPairs).toEqual([]);
    expect((result.identicalPairs as unknown[]).length).toBe(4);
    expect(result.onlyInA).toEqual([]);
    expect(result.onlyInB).toEqual([]);
  });

  it('scopes both sides with urlContains and validates uids + shapes', async () => {
    const scoped = await call('traffic_diff', { a: { uid: UID_A }, b: { uid: UID_B }, urlContains: '/login' });
    expect(scoped.comparedPairs).toBe(1);
    expect(scoped.onlyInA).toEqual([]);
    await expect(call('traffic_diff', { a: { uid: 'nope' }, b: { uid: UID_B } })).rejects.toThrow(/traffic_sources/);
    await expect(call('traffic_diff', { a: 'not-an-object', b: { uid: UID_B } })).rejects.toThrow(/must be an object/);
    await expect(call('traffic_diff', { a: { uid: '' }, b: { uid: UID_B } })).rejects.toThrow(/a\.uid/);
  });
});

describe('traffic_graph', () => {
  it('resolves redirect chains — one node per requestId, hops with URLs and statuses', async () => {
    const result = await call('traffic_graph', { uid: UID_G });
    expect(result.workspaceId).toBe(WS);
    expect(result.totalRecords).toBe(GRAPH_ROWS.length);
    expect(result.redirectChainsTotal).toBe(2);
    const chains = result.redirectChains as Array<Record<string, unknown>>;
    expect(chains[0]).toMatchObject({
      requestId: 'redir',
      hopCount: 2,
      truncated: false,
      finalUrl: 'https://app.openheaders.io/welcome',
      finalStatusCode: 200,
    });
    expect(chains[0]?.hops).toEqual([
      { url: 'https://app.openheaders.io/login', statusCode: 302 },
      { url: 'https://app.openheaders.io/auth', statusCode: 301 },
    ]);
    // A record whose trail did not survive reports the gap honestly.
    expect(chains[1]).toMatchObject({ requestId: 'redir-bare', hopCount: 1, hops: [], truncated: true });
  });

  it('joins initiator chains root→leaf and reports deepest first', async () => {
    const result = await call('traffic_graph', { uid: UID_G });
    expect(result.initiatorChainsTotal).toBe(2);
    const chains = result.initiatorChains as Array<{ urls: string[]; requestIds: string[]; depth: number }>;
    expect(chains[0]?.requestIds).toEqual(['page', 'script', 'dep', 'api-1']);
    expect(chains[0]?.urls).toEqual([PAGE_URL, SCRIPT_URL, DEP_URL, 'https://api.openheaders.io/api/users/123']);
    expect(chains[0]?.depth).toBe(4);
    // Inner nodes never surface as chains of their own — the page→script
    // prefix lives inside the deep chain, not beside it.
    expect(chains[1]?.requestIds).toEqual(['page', 'img']);
  });

  it('walks the critical path back from the last completed exchange', async () => {
    const result = await call('traffic_graph', { uid: UID_G });
    const path = result.criticalPath as {
      chain: Array<{ requestId: string; durationMs?: number }>;
      windowStartedAtMs: number;
      windowEndedAtMs: number;
      windowSpanMs: number;
    };
    expect(path.chain.map((n) => n.requestId)).toEqual(['page', 'script', 'dep', 'api-1']);
    expect(path.chain[3]?.durationMs).toBe(370);
    expect(path.windowStartedAtMs).toBe(1_000);
    expect(path.windowEndedAtMs).toBe(1_500);
    expect(path.windowSpanMs).toBe(500);
  });

  it('clusters failures by folded endpoint and failure kind', async () => {
    const result = await call('traffic_graph', { uid: UID_G });
    expect(result.failureClustersTotal).toBe(2);
    const clusters = result.failureClusters as Array<Record<string, unknown>>;
    // Biggest first: three 5xx on one variable-id endpoint fold to ONE
    // cluster — the "one endpoint, not N problems" read.
    expect(clusters[0]).toMatchObject({
      failureKind: 'http-5xx',
      path: 'https://api.openheaders.io/api/users/*',
      count: 3,
      statusCodes: [500, 503],
      firstStartedAtMs: 1_200,
      lastStartedAtMs: 1_400,
    });
    expect(clusters[1]).toMatchObject({
      failureKind: 'network-error',
      path: 'https://api.openheaders.io/api/stream',
      count: 1,
      errorCodes: ['net::ERR_FAILED'],
    });
    // The 200 on the same folded endpoint is NOT in the cluster.
    expect((clusters[0]?.sampleRequestIds as string[]).includes('api-1')).toBe(false);
  });

  it('scopes by window and urlContains, and caps every list with honest totals', async () => {
    const scoped = await call('traffic_graph', { uid: UID_G, urlContains: '/api/users/' });
    expect(scoped.totalRecords).toBe(4);
    expect(scoped.redirectChainsTotal).toBe(0);
    const windowed = await call('traffic_graph', { uid: UID_G, sinceMs: 1_150, untilMs: 1_460 });
    expect(windowed.totalRecords).toBe(4);
    expect(windowed.failureClustersTotal).toBe(2);
    const capped = await call('traffic_graph', { uid: UID_G, limit: 1 });
    expect(capped.redirectChainsTotal).toBe(2);
    expect((capped.redirectChains as unknown[]).length).toBe(1);
    expect(capped.initiatorChainsTotal).toBe(2);
    expect((capped.initiatorChains as unknown[]).length).toBe(1);
    await expect(call('traffic_graph', { uid: 'nope' })).rejects.toThrow(/traffic_sources/);
  });
});

describe('traffic_wait', () => {
  it('resolves with the matching row through the traffic_list filter vocabulary', async () => {
    const result = await call('traffic_wait', { uid: UID, statusClass: '4xx' });
    expect(result.matched).toBe(true);
    expect((result.row as Record<string, unknown>).requestId).toBe('missing');
    expect(result.waitedMs).toBeDefined();
    // The row is the lean list shape — no headers, no bodies.
    expect(JSON.stringify(result.row)).not.toContain('failureBody');
    expect(tap.waitCalls).toEqual([{ timeoutMs: TRAFFIC_WAIT_TIMEOUT_DEFAULT_MS }]);
  });

  it('answers a timeout as a NORMAL result, with the timeout clamped to transport bounds', async () => {
    const result = await call('traffic_wait', { uid: UID, urlContains: 'never-match', timeoutMs: 999_999 });
    expect(result).toMatchObject({ matched: false, reason: 'timeout', timeoutMs: TRAFFIC_WAIT_TIMEOUT_MAX_MS });
    expect(tap.waitCalls).toEqual([{ timeoutMs: TRAFFIC_WAIT_TIMEOUT_MAX_MS }]);
    await call('traffic_wait', { uid: UID, urlContains: 'never-match', timeoutMs: 1 });
    expect(tap.waitCalls[1]?.timeoutMs).toBe(500);
  });

  it('reports a mid-wait disarm (or lapse) as source-disarmed, not a bare miss', async () => {
    tap.waitMiss = { ok: false, reason: 'source-disarmed' };
    const disarmed = await call('traffic_wait', { uid: UID, urlContains: 'never-match' });
    expect(disarmed).toMatchObject({ matched: false, reason: 'source-disarmed' });
    tap.waitMiss = null;
    const vanished = await call('traffic_wait', { uid: UID, urlContains: 'never-match' });
    expect(vanished).toMatchObject({ matched: false, reason: 'source-disarmed' });
  });

  it('validates the uid and the filter vocabulary before waiting', async () => {
    await expect(call('traffic_wait', { uid: 'nope' })).rejects.toThrow(/traffic_sources/);
    await expect(call('traffic_wait', { uid: UID, statusClass: '6xx' })).rejects.toThrow(/invalid statusClass/);
    expect(tap.waitCalls).toEqual([]);
  });
});

describe('traffic_to_rule', () => {
  it('mints and PUBLISHES a response override through the real write path, with overrides serving the fix', async () => {
    const result = await call('traffic_to_rule', {
      uid: UID_M,
      requestId: 'm-fail',
      statusCode: 200,
      body: '{"ok":true}',
    });
    expect(result.workspaceId).toBe(WS);
    expect(result.published).toBe(true);
    const rule = result.rule as ResponseRule;
    expect(rule.type).toBe('response');
    // Published by default: the write grant is the consent boundary
    // (rules_create publishes through the same gate), so a clean mint
    // is live on the re-fire with no further gesture.
    expect(rule.published).toBe(true);
    expect(rule.enabled).toBe(true);
    expect(rule.action.responseSource).toBe('mock');
    expect(rule.action.bodyType).toBe('static');
    expect(rule.action.statusCode).toBe(200);
    expect(rule.action.responseBody).toBe('{"ok":true}');
    expect(rule.action.contentType).toBe('application/json');
    // The condition is origin + path + `*` — the query (the status knob)
    // is deliberately excluded so the rule matches the re-fire, and the
    // trailing glob keeps the CDP Fetch urlPattern (full-URL glob)
    // matching query-bearing requests.
    expect(rule.conditions[0]?.type).toBe('url-filter');
    expect(rule.conditions[0]?.values).toEqual(['https://api.openheaders.io/net/gate/mock*']);
    expect(rule.conditions[0]?.uid).toBeTruthy();
    expect(rule.name).toBe('Override GET https://api.openheaders.io/net/gate/mock');
    // CORS rides the mint: the observed header is copied, none invented.
    expect(rule.action.responseHeaders).toEqual({ 'Access-Control-Allow-Origin': '*' });
    expect(result.cors).toEqual({ copied: ['Access-Control-Allow-Origin'], synthesized: [] });
    expect(result.body).toMatchObject({ source: 'argument', truncated: false });
    expect((result.observed as Record<string, unknown>).statusCode).toBe(503);
    // The mint landed through the canonical write path.
    const snapshot = snapshotRulePostStates(WS);
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0]?.rule.uid).toBe(rule.uid);
    expect(snapshot[0]?.rule.published).toBe(true);
  });

  it('defaults replay the observed exchange, carry the retained failure body, and honor redaction', async () => {
    const result = await call('traffic_to_rule', { uid: UID_M, requestId: 'm-fail' });
    const rule = result.rule as ResponseRule;
    expect(rule.action.statusCode).toBe(503);
    expect(rule.action.responseBody).toBe('{"status":503,"token":"[redacted:cafe1234]"}');
    expect(result.body).toMatchObject({ source: 'retained-failure', truncated: false });
    // Markers mint VERBATIM and the field is called out — never revealed.
    expect(result.redactedFields).toEqual(['action.responseBody']);
    // Redacted fields force a DRAFT whatever the default: publishing
    // would serve the literal markers to live traffic.
    expect(result.published).toBe(false);
    expect(rule.published).toBe(false);
    const notes = result.notes as string[];
    expect(notes.some((n) => n.includes('replays the observed 503'))).toBe(true);
    expect(notes.some((n) => n.includes('redactedFields'))).toBe(true);
    expect(notes.some((n) => n.includes('force a draft'))).toBe(true);
  });

  it('synthesizes the permissive CORS set for a cross-origin exchange observed without one — and says so', async () => {
    const result = await call('traffic_to_rule', { uid: UID_M, requestId: 'm-cross' });
    const rule = result.rule as ResponseRule;
    expect(rule.action.responseHeaders).toEqual({
      'Access-Control-Allow-Origin': 'https://app.openheaders.io',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': '*',
    });
    expect(result.cors).toEqual({
      copied: [],
      synthesized: ['Access-Control-Allow-Origin', 'Access-Control-Allow-Methods', 'Access-Control-Allow-Headers'],
    });
    expect((result.notes as string[]).some((n) => n.includes('permissive set was synthesized'))).toBe(true);
    // The success body arrived via the on-demand pull.
    expect(result.body).toMatchObject({ source: 'pulled' });
    expect(rule.action.responseBody).toBe('plain body text');
    expect(rule.action.contentType).toBe('text/plain');
  });

  it('a decayed body mints an empty draft with an honest note, never an error', async () => {
    const result = await call('traffic_to_rule', { uid: UID_M, requestId: 'm-nobody' });
    const rule = result.rule as ResponseRule;
    expect(rule.action.responseBody).toBe('');
    expect(result.body).toMatchObject({ source: 'empty' });
    expect((result.body as { note: string }).note).toContain('fill responseBody');
    expect(rule.action.contentType).toBe('application/json');
  });

  it('a binary body is not minted into the draft', async () => {
    const result = await call('traffic_to_rule', { uid: UID_M, requestId: 'm-binary' });
    expect((result.rule as ResponseRule).action.responseBody).toBe('');
    expect(result.body).toMatchObject({ source: 'empty' });
    expect((result.body as { note: string }).note).toContain('binary');
  });

  it('published: false mints an unpublished draft deliberately', async () => {
    const result = await call('traffic_to_rule', {
      uid: UID_M,
      requestId: 'm-fail',
      statusCode: 200,
      body: '{"ok":true}',
      published: false,
    });
    expect(result.published).toBe(false);
    const rule = result.rule as ResponseRule;
    expect(rule.published).toBe(false);
    expect(rule.enabled).toBe(true);
    const snapshot = snapshotRulePostStates(WS);
    expect(snapshot[0]?.rule.published).toBe(false);
  });

  it('refuses when the observe switch is off — no traffic side door through the write grant', async () => {
    observeEnabled = false;
    await expect(call('traffic_to_rule', { uid: UID_M, requestId: 'm-fail' })).rejects.toThrow(
      /Traffic observation enabled/,
    );
    expect(snapshotRulePostStates(WS)).toHaveLength(0);
  });

  it('surfaces unknown uids and requestIds as agent guidance', async () => {
    await expect(call('traffic_to_rule', { uid: 'nope', requestId: 'm-fail' })).rejects.toThrow(/traffic_sources/);
    await expect(call('traffic_to_rule', { uid: UID_M, requestId: 'ghost' })).rejects.toThrow(/see traffic_list/);
  });
});

describe('absence + guidance', () => {
  it('an unknown source uid reads as guidance toward traffic_sources', async () => {
    await expect(call('traffic_list', { uid: 'browser-tab:ext-node-1:99' })).rejects.toThrow(/traffic_sources/);
    await expect(call('traffic_failures', { uid: 'nope' })).rejects.toThrow(/unarmed or expired source is absent/);
  });
});
