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
 * The classifier returns typed messages only — display copy resolves at
 * the render seams via `buildRowAnnotationMessages(t)`, resolved once per
 * locale so the hot rail loop never calls `t()` per row. A new message
 * kind must add its catalog keys and both map entries (compile-enforced).
 *
 * Derived at render time from the lifecycle + panel context; never cached
 * onto the lifecycle.
 */

import type { LifecycleSource, RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { MATERIAL_DEBUG_PAUSE_MS } from '@openheaders/core/request-lifecycle';
import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { currentResponseBody, lifecycleTransferredBytes } from './inspector-row-projection';
import type { DetailSection } from './inspector-tab';
import type { RedirectRewriteKind } from './redirect-hop-rows';
import {
  effectiveStatusCode,
  hasObservedResponseData,
  isCancellationShapedTerminal,
  isPreservedUnknown,
  type SupersessionAnchor,
} from './request-state';

export type RowAnnotationKind =
  | 'interrupted'
  | 'never-finished'
  | 'fidelity-gap'
  | 'synthetic'
  | 'debug-paused'
  | 'rule-rewrite'
  | 'wire-join';

/** One copy variant per message — finer than `kind` where one kind has
 *  two wordings (the two synthesized-row provenances). */
export type RowAnnotationMessage =
  | 'interrupted'
  | 'never-finished'
  | 'fidelity-gap'
  | 'synthetic-har'
  | 'synthetic-memory'
  | 'debug-paused'
  | 'query-param-rewrite'
  | 'redirect-rule'
  | 'wire-joined'
  | 'wire-seen';

export type RowAnnotationSeverity = 'warn' | 'info';

export interface RowAnnotation {
  readonly kind: RowAnnotationKind;
  readonly severity: RowAnnotationSeverity;
  /** Which copy this annotation renders with (label + detail). */
  readonly message: RowAnnotationMessage;
  /** Measured debug-interception hold — part of the `debug-paused` copy. */
  readonly pausedMs?: number;
  /** Witnessing tab's display title — part of the `wire-seen` copy;
   *  `null` when the recording surface knew no title. */
  readonly tabLabel?: string | null;
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
  /** Wire-join (Phase 6), browser-tab views: requestIds whose rows carry
   *  a derived wire layer. Derived at consume, never on the lifecycle. */
  readonly wireJoinedIds?: ReadonlySet<string>;
  /** Wire-join, Wire source view: wireRequestId → witnessing tab's title
   *  (`null` when unknown) from the historical seen record. */
  readonly wireSeenLabels?: ReadonlyMap<string, string | null>;
}

const LABEL_KEY: Record<RowAnnotationMessage, MessageKey> = {
  interrupted: 'panel.rowAnnotations.interrupted.label',
  'never-finished': 'panel.rowAnnotations.neverFinished.label',
  'fidelity-gap': 'panel.rowAnnotations.fidelityGap.label',
  'synthetic-har': 'panel.rowAnnotations.syntheticHar.label',
  'synthetic-memory': 'panel.rowAnnotations.syntheticMemory.label',
  'debug-paused': 'panel.rowAnnotations.debugPaused.label',
  'query-param-rewrite': 'panel.rowAnnotations.queryParamRewrite.label',
  'redirect-rule': 'panel.rowAnnotations.redirectRule.label',
  'wire-joined': 'panel.rowAnnotations.wireJoined.label',
  'wire-seen': 'panel.rowAnnotations.wireSeen.label',
};

const DETAIL_KEY: Record<RowAnnotationMessage, MessageKey> = {
  interrupted: 'panel.rowAnnotations.interrupted.detail',
  'never-finished': 'panel.rowAnnotations.neverFinished.detail',
  'fidelity-gap': 'panel.rowAnnotations.fidelityGap.detail',
  'synthetic-har': 'panel.rowAnnotations.syntheticHar.detail',
  'synthetic-memory': 'panel.rowAnnotations.syntheticMemory.detail',
  'debug-paused': 'panel.rowAnnotations.debugPaused.detail',
  'query-param-rewrite': 'panel.rowAnnotations.queryParamRewrite.detail',
  'redirect-rule': 'panel.rowAnnotations.redirectRule.detail',
  'wire-joined': 'panel.rowAnnotations.wireJoined.detail',
  'wire-seen': 'panel.rowAnnotations.wireSeen.detail',
};

/** Resolved annotation copy for one locale. Labels and the static
 *  details are resolved eagerly; the `debug-paused` detail formats its
 *  measured hold lazily (rare rows only), so consumers hold ONE stable
 *  object per locale — build it with `useMemo` on `t` and thread it,
 *  never `t()` inside a row loop. */
export interface RowAnnotationMessages {
  readonly label: (a: RowAnnotation) => string;
  readonly detail: (a: RowAnnotation) => string;
  readonly alsoOnThisRow: string;
  readonly openDetails: string;
  readonly wireSeenJump: string;
}

export function buildRowAnnotationMessages(t: Translate): RowAnnotationMessages {
  const labels = Object.fromEntries(
    (Object.keys(LABEL_KEY) as RowAnnotationMessage[]).map((m) => [m, t(LABEL_KEY[m])]),
  ) as Record<RowAnnotationMessage, string>;
  const unknownTab = t('panel.rowAnnotations.wireSeen.unknownTab');
  return {
    label: (a) => labels[a.message],
    detail: (a) =>
      a.message === 'debug-paused'
        ? t(DETAIL_KEY[a.message], { ms: Math.round(a.pausedMs ?? 0) })
        : a.message === 'wire-seen'
          ? t(DETAIL_KEY[a.message], { tab: a.tabLabel ?? unknownTab })
          : t(DETAIL_KEY[a.message]),
    alsoOnThisRow: t('panel.rowAnnotations.alsoOnThisRow'),
    openDetails: t('panel.rowAnnotations.openDetails'),
    wireSeenJump: t('panel.rowAnnotations.wireSeen.jump'),
  };
}

/** Synthesized-row requestId prefixes (disjoint from chrome's ids). */
const SYNTHETIC_PREFIXES = ['oh-har:', 'oh-mem:'] as const;

const INTERRUPTED: RowAnnotation = {
  kind: 'interrupted',
  severity: 'warn',
  message: 'interrupted',
  section: 'headers',
};

const NEVER_FINISHED: RowAnnotation = {
  kind: 'never-finished',
  severity: 'info',
  message: 'never-finished',
  section: 'headers',
};

const FIDELITY_GAP: RowAnnotation = {
  kind: 'fidelity-gap',
  severity: 'info',
  message: 'fidelity-gap',
  section: 'headers',
};

const SYNTHETIC_HAR: RowAnnotation = {
  kind: 'synthetic',
  severity: 'info',
  message: 'synthetic-har',
  section: 'headers',
};

const SYNTHETIC_MEMORY: RowAnnotation = {
  kind: 'synthetic',
  severity: 'info',
  message: 'synthetic-memory',
  section: 'headers',
};

const QUERY_PARAM_REWRITE: RowAnnotation = {
  kind: 'rule-rewrite',
  severity: 'info',
  message: 'query-param-rewrite',
  section: 'headers',
};

const REDIRECT_RULE_REWRITE: RowAnnotation = {
  kind: 'rule-rewrite',
  severity: 'info',
  message: 'redirect-rule',
  section: 'headers',
};

const WIRE_JOINED: RowAnnotation = {
  kind: 'wire-join',
  severity: 'info',
  message: 'wire-joined',
  section: 'headers',
};

// Built per-row because the held duration is part of the copy. The hold is a
// measured fact stamped on the lifecycle by the control plane (`pausedByDebugMs`);
// the rail re-checks materiality as defence in depth against an immaterial value.
function debugPausedAnnotation(pausedMs: number): RowAnnotation {
  return { kind: 'debug-paused', severity: 'info', message: 'debug-paused', pausedMs, section: 'timing' };
}

// Built per-row because the witnessing tab's title is part of the copy.
function wireSeenAnnotation(tabLabel: string | null): RowAnnotation {
  return { kind: 'wire-join', severity: 'info', message: 'wire-seen', tabLabel, section: 'headers' };
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
 *   - `rule-rewrite` — a synthetic redirect-hop row whose `redirectRewrite`
 *     marks it as an Open Headers `query-param`/`redirect` rule's own internal
 *     redirect (the projection joins the rule fire; see `stampRedirectRewrites`),
 *     so the 307 reads as our rewrite rather than a server redirect.
 */
export function classifyRowAnnotations(
  lifecycle: RequestLifecycle,
  ctx: RowAnnotationContext,
  redirectRewrite?: RedirectRewriteKind,
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

  if (redirectRewrite === 'query-param') annotations.push(QUERY_PARAM_REWRITE);
  else if (redirectRewrite === 'redirect') annotations.push(REDIRECT_RULE_REWRITE);

  // Wire-join provenance (Phase 6) — derived at consume from the join
  // context, never from the lifecycle itself.
  if (ctx.wireJoinedIds?.has(lifecycle.requestId) === true) annotations.push(WIRE_JOINED);
  const seenLabels = ctx.wireSeenLabels;
  if (seenLabels?.has(lifecycle.requestId) === true) {
    annotations.push(wireSeenAnnotation(seenLabels.get(lifecycle.requestId) ?? null));
  }

  return annotations;
}
