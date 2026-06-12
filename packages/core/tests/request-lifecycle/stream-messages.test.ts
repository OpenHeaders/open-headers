/**
 * `appendStreamMessage` — the shared ring policy both reducers (engine
 * store + panel client mirror) apply to the lifecycle message stream.
 */

import { describe, expect, it } from 'vitest';

import type { RequestLifecycle, StreamMessage, WsStreamMessage } from '../../src/request-lifecycle';
import { appendStreamMessage, MAX_STREAM_MESSAGES_PER_REQUEST } from '../../src/request-lifecycle';

function makeLifecycle(overrides: Partial<RequestLifecycle> = {}): RequestLifecycle {
  return {
    tabId: 1,
    requestId: 'ws-1',
    url: 'wss://api.openheaders.io/socket',
    method: 'GET',
    resourceType: 'websocket',
    phase: 'headers-received',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: 1_700_000_000_000,
    hopStartedAtMs: 1_700_000_000_000,
    har: [],
    harBodyByHop: [],
    ...overrides,
  };
}

function wsFrame(n: number): WsStreamMessage {
  return { kind: 'ws', type: 'receive', atMs: 1_700_000_000_000 + n, opcode: 1, mask: false, data: `frame ${n}` };
}

describe('appendStreamMessage', () => {
  it('starts the list on first append and preserves arrival order', () => {
    const first = appendStreamMessage(makeLifecycle(), wsFrame(0));
    const second = appendStreamMessage(first, wsFrame(1));
    expect(second.messages?.map((m) => (m as WsStreamMessage).data)).toEqual(['frame 0', 'frame 1']);
    expect(second.messagesDropped).toBeUndefined();
  });

  it('appends sse and ws messages through the same list', () => {
    const sse: StreamMessage = { kind: 'sse', atMs: 1, eventName: 'message', eventId: '7', data: '{"a":1}' };
    const next = appendStreamMessage(makeLifecycle(), sse);
    expect(next.messages).toEqual([sse]);
  });

  it('does not mutate the previous lifecycle', () => {
    const prev = appendStreamMessage(makeLifecycle(), wsFrame(0));
    const before = prev.messages;
    appendStreamMessage(prev, wsFrame(1));
    expect(prev.messages).toBe(before);
    expect(prev.messages).toHaveLength(1);
  });

  it('drops oldest past the bound and accumulates the drop count', () => {
    const atCap = makeLifecycle({
      messages: Array.from({ length: MAX_STREAM_MESSAGES_PER_REQUEST }, (_, i) => wsFrame(i)),
    });
    const over = appendStreamMessage(atCap, wsFrame(MAX_STREAM_MESSAGES_PER_REQUEST));
    expect(over.messages).toHaveLength(MAX_STREAM_MESSAGES_PER_REQUEST);
    expect((over.messages?.[0] as WsStreamMessage).data).toBe('frame 1');
    expect((over.messages?.[over.messages.length - 1] as WsStreamMessage).data).toBe(
      `frame ${MAX_STREAM_MESSAGES_PER_REQUEST}`,
    );
    expect(over.messagesDropped).toBe(1);

    const overAgain = appendStreamMessage(over, wsFrame(MAX_STREAM_MESSAGES_PER_REQUEST + 1));
    expect(overAgain.messagesDropped).toBe(2);
    expect(overAgain.messages).toHaveLength(MAX_STREAM_MESSAGES_PER_REQUEST);
  });
});
