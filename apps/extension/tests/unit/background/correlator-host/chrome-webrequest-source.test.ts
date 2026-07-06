/**
 * `ChromeWebRequestEventSource` — two fan-out channels over one set of
 * chrome listeners.
 *
 * Coverage:
 *   - tab-bound events reach only the lifecycle channel (`subscribe`);
 *   - `tabId === -1` + own-origin initiator events reach only the
 *     extension-traffic channel (`subscribeExtensionTraffic`);
 *   - `tabId === -1` events from foreign initiators (other extensions,
 *     browser internals) are dropped on both channels;
 *   - with no extension-traffic subscriber, `tabId === -1` events are
 *     dropped exactly as before (lifecycle channel byte-identical);
 *   - the extension-traffic channel carries the mapped oracle shape
 *     (responseHeaders / ip pass-through).
 */

import type {
  OnCompletedEvent,
  OnHeadersReceivedEvent,
  WebRequestEvent,
} from '@openheaders/oracle/correlator-heuristic';
import { beforeEach, describe, expect, it, type vi } from 'vitest';
import { ChromeWebRequestEventSource } from '@/background/correlator-host/chrome-webrequest-source';
import { chrome as chromeMock } from '../../../__mocks__/chrome';

const OWN_INITIATOR = 'chrome-extension://test-id';

function completedDetails(overrides: Record<string, unknown> = {}): object {
  return {
    tabId: 7,
    requestId: '41',
    url: 'https://api.openheaders.io/v1/users',
    method: 'GET',
    type: 'xmlhttprequest',
    timeStamp: 1_700_000_000_000,
    frameId: 0,
    statusCode: 200,
    statusLine: 'HTTP/1.1 200 OK',
    fromCache: false,
    ip: '203.0.113.10',
    ...overrides,
  };
}

function headersReceivedDetails(overrides: Record<string, unknown> = {}): object {
  return {
    tabId: -1,
    initiator: OWN_INITIATOR,
    requestId: '42',
    url: 'https://api.openheaders.io/v1/login',
    method: 'POST',
    type: 'xmlhttprequest',
    timeStamp: 1_700_000_000_100,
    frameId: 0,
    statusCode: 200,
    statusLine: 'HTTP/1.1 200 OK',
    responseHeaders: [{ name: 'Set-Cookie', value: 'session=abc; Path=/; HttpOnly' }],
    ...overrides,
  };
}

type ChromeListener = (details: object) => void;

function boundListener(event: { addListener: ReturnType<typeof vi.fn> }): ChromeListener {
  expect(event.addListener).toHaveBeenCalled();
  return event.addListener.mock.calls[0][0] as ChromeListener;
}

describe('ChromeWebRequestEventSource channels', () => {
  let source: ChromeWebRequestEventSource;
  let lifecycleEvents: WebRequestEvent[];
  let extensionEvents: WebRequestEvent[];

  beforeEach(() => {
    for (const event of Object.values(chromeMock.webRequest)) {
      (event.addListener as ReturnType<typeof vi.fn>).mockClear();
      (event.removeListener as ReturnType<typeof vi.fn>).mockClear();
    }
    source = new ChromeWebRequestEventSource();
    lifecycleEvents = [];
    extensionEvents = [];
  });

  it('routes tab-bound events to the lifecycle channel only', () => {
    source.subscribe((e) => lifecycleEvents.push(e));
    source.subscribeExtensionTraffic((e) => extensionEvents.push(e));
    boundListener(chromeMock.webRequest.onCompleted)(completedDetails());

    expect(lifecycleEvents).toHaveLength(1);
    expect(extensionEvents).toHaveLength(0);
    const event = lifecycleEvents[0] as OnCompletedEvent;
    expect(event.method_kind).toBe('onCompleted');
    expect(event.tabId).toBe(7);
    expect(event.ip).toBe('203.0.113.10');
  });

  it('routes own-origin tabId -1 events to the extension-traffic channel only', () => {
    source.subscribe((e) => lifecycleEvents.push(e));
    source.subscribeExtensionTraffic((e) => extensionEvents.push(e));
    boundListener(chromeMock.webRequest.onCompleted)(completedDetails({ tabId: -1, initiator: OWN_INITIATOR }));

    expect(lifecycleEvents).toHaveLength(0);
    expect(extensionEvents).toHaveLength(1);
    const event = extensionEvents[0] as OnCompletedEvent;
    expect(event.method_kind).toBe('onCompleted');
    expect(event.ip).toBe('203.0.113.10');
  });

  it('drops foreign-initiator tabId -1 events on both channels', () => {
    source.subscribe((e) => lifecycleEvents.push(e));
    source.subscribeExtensionTraffic((e) => extensionEvents.push(e));
    boundListener(chromeMock.webRequest.onCompleted)(
      completedDetails({ tabId: -1, initiator: 'chrome-extension://other-extension' }),
    );
    boundListener(chromeMock.webRequest.onCompleted)(completedDetails({ tabId: -1, initiator: undefined }));

    expect(lifecycleEvents).toHaveLength(0);
    expect(extensionEvents).toHaveLength(0);
  });

  it('drops tabId -1 events entirely when nothing subscribed to extension traffic', () => {
    source.subscribe((e) => lifecycleEvents.push(e));
    boundListener(chromeMock.webRequest.onCompleted)(completedDetails({ tabId: -1, initiator: OWN_INITIATOR }));

    expect(lifecycleEvents).toHaveLength(0);
  });

  it('carries the mapped oracle shape on the extension-traffic channel', () => {
    source.subscribeExtensionTraffic((e) => extensionEvents.push(e));
    boundListener(chromeMock.webRequest.onHeadersReceived)(headersReceivedDetails());

    expect(extensionEvents).toHaveLength(1);
    const event = extensionEvents[0] as OnHeadersReceivedEvent;
    expect(event.method_kind).toBe('onHeadersReceived');
    expect(event.responseHeaders).toEqual([{ name: 'Set-Cookie', value: 'session=abc; Path=/; HttpOnly' }]);
  });

  it('unsubscribe detaches the extension-traffic listener', () => {
    const unsubscribe = source.subscribeExtensionTraffic((e) => extensionEvents.push(e));
    unsubscribe();
    boundListener(chromeMock.webRequest.onCompleted)(completedDetails({ tabId: -1, initiator: OWN_INITIATOR }));

    expect(extensionEvents).toHaveLength(0);
  });
});
