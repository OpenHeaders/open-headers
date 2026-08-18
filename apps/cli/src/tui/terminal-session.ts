/**
 * The alt-screen terminal session: raw mode, alternate screen, hidden
 * cursor, autowrap off, SGR mouse reporting, bracketed paste — entered
 * in one write and restored on every exit path: close(), process
 * exit, SIGINT, SIGTERM, uncaughtException. Restore is idempotent;
 * whichever path fires first wins and the rest are no-ops. Mouse mode
 * lives and dies with the session so terminal-native selection returns
 * the instant the alt screen closes (the TUI design §2.1).
 */

import type { ProcessLike, TtyInput, TtyOutput } from './tty';

const ENTER_SCREEN = '\x1b[?1049h\x1b[?25l\x1b[?7l';
const ENTER_MOUSE = '\x1b[?1002h\x1b[?1006h';
const ENTER_PASTE = '\x1b[?2004h';
const LEAVE_MOUSE = '\x1b[?1006l\x1b[?1002l';
const LEAVE_PASTE = '\x1b[?2004l';
const LEAVE_SCREEN = '\x1b[?7h\x1b[?25h\x1b[?1049l';

/** 128 + signal number, the shell convention for signal deaths. */
export const SIGINT_EXIT_CODE = 130;
export const SIGTERM_EXIT_CODE = 143;

export interface TerminalSessionOptions {
  readonly input: TtyInput;
  readonly output: TtyOutput;
  readonly proc: ProcessLike;
  /** SGR mouse reporting — on by default (design §2.1). */
  readonly mouse?: boolean;
  readonly onData?: (chunk: Buffer) => void;
  /** Where an uncaught exception is reported after restore (stderr in the binary). */
  readonly errorOutput?: TtyOutput;
}

export interface TerminalSession {
  close(): void;
  readonly closed: boolean;
}

export function openTerminalSession(options: TerminalSessionOptions): TerminalSession {
  const { input, output, proc } = options;
  const mouse = options.mouse ?? true;
  let closed = false;

  function onData(chunk: Buffer): void {
    options.onData?.(chunk);
  }

  function restore(): void {
    if (closed) return;
    closed = true;
    output.write(`${mouse ? LEAVE_MOUSE : ''}${LEAVE_PASTE}${LEAVE_SCREEN}`);
    input.setRawMode?.(false);
    input.off('data', onData);
    input.pause();
    proc.off('SIGINT', onSigint);
    proc.off('SIGTERM', onSigterm);
    proc.off('exit', restore);
    proc.off('uncaughtException', onUncaught);
  }

  function onSigint(): void {
    restore();
    proc.exit(SIGINT_EXIT_CODE);
  }

  function onSigterm(): void {
    restore();
    proc.exit(SIGTERM_EXIT_CODE);
  }

  function onUncaught(error: Error): void {
    restore();
    options.errorOutput?.write(`oh tui: ${error.stack ?? error.message}\n`);
    proc.exit(1);
  }

  input.setRawMode?.(true);
  input.resume();
  input.on('data', onData);
  output.write(`${ENTER_SCREEN}${mouse ? ENTER_MOUSE : ''}${ENTER_PASTE}`);
  proc.on('SIGINT', onSigint);
  proc.on('SIGTERM', onSigterm);
  proc.on('exit', restore);
  proc.on('uncaughtException', onUncaught);

  return {
    close: restore,
    get closed() {
      return closed;
    },
  };
}
