/**
 * Host-side awareness lifeline — connection-bound liveness AND
 * `WorkspaceServiceState` refcount handles (design § 4.0.7).
 *
 * Verifies the lifeline handler wired through the `lifelineServer` seam:
 *   - parses the `instanceId` out of the port name
 *   - ignores ports whose name doesn't match the prefix
 *   - removes the awareness row on port disconnect
 *   - is idempotent (multiple `setupAwarenessLifelinePorts` calls only register one handler)
 *   - acquires the workspace service on the first `bind` message
 *   - releases on disconnect or rebind (one port ↔ at most one workspace ref)
 */

import { type IncomingLifelinePort, setLifelineServer } from '@openheaders/core/awareness';
import {
  __resetAwarenessLifelineSetupForTests,
  buildLifelinePortName,
  setupAwarenessLifelinePorts,
} from '@openheaders/oracle/sync/awareness-lifeline';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface FakePort extends IncomingLifelinePort {
  triggerDisconnect: (info?: { errorMessage?: string }) => void;
  triggerMessage: (m: unknown) => void;
}

function makePort(name: string): FakePort {
  const disconnectListeners: Array<(info: { errorMessage?: string }) => void> = [];
  const messageListeners: Array<(message: unknown) => void> = [];
  return {
    name,
    onMessage(handler) {
      // The transport delivers raw frames — the handler's `T` is its
      // own typed assertion about the stream, mirroring the real seam.
      messageListeners.push(handler as (message: unknown) => void);
    },
    onDisconnect(handler) {
      disconnectListeners.push(handler);
    },
    triggerDisconnect: (info = {}) => {
      for (const l of disconnectListeners) l(info);
    },
    triggerMessage: (m) => {
      for (const l of messageListeners) l(m);
    },
  };
}

const noopHooks = {
  acquireWorkspace: () => {},
  releaseWorkspace: () => {},
};

let connectListeners: Array<(port: IncomingLifelinePort) => void>;

