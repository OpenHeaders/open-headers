/**
 * Command seam for the trust-store modules — every `security` /
 * `certutil` invocation routes through an {@link ExecFn} so tests
 * inject fakes and the elevation posture stays explicit
 * (the proxy-security design §2.6: elevation only for trust-store operations,
 * and only via the signed privileged helper — never an app-drawn
 * prompt, never osascript, whose detached security session cannot
 * manage admin-domain trust).
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
