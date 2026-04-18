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
