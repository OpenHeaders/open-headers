import type { TreeNode } from '@openheaders/core/types';
import { useCallback } from 'react';
import type { SidebarView } from './types';

/**
 * Single source of truth for "which view owns which section header".
 * A section is **owned** by a view iff that view is the only one
 * that renders the section. Auto-expand from active-tab change is
 * only safe for owned (= single-view) sections — every mounted
 * Sidebar instance reacts to the same activeTabId change, so
 * expanding a multi-view section would simultaneously update every
 * panel's slice and surface as cross-panel state leak.
 *
 * Use 'multi' for sections that render in more than one view (e.g.
 * `environments` appears in http-rules, api-requests, and variables
 * as a shared secondary reference). Multi-view sections rely on
 * direct user-action handlers in Sidebar.tsx (e.g. createNew*) to
 * expand only the originating panel's slice — those handlers run
 * inside the Sidebar that received the click, so they're scoped
 * correctly via the per-view setter route.
 *
 * Adding a new section anywhere in the workbench? List its
 * ownership here and `shouldAutoExpandSection()` enforces the rule
 * automatically — no per-call site updates needed.
 */
const SECTION_VIEW_OWNERSHIP: Record<string, SidebarView | 'multi'> = {
  rules: 'http-rules',
  templates: 'http-rules',
  'api-requests': 'api-requests',
  workflows: 'workflows',
  environments: 'multi',
};

function shouldAutoExpandSection(section: string, view: SidebarView): boolean {
  return SECTION_VIEW_OWNERSHIP[section] === view;
}

interface UseSelectOpenedTabParams {
  activeTabId?: string | null;
  view: SidebarView;
  localCollectionTrees: readonly { uid: string; tree: TreeNode[] }[];
  templateCollectionTrees: readonly { uid: string; tree: TreeNode[] }[];
  requestCollectionTrees: readonly { uid: string; tree: TreeNode[] }[];
  /** Parent request uid for a response-example uid — null while the
   *  example isn't in the mirror yet (the auto-select retry covers the
   *  create-broadcast race). */
  resolveResponseExampleParent?: (exampleUid: string) => string | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
  setExpandedKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSectionsExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setFocusedId: (id: string | null) => void;
}

/**
 * "Select Opened Tab" — expand collection/folder ancestors, focus,
 * and scroll to the active tab's sidebar node. Returns true if
 * found + selected.
 *
 * Section-level auto-expansion routes through
 * `shouldAutoExpandSection()` so the rule is one-line, data-driven:
 * a section auto-expands here iff it is owned by exactly one view
 * (per `SECTION_VIEW_OWNERSHIP`) and that view matches this hook's
 * `view` prop. Sections marked `'multi'` (rendered in more than one
 * view) never auto-expand from this hook — every mounted Sidebar
 * reacts to the same activeTabId change, and expansion would
 * propagate to every panel's slice. The originating Sidebar still
 * expands its own slice via direct create-handler calls (e.g.
 * `createNewEnvironment`), which run only in the panel that
 * received the user click.
 */
export function useSelectOpenedTab({
  activeTabId,
  view,
  localCollectionTrees,
  templateCollectionTrees,
  requestCollectionTrees,
  resolveResponseExampleParent,
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
      if (shouldAutoExpandSection('environments', view)) {
        setSectionsExpanded((prev) => ({ ...prev, environments: true }));
      }
      setFocusedId(nodeId);
      setTimeout(() => {
        containerRef.current?.querySelector(`[data-item-id="${nodeId}"]`)?.scrollIntoView({ block: 'nearest' });
      }, 50);
      return true;
    } else if (activeTabId.startsWith('live-wf-')) {
      nodeId = `workflow-${activeTabId.replace('live-wf-', '')}`;
      if (shouldAutoExpandSection('workflows', view)) {
        setSectionsExpanded((prev) => ({ ...prev, workflows: true }));
      }
      setFocusedId(nodeId);
      setTimeout(() => {
        containerRef.current?.querySelector(`[data-item-id="${nodeId}"]`)?.scrollIntoView({ block: 'nearest' });
      }, 50);
      return true;
    } else if (
      (activeTabId.startsWith('request-') || activeTabId.startsWith('resp-example-')) &&
      view === 'api-requests'
    ) {
      nodeId = activeTabId;
      // Example nodes nest under their parent request row — reveal the
      // request's ancestor chain AND expand the request row itself so
      // the example child is visible (e.g. right after Save Response).
      const isExample = activeTabId.startsWith('resp-example-');
      const targetUid = isExample
        ? (resolveResponseExampleParent?.(activeTabId.replace('resp-example-', '')) ?? null)
        : activeTabId.replace('request-', '');
      if (!targetUid) return false;
      let found: { ancestors: string[] } | null = null;
      for (const col of requestCollectionTrees) {
        const colKey = `req-col-${col.uid}`;
        const walk = (nodes: TreeNode[], trail: string[]): string[] | null => {
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
          found = { ancestors: isExample ? [...result, `request-${targetUid}`] : result };
          break;
        }
      }
      if (found) {
        setExpandedKeys((prev) => {
          const next = new Set(prev);
          for (const k of found.ancestors) next.add(k);
          return next;
        });
        if (shouldAutoExpandSection('api-requests', view)) {
          setSectionsExpanded((prev) => ({ ...prev, 'api-requests': true }));
        }
        setFocusedId(nodeId);
        setTimeout(() => {
          containerRef.current?.querySelector(`[data-item-id="${nodeId}"]`)?.scrollIntoView({ block: 'nearest' });
        }, 50);
        return true;
      }
      return false;
    } else if (activeTabId === 'vault' && view === 'variables') {
      // Singleton opener rows — always visible (no section to expand).
      setTimeout(() => {
        containerRef.current?.querySelector(`[data-item-id="vault-row"]`)?.scrollIntoView({ block: 'nearest' });
      }, 50);
      return true;
    } else if (activeTabId === 'workspace-vars' && view === 'variables') {
      setTimeout(() => {
        containerRef.current
          ?.querySelector(`[data-item-id="workspace-vars-row"]`)
          ?.scrollIntoView({ block: 'nearest' });
      }, 50);
      return true;
    } else if (activeTabId === 'live-vars' && view === 'variables') {
      setTimeout(() => {
        containerRef.current?.querySelector(`[data-item-id="live-vars-row"]`)?.scrollIntoView({ block: 'nearest' });
      }, 50);
      return true;
    } else if (activeTabId === 'script-packages' && view === 'api-requests') {
      setTimeout(() => {
        containerRef.current
          ?.querySelector(`[data-item-id="script-packages-row"]`)
          ?.scrollIntoView({ block: 'nearest' });
      }, 50);
      return true;
    }
    if (!nodeId) return false;

    const findAncestors = (
      trees: readonly { uid: string; tree: TreeNode[] }[],
      targetUid: string,
      targetType: string,
      colKeyPrefix: string,
      folderKeyPrefix: string,
    ): { ancestors: string[]; section: 'rules' | 'templates' } | null => {
      for (const col of trees) {
        const colKey = `${colKeyPrefix}${col.uid}`;
        const walk = (nodes: TreeNode[], trail: string[]): string[] | null => {
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
      if (shouldAutoExpandSection(section, view)) {
        setSectionsExpanded((prev) => ({ ...prev, [section]: true }));
      }
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
      if (shouldAutoExpandSection(found.section, view)) {
        setSectionsExpanded((prev) => ({ ...prev, [found.section]: true }));
      }
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
    resolveResponseExampleParent,
    view,
    containerRef,
    setExpandedKeys,
    setSectionsExpanded,
    setFocusedId,
  ]);
}
