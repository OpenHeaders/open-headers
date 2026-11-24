/**
 * useLifecycleClient — a refused watch and its reason. Asserts:
 *   - a `watch-refused` envelope sets the refusal and carries its reason
 *   - `history-too-large` is ended by the client's own clear: the
 *     `clear-session` crosses, and the `ready` that follows lifts it
 *   - a consent refusal reports its own reason
 */

import { type LifelinePort, type LifelineTransport, setLifelineTransport } from '@openheaders/core/awareness';
import { type HostNavigation, setHostNavigation } from '@openheaders/core/navigation';
import { lifecyclePortName } from '@openheaders/core/request-lifecycle';
import { useLifecycleClient } from '@openheaders/ui/panel/data/lifecycle';
import { createSyncNotifyScheduler, setNotifyScheduler } from '@openheaders/ui/panel/data/stores/notify-scheduler';
import { act, render } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface FakePort extends LifelinePort {
  readonly posted: unknown[];
  emit: (msg: unknown) => void;
}

function fakePort(): FakePort {
  let onMessage: ((msg: unknown) => void) | null = null;
  const port: FakePort = {
    posted: [],
    postMessage(msg) {
      port.posted.push(msg);
    },
    onMessage(handler) {
      onMessage = handler as (msg: unknown) => void;
    },
    onDisconnect() {},
    disconnect() {},
    emit(msg) {
      onMessage?.(msg);
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
  const { watchRefused, watchRefusedReason, clearSession } = useLifecycleClient();
  return (
    <div data-refused={String(watchRefused)} data-reason={watchRefusedReason ?? 'none'}>
      <button type="button" onClick={clearSession}>
        clear
      </button>
    </div>
  );
}

function readState(container: HTMLElement): { refused: string | undefined; reason: string | undefined } {
  const root = container.querySelector<HTMLElement>('[data-refused]');
  return { refused: root?.dataset.refused, reason: root?.dataset.reason };
}

describe('useLifecycleClient — a refused watch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setNotifyScheduler(createSyncNotifyScheduler());
    installNavigation(7);
  });

  afterEach(() => {
    vi.useRealTimers();
    setNotifyScheduler(null);
    installNavigation(null);
    installTransport(() => ({ postMessage() {}, onMessage() {}, onDisconnect() {}, disconnect() {} }));
  });

  it('is not refused until the host says so', () => {
    const port = fakePort();
    installTransport(() => port);
    const { container } = render(<Probe />);
    act(() => port.emit({ kind: 'ready', tabId: 7, watermarkMs: -1 }));
    expect(readState(container)).toEqual({ refused: 'false', reason: 'none' });
  });

  it('a watch held for its history’s size reports that reason, and the client’s clear ends it', () => {
    const port = fakePort();
    const connect = vi.fn(() => port);
    installTransport(connect);
    const { container } = render(<Probe />);
    expect(connect).toHaveBeenCalledWith(lifecyclePortName(7));

    act(() => port.emit({ kind: 'watch-refused', tabId: 7, reason: 'history-too-large' }));
    expect(readState(container)).toEqual({ refused: 'true', reason: 'history-too-large' });

    port.posted.length = 0;
    act(() => container.querySelector('button')?.click());
    expect(port.posted).toEqual([{ kind: 'clear-session' }]);
    // Still refused until the host's stream answers.
    expect(readState(container).refused).toBe('true');

    act(() => port.emit({ kind: 'ready', tabId: 7, watermarkMs: -1 }));
    expect(readState(container)).toEqual({ refused: 'false', reason: 'none' });
  });

  it('a consent refusal reports its own reason', () => {
    const port = fakePort();
    installTransport(() => port);
    const { container } = render(<Probe />);
    act(() => port.emit({ kind: 'watch-refused', tabId: 7, reason: 'consent-off' }));
    expect(readState(container)).toEqual({ refused: 'true', reason: 'consent-off' });
  });
});
