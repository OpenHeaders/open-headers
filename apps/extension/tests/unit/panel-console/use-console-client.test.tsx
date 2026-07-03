/**
 * useConsoleClient — opens oh-console:<tabId> and feeds the
 * ConsoleClientStore from `ConsoleStreamWireMessage` envelopes. Unlike the
 * idempotent fire hook, replay is append-only, so `ready` must clear before
 * the replayed entries land.
 */

import { type LifelinePort, type LifelineTransport, setLifelineTransport } from '@openheaders/core/awareness';
import type { ConsoleEntry } from '@openheaders/core/console-stream';
import { type HostNavigation, setHostNavigation } from '@openheaders/core/navigation';
import { createSyncNotifyScheduler, setNotifyScheduler } from '@openheaders/ui/panel/data/stores/notify-scheduler';
import { useConsoleClient } from '@openheaders/ui/panel/data/stores/use-console-client';
import { act, render } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface FakePort extends LifelinePort {
  readonly name: string;
  emit: (msg: unknown) => void;
  triggerDisconnect: () => void;
}

function fakePort(name: string): FakePort {
  let onMessage: ((msg: unknown) => void) | null = null;
  let onDisconnect: ((info: { errorMessage?: string }) => void) | null = null;
  const port: FakePort = {
    name,
    postMessage() {},
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
    triggerDisconnect() {
      onDisconnect?.({});
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
    getInspectedHar: () => Promise.resolve(null),
    openResource: () => {},
  };
  setHostNavigation(nav);
}

function installTransport(connect: (name: string) => LifelinePort): void {
  const transport: LifelineTransport = { connect };
  setLifelineTransport(transport);
}

function entry(text: string, over: Partial<ConsoleEntry> = {}): ConsoleEntry {
  return {
    source: 'console-api',
    level: 'log',
    args: [{ type: 'string', text }],
    timestamp: 1,
    ...over,
  };
}

function consoleUpdate(e: ConsoleEntry, tabId: number): unknown {
  return { kind: 'console-update', update: { kind: 'entry', tabId, entry: e } };
}

function Probe(): React.ReactElement {
  const { snapshot, tabId } = useConsoleClient();
  return (
    <ul data-tabid={tabId ?? 'null'}>
      {snapshot.entries.map((e: ConsoleEntry, i: number) => (
        <li key={i}>
          {e.level}:{e.args.map((a) => a.text).join(' ')}
        </li>
      ))}
    </ul>
  );
}

describe('useConsoleClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setNotifyScheduler(createSyncNotifyScheduler());
  });

  afterEach(() => {
    vi.useRealTimers();
    setNotifyScheduler(null);
    installNavigation(null);
    installTransport(() => ({
      postMessage() {},
      onMessage() {},
      onDisconnect() {},
      disconnect() {},
    }));
  });

  it('opens oh-console:<tabId>', () => {
    installNavigation(7);
    const port = fakePort('oh-console:7');
    const connect = vi.fn(() => port);
    installTransport(connect);
    render(<Probe />);
    expect(connect).toHaveBeenCalledWith('oh-console:7');
  });

  it('appends entry updates in arrival order', () => {
    installNavigation(7);
    const port = fakePort('oh-console:7');
    installTransport(() => port);
    const { container } = render(<Probe />);
    act(() => {
      port.emit(consoleUpdate(entry('first'), 7));
      port.emit(consoleUpdate(entry('second', { level: 'error' }), 7));
    });
    const items = container.querySelectorAll('li');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toBe('log:first');
    expect(items[1].textContent).toBe('error:second');
  });

  it('clears on ready so a reconnect replay does not duplicate', () => {
    installNavigation(7);
    const port = fakePort('oh-console:7');
    installTransport(() => port);
    const { container } = render(<Probe />);
    act(() => {
      port.emit(consoleUpdate(entry('stale'), 7));
    });
    expect(container.querySelectorAll('li')).toHaveLength(1);
    act(() => {
      // Reconnect replay: ready resets, then the engine re-emits its snapshot.
      port.emit({ kind: 'ready', tabId: 7 });
      port.emit(consoleUpdate(entry('stale'), 7));
    });
    expect(container.querySelectorAll('li')).toHaveLength(1);
    expect(container.querySelector('li')?.textContent).toBe('log:stale');
  });

  it('clears the store on tab-cleared updates', () => {
    installNavigation(7);
    const port = fakePort('oh-console:7');
    installTransport(() => port);
    const { container } = render(<Probe />);
    act(() => {
      port.emit(consoleUpdate(entry('gone soon'), 7));
    });
    expect(container.querySelectorAll('li')).toHaveLength(1);
    act(() => {
      port.emit({ kind: 'console-update', update: { kind: 'tab-cleared', tabId: 7 } });
    });
    expect(container.querySelectorAll('li')).toHaveLength(0);
  });

  it('reconnects with the 250ms backoff after disconnect', () => {
    installNavigation(9);
    const first = fakePort('oh-console:9');
    const second = fakePort('oh-console:9');
    const connect = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    installTransport(connect);
    render(<Probe />);
    act(() => first.triggerDisconnect());
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(connect).toHaveBeenCalledTimes(2);
  });
});
