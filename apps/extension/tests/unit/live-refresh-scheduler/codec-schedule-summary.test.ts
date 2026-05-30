/**
 * live-refresh-scheduler — Alarm codec, scheduling gate, schedule/cancel, and cache-summary projection.
 *
 * Shared mock graph + fixtures live in `./_harness`; the static import
 * registers its `vi.mock` calls and `beforeEach`/`afterEach` hooks. The
 * freshly re-imported module is reached as `H.scheduler` (a live binding).
 */

import { describe, expect, it } from 'vitest';
import * as H from './_harness';

const { makeWorkflow, makeVariable, makeRequest, NOW, storeState, alarmsCreateMock, alarmsClearMock } = H;

// ── Alarm name codec ──────────────────────────────────────────────

describe('alarm name codec', () => {
  it('round-trips (workspaceId, workflowUid, environmentId)', () => {
    const name = H.scheduler.buildAlarmName('ws-1', 'wflow001', 'env-prod');
    expect(name.startsWith('live-refresh:')).toBe(true);
    expect(H.scheduler.parseAlarmName(name)).toEqual({
      workspaceId: 'ws-1',
      workflowUid: 'wflow001',
      environmentId: 'env-prod',
    });
  });

  it('round-trips null environment id', () => {
    const name = H.scheduler.buildAlarmName('ws-1', 'wflow001', null);
    expect(H.scheduler.parseAlarmName(name)?.environmentId).toBeNull();
  });

  it('returns null for non-live alarms', () => {
    expect(H.scheduler.parseAlarmName('oauth-refresh:xxx')).toBeNull();
    expect(H.scheduler.parseAlarmName('unrelated')).toBeNull();
  });

  it('isLiveRefreshAlarm filters correctly', () => {
    expect(
      H.scheduler.isLiveRefreshAlarm({ name: H.scheduler.buildAlarmName('a', 'b', null) } as chrome.alarms.Alarm),
    ).toBe(true);
    expect(H.scheduler.isLiveRefreshAlarm({ name: 'oauth-refresh:x' } as chrome.alarms.Alarm)).toBe(false);
  });
});

// ── canScheduleWorkflow ───────────────────────────────────────────

describe('canScheduleWorkflow', () => {
  it('true when workflow is enabled AND has at least one enabled LV', () => {
    expect(H.scheduler.canScheduleWorkflow(makeWorkflow(), [makeVariable()])).toBe(true);
  });

  it('false when workflow is disabled', () => {
    expect(H.scheduler.canScheduleWorkflow(makeWorkflow({ enabled: false }), [makeVariable()])).toBe(false);
  });

  it('false when no enabled LV is bound to the workflow', () => {
    expect(H.scheduler.canScheduleWorkflow(makeWorkflow(), [])).toBe(false);
    expect(H.scheduler.canScheduleWorkflow(makeWorkflow(), [makeVariable({ enabled: false })])).toBe(false);
  });

  it('false when a step references a request that was deleted', () => {
    storeState.requestStoreHydrated = true;
    // `reqfetch1` deliberately not seeded — the backing request is gone.
    expect(H.scheduler.canScheduleWorkflow(makeWorkflow(), [makeVariable()])).toBe(false);
  });

  it('true when every step still resolves to an existing request', () => {
    storeState.requestStoreHydrated = true;
    storeState.requests.set('reqfetch1', makeRequest());
    expect(H.scheduler.canScheduleWorkflow(makeWorkflow(), [makeVariable()])).toBe(true);
  });

  it('skips the request-resolution check while the request store is cold', () => {
    // Not hydrated + `reqfetch1` unseeded — a cold-wake window must not
    // strip the alarm; the resolution gate stays dormant until hydrate.
    storeState.requestStoreHydrated = false;
    expect(H.scheduler.canScheduleWorkflow(makeWorkflow(), [makeVariable()])).toBe(true);
  });
});

// ── Schedule + cancel ─────────────────────────────────────────────

