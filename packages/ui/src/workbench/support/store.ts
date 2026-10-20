/**
 * Report-dialog visibility — a module store so the desktop Help menu
 * (through `menuCommand`), the Settings › About rows, the root error
 * fallback and any later entry can summon the dialog without
 * prop-drilling through the workbench tree. The kind the entry chose
 * preselects the form; an entry that knows the failure (the fallback)
 * seeds the title and the description too.
 */

import type { IssueKind } from '@openheaders/core/diagnostics';
import { useSyncExternalStore } from 'react';

/** The two inputs an entry can fill in before the person sees them. */
export interface ReportIssueSeed {
  title: string;
  description: string;
}

export interface ReportIssueDialogState {
  open: boolean;
  kind: IssueKind;
  seed: ReportIssueSeed | null;
}

let state: ReportIssueDialogState = { open: false, kind: 'bug', seed: null };
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function openReportIssueDialog(kind: IssueKind, seed: ReportIssueSeed | null = null): void {
  if (state.open && state.kind === kind && state.seed === seed) return;
  state = { open: true, kind, seed };
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
