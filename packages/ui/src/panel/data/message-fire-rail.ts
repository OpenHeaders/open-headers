/**
 * Messages-grid fire rail — per-frame attribution of `ws` message rules.
 *
 * No per-frame rule attribution exists in the capture plane (a
 * `WsStreamMessage` records only direction, opcode, and payload), so the
 * dot is DERIVED at consume time: the row's fires narrowed to still-
 * existing `ws` rules, each rule's frame selector re-run against the
 * captured frame. Two honesty caveats shape the tiers:
 *
 *   - A `modify` rule's `messageFilter` matched the ORIGINAL payload,
 *     but the captured frame holds the REPLACED one — so a filter match
 *     on captured data is weak evidence, while payload equality with
 *     the rule's replacement is strong for both `modify` and `inject`.
 *   - `drop` swallows frames before capture — a dropped frame has no
 *     row, so drop rules never earn a dot.
 *
 * Tier per frame (never `contradicted` — there is no claim to disprove):
 *
 *   - `applied` (blue)   — the frame's payload equals the rule's
 *                          literal payload (no unresolved `{{…}}`).
 *   - `inferred` (amber) — the rule's selector (direction + filter)
 *                          takes this frame, or an unresolved-payload
 *                          rule writes frames in this direction;
 *                          application not verifiable.
 *   - `null`             — no rule accounts for the frame.
 *
 * Same posture as `fire-evidence.ts`: pure derivation, nothing cached.
 * The selector comes from the live rule (the frozen `RuleSnapshot`
 * carries header mods only) — matching the CTA flip's `firedRuleOfType`
 * live-rule read, so dot and CTA can never disagree about which rule
 * the row points at.
 */

import type { MessageFilter, Rule, WsRule } from '@openheaders/core/types';
import type { FireDotTier } from './fire-evidence';
import type { InspectorFire } from './types';

export type MessageFireTier = Exclude<FireDotTier, 'contradicted'>;

/** Still-existing `ws` rules among the row's fires, first fire per rule. */
export function firedWsRules(fires: readonly InspectorFire[], rulesByUid: ReadonlyMap<string, Rule>): WsRule[] {
  const seen = new Set<string>();
  const rules: WsRule[] = [];
  for (const fire of fires) {
    if (seen.has(fire.ruleUid)) continue;
    seen.add(fire.ruleUid);
    const rule = rulesByUid.get(fire.ruleUid);
    if (rule?.type === 'ws') rules.push(rule);
  }
  return rules;
}

/** A payload template that never resolved cannot be equality-checked. */
function isLiteralPayload(payload: string | undefined): payload is string {
  return payload !== undefined && !payload.includes('{{');
}

function filterTakes(filter: MessageFilter | undefined, data: string): boolean {
  if (filter === undefined) return true;
  if (filter.matchType === 'contains') return data.includes(filter.value);
  try {
    return new RegExp(filter.value, 'i').test(data);
  } catch {
    return false;
  }
}

interface FrameShape {
  readonly type: 'send' | 'receive' | 'error';
  readonly data: string;
}

/** Tier of one rule against one frame — `null` when the rule cannot
 *  account for it. */
function ruleFrameTier(rule: WsRule, frame: FrameShape): MessageFireTier | null {
  const action = rule.action;
  if (action.operation === 'drop') return null;
  if (frame.type === 'error' || frame.type !== action.direction) return null;

  if (isLiteralPayload(action.payload)) {
    // Strong: the frame carries exactly what the rule writes.
    if (frame.data === action.payload) return 'applied';
    // A resolved inject payload that differs means this is not the
    // injected frame — the rule says nothing about it.
    if (action.operation === 'inject') return null;
    // modify: the replacement is not on the frame; a filter match is
    // only the weak "would have selected it" signal.
    return filterTakes(action.messageFilter, frame.data) ? 'inferred' : null;
  }

  // Unresolved payload — equality is unavailable, selector only.
  if (action.operation === 'inject') return 'inferred';
  return filterTakes(action.messageFilter, frame.data) ? 'inferred' : null;
}

/**
 * Which side of a modify the captured frame holds, plus the derivable
 * counterpart. Direction decides where the capture plane sits relative
 * to the wrapper:
 *
 *   - `captured: 'original'` — the wire recorded the pre-modify frame
 *     (receive: the wrapper swaps delivery after capture). `modified`
 *     is the replacement the page received — the rule's literal
 *     payload, exact by the wrapper's contract, though whether THIS
 *     frame took it is only as strong as the tier says.
 *   - `captured: 'modified'` — the wire recorded the replacement
 *     (send: the wrapper swaps before `send`). The page-produced
 *     original never crossed any capture plane; there is nothing to
 *     derive it from.
 */
export type MessageModificationView =
  | { readonly captured: 'original'; readonly modified: string }
  | { readonly captured: 'modified' };

export interface MessageFrameAttribution {
  readonly tier: MessageFireTier;
  /** Both-sides view of the modification — `null` when the frame isn't
   *  a derivable modify (inject frames are wholly rule-authored, an
   *  unresolved `{{…}}` payload cannot be equality-anchored). */
  readonly modification: MessageModificationView | null;
}

function attributionFor(tier: MessageFireTier, rule: WsRule, frame: FrameShape): MessageFrameAttribution {
  const action = rule.action;
  if (action.operation === 'modify' && isLiteralPayload(action.payload)) {
    // Applied ⇒ payload equality held ⇒ the captured data IS the
    // replacement; inferred ⇒ the captured data is the presumed original
    // and the replacement is the rule's literal payload.
    const modification: MessageModificationView =
      tier === 'applied' ? { captured: 'modified' } : { captured: 'original', modified: action.payload };
    return { tier, modification };
  }
  return { tier, modification: null };
}

/** Attribution for one frame across the row's fired `ws` rules —
 *  `applied` wins over `inferred` (first rule of the winning tier
 *  supplies the modification view); `null` = no rule accounts for it. */
export function messageFrameAttribution(
  rules: readonly WsRule[],
  frame: FrameShape,
): MessageFrameAttribution | null {
  let inferred: WsRule | null = null;
  for (const rule of rules) {
    const t = ruleFrameTier(rule, frame);
    if (t === 'applied') return attributionFor('applied', rule, frame);
    if (t === 'inferred' && inferred === null) inferred = rule;
  }
  return inferred === null ? null : attributionFor('inferred', inferred, frame);
}

/** Rail tier for one frame across the row's fired `ws` rules —
 *  `applied` wins over `inferred`; `null` = no dot. */
export function messageFireTier(rules: readonly WsRule[], frame: FrameShape): MessageFireTier | null {
  return messageFrameAttribution(rules, frame)?.tier ?? null;
}
