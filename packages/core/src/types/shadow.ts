/**
 * Shadow arbitration result types.
 *
 * The runtime arbitrator lives in the rule-engine package; these are the
 * pure data shapes it stamps onto observed fires (and that the UI reads
 * back when rendering attribution).
 */

/** The reason a rule was shadowed. Each kind maps to a distinct diagnostic message in the UI. */
export type ShadowKind =
  | 'block-terminal'
  | 'redirect-retarget'
  | 'query-param-retarget'
  | 'mock-intercept'
  | 'header-stacking-ambiguous';

/**
 * Attribution for a shadowed rule. `uid` / `name` point at the rule that
 * caused the shadow (the "shadower"); `kind` classifies why.
 */
export interface ShadowAttribution {
  uid: string;
  name: string;
  kind: ShadowKind;
}
