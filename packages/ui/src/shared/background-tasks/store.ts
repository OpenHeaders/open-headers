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
  if (existing.title === task.title && existing.detail === task.detail && existing.percent === task.percent) return;
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

/** Test hook — reset module state between cases. */
export function __resetBackgroundTasksForTests(): void {
  tasks = [];
  listeners.clear();
}
