/**
 * Device trust — the certificates THIS machine pins in addition to the
 * runtime's bundled roots and the workspace's trusted certificates.
 *
 * Host posture, not workspace data: a developer's self-signed
 * localhost, a staging box, a colleague's laptop. Never synced, never
 * exported, never in the git tree — the system-proxy posture. A pin is
 * minted from a real dial (the presented certificate the user chose to
 * trust after a verification failure) or pasted by hand; a self-signed
 * leaf is allowed here — pinning the exact certificate is the point.
 * Subject / fingerprint / expiry derive from `certPem` at read time
 * (`utils/certificate-summary.ts`), never stored.
 */

import * as v from 'valibot';
import { UidSchema } from './common';

export const DeviceTrustedCertificateSchema = v.object({
  uid: UidSchema,
  name: v.string(),
  /** Certificate (or chain) in PEM form. */
  certPem: v.string(),
  /** ISO-8601 timestamp of the trust gesture. */
  addedAt: v.string(),
  /** `host:port` the certificate was presented by, when pinned from a dial. */
  origin: v.optional(v.string()),
});

export const DeviceTrustSchema = v.object({
  certificates: v.array(DeviceTrustedCertificateSchema),
  /**
   * Also trust the operating system's certificate store on this
   * machine (the corporate root an IT profile installed) — read from
   * the runtime at dial time, never copied into the record. Opt-in,
   * device posture like the pins above.
   */
  useSystemCa: v.optional(v.boolean(), false),
});
