/**
 * EventStreamView — the EventStream tab grid as the Messages grid's
 * twin: Id / Type / Data / Time columns with sorting, the regex filter
 * (either side of a modified event), view-local Clear all, the fire
 * rail's receive-only attribution, Original | Modified splits, wrapper
 * captures (proof upgrade + synthetic injected rows), row actions, the
 * payload preview, and the honest empty states.
 */

import '@openheaders/ui/workbench/settings/schema';
import type { RequestLifecycle, StreamMessage } from '@openheaders/core/request-lifecycle';
import type { Rule, SseAction, SseRule } from '@openheaders/core/types';
import EventStreamView from '@openheaders/ui/panel/components/detail/EventStreamView';
import type { InspectorFire } from '@openheaders/ui/panel/data/types';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { makeLifecycle } from '../../__factories__/lifecycle';

beforeAll(() => {
  // Opening the View ▾ popover mounts rc-resize-observer.
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

afterEach(cleanup);

function sse(over: Partial<Extract<StreamMessage, { kind: 'sse' }>> = {}): StreamMessage {
  return { kind: 'sse', atMs: 1_000, eventName: 'message', eventId: '', data: 'payload', ...over };
}

function makeSseLifecycle(messages: readonly StreamMessage[], dropped = 0): RequestLifecycle {
  return makeLifecycle({
    url: 'https://openheaders.io/net/sse/6',
    resourceType: 'eventsource',
    messages,
    ...(dropped > 0 ? { messagesDropped: dropped } : {}),
  });
}

function makeSseRule(action: Partial<SseAction> = {}, uid = 'sse1'): SseRule {
  return {
    schemaVersion: 5,
    uid,
    type: 'sse',
    name: 'SSE rule',
    enabled: true,
    path: 'collections/c1/rules',
    conditions: [{ uid: 'tcd00040', type: 'request-domains', values: ['openheaders.io'] }],
    action: { operation: 'modify', ...action },
  } as SseRule;
}

function makeFire(ruleUid = 'sse1'): InspectorFire {
  return { ruleUid, t: 1, pattern: 'https://openheaders.io/*', authoritative: false, evidence: 'confirmed' };
}

interface RailFixture {
  fires?: readonly InspectorFire[];
  rules?: readonly Rule[];
}

function renderView(lc: RequestLifecycle, { fires = [], rules = [] }: RailFixture = {}) {
  const rulesByUid = new Map(rules.map((r) => [r.uid, r]));
  return render(<EventStreamView lifecycle={lc} source="cdp" fires={fires} rulesByUid={rulesByUid} />);
}

function rowDots(container: HTMLElement): (string | null)[] {
  return [...container.querySelectorAll('[role="option"]')].map(
    (row) => row.querySelector('.dt-fire-dot')?.className ?? null,
  );
}

function rowTexts(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[role="option"] .dt-sse-data')].map((el) => el.textContent ?? '');
}

describe('EventStreamView — grid', () => {
  it('renders Id / Type / Data / Time cells from live events', () => {
    const { container } = renderView(
      makeSseLifecycle([sse({ eventId: '7', eventName: 'tick', data: 'one', atMs: 1_000 })]),
    );
    const row = container.querySelector('[role="option"]') as HTMLElement;
    expect(row.querySelector('.dt-sse-id')?.textContent).toBe('7');
    expect(row.querySelector('.dt-sse-type')?.textContent).toBe('tick');
    expect(row.querySelector('.dt-sse-data')?.textContent).toBe('one');
    expect(row.querySelector('.dt-sse-time')?.textContent).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
  });

  it('sorts by Type on header click and toggles direction', () => {
    const { container } = renderView(
      makeSseLifecycle([sse({ eventName: 'zeta', data: 'z' }), sse({ eventName: 'alpha', data: 'a' })]),
    );
    fireEvent.click(screen.getByTitle('Sort by type'));
    expect(rowTexts(container)).toEqual(['a', 'z']);
    fireEvent.click(screen.getByTitle('Sort by type'));
    expect(rowTexts(container)).toEqual(['z', 'a']);
  });

  it('the Time sort toggle reverses the order', () => {
    const { container } = renderView(
      makeSseLifecycle([sse({ atMs: 1, data: 'first' }), sse({ atMs: 2, data: 'second' })]),
    );
    fireEvent.click(screen.getByTitle('Sort by time'));
    expect(rowTexts(container)).toEqual(['second', 'first']);
    fireEvent.click(screen.getByTitle('Sort by time'));
    expect(rowTexts(container)).toEqual(['first', 'second']);
  });
});

describe('EventStreamView — toolbar filters', () => {
  it('the regex filter matches name, id and data; an invalid pattern matches nothing', () => {
    const { container } = renderView(
      makeSseLifecycle([
        sse({ eventName: 'tick', eventId: 'a1', data: 'one' }),
        sse({ eventName: 'message', eventId: 'b2', data: 'two' }),
      ]),
    );
    const input = screen.getByPlaceholderText('Filter using regex (example: https?)');
    fireEvent.change(input, { target: { value: 'tick' } });
    expect(rowTexts(container)).toEqual(['one']);
    fireEvent.change(input, { target: { value: 'b2' } });
    expect(rowTexts(container)).toEqual(['two']);
    fireEvent.change(input, { target: { value: 'https?(' } });
    expect(rowTexts(container)).toEqual([]);
  });

  it('Clear all hides everything so far; later events still arrive', () => {
    const { container, rerender } = renderView(makeSseLifecycle([sse({ atMs: 1, data: 'old' })]));
    fireEvent.click(screen.getByTitle('Clear all'));
    expect(rowTexts(container)).toEqual([]);
    rerender(
      <EventStreamView
        lifecycle={makeSseLifecycle([sse({ atMs: 1, data: 'old' }), sse({ atMs: 2, data: 'new' })])}
        source="cdp"
        fires={[]}
        rulesByUid={new Map()}
      />,
    );
    expect(rowTexts(container)).toEqual(['new']);
  });
});

describe('EventStreamView — body-parse fallback', () => {
  it('parses SSE wire format out of a finished body; Time stays empty', () => {
    const { container } = renderView(
      makeLifecycle({
        url: 'https://openheaders.io/net/sse/6',
        resourceType: 'eventsource',
        harBodyByHop: [
          {
            method: 'GET',
            url: 'https://openheaders.io/net/sse/6',
            startedDateTime: new Date(0).toISOString(),
            content: 'id: 9\nevent: tick\ndata: from-body\n\n',
            encoding: '',
          },
        ],
      }),
    );
    const row = container.querySelector('[role="option"]') as HTMLElement;
    expect(row.querySelector('.dt-sse-id')?.textContent).toBe('9');
    expect(row.querySelector('.dt-sse-type')?.textContent).toBe('tick');
    expect(row.querySelector('.dt-sse-data')?.textContent).toBe('from-body');
    expect(row.querySelector('.dt-sse-time')?.textContent).toBe('');
  });
});

describe('EventStreamView — fire rail', () => {
  it('no fired sse rules ⇒ no dots', () => {
    const { container } = renderView(makeSseLifecycle([sse()]));
    expect(rowDots(container)).toEqual([null]);
  });

  it('the event-name gate scopes the dot to matching events', () => {
    const rule = makeSseRule({ operation: 'drop', eventName: 'tick' });
    const { container } = renderView(
      makeSseLifecycle([sse({ eventName: 'tick', data: 'a' }), sse({ eventName: 'message', data: 'b' })]),
      { fires: [makeFire()], rules: [rule] },
    );
    expect(rowDots(container)).toEqual([expect.stringContaining('dt-fire-dot--inferred'), null]);
  });

  it('a rule without an event name takes default message events only', () => {
    const rule = makeSseRule({ operation: 'modify', payload: 'REPLACED' });
    const { container } = renderView(
      makeSseLifecycle([sse({ eventName: 'message', data: 'a' }), sse({ eventName: 'tick', data: 'b' })]),
      { fires: [makeFire()], rules: [rule] },
    );
    expect(rowDots(container)).toEqual([expect.stringContaining('dt-fire-dot--inferred'), null]);
  });

  it('a modify never earns the applied dot from the wire — capture sits before the wrapper', () => {
    const rule = makeSseRule({ operation: 'modify', payload: 'REPLACED' });
    const { container } = renderView(makeSseLifecycle([sse({ data: 'REPLACED' })]), {
      fires: [makeFire()],
      rules: [rule],
    });
    expect(rowDots(container)).toEqual([expect.stringContaining('dt-fire-dot--inferred')]);
  });

  it('an injected event dots applied only on its exact payload', () => {
    const rule = makeSseRule({ operation: 'inject', payload: 'SYNTH' });
    const { container } = renderView(makeSseLifecycle([sse({ data: 'SYNTH' }), sse({ data: 'organic' })]), {
      fires: [makeFire()],
      rules: [rule],
    });
    expect(rowDots(container)).toEqual([expect.stringContaining('dt-fire-dot--auth'), null]);
  });

  it('a deleted rule leaves the rail empty', () => {
    const { container } = renderView(makeSseLifecycle([sse({ data: 'REPLACED' })]), {
      fires: [makeFire('gone')],
      rules: [],
    });
    expect(rowDots(container)).toEqual([null]);
  });
});

describe('EventStreamView — Original | Modified split', () => {
  function splitSides(row: Element): string[] | null {
    const split = row.querySelector('.dt-sse-data--split');
    if (!split) return null;
    return [...split.querySelectorAll('.dt-sse-data-side')].map((el) => el.textContent ?? '');
  }

  it('an inferred modify splits wire original | derived replacement', () => {
    const rule = makeSseRule({
      operation: 'modify',
      payload: '{"replaced":true}',
      messageFilter: { matchType: 'contains', value: 'echo' },
    });
    const { container } = renderView(makeSseLifecycle([sse({ data: 'echo:hello' }), sse({ data: 'other' })]), {
      fires: [makeFire()],
      rules: [rule],
    });
    const rows = [...container.querySelectorAll('[role="option"]')];
    expect(splitSides(rows[0])).toEqual(['echo:hello', '{"replaced":true}']);
    expect(splitSides(rows[1])).toBeNull();
  });

  it('a dropped event splits wire original | dropped notice', () => {
    const rule = makeSseRule({ operation: 'drop', messageFilter: { matchType: 'contains', value: 'echo' } });
    const { container } = renderView(makeSseLifecycle([sse({ data: 'echo:hello' }), sse({ data: 'other' })]), {
      fires: [makeFire()],
      rules: [rule],
    });
    const rows = [...container.querySelectorAll('[role="option"]')];
    expect(splitSides(rows[0])).toEqual(['echo:hello', 'Dropped — never delivered to the page']);
    expect(rows[0].querySelector('.dt-fire-dot')?.getAttribute('title')).toContain('dropped this event');
    expect(splitSides(rows[1])).toBeNull();
  });

  it('the regex filter matches the derived modified side too', () => {
    const rule = makeSseRule({
      operation: 'modify',
      payload: '{"replaced":true}',
      messageFilter: { matchType: 'contains', value: 'echo' },
    });
    const { container } = renderView(makeSseLifecycle([sse({ data: 'echo:hello' }), sse({ data: 'other' })]), {
      fires: [makeFire()],
      rules: [rule],
    });
    const input = screen.getByPlaceholderText('Filter using regex (example: https?)');
    fireEvent.change(input, { target: { value: 'replaced' } });
    const rows = [...container.querySelectorAll('[role="option"]')];
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('echo:hello');
  });

  it('selecting a modified event opens the labeled Original | Modified preview with the inferred (i)', () => {
    const rule = makeSseRule({
      operation: 'modify',
      payload: '{"replaced":true}',
      messageFilter: { matchType: 'contains', value: 'echo' },
    });
    const { container } = renderView(makeSseLifecycle([sse({ data: 'echo:hello' })]), {
      fires: [makeFire()],
      rules: [rule],
    });
    fireEvent.click(container.querySelector('[role="option"]') as HTMLElement);
    expect(screen.getByText('Original · server → page')).toBeTruthy();
    expect(screen.getByText('Modified · server → Open Headers → page')).toBeTruthy();
    const panes = container.querySelectorAll('.dt-body-split-pane');
    expect(panes[0].textContent).toContain('echo:hello');
    expect(panes[1].textContent).toContain('replaced');
    expect(screen.getByLabelText('About Derived, not captured')).toBeTruthy();
  });

  it('selecting a dropped event opens Original | Dropped with the inferred (i)', () => {
    const rule = makeSseRule({ operation: 'drop', messageFilter: { matchType: 'contains', value: 'echo' } });
    const { container } = renderView(makeSseLifecycle([sse({ data: 'echo:hello' })]), {
      fires: [makeFire()],
      rules: [rule],
    });
    fireEvent.click(container.querySelector('[role="option"]') as HTMLElement);
    expect(screen.getByText('Original · server → page')).toBeTruthy();
    expect(screen.getByText('Dropped · never reached the page')).toBeTruthy();
    expect(screen.getByText(/never delivered to the page\./)).toBeTruthy();
    expect(screen.getByLabelText('About Dropped, inferred')).toBeTruthy();
  });

  describe('wrapper captures — recorded proof', () => {
    it('a replaced capture upgrades the split to proof — blue, no inferred (i)', () => {
      const lc = makeLifecycle({
        url: 'https://openheaders.io/net/sse/6',
        resourceType: 'eventsource',
        messages: [sse({ eventName: 'tick', data: 'echo:hello', atMs: 1_000 })],
        messageCaptures: [
          {
            ruleUid: 'sse1',
            direction: 'receive',
            op: 'replaced',
            eventName: 'tick',
            original: 'echo:hello',
            delivered: '{"replaced":true}',
            atMs: 1_000,
          },
        ],
      });
      const { container } = renderView(lc);
      const row = container.querySelector('[role="option"]') as HTMLElement;
      expect(splitSides(row)).toEqual(['echo:hello', '{"replaced":true}']);
      expect(rowDots(container)).toEqual([expect.stringContaining('dt-fire-dot--auth')]);
      fireEvent.click(row);
      expect(screen.queryByLabelText('About Derived, not captured')).toBeNull();
    });

    it('an injected capture mints a synthetic event row with the provenance banner', () => {
      const lc = makeLifecycle({
        url: 'https://openheaders.io/net/sse/6',
        resourceType: 'eventsource',
        messageCaptures: [
          {
            ruleUid: 'sse1',
            direction: 'receive',
            op: 'injected',
            eventName: 'tick',
            delivered: '{"injected":true}',
            atMs: 1_000,
          },
        ],
      });
      const { container } = renderView(lc);
      const rows = [...container.querySelectorAll('[role="option"]')];
      expect(rows).toHaveLength(1);
      expect(rows[0].className).toContain('dt-sse-row--synthetic');
      expect(rows[0].querySelector('.dt-sse-type')?.textContent).toBe('tick');
      expect(rows[0].textContent).toContain('{"injected":true}');
      expect(rowDots(container)).toEqual([expect.stringContaining('dt-fire-dot--auth')]);
      fireEvent.click(rows[0]);
      expect(screen.getByText(/Synthetic event — injected by a rule/)).toBeTruthy();
    });

    it('the capture join is event-name-scoped — a same-payload event of another type stays unannotated', () => {
      const lc = makeLifecycle({
        url: 'https://openheaders.io/net/sse/6',
        resourceType: 'eventsource',
        messages: [sse({ eventName: 'other', data: 'echo:hello', atMs: 1_000 })],
        messageCaptures: [
          {
            ruleUid: 'sse1',
            direction: 'receive',
            op: 'replaced',
            eventName: 'tick',
            original: 'echo:hello',
            delivered: 'X',
            atMs: 1_000,
          },
        ],
      });
      const { container } = renderView(lc);
      expect(rowDots(container)).toEqual([null]);
    });

    it('Clear all hides synthetic rows too and later wire events still arrive', () => {
      const lc = makeLifecycle({
        url: 'https://openheaders.io/net/sse/6',
        resourceType: 'eventsource',
        messages: [sse({ data: 'first', atMs: 1_000 })],
        messageCaptures: [
          {
            ruleUid: 'sse1',
            direction: 'receive',
            op: 'injected',
            eventName: 'message',
            delivered: 'SYNTH',
            atMs: 1_500,
          },
        ],
      });
      const { container, rerender } = renderView(lc);
      expect(container.querySelectorAll('[role="option"]')).toHaveLength(2);
      fireEvent.click(screen.getByTitle('Clear all'));
      expect(container.querySelectorAll('[role="option"]')).toHaveLength(0);
      rerender(
        <EventStreamView
          lifecycle={{ ...lc, messages: [...(lc.messages ?? []), sse({ data: 'later', atMs: 2_000 })] }}
          source="cdp"
          fires={[]}
          rulesByUid={new Map()}
        />,
      );
      expect(rowTexts(container)).toEqual(['later']);
    });
  });
});

describe('EventStreamView — keyboard navigation', () => {
  function selectionStates(container: HTMLElement): string[] {
    return [...container.querySelectorAll('[role="option"]')].map((row) => row.getAttribute('aria-selected') ?? '');
  }

  it('ArrowDown / ArrowUp walk the selection through the rows and clamp at the ends', () => {
    const { container } = renderView(
      makeSseLifecycle([sse({ atMs: 1, data: 'a' }), sse({ atMs: 2, data: 'b' }), sse({ atMs: 3, data: 'c' })]),
    );
    const list = screen.getByRole('listbox', { name: 'Server-sent events' });
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(selectionStates(container)).toEqual(['true', 'false', 'false']);
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(selectionStates(container)).toEqual(['false', 'true', 'false']);
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(selectionStates(container)).toEqual(['false', 'false', 'true']);
    fireEvent.keyDown(list, { key: 'ArrowUp' });
    expect(selectionStates(container)).toEqual(['false', 'true', 'false']);
  });

  it('ArrowUp with no selection starts from the last row; the selection feeds the preview', () => {
    const { container } = renderView(
      makeSseLifecycle([sse({ atMs: 1, data: 'first' }), sse({ atMs: 2, data: 'last' })]),
    );
    const list = screen.getByRole('listbox', { name: 'Server-sent events' });
    fireEvent.keyDown(list, { key: 'ArrowUp' });
    expect(selectionStates(container)).toEqual(['false', 'true']);
    expect(container.querySelector('.dt-msg-preview-content pre')?.textContent).toBe('last');
  });

  it('Home and End jump to the first and last row (shared-walker parity)', () => {
    const { container } = renderView(
      makeSseLifecycle([sse({ atMs: 1, data: 'a' }), sse({ atMs: 2, data: 'b' }), sse({ atMs: 3, data: 'c' })]),
    );
    const list = screen.getByRole('listbox', { name: 'Server-sent events' });
    fireEvent.keyDown(list, { key: 'End' });
    expect(selectionStates(container)).toEqual(['false', 'false', 'true']);
    fireEvent.keyDown(list, { key: 'Home' });
    expect(selectionStates(container)).toEqual(['true', 'false', 'false']);
  });

  it('ignores modified presses', () => {
    const { container } = renderView(makeSseLifecycle([sse({ atMs: 1, data: 'a' }), sse({ atMs: 2, data: 'b' })]));
    const list = screen.getByRole('listbox', { name: 'Server-sent events' });
    fireEvent.keyDown(list, { key: 'ArrowDown', ctrlKey: true });
    expect(selectionStates(container)).toEqual(['false', 'false']);
  });
});

describe('EventStreamView — preview pane', () => {
  it('starts on the no-selection empty state', () => {
    renderView(makeSseLifecycle([sse()]));
    expect(screen.getByText('No event selected')).toBeTruthy();
    expect(screen.getByText('Select an event to browse its content.')).toBeTruthy();
  });

  it('a parseable payload offers JSON | Raw; Raw shows the verbatim text', () => {
    const { container } = renderView(makeSseLifecycle([sse({ data: '{"op":"subscribe"}' })]));
    fireEvent.click(container.querySelector('[role="option"]') as HTMLElement);
    expect(container.querySelector('.dt-msg-preview-json')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Raw' }));
    expect(container.querySelector('.dt-msg-preview-json')).toBeNull();
    expect(container.querySelector('.dt-msg-preview-content pre')?.textContent).toBe('{"op":"subscribe"}');
  });

  it('a plain-text payload shows verbatim with no mode switch', () => {
    const { container } = renderView(makeSseLifecycle([sse({ data: 'not json at all' })]));
    fireEvent.click(container.querySelector('[role="option"]') as HTMLElement);
    expect(container.querySelector('.dt-msg-preview-content pre')?.textContent).toBe('not json at all');
    expect(screen.queryByRole('button', { name: 'Raw' })).toBeNull();
  });

  it('View ▾ hides the payload preview (and the orientation toggle with it); toggling back restores both', () => {
    const { container } = renderView(makeSseLifecycle([sse()]));
    expect(container.querySelector('.dt-ws-preview')).toBeTruthy();
    expect(container.querySelectorAll('[aria-pressed]')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    fireEvent.click(screen.getByLabelText('Show payload preview'));
    expect(container.querySelector('.dt-ws-preview')).toBeNull();
    expect(container.querySelectorAll('[aria-pressed]')).toHaveLength(0);
    fireEvent.click(screen.getByLabelText('Show payload preview'));
    expect(container.querySelector('.dt-ws-preview')).toBeTruthy();
    expect(container.querySelectorAll('[aria-pressed]')).toHaveLength(2);
  });
});

describe('EventStreamView — row actions', () => {
  it('copy is always offered; the rule action reads Override until an sse rule accounts for the event', () => {
    renderView(makeSseLifecycle([sse()]));
    expect(screen.getByTitle('Copy payload')).toBeTruthy();
    expect(screen.getByTitle('Create a message rule seeded from this event').textContent).toBe('Override');
    expect(screen.queryByTitle('Edit the message rule that acted on this event')).toBeNull();
    cleanup();
    renderView(makeSseLifecycle([sse()]), { fires: [makeFire()], rules: [makeSseRule()] });
    expect(screen.getByTitle('Edit the message rule that acted on this event').textContent).toBe('Edit rule');
    expect(screen.queryByTitle('Create a message rule seeded from this event')).toBeNull();
  });

  it('the edit action is per event — an unmatched event keeps Override', () => {
    const rule = makeSseRule({ operation: 'modify', eventName: 'tick', payload: 'X' });
    const { container } = renderView(
      makeSseLifecycle([
        sse({ eventName: 'tick', data: 'a', atMs: 1 }),
        sse({ eventName: 'message', data: 'b', atMs: 2 }),
      ]),
      { fires: [makeFire()], rules: [rule] },
    );
    const rows = [...container.querySelectorAll('[role="option"]')];
    expect(within(rows[0] as HTMLElement).getByTitle('Edit the message rule that acted on this event')).toBeTruthy();
    expect(within(rows[1] as HTMLElement).getByTitle('Create a message rule seeded from this event')).toBeTruthy();
  });

  it('the toolbar offers the stream-scoped Override event action', () => {
    renderView(makeSseLifecycle([sse()]));
    expect(screen.getByTitle('Create a message rule for this stream').textContent).toBe('Override event');
  });
});

describe('EventStreamView — empty states and truncation', () => {
  it('CDP leg with no events yet', () => {
    renderView(makeSseLifecycle([]));
    expect(screen.getByText('No events received yet.')).toBeTruthy();
  });

  it('heuristic leg explains the close-time materialization', () => {
    render(<EventStreamView lifecycle={makeSseLifecycle([])} source="heuristic" fires={[]} rulesByUid={new Map()} />);
    expect(screen.getByText(/only materialized once the request finishes/)).toBeTruthy();
  });

  it('a fired inject explains the synthetic-only empty capture', () => {
    const rule = makeSseRule({ operation: 'inject', payload: '{"injected":true}' });
    renderView(makeSseLifecycle([]), { fires: [makeFire()], rules: [rule] });
    expect(screen.getByText(/injected events are delivered synthetically/)).toBeTruthy();
  });

  it('an unparseable finished body says so', () => {
    render(
      <EventStreamView
        lifecycle={makeLifecycle({
          url: 'https://openheaders.io/net/sse/6',
          resourceType: 'eventsource',
          harBodyByHop: [
            {
              method: 'GET',
              url: 'https://openheaders.io/net/sse/6',
              startedDateTime: new Date(0).toISOString(),
              content: 'not sse at all',
              encoding: '',
            },
          ],
        })}
        source="heuristic"
        fires={[]}
        rulesByUid={new Map()}
      />,
    );
    expect(screen.getByText('No parseable SSE events in the response body.')).toBeTruthy();
  });

  it('shows the ring-truncation banner when events were dropped', () => {
    renderView(makeSseLifecycle([sse()], 3));
    expect(screen.getByText(/3 older events dropped/)).toBeTruthy();
  });
});

describe('EventStreamView — row view eye', () => {
  it('a detected event payload gets the view eye; plain events stay bare', () => {
    renderView(
      makeSseLifecycle([
        sse({ atMs: 1, data: btoa('sse-event@openheaders.io says hi!') }),
        sse({ atMs: 2, data: 'plain event payload' }),
      ]),
    );
    expect(screen.getAllByRole('button', { name: 'View decoded — Base64 value' })).toHaveLength(1);
  });
});
