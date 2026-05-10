/**
 * Inline action-label widgets above each hunk in the theirs / mine
 * panes. Mirrors VS Code's merge-editor affordance: a row of
 * clickable labels rendered as a Monaco view zone (a fixed-height
 * widget that takes vertical space in the editor) at each hunk's
 * start line.
 *
 * Per pane, per hunk, three labels:
 *   theirs side:  Accept Incoming | Accept Combination | Ignore
 *   mine side:    Accept Current  | Accept Combination | Ignore
 *
 * Click routes to the pick-state controller's `dispatch`:
 *   Accept Incoming/Current → action='arrow' (→ accepted)
 *   Accept Combination      → also action='arrow', controller's
 *                             single-click-resolve-OFF semantics
 *                             stack both sides when the OTHER side
 *                             is already accepted; from a fresh
 *                             pending state, "Combination" routes
 *                             to a special `bulkSet` that flips
 *                             both sides accepted at once.
 *   Ignore                  → action='x' (→ dismissed)
 *
 * Layout-agnostic: works in every layout the merge editor supports
 * (Column / Show Base Top / Show Base Center / 2-pane fallback)
 * because the labels live INSIDE the source panes, not flanking
 * the result. This is what `<HunkActionGutter>` (the IDE-shape
 * flanking gutter) can't do in non-column layouts where the result
 * is on a separate row.
 *
 * View zones are managed via `editor.changeViewZones`. Each zone id
 * is stored per (hunkId, side) so we can update / remove them as
 * hunks change. Only the zone for a side that's still `pending`
 * gets rendered — once the user decides, the zone disappears.
 */

import type * as monaco from 'monaco-editor';
import { type RefObject, useEffect, useRef } from 'react';
import type { Hunk } from '../diff/line-diff';
import type { PickStateController, SideState } from '../use-hunk-pick-state';
import type { HunkSide } from './use-hunk-decorations';
import type { MonacoEditorHandle } from './use-monaco-editor-lifecycle';
import type { HunkTrackedRangesHandle } from './use-hunk-tracked-ranges';
import './hunk-action-zones.css';

export interface UseHunkActionZonesArgs {
  editorRef: RefObject<MonacoEditorHandle>;
  /** Which pane's content this hook decorates — controls the side
   *  state read from the controller and the label text. */
  side: HunkSide;
  hunks: readonly Hunk[];
  controller: PickStateController;
  /** Bumped whenever the controller's state map mutates so this hook
   *  re-runs and refreshes the visible zones. */
  stateRev: number;
  /** When false, the hook clears any existing zones and stops
   *  rendering. Used by the toolbar toggle to disable the inline
   *  labels without unmounting the side editor. */
  enabled: boolean;
  /** Hunk ids classified as TRUE 3-way conflicts (both sides actually
   *  changed the same base region). Drives the frame color split:
   *  true conflicts get the orange "needs decision" frame; everything
   *  else (single-side changes, auto-mergeable) gets the calmer blue
   *  "informational" frame. Resolved hunks always go grey regardless.
   *  When omitted (or the hunk id isn't in the set), the hunk is
   *  treated as non-conflicting (blue). */
  trueConflictIds?: ReadonlySet<string>;
}

const LABEL_THEIRS = {
  accept: 'Accept Incoming',
  combine: 'Accept Combination',
  ignore: 'Ignore',
};
const LABEL_MINE = {
  accept: 'Accept Current',
  combine: 'Accept Combination',
  ignore: 'Ignore',
};

function makeSeparator(): HTMLElement {
  const sep = document.createElement('span');
  sep.className = 'oh-merge__action-zone-sep';
  // Space-padded text instead of relying purely on flex `gap` —
  // some Monaco theme stylesheets interfere with `gap` rendering on
  // view zones, and the visible whitespace inside the text node is
  // a load-bearing fallback that always reads as a proper separator.
  sep.textContent = ' | ';
  sep.setAttribute('aria-hidden', 'true');
  return sep;
}

