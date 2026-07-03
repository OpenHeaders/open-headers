/**
 * useActivityRevert — imperative bridge call for F6.d Revert.
 *
 * Unlike {@link useActivityMutes} / {@link useActivityFeed} there is no
 * live-tail state to maintain: revert is a one-shot RPC that emits an
 * inverse mutation envelope through the same `oh.sync.apply` path as
 * any local mutation. The hook just memoizes a `revert(entry)` callback
 * bound to the current `workspaceId` so cards in the Activity Feed
 * panel can fire-and-forget without touching the bridge directly.
 *
 * The classifier embeds the inverse-mutation spec on the structural
 * entry's `context.inverse`; this hook pulls it back out and ships it
 * to the host along with `(entityType, entityId)`. Entries whose
 * `context.inverse` is `{ kind: 'unavailable' }` (delete-irreversible)
 * or absent (local-emit, classifier skipped capture) cannot be
 * reverted — {@link canRevertEntry} is the predicate the card uses to
 * render the button in a disabled state with an appropriate tooltip
 * rather than firing a doomed call.
 */
import { hostBridge } from '@openheaders/core/bridge';
import type { ActivityEntry, InverseEnvelopeContext } from '@openheaders/core/sync';
import { useCallback } from 'react';

export type RevertResult =
  | { ok: true; mutationId: string }
  | { ok: false; reason: string };

/**
 * Map a {@link RevertResult.reason} code to a single-line, end-user-
 * facing string suitable for a toast. Unknown codes fall through to the
 * raw reason so a wire change doesn't show "Revert failed: undefined".
 */
export function humanizeRevertReason(reason: string): string {
  switch (reason) {
    case 'delete-irreversible':
      return 'Deletes are permanent and cannot be reverted.';
    case 'already-tombstoned':
      return 'The entity was deleted after this change landed.';
    case 'set-item-missing':
      return 'The item this change touched no longer exists.';
    case 'no-op':
      return 'Nothing to revert — the prior state already matches.';
    case 'no-inverse-recorded':
      return 'No inverse was captured for this change.';
    case 'no-oracle-for-workspace':
      return 'Workspace is not ready.';
    case 'no-workspace':
      return 'No active workspace.';
    case 'malformed-payload':
      return 'Internal error: malformed revert payload.';
    default:
      return reason;
  }
}

export interface UseActivityRevertApi {
  revert: (entry: ActivityEntry) => Promise<RevertResult>;
}

/**
 * Pull the {@link InverseEnvelopeContext} the classifier stamped onto
 * the structural entry's context. Returns null when no spec was
 * captured (local-emit, or first-touch inbound the bridge skipped),
 * which the caller interprets as "Revert not available."
 */
export function getEntryInverse(entry: ActivityEntry): InverseEnvelopeContext | null {
  const candidate = entry.context?.inverse;
  if (!candidate || typeof candidate !== 'object') return null;
  const obj = candidate as { mutatorVersion?: unknown; spec?: unknown };
  if (typeof obj.mutatorVersion !== 'number') return null;
  if (!obj.spec || typeof obj.spec !== 'object') return null;
  return candidate as InverseEnvelopeContext;
}

/**
 * Predicate for the card footer: render Revert as enabled when the
 * entry carries a spec that isn't the unavailable sentinel. The
 * specific unavailable reason flows to a tooltip via
 * {@link getEntryRevertUnavailableReason}.
 */
export function canRevertEntry(entry: ActivityEntry): boolean {
  const inverse = getEntryInverse(entry);
  if (!inverse) return false;
  return inverse.spec.kind !== 'unavailable';
}

/**
 * When the entry cannot be reverted, return the specific unavailable
 * reason for tooltip copy. Returns null when the entry is revertible
 * or when no spec was captured at all (the card will hide the button
 * entirely rather than render a disabled control with no reason).
 */
export function getEntryRevertUnavailableReason(entry: ActivityEntry): string | null {
  const inverse = getEntryInverse(entry);
  if (!inverse) return null;
  if (inverse.spec.kind === 'unavailable') return inverse.spec.reason;
  return null;
}

export function useActivityRevert(workspaceId: string | null): UseActivityRevertApi {
  const revert = useCallback(
    async (entry: ActivityEntry): Promise<RevertResult> => {
      if (!workspaceId) return { ok: false, reason: 'no-workspace' };
      const inverse = getEntryInverse(entry);
      if (!inverse) return { ok: false, reason: 'no-inverse-recorded' };
      try {
        const response = await hostBridge.call('oh.sync.revertActivity', {
          workspaceId,
          entityType: entry.entityType,
          entityId: entry.entityId,
          inverse,
        });
        return response;
      } catch (err) {
        return { ok: false, reason: (err as Error).message };
      }
    },
    [workspaceId],
  );
  return { revert };
}
