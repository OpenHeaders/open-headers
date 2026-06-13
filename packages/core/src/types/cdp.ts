/**
 * CDP attach-scope vocabulary — which tabs the debugging-protocol control
 * plane pulls into its attached set when the master switch is on.
 *
 * A user preference, shared by the `inspection.cdpScope` setting and the
 * service-worker attach reconciler. The master switch (`inspection.cdpEnabled`)
 * is the orthogonal on/off axis; this only chooses the breadth once on.
 *
 *   - `devtools` — tabs with their DevTools open (default; the original
 *     behaviour). Detaches when DevTools closes.
 *   - `active`   — the current attachable tab, follows focus, no DevTools
 *     needed. Switching to a non-attachable page (new-tab / `chrome://`)
 *     leaves the prior attachment in place rather than thrashing it.
 *   - `both`     — the union of the two.
 *
 * Explicit per-tab pins are an additive overlay on top of whichever mode is
 * selected, not a mode of their own.
 */

import * as v from 'valibot';

export const cdpScopeModeSchema = v.picklist(['devtools', 'active', 'both']);

export type CdpScopeMode = v.InferOutput<typeof cdpScopeModeSchema>;
