import { describe, expect, it } from 'vitest';
import type { Hunk } from '@/shared/merge-editor/diff/line-diff';
import type { HunkTrackedRangesHandle } from '@/shared/merge-editor/monaco/use-hunk-tracked-ranges';
import {
  createPickStateController,
  type HunkPickState,
  isResolved,
  PENDING_HUNK,
  writeTextFor,
} from '@/shared/merge-editor/use-hunk-pick-state';

function makeHunk(overrides: Partial<Hunk> = {}): Hunk {
  return {
    id: 'hunk-1',
    classification: 'modification',
    theirsRange: { startLine: 1, endLine: 2 },
    mineRange: { startLine: 1, endLine: 2 },
    theirsLines: ['theirs-line'],
    mineLines: ['mine-line'],
    ...overrides,
  };
}

interface TrackedWriteCall {
  hunkId: string;
  text: string;
}

function makeTrackedHandle(): { handle: HunkTrackedRangesHandle; calls: TrackedWriteCall[] } {
  const calls: TrackedWriteCall[] = [];
  const handle: HunkTrackedRangesHandle = {
    liveRangeOf: () => null,
    writeHunk(hunkId, text) {
      calls.push({ hunkId, text });
      return true;
    },
  };
  return { handle, calls };
}

describe('writeTextFor', () => {
  const hunk = makeHunk({ theirsLines: ['T'], mineLines: ['M'] });

  it('emits null for both pending', () => {
    expect(writeTextFor(PENDING_HUNK, hunk)).toBeNull();
  });

  it('emits null for both dismissed', () => {
    expect(writeTextFor({ theirs: 'dismissed', mine: 'dismissed' }, hunk)).toBeNull();
  });

  it('emits theirs text only when theirs accepted + mine pending/dismissed', () => {
    expect(writeTextFor({ theirs: 'accepted', mine: 'pending' }, hunk)).toBe('T\n');
    expect(writeTextFor({ theirs: 'accepted', mine: 'dismissed' }, hunk)).toBe('T\n');
  });

  it('emits mine text only when mine accepted + theirs pending/dismissed', () => {
    expect(writeTextFor({ theirs: 'pending', mine: 'accepted' }, hunk)).toBe('M\n');
    expect(writeTextFor({ theirs: 'dismissed', mine: 'accepted' }, hunk)).toBe('M\n');
  });

  it('stacks theirs then mine when both accepted', () => {
    expect(writeTextFor({ theirs: 'accepted', mine: 'accepted' }, hunk)).toBe('T\nM\n');
  });

  it('handles multi-line theirs + mine', () => {
    const multi = makeHunk({ theirsLines: ['a', 'b'], mineLines: ['x'] });
    expect(writeTextFor({ theirs: 'accepted', mine: 'accepted' }, multi)).toBe('a\nb\nx\n');
  });
});

describe('isResolved', () => {
  it('false when any side pending', () => {
    expect(isResolved(PENDING_HUNK)).toBe(false);
    expect(isResolved({ theirs: 'accepted', mine: 'pending' })).toBe(false);
    expect(isResolved({ theirs: 'pending', mine: 'dismissed' })).toBe(false);
  });

  it('true when no side pending', () => {
    expect(isResolved({ theirs: 'accepted', mine: 'dismissed' })).toBe(true);
    expect(isResolved({ theirs: 'dismissed', mine: 'dismissed' })).toBe(true);
    expect(isResolved({ theirs: 'accepted', mine: 'accepted' })).toBe(true);
  });
});

