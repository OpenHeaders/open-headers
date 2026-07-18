/**
 * Resize watching: SIGWINCH → measure the output tty → callback with
 * the new geometry (80×24, the design floor, when the stream reports
 * none). Returns an unsubscribe so the caller's teardown detaches the
 * signal listener — no handler outlives the alt screen.
 */

import type { ProcessLike, TerminalSize, TtyOutput } from './tty';

export const DEFAULT_SIZE: TerminalSize = { columns: 80, rows: 24 };

export function measureTerminal(output: TtyOutput): TerminalSize {
  // A pty that reports no winsize (undefined or 0×0) gets the floor.
  const columns = output.columns ?? 0;
  const rows = output.rows ?? 0;
  return {
    columns: columns > 0 ? columns : DEFAULT_SIZE.columns,
    rows: rows > 0 ? rows : DEFAULT_SIZE.rows,
  };
}

export function watchResize(output: TtyOutput, proc: ProcessLike, onResize: (size: TerminalSize) => void): () => void {
  function handler(): void {
    onResize(measureTerminal(output));
  }
  proc.on('SIGWINCH', handler);
  return () => {
    proc.off('SIGWINCH', handler);
  };
}
