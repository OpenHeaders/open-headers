/**
 * NM wire framing — encode round-trip, split-chunk reassembly (stdin
 * delivers arbitrary boundaries), multiple frames per chunk, and the
 * two protocol-error exits (oversize length prefix, non-JSON body).
 */

import { describe, expect, it } from 'vitest';
import { createNmMessageDecoder, encodeNmMessage, MAX_INBOUND_FRAME_BYTES } from '../../src/framing';

interface DecodeRun {
  messages: unknown[];
  errors: string[];
  push(chunk: Buffer): void;
}

function decodeRun(): DecodeRun {
  const messages: unknown[] = [];
  const errors: string[] = [];
  const decoder = createNmMessageDecoder({
    onMessage: (value) => messages.push(value),
    onProtocolError: (reason) => errors.push(reason),
  });
  return { messages, errors, push: (chunk) => decoder.push(chunk) };
}

describe('nm framing', () => {
  it('round-trips a message through encode + decode', () => {
    const run = decodeRun();
    run.push(encodeNmMessage({ kind: 'bootstrap', url: 'ws://127.0.0.1:59210' }));
    expect(run.messages).toEqual([{ kind: 'bootstrap', url: 'ws://127.0.0.1:59210' }]);
    expect(run.errors).toEqual([]);
  });

  it('reassembles a frame split across chunk boundaries, prefix included', () => {
    const frame = encodeNmMessage({ ok: true, token: 'oh_secret' });
    const run = decodeRun();
    run.push(frame.subarray(0, 2));
    run.push(frame.subarray(2, 7));
    expect(run.messages).toEqual([]);
    run.push(frame.subarray(7));
    expect(run.messages).toEqual([{ ok: true, token: 'oh_secret' }]);
  });

  it('decodes multiple frames arriving in one chunk', () => {
    const run = decodeRun();
    run.push(Buffer.concat([encodeNmMessage({ a: 1 }), encodeNmMessage({ b: 2 })]));
    expect(run.messages).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('refuses an oversize length prefix without buffering it', () => {
    const prefix = Buffer.allocUnsafe(4);
    prefix.writeUInt32LE(MAX_INBOUND_FRAME_BYTES + 1, 0);
    const run = decodeRun();
    run.push(prefix);
    expect(run.errors).toHaveLength(1);
    // A failed decoder stays failed — later chunks are ignored.
    run.push(encodeNmMessage({ a: 1 }));
    expect(run.messages).toEqual([]);
  });

  it('refuses a non-JSON frame body', () => {
    const body = Buffer.from('not-json', 'utf-8');
    const framed = Buffer.allocUnsafe(4 + body.length);
    framed.writeUInt32LE(body.length, 0);
    body.copy(framed, 4);
    const run = decodeRun();
    run.push(framed);
    expect(run.errors).toHaveLength(1);
    expect(run.messages).toEqual([]);
  });
});
