/**
 * Activity Feed classifier — Phase C F2 (first cut).
 *
 * Pure function: given an applied mutation envelope + outcome, decide
 * whether the receiver should record a workspace-wide Activity Feed
 * entry, and if so what kind. Side-effect-free and host-neutral; the
 * installer (extension SW, desktop main) feeds it the
 * {@link OracleSyncBroadcastEvent} stream and persists each result
 * via {@link ActivityLog}.
 *
 * Scope of this first cut:
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
 *   - **Structural kinds only.** Three categories — `create-entity`,
 *     `delete-entity`, `edit-entity`. The highlight kinds
 *     (`supersede-local-edit`, `sensitive-field-rotation`,
 *     `permission-scope-expansion`) need priors and ride on a
 *     follow-up slice that wires the document-store's pre-apply
 *     snapshot into the classifier inputs.
 *
 * Public shape returns an array so a single envelope can fan out to
 * multiple highlight kinds once those land. F2 first cut returns at
 * most one entry.
 */

import type { MutationEnvelope, MutatorOutcome } from '@openheaders/core/sync';
import { activityEntryId, type ActivityEntry, type ActivityEntryKind } from '@openheaders/core/sync';

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
}

export function classifyEnvelopeForActivity(input: ClassifyActivityInput): ActivityEntry[] {
  const { envelope, outcome, isInbound, observedAt } = input;
  if (!isInbound) return [];
  if (outcome.status !== 'applied') return [];

  const kind = structuralKindFor(envelope);
  if (kind === null) return [];

  const body = envelope.body;
  const context: Record<string, unknown> = {};
  if ('path' in body && typeof body.path === 'string') context.path = body.path;
  if ('itemId' in body && typeof body.itemId === 'string') context.itemId = body.itemId;

  const base: Omit<ActivityEntry, 'id'> = {
    workspaceId: envelope.workspaceId,
    mutationId: envelope.mutationId,
    hlc: envelope.hlc,
    kind,
    entityType: body.type,
    entityId: body.id,
    origin: envelope.origin,
    observedAt,
    read: false,
    ...(Object.keys(context).length > 0 ? { context } : {}),
  };

  return [{ ...base, id: activityEntryId(base) }];
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
