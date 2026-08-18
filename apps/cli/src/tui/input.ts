/**
 * Terminal input decoder: raw tty bytes → key and mouse events. A pure
 * push parser with no timers — a chunk that ends mid-sequence
 * (including a lone Esc, which is both a key and every sequence's
 * first byte) is held as pending, and the caller decides when silence
 * means "that Esc was the Esc key" by calling flushPending(). SGR
 * mouse reports (press/release/motion/wheel) decode to events;
 * bracketed paste is swallowed whole — no text input exists in v1
 * (the TUI design §2), so pasted bytes must never replay as keys.
 */

import { StringDecoder } from 'node:string_decoder';

export interface KeyEvent {
  readonly type: 'key';
  /** A named key ('enter', 'escape', 'tab', 'up', 'space', …) or the printable character itself. */
  readonly key: string;
  readonly ctrl: boolean;
  readonly alt: boolean;
  readonly shift: boolean;
}

export type MouseAction = 'press' | 'release' | 'motion' | 'wheel-up' | 'wheel-down';
export type MouseButton = 'left' | 'middle' | 'right' | 'none';

export interface MouseEvent {
  readonly type: 'mouse';
  readonly action: MouseAction;
  readonly button: MouseButton;
  /** 1-based terminal cell coordinates. */
  readonly x: number;
  readonly y: number;
  readonly ctrl: boolean;
  readonly alt: boolean;
  readonly shift: boolean;
}

export type TuiInputEvent = KeyEvent | MouseEvent;

export interface InputDecoder {
  feed(data: Buffer | string): TuiInputEvent[];
  /** Resolve a chunk-final Esc (or dangling partial sequence) — silence made it literal. */
  flushPending(): TuiInputEvent[];
  readonly pending: boolean;
}

/** How long the caller should wait before treating a chunk-final Esc as the Esc key. */
export const ESCAPE_TIMEOUT_MS = 50;

const ESC = '\x1b';
const PASTE_END = '\x1b[201~';
/** A CSI sequence longer than this is garbage, not a partial — drop it. */
const MAX_SEQUENCE = 64;

function key(name: string, mods?: Partial<Pick<KeyEvent, 'ctrl' | 'alt' | 'shift'>>): KeyEvent {
  return { type: 'key', key: name, ctrl: false, alt: false, shift: false, ...mods };
}

/** Decode one non-escape character; null means a control byte we deliberately drop. */
function characterKey(char: string, alt: boolean): KeyEvent | null {
  if (char === '\r' || char === '\n') return key('enter', { alt });
  if (char === '\t') return key('tab', { alt });
  if (char === ' ') return key('space', { alt });
  if (char === '\x7f' || char === '\b') return key('backspace', { alt });
  const code = char.charCodeAt(0);
  if (code >= 0x01 && code <= 0x1a) return key(String.fromCharCode(code + 96), { ctrl: true, alt });
  if (code < 0x20) return null;
  return key(char, { alt });
}

const CSI_NAMED: Readonly<Record<string, string>> = {
  A: 'up',
  B: 'down',
  C: 'right',
  D: 'left',
  H: 'home',
  F: 'end',
};

const CSI_TILDE: Readonly<Record<string, string>> = {
  '1': 'home',
  '2': 'insert',
  '3': 'delete',
  '4': 'end',
  '5': 'pageup',
  '6': 'pagedown',
  '7': 'home',
  '8': 'end',
};

function modifierFlags(param: string | undefined): Pick<KeyEvent, 'ctrl' | 'alt' | 'shift'> {
  const modifier = param === undefined || param === '' ? 0 : Number.parseInt(param, 10) - 1;
  return { shift: (modifier & 1) !== 0, alt: (modifier & 2) !== 0, ctrl: (modifier & 4) !== 0 };
}

function decodeSgrMouse(params: string, final: string): MouseEvent | null {
  const parts = params.split(';');
  if (parts.length !== 3) return null;
  const flags = Number.parseInt(parts[0], 10);
  const x = Number.parseInt(parts[1], 10);
  const y = Number.parseInt(parts[2], 10);
  if (Number.isNaN(flags) || Number.isNaN(x) || Number.isNaN(y)) return null;
  const wheel = (flags & 64) !== 0;
  const action: MouseAction = wheel
    ? (flags & 1) !== 0
      ? 'wheel-down'
      : 'wheel-up'
    : final === 'm'
      ? 'release'
      : (flags & 32) !== 0
        ? 'motion'
        : 'press';
  const buttons: readonly MouseButton[] = ['left', 'middle', 'right', 'none'];
  return {
    type: 'mouse',
    action,
    button: wheel ? 'none' : buttons[flags & 3],
    x,
    y,
    shift: (flags & 4) !== 0,
    alt: (flags & 8) !== 0,
    ctrl: (flags & 16) !== 0,
  };
}

