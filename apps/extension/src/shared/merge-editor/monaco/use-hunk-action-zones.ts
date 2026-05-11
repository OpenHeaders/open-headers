/**
 * Inline action zones, result-pane status zones, and alignment
 * placeholders.
 *
 * All three hooks share the same shape: iterate `HunkAnalysis[]`, ask
 * the view layer (`view/hunk-visual.ts`) for the visual treatment,
 * emit Monaco view zones + per-line frame decorations.
 *
 *   `useHunkActionZones`              — "Accept Incoming | Combination
 *                                        | Ignore" label rows above
 *                                        each pending hunk in
 *                                        theirs/mine panes + per-line
 *                                        frame closing the rectangle.
 *   `useResultStatusZones`            — non-interactive status label
 *                                        in the result pane that
 *                                        mirrors action-zone height
 *                                        for line-by-line alignment.
 *   `useHunkAlignmentPlaceholders`    — hashed-diagonal placeholders
 *                                        in source panes (action-slot
 *                                        above content / stacked-content
 *                                        below / missing-side replacing
 *                                        absent content).
 *
 * Palette decisions live in `view/hunk-visual.ts`. The hooks own only
 * the Monaco view-zone lifecycle + per-line decoration mechanics.
 */

import type * as monaco from 'monaco-editor';
import { type RefObject, useEffect, useRef } from 'react';
import type { HunkAnalysis } from '../diff/hunk-analysis';
import type { PickStateController } from '../use-hunk-pick-state';
import {
  type FrameVariant,
  frameForResult,
  frameForSide,
  type HunkSide,
  isCombineMeaningful,
  type MissingVariant,
  missingFor,
  resultStatusLabelFor,
} from '../view/hunk-visual';
import './hunk-action-zones.css';
import type { HunkTrackedRangesHandle } from './use-hunk-tracked-ranges';
import type { MonacoEditorHandle } from './use-monaco-editor-lifecycle';

// ── Frame class tables ─────────────────────────────────────────────
//
// One mapping per (FrameVariant) → (per-line CSS class, last-line CSS
// class). The hooks pick from these when emitting the per-line frame
// decorations that close the bottom + side edges of the bordered
// rectangle around a hunk.

const FRAME_CLASS: Record<FrameVariant, string> = {
  'pending-conflict': 'oh-merge__action-zone-frame',
  'pending-clean': 'oh-merge__action-zone-frame-clean',
  resolved: 'oh-merge__action-zone-frame-resolved',
};
const FRAME_CLASS_LAST: Record<FrameVariant, string> = {
  'pending-conflict': 'oh-merge__action-zone-frame-last',
  'pending-clean': 'oh-merge__action-zone-frame-clean-last',
  resolved: 'oh-merge__action-zone-frame-resolved-last',
};

/** Top-strip CSS modifier matching a frame variant. The base class is
 *  the orange action zone; clean swaps to blue, resolved to grey. */
function actionZoneVariantClass(variant: FrameVariant): string {
  switch (variant) {
    case 'pending-conflict':
      return '';
    case 'pending-clean':
      return ' oh-merge__action-zone-clean';
    case 'resolved':
      return ' oh-merge__action-zone-resolved';
  }
}

// ── Source-pane action zones ───────────────────────────────────────

const LABEL_THEIRS = { accept: 'Accept Incoming', combine: 'Accept Combination', ignore: 'Ignore' };
const LABEL_MINE = { accept: 'Accept Current', combine: 'Accept Combination', ignore: 'Ignore' };

function makeSeparator(): HTMLElement {
  const sep = document.createElement('span');
  sep.className = 'oh-merge__action-zone-sep';
  sep.textContent = ' | ';
  sep.setAttribute('aria-hidden', 'true');
  return sep;
}

