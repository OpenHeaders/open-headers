/**
 * footer-status-store — the seam where tool windows publish their
 * footer summary and the status bar subscribes.
 *
 * Storage and Console own the state their summaries derive from
 * (section, typed filter, level mask) inside their tool-window
 * components, so the footer can't compute those lines itself. Each
 * view publishes its `FooterStatus` from an effect and clears it on
 * unmount; the status bar reads per-tool slices via
 * useSyncExternalStore. Lives outside React (focus-store idiom) so a
 * publish re-renders only the status bar, never the panel tree.
 *
 * Publishes are deduped field-by-field — builders mint a fresh object
 * per render, and an unchanged summary must not churn the snapshot
 * identity (panel identity-churn law).
 */

import { useSyncExternalStore } from 'react';
import type { ConsoleFooterStatus, StorageFooterStatus } from '../footer-status';

let storageStatus: StorageFooterStatus | null = null;
let consoleStatus: ConsoleFooterStatus | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function storageEqual(a: StorageFooterStatus, b: StorageFooterStatus): boolean {
  return a.summary === b.summary && a.matches === b.matches && a.alert === b.alert;
}

function consoleEqual(a: ConsoleFooterStatus, b: ConsoleFooterStatus): boolean {
  return (
    a.visibleCount === b.visibleCount &&
    a.totalCount === b.totalCount &&
    a.errorCount === b.errorCount &&
    a.warningCount === b.warningCount
  );
}

export function setStorageFooterStatus(next: StorageFooterStatus | null): void {
  if (storageStatus === next) return;
  if (storageStatus !== null && next !== null && storageEqual(storageStatus, next)) return;
  storageStatus = next;
  emit();
}

export function setConsoleFooterStatus(next: ConsoleFooterStatus | null): void {
  if (consoleStatus === next) return;
  if (consoleStatus !== null && next !== null && consoleEqual(consoleStatus, next)) return;
  consoleStatus = next;
  emit();
}

export function getStorageFooterStatus(): StorageFooterStatus | null {
  return storageStatus;
}

export function getConsoleFooterStatus(): ConsoleFooterStatus | null {
  return consoleStatus;
}

export function useStorageFooterStatus(): StorageFooterStatus | null {
  return useSyncExternalStore(subscribe, getStorageFooterStatus, getStorageFooterStatus);
}

export function useConsoleFooterStatus(): ConsoleFooterStatus | null {
  return useSyncExternalStore(subscribe, getConsoleFooterStatus, getConsoleFooterStatus);
}