function buildZoneDom(args: {
  side: HunkSide;
  hunk: Hunk;
  controller: PickStateController;
  isCombineMeaningful: boolean;
  /** When false, the action zone takes the calmer blue "auto-mergeable"
   *  visual treatment instead of the loud orange "true conflict" one. */
  isTrueConflict: boolean;
}): HTMLElement {
  const labels = args.side === 'theirs' ? LABEL_THEIRS : LABEL_MINE;
  // Wrapper reserves room at the right for Monaco's vertical
  // scrollbar so the inner styled rectangle ends at the content
  // area's right edge (= scrollbar's left edge), matching VS Code.
  // Without the wrapper, the view zone DOM spans the full editor
  // view (including over the scrollbar) and the right shadow lands
  // on top of the scrollbar.
  const wrapper = document.createElement('div');
  wrapper.className = 'oh-merge__action-zone-wrapper';
  const root = document.createElement('div');
  // Base class always; clean modifier swaps orange→blue when the
  // hunk is auto-mergeable. Resolved hunks never reach this DOM
  // builder (shouldRenderZone returns false for non-pending sides).
  root.className = args.isTrueConflict
    ? 'oh-merge__action-zone'
    : 'oh-merge__action-zone oh-merge__action-zone-clean';
  root.setAttribute('data-side', args.side);
  root.setAttribute('data-hunk-id', args.hunk.id);
  wrapper.appendChild(root);

  const slot: 'left' | 'right' = args.side === 'theirs' ? 'left' : 'right';

  // Stop mousedown propagation BEFORE Monaco's editor-level mouse
  // handler sees it. Monaco intercepts mousedown on its own DOM root
  // to manage caret positioning + selection — without this, the
  // browser's click event never fires inside view zones because
  // Monaco's preventDefault eats the mouse interaction.
  const eatMouseDown = (e: Event) => e.stopPropagation();

  const makeBtn = (label: string, extraClass: string, onClick: () => void): HTMLButtonElement => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `oh-merge__action-zone-btn ${extraClass}`.trim();
    btn.textContent = label;
    btn.addEventListener('mousedown', eatMouseDown);
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return btn;
  };

  const acceptBtn = makeBtn(labels.accept, '', () =>
    args.controller.dispatch({ hunkId: args.hunk.id, slot, action: 'arrow' }),
  );
  const combineBtn = makeBtn(labels.combine, '', () =>
    args.controller.bulkSet([{ hunkId: args.hunk.id, next: { theirs: 'accepted', mine: 'accepted' } }]),
  );
  combineBtn.title = 'Stack both sides — incoming first, then current';
  const ignoreBtn = makeBtn(labels.ignore, 'oh-merge__action-zone-btn-ignore', () =>
    args.controller.dispatch({ hunkId: args.hunk.id, slot, action: 'x' }),
  );

  // Also eat mousedown on the container itself so empty space within
  // the row doesn't drop the user into the text caret.
  root.addEventListener('mousedown', eatMouseDown);

  root.appendChild(acceptBtn);
  if (args.isCombineMeaningful) {
    root.appendChild(makeSeparator());
    root.appendChild(combineBtn);
  }
  root.appendChild(makeSeparator());
  root.appendChild(ignoreBtn);
  return wrapper;
}

function shouldRenderZone(state: { theirs: SideState; mine: SideState }, side: HunkSide): boolean {
  if (side === 'theirs') return state.theirs === 'pending';
  return state.mine === 'pending';
}

/**
 * Frame state for THIS side's hunk content.
 *
 *   pending-conflict — this side is pending AND the hunk is a true
 *                      3-way conflict → ORANGE frame ("decide me").
 *   pending-clean    — this side is pending but the hunk is NOT a
 *                      true conflict (single-side change, auto-
 *                      mergeable) → BLUE frame ("informational").
 *   resolved         — this side is decided → GREY ghost frame.
 *                      Always renders, even when no other pane is
 *                      active, so the file's conflict topology
 *                      stays visually scannable after resolution.
 *
 * `isTrueConflict` defaults to true (conservative — orange) when no
 * classification has been threaded through, preserving prior behavior
 * for callers that don't pass `trueConflictIds`.
 */
type FrameState = 'pending-conflict' | 'pending-clean' | 'resolved';

function frameStateFor(
  state: { theirs: SideState; mine: SideState },
  side: HunkSide,
  isTrueConflict: boolean,
): FrameState {
  const thisPending = side === 'theirs' ? state.theirs === 'pending' : state.mine === 'pending';
  if (thisPending) return isTrueConflict ? 'pending-conflict' : 'pending-clean';
  return 'resolved';
}

/** Per-frame-state CSS class table — keeps the choice in one place. */
const FRAME_CLASS: Record<FrameState, string> = {
  'pending-conflict': 'oh-merge__action-zone-frame',
  'pending-clean': 'oh-merge__action-zone-frame-clean',
  resolved: 'oh-merge__action-zone-frame-resolved',
};
const FRAME_CLASS_LAST: Record<FrameState, string> = {
  'pending-conflict': 'oh-merge__action-zone-frame-last',
  'pending-clean': 'oh-merge__action-zone-frame-clean-last',
  resolved: 'oh-merge__action-zone-frame-resolved-last',
};

