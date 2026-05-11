/**
 * Per-side pick state machine for hunks.
 *
 * Each hunk has two independent slots (theirs / mine), each in one of
 * `pending | accepted | dismissed`. The state map drives:
 *   - which gutter glyphs render (only pending sides show controls)
 *   - what the result buffer contains for the hunk's region
 *   - the resolved/unresolved status the sidebar + Complete Merge gate
 *     consume
 *
 * Buffer-write rules per (theirs, mine) tuple:
 *
 *   | theirs    | mine      | result region becomes               |
 *   |-----------|-----------|--------------------------------------|
 *   | accepted  | pending/d | `theirs\n`                           |
 *   | pending/d | accepted  | `mine\n`                             |
 *   | accepted  | accepted  | `theirs\n` + `mine\n` (stacked)      |
 *   | pending   | pending   | (no write — original stays)          |
 *   | dismissed | dismissed | (no write — explicit skip)           |
 *   | dismissed | pending   | (no write — wait for the other side) |
 *   | pending   | dismissed | (no write — wait for the other side) |
 *
 * (`pending/d` = "pending or dismissed"; both contribute nothing.)
 *
 * Single-click-resolve toggle: when enabled, accepting one side
 * auto-dismisses the other so the hunk is fully resolved on the
 * first click — no diagonal-append decision left to consider.
 *
 * Undo: every click pushes onto an internal undo stack `{hunkId, prev,
 * next}`. `undo()` / `redo()` walks the stacks AND re-runs the buffer
 * write so the model and state stay in lock-step. Cmd+Z on the buffer
 * itself is intentionally NOT bridged — Monaco's undo and the pick-
 * state undo are parallel stacks, not unified, because trying to
 * unify them would mean re-deriving state from buffer content (the
 * same observation-based model that lost identity). Callers that want
 * a single undo surface should bind a key chord that calls both.
 */

import type { Hunk } from './diff/line-diff';
import type { HunkTrackedRangesHandle } from './monaco/use-hunk-tracked-ranges';

export type SideState = 'pending' | 'accepted' | 'dismissed';

export interface HunkPickState {
  theirs: SideState;
  mine: SideState;
}

export const PENDING_HUNK: HunkPickState = { theirs: 'pending', mine: 'pending' };

export type ClickSlot = 'left' | 'right';
export type ClickAction = 'arrow' | 'x';

export interface PickClick {
  hunkId: string;
  slot: ClickSlot;
  action: ClickAction;
}

export interface PickStateUndoEntry {
  hunkId: string;
  prev: HunkPickState;
  next: HunkPickState;
}

/** Whether the hunk has reached a terminal state (no side still pending). */
export function isResolved(state: HunkPickState): boolean {
  return state.theirs !== 'pending' && state.mine !== 'pending';
}

function withTrailingNewline(s: string): string {
  return s.length > 0 && !s.endsWith('\n') ? `${s}\n` : s;
}

/** Compute the buffer text the hunk's region should hold for a given
 *  (theirs, mine) state tuple, or `null` when no write should fire. */
export function writeTextFor(state: HunkPickState, hunk: Hunk): string | null {
  const tA = state.theirs === 'accepted';
  const mA = state.mine === 'accepted';
  if (tA && mA) {
    return withTrailingNewline(hunk.theirsLines.join('\n')) + withTrailingNewline(hunk.mineLines.join('\n'));
  }
  if (tA) return withTrailingNewline(hunk.theirsLines.join('\n'));
  if (mA) return withTrailingNewline(hunk.mineLines.join('\n'));
  return null;
}

function transitionForClick(prev: HunkPickState, click: PickClick, singleClickResolve: boolean): HunkPickState {
  const next: HunkPickState = { ...prev };
  const transition: SideState = click.action === 'arrow' ? 'accepted' : 'dismissed';
  if (click.slot === 'left') next.theirs = transition;
  else next.mine = transition;
  // Single-click-resolve: accepting one side auto-dismisses the other
  // pending side. Dismiss clicks don't trigger this — the user is
  // explicitly saying "don't write this side" and the other side may
  // still warrant a real choice.
  if (singleClickResolve && click.action === 'arrow') {
    if (click.slot === 'left' && next.mine === 'pending') next.mine = 'dismissed';
    if (click.slot === 'right' && next.theirs === 'pending') next.theirs = 'dismissed';
  }
  return next;
}

