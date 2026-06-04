/**
 * `usePanelUiState` — panel-local UI state for the inspector toolbar.
 *
 * Separates the four pieces of panel state that have NOTHING to do
 * with the request lifecycle or page list — they're user-facing
 * toggles owned by the panel itself:
 *
 *   - `preserveLog` — when false, the panel clears its stores on
 *     navigation. Defaults to `true` (power-user preference, see the
 *     legacy `InspectorStore` rationale).
 *   - `recording` — when false, new request/page updates are ignored
 *     visually. The current implementation does not silence engine
 *     emission; it's a render-time filter the caller honors. Default
 *     `true`.
 *   - `clear()` — explicitly drop everything in the registered
 *     resettable stores. The hook does NOT own the stores; the caller
 *     registers them via `resettables` so the hook stays decoupled
 *     from any specific store shape (lifecycle, page, fire, ...).
 *
 * Pure UI state — no port, no derivation. Stable callback identities
 * (via `useRef` for the latest resettables list) so component memo
 * boundaries don't churn.
 */

import { useCallback, useRef, useState } from 'react';

export interface Resettable {
  clear(): void;
}

export interface UsePanelUiStateOptions {
  /**
   * Optional default for `preserveLog`. Defaults to `true`; pass
   * `false` to match Chrome's Network tab "clear-on-nav" default.
   */
  readonly defaultPreserveLog?: boolean;
  /**
   * Optional default for `recording`. Defaults to `true`.
   */
  readonly defaultRecording?: boolean;
  /**
   * Stores whose `clear()` runs when the user invokes the toolbar
   * Clear action. The hook reads the latest array via a ref each
   * call, so callers can pass a freshly-constructed array per render
   * without causing the `clear` callback identity to churn.
   */
  readonly resettables: readonly Resettable[];
  /**
   * Injectable clock for the manual-clear floor; defaults to `Date.now`.
   * Shares the engine's `startedAtMs` epoch (wall-clock ms).
   */
  readonly now?: () => number;
}

export interface UsePanelUiStateResult {
  readonly preserveLog: boolean;
  setPreserveLog(value: boolean): void;
  readonly recording: boolean;
  setRecording(value: boolean): void;
  /** Run `clear()` on every registered resettable. */
  clear(): void;
  /**
   * Wall-clock ms of the last manual Clear, or `-1` if never cleared. The
   * panel-local floor for the Resource Timing (memory-cache) feed — which
   * has no engine floor — so synthetic rows that started before the Clear
   * are dropped instead of resurfacing once their real rows are gone.
   */
  readonly clearFloorMs: number;
}

export function usePanelUiState(options: UsePanelUiStateOptions): UsePanelUiStateResult {
  const [preserveLog, setPreserveLog] = useState(options.defaultPreserveLog ?? true);
  const [recording, setRecording] = useState(options.defaultRecording ?? true);
  const [clearFloorMs, setClearFloorMs] = useState(-1);

  const resettablesRef = useRef(options.resettables);
  resettablesRef.current = options.resettables;
  const nowRef = useRef(options.now ?? Date.now);
  nowRef.current = options.now ?? Date.now;

  const clear = useCallback(() => {
    for (const store of resettablesRef.current) {
      try {
        store.clear();
      } catch {
        /* a resettable throwing must not block siblings */
      }
    }
    // Advance the RT clear floor so the cleared requests' still-cached
    // Resource Timing entries don't resurface as `(memory cache)` rows.
    setClearFloorMs(nowRef.current());
  }, []);

  return { preserveLog, setPreserveLog, recording, setRecording, clear, clearFloorMs };
}
