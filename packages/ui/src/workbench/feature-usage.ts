/**
 * Workbench feature-usage mapping for product telemetry
 * (`TELEMETRY_PLAN.md` §3): which editor-tab modes count as the first
 * meaningful use of a vocabulary feature. Rule tabs are deliberately
 * absent — `rule_created` carries the rule signal. The host session
 * latch dedupes per session; `noteFeatureUsed` guards per document.
 */

import type { TelemetryFeatureId } from '@openheaders/core/telemetry';
import { noteFeatureUsed } from '@openheaders/ui/shared/product-telemetry';
import type { TabMode } from './types';

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
};

/** Record the feature a freshly-opened workbench tab represents, if any. */
export function noteTabFeatureUsed(mode: TabMode): void {
  const feature = TAB_MODE_FEATURES[mode];
  if (feature) noteFeatureUsed(feature);
}
