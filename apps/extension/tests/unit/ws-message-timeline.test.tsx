// @vitest-environment jsdom
/**
 * WsMessageTimeline — the WebSocket session's message-list surface.
 * Pins the Phase C laws: one row per captured message in true call
 * order with direction glyphs; lifecycle rows derived from props —
 * never invented — with "Connected" before the first message (no
 * interleave arithmetic: a client cannot write pre-handshake) and the
 * connecting/ended rows at the chronological edges, all flipping with
 * the sort; session-only timestamps rendered when provided, omitted
 * when not; search, direction filter, and Clear display-only over the
 * capture; the `requests.wsMessagesNewestFirst` setting (newest-first
 * default); binary frames labeled honestly with their byte count and
 * base64 in the expanded viewer; the rolling-retention drop count
 * surfaced as a notice. The shared Monaco CodeEditor is mocked to a
 * <textarea> — the contract under test is the list, not Monaco.
 */

import { encodeBase64Bytes } from '@openheaders/core/utils';
import WsMessageTimeline, {
  type WsTimelineItem,
  type WsTimelineLifecycle,
} from '@openheaders/ui/workbench/components/websocket-request-editor/WsMessageTimeline';
import type { WsTimelineLifecycleItem as WsTimelineLifecycleItemForTest } from '@openheaders/ui/workbench/components/websocket-request-editor/ws-lifecycle';
// Registers the requests.* settings the timeline's toolbar reads/writes.
import '@openheaders/ui/workbench/settings/schema/requests';
import { reset as resetSetting, set as setSetting } from '@openheaders/ui/workbench/settings/store';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@openheaders/ui/workbench/components/shared/CodeEditor', () => ({
  default: ({ value, readOnly }: { value?: string; readOnly?: boolean }) => (
    <textarea data-testid="code-editor" value={value} readOnly={readOnly} onChange={() => {}} />
  ),
}));

// antd's Segmented measures via rc-resize-observer — jsdom has none.
beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  const scope = globalThis as unknown as { ResizeObserver?: typeof ResizeObserver };
  if (typeof scope.ResizeObserver === 'undefined') {
    scope.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
});

afterEach(() => {
  cleanup();
  // The sort choice is a GLOBAL setting — reset between tests.
  resetSetting('requests.wsMessagesNewestFirst');
  resetSetting('requests.wsMessagesHideHeartbeat');
  resetSetting('requests.wsMessagesHideHandshake');
});

const text = (direction: 'up' | 'down', payload: string): WsTimelineItem => ({
  direction,
  dataBase64: encodeBase64Bytes(new TextEncoder().encode(payload)),
  binary: false,
});

const binary = (bytes: number[]): WsTimelineItem => ({
  direction: 'down',
  dataBase64: encodeBase64Bytes(Uint8Array.from(bytes)),
  binary: true,
});

const ITEMS: WsTimelineItem[] = [text('up', 'ping'), text('down', 'pong'), text('down', 'done')];

const LIVE_LIFECYCLE: WsTimelineLifecycle = {
  startedAt: 1_700_000_000_000,
  connected: true,
  connectedAt: 1_700_000_000_050,
  handshake: { protocol: 'chat.v2', extensions: '' },
};

/** Document order of the timeline's lifecycle + message rows. */
function rowSequence(): string[] {
  return [
    ...document.querySelectorAll(
      '[data-testid="ws-timeline-sent-row"], [data-testid="ws-timeline-connected-row"],' +
        ' [data-testid="ws-timeline-ended-row"], [data-testid="ws-timeline-message-row"]',
    ),
  ].map((el) => {
    const testid = el.getAttribute('data-testid');
    if (testid === 'ws-timeline-sent-row') return 'connecting';
    if (testid === 'ws-timeline-connected-row') return 'connected';
    if (testid === 'ws-timeline-ended-row') return 'ended';
    const rowText = el.textContent ?? '';
    for (const word of ['ping', 'pong', 'done']) if (rowText.includes(word)) return word;
    return 'row';
  });
}

