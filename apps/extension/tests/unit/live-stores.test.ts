/**
 * Live Workflow / Live Variable / Live Cache stores — verifies
 * workspace scoping, lock wrapping, change-listener semantics,
 * Phase 10 stale-draft detection, env-keyed cache rows, and purge
 * paths. Mirrors the oauth-token-store test shape.
 */

import type { V5 } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installBackingStorage, snapshotStorage } from '../helpers/chrome-storage-backing';

vi.mock('@utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/background/modules/workspace-store', () => ({
  getActiveWorkspaceId: vi.fn(() => 'ws-live'),
}));

vi.mock('@/background/modules/storage-drift', () => ({
  driftRecorder: () => () => {},
}));

class FifoLockRuntime {
  private queues = new Map<string, Array<() => void>>();
  private holders = new Set<string>();
  async request<T>(name: string, _options: unknown, callback: () => Promise<T> | T): Promise<T> {
    if (this.holders.has(name)) {
      await new Promise<void>((resolve) => {
        const q = this.queues.get(name) ?? [];
        q.push(resolve);
        this.queues.set(name, q);
      });
    }
    this.holders.add(name);
    try {
      return await callback();
    } finally {
      this.holders.delete(name);
      const q = this.queues.get(name);
      if (q && q.length > 0) q.shift()!();
    }
  }
}

let wfStore: typeof import('@/background/modules/live-workflow-store');
let lvStore: typeof import('@/background/modules/live-variable-store');
let cacheStore: typeof import('@/background/modules/live-cache-store');

beforeEach(async () => {
  installBackingStorage();
  vi.resetModules();
  const lockModule = await import('@/shared/coordination/with-lock');
  lockModule.setLockRuntime(new FifoLockRuntime());
  wfStore = await import('@/background/modules/live-workflow-store');
  lvStore = await import('@/background/modules/live-variable-store');
  cacheStore = await import('@/background/modules/live-cache-store');
  await wfStore.hydrateFromStorage();
  await lvStore.hydrateFromStorage();
});

afterEach(async () => {
  const lockModule = await import('@/shared/coordination/with-lock');
  lockModule.setLockRuntime(null);
});

// ── Fixture helpers ────────────────────────────────────────────────

function fixtureStep(overrides: Partial<V5.WorkflowStep> = {}): V5.WorkflowStep {
  return {
    id: 'fetch',
    requestUid: 'reqfetch1',
    captures: [{ name: 'access_token', extractor: { kind: 'json-path', path: '$.access_token' } }],
    ...overrides,
  };
}

// ── LiveWorkflow store ─────────────────────────────────────────────

