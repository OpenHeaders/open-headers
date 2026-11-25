/**
 * Capture partition registry — the readers of a lifecycle partition and
 * the one view they share. Asserts:
 *   - the first reader opens a partition, later readers join it
 *   - the last reader out closes it; an earlier one leaving does not
 *   - a partition is its lifeline name AND its wire-join mode
 *   - the owner a reader brings runs the partition, with a labelled seam
 *     when any reader offers one
 *   - the partition list keeps its identity until the set changes
 *   - a published view reaches that partition's readers only, and is
 *     gone with the partition
 */

import {
  type CapturePartitionOwner,
  type CapturePartitionView,
  capturePartitionKey,
  createCapturePartitionRegistry,
  type WireJoinSeam,
} from '@openheaders/ui/panel/data/capture-partition-registry';
import { projectPanelData } from '@openheaders/ui/panel/data/panel-data-projection';
import { EMPTY_FIRE_SNAPSHOT } from '@openheaders/ui/panel/data/stores/fire-client-store';
import { EMPTY_PAGE_SNAPSHOT } from '@openheaders/ui/panel/data/stores/page-client-store';
import { describe, expect, it, vi } from 'vitest';

const qualified = (tabId: number): string => `oh-lifecycle:${tabId}@ext-john-doe`;
const Owner: CapturePartitionOwner = () => null;

function makeView(overrides: Partial<CapturePartitionView> = {}): CapturePartitionView {
  return {
    data: projectPanelData({
      lifecycle: { byRequestId: new Map(), ordered: [] },
      page: EMPTY_PAGE_SNAPSHOT,
      fire: EMPTY_FIRE_SNAPSHOT,
    }),
    source: 'heuristic',
    watchRefusedReason: null,
    joinedIds: undefined,
    seenLabels: undefined,
    clearSession: () => {},
    requestResponseBody: () => {},
    ...overrides,
  };
}

describe('capturePartitionKey', () => {
  it('is the lifeline name with the wire-join mode', () => {
    expect(capturePartitionKey({ tabId: 7 })).toBe('off oh-lifecycle:7');
    expect(capturePartitionKey({ tabId: 7, portName: qualified })).toBe('off oh-lifecycle:7@ext-john-doe');
    expect(capturePartitionKey({ tabId: 7, portName: qualified, wireJoin: { mode: 'browser', nodeId: 'n' } })).toBe(
      'browser oh-lifecycle:7@ext-john-doe',
    );
  });

  it('is the same for two encoders that name the same lifeline', () => {
    const other = (tabId: number): string => `oh-lifecycle:${tabId}@ext-john-doe`;
    expect(capturePartitionKey({ tabId: 7, portName: other })).toBe(
      capturePartitionKey({ tabId: 7, portName: qualified }),
    );
  });
});

