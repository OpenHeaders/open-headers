/**
 * Shared variable-mutator factory.
 *
 * Variable scopes (collection, request-collection, template-collection,
 * environment, workspace-variables) all materialize variables as set
 * members at a fixed `varsPath` on the entity. Set-member identity =
 * the variable's stable `uid` (NOT the user-mutable `name` field).
 *
 * Identity model. The four legacy primitives (set / remove / rename /
 * setType) collapse to two: `setVariable` (upsert by uid; handles add,
 * edit, rename, and type-toggle uniformly) and `removeVariable` (by uid).
 * Per-itemId LWW handles convergence — same uid + later HLC supersedes
 * the earlier whole-record. Rename is just `setVariable` with the same
 * uid and a new `name`. Concurrent same-row renames converge on the
 * later-HLC name (one row, latest-name-wins). Concurrent ADDS of
 * same-named rows produce two distinct uids → two rows visible in the
 * editor for manual merge (no silent data loss either way).
 *
 * Parallel to the rule + request slices from session 39
 * (`HeaderModification.uid`, `RequestHeader.uid`). Earlier comments in
 * this codebase describing "concurrent diverging renames produce two
 * new entries" reflect the pre-uid model and are wrong under this
 * factory.
 *
 * Per-catalog wrappers below preserve the existing named-arg shapes
 * (`SetCollectionVarArgs`, etc.) so call sites and tests don't churn
 * structurally — the args carry a `variable: Variable` payload now
 * instead of separate name/value/type fields.
 *
 * Singleton variable scopes (workspace-variables, vault) plug in by
 * binding `entityUid` to a fixed constant in the wrapper and ignoring
 * the uid arg in `makeSideEffects`. Vault-secrets stays parallel because
 * the secret shape includes TOTP variants with non-`{name,value,type}`
 * fields; vault uses its own concrete factory in `vault/secret.ts`.
 */

import type { HLC } from '../../hlc';
import type { MutationBatch, MutationBody } from '../../envelope';
import type { Variable } from '../../../types/variable';
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
  /** Whole variable record. `variable.uid` is the set-member itemId. */
  variable: Variable;
  /** Optional explicit orderKey — defaults to seed-key when omitted. */
  orderKey?: string;
}

export interface RemoveVariableInput {
  entityUid: string;
  /** The row's persisted uid — NOT its name. */
  uid: string;
}

export interface VariableMutators {
  /**
   * Upsert a variable row. Used uniformly for add / edit (value, type,
   * name) / reorder-companion. Per-(setPath, uid) LWW means the latest
   * record for the same uid wins; renames converge on the later-HLC name.
   */
  setVariable(ctx: MutatorContext, input: SetVariableInput): MutatorIntent;
  removeVariable(ctx: MutatorContext, input: RemoveVariableInput): MutatorIntent;
}

export function makeVariableMutators(bindings: VariableMutatorBindings): VariableMutators {
  const { entityType, varsPath, mintBatch, makeSideEffects } = bindings;

  return {
    setVariable(ctx, input) {
      const body: MutationBody = {
        kind: 'addToSet',
        type: entityType,
        id: input.entityUid,
        path: varsPath,
        itemId: input.variable.uid,
        item: input.variable,
        orderKey: input.orderKey,
      };
      return {
        batch: mintBatch(ctx, [body]),
        sideEffects: makeSideEffects(input.entityUid, ctx.hlc),
      };
    },
    removeVariable(ctx, input) {
      const body: MutationBody = {
        kind: 'removeFromSet',
        type: entityType,
        id: input.entityUid,
        path: varsPath,
        itemId: input.uid,
      };
      return {
        batch: mintBatch(ctx, [body]),
        sideEffects: makeSideEffects(input.entityUid, ctx.hlc),
      };
    },
  };
}