function buildActionZoneDom(args: {
  side: HunkSide;
  analysis: HunkAnalysis;
  controller: PickStateController;
  combineMeaningful: boolean;
  variant: FrameVariant;
}): HTMLElement {
  const labels = args.side === 'theirs' ? LABEL_THEIRS : LABEL_MINE;
  const wrapper = document.createElement('div');
  wrapper.className = 'oh-merge__action-zone-wrapper';
  const root = document.createElement('div');
  root.className = `oh-merge__action-zone${actionZoneVariantClass(args.variant)}`;
  root.setAttribute('data-side', args.side);
  root.setAttribute('data-hunk-id', args.analysis.id);
  wrapper.appendChild(root);

  const slot: 'left' | 'right' = args.side === 'theirs' ? 'left' : 'right';

  // Monaco intercepts mousedown on its DOM root to manage caret +
  // selection. Stopping propagation here keeps clicks inside the
  // view zone reaching the actual button handlers.
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
    args.controller.dispatch({ hunkId: args.analysis.id, slot, action: 'arrow' }),
  );
  const combineBtn = makeBtn(labels.combine, '', () =>
    args.controller.bulkSet([{ hunkId: args.analysis.id, next: { theirs: 'accepted', mine: 'accepted' } }]),
  );
  combineBtn.title = 'Stack both sides — incoming first, then current';
  const ignoreBtn = makeBtn(labels.ignore, 'oh-merge__action-zone-btn-ignore', () =>
    args.controller.dispatch({ hunkId: args.analysis.id, slot, action: 'x' }),
  );

  root.addEventListener('mousedown', eatMouseDown);
  root.appendChild(acceptBtn);
  if (args.combineMeaningful) {
    root.appendChild(makeSeparator());
    root.appendChild(combineBtn);
  }
  root.appendChild(makeSeparator());
  root.appendChild(ignoreBtn);
  return wrapper;
}

export interface UseHunkActionZonesArgs {
  editorRef: RefObject<MonacoEditorHandle>;
  side: HunkSide;
  analyses: readonly HunkAnalysis[];
  controller: PickStateController;
  stateRev: number;
  enabled: boolean;
}

