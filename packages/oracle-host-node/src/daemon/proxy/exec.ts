/**
 * Command seam for the trust-store modules — every `security` /
 * `certutil` / `osascript` invocation routes through an {@link ExecFn}
 * so tests inject fakes and the elevation posture stays explicit
 * (PROXY_SECURITY.md §2.6: elevation only for trust-store operations,
 * each request through its own dedicated seam, never ambient).
 *
 * Results never throw on non-zero exit — callers read `code`/`stderr`
 * and decide; only that keeps "already removed" distinguishable from
 * "refused". A missing binary reports `notFound` so a probe can answer
 * `unavailable` honestly instead of erroring.
 */

import { execFile } from 'node:child_process';

export interface ExecResult {
  code: number;
  stdout: string;
  stderr: string;
  /** The binary itself is absent on this machine (ENOENT). */
  notFound?: boolean;
}

export type ExecFn = (cmd: string, args: readonly string[]) => Promise<ExecResult>;

/** Plain unprivileged runner. */
export const defaultExec: ExecFn = (cmd, args) =>
  new Promise((resolve) => {
    execFile(cmd, [...args], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
        resolve({ code: 127, stdout: '', stderr: `${cmd}: command not found`, notFound: true });
        return;
      }
      const code = err ? (typeof err.code === 'number' ? err.code : 1) : 0;
      resolve({ code, stdout, stderr });
    });
  });

/** POSIX single-quote escaping for embedding one argv inside a shell string. */
function shellQuote(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

/**
 * macOS admin elevation via the OS authorization dialog: wraps the
 * command in `osascript … with administrator privileges`, which puts
 * the system's own password prompt in front of the user — the request
 * is visible, scoped to this one command, and deniable. A denial
 * surfaces as a non-zero exit; callers report it and stop (§5: never
 * retry around a denial).
 */
export const osascriptElevatedExec: ExecFn = (cmd, args) => {
  const shellLine = [cmd, ...args].map(shellQuote).join(' ');
  const script = `do shell script ${JSON.stringify(shellLine)} with administrator privileges`;
  return defaultExec('osascript', ['-e', script]);
};
