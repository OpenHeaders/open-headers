/**
 * Correlates HAR headers with the snapshotted rule actions stored on
 * each `InspectorFire` to produce an "attributed" view of each header
 * direction.
 *
 * ## Snapshot, not live
 *
 * Header values rendered on each row come from `fire.ruleSnapshot` —
 * the frozen view of the rule taken at fire-emit time. Editing the rule
 * afterwards must NOT rewrite what the user sees for a past request:
 * the row is a capture, the live rule is configuration. Same separation
 * debugging proxies and API-client history views all draw.
 *
 * Each rule-attributed row also carries a pointer to the *current* rule
 * + matching mod (looked up by uid/direction/name) and an `edited` flag
 * so the popover can show the snapshot ("what happened on this
 * request") next to the current rule ("what would happen now") and the
 * row can render a small "edited since" indicator.
 *
 * ## Stable order
 *
 * Output ordering:
 *   1. Server-origin headers, in their original HAR order.
 *   2. Headers our rules added (not present in the HAR at all), one row
 *      per unique name (last-fire-wins for attribution).
 *   3. Headers our rules appended via `add`, one row per firing rule
 *      (duplicates are intentional — that's DNR's append semantic).
 *
 * ## Dedup rules
 *
 * The same rule sometimes appears twice in `fires` (once confirmed by
 * Chrome's `onRuleMatchedDebug`, once inferred from URL matching) —
 * that's duplicate *evidence* for a single application. We dedupe by
 * `ruleUid` before processing.
 *
 * Across *different* rules touching the same header, the later-arriving
 * fire wins (matches DNR's same-priority-last-registered semantics).
 *
 * Name matching is case-insensitive per RFC 9110 §5.1.
 *
 * ## Wire-aware rendering
 *
 * When the caller supplies the per-rule {@link FireEvidence} (derived by
 * `fire-evidence.ts` from the same snapshots against the captured header
 * sets), each mod's verdict steers how its claim renders:
 *
 *   - `corroborated` — the capture already SHOWS the modification, so the
 *     claim marks the existing wire row instead of fabricating: an
 *     override keeps the wire value with no invented `originalValue` (the
 *     pre-rewrite value was never captured), an `add` marks the matching
 *     wire row rather than appending a duplicate, a `merge` keeps the
 *     already-merged wire value (the base value is recovered from it
 *     instead of re-concatenated).
 *   - `contradicted` — the capture disproves the claim; nothing is
 *     rendered onto the rows (the wire value stands). The contradiction
 *     surfaces on the fire-rail dot and the Matched Rules badge.
 *   - `unobservable` (or no evidence supplied) — the legacy rendering:
 *     the claim is drawn onto the rows, which is exactly right for a
 *     pre-rewrite (`raw`) capture whose sets cannot contain the mod.
 */

import type {
  HeaderModification,
  HeaderRule,
  Rule,
  RuleSnapshot,
  RuleSnapshotHeaderMod,
} from '@openheaders/core/types';
import { type FireEvidence, type ModEvidenceVerdict, valueCarriesClaim } from './fire-evidence';
import type { InspectorFire } from './types';

/**
 * Rule-attribution context shared by every non-`server`/`system` row.
 *
 * **Historical-only.** The context carries the snapshot data captured
 * at fire time + identity (`ruleUid`, `ruleType`). It deliberately
 * does NOT cache the live rule or live mod — those are derived at
 * consume time from the renderer-side mirror via the exported
 * `findCurrentMod` / `isAttributionEdited` helpers.
 *
 * Why: caching live state in a struct that's built once and reused
 * across re-renders silently goes stale when the rule mutates. Every
 * consumer that reads "live now" must derive it reactively against
 * the current `liveRule`. Architectural separation: attribution =
 * historical, live = derived.
 */
