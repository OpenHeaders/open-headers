/**
 * Fake tty for TUI kernel tests — in-memory stand-ins for the
 * TtyInput/TtyOutput/ProcessLike shapes, with emit helpers to push
 * bytes and signals and probes for what the kernel wrote and wired.
 */

import type { ProcessLike, TtyInput, TtyOutput } from '../../../src/tui/tty';

type DataListener = (chunk: Buffer) => void;
type ProcListener = (error: Error) => void;

export interface FakeOutput extends TtyOutput {
  columns: number;
  rows: number;
  readonly writes: string[];
  written(): string;
  clear(): void;
}

export interface FakeInput extends TtyInput {
  rawMode: boolean | undefined;
  paused: boolean;
  emit(data: Buffer | string): void;
  listenerCount(): number;
}

export interface FakeProcess extends ProcessLike {
  readonly exits: number[];
  emit(event: string, error?: Error): void;
  listenerCount(event: string): number;
}

export interface FakeTtyOverrides {
  readonly columns: number;
  readonly rows: number;
  readonly inputIsTTY: boolean;
  readonly outputIsTTY: boolean;
}

export interface FakeTty {
  readonly input: FakeInput;
  readonly output: FakeOutput;
  readonly errorOutput: FakeOutput;
  readonly proc: FakeProcess;
}

function makeOutput(isTTY: boolean, columns: number, rows: number): FakeOutput {
  const writes: string[] = [];
  return {
    isTTY,
    columns,
    rows,
    writes,
    write(text: string) {
      writes.push(text);
      return true;
    },
    written() {
      return writes.join('');
    },
    clear() {
      writes.length = 0;
    },
  };
}

export function makeFakeTty(overrides?: Partial<FakeTtyOverrides>): FakeTty {
  const listeners: DataListener[] = [];
  const input: FakeInput = {
    isTTY: overrides?.inputIsTTY ?? true,
    rawMode: undefined,
    paused: true,
    setRawMode(mode: boolean) {
      input.rawMode = mode;
    },
    resume() {
      input.paused = false;
    },
    pause() {
      input.paused = true;
    },
    on(_event: 'data', listener: DataListener) {
      listeners.push(listener);
    },
    off(_event: 'data', listener: DataListener) {
      const index = listeners.indexOf(listener);
      if (index !== -1) listeners.splice(index, 1);
    },
    emit(data: Buffer | string) {
      const chunk = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
      for (const listener of [...listeners]) listener(chunk);
    },
    listenerCount() {
      return listeners.length;
    },
  };

  const handlers = new Map<string, ProcListener[]>();
  const exits: number[] = [];
  const proc: FakeProcess = {
    exits,
    on(event: string, listener: ProcListener) {
      handlers.set(event, [...(handlers.get(event) ?? []), listener]);
    },
    off(event: string, listener: ProcListener) {
      handlers.set(
        event,
        (handlers.get(event) ?? []).filter((entry) => entry !== listener),
      );
    },
    exit(code?: number) {
      exits.push(code ?? 0);
    },
    emit(event: string, error?: Error) {
      for (const listener of [...(handlers.get(event) ?? [])]) listener(error ?? new Error(event));
    },
    listenerCount(event: string) {
      return (handlers.get(event) ?? []).length;
    },
  };

  return {
    input,
    output: makeOutput(overrides?.outputIsTTY ?? true, overrides?.columns ?? 80, overrides?.rows ?? 24),
    errorOutput: makeOutput(false, 80, 24),
    proc,
  };
}