export function useHunkActionZones(args: UseHunkActionZonesArgs): void {
  const zoneIdsRef = useRef<Map<string, string>>(new Map());
  const frameDecorationsRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);

  useEffect(() => {
    const editor = args.editorRef.current.editor;
    const model = args.editorRef.current.model;
    if (!editor || !model) return;
    const zoneIds = zoneIdsRef.current;

    if (!args.enabled) {
      // Disabled: clear all zones + frame decorations, leave editor
      // untouched otherwise.
      if (zoneIds.size > 0) {
        editor.changeViewZones((accessor) => {
          for (const id of zoneIds.values()) accessor.removeZone(id);
        });
        zoneIds.clear();
      }
      if (frameDecorationsRef.current) {
        frameDecorationsRef.current.clear();
        frameDecorationsRef.current = null;
      }
      return;
    }

    const liveIds = new Set(args.hunks.map((h) => h.id));
    const lineCount = model.getLineCount();

    // Frame decorations close the VS Code-style outline around the
    // (label row + hunk lines) grouping. Top + side borders come
    // from the action-zone DOM (above); side + bottom borders come
    // from these per-line decorations on the hunk content.
    const frameDecos: monaco.editor.IModelDeltaDecoration[] = [];

    editor.changeViewZones((accessor) => {
      // Drop zones whose hunks vanished from the diff (or whose side
      // is no longer pending — handled below by the rebuild loop).
      for (const [hunkId, zoneId] of zoneIds) {
        if (!liveIds.has(hunkId)) {
          accessor.removeZone(zoneId);
          zoneIds.delete(hunkId);
        }
      }

      // Rebuild zones for current hunks. Cheaper than diffing — view
      // zones are lightweight and the repaint is below user
      // perception. Each rebuild reads the controller's CURRENT state
      // so the zones reflect the latest tick without an extra
      // listener.
      for (const h of args.hunks) {
        const existing = zoneIds.get(h.id);
        const state = args.controller.get(h.id);
        const shouldRender = shouldRenderZone(state, args.side);
        if (existing) {
          accessor.removeZone(existing);
          zoneIds.delete(h.id);
        }
        const range = args.side === 'theirs' ? h.theirsRange : h.mineRange;
        const startLine = range.startLine;
        const endLineExclusive = range.endLine;
        if (startLine < 1 || startLine > lineCount + 1) continue;
        // Empty extent on THIS side (pure addition on theirs / pure
        // removal on mine) — no model lines to attach per-line frame
        // decorations to. The missing-side alignment placeholder
        // renders the bordered rectangle instead, so we skip framing
        // here entirely.
        const hasContentOnThisSide = endLineExclusive > startLine;

        const isTrueConflict = args.trueConflictIds?.has(h.id) ?? false;

        // Frame around the bordered grouping rectangle. Three states:
        // pending-conflict (orange), pending-clean (blue), resolved
        // (grey). Top + side borders come from the action zone DOM
        // (pending) or the action-slot placeholder (resolved); side +
        // bottom borders come from these per-line frame decorations.
        // Skipped entirely on empty-extent sides — handled by the
        // missing-side placeholder instead.
        if (hasContentOnThisSide) {
          const frameState = frameStateFor(state, args.side, isTrueConflict);
          const lastLineInclusive = Math.min(endLineExclusive - 1, lineCount);
          const sideClass = FRAME_CLASS[frameState];
          const lastClass = FRAME_CLASS_LAST[frameState];
          for (let line = startLine; line <= lastLineInclusive; line++) {
            frameDecos.push({
              range: {
                startLineNumber: line,
                startColumn: 1,
                endLineNumber: line,
                endColumn: model.getLineMaxColumn(line),
              },
              options: {
                isWholeLine: true,
                className: line === lastLineInclusive ? `${sideClass} ${lastClass}` : sideClass,
                stickiness: 1,
              },
            });
          }
        }

        // Skip the action zone entirely on empty-extent sides (pure
        // additions on theirs / pure removals on mine). The
        // affordances "Accept Current | Ignore" on a side with no
        // content are semantically redundant with deciding from the
        // populated side or via the result-pane "Remove …" buttons —
        // both produce the same result-buffer outcome. Hiding it
        // declutters the empty side; the missing-side placeholder
        // (rendered by useHunkAlignmentPlaceholders) is the only
        // visual cue the empty side needs.
        if (!shouldRender || !hasContentOnThisSide) continue;
        // Anchor the zone above the hunk's start line on this side.
        const isMultiLine = endLineExclusive > startLine + 1;
        const otherSideAccepted = args.side === 'theirs' ? state.mine === 'accepted' : state.theirs === 'accepted';
        // "Accept Combination" stacks both sides into result. When the
        // OTHER side has no content (pure addition / removal), the
        // combination collapses to "use this side" — identical to
        // "Accept Incoming"/"Accept Current". Hide the redundant
        // button in that case so the action label doesn't carry a
        // no-op affordance.
        const otherSideHasContent =
          args.side === 'theirs' ? h.mineLines.length > 0 : h.theirsLines.length > 0;
        const isCombineMeaningful =
          isMultiLine &&
          otherSideHasContent &&
          !otherSideAccepted &&
          state.theirs !== 'dismissed' &&
          state.mine !== 'dismissed';
        const dom = buildZoneDom({
          side: args.side,
          hunk: h,
          controller: args.controller,
          isCombineMeaningful,
          isTrueConflict,
        });
        const zoneId = accessor.addZone({
          afterLineNumber: startLine - 1,
          heightInLines: 1,
          domNode: dom,
        } satisfies monaco.editor.IViewZone);
        zoneIds.set(h.id, zoneId);
      }
    });

    // Apply frame decorations as a single collection, replacing any
    // previous frame from a prior render. Collection diffs in place.
    if (!frameDecorationsRef.current) {
      frameDecorationsRef.current = editor.createDecorationsCollection(frameDecos);
    } else {
      frameDecorationsRef.current.set(frameDecos);
    }

    return () => {
      // Cleanup on unmount or args change: remove zones + frame
      // decorations. The next effect run re-adds them if still
      // applicable.
      if (zoneIds.size > 0) {
        editor.changeViewZones((accessor) => {
          for (const id of zoneIds.values()) accessor.removeZone(id);
        });
        zoneIds.clear();
      }
      if (frameDecorationsRef.current) {
        frameDecorationsRef.current.clear();
        frameDecorationsRef.current = null;
      }
    };
  }, [
    args.editorRef,
    args.side,
    args.hunks,
    args.controller,
    args.stateRev,
    args.enabled,
    args.trueConflictIds,
  ]);
}

