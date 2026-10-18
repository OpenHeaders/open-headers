/**
 * TOTP usage of one send — every `kind: 'totp'` vault entry whose
 * current code the send consumed, whether a `{{vault.X}}` template
 * resolved it or a pre-request script read it through the send's
 * variable scope (`script-scope.ts`). One tracker per send feeds both
 * paths, so the cooldown gate and the usage record see the same list:
 * the gate refuses a code already used inside its window (most
 * providers answer the reuse with a 401 — an actionable "wait Ns" beats
 * a wasted round-trip), and a successful round-trip records what it
 * burned. The list is LIVE — it grows while the send's scripts run —
 * so a runner gates once after resolve and again after the pre-request
 * chain, and records after the wire.
 */

import type { Vault, VaultSecretTotp } from '@openheaders/core/types';
import type { TemplateVariable } from '@openheaders/core/variables';
import { checkCooldown, recordUsage } from '../../entity/totp-cooldown-store';

/** One TOTP vault entry the send used. Carries the code (so the cooldown
 *  gate can match the recently-used code) and the entry's `period` (so
 *  usage recording can compute the window-end deadline). */
export interface TotpUsage {
  name: string;
  code: string;
  period: number;
}

export interface TotpUsageTracker {
  /** Note every TOTP code among one template's resolved variables. */
  observe(variables: readonly TemplateVariable[]): void;
  /** Every code noted so far, one row per entry — a live view. */
  readonly used: readonly TotpUsage[];
}

/** The tracker over one send's vault snapshot. */
export function createTotpUsageTracker(vault: Vault): TotpUsageTracker {
  const entries = new Map<string, VaultSecretTotp>();
  for (const secret of vault.secrets) {
    if (secret.kind === 'totp') entries.set(secret.name, secret);
  }
  const used: TotpUsage[] = [];
  const rowOf = new Map<string, number>();
  return {
    used,
    observe(variables) {
      if (entries.size === 0) return;
      for (const v of variables) {
        if (!v.resolved || v.scope !== 'vault' || !v.value) continue;
        // Names carry the `vault.` prefix when the user wrote
        // `{{vault.X}}`; strip it before matching the bare entry name.
        const bareName = v.name.startsWith('vault.') ? v.name.slice('vault.'.length) : v.name;
        const entry = entries.get(bareName);
        if (!entry) continue;
        const usage: TotpUsage = { name: bareName, code: v.value, period: entry.period };
        const row = rowOf.get(bareName);
        // A window that rolled mid-send replaces the entry's row — the
        // code the wire carries is the one the record keeps.
        if (row === undefined) {
          rowOf.set(bareName, used.length);
          used.push(usage);
        } else {
          used[row] = usage;
        }
      }
    },
  };
}

/** The gate's refusal for the first code already used inside its window; `null` lets the send go. */
export function totpCooldownRefusal(workspaceId: string, usages: readonly TotpUsage[]): string | null {
  for (const usage of usages) {
    const status = checkCooldown(workspaceId, usage.name, usage.code);
    if (status.inCooldown) {
      return `TOTP '${usage.name}' code can't be reused — wait ${status.remainingSeconds}s for the next window.`;
    }
  }
  return null;
}

/** Record every code the send burned — after a successful round-trip only. */
export function recordTotpUsages(workspaceId: string, usages: readonly TotpUsage[]): void {
  for (const usage of usages) recordUsage(workspaceId, usage.name, usage.code, usage.period);
}
