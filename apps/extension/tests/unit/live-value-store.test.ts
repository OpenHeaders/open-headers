/**
 * WS-C C6 — live-value §4 propagation seam at the cache-store layer.
 *
 * Pins the host-neutral contract `live-value-store` (the sync bridge)
 * relies on:
 *   - `putWorkflowRunCache` fires the registered propagator with ONLY
 *     the value subset (never the bookkeeping fields).
 *   - `applySyncedLiveValues` (the receive side) merges a peer's value
 *     onto the local blob, preserving this host's runner bookkeeping,
 *     and creates a fresh row with default bookkeeping when absent.
 *   - An identical re-apply (the producer's own echo) is a no-op.
 *   - `clearWorkflowRunCache` fires the remover with the dropped keys.
 *
 * Uses the real store against the chrome.storage backing; an explicit
 * workspaceId avoids the active-workspace machinery.
 */

import type { LiveValueRecord } from '@openheaders/core/types';
import {
  applySyncedLiveValues,
  clearWorkflowRunCache,
  getWorkflowRunCache,
  markExclusiveDegradedForRun,
  markRunDefinitionallyStale,
  onLiveCacheStoreChange,
  putWorkflowRunCache,
  recordRefreshError,
  runKey,
  setLiveValuePropagator,
  setLiveValueRemover,
} from '@openheaders/oracle/live/live-cache-store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installBackingStorage } from '../helpers/chrome-storage-backing';

const WS = 'ws-1';
const WF = 'wf-1';

function value(over: Partial<LiveValueRecord> = {}): LiveValueRecord {
  return {
    workflowUid: WF,
    environmentId: null,
    stepCaptures: { s1: { token: 'fresh' } },
    extractedAt: 1000,
    expiresAt: 5000,
    ...over,
  };
}

beforeEach(() => {
  installBackingStorage();
  setLiveValuePropagator(null);
  setLiveValueRemover(null);
});

afterEach(() => {
  setLiveValuePropagator(null);
  setLiveValueRemover(null);
});

describe('putWorkflowRunCache → propagator', () => {
  it('fires the propagator with only the value subset', async () => {
    const propagator = vi.fn();
    setLiveValuePropagator(propagator);

    await putWorkflowRunCache(
      {
        workflowUid: WF,
        environmentId: null,
        stepCaptures: { s1: { token: 'fresh' } },
        stepResponseBytes: { s1: 42 },
        extractedAt: 1000,
        expiresAt: 5000,
      },
      WS,
    );

    expect(propagator).toHaveBeenCalledTimes(1);
    const [input, ws] = propagator.mock.calls[0];
    expect(ws).toBe(WS);
    expect(input.runKey).toBe(runKey(WF, null));
    expect(input.value).toEqual({
      workflowUid: WF,
      environmentId: null,
      stepCaptures: { s1: { token: 'fresh' } },
      extractedAt: 1000,
      expiresAt: 5000,
      // A successful run propagates its health as the synced subset's only
      // non-value field (C7).
      refreshHealth: 'ok',
    });
    // Bookkeeping / observability never crosses.
    expect(input.value).not.toHaveProperty('stepResponseBytes');
    expect(input.value).not.toHaveProperty('circuit');
    expect(input.value).not.toHaveProperty('consecutiveFailures');
  });
});