export interface RuleAttributionContext {
  ruleUid: string;
  /** Display name from the snapshot — what the rule was called at fire time. */
  ruleName: string;
  ruleType: Rule['type'];
  /** The exact mod (frozen) that produced this row. */
  snapshotMod: RuleSnapshotHeaderMod;
  /** Corroboration verdict for this mod against the captured header sets
   *  (see `fire-evidence.ts`). Historical like the rest of the context —
   *  derived from the frozen capture + snapshot, never from live state.
   *  Absent when the caller supplied no evidence. */
  verdict?: ModEvidenceVerdict;
  /**
   * Full mod list at fire time. Needed by `findCurrentMod`'s
   * positional sibling matching for the duplicate-name-and-operation
   * case (two `Set-Cookie: add` mods on the same rule).
   */
  snapshotMods: ReadonlyArray<RuleSnapshotHeaderMod>;
  /**
   * Other modifications on the same rule that fired on this same
   * request — i.e. all snapshot mods minus the row's own mod. Used
   * by the popover to surface the rule's full footprint on this
   * request without forcing the user to scan the inspector list.
   * Empty when this is the only mod the rule applied.
   */
  siblingMods: ReadonlyArray<RuleSnapshotHeaderMod>;
}

export type HeaderAttribution =
  | { kind: 'server' }
  | { kind: 'added'; operation: 'override' | 'add'; ctx: RuleAttributionContext }
  /**
   * `originalValue` is the pre-rule value when one was captured. Absent
   * for a corroborated mod on a post-rewrite capture — the set already
   * holds the modified value, so the pre-rule value was never recorded
   * (claiming one would be fabrication).
   */
  | { kind: 'modified'; operation: 'override' | 'merge'; originalValue?: string; ctx: RuleAttributionContext }
  /**
   * Header was removed before reaching the page. Two sub-cases:
   *   - `source: 'server'`     — the server sent the header and a
   *                              `remove` rule stripped it. `originalValue`
   *                              is the server's value.
   *   - `source: 'injection'`  — another rule had injected this header
   *                              and a later `remove` rule stripped it.
   *                              `originalValue` is the would-have-been-
   *                              injected value; `injectingRule` carries
   *                              the snapshot of the rule that injected.
   * In both cases `ctx` describes the rule that performed the removal.
   */
  | {
      kind: 'removed';
      source: 'server' | 'injection';
      originalValue: string;
      ctx: RuleAttributionContext;
      /** Snapshot of the rule that injected the now-removed value. Only
       *  populated when `source === 'injection'`. */
      injectingRule?: { ruleUid: string; ruleName: string };
    }
  /**
   * Injected / overridden by an Open Headers *system* feature rather
   * than a user-defined rule. Rendered yellow in the UI so users can
   * distinguish it from their own rule-based modifications (blue).
   */
  | { kind: 'system'; source: 'cache-bypass' | 'live-rules'; label: string };

export interface AnnotatedHeader {
  name: string;
  value: string;
  attribution: HeaderAttribution;
}

export type HeaderDirection = 'request' | 'response';

interface HarHeader {
  name: string;
  value: string;
}

export interface SystemHeaderContext {
  cacheBypassEnabled?: boolean;
  liveRulesFired?: boolean;
}

const CACHE_BYPASS_HEADERS: ReadonlySet<string> = new Set(['cache-control', 'pragma']);

function systemAttributionFor(name: string, value: string, ctx: SystemHeaderContext): HeaderAttribution | null {
  if (!CACHE_BYPASS_HEADERS.has(name.toLowerCase()) || !value.toLowerCase().includes('no-cache')) return null;
  if (ctx.cacheBypassEnabled) return { kind: 'system', source: 'cache-bypass', label: 'Bypass HTTP Cache' };
  if (ctx.liveRulesFired) return { kind: 'system', source: 'live-rules', label: 'Live Rules' };
  return null;
}

/** Pull the mod's display value: prefer the resolved value (what hit
 *  the wire), fall back to the raw template when resolution failed. */
