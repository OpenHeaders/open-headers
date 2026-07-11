import { initialCircuitSnapshot } from '@openheaders/core/live';
import type { LiveValueRecord, WorkflowRunCache } from '@openheaders/core/types';
import { type LiveCacheBlob, readBlob, withCacheLock, writeBlob } from './blob';
import { notifyChange } from './listeners';

// ── §4 value propagation hooks (WS-C C6) ────────────────────────────

/**
 * The value subset of one cache row, projected for §4 propagation.
 * Carries only what crosses the wire — `circuit` / failure counters /
 * response bytes / definitional-staleness are host-local bookkeeping
 * and never travel.
 */
export type LiveValuePropagator = (input: { runKey: string; value: LiveValueRecord }, workspaceId: string) => void;
export type LiveValueRemover = (runKeys: readonly string[], workspaceId: string) => void;

export let propagator: LiveValuePropagator | null = null;
export let remover: LiveValueRemover | null = null;

/**
 * Register the §4 value-propagation sink. Wired once at boot by
 * `live-value-store.ts` (the sync-engine bridge). Until then — and on
 * hosts that never connect a backend — the cache is a pure host-local
 * store and these are no-ops. Inverting the dependency this way keeps
 * `live-cache-store` free of any `@openheaders/oracle/sync` import cycle:
 * the sync side reaches IN, the cache never reaches OUT.
 */
export function setLiveValuePropagator(fn: LiveValuePropagator | null): void {
  propagator = fn;
}

export function setLiveValueRemover(fn: LiveValueRemover | null): void {
  remover = fn;
}

/**
 * Overlay a synced value subset onto the host-local cache blob — the
 * receive side of §4 value propagation. For each run-key the value
 * fields (`stepCaptures` / `extractedAt` / `expiresAt`) are merged onto
 * the existing row, **preserving that host's own runner bookkeeping**
 * (circuit / failures / response bytes / definitional-staleness); a
 * run-key with no existing row is created with default bookkeeping. Rows
 * absent from `values` are left untouched — deletion is the
 * delete-cascade's job, not this additive merge.
 *
 * Each merged row is stamped `lastSyncedValueAt` (the WS-C C8 cadence-
 * ownership marker) so a connected peer knows the value is remote-sourced
 * and can defer its own cadence to the backend.
 *
 * No-ops (no write, no notify) when nothing actually changed, which is
 * what makes the producer's own apply-echo cheap: the value it just
 * wrote via {@link putWorkflowRunCache} is already identical here.
 */
export async function applySyncedLiveValues(
  workspaceId: string,
  values: Record<string, LiveValueRecord>,
): Promise<void> {
  let changed = false;
  let postWriteRuns: WorkflowRunCache[] = [];
  await withCacheLock(workspaceId, async () => {
    const current = await readBlob(workspaceId);
    const nextRuns: Record<string, WorkflowRunCache> = { ...current.runs };
    // Wall-clock of this merge — stamped onto every row a genuinely-
    // different remote value lands on, as the WS-C C8 cadence-ownership
    // marker. The producer's own echo hits the `continue` skip below, so
    // a host never marks its own production remote-sourced.
    const mergedAt = Date.now();
    for (const [key, value] of Object.entries(values)) {
      const previous = current.runs[key];
      const valueChanged =
        !previous ||
        previous.extractedAt !== value.extractedAt ||
        previous.expiresAt !== value.expiresAt ||
        !sameCaptures(previous.stepCaptures, value.stepCaptures);
      const incomingHealth = value.refreshHealth ?? 'ok';
      const healthChanged = !previous || (previous.refreshHealth ?? 'ok') !== incomingHealth;
      if (!valueChanged && !healthChanged) {
        continue; // identical value + health — skip (producer echo / re-seed)
      }
      changed = true;
      if (!valueChanged && previous) {
        // Health-only update (WS-C C7): a failure preserved the captures,
        // so only the backend's reported health moved. Do NOT bump
        // `lastSyncedValueAt` (no fresh value arrived) and do NOT clear
        // `exclusiveDegradedSince` (the backend is failing, not recovered)
        // — those belong to a genuine value refresh below.
        nextRuns[key] = { ...previous, refreshHealth: value.refreshHealth };
        continue;
      }
      // A deferring consumer never produces locally, so its only way to
      // clear a definitionally-stale flag is a synced value that provably
      // post-dates the recipe change (audit C-1): the value's `extractedAt`
      // must be at/after the moment the flag was stamped. A value minted
      // *before* the edit reached the producer must NOT clear it.
      const clearsDefinitionallyStale =
        previous?.definitionallyStale === true &&
        previous.definitionallyStaleSince != null &&
        value.extractedAt >= previous.definitionallyStaleSince;
      nextRuns[key] = previous
        ? {
            ...previous,
            stepCaptures: value.stepCaptures,
            // A remote run replaced the captures; this host's per-step
            // attestation described its OWN last run and no longer
            // matches — drop it rather than mislabel remote values.
            stepOutcomes: undefined,
            extractedAt: value.extractedAt,
            expiresAt: value.expiresAt,
            refreshHealth: value.refreshHealth,
            lastSyncedValueAt: mergedAt,
            // A fresh remote value is the backend coming back to life —
            // clear any C9 exclusive-degraded mark so the pill drops out
            // of "reconnect the desktop" the instant the value lands.
            exclusiveDegradedSince: undefined,
            ...(clearsDefinitionallyStale
              ? { definitionallyStale: undefined, definitionallyStaleSince: undefined }
              : {}),
          }
        : {
            workflowUid: value.workflowUid,
            environmentId: value.environmentId,
            stepCaptures: value.stepCaptures,
            stepResponseBytes: {},
            extractedAt: value.extractedAt,
            expiresAt: value.expiresAt,
            refreshHealth: value.refreshHealth,
            consecutiveFailures: 0,
            lastExtractorOk: true,
            circuit: initialCircuitSnapshot(),
            lastSyncedValueAt: mergedAt,
          };
    }
    if (!changed) return;
    const next: LiveCacheBlob = {
      schemaVersion: current.schemaVersion,
      version: current.version + 1,
      runs: nextRuns,
    };
    await writeBlob(workspaceId, next);
    postWriteRuns = Object.values(next.runs);
  });
  if (changed) notifyChange(workspaceId, null, postWriteRuns);
}

function sameCaptures(a: Record<string, Record<string, string>>, b: Record<string, Record<string, string>>): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  for (const stepId of aKeys) {
    const aStep = a[stepId];
    const bStep = b[stepId];
    if (!bStep) return false;
    const aCapKeys = Object.keys(aStep);
    if (aCapKeys.length !== Object.keys(bStep).length) return false;
    for (const cap of aCapKeys) {
      if (aStep[cap] !== bStep[cap]) return false;
    }
  }
  return true;
}