describe('applySyncedLiveValues — receive side', () => {
  it('creates a fresh row with default bookkeeping when absent', async () => {
    await applySyncedLiveValues(WS, { [runKey(WF, null)]: value() });

    const row = await getWorkflowRunCache(WF, null, WS);
    expect(row).not.toBeNull();
    expect(row?.stepCaptures).toEqual({ s1: { token: 'fresh' } });
    expect(row?.extractedAt).toBe(1000);
    expect(row?.expiresAt).toBe(5000);
    // Default bookkeeping for a synced-only row.
    expect(row?.consecutiveFailures).toBe(0);
    expect(row?.lastExtractorOk).toBe(true);
    expect(row?.circuit.state).toBe('closed');
    expect(row?.stepResponseBytes).toEqual({});
  });

  it('merges the value onto an existing row, preserving local bookkeeping', async () => {
    // Seed a row, then fail a refresh so bookkeeping accrues.
    await putWorkflowRunCache(
      {
        workflowUid: WF,
        environmentId: null,
        stepCaptures: { s1: { token: 'old' } },
        stepResponseBytes: { s1: 10 },
        extractedAt: 100,
        expiresAt: 200,
      },
      WS,
    );
    await recordRefreshError({ workflowUid: WF, environmentId: null, message: 'boom' }, WS);
    const before = await getWorkflowRunCache(WF, null, WS);
    expect(before?.consecutiveFailures).toBe(1);

    // A fresher value arrives from a peer.
    await applySyncedLiveValues(WS, {
      [runKey(WF, null)]: value({ stepCaptures: { s1: { token: 'fresh' } }, extractedAt: 9000, expiresAt: 9900 }),
    });

    const after = await getWorkflowRunCache(WF, null, WS);
    // Value subset updated…
    expect(after?.stepCaptures).toEqual({ s1: { token: 'fresh' } });
    expect(after?.extractedAt).toBe(9000);
    expect(after?.expiresAt).toBe(9900);
    // …local runner bookkeeping preserved (not reset by the sync merge).
    expect(after?.consecutiveFailures).toBe(1);
    expect(after?.lastErrorMessage).toBe('boom');
    expect(after?.stepResponseBytes).toEqual({ s1: 10 });
  });

  it('is a no-op (no notify) when the value is identical — the producer echo', async () => {
    await applySyncedLiveValues(WS, { [runKey(WF, null)]: value() });

    const changes: string[] = [];
    const off = onLiveCacheStoreChange((_ws, uid) => changes.push(uid ?? '*'));
    await applySyncedLiveValues(WS, { [runKey(WF, null)]: value() });
    off();

    expect(changes).toEqual([]);
  });

  it('stamps lastSyncedValueAt (C8 remote-sourced marker) on a merged remote value', async () => {
    const before = Date.now();
    await applySyncedLiveValues(WS, { [runKey(WF, null)]: value() });

    const row = await getWorkflowRunCache(WF, null, WS);
    expect(row?.lastSyncedValueAt).toBeGreaterThanOrEqual(before);
  });

  it('clears the marker when THIS host produces the value (own put is not remote-sourced)', async () => {
    // A remote value arrives first → row is marked remote-sourced.
    await applySyncedLiveValues(WS, { [runKey(WF, null)]: value() });
    expect((await getWorkflowRunCache(WF, null, WS))?.lastSyncedValueAt).not.toBeUndefined();

    // This host then runs the workflow itself — the fresh row is local,
    // so the marker is gone and the peer stops deferring.
    await putWorkflowRunCache(
      {
        workflowUid: WF,
        environmentId: null,
        stepCaptures: { s1: { token: 'local' } },
        stepResponseBytes: {},
        extractedAt: 12_000,
        expiresAt: 20_000,
      },
      WS,
    );
    expect((await getWorkflowRunCache(WF, null, WS))?.lastSyncedValueAt).toBeUndefined();
  });

  it('preserves the marker through a failed OWN refresh (peer keeps deferring)', async () => {
    await applySyncedLiveValues(WS, { [runKey(WF, null)]: value() });
    const marked = (await getWorkflowRunCache(WF, null, WS))?.lastSyncedValueAt;
    expect(marked).not.toBeUndefined();

    // A failed self-refresh must not erase the recent-remote-value fact.
    await recordRefreshError({ workflowUid: WF, environmentId: null, message: 'boom' }, WS);
    expect((await getWorkflowRunCache(WF, null, WS))?.lastSyncedValueAt).toBe(marked);
  });
});

