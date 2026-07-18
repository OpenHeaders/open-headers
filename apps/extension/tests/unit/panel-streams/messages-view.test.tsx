/**
 * MessagesView — the Messages tab grid (host parity): toolbar filters
 * (direction + regex), Time sorting, view-local Clear all, row
 * selection feeding the payload preview, and the honest empty states.
 */

import '@openheaders/ui/workbench/settings/schema';
import type { RequestLifecycle, StreamMessage } from '@openheaders/core/request-lifecycle';
import type { Rule, WsAction, WsRule } from '@openheaders/core/types';
import MessagesView from '@openheaders/ui/panel/components/detail/MessagesView';
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

function ws(over: Partial<Extract<StreamMessage, { kind: 'ws' }>> = {}): StreamMessage {
  return { kind: 'ws', type: 'receive', atMs: 1_000, opcode: 1, mask: false, data: 'hello', ...over };
}

function makeWsLifecycle(messages: readonly StreamMessage[], dropped = 0): RequestLifecycle {
  return makeLifecycle({
    url: 'wss://openheaders.io/live',
    resourceType: 'websocket',
    statusCode: 101,
    messages,
    ...(dropped > 0 ? { messagesDropped: dropped } : {}),
  });
}

function makeWsRule(action: Partial<WsAction> = {}, uid = 'ws1'): WsRule {
  return {
    schemaVersion: 5,
    uid,
    type: 'ws',
    name: 'WS rule',
    enabled: true,
    path: 'collections/c1/rules',
    conditions: [{ uid: 'tcd00040', type: 'request-domains', values: ['openheaders.io'] }],
    action: { operation: 'modify', direction: 'receive', ...action },
  } as WsRule;
}

function makeFire(ruleUid = 'ws1'): InspectorFire {
  return { ruleUid, t: 1, pattern: 'wss://openheaders.io/*', authoritative: false, evidence: 'confirmed' };
}

interface RailFixture {
  fires?: readonly InspectorFire[];
  rules?: readonly Rule[];
}

function renderView(lc: RequestLifecycle, { fires = [], rules = [] }: RailFixture = {}) {
  const rulesByUid = new Map(rules.map((r) => [r.uid, r]));
  return render(<MessagesView lifecycle={lc} har={null} source="cdp" fires={fires} rulesByUid={rulesByUid} />);
}

function rowDots(container: HTMLElement): (string | null)[] {
  return [...container.querySelectorAll('[role="option"]')].map(
    (row) => row.querySelector('.dt-fire-dot')?.className ?? null,
  );
}

function rowTexts(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[role="option"] .dt-ws-data')].map((el) => el.textContent ?? '');
}

describe('MessagesView — grid', () => {
  it('renders frames in time order with direction arrows and lengths', () => {
    const { container } = renderView(
      makeWsLifecycle([
        ws({ type: 'send', atMs: 1, data: 'ping me' }),
        ws({ type: 'receive', atMs: 2, data: 'pong you' }),
      ]),
    );
    expect(rowTexts(container)).toEqual(['ping me', 'pong you']);
    const rows = container.querySelectorAll('[role="option"]');
    expect(rows[0].className).toContain('dt-ws-row--send');
    expect(rows[1].className).toContain('dt-ws-row--recv');
    expect(rows[0].querySelector('.dt-ws-len')?.textContent).toBe('7');
  });

  it('binary frames read "Binary Message" with a byte-size length', () => {
    const { container } = renderView(makeWsLifecycle([ws({ opcode: 2, data: '3q2+7w==' })]));
    const row = container.querySelector('[role="option"]') as HTMLElement;
    expect(within(row).getByText('Binary Message')).toBeTruthy();
    expect(row.querySelector('.dt-ws-len')?.textContent).toBe('4 B');
  });

  it('the Time sort toggle reverses the order', () => {
    const { container } = renderView(
      makeWsLifecycle([ws({ atMs: 1, data: 'first' }), ws({ atMs: 2, data: 'second' })]),
    );
    fireEvent.click(screen.getByTitle('Sort by time'));
    expect(rowTexts(container)).toEqual(['second', 'first']);
    fireEvent.click(screen.getByTitle('Sort by time'));
    expect(rowTexts(container)).toEqual(['first', 'second']);
  });
});

