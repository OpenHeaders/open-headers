/**
 * Shared variable-mutator factory.
 *
 * Variable scopes (collection, request-collection, template-collection,
 * etc.) all materialize variables as set members at a fixed `varsPath`
 * on the entity, with set-member identity = variable name. The four
 * primitives — set / remove / rename / setType — have identical wire
 * shape across every per-uid scope. Per-(setPath, name) LWW handles
 * concurrent same-name edits; concurrent diverging renames produce two
 * entries (the convergent answer for "two surfaces independently
 * renamed the same variable to different names").
 *
 * Per-catalog wrappers below preserve the existing named-arg shapes
 * (`SetCollectionVarArgs`, etc.) so call sites and tests don't churn.
 *
 * Singleton variable scopes (workspace-variables, vault) are NOT folded
 * in here: they target a fixed entity id (no `entityUid` arg) and their
 * side-effect intent has no key. Folding them would force a discriminated
 * config and erase the structural symmetry per-uid scopes share. They
 * stay parallel until a third singleton appears.
 */

import type { HLC } from '../../hlc';
import type { MutationBatch, MutationBody } from '../../envelope';
import type { MutatorContext, MutatorIntent, SideEffectIntent } from '../types';

export type VariableType = 'default' | 'secret';

/**
 * Per-catalog binding. The shared factory closes over an `entityType` /
 * `varsPath` constant pair, the catalog's `mintBatch` (carries its own
 * mutatorVersion), and a side-effect intent factory keyed on the entity
 * uid (e.g. `invalidateResolverIntent`).
 */
export interface VariableMutatorBindings {
  entityType: string;
  varsPath: string;
  mintBatch: (ctx: MutatorContext, bodies: MutationBody[]) => MutationBatch;
  /** Side effects to fire alongside every variable-write batch. */
  makeSideEffects: (entityUid: string, hlc: HLC) => SideEffectIntent[];
}

export interface SetVariableInput {
  entityUid: string;
  name: string;
  value: string;
  type?: VariableType;
  /** Optional explicit orderKey — defaults to seed-key when omitted. */
  orderKey?: string;
}

export interface RemoveVariableInput {
  entityUid: string;
  name: string;
}

export interface RenameVariableInput {
  entityUid: string;
  oldName: string;
  newName: string;
  /** Carried through so the new entry has the same value. */
  value: string;
  type?: VariableType;
  orderKey?: string;
}

export interface SetVariableTypeInput {
  entityUid: string;
  name: string;
  /** Carried through so the LWW replacement preserves it. */
  value: string;
  type: VariableType;
}

export interface VariableMutators {
  setVariable(ctx: MutatorContext, input: SetVariableInput): MutatorIntent;
  removeVariable(ctx: MutatorContext, input: RemoveVariableInput): MutatorIntent;
  /** Atomic rename — single batch so observers never see "old removed,
   *  new not yet added" intermediate state. Same-name input → empty batch. */
  renameVariable(ctx: MutatorContext, input: RenameVariableInput): MutatorIntent;
  /** Toggle a variable's `type`. Re-emits the whole record via `addToSet`;
   *  per-(setPath, itemId) LWW means the latest type wins. */
  setVariableType(ctx: MutatorContext, input: SetVariableTypeInput): MutatorIntent;
}

export function makeVariableMutators(bindings: VariableMutatorBindings): VariableMutators {
  const { entityType, varsPath, mintBatch, makeSideEffects } = bindings;

  const buildItem = (name: string, value: string, type: VariableType | undefined): { name: string; value: string; type: VariableType } => ({
    name,
    value,
    type: type ?? 'default',
  });

  const addBody = (entityUid: string, name: string, item: unknown, orderKey?: string): MutationBody => ({
    kind: 'addToSet',
    type: entityType,
    id: entityUid,
    path: varsPath,
    itemId: name,
    item,
    orderKey,
  });

  const removeBody = (entityUid: string, name: string): MutationBody => ({
    kind: 'removeFromSet',
    type: entityType,
    id: entityUid,
    path: varsPath,
    itemId: name,
  });

  return {
    setVariable(ctx, input) {
      return {
        batch: mintBatch(ctx, [addBody(input.entityUid, input.name, buildItem(input.name, input.value, input.type), input.orderKey)]),
        sideEffects: makeSideEffects(input.entityUid, ctx.hlc),
      };
    },
    removeVariable(ctx, input) {
      return {
        batch: mintBatch(ctx, [removeBody(input.entityUid, input.name)]),
        sideEffects: makeSideEffects(input.entityUid, ctx.hlc),
      };
    },
    renameVariable(ctx, input) {
      if (input.oldName === input.newName) {
        return { batch: mintBatch(ctx, []), sideEffects: [] };
      }
      const bodies: MutationBody[] = [
        removeBody(input.entityUid, input.oldName),
        addBody(input.entityUid, input.newName, buildItem(input.newName, input.value, input.type), input.orderKey),
      ];
      return {
        batch: mintBatch(ctx, bodies),
        sideEffects: makeSideEffects(input.entityUid, ctx.hlc),
      };
    },
    setVariableType(ctx, input) {
      return {
        batch: mintBatch(ctx, [addBody(input.entityUid, input.name, buildItem(input.name, input.value, input.type))]),
        sideEffects: makeSideEffects(input.entityUid, ctx.hlc),
      };
    },
  };
}
