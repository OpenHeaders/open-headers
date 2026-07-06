/**
 * Workbench notifications store — the timeline behind the Notifications
 * tool window and the unseen dot on its activity-bar bell.
 *
 * Session-scoped module store (same pattern as the settings store):
 * producers anywhere in the workbench call {@link pushNotification};
 * the panel renders {@link useNotifications} newest-first and the bell
 * icon watches {@link useUnseenNotificationCount}. Opening the panel
 * marks everything seen (the dot clears); entries stay in the timeline
 * until dismissed or cleared.
 */

import { useSyncExternalStore } from 'react';

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export interface NotificationAction {
  label: string;
  run: () => void;
}

export interface NotificationEntry {
  id: string;
  severity: NotificationSeverity;
  title: string;
  description?: string;
  /** Epoch ms at push time. */
  timestamp: number;
  actions?: readonly NotificationAction[];
  /** Producer-supplied identity — a second push with the same key is dropped. */
  dedupeKey?: string;
}

export interface PushNotificationInput {
  severity?: NotificationSeverity;
  title: string;
  description?: string;
  actions?: readonly NotificationAction[];
  dedupeKey?: string;
}

let entries: readonly NotificationEntry[] = [];
let unseen = 0;
let seq = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const fn of listeners) fn();
}

export function pushNotification(input: PushNotificationInput): void {
  if (input.dedupeKey && entries.some((e) => e.dedupeKey === input.dedupeKey)) return;
  seq += 1;
  const entry: NotificationEntry = {
    id: `n${seq}`,
    severity: input.severity ?? 'info',
    title: input.title,
    description: input.description,
    actions: input.actions,
    dedupeKey: input.dedupeKey,
    timestamp: Date.now(),
  };
  entries = [entry, ...entries];
  unseen += 1;
  emit();
}

export function dismissNotification(id: string): void {
  const next = entries.filter((e) => e.id !== id);
  if (next.length === entries.length) return;
  entries = next;
  emit();
}

export function clearAllNotifications(): void {
  if (entries.length === 0 && unseen === 0) return;
  entries = [];
  unseen = 0;
  emit();
}

export function markAllNotificationsSeen(): void {
  if (unseen === 0) return;
  unseen = 0;
  emit();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const getEntries = () => entries;
const getUnseen = () => unseen;

/** Timeline, newest first. */
export function useNotifications(): readonly NotificationEntry[] {
  return useSyncExternalStore(subscribe, getEntries);
}

/** Entries pushed since the panel was last viewed — drives the bell dot. */
export function useUnseenNotificationCount(): number {
  return useSyncExternalStore(subscribe, getUnseen);
}

/** Test hook — reset module state between cases. */
export function __resetNotificationsForTests(): void {
  entries = [];
  unseen = 0;
  seq = 0;
  listeners.clear();
}
