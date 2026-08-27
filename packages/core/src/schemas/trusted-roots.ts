/**
 * Trusted roots — the workspace's custom CA list.
 *
 * A trusted root is TRUST MATERIAL, not a secret: public certificate
 * PEM that every TLS dial the workspace makes verifies against, in
 * addition to the runtime's bundled roots. Synced, exported, never
 * vaulted, never template-resolvable, never per-request.
 *
 * One row holds one PEM blob — a pasted chain stays one root (Node's
 * `ca` option takes a concatenated PEM per entry, and a team removes a
 * whole PKI in one gesture). Subject / fingerprint / expiry are derived
 * from `certPem` at read time (`utils/certificate-summary.ts`), never
 * stored.
 */

import * as v from 'valibot';
import { SchemaVersionSchema, UidSchema } from './common';

export const TrustedRootSchema = v.object({
  uid: UidSchema,
  name: v.string(),
  /** Certificate (or chain) in PEM form. */
  certPem: v.string(),
  /** ISO-8601 timestamp of the add gesture. */
  addedAt: v.string(),
});

export const TrustedRootsSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  roots: v.array(TrustedRootSchema),
});
