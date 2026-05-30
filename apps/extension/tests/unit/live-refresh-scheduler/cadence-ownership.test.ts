/**
 * live-refresh-scheduler — Cadence-ownership escape hatches — offline gate, peer-defer (C8), near-expiry (C9), connect-fence (C10), offline fallback election (C14).
 *
 * Shared mock graph + fixtures live in `./_harness`; the static import
 * registers its `vi.mock` calls and `beforeEach`/`afterEach` hooks. The
 * freshly re-imported module is reached as `H.scheduler` (a live binding).
 */

import type { WorkflowRunCache } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TestCacheRow } from './_harness';
import * as H from './_harness';

const {
  makeWorkflow,
  makeVariable,
  NOW,
  storeState,
  alarmsCreateMock,
  recordLogMock,
  recordRefreshErrorMock,
  markExclusiveDegradedForRunMock,
  deriveExecutionPolicyForWorkflowMock,
  isFallbackEligibleForWorkflowMock,
} = H;

// ── Offline gate ──────────────────────────────────────────────────
//
// When `navigator.onLine === false`, refresh attempts must skip
// cleanly — no adapter call, no circuit transition, no cache write.
// The v4 equivalent paused the refresh scheduler on `NetworkService
// 'offline'`; v5 checks the SW's `navigator.onLine` signal at each
// dispatch + at every manual click. Tests here pin the contract that
// offline blips DON'T rip through all three pre-breaker retries and
// open the circuit in 90 seconds (the MV3 alarm floor clamps 5–10s
// intended retries to 30s apiece).

describe('offline gate', () => {
  const originalOnLine = Object.getOwnPropertyDescriptor(globalThis.navigator, 'onLine');

  function setOnline(value: boolean): void {
    Object.defineProperty(globalThis.navigator, 'onLine', {
      value,
      configurable: true,
      writable: true,
    });
  }

  beforeEach(() => {
    setOnline(true);
  });

  afterEach(() => {
    if (originalOnLine) Object.defineProperty(globalThis.navigator, 'onLine', originalOnLine);
  });

  it('alarm fire while offline does NOT call the adapter', async () => {
    const refreshSpy = vi.fn();
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    storeState.workflows = [makeWorkflow()];
    storeState.variables = [makeVariable()];
    setOnline(false);
    await H.scheduler.handleLiveAlarm({
      name: H.scheduler.buildAlarmName('ws-live', 'wflow001', null),
      scheduledTime: NOW,
    } as chrome.alarms.Alarm);
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('alarm fire while offline does NOT record a circuit failure', async () => {
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: async () => {} });
    storeState.workflows = [makeWorkflow()];
    storeState.variables = [makeVariable()];
    setOnline(false);
    await H.scheduler.handleLiveAlarm({
      name: H.scheduler.buildAlarmName('ws-live', 'wflow001', null),
      scheduledTime: NOW,
    } as chrome.alarms.Alarm);
    // `recordRefreshError` is the cache-mutation path. An offline skip
    // must not call it — the circuit stays where it was.
    expect(recordRefreshErrorMock).not.toHaveBeenCalled();
  });

  it('alarm fire while offline logs at info level with errorClass=Offline', async () => {
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: async () => {} });
    storeState.workflows = [makeWorkflow()];
    storeState.variables = [makeVariable()];
    setOnline(false);
    await H.scheduler.handleLiveAlarm({
      name: H.scheduler.buildAlarmName('ws-live', 'wflow001', null),
      scheduledTime: NOW,
    } as chrome.alarms.Alarm);
    const failedLog = recordLogMock.mock.calls.find((c) => (c[0] as { op: string }).op === 'refresh-failed');
    expect(failedLog).toBeDefined();
    const entry = failedLog?.[0] as { level: string; context: { errorClass: string } };
    expect(entry.level).toBe('info');
    expect(entry.context.errorClass).toBe('Offline');
  });

  it('offline path re-schedules the alarm so a post-online catch-up fires naturally', async () => {
    // recordFailure's CircuitBlocked/Offline branch calls scheduler
    // .schedule(job) explicitly because no cache-change event fires.
    // That keeps the alarm live — when the 'online' handler runs
    // reconcileLiveSchedules, the next computed `when` (= healthy
    // cadence) takes over.
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: async () => {} });
    storeState.workflows = [makeWorkflow({ refresh: { kind: 'interval', seconds: 4 * 3600 } })];
    storeState.variables = [makeVariable()];
    storeState.caches = [
      {
        workflowUid: 'wflow001',
        environmentId: null,
        stepCaptures: {},
        extractedAt: NOW - 60_000,
        expiresAt: null,
        stepResponseBytes: {},
        consecutiveFailures: 0,
        lastExtractorOk: true,
      },
    ];
    alarmsCreateMock.mockClear();
    setOnline(false);
    await H.scheduler.handleLiveAlarm({
      name: H.scheduler.buildAlarmName('ws-live', 'wflow001', null),
      scheduledTime: NOW,
    } as chrome.alarms.Alarm);
    expect(alarmsCreateMock).toHaveBeenCalled();
  });
});