describe('MessagesView — toolbar filters', () => {
  it('the direction filter narrows to send / receive', () => {
    const { container } = renderView(
      makeWsLifecycle([ws({ type: 'send', data: 'out' }), ws({ type: 'receive', data: 'in' })]),
    );
    fireEvent.change(screen.getByTitle('Filter by direction'), { target: { value: 'send' } });
    expect(rowTexts(container)).toEqual(['out']);
    fireEvent.change(screen.getByTitle('Filter by direction'), { target: { value: 'receive' } });
    expect(rowTexts(container)).toEqual(['in']);
    fireEvent.change(screen.getByTitle('Filter by direction'), { target: { value: 'all' } });
    expect(rowTexts(container)).toEqual(['out', 'in']);
  });

  it('the regex filter matches the payload; an invalid pattern degrades to a literal', () => {
    const { container } = renderView(makeWsLifecycle([ws({ data: 'push 1/9999' }), ws({ data: 'echo: hi' })]));
    const input = screen.getByPlaceholderText('Filter using regex (example: (web)?socket)');
    fireEvent.change(input, { target: { value: 'push \\d' } });
    expect(rowTexts(container)).toEqual(['push 1/9999']);
    fireEvent.change(input, { target: { value: 'echo: (' } });
    expect(rowTexts(container)).toEqual([]);
  });

  it('Clear all hides everything so far; later frames still arrive', () => {
    const first = makeWsLifecycle([ws({ atMs: 1, data: 'old' })]);
    const { container, rerender } = renderView(first);
    fireEvent.click(screen.getByTitle('Clear all'));
    expect(rowTexts(container)).toEqual([]);
    rerender(
      <MessagesView
        lifecycle={makeWsLifecycle([ws({ atMs: 1, data: 'old' }), ws({ atMs: 2, data: 'new' })])}
        har={null}
        source="cdp"
        fires={[]}
        rulesByUid={new Map()}
      />,
    );
    expect(rowTexts(container)).toEqual(['new']);
  });
});

describe('MessagesView — keyboard navigation', () => {
  function selectionStates(container: HTMLElement): string[] {
    return [...container.querySelectorAll('[role="option"]')].map((row) => row.getAttribute('aria-selected') ?? '');
  }

  it('ArrowDown / ArrowUp walk the selection through the rows and clamp at the ends', () => {
    const { container } = renderView(
      makeWsLifecycle([ws({ atMs: 1, data: 'a' }), ws({ atMs: 2, data: 'b' }), ws({ atMs: 3, data: 'c' })]),
    );
    const list = screen.getByRole('listbox', { name: 'WebSocket messages' });
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
    const { container } = renderView(makeWsLifecycle([ws({ atMs: 1, data: 'first' }), ws({ atMs: 2, data: 'last' })]));
    const list = screen.getByRole('listbox', { name: 'WebSocket messages' });
    fireEvent.keyDown(list, { key: 'ArrowUp' });
    expect(selectionStates(container)).toEqual(['false', 'true']);
    expect(container.querySelector('.dt-msg-preview-content pre')?.textContent).toBe('last');
  });

  it('Home and End jump to the first and last row (shared-walker parity)', () => {
    const { container } = renderView(
      makeWsLifecycle([ws({ atMs: 1, data: 'a' }), ws({ atMs: 2, data: 'b' }), ws({ atMs: 3, data: 'c' })]),
    );
    const list = screen.getByRole('listbox', { name: 'WebSocket messages' });
    fireEvent.keyDown(list, { key: 'End' });
    expect(selectionStates(container)).toEqual(['false', 'false', 'true']);
    fireEvent.keyDown(list, { key: 'Home' });
    expect(selectionStates(container)).toEqual(['true', 'false', 'false']);
  });

  it('ignores modified presses', () => {
    const { container } = renderView(makeWsLifecycle([ws({ atMs: 1, data: 'a' }), ws({ atMs: 2, data: 'b' })]));
    const list = screen.getByRole('listbox', { name: 'WebSocket messages' });
    fireEvent.keyDown(list, { key: 'ArrowDown', ctrlKey: true });
    expect(selectionStates(container)).toEqual(['false', 'false']);
  });
});

