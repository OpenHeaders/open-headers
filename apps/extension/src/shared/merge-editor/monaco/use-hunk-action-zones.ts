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

  const acceptBtn = document.createElement('button');
  acceptBtn.type = 'button';
  acceptBtn.className = 'oh-merge__action-zone-btn';
  acceptBtn.textContent = labels.accept;
  acceptBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    args.controller.dispatch({ hunkId: args.hunk.id, slot, action: 'arrow' });
  });

  const combineBtn = document.createElement('button');
  combineBtn.type = 'button';
  combineBtn.className = 'oh-merge__action-zone-btn';
  combineBtn.textContent = labels.combine;
  combineBtn.title = 'Stack both sides — incoming first, then current';
  // Combine is only meaningful when we can actually take BOTH sides.
  // If this side is dismissed or the other side is dismissed, combine
  // would be a no-op or contradictory; hide it.
  if (!args.isCombineMeaningful) combineBtn.hidden = true;
  combineBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Combination = accept BOTH sides. Bypass the per-side controller
    // dispatch (which would only flip one slot) and use bulkSet to
    // emit a single undo entry for the combined state.
    args.controller.bulkSet([{ hunkId: args.hunk.id, next: { theirs: 'accepted', mine: 'accepted' } }]);
  });

  const ignoreBtn = document.createElement('button');
  ignoreBtn.type = 'button';
  ignoreBtn.className = 'oh-merge__action-zone-btn oh-merge__action-zone-btn-ignore';
  ignoreBtn.textContent = labels.ignore;
  ignoreBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    args.controller.dispatch({ hunkId: args.hunk.id, slot, action: 'x' });
  });

  root.appendChild(acceptBtn);
  root.appendChild(combineBtn);
  root.appendChild(ignoreBtn);
  return root;
}

function shouldRenderZone(state: { theirs: SideState; mine: SideState }, side: HunkSide): boolean {
  if (side === 'theirs') return state.theirs === 'pending';
  return state.mine === 'pending';
}

export function useHunkActionZones(args: UseHunkActionZonesArgs): void {
  const zoneIdsRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const editor = args.editorRef.current.editor;
    const model = args.editorRef.current.model;
    if (!editor || !model) return;
    const zoneIds = zoneIdsRef.current;

    if (!args.enabled) {
      // Disabled: clear all zones, leave editor untouched.
      if (zoneIds.size > 0) {
        editor.changeViewZones((accessor) => {
          for (const id of zoneIds.values()) accessor.removeZone(id);
        });
        zoneIds.clear();
      }
      return;
    }

    const liveIds = new Set(args.hunks.map((h) => h.id));
    const lineCount = model.getLineCount();

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
        if (!shouldRender) continue;
        // Anchor the zone above the hunk's start line on this side.
        // `theirsRange.startLine` for the theirs pane;
        // `mineRange.startLine` for the mine pane. Both are 1-based
        // inclusive per the line-diff convention. View zones are
        // positioned via `afterLineNumber`, where 0 means "before
        // line 1" — for a hunk starting at line N, we want the zone
        // BEFORE the hunk → afterLineNumber = N - 1.
        const startLine = args.side === 'theirs' ? h.theirsRange.startLine : h.mineRange.startLine;
        if (startLine < 1 || startLine > lineCount + 1) continue;
        // Combine is meaningful when both sides could still potentially
        // be accepted. If the OTHER side is already accepted, the
        // simple Accept on this side already stacks via the controller
        // (because mine='accepted' makes left-arrow combine theirs+
        // mine). Hide the explicit Combine button in that case to
        // reduce duplication.
        const otherSideAccepted = args.side === 'theirs' ? state.mine === 'accepted' : state.theirs === 'accepted';
        const isCombineMeaningful = !otherSideAccepted && state.theirs !== 'dismissed' && state.mine !== 'dismissed';
        const dom = buildZoneDom({ side: args.side, hunk: h, controller: args.controller, isCombineMeaningful });
        const zoneId = accessor.addZone({
          afterLineNumber: startLine - 1,
          heightInLines: 1,
          domNode: dom,
        } satisfies monaco.editor.IViewZone);
        zoneIds.set(h.id, zoneId);
      }
    });
    return () => {
      // Cleanup on unmount or args change: remove every zone we own.
      // The next effect run re-adds them if still applicable.
      if (zoneIds.size === 0) return;
      editor.changeViewZones((accessor) => {
        for (const id of zoneIds.values()) accessor.removeZone(id);
      });
      zoneIds.clear();
    };
  }, [args.editorRef, args.side, args.hunks, args.controller, args.stateRev, args.enabled]);
}
