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
 *
 * Suggestions are a separate list behind the panel's top section:
 * standing advice about the user's setup rather than events, so they
 * carry no timestamp, don't feed the bell dot, and stay until their
 * producer removes them or the user dismisses one via an action.
 *
 * Keyed, non-sticky entries can be muted ("Don't show again") for good.
 * Mutes persist in localStorage and gate pushes, so a muted key never
 * re-enters any list until unmuted (the panel pushes a timeline notice
 * with a Re-enable action on mute). Sticky entries ignore mutes — only
 * their producer's actions retire them.
 */

import type { ReactNode } from 'react';
import { useSyncExternalStore } from 'react';

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export interface NotificationAction {
  label: string;
  run: () => void;
  /** Optional glyph rendered before the label. */
  icon?: ReactNode;
  /** Optional hover hint explaining what the action does. */
  tooltip?: string;
  /**
   * Render style for a suggestion's primary slot — 'button' (default)
   * for a bordered follow-through, 'link' for the same blue text link
   * the timeline cards use. Non-primary actions always render as links.
   */
  variant?: 'button' | 'link';
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

export interface SuggestionEntry {
  id: string;
  severity: NotificationSeverity;
  title: string;
  description?: ReactNode;
  /**
   * The first action renders as a bordered button (the suggestion's
   * primary follow-through), the rest as links.
   */
  actions?: readonly NotificationAction[];
  /** Producer-supplied identity — a second push with the same key is dropped. */
  dedupeKey?: string;
  /** Custom card glyph; falls back to the severity icon. */
  icon?: ReactNode;
  /**
   * Sticky suggestions have no mute menu, survive Clear all, and ignore
   * mutes — same contract as sticky timeline entries: only the producer
   * removes them (via {@link dismissSuggestionByKey}).
   */
  sticky?: boolean;
}

export interface PushSuggestionInput {
  severity?: NotificationSeverity;
  title: string;
  description?: ReactNode;
  actions?: readonly NotificationAction[];
  dedupeKey?: string;
  icon?: ReactNode;
  sticky?: boolean;
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
let suggestions: readonly SuggestionEntry[] = [];
// Derived from `entries` on every mutation — never counted separately,
// so removing an unseen entry (action auto-dismiss, clear) retires the
// bell dot with it.
let unseen = 0;
let seq = 0;
const listeners = new Set<() => void>();

// ── Cross-surface acknowledge (keyed entries only) ──────────────────
//
// Each surface (workbench tab, devtools panel, popup) runs its own
// module store — entries hold React nodes and action closures, so they
// can't be shared. What CAN be shared is the acknowledgment: every
// extension page lives on one origin, so acked dedupe keys persist in
// localStorage and `storage` events fan the ack out to the surfaces
// that are already open. A keyed entry acked anywhere arrives
// pre-seen everywhere else; un-keyed entries stay surface-local.
const ACK_STORAGE_KEY = 'oh.notificationsAckedKeys';
const ACK_CAP = 200;

function readAckedKeys(): ReadonlySet<string> {
  try {
    const raw = window.localStorage.getItem(ACK_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : []);
  } catch {
    return new Set();
  }
}

function persistAckedKeys(keys: Iterable<string>): void {
  try {
    const merged = new Set(readAckedKeys());
    for (const k of keys) merged.add(k);
    window.localStorage.setItem(ACK_STORAGE_KEY, JSON.stringify(Array.from(merged).slice(-ACK_CAP)));
  } catch {
    // Storage unavailable — acks stay surface-local this session.
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== ACK_STORAGE_KEY) return;
    const acked = readAckedKeys();
    if (entries.some((en) => !en.seen && en.dedupeKey !== undefined && acked.has(en.dedupeKey))) {
      commit(entries.map((en) => (!en.seen && en.dedupeKey && acked.has(en.dedupeKey) ? { ...en, seen: true } : en)));
    }
  });
}

// ── "Don't show again" mutes (keyed entries only) ────────────────────
const MUTE_STORAGE_KEY = 'oh.notificationsMutedKeys';
const MUTE_CAP = 200;

function readMutedKeys(): ReadonlySet<string> {
  try {
    const raw = window.localStorage.getItem(MUTE_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === 'string') : []);
  } catch {
    return new Set();
  }
}

function persistMutedKeys(keys: ReadonlySet<string>): void {
  try {
    window.localStorage.setItem(MUTE_STORAGE_KEY, JSON.stringify(Array.from(keys).slice(-MUTE_CAP)));
  } catch {
    // Storage unavailable — the mute still applies to this session's lists.
  }
}

