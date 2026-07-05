/**
 * Stream-grid fire rail — per-frame attribution of `ws` message rules,
 * plus the receive-only `sse` arm at the bottom of the module.
 *
 * Two evidence tiers feed it. A frame carrying a joined wrapper capture
 * (`FrameShape.capture` — see `ws-frames.ts`) has RECORDED attribution:
 * the wrapper reported acting on that exact frame, so the verdict is
 * proof-grade (`applied`) and both sides of the action are known. The
 * wire plane alone records no per-frame attribution (a
 * `WsStreamMessage` holds only direction, opcode, and payload), so
 * capture-less frames fall back to a DERIVED dot: the row's fires
 * narrowed to still-existing `ws` rules, each rule's frame selector
 * re-run against the captured frame. Two honesty caveats shape the
 * derived tiers:
 *
 *   - A `modify` rule's `messageFilter` matched the ORIGINAL payload,
 *     but a SEND frame's captured data holds the REPLACED one (the
 *     wrapper swaps before `send`) — so a filter match on captured data
 *     is weak evidence, while payload equality with the rule's
 *     replacement is strong for both `modify` and `inject`. A RECEIVE
 *     frame is the mirror: capture sits at the wire, before the
 *     wrapper, so the captured data IS the original and equality with
 *     the replacement is unreachable.
 *   - `drop` is direction-split the same way: a dropped SEND frame
 *     never crosses the wire (no row — and a send frame that IS on the
 *     wire was not dropped, so send-drops never mark anything), while a
 *     dropped RECEIVE frame has a row the page never received — marked
 *     with the `dropped` modification view.
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

import type { StreamMessageCapture } from '@openheaders/core/request-lifecycle';
import type { MessageFilter, Rule, SseRule, WsRule } from '@openheaders/core/types';
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

/** The `sse` twin — still-existing sse rules among the row's fires. */
export function firedSseRules(fires: readonly InspectorFire[], rulesByUid: ReadonlyMap<string, Rule>): SseRule[] {
  const seen = new Set<string>();
  const rules: SseRule[] = [];
  for (const fire of fires) {
    if (seen.has(fire.ruleUid)) continue;
    seen.add(fire.ruleUid);
    const rule = rulesByUid.get(fire.ruleUid);
    if (rule?.type === 'sse') rules.push(rule);
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
  /** Wrapper capture joined to the frame — recorded proof that outranks
   *  every selector inference below. */
  readonly capture?: StreamMessageCapture;
}

/** Tier of one rule against one frame — `null` when the rule cannot
 *  account for it. */
function ruleFrameTier(rule: WsRule, frame: FrameShape): MessageFireTier | null {
  const action = rule.action;
  if (frame.type === 'error' || frame.type !== action.direction) return null;

  if (action.operation === 'drop') {
    // Only a receive frame can carry the dropped mark: the wire captured
    // it before the wrapper stopped delivery. A send frame on the wire is
    // one the drop did NOT take (a dropped send never crosses the wire).
    if (action.direction !== 'receive') return null;
    return filterTakes(action.messageFilter, frame.data) ? 'inferred' : null;
  }

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
 * What the wrapper did to the frame relative to what the wire captured.
 * Direction decides where the capture plane sits relative to the wrapper:
 *
 *   - `replaced-in-page` — the wire recorded the pre-modify original
 *     (receive: the wrapper swaps delivery after capture). `modified`
 *     is the replacement the page received — the rule's literal
 *     payload, exact by the wrapper's contract, though whether THIS
 *     frame took it is only as strong as the tier says.
 *   - `replaced-on-wire` — the wire recorded the replacement (send: the
 *     wrapper swaps before `send`). `original` is the page-produced
 *     payload when the wrapper's capture recorded it; absent on the
 *     selector-inferred path (nothing to derive it from).
 *   - `dropped` — the frame was stopped by the wrapper: a receive drop
 *     has a wire row the page never received; a send drop surfaces only
 *     as a capture-minted synthetic row (nothing crossed the wire).
 */
export type MessageModificationView =
  | { readonly kind: 'replaced-in-page'; readonly modified: string }
  | { readonly kind: 'replaced-on-wire'; readonly original?: string }
  | { readonly kind: 'dropped' };

export interface MessageFrameAttribution {
  readonly tier: MessageFireTier;
  /** The rule that accounts for THIS frame — the capture's recorded uid
   *  or the winning rule of the selector derivation. Row actions target
   *  it so "Edit rule" never points at a rule that took another frame. */
  readonly ruleUid: string;
  /** Both-sides view of the modification — `null` when the frame isn't
   *  a derivable modify/drop (inject frames are wholly rule-authored,
   *  an unresolved `{{…}}` payload cannot be equality-anchored). */
  readonly modification: MessageModificationView | null;
}

function attributionFor(tier: MessageFireTier, rule: WsRule): MessageFrameAttribution {
  const action = rule.action;
  const ruleUid = rule.uid;
  if (action.operation === 'drop') {
    return { tier, ruleUid, modification: { kind: 'dropped' } };
  }
  if (action.operation === 'modify' && isLiteralPayload(action.payload)) {
    // Applied ⇒ payload equality held ⇒ the captured data IS the
    // replacement; inferred ⇒ the captured data is the presumed original
    // and the replacement is the rule's literal payload.
    const modification: MessageModificationView =
      tier === 'applied' ? { kind: 'replaced-on-wire' } : { kind: 'replaced-in-page', modified: action.payload };
    return { tier, ruleUid, modification };
  }
  return { tier, ruleUid, modification: null };
}

/** Attribution from the frame's joined wrapper capture — recorded proof
 *  (`applied`, matching `isAppliedFire`'s in-page-reporter tier), so it
 *  needs no live rule and outranks every selector inference. */
function captureAttribution(capture: StreamMessageCapture): MessageFrameAttribution {
  const ruleUid = capture.ruleUid;
  if (capture.op === 'injected') {
    // The whole frame is rule-authored — there are no two sides to split.
    return { tier: 'applied', ruleUid, modification: null };
  }
  if (capture.op === 'dropped') return { tier: 'applied', ruleUid, modification: { kind: 'dropped' } };
  return capture.direction === 'send'
    ? {
        tier: 'applied',
        ruleUid,
        modification: {
          kind: 'replaced-on-wire',
          ...(capture.original !== undefined ? { original: capture.original } : {}),
        },
      }
    : { tier: 'applied', ruleUid, modification: { kind: 'replaced-in-page', modified: capture.delivered ?? '' } };
}

/** Attribution for one frame — the joined capture when present (proof),
 *  else across the row's fired `ws` rules: `applied` wins over
 *  `inferred` (first rule of the winning tier supplies the modification
 *  view); `null` = nothing accounts for the frame. */
export function messageFrameAttribution(rules: readonly WsRule[], frame: FrameShape): MessageFrameAttribution | null {
  if (frame.capture !== undefined) return captureAttribution(frame.capture);
  let inferred: WsRule | null = null;
  for (const rule of rules) {
    const t = ruleFrameTier(rule, frame);
    if (t === 'applied') return attributionFor('applied', rule);
    if (t === 'inferred' && inferred === null) inferred = rule;
  }
  return inferred === null ? null : attributionFor('inferred', inferred);
}

/** Rail tier for one frame across the row's fired `ws` rules —
 *  `applied` wins over `inferred`; `null` = no dot. */
export function messageFireTier(rules: readonly WsRule[], frame: FrameShape): MessageFireTier | null {
  return messageFrameAttribution(rules, frame)?.tier ?? null;
}

// ── SSE arm ───────────────────────────────────────────────────────────
//
// The EventStream grid's twin of the frame derivation above. SSE is
// receive-only, so the honesty caveats collapse to the receive side:
// wire capture happens BEFORE the wrapper acts, the captured data IS
// the original, and equality with a modify rule's replacement is
// unreachable — a literal-payload match is only meaningful for inject.
// The selector is the event-name gate (`message` when the rule omits
// it) plus the data filter.

interface SseEventShape {
  readonly eventName: string;
  readonly data: string;
  /** Wrapper capture joined to the event — recorded proof that outranks
   *  every selector inference below. */
  readonly capture?: StreamMessageCapture;
}

/** Tier of one sse rule against one event — `null` when the rule cannot
 *  account for it. */
function sseRuleEventTier(rule: SseRule, event: SseEventShape): MessageFireTier | null {
  const action = rule.action;
  if ((action.eventName || 'message') !== event.eventName) return null;

  if (action.operation === 'drop') {
    // The wire captured the event before the wrapper stopped delivery,
    // so a dropped event always has a row to mark.
    return filterTakes(action.messageFilter, event.data) ? 'inferred' : null;
  }

  if (isLiteralPayload(action.payload)) {
    // Strong for inject only: the event carries exactly what the rule
    // writes. A modify's replacement never reaches the wire (capture
    // sits before the wrapper), so equality there is meaningless.
    if (action.operation === 'inject') return event.data === action.payload ? 'applied' : null;
    return filterTakes(action.messageFilter, event.data) ? 'inferred' : null;
  }

  // Unresolved payload — equality is unavailable, selector only.
  if (action.operation === 'inject') return 'inferred';
  return filterTakes(action.messageFilter, event.data) ? 'inferred' : null;
}

function sseAttributionFor(tier: MessageFireTier, rule: SseRule): MessageFrameAttribution {
  const action = rule.action;
  const ruleUid = rule.uid;
  if (action.operation === 'drop') {
    return { tier, ruleUid, modification: { kind: 'dropped' } };
  }
  if (action.operation === 'modify' && isLiteralPayload(action.payload)) {
    // Receive-only: the wire holds the original, the replacement was
    // delivered in the page — `replaced-on-wire` is unreachable for sse.
    return { tier, ruleUid, modification: { kind: 'replaced-in-page', modified: action.payload } };
  }
  return { tier, ruleUid, modification: null };
}

/** Attribution for one sse event — the joined capture when present
 *  (proof), else across the row's fired `sse` rules: `applied` wins
 *  over `inferred`; `null` = nothing accounts for the event. */
export function sseEventAttribution(rules: readonly SseRule[], event: SseEventShape): MessageFrameAttribution | null {
  if (event.capture !== undefined) return captureAttribution(event.capture);
  let inferred: SseRule | null = null;
  for (const rule of rules) {
    const t = sseRuleEventTier(rule, event);
    if (t === 'applied') return sseAttributionFor('applied', rule);
    if (t === 'inferred' && inferred === null) inferred = rule;
  }
  return inferred === null ? null : sseAttributionFor('inferred', inferred);
}
