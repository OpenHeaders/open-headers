/**
 * live-refresh-scheduler — Definitional freshness LF1/LF2 — material request-edit + variable-edit refresh.
 *
 * Shared mock graph + fixtures live in `./_harness`; the static import
 * registers its `vi.mock` calls and `beforeEach`/`afterEach` hooks. The
 * freshly re-imported module is reached as `H.scheduler` (a live binding).
 */

import type { Environment, LiveWorkflow, Request } from '@openheaders/core/types';
import { describe, expect, it, vi } from 'vitest';
import * as H from './_harness';

const {
  makeWorkflow,
  makeVariable,
  makeRequest,
  flushAsync,
  storeState,
  activeSwitchState,
  clearWorkflowRunCacheMock,
  clearWorkflowRunCacheForEnvironmentMock,
  markWorkflowDefinitionallyStaleMock,
  markRunDefinitionallyStaleMock,
} = H;

// ── Definitional freshness — material request-edit refresh ────────

describe('material request-edit refresh', () => {
  /** Start the scheduler with a workflow embedding `reqfetch1`, then
   *  fire one request-store event to prime the fingerprint baseline. */
  async function startPrimed(workflow = makeWorkflow()): Promise<void> {
    H.scheduler.__setRequestEditRefreshDebounceMs(0);
    storeState.requests.set('reqfetch1', makeRequest());
    storeState.workflows = [workflow];
    storeState.variables = [makeVariable()];
    H.scheduler.startLiveScheduler();
    // First request-store event = hydration broadcast — primes the
    // baseline, never triggers a refresh.
    for (const fn of storeState.listeners.request) fn();
    await flushAsync();
  }

  it('flags every env row + refreshes the active env on a material edit', async () => {
    type RefreshArgs = { workspaceId: string; workflow: LiveWorkflow; environmentId: string | null };
    const refreshSpy = vi.fn<(args: RefreshArgs) => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    activeSwitchState.activeEnvId = 'env-dev';
    await startPrimed();
    expect(markWorkflowDefinitionallyStaleMock).not.toHaveBeenCalled();

    // Material edit — the request URL changed.
    storeState.requests.set('reqfetch1', makeRequest({ url: 'https://api.openheaders.io/token-v2' }));
    for (const fn of storeState.listeners.request) fn();
    await flushAsync();

    // Every env row flagged definitionally stale — the flag drives the
    // due-now alarm for the non-active envs. No bare cache clear.
    expect(markWorkflowDefinitionallyStaleMock).toHaveBeenCalledWith('wflow001', 'ws-live');
    expect(clearWorkflowRunCacheMock).not.toHaveBeenCalled();
    // Active env refreshed immediately so it has no wrong-recipe window.
    expect(refreshSpy).toHaveBeenCalledOnce();
    expect(refreshSpy.mock.calls[0]?.[0]).toMatchObject({ environmentId: 'env-dev' });
  });

  it('flags a disabled non-manual workflow without refreshing it', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    await startPrimed(makeWorkflow({ enabled: false }));

    storeState.requests.set('reqfetch1', makeRequest({ method: 'POST' }));
    for (const fn of storeState.listeners.request) fn();
    await flushAsync();

    // A disabled workflow can't run now — but the flag persists on its
    // cache rows so a re-enable refreshes them via the due-now path
    // instead of serving the wrong-recipe value out to natural expiry.
    expect(markWorkflowDefinitionallyStaleMock).toHaveBeenCalledWith('wflow001', 'ws-live');
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(clearWorkflowRunCacheMock).not.toHaveBeenCalled();
  });

  it('ignores a cosmetic edit (rename) — fingerprint unchanged', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    await startPrimed();

    storeState.requests.set('reqfetch1', makeRequest({ name: 'Renamed', description: 'docs' }));
    for (const fn of storeState.listeners.request) fn();
    await flushAsync();

    expect(clearWorkflowRunCacheMock).not.toHaveBeenCalled();
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('flags a manual-trigger workflow definitionally stale instead of auto-running it', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    await startPrimed(makeWorkflow({ refresh: { kind: 'manual' } }));

    storeState.requests.set('reqfetch1', makeRequest({ method: 'POST' }));
    for (const fn of storeState.listeners.request) fn();
    await flushAsync();

    // Manual workflow: no auto-run, no env-row clear — but every env
    // cache row is flagged definitionally stale so the UI badges it.
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(clearWorkflowRunCacheMock).not.toHaveBeenCalled();
    expect(markWorkflowDefinitionallyStaleMock).toHaveBeenCalledWith('wflow001', 'ws-live');
  });

  it('does not flag a manual workflow on a cosmetic edit', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    await startPrimed(makeWorkflow({ refresh: { kind: 'manual' } }));

    storeState.requests.set('reqfetch1', makeRequest({ name: 'Renamed' }));
    for (const fn of storeState.listeners.request) fn();
    await flushAsync();

    expect(markWorkflowDefinitionallyStaleMock).not.toHaveBeenCalled();
  });
});

