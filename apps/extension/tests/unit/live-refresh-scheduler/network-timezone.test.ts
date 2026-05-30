/**
 * live-refresh-scheduler — Network-failure modes and timezone / system-clock invariance.
 *
 * Shared mock graph + fixtures live in `./_harness`; the static import
 * registers its `vi.mock` calls and `beforeEach`/`afterEach` hooks. The
 * freshly re-imported module is reached as `H.scheduler` (a live binding).
 */

import { describe, expect, it } from 'vitest';
import * as H from './_harness';

const { makeWorkflow, makeVariable, NOW, storeState, alarmsCreateMock, recordLogMock, recordRefreshErrorMock } = H;

// ── Network-failure modes (VPN disconnected, internet down) ───────
//
// The scheduler's contract when the adapter rejects: record the
// failure (so consecutiveFailures increments → cadence math picks
// up the backoff on the NEXT reconcile) and emit a refresh-failed
// log. The alarm ID stays the same across failures — one logical
// alarm per (workspace, workflow, env), whose `when` changes as
// failures accumulate. Tests here pin that invariant.

describe('network failure modes', () => {
  it('adapter throwing (e.g. ECONNREFUSED / VPN dropped) records failure and logs refresh-failed', async () => {
    H.scheduler.__setLiveRefreshAdapter({
      refreshWorkflow: async () => {
        // Realistic shape for a VPN-dropped fetch: the platform surfaces
        // as "Failed to fetch" / net::ERR_NETWORK_CHANGED up the stack.
        throw new Error('net::ERR_NETWORK_CHANGED');
      },
    });
    storeState.workflows = [makeWorkflow()];
    storeState.variables = [makeVariable()];
    await H.scheduler.handleLiveAlarm({
      name: H.scheduler.buildAlarmName('ws-live', 'wflow001', null),
      scheduledTime: NOW,
    } as chrome.alarms.Alarm);
    expect(recordRefreshErrorMock).toHaveBeenCalledOnce();
    const arg = recordRefreshErrorMock.mock.calls[0][0];
    expect(arg.message).toContain('net::ERR_NETWORK_CHANGED');
    // extractorOk=false signals a fetch-phase failure; the cache
    // store preserves last-good captures on this path.
    expect(arg.extractorOk).toBe(false);
    const ops = recordLogMock.mock.calls.map((c) => (c[0] as { op: string }).op);
    expect(ops).toContain('refresh-failed');
  });

  it('reconcile after a closed-state failure schedules at the pre-breaker tier (5s + jitter)', async () => {
    // Circuit is CLOSED with 1 consecutive failure (pre-breaker tier —
    // first two failures don't open the circuit). Cadence math picks
    // `lastErrorAt + 5s + jitter(0..5s)` per `computePreBreakerDelayMs`.
    // Since lastErrorAt is 10s ago and the tier adds up to 10s, the
    // computed target is in the past and the MV3 30s floor clamps.
    storeState.workflows = [makeWorkflow({ refresh: { kind: 'interval', seconds: 4 * 3600 } })];
    storeState.variables = [makeVariable()];
    storeState.caches = [
      {
        workflowUid: 'wflow001',
        environmentId: null,
        stepCaptures: {},
        extractedAt: NOW - 4 * 3600_000,
        expiresAt: NOW,
        stepResponseBytes: {},
        consecutiveFailures: 1,
        lastErrorAt: NOW - 10_000,
        lastErrorMessage: 'net::ERR_NETWORK_CHANGED',
        lastExtractorOk: false,
        circuit: {
          state: 'closed',
          consecutiveFailures: 1,
          consecutiveOpenings: 0,
          nextAttemptAt: null,
          halfOpenAttempts: 0,
          lastSuccessAt: null,
          lastErrorAt: NOW - 10_000,
        },
      },
    ];
    await H.scheduler.reconcileLiveSchedules(NOW);
    expect(alarmsCreateMock).toHaveBeenCalledOnce();
    const [, info] = alarmsCreateMock.mock.calls[0];
    // Clamped to `now + MIN_ALARM_DELAY_MS` plus reconcile-wave jitter.
    expect(info.when).toBeGreaterThanOrEqual(NOW + H.scheduler.MIN_ALARM_DELAY_MS);
    expect(info.when).toBeLessThan(NOW + H.scheduler.MIN_ALARM_DELAY_MS + 300);
  });

  it('reconcile with circuit OPEN schedules exactly at nextAttemptAt', async () => {
    // Circuit OPEN with nextAttemptAt 60s in the future — the alarm
    // MUST fire at that moment so the probe happens on schedule.
    // Matches v4 AdaptiveCircuitBreaker.nextAttemptTime semantics.
    storeState.workflows = [makeWorkflow({ refresh: { kind: 'interval', seconds: 4 * 3600 } })];
    storeState.variables = [makeVariable()];
    const nextAttemptAt = NOW + 60_000;
    storeState.caches = [
      {
        workflowUid: 'wflow001',
        environmentId: null,
        stepCaptures: {},
        extractedAt: NOW - 6 * 3600_000,
        expiresAt: null,
        stepResponseBytes: {},
        consecutiveFailures: 3,
        lastErrorAt: NOW - 1000,
        lastErrorMessage: 'boom',
        lastExtractorOk: false,
        circuit: {
          state: 'open',
          consecutiveFailures: 3,
          consecutiveOpenings: 1,
          nextAttemptAt,
          halfOpenAttempts: 0,
          lastSuccessAt: null,
          lastErrorAt: NOW - 1000,
        },
      },
    ];
    await H.scheduler.reconcileLiveSchedules(NOW);
    const [, info] = alarmsCreateMock.mock.calls[0];
    expect(info.when).toBeGreaterThanOrEqual(nextAttemptAt);
    expect(info.when).toBeLessThan(nextAttemptAt + 300);
  });

  it('circuit OPEN with deep consecutiveOpenings history uses longer backoff window', async () => {
    // consecutiveOpenings=4 → BASE × 2^3 = 240s. Same effective
    // behavior as v4's circuit-breaker after 4 open cycles.
    const nextAttemptAt = NOW + 240_000;
    storeState.workflows = [makeWorkflow({ refresh: { kind: 'interval', seconds: 4 * 3600 } })];
    storeState.variables = [makeVariable()];
    storeState.caches = [
      {
        workflowUid: 'wflow001',
        environmentId: null,
        stepCaptures: {},
        extractedAt: NOW - 6 * 3600_000,
        expiresAt: null,
        stepResponseBytes: {},
        consecutiveFailures: 6,
        lastErrorAt: NOW,
        lastErrorMessage: 'boom',
        lastExtractorOk: false,
        circuit: {
          state: 'open',
          consecutiveFailures: 6,
          consecutiveOpenings: 4,
          nextAttemptAt,
          halfOpenAttempts: 0,
          lastSuccessAt: null,
          lastErrorAt: NOW,
        },
      },
    ];
    await H.scheduler.reconcileLiveSchedules(NOW);
    const [, info] = alarmsCreateMock.mock.calls[0];
    expect(info.when).toBeGreaterThanOrEqual(nextAttemptAt);
    expect(info.when).toBeLessThan(nextAttemptAt + 300);
  });

  it('does not create a new alarm name per failure — one logical alarm per (ws, workflow, env)', async () => {
    H.scheduler.__setLiveRefreshAdapter({
      refreshWorkflow: async () => {
        throw new Error('boom');
      },
    });
    storeState.workflows = [makeWorkflow()];
    storeState.variables = [makeVariable()];
    const aname = H.scheduler.buildAlarmName('ws-live', 'wflow001', null);
    // Fire the alarm twice in a row (simulating two backoff ticks
    // failing in sequence) and verify the alarm identity is stable.
    await H.scheduler.handleLiveAlarm({ name: aname, scheduledTime: NOW } as chrome.alarms.Alarm);
    await H.scheduler.handleLiveAlarm({ name: aname, scheduledTime: NOW + 60_000 } as chrome.alarms.Alarm);
    // Two failure records, same alarm identity.
    expect(recordRefreshErrorMock).toHaveBeenCalledTimes(2);
    const firstKey = H.scheduler.buildAlarmName(
      (recordRefreshErrorMock.mock.calls[0][1] as string) ?? 'ws-live',
      recordRefreshErrorMock.mock.calls[0][0].workflowUid,
      recordRefreshErrorMock.mock.calls[0][0].environmentId,
    );
    expect(firstKey).toBe(aname);
  });
});

