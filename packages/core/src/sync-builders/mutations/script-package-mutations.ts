/**
 * Script-package write-site → oracle helpers.
 *
 * Pure transforms — no oracle reads, no IO — used by the renderer write
 * client (and any future SW write site) to produce `(batch, sideEffects)`
 * pairs from the catalog factories. Packages are fully flat-scalar, so
 * the update helper is a flat per-key loop emitting `setField` envelopes.
 * Side effects are always empty — packages are read at script-execution
 * time, not compiled into DNR or the variable resolver.
 */

import {
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  mintBatch,
  SCRIPT_PACKAGE_ENTITY_TYPE,
  type SideEffectIntent,
} from '@openheaders/core/sync';
import type { ScriptPackage } from '@openheaders/core/types';
import { seedScriptPackage } from '../projections/script-package-projection';

export interface ScriptPackageMutationPayload {
  batch: MutationBatch;
  sideEffects: SideEffectIntent[];
}

export function buildAddScriptPackageBatch(
  scriptPackage: ScriptPackage,
  ctx: MutatorContext,
): ScriptPackageMutationPayload {
  return { batch: seedScriptPackage(scriptPackage, ctx), sideEffects: [] };
}

export function buildDeleteScriptPackageBatch(
  scriptPackageUid: string,
  ctx: MutatorContext,
): ScriptPackageMutationPayload {
  const bodies: MutationBody[] = [{ kind: 'delete', type: SCRIPT_PACKAGE_ENTITY_TYPE, id: scriptPackageUid }];
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}

/**
 * Translate a `Partial<Omit<ScriptPackage, 'uid' | 'path'>>` patch into
 * a single batch of per-leaf `setField` envelopes. Undefined values skip.
 */
export function buildUpdateScriptPackageBatch(
  scriptPackageUid: string,
  updates: Partial<Omit<ScriptPackage, 'uid' | 'path'>>,
  ctx: MutatorContext,
): ScriptPackageMutationPayload {
  const bodies: MutationBody[] = [];
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    bodies.push({
      kind: 'setField',
      type: SCRIPT_PACKAGE_ENTITY_TYPE,
      id: scriptPackageUid,
      path: key,
      value,
    });
  }
  return { batch: mintBatch(ctx, bodies), sideEffects: [] };
}
