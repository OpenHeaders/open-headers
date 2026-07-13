/**
 * Console panel preferences + session state — a module-level store so the
 * settings survive tool-window switches (ConsoleView unmounts whenever the
 * Console window hides; the console entry buffer already lives at the panel
 * root for the same reason). Panel-local by design: the browser persists
 * its console settings across sessions, ours reset with the panel — the
 * accepted residual from the JS-contexts epic.
 *
 * Also owns the preserve-log cutoff: the browser clears the console on
 * main-frame navigation unless "Preserve log" is on. Our nav signal is the
 * top context being recreated (navigation clears the root session's
 * contexts, so `top`'s contextKey changes); entries before the cutoff stay
 * in the root buffer (history is never destroyed) but the view starts at
 * the newest navigation.
 */

import { useSyncExternalStore } from 'react';
import { type ConsoleLevelsMask, DEFAULT_LEVELS } from './console-levels';

export interface ConsolePrefs {
  readonly levels: ConsoleLevelsMask;
  readonly hideNetwork: boolean;
  readonly preserveLog: boolean;
  readonly selectedContextOnly: boolean;
  readonly settingsOpen: boolean;
  /** Entries before this index are hidden (cleared by a navigation). */
  readonly cutoff: number;
}

const defaults: ConsolePrefs = {
  levels: DEFAULT_LEVELS,
  hideNetwork: false,
  preserveLog: false,
  selectedContextOnly: false,
  settingsOpen: false,
  cutoff: 0,
};

let prefs: ConsolePrefs = defaults;
/** The last seen `top` contextKey — a change means the page navigated. */
let lastTopKey: string | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function setConsolePrefs(patch: Partial<ConsolePrefs>): void {
  prefs = { ...prefs, ...patch };
  emit();
}

/**
 * Track the `top` context across renders; a key change (both sides live)
 * is a navigation — without "Preserve log", the view cuts to the entries
 * that arrive from here on.
 */
export function noteTopContext(topKey: string | null, entryCount: number): void {
  if (topKey === null) return;
  const previous = lastTopKey;
  lastTopKey = topKey;
  if (previous === null || previous === topKey) return;
  if (!prefs.preserveLog) setConsolePrefs({ cutoff: entryCount });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useConsolePrefs(): ConsolePrefs {
  return useSyncExternalStore(subscribe, () => prefs);
}

/** Test seam — the store is module-level state. */
export function resetConsolePrefs(): void {
  prefs = defaults;
  lastTopKey = null;
  emit();
}
