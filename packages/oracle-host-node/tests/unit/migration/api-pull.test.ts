/**
 * Data API puller — orchestration over an injected fetch + sleep. Core
 * owns interpretation and classification (covered in core tests); here
 * we prove pacing, 429 pause/resume, terminal stops with labeled
 * partial results, per-item skips, and that the key never leaks into
 * events or results.
 */

import type { PostmanPullEvent } from '@openheaders/core/import';
import { describe, expect, it } from 'vitest';
import {
  listPostmanWorkspaces,
  type PullFetchFn,
  type PullHttpResponse,
  pullPostmanData,
} from '../../../src/migration/api-pull';

const API_KEY = 'PMAK-secret-key-openheaders-test';

function response(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}): PullHttpResponse {
  const status = init.status ?? 200;
  const headers = init.headers ?? {};
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[name] ?? null },
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

interface Route {
  url: string;
  respond: () => PullHttpResponse;
}

/** Serve each URL from an ordered queue of responses; record every call. */
function fetchStub(routes: Route[]): { fetchFn: PullFetchFn; calls: Array<{ url: string; key: string | undefined }> } {
  const queues = new Map<string, Array<() => PullHttpResponse>>();
  for (const route of routes) {
    const queue = queues.get(route.url) ?? [];
    queue.push(route.respond);
    queues.set(route.url, queue);
  }
  const calls: Array<{ url: string; key: string | undefined }> = [];
  const fetchFn: PullFetchFn = (url, init) => {
    calls.push({ url, key: init.headers['X-Api-Key'] });
    const queue = queues.get(url);
    const next = queue?.shift();
    if (next === undefined) throw new Error(`Unexpected call: ${url}`);
    return Promise.resolve(next());
  };
  return { fetchFn, calls };
}

const workspaceList = { workspaces: [{ id: 'ws-1', name: 'Team', type: 'team' }] };
const workspaceDetail = {
  workspace: {
    id: 'ws-1',
    collections: [{ id: 'c1', uid: 'owner-c1', name: 'Orders API' }],
    environments: [{ id: 'e1', uid: 'owner-e1', name: 'Staging' }],
  },
};
const collectionBody = { collection: { info: { name: 'Orders API' }, item: [] } };
const environmentBody = { environment: { id: 'owner-e1', name: 'Staging', values: [] } };
const globalsBody = {
  values: [{ key: 'api_host', value: 'api.openheaders.io', type: 'default', enabled: true }],
};

const LIST_URL = 'https://api.postman.com/workspaces';
const DETAIL_URL = 'https://api.postman.com/workspaces/ws-1';
const GLOBALS_URL = 'https://api.postman.com/workspaces/ws-1/global-variables';
const COLLECTION_URL = 'https://api.postman.com/collections/owner-c1';
const ENVIRONMENT_URL = 'https://api.postman.com/environments/owner-e1';

function happyRoutes(): Route[] {
  return [
    { url: LIST_URL, respond: () => response(workspaceList) },
    { url: DETAIL_URL, respond: () => response(workspaceDetail) },
    { url: GLOBALS_URL, respond: () => response(globalsBody) },
    { url: COLLECTION_URL, respond: () => response(collectionBody) },
    { url: ENVIRONMENT_URL, respond: () => response(environmentBody) },
  ];
}

