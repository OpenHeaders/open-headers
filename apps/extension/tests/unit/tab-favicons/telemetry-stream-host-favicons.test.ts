/**
 * Telemetry stream host — the inventory read and the favicon pull.
 * Asserts:
 *   - a tabs-list request that reads favicons by key is answered from the
 *     keyed assembly; one that says nothing, from the inline one
 *   - a favicon pull answers on the `<type>:response` channel under its
 *     call id, with the icons this browser holds
 *   - a pull from a wire that is not on this device is claimed and dropped
 *   - a pull with no call id or no keys is not answered
 */

import '@openheaders/ui/workbench/settings/schema';
import type { TelemetryTabsFavicons } from '@openheaders/core/protocol';
import { TELEMETRY_TABS_FAVICONS_TYPE, TELEMETRY_TABS_LIST_TYPE } from '@openheaders/core/protocol';
import { RequestLifecycleHub } from '@openheaders/oracle/request-lifecycle-hub';
import { RequestLifecycleStore } from '@openheaders/oracle/request-lifecycle-store';
import type {
  BackendWireHandle,
  InboundFrameHandler,
} from '@openheaders/oracle/sync/client/backend-connection-manager';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { startTelemetryStreamHost, type TelemetryStreamHost } from '@/background/telemetry-stream-host';
import { resolveTabFavicon } from '@/background/telemetry-stream-host/tab-favicons';

const ICON = 'data:image/png;base64,c3RyZWFtIGhvc3QgaWNvbg==';
const TAB = { tabId: 3, windowId: 1, title: 'Docs', url: 'https://openheaders.io/docs', active: true };

function makeWire(backendId: string, loopback: boolean, wireSent: Record<string, unknown>[]): BackendWireHandle {
  return {
    backendId,
    record: () => {
      throw new Error('record() not used by the telemetry host');
    },
    isLoopback: () => loopback,
    isConnected: () => true,
    send: (data) => {
      wireSent.push(data);
      return true;
    },
  };
}

describe('telemetry stream host — inventory favicons', () => {
  let host: TelemetryStreamHost;
  let wireSent: Record<string, unknown>[];
  let asked: Array<TelemetryTabsFavicons | undefined>;
  let inbound: InboundFrameHandler | null;
  let wire: BackendWireHandle;
  let offWire: BackendWireHandle;

  async function deliver(frame: unknown, to: BackendWireHandle): Promise<boolean> {
    if (!inbound) throw new Error('inbound handler not registered');
    const claimed = await inbound(frame, to);
    await vi.advanceTimersByTimeAsync(10);
    return claimed;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    wireSent = [];
    asked = [];
    inbound = null;
    wire = makeWire('b1', true, wireSent);
    offWire = makeWire('b2', false, wireSent);
    host = startTelemetryStreamHost({
      hub: new RequestLifecycleHub({ store: new RequestLifecycleStore() }),
      send: () => true,
      registerInbound: (handler) => {
        inbound = handler;
        return () => {
          inbound = null;
        };
      },
      subscribeClose: () => () => undefined,
      listWires: () => [wire, offWire],
      queryTabs: async (favicons) => {
        asked.push(favicons);
        return [favicons === 'by-key' ? { ...TAB, favIconKey: 'k' } : { ...TAB, favIconUrl: ICON }];
      },
    });
  });

  afterEach(() => {
    host.dispose();
    vi.useRealTimers();
  });

  it('answers the inventory read the way its asker reads favicons', async () => {
    await deliver({ type: TELEMETRY_TABS_LIST_TYPE, favicons: 'by-key' }, wire);
    await deliver({ type: TELEMETRY_TABS_LIST_TYPE }, wire);

    expect(asked).toEqual(['by-key', undefined]);
    const replies = wireSent.filter((frame) => frame.type === `${TELEMETRY_TABS_LIST_TYPE}:response`);
    expect(replies.map((reply) => (reply.payload as { tabs: unknown[] }).tabs[0])).toEqual([
      { ...TAB, favIconKey: 'k' },
      { ...TAB, favIconUrl: ICON },
    ]);
  });

  it('answers a favicon pull under its call id with the icons it holds', async () => {
    const held = await resolveTabFavicon('https://openheaders.io/docs', ICON);
    if (held === undefined) throw new Error('the icon did not resolve');

    expect(
      await deliver({ type: TELEMETRY_TABS_FAVICONS_TYPE, callId: 'fv1', keys: [held.key, 'unknown'] }, wire),
    ).toBe(true);

    expect(wireSent.filter((frame) => frame.type === `${TELEMETRY_TABS_FAVICONS_TYPE}:response`)).toEqual([
      { type: `${TELEMETRY_TABS_FAVICONS_TYPE}:response`, callId: 'fv1', payload: { icons: { [held.key]: ICON } } },
    ]);
  });

  it('claims a pull from a wire that is not on this device and answers nothing', async () => {
    expect(await deliver({ type: TELEMETRY_TABS_FAVICONS_TYPE, callId: 'fv1', keys: ['k'] }, offWire)).toBe(true);
    expect(wireSent.filter((frame) => frame.type === `${TELEMETRY_TABS_FAVICONS_TYPE}:response`)).toEqual([]);
  });

  it('does not answer a pull that names no call or no keys', async () => {
    await deliver({ type: TELEMETRY_TABS_FAVICONS_TYPE, keys: ['k'] }, wire);
    await deliver({ type: TELEMETRY_TABS_FAVICONS_TYPE, callId: 'fv1' }, wire);
    expect(wireSent.filter((frame) => frame.type === `${TELEMETRY_TABS_FAVICONS_TYPE}:response`)).toEqual([]);
  });
});
