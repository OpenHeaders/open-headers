// @vitest-environment jsdom
/**
 * ResponseSseEventList — the event-list surface both phases share.
 * Pins the ratified laws: one row per wire event newest-first with the
 * colored name badge + inline data preview; comment blocks as their
 * own rows; session-only timestamps rendered when provided, omitted
 * when not; lifecycle rows (connected bottom, ended top) derived from
 * props — never invented; search and Clear display-only; the display
 * window capped with "show older" paging; per-row expansion mounting
 * the mini viewer over the DATA payload — lossless JSON print (int64
 * verbatim — the F3 law), per-line JSON documents printed in sequence,
 * plain payload text otherwise, raw wire block only for comment-only
 * rows. The shared Monaco CodeEditor is mocked to a <textarea> —
 * the contract under test is the list, not Monaco.
 */

import ResponseSseEventList from '@openheaders/ui/workbench/components/request-editor/response/ResponseSseEventList';
import { parseSseEventItems } from '@openheaders/ui/workbench/components/request-editor/response/response-sse';
// Registers the requests.* settings the list's toolbar reads/writes.
import '@openheaders/ui/workbench/settings/schema/requests';
import { reset as resetSetting, set as setSetting } from '@openheaders/ui/workbench/settings/store';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@openheaders/ui/workbench/components/shared/CodeEditor', () => ({
  default: ({ value, readOnly }: { value?: string; readOnly?: boolean }) => (
    <textarea data-testid="code-editor" value={value} readOnly={readOnly} onChange={() => {}} />
  ),
}));

// antd's Dropdown measures via rc-resize-observer — jsdom has none.
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
  resetSetting('requests.sseEventsNewestFirst');
  resetSetting('requests.sseEventsGroupByName');
  resetSetting('requests.sseEventsGroupRowLimit');
});

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

describe('ResponseSseEventList new-events pill', () => {
  it('offers a jump-to-top pill when events commit while scrolled away, and dismisses on click', () => {
    const items = itemsOf(BODY);
    const { container, rerender } = render(<ResponseSseEventList items={items} count={1} lifecycle={LIFECYCLE} />);
    const scroller = container.querySelector('.rules-thin-scrollbar');
    if (!scroller) throw new Error('scroller must render');
    // At the top, a growing count needs no pill — the new row is visible.
    rerender(<ResponseSseEventList items={items} count={2} lifecycle={LIFECYCLE} />);
    expect(screen.queryByTestId('oh-sse-new-events')).toBeNull();
    fireEvent.scroll(scroller, { target: { scrollTop: 120 } });
    rerender(<ResponseSseEventList items={items} count={3} lifecycle={LIFECYCLE} />);
    fireEvent.click(screen.getByTestId('oh-sse-new-events'));
    expect(screen.queryByTestId('oh-sse-new-events')).toBeNull();
  });

  it('scrolling back to the top dismisses the pill', () => {
    const items = itemsOf(BODY);
    const { container, rerender } = render(<ResponseSseEventList items={items} count={2} lifecycle={LIFECYCLE} />);
    const scroller = container.querySelector('.rules-thin-scrollbar');
    if (!scroller) throw new Error('scroller must render');
    fireEvent.scroll(scroller, { target: { scrollTop: 120 } });
    rerender(<ResponseSseEventList items={items} count={3} lifecycle={LIFECYCLE} />);
    expect(screen.getByTestId('oh-sse-new-events')).toBeTruthy();
    fireEvent.scroll(scroller, { target: { scrollTop: 0 } });
    expect(screen.queryByTestId('oh-sse-new-events')).toBeNull();
  });
});

