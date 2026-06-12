/**
 * Type-default rule builders.
 *
 * Every "create a rule" gesture in the product creates a real entity
 * from the click — Linear / Notion / Replicache pattern. The gesture
 * surfaces are heterogeneous:
 *
 *   - workbench `+ New Rule` button + sidebar context menus
 *   - popup "This Page Rules" CTAs + popup template picker
 *   - devtools-panel inline create + "override this header" CTA
 *   - command palette (Create Rule, New Header Rule, …)
 *   - inspector handoff (URL → conditions, headers → action)
 *   - future CLI seeding
 *
 * Heterogeneous in *origin*, but all funnel through the same renderer
 * entry point: `openCreateTab` in
 * `apps/extension/src/workbench/hooks/useTabOpeners.tsx`. Surfaces that
 * live outside the workbench (popup, devpanel, deeplink) reach it by
 * navigating to `workbench.html#/create/<type>/draft-<nonce>` —
 * `useWorkspaceIntentRouter` decodes the hash + dispatches the same
 * `openCreateTab(type, context, templateKey, initialDraft)` call.
 *
 * `openCreateTab` builds a structurally valid `Rule` seed using this
 * helper, applies any per-gesture overlays (template values, draft
 * pre-fill), fires `applyRuleCreate` against the local oracle, and
 * opens the resulting uid in an edit tab. The entity is real from the
 * first render — `published: false` until the user clicks Save.
 *
 * A "structurally valid" seed means: the action shape per variant, an
 * empty conditions list, and a placeholder name the editor's auto-
 * rename gesture can replace.
 *
 * Kept in core so renderer + (future) CLI / desktop create flows agree
 * on the same defaults. The output omits `uid` / `path` / `schemaVersion`
 * because those are minted by the write-client at apply time
 * (`applyRuleCreate`) — the seed only carries the user-shaped fields.
 *
 * `published` is intentionally **not** set on the output. The write-
 * client owns the publication-gate invariant (`+ New Rule` always emits
 * `published: false`) so this helper can stay honest about what the
 * USER asked for vs. what the publication contract requires.
 */

import type { Rule, RuleType } from '../types';
export type RuleSeed = Omit<Rule, 'uid' | 'path' | 'schemaVersion'>;

export function buildEmptyRule(type: RuleType, name: string): RuleSeed {
  const base = { name, enabled: true, conditions: [] };
  switch (type) {
    case 'header':
      return {
        ...base,
        type: 'header',
        action: { requestHeaders: [], responseHeaders: [] },
      };
    case 'redirect':
      return {
        ...base,
        type: 'redirect',
        action: { redirectTo: '' },
      };
    case 'body':
      return {
        ...base,
        type: 'body',
        action: { bodyType: 'static', body: '', resourceType: 'rest' },
      };
    case 'inject':
      return {
        ...base,
        type: 'inject',
        action: { injectType: 'script', code: '', source: 'code', position: 'head' },
      };
    case 'block':
      return {
        ...base,
        type: 'block',
        action: {},
      };
    case 'delay':
      return {
        ...base,
        type: 'delay',
        action: { delayMs: 0 },
      };
    case 'mock':
      return {
        ...base,
        type: 'mock',
        action: {
          statusCode: 200,
          responseHeaders: {},
          responseBody: '',
          contentType: 'application/json',
          bodyType: 'static',
        },
      };
    case 'query-param':
      return {
        ...base,
        type: 'query-param',
        action: { params: [] },
      };
    case 'ws':
      // 'receive' + 'modify' is the most common gesture: rewrite what
      // the server pushes to the page while developing against it.
      return {
        ...base,
        type: 'ws',
        action: { operation: 'modify', direction: 'receive', payload: '' },
      };
    case 'sse':
      return {
        ...base,
        type: 'sse',
        action: { operation: 'modify', payload: '' },
      };
  }
}
