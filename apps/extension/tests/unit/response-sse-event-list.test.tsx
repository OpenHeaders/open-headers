// @vitest-environment jsdom
/**
 * ResponseSseEventList — the event-list surface both phases share.
 * Pins the ratified laws: one row per wire event newest-first with the
 * colored name badge + inline data preview; comment blocks as their
 * own rows; session-only timestamps rendered when provided, omitted
 * when not; lifecycle rows (connected bottom, ended top) derived from
 * props — never invented; search and Clear display-only; the display
 * window capped with "show older" paging; per-row expansion mounting
 * the mini viewer with the lossless JSON print (int64 verbatim — the
 * F3 law). The shared Monaco CodeEditor is mocked to a <textarea> —
 * the contract under test is the list, not Monaco.
 */

import ResponseSseEventList from '@openheaders/ui/workbench/components/request-editor/response/ResponseSseEventList';
import { parseSseEventItems } from '@openheaders/ui/workbench/components/request-editor/response/response-sse';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@openheaders/ui/workbench/components/shared/CodeEditor', () => ({
  default: ({ value, readOnly }: { value?: string; readOnly?: boolean }) => (
    <textarea data-testid="code-editor" value={value} readOnly={readOnly} onChange={() => {}} />
  ),
}));

afterEach(cleanup);

const BODY = [
  'event: tick',
  'data: {"seq":1,"resourceVersion":9007199254740993}',
  '',
  'data: plain payload',
  '',
  ': heartbeat',
  '',
].join('\n');

function itemsOf(body: string) {
  const outcome = parseSseEventItems(body);
  if (!outcome) throw new Error('fixture must parse');
  return outcome.items;
}

const LIFECYCLE = { url: 'https://api.openheaders.io/stream' };

describe('ResponseSseEventList rows', () => {
  it('renders one row per event, newest-first, with name badges and previews', () => {
    const items = itemsOf(BODY);
    render(<ResponseSseEventList items={items} count={items.length} lifecycle={LIFECYCLE} />);
    const rows = screen.getAllByTestId('oh-sse-event-row');
    expect(rows).toHaveLength(3);
    // Newest first: the heartbeat comment block tops the list.
    expect(rows[0].textContent).toContain('comment');
    expect(rows[0].textContent).toContain('heartbeat');
    // Unnamed data events badge as the spec's default `message`.
    expect(rows[1].textContent).toContain('message');
    expect(rows[1].textContent).toContain('plain payload');
    // Named events carry their wire name and the collapsed JSON preview.
    expect(rows[2].textContent).toContain('tick');
    expect(rows[2].textContent).toContain('"seq": 1');
  });

  it('shows session timestamps when provided and none otherwise', () => {
    const items = itemsOf(BODY);
    const at = new Date(2026, 6, 16, 12, 3, 44, 123).getTime();
    const { unmount } = render(
      <ResponseSseEventList items={items} count={items.length} timestamps={[at, at + 1000]} lifecycle={LIFECYCLE} />,
    );
    // Two of three events carry times (the third slot is absent —
    // re-opened saved bodies and short sessions render no time).
    const times = screen.getAllByTestId('oh-sse-event-time');
    expect(times).toHaveLength(2);
    expect(times.map((el) => el.textContent)).toContain('12:03:44.123');
    unmount();
    render(<ResponseSseEventList items={items} count={items.length} lifecycle={LIFECYCLE} />);
    expect(screen.queryByTestId('oh-sse-event-time')).toBeNull();
  });

  it('derives lifecycle rows: connected at the bottom, the ended state on top', () => {
    const items = itemsOf(BODY);
    render(<ResponseSseEventList items={items} count={items.length} lifecycle={{ ...LIFECYCLE, endedBy: 'stop' }} />);
    expect(screen.getByTestId('oh-sse-connected-row').textContent).toContain(
      'Connected to https://api.openheaders.io/stream',
    );
    expect(screen.getByTestId('oh-sse-lifecycle-row').textContent).toContain('Connection stopped');
  });

  it('renders no ended row while the stream is live', () => {
    const items = itemsOf(BODY);
    render(<ResponseSseEventList items={items} count={items.length} lifecycle={LIFECYCLE} />);
    expect(screen.queryByTestId('oh-sse-lifecycle-row')).toBeNull();
  });

  it("appends the error message to a failed stream's ended row", () => {
    const items = itemsOf(BODY);
    render(
      <ResponseSseEventList
        items={items}
        count={items.length}
        lifecycle={{ ...LIFECYCLE, endedBy: 'error', endedMessage: 'socket hang up' }}
      />,
    );
    expect(screen.getByTestId('oh-sse-lifecycle-row').textContent).toContain('Connection failed — socket hang up');
  });
});

