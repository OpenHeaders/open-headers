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
