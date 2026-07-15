/**
 * Resolution commands + live stats for `MergePane`: hunk navigation
 * (true conflicts only), the bulk actions (Apply Non-Conflicting /
 * Accept All Theirs / Accept All Mine), the single-hunk accept used by
 * the Monaco command palette, and the stats effect feeding the header
 * pill / navigator.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import type { RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { HunkAnalysis } from './diff/hunk-analysis';
import type { Hunk } from './diff/line-diff';
import type { HunkSide } from './monaco/use-hunk-decorations';
import type { MonacoEditorHandle } from './monaco/use-monaco-editor-lifecycle';
import type { HunkPickState, PickStateController } from './use-hunk-pick-state';

export interface HunkStats {
  /** Remaining hunks where theirs ≠ result (incoming side still
   *  pending). */
  theirsRemaining: number;
  /** Remaining hunks where mine ≠ result. */
  mineRemaining: number;
  /** `theirsRemaining + mineRemaining`. Conflict-counter feed. */
  totalRemaining: number;
  /** Non-conflicting subtotal — auto-mergeable in one click. */
  nonConflicting: number;
  /** True conflicts (both sides diverge in overlapping ranges). */
  conflicts: number;
}

interface UseMergeResolutionCommandsArgs {
  analyses: readonly HunkAnalysis[];
  pickStateHunks: readonly Hunk[];
  pickController: PickStateController;
  pickStateRev: number;
  has3Panes: boolean;
  resultRef: RefObject<MonacoEditorHandle>;
  onHunkStatsChange?: (stats: HunkStats) => void;
  onAnnounce?: (message: string) => void;
}

export interface MergeResolutionCommands {
  gotoNextHunk: () => void;
  gotoPrevHunk: () => void;
  applyNonConflicting: () => void;
  acceptAllTheirs: () => void;
  acceptAllMine: () => void;
  /** Single-hunk accept for the Monaco command palette chords. */
  acceptHunk: (hunkId: string, side: HunkSide) => void;
}