describe('exclusiveDegradedSince — C9 escape-hatch marker', () => {
  it('marks an existing remote-sourced row degraded', async () => {
    await applySyncedLiveValues(WS, { [runKey(WF, null)]: value() });
    const before = Date.now();

    await markExclusiveDegradedForRun(WF, null, before, WS);

    expect((await getWorkflowRunCache(WF, null, WS))?.exclusiveDegradedSince).toBe(before);
  });

  it('is idempotent — a re-mark preserves the original since and does not notify', async () => {
    await applySyncedLiveValues(WS, { [runKey(WF, null)]: value() });
    await markExclusiveDegradedForRun(WF, null, 1234, WS);

    const changes: string[] = [];
    const off = onLiveCacheStoreChange((_ws, uid) => changes.push(uid ?? '*'));
    const result = await markExclusiveDegradedForRun(WF, null, 9999, WS);
    off();

    expect(result).toBeNull(); // no write on the steady-state re-check poll
    expect(changes).toEqual([]);
    expect((await getWorkflowRunCache(WF, null, WS))?.exclusiveDegradedSince).toBe(1234);
  });

  it('returns null for an absent row (nothing to degrade)', async () => {
    expect(await markExclusiveDegradedForRun(WF, null, 1234, WS)).toBeNull();
  });

  it('clears the mark when a fresh remote value lands (backend back)', async () => {
    await applySyncedLiveValues(WS, { [runKey(WF, null)]: value() });
    await markExclusiveDegradedForRun(WF, null, 1234, WS);
    expect((await getWorkflowRunCache(WF, null, WS))?.exclusiveDegradedSince).toBe(1234);

    // A genuinely-different remote value arrives → backend is producing again.
    await applySyncedLiveValues(WS, {
      [runKey(WF, null)]: value({ stepCaptures: { s1: { token: 'fresher' } }, extractedAt: 9000, expiresAt: 9900 }),
    });

    expect((await getWorkflowRunCache(WF, null, WS))?.exclusiveDegradedSince).toBeUndefined();
  });

  it('clears the mark when THIS host produces the value itself', async () => {
    await applySyncedLiveValues(WS, { [runKey(WF, null)]: value() });
    await markExclusiveDegradedForRun(WF, null, 1234, WS);

    await putWorkflowRunCache(
      {
        workflowUid: WF,
        environmentId: null,
        stepCaptures: { s1: { token: 'local' } },
        stepResponseBytes: {},
        extractedAt: 12_000,
        expiresAt: 20_000,
      },
      WS,
    );

    expect((await getWorkflowRunCache(WF, null, WS))?.exclusiveDegradedSince).toBeUndefined();
  });

  it('preserves the mark through a failed OWN refresh (backend not proven back)', async () => {
    await applySyncedLiveValues(WS, { [runKey(WF, null)]: value() });
    await markExclusiveDegradedForRun(WF, null, 1234, WS);

    await recordRefreshError({ workflowUid: WF, environmentId: null, message: 'boom' }, WS);

    expect((await getWorkflowRunCache(WF, null, WS))?.exclusiveDegradedSince).toBe(1234);
  });
});

