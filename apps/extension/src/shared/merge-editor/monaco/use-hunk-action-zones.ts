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
  /** Mine pane only renders in 3-pane sessions. Affects frame
   *  visibility in the resolved-but-other-side-active case (a side
   *  with no rendered pane shouldn't count as "active alignment"). */
  has3Panes: boolean;
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
}): HTMLElement {
  const labels = args.side === 'theirs' ? LABEL_THEIRS : LABEL_MINE;
  const root = document.createElement('div');
  root.className = 'oh-merge__action-zone';
  root.setAttribute('data-side', args.side);
  root.setAttribute('data-hunk-id', args.hunk.id);

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
  return root;
}

function shouldRenderZone(state: { theirs: SideState; mine: SideState }, side: HunkSide): boolean {
  if (side === 'theirs') return state.theirs === 'pending';
  return state.mine === 'pending';
}

/**
 * Whether THIS side should render a frame around its hunk content,
 * mirroring VS Code's bordered grouping rectangle. Two cases produce
 * a frame:
 *   1. This side's action zone is rendered (pending) — orange frame.
 *   2. This side is decided BUT another pane still renders a zone
 *      (other side action zone or result status zone) — grey frame
 *      around the action-slot placeholder + content.
 *
 * The third case (this side decided + no other zone) yields no frame
 * because the conflict is fully resolved with no other panes to
 * align with — the user has moved on.
 */
function frameStateFor(
  state: { theirs: SideState; mine: SideState },
  side: HunkSide,
  has3Panes: boolean,
): 'pending' | 'resolved' | null {
  const thisPending = side === 'theirs' ? state.theirs === 'pending' : state.mine === 'pending';
  if (thisPending) return 'pending';
  // This side is decided. Render a grey frame iff something else is
  // still in flight (other side or result status).
  const otherPending =
    side === 'theirs' ? state.mine === 'pending' && has3Panes : state.theirs === 'pending';
  const resultVisible = statusLabelFor(state) !== null;
  if (otherPending || resultVisible) return 'resolved';
  return null;
}

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

        // Frame around the bordered grouping rectangle. Renders for
        // both pending (orange) and resolved-but-others-active (grey)
        // states. Top + side borders come from the action zone DOM
        // (pending) or the action-slot placeholder (resolved); side +
        // bottom borders come from these per-line frame decorations.
        const frameState = frameStateFor(state, args.side, args.has3Panes);
        if (frameState !== null) {
          const lastLineInclusive = Math.min(endLineExclusive - 1, lineCount);
          const sideClass =
            frameState === 'pending' ? 'oh-merge__action-zone-frame' : 'oh-merge__action-zone-frame-resolved';
          const lastClass =
            frameState === 'pending'
              ? 'oh-merge__action-zone-frame-last'
              : 'oh-merge__action-zone-frame-resolved-last';
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

        if (!shouldRender) continue;
        // Anchor the zone above the hunk's start line on this side.
        const isMultiLine = endLineExclusive > startLine + 1;
        const otherSideAccepted = args.side === 'theirs' ? state.mine === 'accepted' : state.theirs === 'accepted';
        const isCombineMeaningful =
          isMultiLine && !otherSideAccepted && state.theirs !== 'dismissed' && state.mine !== 'dismissed';
        const dom = buildZoneDom({ side: args.side, hunk: h, controller: args.controller, isCombineMeaningful });
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
  }, [args.editorRef, args.side, args.hunks, args.controller, args.stateRev, args.enabled, args.has3Panes]);
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
  // both dismissed → fully resolved, no alignment needed
  return null;
}

function buildStatusDom(args: { hunkId: string; status: ResultStatus; controller: PickStateController }): HTMLElement {
  const root = document.createElement('div');
  root.className = 'oh-merge__action-zone oh-merge__action-zone-status';

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
  return root;
}

