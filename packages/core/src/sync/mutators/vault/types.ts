/**
 * Vault mutator catalog — routing constants.
 *
 * Singleton entity. There is exactly one Vault record per workspace,
 * addressed by the fixed id `VAULT_ID`. The factory context
 * (`MutatorContext`) and return shape (`MutatorIntent`) live in the
 * parent `mutators/types.ts` because they're identical across every
 * entity type.
 *
 * Set member identity for vault secrets is the secret NAME, matching
 * environment / collection / workspace-vars. The diverging shape vs
 * those three: vault items are `VaultSecret` (discriminated union over
 * `kind: 'string' | 'totp'`), not `Variable` — the catalog primitives
 * therefore take a full `VaultSecret` rather than a `(name, value, type)`
 * tuple.
 *
 * Sensitivity: vault entries are §12.1 schema-marked sensitive — the
 * entire entity is. Awareness scrubs `fieldFocus` for any state whose
 * `entityFocus.type === VAULT_ENTITY_TYPE` (§14.4). Vault remains
 * non-syncing in v1 (§12.3); this catalog only services local
 * convergence across same-machine surfaces.
 */

/** Routing key carried on every vault mutation envelope. */
export const VAULT_ENTITY_TYPE = 'vault';

/** Set path holding the secrets list on the vault entity. */
export const VAULT_PATH = 'secrets';

/** Fixed singleton id — every workspace has exactly one of these. */
export const VAULT_ID = 'vault';