function snapshotValue(mod: RuleSnapshotHeaderMod): string {
  return mod.valueResolved ?? mod.valueTemplate ?? '';
}

/**
 * Locate the live mod corresponding to a snapshot mod. Match policy:
 *   1. By direction + lowercase headerName + operation + (positional
 *      index among same-name+operation siblings in the snapshot's mods).
 *      The positional clause matters for multi-append rules — two
 *      `add`s on `Set-Cookie` with different values must each map to
 *      their own current counterpart.
 *   2. If no positional match, fall back to (direction + name +
 *      operation) with the first available match. Sufficient for
 *      single-mod cases (the common path) and graceful for partial
 *      edits where the user reordered mods.
 *   3. If the operation changed but the direction + name still match,
 *      return null with `edited=true` — the row gets the "edited"
 *      marker and the popover offers the live rule for inspection.
 */
/**
 * Locate the live mod corresponding to a `RuleAttributionContext`.
 * **Pure** — every consumer that needs "what does this mod look like
 * NOW" calls this against the current `liveRule` (which they already
 * subscribe to via the rule mirror). Returns `null` when the rule was
 * deleted, the rule type changed, or the user removed the matching
 * mod from the rule's action list.
 *
 * Match policy:
 *   1. Direction + lowercase headerName + operation + positional
 *      sibling index (matters for multi-append rules where two
 *      `add`s on `Set-Cookie` must each map to their own counterpart).
 *   2. No fallback to fuzzy match — returning `null` lets the consumer
 *      surface "mod gone" with a clear signal.
 */
export function findCurrentMod(liveRule: Rule | null, ctx: RuleAttributionContext): HeaderModification | null {
  if (!liveRule || liveRule.type !== 'header') return null;
  const { snapshotMod, snapshotMods } = ctx;
  const list = snapshotMod.direction === 'request' ? liveRule.action.requestHeaders : liveRule.action.responseHeaders;
  // Live mods carry the raw template (`X-{{env.x}}`), the snapshot
  // carries the resolved name (`X-Foo`). Match against the snapshot's
  // template when it has one — that's the structural identity we
  // care about for "is this still the same mod the user wrote?".
  const lowerSnapshotKey = (snapshotMod.headerNameTemplate ?? snapshotMod.headerName).toLowerCase();

  // Snapshot-side index among siblings (same direction + name + op).
  let snapshotSiblingIndex = -1;
  let walked = 0;
  for (const m of snapshotMods) {
    if (m === snapshotMod) {
      snapshotSiblingIndex = walked;
      break;
    }
    const mKey = (m.headerNameTemplate ?? m.headerName).toLowerCase();
    if (m.direction === snapshotMod.direction && mKey === lowerSnapshotKey && m.operation === snapshotMod.operation) {
      walked++;
    }
  }

  // Walk live siblings, picking the same positional index.
  let liveSeen = 0;
  for (const m of list) {
    if (m.headerName.toLowerCase() !== lowerSnapshotKey) continue;
    if (m.operation !== snapshotMod.operation) continue;
    if (liveSeen === snapshotSiblingIndex) return m;
    liveSeen++;
  }

  return null;
}

/**
 * Reports whether the rule has been edited since fire — the live rule
 * doesn't exist, its type changed, the matching mod is gone, or the
 * mod's structural fields diverge from the snapshot. **Pure**, called
 * by the popover + inspector against the current `liveRule`.
 */
export function isAttributionEdited(liveRule: Rule | null, ctx: RuleAttributionContext): boolean {
  if (!liveRule) return true;
  if (liveRule.type !== ctx.ruleType) return true;
  const currentMod = findCurrentMod(liveRule, ctx);
  if (!currentMod) return true;
  return modsDiverge(ctx.snapshotMod, currentMod);
}

