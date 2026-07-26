/**
 * Width-tier model for the DevTools panel's responsive chrome.
 *
 * The panel can be docked bottom (wide), left/right (narrow), or run
 * undocked — its width spans ~250px to full screen. Chrome adapts in
 * named tiers rather than ad-hoc pixel checks so every surface agrees
 * on when to collapse (mirrors the popup/sidepanel `oh-shell` tier
 * system in popup.less).
 *
 * All figures are CSS logical pixels of the PANEL (not the screen):
 * DPR, OS scaling, and DevTools zoom are already normalized by the
 * browser, and the chrome being measured against these thresholds has
 * fixed intrinsic sizes in the same unit.
 *
 * Two measurement scopes exist, deliberately:
 *   - Panel scope (these tiers, the `dt-panel` CSS container on
 *     `.dt-panel-root`): global chrome — toolbar, status bar, shell.
 *   - Pane scope (the `dt-pane` CSS container on each `.dt-panel`
 *     tool-window wrapper): per-tool content — a Storage window in a
 *     narrow dock compacts even when the panel itself is wide.
 *
 * Tier semantics (what each one drops — chrome only, never data):
 *   xl  ≥ 900   everything visible (the full-width bottom-dock design)
 *   lg  700–900 decoration goes — brand wordmark, footer version
 *   md  440–700 secondary toolbar controls fold into the ⋯ overflow
 *               menu; footer drops page milestones + tertiary chips
 *   sm  340–440 single-surface layout (one region OR the editor at a
 *               time); footer keeps counts + pills; region toggles fold
 *   xs  < 340   essentials only — icon-only everything
 *
 * The md lower bound is deliberately aggressive-low: with the md-tier
 * chrome already compacted (auto-compact table, icon rails, folded
 * toolbar) two columns stay workable down to ~440, and the
 * single-surface switch is the most disruptive transition — it should
 * be the last resort, not an early one.
 */

export type PanelWidthTier = 'xl' | 'lg' | 'md' | 'sm' | 'xs';

/** Tier lower bounds, in CSS px of the panel's inline size. */
export const TIER_XL_MIN_PX = 900;
export const TIER_LG_MIN_PX = 700;
export const TIER_MD_MIN_PX = 440;
export const TIER_SM_MIN_PX = 340;

/** Rank ascending with available width — for "at or below tier X" checks. */
const TIER_RANK: Record<PanelWidthTier, number> = { xs: 0, sm: 1, md: 2, lg: 3, xl: 4 };

export function tierForWidth(width: number): PanelWidthTier {
  if (width >= TIER_XL_MIN_PX) return 'xl';
  if (width >= TIER_LG_MIN_PX) return 'lg';
  if (width >= TIER_MD_MIN_PX) return 'md';
  if (width >= TIER_SM_MIN_PX) return 'sm';
  return 'xs';
}

/** True when `tier` is `bound` or narrower — the JSX twin of a
 *  `@container (max-width: …)` rule, for collapses that must move DOM
 *  (CSS can only hide). */
export function tierAtMost(tier: PanelWidthTier, bound: PanelWidthTier): boolean {
  return TIER_RANK[tier] <= TIER_RANK[bound];
}

/** Below this PANEL width the shell shows one surface at a time (the
 *  narrow single-surface layout) — side-by-side columns stop fitting
 *  once the hard minimums (rails + sidebar min + editor min) exceed
 *  the container. Equals the sm tier's upper bound by design. */
export const SINGLE_SURFACE_MAX_PX = TIER_MD_MIN_PX;

/** Below this PANE width the network table renders its compact layout
 *  (columns fit without horizontal scroll) regardless of the user's
 *  View-menu layout setting. Derived at render — never written back
 *  to the setting, so widening restores the user's choice. */
export const NETWORK_AUTO_COMPACT_MAX_PX = 560;