// ── Variable-edit refresh (LF2) ───────────────────────────────────

describe('variable-edit refresh (LF2)', () => {
  type RefreshArgs = { workspaceId: string; workflow: LiveWorkflow; environmentId: string | null };

  function makeEnvironment(uid: string, vars: Array<{ name: string; value: string }>): Environment {
    return {
      schemaVersion: 5,
      uid,
      name: uid,
      variables: vars.map((v, i) => ({ uid: `${uid}var${i}`, name: v.name, value: v.value, type: 'default' as const })),
    };
  }

  /** A request whose Authorization header carries `refValue`. */
  function requestRef(refValue: string): Request {
    return makeRequest({ headers: [{ uid: 'hdrauth01', key: 'Authorization', value: refValue, enabled: true }] });
  }

  /** Start the scheduler with a workflow embedding a request that
   *  resolves `refValue`, then fire one env-store event to prime the
   *  variable-surface fingerprint baseline. */
  async function startPrimed(refValue = '{{env.token}}', workflow = makeWorkflow()): Promise<void> {
    H.scheduler.__setVariableEditRefreshDebounceMs(0);
    storeState.requests.set('reqfetch1', requestRef(refValue));
    storeState.workflows = [workflow];
    storeState.variables = [makeVariable()];
    storeState.environments = [
      makeEnvironment('env-dev', [{ name: 'token', value: 'dev-aaa' }]),
      makeEnvironment('env-prod', [{ name: 'token', value: 'prod-aaa' }]),
    ];
    H.scheduler.startLiveScheduler();
    // First env-store event = hydration broadcast — primes the
    // baseline, never triggers a refresh.
    for (const fn of storeState.listeners.environment) fn();
    await flushAsync();
  }

  function fireEnvChange(): void {
    for (const fn of storeState.listeners.environment) fn();
  }

  it('refreshes the active env when one of its variables changes', async () => {
    const refreshSpy = vi.fn<(args: RefreshArgs) => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    activeSwitchState.activeEnvId = 'env-dev';
    await startPrimed();

    storeState.environments = [
      makeEnvironment('env-dev', [{ name: 'token', value: 'dev-CHANGED' }]),
      makeEnvironment('env-prod', [{ name: 'token', value: 'prod-aaa' }]),
    ];
    fireEnvChange();
    await flushAsync();

    expect(refreshSpy).toHaveBeenCalledOnce();
    expect(refreshSpy.mock.calls[0]?.[0]).toMatchObject({ environmentId: 'env-dev' });
    // env-dev's row is flagged definitionally stale (a failed refresh
    // leaves the flag for the due-now alarm to retry; a successful one
    // clears it) and is refreshed in place — never dropped.
    expect(markRunDefinitionallyStaleMock).toHaveBeenCalledWith('wflow001', 'env-dev', 'ws-live');
    expect(clearWorkflowRunCacheForEnvironmentMock).not.toHaveBeenCalled();
  });

  it('treats toggling a referenced variable to disabled as a value change (LF2 fires)', async () => {
    const refreshSpy = vi.fn<(args: RefreshArgs) => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    activeSwitchState.activeEnvId = 'env-dev';
    await startPrimed();

    // Same name + value — only the enabled flag flips. The resolver now
    // skips the row, so the workflow's resolved surface changed.
    const disabledDev = makeEnvironment('env-dev', [{ name: 'token', value: 'dev-aaa' }]);
    disabledDev.variables = disabledDev.variables.map((v) => ({ ...v, enabled: false }));
    storeState.environments = [disabledDev, makeEnvironment('env-prod', [{ name: 'token', value: 'prod-aaa' }])];
    fireEnvChange();
    await flushAsync();

    expect(refreshSpy).toHaveBeenCalledOnce();
    expect(markRunDefinitionallyStaleMock).toHaveBeenCalledWith('wflow001', 'env-dev', 'ws-live');
  });

  it('flags a non-active env row when that env variable changes', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    activeSwitchState.activeEnvId = 'env-prod';
    await startPrimed();

    storeState.environments = [
      makeEnvironment('env-dev', [{ name: 'token', value: 'dev-CHANGED' }]),
      makeEnvironment('env-prod', [{ name: 'token', value: 'prod-aaa' }]),
    ];
    fireEnvChange();
    await flushAsync();

    // env-dev is non-active — its row is flagged definitionally stale
    // (kept, not dropped) so the due-now alarm re-warms it.
    expect(markRunDefinitionallyStaleMock).toHaveBeenCalledWith('wflow001', 'env-dev', 'ws-live');
    expect(clearWorkflowRunCacheForEnvironmentMock).not.toHaveBeenCalled();
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('flips every env row when an environment-independent vault secret changes', async () => {
    const refreshSpy = vi.fn<(args: RefreshArgs) => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    activeSwitchState.activeEnvId = 'env-dev';
    storeState.vault = {
      schemaVersion: 5,
      secrets: [{ uid: 'vlt00001', kind: 'string', name: 'secret', value: 'aaa' }],
    };
    await startPrimed('{{vault.secret}}');

    storeState.vault = {
      schemaVersion: 5,
      secrets: [{ uid: 'vlt00001', kind: 'string', name: 'secret', value: 'CHANGED' }],
    };
    fireEnvChange();
    await flushAsync();

    // A vault secret is environment-independent — every env row flips.
    // The active env (env-dev) is refreshed; all three rows (env-dev,
    // env-prod, "No environment") are flagged definitionally stale,
    // never dropped.
    expect(refreshSpy).toHaveBeenCalledOnce();
    expect(refreshSpy.mock.calls[0]?.[0]).toMatchObject({ environmentId: 'env-dev' });
    expect(clearWorkflowRunCacheForEnvironmentMock).not.toHaveBeenCalled();
    const flaggedEnvs = markRunDefinitionallyStaleMock.mock.calls.map((c) => c[1]);
    expect(flaggedEnvs).toContain('env-dev');
    expect(flaggedEnvs).toContain('env-prod');
    expect(flaggedEnvs).toContain(null);
  });

  it('flags a manual workflow affected env rows instead of refreshing', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    activeSwitchState.activeEnvId = 'env-dev';
    await startPrimed('{{env.token}}', makeWorkflow({ refresh: { kind: 'manual' } }));

    storeState.environments = [
      makeEnvironment('env-dev', [{ name: 'token', value: 'dev-CHANGED' }]),
      makeEnvironment('env-prod', [{ name: 'token', value: 'prod-aaa' }]),
    ];
    fireEnvChange();
    await flushAsync();

    expect(refreshSpy).not.toHaveBeenCalled();
    expect(clearWorkflowRunCacheForEnvironmentMock).not.toHaveBeenCalled();
    // Only env-dev's row carried the changed variable.
    expect(markRunDefinitionallyStaleMock).toHaveBeenCalledWith('wflow001', 'env-dev', 'ws-live');
  });

  it('ignores an edit to a variable the workflow does not reference', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    activeSwitchState.activeEnvId = 'env-dev';
    await startPrimed();

    storeState.environments = [
      makeEnvironment('env-dev', [
        { name: 'token', value: 'dev-aaa' },
        { name: 'unrelated', value: 'new' },
      ]),
      makeEnvironment('env-prod', [{ name: 'token', value: 'prod-aaa' }]),
    ];
    fireEnvChange();
    await flushAsync();

    expect(refreshSpy).not.toHaveBeenCalled();
    expect(clearWorkflowRunCacheForEnvironmentMock).not.toHaveBeenCalled();
    expect(markRunDefinitionallyStaleMock).not.toHaveBeenCalled();
  });

  it('does not trigger on a request edit that changes the variable ref set', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    activeSwitchState.activeEnvId = 'env-dev';
    await startPrimed();
    clearWorkflowRunCacheForEnvironmentMock.mockClear();
    markRunDefinitionallyStaleMock.mockClear();

    // The request gains a NEW variable reference — `refsKey` shifts.
    // LF2 re-baselines silently; LF1's request-edit path owns this.
    storeState.requests.set('reqfetch1', requestRef('{{env.token}}{{env.added}}'));
    for (const fn of storeState.listeners.request) fn();
    await flushAsync();

    expect(clearWorkflowRunCacheForEnvironmentMock).not.toHaveBeenCalled();
    expect(markRunDefinitionallyStaleMock).not.toHaveBeenCalled();
  });

  it('flags an ineffective non-manual workflow without refreshing it', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    activeSwitchState.activeEnvId = 'env-dev';
    // A disabled workflow is not schedulable — but a variable edit must
    // still flag its row definitionally stale so the value re-warms on
    // re-enable rather than serving wrong-recipe until cadence expiry.
    await startPrimed('{{env.token}}', makeWorkflow({ enabled: false }));

    storeState.environments = [
      makeEnvironment('env-dev', [{ name: 'token', value: 'dev-CHANGED' }]),
      makeEnvironment('env-prod', [{ name: 'token', value: 'prod-aaa' }]),
    ];
    fireEnvChange();
    await flushAsync();

    expect(markRunDefinitionallyStaleMock).toHaveBeenCalledWith('wflow001', 'env-dev', 'ws-live');
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(clearWorkflowRunCacheForEnvironmentMock).not.toHaveBeenCalled();
  });
});
