/**
 * NM auto-connect sentinel — the policy layer's arming discipline:
 *
 *   - a watch port opens only while a loopback backend is wanted but
 *     disconnected, the NM plane exists, and the `backend.nmAutoJoin`
 *     consent gate is on;
 *   - the host's up-signal dials the connection manager;
 *   - a connected wire tears the port down; a close re-arms it;
 *   - a port that dies without ever signaling up (outdated host,
 *     spawn failure) is suppressed until the next external trigger —
 *     one spawn per trigger, never a respawn loop.
 */

import '@openheaders/ui/workbench/settings/schema';
import { __clearBackendsForTests, refreshBackendsFromHostStorage } from '@openheaders/core/backends';
import { hostStorage, OH } from '@openheaders/core/storage';
import { set as setSetting } from '@openheaders/ui/workbench/settings/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  evaluateNmWatchSentinel,
  installNmWatchSentinel,
  resetNmWatchSentinelForTests,
} from '../../src/background/modules/nm-watch-sentinel';
import { NM_HOST_NAME } from '../../src/shared/nm-handoff';
import type { NmWatchPort } from '../../src/shared/nm-watch';
import { installSyntheticIdentityForTests, makeTestBackend } from './sync/_identity-test-setup';

const LOOPBACK_ID = '01900000-0000-7000-8000-00000000aaaa';
const LAN_ID = '01900000-0000-7000-8000-00000000bbbb';

class FakePort implements NmWatchPort {
  posted: Record<string, unknown>[] = [];
  disconnected = false;
  private messageListeners: ((message: unknown) => void)[] = [];
  private disconnectListeners: (() => void)[] = [];
  onMessage = { addListener: (callback: (message: unknown) => void) => this.messageListeners.push(callback) };
  onDisconnect = { addListener: (callback: () => void) => this.disconnectListeners.push(callback) };
  postMessage(message: Record<string, unknown>): void {
    this.posted.push(message);
  }
  disconnect(): void {
    this.disconnected = true;
  }
  emitUp(): void {
    for (const callback of this.messageListeners) callback({ kind: 'watch', up: true });
  }
  emitHeartbeat(): void {
    for (const callback of this.messageListeners) callback({ kind: 'watch', heartbeat: true });
  }
  emitDisconnect(): void {
    for (const callback of this.disconnectListeners) callback();
  }
}

describe('nm-watch-sentinel', () => {
  let teardownIdentity: () => void;
  let ports: FakePort[];
  let openedHosts: string[];
  let dialed: number;
  let connected: boolean;

  beforeEach(async () => {
    teardownIdentity = await installSyntheticIdentityForTests();
    resetNmWatchSentinelForTests();
    setSetting('backend.nmAutoJoin', true);
    ports = [];
    openedHosts = [];
    dialed = 0;
    connected = false;
  });

  afterEach(() => {
    resetNmWatchSentinelForTests();
    __clearBackendsForTests();
    teardownIdentity();
  });

  function install(): void {
    installNmWatchSentinel({
      connectNative: (host) => {
        openedHosts.push(host);
        const port = new FakePort();
        ports.push(port);
        return port;
      },
      watchAvailable: () => true,
      requestConnect: () => {
        dialed++;
      },
      isConnected: () => connected,
    });
  }

  async function seedBackends(records: ReturnType<typeof makeTestBackend>[]): Promise<void> {
    await hostStorage.set(OH.backends, records);
    await refreshBackendsFromHostStorage();
  }

  it('arms one watch port for a wanted-but-disconnected loopback backend', async () => {
    await seedBackends([makeTestBackend({ id: LOOPBACK_ID, url: 'ws://127.0.0.1:59210' })]);
    install();
    expect(openedHosts).toEqual([NM_HOST_NAME]);
    expect(ports[0].posted).toEqual([{ kind: 'watch', url: 'ws://127.0.0.1:59210' }]);
    // Re-evaluation while armed for the same URL never re-spawns.
    evaluateNmWatchSentinel({ clearSuppression: true });
    expect(ports).toHaveLength(1);
  });

  it('never arms without consent, a loopback record, autoConnect, or the record enabled', async () => {
    await seedBackends([makeTestBackend({ id: LAN_ID, url: 'ws://192.168.1.20:8137' })]);
    install();
    expect(ports).toEqual([]);

    await seedBackends([makeTestBackend({ id: LOOPBACK_ID, url: 'ws://127.0.0.1:59210', enabled: false })]);
    expect(ports).toEqual([]);

    await seedBackends([makeTestBackend({ id: LOOPBACK_ID, url: 'ws://127.0.0.1:59210', autoConnect: false })]);
    expect(ports).toEqual([]);

    setSetting('backend.nmAutoJoin', false);
    await seedBackends([makeTestBackend({ id: LOOPBACK_ID, url: 'ws://127.0.0.1:59210' })]);
    expect(ports).toEqual([]);
  });

  it('never arms while the loopback wire is already connected', async () => {
    connected = true;
    await seedBackends([makeTestBackend({ id: LOOPBACK_ID, url: 'ws://127.0.0.1:59210' })]);
    install();
    expect(ports).toEqual([]);
  });

  it('dials on the up-signal and absorbs heartbeats', async () => {
    await seedBackends([makeTestBackend({ id: LOOPBACK_ID, url: 'ws://127.0.0.1:59210' })]);
    install();
    ports[0].emitHeartbeat();
    expect(dialed).toBe(0);
    ports[0].emitUp();
    expect(dialed).toBe(1);
  });

  it('tears down once connected and re-arms on close', async () => {
    await seedBackends([makeTestBackend({ id: LOOPBACK_ID, url: 'ws://127.0.0.1:59210' })]);
    install();
    expect(ports).toHaveLength(1);
    connected = true;
    evaluateNmWatchSentinel({ clearSuppression: true });
    expect(ports[0].disconnected).toBe(true);
    connected = false;
    evaluateNmWatchSentinel({ clearSuppression: true });
    expect(ports).toHaveLength(2);
  });

  it('suppresses a dead-on-arrival host until the next external trigger', async () => {
    await seedBackends([makeTestBackend({ id: LOOPBACK_ID, url: 'ws://127.0.0.1:59210' })]);
    install();
    expect(ports).toHaveLength(1);
    // The port closes without ever signaling up — an outdated host
    // answering one frame, or a spawn failure.
    ports[0].emitDisconnect();
    expect(ports).toHaveLength(1);
    evaluateNmWatchSentinel();
    expect(ports).toHaveLength(1);
    // The alarm tick (or any registry/socket event) clears the latch.
    evaluateNmWatchSentinel({ clearSuppression: true });
    expect(ports).toHaveLength(2);
  });

  it('re-arms immediately when a port that DID signal up dies', async () => {
    await seedBackends([makeTestBackend({ id: LOOPBACK_ID, url: 'ws://127.0.0.1:59210' })]);
    install();
    ports[0].emitUp();
    ports[0].emitDisconnect();
    expect(ports).toHaveLength(2);
  });

  it('re-arms on a URL change via the registry trigger', async () => {
    await seedBackends([makeTestBackend({ id: LOOPBACK_ID, url: 'ws://127.0.0.1:59210' })]);
    install();
    expect(ports).toHaveLength(1);
    await seedBackends([makeTestBackend({ id: LOOPBACK_ID, url: 'ws://127.0.0.1:59310' })]);
    expect(ports[0].disconnected).toBe(true);
    expect(ports).toHaveLength(2);
    expect(ports[1].posted).toEqual([{ kind: 'watch', url: 'ws://127.0.0.1:59310' }]);
  });
});
