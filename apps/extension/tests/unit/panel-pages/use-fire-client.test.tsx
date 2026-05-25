/**
 * useFireClient — opens devtools-inspector:<tabId>, filters to `fire`
 * variant only, feeds the FireClientStore.
 */

import { act, render } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type LifelinePort,
  type LifelineTransport,
  setLifelineTransport,
} from '@openheaders/core/awareness';
import { type HostNavigation, setHostNavigation } from '@openheaders/core/navigation';
import { useFireClient } from '@openheaders/ui/panel/data/use-fire-client';

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
    openResource: () => {},
  };
  setHostNavigation(nav);
}

function installTransport(connect: (name: string) => LifelinePort): void {
  const transport: LifelineTransport = { connect };
  setLifelineTransport(transport);
}

function Probe(): React.ReactElement {
  const { snapshot, tabId } = useFireClient();
  return (
    <ul data-tabid={tabId ?? 'null'}>
      {snapshot.fires.map((f) => (
        <li key={`${f.ruleUid}-${f.t}`}>
          {f.ruleUid}:{f.evidence}
        </li>
      ))}
    </ul>
  );
}

describe('useFireClient', () => {
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

  it('opens devtools-inspector:<tabId>', () => {
    installNavigation(7);
    const port = fakePort('devtools-inspector:7');
    const connect = vi.fn(() => port);
    installTransport(connect);
    render(<Probe />);
    expect(connect).toHaveBeenCalledWith('devtools-inspector:7');
  });

  it('ingests fire messages only — ignores everything else', () => {
    installNavigation(7);
    const port = fakePort('devtools-inspector:7');
    installTransport(() => port);
    const { container } = render(<Probe />);
    act(() => {
      port.emit({ type: 'har', entry: {}, chromeRequestId: 'r' });
      port.emit({ type: 'nav', url: 'https://openheaders.io' });
      port.emit({
        type: 'fire',
        authoritative: true,
        record: {
          ruleUid: 'rule_a',
          t: 1,
          pattern: '*',
          requestId: 'r1',
          evidence: 'confirmed',
        },
      });
    });
    expect(container.querySelectorAll('li')).toHaveLength(1);
    expect(container.querySelector('li')?.textContent).toBe('rule_a:confirmed');
  });

  it('reconnects with the 250ms backoff after disconnect', () => {
    installNavigation(9);
    const first = fakePort('devtools-inspector:9');
    const second = fakePort('devtools-inspector:9');
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
