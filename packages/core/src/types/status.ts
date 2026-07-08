/**
 * Status types — the unified "what's the state of my world?" domain
 * model.
 *
 * Every subsystem that can go wrong reports an entry; UI surfaces render
 * one pill per subsystem and let the worst-state subsystem drive a
 * compact inline indicator. These are the pure data shapes — they cross
 * the host bridge as the `getStatusSnapshot` / `statusUpdated` payload.
 * Render labels + aggregation helpers live with the UI that consumes
 * them.
 */

/** Which subsystem the entry is about. Closed set — one pill per value. */
export type StatusSubsystem =
  | 'sync' // desktop connection / team workspace sync
  | 'rules' // DNR compile + refresh state
  | 'requests' // executor telemetry
  | 'permissions' // host-permission grants for active rules
  | 'secrets' // vault / cipher state
  | 'live' // Live Variable workflow refresh state
  | 'activity' // workspace-wide Activity Feed pulse + unread count
  | 'cdp'; // opt-in CDP request-inspection attach state

/** Traffic-light state. Worst-state subsystem drives the compact pill. */
export type StatusLevel = 'green' | 'yellow' | 'red';

/**
 * Entry shape. The store keeps the most recent entry per subsystem —
 * Status is a snapshot ("what's going on right now"), not a history.
 * Detailed history lives in the observability log.
 */
export interface StatusEntry {
  subsystem: StatusSubsystem;
  state: StatusLevel;
  message: string;
  /** Optional extra context — rule id, error class, host, etc. Rendered under the pill. */
  context?: Record<string, unknown>;
  /** `Date.now()` at report time. */
  timestamp: number;
}

/** Snapshot of every subsystem. Absent subsystems render as the default 'green · no data yet'. */
export type StatusSnapshot = Partial<Record<StatusSubsystem, StatusEntry>>;

/**
 * One backend's contribution to the `sync` subsystem — the slot the
 * per-connection reporters write before the aggregate rolls worst-of
 * into {@link StatusSnapshot}. Crosses the bridge per backend so the
 * connections-list row dots can attribute state exactly, which the
 * worst-of aggregate can't once two backends are enabled.
 */
export interface BackendSyncStatus {
  state: StatusLevel;
  message: string;
  context?: Record<string, unknown>;
}

/** Per-backend `sync` slots, keyed by `OH.backends` record id. A
 *  torn-down backend's slot is absent, not stale. */
export type BackendSyncStatusSnapshot = Record<string, BackendSyncStatus>;
