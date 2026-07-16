/**
 * useHunkActionZones — "Accept Incoming | Combination | Ignore" label
 * rows above each pending hunk in theirs/mine panes + per-line frame
 * decorations closing the bordered rectangle. Siblings with the same
 * shape (iterate `HunkAnalysis[]`, ask `view/hunk-visual.ts` for the
 * visual treatment, emit Monaco view zones + frame decorations):
 * `use-result-status-zones` and `use-hunk-alignment-placeholders`.
 * Shared DOM builders + frame class tables live in `hunk-zone-dom`.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import type * as monaco from 'monaco-editor';
import { type RefObject, useEffect, useRef } from 'react';
import type { HunkAnalysis } from '../diff/hunk-analysis';
import type { PickStateController } from '../use-hunk-pick-state';
import { frameForSide, type HunkSide, isCombineMeaningful } from '../view/hunk-visual';
import { buildActionZoneDom, FRAME_CLASS, FRAME_CLASS_LAST } from './hunk-zone-dom';
import type { MonacoEditorHandle } from './use-monaco-editor-lifecycle';

export interface UseHunkActionZonesArgs {
  editorRef: RefObject<MonacoEditorHandle>;
  side: HunkSide;
  analyses: readonly HunkAnalysis[];
  controller: PickStateController;
  stateRev: number;
  enabled: boolean;
}

export function useHunkActionZones(args: UseHunkActionZonesArgs): void {
  const t = useT();
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

        // Action zone (top strip with buttons + type label) renders
        // for every pending hunk on this side — including empty-side
        // hunks where the buttons let the user resolve the divergence
        // from this pane too. For empty sides the action zone serves
        // as the header above the missing-side placeholder body.
        const sidePending = args.side === 'theirs' ? state.theirs === 'pending' : state.mine === 'pending';
        if (!sidePending) continue;
        const combineMeaningful = isCombineMeaningful({ analysis, side: args.side, state });
        const dom = buildActionZoneDom({
          side: args.side,
          analysis,
          controller: args.controller,
          combineMeaningful,
          variant: frame,
          t,
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
  }, [args.editorRef, args.side, args.analyses, args.controller, args.stateRev, args.enabled, t]);
}