describe('scheduleLiveWorkflowRefresh', () => {
  it('creates an alarm for an eligible interval-based workflow', async () => {
    const scheduled = await H.scheduler.scheduleLiveWorkflowRefresh(
      {
        workspaceId: 'ws-live',
        workflow: makeWorkflow({ refresh: { kind: 'interval', seconds: 300 } }),
        boundVariables: [makeVariable()],
        cache: null,
        environmentId: null,
      },
      NOW,
    );
    expect(scheduled).toBe(true);
    expect(alarmsCreateMock).toHaveBeenCalledOnce();
    const [name, info] = alarmsCreateMock.mock.calls[0];
    expect(name).toBe(H.scheduler.buildAlarmName('ws-live', 'wflow001', null));
    expect(info.when).toBe(NOW + H.scheduler.MIN_ALARM_DELAY_MS);
  });

  it('skips + cancels manual-policy workflows', async () => {
    const scheduled = await H.scheduler.scheduleLiveWorkflowRefresh(
      {
        workspaceId: 'ws-live',
        workflow: makeWorkflow({ refresh: { kind: 'manual' } }),
        boundVariables: [makeVariable()],
        cache: null,
        environmentId: null,
      },
      NOW,
    );
    expect(scheduled).toBe(false);
    expect(alarmsCreateMock).not.toHaveBeenCalled();
    expect(alarmsClearMock).toHaveBeenCalled();
  });

  it('cancels alarm for disabled / unbound workflows', async () => {
    await H.scheduler.scheduleLiveWorkflowRefresh(
      {
        workspaceId: 'ws-live',
        workflow: makeWorkflow({ enabled: false }),
        boundVariables: [makeVariable()],
        cache: null,
        environmentId: null,
      },
      NOW,
    );
    expect(alarmsCreateMock).not.toHaveBeenCalled();
    expect(alarmsClearMock).toHaveBeenCalled();
  });

  it('cancelLiveWorkflowRefresh clears the alarm by name', async () => {
    await H.scheduler.cancelLiveWorkflowRefresh('ws-live', 'wflow001', 'env-prod');
    expect(alarmsClearMock).toHaveBeenCalledWith(H.scheduler.buildAlarmName('ws-live', 'wflow001', 'env-prod'));
  });
});

// ── Cache summary projection ──────────────────────────────────────

describe('toCacheSummary', () => {
  it('returns null for null input', () => {
    expect(H.scheduler.toCacheSummary(null)).toBeNull();
  });

  it('projects extractedAt / captures / failure state + circuit snapshot', () => {
    const circuit = {
      state: 'closed' as const,
      consecutiveFailures: 2,
      consecutiveOpenings: 0,
      nextAttemptAt: null,
      halfOpenAttempts: 0,
      lastSuccessAt: null,
      lastErrorAt: NOW - 30_000,
    };
    const summary = H.scheduler.toCacheSummary({
      workflowUid: 'wflow001',
      environmentId: null,
      stepCaptures: { fetch: { v: 'x' } },
      extractedAt: NOW - 10_000,
      expiresAt: null,
      stepResponseBytes: {},
      consecutiveFailures: 2,
      lastErrorAt: NOW - 30_000,
      lastExtractorOk: false,
      circuit,
    });
    expect(summary).toEqual({
      extractedAt: NOW - 10_000,
      stepCaptures: { fetch: { v: 'x' } },
      consecutiveFailures: 2,
      lastErrorAt: NOW - 30_000,
      circuit,
    });
  });

  it('defaults missing circuit to the initial closed snapshot', () => {
    // Normalize-on-read is the belt; this is the braces. toCacheSummary
    // must project a usable circuit even when the input row predates
    // the field — the cadence path dereferences `circuit.state` without
    // guarding.
    const summary = H.scheduler.toCacheSummary({
      workflowUid: 'wflow001',
      environmentId: null,
      stepCaptures: {},
      extractedAt: NOW,
      expiresAt: null,
      stepResponseBytes: {},
      consecutiveFailures: 0,
      lastExtractorOk: true,
      // circuit: absent
    } as unknown as Parameters<typeof H.scheduler.toCacheSummary>[0]);
    expect(summary?.circuit).toEqual({
      state: 'closed',
      consecutiveFailures: 0,
      consecutiveOpenings: 0,
      nextAttemptAt: null,
      halfOpenAttempts: 0,
      lastSuccessAt: null,
      lastErrorAt: null,
    });
  });
});
