/**
 * Per-row connection status for the Back-end connections list, read
 * from the per-backend `sync` slot feed (`useBackendSyncStatus` — the
 * aggregate's slots mirrored over the `backendSyncStatusUpdated`
 * broadcast), so each row attributes state exactly even with several
 * backends enabled.
 */

import type { BackendConnection, BackendSyncStatus } from '@openheaders/core/types';
import { useBackendSyncStatus } from '../../../shared/hooks/useBackendSyncStatus';

export type BackendRowStatus = 'connected' | 'connecting' | 'auth-required' | 'error' | 'off';

export interface BackendRowStatusApi {
  status: BackendRowStatus;
  /** The slot's live message (e.g. an Org-conflict notice) for the dot
   *  tooltip; null before the wire has spoken or while disabled. */
  detail: string | null;
}

export function useBackendRowStatus(record: BackendConnection): BackendRowStatusApi {
  const { snapshot } = useBackendSyncStatus();
  const entry = snapshot[record.id];
  return {
    status: deriveRowStatus(record, entry),
    detail: record.enabled ? (entry?.message ?? null) : null,
  };
}

function deriveRowStatus(record: BackendConnection, entry: BackendSyncStatus | undefined): BackendRowStatus {
  if (!record.enabled) return 'off';
  // No slot yet — the wire for this record hasn't spoken.
  if (!entry) return 'connecting';
  if (entry.state === 'green') return 'connected';
  if (entry.state === 'red') {
    return entry.context?.reason === 'auth-required' ? 'auth-required' : 'error';
  }
  return 'connecting';
}
