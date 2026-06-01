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

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { useEffect, useRef, useState } from 'react';

/** Latest top-level (`main_frame`) navigation start, or -1 if none. */
function latestNavStartMs(lifecycles: readonly RequestLifecycle[]): number {
  let nav = -1;
  for (const lc of lifecycles) {
    if (lc.resourceType === 'main_frame' && lc.startedAtMs > nav) nav = lc.startedAtMs;
  }
  return nav;
}

export function useNavClearFloor(lifecycles: readonly RequestLifecycle[], preserveLog: boolean): number {
  const [floorMs, setFloorMs] = useState(-1);
  // Read inside the lifecycle-driven effect via a ref so toggling Preserve
  // log does NOT itself move the floor — only an actual navigation does.
  const preserveRef = useRef(preserveLog);
  preserveRef.current = preserveLog;
  const seenNavRef = useRef(-1);

  useEffect(() => {
    const nav = latestNavStartMs(lifecycles);
    if (nav <= seenNavRef.current) return; // no new top-level navigation
    seenNavRef.current = nav;
    // A navigation arriving while Preserve log is OFF clears the prior log;
    // while ON the floor stays put so the new page accumulates.
    if (!preserveRef.current) setFloorMs(nav);
  }, [lifecycles]);

  return floorMs;
}