describe('live-workflow-store', () => {
  it('createLiveWorkflow + getLiveWorkflow round-trip by uid', async () => {
    const wf = wfStore.createLiveWorkflow({ name: 'Auth', steps: [fixtureStep()] });
    expect(wfStore.getLiveWorkflow(wf.uid)?.name).toBe('Auth');
    expect(wfStore.getLiveWorkflows()).toHaveLength(1);
  });

  it('createLiveWorkflow defaults refresh = manual and enabled = true', () => {
    const wf = wfStore.createLiveWorkflow({ name: 'Basic', steps: [fixtureStep()] });
    expect(wf.refresh).toEqual({ kind: 'manual' });
    expect(wf.enabled).toBe(true);
    expect(wf.version).toBe(1);
  });

  it('updateLiveWorkflow bumps version and persists', async () => {
    const wf = wfStore.createLiveWorkflow({ name: 'A', steps: [fixtureStep()] });
    const result = await wfStore.updateLiveWorkflow(wf.uid, { name: 'A (renamed)' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.version).toBe(2);
      expect(result.workflow.name).toBe('A (renamed)');
    }
  });

  it('updateLiveWorkflow rejects stale drafts when expectedVersion mismatches', async () => {
    const wf = wfStore.createLiveWorkflow({ name: 'A', steps: [fixtureStep()] });
    await wfStore.updateLiveWorkflow(wf.uid, { name: 'B' });
    const stale = await wfStore.updateLiveWorkflow(wf.uid, { name: 'C' }, { expectedVersion: 1 });
    expect(stale.ok).toBe(false);
    if (!stale.ok && stale.reason === 'stale-draft') {
      expect(stale.serverVersion).toBe(2);
    } else {
      throw new Error('expected stale-draft reason');
    }
  });

  it('updateLiveWorkflow returns not-found for missing uid', async () => {
    const result = await wfStore.updateLiveWorkflow('nosuch01', { name: 'x' });
    expect(result).toEqual({ ok: false, reason: 'not-found' });
  });

  it('deleteLiveWorkflow returns true on hit, false on miss', async () => {
    const wf = wfStore.createLiveWorkflow({ name: 'A', steps: [fixtureStep()] });
    expect(await wfStore.deleteLiveWorkflow(wf.uid)).toBe(true);
    expect(await wfStore.deleteLiveWorkflow(wf.uid)).toBe(false);
    expect(wfStore.getLiveWorkflows()).toHaveLength(0);
  });

  it('fires onLiveWorkflowStoreChange after mutation', async () => {
    const spy = vi.fn();
    const unsub = wfStore.onLiveWorkflowStoreChange(spy);
    wfStore.createLiveWorkflow({ name: 'A', steps: [fixtureStep()] });
    // create persists asynchronously but `notifyChange` is synchronous
    // — wait one microtask so the `void persist()` resolves.
    await new Promise((r) => setTimeout(r, 0));
    expect(spy).toHaveBeenCalled();
    unsub();
  });

  it('purgeLiveWorkflowsForWorkspace removes the storage key', async () => {
    wfStore.createLiveWorkflow({ name: 'A', steps: [fixtureStep()] });
    await new Promise((r) => setTimeout(r, 0));
    await wfStore.purgeLiveWorkflowsForWorkspace('ws-live');
    expect(snapshotStorage()['oh.ws.ws-live.liveWorkflows']).toBeUndefined();
  });
});

// ── LiveVariable store ─────────────────────────────────────────────

describe('live-variable-store', () => {
  it('createLiveVariable + getLiveVariableByName', () => {
    const lv = lvStore.createLiveVariable({
      name: 'authToken',
      workflowUid: 'wflow001',
      stepId: 'fetch',
      captureName: 'access_token',
    });
    expect(lvStore.getLiveVariableByName('authToken')?.uid).toBe(lv.uid);
  });

  it('getLiveVariablesForWorkflow returns only LVs bound to that workflow', () => {
    lvStore.createLiveVariable({
      name: 'a',
      workflowUid: 'wf000001',
      stepId: 'fetch',
      captureName: 'v',
    });
    lvStore.createLiveVariable({
      name: 'b',
      workflowUid: 'wf000002',
      stepId: 'fetch',
      captureName: 'v',
    });
    lvStore.createLiveVariable({
      name: 'c',
      workflowUid: 'wf000001',
      stepId: 'fetch',
      captureName: 'v2',
    });
    expect(
      lvStore
        .getLiveVariablesForWorkflow('wf000001')
        .map((lv) => lv.name)
        .sort(),
    ).toEqual(['a', 'c']);
  });

  it('setLiveVariableOverride stores the override; passing null clears it', async () => {
    const lv = lvStore.createLiveVariable({
      name: 'x',
      workflowUid: 'wf000001',
      stepId: 'fetch',
      captureName: 'v',
    });
    const set = await lvStore.setLiveVariableOverride(lv.uid, { value: 'pinned', until: 12345 });
    expect(set.ok).toBe(true);
    if (set.ok) expect(set.variable.manualOverride?.value).toBe('pinned');

    const cleared = await lvStore.setLiveVariableOverride(lv.uid, null);
    expect(cleared.ok).toBe(true);
    if (cleared.ok) expect(cleared.variable.manualOverride).toBeUndefined();
  });

  it('deleteLiveVariable does NOT cascade to the workflow (orphan behavior is Phase E)', async () => {
    const wf = wfStore.createLiveWorkflow({ name: 'W', steps: [fixtureStep()] });
    const lv = lvStore.createLiveVariable({
      name: 'v',
      workflowUid: wf.uid,
      stepId: 'fetch',
      captureName: 'access_token',
    });
    await lvStore.deleteLiveVariable(lv.uid);
    expect(wfStore.getLiveWorkflow(wf.uid)).not.toBeNull();
  });
});

