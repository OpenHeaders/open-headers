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
// Registers the requests.* settings the timeline's toolbar reads/writes.
import '@openheaders/ui/workbench/settings/schema/requests';
import { reset as resetSetting } from '@openheaders/ui/workbench/settings/store';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
  protocol: 'chat.v2',
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
        endedMessage: '1000',
      },
    });
    const sortButton = screen.getByTestId('ws-timeline-sort');
    fireEvent.click(sortButton);
    fireEvent.click(screen.getByText('Oldest first'));
    expect(rowSequence()).toEqual(['connecting', 'connected', 'ping', 'pong', 'done', 'ended']);
  });

  it('names the Connected row with the negotiated subprotocol', () => {
    renderTimeline();
    expect(screen.getByTestId('ws-timeline-connected-row').textContent).toContain('chat.v2');
  });

  it('renders the ended row detail verbatim (close code, stop, failure)', () => {
    renderTimeline({
      lifecycle: { ...LIVE_LIFECYCLE, endedBy: 'close', endedMessage: '4444 menu-reason' },
    });
    expect(screen.getByTestId('ws-timeline-ended-row').textContent).toContain('4444 menu-reason');
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
  it('labels a binary frame with its byte count and shows base64 in the viewer', () => {
    const item = binary([1, 2, 3, 4]);
    renderTimeline({ items: [item], count: 1 });
    const row = screen.getByTestId('ws-timeline-message-row');
    expect(row.textContent).toContain('4 bytes');
    fireEvent.click(row);
    const viewer = screen.getByTestId('ws-timeline-message-viewer');
    expect((viewer.querySelector('textarea') as HTMLTextAreaElement).value).toBe(item.dataBase64);
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
