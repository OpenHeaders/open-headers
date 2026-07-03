/**
 * Result building — projects an `ActiveRun`'s captured telemetry into
 * the persisted `TestRun` shape (per-rule statuses, fire log, the
 * session-end static-arbitration pass for no-fire attribution), plus
 * the empty/rejected result variants.
 */

import { computeOwnerHash } from '@openheaders/oracle/test-run/test-run-store';
import { deriveObservedUrls } from '../../tab-telemetry-source/observed-urls';
import { matchRulesToRequest } from '../request-tracker';
import { arbitrate, type ShadowAttribution } from '../rules/shadow-arbitration';
import { getTabSnapshotForScope } from '../tab-telemetry';
import { type ActiveRun, newRunId, type TestFireEvent, type TestRuleStatus, type TestRun } from './run-registry';
import type { StartRunOptions } from './start';
import { lifecycleStoreRef } from './widget-ports';

export function buildRun(run: ActiveRun): TestRun {
  const snapshotFires = run.tabId != null ? getTabSnapshotForScope(run.tabId, run.ruleUids).fires : [];
  // RequestRecord has extra fields (pattern, resourceType) that TestFireEvent
  // doesn't care about; project to the stable run-result shape. Carry
  // `shadowedBy` through so the workspace can render shadowed rules with
  // their amber outcome instead of an unqualified "executed" badge.
  const fires: TestFireEvent[] = snapshotFires.map((r) => ({
    ruleUid: r.ruleUid,
    url: r.url,
    evidence: r.evidence,
    t: r.t,
    ...(r.shadowedBy ? { shadowedBy: r.shadowedBy } : {}),
  }));
  const firedUids = new Set(fires.map((f) => f.ruleUid));
  const ruleStatuses: Record<string, TestRuleStatus> = {};
  for (const uid of run.ruleUids) {
    if (run.skippedUids.has(uid)) {
      ruleStatuses[uid] = 'skipped';
    } else if (firedUids.has(uid)) {
      ruleStatuses[uid] = 'executed';
    } else {
      ruleStatuses[uid] = 'no-fire';
    }
  }

  // Static arbitration pass over the full observed-URL set. For every
  // no-fire rule in scope, check whether any URL the tab hit during the
  // run would have put it into a matching set where a sibling rule
  // (block / redirect / query-param / response / delay) shadowed it. The
  // first matching URL's attribution wins — we're only trying to give
  // the user a reason, not enumerate every conflict.
  //
  // This catches the case where a fire record was lost because commit
  // attribution abandoned it — e.g. inject on *.openheaders.io/v1/page
  // matches at onBeforeRequest time, gets `shadowedBy: delay` from the
  // per-hop arbitrator, is buffered in pendingFires, and then dropped
  // when the main frame commits to delay.html instead of the user URL.
  // Without this pass the rule surfaces as no-fire with no attribution.
  const noFireReasons: Record<string, ShadowAttribution> = {};
  if (run.tabId != null && lifecycleStoreRef !== null) {
    const observedUrls = deriveObservedUrls(lifecycleStoreRef.snapshotTab(run.tabId));
    if (observedUrls.size > 0) {
      for (const uid of run.ruleUids) {
        if (ruleStatuses[uid] !== 'no-fire') continue;
        for (const url of observedUrls) {
          const arbitrated = arbitrate(matchRulesToRequest(url));
          const self = arbitrated.find((r) => r.uid === uid);
          if (self?.shadowedBy) {
            noFireReasons[uid] = self.shadowedBy;
            break;
          }
        }
      }
    }
  }

  return {
    id: run.id,
    ownerType: run.owner.type,
    ownerId: run.owner.id,
    ownerNameAtRun: run.scopeLabel,
    ruleUids: [...run.ruleUids],
    url: run.url,
    startedAt: run.startedAt,
    endedAt: Date.now(),
    waitSeconds: run.waitSeconds,
    fires,
    ruleStatuses,
    ...(Object.keys(noFireReasons).length > 0 ? { noFireReasons } : {}),
    ownerHashAtRun: computeOwnerHash(run.owner) ?? '',
  };
}

export function buildEmptyRun(run: ActiveRun): TestRun {
  const ruleStatuses: Record<string, TestRuleStatus> = {};
  for (const uid of run.ruleUids) {
    ruleStatuses[uid] = run.skippedUids.has(uid) ? 'skipped' : 'no-fire';
  }
  return {
    id: run.id,
    ownerType: run.owner.type,
    ownerId: run.owner.id,
    ownerNameAtRun: run.scopeLabel,
    ruleUids: [...run.ruleUids],
    url: run.url,
    startedAt: run.startedAt,
    endedAt: Date.now(),
    waitSeconds: run.waitSeconds,
    fires: [],
    ruleStatuses,
    ownerHashAtRun: computeOwnerHash(run.owner) ?? '',
  };
}

/**
 * Build a synthetic empty result for a run that was rejected at the
 * gate (currently only: invalid URL). No tab is opened, no telemetry is
 * captured, no DNR isolation is installed — we just want a well-formed
 * result so the caller's promise resolves cleanly. All scope rules are
 * marked `no-fire` (or `skipped` if disabled / incomplete from the
 * outset). The reason text is logged but not surfaced through the result
 * shape; surfacing it would require a new field on `TestRun`,
 * and the popup launcher already shows the same text via its own
 * synchronous `parseTestTargetUrl` call before sending the message.
 */
export function buildRejectedRun(opts: StartRunOptions, _reason: string): TestRun {
  const ruleStatuses: Record<string, TestRuleStatus> = {};
  for (const uid of opts.ruleUids) {
    ruleStatuses[uid] = 'no-fire';
  }
  const now = Date.now();
  return {
    id: newRunId(),
    ownerType: opts.owner.type,
    ownerId: opts.owner.id,
    ownerNameAtRun: opts.scopeLabel,
    ruleUids: [...opts.ruleUids],
    url: opts.url,
    startedAt: now,
    endedAt: now,
    waitSeconds: Math.max(1, Math.min(opts.waitSeconds, 300)),
    fires: [],
    ruleStatuses,
    ownerHashAtRun: computeOwnerHash(opts.owner) ?? '',
  };
}
