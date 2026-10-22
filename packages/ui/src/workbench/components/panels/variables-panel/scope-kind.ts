/**
 * Tab → scope-kind classification. Pure mapping from the focused tab's
 * mode to what the Scope panel can filter to (rule / request / template),
 * driving the "In ‹entity›" section title and the in-context resolution.
 * Every request editor — HTTP and the four wire kinds alike — reads as
 * `request`; the context resolver tells the kinds apart by the tab mode.
 */

import type { TabMode, WorkbenchTab } from '../../../types';
import type { ScopeKind } from './types';

const RULE_TAB_MODES: ReadonlySet<TabMode> = new Set(['edit']);
const REQUEST_TAB_MODES: ReadonlySet<TabMode> = new Set([
  'request-edit',
  'request-create',
  'grpc-edit',
  'websocket-edit',
  'mqtt-edit',
  'graphql-edit',
]);
const TEMPLATE_TAB_MODES: ReadonlySet<TabMode> = new Set(['template-edit']);

export function getScopeKind(tab: WorkbenchTab | null): ScopeKind {
  if (!tab) return 'none';
  if (RULE_TAB_MODES.has(tab.mode)) return 'rule';
  if (REQUEST_TAB_MODES.has(tab.mode)) return 'request';
  if (TEMPLATE_TAB_MODES.has(tab.mode)) return 'template';
  return 'none';
}
