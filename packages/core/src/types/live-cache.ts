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
}