describe('pullPostmanData', () => {
  it('enumerates then pulls every planned item, paced per bucket', async () => {
    const { fetchFn, calls } = fetchStub(happyRoutes());
    const sleeps: number[] = [];
    const events: PostmanPullEvent[] = [];

    const result = await pullPostmanData({
      apiKey: API_KEY,
      fetchFn,
      sleep: (ms) => {
        sleeps.push(ms);
        return Promise.resolve();
      },
      onEvent: (event) => events.push(event),
    });

    expect(result.outcome).toBe('complete');
    expect(result.callsMade).toBe(5);
    expect(result.workspaces).toEqual([{ id: 'ws-1', name: 'Team', type: 'team' }]);
    expect(result.collections).toHaveLength(1);
    expect(result.collections[0]).toMatchObject({ item: 'collection', id: 'owner-c1', name: 'Orders API' });
    expect(JSON.parse(result.collections[0]?.json ?? '{}')).toEqual(collectionBody.collection);
    expect(result.environments).toHaveLength(1);
    expect(result.environments[0]).toMatchObject({ item: 'environment', id: 'owner-e1', name: 'Staging' });
    expect(result.globals).toEqual([
      {
        workspaceId: 'ws-1',
        variables: [{ name: 'api_host', value: 'api.openheaders.io', type: 'default' }],
      },
    ]);
    expect(result.skipped).toEqual([]);
    // Enumeration-bucket pauses before the detail and globals calls, one item pause per item.
    expect(sleeps).toEqual([1000, 1000, 200, 200]);
    expect(calls.map((call) => call.url)).toEqual([LIST_URL, DETAIL_URL, GLOBALS_URL, COLLECTION_URL, ENVIRONMENT_URL]);
    expect(events.find((event) => event.kind === 'planned')).toEqual({
      kind: 'planned',
      workspaces: 1,
      collections: 1,
      environments: 1,
      totalCalls: 5,
    });
    expect(events.filter((event) => event.kind === 'enumerating').at(-1)).toMatchObject({
      step: 'workspace-globals',
    });
    const progress = events.filter((event) => event.kind === 'item-progress');
    expect(progress).toHaveLength(2);
    expect(progress[1]).toMatchObject({ status: 'pulled', completedItems: 2, totalItems: 2 });
    expect(events.at(-1)).toMatchObject({ kind: 'finished', outcome: 'complete' });
  });

  it('sends the key as X-Api-Key and never leaks it into events or results', async () => {
    const { fetchFn, calls } = fetchStub(happyRoutes());
    const events: PostmanPullEvent[] = [];
    const result = await pullPostmanData({
      apiKey: API_KEY,
      fetchFn,
      sleep: () => Promise.resolve(),
      onEvent: (event) => events.push(event),
    });
    expect(calls.every((call) => call.key === API_KEY)).toBe(true);
    expect(JSON.stringify(result)).not.toContain(API_KEY);
    expect(JSON.stringify(events)).not.toContain(API_KEY);
  });

  it('redirects every call at a stand-in origin when apiOrigin is set', async () => {
    const stubOrigin = 'http://127.0.0.1:19937';
    const routes = happyRoutes().map((route) => ({
      ...route,
      url: route.url.replace('https://api.postman.com', stubOrigin),
    }));
    const { fetchFn, calls } = fetchStub(routes);
    const result = await pullPostmanData({
      apiKey: API_KEY,
      apiOrigin: stubOrigin,
      fetchFn,
      sleep: () => Promise.resolve(),
    });

    expect(result.outcome).toBe('complete');
    expect(result.collections).toHaveLength(1);
    expect(result.environments).toHaveLength(1);
    // Every outgoing URL rides the stand-in origin; the key still rides the header.
    expect(calls.map((call) => call.url)).toEqual([
      `${stubOrigin}/workspaces`,
      `${stubOrigin}/workspaces/ws-1`,
      `${stubOrigin}/workspaces/ws-1/global-variables`,
      `${stubOrigin}/collections/owner-c1`,
      `${stubOrigin}/environments/owner-e1`,
    ]);
    expect(calls.every((call) => call.key === API_KEY)).toBe(true);
  });

  it('honors RetryAfter on a transient 429 and resumes the same call', async () => {
    const routes = happyRoutes();
    routes.splice(3, 0, {
      url: COLLECTION_URL,
      respond: () =>
        response(
          { error: { name: 'rateLimited', message: 'Rate limit exceeded' } },
          { status: 429, headers: { RetryAfter: '3' } },
        ),
    });
    const { fetchFn } = fetchStub(routes);
    const sleeps: number[] = [];
    const events: PostmanPullEvent[] = [];

    const result = await pullPostmanData({
      apiKey: API_KEY,
      fetchFn,
      sleep: (ms) => {
        sleeps.push(ms);
        return Promise.resolve();
      },
      onEvent: (event) => events.push(event),
    });

    expect(result.outcome).toBe('complete');
    expect(result.collections).toHaveLength(1);
    expect(events).toContainEqual({ kind: 'rate-limit-pause', retryAfterSeconds: 3 });
    expect(sleeps).toContain(3000);
    expect(result.callsMade).toBe(6);
  });

  it('stops the run on a monthly service-limit 429 with a labeled partial result', async () => {
    const routes: Route[] = [
      { url: LIST_URL, respond: () => response(workspaceList) },
      { url: DETAIL_URL, respond: () => response(workspaceDetail) },
      { url: GLOBALS_URL, respond: () => response(globalsBody) },
      {
        url: COLLECTION_URL,
        respond: () =>
          response(
            { error: { name: 'serviceLimitExhausted', message: 'Service limit exhausted.' } },
            { status: 429, headers: { 'RateLimit-Remaining-Month': '0' } },
          ),
      },
    ];
    const { fetchFn, calls } = fetchStub(routes);
    const result = await pullPostmanData({ apiKey: API_KEY, fetchFn, sleep: () => Promise.resolve() });

    expect(result.outcome).toBe('partial');
    expect(result.stopReason).toContain('monthly');
    expect(result.collections).toEqual([]);
    // Both planned items surface as skips with the stop reason — never silent.
    expect(result.skipped).toHaveLength(2);
    expect(result.skipped.every((skip) => skip.reason.includes('stopped early'))).toBe(true);
    // No environment call ever went out.
    expect(calls.map((call) => call.url)).toEqual([LIST_URL, DETAIL_URL, GLOBALS_URL, COLLECTION_URL]);
    expect(result.budget).toEqual({ remainingMonth: 0 });
  });

  it('fails the run when the key is rejected, without echoing it', async () => {
    const { fetchFn } = fetchStub([
      { url: LIST_URL, respond: () => response({ error: { name: 'AuthenticationError' } }, { status: 401 }) },
    ]);
    const result = await pullPostmanData({ apiKey: API_KEY, fetchFn, sleep: () => Promise.resolve() });
    expect(result.outcome).toBe('failed');
    expect(result.stopReason).toContain('rejected the key');
    expect(JSON.stringify(result)).not.toContain(API_KEY);
  });

  it('skips an item on an http error and finishes the rest of the run', async () => {
    const routes = happyRoutes();
    routes[3] = {
      url: COLLECTION_URL,
      respond: () => response({ error: { name: 'instanceNotFoundError', message: 'Not found' } }, { status: 404 }),
    };
    const { fetchFn } = fetchStub(routes);
    const result = await pullPostmanData({ apiKey: API_KEY, fetchFn, sleep: () => Promise.resolve() });

    expect(result.outcome).toBe('complete');
    expect(result.collections).toEqual([]);
    expect(result.environments).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]).toMatchObject({ item: 'collection', id: 'owner-c1' });
    expect(result.skipped[0]?.reason).toContain('404');
  });

  it('emits budget events as the remaining monthly budget changes', async () => {
    const routes = happyRoutes();
    routes[0] = {
      url: LIST_URL,
      respond: () =>
        response(workspaceList, {
          headers: { 'RateLimit-Limit-Month': '10000', 'RateLimit-Remaining-Month': '9999' },
        }),
    };
    routes[1] = {
      url: DETAIL_URL,
      respond: () =>
        response(workspaceDetail, {
          headers: { 'RateLimit-Limit-Month': '10000', 'RateLimit-Remaining-Month': '9998' },
        }),
    };
    const { fetchFn } = fetchStub(routes);
    const events: PostmanPullEvent[] = [];
    const result = await pullPostmanData({
      apiKey: API_KEY,
      fetchFn,
      sleep: () => Promise.resolve(),
      onEvent: (event) => events.push(event),
    });
    const budgets = events.filter((event) => event.kind === 'budget');
    expect(budgets).toEqual([
      { kind: 'budget', limitMonth: 10000, remainingMonth: 9999 },
      { kind: 'budget', limitMonth: 10000, remainingMonth: 9998 },
    ]);
    expect(result.budget).toEqual({ limitMonth: 10000, remainingMonth: 9998 });
  });

  it('records a workspace skip when its detail cannot be interpreted, still pulling its globals', async () => {
    const routes = happyRoutes();
    routes[1] = { url: DETAIL_URL, respond: () => response({ nope: true }) };
    const { fetchFn } = fetchStub(routes.slice(0, 3));
    const result = await pullPostmanData({ apiKey: API_KEY, fetchFn, sleep: () => Promise.resolve() });
    expect(result.outcome).toBe('complete');
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]).toMatchObject({ item: 'workspace', id: 'ws-1', workspaceIds: ['ws-1'] });
    // The globals call is independent of the detail read.
    expect(result.globals).toHaveLength(1);
    expect(result.globals[0]?.variables).toHaveLength(1);
  });

  it('skips a workspace\'s globals on a failed read and finishes the run', async () => {
    const routes = happyRoutes();
    routes[2] = {
      url: GLOBALS_URL,
      respond: () => response({ error: { name: 'instanceNotFoundError', message: 'Not found' } }, { status: 404 }),
    };
    const { fetchFn } = fetchStub(routes);
    const result = await pullPostmanData({ apiKey: API_KEY, fetchFn, sleep: () => Promise.resolve() });

    expect(result.outcome).toBe('complete');
    expect(result.globals).toEqual([]);
    expect(result.collections).toHaveLength(1);
    expect(result.environments).toHaveLength(1);
    const globalsSkip = result.skipped.find((skip) => skip.reason.includes('globals'));
    expect(globalsSkip).toMatchObject({ item: 'workspace', id: 'ws-1', workspaceIds: ['ws-1'] });
    expect(globalsSkip?.reason).toContain('404');
  });

  it('reports keyless globals rows as a per-workspace skip and keeps the usable rows', async () => {
    const routes = happyRoutes();
    routes[2] = {
      url: GLOBALS_URL,
      respond: () =>
        response({
          values: [{ key: 'api_host', value: 'api.openheaders.io' }, { value: 'orphan' }],
        }),
    };
    const { fetchFn } = fetchStub(routes);
    const result = await pullPostmanData({ apiKey: API_KEY, fetchFn, sleep: () => Promise.resolve() });

    expect(result.outcome).toBe('complete');
    expect(result.globals).toEqual([
      { workspaceId: 'ws-1', variables: [{ name: 'api_host', value: 'api.openheaders.io', type: 'default' }] },
    ]);
    const rowSkip = result.skipped.find((skip) => skip.reason.includes('no usable name'));
    expect(rowSkip).toMatchObject({ item: 'workspace', id: 'ws-1', workspaceIds: ['ws-1'] });
  });

  it('reports listed API specs as a per-workspace "not imported yet" skip', async () => {
    const routes = happyRoutes();
    routes[1] = {
      url: DETAIL_URL,
      respond: () =>
        response({
          workspace: {
            ...workspaceDetail.workspace,
            specs: [{ id: 's1', name: 'Orders OpenAPI' }],
          },
        }),
    };
    const { fetchFn } = fetchStub(routes);
    const result = await pullPostmanData({ apiKey: API_KEY, fetchFn, sleep: () => Promise.resolve() });

    expect(result.outcome).toBe('complete');
    expect(result.collections).toHaveLength(1);
    const specSkip = result.skipped.find((skip) => skip.reason.includes('not imported yet'));
    expect(specSkip).toMatchObject({ item: 'workspace', id: 'ws-1', workspaceIds: ['ws-1'] });
    expect(specSkip?.reason).toContain('Orders OpenAPI');
  });

  it('attributes pulled items to the workspaces that listed them', async () => {
    const { fetchFn } = fetchStub(happyRoutes());
    const result = await pullPostmanData({ apiKey: API_KEY, fetchFn, sleep: () => Promise.resolve() });
    expect(result.collections[0]?.workspaceIds).toEqual(['ws-1']);
    expect(result.environments[0]?.workspaceIds).toEqual(['ws-1']);
    expect(result.globals[0]?.workspaceId).toBe('ws-1');
  });

  it('narrows the pull to the selected workspaces', async () => {
    const twoWorkspaces = { workspaces: [...workspaceList.workspaces, { id: 'ws-2', name: 'Side', type: 'personal' }] };
    const routes: Route[] = [
      { url: LIST_URL, respond: () => response(twoWorkspaces) },
      { url: DETAIL_URL, respond: () => response(workspaceDetail) },
      { url: GLOBALS_URL, respond: () => response(globalsBody) },
      { url: COLLECTION_URL, respond: () => response(collectionBody) },
      { url: ENVIRONMENT_URL, respond: () => response(environmentBody) },
    ];
    const { fetchFn, calls } = fetchStub(routes);
    const result = await pullPostmanData({
      apiKey: API_KEY,
      workspaceIds: ['ws-1'],
      fetchFn,
      sleep: () => Promise.resolve(),
    });

    expect(result.outcome).toBe('complete');
    expect(result.workspaces).toEqual([{ id: 'ws-1', name: 'Team', type: 'team' }]);
    // ws-2 was never enumerated — no detail or globals call went out for it.
    expect(calls.map((call) => call.url)).toEqual([LIST_URL, DETAIL_URL, GLOBALS_URL, COLLECTION_URL, ENVIRONMENT_URL]);
  });
});

