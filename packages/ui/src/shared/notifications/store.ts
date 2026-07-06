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

import type { ReactNode } from 'react';
import { useSyncExternalStore } from 'react';

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export interface NotificationAction {
  label: string;
  run: () => void;
  /** Optional glyph rendered before the label. */
  icon?: ReactNode;
}

export interface NotificationEntry {
  id: string;
  severity: NotificationSeverity;
  title: string;
  description?: ReactNode;
  /** Epoch ms at push time. */
  timestamp: number;
  actions?: readonly NotificationAction[];
  /** Producer-supplied identity — a second push with the same key is dropped. */
  dedupeKey?: string;
  /** Custom card glyph; falls back to the severity icon. */
  icon?: ReactNode;
  /**
   * Sticky entries have no dismiss affordance and survive Clear all —
   * only the producer removes them (via {@link dismissByKey}, typically
   * from one of the entry's own actions).
   */
  sticky?: boolean;
  /**
   * Whether the user has viewed this entry (panel close marks all).
   * The bell dot derives from the unseen count, so removing an unseen
   * entry retires the dot with it.
   */
  seen: boolean;
}

export interface PushNotificationInput {
  severity?: NotificationSeverity;
  title: string;
  description?: ReactNode;
  actions?: readonly NotificationAction[];
  dedupeKey?: string;
  icon?: ReactNode;
  sticky?: boolean;
}

let entries: readonly NotificationEntry[] = [];
// Derived from `entries` on every mutation — never counted separately,
// so removing an unseen entry (action auto-dismiss, clear) retires the
// bell dot with it.
let unseen = 0;
let seq = 0;
const listeners = new Set<() => void>();

function commit(next: readonly NotificationEntry[]): void {
  entries = next;
  unseen = next.reduce((sum, e) => sum + (e.seen ? 0 : 1), 0);
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
    icon: input.icon,
    sticky: input.sticky,
    seen: false,
    timestamp: Date.now(),
  };
  commit([entry, ...entries]);
}

export function dismissNotification(id: string): void {
  const next = entries.filter((e) => e.id !== id);
  if (next.length === entries.length) return;
  commit(next);
}

/** Producer-side removal by dedupe key — the only way a sticky entry leaves. */
export function dismissByKey(dedupeKey: string): void {
  const next = entries.filter((e) => e.dedupeKey !== dedupeKey);
  if (next.length === entries.length) return;
  commit(next);
}

/** Clears the timeline except sticky entries, which only their producer removes. */
export function clearAllNotifications(): void {
  if (unseen === 0 && entries.every((e) => e.sticky)) return;
  commit(entries.filter((e) => e.sticky).map((e) => (e.seen ? e : { ...e, seen: true })));
}

export function markAllNotificationsSeen(): void {
  if (unseen === 0) return;
  commit(entries.map((e) => (e.seen ? e : { ...e, seen: true })));
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
