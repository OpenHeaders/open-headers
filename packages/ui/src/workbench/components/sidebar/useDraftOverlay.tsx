import { createElement, useCallback, useMemo } from 'react';
import type { WorkbenchTab } from '../../types';
import { buildRuleIcon } from '../shared/rule-icon';
import { composeBadge, methodTag } from './icons';
import type { TreeNode } from './types';

interface UseDraftOverlayParams {
  allTabs?: WorkbenchTab[];
  onSwitchTab?: (tabId: string) => void;
  onCloseDraftTab?: (tabId: string) => void;
}

/**
 * Sidebar = list of PERSISTED entities. Scratch tabs are ephemeral
 * tab-strip state — closing the tab discards them — so they are NOT
 * surfaced in the sidebar tree. Their feedback channel is the tab strip
 * itself: gray prefix icon + gray dot + lifecycle chip ("Scratch") in
 * the editor header.
 *
 * The `*DraftNode` builders + `draftsByLocation`/`workflowDrafts`
 * shapes are retained so call sites stay typed; `draftsByLocation`
 * always returns empty maps and `workflowDrafts` an empty array — the
 * tree composers see "no drafts to splice" and render the saved-only
 * tree.
 */
export function useDraftOverlay({ allTabs: _allTabs, onSwitchTab, onCloseDraftTab }: UseDraftOverlayParams) {
  const draftsByLocation = useMemo(
    () => ({ rule: new Map<string, WorkbenchTab[]>(), request: new Map<string, WorkbenchTab[]>() }),
    [],
  );

  const workflowDrafts = useMemo(() => [] as WorkbenchTab[], []);

  const buildRuleDraftNode = useCallback(
    (tab: WorkbenchTab, depth: number, parentId: string): TreeNode => ({
      id: `draft-${tab.id}`,
      kind: 'leaf',
      label: tab.draftName ?? tab.label,
      depth,
      expandable: false,
      parentId,
      icon: buildRuleIcon({ ruleType: tab.ruleType, isActive: false, paused: false }),
      // Scratch (never persisted) — no dirty dot; the "scratch" badge
      // itself communicates "unsaved", same vocabulary as the editor's
      // lifecycle chip + tab strip's gray dot.
      badge: composeBadge({ label: 'scratch', color: 'var(--ant-color-text-tertiary, #999)' }, false),
      canRename: false,
      canDelete: true,
      canAddChild: false,
      onOpen: () => onSwitchTab?.(tab.id),
      onDelete: () => onCloseDraftTab?.(tab.id),
    }),
    [onSwitchTab, onCloseDraftTab],
  );

  const buildRequestDraftNode = useCallback(
    (tab: WorkbenchTab, depth: number, parentId: string): TreeNode => ({
      id: `draft-${tab.id}`,
      kind: 'leaf',
      label: tab.draftName ?? tab.label,
      depth,
      expandable: false,
      parentId,
      icon: methodTag(tab.ruleType, true),
      // Scratch (never persisted) — no dirty dot; the "scratch" badge
      // itself communicates "unsaved", same vocabulary as the editor's
      // lifecycle chip + tab strip's gray dot.
      badge: composeBadge({ label: 'scratch', color: 'var(--ant-color-text-tertiary, #999)' }, false),
      canRename: false,
      canDelete: true,
      canAddChild: false,
      onOpen: () => onSwitchTab?.(tab.id),
      onDelete: () => onCloseDraftTab?.(tab.id),
    }),
    [onSwitchTab, onCloseDraftTab],
  );

  const buildWorkflowDraftNode = useCallback(
    (tab: WorkbenchTab): TreeNode => ({
      id: `draft-${tab.id}`,
      kind: 'leaf',
      label: tab.draftName ?? tab.label,
      depth: 0,
      expandable: false,
      // Grey-dot icon matches the "never refreshed" state of freshly-
      // persisted workflows, so draft ↔ new-workflow sits at the same
      // rung visually. Differentiation is the "draft" badge, not the icon.
      icon: createElement('span', {
        style: {
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'var(--ant-color-text-tertiary, #999)',
          marginRight: 2,
        },
      }),
      // Scratch (never persisted) — no dirty dot; the "scratch" badge
      // itself communicates "unsaved", same vocabulary as the editor's
      // lifecycle chip + tab strip's gray dot.
      badge: composeBadge({ label: 'scratch', color: 'var(--ant-color-text-tertiary, #999)' }, false),
      canRename: false,
      canDelete: true,
      canAddChild: false,
      onOpen: () => onSwitchTab?.(tab.id),
      onDelete: () => onCloseDraftTab?.(tab.id),
    }),
    [onSwitchTab, onCloseDraftTab],
  );

  return { draftsByLocation, workflowDrafts, buildRuleDraftNode, buildRequestDraftNode, buildWorkflowDraftNode };
}
