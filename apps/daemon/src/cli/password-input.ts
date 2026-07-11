/**
 * Password input for `ohd user set-password` — the secret never
 * rides argv (shell history, process list). Sources, in order:
 *
 *   1. `OH_DAEMON_USER_PASSWORD` / `OH_DAEMON_USER_PASSWORD_FILE` —
 *      the vault-rotate env/file idiom for scripted provisioning
 *      (both set or empty refuses, trailing newline stripped).
 *   2. An interactive echo-off prompt with confirmation when stdin is
 *      a terminal.
 *
 * Neither available (non-TTY, no env) refuses with the env pair named
 * rather than hanging on a read that can never complete.
 */

import { resolvePassphraseEnv } from '../config';

export const USER_PASSWORD_ENV = 'OH_DAEMON_USER_PASSWORD';
export const USER_PASSWORD_FILE_ENV = 'OH_DAEMON_USER_PASSWORD_FILE';

const CTRL_C = '\u0003';
const BACKSPACE = '\u007f';

/**
 * Read one line from a raw-mode TTY without echoing it. Prompts on
 * stderr so stdout stays clean for scripting. Backspace edits, Ctrl-C
 * aborts; Enter resolves.
 */
function readHiddenLine(prompt: string): Promise<string> {
  const stdin = process.stdin;
  const stderr = process.stderr;
  stderr.write(prompt);
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const cleanup = (): void => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off('data', onData);
    };
    const onData = (chunk: Buffer): void => {
      for (const char of chunk.toString('utf8')) {
        if (char === CTRL_C) {
          cleanup();
          stderr.write('\n');
          reject(new Error('aborted.'));
          return;
        }
        if (char === '\r' || char === '\n') {
          cleanup();
          stderr.write('\n');
          resolve(value);
          return;
        }
        if (char === BACKSPACE || char === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        value += char;
      }
    };
    stdin.on('data', onData);
  });
}

export interface PasswordInputIo {
  /** `process.stdin.isTTY` — injectable for tests. */
  readonly isTTY: boolean;
  /** Echo-off line reader — injectable for tests. */
  readonly promptHidden: (prompt: string) => Promise<string>;
}

const realIo: PasswordInputIo = {
  isTTY: process.stdin.isTTY === true,
  promptHidden: readHiddenLine,
};

/** Resolve the new password from env/file, else an interactive prompt. */
export async function resolvePasswordInput(
  env: Record<string, string | undefined>,
  io: PasswordInputIo = realIo,
): Promise<string> {
  const fromEnv = resolvePassphraseEnv(env, USER_PASSWORD_ENV, USER_PASSWORD_FILE_ENV);
  if (fromEnv !== null) return fromEnv;
  if (!io.isTTY) {
    throw new Error(
      `stdin is not a terminal — set ${USER_PASSWORD_ENV} or ${USER_PASSWORD_FILE_ENV} for non-interactive use`,
    );
  }
  const first = await io.promptHidden('New password: ');
  const second = await io.promptHidden('Retype password: ');
  if (first !== second) throw new Error('passwords do not match.');
  return first;
}
