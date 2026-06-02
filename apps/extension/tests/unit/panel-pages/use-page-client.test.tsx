/**
 * usePageClient (P-a sibling for pages) — port lifecycle + replay routing
 * through the client store. Mirrors `useLifecycleClient.test.tsx`.
 */

import { type LifelinePort, type LifelineTransport, setLifelineTransport } from '@openheaders/core/awareness';
import { type HostNavigation, setHostNavigation } from '@openheaders/core/navigation';
import { pagePortName } from '@openheaders/core/page-stream';
import { createSyncNotifyScheduler, setNotifyScheduler } from '@openheaders/ui/panel/data/notify-scheduler';
import { usePageClient } from '@openheaders/ui/panel/data/use-page-client';
import { act, render } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface FakePort extends LifelinePort {
  readonly name: string;
  emit: (msg: unknown) => void;
  triggerDisconnect: (errorMessage?: string) => void;
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
  const { snapshot, tabId } = usePageClient();
  return (
    <ul data-tabid={tabId ?? 'null'}>
      {snapshot.pages.map((p) => (
        <li key={p.id}>
          {p.id}:{p.url ?? '(null)'}
        </li>
      ))}
    </ul>
  );
}

describe('usePageClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Replay routing is asserted per `act`; notify synchronously so a
    // single emit is observable without a frame flush.
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

  it('no port activity when no inspected tab is available', () => {
    installNavigation(null);
    const connect = vi.fn();
    installTransport(connect);
    render(<Probe />);
    expect(connect).not.toHaveBeenCalled();
  });

  it('opens oh-page:<tabId> and routes page-update into the store', () => {
    installNavigation(7);
    const port = fakePort(pagePortName(7));
    const connect = vi.fn(() => port);
    installTransport(connect);

    const { container } = render(<Probe />);
    expect(connect).toHaveBeenCalledWith('oh-page:7');

    act(() => {
      port.emit({ kind: 'ready', tabId: 7 });
      port.emit({
        kind: 'page-update',
        update: {
          kind: 'page-started',
          tabId: 7,
          page: { id: 'page_1', startedAtMs: 1, url: 'https://openheaders.io/x' },
        },
      });
    });
    expect(container.querySelector('li')?.textContent).toBe('page_1:https://openheaders.io/x');
  });

  it('ready clears the store before replay updates land', () => {
    installNavigation(3);
    const port = fakePort(pagePortName(3));
    installTransport(() => port);

    const { container } = render(<Probe />);
    act(() => {
      port.emit({ kind: 'ready', tabId: 3 });
      port.emit({
        kind: 'page-update',
        update: {
          kind: 'page-started',
          tabId: 3,
          page: { id: 'page_1', startedAtMs: 1, url: 'https://openheaders.io/old' },
        },
      });
    });
    expect(container.querySelector('li')?.textContent).toContain('page_1');

    act(() => {
      port.emit({ kind: 'ready', tabId: 3 });
    });
    expect(container.querySelector('li')).toBeNull();
  });

  it('reconnects with the 250ms backoff after disconnect', () => {
    installNavigation(9);
    const first = fakePort(pagePortName(9));
    const second = fakePort(pagePortName(9));
    const connect = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    installTransport(connect);

    render(<Probe />);
    expect(connect).toHaveBeenCalledTimes(1);
    act(() => {
      first.triggerDisconnect();
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it('cancels pending reconnect on unmount', () => {
    installNavigation(2);
    const port = fakePort(pagePortName(2));
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

  it('retries on connect throw', () => {
    installNavigation(4);
    const live = fakePort(pagePortName(4));
    let calls = 0;
    const connect = vi.fn(() => {
      calls++;
      if (calls === 1) throw new Error('Extension context invalidated');
      return live;
    });
    installTransport(connect);
    render(<Probe />);
    expect(connect).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(connect).toHaveBeenCalledTimes(2);
  });
});
