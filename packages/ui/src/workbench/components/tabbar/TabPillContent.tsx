/**
 * TabPillContent — pure presentational content for one tab: icon,
 * label, unsaved dot, optional close affordance. Used by both the
 * interactive SortableTab wrapper and the read-only cross-leaf insertion
 * marker so they share a single source of truth for tab layout/sizing.
 *
 * `hidden` renders the content with `visibility: hidden` so its width
 * and height still contribute to layout but nothing paints — that's how
 * SortableTab's in-place placeholder and the cross-leaf insertion marker
 * both look like a pure blue dashed rectangle while keeping the same
 * footprint as a real tab.
 */

import { CloseOutlined, PushpinFilled } from '@ant-design/icons';
import type React from 'react';
import type { WorkbenchTab } from '../../types';
import { type TabEntityLookups, isCreateDraftMode, isRuleDraftTab, renderTabLabel, tabIcon } from './tab-format';

interface TabPillContentProps extends TabEntityLookups {
  tab: WorkbenchTab;
  /** Live-derived display label — pre-computed by the parent via
   *  `tabDisplayLabel(tab, lookups)`. Reads here instead of `tab.label`
   *  so a rename in any surface lands without an imperative sync hook. */
  displayLabel: string;
  onClose?: (id: string) => void;
  closeIconColor: string;
  hidden?: boolean;
}

const TabPillContent: React.FC<TabPillContentProps> = ({
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
  onClose,
  closeIconColor,
  hidden,
}) => {
  const inner = (
    <>
      <span className="rules-type-badge">
        {tabIcon(
          tab,
          rules,
          templates,
          pausedUids,
          requests,
          unresolvableRequestUids,
          unresolvableRuleUids,
          liveWorkflows,
          unresolvableWorkflowUids,
        )}
      </span>
      <span className="rules-tab-label" style={isRuleDraftTab(tab, rules) ? { fontStyle: 'italic' } : undefined}>
        {renderTabLabel(tab, displayLabel)}
      </span>
      {/* Env-pin marker — this tab drives the active environment while
          focused. Without it, env flapping between tabs reads as a bug. */}
      {tab.pinnedEnvId !== undefined && (
        <PushpinFilled className="rules-tab-env-pin" style={{ fontSize: 9, opacity: 0.65 }} aria-label="Environment pinned" />
      )}
      {/* Gray dot signals a not-yet-persisted scratch tab (always wins
          over orange so the "scratch vs real entity" distinction reads
          regardless of dirty edits). Orange dot only fires on a
          persisted entity whose form has uncommitted edits. */}
      {(isCreateDraftMode(tab) || tab.dirty) && (
        <span className="rules-tab-unsaved" style={{ background: isCreateDraftMode(tab) ? '#999' : '#ff7875' }} />
      )}
      {onClose && (
        <CloseOutlined
          className="rules-tab-close"
          style={{ fontSize: 10, color: closeIconColor }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onClose(tab.id);
          }}
        />
      )}
    </>
  );
  if (!hidden) return inner;
  return (
    <span style={{ display: 'contents', visibility: 'hidden' }} aria-hidden="true">
      {inner}
    </span>
  );
};

export default TabPillContent;