function isMuted(dedupeKey: string): boolean {
  return readMutedKeys().has(dedupeKey);
}

/** Mute a keyed entry for good and drop it from both lists. */
export function muteNotificationKey(dedupeKey: string): void {
  const merged = new Set(readMutedKeys());
  merged.add(dedupeKey);
  persistMutedKeys(merged);
  dismissByKey(dedupeKey);
  dismissSuggestionByKey(dedupeKey);
}

/** Allow a muted key to show again (existing entries are gone — this
 *  only lifts the push-time gate). */
export function unmuteNotificationKey(dedupeKey: string): void {
  const muted = new Set(readMutedKeys());
  if (!muted.delete(dedupeKey)) return;
  persistMutedKeys(muted);
}

function commit(next: readonly NotificationEntry[]): void {
  entries = next;
  unseen = next.reduce((sum, e) => sum + (e.seen ? 0 : 1), 0);
  for (const fn of listeners) fn();
}

export function pushNotification(input: PushNotificationInput): void {
  if (input.dedupeKey && entries.some((e) => e.dedupeKey === input.dedupeKey)) return;
  // Sticky entries are producer-controlled only — they never expose the
  // mute menu and ignore any mute, so an action click stays the one way
  // they retire.
  if (input.dedupeKey && !input.sticky && isMuted(input.dedupeKey)) return;
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
    // Keyed entries acknowledged on another surface arrive pre-seen.
    seen: input.dedupeKey !== undefined && readAckedKeys().has(input.dedupeKey),
    timestamp: Date.now(),
  };
  commit([entry, ...entries]);
}

function commitSuggestions(next: readonly SuggestionEntry[]): void {
  suggestions = next;
  for (const fn of listeners) fn();
}

export function pushSuggestion(input: PushSuggestionInput): void {
  if (input.dedupeKey && suggestions.some((s) => s.dedupeKey === input.dedupeKey)) return;
  // Sticky suggestions are producer-controlled only — like sticky
  // timeline entries they ignore mutes.
  if (input.dedupeKey && !input.sticky && isMuted(input.dedupeKey)) return;
  seq += 1;
  commitSuggestions([
    {
      id: `s${seq}`,
      severity: input.severity ?? 'info',
      title: input.title,
      description: input.description,
      actions: input.actions,
      dedupeKey: input.dedupeKey,
      icon: input.icon,
      sticky: input.sticky,
    },
    ...suggestions,
  ]);
}

export function dismissSuggestion(id: string): void {
  const next = suggestions.filter((s) => s.id !== id);
  if (next.length === suggestions.length) return;
  commitSuggestions(next);
}

/** Clears the suggestions except sticky ones, which only their producer removes. */
export function clearAllSuggestions(): void {
  if (suggestions.every((s) => s.sticky)) return;
  commitSuggestions(suggestions.filter((s) => s.sticky));
}

/** Producer-side removal by dedupe key. */
export function dismissSuggestionByKey(dedupeKey: string): void {
  const next = suggestions.filter((s) => s.dedupeKey !== dedupeKey);
  if (next.length === suggestions.length) return;
  commitSuggestions(next);
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
  persistAckedKeys(entries.flatMap((e) => (e.dedupeKey !== undefined ? [e.dedupeKey] : [])));
  commit(entries.filter((e) => e.sticky).map((e) => (e.seen ? e : { ...e, seen: true })));
}

export function markAllNotificationsSeen(): void {
  if (unseen === 0) return;
  persistAckedKeys(entries.flatMap((e) => (e.dedupeKey !== undefined ? [e.dedupeKey] : [])));
  commit(entries.map((e) => (e.seen ? e : { ...e, seen: true })));
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const getEntries = () => entries;
const getSuggestions = () => suggestions;
const getUnseen = () => unseen;

/** Timeline, newest first. */
export function useNotifications(): readonly NotificationEntry[] {
  return useSyncExternalStore(subscribe, getEntries);
}

/** Standing suggestions, newest first. */
export function useSuggestions(): readonly SuggestionEntry[] {
  return useSyncExternalStore(subscribe, getSuggestions);
}

/** Entries pushed since the panel was last viewed — drives the bell dot. */
export function useUnseenNotificationCount(): number {
  return useSyncExternalStore(subscribe, getUnseen);
}

/** Test hook — reset module state between cases. */
export function __resetNotificationsForTests(): void {
  entries = [];
  suggestions = [];
  unseen = 0;
  seq = 0;
  listeners.clear();
}
