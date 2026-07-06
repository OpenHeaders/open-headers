/**
 * Fire evidence — wire-header corroboration of claimed rule modifications.
 *
 * A fire's `ruleSnapshot` records what the rule CLAIMED to do (the mods
 * compiled into the engine at fire time). This module checks each claim
 * against the header sets the capture plane actually recorded, producing
 * one verdict per mod and an aggregate per fire:
 *
 *   - `corroborated` — the claimed modification is visible in a header
 *     set captured after the engine's rewrite. Ground truth that the
 *     action applied, available on any install type (unlike the
 *     engine-feedback path, which only unpacked installs receive).
 *   - `contradicted` — a post-rewrite set disproves the claim: the
 *     header is missing, carries a different value, or survived a
 *     remove. The rule fired on paper but the capture says otherwise —
 *     a truth signal the browser's own panel cannot show.
 *   - `unobservable` — no post-rewrite set exists for the direction
 *     (the capture is `raw`, pre-rewrite — absence of the mod there is
 *     expected and proves nothing), the claim never resolved, or the
 *     operation is invisible to every capture (an in-page response
 *     merge). Never guessed: classified, not inferred.
 *
 * What is observable depends on where each header set was captured
 * relative to the rewrite — the `_ohHeaderCapture` stamp each HAR
 * producer writes (see `InspectorHarHeaderCapture`):
 *
 *   capture                       | request side | response side
 *   ------------------------------|--------------|---------------
 *   devtools HAR, wire-crossing   | effective    | raw
 *   devtools HAR, cache read      | raw          | effective
 *   webRequest partial HAR        | effective¹   | raw
 *   CDP HAR, ExtraInfo landed     | effective    | raw
 *   CDP HAR, cooked sets only     | raw          | raw
 *   CDP HAR, disk-cache hit       | raw          | effective
 *
 *   ¹ `onSendHeaders` reports the post-rewrite request set (wire-proven
 *     per operation — override, add, remove, merge); raw only on a hop
 *     where the event never fired and no set is held.
 *
 * The probe ground-truthed the model: a HAR records THE WIRE when the
 * request crossed it — the request set post-rewrite (the engine rewrites
 * before send), the response set PRE-rewrite (the engine rewrites after
 * receipt; the wire set held the server's original header while the page
 * received the DNR-rewritten value). A cache read never crossed the wire,
 * so the HAR records the renderer's view instead: the cooked pre-wire
 * request set (raw) and the served response set with the rewrite
 * re-applied (effective).
 *
 * Which producer's entry a row holds is itself provenance-bound: the
 * host's devtools entry exists only once the request FINISHES in devtools
 * terms (loadingFinished), and for a fetch that requires the page to
 * consume the response body. A fetch whose body is never read produces no
 * devtools entry — ever (probe-proven: consumption is the gate, and the
 * entry stays absent through GC). Such rows keep the webRequest partial
 * (effective request / raw response) permanently; that fallback is the
 * row's correct, final state, not a missed join. Producers declare
 * themselves via `_ohEntrySource`.
 *
 * The CDP path additionally carries the current hop's request headers
 * first-class on the lifecycle before any HAR lands; those are effective
 * exactly when `requestHeadersProvisional` is false (the on-the-wire set
 * superseded the cooked one).
 *
 * Same posture as `row-annotations.ts`: one pure derivation at consume
 * time from the lifecycle + the frozen snapshot — never cached onto
 * either, no live-rule reads (live drift stays in `findCurrentMod` /
 * `isAttributionEdited`).
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { RuleSnapshotHeaderMod } from '@openheaders/core/types';
import { currentHarEntry } from './inspector-row-projection';
import { type InspectorFire, isAppliedFire } from './types';

export type ModEvidenceVerdict = 'corroborated' | 'contradicted' | 'unobservable';

export type ModEvidenceReason =
  /** The claimed value is present in the post-rewrite header set. */
  | 'value-on-wire'
  /** The merged value (base + separator + claim, or the claim alone) is present. */
  | 'merge-on-wire'
  /** The header name is present post-rewrite but no entry carries the claim. */
  | 'value-mismatch'
  /** The claimed injection is missing from the post-rewrite set. */
  | 'absent-from-wire'
  /** A header the rule claimed to remove is still present post-rewrite. */
  | 'present-despite-remove'
  /** The removed name is absent — weak evidence (the sender may simply
   *  never have produced it), so a remove is falsifiable-only. */
  | 'absent-after-remove'
  /** The held set was captured before the rewrite — absence is expected. */
  | 'raw-capture'
  /** No header set is held for the direction at all. */
  | 'no-capture'
  /** The snapshot carries no resolved value/name to check against. */
  | 'unresolved-claim'
  /** The operation rewrites only the page's view (an in-page response
   *  merge) — no capture plane ever sees it. */
  | 'invisible-to-capture';

export interface ModEvidence {
  readonly mod: RuleSnapshotHeaderMod;
  readonly verdict: ModEvidenceVerdict;
  readonly reason: ModEvidenceReason;
  /** Post-rewrite value(s) observed under the claimed name, when the set
   *  was checked and the name was present. */
  readonly observed?: readonly string[];
}

