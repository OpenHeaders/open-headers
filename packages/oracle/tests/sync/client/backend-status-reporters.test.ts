/**
 * The per-backend status feed's shared installer: a handshake
 * coordinator's creation installs the handshake-phase reporter into
 * that backend's slot and its removal uninstalls it; every slot change
 * fans out as one `backendSyncStatusUpdated` broadcast carrying the
 * whole snapshot; the uninstall ends both legs.
 */

import type { HandshakeRejectReason } from '@openheaders/core/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installBackendStatusReporters } from '../../../src/sync/client/backend-status-reporters';
import type { HandshakeLifecycleEvent, SyncWiring } from '../../../src/sync/client/backend-sync-plane';
import type { SyncHandshakeHandles } from '../../../src/sync/client/backend-wire-handshake';
import type { InitiatorState } from '../../../src/sync/client/sync-handshake-initiator';
import {
  __resetSyncStatusAggregateForTests,
  reportBackendSyncStatus,
} from '../../../src/sync/client/sync-status-aggregate';

interface FakeInitiator {
  readonly listeners: Set<(state: InitiatorState) => void>;
  setReason(reason: HandshakeRejectReason | null): void;
  transition(state: InitiatorState): void;
}

function makeInitiator(): FakeInitiator & SyncHandshakeHandles['initiator'] {
  const listeners = new Set<(state: InitiatorState) => void>();
  let reason: HandshakeRejectReason | null = null;
  const fake = {
    listeners,
    setReason(next: HandshakeRejectReason | null) {
      reason = next;
    },
    rejectReason: () => reason,
    transition(state: InitiatorState) {
      for (const listener of [...listeners]) listener(state);
    },
    subscribe(listener: (state: InitiatorState) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    failureDetail: () => null,
  };
  return fake as unknown as FakeInitiator & SyncHandshakeHandles['initiator'];
}

function makeRig() {
  const lifecycle = new Set<(event: HandshakeLifecycleEvent) => void>();
  const syncWiring: Pick<SyncWiring, 'subscribeHandshakeLifecycle'> = {
    subscribeHandshakeLifecycle: (cb) => {
      lifecycle.add(cb);
      return () => lifecycle.delete(cb);
    },
  };
  const broadcast = vi.fn();
  const uninstall = installBackendStatusReporters({ syncWiring, broadcast });
  const fire = (event: HandshakeLifecycleEvent): void => {
    for (const cb of [...lifecycle]) cb(event);
  };
  return { broadcast, uninstall, fire, lifecycle };
}

afterEach(() => {
  __resetSyncStatusAggregateForTests();
});

describe('installBackendStatusReporters', () => {
  it('fans every slot change out as one backendSyncStatusUpdated broadcast with the whole snapshot', () => {
    const { broadcast } = makeRig();
    reportBackendSyncStatus('b1', { state: 'yellow', message: 'Connecting to back-end…' });
    expect(broadcast).toHaveBeenLastCalledWith('backendSyncStatusUpdated', {
      b1: { state: 'yellow', message: 'Connecting to back-end…' },
    });
    reportBackendSyncStatus('b2', { state: 'green', message: 'Connected to back-end', context: { phase: 'open' } });
    expect(broadcast).toHaveBeenLastCalledWith('backendSyncStatusUpdated', {
      b1: { state: 'yellow', message: 'Connecting to back-end…' },
      b2: { state: 'green', message: 'Connected to back-end', context: { phase: 'open' } },
    });
  });

  it("writes the handshake phases into the created wire's own slot, with the rejection reason", () => {
    const { broadcast, fire } = makeRig();
    const initiator = makeInitiator();
    fire({ kind: 'created', backendId: 'b1', handles: { initiator } as unknown as SyncHandshakeHandles });

    initiator.transition('hello-sent');
    expect(broadcast).toHaveBeenLastCalledWith('backendSyncStatusUpdated', {
      b1: { state: 'yellow', message: 'Handshaking with back-end…', context: { phase: 'hello-sent' } },
    });
    initiator.transition('synced');
    expect(broadcast).toHaveBeenLastCalledWith('backendSyncStatusUpdated', {
      b1: { state: 'green', message: 'Synced with back-end', context: { phase: 'synced' } },
    });
    initiator.setReason('auth-required');
    initiator.transition('rejected');
    expect(broadcast).toHaveBeenLastCalledWith('backendSyncStatusUpdated', {
      b1: {
        state: 'red',
        message: 'Back-end requires authentication',
        context: { phase: 'rejected', reason: 'auth-required' },
      },
    });
  });

  it("uninstalls the wire's reporter on its removal, and both legs on the uninstall", () => {
    const { broadcast, uninstall, fire, lifecycle } = makeRig();
    const first = makeInitiator();
    fire({ kind: 'created', backendId: 'b1', handles: { initiator: first } as unknown as SyncHandshakeHandles });
    expect(first.listeners.size).toBe(1);
    fire({ kind: 'removed', backendId: 'b1', handles: { initiator: first } as unknown as SyncHandshakeHandles });
    expect(first.listeners.size).toBe(0);

    const second = makeInitiator();
    fire({ kind: 'created', backendId: 'b2', handles: { initiator: second } as unknown as SyncHandshakeHandles });
    uninstall();
    expect(second.listeners.size).toBe(0);
    expect(lifecycle.size).toBe(0);
    broadcast.mockClear();
    reportBackendSyncStatus('b2', { state: 'green', message: 'Connected to back-end' });
    expect(broadcast).not.toHaveBeenCalled();
  });
});