describe('ResponseSseEventList sort order', () => {
  it('flips to oldest-first: rows ascend and the lifecycle rows swap edges', async () => {
    const items = itemsOf(BODY);
    render(
      <ResponseSseEventList items={items} count={items.length} lifecycle={{ ...LIFECYCLE, endedBy: 'stop' }} />,
    );
    fireEvent.click(screen.getByTestId('oh-sse-sort'));
    fireEvent.click(await screen.findByText('Oldest first'));
    const rows = screen.getAllByTestId('oh-sse-event-row');
    expect(rows[0].textContent).toContain('tick');
    expect(rows[2].textContent).toContain('heartbeat');
    // Connected leads, the ended row trails — chronological reading order.
    const connected = screen.getByTestId('oh-sse-connected-row');
    const ended = screen.getByTestId('oh-sse-lifecycle-row');
    expect(connected.compareDocumentPosition(rows[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(rows[2].compareDocumentPosition(ended) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Flipping back restores newest-first.
    fireEvent.click(screen.getByTestId('oh-sse-sort'));
    fireEvent.click(await screen.findByText('Newest first'));
    expect(screen.getAllByTestId('oh-sse-event-row')[0].textContent).toContain('heartbeat');
  });
});

describe('ResponseSseEventList group by event name', () => {
  const GROUP_BODY = [
    'event: tick',
    'data: {"seq":1}',
    '',
    'data: {"seq":2}',
    '',
    'event: tick',
    'data: {"seq":3}',
    '',
    ': heartbeat',
    '',
  ].join('\n');

  async function enableGrouping() {
    fireEvent.click(screen.getByTestId('oh-sse-sort'));
    fireEvent.click(await screen.findByText('Group by event name'));
  }

  it('clusters rows under name headers — anchored to first appearance, arrival order within', async () => {
    const items = itemsOf(GROUP_BODY);
    render(<ResponseSseEventList items={items} count={items.length} lifecycle={LIFECYCLE} />);
    await enableGrouping();
    const headers = screen.getAllByTestId('oh-sse-group-header');
    expect(headers).toHaveLength(3);
    // Group order anchors to first appearance (tick → message →
    // comment), read newest-minted first — new events never make
    // existing groups trade places.
    expect(headers[0].textContent).toContain('comment');
    expect(headers[1].textContent).toContain('message');
    expect(headers[2].textContent).toContain('tick');
    expect(headers[2].textContent).toContain('2 events');
    const rows = screen.getAllByTestId('oh-sse-event-row');
    expect(rows).toHaveLength(4);
    // Within the tick group, arrival order (newest-first) holds.
    expect(rows[2].textContent).toContain('"seq": 3');
    expect(rows[3].textContent).toContain('"seq": 1');
  });

  it('anchored group order holds as new events commit to an old group', async () => {
    const items = itemsOf(GROUP_BODY);
    const { rerender } = render(<ResponseSseEventList items={items} count={3} lifecycle={LIFECYCLE} />);
    await enableGrouping();
    // Committing the comment block (newest) after tick/message groups
    // exist mints ITS group at the new edge; tick/message stay put.
    rerender(<ResponseSseEventList items={items} count={4} lifecycle={LIFECYCLE} />);
    const headers = screen.getAllByTestId('oh-sse-group-header');
    expect(headers[0].textContent).toContain('comment');
    expect(headers[1].textContent).toContain('message');
    expect(headers[2].textContent).toContain('tick');
  });

  it('collapsing a group hides its rows; expanding restores them', async () => {
    const items = itemsOf(GROUP_BODY);
    render(<ResponseSseEventList items={items} count={items.length} lifecycle={LIFECYCLE} />);
    await enableGrouping();
    const tickHeader = screen.getAllByTestId('oh-sse-group-header')[2];
    fireEvent.click(tickHeader);
    expect(tickHeader.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getAllByTestId('oh-sse-event-row')).toHaveLength(2);
    fireEvent.click(tickHeader);
    expect(screen.getAllByTestId('oh-sse-event-row')).toHaveLength(4);
  });

  it('toggling grouping off restores the flat list', async () => {
    const items = itemsOf(GROUP_BODY);
    render(<ResponseSseEventList items={items} count={items.length} lifecycle={LIFECYCLE} />);
    await enableGrouping();
    expect(screen.getAllByTestId('oh-sse-group-header')).toHaveLength(3);
    await enableGrouping();
    expect(screen.queryByTestId('oh-sse-group-header')).toBeNull();
    expect(screen.getAllByTestId('oh-sse-event-row')).toHaveLength(4);
  });

  it('search narrows within groups and grouping respects the sort flip', async () => {
    const items = itemsOf(GROUP_BODY);
    render(<ResponseSseEventList items={items} count={items.length} lifecycle={LIFECYCLE} />);
    await enableGrouping();
    fireEvent.click(screen.getByTestId('oh-sse-sort'));
    fireEvent.click(await screen.findByText('Oldest first'));
    const headers = screen.getAllByTestId('oh-sse-group-header');
    // Oldest-first reading: first-seen name leads.
    expect(headers[0].textContent).toContain('tick');
    const rows = screen.getAllByTestId('oh-sse-event-row');
    expect(rows[0].textContent).toContain('"seq": 1');
    expect(rows[1].textContent).toContain('"seq": 3');
    fireEvent.change(screen.getByTestId('oh-sse-search'), { target: { value: 'seq' } });
    expect(screen.getAllByTestId('oh-sse-group-header')).toHaveLength(2);
    expect(screen.getAllByTestId('oh-sse-event-row')).toHaveLength(3);
  });

  it('caps each group to its newest N rows under the row limit — headers keep real totals', () => {
    setSetting('requests.sseEventsGroupByName', true);
    setSetting('requests.sseEventsGroupRowLimit', 1);
    const items = itemsOf(GROUP_BODY);
    render(<ResponseSseEventList items={items} count={items.length} lifecycle={LIFECYCLE} />);
    const headers = screen.getAllByTestId('oh-sse-group-header');
    expect(headers).toHaveLength(3);
    // The tick group holds 2 events but mounts only the NEWEST one.
    expect(headers[2].textContent).toContain('2 events');
    const rows = screen.getAllByTestId('oh-sse-event-row');
    expect(rows).toHaveLength(3);
    expect(rows[2].textContent).toContain('"seq": 3');
    expect(screen.queryByText(/"seq": 1/)).toBeNull();
  });

  it('the sticky overlay pins the group spanning the viewport top, still collapsible', () => {
    setSetting('requests.sseEventsGroupByName', true);
    const body = Array.from({ length: 60 }, (_, i) => `event: tick\ndata: {"seq":${i}}\n`).join('\n');
    const items = itemsOf(`${body}\n`);
    const { container } = render(<ResponseSseEventList items={items} count={items.length} lifecycle={LIFECYCLE} />);
    const scroller = container.querySelector('.rules-thin-scrollbar');
    if (!scroller) throw new Error('scroller must render');
    expect(screen.queryByTestId('oh-sse-sticky-header')).toBeNull();
    Object.defineProperty(scroller, 'clientHeight', { value: 300 });
    fireEvent.scroll(scroller, { target: { scrollTop: 400 } });
    const sticky = screen.getByTestId('oh-sse-sticky-header');
    expect(sticky.textContent).toContain('tick');
    expect(sticky.textContent).toContain('60 events');
    // Collapsing from the overlay folds the group's rows away.
    fireEvent.click(sticky);
    expect(screen.queryAllByTestId('oh-sse-event-row')).toHaveLength(0);
  });

  it('sort/group choices are global settings that survive remounts (Send/Stop lifecycle)', async () => {
    const items = itemsOf(GROUP_BODY);
    const first = render(<ResponseSseEventList items={items} count={items.length} lifecycle={LIFECYCLE} />);
    await enableGrouping();
    expect(screen.getAllByTestId('oh-sse-group-header').length).toBeGreaterThan(0);
    first.unmount();
    // A fresh instance (the live→materialized remount) reads the same
    // setting — grouping stays on until the user changes it.
    render(<ResponseSseEventList items={items} count={items.length} lifecycle={LIFECYCLE} />);
    expect(screen.getAllByTestId('oh-sse-group-header').length).toBeGreaterThan(0);
  });
});

describe('ResponseSseEventList virtualization', () => {
  it('every event is reachable — no cap, no pager', () => {
    const body = Array.from({ length: 250 }, (_, i) => `data: {"seq":${i}}\n`).join('\n');
    const items = itemsOf(`${body}\n`);
    expect(items).toHaveLength(250);
    render(<ResponseSseEventList items={items} count={items.length} lifecycle={LIFECYCLE} />);
    // jsdom's zero-height viewport takes the shared window hook's
    // render-everything fallback — the full list, no pager row.
    const rows = screen.getAllByTestId('oh-sse-event-row');
    expect(rows).toHaveLength(250);
    expect(rows[0].textContent).toContain('"seq": 249');
    expect(rows[249].textContent).toContain('"seq": 0');
    expect(screen.queryByTestId('oh-sse-show-older')).toBeNull();
  });

  it('mounts only the viewport slice once the scroller has layout', () => {
    const body = Array.from({ length: 1000 }, (_, i) => `data: {"seq":${i}}\n`).join('\n');
    const items = itemsOf(`${body}\n`);
    const { container } = render(<ResponseSseEventList items={items} count={items.length} lifecycle={LIFECYCLE} />);
    const scroller = container.querySelector('.rules-thin-scrollbar');
    if (!scroller) throw new Error('scroller must render');
    Object.defineProperty(scroller, 'clientHeight', { value: 400 });
    fireEvent.scroll(scroller, { target: { scrollTop: 0 } });
    // 400px viewport + 600px overscan at 28px rows ≈ 36 rows — three
    // orders below the 1000-row log.
    const mounted = screen.getAllByTestId('oh-sse-event-row').length;
    expect(mounted).toBeGreaterThan(10);
    expect(mounted).toBeLessThan(100);
    // Scrolled to the far end, the tail rows mount instead.
    fireEvent.scroll(scroller, { target: { scrollTop: 27000 } });
    expect(screen.getAllByTestId('oh-sse-event-row')[0].textContent).not.toContain('"seq": 999');
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

  it('shows the payload text verbatim for non-JSON payloads', () => {
    const items = itemsOf(BODY);
    render(<ResponseSseEventList items={items} count={items.length} lifecycle={LIFECYCLE} />);
    fireEvent.click(screen.getAllByTestId('oh-sse-event-row')[1]);
    const editor = screen.getByTestId('oh-sse-event-viewer').querySelector('textarea');
    expect(editor?.value).toBe('plain payload');
  });

  it('pretty-prints a multi-line payload whose data lines are each JSON documents', () => {
    const items = itemsOf('event: tick\ndata: {"seq":5}\ndata: {"named":true}\n\n');
    render(<ResponseSseEventList items={items} count={items.length} lifecycle={LIFECYCLE} />);
    fireEvent.click(screen.getByTestId('oh-sse-event-row'));
    const editor = screen.getByTestId('oh-sse-event-viewer').querySelector('textarea');
    expect(editor?.value).toBe('{\n  "seq": 5\n}\n{\n  "named": true\n}');
  });

  it('keeps the raw wire block for comment-only rows', () => {
    const items = itemsOf(BODY);
    render(<ResponseSseEventList items={items} count={items.length} lifecycle={LIFECYCLE} />);
    fireEvent.click(screen.getAllByTestId('oh-sse-event-row')[0]);
    const editor = screen.getByTestId('oh-sse-event-viewer').querySelector('textarea');
    expect(editor?.value).toBe(': heartbeat');
  });
});