describe('capture partition registry', () => {
  it('opens a partition with its first reader and shares it with the next', () => {
    const registry = createCapturePartitionRegistry();
    const changed = vi.fn();
    registry.subscribePartitions(changed);

    registry.join({ tabId: 7, portName: qualified }, Owner);
    expect(registry.getPartitions()).toEqual([
      { key: 'off oh-lifecycle:7@ext-john-doe', tabId: 7, portName: qualified, wireJoin: undefined, Owner },
    ]);
    expect(changed).toHaveBeenCalledTimes(1);

    const opened = registry.getPartitions();
    registry.join({ tabId: 7, portName: qualified }, Owner);
    expect(registry.getPartitions()).toBe(opened);
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('keeps the partition until its last reader leaves', () => {
    const registry = createCapturePartitionRegistry();
    const grid = registry.join({ tabId: 7, portName: qualified }, Owner);
    const inspect = registry.join({ tabId: 7, portName: qualified }, Owner);
    const changed = vi.fn();
    registry.subscribePartitions(changed);

    grid.leave();
    expect(registry.getPartitions()).toHaveLength(1);
    expect(changed).not.toHaveBeenCalled();

    inspect.leave();
    expect(registry.getPartitions()).toEqual([]);
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('counts a reader that leaves twice once', () => {
    const registry = createCapturePartitionRegistry();
    const grid = registry.join({ tabId: 7 }, Owner);
    const inspect = registry.join({ tabId: 7 }, Owner);
    grid.leave();
    grid.leave();
    expect(registry.getPartitions()).toHaveLength(1);
    inspect.leave();
    expect(registry.getPartitions()).toEqual([]);
  });

  it('holds two lifelines, and two modes of one lifeline, as separate partitions', () => {
    const registry = createCapturePartitionRegistry();
    registry.join({ tabId: 7, portName: qualified }, Owner);
    registry.join({ tabId: 8, portName: qualified }, Owner);
    registry.join({ tabId: 7, portName: qualified, wireJoin: { mode: 'browser', nodeId: 'ext-john-doe' } }, Owner);
    expect(registry.getPartitions().map((partition) => partition.key)).toEqual([
      'off oh-lifecycle:7@ext-john-doe',
      'off oh-lifecycle:8@ext-john-doe',
      'browser oh-lifecycle:7@ext-john-doe',
    ]);
  });

  it('runs the owner with a labelled seam when any reader offers one', () => {
    const registry = createCapturePartitionRegistry();
    const unlabelled: WireJoinSeam = { mode: 'browser', nodeId: 'ext-john-doe', sourceLabel: null };
    const labelled: WireJoinSeam = { mode: 'browser', nodeId: 'ext-john-doe', sourceLabel: 'Open Headers Playground' };

    const inspect = registry.join({ tabId: 7, portName: qualified, wireJoin: unlabelled }, Owner);
    expect(registry.getPartitions()[0].wireJoin).toBe(unlabelled);

    const grid = registry.join({ tabId: 7, portName: qualified, wireJoin: labelled }, Owner);
    expect(registry.getPartitions()[0].wireJoin).toBe(labelled);

    grid.leave();
    expect(registry.getPartitions()[0].wireJoin).toBe(unlabelled);
    inspect.leave();
  });

  it('follows a reader whose label changes, and ignores an equal seam', () => {
    const registry = createCapturePartitionRegistry();
    const grid = registry.join(
      {
        tabId: 7,
        portName: qualified,
        wireJoin: { mode: 'browser', nodeId: 'ext-john-doe', sourceLabel: 'Loading' },
      },
      Owner,
    );
    const changed = vi.fn();
    registry.subscribePartitions(changed);

    grid.offer({ mode: 'browser', nodeId: 'ext-john-doe', sourceLabel: 'Loading' });
    expect(changed).not.toHaveBeenCalled();

    grid.offer({ mode: 'browser', nodeId: 'ext-john-doe', sourceLabel: 'Open Headers Playground' });
    expect(changed).toHaveBeenCalledTimes(1);
    expect(registry.getPartitions()[0].wireJoin?.sourceLabel).toBe('Open Headers Playground');
  });

  it('ignores an offer from a reader that already left', () => {
    const registry = createCapturePartitionRegistry();
    const gone = registry.join({ tabId: 7, wireJoin: { mode: 'wire' } }, Owner);
    registry.join({ tabId: 7, wireJoin: { mode: 'wire' } }, Owner);
    gone.leave();
    const before = registry.getPartitions();
    gone.offer({ mode: 'wire', sourceLabel: 'late' });
    expect(registry.getPartitions()).toBe(before);
  });

  it('hands a published view to that partition’s readers only', () => {
    const registry = createCapturePartitionRegistry();
    registry.join({ tabId: 7 }, Owner);
    registry.join({ tabId: 8 }, Owner);
    const seven = vi.fn();
    const eight = vi.fn();
    registry.subscribeView('off oh-lifecycle:7', seven);
    registry.subscribeView('off oh-lifecycle:8', eight);
    expect(registry.readView('off oh-lifecycle:7')).toBeNull();

    const view = makeView();
    registry.publish('off oh-lifecycle:7', view);
    expect(registry.readView('off oh-lifecycle:7')).toBe(view);
    expect(seven).toHaveBeenCalledTimes(1);
    expect(eight).not.toHaveBeenCalled();

    registry.publish('off oh-lifecycle:7', view);
    expect(seven).toHaveBeenCalledTimes(1);
  });

  it('drops the view with the partition, and takes none for a partition nobody reads', () => {
    const registry = createCapturePartitionRegistry();
    const reader = registry.join({ tabId: 7 }, Owner);
    registry.publish('off oh-lifecycle:7', makeView());
    const listener = vi.fn();
    const unsubscribe = registry.subscribeView('off oh-lifecycle:7', listener);

    reader.leave();
    expect(registry.readView('off oh-lifecycle:7')).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);

    registry.publish('off oh-lifecycle:7', makeView());
    expect(registry.readView('off oh-lifecycle:7')).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('opens a fresh partition, without the old view, for a reader that comes back', () => {
    const registry = createCapturePartitionRegistry();
    registry.join({ tabId: 7 }, Owner).leave();
    registry.join({ tabId: 7 }, Owner);
    expect(registry.getPartitions()).toHaveLength(1);
    expect(registry.readView('off oh-lifecycle:7')).toBeNull();
  });
});