describe('listPostmanWorkspaces', () => {
  it('answers names + item counts from the enumeration calls only', async () => {
    const { fetchFn, calls } = fetchStub(happyRoutes().slice(0, 2));
    const result = await listPostmanWorkspaces({ apiKey: API_KEY, fetchFn, sleep: () => Promise.resolve() });

    expect(result).toEqual({
      ok: true,
      workspaces: [{ id: 'ws-1', name: 'Team', type: 'team', collections: 1, environments: 1 }],
      budget: {},
    });
    // No item pull ever went out — the preflight is enumeration-only.
    expect(calls.map((call) => call.url)).toEqual([LIST_URL, DETAIL_URL]);
    expect(calls.every((call) => call.key === API_KEY)).toBe(true);
  });

  it('keeps an unreadable workspace listed with zero counts', async () => {
    const routes = happyRoutes().slice(0, 2);
    routes[1] = { url: DETAIL_URL, respond: () => response({ nope: true }) };
    const { fetchFn } = fetchStub(routes);
    const result = await listPostmanWorkspaces({ apiKey: API_KEY, fetchFn, sleep: () => Promise.resolve() });
    expect(result).toMatchObject({
      ok: true,
      workspaces: [{ id: 'ws-1', name: 'Team', collections: 0, environments: 0 }],
    });
  });

  it('fails with a reason when the key is rejected, without echoing it', async () => {
    const { fetchFn } = fetchStub([
      { url: LIST_URL, respond: () => response({ error: { name: 'AuthenticationError' } }, { status: 401 }) },
    ]);
    const result = await listPostmanWorkspaces({ apiKey: API_KEY, fetchFn, sleep: () => Promise.resolve() });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('rejected the key');
    expect(JSON.stringify(result)).not.toContain(API_KEY);
  });
});
