/**
 * `License` — the signed claims payload of a license artifact
 * (`LICENSING_PLAN.md` §3.1).
 *
 * The schema is deliberately non-strict: valibot strips unknown keys, so
 * a license signed by a newer control plane with claims this build has
 * never heard of (e.g. a future `perpetualForVersionsBefore`) still
 * verifies — the signature covers the encoded payload bytes, not the
 * parsed object, so stripping loses nothing cryptographically.
 */

import * as v from 'valibot';

export const LicenseeSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1)),
  org: v.optional(v.string()),
  email: v.optional(v.string()),
});

export const LicenseSchema = v.object({
  schemaVersion: v.literal(1),
  /** Issuer-assigned identifier — the public handle for support/audit. */
  licenseId: v.pipe(v.string(), v.minLength(1)),
  licensee: LicenseeSchema,
  /** The one live claim in v1: active daemon users this license admits. */
  seats: v.pipe(v.number(), v.integer(), v.minValue(1)),
  /** Capability strings; empty in v1. See `RESERVED_ENTITLEMENTS`. */
  entitlements: v.array(v.pipe(v.string(), v.minLength(1))),
  /** Delivery-modality marker: long-lived air-gapped file; hosts disable the refresh agent. */
  offline: v.optional(v.literal(true)),
  /**
   * Opaque control-plane subscription reference, stamped at first
   * issuance and carried forward on every refresh — the key the control
   * plane uses to look up subscription state. Absent on enterprise
   * (`offline`) files; hosts never read it.
   */
  subscriptionRef: v.optional(v.pipe(v.string(), v.minLength(1))),
  /** ms-since-epoch of signing. */
  issuedAt: v.pipe(v.number(), v.integer()),
  /** ms-since-epoch after which the license enters grace. */
  validUntil: v.pipe(v.number(), v.integer()),
  /** Days of grace after `validUntil` before degradation to free-tier limits. */
  graceDays: v.pipe(v.number(), v.integer(), v.minValue(0)),
  /** Signing-key id (`oh-lic-<year><rev>`) — selects the ring entry; enables rotation without flag days. */
  kid: v.pipe(v.string(), v.minLength(1)),
});

export type Licensee = v.InferOutput<typeof LicenseeSchema>;
export type License = v.InferOutput<typeof LicenseSchema>;
