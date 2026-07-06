/**
 * Terminal-shadow compilation — the cross-plane arbitration seam.
 *
 * DNR resolves conflicts by priority with terminal actions winning: a
 * `block` (priority 200) beats every non-terminal rule on the same
 * request. The in-page wrappers (delay, request-body, response) act
 * BEFORE the request reaches DNR, so without arbitration they compose
 * wrongly with block: a delay holds the request its block will kill, and
 * a mock response serves a body for a request the user asked to block —
 * the mock never touches the network, silently defeating the block.
 *
 * This module compiles the effective block rules into regex sources the
 * wrappers can evaluate per-request (same dialect as
 * `compileRuleForInjection`). A wrapper whose own selector takes a
 * request FIRST tests it against these terminal sources — a hit means a
 * block rule owns the request, so the wrapper stands down (no action, no
 * fire) and lets the request proceed straight to its DNR fate.
 *
 * Eligibility is CONSERVATIVE: only block rules whose conditions the
 * wrapper can faithfully evaluate in-page are folded. The wrapper knows
 * the request URL and nothing else, so:
 *
 *   - `url-filter` / `url-regex` / `request-domains` — evaluable, they
 *     compile into the terminal sources.
 *   - `resource-types` — foldable only when it includes `xhr`: every
 *     wrapped request is fetch/XHR, so a block scoped to other resource
 *     types would never take these requests.
 *   - `exclude-resource-types` — foldable only when it does NOT list
 *     `xhr` (the block still takes fetch/XHR).
 *   - anything else (methods, headers, initiator/domain gates) — the
 *     wrapper cannot evaluate it, so the rule is skipped entirely.
 *
 * Skipping errs toward NO suppression: the worst case is today's
 * behavior (wrapper acts, DNR blocks after), never a wrapper standing
 * down for a request the block would not have taken.
 */

import type { Rule } from '@openheaders/core/types';
import { compileRuleForInjection } from '@openheaders/core/utils';

const FOLDABLE_CONDITION_TYPES = new Set(['url-filter', 'url-regex', 'request-domains']);

/** Can this block rule's full condition set be evaluated in-page against
 *  a fetch/XHR request URL? */
function isTerminalFoldable(rule: Rule): boolean {
  for (const cond of rule.conditions) {
    if (FOLDABLE_CONDITION_TYPES.has(cond.type)) continue;
    if (cond.type === 'resource-types') {
      if (!cond.values.includes('xhr')) return false;
      continue;
    }
    if (cond.type === 'exclude-resource-types') {
      if (cond.values.includes('xhr')) return false;
      continue;
    }
    return false;
  }
  return true;
}

/**
 * Compile the effective rules' terminal (block) matchers into regex
 * sources for the wrapper configs. Empty array = no terminal shadow,
 * wrappers act unconditionally (today's behavior).
 */
export function compileTerminalBlockSources(rules: readonly Rule[]): string[] {
  const sources: string[] = [];
  for (const rule of rules) {
    if (rule.type !== 'block') continue;
    if (!isTerminalFoldable(rule)) continue;
    sources.push(...compileRuleForInjection(rule));
  }
  return sources;
}
