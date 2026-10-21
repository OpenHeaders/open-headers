// @vitest-environment jsdom
/**
 * DownloadFeedbackToast — the saved-download feedback: a `downloadDone`
 * broadcast with `completed` lands a success entry naming the file
 * with a "Show in folder" action that reveals that path through the
 * host; `interrupted` lands a warning; a host without the broadcast
 * (no bridge) renders nothing and pushes nothing.
 */

import { type BridgeBroadcastType, type HostBridge, setHostBridge } from '@openheaders/core/bridge';
import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import { getTranslator } from '@openheaders/i18n';
import { LocaleContext } from '@openheaders/ui/context/LocaleContext';
import {
  __resetNotificationsForTests,
  DownloadFeedbackToast,
  type NotificationEntry,
  useNotifications,
} from '@openheaders/ui/shared/notifications';
import { act, cleanup, render } from '@testing-library/react';
import { App } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const EN = { locale: 'en', direction: 'ltr' as const, t: getTranslator('en') };

let latest: readonly NotificationEntry[] = [];
type Handler = (payload: unknown) => void;
const handlers = new Map<string, Handler>();

function Probe() {
  latest = useNotifications();
  return null;
}

function Harness() {
  return (
    <LocaleContext.Provider value={EN}>
      <App>
        <DownloadFeedbackToast />
        <Probe />
      </App>
    </LocaleContext.Provider>
  );
}

function installBridge(): void {
  setHostBridge({
    call: vi.fn(),
    subscribe: (type: BridgeBroadcastType, handler: Handler) => {
      handlers.set(type, handler);
      return () => handlers.delete(type);
    },
    presence: () => () => {},
  } as unknown as HostBridge);
}

function broadcast(payload: unknown): void {
  act(() => {
    handlers.get('downloadDone')?.(payload);
  });
}

beforeEach(() => {
  __resetNotificationsForTests();
  handlers.clear();
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

afterEach(() => {
  cleanup();
  unregisterCapability('revealDownload');
});

describe('DownloadFeedbackToast', () => {
  it('lands a success entry naming the file, whose action reveals the path through the host', () => {
    installBridge();
    const reveal = vi.fn(async () => {});
    registerCapability('revealDownload', reveal);
    render(<Harness />);
    broadcast({
      filename: 'openheaders-diagnostics-desktop.zip',
      path: '/Users/jane/Downloads/x.zip',
      state: 'completed',
    });
    expect(latest).toHaveLength(1);
    expect(latest[0].severity).toBe('success');
    expect(latest[0].title).toBe('Saved openheaders-diagnostics-desktop.zip');
    expect(latest[0].actions?.map((a) => a.label)).toEqual(['Show in folder']);
    latest[0].actions?.[0]?.run();
    expect(reveal).toHaveBeenCalledWith('/Users/jane/Downloads/x.zip');
  });

  it('lands a warning for an interrupted save and nothing without a bridge', () => {
    installBridge();
    render(<Harness />);
    broadcast({ filename: 'a.json', path: '/Users/jane/Downloads/a.json', state: 'interrupted' });
    expect(latest.map((n) => [n.severity, n.title])).toEqual([['warning', 'Could not save a.json']]);
    cleanup();
    __resetNotificationsForTests();
    handlers.clear();
    setHostBridge(null as unknown as HostBridge);
    render(<Harness />);
    expect(handlers.size).toBe(0);
    expect(latest).toHaveLength(0);
  });
});