describe('MessagesView — preview pane', () => {
  it('starts on the no-selection empty state', () => {
    renderView(makeWsLifecycle([ws()]));
    expect(screen.getByText('No message selected')).toBeTruthy();
    expect(screen.getByText('Select message to browse its content.')).toBeTruthy();
  });

  it('selecting a text frame shows the payload; JSON renders as a tree', () => {
    const { container } = renderView(makeWsLifecycle([ws({ data: '{"op":"subscribe"}' })]));
    fireEvent.click(container.querySelector('[role="option"]') as HTMLElement);
    const preview = container.querySelector('.dt-msg-preview-json');
    expect(preview).toBeTruthy();
    expect(preview?.textContent).toContain('subscribe');
  });

  it('a parseable payload offers JSON | Raw; Raw shows the verbatim text', () => {
    const { container } = renderView(makeWsLifecycle([ws({ data: '{"op":"subscribe"}' })]));
    fireEvent.click(container.querySelector('[role="option"]') as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'Raw' }));
    expect(container.querySelector('.dt-msg-preview-json')).toBeNull();
    expect(container.querySelector('.dt-msg-preview-content pre')?.textContent).toBe('{"op":"subscribe"}');
    fireEvent.click(screen.getByRole('button', { name: 'JSON' }));
    expect(container.querySelector('.dt-msg-preview-json')).toBeTruthy();
  });

  it('a non-JSON payload gets no mode switch', () => {
    const { container } = renderView(makeWsLifecycle([ws({ data: 'plain text' })]));
    fireEvent.click(container.querySelector('[role="option"]') as HTMLElement);
    expect(screen.queryByRole('button', { name: 'Raw' })).toBeNull();
  });

  it('View ▾ hides the payload preview (and the orientation toggle with it); toggling back restores both', () => {
    const { container } = renderView(makeWsLifecycle([ws()]));
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

  it('selecting a plain-text frame shows it verbatim', () => {
    const { container } = renderView(makeWsLifecycle([ws({ data: 'not json at all' })]));
    fireEvent.click(container.querySelector('[role="option"]') as HTMLElement);
    expect(container.querySelector('.dt-msg-preview-content pre')?.textContent).toBe('not json at all');
  });
});

