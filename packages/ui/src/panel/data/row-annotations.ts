/**
 * Row annotations — the data layer behind the always-on OH annotation
 * rail in the traffic table and the matching insight cards in the detail
 * pane. One pure classifier, two consumers, never two derivations.
 *
 * The Chrome-parity region of the grid renders exactly what the browser
 * renders — which means it inherits the browser's blind spots: a document
 * canceled mid-stream reads as a finished `200`, a row reconstructed from
 * auxiliary signals looks like a wire capture, and the default capture
 * path's structural limits are invisible. Annotations carry what OH knows
 * beyond what the parity region may show, on a dedicated OH-native rail
 * (sibling of the rule-fire dot rail) so the parity columns stay 1:1.
 *
 * Admission is strict — structural anomalies only. Routine states
 * (in-flight pending, a plain `(canceled)` with no status, cache hits)
 * already speak through the parity cells; annotating them would make the
 * rail noise. Severity is two-tier: `warn` for "this row is not what it
 * looks like", `info` for provenance/fidelity context.
 *
 * Derived at render time from the lifecycle + panel context; never cached
 * onto the lifecycle.
 */

import type { LifecycleSource, RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { MATERIAL_DEBUG_PAUSE_MS } from '@openheaders/core/request-lifecycle';
import { currentResponseBody, lifecycleTransferredBytes } from './inspector-row-projection';
import type { DetailSection } from './inspector-tab';
import {
  effectiveStatusCode,
  hasObservedResponseData,
  isCancellationShapedTerminal,
  isPreservedUnknown,
  type SupersessionAnchor,
} from './request-state';

export type RowAnnotationKind = 'interrupted' | 'never-finished' | 'fidelity-gap' | 'synthetic' | 'debug-paused';

export type RowAnnotationSeverity = 'warn' | 'info';

export interface RowAnnotation {
  readonly kind: RowAnnotationKind;
  readonly severity: RowAnnotationSeverity;
  /** Short rail/tooltip label ("Transfer interrupted"). */
  readonly label: string;
  /** One-sentence explanation — the insight card's body. */
  readonly detail: string;
  /** Detail-pane section a rail click should land on. */
  readonly section: DetailSection;
}

/** Panel-level context the classifier reads alongside the lifecycle. */
export interface RowAnnotationContext {
  /** The supersession anchor — same source as the list cells' "(unknown)". */
  readonly anchor: SupersessionAnchor;
  /** Which correlator feeds the inspected tab (fidelity annotations are
   *  meta-UI and may read provenance; Chrome-parity cells never do). */
  readonly source: LifecycleSource;
}

/** Synthesized-row requestId prefixes (disjoint from chrome's ids). */
const SYNTHETIC_PREFIXES = ['oh-har:', 'oh-mem:'] as const;

const INTERRUPTED: RowAnnotation = {
  kind: 'interrupted',
  severity: 'warn',
  label: 'Transfer interrupted',
  detail:
    'The download was canceled before it finished. The status reflects the headers that arrived before the ' +
    'interruption, and the received data is incomplete — the row is otherwise indistinguishable from a completed one.',
  section: 'headers',
};

const NEVER_FINISHED: RowAnnotation = {
  kind: 'never-finished',
  severity: 'info',
  label: 'Never finished',
  detail:
    'The page that issued this request unloaded while it was still in flight, so no outcome was ever recorded — ' +
    'that is why Status and Time read "(unknown)".',
  section: 'headers',
};

const FIDELITY_GAP: RowAnnotation = {
  kind: 'fidelity-gap',
  severity: 'info',
  label: 'Capture-fidelity gap',
  detail:
    'Transferred bytes and the response body are not visible to the default capture path for requests that never ' +
    'finished — CDP-enhanced inspection records them.',
  section: 'headers',
};

const SYNTHETIC_HAR: RowAnnotation = {
  kind: 'synthetic',
  severity: 'info',
  label: 'Synthesized row',
  detail:
    'This row was reconstructed from a capture record that never joined a live request, so some columns cannot be ' +
    'filled.',
  section: 'headers',
};

const SYNTHETIC_MEMORY: RowAnnotation = {
  kind: 'synthetic',
  severity: 'info',
  label: 'Synthesized row',
  detail:
    'This row was reconstructed from the page’s Resource Timing (a memory-cache hit never reaches the network ' +
    'stack), so headers and cookies are not available.',
  section: 'headers',
};

// Built per-row because the held duration is part of the copy. The hold is a
// measured fact stamped on the lifecycle by the control plane (`pausedByDebugMs`);
// the rail re-checks materiality as defence in depth against an immaterial value.
function debugPausedAnnotation(pausedByDebugMs: number): RowAnnotation {
  return {
    kind: 'debug-paused',
    severity: 'info',
    label: 'Debug-mode hold',
    detail:
      `${Math.round(pausedByDebugMs)} ms of this row’s time was spent paused in debug-mode interception, not ` +
      'waiting on the server or network — debug mode held the request while it inspected it, so the row’s total ' +
      'time runs longer than the request itself took.',
    section: 'timing',
  };
}

/**
 * Classify one row. Returns the annotations in severity order (`warn`
 * first) — the rail's single glyph is `annotations[0]`, the tooltip and
 * the detail-pane cards enumerate all.
 *
 * The facts, per kind:
 *   - `interrupted` — a successful (2xx) response whose transfer was
 *     killed: a cancellation-shaped terminal error (the heuristic path's
 *     webRequest fact), or the frame-stop record on a still-in-flight
 *     request (`loadingStoppedAtMs`, the CDP path's only record of a
 *     document canceled mid-stream — no Network terminal ever arrives).
 *   - `never-finished` — the preserved-unknown rows: issuing page gone,
 *     no confirmed response data, "(unknown)" in the parity cells.
 *     Mutually exclusive with `interrupted` (a confirmed response keeps
 *     its status and annotates as interrupted instead).
 *   - `fidelity-gap` — heuristic capture of an interrupted/never-finished
 *     row whose bytes and body are structurally absent (probe-proven hard
 *     limits of the default path; CDP-enhanced records them).
 *   - `synthetic` — the row's lifecycle was synthesized (`oh-har:` /
 *     `oh-mem:`), not observed on the request wire.
 *   - `debug-paused` — the control plane held this request in CDP `Fetch`
 *     interception for a material duration (`pausedByDebugMs`); the hold is
 *     debug-mode overhead, not server/network time, so the row's total time
 *     overstates what the request actually took.
 */
export function classifyRowAnnotations(
  lifecycle: RequestLifecycle,
  ctx: RowAnnotationContext,
): readonly RowAnnotation[] {
  const annotations: RowAnnotation[] = [];

  const preserved = isPreservedUnknown(lifecycle, ctx.anchor);
  const neverFinished = preserved && !hasObservedResponseData(lifecycle);
  const code = effectiveStatusCode(lifecycle);
  const succeeded = code != null && code >= 200 && code < 300;
  const interrupted =
    !neverFinished &&
    succeeded &&
    (isCancellationShapedTerminal(lifecycle) ||
      (lifecycle.completedAtMs == null && lifecycle.loadingStoppedAtMs != null));

  if (interrupted) annotations.push(INTERRUPTED);
  if (neverFinished) annotations.push(NEVER_FINISHED);

  if (
    ctx.source === 'heuristic' &&
    (interrupted || neverFinished) &&
    lifecycleTransferredBytes(lifecycle) == null &&
    currentResponseBody(lifecycle) == null
  ) {
    annotations.push(FIDELITY_GAP);
  }

  if (lifecycle.pausedByDebugMs != null && lifecycle.pausedByDebugMs >= MATERIAL_DEBUG_PAUSE_MS) {
    annotations.push(debugPausedAnnotation(lifecycle.pausedByDebugMs));
  }

  if (lifecycle.requestId.startsWith(SYNTHETIC_PREFIXES[0])) annotations.push(SYNTHETIC_HAR);
  else if (lifecycle.requestId.startsWith(SYNTHETIC_PREFIXES[1])) annotations.push(SYNTHETIC_MEMORY);

  return annotations;
}
