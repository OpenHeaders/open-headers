/**
 * Awareness bridge — adapts `AwarenessPublishRequest` from
 * `@openheaders/core/protocol` to the SW {@link AwarenessStore}.
 *
 * Pure adapter, like {@link bridge.ts}. The handler reaches into the
 * store via the injected callback rather than a module-level singleton
 * so it stays testable without service-level fixtures.
 */

import type { AwarenessPublishRequest, AwarenessPublishResponse } from '@openheaders/core/protocol';
import type { AwarenessStore } from './awareness';

/**
 * Resolve an `AwarenessStore` for a given workspace id. The service
 * holds one store per active workspace; cross-workspace publishes
 * (rare, but possible if a renderer hasn't observed the active-workspace
 * change yet) are dropped at the boundary.
 */
export type AwarenessStoreLookup = (workspaceId: string) => AwarenessStore | null;

export function handleAwarenessPublish(
  lookup: AwarenessStoreLookup,
  request: AwarenessPublishRequest,
): AwarenessPublishResponse {
  const store = lookup(request.workspaceId);
  if (!store) {
    // No store for this workspace — return an empty presence so the
    // caller's local mirror clears the entry rather than holding stale.
    return { ok: true, presence: [] };
  }
  const presence = store.publish(request.state);
  return { ok: true, presence };
}