export interface FireEvidence {
  /** Aggregate: any contradicted mod ⇒ `contradicted`; else any
   *  corroborated ⇒ `corroborated`; else `unobservable`. */
  readonly verdict: ModEvidenceVerdict;
  readonly mods: readonly ModEvidence[];
}

/** Display tier of the fire-rail dot — `contradicted` outranks `applied`
 *  (a disproven claim must not celebrate), `applied` outranks `inferred`. */
export type FireDotTier = 'applied' | 'contradicted' | 'inferred';

export interface CapturedHeaderSet {
  readonly headers: ReadonlyArray<{ name: string; value: string }>;
  readonly capture: 'effective' | 'raw';
}

/**
 * The header set held for one direction of the lifecycle's current hop,
 * with its capture point. HAR first (it carries the producer's stamp);
 * for the request side the lifecycle's first-class headers stand in
 * before a HAR lands — effective exactly when the on-the-wire set has
 * superseded the cooked one. `null` when nothing is held.
 *
 * Exported for the parity debug hook: a capture artifact that reports
 * stamps and observed wire values must read them through the same
 * derivation the verdicts use, or the two could drift.
 */
export function capturedHeaderSet(
  lifecycle: RequestLifecycle,
  direction: 'request' | 'response',
): CapturedHeaderSet | null {
  const har = currentHarEntry(lifecycle);
  if (direction === 'request') {
    const harHeaders = har?.request?.headers;
    if (harHeaders !== undefined) {
      return { headers: harHeaders, capture: har?._ohHeaderCapture?.request ?? 'raw' };
    }
    if (lifecycle.requestHeaders !== undefined) {
      return {
        headers: lifecycle.requestHeaders,
        capture: lifecycle.requestHeadersProvisional === false ? 'effective' : 'raw',
      };
    }
    return null;
  }
  const harHeaders = har?.response?.headers;
  if (harHeaders === undefined) return null;
  return { headers: harHeaders, capture: har?._ohHeaderCapture?.response ?? 'raw' };
}

/** Default merge separator, mirroring the engine's compile-time default. */
function mergeSeparatorFor(mod: RuleSnapshotHeaderMod): string {
  if (mod.mergeSeparator !== undefined) return mod.mergeSeparator;
  const key = mod.headerName.toLowerCase();
  return key === 'cookie' || key === 'set-cookie' ? '; ' : ', ';
}

/** Values observed under the claimed name (case-insensitive, RFC 9110 §5.1). */
function observedValues(set: CapturedHeaderSet, name: string): string[] {
  const lower = name.toLowerCase();
  const out: string[] = [];
  for (const h of set.headers) {
    if (h.name.toLowerCase() === lower) out.push(h.value);
  }
  return out;
}

/** Whether an observed value carries the claim — exactly, or as one
 *  segment of a comma-combined list header (the transport may fold
 *  repeated headers into one line). Shared with `attributeHeaders`'
 *  corroborated-row marking so judging and marking can never diverge. */
export function valueCarriesClaim(observed: string, claim: string): boolean {
  if (observed === claim) return true;
  if (claim === '') return false;
  return observed.split(',').some((segment) => segment.trim() === claim);
}

function judge(
  mod: RuleSnapshotHeaderMod,
  verdict: ModEvidenceVerdict,
  reason: ModEvidenceReason,
  observed?: readonly string[],
): ModEvidence {
  return { mod, verdict, reason, ...(observed !== undefined && observed.length > 0 ? { observed } : {}) };
}

/** Verdict for one claimed modification against the held header sets. */
export function deriveModEvidence(lifecycle: RequestLifecycle, mod: RuleSnapshotHeaderMod): ModEvidence {
  // An in-page response merge rewrites only what the page sees — no
  // capture plane (HAR, ExtraInfo, webRequest) ever records it.
  if (mod.operation === 'merge' && mod.direction === 'response') {
    return judge(mod, 'unobservable', 'invisible-to-capture');
  }
  // A claim whose name never resolved cannot be checked.
  if (mod.headerName.includes('{{')) return judge(mod, 'unobservable', 'unresolved-claim');

  const set = capturedHeaderSet(lifecycle, mod.direction);
  if (set === null) return judge(mod, 'unobservable', 'no-capture');
  if (set.capture !== 'effective') return judge(mod, 'unobservable', 'raw-capture');

  const observed = observedValues(set, mod.headerName);

  if (mod.operation === 'remove') {
    return observed.length > 0
      ? judge(mod, 'contradicted', 'present-despite-remove', observed)
      : judge(mod, 'unobservable', 'absent-after-remove');
  }

  const claim = mod.valueResolved;
  if (claim === undefined) return judge(mod, 'unobservable', 'unresolved-claim');

  if (mod.operation === 'merge') {
    const sep = mergeSeparatorFor(mod);
    const merged = observed.some((v) => v === claim || v.endsWith(sep + claim));
    if (merged) return judge(mod, 'corroborated', 'merge-on-wire', observed);
    return observed.length > 0
      ? judge(mod, 'contradicted', 'value-mismatch', observed)
      : judge(mod, 'contradicted', 'absent-from-wire');
  }

  // override / add — the claimed value must be present under the name.
  const carried = observed.some((v) => valueCarriesClaim(v, claim));
  if (carried) return judge(mod, 'corroborated', 'value-on-wire', observed);
  return observed.length > 0
    ? judge(mod, 'contradicted', 'value-mismatch', observed)
    : judge(mod, 'contradicted', 'absent-from-wire');
}

