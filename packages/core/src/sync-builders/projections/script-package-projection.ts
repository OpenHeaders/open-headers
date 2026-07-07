/**
 * Script-package projection — `ScriptPackage ⇄ MutationBatch /
 * MaterializedEntity`. The entity is fully flat-scalar, so the seed is
 * a single `create` envelope and the projection is a plain shape check.
 */

import {
  type MaterializedEntity,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  mintBatch,
  SCRIPT_PACKAGE_ENTITY_TYPE,
} from '@openheaders/core/sync';
import type { ScriptPackage } from '@openheaders/core/types';

export function seedScriptPackage(scriptPackage: ScriptPackage, ctx: MutatorContext): MutationBatch {
  const payload = JSON.parse(JSON.stringify(scriptPackage)) as Record<string, unknown>;
  const bodies: MutationBody[] = [{ kind: 'create', type: SCRIPT_PACKAGE_ENTITY_TYPE, id: scriptPackage.uid, payload }];
  return mintBatch(ctx, bodies);
}

/**
 * Convert a `MaterializedEntity` back into a `ScriptPackage`. Returns
 * `null` when the materialized data fails basic shape checks — callers
 * persist only when projection succeeds.
 */
export function projectScriptPackage(materialized: MaterializedEntity): ScriptPackage | null {
  if (materialized.type !== SCRIPT_PACKAGE_ENTITY_TYPE) return null;
  const data = materialized.data;
  if (!isPlainObject(data)) return null;
  return data as ScriptPackage;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
