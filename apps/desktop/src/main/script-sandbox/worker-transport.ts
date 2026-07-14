/**
 * Developer-mode worker transport — the `utilityProcess` lifecycle half
 * of the desktop's full-runtime script host, behind the same
 * {@link SandboxTransport} seam the Safe-mode hidden window implements,
 * so one broker (`script-broker.ts`) drives both runtimes:
 *   • forked lazily on the first `ensureReady()`, reused after;
 *   • an exited/crashed worker drops the handle, so the next run forks
 *     a fresh one (a fork that dies before its ready signal rejects
 *     that spawn instead of hanging);
 *   • `close()` kills the process (idle timer / shutdown) — `kill()`
 *     interrupts even a busy-looping script, so the broker's idle
 *     close doubles as the runaway-script backstop.
 *
 * Message-API asymmetry pinned here so it can't resurface as a bug:
 * the PARENT's `'message'` listener receives the posted data directly,
 * while the WORKER's `process.parentPort` listener receives a
 * MessageEvent and reads `.data`.
 */

import { join } from 'node:path';
import { utilityProcess } from 'electron';
import { createLogger } from '../bootstrap/logger';
import type { SandboxTransport } from './sandbox-window';

const logger = createLogger('script-worker');

export function createScriptWorkerTransport(onUp: (message: unknown) => void): SandboxTransport {
  let child: Electron.UtilityProcess | null = null;
  let readyPromise: Promise<void> | null = null;

  const dropChild = (): void => {
    child = null;
    readyPromise = null;
  };

  const spawn = (): Promise<void> => {
    const forked = utilityProcess.fork(join(__dirname, 'script-worker.js'), [], {
      serviceName: 'openheaders-script-worker',
    });
    child = forked;

    const ready = new Promise<void>((resolve, reject) => {
      let settled = false;
      forked.on('message', (message: unknown) => {
        // Stale-handle guard — a killed worker's late messages must not
        // reach the broker as if they came from the live one.
        if (child !== forked) return;
        const data = message as { type?: unknown } | null;
        if (!settled && data && typeof data === 'object' && data.type === 'sandbox.ready') {
          settled = true;
          resolve();
          return;
        }
        onUp(message);
      });
      forked.once('exit', (code) => {
        if (!settled) {
          settled = true;
          reject(new Error(`script worker exited before ready (code ${code})`));
        } else if (child === forked) {
          logger.warn('script worker exited — respawning on next run', { code });
        }
        if (child === forked) dropChild();
      });
    });

    return ready.then(() => {
      logger.info('script worker ready');
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
      child?.postMessage(message);
    },
    close(reason: 'idle' | 'shutdown'): void {
      if (child) {
        const closing = child;
        // Drop first so the exit listener sees a stale handle and stays
        // quiet — this close is deliberate, not a crash.
        dropChild();
        closing.kill();
        logger.info(`script worker closed (${reason})`);
      }
    },
  };
}
