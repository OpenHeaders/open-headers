/**
 * Per-connection reach writers + projections over `OH.backendReach`
 * ({@link BackendReachMap}) — one entry per connected backend record,
 * written from its handshake WELCOME, plus the host's own server-bind
 * tier under {@link SELF_BACKEND_REACH_KEY}.
 *
 * Live connection state: a wire's entry clears on its disconnect and
 * the extension SW resets the whole slot at init, so a stale tier never
 * outlives its socket. Writes are read-modify-write on a shared record,
 * so they serialize under one mutex — two wires' WELCOMEs never clobber
 * each other.
 */

import type { BackendReach } from '../protocol';
import { hostStorage } from '../storage/host-storage';
import { type BackendReachMap, OH } from '../storage/keys';
import { createMutex } from '../utils/mutex';

/** Serializes every read-modify-write on the reach slot. */
const withReachLock = createMutex();

/**
 * Upsert one connection's reach entry; `null` removes it (disconnect —
 * the next WELCOME re-converges it).
 */
export function setBackendReach(key: string, reach: BackendReach | null): Promise<void> {
  return withReachLock(async () => {
    const stored = (await hostStorage.get(OH.backendReach)) ?? {};
    if (reach === null) {
      if (!(key in stored)) return;
      const { [key]: _removed, ...rest } = stored;
      await hostStorage.set(OH.backendReach, rest);
      return;
    }
    if (stored[key] === reach) return;
    await hostStorage.set(OH.backendReach, { ...stored, [key]: reach });
  });
}

/**
 * Drop every entry — the extension SW calls this at init so no tier
 * from a prior SW lifetime outlives its socket.
 */
export function resetBackendReach(): Promise<void> {
  return withReachLock(async () => {
    await hostStorage.set(OH.backendReach, {});
  });
}

const REACH_RANK: Record<BackendReach, number> = { loopback: 0, lan: 1, wan: 2 };

/**
 * The widest tier across every entry (self + connected backends), or
 * `null` for an empty map — the "extend your reach" ladder's input.
 */
export function widestBackendReach(map: BackendReachMap): BackendReach | null {
  let widest: BackendReach | null = null;
  for (const reach of Object.values(map)) {
    if (widest === null || REACH_RANK[reach] > REACH_RANK[widest]) widest = reach;
  }
  return widest;
}