// ── Result-pane status zones ────────────────────────────────────────

/**
 * Non-interactive companion to `useHunkActionZones` for the RESULT
 * pane. Maintains row alignment with the theirs / mine action zones
 * by emitting a same-height view zone at the corresponding line in
 * result, with a status label that reflects the current pick state:
 *
 *   pending / pending     → "No Changes Accepted"
 *   accepted / pending    → "Incoming Accepted"
 *   pending  / accepted   → "Current Accepted"
 *   accepted / accepted   → "Combination Accepted"
 *   dismissed / pending   → "Incoming Skipped"
 *   pending / dismissed   → "Current Skipped"
 *   accepted / dismissed  → "Incoming Accepted"  (dismissed side hidden)
 *   dismissed / accepted  → "Current Accepted"
 *   dismissed / dismissed → no zone (fully resolved, no alignment needed)
 *
 * Without this, the action zones in theirs/mine push their content
 * down by 1 line each but the result pane's content stays at its
 * original line position — making the three panes visually
 * desynchronized. With it, every row across all three panes lines
 * up at the same vertical offset.
 *
 * Result-pane positions come from the sticky tracked ranges (the
 * per-hunk decoration that follows buffer edits). The zone anchors
 * via `afterLineNumber = liveRange.startLineNumber - 1`.
 */
export interface UseResultStatusZonesArgs {
  resultRef: RefObject<MonacoEditorHandle>;
  trackedRangesRef: RefObject<HunkTrackedRangesHandle>;
  hunks: readonly Hunk[];
  controller: PickStateController;
  stateRev: number;
  enabled: boolean;
  /** See `UseHunkActionZonesArgs.trueConflictIds`. Drives the result
   *  status zone's frame color via the same orange/blue/grey rule. */
  trueConflictIds?: ReadonlySet<string>;
}

interface ResultStatus {
  label: string;
  /** Which slots can still be reverted from the result-pane labels.
   *  Each entry adds a "Remove …" button that calls
   *  `controller.revert(hunkId, slot)`. */
  removable: ReadonlyArray<{ slot: 'left' | 'right'; label: string }>;
}

function statusLabelFor(state: { theirs: SideState; mine: SideState }): ResultStatus | null {
  if (state.theirs === 'pending' && state.mine === 'pending') {
    return { label: 'No Changes Accepted', removable: [] };
  }
  if (state.theirs === 'accepted' && state.mine === 'accepted') {
    return {
      label: 'Incoming + Current',
      removable: [
        { slot: 'left', label: 'Remove Incoming' },
        { slot: 'right', label: 'Remove Current' },
      ],
    };
  }
  if (state.theirs === 'accepted') {
    return { label: 'Incoming', removable: [{ slot: 'left', label: 'Remove Incoming' }] };
  }
  if (state.mine === 'accepted') {
    return { label: 'Current', removable: [{ slot: 'right', label: 'Remove Current' }] };
  }
  if (state.theirs === 'dismissed' && state.mine === 'pending') return { label: 'Incoming Skipped', removable: [] };
  if (state.mine === 'dismissed' && state.theirs === 'pending') return { label: 'Current Skipped', removable: [] };
  // Both dismissed — explicit user decision to keep the original
  // content. Surface a "No Changes Accepted" status so the result
  // pane keeps its bordered rectangle (in grey) as a "this conflict
  // was reviewed and skipped" marker, and so the source panes still
  // get their alignment placeholders.
  if (state.theirs === 'dismissed' && state.mine === 'dismissed') {
    return { label: 'No Changes Accepted', removable: [] };
  }
  return null;
}

/** Whether all sides of a hunk have reached a terminal state. */
function isResolvedHunk(state: { theirs: SideState; mine: SideState }): boolean {
  return state.theirs !== 'pending' && state.mine !== 'pending';
}

function buildStatusDom(args: {
  hunkId: string;
  status: ResultStatus;
  controller: PickStateController;
  resolved: boolean;
  isTrueConflict: boolean;
}): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'oh-merge__action-zone-wrapper';
  const root = document.createElement('div');
  // Three visual variants matching the source-pane frame logic:
  //   resolved          → grey  ("decided, here for reference")
  //   pending conflict  → orange ("decide me — true 3-way conflict")
  //   pending non-conf  → blue   ("informational, auto-mergeable")
  // Keeping the result-pane and source-pane treatments aligned so
  // the user reads the same color story across all three editors.
  const variant = args.resolved
    ? ' oh-merge__action-zone-resolved'
    : args.isTrueConflict
      ? '' // base class is already orange
      : ' oh-merge__action-zone-clean';
  root.className = `oh-merge__action-zone${variant} oh-merge__action-zone-status`;
  wrapper.appendChild(root);

  const eatMouseDown = (e: Event) => e.stopPropagation();
  root.addEventListener('mousedown', eatMouseDown);

  const labelSpan = document.createElement('span');
  labelSpan.className = 'oh-merge__action-zone-status-label';
  labelSpan.textContent = args.status.label;
  root.appendChild(labelSpan);

  for (const remove of args.status.removable) {
    const sep = document.createElement('span');
    sep.className = 'oh-merge__action-zone-sep';
    sep.textContent = ' | ';
    sep.setAttribute('aria-hidden', 'true');
    root.appendChild(sep);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'oh-merge__action-zone-btn oh-merge__action-zone-btn-remove';
    btn.textContent = remove.label;
    btn.title = `Revert ${remove.label.replace(/^Remove\s+/, '').toLowerCase()} to pending so you can re-decide`;
    btn.addEventListener('mousedown', eatMouseDown);
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      args.controller.revert(args.hunkId, remove.slot);
    });
    root.appendChild(btn);
  }
  return wrapper;
}