describe('definitionallyStaleSince — deferring-consumer clear (audit C-1)', () => {
  it('stamps definitionallyStaleSince alongside the flag on the not-stale→stale transition', async () => {
    await applySyncedLiveValues(WS, { [runKey(WF, null)]: value() });
    const t0 = Date.now();

    await markRunDefinitionallyStale(WF, null, WS);

    const row = await getWorkflowRunCache(WF, null, WS);
    expect(row?.definitionallyStale).toBe(true);
    expect(row?.definitionallyStaleSince).toBeGreaterThanOrEqual(t0);
  });

  it('clears the flag + since when a synced value provably post-dates the edit (extractedAt ≥ since)', async () => {
    // A deferring consumer never produces locally, so this is its ONLY clear
    // path — without it the flag (and a 30s alarm hot-loop) sticks forever.
    await applySyncedLiveValues(WS, { [runKey(WF, null)]: value() });
    await markRunDefinitionallyStale(WF, null, WS);
    const since = (await getWorkflowRunCache(WF, null, WS))?.definitionallyStaleSince as number;
    expect(since).toBeTypeOf('number');

    await applySyncedLiveValues(WS, {
      [runKey(WF, null)]: value({
        stepCaptures: { s1: { token: 'corrected' } },
        extractedAt: since + 10,
        expiresAt: since + 10_000,
      }),
    });

    const after = await getWorkflowRunCache(WF, null, WS);
    expect(after?.definitionallyStale).toBeUndefined();
    expect(after?.definitionallyStaleSince).toBeUndefined();
    expect(after?.stepCaptures).toEqual({ s1: { token: 'corrected' } });
  });

  it('does NOT clear the flag for a value minted BEFORE the edit (wrong-recipe gate holds)', async () => {
    // The backend may push a value it minted before the recipe edit reached
    // it; clearing on that would reintroduce the wrong-recipe window the
    // timestamp gate exists to prevent.
    await applySyncedLiveValues(WS, { [runKey(WF, null)]: value() });
    await markRunDefinitionallyStale(WF, null, WS);
    const since = (await getWorkflowRunCache(WF, null, WS))?.definitionallyStaleSince as number;

    await applySyncedLiveValues(WS, {
      [runKey(WF, null)]: value({
        stepCaptures: { s1: { token: 'pre-edit' } },
        extractedAt: since - 1,
        expiresAt: since + 10_000,
      }),
    });

    const after = await getWorkflowRunCache(WF, null, WS);
    expect(after?.definitionallyStale).toBe(true);
    expect(after?.definitionallyStaleSince).toBe(since);
  });

  it('preserves the flag + since through a failed OWN refresh', async () => {
    await applySyncedLiveValues(WS, { [runKey(WF, null)]: value() });
    await markRunDefinitionallyStale(WF, null, WS);
    const since = (await getWorkflowRunCache(WF, null, WS))?.definitionallyStaleSince;

    await recordRefreshError({ workflowUid: WF, environmentId: null, message: 'boom' }, WS);

    const after = await getWorkflowRunCache(WF, null, WS);
    expect(after?.definitionallyStale).toBe(true);
    expect(after?.definitionallyStaleSince).toBe(since);
  });

  it('clears the flag + since when THIS host produces the value itself', async () => {
    await applySyncedLiveValues(WS, { [runKey(WF, null)]: value() });
    await markRunDefinitionallyStale(WF, null, WS);

    await putWorkflowRunCache(
      {
        workflowUid: WF,
        environmentId: null,
        stepCaptures: { s1: { token: 'local' } },
        stepResponseBytes: {},
        extractedAt: 12_000,
        expiresAt: 20_000,
      },
      WS,
    );

    const after = await getWorkflowRunCache(WF, null, WS);
    expect(after?.definitionallyStale).toBeUndefined();
    expect(after?.definitionallyStaleSince).toBeUndefined();
  });
});

