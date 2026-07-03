import type { RowActions } from '@openheaders/ui/shared/table-shared';
import { useEffect } from 'react';

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