export function useHunkActionZones(args: UseHunkActionZonesArgs): void {
  const zoneIdsRef = useRef<Map<string, string>>(new Map());
  const frameDecorationsRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: stateRev is the controller's reactivity bridge (ref-stable controller; React can't observe its mutations)
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
      if (frameDecorationsRef.current) {
        frameDecorationsRef.current.clear();
        frameDecorationsRef.current = null;
      }
      return;
    }

    const liveIds = new Set(args.analyses.map((a) => a.id));
    const lineCount = model.getLineCount();
    const frameDecos: monaco.editor.IModelDeltaDecoration[] = [];

    editor.changeViewZones((accessor) => {
      for (const [hunkId, zoneId] of zoneIds) {
        if (!liveIds.has(hunkId)) {
          accessor.removeZone(zoneId);
          zoneIds.delete(hunkId);
        }
      }

      for (const analysis of args.analyses) {
        const existing = zoneIds.get(analysis.id);
        if (existing) {
          accessor.removeZone(existing);
          zoneIds.delete(analysis.id);
        }

        const state = args.controller.get(analysis.id);
        const sideChange = args.side === 'theirs' ? analysis.theirs : analysis.mine;
        const startLine = sideChange.range.startLine;
        const endLineExclusive = sideChange.range.endLine;
        if (startLine < 1 || startLine > lineCount + 1) continue;

        const hasContentOnThisSide = !sideChange.isEmpty;
        const frame = frameForSide(analysis, args.side, state);

        // Per-line frame closes the bottom + side edges of the
        // bordered rectangle (top + side come from the action-zone /
        // action-slot DOM). Empty-side hunks are framed by the
        // missing-side placeholder instead — skip per-line decorations
        // there to avoid double-painting.
        if (hasContentOnThisSide) {
          const lastLineInclusive = Math.min(endLineExclusive - 1, lineCount);
          const sideClass = FRAME_CLASS[frame];
          const lastClass = FRAME_CLASS_LAST[frame];
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

        // Action zone (top strip with buttons) only renders for
        // pending sides on hunks with actual content. Empty-side
        // hunks are decided from the populated side or the result-
        // pane "Remove …" button — no need for an action row that
        // would offer "Accept Current" on a side with no current
        // content.
        const sidePending = args.side === 'theirs' ? state.theirs === 'pending' : state.mine === 'pending';
        if (!sidePending || !hasContentOnThisSide) continue;
        const combineMeaningful = isCombineMeaningful({ analysis, side: args.side, state });
        const dom = buildActionZoneDom({
          side: args.side,
          analysis,
          controller: args.controller,
          combineMeaningful,
          variant: frame,
        });
        const zoneId = accessor.addZone({
          afterLineNumber: startLine - 1,
          heightInLines: 1,
          domNode: dom,
        } satisfies monaco.editor.IViewZone);
        zoneIds.set(analysis.id, zoneId);
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
  }, [args.editorRef, args.side, args.analyses, args.controller, args.stateRev, args.enabled]);
}

// ── Result-pane status zones ───────────────────────────────────────

function buildResultStatusDom(args: {
  hunkId: string;
  label: string;
  removable: ReadonlyArray<{ slot: 'left' | 'right'; label: string }>;
  controller: PickStateController;
  variant: FrameVariant;
}): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'oh-merge__action-zone-wrapper';
  const root = document.createElement('div');
  root.className = `oh-merge__action-zone${actionZoneVariantClass(args.variant)} oh-merge__action-zone-status`;
  wrapper.appendChild(root);

  const eatMouseDown = (e: Event) => e.stopPropagation();
  root.addEventListener('mousedown', eatMouseDown);

  const labelSpan = document.createElement('span');
  labelSpan.className = 'oh-merge__action-zone-status-label';
  labelSpan.textContent = args.label;
  root.appendChild(labelSpan);

  for (const remove of args.removable) {
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

export interface UseResultStatusZonesArgs {
  resultRef: RefObject<MonacoEditorHandle>;
  trackedRangesRef: RefObject<HunkTrackedRangesHandle>;
  analyses: readonly HunkAnalysis[];
  controller: PickStateController;
  stateRev: number;
  enabled: boolean;
}

export function useResultStatusZones(args: UseResultStatusZonesArgs): void {
  const zoneIdsRef = useRef<Map<string, string>>(new Map());
  const frameDecorationsRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: stateRev is the controller's reactivity bridge
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
    for (const a of args.analyses) {
      liveKeys.add(`${a.id}:status`);
      liveKeys.add(`${a.id}:missing`);
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

      for (const analysis of args.analyses) {
        const state = args.controller.get(analysis.id);
        const status = resultStatusLabelFor(state);
        for (const slot of ['status', 'missing'] as const) {
          const key = `${analysis.id}:${slot}`;
          const existing = zoneIds.get(key);
          if (existing) {
            accessor.removeZone(existing);
            zoneIds.delete(key);
          }
        }
        if (status === null) continue;
        const live = args.trackedRangesRef.current.liveRangeOf(analysis.id);
        const startLine = live ? live.startLineNumber : analysis.mine.range.startLine;
        const endLineExclusive = live ? live.endLineNumber + 1 : analysis.mine.range.endLine;
        if (startLine < 1 || startLine > lineCount + 1) continue;
        const variant = frameForResult(analysis, state);

        const dom = buildResultStatusDom({
          hunkId: analysis.id,
          label: status.label,
          removable: status.removable,
          controller: args.controller,
          variant,
        });
        const statusZoneId = accessor.addZone({
          afterLineNumber: startLine - 1,
          heightInLines: 1,
          domNode: dom,
        } satisfies monaco.editor.IViewZone);
        zoneIds.set(`${analysis.id}:status`, statusZoneId);

        // Insertion-point detection mirrors `useHunkTrackedRanges`
        // encoding: a tracked decoration with same start/end line +
        // collapsed columns marks a zero-extent insertion. Without
        // this check the per-line frame would wrap the line below
        // the hunk (the next real content line) for pre-acceptance
        // pure additions.
        const isInsertionPoint =
          live !== null &&
          live.startLineNumber === live.endLineNumber &&
          live.startColumn === 1 &&
          live.endColumn === 1;
        const hasContentInResult = !isInsertionPoint && endLineExclusive > startLine;
        if (!hasContentInResult) {
          // Pre-acceptance or both-dismissed pure-addition: pad
          // result with N hashed rows so all three panes stay in
          // line-by-line alignment. Result placeholder is always
          // neutral grey — the result pane has no per-side
          // "deletion" semantic to communicate.
          const otherLineCount = Math.max(analysis.theirs.lines.length, analysis.mine.lines.length);
          if (otherLineCount > 0) {
            const placeholderDom = buildPlaceholderDom('missing-side', undefined, 'neutral');
            const missingZoneId = accessor.addZone({
              afterLineNumber: startLine - 1,
              heightInLines: otherLineCount,
              domNode: placeholderDom,
            } satisfies monaco.editor.IViewZone);
            zoneIds.set(`${analysis.id}:missing`, missingZoneId);
          }
          continue;
        }
        const lastLineInclusive = Math.min(endLineExclusive - 1, lineCount);
        const sideClass = FRAME_CLASS[variant];
        const lastClass = FRAME_CLASS_LAST[variant];
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
  }, [args.resultRef, args.trackedRangesRef, args.analyses, args.controller, args.stateRev, args.enabled]);
}

// ── Hashed alignment placeholders ──────────────────────────────────

type PlaceholderKind = 'action-slot' | 'stacked-content' | 'missing-side';

function buildPlaceholderDom(kind: PlaceholderKind, label?: string, variant: MissingVariant = 'neutral'): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'oh-merge__action-zone-wrapper';
  const root = document.createElement('div');
  // The red `-removal` modifier applies only to the action-slot
  // header + missing-side body (the two parts of the bordered
  // missing-side rectangle). Stacked-content is alignment padding
  // and stays neutral hash regardless.
  const variantSuffix =
    variant === 'removal' && (kind === 'missing-side' || kind === 'action-slot')
      ? ` oh-merge__alignment-placeholder-${kind}-removal`
      : '';
  root.className = `oh-merge__alignment-placeholder oh-merge__alignment-placeholder-${kind}${variantSuffix}`;
  if (label) {
    const labelSpan = document.createElement('span');
    labelSpan.className = 'oh-merge__placeholder-label';
    labelSpan.textContent = label;
    root.appendChild(labelSpan);
  }
  wrapper.appendChild(root);
  return wrapper;
}

/**
 * Lines-of-placeholder plan for a hunk on a given source side.
 *
 *   beforeLines  — action-slot strip ABOVE content. Renders when this
 *                  side's action zone is hidden (decided) but other
 *                  panes still emit zones at the same row, OR when the
 *                  missing-side body needs a header strip carrying
 *                  the "Removed here" / "No content here" label.
 *   afterLines   — stacked-content strip BELOW content. Renders when
 *                  both sides are accepted — result has N + M lines
 *                  and this side has fewer; the rest pads visually.
 *   missingLines — replaces absent content. Renders for empty-side
 *                  hunks (pure add / pure remove on this side).
 */
interface PlaceholderPlan {
  beforeLines: number;
  afterLines: number;
  missingLines: number;
  /** Carried into action-slot DOM as a caption when present. */
  missingLabel?: string;
  /** Variant for the missing-side body + its action-slot header.
   *  Undefined when this is not a missing-side scenario. */
  missingVariant?: MissingVariant;
}

function placeholderPlanFor(args: {
  analysis: HunkAnalysis;
  side: HunkSide;
  state: ReturnType<PickStateController['get']>;
  has3Panes: boolean;
}): PlaceholderPlan | null {
  const { analysis, side, state, has3Panes } = args;
  const N = analysis.theirs.lines.length;
  const M = analysis.mine.lines.length;
  const tA = state.theirs === 'accepted';
  const mA = state.mine === 'accepted';
  const sideChange = side === 'theirs' ? analysis.theirs : analysis.mine;
  const otherChange = side === 'theirs' ? analysis.mine : analysis.theirs;
  const isEmptyOnThisSide = sideChange.isEmpty && !otherChange.isEmpty;

  const missing = isEmptyOnThisSide ? missingFor(analysis, side) : null;

  const thisSidePending = side === 'theirs' ? state.theirs === 'pending' : state.mine === 'pending';
  const otherZonePending = side === 'theirs' ? state.mine === 'pending' && has3Panes : state.theirs === 'pending';
  const resultStatusVisible = resultStatusLabelFor(state) !== null;
  // The action zone on this side hides for empty-extent hunks even
  // when pending — the populated side + result status zone drive the
  // decision. So an empty side counts as "no zone here" for alignment
  // purposes.
  const thisZoneRenders = thisSidePending && !isEmptyOnThisSide;

  // The action-slot header strip ABOVE content fires when:
  //   1. This side is empty (the strip carries the "Removed here" /
  //      "No content here" label above the hashed body), OR
  //   2. This side's action zone is hidden but other panes still
  //      render zones — so a 1-line placeholder keeps row counts in
  //      sync across panes.
  const beforeLines = isEmptyOnThisSide || (!thisZoneRenders && (otherZonePending || resultStatusVisible)) ? 1 : 0;

  const missingLines = isEmptyOnThisSide ? Math.max(N, M) : 0;

  // Stacked-content pad: only when both sides accepted AND this side
  // has actual content (empty-side hunks have nothing to pad below).
  let afterLines = 0;
  if (!isEmptyOnThisSide && tA && mA) {
    afterLines = side === 'theirs' ? M : N;
  }

  if (beforeLines === 0 && afterLines === 0 && missingLines === 0) return null;
  return {
    beforeLines,
    afterLines,
    missingLines,
    missingLabel: missing?.label,
    missingVariant: missing?.variant,
  };
}

export interface UseHunkAlignmentPlaceholdersArgs {
  editorRef: RefObject<MonacoEditorHandle>;
  side: HunkSide;
  analyses: readonly HunkAnalysis[];
  controller: PickStateController;
  stateRev: number;
  enabled: boolean;
  has3Panes: boolean;
}

export function useHunkAlignmentPlaceholders(args: UseHunkAlignmentPlaceholdersArgs): void {
  const zoneIdsRef = useRef<Map<string, string>>(new Map());

  // biome-ignore lint/correctness/useExhaustiveDependencies: stateRev is the controller's reactivity bridge
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
    for (const a of args.analyses) {
      liveKeys.add(`${a.id}:before`);
      liveKeys.add(`${a.id}:after`);
      liveKeys.add(`${a.id}:missing`);
    }

    editor.changeViewZones((accessor) => {
      for (const [key, zoneId] of zoneIds) {
        if (!liveKeys.has(key)) {
          accessor.removeZone(zoneId);
          zoneIds.delete(key);
        }
      }
      for (const analysis of args.analyses) {
        const state = args.controller.get(analysis.id);
        const plan = placeholderPlanFor({
          analysis,
          side: args.side,
          state,
          has3Panes: args.has3Panes,
        });
        for (const slot of ['before', 'after', 'missing'] as const) {
          const key = `${analysis.id}:${slot}`;
          const existing = zoneIds.get(key);
          if (existing) {
            accessor.removeZone(existing);
            zoneIds.delete(key);
          }
        }
        if (!plan) continue;
        const sideChange = args.side === 'theirs' ? analysis.theirs : analysis.mine;
        const startLine = sideChange.range.startLine;
        const endLineExclusive = sideChange.range.endLine;
        if (plan.beforeLines > 0) {
          const dom = buildPlaceholderDom('action-slot', plan.missingLabel, plan.missingVariant);
          const zoneId = accessor.addZone({
            afterLineNumber: Math.max(0, startLine - 1),
            heightInLines: plan.beforeLines,
            domNode: dom,
          } satisfies monaco.editor.IViewZone);
          zoneIds.set(`${analysis.id}:before`, zoneId);
        }
        if (plan.afterLines > 0) {
          const dom = buildPlaceholderDom('stacked-content');
          const zoneId = accessor.addZone({
            afterLineNumber: Math.max(0, endLineExclusive - 1),
            heightInLines: plan.afterLines,
            domNode: dom,
          } satisfies monaco.editor.IViewZone);
          zoneIds.set(`${analysis.id}:after`, zoneId);
        }
        if (plan.missingLines > 0) {
          const dom = buildPlaceholderDom('missing-side', undefined, plan.missingVariant);
          const zoneId = accessor.addZone({
            afterLineNumber: Math.max(0, startLine - 1),
            heightInLines: plan.missingLines,
            domNode: dom,
          } satisfies monaco.editor.IViewZone);
          zoneIds.set(`${analysis.id}:missing`, zoneId);
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
  }, [args.editorRef, args.side, args.analyses, args.controller, args.stateRev, args.enabled, args.has3Panes]);
}