function modsDiverge(a: RuleSnapshotHeaderMod, b: HeaderModification): boolean {
  if (a.operation !== b.operation) return true;
  // Compare templates structurally: the snapshot's `headerName` is the
  // resolved name, but `headerNameTemplate` (when set) is what the user
  // wrote. Compare that against the live mod's template.
  const aNameTemplate = a.headerNameTemplate ?? a.headerName;
  if (aNameTemplate !== b.headerName) return true;
  const aTemplate = a.valueTemplate ?? '';
  const bValue = b.value ?? '';
  if (a.operation !== 'remove' && aTemplate !== bValue) return true;
  if (a.operation === 'merge') {
    // Snapshot's `mergeSeparator` is the resolved separator; live mod's
    // is the raw template. Compare templates so var-only resolution
    // changes don't read as structural edits.
    const aSepTemplate = a.mergeSeparatorTemplate ?? a.mergeSeparator ?? '';
    if (aSepTemplate !== (b.mergeSeparator ?? '')) return true;
  }
  return false;
}

function buildContext(
  snapshot: RuleSnapshot,
  snapshotMod: RuleSnapshotHeaderMod,
  verdict?: ModEvidenceVerdict,
): RuleAttributionContext {
  // Pure historical context — no live-rule reads. Consumers derive
  // current state via `findCurrentMod` / `isAttributionEdited` against
  // their own subscription to the rule mirror.
  const snapshotMods = snapshot.headerMods ?? [];
  const siblingMods = snapshotMods.filter((m) => m !== snapshotMod);
  return {
    ruleUid: snapshot.ruleUid,
    ruleName: snapshot.name,
    ruleType: snapshot.type,
    snapshotMod,
    snapshotMods,
    siblingMods,
    ...(verdict !== undefined ? { verdict } : {}),
  };
}

/**
 * Synthesize a snapshot for a fire that arrived without one — happens
 * for legacy ring-buffer entries or fires whose rule was deleted before
 * the snapshotter could read it. Uses the *live* rule as the snapshot
 * source (so rendering still works) but never marks the row as edited
 * (we have no historical baseline to compare).
 */
function synthesizeSnapshot(rule: HeaderRule): RuleSnapshot {
  // Legacy fires (predate the snapshotter) carry no resolved values.
  // Use the live rule's template literally for both `headerName` and
  // `headerNameTemplate`/`valueTemplate`/`valueResolved`. Consumers
  // that read `isAttributionEdited` will report `false` because the
  // synthesized snapshot already matches the live mod structurally —
  // a clean baseline ensures we don't claim drift we can't verify.
  const synthMod = (m: HeaderModification, direction: 'request' | 'response'): RuleSnapshotHeaderMod => {
    const entry: RuleSnapshotHeaderMod = { direction, operation: m.operation, headerName: m.headerName };
    if (m.operation !== 'remove' && m.value !== undefined) {
      entry.valueTemplate = m.value;
      entry.valueResolved = m.value;
    }
    if (m.operation === 'merge' && m.mergeSeparator !== undefined) {
      entry.mergeSeparator = m.mergeSeparator;
    }
    return entry;
  };
  const headerMods: RuleSnapshotHeaderMod[] = [
    ...(rule.action.requestHeaders ?? []).map((m) => synthMod(m, 'request')),
    ...(rule.action.responseHeaders ?? []).map((m) => synthMod(m, 'response')),
  ];
  return {
    ruleUid: rule.uid,
    name: rule.name,
    type: rule.type,
    enabled: rule.enabled,
    headerMods,
  };
}

