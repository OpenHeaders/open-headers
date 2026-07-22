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

  /**
   * Coarse CLI-provisioning state of the connected desktop, relayed
   * over the backend wire (`getCliStatusSummary` peer verb). State
   * only — no paths, token ids, or labels cross the wire. `null` =
   * unknown (no connected desktop, an older desktop without the verb,
   * or no answer inside the call window); surfaces fall back to the
   * pointer copy.
   */
  getCliWireStatus: {
    req: Record<string, never>;
    res: { state: 'unconfigured' | 'configured' | 'stale' | 'external' | 'malformed' | null };
  };
}
