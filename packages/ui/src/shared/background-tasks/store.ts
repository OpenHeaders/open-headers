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

export interface BackgroundTask {
  /** Stable producer-chosen identity — upserts replace by id. */
  id: string;
  title: string;
  /** Optional second line shown in the Processes popover. */
  detail?: string;
  /** 0–100, or null for indeterminate. */
  percent: number | null;
  /** Renders the progress bar in its failure state. */
  error?: boolean;
  /** The work settled successfully — renders green with a check mark
   *  instead of the in-flight pulse. */
  done?: boolean;
  /**
   * Click-through for a settled task (e.g. "view report"). Producers
   * must pass a stable reference — upserts compare it by identity.
   */
  onActivate?: () => void;
}

let tasks: readonly BackgroundTask[] = [];
const listeners = new Set<() => void>();

function commit(next: readonly BackgroundTask[]): void {
  tasks = next;
  for (const fn of listeners) fn();
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
    existing.percent === task.percent &&
    existing.error === task.error &&
    existing.done === task.done &&
    existing.onActivate === task.onActivate
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
