/**
 * Live gRPC stream mirror over the web tab's wire — the
 * `wire-request-stream` twin's laws: `grpcStreamEvent` frames claim
 * synchronously and re-broadcast their payload verbatim into the
 * in-tab fan-out (the channel `useLiveGrpcStream` subscribes to), a
 * malformed frame of the type is still ours to drop, and every other
 * frame type passes onward.
 */

import { setHostLogger } from '@openheaders/core/logger';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { subscribeLocal } from '@/host/web-broadcast';
import { handleIncomingGrpcStreamFrame } from '@/host/wire-grpc-stream';

function streamFrame(overrides?: Partial<{ sendId: unknown; seq: unknown; kind: unknown }>): Record<string, unknown> {
  return {
    type: 'grpcStreamEvent',
    payload: { sendId: 'send-1', seq: 2, kind: 'messages', items: [], ...overrides },
  };
}

describe('wire-grpc-stream', () => {
  let received: unknown[];
  let unsubscribe: () => void;

  beforeAll(() => {
    setHostLogger({ error() {}, warn() {}, info() {}, debug() {} });
  });

  beforeEach(() => {
    received = [];
    unsubscribe = subscribeLocal('grpcStreamEvent', (payload) => {
      received.push(payload);
    });
    return () => unsubscribe();
  });

  it('claims a stream frame and re-broadcasts its payload verbatim', () => {
    const frame = streamFrame();
    expect(handleIncomingGrpcStreamFrame(frame)).toBe(true);
    expect(received).toEqual([frame.payload]);
  });

  it('claims a malformed frame of its type without broadcasting', () => {
    expect(handleIncomingGrpcStreamFrame(streamFrame({ seq: 'not-a-number' }))).toBe(true);
    expect(handleIncomingGrpcStreamFrame({ type: 'grpcStreamEvent' })).toBe(true);
    expect(received).toEqual([]);
  });

  it('passes other frame types onward', () => {
    expect(handleIncomingGrpcStreamFrame({ type: 'pong' })).toBe(false);
    expect(handleIncomingGrpcStreamFrame({ type: 'requestStreamEvent', payload: {} })).toBe(false);
    expect(handleIncomingGrpcStreamFrame(null)).toBe(false);
    expect(received).toEqual([]);
  });
});
