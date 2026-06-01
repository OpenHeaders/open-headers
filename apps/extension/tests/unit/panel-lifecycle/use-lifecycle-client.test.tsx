/**
 * useLifecycleClient (P4) — port lifecycle + replay routing through the
 * client store. Asserts:
 *   - bails out cleanly when no tab id is available
 *   - opens `oh-lifecycle:<tabId>` and routes wire messages into the store
 *   - `ready` clears state so reconnect replay rebuilds canonically
 *   - reconnects on disconnect (SW eviction) with the documented backoff
 *   - disconnects + cancels pending reconnects on unmount
 *   - sends the `subscribe` handshake: session-start on first connect,
 *     the learned watermark floor on reconnect, `-1` when the
 *     background-history toggle is on
 */

import { type LifelinePort, type LifelineTransport, setLifelineTransport } from '@openheaders/core/awareness';
import { type HostNavigation, setHostNavigation } from '@openheaders/core/navigation';
import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { lifecyclePortName } from '@openheaders/core/request-lifecycle';
import { useLifecycleClient } from '@openheaders/ui/panel/data/lifecycle';
import { act, render } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface FakePort extends LifelinePort {
  readonly name: string;
  readonly posted: unknown[];
  emit: (msg: unknown) => void;
  triggerDisconnect: (errorMessage?: string) => void;
}

function fakePort(name: string): FakePort {
  let onMessage: ((msg: unknown) => void) | null = null;
  let onDisconnect: ((info: { errorMessage?: string }) => void) | null = null;
  const port: FakePort = {
    name,
    posted: [],
    postMessage(msg) {
      port.posted.push(msg);
    },
    onMessage(handler) {
      onMessage = handler as (msg: unknown) => void;
    },
    onDisconnect(handler) {
      onDisconnect = handler;
    },
    disconnect() {},
    emit(msg) {
      onMessage?.(msg);
    },
    triggerDisconnect(errorMessage) {
      onDisconnect?.({ errorMessage });
    },
  };
  return port;
}

function installNavigation(tabId: number | null): void {
  const nav: HostNavigation = {
    switchViewMode: () => Promise.resolve({ opened: false }),
    currentWindowId: () => Promise.resolve(undefined),
    activeTabUrl: () => Promise.resolve(undefined),
    openUrl: () => {},
    openShortcutSettings: () => {},
    getActiveTab: () => Promise.resolve(null),
    observeActiveTabContext: () => () => {},
    inspectedTabId: () => tabId,
    reloadInspectedTab: () => {},
    openResource: () => {},
  };
  setHostNavigation(nav);
}

function installTransport(connect: (name: string) => LifelinePort): void {
  const transport: LifelineTransport = { connect };
  setLifelineTransport(transport);
}

function Probe(): React.ReactElement {
  const { snapshot, tabId, clearSession, showBackgroundHistory, setShowBackgroundHistory } = useLifecycleClient();
  return (
    <div>
      <button type="button" data-testid="toggle" onClick={() => setShowBackgroundHistory(!showBackgroundHistory)}>
        toggle
      </button>
      <button type="button" data-testid="clear" onClick={clearSession}>
        clear
      </button>
      <ul data-tabid={tabId ?? 'null'}>
        {snapshot.ordered.map((l: RequestLifecycle) => (
          <li key={l.requestId}>
            {l.requestId}:{l.phase}
          </li>
        ))}
      </ul>
    </div>
  );
}

