/**
 * Tab → scope-kind classification. Pure mapping from the focused tab's
 * mode to what the Scope panel can filter to ("In Rule" / "In Request"
 * / "In Template"), plus the human label for the filter toggle.
 */

import type { TabMode, WorkbenchTab } from '../../../types';
import type { ScopeKind } from './types';

const RULE_TAB_MODES: ReadonlySet<TabMode> = new Set(['edit']);
const REQUEST_TAB_MODES: ReadonlySet<TabMode> = new Set(['request-edit', 'request-create']);
const TEMPLATE_TAB_MODES: ReadonlySet<TabMode> = new Set(['template-edit']);

export function getScopeKind(tab: WorkbenchTab | null): ScopeKind {
  if (!tab) return 'none';
  if (RULE_TAB_MODES.has(tab.mode)) return 'rule';
  if (REQUEST_TAB_MODES.has(tab.mode)) return 'request';
  if (TEMPLATE_TAB_MODES.has(tab.mode)) return 'template';
  return 'none';
}

/** Human-facing label for the "filter to this entity" button. */
export function getContextLabel(kind: ScopeKind): string | null {
  if (kind === 'rule') return 'In Rule';
  if (kind === 'request') return 'In Request';
  if (kind === 'template') return 'In Template';
  return null;
}
