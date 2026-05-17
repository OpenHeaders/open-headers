/**
 * Initiator-graph helpers.
 *
 * Chrome's Network tab "Request initiator chain" is a *downstream* view —
 * for the selected request it lists every subresource the page initiated,
 * recursively. The HAR `_initiator` field alone only describes the
 * *upstream* parent ("who initiated me"), so reconstructing the chain
 * means scanning siblings and inverting the parent-of relation.
 *
 * These helpers are pure: `resolveInitiatorRootUrl` extracts the URL we
 * attribute as a request's parent, and `InspectorStore` uses it to maintain
 * an incremental parent-URL → child-entry-id index alongside its other
 * indices. The view consumes the inverted index through `getInitiatorChildren`
 * passed down from the panel.
 */

import type { InspectorHarEntry } from '@openheaders/core/types';

interface InitiatorCallFrame {
  url?: string;
}

interface InitiatorStackTrace {
  callFrames?: InitiatorCallFrame[];
  parent?: InitiatorStackTrace;
}

interface InitiatorField {
  type?: string;
  url?: string;
  stack?: InitiatorStackTrace;
}

function firstScriptUrl(stack: InitiatorStackTrace | undefined): string | undefined {
  let cur: InitiatorStackTrace | undefined = stack;
  while (cur) {
    for (const f of cur.callFrames ?? []) {
      if (f.url) return f.url;
    }
    cur = cur.parent;
  }
  return undefined;
}

/**
 * URL we attribute as the request's parent in the initiator graph.
 * Returns null for top-level navigations or user-driven fetches with no
 * upstream context (`_initiator.type === 'other'` and no url/stack).
 */
export function resolveInitiatorRootUrl(har: InspectorHarEntry): string | null {
  const init = har._initiator as InitiatorField | undefined;
  if (!init) return null;
  if (init.url) return init.url;
  return firstScriptUrl(init.stack) ?? null;
}
