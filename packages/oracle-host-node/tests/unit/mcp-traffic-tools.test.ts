/**
 * Observe-tier traffic tools (AGENT_TRAFFIC_PLAN.md §5, slice S3) over
 * a fake tap: host-side filters + pagination (the "host computes, agent
 * queries" law), failure classification with attached bodies and honest
 * `bodyUnavailable` reasons, unknown-source/unknown-request errors that
 * read as agent guidance, and the mandatory workspace resolution the
 * observe-visibility seam depends on (STATUS finding 13).
 */

import { setHostLogger } from '@openheaders/core/logger';
import { setHostStorage } from '@openheaders/core/storage';
import type { TrafficRecordProjection } from '@openheaders/core/traffic';
import { logger as consoleLogger } from '@openheaders/core/utils';
import { __initSyncServiceForTests, dispose as disposeSyncService } from '@openheaders/oracle/sync/service';
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

interface FakeTapControls {
  pullCalls: string[];
  waitCalls: Array<{ timeoutMs: number }>;
  /** Forced miss for waits whose predicate finds nothing retained;
   *  `null` mimics a source vanishing between gate and wait. */
  waitMiss: TrafficWaitResult | null;
}

function makeFakeTap(): TrafficTap & FakeTapControls {
  const pullCalls: string[] = [];
  const waitCalls: Array<{ timeoutMs: number }> = [];
  const rowsByUid = new Map<string, TrafficRecordProjection[]>([
    [UID, ROWS],
    [UID_A, DIFF_ROWS_A],
    [UID_B, DIFF_ROWS_B],
    [UID_W, WINDOW_ROWS],
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
    armBrowserTab: () => UID,
    armProxy: () => 'proxy',
    disarm: () => true,
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
      if (uid !== UID) return null;
      pullCalls.push(requestId);
      const row = ROWS.find((r) => r.requestId === requestId);
      if (row === undefined) return { ok: false, reason: 'unknown-request' };
      if (row.failureBody !== undefined) return { ok: true, body: row.failureBody };
      if (row.phase === 'failed') return { ok: false, reason: 'no-response-body' };
      if (row.requestId === 'ok-1') {
        return { ok: true, body: { content: '{"users":[1]}', encoding: 'text', truncated: false } };
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
  tools = new Map(createTrafficToolDefinitions({ tap }).map((t) => [t.name, t]));
});

afterEach(() => {
  disposeSyncService();
});

describe('registration contract', () => {
  it('every tool is observe-tier and resolves the active workspace for the visibility seam', () => {
    expect([...tools.keys()]).toEqual([
      'traffic_sources',
      'traffic_list',
      'traffic_failures',
      'traffic_get',
      'traffic_diff',
      'traffic_wait',
    ]);
    for (const tool of tools.values()) {
      expect(tool.tier).toBe('observe');
      expect(tool.resolveWorkspaceId({ workspaceId: WS })).toBe(WS);
    }
  });
});

describe('traffic_sources', () => {
  it('projects armed sources with stats and reports the workspace it lands in', async () => {
    const result = await call('traffic_sources', {});
    expect(result.workspaceId).toBe(WS);
    const sources = result.sources as Array<Record<string, unknown>>;
    expect(sources.map((s) => s.uid)).toEqual([UID, UID_A, UID_B, UID_W]);
    expect(sources[0]).toMatchObject({ uid: UID, kind: 'browser-tab', tabId: 7, state: 'streaming' });
    expect((sources[0]?.stats as Record<string, unknown>).recordCount).toBe(ROWS.length);
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
    expect(netError.bodyUnavailable).toContain('failed before a response body existed');
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

describe('absence + guidance', () => {
  it('an unknown source uid reads as guidance toward traffic_sources', async () => {
    await expect(call('traffic_list', { uid: 'browser-tab:ext-node-1:99' })).rejects.toThrow(/traffic_sources/);
    await expect(call('traffic_failures', { uid: 'nope' })).rejects.toThrow(/unarmed or expired source is absent/);
  });
});
