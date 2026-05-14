/**
 * StatusStore — the single "something's wrong" surface every subsystem
 * reports into. Kept intentionally tiny: one entry per subsystem,
 * subscriber pattern, no persistence.
 *
 * Persistence lives in the observability log (`observability/ring.ts`).
 * Status is the *current* snapshot; the log is the *history*. Reloading
 * the SW resets Status — subsystems re-emit on first relevant event.
 *
 * This store lives in `@openheaders/ui` because both the host reactor
 * (writes) and the renderer (reads via bridge broadcast) need the same
 * type vocabulary. The UI-side hook (`useStatus`) mirrors the host
 * store over the `statusUpdated` broadcast.
 */

import type { StatusEntry, StatusLevel, StatusListener, StatusSnapshot, StatusSubsystem } from './types';

const snapshot: StatusSnapshot = {};
const listeners = new Set<StatusListener>();

function notify(): void {
  const copy: StatusSnapshot = { ...snapshot };
  for (const fn of listeners) fn(copy);
}

export interface ReportInput {
  subsystem: StatusSubsystem;
  state: StatusLevel;
  message: string;
  context?: Record<string, unknown>;
}

/**
 * Record the current state of a subsystem. Overwrites the previous
 * entry for that subsystem — Status is a snapshot, not a history.
 */
export function report(input: ReportInput): void {
  const entry: StatusEntry = {
    subsystem: input.subsystem,
    state: input.state,
    message: input.message,
    context: input.context,
    timestamp: Date.now(),
  };
  const prev = snapshot[input.subsystem];
  snapshot[input.subsystem] = entry;
  // Avoid notify churn when a subsystem re-emits the same state with
  // the same message. Context differences still count as a change
  // (fresh ruleId / errorClass may be interesting to the UI).
  if (
    prev &&
    prev.state === entry.state &&
    prev.message === entry.message &&
    contextsEqual(prev.context, entry.context)
  ) {
    return;
  }
  notify();
}

/** Read the current snapshot. Intentionally returns a fresh copy — UIs must not mutate the source of truth. */
export function getStatusSnapshot(): StatusSnapshot {
  return { ...snapshot };
}

/** Subscribe to snapshot changes. Returns an unsubscribe fn. */
export function subscribe(listener: StatusListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Drop every recorded entry. Used by tests + on clearObservabilityLog. */
export function clearStatus(): void {
  let touched = false;
  for (const key of Object.keys(snapshot) as StatusSubsystem[]) {
    delete snapshot[key];
    touched = true;
  }
  if (touched) notify();
}

// ── Internal ────────────────────────────────────────────────────

function contextsEqual(a: Record<string, unknown> | undefined, b: Record<string, unknown> | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

// ── Test helpers ────────────────────────────────────────────────

/** Reset internal state — tests only. */
export function __resetForTests(): void {
  for (const key of Object.keys(snapshot) as StatusSubsystem[]) {
    delete snapshot[key];
  }
  listeners.clear();
}
