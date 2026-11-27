/**
 * Where a workflow's steps were placed on its graph, off the draft: the
 * device's record and its two helpers, the draft and its places as one
 * undo history, and the hook that follows the places onto the device —
 * read once, written at each change, one workflow without dropping
 * another's.
 */

import { type HostStorage, setHostStorage, wsKeys } from '@openheaders/core/storage';
import { readWorkflowNodePlaces, type WorkflowNodePlaces, withWorkflowNodePlaces } from '@openheaders/core/utils';
import { useArrangedDraft } from '@openheaders/ui/workbench/components/live/use-arranged-draft';
import { keepNodePlaces, useKeptNodePlaces } from '@openheaders/ui/workbench/components/live/use-kept-node-places';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function createHostStorageFake(): HostStorage & { map: Map<string, unknown> } {
  const map = new Map<string, unknown>();
  return {
    map,
    get: async (spec) => map.get(spec.key) as never,
    getMany: async (specs) => {
      const out: Record<string, unknown> = {};
      for (const [k, spec] of Object.entries(specs)) out[k] = map.get(spec.key);
      return out as never;
    },
    set: async (spec, value) => {
      map.set(spec.key, value);
    },
    setMany: async (writes) => {
      for (const [spec, value] of writes) map.set(spec.key, value);
    },
    remove: async (specs) => {
      const list = Array.isArray(specs) ? specs : [specs];
      for (const spec of list) map.delete(spec.key);
    },
    getValidated: async () => null,
    getValidatedArray: async () => [],
    subscribe: () => () => undefined,
  };
}

let storage: ReturnType<typeof createHostStorageFake>;
const SLOT = wsKeys('ws-1').workflowNodePlaces;

beforeEach(() => {
  storage = createHostStorageFake();
  setHostStorage(storage);
});

afterEach(cleanup);

interface Draft {
  name: string;
}

const START: Draft = { name: 'Reboot' };
const MOVED: WorkflowNodePlaces = { stepaaaa: { x: 320, y: 176 } };
const MOVED_AGAIN: WorkflowNodePlaces = { stepaaaa: { x: 64, y: 400 } };

describe('the node-places record', () => {
  it('reads a workflow with no entry as the computed layout, and forgets by removing the entry', () => {
    expect(readWorkflowNodePlaces(undefined, 'wf-1')).toBeNull();
    const kept = withWorkflowNodePlaces(undefined, 'wf-1', MOVED);
    expect(readWorkflowNodePlaces(kept, 'wf-1')).toEqual(MOVED);
    expect(readWorkflowNodePlaces(kept, 'wf-2')).toBeNull();
    expect(withWorkflowNodePlaces(kept, 'wf-1', null)).toEqual({});
  });

  it('keeps one workflow’s places beside another’s', () => {
    const both = withWorkflowNodePlaces(withWorkflowNodePlaces(undefined, 'wf-1', MOVED), 'wf-2', MOVED_AGAIN);

    expect(both).toEqual({ 'wf-1': MOVED, 'wf-2': MOVED_AGAIN });
  });

  it('reads what is not a set of places as none, and drops an entry that is no place', () => {
    expect(readWorkflowNodePlaces('places', 'wf-1')).toBeNull();
    expect(readWorkflowNodePlaces({ 'wf-1': [] }, 'wf-1')).toBeNull();
    expect(readWorkflowNodePlaces({ 'wf-1': { stepaaaa: { x: '320', y: 176 } } }, 'wf-1')).toBeNull();
    expect(
      readWorkflowNodePlaces({ 'wf-1': { stepaaaa: { x: 320, y: 176 }, stepbbbb: { x: Number.NaN, y: 0 } } }, 'wf-1'),
    ).toEqual(MOVED);
  });
});