export function useResultStatusZones(args: UseResultStatusZonesArgs): void {
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

    const liveIds = new Set(args.hunks.map((h) => h.id));
    const lineCount = model.getLineCount();
    const frameDecos: monaco.editor.IModelDeltaDecoration[] = [];

    editor.changeViewZones((accessor) => {
      for (const [hunkId, zoneId] of zoneIds) {
        if (!liveIds.has(hunkId)) {
          accessor.removeZone(zoneId);
          zoneIds.delete(hunkId);
        }
      }

      for (const h of args.hunks) {
        const existing = zoneIds.get(h.id);
        const state = args.controller.get(h.id);
        const status = statusLabelFor(state);
        if (existing) {
          accessor.removeZone(existing);
          zoneIds.delete(h.id);
        }
        if (status === null) continue;
        // Position via the sticky tracked range so the zone follows
        // buffer edits / accept writes that shift the hunk's
        // location in result.
        const live = args.trackedRangesRef.current.liveRangeOf(h.id);
        const startLine = live ? live.startLineNumber : h.mineRange.startLine;
        const endLineExclusive = live ? live.endLineNumber + 1 : h.mineRange.endLine;
        if (startLine < 1 || startLine > lineCount + 1) continue;
        const dom = buildStatusDom({ hunkId: h.id, status, controller: args.controller });
        const zoneId = accessor.addZone({
          afterLineNumber: startLine - 1,
          heightInLines: 1,
          domNode: dom,
        } satisfies monaco.editor.IViewZone);
        zoneIds.set(h.id, zoneId);

        // Mirror the bordered grouping outline on the result pane so
        // the (status row + hunk content) shows as one box, matching
        // the theirs/mine panes' grouping.
        const lastLineInclusive = Math.min(endLineExclusive - 1, lineCount);
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
              className:
                line === lastLineInclusive
                  ? 'oh-merge__action-zone-frame oh-merge__action-zone-frame-last'
                  : 'oh-merge__action-zone-frame',
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
  }, [args.resultRef, args.trackedRangesRef, args.hunks, args.controller, args.stateRev, args.enabled]);
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
   *  so we need a placeholder to maintain row-by-row alignment). */
  beforeLines: number;
  /** Lines AFTER the source content (stacked-content slot — when
   *  both sides accepted, the result has N + M lines; this side has
   *  fewer, so the rest pads visually below). VS Code's convention
   *  puts the placeholder below content on BOTH sides for visual
   *  symmetry, even though semantically theirs's content sits above
   *  mine's in the result stack — line-number parity is the goal,
   *  not a per-line semantic mapping. */
  afterLines: number;
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

  const thisSidePending = side === 'theirs' ? state.theirs === 'pending' : state.mine === 'pending';
  // Mine zone only renders when has3Panes — in 2-pane fallback it's
  // hidden by the action-zones hook, so the alignment math should
  // treat it as not-visible for action-slot placement purposes.
  const otherZonePending =
    side === 'theirs'
      ? state.mine === 'pending' && has3Panes
      : state.theirs === 'pending';
  const resultStatusVisible = statusLabelFor(state) !== null;

  const beforeLines = !thisSidePending && (otherZonePending || resultStatusVisible) ? 1 : 0;

  // Stacked-content slot: both accepted → result has N + M lines,
  // this side has its own line count, the rest is the other side's
  // content rendered as a placeholder.
  let afterLines = 0;
  if (tA && mA) {
    afterLines = side === 'theirs' ? M : N;
  }

  if (beforeLines === 0 && afterLines === 0) return null;
  return { beforeLines, afterLines };
}

type PlaceholderKind = 'action-slot' | 'stacked-content';

function buildPlaceholderDom(kind: PlaceholderKind): HTMLElement {
  const root = document.createElement('div');
  root.className = `oh-merge__alignment-placeholder oh-merge__alignment-placeholder-${kind}`;
  return root;
}

export function useHunkAlignmentPlaceholders(args: UseHunkAlignmentPlaceholdersArgs & { has3Panes: boolean }): void {
  // Two zones possible per hunk per side: before (action-slot) + after
  // (stacked-content). Composite key `${hunkId}:before` / `${hunkId}:after`.
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
        for (const slot of ['before', 'after'] as const) {
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
          const dom = buildPlaceholderDom('action-slot');
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