// ── Cadence ownership — peer defer (C8) ───────────────────────────

describe('cadence ownership — peer defer (C8)', () => {
  // The `offline gate` suite leaves `navigator.onLine = false` as an own
  // property (its restore is a no-op — happy-dom defines `onLine` on the
  // prototype, so the captured descriptor is undefined). Force it online
  // here so the refresh-path tests reach the defer gate, not the offline
  // short-circuit that runs ahead of it.
  beforeEach(() => {
    Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true, writable: true });
  });

  const CLOSED_CIRCUIT = {
    state: 'closed' as const,
    consecutiveFailures: 0,
    consecutiveOpenings: 0,
    nextAttemptAt: null,
    halfOpenAttempts: 0,
    lastSuccessAt: null,
    lastErrorAt: null,
  };

  function makeCache(over: Partial<WorkflowRunCache> = {}): WorkflowRunCache {
    return {
      workflowUid: 'wflow001',
      environmentId: null,
      stepCaptures: {},
      extractedAt: NOW,
      expiresAt: NOW + 600_000,
      stepResponseBytes: {},
      consecutiveFailures: 0,
      lastExtractorOk: true,
      circuit: CLOSED_CIRCUIT,
      ...over,
    };
  }

  function scheduleWith(cache: WorkflowRunCache): Promise<boolean> {
    return H.scheduler.scheduleLiveWorkflowRefresh(
      {
        workspaceId: 'ws-live',
        workflow: makeWorkflow({ refresh: { kind: 'interval', seconds: 300 } }),
        boundVariables: [makeVariable()],
        cache,
        environmentId: null,
      },
      NOW,
    );
  }

  it('arms the near-expiry safety fire when connected + the value is remote-sourced', async () => {
    H.scheduler.setBackendConnectionProbe(() => true);
    const expiresAt = NOW + 600_000;
    const scheduled = await scheduleWith(makeCache({ extractedAt: NOW, expiresAt, lastSyncedValueAt: NOW }));
    expect(scheduled).toBe(true);
    // expiresAt − 30s peer lead — well past the normal interval fire
    // (NOW + 300s), so the backend gets the first shot.
    const [, info] = alarmsCreateMock.mock.calls[0];
    expect(info.when).toBe(expiresAt - 30_000);
  });

  it('keeps its own cadence when no backend is connected', async () => {
    // No probe installed → isBackendConnected() is false.
    await scheduleWith(makeCache({ extractedAt: NOW, expiresAt: NOW + 600_000, lastSyncedValueAt: NOW }));
    const [, info] = alarmsCreateMock.mock.calls[0];
    expect(info.when).toBe(NOW + 300_000);
  });

  it('keeps its own cadence for a locally-produced value (no remote marker)', async () => {
    H.scheduler.setBackendConnectionProbe(() => true);
    await scheduleWith(makeCache({ extractedAt: NOW, expiresAt: NOW + 600_000 /* no lastSyncedValueAt */ }));
    const [, info] = alarmsCreateMock.mock.calls[0];
    expect(info.when).toBe(NOW + 300_000);
  });

  it('does not defer a row this host is failing on (open circuit keeps its backoff)', async () => {
    H.scheduler.setBackendConnectionProbe(() => true);
    const scheduled = await scheduleWith(
      makeCache({
        extractedAt: NOW,
        expiresAt: NOW + 600_000,
        lastSyncedValueAt: NOW,
        consecutiveFailures: 3,
        circuit: {
          state: 'open',
          consecutiveFailures: 3,
          consecutiveOpenings: 1,
          nextAttemptAt: NOW + 120_000,
          halfOpenAttempts: 0,
          lastSuccessAt: null,
          lastErrorAt: NOW,
        },
      }),
    );
    expect(scheduled).toBe(true);
    // The open circuit's nextAttemptAt wins — not the deferred 570s fire.
    const [, info] = alarmsCreateMock.mock.calls[0];
    expect(info.when).toBe(NOW + 120_000);
  });

  it('does not defer a definitionally-stale row (fire-ASAP wins)', async () => {
    H.scheduler.setBackendConnectionProbe(() => true);
    await scheduleWith(
      makeCache({ extractedAt: NOW, expiresAt: NOW + 600_000, lastSyncedValueAt: NOW, definitionallyStale: true }),
    );
    const [, info] = alarmsCreateMock.mock.calls[0];
    expect(info.when).toBe(NOW + H.scheduler.MIN_ALARM_DELAY_MS);
  });

  it('re-defers (no self-refresh) when the safety alarm fires while the synced value is fresh', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    H.scheduler.setBackendConnectionProbe(() => true);
    const now = Date.now();
    storeState.workflows = [makeWorkflow()];
    storeState.variables = [makeVariable()];
    storeState.caches = [
      {
        workflowUid: 'wflow001',
        environmentId: null,
        stepCaptures: {},
        extractedAt: now,
        expiresAt: now + 3_600_000, // far from expiry → outside the hatch window
        stepResponseBytes: {},
        consecutiveFailures: 0,
        lastExtractorOk: true,
        lastSyncedValueAt: now,
      },
    ];
    await H.scheduler.handleLiveAlarm({
      name: H.scheduler.buildAlarmName('ws-live', 'wflow001', null),
      scheduledTime: now,
    } as chrome.alarms.Alarm);

    expect(refreshSpy).not.toHaveBeenCalled();
    expect(recordRefreshErrorMock).not.toHaveBeenCalled();
    const failed = recordLogMock.mock.calls
      .map((c) => c[0] as { op: string; context?: { errorClass?: string } })
      .find((e) => e.op === 'refresh-failed');
    expect(failed?.context?.errorClass).toBe('Deferred');
  });

  it('self-refreshes (escape hatch) when the safety alarm fires inside the near-expiry window', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    H.scheduler.setBackendConnectionProbe(() => true);
    const now = Date.now();
    storeState.workflows = [makeWorkflow()];
    storeState.variables = [makeVariable()];
    storeState.caches = [
      {
        workflowUid: 'wflow001',
        environmentId: null,
        stepCaptures: {},
        extractedAt: now,
        expiresAt: now + 5_000, // inside the 30s hatch → the peer acts
        stepResponseBytes: {},
        consecutiveFailures: 0,
        lastExtractorOk: true,
        lastSyncedValueAt: now,
      },
    ];
    await H.scheduler.handleLiveAlarm({
      name: H.scheduler.buildAlarmName('ws-live', 'wflow001', null),
      scheduledTime: now,
    } as chrome.alarms.Alarm);

    expect(refreshSpy).toHaveBeenCalledOnce();
  });
});

