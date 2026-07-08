/**
 * Per-backend sync-status aggregation — the roll-up AND the per-backend
 * slot feed behind the connections-list row dots.
 *
 * Pins:
 *   - worst-of across slots wins the `sync` pill; within a state, most
 *     recent report wins; zero slots reads "Running in this browser";
 *   - the slot snapshot keys by backend id and drops torn-down backends;
 *   - subscribers fire on every report and drop with the full map.
 */

import { __clearBackendsForTests, refreshBackendsFromHostStorage } from '@openheaders/core/backends';
import { hostStorage, OH } from '@openheaders/core/storage';
import type { BackendSyncStatusSnapshot, Org } from '@openheaders/core/types';
import { __resetStatusForTests, getStatusSnapshot } from '@openheaders/ui/shared/status';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __resetSyncStatusAggregateForTests,
  dropBackendSyncStatus,
  getBackendSyncStatusSnapshot,
  refreshSyncStatusAggregate,
  reportBackendSyncStatus,
  subscribeBackendSyncStatus,
} from '../../src/background/sync-status-aggregate';
import { installSyntheticIdentityForTests, makeTestBackend, TEST_BACKEND_ID } from './sync/_identity-test-setup';

beforeEach(() => {
  __resetSyncStatusAggregateForTests();
  __resetStatusForTests();
});

describe('sync-status aggregate', () => {
  it('rolls worst-of across backends into the sync pill', () => {
    reportBackendSyncStatus('backend-a', { state: 'green', message: 'Synced with back-end' });
    reportBackendSyncStatus('backend-b', { state: 'red', message: 'Back-end requires authentication' });

    const sync = getStatusSnapshot().sync;
    expect(sync?.state).toBe('red');
    expect(sync?.message).toBe('Back-end requires authentication');
  });

  it('zero slots reads as the in-browser resting state', () => {
    reportBackendSyncStatus('backend-a', { state: 'green', message: 'Synced with back-end' });
    dropBackendSyncStatus('backend-a');

    const sync = getStatusSnapshot().sync;
    expect(sync?.state).toBe('green');
    expect(sync?.message).toBe('Running in this browser');
  });

  it('exposes per-backend slots keyed by record id', () => {
    reportBackendSyncStatus('backend-a', { state: 'green', message: 'Synced with back-end' });
    reportBackendSyncStatus('backend-b', {
      state: 'red',
      message: 'Back-end requires authentication',
      context: { reason: 'auth-required' },
    });

    expect(getBackendSyncStatusSnapshot()).toEqual({
      'backend-a': { state: 'green', message: 'Synced with back-end' },
      'backend-b': {
        state: 'red',
        message: 'Back-end requires authentication',
        context: { reason: 'auth-required' },
      },
    });
  });

  it('a torn-down backend leaves no slot behind', () => {
    reportBackendSyncStatus('backend-a', { state: 'green', message: 'Synced with back-end' });
    reportBackendSyncStatus('backend-b', { state: 'yellow', message: 'Handshaking with back-end…' });
    dropBackendSyncStatus('backend-a');

    expect(Object.keys(getBackendSyncStatusSnapshot())).toEqual(['backend-b']);
  });

  it('notifies subscribers with the full map on report and drop', () => {
    const seen: BackendSyncStatusSnapshot[] = [];
    subscribeBackendSyncStatus((snapshot) => seen.push(snapshot));

    reportBackendSyncStatus('backend-a', { state: 'green', message: 'Synced with back-end' });
    dropBackendSyncStatus('backend-a');

    expect(seen).toHaveLength(2);
    expect(Object.keys(seen[0])).toEqual(['backend-a']);
    expect(seen[1]).toEqual({});
  });
});

describe('disabled-but-bound backends', () => {
  const JOINED_ORG: Org = {
    id: 'org-backend',
    name: 'Johns-MacBook-Pro',
    hostKind: 'desktop',
    isPrivate: false,
  };
  let teardownIdentity: (() => void) | null = null;

  afterEach(() => {
    teardownIdentity?.();
    teardownIdentity = null;
    __clearBackendsForTests();
  });

  it('a disabled record still binding a joined Org turns the pill yellow', async () => {
    teardownIdentity = await installSyntheticIdentityForTests([], [{ org: JOINED_ORG, backendId: TEST_BACKEND_ID }]);
    await hostStorage.set(OH.backends, [makeTestBackend({ enabled: false, label: 'Desktop application' })]);
    await refreshBackendsFromHostStorage();

    refreshSyncStatusAggregate();

    const sync = getStatusSnapshot().sync;
    expect(sync?.state).toBe('yellow');
    expect(sync?.message).toBe("Desktop application is off — its workspaces aren't syncing");
    expect(sync?.context).toEqual({ reason: 'backend-off', backendId: TEST_BACKEND_ID });
    // Roll-up only — the per-backend slot feed stays pure wire truth.
    expect(getBackendSyncStatusSnapshot()).toEqual({});
  });

  it('a live report outranks the synthetic candidate within the same state', async () => {
    teardownIdentity = await installSyntheticIdentityForTests([], [{ org: JOINED_ORG, backendId: TEST_BACKEND_ID }]);
    await hostStorage.set(OH.backends, [
      makeTestBackend({ enabled: false, label: 'Desktop application' }),
      makeTestBackend({ id: 'backend-b', enabled: true }),
    ]);
    await refreshBackendsFromHostStorage();

    reportBackendSyncStatus('backend-b', { state: 'yellow', message: 'Handshaking with back-end…' });

    const sync = getStatusSnapshot().sync;
    expect(sync?.state).toBe('yellow');
    expect(sync?.message).toBe('Handshaking with back-end…');
  });

  it('a disabled record with no bound Orgs keeps the in-browser resting state', async () => {
    teardownIdentity = await installSyntheticIdentityForTests();
    await hostStorage.set(OH.backends, [makeTestBackend({ enabled: false, label: 'Desktop application' })]);
    await refreshBackendsFromHostStorage();

    refreshSyncStatusAggregate();

    const sync = getStatusSnapshot().sync;
    expect(sync?.state).toBe('green');
    expect(sync?.message).toBe('Running in this browser');
  });
});