function renderTimeline(overrides: Partial<Parameters<typeof WsMessageTimeline>[0]> = {}) {
  return render(<WsMessageTimeline items={ITEMS} count={ITEMS.length} lifecycle={LIVE_LIFECYCLE} {...overrides} />);
}

describe('WsMessageTimeline — rows and lifecycle order', () => {
  it('renders newest-first by default: ended edge absent live, Connecting at the bottom', () => {
    renderTimeline();
    expect(rowSequence()).toEqual(['done', 'pong', 'ping', 'connected', 'connecting']);
  });

  it('flips to call order and appends the ended row once settled', () => {
    renderTimeline({
      lifecycle: {
        ...LIVE_LIFECYCLE,
        endedBy: 'close',
        endedAt: 1_700_000_001_000,
        close: { code: 1000, reason: '' },
      },
    });
    const sortButton = screen.getByTestId('ws-timeline-sort');
    fireEvent.click(sortButton);
    fireEvent.click(screen.getByText('Oldest first'));
    expect(rowSequence()).toEqual(['connecting', 'connected', 'ping', 'pong', 'done', 'ended']);
  });

  it('reads plain Connected collapsed and expands to the handshake facts', () => {
    renderTimeline();
    const row = screen.getByTestId('ws-timeline-connected-row');
    expect(row.textContent).toContain('Connected');
    expect(row.textContent).not.toContain('chat.v2');
    expect(screen.queryByTestId('ws-timeline-handshake-details')).toBeNull();
    fireEvent.click(row);
    const details = screen.getByTestId('ws-timeline-handshake-details');
    expect(details.textContent).toContain('Request Method: "GET"');
    expect(details.textContent).toContain('Sec-WebSocket-Protocol: "chat.v2"');
    // No extensions negotiated — the response section names none.
    const response = (details.textContent ?? '').split('Response Headers')[1] ?? '';
    expect(response).not.toContain('Sec-WebSocket-Extensions');
    fireEvent.click(row);
    expect(screen.queryByTestId('ws-timeline-handshake-details')).toBeNull();
  });

  it('reads the close verdict under the Disconnected row: registry phrase and meaning, reason verbatim', () => {
    const { unmount } = renderTimeline({
      lifecycle: { ...LIVE_LIFECYCLE, endedBy: 'close', close: { code: 1000, reason: '' } },
    });
    expect(screen.getByTestId('ws-timeline-ended-row').textContent).toContain('Disconnected');
    expect(screen.getByTestId('ws-timeline-ended-details').textContent).toBe(
      '1000 Normal Closure: Connection was closed successfully.',
    );
    unmount();

    const reasoned = renderTimeline({
      lifecycle: { ...LIVE_LIFECYCLE, endedBy: 'close', close: { code: 4444, reason: 'menu-reason' } },
    });
    expect(screen.getByTestId('ws-timeline-ended-details').textContent).toBe('4444: menu-reason');
    reasoned.unmount();

    renderTimeline({ lifecycle: { ...LIVE_LIFECYCLE, endedBy: 'close', close: null } });
    expect(screen.getByTestId('ws-timeline-ended-details').textContent).toContain('without a Close frame');
  });

  it('names the peer on both rows and lays the stamped request headers over the host set', () => {
    renderTimeline({
      lifecycle: {
        ...LIVE_LIFECYCLE,
        handshake: {
          protocol: 'chat.v2',
          extensions: 'permessage-deflate',
          url: 'wss://echo.openheaders.io/live',
          requestHeaders: [
            { key: 'authorization', value: 'Bearer tok' },
            { key: 'Sec-WebSocket-Protocol', value: 'chat.v2' },
          ],
        },
        endedBy: 'close',
        close: { code: 1000, reason: '' },
      },
    });
    expect(screen.getByTestId('ws-timeline-connected-row').textContent).toContain(
      'Connected to wss://echo.openheaders.io/live',
    );
    expect(screen.getByTestId('ws-timeline-ended-row').textContent).toContain(
      'Disconnected from wss://echo.openheaders.io/live',
    );
    fireEvent.click(screen.getByTestId('ws-timeline-connected-row'));
    const sheet = screen.getByTestId('ws-timeline-handshake-details').textContent ?? '';
    expect(sheet).toContain('Request URL: "https://echo.openheaders.io/live"');
    expect(sheet).toContain('Status Code: "101 Switching Protocols"');
    expect(sheet).toContain('Host: "echo.openheaders.io"');
    expect(sheet).toContain('authorization: "Bearer tok"');
    expect(sheet).toContain('Sec-WebSocket-Protocol: "chat.v2"');
    expect(sheet).toContain('Sec-WebSocket-Extensions: "permessage-deflate"');
    // The header sections fold independently.
    fireEvent.click(screen.getByTestId('ws-timeline-request-headers-head'));
    const folded = screen.getByTestId('ws-timeline-handshake-details').textContent ?? '';
    expect(folded).not.toContain('authorization: "Bearer tok"');
    expect(folded).toContain('Sec-WebSocket-Extensions: "permessage-deflate"');
    fireEvent.click(screen.getByTestId('ws-timeline-response-headers-head'));
    expect(screen.getByTestId('ws-timeline-handshake-details').textContent).not.toContain('permessage-deflate"');
  });

  it('shows Trust certificate on the error row only with a handler, the click never toggles the row', () => {
    const failed = {
      startedAt: 1_700_000_000_000,
      connected: false,
      errorMessage: 'TLS certificate error reaching 127.0.0.1:3443',
      endedAt: 1_700_000_000_200,
    };
    const { unmount } = renderTimeline({ items: [], count: 0, lifecycle: failed });
    expect(screen.queryByTestId('ws-timeline-trust-certificate')).toBeNull();
    unmount();
    const onTrustCertificate = vi.fn();
    renderTimeline({ items: [], count: 0, lifecycle: failed, onTrustCertificate, trustOfferOpen: true });
    const row = screen.getByTestId('ws-timeline-error-row');
    const before = row.getAttribute('aria-expanded');
    const button = screen.getByTestId('ws-timeline-trust-certificate');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(button);
    expect(onTrustCertificate).toHaveBeenCalledTimes(1);
    expect(row.getAttribute('aria-expanded')).toBe(before);
  });

  it('renders a settled pre-open failure as the error row at the ended slot', () => {
    renderTimeline({
      items: [],
      count: 0,
      lifecycle: {
        startedAt: 1_700_000_000_000,
        connected: false,
        errorMessage: 'Connection refused by 127.0.0.1:9',
        endedAt: 1_700_000_000_200,
      },
    });
    expect(screen.getByTestId('ws-session-error-detail').textContent).toBe('Connection refused by 127.0.0.1:9');
    // Newest-first: the error row sits at the new edge, Connecting at
    // the old one — never beside an opened-session end row, and the
    // settled failure shows no waiting notice.
    const errorRow = screen.getByTestId('ws-timeline-error-row');
    const sentRow = screen.getByTestId('ws-timeline-sent-row');
    expect(errorRow.compareDocumentPosition(sentRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByTestId('ws-timeline-ended-row')).toBeNull();
    expect(screen.queryByTestId('ws-timeline-connected-row')).toBeNull();
    expect(screen.queryByText('Waiting for messages…')).toBeNull();
  });

  it('names the peer on a failed dial and opens on the error and the attempted handshake', () => {
    renderTimeline({
      items: [],
      count: 0,
      lifecycle: {
        startedAt: 1_700_000_000_000,
        connected: false,
        handshake: {
          protocol: '',
          extensions: '',
          url: 'wss://echo.openheaders.io/live',
          requestHeaders: [{ key: 'x-room', value: 'a' }],
        },
        errorMessage: 'TLS certificate error reaching echo.openheaders.io (DEPTH_ZERO_SELF_SIGNED_CERT).',
        endedAt: 1_700_000_000_200,
      },
    });
    expect(screen.getByTestId('ws-timeline-error-row').textContent).toContain(
      'Could not connect to wss://echo.openheaders.io/live',
    );
    const details = screen.getByTestId('ws-timeline-error-details').textContent ?? '';
    expect(details).toContain('Error: TLS certificate error reaching echo.openheaders.io');
    expect(details).toContain('Request URL: "https://echo.openheaders.io/live"');
    expect(details).toContain('x-room: "a"');
    expect(details).not.toContain('Status Code');
    fireEvent.click(screen.getByTestId('ws-timeline-error-row'));
    expect(screen.queryByTestId('ws-timeline-error-details')).toBeNull();
  });

  it('renders a pre-open user abort as the neutral aborted row, never the error row', () => {
    renderTimeline({
      items: [],
      count: 0,
      lifecycle: {
        startedAt: 1_700_000_000_000,
        connected: false,
        aborted: true,
        endedAt: 1_700_000_000_200,
      },
    });
    expect(screen.getByTestId('ws-timeline-aborted-row').textContent).toContain('Connection aborted');
    expect(screen.queryByTestId('ws-timeline-error-row')).toBeNull();
    expect(screen.queryByTestId('ws-session-error-detail')).toBeNull();
    expect(screen.queryByTestId('ws-timeline-ended-row')).toBeNull();
    expect(screen.queryByText('Waiting for messages…')).toBeNull();
  });

  it('shows the save action only with a handler and hands it the row frame', () => {
    const onSaveMessage = vi.fn();
    const { unmount } = renderTimeline({ onSaveMessage });
    const saves = screen.getAllByTestId('ws-timeline-save-message');
    expect(saves).toHaveLength(ITEMS.length);
    // Newest-first: the top row is the last item.
    fireEvent.click(saves[0]);
    expect(onSaveMessage).toHaveBeenCalledWith(ITEMS[ITEMS.length - 1]);
    unmount();
    renderTimeline();
    expect(screen.queryByTestId('ws-timeline-save-message')).toBeNull();
  });

  it('renders session times only when provided', () => {
    const { unmount } = renderTimeline({ timestamps: [1_700_000_000_100, 1_700_000_000_200, 1_700_000_000_300] });
    expect(screen.getAllByTestId('ws-timeline-message-time')).toHaveLength(3);
    unmount();
    renderTimeline();
    expect(screen.queryByTestId('ws-timeline-message-time')).toBeNull();
  });
});

describe('WsMessageTimeline — display-only controls', () => {
  it('search filters by decoded payload without touching the capture', () => {
    renderTimeline();
    fireEvent.change(screen.getByTestId('ws-timeline-search'), { target: { value: 'pong' } });
    expect(rowSequence().filter((r) => !['connecting', 'connected'].includes(r))).toEqual(['pong']);
  });

  it('direction filter keeps only the picked direction', () => {
    renderTimeline();
    fireEvent.click(screen.getByText('↑ Sent'));
    expect(rowSequence().filter((r) => !['connecting', 'connected'].includes(r))).toEqual(['ping']);
  });

  it('Clear hides current rows; lifecycle rows stay', () => {
    renderTimeline();
    fireEvent.click(screen.getByTestId('ws-timeline-clear'));
    expect(rowSequence()).toEqual(['connected', 'connecting']);
  });
});

describe('WsMessageTimeline — payload views', () => {
  it('labels a binary frame with its byte count and opens it on the hexdump, Show Message reads base64', () => {
    const item = binary([1, 2, 3, 4]);
    renderTimeline({ items: [item], count: 1 });
    const row = screen.getByTestId('ws-timeline-message-row');
    expect(row.textContent).toContain('4 bytes');
    fireEvent.click(row);
    expect(screen.getByTestId('ws-timeline-hex-offsets').textContent).toBe('00000000:');
    expect(screen.getByTestId('ws-timeline-hex').textContent).toMatch(/01 02 03 04/i);
    expect(screen.getByTestId('ws-timeline-viewer-hex').textContent).toBe('Show Message');
    fireEvent.click(screen.getByTestId('ws-timeline-viewer-hex'));
    const viewer = screen.getByTestId('ws-timeline-message-viewer');
    expect((viewer.querySelector('textarea') as HTMLTextAreaElement).value).toBe(item.dataBase64);
  });

  it('toggles a text frame to its hexdump and back, the viewer toolbar carries format wrap and find', () => {
    renderTimeline();
    const pingRow = screen.getAllByTestId('ws-timeline-message-row').find((r) => r.textContent?.includes('ping'));
    if (!pingRow) throw new Error('no ping row');
    fireEvent.click(pingRow);
    expect(screen.getByTestId('ws-timeline-viewer-format')).toBeTruthy();
    expect(screen.getByTestId('ws-timeline-viewer-wrap')).toBeTruthy();
    expect(screen.getByTestId('ws-timeline-viewer-find')).toBeTruthy();
    const toggle = screen.getByTestId('ws-timeline-viewer-hex');
    expect(toggle.textContent).toBe('Show Hexdump');
    fireEvent.click(toggle);
    expect(screen.getByTestId('ws-timeline-hex').textContent).toMatch(/70 69 6e 67/i);
    expect(screen.queryByTestId('code-editor')).toBeNull();
    fireEvent.click(screen.getByTestId('ws-timeline-viewer-hex'));
    const viewer = screen.getByTestId('ws-timeline-message-viewer');
    expect((viewer.querySelector('textarea') as HTMLTextAreaElement).value).toBe('ping');
  });

  it('expands a text row into the decoded payload', () => {
    renderTimeline();
    const rows = screen.getAllByTestId('ws-timeline-message-row');
    const pingRow = rows.find((r) => r.textContent?.includes('ping'));
    if (!pingRow) throw new Error('no ping row');
    fireEvent.click(pingRow);
    const viewer = screen.getByTestId('ws-timeline-message-viewer');
    expect((viewer.querySelector('textarea') as HTMLTextAreaElement).value).toBe('ping');
  });

  it('surfaces the rolling-retention drop count as a notice', () => {
    renderTimeline({ droppedMessages: 7 });
    expect(screen.getByTestId('ws-timeline-dropped').textContent).toContain('7');
  });
});

describe('WsMessageTimeline — socketio decoded display', () => {
  const SIO_ITEMS: WsTimelineItem[] = [
    text('down', '0{"sid":"abc","pingInterval":25000}'),
    text('up', '40'),
    text('down', '40{"sid":"abc"}'),
    text('down', '2'),
    text('up', '3'),
    text('down', '42["news",{"headline":"hi"}]'),
    text('up', '421["ping-me"]'),
    text('down', '431[{"ok":true}]'),
  ];

  it('renders events by name, the handshake framing and the heartbeat hidden by default', () => {
    renderTimeline({ items: SIO_ITEMS, count: SIO_ITEMS.length, flavor: 'socketio' });
    const rows = screen.getAllByTestId('ws-timeline-message-row').map((r) => r.textContent ?? '');
    expect(rows.some((r) => r.includes('engine.io open'))).toBe(false);
    expect(rows.some((r) => r.includes('connect /'))).toBe(false);
    expect(rows.some((r) => r.includes('connected /'))).toBe(false);
    // The engine.io ping / pong rows are keep-alive noise — filtered
    // by the default-on setting; the event named `ping-me` is not a
    // heartbeat and stays.
    expect(rows.some((r) => /\bping\b/.test(r) && !r.includes('ping-me'))).toBe(false);
    expect(rows.some((r) => r.includes('pong'))).toBe(false);
    // Newest-first default: the latest frame renders first.
    const names = screen.getAllByTestId('ws-sio-event-name').map((el) => el.textContent);
    expect(names).toEqual(['ack', 'ping-me', 'news']);
  });

  it('renders the handshake framing as subdued protocol rows once the setting is off', () => {
    setSetting('requests.wsMessagesHideHandshake', false);
    renderTimeline({ items: SIO_ITEMS, count: SIO_ITEMS.length, flavor: 'socketio' });
    const rows = screen.getAllByTestId('ws-timeline-message-row').map((r) => r.textContent ?? '');
    expect(rows.some((r) => r.includes('engine.io open'))).toBe(true);
    expect(rows.some((r) => r.includes('connect /'))).toBe(true);
    expect(rows.some((r) => r.includes('connected /'))).toBe(true);
  });

  it('shows the heartbeat rows once the setting is off', () => {
    setSetting('requests.wsMessagesHideHeartbeat', false);
    renderTimeline({ items: SIO_ITEMS, count: SIO_ITEMS.length, flavor: 'socketio' });
    const rows = screen.getAllByTestId('ws-timeline-message-row').map((r) => r.textContent ?? '');
    expect(rows.some((r) => /\bping\b/.test(r) && !r.includes('ping-me'))).toBe(true);
    expect(rows.some((r) => r.includes('pong'))).toBe(true);
  });

  it('shows the args preview and correlates ack ids', () => {
    renderTimeline({ items: SIO_ITEMS, count: SIO_ITEMS.length, flavor: 'socketio' });
    const rows = screen.getAllByTestId('ws-timeline-message-row').map((r) => r.textContent ?? '');
    expect(rows.some((r) => r.includes('news') && r.includes('[{"headline":"hi"}]'))).toBe(true);
    const ackIds = screen.getAllByTestId('ws-sio-ack-id').map((el) => el.textContent);
    expect(ackIds).toEqual(['#1', '#1']);
  });

  it('renders an ack-timeout fact at its index and tints the timed-out event chip', () => {
    const items = SIO_ITEMS.slice(0, 7);
    renderTimeline({
      items,
      count: items.length,
      flavor: 'socketio',
      lifecycleItems: [{ kind: 'ackTimeout', ackId: 1, timeoutMs: 5000, atIndex: 7, atMs: 1_700_000_005_000 }],
    });
    const row = screen.getByTestId('ws-timeline-ack-timeout-row');
    expect(row.textContent).toContain('Ack #1 timed out after 5 s');
    const chip = screen.getByTestId('ws-sio-ack-id');
    expect(chip.getAttribute('data-ack-timed-out')).toBe('true');
    // Newest-first: the fact sits above the event it names.
    const eventRow = screen.getAllByTestId('ws-timeline-message-row').find((r) => r.textContent?.includes('ping-me'));
    if (!eventRow) throw new Error('no event row');
    expect((row.compareDocumentPosition(eventRow) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0).toBe(true);
  });

  it('expands an event row into the pretty-printed arguments', () => {
    renderTimeline({ items: SIO_ITEMS, count: SIO_ITEMS.length, flavor: 'socketio' });
    const eventRow = screen.getAllByTestId('ws-timeline-message-row').find((r) => r.textContent?.includes('news'));
    if (!eventRow) throw new Error('no event row');
    fireEvent.click(eventRow);
    const viewer = screen.getByTestId('ws-timeline-message-viewer');
    expect((viewer.querySelector('textarea') as HTMLTextAreaElement).value).toBe(
      JSON.stringify([{ headline: 'hi' }], null, 2),
    );
  });

  it('leaves the raw flavor undecoded — frames render verbatim', () => {
    renderTimeline({ items: [text('down', '42["news"]')], count: 1 });
    const row = screen.getByTestId('ws-timeline-message-row');
    expect(row.textContent).toContain('42["news"]');
    expect(screen.queryByTestId('ws-sio-event-name')).toBeNull();
  });

  it('listen filter hides unlisted incoming events only — sent frames, controls and acks stay', () => {
    const items: WsTimelineItem[] = [
      text('down', '0{"sid":"abc"}'),
      text('up', '42["mute-me"]'),
      text('down', '42["news",{"headline":"hi"}]'),
      text('down', '42["mute-me",{"n":1}]'),
      text('down', '431[{"ok":true}]'),
    ];
    // Handshake framing shown so the control row proves it survives the filter.
    setSetting('requests.wsMessagesHideHandshake', false);
    renderTimeline({ items, count: items.length, flavor: 'socketio', listenedEvents: ['news'] });
    const rows = screen.getAllByTestId('ws-timeline-message-row').map((r) => r.textContent ?? '');
    // The unlisted DOWN event hides; the same-named UP compose stays
    // (the filter reads incoming frames only), as do control + ack rows.
    expect(rows.some((r) => r.includes('{"n":1}'))).toBe(false);
    expect(rows.some((r) => r.includes('news'))).toBe(true);
    expect(rows.some((r) => r.includes('mute-me'))).toBe(true);
    expect(rows.some((r) => r.includes('engine.io open'))).toBe(true);
    expect(rows.some((r) => r.includes('ack'))).toBe(true);
  });
});

describe('WsMessageTimeline — script marks', () => {
  const scriptMark = (
    over: Partial<Extract<WsTimelineLifecycleItemForTest, { kind: 'script' }>> = {},
  ): WsTimelineLifecycleItemForTest => ({
    kind: 'script',
    hook: 'ws-before-connect',
    succeeded: true,
    durationMs: 3,
    chain: [
      { level: 'collection', uid: 'col1', name: 'Payments', durationMs: 2, succeeded: true },
      { level: 'request', uid: 'req1', name: 'Charge', durationMs: 1, succeeded: true },
    ],
    atIndex: 0,
    atMs: 1_700_000_000_040,
    ...over,
  });

  it('renders a hook run as a lifecycle row naming the hook and the levels, at its capture position', () => {
    renderTimeline({
      lifecycleItems: [scriptMark(), scriptMark({ hook: 'ws-on-message', atIndex: 2, attempt: undefined })],
    });
    const rows = screen.getAllByTestId('ws-timeline-script-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('On message — Collection ‘Payments’ · Request · 3 ms');
    expect(rows[1]?.textContent).toContain('Before connect — Collection ‘Payments’ · Request · 3 ms');
    // Newest first: the On message mark (index 2) sits above the
    // messages it followed; the connect mark below the first message.
    const sequence = [
      ...document.querySelectorAll('[data-testid="ws-timeline-message-row"], [data-testid="ws-timeline-script-row"]'),
    ].map((el) => el.getAttribute('data-testid'));
    expect(sequence).toEqual([
      'ws-timeline-message-row',
      'ws-timeline-script-row',
      'ws-timeline-message-row',
      'ws-timeline-message-row',
      'ws-timeline-script-row',
    ]);
  });

  it('a failed run reads the error, a drop names the level, a reconnect dial its attempt', () => {
    renderTimeline({
      lifecycleItems: [
        scriptMark({ succeeded: false, error: { name: 'Error', message: "Collection 'Payments': boom" } }),
        scriptMark({ hook: 'ws-before-send', droppedBy: "Folder 'Guard'", atIndex: 1 }),
        scriptMark({ attempt: 2, atIndex: 3 }),
      ],
    });
    const rows = screen.getAllByTestId('ws-timeline-script-row').map((el) => el.textContent ?? '');
    expect(rows.some((r) => r.includes("Before connect failed — Collection 'Payments': boom"))).toBe(true);
    expect(rows.some((r) => r.includes("Before send dropped the message — Folder 'Guard'"))).toBe(true);
    expect(rows.some((r) => r.includes('attempt 2'))).toBe(true);
  });

  it("the row's hover (i) opens the WebSocket lifecycle card with the mark's hook line lit", () => {
    renderTimeline({ lifecycleItems: [scriptMark({ hook: 'ws-on-message', atIndex: 2, attempt: undefined })] });
    const row = screen.getByTestId('ws-timeline-script-row');
    expect(row.classList.contains('oh-info-hover-host')).toBe(true);
    const trigger = within(row).getByRole('button', { name: 'About On message script' });
    expect(trigger.classList.contains('oh-info-trigger--hover')).toBe(true);
    fireEvent.click(trigger);
    // The rail row's card verbatim — four hook lines, On message's lit.
    expect(document.querySelectorAll('.oh-info-eg-line')).toHaveLength(4);
    const lit = Array.from(document.querySelectorAll('.oh-info-eg-hl')).map((el) => el.textContent);
    expect(lit).toEqual(['On message', 'MESSAGE ↓ {"type":"tick"}', 'text', 'bytes', 'index']);
    expect(screen.getByText('oh.send(text)')).toBeTruthy();
  });
});