// ── Near-expiry escape hatch — exclusive class (C9) ────────────────

describe('near-expiry escape hatch — exclusive class (C9)', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true, writable: true });
  });

  /** A remote-sourced row sitting inside the 30s near-expiry hatch window. */
  function hatchedCache(now: number): TestCacheRow {
    return {
      workflowUid: 'wflow001',
      environmentId: null,
      stepCaptures: {},
      extractedAt: now,
      expiresAt: now + 5_000, // inside the 30s hatch
      stepResponseBytes: {},
      consecutiveFailures: 0,
      lastExtractorOk: true,
      lastSyncedValueAt: now,
    };
  }

  async function fireHatch(now: number): Promise<void> {
    storeState.workflows = [makeWorkflow()];
    storeState.variables = [makeVariable()];
    storeState.caches = [hatchedCache(now)];
    await H.scheduler.handleLiveAlarm({
      name: H.scheduler.buildAlarmName('ws-live', 'wflow001', null),
      scheduledTime: now,
    } as chrome.alarms.Alarm);
  }

  it('does NOT self-refresh an exclusive cred — marks it degraded + logs ExclusiveDeferred', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    H.scheduler.setBackendConnectionProbe(() => true);
    deriveExecutionPolicyForWorkflowMock.mockReturnValue({
      policy: 'exclusive',
      reasons: [{ kind: 'totp', vaultName: 'otp' }],
    });
    const now = Date.now();

    await fireHatch(now);

    // Did not burn the single-use cred.
    expect(refreshSpy).not.toHaveBeenCalled();
    // No failure counter bump — this is a deliberate skip, not a failure.
    expect(recordRefreshErrorMock).not.toHaveBeenCalled();
    // Row marked degraded so the Status pill can say "reconnect the desktop".
    expect(markExclusiveDegradedForRunMock).toHaveBeenCalledTimes(1);
    const [uid, envId, , ws] = markExclusiveDegradedForRunMock.mock.calls[0];
    expect(uid).toBe('wflow001');
    expect(envId).toBeNull();
    expect(ws).toBe('ws-live');
    // Logged as a no-op skip, not an error.
    const failed = recordLogMock.mock.calls
      .map((c) => c[0] as { op: string; level: string; context?: { errorClass?: string } })
      .find((e) => e.op === 'refresh-failed');
    expect(failed?.context?.errorClass).toBe('ExclusiveDeferred');
    expect(failed?.level).toBe('info');
  });

  it('still self-refreshes an idempotent cred in the same window (preserves 401-safety)', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    H.scheduler.setBackendConnectionProbe(() => true);
    // Default mock verdict is idempotent.
    const now = Date.now();

    await fireHatch(now);

    expect(refreshSpy).toHaveBeenCalledOnce();
    expect(markExclusiveDegradedForRunMock).not.toHaveBeenCalled();
  });

  it('self-refreshes an exclusive cred when NO backend is connected (sole runner, not a peer)', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    // No probe → isBackendConnected() false → the defer block is skipped
    // entirely; an exclusive Mode-1 runner is the legitimate sole runner.
    deriveExecutionPolicyForWorkflowMock.mockReturnValue({
      policy: 'exclusive',
      reasons: [{ kind: 'totp', vaultName: 'otp' }],
    });
    const now = Date.now();

    await fireHatch(now);

    expect(refreshSpy).toHaveBeenCalledOnce();
    expect(markExclusiveDegradedForRunMock).not.toHaveBeenCalled();
    // Policy is never even consulted when there's no backend to defer to.
    expect(deriveExecutionPolicyForWorkflowMock).not.toHaveBeenCalled();
  });

  it('re-defers (not degrades) an exclusive cred that is still fresh — outside the hatch', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    H.scheduler.setBackendConnectionProbe(() => true);
    deriveExecutionPolicyForWorkflowMock.mockReturnValue({
      policy: 'exclusive',
      reasons: [{ kind: 'totp', vaultName: 'otp' }],
    });
    const now = Date.now();
    storeState.workflows = [makeWorkflow()];
    storeState.variables = [makeVariable()];
    storeState.caches = [
      { ...hatchedCache(now), expiresAt: now + 3_600_000 }, // far from expiry
    ];

    await H.scheduler.handleLiveAlarm({
      name: H.scheduler.buildAlarmName('ws-live', 'wflow001', null),
      scheduledTime: now,
    } as chrome.alarms.Alarm);

    // The plain C8 defer wins before the policy check is reached.
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(markExclusiveDegradedForRunMock).not.toHaveBeenCalled();
    expect(deriveExecutionPolicyForWorkflowMock).not.toHaveBeenCalled();
    const failed = recordLogMock.mock.calls
      .map((c) => c[0] as { op: string; context?: { errorClass?: string } })
      .find((e) => e.op === 'refresh-failed');
    expect(failed?.context?.errorClass).toBe('Deferred');
  });
});

