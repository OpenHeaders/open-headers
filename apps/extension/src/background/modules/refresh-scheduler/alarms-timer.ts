/**
 * `chrome.alarms` implementation of the scheduler core's `RefreshTimer`
 * port — the extension host's timer substrate.
 *
 * The eviction ceremony lives here and in the host bootstrap, never in
 * the core: keys ARE alarm names (the consumer's codec produces
 * prefix + base64url identities), so an armed schedule survives
 * service-worker eviction; `listArmed` reads `alarms.getAll()` for the
 * core's orphan sweep (the core scopes to its provider's prefix); and
 * fires arrive through `bootstrap/alarm-dispatch.ts`, which awaits the
 * hydration barrier and routes each alarm name back into the owning
 * scheduler's `handleFire`.
 *
 * `available` reflects the alarms shim — absent (e.g. a test path
 * without the API) the scheduler declines to arm, exactly the previous
 * behavior of the alarm-bound scheduler.
 */

import type { RefreshTimer } from '@openheaders/oracle/scheduling';
import { alarms } from '@utils/browser-api';

export function createAlarmsRefreshTimer(): RefreshTimer {
  return {
    available: alarms != null,
    arm(key: string, atMs: number): void {
      alarms?.create(key, { when: atMs });
    },
    cancel(key: string): void {
      alarms?.clear(key);
    },
    async listArmed(): Promise<readonly string[]> {
      if (!alarms) return [];
      const existing = await alarms.getAll();
      return existing.map((a) => a.name);
    },
  };
}
