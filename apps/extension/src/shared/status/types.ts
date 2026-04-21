/**
 * Status types — the unified "what's the state of my world?" API.
 *
 * Every subsystem that can go wrong emits through `Status.report(...)`
 * (see `store.ts`). The footer renders one pill per subsystem; the
 * worst-state subsystem's colour bleeds into the popup/sidepanel's
 * inline indicator. See ARCHITECTURE.md §25.
 */

/** Which subsystem the entry is about. Closed set — one pill per value. */
export type StatusSubsystem =
  | 'sync' // desktop connection / team workspace sync
  | 'rules' // DNR compile + refresh state
  | 'requests' // executor telemetry
  | 'permissions' // host-permission grants for active rules
  | 'secrets' // vault / cipher state
  | 'live'; // Live Variable workflow refresh state

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

export type StatusListener = (snapshot: StatusSnapshot) => void;

// ── Render helpers ────────────────────────────────────────────────

/** Display label for each subsystem. Kept here so the pill render and
 *  the settings/log render stay in lockstep. */
export const SUBSYSTEM_LABELS: Record<StatusSubsystem, string> = {
  sync: 'Sync',
  rules: 'Rules',
  requests: 'Requests',
  permissions: 'Permissions',
  secrets: 'Secrets',
  live: 'Live',
};

/** Worst-state aggregator (red > yellow > green). Used for the compact
 *  inline pill shown in popup/sidepanel. */
export function worstLevel(snapshot: StatusSnapshot): StatusLevel {
  let worst: StatusLevel = 'green';
  for (const entry of Object.values(snapshot)) {
    if (!entry) continue;
    if (entry.state === 'red') return 'red';
    if (entry.state === 'yellow') worst = 'yellow';
  }
  return worst;
}
