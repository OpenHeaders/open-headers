/**
 * Pure helper: snapshot of existing lifecycles → ordered sequence of
 * synthetic `{ kind: 'started' }` updates. Replay shares the consumer's
 * single reducer code path with live updates, so the consumer never
 * branches on "is this replay or live."
 *
 * Order is whatever `RequestLifecycleStore.snapshotTab` returns (LRU
 * position, oldest first). Consumers that want arrival ordering sort by
 * `lifecycle.startedAtMs`.
 */

import type { RequestLifecycle, RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';

export function snapshotToUpdates(snapshot: readonly RequestLifecycle[]): RequestLifecycleUpdate[] {
  const out: RequestLifecycleUpdate[] = [];
  for (const lifecycle of snapshot) out.push({ kind: 'started', lifecycle });
  return out;
}