describe('ResponseSseEventList search + clear (display-only)', () => {
  it('search narrows rows over the raw block text', () => {
    const items = itemsOf(BODY);
    render(<ResponseSseEventList items={items} count={items.length} lifecycle={LIFECYCLE} />);
    fireEvent.change(screen.getByTestId('oh-sse-search'), { target: { value: 'resourceVersion' } });
    const rows = screen.getAllByTestId('oh-sse-event-row');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('tick');
  });

  it('says so when nothing matches', () => {
    const items = itemsOf(BODY);
    render(<ResponseSseEventList items={items} count={items.length} lifecycle={LIFECYCLE} />);
    fireEvent.change(screen.getByTestId('oh-sse-search'), { target: { value: 'nope-nothing' } });
    expect(screen.queryAllByTestId('oh-sse-event-row')).toHaveLength(0);
    expect(screen.getByText('No events match.')).toBeTruthy();
  });

  it('clear hides current events but keeps the lifecycle rows', () => {
    const items = itemsOf(BODY);
    render(<ResponseSseEventList items={items} count={items.length} lifecycle={{ ...LIFECYCLE, endedBy: 'end' }} />);
    fireEvent.click(screen.getByTestId('oh-sse-clear'));
    expect(screen.queryAllByTestId('oh-sse-event-row')).toHaveLength(0);
    expect(screen.getByTestId('oh-sse-connected-row')).toBeTruthy();
    expect(screen.getByTestId('oh-sse-lifecycle-row')).toBeTruthy();
  });

  it('resets display state when a new event log arrives', () => {
    const items = itemsOf(BODY);
    const { rerender } = render(<ResponseSseEventList items={items} count={items.length} lifecycle={LIFECYCLE} />);
    fireEvent.click(screen.getByTestId('oh-sse-clear'));
    expect(screen.queryAllByTestId('oh-sse-event-row')).toHaveLength(0);
    const next = itemsOf('data: fresh\n\n');
    rerender(<ResponseSseEventList items={next} count={next.length} lifecycle={LIFECYCLE} />);
    expect(screen.getAllByTestId('oh-sse-event-row')).toHaveLength(1);
  });
});

describe('ResponseSseEventList display window', () => {
  it('caps visible rows and pages down with "show older"', () => {
    const body = Array.from({ length: 250 }, (_, i) => `data: {"seq":${i}}\n`).join('\n');
    const items = itemsOf(`${body}\n`);
    expect(items).toHaveLength(250);
    render(<ResponseSseEventList items={items} count={items.length} lifecycle={LIFECYCLE} />);
    const rows = screen.getAllByTestId('oh-sse-event-row');
    expect(rows).toHaveLength(200);
    // Newest-first: the top row is the last event.
    expect(rows[0].textContent).toContain('"seq": 249');
    const older = screen.getByTestId('oh-sse-show-older');
    expect(older.textContent).toContain('50');
    fireEvent.click(older);
    expect(screen.getAllByTestId('oh-sse-event-row')).toHaveLength(250);
    expect(screen.queryByTestId('oh-sse-show-older')).toBeNull();
  });
});

describe('ResponseSseEventList row expansion', () => {
  it('expands into the mini viewer with the lossless JSON print (F3 law)', () => {
    const items = itemsOf(BODY);
    render(<ResponseSseEventList items={items} count={items.length} lifecycle={LIFECYCLE} />);
    const rows = screen.getAllByTestId('oh-sse-event-row');
    expect(screen.queryByTestId('oh-sse-event-viewer')).toBeNull();
    fireEvent.click(rows[2]);
    const viewer = screen.getByTestId('oh-sse-event-viewer');
    const editor = viewer.querySelector('textarea');
    expect(editor?.value).toContain('"resourceVersion": 9007199254740993');
    expect(rows[2].getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(rows[2]);
    expect(screen.queryByTestId('oh-sse-event-viewer')).toBeNull();
  });

  it('shows the raw wire block for non-JSON payloads', () => {
    const items = itemsOf(BODY);
    render(<ResponseSseEventList items={items} count={items.length} lifecycle={LIFECYCLE} />);
    fireEvent.click(screen.getAllByTestId('oh-sse-event-row')[1]);
    const editor = screen.getByTestId('oh-sse-event-viewer').querySelector('textarea');
    expect(editor?.value).toBe('data: plain payload');
  });
});