export interface PickStateController {
  /** Read-only snapshot of every hunk's current state. Missing entries
   *  default to `PENDING_HUNK`. The returned Map is owned by the
   *  controller; do not mutate. */
  states(): ReadonlyMap<string, HunkPickState>;
  get(hunkId: string): HunkPickState;
  /** Apply a click. Computes the new state, runs the buffer write,
   *  records the transition for undo. No-op when the hunk is unknown. */
  dispatch(click: PickClick): void;
  /** Revert one slot back to `pending` from a non-pending state. If
   *  no slot remains accepted after the revert, the buffer's region
   *  for this hunk is restored to its original content (`mineLines`).
   *  Records as a single undo entry like `dispatch`. */
  revert(hunkId: string, slot: ClickSlot): void;
  /** Bulk action — set the state for many hunks at once and write the
   *  buffer in one batch. Used by "Apply Non-Conflicting" / "Accept
   *  All Theirs" / "Accept All Mine". Each entry is recorded as a
   *  single undo unit (a "bulk" entry that reverts every change at
   *  once on undo). */
  bulkSet(updates: ReadonlyArray<{ hunkId: string; next: HunkPickState }>): void;
  /** Reset every hunk's state to PENDING_HUNK. Used when the hunk set
   *  changes radically (e.g. file switch) and stale entries would
   *  carry false signals. */
  reset(): void;
  /** Pop the most recent click + revert state + buffer. */
  undo(): void;
  /** Re-apply a previously undone click. */
  redo(): void;
  /** Diagnostic — depths of the undo / redo stacks. */
  stackDepths(): { undo: number; redo: number };
}

export interface CreatePickStateControllerArgs {
  hunksRef: { current: readonly Hunk[] };
  trackedRangesRef: { current: HunkTrackedRangesHandle };
  singleClickResolveRef: { current: boolean };
  /** Fires after every state change so callers can repaint immediately
   *  without waiting for the next React effect tick. The argument is
   *  the affected hunk id, or `null` when many changed (bulkSet /
   *  reset). */
  onChange?: (hunkId: string | null) => void;
}

