// @vitest-environment jsdom
/**
 * GrpcMessageTimeline — the streaming invoke's message-list surface.
 * Pins the ratified Phase E laws: one row per captured frame in true
 * call order with direction glyphs and a name chip carrying the
 * frame's DECLARED type's short name (request type for ↑, response
 * type for ↓; the wire-grammar `message` fallback when the method
 * doesn't resolve); lifecycle rows derived from props — never
 * invented — with "Response received" INTERLEAVED at the recorded
 * `headAtMessage` position (the executor's call-order truth) and the
 * sent/ended rows at the chronological edges, all flipping with the
 * sort; session-only timestamps rendered when provided, omitted when
 * not; search, direction filter, and Clear display-only over the
 * capture; the SSE-anatomy sort/group controls on the
 * `requests.grpcMessages*` settings — newest-first default, group-by-
 * type clustering with real totals on collapsible headers and the
 * per-group row limit windowing each group's newest rows; per-row
 * expansion mounting the mini viewer over the frame's schema-decoded
 * payload, raw base64 when the bytes decode as neither. The shared
 * Monaco CodeEditor is mocked to a <textarea> — the contract under
 * test is the list, not Monaco.
 */

import { buildRegistry, encodeMessage, parseProto } from '@openheaders/core/proto';
import { encodeBase64Bytes } from '@openheaders/core/utils';
import GrpcMessageTimeline, {
  type GrpcTimelineItem,
  type GrpcTimelineLifecycle,
} from '@openheaders/ui/workbench/components/grpc-request-editor/GrpcMessageTimeline';
// Registers the requests.* settings the timeline's toolbar reads/writes.
import '@openheaders/ui/workbench/settings/schema/requests';
import { reset as resetSetting, set as setSetting } from '@openheaders/ui/workbench/settings/store';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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
  // The sort/group choices are GLOBAL settings — reset between tests.
  resetSetting('requests.grpcMessagesNewestFirst');
  resetSetting('requests.grpcMessagesShowTypes');
  resetSetting('requests.grpcMessagesGroupByType');
  resetSetting('requests.grpcMessagesGroupRowLimit');
});

const PROTO = `syntax = "proto3";
package library.v1;

service Library {
  rpc Chat(stream Ask) returns (stream Reply);
}

message Ask { string question = 1; }
message Reply { string answer = 1; }
`;

const REGISTRY = buildRegistry([{ path: 'index.proto', census: parseProto(PROTO) }]);
const ASK = 'library.v1.Ask';
const REPLY = 'library.v1.Reply';

const up = (question: string): GrpcTimelineItem => ({
  direction: 'up',
  dataBase64: encodeBase64Bytes(encodeMessage(REGISTRY, ASK, { question })),
  compressed: false,
});
const down = (answer: string): GrpcTimelineItem => ({
  direction: 'down',
  dataBase64: encodeBase64Bytes(encodeMessage(REGISTRY, REPLY, { answer })),
  compressed: false,
});

const ITEMS: GrpcTimelineItem[] = [up('ping'), down('pong'), down('done')];

const LIVE_LIFECYCLE: GrpcTimelineLifecycle = {
  startedAt: 1_700_000_000_000,
  headArrived: true,
  connectedAt: 1_700_000_000_050,
  // The ↑ ping preceded the head in call order — the recorded truth.
  headAtMessage: 1,
};

/** Document order of the timeline's lifecycle + message rows. */
function rowSequence(): string[] {
  return [
    ...document.querySelectorAll(
      '[data-testid="grpc-timeline-sent-row"], [data-testid="grpc-timeline-connected-row"],' +
        ' [data-testid="grpc-timeline-ended-row"], [data-testid="grpc-timeline-message-row"]',
    ),
  ].map((el) => {
    const testid = el.getAttribute('data-testid');
    if (testid === 'grpc-timeline-sent-row') return 'sent';
    if (testid === 'grpc-timeline-connected-row') return 'connected';
    if (testid === 'grpc-timeline-ended-row') return 'ended';
    const text = el.textContent ?? '';
    for (const word of ['ping', 'pong', 'done']) if (text.includes(word)) return word;
    return 'row';
  });
}

function renderTimeline(overrides: Partial<Parameters<typeof GrpcMessageTimeline>[0]> = {}) {
  return render(
    <GrpcMessageTimeline
      items={ITEMS}
      count={ITEMS.length}
      lifecycle={LIVE_LIFECYCLE}
      registry={REGISTRY}
      inputType={ASK}
      outputType={REPLY}
      {...overrides}
    />,
  );
}

