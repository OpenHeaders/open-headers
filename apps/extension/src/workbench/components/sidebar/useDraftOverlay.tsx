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
 * Index every `request-create` tab by its user-chosen destination so
 * the tree builders can splice draft rows in under the right
 * collection / folder. Key shape: `${collectionId}|${folderPath}` —
 * `folderPath: ''` means collection root. Drafts without a
 * `preferredCollectionId` are skipped: there's nowhere to render them yet.
 *
 * Rule drafts no longer flow through here — `+ New Rule` mints a real
 * entity at click time, so the rule itself appears in the sidebar tree
 * via the standard rule node path. Its draft state is conveyed by the
 * `row-draft` styling derived from `isRuleDraft(rule)`.
 *
 * Workflow drafts (`live-workflow-create`) are collected in a flat list
 * rather than a by-location map — the Sources view is a flat list of
 * workflows, no collections/folders to nest under, so drafts simply
 * render at the top of the list with a "draft" badge.
 */
export function useDraftOverlay({ allTabs, onSwitchTab, onCloseDraftTab }: UseDraftOverlayParams) {
  const draftsByLocation = useMemo(() => {
    const rule = new Map<string, WorkbenchTab[]>();
    const request = new Map<string, WorkbenchTab[]>();
    if (!allTabs) return { rule, request };
    for (const tab of allTabs) {
      if (!tab.preferredCollectionId) continue;
      const key = `${tab.preferredCollectionId}|${tab.preferredFolderPath ?? ''}`;
      if (tab.mode === 'request-create') {
        const list = request.get(key);
        if (list) list.push(tab);
        else request.set(key, [tab]);
      }
    }
    return { rule, request };
  }, [allTabs]);

  const workflowDrafts = useMemo(() => {
    if (!allTabs) return [] as WorkbenchTab[];
    return allTabs.filter((tab) => tab.mode === 'live-workflow-create');
  }, [allTabs]);

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
