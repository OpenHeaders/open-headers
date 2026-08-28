/**
 * WebSocket response example draft — the captured request block's
 * compose mode round trip: `messageFormat` / `binaryEncoding` land on
 * the capture only when they carry meaning (raw flavor, non-text; the
 * spelling only under binary) and read back with their defaults.
 */

import type { WsResponseExample } from '@openheaders/core/types';
import {
  capturedWsRequestFromDraft,
  wsExampleDraftFingerprint,
  wsExampleToDraft,
} from '@openheaders/ui/workbench/components/ws-response-example/ws-example-draft';
import { describe, expect, it } from 'vitest';

const example = (request: Partial<WsResponseExample['request']> = {}): WsResponseExample => ({
  schemaVersion: 5,
  uid: 'wsex0001',
  path: 'requests/live-wsrq0001/examples/first-wsex0001',
  websocketRequestUid: 'wsrq0001',
  name: 'First',
  capturedAt: '2026-08-28T09:00:00.000Z',
  request: {
    url: 'wss://echo.openheaders.io/live',
    flavor: 'raw',
    subprotocols: [],
    headers: [],
    params: [],
    message: 'aGVsbG8=',
    sslVerification: true,
    ...request,
  },
  response: { protocol: '', extensions: '', messages: [], droppedMessages: 0, close: null, durationMs: 12 },
});

describe('ws example draft — compose mode', () => {
  it('reads an absent format as text over base64', () => {
    const draft = wsExampleToDraft(example());
    expect(draft.messageFormat).toBe('text');
    expect(draft.binaryEncoding).toBe('base64');
  });

  it('captures the format only off text and the spelling only under binary', () => {
    const draft = wsExampleToDraft(example({ messageFormat: 'binary', binaryEncoding: 'hex' }));
    expect(capturedWsRequestFromDraft(draft, 'raw')).toMatchObject({ messageFormat: 'binary', binaryEncoding: 'hex' });

    const json = capturedWsRequestFromDraft({ ...draft, messageFormat: 'json' }, 'raw');
    expect(json.messageFormat).toBe('json');
    expect('binaryEncoding' in json).toBe(false);

    const text = capturedWsRequestFromDraft({ ...draft, messageFormat: 'text' }, 'raw');
    expect('messageFormat' in text).toBe(false);

    const socketio = capturedWsRequestFromDraft(draft, 'socketio');
    expect('messageFormat' in socketio).toBe(false);
  });

  it('fingerprints the spelling only while the format is binary', () => {
    const draft = wsExampleToDraft(example({ messageFormat: 'binary' }));
    expect(wsExampleDraftFingerprint(draft)).not.toBe(wsExampleDraftFingerprint({ ...draft, binaryEncoding: 'hex' }));
    const text = { ...draft, messageFormat: 'text' as const };
    expect(wsExampleDraftFingerprint(text)).toBe(wsExampleDraftFingerprint({ ...text, binaryEncoding: 'hex' }));
  });
});
