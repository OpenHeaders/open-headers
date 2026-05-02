/**
 * SW-side awareness lifeline — connection-bound liveness.
 *
 * Verifies the `chrome.runtime.onConnect` handler:
 *   - parses the `instanceId` out of the port name
 *   - ignores ports whose name doesn't match the prefix
 *   - removes the awareness row on `port.onDisconnect`
 *   - is idempotent (multiple `setupAwarenessLifelinePorts` calls only register one listener)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetAwarenessLifelineSetupForTests,
  buildLifelinePortName,
  setupAwarenessLifelinePorts,
} from '@/background/sync/awareness-lifeline';

type DisconnectListener = () => void;

interface FakePort {
  name: string;
  onDisconnect: { addListener: (l: DisconnectListener) => void };
  triggerDisconnect: () => void;
}

function makePort(name: string): FakePort {
  const listeners: DisconnectListener[] = [];
  return {
    name,
    onDisconnect: {
      addListener: (l) => {
        listeners.push(l);
      },
    },
    triggerDisconnect: () => {
      for (const l of listeners) l();
    },
  };
}

let connectListeners: Array<(port: FakePort) => void>;

beforeEach(() => {
  __resetAwarenessLifelineSetupForTests();
  connectListeners = [];
  const chromeStub = {
    runtime: {
      onConnect: {
        addListener: (l: (port: FakePort) => void) => {
          connectListeners.push(l);
        },
      },
      lastError: undefined as { message: string } | undefined,
    },
  };
  (globalThis as unknown as { chrome: typeof chromeStub }).chrome = chromeStub;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('awareness lifeline handler', () => {
  it('removes the row on port disconnect, keyed by instanceId from the port name', () => {
    const remove = vi.fn();
    setupAwarenessLifelinePorts(remove);

    const port = makePort(buildLifelinePortName('workbench-A'));
    connectListeners[0](port);
    port.triggerDisconnect();

    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith('workbench-A');
  });

  it('ignores ports whose name does not carry the lifeline prefix', () => {
    const remove = vi.fn();
    setupAwarenessLifelinePorts(remove);

    const port = makePort('popup');
    connectListeners[0](port);
    port.triggerDisconnect();

    expect(remove).not.toHaveBeenCalled();
  });

  it('ignores lifeline ports with an empty instanceId', () => {
    const remove = vi.fn();
    setupAwarenessLifelinePorts(remove);

    // Trailing colon, no instanceId — defensive guard against malformed names.
    const port = makePort('oh.awareness.lifeline:');
    connectListeners[0](port);
    port.triggerDisconnect();

    expect(remove).not.toHaveBeenCalled();
  });

  it('is idempotent — repeated setup calls register only one listener', () => {
    const remove = vi.fn();
    setupAwarenessLifelinePorts(remove);
    setupAwarenessLifelinePorts(remove);
    setupAwarenessLifelinePorts(remove);

    expect(connectListeners).toHaveLength(1);
  });

  it('disposes each port independently — disconnects of one do not affect another', () => {
    const remove = vi.fn();
    setupAwarenessLifelinePorts(remove);

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

  it('survives a remove callback that throws — does not break subsequent ports', () => {
    const remove = vi.fn().mockImplementationOnce(() => {
      throw new Error('boom');
    });
    setupAwarenessLifelinePorts(remove);

    const portA = makePort(buildLifelinePortName('inst-A'));
    const portB = makePort(buildLifelinePortName('inst-B'));
    connectListeners[0](portA);
    connectListeners[0](portB);

    portA.triggerDisconnect();
    portB.triggerDisconnect();

    expect(remove).toHaveBeenCalledTimes(2);
  });
});
