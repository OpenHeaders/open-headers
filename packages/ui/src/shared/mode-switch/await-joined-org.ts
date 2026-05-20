/**
 * Mode-switch join barrier (Phase U5.5).
 *
 * Combine (U5.3) and Use-Target (U5.4) re-home into / retire against a
 * target backend's `Org` — but the oracle only authorizes that `Org`
 * once the live connection's handshake records the join (`onJoinedOrg`
 * → `recordJoinedOrg`, Phase U5.2). The mode-switch dialog commits the
 * new `backend.mode` and then the SW reconnects under it; the join
 * lands a moment later.
 *
 * This helper bridges that gap: after the mode commit, it waits for the
 * target `Org` id to appear in the persisted `OH.joinedOrgs` set before
 * the dialog fires its local executor. Resolves immediately when the
 * backend is already on file (reconnecting to a known backend), or
 * `false` on timeout (the backend never came online — the executor
 * surfaces a "your data is unchanged" toast).
 */

import { getHostStorage, OH } from '@openheaders/core/storage';

/** Default ceiling for the post-commit handshake + join round-trip. */
const DEFAULT_TIMEOUT_MS = 12_000;

/**
 * Resolve once `orgId` is present in `OH.joinedOrgs`, or `false` if it
 * hasn't landed within `timeoutMs`.
 */
export async function awaitJoinedOrg(orgId: string, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<boolean> {
  const storage = getHostStorage();
  if (!storage) return false;

  const existing = (await storage.get(OH.joinedOrgs)) ?? [];
  if (existing.some((org) => org.id === orgId)) return true;

  return new Promise<boolean>((resolve) => {
    let settled = false;
    let unsubscribe: (() => void) | undefined;

    const finish = (result: boolean): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe?.();
      resolve(result);
    };

    const timer = setTimeout(() => finish(false), timeoutMs);
    unsubscribe = storage.subscribe(OH.joinedOrgs, (next) => {
      if ((next ?? []).some((org) => org.id === orgId)) finish(true);
    });
  });
}