// ── LiveCache store ────────────────────────────────────────────────

describe('live-cache-store', () => {
  const EXTRACTED_AT = 1_700_000_000_000;

  it('putWorkflowRunCache + getWorkflowRunCache round-trip keyed by (workflowUid, envId)', async () => {
    await cacheStore.putWorkflowRunCache({
      workflowUid: 'wflow001',
      environmentId: 'env-prod',
      stepCaptures: { fetch: { access_token: 'tk-42' } },
      stepResponseBytes: { fetch: 120 },
      extractedAt: EXTRACTED_AT,
      expiresAt: null,
    });
    const run = await cacheStore.getWorkflowRunCache('wflow001', 'env-prod');
    expect(run?.stepCaptures.fetch?.access_token).toBe('tk-42');
    expect(run?.consecutiveFailures).toBe(0);
    expect(run?.lastExtractorOk).toBe(true);
  });

  it('"No environment" state uses a distinct cache row from any env id', async () => {
    await cacheStore.putWorkflowRunCache({
      workflowUid: 'wflow001',
      environmentId: null,
      stepCaptures: { fetch: { access_token: 'none-env' } },
      stepResponseBytes: {},
      extractedAt: EXTRACTED_AT,
      expiresAt: null,
    });
    await cacheStore.putWorkflowRunCache({
      workflowUid: 'wflow001',
      environmentId: 'env-dev',
      stepCaptures: { fetch: { access_token: 'dev-env' } },
      stepResponseBytes: {},
      extractedAt: EXTRACTED_AT,
      expiresAt: null,
    });
    expect((await cacheStore.getWorkflowRunCache('wflow001', null))?.stepCaptures.fetch?.access_token).toBe('none-env');
    expect((await cacheStore.getWorkflowRunCache('wflow001', 'env-dev'))?.stepCaptures.fetch?.access_token).toBe(
      'dev-env',
    );
  });

  it('recordRefreshError preserves previous captures and increments failure counter', async () => {
    await cacheStore.putWorkflowRunCache({
      workflowUid: 'wflow001',
      environmentId: null,
      stepCaptures: { fetch: { v: 'good' } },
      stepResponseBytes: {},
      extractedAt: EXTRACTED_AT,
      expiresAt: null,
    });
    await cacheStore.recordRefreshError({
      workflowUid: 'wflow001',
      environmentId: null,
      message: 'upstream 503',
      failedStepId: 'fetch',
    });
    const run = await cacheStore.getWorkflowRunCache('wflow001', null);
    // Captures preserved from the last successful run (atomic-refresh discipline).
    expect(run?.stepCaptures.fetch?.v).toBe('good');
    expect(run?.consecutiveFailures).toBe(1);
    expect(run?.lastErrorMessage).toBe('upstream 503');
    expect(run?.lastErrorStepId).toBe('fetch');
    expect(run?.lastExtractorOk).toBe(false);
  });

  it('recordRefreshError accumulates consecutive failures', async () => {
    await cacheStore.recordRefreshError({ workflowUid: 'wflow001', environmentId: null, message: 'fail1' });
    await cacheStore.recordRefreshError({ workflowUid: 'wflow001', environmentId: null, message: 'fail2' });
    const run = await cacheStore.getWorkflowRunCache('wflow001', null);
    expect(run?.consecutiveFailures).toBe(2);
  });

  it('putWorkflowRunCache after a failure resets consecutiveFailures', async () => {
    await cacheStore.recordRefreshError({ workflowUid: 'wflow001', environmentId: null, message: 'fail' });
    await cacheStore.putWorkflowRunCache({
      workflowUid: 'wflow001',
      environmentId: null,
      stepCaptures: {},
      stepResponseBytes: {},
      extractedAt: EXTRACTED_AT,
      expiresAt: null,
    });
    const run = await cacheStore.getWorkflowRunCache('wflow001', null);
    expect(run?.consecutiveFailures).toBe(0);
    expect(run?.lastExtractorOk).toBe(true);
  });

  it('clearWorkflowRunCache removes every env-keyed row for the workflow', async () => {
    await cacheStore.putWorkflowRunCache({
      workflowUid: 'wflow001',
      environmentId: null,
      stepCaptures: {},
      stepResponseBytes: {},
      extractedAt: EXTRACTED_AT,
      expiresAt: null,
    });
    await cacheStore.putWorkflowRunCache({
      workflowUid: 'wflow001',
      environmentId: 'env-prod',
      stepCaptures: {},
      stepResponseBytes: {},
      extractedAt: EXTRACTED_AT,
      expiresAt: null,
    });
    const removed = await cacheStore.clearWorkflowRunCache('wflow001');
    expect(removed).toBe(2);
    expect(await cacheStore.listCachesForWorkflow('wflow001')).toHaveLength(0);
  });

  it('purgeLiveCacheForWorkspace removes the cache storage key', async () => {
    await cacheStore.putWorkflowRunCache({
      workflowUid: 'wflow001',
      environmentId: null,
      stepCaptures: {},
      stepResponseBytes: {},
      extractedAt: EXTRACTED_AT,
      expiresAt: null,
    });
    await cacheStore.purgeLiveCacheForWorkspace('ws-live');
    expect(snapshotStorage()['oh.ws.ws-live.liveCache']).toBeUndefined();
  });

  it('fires onLiveCacheStoreChange after mutation, carrying the workflowUid + post-write runs', async () => {
    const spy = vi.fn();
    const unsub = cacheStore.onLiveCacheStoreChange(spy);
    await cacheStore.putWorkflowRunCache({
      workflowUid: 'wflow001',
      environmentId: null,
      stepCaptures: { step1: { name: 'cloudflare' } },
      stepResponseBytes: { step1: 42 },
      extractedAt: EXTRACTED_AT,
      expiresAt: null,
    });
    expect(spy).toHaveBeenCalledOnce();
    const [ws, workflowUid, runs] = spy.mock.calls[0];
    expect(ws).toBe('ws-live');
    expect(workflowUid).toBe('wflow001');
    expect(runs).toHaveLength(1);
    expect(runs[0].stepCaptures.step1.name).toBe('cloudflare');
    unsub();
  });

  it('listCachesForWorkflow filters across envs', async () => {
    await cacheStore.putWorkflowRunCache({
      workflowUid: 'wflow001',
      environmentId: null,
      stepCaptures: {},
      stepResponseBytes: {},
      extractedAt: EXTRACTED_AT,
      expiresAt: null,
    });
    await cacheStore.putWorkflowRunCache({
      workflowUid: 'wflow001',
      environmentId: 'env-prod',
      stepCaptures: {},
      stepResponseBytes: {},
      extractedAt: EXTRACTED_AT + 1,
      expiresAt: null,
    });
    await cacheStore.putWorkflowRunCache({
      workflowUid: 'wfother01',
      environmentId: null,
      stepCaptures: {},
      stepResponseBytes: {},
      extractedAt: EXTRACTED_AT + 2,
      expiresAt: null,
    });
    const runs = await cacheStore.listCachesForWorkflow('wflow001');
    expect(runs).toHaveLength(2);
    expect(runs.every((r) => r.workflowUid === 'wflow001')).toBe(true);
  });
});