// ── Timezone + system-clock edge cases ────────────────────────────
//
// `computeNextFireAt` operates purely in ms-since-epoch — there is no
// timezone arithmetic anywhere in the cadence path, and Chrome's
// `alarms.create({ when })` takes the same absolute-ms value. These
// tests pin that contract so a future refactor can't accidentally
// introduce a `Date.parse`/`toLocaleString` drift.

describe('timezone + clock-skew invariance', () => {
  it('healthy-path when is derived from extractedAt, not nowMs (two close calls agree modulo jitter)', async () => {
    // Cache is well within the cadence window for both nowMs values
    // below, so `computeNextFireAt` returns `extractedAt + 300s` both
    // times and the MIN_ALARM floor never engages. Verifies the
    // cadence path is pinned to persisted extractedAt (tz-neutral)
    // rather than wall-clock arithmetic that might drift through
    // `new Date(...)` / `toLocaleString(...)`. The reconcile wave
    // adds 0–250ms random jitter on top (thundering-herd spread), so
    // the assertion is "both in the same 300ms window around the
    // target" rather than exact equality.
    storeState.workflows = [makeWorkflow({ refresh: { kind: 'interval', seconds: 300 } })];
    storeState.variables = [makeVariable()];
    storeState.caches = [
      {
        workflowUid: 'wflow001',
        environmentId: null,
        stepCaptures: {},
        extractedAt: NOW - 1000,
        expiresAt: NOW + 299_000,
        stepResponseBytes: {},
        consecutiveFailures: 0,
        lastExtractorOk: true,
      },
    ];
    const healthyTarget = NOW - 1000 + 300_000;
    await H.scheduler.reconcileLiveSchedules(NOW);
    const firstWhen = alarmsCreateMock.mock.calls[0]?.[1]?.when;
    expect(firstWhen).toBeDefined();
    expect(firstWhen!).toBeGreaterThanOrEqual(healthyTarget);
    expect(firstWhen!).toBeLessThan(healthyTarget + 300);
    alarmsCreateMock.mockClear();
    // Nudge nowMs forward by one minute — still well inside the
    // healthy window (target is at NOW+299s, floor is at NOW+60s+30s).
    await H.scheduler.reconcileLiveSchedules(NOW + 60_000);
    const secondWhen = alarmsCreateMock.mock.calls[0]?.[1]?.when;
    expect(secondWhen).toBeDefined();
    expect(secondWhen!).toBeGreaterThanOrEqual(healthyTarget);
    expect(secondWhen!).toBeLessThan(healthyTarget + 300);
  });

  it('clock jumping far forward clamps via nowMs (NOT via Date.now) — the injected nowMs wins', async () => {
    // When the computed target is in the past relative to `nowMs`,
    // the clamp moves `when` to `nowMs + MIN_ALARM_DELAY`. This test
    // pins that the INJECTED nowMs (not a leaked Date.now()) drives
    // the clamp — so a DST rollover / VM snapshot resume / NTP jump
    // can be simulated deterministically in tests without monkey-
    // patching globalThis.Date.
    storeState.workflows = [makeWorkflow({ refresh: { kind: 'interval', seconds: 300 } })];
    storeState.variables = [makeVariable()];
    storeState.caches = [
      {
        workflowUid: 'wflow001',
        environmentId: null,
        stepCaptures: {},
        extractedAt: NOW - 1000,
        expiresAt: NOW + 299_000,
        stepResponseBytes: {},
        consecutiveFailures: 0,
        lastExtractorOk: true,
      },
    ];
    const jumpedNow = NOW + 7 * 24 * 3600_000; // 7 days ahead
    await H.scheduler.reconcileLiveSchedules(jumpedNow);
    const when = alarmsCreateMock.mock.calls[0]?.[1]?.when;
    expect(when).toBeDefined();
    expect(when!).toBeGreaterThanOrEqual(jumpedNow + H.scheduler.MIN_ALARM_DELAY_MS);
    expect(when!).toBeLessThan(jumpedNow + H.scheduler.MIN_ALARM_DELAY_MS + 300);
  });

  it('clock jumping forward past the target re-arms at now+MIN_ALARM_DELAY', async () => {
    // e.g. user was asleep, laptop's RTC is now 10h ahead of when the
    // cache was stamped. Target = extractedAt + 300s is far in the past;
    // the scheduler must clamp rather than emit a when that Chrome
    // would treat as "fire immediately but burn alarm quota doing it."
    storeState.workflows = [makeWorkflow({ refresh: { kind: 'interval', seconds: 300 } })];
    storeState.variables = [makeVariable()];
    storeState.caches = [
      {
        workflowUid: 'wflow001',
        environmentId: null,
        stepCaptures: {},
        extractedAt: NOW - 10 * 3600_000,
        expiresAt: NOW - 10 * 3600_000 + 300_000,
        stepResponseBytes: {},
        consecutiveFailures: 0,
        lastExtractorOk: true,
      },
    ];
    await H.scheduler.reconcileLiveSchedules(NOW);
    const [, info] = alarmsCreateMock.mock.calls[0];
    expect(info.when).toBeGreaterThanOrEqual(NOW + H.scheduler.MIN_ALARM_DELAY_MS);
  });

  it('clock rolling backward still respects extractedAt (no negative intervals)', async () => {
    // Pathological: user manually set the system clock earlier than
    // extractedAt (VM restored from a snapshot; NTP correction after
    // boot on a drifted RTC). extractedAt is "future" relative to
    // nowMs — target = extractedAt + 300s is also future, the
    // scheduler just schedules farther out. No crash, no negative ms.
    storeState.workflows = [makeWorkflow({ refresh: { kind: 'interval', seconds: 300 } })];
    storeState.variables = [makeVariable()];
    const futureExtractedAt = NOW + 60 * 3600_000; // "extracted 60h from now"
    storeState.caches = [
      {
        workflowUid: 'wflow001',
        environmentId: null,
        stepCaptures: {},
        extractedAt: futureExtractedAt,
        expiresAt: futureExtractedAt + 300_000,
        stepResponseBytes: {},
        consecutiveFailures: 0,
        lastExtractorOk: true,
      },
    ];
    await H.scheduler.reconcileLiveSchedules(NOW);
    const [, info] = alarmsCreateMock.mock.calls[0];
    // Healthy-path target (extractedAt + 300s) wins — far in the
    // future, no clamp needed, and crucially > NOW.
    expect(info.when).toBeGreaterThan(NOW);
    expect(info.when).toBeGreaterThanOrEqual(futureExtractedAt + 300_000);
  });
});