export function useMergeResolutionCommands({
  analyses,
  pickStateHunks,
  pickController,
  pickStateRev,
  has3Panes,
  resultRef,
  onHunkStatsChange,
  onAnnounce,
}: UseMergeResolutionCommandsArgs): MergeResolutionCommands {
  const t = useT();
  // Legacy single-click accept callback retained for the Monaco
  // command palette ("Accept incoming/current hunk at cursor"). The
  // chord lands as if the user clicked the corresponding action-gutter
  // arrow, routing through the controller so state + buffer stay in
  // lock-step.
  const acceptHunk = useCallback(
    (hunkId: string, side: HunkSide) => {
      pickController.dispatch({ hunkId, slot: side === 'theirs' ? 'left' : 'right', action: 'arrow' });
      onAnnounce?.(
        side === 'theirs'
          ? t('shared.mergeEditor.announce.acceptedIncoming')
          : t('shared.mergeEditor.announce.acceptedCurrent'),
      );
    },
    [pickController, onAnnounce, t],
  );

  useEffect(() => {
    // Stats derive from the controller + the unified analysis. In
    // 2-pane fallback (mine pane hidden) the mine slot is unreachable
    // so its pending count is ignored — the stats useEffect already
    // treats `mine: 'pending'` in 2-pane as auto-resolved.
    let theirsPending = 0;
    let minePending = 0;
    let trueConflicts = 0;
    for (const analysis of analyses) {
      const state = pickController.get(analysis.id);
      if (state.theirs === 'pending') theirsPending++;
      if (has3Panes && state.mine === 'pending') minePending++;
      const sidesPending = state.theirs === 'pending' || (has3Panes && state.mine === 'pending');
      if (analysis.conflict === 'true' && sidesPending) trueConflicts++;
    }
    const total = theirsPending + minePending;
    onHunkStatsChange?.({
      theirsRemaining: theirsPending,
      mineRemaining: minePending,
      totalRemaining: total,
      nonConflicting: Math.max(0, total - trueConflicts),
      conflicts: trueConflicts,
    });
    void pickStateRev;
  }, [analyses, onHunkStatsChange, pickController, pickStateRev, has3Panes]);

  const navIndexRef = useRef(-1);
  const orderedNav = useMemo(() => {
    // Navigate only through TRUE conflicts (auto-mergeable hunks
    // resolve via "Apply Non-Conflicting" — no need to cycle through
    // them with the F-keys). Order by mine-side line for natural top-
    // to-bottom traversal in the result pane.
    const trueConflictIds = new Set<string>();
    for (const a of analyses) if (a.conflict === 'true') trueConflictIds.add(a.id);
    const visible = pickStateHunks.filter((h) => trueConflictIds.has(h.id));
    return visible
      .map((h) => ({ hunk: h, side: 'theirs' as const }))
      .sort((a, b) => a.hunk.mineRange.startLine - b.hunk.mineRange.startLine);
  }, [analyses, pickStateHunks]);

  const revealHunkAt = useCallback(
    (idx: number) => {
      if (orderedNav.length === 0) return;
      const wrapped = ((idx % orderedNav.length) + orderedNav.length) % orderedNav.length;
      navIndexRef.current = wrapped;
      const target = orderedNav[wrapped];
      const editor = resultRef.current.editor;
      if (!editor) return;
      const line = target.hunk.mineRange.startLine;
      // Land the conflict near the TOP of the viewport (VS Code's
      // navigator convention) so the user immediately sees the
      // hunk's content + action zones above it without further
      // scrolling. Pairs with `scrollBeyondLastLine: true` so this
      // works even for hunks near EOF.
      editor.revealLineNearTop(line);
      editor.setPosition({ lineNumber: line, column: 1 });
      editor.focus();
    },
    [orderedNav, resultRef],
  );

  const gotoNextHunk = useCallback(() => revealHunkAt(navIndexRef.current + 1), [revealHunkAt]);
  const gotoPrevHunk = useCallback(() => revealHunkAt(navIndexRef.current - 1), [revealHunkAt]);

  // In 2-pane fallback the mine slot isn't reachable from the gutter,
  // so bulk actions skip writing to it (the stats useEffect already
  // treats `mine: 'pending'` in 2-pane as auto-resolved).
  const minePostState: 'dismissed' | 'pending' = has3Panes ? 'dismissed' : 'pending';

  const applyNonConflicting = useCallback(() => {
    const updates: { hunkId: string; next: HunkPickState }[] = [];
    for (const analysis of analyses) {
      if (analysis.conflict === 'true') continue;
      const prev = pickController.get(analysis.id);
      if (prev.theirs !== 'pending') continue;
      // Auto-mergeable hunk shape: take whichever side actually
      // changed vs base. Mine-only change ⇒ keep mine (dismiss
      // theirs). Theirs-only change ⇒ accept theirs (default
      // dismissed mine in 3-pane). 2-pane fallback collapses to
      // "accept theirs" because that's the only axis the user can
      // act on.
      if (analysis.hasBase && analysis.theirs.kind === 'unchanged' && analysis.mine.kind !== 'unchanged') {
        updates.push({ hunkId: analysis.id, next: { theirs: 'dismissed', mine: 'accepted' } });
      } else {
        updates.push({ hunkId: analysis.id, next: { theirs: 'accepted', mine: minePostState } });
      }
    }
    if (updates.length > 0) {
      onAnnounce?.(t('shared.mergeEditor.announce.appliedNonConflicting', { count: updates.length }));
      pickController.bulkSet(updates);
    }
  }, [analyses, pickController, onAnnounce, minePostState, t]);

  const acceptAllTheirs = useCallback(() => {
    const updates: { hunkId: string; next: HunkPickState }[] = pickStateHunks.map((h) => ({
      hunkId: h.id,
      next: { theirs: 'accepted', mine: minePostState },
    }));
    if (updates.length > 0) {
      onAnnounce?.(t('shared.mergeEditor.announce.acceptedAllIncoming', { count: updates.length }));
      pickController.bulkSet(updates);
    }
  }, [pickStateHunks, pickController, onAnnounce, minePostState, t]);

  const acceptAllMine = useCallback(() => {
    // In 2-pane fallback there is no separate "mine" content to take —
    // the right pane isn't displayed and the mine slot is unreachable
    // from the gutter. Skip the action entirely.
    if (!has3Panes) return;
    const updates: { hunkId: string; next: HunkPickState }[] = pickStateHunks.map((h) => ({
      hunkId: h.id,
      next: { theirs: 'dismissed', mine: 'accepted' },
    }));
    if (updates.length > 0) {
      onAnnounce?.(t('shared.mergeEditor.announce.acceptedAllCurrent', { count: updates.length }));
      pickController.bulkSet(updates);
    }
  }, [pickStateHunks, pickController, onAnnounce, has3Panes, t]);

  return { gotoNextHunk, gotoPrevHunk, applyNonConflicting, acceptAllTheirs, acceptAllMine, acceptHunk };
}
