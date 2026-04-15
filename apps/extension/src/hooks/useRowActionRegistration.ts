import { useEffect } from 'react';
import type { RowActions } from '@/popup/utils/table-shared';

export function useRowActionRegistration(
  onRowActionsChange: ((actions: RowActions) => void) | undefined,
  actions: RowActions,
): void {
  const { onToggleRow, onEditRow, onCopyRow, onDeleteRow, onAddRule, onExpandRow, onCollapseRow, onPauseRow } = actions;
  useEffect(() => {
    if (!onRowActionsChange) return;
    onRowActionsChange({
      onToggleRow,
      onEditRow,
      onCopyRow,
      onDeleteRow,
      onAddRule,
      onExpandRow,
      onCollapseRow,
      onPauseRow,
    });
  }, [
    onRowActionsChange,
    onToggleRow,
    onEditRow,
    onCopyRow,
    onDeleteRow,
    onAddRule,
    onExpandRow,
    onCollapseRow,
    onPauseRow,
  ]);
}
