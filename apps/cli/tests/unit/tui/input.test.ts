/**
 * Input decoder — printable and control keys, CSI/SS3 sequences with
 * modifiers, the Esc-vs-sequence pending protocol, SGR mouse decode
 * (press/release/motion/wheel), and bracketed-paste swallowing.
 */

import { describe, expect, it } from 'vitest';
import { createInputDecoder, type TuiInputEvent } from '../../../src/tui/input';

function keys(events: TuiInputEvent[]): string[] {
  return events.map((event) => (event.type === 'key' ? event.key : `${event.action}@${event.x},${event.y}`));
}

describe('keys', () => {
  it('decodes printable characters as themselves', () => {
    const decoder = createInputDecoder();
    expect(keys(decoder.feed('q/?rG'))).toEqual(['q', '/', '?', 'r', 'G']);
  });

  it('decodes named keys', () => {
    const decoder = createInputDecoder();
    expect(keys(decoder.feed('\r\t \x7f'))).toEqual(['enter', 'tab', 'space', 'backspace']);
  });

  it('decodes ctrl chords from C0 bytes', () => {
    const decoder = createInputDecoder();
    const events = decoder.feed('\x03\x0b');
    expect(events).toEqual([
      { type: 'key', key: 'c', ctrl: true, alt: false, shift: false },
      { type: 'key', key: 'k', ctrl: true, alt: false, shift: false },
    ]);
  });

  it('decodes CSI arrows, home/end, and tilde keys', () => {
    const decoder = createInputDecoder();
    expect(keys(decoder.feed('\x1b[A\x1b[B\x1b[C\x1b[D\x1b[H\x1b[F\x1b[5~\x1b[6~\x1b[3~'))).toEqual([
      'up',
      'down',
      'right',
      'left',
      'home',
      'end',
      'pageup',
      'pagedown',
      'delete',
    ]);
  });

  it('decodes SS3 application-mode arrows', () => {
    const decoder = createInputDecoder();
    expect(keys(decoder.feed('\x1bOA\x1bOD'))).toEqual(['up', 'left']);
  });

  it('decodes Shift+Tab (CSI Z)', () => {
    const decoder = createInputDecoder();
    expect(decoder.feed('\x1b[Z')).toEqual([{ type: 'key', key: 'tab', ctrl: false, alt: false, shift: true }]);
  });

  it('decodes CSI modifier parameters', () => {
    const decoder = createInputDecoder();
    expect(decoder.feed('\x1b[1;5A')).toEqual([{ type: 'key', key: 'up', ctrl: true, alt: false, shift: false }]);
    expect(decoder.feed('\x1b[5;2~')).toEqual([{ type: 'key', key: 'pageup', ctrl: false, alt: false, shift: true }]);
  });

  it('decodes Esc-prefixed characters as alt chords', () => {
    const decoder = createInputDecoder();
    expect(decoder.feed('\x1bx')).toEqual([{ type: 'key', key: 'x', ctrl: false, alt: true, shift: false }]);
  });

  it('drops unknown control bytes and unknown CSI finals', () => {
    const decoder = createInputDecoder();
    expect(decoder.feed('\x00\x1b[19;2P q')).toEqual([
      { type: 'key', key: 'space', ctrl: false, alt: false, shift: false },
      { type: 'key', key: 'q', ctrl: false, alt: false, shift: false },
    ]);
  });

  it('reassembles a multi-byte character split across chunks', () => {
    const decoder = createInputDecoder();
    const bytes = Buffer.from('é', 'utf-8');
    expect(decoder.feed(bytes.subarray(0, 1))).toEqual([]);
    expect(keys(decoder.feed(bytes.subarray(1)))).toEqual(['é']);
  });
});

describe('escape disambiguation', () => {
  it('holds a chunk-final Esc as pending and resolves it on flush', () => {
    const decoder = createInputDecoder();
    expect(decoder.feed('\x1b')).toEqual([]);
    expect(decoder.pending).toBe(true);
    expect(decoder.flushPending()).toEqual([{ type: 'key', key: 'escape', ctrl: false, alt: false, shift: false }]);
    expect(decoder.pending).toBe(false);
  });

  it('completes a sequence split across chunks instead of flushing', () => {
    const decoder = createInputDecoder();
    expect(decoder.feed('\x1b')).toEqual([]);
    expect(keys(decoder.feed('[A'))).toEqual(['up']);
    expect(decoder.pending).toBe(false);
  });

  it('flushes a dangling partial CSI as Esc plus literal bytes', () => {
    const decoder = createInputDecoder();
    decoder.feed('\x1b[');
    expect(keys(decoder.flushPending())).toEqual(['escape', '[']);
  });

  it('decodes Esc Esc as the escape key', () => {
    const decoder = createInputDecoder();
    expect(keys(decoder.feed('\x1b\x1b'))).toEqual(['escape']);
  });
});

describe('mouse', () => {
  it('decodes SGR press and release with buttons', () => {
    const decoder = createInputDecoder();
    expect(decoder.feed('\x1b[<0;12;5M\x1b[<0;12;5m\x1b[<2;3;4M')).toEqual([
      { type: 'mouse', action: 'press', button: 'left', x: 12, y: 5, ctrl: false, alt: false, shift: false },
      { type: 'mouse', action: 'release', button: 'left', x: 12, y: 5, ctrl: false, alt: false, shift: false },
      { type: 'mouse', action: 'press', button: 'right', x: 3, y: 4, ctrl: false, alt: false, shift: false },
    ]);
  });

  it('decodes wheel and motion', () => {
    const decoder = createInputDecoder();
    expect(decoder.feed('\x1b[<64;8;2M\x1b[<65;8;2M\x1b[<32;9;3M')).toEqual([
      { type: 'mouse', action: 'wheel-up', button: 'none', x: 8, y: 2, ctrl: false, alt: false, shift: false },
      { type: 'mouse', action: 'wheel-down', button: 'none', x: 8, y: 2, ctrl: false, alt: false, shift: false },
      { type: 'mouse', action: 'motion', button: 'left', x: 9, y: 3, ctrl: false, alt: false, shift: false },
    ]);
  });

  it('decodes mouse modifier bits', () => {
    const decoder = createInputDecoder();
    expect(decoder.feed('\x1b[<16;1;1M')).toEqual([
      { type: 'mouse', action: 'press', button: 'left', x: 1, y: 1, ctrl: true, alt: false, shift: false },
    ]);
  });
});

describe('bracketed paste', () => {
  it('swallows pasted bytes whole', () => {
    const decoder = createInputDecoder();
    expect(keys(decoder.feed('\x1b[200~pasted q keys\x1b[201~x'))).toEqual(['x']);
  });

  it('swallows a paste split across chunks, including a split terminator', () => {
    const decoder = createInputDecoder();
    expect(decoder.feed('\x1b[200~hello ')).toEqual([]);
    expect(decoder.feed('world\x1b[201')).toEqual([]);
    expect(keys(decoder.feed('~q'))).toEqual(['q']);
  });

  it('does not count an open paste as a pending escape', () => {
    const decoder = createInputDecoder();
    decoder.feed('\x1b[200~partial');
    expect(decoder.pending).toBe(false);
    expect(decoder.flushPending()).toEqual([]);
  });
});
