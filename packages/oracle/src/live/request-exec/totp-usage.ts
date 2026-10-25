/**
 * TOTP usage over THIS host's cooldown store — the gate and the record
 * for one batch's usages (`@openheaders/core/totp` holds the tracker
 * and the plane shape every realm shares). An HTTP send gates once
 * after resolve and again after the pre-request chain, and records
 * after the wire; a live session's resolution carries the plane
 * (`session-resolution.ts`) so Connect and every rider gate and record
 * through the same store the HTTP sends use.
 */

import {
  createTotpUsageTracker,
  type TotpCooldownPlane,
  type TotpUsage,
  totpCooldownMessage,
  totpNamesOf,
} from '@openheaders/core/totp';
import type { Vault } from '@openheaders/core/types';
import { checkCooldown, recordUsage } from '../../entity/totp-cooldown-store';

export type { TotpUsage, TotpUsageTracker } from '@openheaders/core/totp';
export { createTotpUsageTracker } from '@openheaders/core/totp';

/** The gate's refusal for the first code already used inside its window; `null` lets the send go. */
export function totpCooldownRefusal(workspaceId: string, usages: readonly TotpUsage[]): string | null {
  for (const usage of usages) {
    const status = checkCooldown(workspaceId, usage.name, usage.code);
    if (status.inCooldown) return totpCooldownMessage(usage.name, status.remainingSeconds);
  }
  return null;
}

/** Record every code the send burned — after a successful round-trip only. */
export function recordTotpUsages(workspaceId: string, usages: readonly TotpUsage[]): void {
  for (const usage of usages) recordUsage(workspaceId, usage.name, usage.code, usage.period);
}

/**
 * A live session's cooldown plane over this host's store. The partition
 * key is read only when a code is in play — an unpinned session with no
 * TOTP usage never asks the workspace store (the SW send's posture).
 */
export function oracleTotpCooldownPlane(vault: Vault, workspaceKey: () => string): TotpCooldownPlane {
  const hasTotp = totpNamesOf(vault).size > 0;
  return {
    tracker: () => (hasTotp ? createTotpUsageTracker(vault) : null),
    refusal: (usages) => (usages.length === 0 ? null : totpCooldownRefusal(workspaceKey(), usages)),
    record: (usages) => {
      if (usages.length > 0) recordTotpUsages(workspaceKey(), usages);
    },
  };
}