export function useResultStatusZones(args: UseResultStatusZonesArgs): void {
  // Two zones possible per hunk: ${hunkId}:status (always) +
  // ${hunkId}:missing (only when the result region is zero-extent —
  // pre-acceptance pure additions). Composite key keeps both
  // independently addressable across re-renders.
  const zoneIdsRef = useRef<Map<string, string>>(new Map());
  const frameDecorationsRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);

  useEffect(() => {
    const editor = args.resultRef.current.editor;
    const model = args.resultRef.current.model;
    if (!editor || !model) return;
    const zoneIds = zoneIdsRef.current;

    if (!args.enabled) {
      if (zoneIds.size > 0) {
        editor.changeViewZones((accessor) => {
          for (const id of zoneIds.values()) accessor.removeZone(id);
        });
        zoneIds.clear();
      }
      if (frameDecorationsRef.current) {
        frameDecorationsRef.current.clear();
        frameDecorationsRef.current = null;
      }
      return;
    }

    const liveKeys = new Set<string>();
    for (const h of args.hunks) {
      liveKeys.add(`${h.id}:status`);
      liveKeys.add(`${h.id}:missing`);
    }
    const lineCount = model.getLineCount();
    const frameDecos: monaco.editor.IModelDeltaDecoration[] = [];

    editor.changeViewZones((accessor) => {
      for (const [key, zoneId] of zoneIds) {
        if (!liveKeys.has(key)) {
          accessor.removeZone(zoneId);
          zoneIds.delete(key);
        }
      }

      for (const h of args.hunks) {
        const state = args.controller.get(h.id);
        const status = statusLabelFor(state);
        // Always-rebuild approach: drop both possible zones for this
        // hunk and re-add according to current state.
        for (const slot of ['status', 'missing'] as const) {
          const key = `${h.id}:${slot}`;
          const existing = zoneIds.get(key);
          if (existing) {
            accessor.removeZone(existing);
            zoneIds.delete(key);
          }
        }
        if (status === null) continue;
        // Position via the sticky tracked range so the zone follows
        // buffer edits / accept writes that shift the hunk's
        // location in result.
        const live = args.trackedRangesRef.current.liveRangeOf(h.id);
        const startLine = live ? live.startLineNumber : h.mineRange.startLine;
        const endLineExclusive = live ? live.endLineNumber + 1 : h.mineRange.endLine;
        if (startLine < 1 || startLine > lineCount + 1) continue;
        const resolved = isResolvedHunk(state);
        const isTrueConflict = args.trueConflictIds?.has(h.id) ?? false;

        // Status zone first (anchored at startLine - 1) so it lands
        // ABOVE the missing-side placeholder when both are emitted.
        // Monaco stacks zones at the same afterLineNumber in
        // insertion order; status-then-missing reads as label-on-top
        // of the hashed rectangle, matching the source panes.
        const dom = buildStatusDom({
          hunkId: h.id,
          status,
          controller: args.controller,
          resolved,
          isTrueConflict,
        });
        const statusZoneId = accessor.addZone({
          afterLineNumber: startLine - 1,
          heightInLines: 1,
          domNode: dom,
        } satisfies monaco.editor.IViewZone);
        zoneIds.set(`${h.id}:status`, statusZoneId);

        // Result-pane parity for empty-extent hunks. When the result
        // has zero lines for this hunk (pre-acceptance pure addition,
        // or both-dismissed pure addition), emit a missing-side
        // placeholder so result row count matches the source panes
        // (which show the populated side's N content lines or their
        // own missing-side placeholder of N rows). Without this, the
        // result pane is N rows shorter than theirs/mine for the
        // hunk, breaking line-by-line alignment across all 3 panes.
        //
        // Insertion-point detection mirrors useHunkTrackedRanges'
        // encoding: tracked decoration with endColumn === 1 + same
        // line + startColumn === 1 marks an insertion point (zero
        // content). Without this check, `endLineExclusive > startLine`
        // is always true (because endLineExclusive = endLineNumber + 1)
        // and the per-line frame would erroneously wrap the line
        // BELOW the hunk (e.g. `responseHeaders: []` on a pre-accept
        // pure-addition).
        const isInsertionPoint =
          live !== null &&
          live.startLineNumber === live.endLineNumber &&
          live.startColumn === 1 &&
          live.endColumn === 1;
        const hasContentInResult = !isInsertionPoint && endLineExclusive > startLine;
        if (!hasContentInResult) {
          // Pre-acceptance / both-dismissed pure-addition: theirs has
          // N lines, mine has 0, result has 0. Pad result with N rows.
          // Pure-removals never hit this branch — result starts as
          // mine which still has the to-be-removed content.
          const otherLineCount = Math.max(h.theirsLines.length, h.mineLines.length);
          if (otherLineCount > 0) {
            // No label inside the hashed body — the result pane's
            // status zone above ("No Changes Accepted" / "Incoming" /
            // etc.) already serves as the header for this rectangle.
            const placeholderDom = buildPlaceholderDom('missing-side');
            const missingZoneId = accessor.addZone({
              afterLineNumber: startLine - 1,
              heightInLines: otherLineCount,
              domNode: placeholderDom,
            } satisfies monaco.editor.IViewZone);
            zoneIds.set(`${h.id}:missing`, missingZoneId);
          }
        }

        // Frame around the status row + hunk content. Color matches
        // the status zone DOM via the same FRAME_CLASS table the
        // source panes use: orange (true conflict pending), blue
        // (clean pending), grey (resolved). Skipped for empty-extent
        // hunks — the missing-side placeholder is already a self-
        // contained bordered rectangle (grey ghost), so adding a
        // per-line frame would double-draw on the wrong color.
        if (!hasContentInResult) continue;
        const lastLineInclusive = Math.min(endLineExclusive - 1, lineCount);
        const frameState: FrameState = resolved
          ? 'resolved'
          : isTrueConflict
            ? 'pending-conflict'
            : 'pending-clean';
        const sideClass = FRAME_CLASS[frameState];
        const lastClass = FRAME_CLASS_LAST[frameState];
        for (let line = startLine; line <= lastLineInclusive; line++) {
          frameDecos.push({
            range: {
              startLineNumber: line,
              startColumn: 1,
              endLineNumber: line,
              endColumn: model.getLineMaxColumn(line),
            },
            options: {
              isWholeLine: true,
              className: line === lastLineInclusive ? `${sideClass} ${lastClass}` : sideClass,
              stickiness: 1,
            },
          });
        }
      }
    });

    if (!frameDecorationsRef.current) {
      frameDecorationsRef.current = editor.createDecorationsCollection(frameDecos);
    } else {
      frameDecorationsRef.current.set(frameDecos);
    }

    return () => {
      if (zoneIds.size > 0) {
        editor.changeViewZones((accessor) => {
          for (const id of zoneIds.values()) accessor.removeZone(id);
        });
        zoneIds.clear();
      }
      if (frameDecorationsRef.current) {
        frameDecorationsRef.current.clear();
        frameDecorationsRef.current = null;
      }
    };
  }, [
    args.resultRef,
    args.trackedRangesRef,
    args.hunks,
    args.controller,
    args.stateRev,
    args.enabled,
    args.trueConflictIds,
  ]);
}

