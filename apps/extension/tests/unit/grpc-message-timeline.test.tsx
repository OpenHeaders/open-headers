// @vitest-environment jsdom
/**
 * GrpcMessageTimeline — the streaming invoke's message-list surface.
 * Pins the ratified Phase E laws: one row per captured frame in
 * arrival order (oldest first, a conversation) with direction glyphs
 * and a name chip carrying the frame's DECLARED type's short name
 * (request type for ↑, response type for ↓; the wire-grammar `message`
 * fallback when the method doesn't resolve);
 * lifecycle rows derived from props — Request sent at the top,
 * Response received once the head is in, Call completed/stopped at
 * the bottom with the status label — never invented; session-only
 * timestamps rendered when provided, omitted when not; search,
 * direction filter, and Clear display-only over the capture; per-row
 * expansion mounting the mini viewer over the frame's schema-decoded
 * payload (request type for ↑, response type for ↓), raw base64 when
 * the bytes decode as neither. The shared Monaco CodeEditor is mocked
 * to a <textarea> — the contract under test is the list, not Monaco.
 */

import { buildRegistry, encodeMessage, parseProto } from '@openheaders/core/proto';
import { encodeBase64Bytes } from '@openheaders/core/utils';
import GrpcMessageTimeline, {
  type GrpcTimelineItem,
  type GrpcTimelineLifecycle,
} from '@openheaders/ui/workbench/components/grpc-request-editor/GrpcMessageTimeline';
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
  target: '/library.v1.Library/Chat',
  startedAt: 1_700_000_000_000,
  headArrived: true,
  connectedAt: 1_700_000_000_050,
};

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
    renderTimeline();
    const rows = screen.getAllByTestId('grpc-timeline-message-row');
    expect(rows).toHaveLength(3);
    // ↑ frames decode as the request type, ↓ as the response type.
    expect(rows[0].textContent).toContain('ping');
    expect(rows[0].querySelector('[aria-label="Sent message"]')).not.toBeNull();
    expect(rows[1].textContent).toContain('pong');
    expect(rows[1].querySelector('[aria-label="Received message"]')).not.toBeNull();
  });

  it('chips each row with the declared type short name, message when unresolved', () => {
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
    expect(screen.getByTestId('grpc-timeline-sent-row').textContent).toContain('/library.v1.Library/Chat');
    expect(screen.getByTestId('grpc-timeline-connected-row')).toBeTruthy();
    expect(screen.queryByTestId('grpc-timeline-ended-row')).toBeNull();
    unmount();
    renderTimeline({
      lifecycle: { ...LIVE_LIFECYCLE, endedBy: 'complete', endedAt: 1_700_000_001_000, statusLabel: '0 OK' },
    });
    const ended = screen.getByTestId('grpc-timeline-ended-row');
    expect(ended.textContent).toContain('Call completed');
    expect(ended.textContent).toContain('0 OK');
  });

  it('labels a stopped call and omits the connected row before the head', () => {
    renderTimeline({
      lifecycle: { target: '/library.v1.Library/Chat', headArrived: false, endedBy: 'stop' },
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
    // Chip names are part of the haystack — 'ask' hits only ↑ rows.
    fireEvent.change(screen.getByTestId('grpc-timeline-search'), { target: { value: 'ask' } });
    const chipMatches = screen.getAllByTestId('grpc-timeline-message-row');
    expect(chipMatches).toHaveLength(1);
    expect(chipMatches[0].textContent).toContain('ping');
    fireEvent.change(screen.getByTestId('grpc-timeline-search'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('grpc-timeline-clear'));
    expect(screen.queryAllByTestId('grpc-timeline-message-row')).toHaveLength(0);
    expect(screen.getByTestId('grpc-timeline-sent-row')).toBeTruthy();
  });
});
