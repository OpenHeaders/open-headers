/**
 * Type-default rule builders.
 *
 * Every "create a rule" gesture in the product — workbench `+ New Rule`,
 * popup "This Page Rules" CTAs, devtools-panel inline create, command
 * palette, sidebar context menus, future CLI seeding — eventually flows
 * through one entry point (`openCreateTab` in
 * `apps/extension/src/workbench/hooks/useTabOpeners.tsx`, reached by
 * external surfaces via the `workbench.html#/create/<type>/draft-<nonce>`
 * deeplink + `useWorkspaceIntentRouter`). That entry point creates a
 * real entity from the click — Linear / Notion / Replicache pattern. To
 * do that it needs a structurally valid `V5.Rule` for each type before
 * the user has filled anything in: the action shape per variant, an
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

import type { V5 } from '../types';

export type RuleSeed = Omit<V5.Rule, 'uid' | 'path' | 'schemaVersion'>;

export function buildEmptyRule(type: V5.RuleType, name: string): RuleSeed {
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
  }
}
