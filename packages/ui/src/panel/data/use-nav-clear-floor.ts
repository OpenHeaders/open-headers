/**
 * `useNavClearFloor` — the "Preserve log" boundary, modeled as a
 * monotonic per-tab clear floor (a `startedAtMs` value) rather than a
 * reversible display filter.
 *
 * The browser's Network panel does not retroactively un-hide history when
 * you re-enable Preserve log: it records from that point forward. A floor
 * that only ever advances captures exactly that:
 *
 *   - A top-level navigation that commits while Preserve log is OFF clears
 *     the prior page's requests → the floor advances to that navigation.
 *   - While Preserve log is ON the floor is frozen, so the navigations
 *     that happen accumulate (nothing is dropped).
 *   - The floor never moves backward, so toggling Preserve log ON keeps
 *     the past scoped out and preserves everything from there on.
 *
 * Returns the floor; the consumer shows lifecycles with
 * `startedAtMs >= floor`. `-1` means "no floor" (show everything) — the
 * Preserve-log-ON-from-the-start default, and the case where no top-level
 * navigation has been observed yet.
 */

import type { Page } from '@openheaders/core/page-stream';
import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { useEffect, useRef, useState } from 'react';

/**
 * Latest top-level navigation start, or -1 if none.
 *
 * A top-level navigation in EITHER correlator vocabulary: the heuristic
 * (webRequest) path tags it `main_frame` (self-identifying); the CDP path
 * tags every document — top-level AND iframe — `document`, so the
 * main-frame one is the document whose committed loader id binds to an
 * observed page (an iframe document carries its own loader id, never a
 * page's main-frame loader id). Without the CDP branch a debug-mode
 * (CDP-owned) tab's navigations are never seen, so the Preserve-log floor
 * never advances and the prior page's requests aren't cleared on navigation.
 */
function latestNavStartMs(lifecycles: readonly RequestLifecycle[], pages: readonly Page[]): number {
  const pageLoaderIds = new Set<string>();
  for (const page of pages) if (page.loaderId) pageLoaderIds.add(page.loaderId);
  let nav = -1;
  for (const lc of lifecycles) {
    if (isTopLevelNavigation(lc, pageLoaderIds) && lc.startedAtMs > nav) nav = lc.startedAtMs;
  }
  return nav;
}

function isTopLevelNavigation(lifecycle: RequestLifecycle, pageLoaderIds: ReadonlySet<string>): boolean {
  if (lifecycle.resourceType === 'main_frame') return true;
  return lifecycle.resourceType === 'document' && lifecycle.loaderId != null && pageLoaderIds.has(lifecycle.loaderId);
}

export function useNavClearFloor(
  lifecycles: readonly RequestLifecycle[],
  pages: readonly Page[],
  preserveLog: boolean,
): number {
  const [floorMs, setFloorMs] = useState(-1);
  // Read inside the lifecycle-driven effect via a ref so toggling Preserve
  // log does NOT itself move the floor — only an actual navigation does.
  const preserveRef = useRef(preserveLog);
  preserveRef.current = preserveLog;
  const seenNavRef = useRef(-1);

  // `pages` is a dep too: a CDP navigation's document is only recognizable
  // as top-level once its page lands (loader-id bind), which can trail the
  // lifecycle by a tick.
  useEffect(() => {
    const nav = latestNavStartMs(lifecycles, pages);
    if (nav <= seenNavRef.current) return; // no new top-level navigation
    seenNavRef.current = nav;
    // A navigation arriving while Preserve log is OFF clears the prior log;
    // while ON the floor stays put so the new page accumulates.
    if (!preserveRef.current) setFloorMs(nav);
  }, [lifecycles, pages]);

  return floorMs;
}
