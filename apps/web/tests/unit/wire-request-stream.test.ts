/**
 * Live send-stream mirror over the web tab's wire — the mirror's laws:
 * `requestStreamEvent` frames claim synchronously and re-broadcast
 * their payload verbatim into the in-tab fan-out (the channel
 * `useLiveSendStream` subscribes to), a malformed frame of the type is
 * still ours to drop, and every other frame type passes onward.
 */

import { setHostLogger } from '@openheaders/core/logger';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { subscribeLocal } from '@/host/web-broadcast';
import { handleIncomingRequestStreamFrame } from '@/host/wire-request-stream';

function streamFrame(overrides?: Partial<{ sendId: unknown; seq: unknown; kind: unknown }>): Record<string, unknown> {
  return {
    type: 'requestStreamEvent',
    payload: { sendId: 'send-1', seq: 2, kind: 'chunk', chunkBase64: 'YWJj', totalBytes: 3, ...overrides },
  };
}

describe('wire-request-stream', () => {
  let received: unknown[];
  let unsubscribe: () => void;

  beforeAll(() => {
    setHostLogger({ error() {}, warn() {}, info() {}, debug() {} });
  });

  beforeEach(() => {
    received = [];
    unsubscribe = subscribeLocal('requestStreamEvent', (payload) => {
      received.push(payload);
    });
    return () => unsubscribe();
  });

  it('claims a stream frame and re-broadcasts its payload verbatim', () => {
    const frame = streamFrame();
    expect(handleIncomingRequestStreamFrame(frame)).toBe(true);
    expect(received).toEqual([frame.payload]);
  });

  it('claims a malformed frame of its type without broadcasting', () => {
    expect(handleIncomingRequestStreamFrame(streamFrame({ seq: 'not-a-number' }))).toBe(true);
    expect(handleIncomingRequestStreamFrame({ type: 'requestStreamEvent' })).toBe(true);
    expect(received).toEqual([]);
  });

  it('passes other frame types onward', () => {
    expect(handleIncomingRequestStreamFrame({ type: 'pong' })).toBe(false);
    expect(handleIncomingRequestStreamFrame({ type: 'migrationPullEvent', payload: {} })).toBe(false);
    expect(handleIncomingRequestStreamFrame(null)).toBe(false);
    expect(received).toEqual([]);
  });
});