// ── Hashed diagonal alignment placeholders ──────────────────────────

/**
 * Hashed-diagonal placeholder view zones in the theirs / mine source
 * panes. Maintains line-by-line alignment with the result pane when
 * the result region for a hunk has more lines than the corresponding
 * source side does.
 *
 * Common case: both sides accepted on a single-line hunk. Theirs has
 * 1 line, mine has 1 line, result has 2 lines (theirs then mine
 * stacked). To keep all three panes visually aligned line-for-line:
 *
 *   theirs:  theirs-value      (line 7)
 *            ╱╱╱╱╱╱╱╱╱╱╱╱      (line 8 — hashed placeholder)
 *   result:  theirs-value      (line 7)
 *            mine-value        (line 8)
 *   mine:    ╱╱╱╱╱╱╱╱╱╱╱╱      (line 7 — hashed placeholder)
 *            mine-value        (line 8)
 *
 * Hash pattern uses CSS `repeating-linear-gradient` so it scales
 * cleanly with the editor font size. Pure-visual — no clicks, no
 * state, just an alignment cue. Disabled when inline action labels
 * are off (the alignment isn't relevant when there are no zones to
 * align with).
 */
export interface UseHunkAlignmentPlaceholdersArgs {
  editorRef: RefObject<MonacoEditorHandle>;
  /** Source side this hook decorates ('theirs' or 'mine'). */
  side: HunkSide;
  hunks: readonly Hunk[];
  controller: PickStateController;
  stateRev: number;
  enabled: boolean;
}

interface PlaceholderPlan {
  /** Lines BEFORE the source content (action-zone slot — hidden
   *  when this side is decided but other panes still render zones,
   *  so we need a placeholder to maintain row-by-row alignment).
   *  Doubles as the header strip for the missing-side rectangle
   *  below it when `missingLines > 0`. */
  beforeLines: number;
  /** Lines AFTER the source content (stacked-content slot — when
   *  both sides accepted, the result has N + M lines; this side has
   *  fewer, so the rest pads visually below). VS Code's convention
   *  puts the placeholder below content on BOTH sides for visual
   *  symmetry, even though semantically theirs's content sits above
   *  mine's in the result stack — line-number parity is the goal,
   *  not a per-line semantic mapping. */
  afterLines: number;
  /** Lines REPLACING absent content (missing-side slot — pure add /
   *  pure remove hunks have zero lines on one source side, but the
   *  other side / result still render N lines for the divergence.
   *  This placeholder fills those N rows on the empty side so all
   *  three panes line up + visually communicates "content lives on
   *  the other side, not here." Self-contained bordered rectangle
   *  in grey (no per-line frame decorations possible — there are
   *  no model lines to attach them to). */
  missingLines: number;
  /** Label rendered in the action-slot strip above a missing-side
   *  rectangle ("Only in Incoming" / "Only in Current"). Set only
   *  when this is a missing-side scenario; consumed by the action-
   *  slot placeholder DOM as its caption. The action-slot already
   *  renders 1 line tall directly above the hashed body, so it acts
   *  as a natural header — putting the label there keeps it on a
   *  solid grey background instead of fighting with the hash
   *  pattern below. */
  missingLabel?: string;
}

