/**
 * Inverse-mutation spec carried on an Activity Feed entry's `context`.
 *
 * Each row produced by the F2 classifier optionally embeds the minimum
 * state needed to mint the mutation that undoes the inbound one — the
 * Activity Feed's `Revert` action (F6.d). Capturing only the prior
 * value at the touched path (or the prior `(item, orderKey)` for set
 * ops) keeps the per-row payload bounded; a whole-entity snapshot is
 * only ever needed for `delete`, which is structurally irreversible
 * under §7.2 delete-wins-permanent and therefore never produces a spec.
 *
 * The spec is shape-symmetric with {@link MutationBody}: one variant
 * per inbound kind, carrying only the fields the inverse generator
 * needs to construct a new `MutationBody`. Validation against the
 * post-inbound state happens at revert time in the generator; this
 * module is pure types + a pure compute helper.
 *
 * Producers: `mutation-stream-bridge.capturePriorsForActivity` reads
 * the pre-apply state via the local oracle and computes the spec here
 * before passing it to the classifier.
 *
 * Consumers: `activity-revert.generateInverseMutation` reads
 * `entry.context.inverse` at revert time, validates against current
 * state, and emits a fresh envelope.
 */
import type { MutationBody } from '../envelope';

/** Inverse of `create` is `delete`. No prior state required. */
export interface InverseCreate {
  kind: 'create';
}

/**
 * Inverse of `delete` would re-create the entity, which §7.2
 * delete-wins-permanent makes structurally impossible at the same id.
 * The unavailable spec is what the classifier embeds so the UI can
 * render the Revert button as disabled with a clear tooltip.
 */
export interface InverseUnavailable {
  kind: 'unavailable';
  reason: 'delete-irreversible';
}

/**
 * Inverse of `setField path v` is either `setField path priorValue`
 * (when the field existed pre-apply) or `unsetField path` (when it did
 * not — restoring absence is the closest available undo). The boolean
 * disambiguates so an explicit `undefined` prior value still rounds-
 * trips correctly.
 */
export interface InverseSetField {
  kind: 'setField';
  path: string;
  priorExists: boolean;
  priorValue?: unknown;
}

/**
 * Inverse of `unsetField path` is symmetric to {@link InverseSetField}:
 * `setField path priorValue` when the path was previously populated,
 * or no-op when it was already absent.
 */
export interface InverseUnsetField {
  kind: 'unsetField';
  path: string;
  priorExists: boolean;
  priorValue?: unknown;
}

/**
 * Inverse of `addToSet path itemId item` is `removeFromSet path itemId`.
 * The itemId from the original envelope is enough — no prior state
 * needed because the add itself is what we are undoing.
 */
export interface InverseAddToSet {
  kind: 'addToSet';
  path: string;
  itemId: string;
}

/**
 * Inverse of `removeFromSet path itemId` is `addToSet path itemId item`
 * with the prior `orderKey` so the item lands where it was. Captured
 * pre-apply from the oracle's `liveOrderedSetItems(path)` because the
 * `MaterializedEntity.data` view strips itemIds + order keys.
 */
export interface InverseRemoveFromSet {
  kind: 'removeFromSet';
  path: string;
  itemId: string;
  priorItem: unknown;
  priorOrderKey: string;
}

/**
 * Inverse of `moveBefore path itemId k` is `moveBefore path itemId
 * priorOrderKey` — restore the item's position. Captured pre-apply.
 */
export interface InverseMoveBefore {
  kind: 'moveBefore';
  path: string;
  itemId: string;
  priorOrderKey: string;
}

/**
 * Discriminated union mirroring {@link MutationBody} kinds. The
 * `unavailable` variant carries no per-mutator data — it is the
 * sentinel for "this row cannot be reverted, here is why."
 */
export type InverseSpec =
  | InverseCreate
  | InverseUnavailable
  | InverseSetField
  | InverseUnsetField
  | InverseAddToSet
  | InverseRemoveFromSet
  | InverseMoveBefore;

/**
 * Wire-side shape embedded on the structural activity entry's
 * `context.inverse`. Pairs the per-mutator inverse with the original
 * envelope's `mutatorVersion` so the F6.d generator mints a revert
 * envelope that is wire-compatible with the inbound it undoes — even
 * if the entity's mutator catalog version is bumped between observe
 * and revert.
 */
export interface InverseEnvelopeContext {
  mutatorVersion: number;
  spec: InverseSpec;
}

/**
 * Pre-apply read needed to fill in path / set-member specs. The bridge
 * passes a minimal accessor backed by the workspace's oracle so the
 * compute step stays pure. `getFieldAt` walks the pre-apply
 * materialized data for the entity at the dotted path; `getSetMember`
 * resolves an itemId at a set path to its raw `(item, orderKey)` pair
 * (sourced from the oracle's `liveOrderedSetItems`).
 */
export interface InverseSpecPriorAccess {
  /**
   * Pre-apply value lookup at a dotted path on the entity's
   * materialized data. Returns `{ exists: false }` when the path
   * doesn't resolve to a leaf the materializer would emit.
   */
  getFieldAt(path: string): { exists: boolean; value?: unknown };
  /**
   * Pre-apply raw set-member lookup. Returns `null` when no live
   * member exists for `(path, itemId)` in the pre-apply state.
   */
  getSetMember(path: string, itemId: string): { item: unknown; orderKey: string } | null;
}

/**
 * Compute the inverse spec for an inbound mutation body. Pure: the
 * caller supplies a pre-apply accessor; this function never reads any
 * live state itself.
 *
 * Returns `null` for cases where the inbound body is malformed past
 * the schema layer (defense in depth; the dispatcher already rejects
 * such envelopes upstream).
 */
export function computeInverseSpec(body: MutationBody, prior: InverseSpecPriorAccess): InverseSpec | null {
  switch (body.kind) {
    case 'create':
      return { kind: 'create' };
    case 'delete':
      return { kind: 'unavailable', reason: 'delete-irreversible' };
    case 'setField': {
      const lookup = prior.getFieldAt(body.path);
      return lookup.exists
        ? { kind: 'setField', path: body.path, priorExists: true, priorValue: lookup.value }
        : { kind: 'setField', path: body.path, priorExists: false };
    }
    case 'unsetField': {
      const lookup = prior.getFieldAt(body.path);
      return lookup.exists
        ? { kind: 'unsetField', path: body.path, priorExists: true, priorValue: lookup.value }
        : { kind: 'unsetField', path: body.path, priorExists: false };
    }
    case 'addToSet':
      return { kind: 'addToSet', path: body.path, itemId: body.itemId };
    case 'removeFromSet': {
      const member = prior.getSetMember(body.path, body.itemId);
      if (!member) return null;
      return {
        kind: 'removeFromSet',
        path: body.path,
        itemId: body.itemId,
        priorItem: member.item,
        priorOrderKey: member.orderKey,
      };
    }
    case 'moveBefore': {
      const member = prior.getSetMember(body.path, body.itemId);
      if (!member) return null;
      return {
        kind: 'moveBefore',
        path: body.path,
        itemId: body.itemId,
        priorOrderKey: member.orderKey,
      };
    }
  }
}
