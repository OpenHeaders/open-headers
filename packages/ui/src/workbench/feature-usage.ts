/**
 * Workbench feature-usage mapping for product telemetry
 * (`TELEMETRY_PLAN.md` §3): which editor-tab modes count as the first
 * meaningful use of a vocabulary feature. Rule tabs are deliberately
 * absent — `rule_created` carries the rule signal. The host session
 * latch dedupes per session; `noteFeatureUsed` guards per document.
 */

import type { TelemetryFeatureId } from '@openheaders/core/telemetry';
import { noteFeatureUsed } from '@openheaders/ui/shared/product-telemetry';
import type { TabMode, ToolWindowId } from './types';

const TAB_MODE_FEATURES: Partial<Record<TabMode, TelemetryFeatureId>> = {
  'request-edit': 'request-editor',
  'request-create': 'request-editor',
  'template-edit': 'template-editor',
  'live-workflow-edit': 'workflow-editor',
  'live-workflow-create': 'workflow-editor',
  'live-vars': 'live-sources',
  'live-variable-edit': 'live-sources',
  'live-variable-create': 'live-sources',
  vault: 'vault',
  'script-packages': 'devtools-scripts',
  'workspace-vars': 'variables',
  'collection-vars': 'variables',
  'request-collection-vars': 'variables',
  'template-collection-vars': 'variables',
  'env-edit': 'variables',
  'spec-edit': 'api-specs',
  'response-example': 'response-examples',
  'grpc-response-example': 'response-examples',
  'ws-response-example': 'response-examples',
  'grpc-edit': 'grpc-client',
  'websocket-edit': 'ws-client',
  'whats-new': 'whats-new',
};

/** Record the feature a freshly-opened workbench tab represents, if any. */
export function noteTabFeatureUsed(mode: TabMode): void {
  const feature = TAB_MODE_FEATURES[mode];
  if (feature) noteFeatureUsed(feature);
}

/**
 * Which activated tool windows count as the first meaningful use of a
 * vocabulary feature — the dock analog of the tab-mode map above (S17).
 * Only surfaces with a real working plane behind them are listed; the
 * ambient inspectors (notifications, docs, variable scope) carry no
 * adoption question.
 */
export const TOOL_WINDOW_FEATURES: Partial<Record<ToolWindowId, TelemetryFeatureId>> = {
  commit: 'git-commit',
  git: 'git-log',
  terminal: 'terminal',
  'traffic-monitor': 'traffic-monitor',
  activity: 'activity-feed',
};

/** Record the feature an activated workbench tool window represents, if any. */
export function noteToolWindowFeatureUsed(id: ToolWindowId): void {
  const feature = TOOL_WINDOW_FEATURES[id];
  if (feature) noteFeatureUsed(feature);
}
