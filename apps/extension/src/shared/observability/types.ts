/**
 * Observability types — structured entries for the local-first ring buffer.
 *
 * Distinct from `utils/logger`: `logger` writes to the SW console only
 * (debug stream). Observability entries are the *exportable* record —
 * users attach them to bug reports, we never upload anything by default.
 * See ARCHITECTURE.md §26.
 */

export type LogLevel = 'info' | 'warn' | 'error';

/**
 * Fixed set of subsystems that can record entries. Adding a new
 * subsystem is a manifest-level change (the UI filter chips render
 * from this list; the Status footer in Phase 6 will key pills off it).
 */
export type LogSubsystem =
  | 'rule-engine'
  | 'request-executor'
  | 'workspace'
  | 'environment'
  | 'vault'
  | 'permissions'
  | 'extension'
  | 'scripts'
  | 'oauth';

export interface LogEntryContext {
  /** Rule uid when the event relates to a specific rule. */
  ruleId?: string;
  /** Workspace id when the event is workspace-scoped. */
  workspaceId?: string;
  /** Request uid when the event relates to a specific request. */
  requestId?: string;
  /** Error class name (e.g. `TypeError`, `AbortError`) — helps triage. */
  errorClass?: string;
  /** Error stack for `error`-level entries. Never sent off-device. */
  stack?: string;
  /** Extension version at record time. Filled by `recordLog`. */
  extensionVersion?: string;
  /** Tab id when the event is tab-scoped (workspace tab registry, etc.). */
  tabId?: number;
  /** Count of tracked entities (workspace tabs, etc.) at record time. */
  count?: number;
  /** Script kind (`pre-request` | `post-response`) when the event is scripts-scoped. */
  scriptKind?: 'pre-request' | 'post-response';
  /** Script execution id when the event is tied to a specific run. */
  executionId?: string;
  /** OAuth credential reference when the event is auth-scoped. */
  credentialRef?: string;
}

export interface LogEntry {
  /** `Date.now()` at record time. */
  timestamp: number;
  subsystem: LogSubsystem;
  /** Short op code — stable across entries of the same kind (e.g. `dnr-update`, `fetch`). */
  op: string;
  level: LogLevel;
  /** Human-readable summary. Not user-facing UI copy — triage text. */
  message: string;
  context: LogEntryContext;
}
