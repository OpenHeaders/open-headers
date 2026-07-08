/**
 * Observability bridge RPCs — the diagnostic log buffer and the
 * cross-subsystem status snapshot.
 */

import type { BackendSyncStatusSnapshot, LogEntry as ObservabilityLogEntry, StatusSnapshot } from '../../types';

export interface ObservabilityRpc {
  // ── Observability log ────────────────────────────────────────────
  getObservabilityLog: {
    req: Record<string, never>;
    res: { entries: ObservabilityLogEntry[] };
  };
  clearObservabilityLog: {
    req: Record<string, never>;
    res: { success: boolean };
  };

  // ── Status snapshot ──────────────────────────────────────────────
  getStatusSnapshot: {
    req: Record<string, never>;
    res: { snapshot: StatusSnapshot };
  };
  /** Mount-time read behind the `backendSyncStatusUpdated` broadcast. */
  getBackendSyncStatusSnapshot: {
    req: Record<string, never>;
    res: { snapshot: BackendSyncStatusSnapshot };
  };
}
