import { getCapability } from '@openheaders/core/capabilities';
import type { UseRuleMutatorApi } from '@openheaders/ui/shared/hooks/useRuleMutator';
import { useRowActionRegistration } from '@openheaders/ui/shared/hooks/useRowActionRegistration';
import type { RowActions } from '@openheaders/ui/shared/table-shared';
import type { WorkspaceIntent } from '@openheaders/ui/shared/workspace-intent';
import { App } from 'antd';
import { type Dispatch, type RefObject, type SetStateAction, useCallback } from 'react';
import type { ActiveRule, TableRecord } from './types';

/** Antd `message` API handed down from the popup's `App.useApp()` context. */
type ThisPageMessageApi = ReturnType<typeof App.useApp>['message'];

export interface ThisPageRuleRowActionsOptions {
  dataSourceRef: RefObject<TableRecord[]>;
  setActiveRules: Dispatch<SetStateAction<ActiveRule[]>>;
  ruleMutator: UseRuleMutatorApi;
  openRulesIntent: (intent: WorkspaceIntent) => void;
  setCopiedRowId: Dispatch<SetStateAction<string | number | null>>;
  message: ThisPageMessageApi;
  onRowActionsChange: ((actions: RowActions) => void) | undefined;
}

/**
 * Wires the keyboard-driven row actions (toggle / edit / copy / delete) for
 * the This Page table and registers them with the keyboard-nav dispatcher.
 * Handlers read the live table via `dataSourceRef` so their dependency lists
 * can stay minimal while always operating on the current row set. Returns
 * void — the callbacks are consumed only through the registration.
 */
export function useThisPageRuleRowActions({
  dataSourceRef,
  setActiveRules,
  ruleMutator,
  openRulesIntent,
  setCopiedRowId,
  message,
  onRowActionsChange,
}: ThisPageRuleRowActionsOptions): void {
  const handleToggleRow = useCallback(
    (index: number) => {
      const record = dataSourceRef.current[index];
      if (!record) return;
      const isEnabled = record.isEnabled !== false;
      setActiveRules((prev) => prev.map((r) => (r.id === record.id ? { ...r, isEnabled: !isEnabled } : r)));
      void ruleMutator.toggleRule(record.id, !isEnabled).then((resp) => {
        if (resp.ok) {
          // Nudge the SW to revalidate tracked requests + rebuild DNR
          void getCapability('notifyRulesChanged')?.().catch(() => undefined);
        } else {
          setActiveRules((prev) => prev.map((r) => (r.id === record.id ? { ...r, isEnabled } : r)));
        }
      });
    },
    [ruleMutator],
  );

  const handleEditRow = useCallback(
    (index: number) => {
      const record = dataSourceRef.current[index];
      if (!record) return;
      openRulesIntent({ kind: 'edit-rule', uid: record.id });
    },
    [openRulesIntent],
  );

  const handleCopyRow = useCallback((index: number) => {
    const record = dataSourceRef.current[index];
    if (!record?.summary) return;
    void navigator.clipboard.writeText(record.summary);
    setCopiedRowId(record.key);
    setTimeout(() => setCopiedRowId(null), 1000);
  }, []);

  const handleDeleteRow = useCallback(
    (index: number) => {
      const record = dataSourceRef.current[index];
      if (!record) return;
      setActiveRules((prev) => prev.filter((r) => r.id !== record.id));
      void ruleMutator.deleteRule(record.id).then((resp) => {
        if (resp.ok) {
          void message.success('Rule deleted');
        } else {
          void message.error('Failed to delete rule');
        }
      });
    },
    [message, ruleMutator],
  );

  useRowActionRegistration(onRowActionsChange, {
    onToggleRow: handleToggleRow,
    onEditRow: handleEditRow,
    onCopyRow: handleCopyRow,
    onDeleteRow: handleDeleteRow,
  });
}
