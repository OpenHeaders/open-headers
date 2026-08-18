/**
 * Session tools (the agent-traffic plan §11.5, C7) over a fake session
 * query plane: the three-tool registration contract (observe tier +
 * mandatory workspace resolution — the visibility seam's precondition),
 * host-side filters + pagination over one session's rows, the archived
 * body vs honest `bodyUnavailable` split, the raw-projection reporting
 * seam (`ctx.markRawRead` fires exactly when the plane projected raw —
 * the tool never decides), and archive refusals surfaced as
 * agent-correctable guidance.
 */

import { setHostLogger } from '@openheaders/core/logger';
import { setHostStorage } from '@openheaders/core/storage';
import type { TrafficRecordProjection } from '@openheaders/core/traffic';
import { logger as consoleLogger } from '@openheaders/core/utils';
import { __initSyncServiceForTests, dispose as disposeSyncService } from '@openheaders/oracle/sync/service';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { McpToolCallContext, McpToolDefinition } from '../../src/mcp/registry';
import { createSessionToolDefinitions } from '../../src/mcp/tools/session-tools';
import type { TrafficSessionQuery, TrafficSessionRecordRead, TrafficSessionRowsRead } from '../../src/traffic';
import { createHostStorageFake } from './_host-storage-fake';

const WS = 'ws-session-tools';

beforeEach(() => {
  setHostLogger(consoleLogger);
  setHostStorage(createHostStorageFake());
  __initSyncServiceForTests(WS);
});

afterEach(() => {
  disposeSyncService();
});
const SESSION_ID = '2026-08-06T10-00-00-000Z-openheaders-io-cap-1';

function makeRow(overrides: Partial<TrafficRecordProjection> = {}): TrafficRecordProjection {
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
  makeRow({ requestId: 'ok-1', startedAtMs: 1_000 }),
  makeRow({ requestId: 'post-1', method: 'POST', url: 'https://api.openheaders.io/renew', startedAtMs: 1_100 }),
  makeRow({ requestId: 'missing', statusCode: 404, startedAtMs: 1_200 }),
  makeRow({
    requestId: 'net-fail',
    phase: 'failed',
    statusCode: undefined,
    completedAtMs: undefined,
    error: { code: 'net::ERR_FAILED', reason: 'CORS' },
    startedAtMs: 1_300,
  }),
];

interface FakeQueryControls {
  raw: boolean;
  listCalls: number;
}

function makeFakeQuery(): TrafficSessionQuery & FakeQueryControls {
  const plane: TrafficSessionQuery & FakeQueryControls = {
    raw: false,
    listCalls: 0,
    async list() {
      plane.listCalls++;
      return [
        {
          id: SESSION_ID,
          sessionId: 'cap-1',
          name: 'openheaders.io — 2026-08-06 12:00 (4 requests, 1 errors)',
          folder: 'openheaders.io',
          sourceKind: 'browser-tab',
          sourceLabel: 'tab 7 @ ext-node-1',
          state: 'sealed',
          startedAtMs: 900,
          stoppedAtMs: 2_000,
          endReason: 'stopped',
          requests: 4,
          errors: 1,
          events: 12,
          sizeBytes: 4_096,
          encrypted: true,
          fidelity: 'cdp',
          planes: ['lifecycle'],
          origins: ['https://api.openheaders.io'],
          partitionTabId: 7,
        },
      ];
    },
    async records(id): Promise<TrafficSessionRowsRead> {
      if (id !== SESSION_ID) throw new Error('unknown session');
      return { rows: ROWS, raw: plane.raw, fidelity: 'cdp', truncatedOldest: 0 };
    },
    async getRecord(id, requestId): Promise<TrafficSessionRecordRead | null> {
      if (id !== SESSION_ID) throw new Error('unknown session');
      const record = ROWS.find((row) => row.requestId === requestId);
      if (record === undefined) return null;
      const base = { record, raw: plane.raw, fidelity: 'cdp' as const };
      if (record.phase === 'failed') return { ...base, bodyGap: 'phase-failed' };
      if (record.requestId === 'ok-1') {
        return { ...base, body: { content: '{"users":[1]}', encoding: 'text', truncated: false } };
      }
      return { ...base, bodyGap: 'not-recorded' };
    },
  };
  return plane;
}

function makeTools(plane: TrafficSessionQuery): Map<string, McpToolDefinition> {
  return new Map(createSessionToolDefinitions({ sessions: plane }).map((t) => [t.name, t]));
}

function call(
  tools: Map<string, McpToolDefinition>,
  name: string,
  args: Record<string, unknown>,
  ctx?: Partial<McpToolCallContext>,
): Promise<Record<string, unknown>> {
  const tool = tools.get(name);
  if (!tool) throw new Error(`missing tool ${name}`);
  return tool.handler({ workspaceId: WS, ...args }, { tokenId: 'token-1', userId: 'user-1', ...ctx }) as Promise<
    Record<string, unknown>
  >;
}

