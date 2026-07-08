/**
 * useSidebarExpansion — the section/tree expansion subsystem behind the
 * sidebar's chevrons and the Expand/Collapse All toolbar actions.
 *
 * Every callback writes only through the lifted `setSectionsExpanded` /
 * `setExpandedKeys` dispatchers (owned by the host's
 * `useWorkbenchSidebarState` so values survive tab close/reopen) and
 * reads only derived view data — it touches none of the interaction
 * subsystem's mutable state. `toggleExpand` is threaded down into the
 * per-section tree-node hooks and the keyboard-nav handler; the other
 * three are wired straight to header/section chrome.
 */

import type { TreeNode as CoreTreeNode } from '@openheaders/core/types';
import type React from 'react';
import { useCallback } from 'react';
import { TEMPLATES_BY_TYPE } from '../../rule-templates';
import { replaceOwnedKeys } from './expanded-key-ownership';
import type { SidebarView } from './types';

// Views with no expandable collection/folder tree: their section
// headers are the only collapsible level, so Expand/Collapse All
// toggles every listed section instead of operating on tree keys.
// List every section the view renders, including the shared
// ENVIRONMENTS footer.
const TREELESS_VIEW_SECTIONS: Partial<Record<SidebarView, readonly string[]>> = {
  variables: ['environments'],
  workflows: ['workflows', 'environments'],
};

const sectionsAllSet = (keys: readonly string[], open: boolean): Record<string, boolean> =>
  Object.fromEntries(keys.map((k) => [k, open]));

interface UseSidebarExpansionParams {
  view: SidebarView;
  sectionsExpanded: Record<string, boolean>;
  localCollectionTrees: readonly { uid: string; tree: CoreTreeNode[] }[];
  templateCollectionTrees: readonly { uid: string; tree: CoreTreeNode[] }[];
  requestCollectionTrees: readonly { uid: string; tree: CoreTreeNode[] }[];
  setSectionsExpanded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setExpandedKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export interface SidebarExpansion {
  toggleSection: (key: string) => void;
  toggleExpand: (key: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
}

export function useSidebarExpansion({
  view,
  sectionsExpanded,
  localCollectionTrees,
  templateCollectionTrees,
  requestCollectionTrees,
  setSectionsExpanded,
  setExpandedKeys,
}: UseSidebarExpansionParams): SidebarExpansion {
  const toggleSection = useCallback(
    (key: string) => {
      setSectionsExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
    },
    [setSectionsExpanded],
  );

  const toggleExpand = useCallback(
    (key: string) => {
      setExpandedKeys((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    },
    [setExpandedKeys],
  );

  // Expand/Collapse All behaves by view shape:
  //   - Tree-bearing views (http-rules, api-requests): operate on the
  //     visible collection/folder tree only. Sections are a layout
  //     choice the user owns, so a click never opens or closes one —
  //     except that, when every section is collapsed, Expand All would
  //     be a visible no-op, so it also opens the sections to let the
  //     user climb out of an all-closed state in one click.
  //   - Tree-less views (variables, workflows): the sections ARE the
  //     only collapsible level, so Expand/Collapse All toggles every
  //     section in TREELESS_VIEW_SECTIONS open/closed.
  //
  // `replaceOwnedKeys()` swaps in this view's `nextOwned` tree-key
  // set while preserving every other panel's expansions (keys owned
  // by other views or with no recognized prefix).
  const expandAll = useCallback(() => {
    const collectFolderKeys = (nodes: CoreTreeNode[], prefix: string, into: Set<string>) => {
      for (const n of nodes) {
        if (n.type === 'folder') {
          into.add(`${prefix}${n.uid}`);
          collectFolderKeys(n.children, prefix, into);
        }
      }
    };

    if (view === 'http-rules') {
      const rulesOpen = sectionsExpanded.rules === true;
      const templatesOpen = sectionsExpanded.templates === true;
      const allClosed = !rulesOpen && !templatesOpen && sectionsExpanded.environments !== true;
      if (allClosed) {
        setSectionsExpanded({ rules: true, templates: true, environments: true });
      }
      const ownedKeys = new Set<string>();
      if (rulesOpen || allClosed) {
        for (const col of localCollectionTrees) {
          ownedKeys.add(`col-${col.uid}`);
          collectFolderKeys(col.tree, 'folder-', ownedKeys);
        }
      }
      if (templatesOpen || allClosed) {
        for (const col of templateCollectionTrees) {
          ownedKeys.add(`tpl-col-${col.uid}`);
          collectFolderKeys(col.tree, 'tpl-folder-', ownedKeys);
        }
        ownedKeys.add('sys-tpl-col');
        for (const [ruleType, tpls] of Object.entries(TEMPLATES_BY_TYPE)) {
          if (tpls.length === 0) continue;
          ownedKeys.add(`sys-tpl-${ruleType}`);
        }
      }
      setExpandedKeys((prev) => replaceOwnedKeys(prev, ownedKeys, view));
      return;
    }

    if (view === 'api-requests') {
      const reqOpen = sectionsExpanded['api-requests'] === true;
      const allClosed = !reqOpen && sectionsExpanded.environments !== true;
      if (allClosed) {
        setSectionsExpanded({ 'api-requests': true, environments: true });
      }
      const ownedKeys = new Set<string>();
      if (reqOpen || allClosed) {
        for (const col of requestCollectionTrees) {
          ownedKeys.add(`req-col-${col.uid}`);
          collectFolderKeys(col.tree, 'req-folder-', ownedKeys);
        }
      }
      setExpandedKeys((prev) => replaceOwnedKeys(prev, ownedKeys, view));
      return;
    }

    // Tree-less views: open every section.
    const treelessSections = TREELESS_VIEW_SECTIONS[view];
    if (treelessSections) {
      setSectionsExpanded(sectionsAllSet(treelessSections, true));
    }
  }, [
    view,
    sectionsExpanded,
    localCollectionTrees,
    templateCollectionTrees,
    requestCollectionTrees,
    setSectionsExpanded,
    setExpandedKeys,
  ]);

  // Collapse All clears this view's tree keys; in tree-bearing views
  // sections stay as the user left them (symmetric with Expand All —
  // a click never closes a section the user explicitly opened). In
  // tree-less views the sections are the only collapsible level, so it
  // closes every one.
  const collapseAll = useCallback(() => {
    setExpandedKeys((prev) => replaceOwnedKeys(prev, new Set<string>(), view));
    const treelessSections = TREELESS_VIEW_SECTIONS[view];
    if (treelessSections) {
      setSectionsExpanded(sectionsAllSet(treelessSections, false));
    }
  }, [view, setExpandedKeys, setSectionsExpanded]);

  return { toggleSection, toggleExpand, expandAll, collapseAll };
}