describe('MessagesView — fire rail', () => {
  it('no fired ws rules ⇒ no dots', () => {
    const { container } = renderView(makeWsLifecycle([ws()]));
    expect(rowDots(container)).toEqual([null]);
  });

  it('payload equality earns the applied (blue) dot for modify', () => {
    const rule = makeWsRule({ operation: 'modify', direction: 'receive', payload: 'REPLACED' });
    const { container } = renderView(makeWsLifecycle([ws({ data: 'REPLACED' }), ws({ data: 'untouched' })]), {
      fires: [makeFire()],
      rules: [rule],
    });
    const dots = rowDots(container);
    expect(dots[0]).toContain('dt-fire-dot--auth');
    // No filter ⇒ the selector takes every receive frame — inferred only.
    expect(dots[1]).toContain('dt-fire-dot--inferred');
  });

  it('selector match without payload equality reads inferred (amber)', () => {
    const rule = makeWsRule({
      operation: 'modify',
      direction: 'receive',
      payload: '{{env.replacement}}',
      messageFilter: { matchType: 'contains', value: 'ping' },
    });
    const { container } = renderView(makeWsLifecycle([ws({ data: 'ping 4' }), ws({ data: 'pong 4' })]), {
      fires: [makeFire()],
      rules: [rule],
    });
    expect(rowDots(container)).toEqual([expect.stringContaining('dt-fire-dot--inferred'), null]);
  });

  it('direction gates the dot; error frames never dot; a receive-drop marks its frame', () => {
    const modify = makeWsRule({ operation: 'modify', direction: 'send', payload: 'OUT' }, 'ws1');
    const drop = makeWsRule({ operation: 'drop', direction: 'receive' }, 'ws2');
    const { container } = renderView(
      makeWsLifecycle([
        ws({ type: 'send', data: 'OUT' }),
        ws({ type: 'receive', data: 'OUT' }),
        ws({ type: 'error', data: 'closed', opcode: -1 }),
      ]),
      { fires: [makeFire('ws1'), makeFire('ws2')], rules: [modify, drop] },
    );
    expect(rowDots(container)).toEqual([
      expect.stringContaining('dt-fire-dot--auth'),
      // The wire captured the receive frame before the wrapper dropped it.
      expect.stringContaining('dt-fire-dot--inferred'),
      null,
    ]);
  });

  it('a send-drop never marks wire frames — a captured send was not dropped', () => {
    const drop = makeWsRule({ operation: 'drop', direction: 'send' });
    const { container } = renderView(makeWsLifecycle([ws({ type: 'send', data: 'OUT' })]), {
      fires: [makeFire()],
      rules: [drop],
    });
    expect(rowDots(container)).toEqual([null]);
  });

  it('an injected frame dots only on its exact payload', () => {
    const rule = makeWsRule({ operation: 'inject', direction: 'receive', payload: 'SYNTH' });
    const { container } = renderView(makeWsLifecycle([ws({ data: 'SYNTH' }), ws({ data: 'organic' })]), {
      fires: [makeFire()],
      rules: [rule],
    });
    expect(rowDots(container)).toEqual([expect.stringContaining('dt-fire-dot--auth'), null]);
  });

  it('a deleted rule leaves the rail empty', () => {
    const { container } = renderView(makeWsLifecycle([ws({ data: 'REPLACED' })]), {
      fires: [makeFire('gone')],
      rules: [],
    });
    expect(rowDots(container)).toEqual([null]);
  });
});