describe('refreshHealth — C7 health sync', () => {
  async function seedHealthy(extractedAt = 1000): Promise<void> {
    await putWorkflowRunCache(
      {
        workflowUid: WF,
        environmentId: null,
        stepCaptures: { s1: { token: 'good' } },
        stepResponseBytes: {},
        extractedAt,
        expiresAt: 5000,
      },
      WS,
    );
  }

  it('propagates the preserved value + new health on a failure category transition', async () => {
    await seedHealthy();
    const propagator = vi.fn();
    setLiveValuePropagator(propagator);

    await recordRefreshError(
      { workflowUid: WF, environmentId: null, message: 'src down', refreshHealth: 'source-failing' },
      WS,
    );

    expect(propagator).toHaveBeenCalledTimes(1);
    const [{ value }] = propagator.mock.calls[0];
    // Captures are preserved (atomic refresh) — only health moved.
    expect(value.stepCaptures).toEqual({ s1: { token: 'good' } });
    expect(value.extractedAt).toBe(1000);
    expect(value.refreshHealth).toBe('source-failing');
  });

  it('does NOT re-propagate when the failure category is unchanged', async () => {
    await seedHealthy();
    await recordRefreshError(
      { workflowUid: WF, environmentId: null, message: 'src down', refreshHealth: 'source-failing' },
      WS,
    );
    const propagator = vi.fn();
    setLiveValuePropagator(propagator);

    await recordRefreshError(
      { workflowUid: WF, environmentId: null, message: 'still down', refreshHealth: 'source-failing' },
      WS,
    );

    expect(propagator).not.toHaveBeenCalled();
  });

  it('re-propagates when the category flips source-failing → auth-failing', async () => {
    await seedHealthy();
    await recordRefreshError(
      { workflowUid: WF, environmentId: null, message: 'src down', refreshHealth: 'source-failing' },
      WS,
    );
    const propagator = vi.fn();
    setLiveValuePropagator(propagator);

    await recordRefreshError(
      { workflowUid: WF, environmentId: null, message: '401', refreshHealth: 'auth-failing' },
      WS,
    );

    expect(propagator).toHaveBeenCalledTimes(1);
    expect(propagator.mock.calls[0][0].value.refreshHealth).toBe('auth-failing');
  });

  it('does NOT propagate a failure when no prior value exists (nothing to attach to)', async () => {
    const propagator = vi.fn();
    setLiveValuePropagator(propagator);

    await recordRefreshError(
      { workflowUid: WF, environmentId: null, message: 'src down', refreshHealth: 'source-failing' },
      WS,
    );

    expect(propagator).not.toHaveBeenCalled();
  });

  it('health-only merge updates refreshHealth without bumping lastSyncedValueAt or clearing degrade', async () => {
    await applySyncedLiveValues(WS, { [runKey(WF, null)]: value({ refreshHealth: 'ok' }) });
    await markExclusiveDegradedForRun(WF, null, 1234, WS);
    const stamp = (await getWorkflowRunCache(WF, null, WS))?.lastSyncedValueAt;

    // Identical captures/extractedAt/expiresAt — only the backend's health moved.
    await applySyncedLiveValues(WS, { [runKey(WF, null)]: value({ refreshHealth: 'source-failing' }) });

    const after = await getWorkflowRunCache(WF, null, WS);
    expect(after?.refreshHealth).toBe('source-failing');
    expect(after?.lastSyncedValueAt).toBe(stamp); // NOT bumped — no fresh value
    expect(after?.exclusiveDegradedSince).toBe(1234); // degrade preserved — backend still failing
  });

  it('a genuine value change sets health to ok and clears the degrade (backend recovered)', async () => {
    await applySyncedLiveValues(WS, { [runKey(WF, null)]: value({ refreshHealth: 'source-failing' }) });
    await markExclusiveDegradedForRun(WF, null, 1234, WS);

    await applySyncedLiveValues(WS, {
      [runKey(WF, null)]: value({
        stepCaptures: { s1: { token: 'fresh2' } },
        extractedAt: 9000,
        expiresAt: 9900,
        refreshHealth: 'ok',
      }),
    });

    const after = await getWorkflowRunCache(WF, null, WS);
    expect(after?.refreshHealth).toBe('ok');
    expect(after?.exclusiveDegradedSince).toBeUndefined();
  });
});

describe('clearWorkflowRunCache → remover', () => {
  it('fires the remover with the dropped run-keys', async () => {
    const remover = vi.fn();
    await applySyncedLiveValues(WS, {
      [runKey(WF, null)]: value(),
      [runKey(WF, 'env-2')]: value({ environmentId: 'env-2' }),
    });
    setLiveValueRemover(remover);

    const removed = await clearWorkflowRunCache(WF, WS);

    expect(removed).toBe(2);
    expect(remover).toHaveBeenCalledTimes(1);
    const [keys, ws] = remover.mock.calls[0];
    expect(ws).toBe(WS);
    expect([...keys].sort()).toEqual([runKey(WF, null), runKey(WF, 'env-2')].sort());
  });
});

// ── Per-step outcomes + skip-merge (graph overlay, PLAN §6.3) ───────
//
// The runner attests which steps completed vs gate-skipped; the write
// stamps that map AND preserves a skipped step's prior captures so its
// exposed `{{live.X}}` stays resolvable across a run that legitimately
// didn't execute it. The attestation is host-local bookkeeping: it
// survives failed refreshes (which preserve the captures it describes),
// never rides the propagator, and is dropped when a remote value lands.