/**
 * Compute the placeholder plan for a hunk on a given source side
 * given the current pick state.
 *
 * Action-zone slot (`beforeLines === 1`):
 *   When this side's action zone is hidden (state ≠ pending) but
 *   other panes still render zones (other side's action zone OR
 *   result status zone), add a 1-line placeholder above content so
 *   the visual row count matches across panes.
 *
 * Stacked-content slot (`afterLines === N or M`):
 *   When both sides accepted, the result region has N + M lines
 *   (theirs stacked above mine). Each source side has fewer lines
 *   than result; the remainder is rendered as a placeholder below
 *   that side's content. Both sides put the placeholder BELOW for
 *   visual symmetry (matches VS Code).
 *
 * Returns null when no placeholder is needed for either slot.
 */
function placeholderPlanFor(
  side: HunkSide,
  hunk: Hunk,
  state: { theirs: SideState; mine: SideState },
  has3Panes: boolean,
): PlaceholderPlan | null {
  const N = hunk.theirsLines.length;
  const M = hunk.mineLines.length;
  const tA = state.theirs === 'accepted';
  const mA = state.mine === 'accepted';
  const thisLineCount = side === 'theirs' ? N : M;
  const otherLineCount = side === 'theirs' ? M : N;
  const isEmptyOnThisSide = thisLineCount === 0 && otherLineCount > 0;
  // Cached so we only build the label string once per plan.
  const emptySideLabel = isEmptyOnThisSide ? missingSideLabel(hunk) : undefined;

  const thisSidePending = side === 'theirs' ? state.theirs === 'pending' : state.mine === 'pending';
  // Mine zone only renders when has3Panes — in 2-pane fallback it's
  // hidden by the action-zones hook, so the alignment math should
  // treat it as not-visible for action-slot placement purposes.
  const otherZonePending =
    side === 'theirs'
      ? state.mine === 'pending' && has3Panes
      : state.theirs === 'pending';
  const resultStatusVisible = statusLabelFor(state) !== null;
  // Action zone on THIS side hides on empty-extent hunks (the user
  // can decide from the populated side or from the result status
  // zone). So even when state is "pending", an empty-side hunk is
  // treated as if it has no zone here for alignment purposes — the
  // missing-side placeholder needs an action-slot row above it to
  // match the other panes' action zone height.
  const thisZoneRenders = thisSidePending && !isEmptyOnThisSide;

  // Force the action-slot row to render whenever this side is empty:
  // it becomes the visual HEADER for the missing-side rectangle below
  // (carries the "Only in …" label on a solid grey backdrop, instead
  // of letting the label fight with the hashed pattern). Outside the
  // missing-side case, render the action-slot only when alignment
  // requires it.
  const beforeLines = isEmptyOnThisSide || (!thisZoneRenders && (otherZonePending || resultStatusVisible)) ? 1 : 0;

  // Missing-side slot — pure add / pure remove on this side. Renders
  // N hashed rows where N = the OTHER side's content line count, so
  // all panes line up row-by-row + the empty side keeps a visible
  // bordered rectangle that survives auto-resolve.
  const missingLines = isEmptyOnThisSide ? otherLineCount : 0;

  // Stacked-content slot: both accepted → result has N + M lines,
  // this side has its own line count, the rest is the other side's
  // content rendered as a placeholder. Mutually exclusive with
  // missing-side (empty-side hunks have nothing to stack onto).
  let afterLines = 0;
  if (!isEmptyOnThisSide && tA && mA) {
    afterLines = side === 'theirs' ? M : N;
  }

  if (beforeLines === 0 && afterLines === 0 && missingLines === 0) return null;
  return { beforeLines, afterLines, missingLines, missingLabel: emptySideLabel };
}

type PlaceholderKind = 'action-slot' | 'stacked-content' | 'missing-side';

function buildPlaceholderDom(kind: PlaceholderKind, label?: string): HTMLElement {
  // Same wrapper trick as the action / status zones: outer reserves
  // scrollbar space; inner takes the borders. Stacked-content kind
  // doesn't have borders but uses the same wrapper for layout
  // consistency (otherwise the hashed pattern would extend over the
  // scrollbar area and look wrong against the rectangle's right
  // edge on the rows above/below).
  const wrapper = document.createElement('div');
  wrapper.className = 'oh-merge__action-zone-wrapper';
  const root = document.createElement('div');
  root.className = `oh-merge__alignment-placeholder oh-merge__alignment-placeholder-${kind}`;
  if (label) {
    // Inline label so the user reads what the hashed rectangle
    // means without guessing. Side-aware copy comes from the caller.
    const labelSpan = document.createElement('span');
    labelSpan.className = 'oh-merge__placeholder-label';
    labelSpan.textContent = label;
    root.appendChild(labelSpan);
  }
  wrapper.appendChild(root);
  return wrapper;
}

