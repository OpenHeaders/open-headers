/**
 * Rehome — the ONE primitive behind "nothing is lost silently" in the
 * tree containment plan. A child that ends up with no live parent
 * (its container tombstoned under a concurrent move; the losing slot
 * of a folder cycle) is re-attached to a collection root of its tree,
 * appended after the tail, and the move is surfaced on the Activity
 * Feed as a `rehome-entity` row — the git-like answer: keep the
 * entity, show the conflict. The reconciler plans the slot writes;
 * this module shapes the feed entry and its inverse.
 */

import {
  type ActivityEntry,
  activityEntryId,
  type InverseSpec,
  type MutationEnvelope,
  type ParentRefShape,
} from '@openheaders/core/sync';
import type { TreeSlotRecord } from './post-state/folder-tree-post-state';

export type RehomeReason = 'orphan' | 'cycle';

export interface RehomePlan {
  child: { type: string; uid: string };
  /** The slot the child lost — known for a cycle victim (the index
   *  reports it), unknown for an orphan whose container is gone. */
  from: TreeSlotRecord | null;
  to: { parent: ParentRefShape; setPath: string };
  reason: RehomeReason;
}

/**
 * The feed row for one applied rehome, keyed on the `addToSet`
 * envelope that landed the child on its root so `(mutationId, kind)`
 * stays unique and the row orders among peers' rows by the same HLC.
 * The inverse is the move back — a `slotTransfer` from the root onto
 * the original container with the prior marker and key — and is
 * unavailable when that container is no longer alive.
 */
export function rehomeActivityEntry(
  envelope: MutationEnvelope,
  plan: RehomePlan,
  originalParentAlive: boolean,
  observedAt: number,
): ActivityEntry {
  const spec: InverseSpec =
    plan.from && originalParentAlive
      ? {
          kind: 'slotTransfer',
          from: { type: plan.to.parent.type, id: plan.to.parent.uid, path: plan.to.setPath },
          to: { type: plan.from.parent.type, id: plan.from.parent.uid, path: plan.from.setPath },
          itemId: plan.child.uid,
          item: plan.from.item,
          orderKey: plan.from.orderKey,
        }
      : { kind: 'unavailable', reason: 'original-parent-gone' };
  const kind = 'rehome-entity';
  return {
    id: activityEntryId({ hlc: envelope.hlc, mutationId: envelope.mutationId, kind }),
    workspaceId: envelope.workspaceId,
    mutationId: envelope.mutationId,
    hlc: envelope.hlc,
    kind,
    entityType: plan.child.type,
    entityId: plan.child.uid,
    origin: envelope.origin,
    observedAt,
    read: false,
    context: {
      path: plan.to.setPath,
      itemId: plan.child.uid,
      reason: plan.reason,
      from: plan.from ? { type: plan.from.parent.type, uid: plan.from.parent.uid } : null,
      to: { type: plan.to.parent.type, uid: plan.to.parent.uid },
      inverse: { mutatorVersion: envelope.mutatorVersion, spec },
    },
  };
}
