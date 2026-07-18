/**
 * Message quick-create builders — `message-rule-create` +
 * `rule-draft-bridge`'s frame/event seeds.
 *
 * Counterpart of `panel-url-rule-create.test.ts` for the Messages /
 * EventStream grids' per-frame "Override" actions: the
 * kind-discriminated quick draft must round-trip ws and sse drafts,
 * the rule seed must carry only the fields the operation speaks
 * (payload never on drop, injectTrigger only on inject, empty event
 * name omitted), and the draft-bridge seeds must gate on what a rule
 * can actually select (text frames only for ws; default `message`
 * event name omitted for sse). The payload plane is WIRE-space: seeds
 * carry the captured frame/event bytes verbatim and Save / hand-off
 * store the quick payload AS IS (the body editor owns the view).
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { RuleCondition, SseRuleDraft, WsRuleDraft } from '@openheaders/core/types';
import {
  buildMessageRuleSeed,
  type MessageQuickDraft,
  mergeQuickIntoMessageDraft,
  messageQuickDraftValid,
  seedMessageQuickDraft,
} from '@openheaders/ui/panel/data/rule-create/message-rule-create';
import {
  buildSseDraftFromConnection,
  buildSseDraftFromEvent,
  buildWsDraftFromConnection,
  buildWsDraftFromFrame,
} from '@openheaders/ui/panel/data/rule-create/rule-draft-bridge';
import { describe, expect, it } from 'vitest';
import { makeLifecycle } from '../__factories__/lifecycle';

const WS_URL = 'wss://stream.openheaders.io/socket';
const SSE_URL = 'https://stream.openheaders.io/events';

function wsLifecycle(): RequestLifecycle {
  return makeLifecycle({ url: WS_URL, resourceType: 'websocket' });
}

function sseLifecycle(): RequestLifecycle {
  return makeLifecycle({ url: SSE_URL, resourceType: 'eventsource' });
}

const CONDITIONS: RuleCondition[] = [{ uid: 'c1', type: 'url-filter', values: [WS_URL] }];

describe('seedMessageQuickDraft', () => {
  it('seeds ws create defaults from a selector-only draft', () => {
    const draft: WsRuleDraft = { type: 'ws', url: WS_URL };
    expect(seedMessageQuickDraft(draft)).toEqual({
      kind: 'ws',
      operation: 'modify',
      direction: 'receive',
      filterType: 'none',
      filterValue: '',
      payload: '',
      injectTrigger: 'open',
    });
  });

  it('seeds sse fields including the event name', () => {
    const draft: SseRuleDraft = {
      type: 'sse',
      url: SSE_URL,
      operation: 'drop',
      eventName: 'price',
      messageFilter: { matchType: 'contains', value: 'BTC' },
    };
    expect(seedMessageQuickDraft(draft)).toEqual({
      kind: 'sse',
      operation: 'drop',
      eventName: 'price',
      filterType: 'contains',
      filterValue: 'BTC',
      payload: '',
      injectTrigger: 'open',
    });
  });

  it('seeds a captured payload verbatim', () => {
    const draft: WsRuleDraft = { type: 'ws', url: WS_URL, payload: '{"op":"subscribe"}' };
    expect(seedMessageQuickDraft(draft).payload).toBe('{"op":"subscribe"}');
  });
});

describe('buildMessageRuleSeed', () => {
  const wsQuick: MessageQuickDraft = {
    kind: 'ws',
    operation: 'modify',
    direction: 'send',
    filterType: 'contains',
    filterValue: 'ping',
    payload: '{"kind":"pong"}',
    injectTrigger: 'open',
  };

  it('builds a ws seed carrying direction and filter', () => {
    expect(buildMessageRuleSeed(wsQuick, 'WS messages · stream.openheaders.io', CONDITIONS)).toEqual({
      name: 'WS messages · stream.openheaders.io',
      enabled: true,
      type: 'ws',
      conditions: CONDITIONS,
      action: {
        operation: 'modify',
        direction: 'send',
        messageFilter: { matchType: 'contains', value: 'ping' },
        payload: '{"kind":"pong"}',
      },
    });
  });

  it('builds an sse seed carrying the event name and omitting it when blank', () => {
    const sseQuick: MessageQuickDraft = {
      kind: 'sse',
      operation: 'inject',
      eventName: 'price',
      filterType: 'none',
      filterValue: '',
      payload: '{"symbol":"BTC"}',
      injectTrigger: 'message',
    };
    expect(buildMessageRuleSeed(sseQuick, 'SSE events', CONDITIONS)).toEqual({
      name: 'SSE events',
      enabled: true,
      type: 'sse',
      conditions: CONDITIONS,
      action: {
        operation: 'inject',
        eventName: 'price',
        payload: '{"symbol":"BTC"}',
        injectTrigger: 'message',
      },
    });
    const action = buildMessageRuleSeed({ ...sseQuick, eventName: '  ' }, 'SSE events', CONDITIONS).action;
    expect('eventName' in action).toBe(false);
  });

  it('drop carries no payload and non-inject no trigger', () => {
    const seed = buildMessageRuleSeed({ ...wsQuick, operation: 'drop' }, 'n', CONDITIONS);
    expect(seed.action).toEqual({
      operation: 'drop',
      direction: 'send',
      messageFilter: { matchType: 'contains', value: 'ping' },
    });
  });

  it('an untouched draft stores the captured bytes exactly', () => {
    const draft: WsRuleDraft = { type: 'ws', url: WS_URL, payload: '{"op":"subscribe"}' };
    const quick = seedMessageQuickDraft(draft);
    const seed = buildMessageRuleSeed(quick, 'n', CONDITIONS);
    expect(seed.action.payload).toBe('{"op":"subscribe"}');
  });

  it('stores the wire-space payload AS IS — a Raw-mode profile change is honored', () => {
    const draft: WsRuleDraft = { type: 'ws', url: WS_URL, payload: '{"op":"subscribe"}' };
    const quick = { ...seedMessageQuickDraft(draft), payload: '{\n  "op": "unsubscribe"\n}' };
    const seed = buildMessageRuleSeed(quick, 'n', CONDITIONS);
    expect(seed.action.payload).toBe('{\n  "op": "unsubscribe"\n}');
  });
});

describe('mergeQuickIntoMessageDraft', () => {
  it('folds ws edits back into the handoff draft', () => {
    const draft: WsRuleDraft = { type: 'ws', url: WS_URL, operation: 'modify', direction: 'receive' };
    const quick = seedMessageQuickDraft(draft);
    const merged = mergeQuickIntoMessageDraft(draft, {
      ...quick,
      kind: 'ws',
      direction: 'send',
      operation: 'inject',
      payload: '{"hello":1}',
      injectTrigger: 'message',
    });
    expect(merged).toMatchObject({
      type: 'ws',
      url: WS_URL,
      operation: 'inject',
      direction: 'send',
      payload: '{"hello":1}',
      injectTrigger: 'message',
    });
  });

  it('folds sse edits back and normalizes a blank event name to absent', () => {
    const draft: SseRuleDraft = { type: 'sse', url: SSE_URL, operation: 'modify', eventName: 'price' };
    const quick = seedMessageQuickDraft(draft);
    const merged = mergeQuickIntoMessageDraft(draft, { ...quick, kind: 'sse', eventName: '   ' });
    expect(merged.type).toBe('sse');
    expect(merged).toMatchObject({ url: SSE_URL, operation: 'modify', eventName: undefined });
  });

  it('a drop edit strips the payload from the handoff', () => {
    const draft: WsRuleDraft = { type: 'ws', url: WS_URL, payload: '{"old":1}' };
    const quick = seedMessageQuickDraft(draft);
    const merged = mergeQuickIntoMessageDraft(draft, { ...quick, operation: 'drop' });
    expect(merged.payload).toBeUndefined();
  });

  it('hands off the wire-space payload as is — untouched draft byte-exact', () => {
    const draft: WsRuleDraft = { type: 'ws', url: WS_URL, payload: '{"old":1}' };
    const quick = seedMessageQuickDraft(draft);
    expect(mergeQuickIntoMessageDraft(draft, quick).payload).toBe('{"old":1}');
    const edited = mergeQuickIntoMessageDraft(draft, { ...quick, payload: '{\n  "old": 2\n}' });
    expect(edited.payload).toBe('{\n  "old": 2\n}');
  });
});

describe('messageQuickDraftValid', () => {
  it('requires a value only when a filter type is chosen', () => {
    const quick = seedMessageQuickDraft({ type: 'sse', url: SSE_URL });
    expect(messageQuickDraftValid(quick)).toBe(true);
    expect(messageQuickDraftValid({ ...quick, filterType: 'regex', filterValue: ' ' })).toBe(false);
    expect(messageQuickDraftValid({ ...quick, filterType: 'regex', filterValue: 'x' })).toBe(true);
  });
});

describe('buildWsDraftFromFrame / buildWsDraftFromConnection', () => {
  it('seeds selector defaults from the connection', () => {
    expect(buildWsDraftFromConnection(wsLifecycle())).toEqual({
      type: 'ws',
      url: WS_URL,
      operation: 'modify',
      direction: 'receive',
    });
  });

  it('text frames seed a contains filter and the payload; binary frames do not', () => {
    const lc = wsLifecycle();
    const text = buildWsDraftFromFrame(lc, { type: 'send', opcode: 1, data: '{"op":"subscribe"}' });
    expect(text).toMatchObject({
      direction: 'send',
      messageFilter: { matchType: 'contains', value: '{"op":"subscribe"}' },
    });
    expect(text.payload).toBe('{"op":"subscribe"}');
    const binary = buildWsDraftFromFrame(lc, { type: 'receive', opcode: 2, data: 'aGVsbG8=' });
    expect(binary).toEqual({ type: 'ws', url: WS_URL, operation: 'modify', direction: 'receive' });
  });
});

describe('buildSseDraftFromEvent / buildSseDraftFromConnection', () => {
  it('seeds selector defaults from the stream', () => {
    expect(buildSseDraftFromConnection(sseLifecycle())).toEqual({
      type: 'sse',
      url: SSE_URL,
      operation: 'modify',
    });
  });

  it('seeds the event name, filter and payload from a named event', () => {
    const draft = buildSseDraftFromEvent(sseLifecycle(), { eventName: 'price', data: '{"symbol":"BTC","usd":1}' });
    expect(draft).toMatchObject({
      type: 'sse',
      url: SSE_URL,
      operation: 'modify',
      eventName: 'price',
      messageFilter: { matchType: 'contains', value: '{"symbol":"BTC","usd":1}' },
    });
    expect(draft.payload).toBe('{"symbol":"BTC","usd":1}');
  });

  it('omits the default message event name', () => {
    const draft = buildSseDraftFromEvent(sseLifecycle(), { eventName: 'message', data: 'plain text' });
    expect('eventName' in draft).toBe(false);
    expect(draft.payload).toBe('plain text');
  });
});