interface CsiDecode {
  readonly event: TuiInputEvent | null;
  readonly startPaste: boolean;
}

function decodeCsi(params: string, final: string): CsiDecode {
  if (params.startsWith('<') && (final === 'M' || final === 'm')) {
    return { event: decodeSgrMouse(params.slice(1), final), startPaste: false };
  }
  if (final === '~') {
    const parts = params.split(';');
    if (parts[0] === '200') return { event: null, startPaste: true };
    const name = CSI_TILDE[parts[0]];
    return { event: name === undefined ? null : key(name, modifierFlags(parts[1])), startPaste: false };
  }
  if (final === 'Z') return { event: key('tab', { shift: true }), startPaste: false };
  const name = CSI_NAMED[final];
  if (name !== undefined) {
    const parts = params.split(';');
    return { event: key(name, modifierFlags(parts[1])), startPaste: false };
  }
  return { event: null, startPaste: false };
}

export function createInputDecoder(): InputDecoder {
  const utf8 = new StringDecoder('utf-8');
  let buffer = '';
  let inPaste = false;

  function parse(flush: boolean): TuiInputEvent[] {
    const events: TuiInputEvent[] = [];
    while (buffer.length > 0) {
      if (inPaste) {
        const end = buffer.indexOf(PASTE_END);
        if (end === -1) {
          // Keep only a tail that could still be the split terminator.
          let keep = '';
          for (let i = PASTE_END.length - 1; i > 0; i -= 1) {
            if (buffer.endsWith(PASTE_END.slice(0, i))) {
              keep = PASTE_END.slice(0, i);
              break;
            }
          }
          buffer = keep;
          break;
        }
        buffer = buffer.slice(end + PASTE_END.length);
        inPaste = false;
        continue;
      }
      if (!buffer.startsWith(ESC)) {
        const codePoint = buffer.codePointAt(0) ?? 0;
        const char = String.fromCodePoint(codePoint);
        const event = characterKey(char, false);
        if (event !== null) events.push(event);
        buffer = buffer.slice(char.length);
        continue;
      }
      if (buffer.length === 1) {
        if (!flush) break;
        events.push(key('escape'));
        buffer = '';
        continue;
      }
      const next = buffer[1];
      if (next === '[') {
        let finalIndex = -1;
        for (let i = 2; i < buffer.length; i += 1) {
          const code = buffer.charCodeAt(i);
          if (code >= 0x40 && code <= 0x7e) {
            finalIndex = i;
            break;
          }
        }
        if (finalIndex === -1) {
          if (buffer.length > MAX_SEQUENCE) {
            buffer = '';
            break;
          }
          if (!flush) break;
          events.push(key('escape'));
          buffer = buffer.slice(1);
          continue;
        }
        const { event, startPaste } = decodeCsi(buffer.slice(2, finalIndex), buffer[finalIndex]);
        buffer = buffer.slice(finalIndex + 1);
        if (startPaste) inPaste = true;
        if (event !== null) events.push(event);
        continue;
      }
      if (next === 'O') {
        if (buffer.length < 3) {
          if (!flush) break;
          events.push(key('escape'));
          buffer = buffer.slice(1);
          continue;
        }
        const name = CSI_NAMED[buffer[2]];
        if (name !== undefined) events.push(key(name));
        buffer = buffer.slice(3);
        continue;
      }
      if (next === ESC) {
        events.push(key('escape'));
        buffer = buffer.slice(2);
        continue;
      }
      const codePoint = buffer.codePointAt(1) ?? 0;
      const char = String.fromCodePoint(codePoint);
      const event = characterKey(char, true);
      if (event !== null) events.push(event);
      buffer = buffer.slice(1 + char.length);
    }
    return events;
  }

  return {
    feed(data: Buffer | string): TuiInputEvent[] {
      buffer += typeof data === 'string' ? data : utf8.write(data);
      return parse(false);
    },
    flushPending(): TuiInputEvent[] {
      return parse(true);
    },
    get pending(): boolean {
      return buffer.length > 0 && !inPaste;
    },
  };
}
