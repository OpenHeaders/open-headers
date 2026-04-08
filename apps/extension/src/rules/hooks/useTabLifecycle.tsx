/**
 * useTabLifecycle — dirty-close confirmation and batch close orchestration.
 *
 * Port of desktop's useTabLifecycle.tsx adapted for extension types.
 * Shows a "Save changes?" modal with three options:
 *   "Don't save" (discard) / "Cancel" / "Save changes" (red)
 */

import { Modal } from 'antd';
import { useCallback } from 'react';
import type { RulesTab } from '../types';

interface UseTabLifecycleOptions {
  tabs: RulesTab[];
  closeTab: (tabId: string, force?: boolean) => void;
  switchTab: (tabId: string) => void;
  saveRefMap: React.MutableRefObject<Map<string, () => void>>;
}

export function useTabLifecycle({ tabs, closeTab, switchTab, saveRefMap }: UseTabLifecycleOptions) {
  // ── Confirmation modal ──────────────────────────────────────────

  const confirmUnsaved = useCallback((tab: { id: string; label: string }): Promise<'discard' | 'save' | 'cancel'> => {
    return new Promise((resolve) => {
      const modal = Modal.confirm({
        title: <span style={{ fontSize: 13, fontWeight: 600 }}>Save changes?</span>,
        width: 380,
        content: (
          <p style={{ fontSize: 12, margin: '4px 0 0', lineHeight: 1.5 }}>
            <strong>{tab.label}</strong> has unsaved changes. Save these changes to avoid losing your work.
          </p>
        ),
        icon: null,
        closable: true,
        onCancel: () => {
          modal.destroy();
          resolve('cancel');
        },
        footer: (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 0 4px' }}>
            <button
              type="button"
              onClick={() => {
                modal.destroy();
                resolve('discard');
              }}
              style={{
                padding: '4px 16px',
                fontSize: 13,
                border: '1px solid #d9d9d9',
                borderRadius: 6,
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              Don&apos;t save
            </button>
            <button
              type="button"
              onClick={() => {
                modal.destroy();
                resolve('cancel');
              }}
              style={{
                padding: '4px 16px',
                fontSize: 13,
                border: '1px solid #d9d9d9',
                borderRadius: 6,
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                modal.destroy();
                resolve('save');
              }}
              style={{
                padding: '4px 16px',
                fontSize: 13,
                border: 'none',
                borderRadius: 6,
                background: '#ff7875',
                color: '#fff',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Save changes
            </button>
          </div>
        ),
      });
    });
  }, []);

  // ── Single tab close with confirmation ──────────────────────────

  const handleCloseTab = useCallback(
    async (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return;

      // Draft tabs are always treated as unsaved
      if (tab.mode === 'create') {
        const result = await confirmUnsaved(tab);
        if (result === 'save') {
          switchTab(tabId);
          setTimeout(() => saveRefMap.current.get(tabId)?.(), 50);
          return; // don't close — save flow will transition the tab
        }
        if (result === 'cancel') return;
        closeTab(tabId, true);
        return;
      }

      // Clean tab — close directly
      if (!tab.dirty) {
        closeTab(tabId, true);
        return;
      }

      // Dirty tab — confirm
      const result = await confirmUnsaved(tab);
      if (result === 'save') {
        saveRefMap.current.get(tabId)?.();
        // Close after saving (save sets dirty=false, then we force close)
        setTimeout(() => closeTab(tabId, true), 100);
        return;
      }
      if (result === 'cancel') return;
      closeTab(tabId, true); // discard
    },
    [tabs, closeTab, switchTab, saveRefMap, confirmUnsaved],
  );

  // ── Batch close with sequential confirmation ────────────────────

  const handleBatchClose = useCallback(
    async (tabIds: string[]) => {
      // Separate clean from dirty/draft
      const clean: string[] = [];
      const dirty: string[] = [];

      for (const id of tabIds) {
        const tab = tabs.find((t) => t.id === id);
        if (!tab) continue;
        if (tab.dirty || tab.mode === 'create') dirty.push(id);
        else clean.push(id);
      }

      // Close all clean tabs immediately
      for (const id of clean) closeTab(id, true);

      // Confirm dirty tabs one by one
      for (const id of dirty) {
        const tab = tabs.find((t) => t.id === id);
        if (!tab) continue;

        const result = await confirmUnsaved(tab);
        if (result === 'cancel') return; // abort remaining
        if (result === 'save') {
          if (tab.mode === 'create') {
            switchTab(id);
            setTimeout(() => saveRefMap.current.get(id)?.(), 50);
            continue; // don't close — save flow handles it
          }
          saveRefMap.current.get(id)?.();
        }
        closeTab(id, true);
      }
    },
    [tabs, closeTab, switchTab, saveRefMap, confirmUnsaved],
  );

  // ── Derived batch handlers ──────────────────────────────────────

  const handleCloseOther = useCallback(
    (tabId: string) => {
      const ids = tabs.filter((t) => t.id !== tabId).map((t) => t.id);
      void handleBatchClose(ids);
    },
    [tabs, handleBatchClose],
  );

  const handleCloseAll = useCallback(() => {
    const ids = tabs.map((t) => t.id);
    void handleBatchClose(ids);
  }, [tabs, handleBatchClose]);

  const handleCloseUnmodified = useCallback(() => {
    // Close clean, non-draft tabs directly — no confirmation needed
    for (const tab of tabs) {
      if (!tab.dirty && tab.mode !== 'create') {
        closeTab(tab.id, true);
      }
    }
  }, [tabs, closeTab]);

  const handleCloseToLeft = useCallback(
    (tabId: string) => {
      const idx = tabs.findIndex((t) => t.id === tabId);
      if (idx <= 0) return;
      const ids = tabs.slice(0, idx).map((t) => t.id);
      void handleBatchClose(ids);
    },
    [tabs, handleBatchClose],
  );

  const handleCloseToRight = useCallback(
    (tabId: string) => {
      const idx = tabs.findIndex((t) => t.id === tabId);
      if (idx === -1 || idx === tabs.length - 1) return;
      const ids = tabs.slice(idx + 1).map((t) => t.id);
      void handleBatchClose(ids);
    },
    [tabs, handleBatchClose],
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
