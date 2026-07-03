/**
 * useFireClient — opens oh-fires:<tabId> and feeds the FireClientStore
 * from `RuleFireWireMessage` envelopes.
 */

import { type LifelinePort, type LifelineTransport, setLifelineTransport } from '@openheaders/core/awareness';
import { type HostNavigation, setHostNavigation } from '@openheaders/core/navigation';
import { createSyncNotifyScheduler, setNotifyScheduler } from '@openheaders/ui/panel/data/stores/notify-scheduler';
import { useFireClient } from '@openheaders/ui/panel/data/stores/use-fire-client';
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
    // Fire routing is asserted per `act`; notify synchronously so a
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

  it('opens oh-fires:<tabId>', () => {
    installNavigation(7);
    const port = fakePort('oh-fires:7');
    const connect = vi.fn(() => port);
    installTransport(connect);
    render(<Probe />);
    expect(connect).toHaveBeenCalledWith('oh-fires:7');
  });

  it('ingests fire-update envelopes and ignores ready / unrelated kinds', () => {
    installNavigation(7);
    const port = fakePort('oh-fires:7');
    installTransport(() => port);
    const { container } = render(<Probe />);
    act(() => {
      port.emit({ kind: 'ready', tabId: 7 });
      port.emit({
        kind: 'fire-update',
        update: {
          kind: 'fire',
          tabId: 7,
          authoritative: true,
          record: {
            ruleUid: 'rule_a',
            url: 'https://openheaders.io/api',
            pattern: '*',
            resourceType: 'xmlhttprequest',
            t: 1,
            requestId: 'r1',
            evidence: 'confirmed',
          },
        },
      });
    });
    expect(container.querySelectorAll('li')).toHaveLength(1);
    expect(container.querySelector('li')?.textContent).toBe('rule_a:confirmed');
  });

  it('clears the store on tab-cleared updates', () => {
    installNavigation(7);
    const port = fakePort('oh-fires:7');
    installTransport(() => port);
    const { container } = render(<Probe />);
    act(() => {
      port.emit({
        kind: 'fire-update',
        update: {
          kind: 'fire',
          tabId: 7,
          authoritative: true,
          record: {
            ruleUid: 'rule_a',
            url: 'https://openheaders.io/api',
            pattern: '*',
            resourceType: 'xmlhttprequest',
            t: 1,
            requestId: 'r1',
            evidence: 'confirmed',
          },
        },
      });
    });
    expect(container.querySelectorAll('li')).toHaveLength(1);
    act(() => {
      port.emit({
        kind: 'fire-update',
        update: { kind: 'tab-cleared', tabId: 7 },
      });
    });
    expect(container.querySelectorAll('li')).toHaveLength(0);
  });

  it('reconnects with the 250ms backoff after disconnect', () => {
    installNavigation(9);
    const first = fakePort('oh-fires:9');
    const second = fakePort('oh-fires:9');
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
