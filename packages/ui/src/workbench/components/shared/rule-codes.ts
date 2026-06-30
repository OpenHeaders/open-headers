/**
 * Short rule-type codes — the single source of truth for the text codes
 * shown in place of a line glyph wherever a rule type appears: the
 * create/picker menus (neutral gradient, via `ruleTypeBadge`) and real
 * rule rows/tabs (state-colored, via `buildRuleIcon`).
 *
 * Kept in its own tiny module so both `rule-type-menu.tsx` (heavier —
 * pulls in Ant icons + templates) and `rule-icon.ts` can import it
 * without a circular dependency.
 */

import type { ExtensionRuleType } from '@openheaders/core/types';

export const RULE_TYPE_CODES: Record<ExtensionRuleType, string> = {
  header: 'HEAD',
  block: 'BLOCK',
  redirect: 'REDIR',
  'query-param': 'QUERY',
  inject: 'JS/CSS',
  'request-body': 'REQ',
  delay: 'DELAY',
  response: 'RES',
  ws: 'WS',
  sse: 'SSE',
  auth: 'AUTH',
};
