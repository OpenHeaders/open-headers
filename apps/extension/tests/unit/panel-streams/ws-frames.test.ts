/**
 * WS frame display projection — the Messages grid's cell vocabulary
 * (host parity): text frames show payload + char count, binary frames
 * show the opcode label + decoded byte size, error frames show the
 * message + "N/A". Live plane preferred over the HAR dialect.
 */

import {
  formatFrameBytes,
  frameDataLabel,
  frameLengthLabel,
  opcodeDescription,
  type WsDisplayFrame,
  wsDisplayFrames,
} from '@openheaders/ui/panel/components/detail/streams/ws-frames';
import { base64ByteLength, base64ToBytes } from '@openheaders/ui/panel/data/base64';
import { describe, expect, it } from 'vitest';
import { makeHar, makeLifecycle } from '../../__factories__/lifecycle';

function frame(over: Partial<WsDisplayFrame> = {}): WsDisplayFrame {
  return { index: 0, type: 'receive', atMs: 1_000, opcode: 1, mask: false, data: 'hello', ...over };
}

describe('frameDataLabel', () => {
  it('text frames show the payload verbatim', () => {
    expect(frameDataLabel(frame({ opcode: 1, data: 'push 1/9999' }))).toBe('push 1/9999');
  });

  it('binary frames show the opcode label, never raw base64', () => {
    expect(frameDataLabel(frame({ opcode: 2, data: '3q2+7w==' }))).toBe('Binary Message');
  });

  it('error frames show the transport error message', () => {
    expect(frameDataLabel(frame({ type: 'error', opcode: -1, data: 'Connection reset' }))).toBe('Connection reset');
  });

  it('control frames show their opcode label', () => {
    expect(frameDataLabel(frame({ opcode: 8, data: '' }))).toBe('Connection Close Message');
    expect(frameDataLabel(frame({ opcode: 9, data: '' }))).toBe('Ping Message');
    expect(frameDataLabel(frame({ opcode: 10, data: '' }))).toBe('Pong Message');
  });
});

describe('frameLengthLabel', () => {
  it('text frames count characters as a bare number', () => {
    expect(frameLengthLabel(frame({ opcode: 1, data: 'push 1275/9999' }))).toBe('14');
  });

  it('binary frames format the decoded byte size', () => {
    // 4 raw bytes encoded as base64.
    expect(frameLengthLabel(frame({ opcode: 2, data: '3q2+7w==' }))).toBe('4 B');
  });

  it('error frames read N/A', () => {
    expect(frameLengthLabel(frame({ type: 'error', opcode: -1, data: 'boom' }))).toBe('N/A');
  });
});

describe('formatFrameBytes', () => {
  it('scales bytes → kB → MB on the 1000 base', () => {
    expect(formatFrameBytes(0)).toBe('0 B');
    expect(formatFrameBytes(999)).toBe('999 B');
    expect(formatFrameBytes(1_500)).toBe('1.5 kB');
    expect(formatFrameBytes(250_000)).toBe('250 kB');
    expect(formatFrameBytes(2_500_000)).toBe('2.5 MB');
  });
});

describe('base64 helpers', () => {
  it('base64ByteLength matches the decoded length', () => {
    for (const b64 of ['', 'YQ==', 'YWI=', 'YWJj', '3q2+7w==']) {
      expect(base64ByteLength(b64)).toBe(base64ToBytes(b64).length);
    }
  });
});

describe('opcodeDescription', () => {
  it('names the opcode, with the mask flag when set', () => {
    expect(opcodeDescription(1, false)).toBe('Text Message (Opcode 1)');
    expect(opcodeDescription(2, true)).toBe('Binary Message (Opcode 2, mask)');
  });
});

describe('wsDisplayFrames', () => {
  it('prefers the live plane and keeps arrival indices', () => {
    const lc = makeLifecycle({
      url: 'wss://openheaders.io/live',
      messages: [
        { kind: 'ws', type: 'send', atMs: 1, opcode: 1, mask: true, data: 'a' },
        { kind: 'ws', type: 'receive', atMs: 2, opcode: 1, mask: false, data: 'b' },
      ],
    });
    const frames = wsDisplayFrames(lc, null);
    expect(frames.map((f) => [f.index, f.type, f.data])).toEqual([
      [0, 'send', 'a'],
      [1, 'receive', 'b'],
    ]);
  });

  it('falls back to the HAR dialect (time in wall seconds)', () => {
    const lc = makeLifecycle({ url: 'wss://openheaders.io/live' });
    const har = {
      ...makeHar('wss://openheaders.io/live'),
      _webSocketMessages: [{ type: 'receive' as const, time: 1.5, opcode: 1, data: 'x' }],
    };
    const frames = wsDisplayFrames(lc, har);
    expect(frames).toHaveLength(1);
    expect(frames[0].atMs).toBe(1_500);
    expect(frames[0].data).toBe('x');
  });
});
