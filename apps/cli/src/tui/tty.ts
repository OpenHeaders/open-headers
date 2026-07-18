/**
 * Minimal structural views of the terminal surfaces the TUI kernel
 * touches. Narrow on purpose: `process.stdin`/`process.stdout`/
 * `process` satisfy them in the binary, and a fake tty satisfies them
 * in unit tests. Kernel modules depend on these shapes only, never on
 * Node globals directly.
 */

export interface TerminalSize {
  readonly columns: number;
  readonly rows: number;
}

/** Write side — the `process.stdout` shape. */
export interface TtyOutput {
  write(text: string): unknown;
  readonly isTTY?: boolean;
  readonly columns?: number;
  readonly rows?: number;
}

/** Read side — the `process.stdin` shape. */
export interface TtyInput {
  readonly isTTY?: boolean;
  setRawMode?(mode: boolean): unknown;
  resume(): unknown;
  pause(): unknown;
  on(event: 'data', listener: (chunk: Buffer) => void): unknown;
  off(event: 'data', listener: (chunk: Buffer) => void): unknown;
}

/** Signal and exit surface — the `process` shape. */
export interface ProcessLike {
  on(event: 'SIGINT' | 'SIGTERM' | 'SIGWINCH' | 'exit', listener: () => void): unknown;
  on(event: 'uncaughtException', listener: (error: Error) => void): unknown;
  off(event: 'SIGINT' | 'SIGTERM' | 'SIGWINCH' | 'exit', listener: () => void): unknown;
  off(event: 'uncaughtException', listener: (error: Error) => void): unknown;
  exit(code?: number): void;
}