export function createPickStateController(args: CreatePickStateControllerArgs): PickStateController {
  const map = new Map<string, HunkPickState>();
  const undoStack: PickStateUndoEntry[] = [];
  const redoStack: PickStateUndoEntry[] = [];

  const findHunk = (hunkId: string): Hunk | null => {
    for (const h of args.hunksRef.current) if (h.id === hunkId) return h;
    return null;
  };

  /**
   * Sync the model with the target pick state.
   *
   * When `writeTextFor` returns null (no side accepted), the model's
   * region for this hunk should hold its ORIGINAL pre-acceptance
   * content. Without this restoration the model is left holding
   * whatever the previous accepted state wrote, while the controller
   * says "pending / dismissed" — visual reads as pending but the
   * buffer reflects an accepted state.
   *
   * "Original" = `hunk.mineLines` joined with newlines because the
   * result buffer is seeded from mine. Pure-addition hunks have empty
   * `mineLines`, so the original content is the empty string (an
   * insertion-point in the result).
   *
   * Crossing this restore through `writeFor` (rather than leaving
   * `revert` to do it alone) closes the same gap on undo / redo, which
   * also transition between accepted and pending states.
   */
  const writeFor = (hunkId: string, state: HunkPickState): void => {
    const hunk = findHunk(hunkId);
    if (!hunk) return;
    const text = writeTextFor(state, hunk);
    const finalText = text ?? (hunk.mineLines.length === 0 ? '' : `${hunk.mineLines.join('\n')}\n`);
    args.trackedRangesRef.current.writeHunk(hunkId, finalText);
  };

  return {
    states: () => map,
    get: (hunkId) => map.get(hunkId) ?? PENDING_HUNK,
    dispatch(click) {
      const hunk = findHunk(click.hunkId);
      const prev = map.get(click.hunkId) ?? PENDING_HUNK;
      let next = transitionForClick(prev, click, args.singleClickResolveRef.current);
      // Auto-dismiss the empty side of pure-add / pure-remove hunks.
      // The empty side has no content to decide about and its action
      // zone is hidden in the UI (no affordance), so without this
      // bridge a single dispatch leaves the hunk stuck in
      // {accepted, pending} forever — frame stays blue instead of
      // resolving to grey, and "Complete Merge" stays disabled
      // because stats count the empty side as still-pending. The
      // auto-dismiss matches the user's intent (they decided on the
      // populated side; the empty side has nothing to decide).
      if (hunk) {
        if (hunk.mineLines.length === 0 && next.theirs !== 'pending' && next.mine === 'pending') {
          next = { ...next, mine: 'dismissed' };
        }
        if (hunk.theirsLines.length === 0 && next.mine !== 'pending' && next.theirs === 'pending') {
          next = { ...next, theirs: 'dismissed' };
        }
      }
      if (prev.theirs === next.theirs && prev.mine === next.mine) return;
      map.set(click.hunkId, next);
      undoStack.push({ hunkId: click.hunkId, prev, next });
      redoStack.length = 0;
      writeFor(click.hunkId, next);
      args.onChange?.(click.hunkId);
    },
    revert(hunkId, slot) {
      const prev = map.get(hunkId) ?? PENDING_HUNK;
      const next: HunkPickState = { ...prev };
      if (slot === 'left') next.theirs = 'pending';
      else next.mine = 'pending';
      if (prev.theirs === next.theirs && prev.mine === next.mine) return;
      // Drop the entry entirely if both sides are now pending —
      // matches the undo path's "missing-from-map === PENDING_HUNK"
      // convention so the controller's state map stays compact.
      if (next.theirs === 'pending' && next.mine === 'pending') {
        map.delete(hunkId);
      } else {
        map.set(hunkId, next);
      }
      undoStack.push({ hunkId, prev, next });
      redoStack.length = 0;
      // `writeFor` handles both the accepted-content and the
      // restore-to-original cases — single source of truth for
      // syncing the model with the target state.
      writeFor(hunkId, next);
      args.onChange?.(hunkId);
    },
    bulkSet(updates) {
      let changed = false;
      for (const u of updates) {
        const prev = map.get(u.hunkId) ?? PENDING_HUNK;
        if (prev.theirs === u.next.theirs && prev.mine === u.next.mine) continue;
        map.set(u.hunkId, u.next);
        undoStack.push({ hunkId: u.hunkId, prev, next: u.next });
        writeFor(u.hunkId, u.next);
        changed = true;
      }
      if (changed) {
        redoStack.length = 0;
        args.onChange?.(null);
      }
    },
    reset() {
      if (map.size === 0 && undoStack.length === 0 && redoStack.length === 0) return;
      map.clear();
      undoStack.length = 0;
      redoStack.length = 0;
      args.onChange?.(null);
    },
    undo() {
      const entry = undoStack.pop();
      if (!entry) return;
      redoStack.push(entry);
      // Restore the prior state. If `prev` was the default (both
      // pending) and we want to reflect that explicitly, store it.
      // Either way, missing-from-map === PENDING_HUNK so deletion is
      // safe when prev IS the default.
      if (entry.prev.theirs === 'pending' && entry.prev.mine === 'pending') {
        map.delete(entry.hunkId);
      } else {
        map.set(entry.hunkId, entry.prev);
      }
      writeFor(entry.hunkId, entry.prev);
      args.onChange?.(entry.hunkId);
    },
    redo() {
      const entry = redoStack.pop();
      if (!entry) return;
      undoStack.push(entry);
      map.set(entry.hunkId, entry.next);
      writeFor(entry.hunkId, entry.next);
      args.onChange?.(entry.hunkId);
    },
    stackDepths() {
      return { undo: undoStack.length, redo: redoStack.length };
    },
  };
}
