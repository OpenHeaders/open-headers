/**
 * `oh tui` Phase 2 shell — tty precondition, blank-frame entry, quit
 * paths (q, Ctrl+C), resize repaint, and the Esc-timer decoder glue.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UsageError } from '../../../src/exit-codes';
import { ESCAPE_TIMEOUT_MS } from '../../../src/tui/input';
import { runTui } from '../../../src/tui/run';
import { makeFakeTty } from './fake-tty';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('runTui', () => {
  it('refuses without an interactive terminal', () => {
    const tty = makeFakeTty({ inputIsTTY: false });
    expect(() => runTui(tty)).toThrow(UsageError);
    const piped = makeFakeTty({ outputIsTTY: false });
    expect(() => runTui(piped)).toThrow(UsageError);
  });

  it('enters the alt screen, paints the blank frame, and quits on q with a full restore', async () => {
    const tty = makeFakeTty({ columns: 40, rows: 6 });
    const done = runTui(tty);
    expect(tty.output.written()).toContain('\x1b[?1049h');
    expect(tty.output.written()).toContain('\x1b[1;1H\x1b[2K');

    tty.input.emit('q');
    await done;

    expect(tty.output.written()).toContain('\x1b[?1049l');
    expect(tty.input.rawMode).toBe(false);
    expect(tty.proc.listenerCount('SIGINT')).toBe(0);
    expect(tty.proc.listenerCount('SIGWINCH')).toBe(0);
  });

  it('quits on Ctrl+C delivered as a raw byte', async () => {
    const tty = makeFakeTty();
    const done = runTui(tty);

    tty.input.emit('\x03');
    await done;

    expect(tty.output.written()).toContain('\x1b[?1049l');
  });

  it('repaints on resize with the new geometry', async () => {
    const tty = makeFakeTty({ columns: 80, rows: 4 });
    const done = runTui(tty);
    tty.output.clear();

    tty.output.rows = 2;
    tty.proc.emit('SIGWINCH');

    expect(tty.output.written()).toBe('\x1b[1;1H\x1b[2K\x1b[2;1H\x1b[2K');
    tty.input.emit('q');
    await done;
  });

  it('a lone Esc resolves through the timer without quitting; q still quits after', async () => {
    const tty = makeFakeTty();
    const done = runTui(tty);

    tty.input.emit('\x1b');
    vi.advanceTimersByTime(ESCAPE_TIMEOUT_MS + 1);
    expect(tty.output.written()).not.toContain('\x1b[?1049l');

    tty.input.emit('q');
    await done;
    expect(tty.output.written()).toContain('\x1b[?1049l');
  });

  it('an Esc-led sequence completing in a later chunk cancels the pending timer', async () => {
    const tty = makeFakeTty();
    const done = runTui(tty);

    tty.input.emit('\x1b');
    tty.input.emit('[A');
    vi.advanceTimersByTime(ESCAPE_TIMEOUT_MS + 1);
    expect(vi.getTimerCount()).toBe(0);

    tty.input.emit('q');
    await done;
  });
});
