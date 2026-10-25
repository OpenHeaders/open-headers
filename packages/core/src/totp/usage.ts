/**
 * TOTP usage of one resolve batch — every `kind: 'totp'` vault entry
 * whose current code the batch consumed, whether a `{{vault.X}}`
 * template resolved it or a script read it through the batch's variable
 * scope. One tracker per batch feeds both paths, so the cooldown gate
 * and the usage record see the same list: the gate refuses a code
 * already used inside its window (most providers answer the reuse with
 * a 401 — an actionable "wait Ns" beats a wasted round-trip), and a
 * wire write records what it burned. The list is LIVE — it grows while
 * the batch's scripts run — so a runner gates after its hooks and
 * records after the wire.
 *
 * A batch is an HTTP send, a live session's Connect, or one of its
 * riders (a WebSocket send, an MQTT publish or subscription toggle).
 * The store the gate and the record read lives with the host; this
 * module is the platform-free half every realm shares (the node hosts'
 * oracle, the browser service worker, the extension's page realm).
 */

import type { Vault, VaultSecretTotp } from '../types';
import type { TemplateVariable } from '../variables/resolver/template';

/** One TOTP vault entry the batch used. Carries the code (so the
 *  cooldown gate can match the recently-used code) and the entry's
 *  `period` (so usage recording can compute the window-end deadline). */
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

/** The tracker over one batch's vault snapshot. */
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
        // A window that rolled mid-batch replaces the entry's row — the
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

/** The entry names of every `kind: 'totp'` secret — what a batch's
 *  templates must name for a fresh code to matter. */
export function totpNamesOf(vault: Vault): ReadonlySet<string> {
  const names = new Set<string>();
  for (const secret of vault.secrets) {
    if (secret.kind === 'totp') names.add(secret.name);
  }
  return names;
}

/** True when any referenced name (bare or `vault.`-prefixed, as
 *  `collectTemplateVariableNames` reports them) is a TOTP entry. */
export function referencesTotp(names: Iterable<string>, totpNames: ReadonlySet<string>): boolean {
  if (totpNames.size === 0) return false;
  for (const name of names) {
    if (totpNames.has(name)) return true;
  }
  return false;
}

/**
 * The cooldown plane one live session's batches ride — where the gate
 * and the record live is the host's business (a store in this realm, or
 * another realm's store over a bridge), so the session executors read
 * the plane and never a store.
 */
export interface TotpCooldownPlane {
  /** A fresh tracker for one batch; `null` when the scope holds no TOTP
   *  entry — nothing to track, nothing to gate. */
  tracker(): TotpUsageTracker | null;
  /** The gate's refusal for the first code of the batch already used
   *  inside its window; `null` lets the batch go. A host that asks
   *  another realm's store answers asynchronously. */
  refusal(usages: readonly TotpUsage[]): Promise<string | null> | string | null;
  /** Record every code the batch burned — after the wire carried them. */
  record(usages: readonly TotpUsage[]): void;
}

/** The plane of a resolution that gates nothing — an injected closure
 *  from a realm without a cooldown store. */
export const NO_TOTP_COOLDOWN: TotpCooldownPlane = {
  tracker: () => null,
  refusal: () => null,
  record: () => undefined,
};

/** The gate's wording — ONE sentence on every host and every wire kind. */
export function totpCooldownMessage(name: string, remainingSeconds: number): string {
  return `TOTP '${name}' code can't be reused — wait ${remainingSeconds}s for the next window.`;
}