describe('GrpcMessageTimeline rows', () => {
  it('renders one row per frame in arrival order with direction-typed previews', () => {
    setSetting('requests.grpcMessagesNewestFirst', false);
    renderTimeline();
    const rows = screen.getAllByTestId('grpc-timeline-message-row');
    expect(rows).toHaveLength(3);
    // ↑ frames decode as the request type, ↓ as the response type.
    expect(rows[0].textContent).toContain('ping');
    expect(rows[0].querySelector('[aria-label="Sent message"]')).not.toBeNull();
    expect(rows[1].textContent).toContain('pong');
    expect(rows[1].querySelector('[aria-label="Received message"]')).not.toBeNull();
  });

  it('hides per-row type chips by default — the direction badge already tells rows apart', () => {
    renderTimeline();
    expect(screen.queryAllByTestId('grpc-timeline-message-badge')).toHaveLength(0);
  });

  it('chips each row with the declared type short name when opted in, message when unresolved', () => {
    setSetting('requests.grpcMessagesNewestFirst', false);
    setSetting('requests.grpcMessagesShowTypes', true);
    const { unmount } = renderTimeline();
    const badges = screen.getAllByTestId('grpc-timeline-message-badge');
    expect(badges.map((badge) => badge.textContent)).toEqual(['Ask', 'Reply', 'Reply']);
    unmount();
    renderTimeline({ inputType: null, outputType: null });
    for (const badge of screen.getAllByTestId('grpc-timeline-message-badge')) {
      expect(badge.textContent).toBe('message');
    }
  });

  it('renders session timestamps when provided and none otherwise', () => {
    const { unmount } = renderTimeline({ timestamps: [1_700_000_000_100, 1_700_000_000_200, 1_700_000_000_300] });
    expect(screen.getAllByTestId('grpc-timeline-message-time')).toHaveLength(3);
    unmount();
    renderTimeline();
    expect(screen.queryAllByTestId('grpc-timeline-message-time')).toHaveLength(0);
  });

  it('expands a row into the viewer over the schema-decoded payload', () => {
    setSetting('requests.grpcMessagesNewestFirst', false);
    renderTimeline();
    fireEvent.click(screen.getAllByTestId('grpc-timeline-message-row')[0]);
    const viewer = screen.getByTestId('grpc-timeline-message-viewer');
    const editor = viewer.querySelector('[data-testid="code-editor"]');
    expect(editor).not.toBeNull();
    expect((editor as HTMLTextAreaElement).value).toContain('"question": "ping"');
  });

  it('falls back to raw base64 when the frame decodes as neither type', () => {
    // 0xff alone is no valid protobuf field — schema and structural
    // decode both refuse, so the row shows the raw bytes.
    const raw: GrpcTimelineItem = { direction: 'down', dataBase64: '/w==', compressed: false };
    renderTimeline({ items: [raw], count: 1 });
    fireEvent.click(screen.getByTestId('grpc-timeline-message-row'));
    const viewer = screen.getByTestId('grpc-timeline-message-viewer');
    expect((viewer.querySelector('[data-testid="code-editor"]') as HTMLTextAreaElement).value).toBe('/w==');
  });
});

describe('GrpcMessageTimeline lifecycle rows', () => {
  it('derives sent, connected, and ended rows from props — never invented', () => {
    const { unmount } = renderTimeline();
    // The bare label — no call path (the Postman posture).
    expect(screen.getByTestId('grpc-timeline-sent-row').textContent).toContain('Request sent');
    expect(screen.getByTestId('grpc-timeline-connected-row')).toBeTruthy();
    expect(screen.queryByTestId('grpc-timeline-ended-row')).toBeNull();
    unmount();
    renderTimeline({
      lifecycle: { ...LIVE_LIFECYCLE, endedBy: 'complete', endedAt: 1_700_000_001_000 },
    });
    const ended = screen.getByTestId('grpc-timeline-ended-row');
    // The bare label — the meta strip's pill owns the status code, so
    // the row never duplicates it (the Postman posture).
    expect(ended.textContent).toContain('Call completed');
    expect(ended.textContent).not.toContain('OK');
  });

  it('labels a stopped call and omits the connected row before the head', () => {
    renderTimeline({
      lifecycle: { headArrived: false, endedBy: 'stop' },
    });
    expect(screen.queryByTestId('grpc-timeline-connected-row')).toBeNull();
    expect(screen.getByTestId('grpc-timeline-ended-row').textContent).toContain('Call stopped');
  });
});

