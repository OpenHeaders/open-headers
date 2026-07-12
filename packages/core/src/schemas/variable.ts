/**
 * Valibot schemas for the 4-scope variable shapes:
 *   Variable / VaultSecret / Vault / WorkspaceVariables / Environment.
 *
 * Schemas are parallel to the hand-written interfaces in
 * `types/variable.ts` — the type system enforces structural
 * agreement; these schemas enforce runtime validation at the storage
 * boundary. See `document.ts` for the preserve-unknown discipline.
 *
 * Identity model. Variable + VaultSecret rows carry a stable `uid` that
 * doubles as the sync engine's set-member itemId. The user-mutable
 * `name` is just another field — renames are LWW within a stable uid
 * (one row, latest name wins). Parallel to the rule + request slice
 * from session 39 (HeaderModification.uid, RequestHeader.uid). Earlier
 * comments throughout this codebase describing "concurrent diverging
 * renames produce two new entries" reflect the pre-uid name-as-identity
 * model and are wrong under this schema.
 */

import * as v from 'valibot';
import { SchemaVersionSchema, UidSchema } from './common';

export const VariableTypeSchema = v.picklist(['default', 'secret']);

/**
 * Per-row identity for variable entries. Doubles as the sync engine's
 * itemId so set-member identity round-trips through save/reload without
 * depending on the user-mutable `name` field. Concurrent renames on the
 * same row converge under per-itemId LWW (one row, latest name wins);
 * two surfaces independently adding same-named rows produce two distinct
 * uids (no silent data loss — duplicate visible in the editor for manual
 * merge). Parallel to `RequestHeader.uid` / `HeaderModification.uid`
 * from session 39.
 */
export const VariableSchema = v.object({
  uid: UidSchema,
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
// `client-certificate` — a TLS client certificate + private key PAIR
//            (PEM strings, optional key passphrase). One entry is the
//            unit users install, rotate, and revoke — never two string
//            entries a request must stitch. NOT template-resolvable:
//            `{{vault.X}}` never returns PEM material; requests carry
//            only a reference (`clientCertificateRef`, the entry NAME)
//            and the executor resolves the pair at send time. The PEM
//            never leaves the vault file.

export const VaultSecretKindSchema = v.picklist(['string', 'totp', 'client-certificate']);

export const TotpAlgorithmSchema = v.picklist(['SHA1', 'SHA256', 'SHA512']);

export const VaultSecretStringSchema = v.object({
  uid: UidSchema,
  kind: v.literal('string'),
  name: v.string(),
  value: v.string(),
});

export const VaultSecretTotpSchema = v.object({
  uid: UidSchema,
  kind: v.literal('totp'),
  name: v.string(),
  seed: v.string(),
  algorithm: TotpAlgorithmSchema,
  digits: v.pipe(v.number(), v.integer(), v.minValue(6), v.maxValue(10)),
  period: v.pipe(v.number(), v.integer(), v.minValue(1)),
  issuer: v.optional(v.string()),
});

export const VaultSecretClientCertificateSchema = v.object({
  uid: UidSchema,
  kind: v.literal('client-certificate'),
  name: v.string(),
  /** Certificate (chain) in PEM form. */
  cert: v.string(),
  /** Private key in PEM form. */
  key: v.string(),
  /** Passphrase for an encrypted private key. */
  passphrase: v.optional(v.string()),
});

export const VaultSecretSchema = v.variant('kind', [
  VaultSecretStringSchema,
  VaultSecretTotpSchema,
  VaultSecretClientCertificateSchema,
]);

export const VaultSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  secrets: v.array(VaultSecretSchema),
});

export const WorkspaceVariablesSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  variables: v.array(VariableSchema),
});

export const EnvironmentSchema = v.object({
  schemaVersion: SchemaVersionSchema,
  uid: UidSchema,
  name: v.string(),
  path: v.optional(v.string()),
  variables: v.array(VariableSchema),
});
