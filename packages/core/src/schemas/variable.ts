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

export const VaultSecretSchema = v.object({
  name: v.string(),
  value: v.string(),
});

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
