/**
 * `live` Status pill aggregation — recomputed after every tick and on
 * every live store mutation (wired through the provider's combined
 * store listener).
 */

import { listWorkflowRunCaches, type WorkflowRunCache } from '@openheaders/oracle/live/live-cache-store';
import { report as reportStatus } from '@openheaders/ui/shared/status';

// ── Status reporting ─────────────────────────────────────────────
//
// Active-workspace-only aggregation drives the `live` Status pill per
// the plan (§Observability → Status pill color rules):
//
//   green  — no cached runs with failures + no stale-beyond-2×-cadence
//            + lastExtractorOk on every run that has run at least once
//   yellow — any stale beyond 2× cadence OR lastExtractorOk=false OR
//            consecutiveFailures in 1..4
//   red    — any consecutiveFailures >= 5
//
// Inactive workspaces are deliberately excluded — the user can't see
// or act on those rules, so reporting on them yellow-pills the footer
// for state the user can't reach. When the user switches workspaces,
// the pill recomputes against the new active workspace.
//
// Values never appear in Status messages — only counts + the "first
// failing workflow" for a hint. Host-permission red (from §12) routes
// through the existing `permissions` pill; surfacing permissions state
// on the live pill would double-report and confuse the triage story.

const RED_FAILURE_THRESHOLD = 5;

export async function recomputeLiveStatus(): Promise<void> {
  let runs: WorkflowRunCache[];
  try {
    // Active workspace only — `listWorkflowRunCaches()` with no arg
    // defaults to the active workspace's cache row set.
    runs = await listWorkflowRunCaches();
  } catch {
    // Storage read failure — leave the pill alone rather than flipping
    // to a misleading red. The scheduler still fires alarms; a real
    // failure surfaces on the next refresh dispatch.
    return;
  }
  if (runs.length === 0) {
    reportStatus({
      subsystem: 'live',
      state: 'green',
      message: 'No workflows configured',
    });
    return;
  }
  let red = 0;
  let yellow = 0;
  let degraded = 0;
  let firstRed: string | undefined;
  let firstYellow: string | undefined;
  let firstDegraded: string | undefined;
  // The distinct backend-reported health categories across the degraded
  // rows (WS-C C7). When they agree we specialize the banner from a
  // backend-agnostic "reconnect" into "the backend's source/auth is
  // failing"; mixed or unknown falls back to the generic copy.
  const degradedHealths = new Set<string>();
  const now = Date.now();
  for (const run of runs) {
    if (run.consecutiveFailures >= RED_FAILURE_THRESHOLD) {
      red++;
      firstRed ??= run.workflowUid;
      continue;
    }
    // C9: a connected peer declined to refresh this exclusive credential
    // because its backend went silent. Surface the actionable "reconnect"
    // message ahead of the generic stale-yellow — the value will expire,
    // but a self-refresh would burn the cred, so the user must bring the
    // backend back rather than wait for this host to recover it.
    if (run.exclusiveDegradedSince != null) {
      degraded++;
      firstDegraded ??= run.workflowUid;
      degradedHealths.add(run.refreshHealth ?? 'unknown');
      continue;
    }
    if (run.consecutiveFailures > 0 || !run.lastExtractorOk) {
      yellow++;
      firstYellow ??= run.workflowUid;
      continue;
    }
    if (run.expiresAt != null && run.extractedAt > 0) {
      const window = run.expiresAt - run.extractedAt;
      if (window > 0 && now - run.extractedAt > 2 * window) {
        yellow++;
        firstYellow ??= run.workflowUid;
      }
    }
  }
  if (red > 0) {
    reportStatus({
      subsystem: 'live',
      state: 'red',
      message: `${red} workflow${red === 1 ? '' : 's'} failing (${RED_FAILURE_THRESHOLD}+ consecutive)`,
      context: { red, yellow, firstRed },
    });
    return;
  }
  if (degraded > 0) {
    const creds = `${degraded} exclusive credential${degraded === 1 ? '' : 's'} can't refresh`;
    // Specialize only when every degraded row agrees on the cause; the
    // backend is known-present here (the C9 degrade is set under a live
    // connection probe), so the enum just names *why* it isn't producing.
    const only = degradedHealths.size === 1 ? [...degradedHealths][0] : undefined;
    const message =
      only === 'auth-failing'
        ? `${creds} — the desktop app's authentication is failing`
        : only === 'source-failing'
          ? `${creds} — the desktop app's source is failing`
          : `${creds} — reconnect the desktop app`;
    reportStatus({
      subsystem: 'live',
      state: 'yellow',
      message,
      context: { degraded, firstDegraded },
    });
    return;
  }
  if (yellow > 0) {
    reportStatus({
      subsystem: 'live',
      state: 'yellow',
      message: `${yellow} workflow${yellow === 1 ? '' : 's'} stale or failing`,
      context: { yellow, firstYellow },
    });
    return;
  }
  reportStatus({
    subsystem: 'live',
    state: 'green',
    message: `${runs.length} workflow${runs.length === 1 ? '' : 's'} fresh`,
    context: { fresh: runs.length },
  });
}
