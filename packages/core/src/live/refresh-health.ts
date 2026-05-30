/**
 * Refresh-health classification for Live Workflows (WS-C C7).
 *
 * Maps a chain-run failure to the closed {@link RefreshHealth} enum that
 * rides §4 beside the value, so a deferring peer can tell *why* an
 * exclusive credential isn't refreshing — the backend's data source vs its
 * auth — instead of a backend-agnostic "reconnect."
 *
 * Two signals, status-code first:
 *   1. The failed step's HTTP status is a 401/403 → `auth-failing` (the
 *      strongest, cheapest signal; an auth rejection regardless of which
 *      step it landed on). A status is recorded only for steps that
 *      reached the response phase, so this catches the common
 *      "extractor ran against a 401 body" case.
 *   2. Else the failed step is a credential/auth step (consumes a TOTP
 *      code, or is OAuth-authed — `credentialStepIds` from
 *      {@link deriveExecutionPolicy}) → `auth-failing`. Covers a credential
 *      step that failed at fetch (no status, e.g. the token endpoint was
 *      unreachable) or at extraction.
 *   3. Else → `source-failing`.
 *
 * Pure — the host derives `credentialStepIds` from its stores and passes
 * the failure outcome in. Success is never classified here; the producer
 * stamps `'ok'` directly on a successful run.
 */

import type { RefreshHealth } from '../types/live-cache';
import type { ChainRunFailure } from './chain-runner';

/** HTTP statuses that unambiguously signal an auth failure. */
const AUTH_REJECTION_STATUSES: ReadonlySet<number> = new Set([401, 403]);

export function classifyRefreshHealth(
  outcome: ChainRunFailure,
  credentialStepIds: ReadonlySet<string>,
): Exclude<RefreshHealth, 'ok'> {
  const status = outcome.partialStepStatuses.get(outcome.failedStepId);
  if (status !== undefined && AUTH_REJECTION_STATUSES.has(status)) return 'auth-failing';
  if (credentialStepIds.has(outcome.failedStepId)) return 'auth-failing';
  return 'source-failing';
}
