/**
 * Pure helper: snapshot of live contexts → ordered sequence of
 * `'context-added'` updates. Replay shares the consumer's single reducer
 * code path with live updates, so the consumer never branches on replay vs
 * live. Order is `JsContextStore.snapshotTab` order — first-add order.
 */

import type { JsContext, JsContextUpdate } from '@openheaders/core/js-contexts';

export function snapshotToUpdates(tabId: number, snapshot: readonly JsContext[]): JsContextUpdate[] {
  const out: JsContextUpdate[] = [];
  for (const context of snapshot) {
    out.push({ kind: 'context-added', tabId, context });
  }
  return out;
}
