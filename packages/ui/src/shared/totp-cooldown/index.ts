/**
 * The page realm's TOTP cooldown plane — a live session executing IN
 * the workbench page (the extension's page-session capability) has no
 * cooldown store of its own, so its batches gate and record through
 * the host bridge onto the service worker's store, the one the HTTP
 * sends ride (`oh.totp.*`). The tracker is the realm-free core's; only
 * the gate and the record cross the bridge. A bridge that cannot answer
 * lets the batch go — the provider's own refusal is then the story, the
 * posture the store documents for a restarted worker.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { createTotpUsageTracker, type TotpCooldownPlane, type TotpUsage, totpNamesOf } from '@openheaders/core/totp';
import type { Vault } from '@openheaders/core/types';

export function pageTotpCooldownPlane(vault: Vault, workspaceId: string | null): TotpCooldownPlane {
  const hasTotp = totpNamesOf(vault).size > 0;
  return {
    tracker: () => (hasTotp ? createTotpUsageTracker(vault) : null),
    refusal: async (usages: readonly TotpUsage[]) => {
      if (usages.length === 0) return null;
      try {
        const answer = await hostBridge.call('oh.totp.checkCooldown', { workspaceId, usages: [...usages] });
        return answer.refusal;
      } catch {
        return null;
      }
    },
    record: (usages: readonly TotpUsage[]) => {
      if (usages.length === 0) return;
      void hostBridge.call('oh.totp.recordUsage', { workspaceId, usages: [...usages] }).catch(() => undefined);
    },
  };
}