/**
 * Caption for a missing-side placeholder. Panel-focused: the user
 * already knows which pane they're in, so the caption names what's
 * happening RIGHT HERE ("No content here") instead of describing
 * the other pane ("Only in Incoming/Current"). Same string for both
 * sides — the per-pane interpretation is implicit from the user's
 * vantage point. Kept as a function so future callers can branch
 * on hunk shape if a need arises.
 */
function missingSideLabel(_hunk: Hunk): string {
  return 'No content here';
}

export function useHunkAlignmentPlaceholders(args: UseHunkAlignmentPlaceholdersArgs & { has3Panes: boolean }): void {
  // Up to three zones possible per hunk per side:
  //   ${hunkId}:before   — action-slot (above content, decided + others active)
  //   ${hunkId}:after    — stacked-content (below content, both-accepted parity)
  //   ${hunkId}:missing  — missing-side (replaces absent content for pure add/remove)
  const zoneIdsRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const editor = args.editorRef.current.editor;
    const model = args.editorRef.current.model;
    if (!editor || !model) return;
    const zoneIds = zoneIdsRef.current;

    if (!args.enabled) {
      if (zoneIds.size > 0) {
        editor.changeViewZones((accessor) => {
          for (const id of zoneIds.values()) accessor.removeZone(id);
        });
        zoneIds.clear();
      }
      return;
    }

    const liveKeys = new Set<string>();
    for (const h of args.hunks) {
      liveKeys.add(`${h.id}:before`);
      liveKeys.add(`${h.id}:after`);
      liveKeys.add(`${h.id}:missing`);
    }

    editor.changeViewZones((accessor) => {
      // Drop zones for hunks no longer in the live set.
      for (const [key, zoneId] of zoneIds) {
        if (!liveKeys.has(key)) {
          accessor.removeZone(zoneId);
          zoneIds.delete(key);
        }
      }
      for (const h of args.hunks) {
        const state = args.controller.get(h.id);
        const plan = placeholderPlanFor(args.side, h, state, args.has3Panes);
        // Always-rebuild approach: drop existing zones for this hunk
        // and re-add according to the current plan. Cheaper than
        // diffing per-region; view zones are lightweight.
        for (const slot of ['before', 'after', 'missing'] as const) {
          const key = `${h.id}:${slot}`;
          const existing = zoneIds.get(key);
          if (existing) {
            accessor.removeZone(existing);
            zoneIds.delete(key);
          }
        }
        if (!plan) continue;
        const range = args.side === 'theirs' ? h.theirsRange : h.mineRange;
        const startLine = range.startLine;
        const endLineExclusive = range.endLine;
        if (plan.beforeLines > 0) {
          // For missing-side hunks the action-slot doubles as the
          // header row — carry the "Only in …" label here so it
          // sits on the solid grey strip directly above the hashed
          // body, instead of overlapping the hash pattern.
          const dom = buildPlaceholderDom('action-slot', plan.missingLabel);
          const zoneId = accessor.addZone({
            afterLineNumber: Math.max(0, startLine - 1),
            heightInLines: plan.beforeLines,
            domNode: dom,
          } satisfies monaco.editor.IViewZone);
          zoneIds.set(`${h.id}:before`, zoneId);
        }
        if (plan.afterLines > 0) {
          const dom = buildPlaceholderDom('stacked-content');
          const zoneId = accessor.addZone({
            // Place AFTER the last content line. `endLine` is
            // exclusive in our LineRange convention, so endLine - 1
            // is the last content line; afterLineNumber on it puts
            // the zone immediately below.
            afterLineNumber: Math.max(0, endLineExclusive - 1),
            heightInLines: plan.afterLines,
            domNode: dom,
          } satisfies monaco.editor.IViewZone);
          zoneIds.set(`${h.id}:after`, zoneId);
        }
        if (plan.missingLines > 0) {
          // Anchor at the insertion point on this side. For pure
          // additions (theirs added X-C, mine has nothing): mineRange
          // is zero-extent at the insertion line in mine pane, so
          // afterLineNumber lands the placeholder right where the
          // content WOULD have been. The action zone for this hunk
          // (if pending) renders at the same anchor; Monaco zones at
          // the same afterLineNumber stack in insertion order.
          // No label here — it lives in the action-slot strip above
          // (the hashed body would otherwise compete with the text).
          const dom = buildPlaceholderDom('missing-side');
          const zoneId = accessor.addZone({
            afterLineNumber: Math.max(0, startLine - 1),
            heightInLines: plan.missingLines,
            domNode: dom,
          } satisfies monaco.editor.IViewZone);
          zoneIds.set(`${h.id}:missing`, zoneId);
        }
      }
    });
    return () => {
      if (zoneIds.size === 0) return;
      editor.changeViewZones((accessor) => {
        for (const id of zoneIds.values()) accessor.removeZone(id);
      });
      zoneIds.clear();
    };
  }, [args.editorRef, args.side, args.hunks, args.controller, args.stateRev, args.enabled, args.has3Panes]);
}
