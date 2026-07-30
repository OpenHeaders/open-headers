/**
 * Frame codec — encode/decode roundtrips, reassembly across arbitrary
 * chunk boundaries (stdio guarantees none), and the corrupt-stream
 * payload ceiling.
 */

import { describe, expect, it } from 'vitest';
import {
  encodeH3Frame,
  H3_FRAME_HEADER_BYTES,
  H3_MAX_PAYLOAD_BYTES,
  H3FrameDecoder,
} from '../../../src/live/h3-helper/framing';
import { H3_FRAME } from '../../../src/live/h3-helper/protocol';

describe('encodeH3Frame', () => {
  it('lays out the 9-byte big-endian header before the payload', () => {
    const payload = Buffer.from('{"ok":true}', 'utf8');
    const frame = encodeH3Frame(H3_FRAME.RESPONSE_HEAD, 0x01020304, payload);
    expect(frame.length).toBe(H3_FRAME_HEADER_BYTES + payload.length);
    expect(frame.readUInt8(0)).toBe(H3_FRAME.RESPONSE_HEAD);
    expect(frame.readUInt32BE(1)).toBe(0x01020304);
    expect(frame.readUInt32BE(5)).toBe(payload.length);
    expect(frame.subarray(H3_FRAME_HEADER_BYTES).toString('utf8')).toBe('{"ok":true}');
  });

  it('encodes a payloadless frame as a bare header', () => {
    const frame = encodeH3Frame(H3_FRAME.REQUEST_END, 7);
    expect(frame.length).toBe(H3_FRAME_HEADER_BYTES);
    expect(frame.readUInt32BE(5)).toBe(0);
  });
});

describe('H3FrameDecoder', () => {
  it('decodes multiple frames arriving in one chunk', () => {
    const decoder = new H3FrameDecoder();
    const chunk = Buffer.concat([
      encodeH3Frame(H3_FRAME.RESPONSE_BODY, 1, Buffer.from('aa')),
      encodeH3Frame(H3_FRAME.RESPONSE_END, 1),
      encodeH3Frame(H3_FRAME.RESPONSE_HEAD, 2, Buffer.from('{}')),
    ]);
    const frames = decoder.push(chunk);
    expect(frames.map((f) => [f.type, f.id, f.payload.toString('utf8')])).toEqual([
      [H3_FRAME.RESPONSE_BODY, 1, 'aa'],
      [H3_FRAME.RESPONSE_END, 1, ''],
      [H3_FRAME.RESPONSE_HEAD, 2, '{}'],
    ]);
  });

  it('reassembles one frame split across arbitrary chunk boundaries', () => {
    const decoder = new H3FrameDecoder();
    const frame = encodeH3Frame(H3_FRAME.RESPONSE_BODY, 9, Buffer.from('hello h3 world'));
    const collected: string[] = [];
    // Byte-at-a-time is the worst case any stdio chunking can produce.
    for (const byte of frame) {
      for (const decoded of decoder.push(Buffer.from([byte]))) {
        collected.push(decoded.payload.toString('utf8'));
        expect(decoded.id).toBe(9);
      }
    }
    expect(collected).toEqual(['hello h3 world']);
  });

  it('keeps trailing partial bytes buffered for the next push', () => {
    const decoder = new H3FrameDecoder();
    const first = encodeH3Frame(H3_FRAME.RESPONSE_BODY, 1, Buffer.from('one'));
    const second = encodeH3Frame(H3_FRAME.RESPONSE_BODY, 1, Buffer.from('two'));
    const joined = Buffer.concat([first, second]);
    const frames = decoder.push(joined.subarray(0, first.length + 4));
    expect(frames).toHaveLength(1);
    const rest = decoder.push(joined.subarray(first.length + 4));
    expect(rest).toHaveLength(1);
    expect(rest[0]?.payload.toString('utf8')).toBe('two');
  });

  it('reassembles a frame far larger than any single chunk', () => {
    // The decoder accumulates chunks uncopied until the frame
    // completes — this leg pins the multi-chunk path (one compact per
    // frame), the shape a large RESPONSE_HEAD arriving in pipe-sized
    // pieces produces.
    const decoder = new H3FrameDecoder();
    const payload = Buffer.alloc(200 * 1024, 5);
    const encoded = encodeH3Frame(H3_FRAME.RESPONSE_BODY, 3, payload);
    const frames = [];
    for (let offset = 0; offset < encoded.length; offset += 8 * 1024) {
      frames.push(...decoder.push(encoded.subarray(offset, offset + 8 * 1024)));
    }
    expect(frames).toHaveLength(1);
    expect(frames[0]?.id).toBe(3);
    expect(frames[0]?.payload.equals(payload)).toBe(true);
  });

  it('throws on a payload past the ceiling — a corrupt stream', () => {
    const decoder = new H3FrameDecoder();
    const header = Buffer.alloc(H3_FRAME_HEADER_BYTES);
    header.writeUInt8(H3_FRAME.RESPONSE_BODY, 0);
    header.writeUInt32BE(1, 1);
    header.writeUInt32BE(H3_MAX_PAYLOAD_BYTES + 1, 5);
    expect(() => decoder.push(header)).toThrow(/exceeds/);
  });
});
