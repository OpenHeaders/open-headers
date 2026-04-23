import type { V5 } from '@openheaders/core/types';
import { useCallback } from 'react';
import type { SidebarView } from './types';

interface UseSelectOpenedTabParams {
  activeTabId?: string | null;
  view: SidebarView;
  localCollectionTrees: readonly { uid: string; tree: V5.TreeNode[] }[];
  templateCollectionTrees: readonly { uid: string; tree: V5.TreeNode[] }[];
  requestCollectionTrees: readonly { uid: string; tree: V5.TreeNode[] }[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  setExpandedKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSectionsExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setFocusedId: (id: string | null) => void;
}

/**
 * "Select Opened Tab" — expand ancestors, focus, and scroll to the
 * active tab's sidebar node. Returns true if found + selected.
 */
export function useSelectOpenedTab({
  activeTabId,
  view,
  localCollectionTrees,
  templateCollectionTrees,
  requestCollectionTrees,
  containerRef,
  setExpandedKeys,
  setSectionsExpanded,
  setFocusedId,
}: UseSelectOpenedTabParams): () => boolean {
  return useCallback((): boolean => {
    if (!activeTabId) return false;

    let nodeId: string | null = null;
    let section: 'rules' | 'templates' = 'rules';

    if (activeTabId.startsWith('edit-')) {
      nodeId = `rule-${activeTabId.replace('edit-', '')}`;
    } else if (activeTabId.startsWith('tpl-edit-')) {
      nodeId = `tpl-${activeTabId.replace('tpl-edit-', '')}`;
      section = 'templates';
    } else if (activeTabId.startsWith('tpl-col-') || activeTabId.startsWith('tpl-folder-')) {
      nodeId = activeTabId;
      section = 'templates';
    } else if (activeTabId.startsWith('col-') || activeTabId.startsWith('folder-')) {
      nodeId = activeTabId;
    } else if (activeTabId.startsWith('env-')) {
      nodeId = activeTabId;
      setSectionsExpanded((prev) => ({ ...prev, environments: true }));
      setFocusedId(nodeId);
      setTimeout(() => {
        containerRef.current?.querySelector(`[data-item-id="${nodeId}"]`)?.scrollIntoView({ block: 'nearest' });
      }, 50);
      return true;
    } else if (activeTabId.startsWith('live-wf-')) {
      nodeId = `workflow-${activeTabId.replace('live-wf-', '')}`;
      setSectionsExpanded((prev) => ({ ...prev, workflows: true }));
      setFocusedId(nodeId);
      setTimeout(() => {
        containerRef.current?.querySelector(`[data-item-id="${nodeId}"]`)?.scrollIntoView({ block: 'nearest' });
      }, 50);
      return true;
    } else if (activeTabId.startsWith('request-') && view === 'api-requests') {
      nodeId = activeTabId;
      const targetUid = activeTabId.replace('request-', '');
      let found: { ancestors: string[] } | null = null;
      for (const col of requestCollectionTrees) {
        const colKey = `req-col-${col.uid}`;
        const walk = (nodes: V5.TreeNode[], trail: string[]): string[] | null => {
          for (const n of nodes) {
            if (n.type === 'request' && n.uid === targetUid) return trail;
            if (n.type === 'folder') {
              const r = walk(n.children, [...trail, `req-folder-${n.uid}`]);
              if (r) return r;
            }
          }
          return null;
        };
        const result = walk(col.tree, [colKey]);
        if (result) {
          found = { ancestors: result };
          break;
        }
      }
      if (found) {
        setExpandedKeys((prev) => {
          const next = new Set(prev);
          for (const k of found.ancestors) next.add(k);
          return next;
        });
        setSectionsExpanded((prev) => ({ ...prev, 'api-requests': true }));
        setFocusedId(nodeId);
        setTimeout(() => {
          containerRef.current?.querySelector(`[data-item-id="${nodeId}"]`)?.scrollIntoView({ block: 'nearest' });
        }, 50);
        return true;
      }
      return false;
    } else if (activeTabId === 'vault' && view === 'variables') {
      setSectionsExpanded((prev) => ({ ...prev, vault: true }));
      setFocusedId('vault-row');
      setTimeout(() => {
        containerRef.current?.querySelector(`[data-item-id="vault-row"]`)?.scrollIntoView({ block: 'nearest' });
      }, 50);
      return true;
    } else if (activeTabId === 'workspace-vars' && view === 'variables') {
      setSectionsExpanded((prev) => ({ ...prev, 'workspace-vars': true }));
      setFocusedId('workspace-vars-row');
      setTimeout(() => {
        containerRef.current
          ?.querySelector(`[data-item-id="workspace-vars-row"]`)
          ?.scrollIntoView({ block: 'nearest' });
      }, 50);
      return true;
    } else if (activeTabId === 'live-vars' && view === 'variables') {
      setSectionsExpanded((prev) => ({ ...prev, 'live-variables': true }));
      setFocusedId('live-vars-row');
      setTimeout(() => {
        containerRef.current?.querySelector(`[data-item-id="live-vars-row"]`)?.scrollIntoView({ block: 'nearest' });
      }, 50);
      return true;
    }
    if (!nodeId) return false;

    const findAncestors = (
      trees: readonly { uid: string; tree: V5.TreeNode[] }[],
      targetUid: string,
      targetType: string,
      colKeyPrefix: string,
      folderKeyPrefix: string,
    ): { ancestors: string[]; section: 'rules' | 'templates' } | null => {
      for (const col of trees) {
        const colKey = `${colKeyPrefix}${col.uid}`;
        const walk = (nodes: V5.TreeNode[], trail: string[]): string[] | null => {
          for (const n of nodes) {
            if (n.type === targetType && n.uid === targetUid) return trail;
            if (n.type === 'folder') {
              const r = walk(n.children, [...trail, `${folderKeyPrefix}${n.uid}`]);
              if (r) return r;
            }
          }
          return null;
        };
        const result = walk(col.tree, [colKey]);
        if (result) return { ancestors: result, section };
      }
      return null;
    };

    if (nodeId.startsWith('col-') || nodeId.startsWith('tpl-col-')) {
      setSectionsExpanded((prev) => ({ ...prev, [section]: true }));
      setFocusedId(nodeId);
      setTimeout(() => {
        containerRef.current?.querySelector(`[data-item-id="${nodeId}"]`)?.scrollIntoView({ block: 'nearest' });
      }, 50);
      return true;
    }

    let found: { ancestors: string[]; section: 'rules' | 'templates' } | null = null;

    if (section === 'rules') {
      const targetUid = nodeId.startsWith('rule-') ? nodeId.replace('rule-', '') : nodeId.replace('folder-', '');
      const targetType = nodeId.startsWith('rule-') ? 'rule' : 'folder';
      found = findAncestors(localCollectionTrees, targetUid, targetType, 'col-', 'folder-');
    } else {
      const targetUid = nodeId.replace('tpl-', '');
      found =
        findAncestors(templateCollectionTrees, targetUid, 'template', 'tpl-col-', 'tpl-folder-') ||
        findAncestors(templateCollectionTrees, targetUid, 'folder', 'tpl-col-', 'tpl-folder-');
    }

    if (found) {
      setExpandedKeys((prev) => {
        const next = new Set(prev);
        for (const k of found.ancestors) next.add(k);
        return next;
      });
      setSectionsExpanded((prev) => ({ ...prev, [found.section]: true }));
      setFocusedId(nodeId);
      setTimeout(() => {
        containerRef.current?.querySelector(`[data-item-id="${nodeId}"]`)?.scrollIntoView({ block: 'nearest' });
      }, 50);
      return true;
    }

    return false;
  }, [
    activeTabId,
    localCollectionTrees,
    templateCollectionTrees,
    requestCollectionTrees,
    view,
    containerRef,
    setExpandedKeys,
    setSectionsExpanded,
    setFocusedId,
  ]);
}
