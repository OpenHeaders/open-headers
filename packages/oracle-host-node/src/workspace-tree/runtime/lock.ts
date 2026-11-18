/**
 * Workspace-tree runtime — the binding keeps its lock.
 *
 * The lock is a file in the sidecar (`sidecar.ts`), and the sidecar can
 * be taken away under an open binding: git's own checkout of a branch
 * whose tree holds a link or a file at its name — by a switch of ours,
 * or from a terminal, which passes no door of ours — or a hand that
 * removes it. It is made anew, empty, with no lock in it: another engine
 * that asks for the folder is then given it, while this one goes on
 * writing there.
 *
 * So the binding asks for its lock again at the end of every pass on its
 * chain. The ask re-enters: a pass that finds the lock its own is one
 * refused create and one small read, and a pass that finds none takes
 * it, whatever took it away.
 *
 * Another engine that was given it first keeps it. This binding goes on
 * with its passes and its commits, says who holds the lock — once a
 * holder — and asks again after every pass, so the lock is its own at
 * the first pass after the other lets go. An ask that fails is said the
 * same way, once.
 *
 * Nothing is asked once the binding is closed: its unbind gives the lock
 * back, and a pass that ends after that must not take it again.
 */

import { logger } from '@openheaders/core/utils';
import { acquireTreeLock } from '../sidecar';
import { type OpenBinding, SCOPE } from './core';

export async function keepTreeLock(
  binding: Pick<OpenBinding, 'record' | 'closed' | 'lockSaid'>,
  hostId: string,
): Promise<void> {
  if (binding.closed) return;
  const { rootDir } = binding.record;
  let said: string | null;
  try {
    const lock = await acquireTreeLock(rootDir, hostId);
    said = lock.ok ? null : `is held by ${lock.holder.hostId} (pid ${lock.holder.pid})`;
  } catch (err) {
    said = `could not be asked for: ${err instanceof Error ? err.message : String(err)}`;
  }
  if (said === binding.lockSaid) return;
  binding.lockSaid = said;
  if (said === null) logger.info(SCOPE, `the lock of ${rootDir} is this engine's again`);
  else logger.warn(SCOPE, `the lock of ${rootDir} ${said} — this engine goes on, and asks again after every pass`);
}