describe('GrpcMessageTimeline toolbar', () => {
  it('filters by direction, display-only', () => {
    renderTimeline();
    fireEvent.click(screen.getByText('↑ Sent'));
    const rows = screen.getAllByTestId('grpc-timeline-message-row');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('ping');
    fireEvent.click(screen.getByText('All'));
    expect(screen.getAllByTestId('grpc-timeline-message-row')).toHaveLength(3);
  });

  it('searches decoded previews and chip names, clears display-only, lifecycle intact', () => {
    renderTimeline();
    fireEvent.change(screen.getByTestId('grpc-timeline-search'), { target: { value: 'pong' } });
    expect(screen.getAllByTestId('grpc-timeline-message-row')).toHaveLength(1);
    // Chip names join the haystack only while type chips are SHOWN —
    // search matches what the user can see.
    fireEvent.change(screen.getByTestId('grpc-timeline-search'), { target: { value: 'ask' } });
    expect(screen.queryAllByTestId('grpc-timeline-message-row')).toHaveLength(0);
    act(() => setSetting('requests.grpcMessagesShowTypes', true));
    const chipMatches = screen.getAllByTestId('grpc-timeline-message-row');
    expect(chipMatches).toHaveLength(1);
    expect(chipMatches[0].textContent).toContain('ping');
    fireEvent.change(screen.getByTestId('grpc-timeline-search'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('grpc-timeline-clear'));
    expect(screen.queryAllByTestId('grpc-timeline-message-row')).toHaveLength(0);
    expect(screen.getByTestId('grpc-timeline-sent-row')).toBeTruthy();
  });
});

describe('GrpcMessageTimeline sort + head interleave', () => {
  it('interleaves Response received at the recorded head position, oldest-first', () => {
    setSetting('requests.grpcMessagesNewestFirst', false);
    renderTimeline({
      lifecycle: { ...LIVE_LIFECYCLE, endedBy: 'complete' },
    });
    // The ↑ ping was sent BEFORE the head arrived (headAtMessage 1).
    expect(rowSequence()).toEqual(['sent', 'ping', 'connected', 'pong', 'done', 'ended']);
  });

  it('newest-first (the default) reads the same event log top-down reversed', () => {
    renderTimeline({
      lifecycle: { ...LIVE_LIFECYCLE, endedBy: 'complete' },
    });
    expect(rowSequence()).toEqual(['ended', 'done', 'pong', 'connected', 'ping', 'sent']);
  });

  it('an absent position reads as head-before-everything (pre-position captures)', () => {
    setSetting('requests.grpcMessagesNewestFirst', false);
    const { headAtMessage: _headAtMessage, ...lifecycle } = LIVE_LIFECYCLE;
    renderTimeline({ lifecycle });
    expect(rowSequence()).toEqual(['sent', 'connected', 'ping', 'pong', 'done']);
  });
});

describe('GrpcMessageTimeline grouping', () => {
  it('clusters rows under type headers with real totals; head joins the chronological edge', () => {
    setSetting('requests.grpcMessagesNewestFirst', false);
    setSetting('requests.grpcMessagesGroupByType', true);
    renderTimeline();
    const headers = screen.getAllByTestId('grpc-timeline-group-header');
    // First-appearance anchored: Ask (the ↑ ping) minted first.
    expect(headers.map((h) => h.textContent)).toEqual(['Ask1 message', 'Reply2 messages']);
    // Grouped mode is clustering, not a timeline — the head row sits
    // at the edge beside Request sent instead of interleaving.
    expect(rowSequence()).toEqual(['sent', 'connected', 'ping', 'pong', 'done']);
  });

  it('collapses a group on click and windows each group to the row limit, totals intact', () => {
    setSetting('requests.grpcMessagesNewestFirst', false);
    setSetting('requests.grpcMessagesGroupByType', true);
    setSetting('requests.grpcMessagesGroupRowLimit', 1);
    renderTimeline();
    // Limit 1: Reply shows only its newest row; the header keeps 2.
    let rows = screen.getAllByTestId('grpc-timeline-message-row');
    expect(rows.map((r) => (r.textContent ?? '').includes('done'))).toContain(true);
    expect(rows).toHaveLength(2);
    expect(screen.getAllByTestId('grpc-timeline-group-header')[1].textContent).toContain('2 messages');
    fireEvent.click(screen.getAllByTestId('grpc-timeline-group-header')[1]);
    rows = screen.getAllByTestId('grpc-timeline-message-row');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('ping');
  });
});
