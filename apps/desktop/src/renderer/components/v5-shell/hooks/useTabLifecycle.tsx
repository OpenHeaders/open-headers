/**
 * useTabLifecycle — tab close operations and unsaved-changes confirmation.
 *
 * Extracted from V5Shell to reduce component size. Handles:
 *   - Unsaved confirmation dialog (save / discard / cancel)
 *   - Single tab close (with draft-aware save flow)
 *   - Batch close (close other, close all, close unmodified, close to left/right)
 */

import { Modal } from 'antd';
import { useCallback } from 'react';
import type { ResolvedTab } from './useResolvedTabs';

interface UseTabLifecycleOptions {
  resolvedTabs: ResolvedTab[];
  closeTab: (tabId: string, force?: boolean) => void;
  switchTab: (tabId: string) => void;
  editorSaveRef: React.MutableRefObject<(() => void) | null>;
}

export function useTabLifecycle({ resolvedTabs, closeTab, switchTab, editorSaveRef }: UseTabLifecycleOptions) {
  const confirmUnsaved = useCallback(
    (tab: { id: string; label: string }): Promise<'discard' | 'save' | 'cancel'> =>
      new Promise((resolve) => {
        const modal = Modal.confirm({
          title: <span style={{ fontSize: 13, fontWeight: 600 }}>Save changes?</span>,
          width: 380,
          content: (
            <p style={{ fontSize: 12, margin: '4px 0 0' }}>
              <strong>{tab.label}</strong> has unsaved changes. Save these changes to avoid losing your work.
            </p>
          ),
          footer: (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
              <button
                type="button"
                style={{
                  padding: '5px 16px',
                  border: '1px solid #d9d9d9',
                  borderRadius: 5,
                  background: '#ffffff',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
                onClick={() => {
                  modal.destroy();
                  resolve('discard');
                }}
              >
                Don't save
              </button>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  style={{
                    padding: '5px 16px',
                    border: '1px solid #d9d9d9',
                    borderRadius: 5,
                    background: '#ffffff',
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                  onClick={() => {
                    modal.destroy();
                    resolve('cancel');
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  style={{
                    padding: '5px 16px',
                    border: 'none',
                    borderRadius: 5,
                    background: '#ff7875',
                    color: '#ffffff',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                  onClick={() => {
                    modal.destroy();
                    resolve('save');
                  }}
                >
                  Save changes
                </button>
              </div>
            </div>
          ),
          closable: true,
          onCancel: () => {
            modal.destroy();
            resolve('cancel');
          },
        });
      }),
    [],
  );

  // Close a single tab, prompting if unsaved
  const handleCloseTab = useCallback(
    async (tabId: string) => {
      const rt = resolvedTabs.find((t) => t.id === tabId);
      if (!rt) return;

      // Draft tabs always prompt (they're inherently unsaved)
      if (rt.draft) {
        const result = await confirmUnsaved({ id: rt.id, label: rt.resolvedLabel });
        if (result === 'save') {
          // Switch to the draft tab so editorSaveRef points to it, then trigger save
          switchTab(tabId);
          setTimeout(() => editorSaveRef.current?.(), 50);
        } else if (result === 'discard') {
          closeTab(tabId, true);
        }
        return;
      }

      if (!rt.unsaved) {
        closeTab(tabId);
        return;
      }
      const result = await confirmUnsaved({ id: rt.id, label: rt.resolvedLabel });
      if (result === 'save') editorSaveRef.current?.();
      if (result !== 'cancel') closeTab(tabId, true);
    },
    [resolvedTabs, closeTab, switchTab, confirmUnsaved, editorSaveRef],
  );

  // Close multiple tabs, prompting for each dirty one sequentially
  const handleBatchClose = useCallback(
    async (tabIds: string[]) => {
      const clean = tabIds.filter((id) => {
        const t = resolvedTabs.find((tab) => tab.id === id);
        return t && !t.unsaved && !t.draft && !t.pinned;
      });
      for (const id of clean) closeTab(id, true);

      const dirty = tabIds.filter((id) => {
        const t = resolvedTabs.find((tab) => tab.id === id);
        return (t?.unsaved || t?.draft) && !t?.pinned;
      });
      for (const id of dirty) {
        const rt = resolvedTabs.find((t) => t.id === id);
        if (!rt) continue;
        const result = await confirmUnsaved({ id: rt.id, label: rt.resolvedLabel });
        if (result === 'cancel') return;
        if (result === 'save') {
          if (rt.draft) {
            switchTab(id);
            setTimeout(() => editorSaveRef.current?.(), 50);
            continue; // don't close — the save-to-collection flow will handle it
          }
          editorSaveRef.current?.();
        }
        closeTab(id, true);
      }
    },
    [resolvedTabs, closeTab, switchTab, confirmUnsaved, editorSaveRef],
  );

  const handleCloseOther = useCallback(
    (tabId: string) => {
      const toClose = resolvedTabs.filter((t) => t.id !== tabId && !t.pinned).map((t) => t.id);
      void handleBatchClose(toClose);
    },
    [resolvedTabs, handleBatchClose],
  );

  const handleCloseAll = useCallback(() => {
    const toClose = resolvedTabs.filter((t) => !t.pinned).map((t) => t.id);
    void handleBatchClose(toClose);
  }, [resolvedTabs, handleBatchClose]);

  const handleCloseUnmodified = useCallback(() => {
    const toClose = resolvedTabs
      .filter((t) => !t.unsaved && !t.draft && !t.pinned && t.type !== 'overview')
      .map((t) => t.id);
    for (const id of toClose) closeTab(id, true);
  }, [resolvedTabs, closeTab]);

  const handleCloseToLeft = useCallback(
    (tabId: string) => {
      const idx = resolvedTabs.findIndex((t) => t.id === tabId);
      if (idx <= 0) return;
      const toClose = resolvedTabs
        .slice(0, idx)
        .filter((t) => !t.pinned)
        .map((t) => t.id);
      void handleBatchClose(toClose);
    },
    [resolvedTabs, handleBatchClose],
  );

  const handleCloseToRight = useCallback(
    (tabId: string) => {
      const idx = resolvedTabs.findIndex((t) => t.id === tabId);
      if (idx === -1) return;
      const toClose = resolvedTabs
        .slice(idx + 1)
        .filter((t) => !t.pinned)
        .map((t) => t.id);
      void handleBatchClose(toClose);
    },
    [resolvedTabs, handleBatchClose],
  );

  return {
    handleCloseTab,
    handleCloseOther,
    handleCloseAll,
    handleCloseUnmodified,
    handleCloseToLeft,
    handleCloseToRight,
  };
}
