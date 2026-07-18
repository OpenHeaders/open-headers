/**
 * Resize watching — SIGWINCH to measured geometry, the 80×24 floor
 * default, and listener teardown via the returned unsubscribe.
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_SIZE, measureTerminal, watchResize } from '../../../src/tui/resize';
import { makeFakeTty } from './fake-tty';

describe('measureTerminal', () => {
  it('reads the stream geometry', () => {
    const tty = makeFakeTty({ columns: 120, rows: 40 });
    expect(measureTerminal(tty.output)).toEqual({ columns: 120, rows: 40 });
  });

  it('falls back to the 80×24 floor when the stream reports none', () => {
    expect(measureTerminal({ write: () => true })).toEqual(DEFAULT_SIZE);
  });
});

describe('watchResize', () => {
  it('fires with the freshly measured size on SIGWINCH', () => {
    const tty = makeFakeTty({ columns: 100, rows: 30 });
    const seen: Array<{ columns: number; rows: number }> = [];
    watchResize(tty.output, tty.proc, (size) => seen.push(size));

    tty.proc.emit('SIGWINCH');
    tty.output.columns = 90;
    tty.output.rows = 25;
    tty.proc.emit('SIGWINCH');

    expect(seen).toEqual([
      { columns: 100, rows: 30 },
      { columns: 90, rows: 25 },
    ]);
  });

  it('unsubscribe detaches the signal listener', () => {
    const tty = makeFakeTty();
    const seen: unknown[] = [];
    const unwatch = watchResize(tty.output, tty.proc, (size) => seen.push(size));

    unwatch();
    tty.proc.emit('SIGWINCH');

    expect(seen).toEqual([]);
    expect(tty.proc.listenerCount('SIGWINCH')).toBe(0);
  });
});
