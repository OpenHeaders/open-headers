/**
 * useTabLifecycle — dirty-close confirmation and batch close orchestration.
 *
 * Port of desktop's useTabLifecycle.tsx adapted for extension types.
 * Shows a "Save changes?" modal with three options:
 *   "Don't save" (discard) / "Cancel" / "Save changes" (red)
 */

import type { Rule } from '@openheaders/core/types';
import { isRuleDraft } from '@openheaders/core/utils';
import { App as AntApp, Button } from 'antd';
import { useCallback } from 'react';
import { applyRuleDelete } from '@/shared/sync/rule-write-client';
import type { WorkbenchTab } from '../types';

interface UseTabLifecycleOptions {
  /** All tabs across every editor group. Used for "find by id" lookups. */
  allTabs: WorkbenchTab[];
  /** Live rules — used to detect tabs whose rule is still in draft
   *  (unpublished) state, which need the discard-or-keep prompt
   *  rather than the legacy "save changes?" prompt. */
  rules: Rule[];
  /** Active workspace id — required for `applyRuleDelete` on Discard. */
  workspaceId: string | null;
  /** Returns the tabs in the same leaf as the anchor tab — batch close
   *  operations scope to the anchor's editor group. */
  getLeafTabs: (anchorTabId: string) => WorkbenchTab[];
  /** Returns the tabs of the currently-focused leaf. Used by Close All
   *  and Close Unmodified when no anchor is supplied. */
  getFocusedLeafTabs: () => WorkbenchTab[];
  closeTab: (tabId: string, force?: boolean) => void;
  switchTab: (tabId: string) => void;
  saveRefMap: React.MutableRefObject<Map<string, () => void>>;
}

/**
 * Returns the unpublished rule whose tab the user is about to close,
 * or `null` if the tab isn't a draft-rule edit. Centralized so both
 * the single-close and batch-close paths agree on what counts as
 * "still drafting."
 */
function tabDraftRule(tab: WorkbenchTab, rules: Rule[]): Rule | null {
  if (tab.mode !== 'edit' || !tab.ruleUid) return null;
  const rule = rules.find((r) => r.uid === tab.ruleUid);
  return rule && isRuleDraft(rule) ? rule : null;
}

