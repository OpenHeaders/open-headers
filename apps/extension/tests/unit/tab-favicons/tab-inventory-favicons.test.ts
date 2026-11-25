/**
 * Tab-inventory watch host — each watching wire gets its snapshots the
 * way it reads favicons. Asserts:
 *   - a wire that subscribes `by-key` is pushed keyed rows; one that
 *     says nothing is pushed the bytes inline (a host that predates keys)
 *   - a tab event pushes each wire its own kind, from one assembly per kind
 *   - a re-subscribe changes how a wire is pushed from then on
 */

import '@openheaders/ui/workbench/settings/schema';
import type {
  BrowserTabWire,
  TelemetryTabsFavicons,
  TelemetryTabsListResponsePayload,
} from '@openheaders/core/protocol';
import { TELEMETRY_TABS_PUSH_TYPE, TELEMETRY_TABS_SUBSCRIBE_TYPE } from '@openheaders/core/protocol';
import type {
  BackendWireHandle,
  InboundFrameHandler,
} from '@openheaders/oracle/sync/client/backend-connection-manager';
import { set as setSetting } from '@openheaders/ui/workbench/settings/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { startTabInventoryHost, type TabInventoryHost } from '@/background/telemetry-stream-host/tab-inventory';

const DEBOUNCE_MS = 20;
const ICON = 'data:image/png;base64,aWNvbg==';
const KEY = '0123456789abcdef';

const TAB = { tabId: 3, windowId: 1, title: 'Docs', url: 'https://openheaders.io/docs', active: true };
const KEYED: BrowserTabWire[] = [{ ...TAB, favIconKey: KEY }];
const INLINE: BrowserTabWire[] = [{ ...TAB, favIconUrl: ICON }];

interface SentFrame {
  backendId: string;
  frame: Record<string, unknown>;
}

function makeWire(backendId: string): BackendWireHandle {
  return {
    backendId,
    record: () => {
      throw new Error('record() not used by the inventory host');
    },
    isLoopback: () => true,
    isConnected: () => true,
    send: () => true,
  };
}

describe('tab-inventory watch host — favicons', () => {
  let host: TabInventoryHost;
  let sent: SentFrame[];
  let asked: Array<TelemetryTabsFavicons | undefined>;
  let inbound: InboundFrameHandler | null;
  const keyedWire = makeWire('keyed');
  const inlineWire = makeWire('inline');

  async function deliver(frame: unknown, wire: BackendWireHandle): Promise<void> {
    if (!inbound) throw new Error('inbound handler not registered');
    await inbound(frame, wire);
    await vi.advanceTimersByTimeAsync(0);
  }

  function pushesTo(backendId: string): BrowserTabWire[][] {
    return sent
      .filter((entry) => entry.backendId === backendId && entry.frame.type === TELEMETRY_TABS_PUSH_TYPE)
      .map((entry) => (entry.frame.payload as TelemetryTabsListResponsePayload).tabs);
  }

  async function fireTabsEvent(): Promise<void> {
    const added = vi.mocked(chrome.tabs.onCreated.addListener).mock.calls;
    for (const [listener] of added) (listener as () => void)();
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 5);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    setSetting('backend.allowDesktopWatch', true);
    sent = [];
    asked = [];
    inbound = null;
    host = startTabInventoryHost({
      send: (backendId, frame) => {
        sent.push({ backendId, frame });
        return true;
      },
      registerInbound: (handler) => {
        inbound = handler;
        return () => {
          inbound = null;
        };
      },
      subscribeClose: () => () => undefined,
      queryTabs: async (favicons) => {
        asked.push(favicons);
        return favicons === 'by-key' ? KEYED : INLINE;
      },
      debounceMs: DEBOUNCE_MS,
    });
  });

  afterEach(() => {
    host.dispose();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('pushes keyed rows to a wire that subscribes by key and inline rows to one that says nothing', async () => {
    await deliver({ type: TELEMETRY_TABS_SUBSCRIBE_TYPE, favicons: 'by-key' }, keyedWire);
    await deliver({ type: TELEMETRY_TABS_SUBSCRIBE_TYPE }, inlineWire);

    expect(pushesTo('keyed')).toEqual([KEYED]);
    expect(pushesTo('inline')).toEqual([INLINE]);
  });

  it('pushes each wire its own kind on a tab event, from one assembly per kind', async () => {
    await deliver({ type: TELEMETRY_TABS_SUBSCRIBE_TYPE, favicons: 'by-key' }, keyedWire);
    await deliver({ type: TELEMETRY_TABS_SUBSCRIBE_TYPE, favicons: 'by-key' }, makeWire('keyed-2'));
    await deliver({ type: TELEMETRY_TABS_SUBSCRIBE_TYPE }, inlineWire);
    asked = [];
    sent = [];

    await fireTabsEvent();

    expect(pushesTo('keyed')).toEqual([KEYED]);
    expect(pushesTo('keyed-2')).toEqual([KEYED]);
    expect(pushesTo('inline')).toEqual([INLINE]);
    expect([...asked].sort()).toEqual(['by-key', undefined]);
  });

  it('pushes a wire the other way once it subscribes again that way', async () => {
    await deliver({ type: TELEMETRY_TABS_SUBSCRIBE_TYPE }, keyedWire);
    expect(pushesTo('keyed')).toEqual([INLINE]);

    await deliver({ type: TELEMETRY_TABS_SUBSCRIBE_TYPE, favicons: 'by-key' }, keyedWire);
    await fireTabsEvent();
    expect(pushesTo('keyed')).toEqual([INLINE, KEYED, KEYED]);
  });
});
