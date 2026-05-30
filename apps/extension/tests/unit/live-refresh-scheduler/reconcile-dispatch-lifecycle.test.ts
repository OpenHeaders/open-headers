/**
 * live-refresh-scheduler — Reconcile, alarm dispatch, and scheduler start/stop lifecycle.
 *
 * Shared mock graph + fixtures live in `./_harness`; the static import
 * registers its `vi.mock` calls and `beforeEach`/`afterEach` hooks. The
 * freshly re-imported module is reached as `H.scheduler` (a live binding).
 */

import type { LiveWorkflow } from '@openheaders/core/types';
import { describe, expect, it, vi } from 'vitest';
import * as H from './_harness';

const {
  makeWorkflow,
  makeVariable,
  NOW,
  storeState,
  activeSwitchState,
  alarmsCreateMock,
  alarmsClearMock,
  alarmsGetAllMock,
  recordLogMock,
  recordRefreshErrorMock,
} = H;

// ── Reconcile ─────────────────────────────────────────────────────

describe('reconcileLiveSchedules', () => {
  it('schedules every eligible workflow in the active workspace', async () => {
    storeState.workflows = [makeWorkflow({ uid: 'wflow001' }), makeWorkflow({ uid: 'wflow002', name: 'Other' })];
    storeState.variables = [makeVariable({ workflowUid: 'wflow001' }), makeVariable({ workflowUid: 'wflow002' })];
    await H.scheduler.reconcileLiveSchedules(NOW);
    // Two workflows × one implicit env (null) = two alarms.
    expect(alarmsCreateMock).toHaveBeenCalledTimes(2);
  });

  it('clears orphan alarms whose workflow no longer exists', async () => {
    storeState.workflows = [makeWorkflow({ uid: 'wflow001' })];
    storeState.variables = [makeVariable({ workflowUid: 'wflow001' })];
    // Pretend there's an orphan alarm from a previous scheduler run.
    const orphanName = H.scheduler.buildAlarmName('ws-live', 'wflow-ghost', null);
    const liveName = H.scheduler.buildAlarmName('ws-live', 'wflow001', null);
    alarmsGetAllMock.mockResolvedValue([
      { name: orphanName, scheduledTime: NOW + 100_000 } as chrome.alarms.Alarm,
      { name: liveName, scheduledTime: NOW + 200_000 } as chrome.alarms.Alarm,
    ]);
    await H.scheduler.reconcileLiveSchedules(NOW);
    expect(alarmsClearMock).toHaveBeenCalledWith(orphanName);
    expect(alarmsClearMock).not.toHaveBeenCalledWith(liveName);
  });

  it('schedules per-env-cache so env switches expose distinct alarms', async () => {
    storeState.workflows = [makeWorkflow({ uid: 'wflow001' })];
    storeState.variables = [makeVariable({ workflowUid: 'wflow001' })];
    storeState.caches = [
      {
        workflowUid: 'wflow001',
        environmentId: 'env-prod',
        stepCaptures: {},
        extractedAt: NOW - 10_000,
        expiresAt: null,
        stepResponseBytes: {},
        consecutiveFailures: 0,
        lastExtractorOk: true,
      },
      {
        workflowUid: 'wflow001',
        environmentId: 'env-dev',
        stepCaptures: {},
        extractedAt: NOW - 10_000,
        expiresAt: null,
        stepResponseBytes: {},
        consecutiveFailures: 0,
        lastExtractorOk: true,
      },
    ];
    await H.scheduler.reconcileLiveSchedules(NOW);
    // Two env-keyed cache rows → two alarms (one per env).
    expect(alarmsCreateMock).toHaveBeenCalledTimes(2);
    const names = alarmsCreateMock.mock.calls.map(([n]) => n);
    expect(names.sort()).toEqual(
      [
        H.scheduler.buildAlarmName('ws-live', 'wflow001', 'env-dev'),
        H.scheduler.buildAlarmName('ws-live', 'wflow001', 'env-prod'),
      ].sort(),
    );
  });

  it('does not schedule workflows with no enabled LV bindings', async () => {
    storeState.workflows = [makeWorkflow()];
    storeState.variables = []; // no LVs bound
    await H.scheduler.reconcileLiveSchedules(NOW);
    expect(alarmsCreateMock).not.toHaveBeenCalled();
  });
});

// ── handleLiveAlarm dispatch ──────────────────────────────────────

