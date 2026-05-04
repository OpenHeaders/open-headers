/**
 * Tests for the dock-layout collision detector.
 *
 * `toolWindowCollision` and `makeEditorTabCollisionDetection` are pure
 * given the dnd-kit args shape. We mock the two dnd-kit primitives
 * (`pointerWithin`, `closestCenter`) so each test feeds a stable hit
 * list and asserts the detector's branching behaviour.
 */

import type { CollisionDetection } from '@dnd-kit/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

const pointerWithinMock = vi.fn<CollisionDetection>();
const closestCenterMock = vi.fn<CollisionDetection>();

vi.mock('@dnd-kit/core', () => ({
  pointerWithin: (args: Parameters<CollisionDetection>[0]) => pointerWithinMock(args),
  closestCenter: (args: Parameters<CollisionDetection>[0]) => closestCenterMock(args),
}));

import { makeEditorTabCollisionDetection } from '@/shared/dock-layout/editor-tab-collision';

type Container = {
  id: string;
  data: { current: Record<string, unknown> };
  node: { current: HTMLElement | null };
};

function container(id: string, data: Record<string, unknown> = {}, node: HTMLElement | null = null): Container {
  return { id, data: { current: data }, node: { current: node } };
}

function makeArgs(overrides: {
  active?: { kind?: string };
  pointer?: { x: number; y: number } | null;
  containers?: Container[];
}): Parameters<CollisionDetection>[0] {
  return {
    active: { id: 'src', data: { current: overrides.active ?? {} } },
    droppableContainers: overrides.containers ?? [],
    pointerCoordinates: overrides.pointer ?? null,
    collisionRect: { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 },
    droppableRects: new Map(),
  } as unknown as Parameters<CollisionDetection>[0];
}

afterEach(() => {
  pointerWithinMock.mockReset();
  closestCenterMock.mockReset();
});

describe('toolWindowCollision (non-editor-tab drags)', () => {
  const detect = makeEditorTabCollisionDetection('.tab-bar');

  it('falls back to closestCenter when pointer hits no droppable', () => {
    pointerWithinMock.mockReturnValue([]);
    closestCenterMock.mockReturnValue([{ id: 'tw:a' }]);

    const out = detect(makeArgs({}));

    expect(closestCenterMock).toHaveBeenCalledOnce();
    expect(out).toEqual([{ id: 'tw:a' }]);
  });

  it('returns the specific tab (tw:) when the pointer is over one', () => {
    pointerWithinMock.mockReturnValue([{ id: 'dock:left-top' }, { id: 'tw:b' }]);

    const out = detect(makeArgs({}));

    expect(out).toEqual([{ id: 'tw:b' }]);
    expect(closestCenterMock).not.toHaveBeenCalled();
  });

  it('over a strip with same-slot tabs → snaps to closest tab in that strip', () => {
    pointerWithinMock.mockReturnValue([{ id: 'dock:left-top' }]);
    closestCenterMock.mockReturnValue([{ id: 'tw:a' }]);

    const containers: Container[] = [
      container('tw:a', { fromSlot: 'left-top' }),
      container('tw:b', { fromSlot: 'left-top' }),
      container('tw:other', { fromSlot: 'right-top' }),
      container('dock:left-top'),
    ];
    const out = detect(makeArgs({ containers }));

    // closestCenter should have been called scoped to the two left-top tabs only.
    expect(closestCenterMock).toHaveBeenCalledOnce();
    const scoped = closestCenterMock.mock.calls[0][0].droppableContainers as Container[];
    expect(scoped.map((c) => c.id)).toEqual(['tw:a', 'tw:b']);
    expect(out).toEqual([{ id: 'tw:a' }]);
  });

  it('over a strip with no same-slot tabs → returns the dock as drop target', () => {
    pointerWithinMock.mockReturnValue([{ id: 'dock:bottom-left' }]);
    const containers: Container[] = [container('tw:elsewhere', { fromSlot: 'left-top' })];

    const out = detect(makeArgs({ containers }));

    expect(out).toEqual([{ id: 'dock:bottom-left' }]);
    expect(closestCenterMock).not.toHaveBeenCalled();
  });

  it('returns pointerWithin hits unchanged when no tw: or dock: is present', () => {
    const hits = [{ id: 'overlay:left' }];
    pointerWithinMock.mockReturnValue(hits);
    const out = detect(makeArgs({}));
    expect(out).toBe(hits);
  });
});

describe('makeEditorTabCollisionDetection (editor-tab drags)', () => {
  const detect = makeEditorTabCollisionDetection('.tab-bar');

  it('returns [] when active is editor-tab and no pointer is provided', () => {
    const out = detect(makeArgs({ active: { kind: 'editor-tab' }, pointer: null }));
    expect(out).toEqual([]);
    expect(pointerWithinMock).not.toHaveBeenCalled();
    expect(closestCenterMock).not.toHaveBeenCalled();
  });

  it('returns [] when pointer is outside every editor-tab tab-bar', () => {
    // Build a node with a parent matching '.tab-bar' but at coords [0..10, 0..10].
    document.body.innerHTML = '<div class="tab-bar" id="bar"><div id="tab"></div></div>';
    const bar = document.getElementById('bar') as HTMLElement;
    Object.assign(bar, {
      getBoundingClientRect: () => ({ left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10 }),
    });
    const tabNode = document.getElementById('tab') as HTMLElement;

    const containers: Container[] = [container('et:1', { kind: 'editor-tab' }, tabNode)];
    const out = detect(
      makeArgs({ active: { kind: 'editor-tab' }, pointer: { x: 999, y: 999 }, containers }),
    );

    expect(out).toEqual([]);
  });

  it('scopes collisions to the hovered tab-bar only when pointer is inside it', () => {
    document.body.innerHTML = `
      <div class="tab-bar" id="barA"><div id="tabA"></div></div>
      <div class="tab-bar" id="barB"><div id="tabB"></div></div>
    `;
    const barA = document.getElementById('barA') as HTMLElement;
    const barB = document.getElementById('barB') as HTMLElement;
    Object.assign(barA, {
      getBoundingClientRect: () => ({ left: 0, top: 0, right: 50, bottom: 20, width: 50, height: 20 }),
    });
    Object.assign(barB, {
      getBoundingClientRect: () => ({ left: 100, top: 0, right: 150, bottom: 20, width: 50, height: 20 }),
    });
    const tabA = document.getElementById('tabA') as HTMLElement;
    const tabB = document.getElementById('tabB') as HTMLElement;

    const containers: Container[] = [
      container('et:A', { kind: 'editor-tab' }, tabA),
      container('et:B', { kind: 'editor-tab' }, tabB),
      container('tw:noise', { kind: 'tool-window' }, document.body), // never editor-tab
    ];
    closestCenterMock.mockReturnValue([{ id: 'et:B' }]);

    const out = detect(
      makeArgs({ active: { kind: 'editor-tab' }, pointer: { x: 110, y: 5 }, containers }),
    );

    // Only the tab inside barB should be in the scoped list.
    const scoped = closestCenterMock.mock.calls[0][0].droppableContainers as Container[];
    expect(scoped.map((c) => c.id)).toEqual(['et:B']);
    expect(out).toEqual([{ id: 'et:B' }]);
  });
});
