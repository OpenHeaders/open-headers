/**
 * Shared types for the DevTools Inspector panel.
 *
 * Row data lives on `InspectorRow` / `InspectorRowWithFires`
 * (see `inspector-facet.ts` and `inspector-row-projection.ts`); the
 * lifecycle itself comes from `@openheaders/core/request-lifecycle`.
 * This file is now scoped to the fire-attribution layer.
 *
 * Fires augment rows when their URL matches a rule. Unmatched fires
 * (request blocked before HAR landed, served from cache without DNR
 * feedback, scriptable-only fires) surface as "dangling" — same
 * `InspectorFire` shape, no row.
 */

import type { RequestRecord, RuleSnapshot } from '@openheaders/core/types';

/**
 * Per-rule fire attached to an inspector row. `authoritative`
 * distinguishes engine-confirmed DNR fires (Chrome/Edge only — the
 * platform told us this rule actually executed) from tab-telemetry's
 * inferred URL-matching path.
 *
 * `requestId` is the host's network-request identifier — present for
 * every network-observed fire and used as the deterministic join key to
 * the lifecycle. Scriptable fires adopt it from the observation they
 * confirm; absent only when no network observation exists for the fire.
 */
export interface InspectorFire {
  ruleUid: string;
  t: number;
  pattern: string;
  authoritative: boolean;
  requestId?: string;
  shadowedBy?: RequestRecord['shadowedBy'];
  evidence: RequestRecord['evidence'];
  /** Frozen rule snapshot captured at fire-emit time in the background.
   *  Authoritative source for what the row should display — prevents
   *  later edits to the live rule from rewriting historical attribution.
   *  See `RuleSnapshot` doc in `types/telemetry.ts`. */
  ruleSnapshot?: RuleSnapshot;
}

/**
 * "Rule actually ran" predicate. True when we have ground-truth evidence
 * the action executed — either:
 *
 *   - `authoritative`: the engine reported this DNR rule executed on the wire.
 *   - `evidence === 'confirmed'`: the in-page fire-bridge reported the
 *     scriptable action ran inside the page.
 *
 * Both signals are equivalently strong from the user's POV.
 */
export function isAppliedFire(fire: InspectorFire): boolean {
  return fire.authoritative || fire.evidence === 'confirmed';
}
