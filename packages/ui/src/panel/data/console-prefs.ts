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
  /** Synthesize "finished/failed loading" rows for XHR-category requests. */
  readonly logXhr: boolean;
  readonly preserveLog: boolean;
  /** Silent side-effect-free preview of the prompt text as it is typed. */
  readonly eagerEval: boolean;
  readonly selectedContextOnly: boolean;
  /** Suggest prior prompt commands as the user types. */
  readonly autocompleteHistory: boolean;
  /** Collapse repeated identical messages into one row with a count. */
  readonly groupSimilar: boolean;
  /** Off hides the browser's CORS-policy error messages. */
  readonly showCorsErrors: boolean;
  /** `Runtime.evaluate` with `userGesture` — the browser's "Treat code
   *  evaluation as user action". */
  readonly evalUserGesture: boolean;
  readonly settingsOpen: boolean;
  /** Entries before this index are hidden (cleared by a navigation). */
  readonly cutoff: number;
  /**
   * Wall-clock twin of {@link cutoff} — the instant of the latest cut
   * (navigation without "Preserve log", or a client-local Clear). Scopes the
   * rows the console DERIVES rather than buffers (the "Log XMLHttpRequests"
   * entries come from the network plane, so an index into the console buffer
   * can't cut them).
   */
  readonly cutoffMs: number;
  /**
   * The prompt's submitted-command ring, oldest first. Lives here — not in
   * ConsolePrompt state — so the history survives tool-window switches like
   * every other console pref; ↑/↓ walk it and the history autocomplete
   * prefix-matches against it.
   */
  readonly promptHistory: readonly string[];
}

/** Defaults mirror the browser's console settings defaults. */
const defaults: ConsolePrefs = {
  levels: DEFAULT_LEVELS,
  hideNetwork: false,
  logXhr: false,
  preserveLog: false,
  eagerEval: true,
  selectedContextOnly: false,
  autocompleteHistory: true,
  groupSimilar: true,
  showCorsErrors: true,
  evalUserGesture: true,
  settingsOpen: false,
  cutoff: 0,
  cutoffMs: 0,
  promptHistory: [],
};

/** Ring bound on {@link ConsolePrefs.promptHistory} (the browser keeps 300). */
const MAX_PROMPT_HISTORY = 300;

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
 * Append a submitted prompt command to the history ring — consecutive
 * duplicates collapse (the browser's rule) and the ring drops its oldest
 * past {@link MAX_PROMPT_HISTORY}.
 */
export function pushConsolePromptHistory(expression: string): void {
  const history = prefs.promptHistory;
  if (history[history.length - 1] === expression) return;
  const next = [...history, expression];
  setConsolePrefs({ promptHistory: next.length > MAX_PROMPT_HISTORY ? next.slice(-MAX_PROMPT_HISTORY) : next });
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
  if (!prefs.preserveLog) setConsolePrefs({ cutoff: entryCount, cutoffMs: Date.now() });
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
