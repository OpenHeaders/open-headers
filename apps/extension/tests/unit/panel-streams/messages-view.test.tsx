/**
 * MessagesView — the Messages tab grid (host parity): toolbar filters
 * (direction + regex), Time sorting, view-local Clear all, row
 * selection feeding the payload preview, and the honest empty states.
 */

import type { RequestLifecycle, StreamMessage } from '@openheaders/core/request-lifecycle';
import type { Rule, WsAction, WsRule } from '@openheaders/core/types';
import MessagesView from '@openheaders/ui/panel/components/detail/MessagesView';
import type { InspectorFire } from '@openheaders/ui/panel/data/types';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { makeLifecycle } from '../../__factories__/lifecycle';

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

  it('direction gates the dot; error frames and drop rules never dot', () => {
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
    expect(rowDots(container)).toEqual([expect.stringContaining('dt-fire-dot--auth'), null, null]);
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

describe('MessagesView — row actions', () => {
  it('copy is always offered; the rule action reads Override until a ws rule fired', () => {
    renderView(makeWsLifecycle([ws()]));
    expect(screen.getByTitle('Copy payload')).toBeTruthy();
    expect(screen.getByTitle('Create a message rule seeded from this frame').textContent).toBe('Override');
    expect(screen.queryByTitle('Edit the message rule that fired on this request')).toBeNull();
    cleanup();
    renderView(makeWsLifecycle([ws()]), { fires: [makeFire()], rules: [makeWsRule()] });
    expect(screen.getByTitle('Edit the message rule that fired on this request').textContent).toBe('Edit rule');
    expect(screen.queryByTitle('Create a message rule seeded from this frame')).toBeNull();
  });

  it('the toolbar offers the connection-scoped Override message action', () => {
    renderView(makeWsLifecycle([ws()]));
    expect(screen.getByTitle('Create a message rule for this connection').textContent).toBe('Override message');
  });

  it('a deleted rule degrades the action to Override', () => {
    renderView(makeWsLifecycle([ws()]), { fires: [makeFire('gone')], rules: [] });
    expect(screen.queryByTitle('Edit the message rule that fired on this request')).toBeNull();
    expect(screen.getByTitle('Create a message rule seeded from this frame')).toBeTruthy();
  });
});

describe('MessagesView — empty states and truncation', () => {
  it('CDP leg with no frames yet', () => {
    renderView(makeWsLifecycle([]));
    expect(screen.getByText('No WebSocket frames exchanged yet.')).toBeTruthy();
  });

  it('heuristic leg explains the missing plane', () => {
    render(<MessagesView lifecycle={makeWsLifecycle([])} har={null} source="heuristic" fires={[]} rulesByUid={new Map()} />);
    expect(screen.getByText('WebSocket frames are only visible with debug mode enabled for this tab.')).toBeTruthy();
  });

  it('shows the ring-truncation banner when frames were dropped', () => {
    renderView(makeWsLifecycle([ws()], 3));
    expect(screen.getByText(/3 older frames dropped/)).toBeTruthy();
  });
});
