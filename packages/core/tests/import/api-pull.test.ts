import { describe, expect, it } from 'vitest';
import {
  buildPullPlan,
  classifyPullFailure,
  collectionUrl,
  DEFAULT_RETRY_AFTER_SECONDS,
  environmentUrl,
  readCollectionPayload,
  readEnvironmentPayload,
  readRateBudget,
  readWorkspaceDetail,
  readWorkspaceList,
  workspaceDetailUrl,
  workspaceListUrl,
} from '../../src/import';

describe('api-pull endpoints', () => {
  it('builds the Data API URLs with encoded ids', () => {
    expect(workspaceListUrl()).toBe('https://api.postman.com/workspaces');
    expect(workspaceDetailUrl('ws 1')).toBe('https://api.postman.com/workspaces/ws%201');
    expect(collectionUrl('owner-123')).toBe('https://api.postman.com/collections/owner-123');
    expect(environmentUrl('env/1')).toBe('https://api.postman.com/environments/env%2F1');
  });
});

describe('readWorkspaceList', () => {
  it('reads workspaces and counts malformed entries', () => {
    const read = readWorkspaceList(
      JSON.stringify({
        workspaces: [
          { id: 'ws-1', name: 'Team APIs', type: 'team' },
          { id: 'ws-2', name: '' },
          { name: 'no id' },
          'garbage',
        ],
      }),
    );
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.workspaces).toEqual([
      { id: 'ws-1', name: 'Team APIs', type: 'team' },
      { id: 'ws-2', name: 'ws-2' },
    ]);
    expect(read.value.malformedEntries).toBe(2);
  });

  it('surfaces a reason for non-JSON and missing arrays', () => {
    expect(readWorkspaceList('nope')).toMatchObject({ ok: false, reason: expect.stringContaining('not valid JSON') });
    expect(readWorkspaceList('{"data":[]}')).toMatchObject({
      ok: false,
      reason: expect.stringContaining('`workspaces` array'),
    });
  });
});

describe('readWorkspaceDetail', () => {
  it('prefers the uid form and tolerates missing sections', () => {
    const read = readWorkspaceDetail(
      'ws-1',
      JSON.stringify({
        workspace: {
          id: 'ws-1',
          collections: [{ id: 'c1', uid: 'owner-c1', name: 'Orders API' }, { name: 'no id' }],
        },
      }),
    );
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value).toEqual({
      workspaceId: 'ws-1',
      collections: [{ id: 'owner-c1', name: 'Orders API' }],
      environments: [],
      specs: [],
      malformedRefs: 1,
    });
  });

  it('reads the specs section without gating pulls on it', () => {
    const read = readWorkspaceDetail(
      'ws-1',
      JSON.stringify({
        workspace: {
          id: 'ws-1',
          collections: [{ id: 'c1', name: 'Orders API' }],
          specs: [{ id: 's1', name: 'Orders OpenAPI' }, { name: 'no id spec' }],
        },
      }),
    );
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.specs).toEqual([
      { id: 's1', name: 'Orders OpenAPI' },
      { id: '(unknown)', name: 'no id spec' },
    ]);
    expect(read.value.malformedRefs).toBe(0);
  });

  it('surfaces a reason when the workspace object is missing', () => {
    expect(readWorkspaceDetail('ws-1', '{}')).toMatchObject({
      ok: false,
      reason: expect.stringContaining('`workspace` object'),
    });
  });
});

describe('payload unwrapping', () => {
  it('unwraps a collection envelope into v2.1 JSON with the info name', () => {
    const inner = {
      info: { name: 'Orders API', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
      item: [],
    };
    const read = readCollectionPayload(JSON.stringify({ collection: inner }));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.name).toBe('Orders API');
    expect(JSON.parse(read.value.json)).toEqual(inner);
  });

  it('unwraps an environment envelope with its top-level name', () => {
    const inner = { id: 'env-1', name: 'Staging', values: [{ key: 'host', value: 'api.openheaders.io' }] };
    const read = readEnvironmentPayload(JSON.stringify({ environment: inner }));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.value.name).toBe('Staging');
    expect(JSON.parse(read.value.json)).toEqual(inner);
  });

  it('surfaces a reason when the wrapper key is absent', () => {
    expect(readCollectionPayload('{"environment":{}}')).toMatchObject({
      ok: false,
      reason: expect.stringContaining('`collection` object'),
    });
    expect(readEnvironmentPayload('not json')).toMatchObject({
      ok: false,
      reason: expect.stringContaining('not valid JSON'),
    });
  });
});

