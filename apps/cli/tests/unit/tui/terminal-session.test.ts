/**
 * Alt-screen session — enter/leave sequences, raw-mode and mouse-mode
 * lifecycle, and the restore guarantee on every exit path: close(),
 * process exit, SIGINT, SIGTERM, uncaughtException. Restore must be
 * idempotent so racing paths cannot double-write teardown bytes.
 */

import { describe, expect, it } from 'vitest';
import { openTerminalSession, SIGINT_EXIT_CODE, SIGTERM_EXIT_CODE } from '../../../src/tui/terminal-session';
import { makeFakeTty } from './fake-tty';

const ALT_ON = '\x1b[?1049h';
const ALT_OFF = '\x1b[?1049l';
const CURSOR_HIDE = '\x1b[?25l';
const CURSOR_SHOW = '\x1b[?25h';
const WRAP_OFF = '\x1b[?7l';
const WRAP_ON = '\x1b[?7h';
const MOUSE_ON = '\x1b[?1002h\x1b[?1006h';
const MOUSE_OFF = '\x1b[?1006l\x1b[?1002l';
const PASTE_ON = '\x1b[?2004h';
const PASTE_OFF = '\x1b[?2004l';

describe('openTerminalSession', () => {
  it('enters the alt screen with raw mode, hidden cursor, autowrap off, mouse and paste modes', () => {
    const tty = makeFakeTty();
    openTerminalSession({ input: tty.input, output: tty.output, proc: tty.proc });

    const written = tty.output.written();
    for (const sequence of [ALT_ON, CURSOR_HIDE, WRAP_OFF, MOUSE_ON, PASTE_ON]) {
      expect(written).toContain(sequence);
    }
    expect(tty.input.rawMode).toBe(true);
    expect(tty.input.paused).toBe(false);
    expect(tty.input.listenerCount()).toBe(1);
  });

  it('close() restores everything and detaches listeners', () => {
    const tty = makeFakeTty();
    const session = openTerminalSession({ input: tty.input, output: tty.output, proc: tty.proc });
    tty.output.clear();

    session.close();

    const written = tty.output.written();
    for (const sequence of [MOUSE_OFF, PASTE_OFF, WRAP_ON, CURSOR_SHOW, ALT_OFF]) {
      expect(written).toContain(sequence);
    }
    expect(session.closed).toBe(true);
    expect(tty.input.rawMode).toBe(false);
    expect(tty.input.paused).toBe(true);
    expect(tty.input.listenerCount()).toBe(0);
    for (const event of ['SIGINT', 'SIGTERM', 'exit', 'uncaughtException']) {
      expect(tty.proc.listenerCount(event)).toBe(0);
    }
  });

  it('restore is idempotent — a second close writes nothing', () => {
    const tty = makeFakeTty();
    const session = openTerminalSession({ input: tty.input, output: tty.output, proc: tty.proc });
    session.close();
    tty.output.clear();

    session.close();
    tty.proc.emit('exit');

    expect(tty.output.written()).toBe('');
  });

  it('SIGINT restores the screen and exits 130', () => {
    const tty = makeFakeTty();
    openTerminalSession({ input: tty.input, output: tty.output, proc: tty.proc });
    tty.output.clear();

    tty.proc.emit('SIGINT');

    expect(tty.output.written()).toContain(ALT_OFF);
    expect(tty.proc.exits).toEqual([SIGINT_EXIT_CODE]);
  });

  it('SIGTERM restores the screen and exits 143', () => {
    const tty = makeFakeTty();
    openTerminalSession({ input: tty.input, output: tty.output, proc: tty.proc });
    tty.output.clear();

    tty.proc.emit('SIGTERM');

    expect(tty.output.written()).toContain(ALT_OFF);
    expect(tty.proc.exits).toEqual([SIGTERM_EXIT_CODE]);
  });

  it('process exit restores the screen without calling exit again', () => {
    const tty = makeFakeTty();
    openTerminalSession({ input: tty.input, output: tty.output, proc: tty.proc });
    tty.output.clear();

    tty.proc.emit('exit');

    expect(tty.output.written()).toContain(ALT_OFF);
    expect(tty.proc.exits).toEqual([]);
  });

  it('uncaughtException restores, reports to errorOutput, and exits 1', () => {
    const tty = makeFakeTty();
    openTerminalSession({
      input: tty.input,
      output: tty.output,
      proc: tty.proc,
      errorOutput: tty.errorOutput,
    });
    tty.output.clear();

    tty.proc.emit('uncaughtException', new Error('renderer blew up'));

    expect(tty.output.written()).toContain(ALT_OFF);
    expect(tty.errorOutput.written()).toContain('renderer blew up');
    expect(tty.proc.exits).toEqual([1]);
  });

  it('mouse: false skips mouse sequences on enter and leave', () => {
    const tty = makeFakeTty();
    const session = openTerminalSession({ input: tty.input, output: tty.output, proc: tty.proc, mouse: false });
    session.close();

    const written = tty.output.written();
    expect(written).not.toContain(MOUSE_ON);
    expect(written).not.toContain(MOUSE_OFF);
    expect(written).toContain(ALT_ON);
    expect(written).toContain(ALT_OFF);
  });

  it('forwards input chunks to onData until closed', () => {
    const tty = makeFakeTty();
    const chunks: string[] = [];
    const session = openTerminalSession({
      input: tty.input,
      output: tty.output,
      proc: tty.proc,
      onData: (chunk) => chunks.push(chunk.toString('utf-8')),
    });

    tty.input.emit('q');
    session.close();
    tty.input.emit('x');

    expect(chunks).toEqual(['q']);
  });
});
