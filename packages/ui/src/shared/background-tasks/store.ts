/**
 * Background-tasks store — the list behind the footer progress
 * indicator and its "Processes" popover.
 *
 * Session-scoped module store (same pattern as the notifications
 * store): producers upsert a task while their long-running work is in
 * flight and remove it when the work settles; the footer renders the
 * newest task inline and the popover lists them all. Tasks are display
 * state only — removing one never cancels the underlying work.
 */

import { useSyncExternalStore } from 'react';

export interface BackgroundTaskAction {
  /** Button caption (e.g. "View report"). */
  label: string;
  /** Muted note rendered after the button (e.g. "215 import notes"). */
  note?: string;
  /** Producers must pass a stable reference — upserts compare it by identity. */
  run: () => void;
}

export interface BackgroundTaskStat {
  /** Count column, right-aligned in the grid (pre-formatted). */
  value: string;
  label: string;
}

export interface BackgroundTaskFootnote {
  /** Muted line rendered on its own row under the detail. */
  text: string;
  /** Explanation behind an (i) hover affordance next to the text. */
  hint?: string;
}

/**
 * A task that can actually be stopped. When present, the ✕ affordance
 * asks for confirmation and calls `run` (which cancels the underlying
 * work) instead of merely hiding the entry — the terminal state then
 * arrives through the producer like any other update.
 */
export interface BackgroundTaskCancel {
  /** Confirmation prompt shown before stopping. */
  confirm: string;
  /** Producers must pass a stable reference — upserts compare it by identity. */
  run: () => void;
}

export interface BackgroundTask {
  /** Stable producer-chosen identity — upserts replace by id. */
  id: string;
  title: string;
  /** Optional second line shown in the Processes popover. */
  detail?: string;
  /** Aligned count/label rows rendered as a grid under the detail
   *  (e.g. an import summary). */
  stats?: readonly BackgroundTaskStat[];
  /** Standalone muted line under the detail, with an optional (i)
   *  hover explanation (e.g. a vendor-imposed quota). */
  footnote?: BackgroundTaskFootnote;
  /** 0–100, or null for indeterminate. */
  percent: number | null;
  /** Renders the progress bar in its failure state. */
  error?: boolean;
  /** The work settled successfully — renders green with a check mark
   *  instead of the in-flight pulse. */
  done?: boolean;
  /** Follow-up rendered as a button under the task in the Processes
   *  panel (e.g. "View report"). */
  action?: BackgroundTaskAction;
  /** Present while the underlying work can be stopped — turns the ✕
   *  into a confirm-then-cancel affordance. */
  cancel?: BackgroundTaskCancel;
}

let tasks: readonly BackgroundTask[] = [];
const listeners = new Set<() => void>();

function commit(next: readonly BackgroundTask[]): void {
  tasks = next;
  for (const fn of listeners) fn();
}

function sameStats(a: readonly BackgroundTaskStat[] | undefined, b: readonly BackgroundTaskStat[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((stat, i) => stat.value === b[i].value && stat.label === b[i].label);
}

/** Insert the task, or update it in place when the id already exists. */
export function upsertBackgroundTask(task: BackgroundTask): void {
  const index = tasks.findIndex((t) => t.id === task.id);
  if (index === -1) {
    commit([...tasks, task]);
    return;
  }
  const existing = tasks[index];
  if (
    existing.title === task.title &&
    existing.detail === task.detail &&
    sameStats(existing.stats, task.stats) &&
    existing.footnote?.text === task.footnote?.text &&
    existing.footnote?.hint === task.footnote?.hint &&
    existing.percent === task.percent &&
    existing.error === task.error &&
    existing.done === task.done &&
    existing.action?.label === task.action?.label &&
    existing.action?.note === task.action?.note &&
    existing.action?.run === task.action?.run &&
    existing.cancel?.confirm === task.cancel?.confirm &&
    existing.cancel?.run === task.cancel?.run
  )
    return;
  const next = tasks.slice();
  next[index] = task;
  commit(next);
}

export function removeBackgroundTask(id: string): void {
  const next = tasks.filter((t) => t.id !== id);
  if (next.length === tasks.length) return;
  commit(next);
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const getTasks = () => tasks;

/** All in-flight tasks, insertion order. */
export function useBackgroundTasks(): readonly BackgroundTask[] {
  return useSyncExternalStore(subscribe, getTasks);
}

// The Processes panel's visibility lives here so producers can surface
// it when their work starts (e.g. the migration pull opens it on
// kickoff instead of leaving only the footer slot as a hint).
let panelOpen = false;

export function setBackgroundTasksPanelOpen(open: boolean): void {
  if (panelOpen === open) return;
  panelOpen = open;
  for (const fn of listeners) fn();
}

const getPanelOpen = () => panelOpen;

/** Whether the standalone Processes panel is showing. */
export function useBackgroundTasksPanelOpen(): boolean {
  return useSyncExternalStore(subscribe, getPanelOpen);
}

/** Test hook — reset module state between cases. */
export function __resetBackgroundTasksForTests(): void {
  tasks = [];
  panelOpen = false;
  listeners.clear();
}
