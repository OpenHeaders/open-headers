/**
 * useResultStatusZones — non-interactive status label in the result
 * pane that mirrors action-zone height for line-by-line alignment,
 * plus the hashed missing-side padding for pure additions. Same shape
 * as its siblings (`use-hunk-action-zones`,
 * `use-hunk-alignment-placeholders`): iterate `HunkAnalysis[]`, ask
 * `view/hunk-visual.ts` for the visual treatment, emit Monaco view
 * zones + per-line frame decorations.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import type * as monaco from 'monaco-editor';
import { type RefObject, useEffect, useRef } from 'react';
import type { HunkAnalysis } from '../diff/hunk-analysis';
import type { PickStateController } from '../use-hunk-pick-state';
import { frameForResult, resultStatusLabelFor } from '../view/hunk-visual';
import { buildPlaceholderDom, buildResultStatusDom, FRAME_CLASS, FRAME_CLASS_LAST } from './hunk-zone-dom';
import type { HunkTrackedRangesHandle } from './use-hunk-tracked-ranges';
import type { MonacoEditorHandle } from './use-monaco-editor-lifecycle';

export interface UseResultStatusZonesArgs {
  resultRef: RefObject<MonacoEditorHandle>;
  trackedRangesRef: RefObject<HunkTrackedRangesHandle>;
  analyses: readonly HunkAnalysis[];
  controller: PickStateController;
  stateRev: number;
  enabled: boolean;
}

export function useResultStatusZones(args: UseResultStatusZonesArgs): void {
  const t = useT();
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
          status,
          controller: args.controller,
          variant,
          t,
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
            // Hashed pattern signals "intermediate — content WILL
            // arrive here once you decide." Once the user resolves
            // the hunk (either side dismissed or both dismissed),
            // there's no more decision to be made — drop the hash
            // so the placeholder reads as quiet "decided, no
            // content."
            const resolved = state.theirs !== 'pending' && state.mine !== 'pending';
            const placeholderDom = buildPlaceholderDom({ kind: 'missing-side', hashed: !resolved });
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
  }, [args.resultRef, args.trackedRangesRef, args.analyses, args.controller, args.stateRev, args.enabled, t]);
}