export function attributeHeaders(
  harHeaders: readonly HarHeader[],
  fires: readonly InspectorFire[],
  direction: HeaderDirection,
  rulesByUid: ReadonlyMap<string, Rule>,
  systemCtx: SystemHeaderContext = {},
  evidenceByRule?: ReadonlyMap<string, FireEvidence>,
): AnnotatedHeader[] {
  // ── Server rows ───────────────────────────────────────────
  const serverRows: AnnotatedHeader[] = harHeaders.map((h) => {
    const systemAttr = direction === 'request' ? systemAttributionFor(h.name, h.value, systemCtx) : null;
    return {
      name: h.name,
      value: h.value,
      attribution: (systemAttr ?? { kind: 'server' }) as HeaderAttribution,
    };
  });
  const serverIndex = new Map<string, number>();
  const serverOriginal = new Map<number, string>();
  for (let i = 0; i < serverRows.length; i++) {
    const key = serverRows[i].name.toLowerCase();
    if (!serverIndex.has(key)) serverIndex.set(key, i);
    serverOriginal.set(i, serverRows[i].value);
  }

  const addedByName = new Map<string, AnnotatedHeader>();
  const appendedRows: AnnotatedHeader[] = [];

  // Dedupe fires by ruleUid (authoritative + inferred describe one
  // application) — preserve the first occurrence so its snapshot wins.
  const seen = new Set<string>();
  const uniqueFires: InspectorFire[] = [];
  for (const fire of fires) {
    if (seen.has(fire.ruleUid)) continue;
    seen.add(fire.ruleUid);
    uniqueFires.push(fire);
  }

  for (const fire of uniqueFires) {
    const liveRule = rulesByUid.get(fire.ruleUid) ?? null;

    // Pick the snapshot to read mods from. Order:
    //   1. Fire's own snapshot (the immutable record of what fired).
    //   2. Synthesize from live rule (legacy / pre-snapshot fires).
    //   3. No snapshot AND no live rule — nothing to attribute, skip.
    let snapshot: RuleSnapshot | null = fire.ruleSnapshot ?? null;
    if (!snapshot && liveRule && liveRule.type === 'header') {
      snapshot = synthesizeSnapshot(liveRule);
    }
    if (!snapshot || snapshot.type !== 'header' || !snapshot.headerMods) continue;

    const directionMods = snapshot.headerMods.filter((m) => m.direction === direction);
    const evidence = evidenceByRule?.get(fire.ruleUid);

    for (const snapshotMod of directionMods) {
      const key = snapshotMod.headerName.toLowerCase();
      const serverIdx = serverIndex.get(key);
      const verdict = evidence?.mods.find((m) => m.mod === snapshotMod)?.verdict;
      const ctx = buildContext(snapshot, snapshotMod, verdict);
      const appliedValue = snapshotValue(snapshotMod);

      // Contradicted: the capture disproves this claim — the wire rows
      // stand untouched. The contradiction surfaces on the fire-rail dot
      // and the Matched Rules badge, not as a fabricated header row.
      if (verdict === 'contradicted') continue;

      // Corroborated: the capture already shows the modification — mark
      // the wire row instead of fabricating values onto it.
      if (verdict === 'corroborated') {
        if (snapshotMod.operation === 'override' && serverIdx != null) {
          serverRows[serverIdx] = {
            name: serverRows[serverIdx].name,
            value: serverRows[serverIdx].value,
            // No `originalValue`: a post-rewrite capture never recorded
            // the pre-rule value.
            attribution: { kind: 'modified', operation: 'override', ctx },
          };
          continue;
        }
        if (snapshotMod.operation === 'add') {
          const idx = serverRows.findIndex(
            (r) =>
              r.attribution.kind === 'server' &&
              r.name.toLowerCase() === key &&
              valueCarriesClaim(r.value, appliedValue),
          );
          if (idx >= 0) {
            serverRows[idx] = {
              name: serverRows[idx].name,
              value: serverRows[idx].value,
              attribution: { kind: 'added', operation: 'add', ctx },
            };
            continue;
          }
          // Defensive: judged against a set the displayed list doesn't
          // mirror — fall through to the legacy rendering below.
        }
        if (snapshotMod.operation === 'merge' && serverIdx != null) {
          const sep = snapshotMod.mergeSeparator ?? (key === 'cookie' || key === 'set-cookie' ? '; ' : ', ');
          const wireValue = serverRows[serverIdx].value;
          const suffix = sep + appliedValue;
          // The wire value is already merged — recover the base from it
          // rather than concatenating the claim a second time.
          const originalValue =
            wireValue.length > suffix.length && wireValue.endsWith(suffix)
              ? wireValue.slice(0, wireValue.length - suffix.length)
              : undefined;
          serverRows[serverIdx] = {
            name: serverRows[serverIdx].name,
            value: wireValue,
            attribution: {
              kind: 'modified',
              operation: 'merge',
              ...(originalValue !== undefined ? { originalValue } : {}),
              ctx,
            },
          };
          continue;
        }
        // Other corroborated shapes (a remove never corroborates in this
        // model) fall through to the legacy rendering.
      }

      if (snapshotMod.operation === 'remove') {
        if (serverIdx != null) {
          const originalValue = serverOriginal.get(serverIdx) ?? serverRows[serverIdx].value;
          serverRows[serverIdx] = {
            name: serverRows[serverIdx].name,
            value: serverRows[serverIdx].value,
            attribution: { kind: 'removed', source: 'server', originalValue, ctx },
          };
        }
        // Rule-on-rule remove: keep the row visible as a cancelled
        // injection. Without this, the user sees neither the original
        // injection nor the removal — the action chain disappears.
        // The row is attributed to the *removing* rule (it's the
        // winner in DNR's eyes); the injecting rule rides along in
        // `injectingRule` so the popover can explain the chain.
        const cancelled = addedByName.get(key);
        if (cancelled) {
          const cancelledCtx = cancelled.attribution.kind === 'added' ? cancelled.attribution.ctx : null;
          addedByName.set(key, {
            name: cancelled.name,
            value: cancelled.value,
            attribution: {
              kind: 'removed',
              source: 'injection',
              originalValue: cancelled.value,
              ctx,
              ...(cancelledCtx
                ? { injectingRule: { ruleUid: cancelledCtx.ruleUid, ruleName: cancelledCtx.ruleName } }
                : {}),
            },
          });
        }
        continue;
      }

      if (snapshotMod.operation === 'override') {
        if (serverIdx != null) {
          const originalValue = serverOriginal.get(serverIdx) ?? serverRows[serverIdx].value;
          serverRows[serverIdx] = {
            name: serverRows[serverIdx].name,
            value: appliedValue,
            attribution: { kind: 'modified', operation: 'override', originalValue, ctx },
          };
        } else {
          addedByName.set(key, {
            name: snapshotMod.headerName,
            value: appliedValue,
            attribution: { kind: 'added', operation: 'override', ctx },
          });
        }
        continue;
      }

      if (snapshotMod.operation === 'add') {
        appendedRows.push({
          name: snapshotMod.headerName,
          value: appliedValue,
          attribution: { kind: 'added', operation: 'add', ctx },
        });
        continue;
      }

      if (snapshotMod.operation === 'merge') {
        const sep = snapshotMod.mergeSeparator ?? (key === 'cookie' || key === 'set-cookie' ? '; ' : ', ');
        if (serverIdx != null) {
          const originalValue = serverOriginal.get(serverIdx) ?? serverRows[serverIdx].value;
          serverRows[serverIdx] = {
            name: serverRows[serverIdx].name,
            value: originalValue + sep + appliedValue,
            attribution: { kind: 'modified', operation: 'merge', originalValue, ctx },
          };
        } else {
          const existing = addedByName.get(key);
          const existingValue = existing?.value ?? '';
          const mergedValue = existingValue ? `${existingValue}${sep}${appliedValue}` : appliedValue;
          addedByName.set(key, {
            name: snapshotMod.headerName,
            value: mergedValue,
            attribution: { kind: 'added', operation: 'override', ctx },
          });
        }
      }
    }
  }

  return [...serverRows, ...addedByName.values(), ...appendedRows];
}
