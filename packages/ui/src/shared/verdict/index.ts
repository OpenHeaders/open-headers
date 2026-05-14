/**
 * UI metadata for rule verdicts — labels, colors, tooltips, and sort
 * ranks. Kept separate from the engine so the background (which
 * computes verdicts) never takes a dependency on UI concerns, and so
 * multiple UIs (popup, devtools panel, workspace inspector) can share
 * one vocabulary.
 *
 * Every lookup table is keyed by `RuleVerdict`, so adding a new
 * verdict value forces a TypeScript error at each table until the
 * new entry is added — no silent drift between engine and UI.
 */

import type { RuleVerdict } from '@openheaders/core/types';

export type { RuleVerdict } from '@openheaders/core/types';

/**
 * Sort rank — lower = stronger signal. Used by the popup's primary
 * sort so firing rules rank above silent, which rank above page, etc.,
 * regardless of the secondary sort mode the user picked.
 */
export const VERDICT_RANK: Record<RuleVerdict, number> = {
  firing: 0,
  silent: 1,
  page: 2,
  related: 3,
  idle: 4,
};

/**
 * Short chip/tag label rendered inline with the rule name. Kept to a
 * single word so the chip fits alongside the count tag without
 * wrapping the row. The popup hides the chip when `verdict === 'firing'`
 * because the blue count tag already conveys that.
 */
export const VERDICT_LABEL: Record<RuleVerdict, string> = {
  firing: 'Firing',
  silent: 'Silent',
  page: 'Page',
  related: 'Related',
  idle: 'Idle',
};

/**
 * Ant Design tag color token. Chosen for semantic hierarchy:
 *   - firing  → blue filled count tag; this token is used only for
 *               tooltip accents when layered elsewhere.
 *   - silent  → gold (warning, cached; action suppressed).
 *   - page    → cyan (info, pattern match only).
 *   - related → default gray (weakest signal).
 *   - idle    → default gray (no signal).
 */
export const VERDICT_COLOR: Record<RuleVerdict, string> = {
  firing: 'blue',
  silent: 'gold',
  page: 'cyan',
  related: 'default',
  idle: 'default',
};

/**
 * Default tooltip shown when a row's own `verdictReason` string is
 * absent. Explains what the verdict means in user-facing terms.
 * Consumers should prefer `record.verdictReason` (per-row engine
 * output) and fall back to this only when the engine didn't render a
 * specific reason.
 */
export const VERDICT_TOOLTIP: Record<RuleVerdict, string> = {
  firing: 'Rule has fired on this page — its action ran on at least one request',
  silent:
    "Rule's pattern matched a subresource but the response was served from cache, so the action could not run. Reload bypassing cache to force a fresh request.",
  page: "Rule's pattern matches the current page URL — no matching subresources have been observed yet",
  related: 'Rule targets the same domain as this page but has no specific URL match yet',
  idle: 'Rule is enabled but has no verdict signal on this page',
};
