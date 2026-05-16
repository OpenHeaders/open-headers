/**
 * Activity Feed classifier — Phase C F2.
 *
 * Pure function: given an applied mutation envelope + outcome, decide
 * whether the receiver should record a workspace-wide Activity Feed
 * entry, and if so what kind. Side-effect-free and host-neutral; the
 * installer (extension SW, desktop main) feeds it the
 * {@link OracleSyncBroadcastEvent} stream and persists each result
 * via {@link ActivityLog}.
 *
 * Scope:
 *
 *   - **Receiver-only.** Only envelopes the host received over the
 *     wire (`isInbound: true`) enter the feed. The caller decides
 *     what counts as inbound — on the extension SW that's the
 *     `hasRecentlyApplied` mutation-stream-bridge seen-set; on
 *     desktop it's the equivalent inbound dispatch path.
 *   - **Applied-only.** Non-applied outcomes (`duplicate`,
 *     `superseded-by-hlc`, `tombstoned`, `invalid-path`, schema /
 *     version rejections) yield nothing. The feed is a record of
 *     state changes the user can observe, not engine no-ops.
 *   - **One structural row + zero or more highlight rows.** Every
 *     applied + inbound envelope produces exactly one structural row
 *     (`create-entity` / `delete-entity` / `edit-entity`). When the
 *     caller passes pre/post materialized snapshots, the classifier
 *     additionally emits `sensitive-field-rotation` (a secret-bearing
 *     leaf changed value) and / or `permission-scope-expansion` (a
 *     rule's match surface widened). The `supersede-local-edit`
 *     highlight needs per-field origin tracking and is deferred
 *     (F2.h).
 */

import type {
  InverseEnvelopeContext,
  MaterializedEntity,
  MutationBody,
  MutationEnvelope,
  MutatorOutcome,
} from '@openheaders/core/sync';
import {
  activityEntryId,
  detectSensitiveRotation,
  widensScope,
  type ActivityEntry,
  type ActivityEntryKind,
} from '@openheaders/core/sync';

export interface ClassifyActivityInput {
  envelope: MutationEnvelope;
  outcome: MutatorOutcome;
  /**
   * `true` iff the envelope arrived via the host's inbound
   * mutation-stream bridge (i.e. came from a peer over the wire).
   * The feed surfaces inbound activity only; local-emit envelopes
   * are skipped.
   */
  isInbound: boolean;
  /** Wall-clock millis to stamp on the entry. Inject for tests. */
  observedAt: number;
  /**
   * Materialized view of the entity BEFORE the inbound mutation was
   * applied. Captured by the mutation-stream bridge pre-apply and
   * handed in by the installer. Required to emit the highlight kinds;
   * absent in unit tests that exercise the structural path only.
   */
  prior?: MaterializedEntity | null;
  /**
   * Materialized view of the entity AFTER the inbound mutation was
   * applied. The installer reads it via `materializeOne` on the local
   * oracle. Required to emit the highlight kinds.
   */
  next?: MaterializedEntity | null;
  /**
   * Inverse-mutation context captured by the bridge at pre-apply time
   * alongside the prior. When present, the classifier attaches it to
   * the structural entry's `context.inverse` so the F6.d Revert action
   * can mint an inverse envelope without re-reading the (now-mutated)
   * pre-apply state. Absent on local-emit envelopes and on first-touch
   * inbound where the bridge skipped capture; `Revert` simply degrades
   * to disabled when the entry has no spec.
   */
  inverse?: InverseEnvelopeContext | null;
}

export function classifyEnvelopeForActivity(input: ClassifyActivityInput): ActivityEntry[] {
  const { envelope, outcome, isInbound, observedAt, prior = null, next = null, inverse = null } = input;
  if (!isInbound) return [];
  if (outcome.status !== 'applied') return [];

  const structuralKind = structuralKindFor(envelope);
  if (structuralKind === null) return [];

  const body = envelope.body;
  // Base context shared by every kind on this envelope — path / itemId
  // are derivable from `body` and identify the affected leaf for diff
  // tooling. The inverse spec rides only on the structural row: the
  // highlight rows (sensitive / scope-expansion) share the same
  // mutationId and the panel groups by mutationId, so a single
  // `Revert` button per group has one spec to consult.
  const sharedContext: Record<string, unknown> = {};
  if ('path' in body && typeof body.path === 'string') sharedContext.path = body.path;
  if ('itemId' in body && typeof body.itemId === 'string') sharedContext.itemId = body.itemId;

  const baseFields = {
    workspaceId: envelope.workspaceId,
    mutationId: envelope.mutationId,
    hlc: envelope.hlc,
    entityType: body.type,
    entityId: body.id,
    origin: envelope.origin,
    observedAt,
    read: false,
  } as const;

  const kinds = kindsToEmit(structuralKind, body, prior, next);
  const entries: ActivityEntry[] = [];
  for (const kind of kinds) {
    const context: Record<string, unknown> = { ...sharedContext };
    if (kind === structuralKind && inverse !== null) context.inverse = inverse;
    const contextField = Object.keys(context).length > 0 ? { context } : {};
    const partial: Omit<ActivityEntry, 'id'> = { ...baseFields, kind, ...contextField };
    entries.push({ ...partial, id: activityEntryId(partial) });
  }
  return entries;
}

/**
 * Compose the kinds this envelope produces. Always begins with the
 * structural kind; appends highlight kinds when their detectors fire
 * on the pre/post snapshots.
 *
 * Highlight kinds only emit on `edit-entity` — create / delete are
 * already strong signals on their own and the diff would be one-sided
 * (no prior on create; no next on delete).
 *
 * `supersede-local-edit` fires when an inbound `setField` / `unsetField`
 * overwrites a path whose prior write originated locally on this
 * device. Origin is read from {@link MaterializedEntity.fieldOrigins}
 * — populated by the materializer from {@link EntityState.fieldValues}.
 * Set mutators (`addToSet` / `removeFromSet` / `moveBefore`) don't
 * touch leaf field values, so they can't supersede a per-path local
 * edit and don't emit this kind.
 */
function kindsToEmit(
  structural: ActivityEntryKind,
  body: MutationBody,
  prior: MaterializedEntity | null,
  next: MaterializedEntity | null,
): ActivityEntryKind[] {
  const out: ActivityEntryKind[] = [structural];
  if (structural !== 'edit-entity') return out;

  if (supersedesLocalEdit(body, prior)) {
    out.push('supersede-local-edit');
  }

  const priorData = prior?.data ?? null;
  const nextData = next?.data ?? null;
  if (priorData === null || nextData === null) return out;
  if (detectSensitiveRotation(body.type, priorData, nextData)) {
    out.push('sensitive-field-rotation');
  }
  if (widensScope(body.type, priorData, nextData)) {
    out.push('permission-scope-expansion');
  }
  return out;
}

function supersedesLocalEdit(body: MutationBody, prior: MaterializedEntity | null): boolean {
  if (prior === null) return false;
  if (body.kind !== 'setField' && body.kind !== 'unsetField') return false;
  return prior.fieldOrigins[body.path] === 'local';
}

function structuralKindFor(envelope: MutationEnvelope): ActivityEntryKind | null {
  switch (envelope.body.kind) {
    case 'create':
      return 'create-entity';
    case 'delete':
      return 'delete-entity';
    case 'setField':
    case 'unsetField':
    case 'addToSet':
    case 'removeFromSet':
    case 'moveBefore':
      return 'edit-entity';
  }
}