describe('createPickStateController', () => {
  function setup(opts: { singleClick?: boolean } = {}) {
    const hunks: Hunk[] = [makeHunk({ id: 'h1', theirsLines: ['T'], mineLines: ['M'] })];
    const hunksRef = { current: hunks };
    const { handle, calls } = makeTrackedHandle();
    const trackedRangesRef = { current: handle };
    const singleClickResolveRef = { current: opts.singleClick ?? false };
    let onChangeId: string | null | undefined;
    const controller = createPickStateController({
      hunksRef,
      trackedRangesRef,
      singleClickResolveRef,
      onChange: (id) => {
        onChangeId = id;
      },
    });
    return { controller, calls, hunksRef, singleClickResolveRef, getOnChangeId: () => onChangeId };
  }

  it('arrow click on left sets theirs to accepted, writes theirs text', () => {
    const { controller, calls } = setup();
    controller.dispatch({ hunkId: 'h1', slot: 'left', action: 'arrow' });
    expect(controller.get('h1')).toEqual({ theirs: 'accepted', mine: 'pending' });
    expect(calls).toEqual([{ hunkId: 'h1', text: 'T\n' }]);
  });

  it('x click on right sets mine to dismissed, restores original content', () => {
    // The buffer always reflects the controller's state. Going from
    // PENDING_HUNK → {theirs: pending, mine: dismissed} restores the
    // original content (= mineLines for theirs-axis hunks); for hunks
    // that hadn't been written before, this writes the same text the
    // buffer already holds — a safe no-op at the model level.
    const { controller, calls } = setup();
    controller.dispatch({ hunkId: 'h1', slot: 'right', action: 'x' });
    expect(controller.get('h1')).toEqual({ theirs: 'pending', mine: 'dismissed' });
    expect(calls).toEqual([{ hunkId: 'h1', text: 'M\n' }]);
  });

  it('accept theirs then accept mine stacks the write', () => {
    const { controller, calls } = setup();
    controller.dispatch({ hunkId: 'h1', slot: 'left', action: 'arrow' });
    controller.dispatch({ hunkId: 'h1', slot: 'right', action: 'arrow' });
    expect(controller.get('h1')).toEqual({ theirs: 'accepted', mine: 'accepted' });
    expect(calls).toEqual([
      { hunkId: 'h1', text: 'T\n' },
      { hunkId: 'h1', text: 'T\nM\n' },
    ]);
  });

  it('single-click-resolve auto-dismisses the other side on accept', () => {
    const { controller, calls } = setup({ singleClick: true });
    controller.dispatch({ hunkId: 'h1', slot: 'left', action: 'arrow' });
    expect(controller.get('h1')).toEqual({ theirs: 'accepted', mine: 'dismissed' });
    expect(calls).toEqual([{ hunkId: 'h1', text: 'T\n' }]);
  });

  it('single-click-resolve does NOT auto-dismiss on dismiss click', () => {
    const { controller } = setup({ singleClick: true });
    controller.dispatch({ hunkId: 'h1', slot: 'left', action: 'x' });
    expect(controller.get('h1')).toEqual({ theirs: 'dismissed', mine: 'pending' });
  });

  it('toggling singleClickResolve mid-session affects the next click only', () => {
    const { controller, singleClickResolveRef } = setup();
    controller.dispatch({ hunkId: 'h1', slot: 'left', action: 'arrow' });
    expect(controller.get('h1').mine).toBe('pending');
    singleClickResolveRef.current = true;
    controller.dispatch({ hunkId: 'h1', slot: 'right', action: 'arrow' });
    // Now both accepted (both arrows fired).
    expect(controller.get('h1')).toEqual({ theirs: 'accepted', mine: 'accepted' });
  });

  it('undo reverts state AND restores the original buffer content', () => {
    const { controller, calls } = setup();
    controller.dispatch({ hunkId: 'h1', slot: 'left', action: 'arrow' });
    expect(controller.get('h1').theirs).toBe('accepted');
    controller.undo();
    expect(controller.get('h1')).toEqual(PENDING_HUNK);
    // Undo to PENDING_HUNK must rewrite the original mine content
    // so the buffer stays in lock-step with the controller state —
    // without this, the model is left holding theirs's accepted
    // content while the controller says pending (visual / buffer
    // mismatch, and the action zone reappears over what looks like
    // an already-accepted region).
    expect(calls).toEqual([
      { hunkId: 'h1', text: 'T\n' },
      { hunkId: 'h1', text: 'M\n' },
    ]);
  });

  it('redo re-applies the accepted content after an undo', () => {
    const { controller, calls } = setup();
    controller.dispatch({ hunkId: 'h1', slot: 'left', action: 'arrow' });
    controller.undo();
    controller.redo();
    expect(controller.get('h1').theirs).toBe('accepted');
    expect(calls).toEqual([
      { hunkId: 'h1', text: 'T\n' },
      { hunkId: 'h1', text: 'M\n' },
      { hunkId: 'h1', text: 'T\n' },
    ]);
  });

  it('dismiss other side then accept this side still writes this side', () => {
    // Repro for the "Ignore on right + Accept Incoming on left" bug:
    // the SECOND dispatch must still produce a buffer write for the
    // accepted side even though the first dispatch already decided
    // the other side.
    const hunks: Hunk[] = [
      makeHunk({
        id: 'add',
        theirsLines: ['T1', 'T2'],
        mineLines: [],
        theirsRange: { startLine: 1, endLine: 3 },
        mineRange: { startLine: 1, endLine: 1 },
      }),
    ];
    const { handle, calls } = makeTrackedHandle();
    const controller = createPickStateController({
      hunksRef: { current: hunks },
      trackedRangesRef: { current: handle },
      singleClickResolveRef: { current: false },
    });
    controller.dispatch({ hunkId: 'add', slot: 'right', action: 'x' });
    expect(controller.get('add')).toEqual({ theirs: 'pending', mine: 'dismissed' });
    // First dispatch restores original (= empty for pure-add).
    expect(calls).toEqual([{ hunkId: 'add', text: '' }]);
    controller.dispatch({ hunkId: 'add', slot: 'left', action: 'arrow' });
    expect(controller.get('add')).toEqual({ theirs: 'accepted', mine: 'dismissed' });
    expect(calls).toEqual([
      { hunkId: 'add', text: '' },
      { hunkId: 'add', text: 'T1\nT2\n' },
    ]);
  });

  it('new dispatch clears the redo stack (standard editor behavior)', () => {
    const { controller } = setup();
    controller.dispatch({ hunkId: 'h1', slot: 'left', action: 'arrow' });
    controller.undo();
    expect(controller.stackDepths()).toEqual({ undo: 0, redo: 1 });
    controller.dispatch({ hunkId: 'h1', slot: 'right', action: 'arrow' });
    expect(controller.stackDepths().redo).toBe(0);
  });

  it('bulkSet records every change as its own undo entry and writes the buffer', () => {
    const hunks: Hunk[] = [
      makeHunk({ id: 'a', theirsLines: ['Ta'], mineLines: ['Ma'] }),
      makeHunk({ id: 'b', theirsLines: ['Tb'], mineLines: ['Mb'] }),
    ];
    const { handle, calls } = makeTrackedHandle();
    const controller = createPickStateController({
      hunksRef: { current: hunks },
      trackedRangesRef: { current: handle },
      singleClickResolveRef: { current: false },
    });
    const accepted: HunkPickState = { theirs: 'accepted', mine: 'dismissed' };
    controller.bulkSet([
      { hunkId: 'a', next: accepted },
      { hunkId: 'b', next: accepted },
    ]);
    expect(controller.get('a')).toEqual(accepted);
    expect(controller.get('b')).toEqual(accepted);
    expect(calls).toEqual([
      { hunkId: 'a', text: 'Ta\n' },
      { hunkId: 'b', text: 'Tb\n' },
    ]);
    expect(controller.stackDepths().undo).toBe(2);
  });

  it('reset clears state + undo/redo and notifies onChange once', () => {
    const { controller, getOnChangeId } = setup();
    controller.dispatch({ hunkId: 'h1', slot: 'left', action: 'arrow' });
    controller.reset();
    expect(controller.get('h1')).toEqual(PENDING_HUNK);
    expect(controller.stackDepths()).toEqual({ undo: 0, redo: 0 });
    expect(getOnChangeId()).toBeNull();
  });
});
