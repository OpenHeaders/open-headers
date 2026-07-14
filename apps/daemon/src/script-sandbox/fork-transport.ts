/**
 * Safe-mode fork transport — the `child_process.fork` lifecycle half
 * of the daemon's script runtime, behind the same
 * {@link SandboxTransport} seam the desktop's transports implement, so
 * the one host-neutral broker drives it unchanged:
 *   • forked lazily on the first `ensureReady()`, reused after;
 *   • an exited/crashed runner drops the handle, so the next run forks
 *     a fresh one (a fork that dies before its ready signal rejects
 *     that spawn instead of hanging);
 *   • `close()` kills the process (idle timer / shutdown) — SIGTERM
 *     interrupts even a busy-looping script (probed), so the broker's
 *     idle close doubles as the runaway-script backstop.
 *
 * Isolation is the fork's launch shape, pinned by standalone probe:
 *   • `--permission` — filesystem read/write, child processes, worker
 *     threads and native addons all refuse with ERR_ACCESS_DENIED;
 *   • `--allow-fs-read=<runner bundle>` — module loading needs exactly
 *     the one self-contained file (never a directory grant);
 *   • `env: {}` — the runner never sees the daemon's environment
 *     (`OH_DAEMON_VAULT_PASSPHRASE` above all).
 * Message-API note: unlike the desktop's `utilityProcess` worker, BOTH
 * fork ends receive the posted data directly (no MessageEvent).
 */

import { type ChildProcess, fork, type Serializable } from 'node:child_process';
import { hostLogger as logger } from '@openheaders/core/logger';
import type { SandboxTransport } from '@openheaders/oracle-host-node/daemon';

const SCOPE = 'script-runner';

export function createForkTransport(runnerPath: string): (onUp: (message: unknown) => void) => SandboxTransport {
  return (onUp: (message: unknown) => void): SandboxTransport => {
    let child: ChildProcess | null = null;
    let readyPromise: Promise<void> | null = null;

    const dropChild = (): void => {
      child = null;
      readyPromise = null;
    };

    const spawn = (): Promise<void> => {
      const forked = fork(runnerPath, [], {
        execArgv: ['--permission', `--allow-fs-read=${runnerPath}`],
        env: {},
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      });
      child = forked;

      const ready = new Promise<void>((resolve, reject) => {
        let settled = false;
        forked.on('message', (message: unknown) => {
          // Stale-handle guard — a killed runner's late messages must
          // not reach the broker as if they came from the live one.
          if (child !== forked) return;
          const data = message as { type?: unknown } | null;
          if (!settled && data && typeof data === 'object' && data.type === 'sandbox.ready') {
            settled = true;
            resolve();
            return;
          }
          onUp(message);
        });
        forked.on('error', (err) => {
          if (!settled) {
            settled = true;
            reject(err);
          }
          if (child === forked) dropChild();
        });
        forked.once('exit', (code, signal) => {
          if (!settled) {
            settled = true;
            reject(new Error(`script runner exited before ready (code ${code ?? signal})`));
          } else if (child === forked) {
            logger.warn(SCOPE, `script runner exited — respawning on next run (code ${code ?? signal})`);
          }
          if (child === forked) dropChild();
        });
      });

      return ready.then(() => {
        logger.info(SCOPE, 'script runner ready');
      });
    };

    return {
      ensureReady(): Promise<void> {
        if (child && readyPromise) return readyPromise;
        readyPromise = spawn().catch((err: unknown) => {
          // A failed fork must not poison every later run.
          dropChild();
          throw err;
        });
        return readyPromise;
      },
      post(message: unknown): void {
        // The broker's envelopes are plain JSON objects by contract —
        // the seam's `unknown` narrows to fork's Serializable here.
        child?.send(message as Serializable);
      },
      close(reason: 'idle' | 'shutdown'): void {
        if (child) {
          const closing = child;
          // Drop first so the exit listener sees a stale handle and
          // stays quiet — this close is deliberate, not a crash.
          dropChild();
          closing.kill();
          logger.info(SCOPE, `script runner closed (${reason})`);
        }
      },
    };
  };
}
