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
import { createTrafficToolDefinitions } from '../../src/mcp/tools/traffic-tools';
import type { TrafficBodyPullResult, TrafficRecordsOptions, TrafficSourceStatus, TrafficTap } from '../../src/traffic';
import { createHostStorageFake } from './_host-storage-fake';

const WS = 'ws-traffic-tools';
const CTX = { tokenId: 'token-1', userId: 'user-1' };
const UID = 'browser-tab:ext-node-1:7';

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

function makeFakeTap(): TrafficTap & { pullCalls: string[] } {
  const pullCalls: string[] = [];
  return {
    pullCalls,
    armBrowserTab: () => UID,
    armProxy: () => 'proxy',
    disarm: () => true,
    status: () => [
      {
        uid: UID,
        kind: 'browser-tab',
        label: 'tab 7 @ ext-node-1',
        nodeId: 'ext-node-1',
        tabId: 7,
        state: 'streaming',
        armedAtMs: 500,
        expiresAtMs: 999_999,
        stats: {
          recordCount: ROWS.length,
          byteSize: 4_096,
          maxRecords: 2_000,
          maxBytes: 8_388_608,
          evictedCount: 0,
          droppedPreArm: 0,
          droppedEvictedReplay: 0,
          readyEpochs: 1,
        },
      } satisfies TrafficSourceStatus,
    ],
    records: (uid: string, options?: TrafficRecordsOptions) => {
      if (uid !== UID) return null;
      if (options?.includeFailureBodies === true) return ROWS;
      return ROWS.map(({ failureBody: _body, ...rest }) => rest);
    },
    getRecord: (uid: string, requestId: string) =>
      uid === UID ? (ROWS.find((row) => row.requestId === requestId) ?? null) : null,
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
    escalate: () => false,
    dispose: () => {},
  };
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
    expect([...tools.keys()]).toEqual(['traffic_sources', 'traffic_list', 'traffic_failures', 'traffic_get']);
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
    expect(sources).toHaveLength(1);
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

describe('absence + guidance', () => {
  it('an unknown source uid reads as guidance toward traffic_sources', async () => {
    await expect(call('traffic_list', { uid: 'browser-tab:ext-node-1:99' })).rejects.toThrow(/traffic_sources/);
    await expect(call('traffic_failures', { uid: 'nope' })).rejects.toThrow(/unarmed or expired source is absent/);
  });
});