// ── Connect-time fence — exclusive class (C10) ─────────────────────

describe('connect-time fence — exclusive class (C10)', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true, writable: true });
  });

  /**
   * A fresh, LOCALLY-produced row (no `lastSyncedValueAt`) — the Mode-1
   * connect edge: this host has never received a §4 value for the row, so
   * a connected peer can't yet trust the backend to be producing it.
   */
  function unsyncedCache(now: number, over: Partial<TestCacheRow> = {}): TestCacheRow {
    return {
      workflowUid: 'wflow001',
      environmentId: null,
      stepCaptures: {},
      extractedAt: now,
      expiresAt: now + 600_000,
      stepResponseBytes: {},
      consecutiveFailures: 0,
      lastExtractorOk: true,
      // deliberately NO lastSyncedValueAt
      ...over,
    };
  }

  async function fireWith(now: number, cache: TestCacheRow): Promise<void> {
    storeState.workflows = [makeWorkflow()];
    storeState.variables = [makeVariable()];
    storeState.caches = [cache];
    await H.scheduler.handleLiveAlarm({
      name: H.scheduler.buildAlarmName('ws-live', 'wflow001', null),
      scheduledTime: now,
    } as chrome.alarms.Alarm);
  }

  it('fences an exclusive cred while connected before any synced value lands — no refresh, no degrade', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    H.scheduler.setBackendConnectionProbe(() => true);
    deriveExecutionPolicyForWorkflowMock.mockReturnValue({
      policy: 'exclusive',
      reasons: [{ kind: 'totp', vaultName: 'otp' }],
    });
    const now = Date.now();

    await fireWith(now, unsyncedCache(now));

    // Did not race the freshly-connected backend's first run.
    expect(refreshSpy).not.toHaveBeenCalled();
    // No failure-counter bump — a deliberate skip, not a failure.
    expect(recordRefreshErrorMock).not.toHaveBeenCalled();
    // Unlike C9, the fence does NOT degrade the row — the gap is expected
    // (catch-up in flight) and must not flap the "reconnect" banner.
    expect(markExclusiveDegradedForRunMock).not.toHaveBeenCalled();
    // Logged as a no-op skip at info, errorClass ConnectFenced.
    const failed = recordLogMock.mock.calls
      .map((c) => c[0] as { op: string; level: string; context?: { errorClass?: string } })
      .find((e) => e.op === 'refresh-failed');
    expect(failed?.context?.errorClass).toBe('ConnectFenced');
    expect(failed?.level).toBe('info');
  });

  it('still self-refreshes an idempotent cred while connected before a synced value (warm on connect)', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    H.scheduler.setBackendConnectionProbe(() => true);
    // Default mock verdict is idempotent.
    const now = Date.now();

    await fireWith(now, unsyncedCache(now));

    expect(refreshSpy).toHaveBeenCalledOnce();
    expect(markExclusiveDegradedForRunMock).not.toHaveBeenCalled();
  });

  it('fences an exclusive synced value with no derivable expiry (rather than self-refreshing)', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    H.scheduler.setBackendConnectionProbe(() => true);
    deriveExecutionPolicyForWorkflowMock.mockReturnValue({
      policy: 'exclusive',
      reasons: [{ kind: 'totp', vaultName: 'otp' }],
    });
    const now = Date.now();

    // Synced (lastSyncedValueAt set) but expiresAt null — C8/C9 can't reason
    // about freshness, so the unified guard fences rather than self-refresh.
    await fireWith(now, unsyncedCache(now, { lastSyncedValueAt: now, expiresAt: null }));

    expect(refreshSpy).not.toHaveBeenCalled();
    // No proof of imminent expiry → fence (silent), not C9's degrade.
    expect(markExclusiveDegradedForRunMock).not.toHaveBeenCalled();
    const failed = recordLogMock.mock.calls
      .map((c) => c[0] as { op: string; context?: { errorClass?: string } })
      .find((e) => e.op === 'refresh-failed');
    expect(failed?.context?.errorClass).toBe('ConnectFenced');
  });

  it('self-refreshes an exclusive cred when NO backend is connected (sole runner)', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    // No probe → isBackendConnected() false → the whole guard is skipped.
    deriveExecutionPolicyForWorkflowMock.mockReturnValue({
      policy: 'exclusive',
      reasons: [{ kind: 'totp', vaultName: 'otp' }],
    });
    const now = Date.now();

    await fireWith(now, unsyncedCache(now));

    expect(refreshSpy).toHaveBeenCalledOnce();
    expect(markExclusiveDegradedForRunMock).not.toHaveBeenCalled();
    expect(deriveExecutionPolicyForWorkflowMock).not.toHaveBeenCalled();
  });
});

