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
  /**
   * Row participation flag. ABSENT means enabled — existing data is
   * never rewritten; only `false` is ever persisted (writers normalize
   * `true` back to absent so untouched rows stay byte-stable). Disabled
   * rows are skipped by resolution in every scope but keep their place
   * in editors and suggestion pickers (marked, deprioritized).
   */
  enabled: v.optional(v.boolean()),
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

export const VaultSecretKindSchema = v.picklist(['string', 'totp', 'client-certificate', 'secret-manager']);

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

// ── Secret-manager locators (discriminated on `provider`) ──────────
// A `secret-manager` vault entry stores a structured REFERENCE into an
// external secret manager — never the secret. Locator fields mirror
// each provider's native addressing idiom; optional fields are
// account/org disambiguation hints. References are not secret material:
// they are team-shareable by construction, and resolution is gated by
// the provider's own auth on each device.

export const SecretProviderIdSchema = v.picklist([
  'onepassword',
  'bitwarden',
  'oskeychain',
  'awssm',
  'azurekv',
  'hashivault',
]);

export const SecretLocatorSchema = v.variant('provider', [
  v.object({
    provider: v.literal('onepassword'),
    vault: v.string(),
    item: v.string(),
    field: v.string(),
    /** Account hint for machines with more than one signed-in account. */
    account: v.optional(v.string()),
  }),
  v.object({
    provider: v.literal('bitwarden'),
    secretId: v.string(),
  }),
  v.object({
    provider: v.literal('oskeychain'),
    service: v.string(),
    account: v.string(),
  }),
  v.object({
    provider: v.literal('awssm'),
    name: v.string(),
    stage: v.optional(v.string()),
    region: v.optional(v.string()),
    /** Credential-chain profile hint. */
    profile: v.optional(v.string()),
  }),
  v.object({
    provider: v.literal('azurekv'),
    vaultUrl: v.string(),
    name: v.string(),
    version: v.optional(v.string()),
  }),
  v.object({
    provider: v.literal('hashivault'),
    mount: v.string(),
    path: v.string(),
    key: v.string(),
    /** Server hint when more than one server is configured. */
    serverUrl: v.optional(v.string()),
  }),
]);

export const VaultSecretManagerSchema = v.object({
  uid: UidSchema,
  kind: v.literal('secret-manager'),
  name: v.string(),
  locator: SecretLocatorSchema,
});

export const VaultSecretSchema = v.variant('kind', [
  VaultSecretStringSchema,
  VaultSecretTotpSchema,
  VaultSecretClientCertificateSchema,
  VaultSecretManagerSchema,
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
