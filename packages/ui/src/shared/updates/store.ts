/**
 * Update-dialog visibility — a module store so any update surface (the
 * corner toast, menus) can summon the dialog without prop-drilling
 * through the workbench tree. The dialog itself reads updater state
 * straight from the host bridge.
 */

import { useSyncExternalStore } from 'react';

let open = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function openUpdateDialog(): void {
  if (open) return;
  open = true;
  emit();
}

export function closeUpdateDialog(): void {
  if (!open) return;
  open = false;
  emit();
}

export function useUpdateDialogOpen(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => open,
  );
}