// ── Offline fallback election — exclusive class (C14) ──────────────

describe('offline fallback election — exclusive class (C14)', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true, writable: true });
  });

  /** A schedulable row for a configured-but-offline backend (no defer when disconnected). */
  function offlineCache(now: number): TestCacheRow {
    return {
      workflowUid: 'wflow001',
      environmentId: null,
      stepCaptures: {},
      extractedAt: now,
      expiresAt: now + 600_000,
      stepResponseBytes: {},
      consecutiveFailures: 0,
      lastExtractorOk: true,
      lastSyncedValueAt: now,
    };
  }

  async function fire(now: number): Promise<void> {
    storeState.workflows = [makeWorkflow()];
    storeState.variables = [makeVariable()];
    storeState.caches = [offlineCache(now)];
    await H.scheduler.handleLiveAlarm({
      name: H.scheduler.buildAlarmName('ws-live', 'wflow001', null),
      scheduledTime: now,
    } as chrome.alarms.Alarm);
  }

  /** Configured backend, currently OFFLINE. */
  function setupOfflineExclusive(refreshSpy: () => Promise<void>): void {
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    H.scheduler.setBackendConnectionProbe(() => false);
    deriveExecutionPolicyForWorkflowMock.mockReturnValue({
      policy: 'exclusive',
      reasons: [{ kind: 'totp', vaultName: 'otp' }],
    });
  }

  function lastFailed(): { level?: string; context?: { errorClass?: string } } | undefined {
    return recordLogMock.mock.calls
      .map((c) => c[0] as { op: string; level: string; context?: { errorClass?: string } })
      .find((e) => e.op === 'refresh-failed');
  }

  it('elected rank-0 eligible host self-refreshes as the single fallback runner', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    setupOfflineExclusive(refreshSpy);
    H.scheduler.setFallbackPriorityProbe(() => ({ order: ['p-self', 'p-other'], selfPrincipalId: 'p-self' }));

    await fire(Date.now());

    expect(refreshSpy).toHaveBeenCalledOnce();
    expect(markExclusiveDegradedForRunMock).not.toHaveBeenCalled();
  });

  it('consults the probe with the dispatching entry workspaceId (per-workspace list)', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    setupOfflineExclusive(refreshSpy);
    const seen: string[] = [];
    H.scheduler.setFallbackPriorityProbe((workspaceId) => {
      seen.push(workspaceId);
      // Elect self only in the dispatching workspace's list.
      return workspaceId === 'ws-live'
        ? { order: ['p-self'], selfPrincipalId: 'p-self' }
        : { order: ['p-other'], selfPrincipalId: 'p-self' };
    });

    await fire(Date.now());

    expect(seen).toEqual(['ws-live']);
    expect(refreshSpy).toHaveBeenCalledOnce();
  });

  it('outranked host does NOT refresh — degrades + logs FallbackNotElected', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    setupOfflineExclusive(refreshSpy);
    H.scheduler.setFallbackPriorityProbe(() => ({ order: ['p-other', 'p-self'], selfPrincipalId: 'p-self' }));

    await fire(Date.now());

    expect(refreshSpy).not.toHaveBeenCalled();
    // Deliberate skip, not a failure.
    expect(recordRefreshErrorMock).not.toHaveBeenCalled();
    // Degraded so the Status pill says "reconnect the desktop".
    expect(markExclusiveDegradedForRunMock).toHaveBeenCalledTimes(1);
    const [uid, envId, , ws] = markExclusiveDegradedForRunMock.mock.calls[0];
    expect(uid).toBe('wflow001');
    expect(envId).toBeNull();
    expect(ws).toBe('ws-live');
    expect(lastFailed()?.context?.errorClass).toBe('FallbackNotElected');
    expect(lastFailed()?.level).toBe('info');
  });

  it('ineligible (cross-device, lacks the seed) host does NOT refresh even at rank-0', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    setupOfflineExclusive(refreshSpy);
    // Would be rank-0, but the local seed gate overrides the ranking.
    isFallbackEligibleForWorkflowMock.mockReturnValue(false);
    H.scheduler.setFallbackPriorityProbe(() => ({ order: ['p-self'], selfPrincipalId: 'p-self' }));

    await fire(Date.now());

    expect(refreshSpy).not.toHaveBeenCalled();
    expect(markExclusiveDegradedForRunMock).toHaveBeenCalledTimes(1);
    expect(lastFailed()?.context?.errorClass).toBe('FallbackNotElected');
  });

  it('empty priority list is the SAFE default — banner, never a free-for-all race', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    setupOfflineExclusive(refreshSpy);
    H.scheduler.setFallbackPriorityProbe(() => ({ order: [], selfPrincipalId: 'p-self' }));

    await fire(Date.now());

    expect(refreshSpy).not.toHaveBeenCalled();
    expect(markExclusiveDegradedForRunMock).toHaveBeenCalledTimes(1);
    expect(lastFailed()?.context?.errorClass).toBe('FallbackNotElected');
  });

  it('idempotent rows self-refresh on every offline peer (no election, harmless)', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    H.scheduler.setBackendConnectionProbe(() => false);
    // Default mock verdict is idempotent.
    H.scheduler.setFallbackPriorityProbe(() => ({ order: ['p-other'], selfPrincipalId: 'p-self' }));

    await fire(Date.now());

    expect(refreshSpy).toHaveBeenCalledOnce();
    expect(markExclusiveDegradedForRunMock).not.toHaveBeenCalled();
  });

  it('pure Mode-1 (no backend configured) self-refreshes exclusive — gate dormant, policy never consulted', async () => {
    const refreshSpy = vi.fn<() => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    // No backend probe AND no fallback probe → the probe returns null →
    // the SW is the legitimate sole runner (plan §8).
    deriveExecutionPolicyForWorkflowMock.mockReturnValue({
      policy: 'exclusive',
      reasons: [{ kind: 'totp', vaultName: 'otp' }],
    });

    await fire(Date.now());

    expect(refreshSpy).toHaveBeenCalledOnce();
    expect(markExclusiveDegradedForRunMock).not.toHaveBeenCalled();
    expect(deriveExecutionPolicyForWorkflowMock).not.toHaveBeenCalled();
  });
});
