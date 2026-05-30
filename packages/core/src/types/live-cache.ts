/**
 * Live Variables workflow-run cache row.
 *
 * One row per (workflow × environment), persisted per workspace. The
 * runtime writers (chain runner, scheduler) live in the engine; UI
 * surfaces (live-vars page, observability log) consume the shape via
 * bridge RPC. The pure shape lives here as the single source of truth.
 */

import type { CircuitSnapshot } from '../live';

/**
 * How the *producing* host's last refresh of a live value fared, as a
 * closed three-value summary that rides §4 beside the value (WS-C C7):
 *
 *   - `ok` — the last refresh succeeded.
 *   - `source-failing` — the refresh failed at a non-credential step (the
 *     upstream data source is down / erroring).
 *   - `auth-failing` — the refresh failed at the credential/auth step (a
 *     401/403, or a failure on a step that consumes a TOTP code / is
 *     OAuth-authed) — the credential, not the data source, is the problem.
 *
 * Deliberately NOT the circuit / failure-count bookkeeping: a peer reads
 * *presence* from its connection probe and only consults this enum to
 * specialize the "exclusive credential can't refresh" banner copy into
 * "the backend's source is failing" vs "...auth is failing." Pinned to a
 * closed enum so it never widens into host-local circuit state.
 */
export type RefreshHealth = 'ok' | 'source-failing' | 'auth-failing';

/**
 * One workflow's last-extraction snapshot for one environment.
 * Intentionally NOT a valibot schema — the cache is ephemeral and
 * written exclusively by the SW, so the at-rest shape is defined by
 * this interface + the engine's tolerant read path.
 */
export interface WorkflowRunCache {
  workflowUid: string;
  /** Active env uid at extraction time; `null` for the "No environment" state. */
  environmentId: string | null;
  /** `stepId → captureName → extractedValue` across every step. */
  stepCaptures: Record<string, Record<string, string>>;
  /** Wall-clock ms when the last successful extraction completed. */
  extractedAt: number;
  /** Derived expiry (from refresh policy / `expires-in` / `expires-at`), or null if none. */
  expiresAt: number | null;
  /** Per-step response body byte count — observability only, never value bytes. */
  stepResponseBytes: Record<string, number>;
  /** Consecutive failed refreshes since the last success. Drives backoff. */
  consecutiveFailures: number;
  /** Wall-clock ms of the last failed refresh. */
  lastErrorAt?: number;
  /** Human-readable last-failure message (truncated to 200 chars). */
  lastErrorMessage?: string;
  /** Step id where the last failure halted — lets the UI pinpoint the broken hop. */
  lastErrorStepId?: string;
  /**
   * `false` when the most recent refresh succeeded at fetching every
   * step but failed during extraction (a capture's json-path / header /
   * regex didn't match). Preserves the cache because the RESPONSE was
   * real; the extractor config is what's wrong.
   */
  lastExtractorOk: boolean;
  /**
   * Circuit-breaker snapshot — persisted alongside cache state so the
   * state machine survives SW eviction. Source of truth for the
   * scheduler's attempt gate + the UI's "retry 2 of 3 in 5s" /
   * "paused · next attempt in 12m" signals.
   */
  circuit: CircuitSnapshot;
  /**
   * `true` when an input to this value's production recipe changed —
   * the embedded request's executable surface, the workflow definition,
   * or a variable it resolves — but the value has NOT been re-extracted
   * since. Distinct from time-staleness (`expiresAt`): a definitionally-
   * stale value is wrong-recipe, not merely old. Set on a *manual*-
   * trigger workflow's rows when a material edit lands (the workflow
   * must not auto-run), so the LV picker / inspector can badge "needs
   * re-run." A successful `putWorkflowRunCache` writes a row without
   * this flag, clearing it.
   */
  definitionallyStale?: boolean;
  /**
   * Wall-clock ms when this row's value last arrived from a *remote*
   * paired peer over §4 — the cadence-ownership marker (WS-C C8). Set by
   * the receive-side merge when a genuinely-different remote value lands
   * (the producer's own echo is an identical no-op and never stamps it);
   * cleared when *this* host produces the value itself
   * (`putWorkflowRunCache`). Its presence means "the value here is
   * remote-sourced," which a connected peer reads to defer its own
   * cadence to the backend (the peer arms only a near-expiry safety
   * fire instead of the normal lead-time refresh). Host-local runner
   * bookkeeping — never enters {@link LiveValueRecord}, never syncs.
   */
  lastSyncedValueAt?: number;
  /**
   * Wall-clock ms when a connected peer declined to self-refresh this
   * row's *exclusive* credential at the near-expiry escape hatch
   * (WS-C C9). Set when the backend that was producing this remote-sourced
   * value went silent near expiry AND the workflow is `exclusive` (a
   * self-refresh would burn a single-use TOTP code / trip OAuth
   * reuse-detection) — so the peer degrades rather than races. The `live`
   * Status pill reads it to surface "reconnect the desktop app to refresh
   * X" instead of a generic stale-yellow. Cleared the moment a fresh
   * remote value lands (`applySyncedLiveValues`) or this host produces the
   * value itself (`putWorkflowRunCache`). Like {@link lastSyncedValueAt},
   * host-local runner bookkeeping — never enters {@link LiveValueRecord}.
   */
  exclusiveDegradedSince?: number;
  /**
   * The producing host's last-refresh health for this row (WS-C C7).
   * Unlike the host-local bookkeeping above, this is part of the synced
   * value subset — it rides §4 in {@link LiveValueRecord} so a deferring
   * peer can specialize its degraded banner ("the backend's source is
   * failing" vs "...auth is failing"). The producer sets `'ok'` on a
   * successful {@link putWorkflowRunCache} and the classified failure
   * category on `recordRefreshError`; the receive-side merge mirrors it.
   * Absent ⇒ treated as `'ok'` (no specialization).
   */
  refreshHealth?: RefreshHealth;
}