beforeEach(() => {
  __resetAwarenessLifelineSetupForTests();
  connectListeners = [];
  setLifelineServer({
    onConnect: (handler) => {
      connectListeners.push(handler);
      return () => {};
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('awareness lifeline handler', () => {
  it('removes the row on port disconnect, keyed by instanceId from the port name', () => {
    const remove = vi.fn();
    setupAwarenessLifelinePorts({ removeByInstanceId: remove, ...noopHooks });

    const port = makePort(buildLifelinePortName('workbench-A'));
    connectListeners[0](port);
    port.triggerDisconnect();

    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith('workbench-A');
  });

  it('ignores ports whose name does not carry the lifeline prefix', () => {
    const remove = vi.fn();
    setupAwarenessLifelinePorts({ removeByInstanceId: remove, ...noopHooks });

    const port = makePort('popup');
    connectListeners[0](port);
    port.triggerDisconnect();

    expect(remove).not.toHaveBeenCalled();
  });

  it('ignores lifeline ports with an empty instanceId', () => {
    const remove = vi.fn();
    setupAwarenessLifelinePorts({ removeByInstanceId: remove, ...noopHooks });

    // Trailing colon, no instanceId — defensive guard against malformed names.
    const port = makePort('oh.awareness.lifeline:');
    connectListeners[0](port);
    port.triggerDisconnect();

    expect(remove).not.toHaveBeenCalled();
  });

  it('is idempotent — repeated setup calls register only one handler', () => {
    const remove = vi.fn();
    setupAwarenessLifelinePorts({ removeByInstanceId: remove, ...noopHooks });
    setupAwarenessLifelinePorts({ removeByInstanceId: remove, ...noopHooks });
    setupAwarenessLifelinePorts({ removeByInstanceId: remove, ...noopHooks });

    expect(connectListeners).toHaveLength(1);
  });

  it('disposes each port independently — disconnects of one do not affect another', () => {
    const remove = vi.fn();
    setupAwarenessLifelinePorts({ removeByInstanceId: remove, ...noopHooks });

    const portA = makePort(buildLifelinePortName('inst-A'));
    const portB = makePort(buildLifelinePortName('inst-B'));
    connectListeners[0](portA);
    connectListeners[0](portB);

    portA.triggerDisconnect();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenLastCalledWith('inst-A');

    portB.triggerDisconnect();
    expect(remove).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenLastCalledWith('inst-B');
  });

  it('acquires a workspace on the first bind message and releases on disconnect', () => {
    const acquireWorkspace = vi.fn();
    const releaseWorkspace = vi.fn();
    setupAwarenessLifelinePorts({ removeByInstanceId: () => {}, acquireWorkspace, releaseWorkspace });

    const port = makePort(buildLifelinePortName('inst-A'));
    connectListeners[0](port);
    port.triggerMessage({ kind: 'bind', workspaceId: 'w1' });

    expect(acquireWorkspace).toHaveBeenCalledTimes(1);
    expect(acquireWorkspace).toHaveBeenCalledWith('w1');
    expect(releaseWorkspace).not.toHaveBeenCalled();

    port.triggerDisconnect();
    expect(releaseWorkspace).toHaveBeenCalledTimes(1);
    expect(releaseWorkspace).toHaveBeenCalledWith('w1');
  });

  it('rebinds release the previous workspace before acquiring the new one', () => {
    const acquireWorkspace = vi.fn();
    const releaseWorkspace = vi.fn();
    setupAwarenessLifelinePorts({ removeByInstanceId: () => {}, acquireWorkspace, releaseWorkspace });

    const port = makePort(buildLifelinePortName('inst-A'));
    connectListeners[0](port);
    port.triggerMessage({ kind: 'bind', workspaceId: 'w1' });
    port.triggerMessage({ kind: 'bind', workspaceId: 'w2' });

    expect(releaseWorkspace).toHaveBeenCalledWith('w1');
    expect(acquireWorkspace).toHaveBeenNthCalledWith(1, 'w1');
    expect(acquireWorkspace).toHaveBeenNthCalledWith(2, 'w2');

    port.triggerDisconnect();
    expect(releaseWorkspace).toHaveBeenLastCalledWith('w2');
    expect(releaseWorkspace).toHaveBeenCalledTimes(2);
  });

  it('same-workspace bind messages are no-ops (no double acquire)', () => {
    const acquireWorkspace = vi.fn();
    const releaseWorkspace = vi.fn();
    setupAwarenessLifelinePorts({ removeByInstanceId: () => {}, acquireWorkspace, releaseWorkspace });

    const port = makePort(buildLifelinePortName('inst-A'));
    connectListeners[0](port);
    port.triggerMessage({ kind: 'bind', workspaceId: 'w1' });
    port.triggerMessage({ kind: 'bind', workspaceId: 'w1' });
    port.triggerMessage({ kind: 'bind', workspaceId: 'w1' });

    expect(acquireWorkspace).toHaveBeenCalledTimes(1);
    expect(releaseWorkspace).not.toHaveBeenCalled();
  });

  it('ignores malformed bind messages and never touches the refcount', () => {
    const acquireWorkspace = vi.fn();
    const releaseWorkspace = vi.fn();
    setupAwarenessLifelinePorts({ removeByInstanceId: () => {}, acquireWorkspace, releaseWorkspace });

    const port = makePort(buildLifelinePortName('inst-A'));
    connectListeners[0](port);
    port.triggerMessage({ kind: 'unknown' });
    port.triggerMessage({ workspaceId: 'w1' });
    port.triggerMessage({ kind: 'bind', workspaceId: '' });
    port.triggerMessage(null);

    expect(acquireWorkspace).not.toHaveBeenCalled();
    port.triggerDisconnect();
    expect(releaseWorkspace).not.toHaveBeenCalled();
  });

  it('skips release on disconnect when no bind ever landed (liveness-only ports)', () => {
    const releaseWorkspace = vi.fn();
    setupAwarenessLifelinePorts({
      removeByInstanceId: () => {},
      acquireWorkspace: () => {},
      releaseWorkspace,
    });

    const port = makePort(buildLifelinePortName('inst-A'));
    connectListeners[0](port);
    port.triggerDisconnect();

    expect(releaseWorkspace).not.toHaveBeenCalled();
  });

  it('an acquireWorkspace throw clears the bound id so disconnect does not double-release', () => {
    const acquireWorkspace = vi.fn().mockImplementation(() => {
      throw new Error('workspace deleted');
    });
    const releaseWorkspace = vi.fn();
    setupAwarenessLifelinePorts({ removeByInstanceId: () => {}, acquireWorkspace, releaseWorkspace });

    const port = makePort(buildLifelinePortName('inst-A'));
    connectListeners[0](port);
    port.triggerMessage({ kind: 'bind', workspaceId: 'w1' });
    port.triggerDisconnect();

    expect(releaseWorkspace).not.toHaveBeenCalled();
  });

  it('survives a remove callback that throws — does not break subsequent ports', () => {
    const remove = vi.fn().mockImplementationOnce(() => {
      throw new Error('boom');
    });
    setupAwarenessLifelinePorts({ removeByInstanceId: remove, ...noopHooks });

    const portA = makePort(buildLifelinePortName('inst-A'));
    const portB = makePort(buildLifelinePortName('inst-B'));
    connectListeners[0](portA);
    connectListeners[0](portB);

    portA.triggerDisconnect();
    portB.triggerDisconnect();

    expect(remove).toHaveBeenCalledTimes(2);
  });
});
