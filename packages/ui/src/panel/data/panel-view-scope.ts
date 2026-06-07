/**
 * `panel-view-scope` — the single display-scope predicate the projection
 * applies to BOTH halves of the network data plane: request lifecycles
 * (rows) and pages (navigations). It composes the two recording-state
 * axes that decide whether something the stores hold is currently shown:
 *
 *   - the navigation clear floor (Preserve log) — a monotonic
 *     `startedAtMs` floor; anything before it is scoped out (see
 *     `use-nav-clear-floor.ts`);
 *   - the recording windows (record / stop) — anything that started while
 *     recording was stopped is scoped out (see `use-recording-windows.ts`).
 *
 * Pulling the predicate out of `projectPanelData` is what keeps rows and
 * pages from drifting apart: the page block, footer milestones, status-bar
 * counts, and the HAR export's page set all derive from the same scope as
 * the rows, so they can never disagree under stop/resume or Preserve-log
 * toggles (the browser scopes its whole network log, not just the rows).
 *
 * The manual-Clear floor (`clearFloorMs`) is deliberately NOT part of this
 * seam: it scopes only the synthetic Resource Timing feed, which has no
 * engine floor of its own. Real rows and pages share exactly this predicate.
 */

import { isRecorded, type RecordingWindow } from './use-recording-windows';

export interface PanelViewScope {
  /**
   * Navigation clear floor (a `startedAtMs` value). `-1` means no floor
   * (show everything). Anything with `startedAtMs >= navClearFloorMs` is
   * in scope.
   */
  readonly navClearFloorMs: number;
  /**
   * Recording windows. `undefined` means "always recording" (no recording
   * filter); otherwise an item is in scope only if its `startedAtMs` falls
   * inside one window.
   */
  readonly recordingWindows?: readonly RecordingWindow[];
}

/**
 * True when something that started at `startedAtMs` is currently displayed,
 * given the recording-state `scope`. The one predicate rows AND pages run
 * through.
 */
export function isInView(startedAtMs: number, scope: PanelViewScope): boolean {
  const { navClearFloorMs, recordingWindows } = scope;
  return (
    (navClearFloorMs < 0 || startedAtMs >= navClearFloorMs) &&
    (recordingWindows === undefined || isRecorded(startedAtMs, recordingWindows))
  );
}
