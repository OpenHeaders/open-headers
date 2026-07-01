/**
 * CrossLeafInsertionMarker — a read-only pill rendered into the target
 * leaf's tab list while a tab from another leaf is being dragged over
 * it. Uses the shared empty-placeholder style so it's visually identical
 * to the source placeholder, and renders TabPillContent in hidden mode
 * so its width matches the dragged tab's natural size.
 */

import { theme } from 'antd';
import type React from 'react';
import type { WorkbenchTab } from '../../types';
import TabPillContent from './TabPillContent';
import { type TabEntityLookups, emptyPlaceholderStyle } from './tab-format';

interface CrossLeafInsertionMarkerProps extends TabEntityLookups {
  tab: WorkbenchTab;
  displayLabel: string;
  token: ReturnType<typeof theme.useToken>['token'];
}

const CrossLeafInsertionMarker: React.FC<CrossLeafInsertionMarkerProps> = ({
  tab,
  displayLabel,
  rules,
  templates,
  requests,
  pausedUids,
  unresolvableRuleUids,
  unresolvableRequestUids,
  liveWorkflows,
  unresolvableWorkflowUids,
  token,
}) => (
  <div
    aria-hidden="true"
    className="rules-tab"
    style={{ ...emptyPlaceholderStyle(token), pointerEvents: 'none', flexShrink: 0 }}
  >
    <TabPillContent
      tab={tab}
      displayLabel={displayLabel}
      rules={rules}
      templates={templates}
      requests={requests}
      pausedUids={pausedUids}
      unresolvableRuleUids={unresolvableRuleUids}
      unresolvableRequestUids={unresolvableRequestUids}
      liveWorkflows={liveWorkflows}
      unresolvableWorkflowUids={unresolvableWorkflowUids}
      closeIconColor={token.colorTextTertiary}
      hidden
    />
  </div>
);

export default CrossLeafInsertionMarker;