describe('useArrangedDraft', () => {
  it('a move is an entry of the draft’s own history, and leaves the draft the very one it was', () => {
    const { result } = renderHook(() => useArrangedDraft(() => START));
    expect(result.current.places).toBeNull();

    act(() => result.current.move(MOVED));
    expect(result.current.places).toBe(MOVED);
    expect(result.current.draft).toBe(START);
    expect(result.current.history.canUndo).toBe(true);

    act(() => result.current.history.undo());
    expect(result.current.places).toBeNull();
    expect(result.current.draft).toBe(START);

    act(() => result.current.history.redo());
    expect(result.current.places).toBe(MOVED);
  });

  it('edits and moves are taken back in the order they were made, each keeping the other half', () => {
    const { result } = renderHook(() => useArrangedDraft(() => START));
    const renamed: Draft = { name: 'Reboot the device' };

    act(() => result.current.move(MOVED));
    act(() => result.current.edit(renamed));
    act(() => result.current.move(MOVED_AGAIN));
    expect(result.current.draft).toBe(renamed);
    expect(result.current.places).toBe(MOVED_AGAIN);

    act(() => result.current.history.undo());
    expect(result.current.draft).toBe(renamed);
    expect(result.current.places).toBe(MOVED);

    act(() => result.current.history.undo());
    expect(result.current.draft).toBe(START);
    expect(result.current.places).toBe(MOVED);

    act(() => result.current.history.undo());
    expect(result.current.places).toBeNull();
    expect(result.current.history.canUndo).toBe(false);
  });

  it('the places forgotten are an entry too: an undo brings them back', () => {
    const { result } = renderHook(() => useArrangedDraft(() => START));
    act(() => result.current.move(MOVED));

    act(() => result.current.move(null));
    expect(result.current.places).toBeNull();

    act(() => result.current.history.undo());
    expect(result.current.places).toBe(MOVED);
  });

  it('a draft replaced from outside empties the history and keeps the places', () => {
    const { result } = renderHook(() => useArrangedDraft(() => START));
    act(() => result.current.move(MOVED));

    act(() => result.current.replace(() => ({ name: 'theirs' })));

    expect(result.current.draft).toEqual({ name: 'theirs' });
    expect(result.current.places).toBe(MOVED);
    expect(result.current.history.canUndo).toBe(false);
  });

  it('a draft handed back as it was keeps the history', () => {
    const { result } = renderHook(() => useArrangedDraft(() => START));
    act(() => result.current.move(MOVED));

    act(() => result.current.replace((current) => current));

    expect(result.current.history.canUndo).toBe(true);
  });

  it('the places read from the device are where the graph stood before any move here, and no entry', () => {
    const { result } = renderHook(() => useArrangedDraft(() => START));
    act(() => result.current.edit({ name: 'Reboot the device' }));

    act(() => result.current.placesRead(MOVED));
    expect(result.current.places).toBe(MOVED);

    // The one entry is the edit; taken back, the graph still stands as the device kept it.
    act(() => result.current.history.undo());
    expect(result.current.draft).toBe(START);
    expect(result.current.places).toBe(MOVED);
    expect(result.current.history.canUndo).toBe(false);
  });

  it('a node moved before the read came back stays where it was moved to; the undo returns to what was kept', () => {
    const { result } = renderHook(() => useArrangedDraft(() => START));
    act(() => result.current.move(MOVED_AGAIN));

    act(() => result.current.placesRead(MOVED));
    expect(result.current.places).toBe(MOVED_AGAIN);

    act(() => result.current.history.undo());
    expect(result.current.places).toBe(MOVED);
  });
});

describe('useKeptNodePlaces', () => {
  const mount = (workspaceId: string | null, initial: WorkflowNodePlaces | null = null) => {
    const onRead = vi.fn<(kept: WorkflowNodePlaces) => void>();
    const hook = renderHook(({ places }) => useKeptNodePlaces(workspaceId, 'wf-1', places, onRead), {
      initialProps: { places: initial },
    });
    return { ...hook, onRead };
  };

  it('hands over what the device kept for the workflow, once, and writes nothing for it', async () => {
    storage.map.set(SLOT.key, { 'wf-1': MOVED, 'wf-2': MOVED_AGAIN });
    const set = vi.spyOn(storage, 'set');

    const { onRead, rerender } = mount('ws-1');
    await waitFor(() => expect(onRead).toHaveBeenCalledTimes(1));
    expect(onRead).toHaveBeenCalledWith(MOVED);

    // The editor now holds what was read.
    rerender({ places: onRead.mock.calls[0][0] });
    await act(async () => {});
    expect(set).not.toHaveBeenCalled();
  });

  it('hands nothing over where the device kept none', async () => {
    const get = vi.spyOn(storage, 'get');
    const { onRead } = mount('ws-1');

    await waitFor(() => expect(get).toHaveBeenCalled());
    await act(async () => {});
    expect(onRead).not.toHaveBeenCalled();
  });

  it('writes the places as they change, and leaves another workflow’s as they are', async () => {
    storage.map.set(SLOT.key, { 'wf-2': MOVED_AGAIN });
    const get = vi.spyOn(storage, 'get');
    const { rerender } = mount('ws-1');
    await waitFor(() => expect(get).toHaveBeenCalled());
    await act(async () => {});

    rerender({ places: MOVED });
    await waitFor(() => expect(storage.map.get(SLOT.key)).toEqual({ 'wf-1': MOVED, 'wf-2': MOVED_AGAIN }));

    // Forgotten — Auto-arrange, or the undo of a first move.
    rerender({ places: null });
    await waitFor(() => expect(storage.map.get(SLOT.key)).toEqual({ 'wf-2': MOVED_AGAIN }));
  });

  it('a node moved before the read came back is kept, over what the device held', async () => {
    storage.map.set(SLOT.key, { 'wf-1': MOVED });

    const { onRead } = mount('ws-1', MOVED_AGAIN);

    await waitFor(() => expect(storage.map.get(SLOT.key)).toEqual({ 'wf-1': MOVED_AGAIN }));
    expect(onRead).toHaveBeenCalledWith(MOVED);
  });

  it('reads and writes nothing without a scope', async () => {
    const get = vi.spyOn(storage, 'get');
    const { rerender, onRead } = mount(null);

    rerender({ places: MOVED });
    await act(async () => {});

    expect(get).not.toHaveBeenCalled();
    expect(onRead).not.toHaveBeenCalled();
    expect(storage.map.size).toBe(0);
  });
});

describe('keepNodePlaces', () => {
  it('keeps a workflow’s places on the device, as a draft does at its first save', async () => {
    await keepNodePlaces('ws-1', 'wf-new', MOVED);

    expect(storage.map.get(SLOT.key)).toEqual({ 'wf-new': MOVED });
  });
});
