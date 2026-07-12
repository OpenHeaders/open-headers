/**
 * useJsContexts — opens oh-contexts:<tabId> and feeds the
 * JsContextsClientStore from `JsContextsWireMessage` envelopes. Replace
 * semantics: `ready` clears before the live-set replay, so a context that
 * died while the port was down never survives a reconnect.
 */

import { type LifelinePort, type LifelineTransport, setLifelineTransport } from '@openheaders/core/awareness';
import type { JsContext } from '@openheaders/core/js-contexts';
import { type HostNavigation, setHostNavigation } from '@openheaders/core/navigation';
import { createSyncNotifyScheduler, setNotifyScheduler } from '@openheaders/ui/panel/data/stores/notify-scheduler';
import { useJsContexts } from '@openheaders/ui/panel/data/stores/use-js-contexts';
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

function context(contextKey: string, over: Partial<JsContext> = {}): JsContext {
  return {
    contextKey,
    origin: 'https://app.openheaders.io',
    name: '',
    isDefault: true,
    targetKind: 'page',
    worldType: 'default',
    ...over,
  };
}

function added(c: JsContext, tabId: number): unknown {
  return { kind: 'contexts-update', update: { kind: 'context-added', tabId, context: c } };
}

function removed(contextKey: string, tabId: number): unknown {
  return { kind: 'contexts-update', update: { kind: 'context-removed', tabId, contextKey } };
}

function Probe(): React.ReactElement {
  const { snapshot, tabId } = useJsContexts();
  return (
    <ul data-tabid={tabId ?? 'null'}>
      {snapshot.contexts.map((c: JsContext) => (
        <li key={c.contextKey}>
          {c.contextKey}:{c.name}
        </li>
      ))}
    </ul>
  );
}

describe('useJsContexts', () => {
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

  it('opens oh-contexts:<tabId>', () => {
    installNavigation(7);
    const port = fakePort('oh-contexts:7');
    const connect = vi.fn(() => port);
    installTransport(connect);
    render(<Probe />);
    expect(connect).toHaveBeenCalledWith('oh-contexts:7');
  });

  it('upserts added contexts and removes destroyed ones', () => {
    installNavigation(7);
    const port = fakePort('oh-contexts:7');
    installTransport(() => port);
    const { container } = render(<Probe />);
    act(() => {
      port.emit(added(context('page::1'), 7));
      port.emit(added(context('page::5', { name: 'Open Headers' }), 7));
      port.emit(added(context('page::1', { name: 'main' }), 7));
    });
    let items = container.querySelectorAll('li');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toBe('page::1:main');
    expect(items[1].textContent).toBe('page::5:Open Headers');
    act(() => {
      port.emit(removed('page::5', 7));
    });
    items = container.querySelectorAll('li');
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toBe('page::1:main');
  });

  it('clears on ready so a reconnect replay rebuilds the live set exactly', () => {
    installNavigation(7);
    const port = fakePort('oh-contexts:7');
    installTransport(() => port);
    const { container } = render(<Probe />);
    act(() => {
      port.emit(added(context('page::1'), 7));
      port.emit(added(context('page::2'), 7));
    });
    expect(container.querySelectorAll('li')).toHaveLength(2);
    act(() => {
      // Reconnect replay: page::2 died while the port was down — only the
      // live set re-emits, so the clear is what removes it.
      port.emit({ kind: 'ready', tabId: 7 });
      port.emit(added(context('page::1'), 7));
    });
    const items = container.querySelectorAll('li');
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toBe('page::1:');
  });

  it('clears the store on tab-cleared updates', () => {
    installNavigation(7);
    const port = fakePort('oh-contexts:7');
    installTransport(() => port);
    const { container } = render(<Probe />);
    act(() => {
      port.emit(added(context('page::1'), 7));
    });
    expect(container.querySelectorAll('li')).toHaveLength(1);
    act(() => {
      port.emit({ kind: 'contexts-update', update: { kind: 'tab-cleared', tabId: 7 } });
    });
    expect(container.querySelectorAll('li')).toHaveLength(0);
  });

  it('reconnects with the 250ms backoff after disconnect', () => {
    installNavigation(9);
    const first = fakePort('oh-contexts:9');
    const second = fakePort('oh-contexts:9');
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
