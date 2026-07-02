/**
 * useHunkAlignmentPlaceholders — hashed-diagonal placeholders in
 * source panes (action-slot above content / stacked-content below /
 * missing-side replacing absent content), plus the per-hunk
 * placeholder plan that decides which of the three slots fire. Same
 * shape as its siblings (`use-hunk-action-zones`,
 * `use-result-status-zones`): iterate `HunkAnalysis[]`, ask
 * `view/hunk-visual.ts` for the visual treatment, emit Monaco view
 * zones.
 */

import type * as monaco from 'monaco-editor';
import { type RefObject, useEffect, useRef } from 'react';
import type { HunkAnalysis } from '../diff/hunk-analysis';
import type { PickStateController } from '../use-hunk-pick-state';
import {
  type HunkSide,
  kindLabelFor,
  type MissingVariant,
  missingVariantFor,
  resultStatusLabelFor,
} from '../view/hunk-visual';
import { buildPlaceholderDom } from './hunk-zone-dom';
import type { MonacoEditorHandle } from './use-monaco-editor-lifecycle';

/**
 * Lines-of-placeholder plan for a hunk on a given source side.
 *
 *   beforeLines  — action-slot strip ABOVE content. Renders only when
 *                  this side's action zone is hidden (decided) AND
 *                  another pane still emits a zone at the same row,
 *                  so a 1-line filler keeps row counts in sync across
 *                  panes. Empty-pending sides are handled by the
 *                  action zone itself (it doubles as the header above
 *                  the missing-side body).
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
  /** Variant for the missing-side body + its action-slot header
   *  (when the action-slot is rendering as a decided-side filler).
   *  Undefined when this is not a missing-side scenario. */
  missingVariant?: MissingVariant;
  /** Right-aligned kind label rendered inside the action-slot when
   *  the action-slot fires (decided side). Same vocabulary the
   *  action zone uses for pending sides — keeps the per-side header
   *  pattern uniform across pending and decided states. */
  kindLabel?: string;
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

  const missingVariant = missingVariantFor(analysis, side) ?? undefined;

  const thisSidePending = side === 'theirs' ? state.theirs === 'pending' : state.mine === 'pending';
  const otherZonePending = side === 'theirs' ? state.mine === 'pending' && has3Panes : state.theirs === 'pending';
  const resultStatusVisible = resultStatusLabelFor(state) !== null;
  // The action zone renders for every pending hunk regardless of
  // whether this side has content. Empty-pending sides get the zone
  // as the header for the missing-side body below them.
  const thisZoneRenders = thisSidePending;

  // The action-slot strip fires when this side's action zone is
  // hidden (decided) AND we still need a header on this side — either
  // because this side is empty (the missing-side body needs a top
  // label) or because other panes still emit zones (alignment).
  const beforeLines = !thisZoneRenders && (isEmptyOnThisSide || otherZonePending || resultStatusVisible) ? 1 : 0;

  const missingLines = isEmptyOnThisSide ? Math.max(N, M) : 0;

  // Stacked-content pad: only when both sides accepted AND this side
  // has actual content (empty-side hunks have nothing to pad below).
  let afterLines = 0;
  if (!isEmptyOnThisSide && tA && mA) {
    afterLines = side === 'theirs' ? M : N;
  }

  if (beforeLines === 0 && afterLines === 0 && missingLines === 0) return null;
  const sideKind = side === 'theirs' ? analysis.theirs.kind : analysis.mine.kind;
  return {
    beforeLines,
    afterLines,
    missingLines,
    missingVariant,
    kindLabel: beforeLines > 0 ? kindLabelFor(sideKind) : undefined,
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
          const dom = buildPlaceholderDom({
            kind: 'action-slot',
            variant: plan.missingVariant,
            kindLabel: plan.kindLabel,
          });
          const zoneId = accessor.addZone({
            afterLineNumber: Math.max(0, startLine - 1),
            heightInLines: plan.beforeLines,
            domNode: dom,
          } satisfies monaco.editor.IViewZone);
          zoneIds.set(`${analysis.id}:before`, zoneId);
        }
        if (plan.afterLines > 0) {
          const dom = buildPlaceholderDom({ kind: 'stacked-content' });
          const zoneId = accessor.addZone({
            afterLineNumber: Math.max(0, endLineExclusive - 1),
            heightInLines: plan.afterLines,
            domNode: dom,
          } satisfies monaco.editor.IViewZone);
          zoneIds.set(`${analysis.id}:after`, zoneId);
        }
        if (plan.missingLines > 0) {
          const dom = buildPlaceholderDom({ kind: 'missing-side', variant: plan.missingVariant });
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
