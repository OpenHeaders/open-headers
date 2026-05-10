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
        if (!shouldRender) continue;
        // Anchor the zone above the hunk's start line on this side.
        // View zones use `afterLineNumber` where 0 means "before
        // line 1" — for a hunk starting at line N, we want the zone
        // BEFORE the hunk → afterLineNumber = N - 1.
        const range = args.side === 'theirs' ? h.theirsRange : h.mineRange;
        const startLine = range.startLine;
        const endLineExclusive = range.endLine;
        if (startLine < 1 || startLine > lineCount + 1) continue;
        // Combination is only offered for MULTI-line hunks — VS Code's
        // convention is that single-line hunks just get
        // "Accept | Ignore" (taking BOTH means stacking, which is only
        // meaningful when each side has distinct multi-line content).
        // Single-line picks default to whichever side the user names.
        const isMultiLine = endLineExclusive > startLine + 1;
        // Combine is also only meaningful when the OTHER side is still
        // pending (accepting both makes sense) AND no side is dismissed
        // (combining a dismissed side is contradictory).
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

        // Frame decorations on every line of the hunk to close the
        // VS Code-style outline rectangle (label row + hunk body).
        // Last line gets the bottom border to seal the box.
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
  }, [args.editorRef, args.side, args.hunks, args.controller, args.stateRev, args.enabled]);
}
