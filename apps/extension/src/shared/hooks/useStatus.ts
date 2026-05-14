/**
 * useStatus — mirrors the SW's Status snapshot into the renderer.
 *
 * One bridge RPC at mount + one `statusUpdated` subscription. No
 * polling: the SW fires the broadcast on every `Status.report(...)`,
 * so UI surfaces (workspace footer, popup inline pill) stay in
 * lockstep automatically.
 */

import { call, subscribe } from '@utils/bridge';
import { useEffect, useMemo, useState } from 'react';
// Import directly from the submodule (not the `@/shared/status` barrel)
// to avoid a chunking cycle: StatusPill is exported from the barrel AND
// consumes this hook, so routing the hook through the barrel makes
// Rollup emit a circular-chunk warning and risks a broken execution
// order at runtime.
import { type StatusSnapshot, worstLevel } from '@/shared/status/types';

export interface UseStatusApi {
  snapshot: StatusSnapshot;
  /** Worst-level across every recorded subsystem. `'green'` when nothing is reported. */
  worst: ReturnType<typeof worstLevel>;
  isReady: boolean;
}

export function useStatus(): UseStatusApi {
  const [snapshot, setSnapshot] = useState<StatusSnapshot>({});
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void call('getStatusSnapshot')
      .catch(() => null)
      .then((resp) => {
        if (cancelled) return;
        if (resp?.snapshot) setSnapshot(resp.snapshot);
        setIsReady(true);
      });

    const unsub = subscribe('statusUpdated', (payload) => {
      setSnapshot(payload);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const worst = useMemo(() => worstLevel(snapshot), [snapshot]);

  return { snapshot, worst, isReady };
}
