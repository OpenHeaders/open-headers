/**
 * One-shot response handoff across the draft→edit tab swap.
 *
 * Saving a request draft replaces the `request-create` tab with a fresh
 * `request-edit` tab (see `useSaveRequestFlow`), which remounts
 * `RequestEditor` and would drop its in-memory response. The save flow
 * stashes the draft's last response under the created request's uid;
 * the remounted editor takes it as its initial response.
 */

import type { ExecutedRequestSnapshot } from '@openheaders/core/types';

const pending = new Map<string, ExecutedRequestSnapshot>();

export function stashHandoffResponse(requestUid: string, snapshot: ExecutedRequestSnapshot): void {
  pending.set(requestUid, snapshot);
}

export function takeHandoffResponse(requestUid: string): ExecutedRequestSnapshot | null {
  const snapshot = pending.get(requestUid) ?? null;
  pending.delete(requestUid);
  return snapshot;
}