describe('handleLiveAlarm', () => {
  it('records scheduler-not-ready when no adapter is installed', async () => {
    storeState.workflows = [makeWorkflow()];
    storeState.variables = [makeVariable()];
    await H.scheduler.handleLiveAlarm({
      name: H.scheduler.buildAlarmName('ws-live', 'wflow001', null),
      scheduledTime: NOW,
    } as chrome.alarms.Alarm);
    expect(recordRefreshErrorMock).toHaveBeenCalledOnce();
    const arg = recordRefreshErrorMock.mock.calls[0][0];
    expect(arg.workflowUid).toBe('wflow001');
    expect(arg.message).toContain('scheduler-not-ready');
  });

  it('calls the installed adapter on successful dispatch', async () => {
    type RefreshArgs = { workspaceId: string; workflow: LiveWorkflow; environmentId: string | null };
    const refreshSpy = vi.fn<(args: RefreshArgs) => Promise<void>>(async () => {});
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    storeState.workflows = [makeWorkflow()];
    storeState.variables = [makeVariable()];
    await H.scheduler.handleLiveAlarm({
      name: H.scheduler.buildAlarmName('ws-live', 'wflow001', 'env-prod'),
      scheduledTime: NOW,
    } as chrome.alarms.Alarm);
    expect(refreshSpy).toHaveBeenCalledOnce();
    const arg = refreshSpy.mock.calls[0][0];
    expect(arg.workspaceId).toBe('ws-live');
    expect(arg.workflow.uid).toBe('wflow001');
    expect(arg.environmentId).toBe('env-prod');
  });

  it('records a refresh-succeeded log entry when the adapter resolves', async () => {
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: async () => {} });
    storeState.workflows = [makeWorkflow()];
    storeState.variables = [makeVariable()];
    await H.scheduler.handleLiveAlarm({
      name: H.scheduler.buildAlarmName('ws-live', 'wflow001', null),
      scheduledTime: NOW,
    } as chrome.alarms.Alarm);
    const ops = recordLogMock.mock.calls.map((call) => (call[0] as { op: string }).op);
    expect(ops).toContain('refresh-fired');
    expect(ops).toContain('refresh-succeeded');
  });

  it('catches adapter rejections and records a refresh-failed entry', async () => {
    H.scheduler.__setLiveRefreshAdapter({
      refreshWorkflow: async () => {
        throw new Error('boom');
      },
    });
    storeState.workflows = [makeWorkflow()];
    storeState.variables = [makeVariable()];
    await H.scheduler.handleLiveAlarm({
      name: H.scheduler.buildAlarmName('ws-live', 'wflow001', null),
      scheduledTime: NOW,
    } as chrome.alarms.Alarm);
    expect(recordRefreshErrorMock).toHaveBeenCalled();
    const ops = recordLogMock.mock.calls.map((call) => (call[0] as { op: string }).op);
    expect(ops).toContain('refresh-failed');
  });

  it('cancels the alarm when the workflow no longer exists', async () => {
    const refreshSpy = vi.fn();
    H.scheduler.__setLiveRefreshAdapter({ refreshWorkflow: refreshSpy });
    // Nothing in storeState.workflows → handler treats as deleted.
    await H.scheduler.handleLiveAlarm({
      name: H.scheduler.buildAlarmName('ws-live', 'wflow-gone', null),
      scheduledTime: NOW,
    } as chrome.alarms.Alarm);
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(alarmsClearMock).toHaveBeenCalledWith(H.scheduler.buildAlarmName('ws-live', 'wflow-gone', null));
  });

  it('ignores non-live alarms (wrong prefix)', async () => {
    await H.scheduler.handleLiveAlarm({ name: 'oauth-refresh:xxx', scheduledTime: NOW } as chrome.alarms.Alarm);
    expect(recordRefreshErrorMock).not.toHaveBeenCalled();
    expect(recordLogMock).not.toHaveBeenCalled();
  });
});

// ── Lifecycle + store-change reconcile ────────────────────────────

describe('startLiveScheduler', () => {
  it('subscribes to every live store and reconciles on change', async () => {
    storeState.workflows = [makeWorkflow()];
    storeState.variables = [makeVariable()];
    H.scheduler.startLiveScheduler();
    // Two subscribers per shared store now: the scheduler's own
    // reconcile + status listener, and the lifted definitional-freshness
    // module (LF1–LF4), which owns its own subscriptions.
    expect(storeState.listeners.workflow.size).toBe(2);
    expect(storeState.listeners.variable.size).toBe(2);
    expect(storeState.listeners.cache.size).toBe(2);
    expect(storeState.listeners.request.size).toBe(2);

    alarmsCreateMock.mockClear();
    // Simulate a workflow-store mutation.
    for (const fn of storeState.listeners.workflow) fn();
    // Reconcile is async (fire-and-forget); wait a microtask.
    await new Promise((r) => setTimeout(r, 0));
    expect(alarmsCreateMock).toHaveBeenCalled();
  });

  it('reconciles when a request-store mutation reshapes the dependency DAG', async () => {
    storeState.workflows = [makeWorkflow()];
    storeState.variables = [makeVariable()];
    H.scheduler.startLiveScheduler();
    expect(storeState.listeners.request.size).toBe(2);

    alarmsCreateMock.mockClear();
    // Simulate a request edit (e.g. a `{{live.X}}` ref added/removed).
    for (const fn of storeState.listeners.request) fn();
    await new Promise((r) => setTimeout(r, 0));
    expect(alarmsCreateMock).toHaveBeenCalled();
  });

  it('stopLiveScheduler tears down every listener', () => {
    H.scheduler.startLiveScheduler();
    expect(storeState.listeners.workflow.size).toBe(2);
    H.scheduler.stopLiveScheduler();
    expect(storeState.listeners.workflow.size).toBe(0);
    expect(storeState.listeners.variable.size).toBe(0);
    expect(storeState.listeners.cache.size).toBe(0);
    expect(storeState.listeners.request.size).toBe(0);
  });

  it('is idempotent — a second start call does not double-subscribe', () => {
    H.scheduler.startLiveScheduler();
    H.scheduler.startLiveScheduler();
    expect(storeState.listeners.workflow.size).toBe(2);
  });

  it('subscribes to active-workspace + active-env switch events', () => {
    H.scheduler.startLiveScheduler();
    // Two workspace subscribers: the scheduler's switch-warm pass + the
    // freshness module's deferred-cascade drain. Only the scheduler
    // watches active-env switches.
    expect(activeSwitchState.workspaceListeners.size).toBe(2);
    expect(activeSwitchState.envListeners.size).toBe(1);
    H.scheduler.stopLiveScheduler();
    expect(activeSwitchState.workspaceListeners.size).toBe(0);
    expect(activeSwitchState.envListeners.size).toBe(0);
  });
});
