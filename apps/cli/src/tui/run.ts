/**
 * `oh tui` — the Phase 2 shell: proves the kernel end-to-end in a real
 * terminal (alt screen in, blank frame, q/Ctrl+C out, resize
 * repaints) ahead of the Phase 3 dashboard. Requires an interactive
 * terminal on both ends; refuses with the usage class otherwise. The
 * Esc-timer glue here is the canonical decoder wiring: feed on data,
 * arm the timeout while a sequence is pending, cancel on more bytes.
 */

import { UsageError } from '../exit-codes';
import { createInputDecoder, ESCAPE_TIMEOUT_MS, type TuiInputEvent } from './input';
import { measureTerminal, watchResize } from './resize';
import { createScreenRenderer } from './screen';
import { openTerminalSession } from './terminal-session';
import type { ProcessLike, TtyInput, TtyOutput } from './tty';

export interface TuiIo {
  readonly input: TtyInput;
  readonly output: TtyOutput;
  readonly errorOutput: TtyOutput;
  readonly proc: ProcessLike;
}

/** Resolves when the user quits; the session restores the terminal on every other path itself. */
export function runTui(io: TuiIo): Promise<void> {
  const { input, output, proc } = io;
  if (input.isTTY !== true || output.isTTY !== true) {
    throw new UsageError('oh tui needs an interactive terminal (a tty on stdin and stdout)');
  }
  return new Promise((resolve) => {
    const renderer = createScreenRenderer(output, measureTerminal(output));
    const decoder = createInputDecoder();
    let escapeTimer: ReturnType<typeof setTimeout> | undefined;

    function handle(events: TuiInputEvent[]): void {
      for (const event of events) {
        if (event.type !== 'key') continue;
        if (event.key === 'q' || (event.key === 'c' && event.ctrl)) {
          quit();
          return;
        }
      }
    }

    function quit(): void {
      if (escapeTimer !== undefined) clearTimeout(escapeTimer);
      unwatch();
      session.close();
      resolve();
    }

    const session = openTerminalSession({
      input,
      output,
      proc,
      errorOutput: io.errorOutput,
      onData(chunk) {
        if (escapeTimer !== undefined) {
          clearTimeout(escapeTimer);
          escapeTimer = undefined;
        }
        handle(decoder.feed(chunk));
        if (!session.closed && decoder.pending) {
          escapeTimer = setTimeout(() => {
            escapeTimer = undefined;
            handle(decoder.flushPending());
          }, ESCAPE_TIMEOUT_MS);
        }
      },
    });
    const unwatch = watchResize(output, proc, (size) => {
      renderer.resize(size);
      renderer.render([]);
    });
    renderer.render([]);
  });
}