/**
 * The cross-host-synced projection of a {@link WorkflowRunCache} row —
 * the *value* subset that rides §4 to paired peers (WS-C C6) plus the
 * tiny `refreshHealth` enum (WS-C C7). The derived value + that one
 * health byte cross the wire; every other `WorkflowRunCache` field
 * (`circuit`, `consecutiveFailures`, `lastError*`, `lastExtractorOk`,
 * `stepResponseBytes`, `definitionallyStale`, `lastSyncedValueAt`,
 * `exclusiveDegradedSince`) is per-host *runner* bookkeeping that each
 * host derives for itself and
 * never syncs.
 *
 * `workflowUid` + `environmentId` are carried explicitly (not only in
 * the set itemId / run-key) so the receiving host can re-key into its
 * own cache without parsing the composite key.
 *
 * Flagged sensitive at rest + in the snapshot transport: a resolved
 * capture set can hold an access token (a derived secret).
 */
export interface LiveValueRecord {
  workflowUid: string;
  /** Active env uid at extraction time; `null` for the "No environment" state. */
  environmentId: string | null;
  /** `stepId → captureName → extractedValue` across every step. */
  stepCaptures: Record<string, Record<string, string>>;
  /** Wall-clock ms when the last successful extraction completed. */
  extractedAt: number;
  /** Derived expiry (from refresh policy / `expires-in` / `expires-at`), or null if none. */
  expiresAt: number | null;
  /**
   * The producing host's last-refresh health (WS-C C7) — the only
   * non-value field in the synced subset. Lets a deferring peer say *why*
   * an exclusive credential isn't refreshing (source vs auth) instead of a
   * backend-agnostic "reconnect." Absent ⇒ `'ok'`. NOT the circuit / error
   * bookkeeping, which stays host-local (see {@link RefreshHealth}).
   */
  refreshHealth?: RefreshHealth;
}
