/**
 * Report-dialog visibility — a module store so the desktop Help menu
 * (through `menuCommand`), the Settings › About rows and any later
 * entry can summon the dialog without prop-drilling through the
 * workbench tree. The kind the entry chose preselects the form.
 */

import type { IssueKind } from '@openheaders/core/diagnostics';
import { useSyncExternalStore } from 'react';

export interface ReportIssueDialogState {
  open: boolean;
  kind: IssueKind;
}

let state: ReportIssueDialogState = { open: false, kind: 'bug' };
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function openReportIssueDialog(kind: IssueKind): void {
  if (state.open && state.kind === kind) return;
  state = { open: true, kind };
  emit();
}

export function closeReportIssueDialog(): void {
  if (!state.open) return;
  state = { ...state, open: false };
  emit();
}

export function useReportIssueDialog(): ReportIssueDialogState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}
