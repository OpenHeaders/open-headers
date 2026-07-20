/**
 * Proxy trust plane TypeScript types — derived from
 * `schemas/proxy-trust.ts` (single source of truth). See that module
 * for the host-only private-key law and the what-we-changed record.
 */

import type * as v from 'valibot';
import type { ProxyCaRecordSchema, ProxyTrustChangeSchema, ProxyTrustStoreIdSchema } from '../schemas/proxy-trust';

export type ProxyTrustStoreId = v.InferOutput<typeof ProxyTrustStoreIdSchema>;
export type ProxyCaRecord = v.InferOutput<typeof ProxyCaRecordSchema>;
export type ProxyTrustChange = v.InferOutput<typeof ProxyTrustChangeSchema>;

/**
 * Public projection of the CA — the ONLY shape that ever crosses an RPC
 * contract. Derived from the stored cert at read time, never cached.
 */
export interface ProxyCaPublicInfo {
  subject: string;
  fingerprintSha256: string;
  notBeforeIso: string;
  notAfterIso: string;
  createdAt: number;
}

/**
 * Live probe verdict for one concrete trust store. `trusted` = our
 * fingerprint found AND the store's trust settings name it; `absent` =
 * nothing of ours present; `untrusted` = our cert is physically present
 * but the store carries no trust settings for it — a residue state the
 * teardown record must still cover (a partial install, or a cancelled
 * trust prompt after the cert was already imported, never silently read
 * as "not installed"); `mismatch` = a cert with our nickname/subject is
 * present but its fingerprint differs from the stored CA (tamper
 * visibility — report, never trust it); `unavailable` = the store
 * cannot be probed on this machine (tooling missing, store unreadable)
 * with `detail` saying why.
 */
export interface ProxyTrustStoreState {
  store: ProxyTrustStoreId;
  ref: string;
  state: 'trusted' | 'absent' | 'untrusted' | 'mismatch' | 'unavailable';
  detail?: string;
}
