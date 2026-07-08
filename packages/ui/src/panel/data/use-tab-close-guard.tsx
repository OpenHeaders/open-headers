/**
 * useTabCloseGuard — dirty-close confirmation for the panel's editor
 * tabs, mirroring the workspace tab bar's lifecycle: a dirty tab (an
 * IndexedDB record document with an unsaved draft) prompts
 * Save / Don't save / Cancel before closing; batch closes confirm each
 * dirty tab in turn and abort on Cancel. Clean tabs close straight
 * through. "Save changes" routes through the save action the editor
 * body registered — a failed save keeps the tab open with its inline
 * failure note showing.
 */

import { App as AntApp, Button } from 'antd';
import type React from 'react';
import { useCallback } from 'react';
import { findLeaf } from './editor-groups';
import type { InspectorTab } from './inspector-tab';
import { tabPillLabel } from './inspector-tab';
import type { UseInspectorEditorGroupsApi } from './use-inspector-editor-groups';

export type TabSaveRefMap = Map<string, () => Promise<boolean>>;

export interface TabCloseGuardApi {
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeAllTabs: () => void;
  closeTabsToLeft: (tabId: string) => void;
  closeTabsToRight: (tabId: string) => void;
}

function isDirty(tab: InspectorTab): boolean {
  return tab.kind === 'idb-record' && tab.dirty === true;
}

export function useTabCloseGuard(
  groups: UseInspectorEditorGroupsApi,
  saveRefs: React.RefObject<TabSaveRefMap>,
): TabCloseGuardApi {
  const { modal } = AntApp.useApp();

  const confirmUnsaved = useCallback(
    (tab: InspectorTab): Promise<'discard' | 'save' | 'cancel'> => {
      return new Promise((resolve) => {
        const instance = modal.confirm({
          title: <span style={{ fontSize: 13, fontWeight: 600 }}>Save changes?</span>,
          width: 380,
          content: (
            <p style={{ fontSize: 12, margin: '4px 0 0', lineHeight: 1.5 }}>
              <strong>{tabPillLabel(tab)}</strong> has unsaved changes. Save these changes to avoid losing your work.
            </p>
          ),
          icon: null,
          closable: true,
          onCancel: () => {
            instance.destroy();
            resolve('cancel');
          },
          footer: (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 0 4px' }}>
              <Button
                size="small"
                onClick={() => {
                  instance.destroy();
                  resolve('discard');
                }}
              >
                Don&apos;t save
              </Button>
              <Button
                size="small"
                onClick={() => {
                  instance.destroy();
                  resolve('cancel');
                }}
              >
                Cancel
              </Button>
              <Button
                size="small"
                danger
                type="primary"
                onClick={() => {
                  instance.destroy();
                  resolve('save');
                }}
              >
                Save changes
              </Button>
            </div>
          ),
        });
      });
    },
    [modal],
  );

  // One tab through the guard; resolves whether it actually closed.
  const guardAndClose = useCallback(
    async (tab: InspectorTab): Promise<boolean> => {
      if (!isDirty(tab)) {
        groups.closeTab(tab.id);
        return true;
      }
      const result = await confirmUnsaved(tab);
      if (result === 'cancel') return false;
      if (result === 'save') {
        const save = saveRefs.current?.get(tab.id);
        const ok = save ? await save() : false;
        if (!ok) {
          // Keep the tab open and in view — its inline note says why.
          groups.switchTab(tab.id);
          return false;
        }
      }
      groups.closeTab(tab.id);
      return true;
    },
    [groups, confirmUnsaved, saveRefs],
  );

  const closeMany = useCallback(
    async (tabs: InspectorTab[]) => {
      // Clean tabs close immediately; dirty ones confirm one by one and
      // a Cancel (or failed save) aborts the rest — workspace parity.
      for (const tab of tabs.filter((t) => !isDirty(t))) groups.closeTab(tab.id);
      for (const tab of tabs.filter(isDirty)) {
        if (!(await guardAndClose(tab))) return;
      }
    },
    [groups, guardAndClose],
  );

  const leafTabsOf = useCallback(
    (tabId: string): InspectorTab[] => {
      const leafId = groups.findTabLeafId(tabId);
      const leaf = leafId ? findLeaf(groups.root, leafId) : null;
      return leaf ? [...leaf.tabs] : [];
    },
    [groups],
  );

  const closeTab = useCallback(
    (tabId: string) => {
      const tab = groups.allTabs.find((t) => t.id === tabId);
      if (tab) void guardAndClose(tab);
    },
    [groups, guardAndClose],
  );

  const closeOtherTabs = useCallback(
    (tabId: string) => {
      void closeMany(leafTabsOf(tabId).filter((t) => t.id !== tabId));
    },
    [closeMany, leafTabsOf],
  );

  const closeAllTabs = useCallback(() => {
    void closeMany([...groups.focusedLeaf.tabs]);
  }, [closeMany, groups]);

  const closeTabsToLeft = useCallback(
    (tabId: string) => {
      const tabs = leafTabsOf(tabId);
      const idx = tabs.findIndex((t) => t.id === tabId);
      if (idx > 0) void closeMany(tabs.slice(0, idx));
    },
    [closeMany, leafTabsOf],
  );

  const closeTabsToRight = useCallback(
    (tabId: string) => {
      const tabs = leafTabsOf(tabId);
      const idx = tabs.findIndex((t) => t.id === tabId);
      if (idx !== -1 && idx < tabs.length - 1) void closeMany(tabs.slice(idx + 1));
    },
    [closeMany, leafTabsOf],
  );

  return { closeTab, closeOtherTabs, closeAllTabs, closeTabsToLeft, closeTabsToRight };
}