export function useTabLifecycle({
  allTabs,
  rules,
  workspaceId,
  getLeafTabs,
  getFocusedLeafTabs,
  closeTab,
  switchTab,
  saveRefMap,
}: UseTabLifecycleOptions) {
  // `App.useApp()` yields theme-aware imperative APIs. The global
  // `Modal.confirm(...)` static method mounts outside the React tree
  // and therefore never sees the ConfigProvider theme — in dark mode
  // that leaves you with a white modal over a dark UI. Using the
  // instance from the surrounding <App> wrapper fixes both colors and
  // component tokens inside the dialog.
  const { modal } = AntApp.useApp();

  // ── Confirmation modal ──────────────────────────────────────────

  const confirmUnsaved = useCallback(
    (tab: { id: string; label: string }): Promise<'discard' | 'save' | 'cancel'> => {
      return new Promise((resolve) => {
        const instance = modal.confirm({
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

  // Draft-rule discard prompt. The rule lives in storage from the
  // moment of `+ New Rule`, so closing its tab raises the question
  // "do you want to keep this draft for later, or throw it away?"
  // Distinct from the legacy "save changes?" because there's nothing
  // to save — the gesture is publish-or-toss, not commit-or-revert.
  const confirmDiscardDraft = useCallback(
    (tab: { id: string; label: string }): Promise<'discard' | 'keep' | 'cancel'> => {
      return new Promise((resolve) => {
        const instance = modal.confirm({
          title: <span style={{ fontSize: 13, fontWeight: 600 }}>Discard draft?</span>,
          width: 380,
          content: (
            <p style={{ fontSize: 12, margin: '4px 0 0', lineHeight: 1.5 }}>
              <strong>{tab.label}</strong> hasn&apos;t been published yet. Discarding deletes the draft; keeping leaves
              it in your sidebar to finish later.
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
                danger
                onClick={() => {
                  instance.destroy();
                  resolve('discard');
                }}
              >
                Discard
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
                type="primary"
                onClick={() => {
                  instance.destroy();
                  resolve('keep');
                }}
              >
                Keep as draft
              </Button>
            </div>
          ),
        });
      });
    },
    [modal],
  );

  // ── Single tab close with confirmation ──────────────────────────

  const handleCloseTab = useCallback(
    async (tabId: string) => {
      const tab = allTabs.find((t) => t.id === tabId);
      if (!tab) return;

      // Draft (unpublished) rule tab — discard / keep / cancel.
      // Takes precedence over the dirty-form prompt because the
      // publication-gate question subsumes the form-edit question:
      // discarding deletes the rule outright, so any pending form
      // edits are moot.
      const draftRule = tabDraftRule(tab, rules);
      if (draftRule && workspaceId) {
        const result = await confirmDiscardDraft(tab);
        if (result === 'cancel') return;
        if (result === 'discard') {
          void applyRuleDelete(draftRule.uid, { workspaceId, surfaceId: 'workbench' });
        }
        closeTab(tabId, true);
        return;
      }

      // Scratch (*-create) tabs always confirm — closing discards
      // unpersisted form values; saving routes through the where-to-save
      // modal which transitions the tab to *-edit on success.
      if (
        tab.mode === 'request-create' ||
        tab.mode === 'rule-create' ||
        tab.mode === 'live-variable-create' ||
        tab.mode === 'live-workflow-create'
      ) {
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
    [allTabs, rules, workspaceId, closeTab, switchTab, saveRefMap, confirmUnsaved, confirmDiscardDraft],
  );

  // ── Batch close with sequential confirmation ────────────────────

  const handleBatchClose = useCallback(
    async (tabIds: string[]) => {
      // Separate clean / dirty / draft. Draft tabs go through the
      // discard-or-keep flow rather than save-or-discard.
      const clean: string[] = [];
      const dirty: string[] = [];
      const draft: string[] = [];

      for (const id of tabIds) {
        const tab = allTabs.find((t) => t.id === id);
        if (!tab) continue;
        if (tabDraftRule(tab, rules)) draft.push(id);
        else if (
          tab.dirty ||
          tab.mode === 'request-create' ||
          tab.mode === 'rule-create' ||
          tab.mode === 'live-variable-create' ||
          tab.mode === 'live-workflow-create'
        )
          dirty.push(id);
        else clean.push(id);
      }

      // Close all clean tabs immediately
      for (const id of clean) closeTab(id, true);

      // Draft tabs — confirm one by one (discard / keep / cancel).
      for (const id of draft) {
        const tab = allTabs.find((t) => t.id === id);
        if (!tab) continue;
        const draftRule = tabDraftRule(tab, rules);
        if (!draftRule) {
          closeTab(id, true);
          continue;
        }
        const result = await confirmDiscardDraft(tab);
        if (result === 'cancel') return; // abort remaining
        if (result === 'discard' && workspaceId) {
          void applyRuleDelete(draftRule.uid, { workspaceId, surfaceId: 'workbench' });
        }
        closeTab(id, true);
      }

      // Confirm dirty tabs one by one
      for (const id of dirty) {
        const tab = allTabs.find((t) => t.id === id);
        if (!tab) continue;

        const result = await confirmUnsaved(tab);
        if (result === 'cancel') return; // abort remaining
        if (result === 'save') {
          if (
            tab.mode === 'request-create' ||
            tab.mode === 'rule-create' ||
            tab.mode === 'live-variable-create' ||
            tab.mode === 'live-workflow-create'
          ) {
            switchTab(id);
            setTimeout(() => saveRefMap.current.get(id)?.(), 50);
            continue; // don't close — save flow handles it
          }
          saveRefMap.current.get(id)?.();
        }
        closeTab(id, true);
      }
    },
    [allTabs, rules, workspaceId, closeTab, switchTab, saveRefMap, confirmUnsaved, confirmDiscardDraft],
  );

  // ── Derived batch handlers (leaf-scoped) ──────────────────────

  const handleCloseOther = useCallback(
    (tabId: string) => {
      const leafTabs = getLeafTabs(tabId);
      const ids = leafTabs.filter((t) => t.id !== tabId).map((t) => t.id);
      void handleBatchClose(ids);
    },
    [getLeafTabs, handleBatchClose],
  );

  const handleCloseAll = useCallback(() => {
    const leafTabs = getFocusedLeafTabs();
    void handleBatchClose(leafTabs.map((t) => t.id));
  }, [getFocusedLeafTabs, handleBatchClose]);

  const handleCloseUnmodified = useCallback(() => {
    for (const tab of getFocusedLeafTabs()) {
      if (
        !tab.dirty &&
        !tabDraftRule(tab, rules) &&
        tab.mode !== 'request-create' &&
        tab.mode !== 'rule-create' &&
        tab.mode !== 'live-variable-create' &&
        tab.mode !== 'live-workflow-create'
      )
        closeTab(tab.id, true);
    }
  }, [getFocusedLeafTabs, rules, closeTab]);

  const handleCloseToLeft = useCallback(
    (tabId: string) => {
      const leafTabs = getLeafTabs(tabId);
      const idx = leafTabs.findIndex((t) => t.id === tabId);
      if (idx <= 0) return;
      const ids = leafTabs.slice(0, idx).map((t) => t.id);
      void handleBatchClose(ids);
    },
    [getLeafTabs, handleBatchClose],
  );

  const handleCloseToRight = useCallback(
    (tabId: string) => {
      const leafTabs = getLeafTabs(tabId);
      const idx = leafTabs.findIndex((t) => t.id === tabId);
      if (idx === -1 || idx === leafTabs.length - 1) return;
      const ids = leafTabs.slice(idx + 1).map((t) => t.id);
      void handleBatchClose(ids);
    },
    [getLeafTabs, handleBatchClose],
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