describe('useLifecycleClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    installNavigation(null);
    installTransport(() => ({
      postMessage() {},
      onMessage() {},
      onDisconnect() {},
      disconnect() {},
    }));
  });

  it('returns tabId: null and no port activity when no inspected tab is available', () => {
    installNavigation(null);
    const connect = vi.fn();
    installTransport(connect);

    const { container } = render(<Probe />);
    expect(container.querySelector('ul')).toHaveProperty('dataset.tabid', 'null');
    expect(connect).not.toHaveBeenCalled();
  });

  it('opens oh-lifecycle:<tabId> and routes lifecycle-update into the store', () => {
    installNavigation(7);
    const port = fakePort(lifecyclePortName(7));
    const connect = vi.fn(() => port);
    installTransport(connect);

    const { container } = render(<Probe />);
    expect(connect).toHaveBeenCalledWith('oh-lifecycle:7');

    act(() => {
      port.emit({ kind: 'ready', tabId: 7, watermarkMs: -1 });
      port.emit({
        kind: 'lifecycle-update',
        update: {
          kind: 'started',
          lifecycle: {
            tabId: 7,
            requestId: 'r1',
            url: 'https://openheaders.io/a',
            method: 'GET',
            resourceType: 'xmlhttprequest',
            phase: 'pending',
            redirectHopCount: 0,
            redirectHops: [],
            startedAtMs: 1,
            hopStartedAtMs: 1,
            har: [],
            harBodyByHop: [],
          },
        },
      });
    });
    expect(container.querySelector('li')?.textContent).toBe('r1:pending');
  });

  it('clears store state on every `ready` so reconnect replay rebuilds canonically', () => {
    installNavigation(3);
    const port = fakePort(lifecyclePortName(3));
    installTransport(() => port);

    const { container } = render(<Probe />);
    act(() => {
      port.emit({ kind: 'ready', tabId: 3, watermarkMs: -1 });
      port.emit({
        kind: 'lifecycle-update',
        update: {
          kind: 'started',
          lifecycle: {
            tabId: 3,
            requestId: 'stale',
            url: 'https://openheaders.io/old',
            method: 'GET',
            resourceType: 'xmlhttprequest',
            phase: 'pending',
            redirectHopCount: 0,
            redirectHops: [],
            startedAtMs: 1,
            hopStartedAtMs: 1,
            har: [],
            harBodyByHop: [],
          },
        },
      });
    });
    expect(container.querySelector('li')?.textContent).toBe('stale:pending');

    act(() => {
      port.emit({ kind: 'ready', tabId: 3, watermarkMs: -1 });
    });
    expect(container.querySelector('li')).toBeNull();
  });

  it('clears store state on `tab-cleared` envelope from upstream tab close', () => {
    installNavigation(5);
    const port = fakePort(lifecyclePortName(5));
    installTransport(() => port);

    const { container } = render(<Probe />);
    act(() => {
      port.emit({ kind: 'ready', tabId: 5, watermarkMs: -1 });
      port.emit({
        kind: 'lifecycle-update',
        update: {
          kind: 'started',
          lifecycle: {
            tabId: 5,
            requestId: 'r-clear',
            url: 'https://openheaders.io/x',
            method: 'GET',
            resourceType: 'xmlhttprequest',
            phase: 'pending',
            redirectHopCount: 0,
            redirectHops: [],
            startedAtMs: 1,
            hopStartedAtMs: 1,
            har: [],
            harBodyByHop: [],
          },
        },
      });
    });
    expect(container.querySelector('li')?.textContent).toBe('r-clear:pending');

    act(() => {
      port.emit({ kind: 'tab-cleared', tabId: 5 });
    });
    expect(container.querySelector('li')).toBeNull();
  });

  it('reconnects after a disconnect using the documented 250ms backoff', () => {
    installNavigation(9);
    const first = fakePort(lifecyclePortName(9));
    const second = fakePort(lifecyclePortName(9));
    const connect = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    installTransport(connect);

    render(<Probe />);
    expect(connect).toHaveBeenCalledTimes(1);

    act(() => {
      first.triggerDisconnect();
    });
    expect(connect).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it('disconnects + cancels pending reconnect on unmount', () => {
    installNavigation(2);
    const port = fakePort(lifecyclePortName(2));
    const connect = vi.fn(() => port);
    installTransport(connect);

    const { unmount } = render(<Probe />);
    act(() => {
      port.triggerDisconnect();
    });
    unmount();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('retries on connect throw (extension context invalidated)', () => {
    installNavigation(4);
    const livePort = fakePort(lifecyclePortName(4));
    let calls = 0;
    const connect = vi.fn(() => {
      calls++;
      if (calls === 1) throw new Error('Extension context invalidated');
      return livePort;
    });
    installTransport(connect);

    render(<Probe />);
    expect(connect).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it('sends a session-start subscribe (no sinceMs) on first connect', () => {
    installNavigation(7);
    const port = fakePort(lifecyclePortName(7));
    installTransport(() => port);

    render(<Probe />);
    expect(port.posted).toEqual([{ kind: 'subscribe' }]);
  });

  it('re-subscribes with an engine-owned session floor (no sinceMs) after a reconnect', () => {
    installNavigation(9);
    const first = fakePort(lifecyclePortName(9));
    const second = fakePort(lifecyclePortName(9));
    const connect = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    installTransport(connect);

    render(<Probe />);
    expect(first.posted).toEqual([{ kind: 'subscribe' }]);

    // The engine reports its watermark, but the panel no longer carries the
    // floor — the engine owns the session, keyed by tab.
    act(() => {
      first.emit({ kind: 'ready', tabId: 9, watermarkMs: 4200 });
    });

    act(() => {
      first.triggerDisconnect();
      vi.advanceTimersByTime(250);
    });
    // The reconnect re-subscribes with an omitted floor; the engine
    // restores the SAME session floor it established for this tab, so an
    // in-flight request is not dropped.
    expect(second.posted).toEqual([{ kind: 'subscribe' }]);
  });

  it('clearSession drops the local mirror and posts clear-session to the engine', () => {
    installNavigation(11);
    const port = fakePort(lifecyclePortName(11));
    installTransport(() => port);

    const { container } = render(<Probe />);
    act(() => {
      port.emit({ kind: 'ready', tabId: 11, watermarkMs: -1 });
      port.emit({
        kind: 'lifecycle-update',
        update: {
          kind: 'started',
          lifecycle: {
            tabId: 11,
            requestId: 'r1',
            url: 'https://openheaders.io/a',
            method: 'GET',
            resourceType: 'xmlhttprequest',
            phase: 'pending',
            redirectHopCount: 0,
            redirectHops: [],
            startedAtMs: 1,
            hopStartedAtMs: 1,
            har: [],
            harBodyByHop: [],
          },
        },
      });
    });
    expect(container.querySelector('li')?.textContent).toBe('r1:pending');

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="clear"]')?.click();
    });
    // Local mirror dropped, and the engine is told to advance the session
    // floor so the cleared request does not replay on a later reconnect.
    expect(container.querySelector('li')).toBeNull();
    expect(port.posted).toContainEqual({ kind: 'clear-session' });
  });

  it('re-subscribes with -1 when the background-history toggle is turned on', () => {
    installNavigation(7);
    const port = fakePort(lifecyclePortName(7));
    installTransport(() => port);

    const { container } = render(<Probe />);
    act(() => {
      port.emit({ kind: 'ready', tabId: 7, watermarkMs: 4200 });
    });
    expect(port.posted).toEqual([{ kind: 'subscribe' }]);

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="toggle"]')?.click();
    });
    // Toggling on re-subscribes in place asking for everything retained.
    expect(port.posted[port.posted.length - 1]).toEqual({ kind: 'subscribe', sinceMs: -1 });
  });
});