describe('buildPullPlan', () => {
  it('dedupes shared items across workspaces and totals the call cost', () => {
    const workspaces = [
      { id: 'ws-1', name: 'One' },
      { id: 'ws-2', name: 'Two' },
    ];
    const plan = buildPullPlan(workspaces, [
      {
        workspaceId: 'ws-1',
        collections: [{ id: 'c1', name: 'Shared' }],
        environments: [{ id: 'e1', name: 'Staging' }],
        specs: [],
        malformedRefs: 0,
      },
      { workspaceId: 'ws-2', collections: [{ id: 'c1' }], environments: [], specs: [], malformedRefs: 0 },
    ]);
    expect(plan.items).toEqual([
      { item: 'collection', id: 'c1', name: 'Shared', workspaceIds: ['ws-1', 'ws-2'] },
      { item: 'environment', id: 'e1', name: 'Staging', workspaceIds: ['ws-1'] },
    ]);
    // 1 list + 2 workspace details + 1 collection + 1 environment.
    expect(plan.totalCalls).toBe(5);
  });
});

describe('readRateBudget', () => {
  it('reads the month budget and RetryAfter headers', () => {
    const headers: Record<string, string> = {
      'RateLimit-Limit-Month': '10000',
      'RateLimit-Remaining-Month': '9876',
      RetryAfter: '17',
    };
    expect(readRateBudget((name) => headers[name] ?? null)).toEqual({
      limitMonth: 10000,
      remainingMonth: 9876,
      retryAfterSeconds: 17,
    });
  });

  it('falls back to the standard Retry-After spelling and ignores junk', () => {
    const headers: Record<string, string> = { 'Retry-After': '3', 'RateLimit-Remaining-Month': 'soon' };
    expect(readRateBudget((name) => headers[name] ?? null)).toEqual({ retryAfterSeconds: 3 });
  });
});

describe('classifyPullFailure', () => {
  it('treats 401/403 as terminal unauthorized without echoing anything sensitive', () => {
    const failure = classifyPullFailure(401, '{"error":{"name":"AuthenticationError"}}', {});
    expect(failure.kind).toBe('unauthorized');
    expect(failure.reason).toContain('rejected the key');
  });

  it('treats a plain 429 as transient with the RetryAfter pause', () => {
    const failure = classifyPullFailure(429, '{"error":{"name":"rateLimited","message":"Rate limit exceeded"}}', {
      retryAfterSeconds: 7,
    });
    expect(failure).toMatchObject({ kind: 'rate-limited', retryAfterSeconds: 7 });
  });

  it('defaults the pause when no RetryAfter header arrived', () => {
    const failure = classifyPullFailure(429, '', {});
    expect(failure).toMatchObject({ kind: 'rate-limited', retryAfterSeconds: DEFAULT_RETRY_AFTER_SECONDS });
  });

  it('treats a service-limit body as terminal', () => {
    const failure = classifyPullFailure(
      429,
      '{"error":{"name":"serviceLimitExhausted","message":"Service limit exhausted."}}',
      { retryAfterSeconds: 5 },
    );
    expect(failure.kind).toBe('service-limit-exhausted');
    expect(failure.reason).toContain('monthly');
  });

  it('treats a drained monthly budget as terminal even without the body marker', () => {
    const failure = classifyPullFailure(429, '', { remainingMonth: 0 });
    expect(failure.kind).toBe('service-limit-exhausted');
  });

  it('classifies other statuses as item-level http errors with the body message', () => {
    const failure = classifyPullFailure(404, '{"error":{"name":"instanceNotFoundError","message":"Not found"}}', {});
    expect(failure).toMatchObject({ kind: 'http-error', status: 404 });
    expect(failure.reason).toContain('Not found');
  });
});