describe('MessagesView — Original | Modified split', () => {
  function splitSides(row: Element): string[] | null {
    const split = row.querySelector('.dt-ws-data--split');
    if (!split) return null;
    return [...split.querySelectorAll('.dt-ws-data-side')].map((el) => el.textContent ?? '');
  }

  it('an inferred receive-modify frame splits wire original | derived replacement', () => {
    const rule = makeWsRule({
      operation: 'modify',
      direction: 'receive',
      payload: '{"replaced":true}',
      messageFilter: { matchType: 'contains', value: 'echo' },
    });
    const { container } = renderView(makeWsLifecycle([ws({ data: 'echo:hello' }), ws({ data: 'other' })]), {
      fires: [makeFire()],
      rules: [rule],
    });
    const rows = [...container.querySelectorAll('[role="option"]')];
    expect(splitSides(rows[0])).toEqual(['echo:hello', '{"replaced":true}']);
    expect(splitSides(rows[1])).toBeNull();
  });

  it('an applied send-modify frame splits Not captured | wire replacement', () => {
    const rule = makeWsRule({ operation: 'modify', direction: 'send', payload: 'OUT' });
    const { container } = renderView(makeWsLifecycle([ws({ type: 'send', data: 'OUT' })]), {
      fires: [makeFire()],
      rules: [rule],
    });
    const row = container.querySelector('[role="option"]') as HTMLElement;
    expect(splitSides(row)).toEqual(['Not captured', 'OUT']);
  });

  it('a receive-drop frame splits wire original | dropped notice', () => {
    const rule = makeWsRule({
      operation: 'drop',
      direction: 'receive',
      messageFilter: { matchType: 'contains', value: 'echo' },
    });
    const { container } = renderView(makeWsLifecycle([ws({ data: 'echo:hello' }), ws({ data: 'other' })]), {
      fires: [makeFire()],
      rules: [rule],
    });
    const rows = [...container.querySelectorAll('[role="option"]')];
    expect(splitSides(rows[0])).toEqual(['echo:hello', 'Dropped — never delivered to the page']);
    expect(rows[0].querySelector('.dt-fire-dot')?.getAttribute('title')).toContain('dropped this frame');
    expect(splitSides(rows[1])).toBeNull();
  });

  it('selecting a dropped frame opens Original | Dropped with the inferred (i)', () => {
    const rule = makeWsRule({
      operation: 'drop',
      direction: 'receive',
      messageFilter: { matchType: 'contains', value: 'echo' },
    });
    const { container } = renderView(makeWsLifecycle([ws({ data: 'echo:hello' })]), {
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
    it('a send-modify capture shows the REAL original next to the wire replacement (blue)', () => {
      const lc = makeLifecycle({
        url: 'wss://openheaders.io/live',
        resourceType: 'websocket',
        statusCode: 101,
        messages: [ws({ type: 'send', data: 'patched', atMs: 1_000 })],
        messageCaptures: [
          {
            ruleUid: 'ws1',
            direction: 'send',
            op: 'replaced',
            original: 'original',
            delivered: 'patched',
            atMs: 1_000,
          },
        ],
      });
      const { container } = renderView(lc);
      const row = container.querySelector('[role="option"]') as HTMLElement;
      expect(splitSides(row)).toEqual(['original', 'patched']);
      expect(rowDots(container)).toEqual([expect.stringContaining('dt-fire-dot--auth')]);
      fireEvent.click(row);
      const panes = container.querySelectorAll('.dt-body-split-pane');
      expect(panes[0].textContent).toContain('original');
      expect(panes[1].textContent).toContain('patched');
      expect(screen.queryByText(/was not captured/)).toBeNull();
    });

    it('a receive-inject capture mints a synthetic frame row with the provenance banner', () => {
      const lc = makeLifecycle({
        url: 'wss://openheaders.io/live',
        resourceType: 'websocket',
        statusCode: 101,
        messageCaptures: [
          { ruleUid: 'ws1', direction: 'receive', op: 'injected', delivered: '{"injected":true}', atMs: 1_000 },
        ],
      });
      const { container } = renderView(lc);
      const rows = [...container.querySelectorAll('[role="option"]')];
      expect(rows).toHaveLength(1);
      expect(rows[0].className).toContain('dt-ws-row--synthetic');
      expect(rows[0].textContent).toContain('{"injected":true}');
      expect(rowDots(container)).toEqual([expect.stringContaining('dt-fire-dot--auth')]);
      fireEvent.click(rows[0]);
      expect(screen.getByText(/Synthetic frame — injected by a rule/)).toBeTruthy();
    });

    it('a receive-modify capture upgrades the split to proof — blue, no inferred (i)', () => {
      const lc = makeLifecycle({
        url: 'wss://openheaders.io/live',
        resourceType: 'websocket',
        statusCode: 101,
        messages: [ws({ data: 'echo:hello', atMs: 1_000 })],
        messageCaptures: [
          {
            ruleUid: 'ws1',
            direction: 'receive',
            op: 'replaced',
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

    it('a send-drop capture mints a synthetic row split original | dropped', () => {
      const lc = makeLifecycle({
        url: 'wss://openheaders.io/live',
        resourceType: 'websocket',
        statusCode: 101,
        messageCaptures: [{ ruleUid: 'ws1', direction: 'send', op: 'dropped', original: 'secret', atMs: 1_000 }],
      });
      const { container } = renderView(lc);
      const row = container.querySelector('[role="option"]') as HTMLElement;
      expect(row.className).toContain('dt-ws-row--synthetic');
      expect(splitSides(row)).toEqual(['secret', 'Dropped — never sent to the server']);
      fireEvent.click(row);
      expect(screen.getByText('Dropped · never reached the server')).toBeTruthy();
    });

    it('Clear all hides synthetic rows too and later wire frames still arrive', () => {
      const lc = makeLifecycle({
        url: 'wss://openheaders.io/live',
        resourceType: 'websocket',
        statusCode: 101,
        messages: [ws({ data: 'first', atMs: 1_000 })],
        messageCaptures: [{ ruleUid: 'ws1', direction: 'receive', op: 'injected', delivered: 'SYNTH', atMs: 1_500 }],
      });
      const { container, rerender } = renderView(lc);
      expect(container.querySelectorAll('[role="option"]')).toHaveLength(2);
      fireEvent.click(screen.getByTitle('Clear all'));
      expect(container.querySelectorAll('[role="option"]')).toHaveLength(0);
      rerender(
        <MessagesView
          lifecycle={{ ...lc, messages: [...(lc.messages ?? []), ws({ data: 'later', atMs: 2_000 })] }}
          har={null}
          source="cdp"
          fires={[]}
          rulesByUid={new Map()}
        />,
      );
      expect(rowTexts(container)).toEqual(['later']);
    });
  });

  it('inject and unresolved-payload frames never split', () => {
    const inject = makeWsRule({ operation: 'inject', direction: 'receive', payload: 'SYNTH' }, 'ws1');
    const unresolved = makeWsRule({ operation: 'modify', direction: 'receive', payload: '{{env.x}}' }, 'ws2');
    const { container } = renderView(makeWsLifecycle([ws({ data: 'SYNTH' }), ws({ data: 'organic' })]), {
      fires: [makeFire('ws1'), makeFire('ws2')],
      rules: [inject, unresolved],
    });
    const rows = [...container.querySelectorAll('[role="option"]')];
    expect(splitSides(rows[0])).toBeNull();
    expect(splitSides(rows[1])).toBeNull();
  });

  it('selecting a modified frame opens the labeled Original | Modified preview with the inferred (i)', () => {
    const rule = makeWsRule({
      operation: 'modify',
      direction: 'receive',
      payload: '{"replaced":true}',
      messageFilter: { matchType: 'contains', value: 'echo' },
    });
    const { container } = renderView(makeWsLifecycle([ws({ data: 'echo:hello' })]), {
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

  it('an applied send-modify preview explains the uncaptured original and carries no inferred (i)', () => {
    const rule = makeWsRule({ operation: 'modify', direction: 'send', payload: 'OUT' });
    const { container } = renderView(makeWsLifecycle([ws({ type: 'send', data: 'OUT' })]), {
      fires: [makeFire()],
      rules: [rule],
    });
    fireEvent.click(container.querySelector('[role="option"]') as HTMLElement);
    expect(screen.getByText('Original · page → server')).toBeTruthy();
    expect(screen.getByText('Modified · page → Open Headers → server')).toBeTruthy();
    expect(screen.getByText(/was not captured/)).toBeTruthy();
    expect(screen.queryByLabelText('About Derived, not captured')).toBeNull();
  });

  it('the regex filter matches the derived modified side too', () => {
    const rule = makeWsRule({
      operation: 'modify',
      direction: 'receive',
      payload: '{"replaced":true}',
      messageFilter: { matchType: 'contains', value: 'echo' },
    });
    const { container } = renderView(makeWsLifecycle([ws({ data: 'echo:hello' }), ws({ data: 'other' })]), {
      fires: [makeFire()],
      rules: [rule],
    });
    const input = screen.getByPlaceholderText('Filter using regex (example: (web)?socket)');
    fireEvent.change(input, { target: { value: 'replaced' } });
    const rows = [...container.querySelectorAll('[role="option"]')];
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('echo:hello');
  });

  it('an unmodified frame keeps the single-pane preview', () => {
    const { container } = renderView(makeWsLifecycle([ws({ data: 'plain' })]));
    fireEvent.click(container.querySelector('[role="option"]') as HTMLElement);
    expect(container.querySelector('.dt-msg-preview-dual')).toBeNull();
    expect(container.querySelector('.dt-msg-preview-content pre')?.textContent).toBe('plain');
  });
});

describe('MessagesView — row actions', () => {
  it('copy is always offered; the rule action reads Override until a ws rule accounts for the frame', () => {
    renderView(makeWsLifecycle([ws()]));
    expect(screen.getByTitle('Copy payload')).toBeTruthy();
    expect(screen.getByTitle('Create a message rule seeded from this frame').textContent).toBe('Override');
    expect(screen.queryByTitle('Edit the message rule that acted on this frame')).toBeNull();
    cleanup();
    renderView(makeWsLifecycle([ws()]), { fires: [makeFire()], rules: [makeWsRule()] });
    expect(screen.getByTitle('Edit the message rule that acted on this frame').textContent).toBe('Edit rule');
    expect(screen.queryByTitle('Create a message rule seeded from this frame')).toBeNull();
  });

  it('the edit action is per frame — an untouched frame keeps Override', () => {
    // Receive-modify rule with an echo filter: it accounts for the
    // receive frame only; the page's own send frame gets no rule action.
    const rule = makeWsRule({
      operation: 'modify',
      direction: 'receive',
      payload: '{"replaced":true}',
      messageFilter: { matchType: 'contains', value: 'echo' },
    });
    const { container } = renderView(
      makeWsLifecycle([ws({ type: 'send', data: 'hello', atMs: 1 }), ws({ data: 'echo:hello', atMs: 2 })]),
      { fires: [makeFire()], rules: [rule] },
    );
    const rows = [...container.querySelectorAll('[role="option"]')];
    expect(within(rows[0] as HTMLElement).getByTitle('Create a message rule seeded from this frame')).toBeTruthy();
    expect(within(rows[1] as HTMLElement).getByTitle('Edit the message rule that acted on this frame')).toBeTruthy();
  });

  it('the toolbar offers the connection-scoped Override message action', () => {
    renderView(makeWsLifecycle([ws()]));
    expect(screen.getByTitle('Create a message rule for this connection').textContent).toBe('Override message');
  });

  it('a deleted rule degrades the action to Override', () => {
    renderView(makeWsLifecycle([ws()]), { fires: [makeFire('gone')], rules: [] });
    expect(screen.queryByTitle('Edit the message rule that acted on this frame')).toBeNull();
    expect(screen.getByTitle('Create a message rule seeded from this frame')).toBeTruthy();
  });
});

describe('MessagesView — empty states and truncation', () => {
  it('CDP leg with no frames yet', () => {
    renderView(makeWsLifecycle([]));
    expect(screen.getByText('No WebSocket frames exchanged yet.')).toBeTruthy();
  });

  it('heuristic leg explains the missing plane', () => {
    render(
      <MessagesView lifecycle={makeWsLifecycle([])} har={null} source="heuristic" fires={[]} rulesByUid={new Map()} />,
    );
    expect(screen.getByText('WebSocket frames are only visible with debug mode enabled for this tab.')).toBeTruthy();
  });

  it('a fired receive-inject explains the synthetic-only empty capture', () => {
    const rule = makeWsRule({ operation: 'inject', direction: 'receive', payload: '{"injected":true}' });
    renderView(makeWsLifecycle([]), { fires: [makeFire()], rules: [rule] });
    expect(screen.getByText(/injected frames are delivered synthetically/)).toBeTruthy();
  });

  it('a fired send-inject keeps the plain empty state — its frames do cross the wire', () => {
    const rule = makeWsRule({ operation: 'inject', direction: 'send', payload: 'SYNTH' });
    renderView(makeWsLifecycle([]), { fires: [makeFire()], rules: [rule] });
    expect(screen.getByText('No WebSocket frames exchanged yet.')).toBeTruthy();
  });

  it('shows the ring-truncation banner when frames were dropped', () => {
    renderView(makeWsLifecycle([ws()], 3));
    expect(screen.getByText(/3 older frames dropped/)).toBeTruthy();
  });
});

describe('MessagesView — row view eye', () => {
  it('a detected text payload gets the view eye; plain and binary rows stay bare', () => {
    renderView(
      makeWsLifecycle([
        ws({ atMs: 1, data: btoa('ws-frame@openheaders.io says hi!') }),
        ws({ atMs: 2, data: 'plain text frame' }),
        ws({ atMs: 3, opcode: 2, data: '3q2+7w==' }),
      ]),
    );
    // Exactly one eye — the base64 TEXT frame; the plain frame has no
    // registry hit and the binary frame's cell is an opcode label, not
    // its payload.
    expect(screen.getAllByRole('button', { name: 'View decoded — Base64 value' })).toHaveLength(1);
  });
});
