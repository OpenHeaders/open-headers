/**
 * useImportShortcut — the Save modal's ⌘S machinery for the import
 * modals: while the modal is open, Cmd/Ctrl+S triggers the import
 * (capture phase, so the workbench's own save handler never sees it).
 * Returns the platform shortcut label for tooltips and hint bars.
 */

import { useEffect } from 'react';
import { useShortcutLabel } from '../../hooks/useWorkspaceShortcuts';

export function useImportShortcut(open: boolean, canImport: boolean, onImport: () => void): string {
  const saveLabel = useShortcutLabel('save');

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        e.stopPropagation();
        if (canImport) onImport();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [open, canImport, onImport]);

  return saveLabel;
}
