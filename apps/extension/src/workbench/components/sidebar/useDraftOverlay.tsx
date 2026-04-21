import { useCallback, useMemo } from 'react';
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
 * Index every `create` / `request-create` tab by its user-chosen
 * destination so the tree builders can splice draft rows in under the
 * right collection / folder. Key shape: `${collectionId}|${folderPath}` —
 * `folderPath: ''` means collection root. Drafts without a
 * `preferredCollectionId` are skipped: there's nowhere to render them yet.
 */
export function useDraftOverlay({ allTabs, onSwitchTab, onCloseDraftTab }: UseDraftOverlayParams) {
  const draftsByLocation = useMemo(() => {
    const rule = new Map<string, WorkbenchTab[]>();
    const request = new Map<string, WorkbenchTab[]>();
    if (!allTabs) return { rule, request };
    for (const tab of allTabs) {
      if (!tab.preferredCollectionId) continue;
      const key = `${tab.preferredCollectionId}|${tab.preferredFolderPath ?? ''}`;
      if (tab.mode === 'create') {
        const list = rule.get(key);
        if (list) list.push(tab);
        else rule.set(key, [tab]);
      } else if (tab.mode === 'request-create') {
        const list = request.get(key);
        if (list) list.push(tab);
        else request.set(key, [tab]);
      }
    }
    return { rule, request };
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
      badge: composeBadge({ label: 'draft', color: 'var(--ant-color-text-tertiary, #999)' }, true),
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
      badge: composeBadge({ label: 'draft', color: 'var(--ant-color-text-tertiary, #999)' }, true),
      canRename: false,
      canDelete: true,
      canAddChild: false,
      onOpen: () => onSwitchTab?.(tab.id),
      onDelete: () => onCloseDraftTab?.(tab.id),
    }),
    [onSwitchTab, onCloseDraftTab],
  );

  return { draftsByLocation, buildRuleDraftNode, buildRequestDraftNode };
}