describe('registration contract', () => {
  it('all three tools are observe-tier and resolve the workspace', () => {
    const tools = makeTools(makeFakeQuery());
    expect([...tools.keys()]).toEqual(['traffic_sessions', 'traffic_session_list', 'traffic_session_get']);
    for (const tool of tools.values()) {
      expect(tool.tier).toBe('observe');
      expect(tool.resolveWorkspaceId({ workspaceId: WS })).toBe(WS);
    }
  });
});

describe('traffic_sessions', () => {
  it('lists index rows with meta facts and honest pagination', async () => {
    const tools = makeTools(makeFakeQuery());
    const payload = await call(tools, 'traffic_sessions', {});
    expect(payload.total).toBe(1);
    expect(payload.hasMore).toBe(false);
    const rows = payload.sessions as Array<Record<string, unknown>>;
    expect(rows[0]).toMatchObject({
      sessionId: SESSION_ID,
      folder: 'openheaders.io',
      state: 'sealed',
      requests: 4,
      errors: 1,
      encrypted: true,
      fidelity: 'cdp',
    });
    // Index facts only — no record vocabulary on this surface.
    expect(JSON.stringify(rows)).not.toContain('requestId');
  });
});

describe('traffic_session_list', () => {
  it('filters and paginates host-side over the session fold', async () => {
    const tools = makeTools(makeFakeQuery());
    const all = await call(tools, 'traffic_session_list', { sessionId: SESSION_ID });
    expect(all).toMatchObject({ sessionId: SESSION_ID, fidelity: 'cdp', projection: 'redacted', total: 4, matched: 4 });
    expect((all.rows as Array<{ requestId: string }>).map((r) => r.requestId)).toEqual([
      'ok-1',
      'post-1',
      'missing',
      'net-fail',
    ]);
    // Lean rows — never headers, never bodies.
    expect(JSON.stringify(all.rows)).not.toContain('requestHeaders');

    const posts = await call(tools, 'traffic_session_list', { sessionId: SESSION_ID, method: 'post' });
    expect((posts.rows as Array<{ requestId: string }>).map((r) => r.requestId)).toEqual(['post-1']);
    const fourxx = await call(tools, 'traffic_session_list', { sessionId: SESSION_ID, statusClass: '4xx' });
    expect((fourxx.rows as Array<{ requestId: string }>).map((r) => r.requestId)).toEqual(['missing']);

    const page = await call(tools, 'traffic_session_list', { sessionId: SESSION_ID, limit: 3 });
    expect((page.rows as unknown[]).length).toBe(3);
    expect(page.hasMore).toBe(true);
  });

  it('reports raw projection and fires markRawRead only under the grant', async () => {
    const plane = makeFakeQuery();
    const tools = makeTools(plane);
    let marked = 0;
    const ctx = { markRawRead: () => marked++ };

    const redacted = await call(tools, 'traffic_session_list', { sessionId: SESSION_ID }, ctx);
    expect(redacted.projection).toBe('redacted');
    expect(marked).toBe(0);

    plane.raw = true;
    const raw = await call(tools, 'traffic_session_list', { sessionId: SESSION_ID }, ctx);
    expect(raw.projection).toBe('raw');
    expect(marked).toBe(1);
  });

  it('surfaces archive refusals as agent guidance', async () => {
    const tools = makeTools(makeFakeQuery());
    await expect(call(tools, 'traffic_session_list', { sessionId: 'ghost' })).rejects.toThrow(
      /unknown session.*traffic_sessions/,
    );
  });
});

describe('traffic_session_get', () => {
  it('serves the archived body, honest gaps, and unknown-request guidance', async () => {
    const plane = makeFakeQuery();
    const tools = makeTools(plane);

    const withBody = await call(tools, 'traffic_session_get', { sessionId: SESSION_ID, requestId: 'ok-1' });
    expect((withBody.body as { content: string }).content).toBe('{"users":[1]}');
    expect(withBody.bodyUnavailable).toBeUndefined();

    const failed = await call(tools, 'traffic_session_get', { sessionId: SESSION_ID, requestId: 'net-fail' });
    expect(failed.body).toBeUndefined();
    expect(failed.bodyUnavailable as string).toContain('failed before a response body existed');

    const bare = await call(tools, 'traffic_session_get', { sessionId: SESSION_ID, requestId: 'post-1' });
    expect(bare.bodyUnavailable as string).toContain('recorded no body');

    await expect(call(tools, 'traffic_session_get', { sessionId: SESSION_ID, requestId: 'ghost' })).rejects.toThrow(
      /traffic_session_list/,
    );
  });

  it('fires markRawRead on a raw single-exchange read', async () => {
    const plane = makeFakeQuery();
    plane.raw = true;
    const tools = makeTools(plane);
    let marked = 0;
    const payload = await call(
      tools,
      'traffic_session_get',
      { sessionId: SESSION_ID, requestId: 'ok-1' },
      { markRawRead: () => marked++ },
    );
    expect(payload.projection).toBe('raw');
    expect(marked).toBe(1);
  });
});
