import { describe, expect, it } from 'vitest';

import { utf8ByteLength } from '../../src/protocol';
import {
  fitLifecycleWireMessage,
  type LifecycleWireMessage,
  type RequestLifecycle,
  type WsStreamMessage,
} from '../../src/request-lifecycle';
import type { InspectorHarBody } from '../../src/types/har-source';

const LIMIT = 4_000;

function makeBody(content: string): InspectorHarBody {
  return {
    method: 'GET',
    url: 'https://api.openheaders.io/v2/report',
    startedDateTime: '2026-11-24T00:00:00.000Z',
    content,
    encoding: '',
  };
}

function makeLifecycle(overrides: Partial<RequestLifecycle> = {}): RequestLifecycle {
  return {
    tabId: 7,
    requestId: 'r1',
    url: 'https://api.openheaders.io/v2/report',
    method: 'GET',
    resourceType: 'xmlhttprequest',
    phase: 'completed',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs: 1000,
    hopStartedAtMs: 1000,
    har: [],
    harBodyByHop: [],
    ...overrides,
  };
}

function frame(index: number): WsStreamMessage {
  return {
    kind: 'ws',
    type: 'receive',
    atMs: 1000 + index,
    opcode: 1,
    mask: false,
    data: `frame-${index}-${'x'.repeat(80)}`,
  };
}

function fitMessage(message: LifecycleWireMessage): string | null {
  return fitLifecycleWireMessage(message, JSON.stringify(message), LIMIT);
}

function started(text: string | null): RequestLifecycle {
  if (text === null) throw new Error('expected a message that fits');
  const parsed = JSON.parse(text) as LifecycleWireMessage;
  if (parsed.kind !== 'lifecycle-update' || parsed.update.kind !== 'started') throw new Error('not a started row');
  return parsed.update.lifecycle;
}

describe('fitLifecycleWireMessage', () => {
  it('returns the text it was given when the message already fits', () => {
    const message: LifecycleWireMessage = {
      kind: 'lifecycle-update',
      update: { kind: 'started', lifecycle: makeLifecycle() },
    };
    const serialized = JSON.stringify(message);
    expect(fitLifecycleWireMessage(message, serialized, LIMIT)).toBe(serialized);
  });

  it('a body over the limit crosses as the same update without its content, and says so', () => {
    const message: LifecycleWireMessage = {
      kind: 'lifecycle-update',
      update: { kind: 'body-attached', tabId: 7, requestId: 'r1', hopIndex: 0, body: makeBody('x'.repeat(LIMIT)) },
    };
    const text = fitMessage(message);
    expect(text).not.toBeNull();
    expect(utf8ByteLength(text ?? '')).toBeLessThanOrEqual(LIMIT);
    expect(JSON.parse(text ?? '')).toEqual({
      kind: 'lifecycle-update',
      update: {
        kind: 'body-attached',
        tabId: 7,
        requestId: 'r1',
        hopIndex: 0,
        body: { ...makeBody(''), omitted: 'too-large' },
      },
    });
  });

  it('a replayed row over the limit keeps everything but its bodies', () => {
    const lifecycle = makeLifecycle({
      statusCode: 200,
      harBodyByHop: [null, makeBody(''), makeBody('x'.repeat(LIMIT))],
    });
    const fitted = started(fitMessage({ kind: 'lifecycle-update', update: { kind: 'started', lifecycle } }));
    expect(fitted).toEqual({
      ...lifecycle,
      // The hop with no body and the hop with an empty one are untouched.
      harBodyByHop: [null, makeBody(''), { ...makeBody(''), omitted: 'too-large' }],
    });
  });

  it('counts bytes, not characters, against the limit', () => {
    // 1,500 three-byte characters are 4,500 bytes: over, though far fewer units than the limit.
    const lifecycle = makeLifecycle({ harBodyByHop: [makeBody('€'.repeat(1_500))] });
    const fitted = started(fitMessage({ kind: 'lifecycle-update', update: { kind: 'started', lifecycle } }));
    expect(fitted.harBodyByHop[0]).toEqual({ ...makeBody(''), omitted: 'too-large' });
  });

  it('a row whose message stream is over the limit keeps its newest messages and counts the rest as dropped', () => {
    const messages = Array.from({ length: 64 }, (_, i) => frame(i));
    const lifecycle = makeLifecycle({ resourceType: 'websocket', messages, messagesDropped: 3 });
    const text = fitMessage({ kind: 'lifecycle-update', update: { kind: 'started', lifecycle } });
    expect(utf8ByteLength(text ?? '')).toBeLessThanOrEqual(LIMIT);
    const fitted = started(text);
    const kept = fitted.messages ?? [];
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.length).toBeLessThan(messages.length);
    // The tail of the stream, in order.
    expect(kept).toEqual(messages.slice(messages.length - kept.length));
    expect(fitted.messagesDropped).toBe(3 + messages.length - kept.length);
  });

  it('shortens the wrapper captures by the same rule', () => {
    const messageCaptures = Array.from({ length: 64 }, (_, i) => ({
      ruleUid: 'rule-1',
      direction: 'receive' as const,
      op: 'replaced' as const,
      delivered: `capture-${i}-${'y'.repeat(80)}`,
      atMs: 1000 + i,
    }));
    const lifecycle = makeLifecycle({ resourceType: 'websocket', messageCaptures });
    const fitted = started(fitMessage({ kind: 'lifecycle-update', update: { kind: 'started', lifecycle } }));
    const kept = fitted.messageCaptures ?? [];
    expect(kept).toEqual(messageCaptures.slice(messageCaptures.length - kept.length));
    expect(fitted.messageCapturesDropped).toBe(messageCaptures.length - kept.length);
  });

  it('returns null for a row nothing can shorten', () => {
    const lifecycle = makeLifecycle({ url: `https://api.openheaders.io/${'p'.repeat(LIMIT)}` });
    expect(fitMessage({ kind: 'lifecycle-update', update: { kind: 'started', lifecycle } })).toBeNull();
  });

  it('returns null for any other message over the limit', () => {
    expect(
      fitMessage({
        kind: 'lifecycle-update',
        update: {
          kind: 'message-appended',
          tabId: 7,
          requestId: 'r1',
          message: { ...frame(0), data: 'z'.repeat(LIMIT) },
        },
      }),
    ).toBeNull();
  });
});
