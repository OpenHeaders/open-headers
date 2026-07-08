/**
 * Per-row connection status for the Back-end connections list.
 *
 * Interim derivation: the `sync` Status entry the SW broadcasts is the
 * WORST-OF aggregate across backends (`sync-status-aggregate.ts`), so a
 * row can only be attributed exactly while at most one backend is
 * enabled — true for every state reachable from today's UI. The real
 * per-backend feed (the aggregate's slots mirrored over a dedicated
 * broadcast, same idiom as `statusUpdated`) is designed and lands with
 * the Phase-4 surfaces work; this hook is its single swap point.
 */

import type { BackendConnection } from '@openheaders/core/types';
import { useStatus } from '../../../shared/hooks/useStatus';
import type { StatusEntry } from '../../../shared/status';

export type BackendRowStatus = 'connected' | 'connecting' | 'auth-required' | 'error' | 'off';

export function useBackendRowStatus(record: BackendConnection): BackendRowStatus {
  const { snapshot } = useStatus();
  return deriveRowStatus(record, snapshot.sync);
}

function deriveRowStatus(record: BackendConnection, sync: StatusEntry | undefined): BackendRowStatus {
  if (!record.enabled) return 'off';
  // No report yet, or the aggregate still shows the zero-slot resting
  // state — the wire for this record hasn't spoken.
  if (!sync || sync.message === 'Running in this browser') return 'connecting';
  if (sync.state === 'green') return 'connected';
  if (sync.state === 'red') {
    return sync.context?.reason === 'auth-required' ? 'auth-required' : 'error';
  }
  return 'connecting';
}