describe('stepOutcomes + skip-merge', () => {
  it('stamps completed/skipped from the runner attestation and merges skipped prior captures', async () => {
    await putWorkflowRunCache(
      {
        workflowUid: WF,
        environmentId: null,
        stepCaptures: { root: { token: 'v1' }, gated: { refreshed: 'r1' } },
        stepResponseBytes: { root: 10, gated: 20 },
        extractedAt: 1000,
        expiresAt: null,
      },
      WS,
    );
    // Second run: `gated` is gate-skipped. Its prior capture (and byte
    // count) must survive the atomic commit; the outcome map records
    // the skip so consumers don't read presence as "ran".
    await putWorkflowRunCache(
      {
        workflowUid: WF,
        environmentId: null,
        stepCaptures: { root: { token: 'v2' } },
        stepResponseBytes: { root: 11 },
        extractedAt: 2000,
        expiresAt: null,
        skippedStepIds: ['gated'],
      },
      WS,
    );

    const row = await getWorkflowRunCache(WF, null, WS);
    expect(row?.stepCaptures).toEqual({ root: { token: 'v2' }, gated: { refreshed: 'r1' } });
    expect(row?.stepResponseBytes).toEqual({ root: 11, gated: 20 });
    expect(row?.stepOutcomes).toEqual({ root: 'completed', gated: 'skipped' });
  });

  it('drops steps that are neither completed nor skipped (deleted steps)', async () => {
    await putWorkflowRunCache(
      {
        workflowUid: WF,
        environmentId: null,
        stepCaptures: { legacy: { old: 'x' } },
        stepResponseBytes: {},
        extractedAt: 1000,
        expiresAt: null,
      },
      WS,
    );
    await putWorkflowRunCache(
      {
        workflowUid: WF,
        environmentId: null,
        stepCaptures: { root: { token: 'v2' } },
        stepResponseBytes: {},
        extractedAt: 2000,
        expiresAt: null,
        skippedStepIds: [],
      },
      WS,
    );

    const row = await getWorkflowRunCache(WF, null, WS);
    expect(row?.stepCaptures).toEqual({ root: { token: 'v2' } });
    expect(row?.stepOutcomes).toEqual({ root: 'completed' });
  });

  it('propagates the MERGED capture set but never the outcome map', async () => {
    await putWorkflowRunCache(
      {
        workflowUid: WF,
        environmentId: null,
        stepCaptures: { root: { token: 'v1' }, gated: { refreshed: 'r1' } },
        stepResponseBytes: {},
        extractedAt: 1000,
        expiresAt: null,
      },
      WS,
    );
    const propagator = vi.fn();
    setLiveValuePropagator(propagator);

    await putWorkflowRunCache(
      {
        workflowUid: WF,
        environmentId: null,
        stepCaptures: { root: { token: 'v2' } },
        stepResponseBytes: {},
        extractedAt: 2000,
        expiresAt: null,
        skippedStepIds: ['gated'],
      },
      WS,
    );

    const [input] = propagator.mock.calls[0];
    // A peer resolving {{live.X}} needs the full resolvable value set,
    // including the skip-preserved prior capture...
    expect(input.value.stepCaptures).toEqual({ root: { token: 'v2' }, gated: { refreshed: 'r1' } });
    // ...but the attestation is host-local and never crosses the wire.
    expect('stepOutcomes' in input.value).toBe(false);
  });

  it('a failed refresh preserves the outcome map with the captures it describes', async () => {
    await putWorkflowRunCache(
      {
        workflowUid: WF,
        environmentId: null,
        stepCaptures: { root: { token: 'v1' } },
        stepResponseBytes: {},
        extractedAt: 1000,
        expiresAt: null,
        skippedStepIds: ['gated'],
      },
      WS,
    );
    await recordRefreshError(
      { workflowUid: WF, environmentId: null, message: 'HTTP 500', failedStepId: 'root', extractorOk: true },
      WS,
    );

    const row = await getWorkflowRunCache(WF, null, WS);
    expect(row?.stepCaptures).toEqual({ root: { token: 'v1' } });
    expect(row?.stepOutcomes).toEqual({ root: 'completed', gated: 'skipped' });
    expect(row?.lastErrorStepId).toBe('root');
  });

  it('a synced remote value drops the local attestation', async () => {
    await putWorkflowRunCache(
      {
        workflowUid: WF,
        environmentId: null,
        stepCaptures: { root: { token: 'v1' } },
        stepResponseBytes: {},
        extractedAt: 1000,
        expiresAt: null,
      },
      WS,
    );
    await applySyncedLiveValues(WS, {
      [runKey(WF, null)]: value({ stepCaptures: { root: { token: 'remote' } }, extractedAt: 2000 }),
    });

    const row = await getWorkflowRunCache(WF, null, WS);
    expect(row?.stepCaptures).toEqual({ root: { token: 'remote' } });
    // This host cannot attest a remote run's per-step outcomes.
    expect(row?.stepOutcomes).toBeUndefined();
  });
});
