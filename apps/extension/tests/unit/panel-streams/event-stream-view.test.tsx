/**
 * EventStreamView — the EventStream tab grid (host parity): Id / Type /
 * Data / Time columns, sortable headers, regex filter across all three
 * text fields, view-local Clear all, and the body-parse fallback.
 */

import type { StreamMessage } from '@openheaders/core/request-lifecycle';
import EventStreamView from '@openheaders/ui/panel/components/detail/EventStreamView';
import type { InspectorRowWithFires } from '@openheaders/ui/panel/data/inspector-row-projection';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { makeRow, type RowOverrides } from '../../__factories__/lifecycle';

afterEach(cleanup);

function sse(over: Partial<Extract<StreamMessage, { kind: 'sse' }>> = {}): StreamMessage {
  return { kind: 'sse', atMs: 1_000, eventName: 'message', eventId: '', data: 'payload', ...over };
}

function makeSseRow(over: RowOverrides = {}): InspectorRowWithFires {
  return makeRow({
    url: 'https://openheaders.io/net/sse/6',
    resourceType: 'eventsource',
    harOverrides: { mimeType: 'text/event-stream' },
    ...over,
  });
}

function dataCells(container: HTMLElement): string[] {
  return [...container.querySelectorAll('.dt-sse-list .dt-sse-row:not(.dt-sse-row-header) .dt-sse-data')].map(
    (el) => el.textContent ?? '',
  );
}

describe('EventStreamView — live plane', () => {
  it('renders Id / Type / Data / Time cells from live events', () => {
    const { container } = render(
      <EventStreamView
        row={makeSseRow({ messages: [sse({ eventId: '7', eventName: 'tick', data: 'one', atMs: 1_000 })] })}
      />,
    );
    const row = container.querySelector('.dt-sse-list .dt-sse-row:not(.dt-sse-row-header)') as HTMLElement;
    expect(row.querySelector('.dt-sse-id')?.textContent).toBe('7');
    expect(row.querySelector('.dt-sse-type')?.textContent).toBe('tick');
    expect(row.querySelector('.dt-sse-data')?.textContent).toBe('one');
    expect(row.querySelector('.dt-sse-time')?.textContent).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
  });

  it('sorts by Type on header click and toggles direction', () => {
    const { container } = render(
      <EventStreamView
        row={makeSseRow({
          messages: [sse({ eventName: 'zeta', data: 'z' }), sse({ eventName: 'alpha', data: 'a' })],
        })}
      />,
    );
    fireEvent.click(screen.getByTitle('Sort by type'));
    expect(dataCells(container)).toEqual(['a', 'z']);
    fireEvent.click(screen.getByTitle('Sort by type'));
    expect(dataCells(container)).toEqual(['z', 'a']);
  });

  it('the regex filter matches name, id and data; an invalid pattern matches nothing', () => {
    const { container } = render(
      <EventStreamView
        row={makeSseRow({
          messages: [
            sse({ eventName: 'tick', eventId: 'a1', data: 'one' }),
            sse({ eventName: 'message', eventId: 'b2', data: 'two' }),
          ],
        })}
      />,
    );
    const input = screen.getByPlaceholderText('Filter using regex (example: https?)');
    fireEvent.change(input, { target: { value: 'tick' } });
    expect(dataCells(container)).toEqual(['one']);
    fireEvent.change(input, { target: { value: 'b2' } });
    expect(dataCells(container)).toEqual(['two']);
    fireEvent.change(input, { target: { value: 'https?(' } });
    expect(dataCells(container)).toEqual([]);
  });

  it('Clear all hides everything so far', () => {
    const { container } = render(<EventStreamView row={makeSseRow({ messages: [sse({ data: 'one' })] })} />);
    fireEvent.click(screen.getByTitle('Clear all'));
    expect(dataCells(container)).toEqual([]);
  });
});

describe('EventStreamView — body-parse fallback', () => {
  it('parses SSE wire format out of a finished body; Time stays empty', () => {
    const { container } = render(
      <EventStreamView
        row={makeSseRow({
          harBodyByHop: [
            {
              method: 'GET',
              url: 'https://openheaders.io/net/sse/6',
              startedDateTime: new Date(0).toISOString(),
              content: 'id: 9\nevent: tick\ndata: from-body\n\n',
              encoding: '',
            },
          ],
        })}
      />,
    );
    const row = container.querySelector('.dt-sse-list .dt-sse-row:not(.dt-sse-row-header)') as HTMLElement;
    expect(row.querySelector('.dt-sse-id')?.textContent).toBe('9');
    expect(row.querySelector('.dt-sse-type')?.textContent).toBe('tick');
    expect(row.querySelector('.dt-sse-data')?.textContent).toBe('from-body');
    expect(row.querySelector('.dt-sse-time')?.textContent).toBe('');
  });

  it('keeps the honest empty state when nothing is captured', () => {
    render(<EventStreamView row={makeSseRow()} />);
    expect(screen.getByText(/No events captured/)).toBeTruthy();
  });
});
