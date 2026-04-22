/**
 * Valibot schemas for the 4-scope variable shapes:
 *   Variable / VaultSecret / Vault / WorkspaceVariables / Environment.
 *
 * Schemas are parallel to the hand-written interfaces in
 * `types/v5/variable.ts` — the type system enforces structural
 * agreement; these schemas enforce runtime validation at the storage
 * boundary. See `document.ts` for the preserve-unknown discipline.
 */

import * as v from 'valibot';
import { SchemaVersionSchema, UidSchema } from './common';

export const VariableTypeSchema = v.picklist(['default', 'secret']);

export const VariableSchema = v.object({
  name: v.string(),
  value: v.string(),
  type: VariableTypeSchema,
});

// ── Vault secrets (discriminated on `kind`) ────────────────────────
// `string` — literal value returned verbatim by `{{vault.X}}`.
// `totp`   — base32 seed plus RFC 6238 parameters. `{{vault.X}}`
//            resolves to the CURRENT 6/8-digit code; the seed itself is
//            never exposed through the resolver. Stored plaintext in
//            chrome.storage.local today (noop cipher tier); the v2
//            AES-GCM cipher upgrade encrypts the whole vault payload,
//            including the seed, transparently.

export const VaultSecretKindSchema = v.picklist(['string', 'totp']);

export const TotpAlgorithmSchema = v.picklist(['SHA1', 'SHA256', 'SHA512']);

export const VaultSecretStringSchema = v.object({
  kind: v.literal('string'),
  name: v.string(),
  value: v.string(),
});

export const VaultSecretTotpSchema = v.object({
  kind: v.literal('totp'),
  name: v.string(),
  seed: v.string(),
  algorithm: TotpAlgorithmSchema,
  digits: v.pipe(v.number(), v.integer(), v.minValue(6), v.maxValue(10)),
  period: v.pipe(v.number(), v.integer(), v.minValue(1)),
  issuer: v.optional(v.string()),
});

export const VaultSecretSchema = v.variant('kind', [VaultSecretStringSchema, VaultSecretTotpSchema]);

export const VaultSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  /** Phase 10 monotonic write counter — see `RuleBase.version`. */
  version: v.pipe(v.number(), v.integer(), v.minValue(1)),
  secrets: v.array(VaultSecretSchema),
});

export const WorkspaceVariablesSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  /** Phase 10 monotonic write counter — see `RuleBase.version`. */
  version: v.pipe(v.number(), v.integer(), v.minValue(1)),
  variables: v.array(VariableSchema),
});

export const EnvironmentSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  uid: UidSchema,
  name: v.string(),
  path: v.optional(v.string()),
  variables: v.array(VariableSchema),
  /**
   * Phase 10 monotonic write counter — separate from `schemaVersion`.
   * Starts at 1 on creation, incremented by the environment-store on
   * every save. Clients that load the environment into an editor
   * send this back as `expectedVersion` on save for stale-draft
   * protection. V5 has zero users, so required from day one.
   */
  version: v.pipe(v.number(), v.integer(), v.minValue(1)),
});
