/**
 * Rule snapshot — freezes the parts of a rule the inspector panel needs
 * to render attribution for a single fire. Captured at fire-emit time
 * in the background and shipped through the inspector port alongside
 * the `RequestRecord`.
 *
 * Why a snapshot at all: `header-attribution` originally read live rule
 * mods to compute the row's value, which meant editing a rule in the
 * workspace silently rewrote what the user saw for a *past* request.
 * That violates the invariant every other capture tool (debugging
 * proxies, API-client history) holds — captured events are
 * immutable, configuration is mutable. Snapshotting at the fire
 * boundary makes fires self-describing so the panel renders history
 * faithfully even when the live rule has since been edited or deleted.
 *
 * Both the raw template and the resolved value are captured. The
 * resolved value is what hit the wire (and what the row displays); the
 * template is shown alongside in the popover so a user can tell whether
 * a divergence is "I edited the rule" vs "the env var changed."
 *
 * Timing: this is MV3 — Chrome's declarativeNetRequest engine actually
 * modifies the request inside the network stack, and we learn about
 * the fire asynchronously via `onRuleMatchedDebug` (Chrome/Edge) or
 * by URL-matching a `webRequest.onBeforeRequest` observation (inferred
 * fallback). The snapshot is taken when our `handleFireRecord` callback
 * runs in response to those signals — i.e. *after* the DNR rule has
 * already executed. The window between DNR-execution and our callback
 * is sub-millisecond; a user editing a rule in that window would see
 * the post-edit state in the snapshot. Same approximation desktop
 * debugging proxies accept; not actually reachable in practice.
 */

import type { HeaderModification, HeaderRule } from '@openheaders/core/types';
import type { RuleSnapshot, RuleSnapshotHeaderMod } from '@/types/telemetry';
import { getRules } from './rule-store';
import { getResolvedRules } from './variables-resolver';

/**
 * Build a snapshot for the given ruleUid by reading both the live (raw)
 * rule and the last-resolved rule from the variables-resolver. Returns
 * `null` when neither registry knows the uid — happens when a rule was
 * deleted between fire-record creation and broadcast, or when the
 * resolver hasn't run yet (cold start before the first compile).
 */
export function buildRuleSnapshot(ruleUid: string): RuleSnapshot | null {
  const rawRules = getRules();
  const resolvedRules = getResolvedRules();
  const raw = rawRules.find((r) => r.uid === ruleUid);
  const resolved = resolvedRules.find((r) => r.uid === ruleUid);
  // Prefer raw for identity (name/version reflect what the user sees in
  // the workspace right now). The resolved counterpart is consulted
  // only for `valueResolved` substitution into header mods. If only one
  // exists, fall back to it for everything.
  const identitySource = raw ?? resolved;
  if (!identitySource) return null;

  const snapshot: RuleSnapshot = {
    ruleUid,
    name: identitySource.name,
    type: identitySource.type,
    enabled: identitySource.enabled,
  };

  if (identitySource.type === 'header') {
    snapshot.headerMods = buildHeaderMods(raw as HeaderRule | undefined, resolved as HeaderRule | undefined);
  }

  return snapshot;
}

function buildHeaderMods(
  raw: HeaderRule | undefined,
  resolved: HeaderRule | undefined,
): ReadonlyArray<RuleSnapshotHeaderMod> {
  // Walk the raw rule's mod arrays as the structural authority — those
  // are the entries the user wrote. The resolved rule's mods at the
  // same positions carry the resolved values; positional alignment is
  // safe because `resolveRulesForCompile` produces the resolved rule by
  // mapping over the same arrays without reordering.
  const out: RuleSnapshotHeaderMod[] = [];
  const directions: Array<
    ['request' | 'response', HeaderModification[] | undefined, HeaderModification[] | undefined]
  > = [
    ['request', raw?.action.requestHeaders, resolved?.action.requestHeaders],
    ['response', raw?.action.responseHeaders, resolved?.action.responseHeaders],
  ];
  for (const [direction, rawMods, resolvedMods] of directions) {
    if (!rawMods && !resolvedMods) continue;
    const list = rawMods ?? resolvedMods ?? [];
    for (let i = 0; i < list.length; i++) {
      const rawMod = rawMods?.[i];
      const resolvedMod = resolvedMods?.[i];
      const mod = rawMod ?? resolvedMod;
      if (!mod) continue;
      // Header name: prefer the resolved version (what hit the wire,
      // and what the inspector matches against HAR rows). Stash the
      // raw template alongside when it differs — i.e. the user wrote
      // `{{vars}}` in the name field — so the popover can show "Tpl
      // header name was X-{{env.wat}}" alongside the resolved name.
      const resolvedName = resolvedMod?.headerName ?? rawMod?.headerName ?? mod.headerName;
      const rawName = rawMod?.headerName;
      const entry: RuleSnapshotHeaderMod = {
        direction,
        operation: mod.operation,
        headerName: resolvedName,
      };
      if (rawName !== undefined && rawName !== resolvedName) {
        entry.headerNameTemplate = rawName;
      }
      if (mod.operation !== 'remove') {
        if (rawMod?.value !== undefined) entry.valueTemplate = rawMod.value;
        if (resolvedMod?.value !== undefined) entry.valueResolved = resolvedMod.value;
      }
      if (mod.operation === 'merge') {
        const rawSep = rawMod?.mergeSeparator;
        const resolvedSep = resolvedMod?.mergeSeparator ?? rawSep;
        if (resolvedSep !== undefined) entry.mergeSeparator = resolvedSep;
        if (rawSep !== undefined && rawSep !== resolvedSep) entry.mergeSeparatorTemplate = rawSep;
      }
      out.push(entry);
    }
  }
  return out;
}
