/**
 * Per-row connection status for the Back-end connections list, read
 * from the per-backend `sync` slot feed (`useBackendSyncStatus` — the
 * aggregate's slots mirrored over the `backendSyncStatusUpdated`
 * broadcast), so each row attributes state exactly even with several
 * backends enabled.
 */

import type { BackendConnection, BackendSyncStatus } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import { useBackendSyncStatus } from '../../../shared/hooks/useBackendSyncStatus';

export type BackendRowStatus = 'connected' | 'connecting' | 'auth-required' | 'error' | 'off';

/** The state word beside a row's place — one vocabulary for every row. */
export const BACKEND_ROW_STATUS_LABEL: Record<BackendRowStatus, MessageKey> = {
  connected: 'workbench.settings.backendPane.connections.status.connected',
  connecting: 'workbench.settings.backendPane.connections.status.connecting',
  'auth-required': 'workbench.settings.backendPane.connections.status.authRequired',
  error: 'workbench.settings.backendPane.connections.status.error',
  off: 'workbench.settings.backendPane.connections.status.off',
};

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
  return slotStatus(entry);
}

/** The state of one live slot — no slot yet means the wire hasn't spoken. */
export function slotStatus(entry: BackendSyncStatus | undefined): BackendRowStatus {
  if (!entry) return 'connecting';
  if (entry.state === 'green') return 'connected';
  if (entry.state === 'red') {
    return entry.context?.reason === 'auth-required' ? 'auth-required' : 'error';
  }
  return 'connecting';
}