/**
 * Verdict for one fire: every header mod in its snapshot judged against
 * the held sets, aggregated contradicted-first. Non-header fires (and
 * fires without a snapshot) carry no checkable claim — `unobservable`
 * with no per-mod entries; their evidence remains the engine-feedback /
 * in-page-reporter tiers.
 */
export function deriveFireEvidence(lifecycle: RequestLifecycle, fire: InspectorFire): FireEvidence {
  const snapshot = fire.ruleSnapshot;
  if (!snapshot || snapshot.type !== 'header' || !snapshot.headerMods || snapshot.headerMods.length === 0) {
    return { verdict: 'unobservable', mods: [] };
  }
  const mods = snapshot.headerMods.map((mod) => deriveModEvidence(lifecycle, mod));
  let verdict: ModEvidenceVerdict = 'unobservable';
  for (const m of mods) {
    if (m.verdict === 'contradicted') {
      verdict = 'contradicted';
      break;
    }
    if (m.verdict === 'corroborated') verdict = 'corroborated';
  }
  return { verdict, mods };
}

/**
 * Per-rule evidence map for one row — first fire per `ruleUid` wins,
 * matching `attributeHeaders`' dedup (authoritative + inferred describe
 * one application; the first occurrence's snapshot is the one rendered).
 */
export function deriveFireEvidenceByRule(
  lifecycle: RequestLifecycle,
  fires: readonly InspectorFire[],
): ReadonlyMap<string, FireEvidence> {
  const byRule = new Map<string, FireEvidence>();
  for (const fire of fires) {
    if (byRule.has(fire.ruleUid)) continue;
    byRule.set(fire.ruleUid, deriveFireEvidence(lifecycle, fire));
  }
  return byRule;
}

/**
 * Display tier of one fire. `contradicted` outranks the applied tiers:
 * a wire set disproving the claim is ground truth about the outcome,
 * even when the engine reported the rule matched (per-header arbitration
 * can hand the header to a higher-priority rule).
 */
export function fireTier(lifecycle: RequestLifecycle, fire: InspectorFire): FireDotTier {
  const evidence = deriveFireEvidence(lifecycle, fire);
  if (evidence.verdict === 'contradicted') return 'contradicted';
  if (
    evidence.verdict === 'corroborated' ||
    isAppliedFire(fire) ||
    hasCapturedOverride(lifecycle, fire.ruleUid) ||
    hasCapturedMessage(lifecycle, fire.ruleUid)
  ) {
    return 'applied';
  }
  return 'inferred';
}

/**
 * Whether the modifier captured this rule's actual effect on the row — a
 * two-sided response/request-body override keyed to the fire's rule. It is the
 * response/request-body analog of wire-header corroboration: a header change is
 * provable on the wire, but a body change is invisible to the wire, so its
 * proof is the captured served/original (sent/original) the modifier relayed.
 * Present ⇒ the rule verifiably applied — including in standard mode, where the
 * page-reported fire alone would only read `inferred`.
 */
export function hasCapturedOverride(lifecycle: RequestLifecycle, ruleUid: string): boolean {
  return lifecycle.responseOverride?.ruleUid === ruleUid || lifecycle.requestOverride?.ruleUid === ruleUid;
}

/**
 * Whether the stream wrapper captured this rule acting on the row — a
 * per-frame / per-event `StreamMessageCapture` keyed to the fire's rule.
 * The ws/sse analog of {@link hasCapturedOverride}: a message action is
 * invisible to the wire (a modify's replacement never crosses it, an
 * injected event never existed there), so its proof is the wrapper's
 * recorded report. Present ⇒ verifiably applied — the same tier the
 * stream grids' fire rails give a joined capture.
 */
export function hasCapturedMessage(lifecycle: RequestLifecycle, ruleUid: string): boolean {
  return (lifecycle.messageCaptures ?? []).some((c) => c.ruleUid === ruleUid);
}

/** Row-level tier for the fire-rail dot: contradicted > applied > inferred.
 *  `null` when the row has no fires (no dot). */
export function rowFireTier(lifecycle: RequestLifecycle, fires: readonly InspectorFire[]): FireDotTier | null {
  if (fires.length === 0) return null;
  let tier: FireDotTier = 'inferred';
  for (const fire of fires) {
    const t = fireTier(lifecycle, fire);
    if (t === 'contradicted') return 'contradicted';
    if (t === 'applied') tier = 'applied';
  }
  return tier;
}
