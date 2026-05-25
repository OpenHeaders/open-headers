/**
 * Pure tabId extraction over the six `RequestLifecycleUpdate` variants.
 * Lifted out of the hub so the per-tab fanout decision is a one-line
 * predicate, not a switch buried in the broadcast loop.
 */

import type { RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';

export function tabIdOf(update: RequestLifecycleUpdate): number {
  return update.kind === 'started' ? update.lifecycle.tabId : update.tabId;
}
