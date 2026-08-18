/**
 * Durable "what we changed" record (the proxy-security design §2.5) — one row
 * per concrete trust store the CA was installed into, keyed by
 * `(store, ref)`. Rows are written BEFORE the install command runs, so
 * a crash mid-install can never leave trust the record doesn't know
 * about; teardown undoes exactly these rows and drops each only on
 * verified removal. Crash-safe by construction: an orphaned row is
 * re-attempted on the next teardown, an orphaned install is impossible.
 */

import { ProxyTrustChangeSchema } from '@openheaders/core/schemas';
import { hostStorage, OH } from '@openheaders/core/storage';
import type { ProxyTrustChange, ProxyTrustStoreId } from '@openheaders/core/types';

export async function listTrustChanges(): Promise<ProxyTrustChange[]> {
  return hostStorage.getValidatedArray(OH.proxyTrustChanges, ProxyTrustChangeSchema);
}

/** Upsert by `(store, ref)` — re-installing a store replaces its row. */
export async function upsertTrustChange(change: ProxyTrustChange): Promise<void> {
  const changes = await listTrustChanges();
  const rest = changes.filter((c) => !(c.store === change.store && c.ref === change.ref));
  await hostStorage.set(OH.proxyTrustChanges, [...rest, change]);
}

/** Drop one row — only after its removal is verified. */
export async function dropTrustChange(store: ProxyTrustStoreId, ref: string): Promise<void> {
  const changes = await listTrustChanges();
  const rest = changes.filter((c) => !(c.store === store && c.ref === ref));
  if (rest.length !== changes.length) await hostStorage.set(OH.proxyTrustChanges, rest);
}
