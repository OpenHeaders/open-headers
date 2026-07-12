/**
 * `BrowserTargetAttachController` — the browser-target reconciler (JS
 * contexts Phase B), sibling of `CdpAttachController`:
 *
 *     attachedTargets = { targets whose owner-set ∩ cdp-attached tabs ≠ ∅ }
 *                       ∩ { master switch ON }
 *
 * Coverage:
 *   - origin-match attribution (owner-set from attached tabs' origins);
 *   - master-switch gating both ways;
 *   - owner-set churn on an attached target (navigation in/out, second
 *     owner joining) commits and fans the membership delta;
 *   - detach when the last owner leaves; detach-all on flag OFF;
 *   - desire re-read after the attach await (mid-handshake input loss
 *     leaves the target unattached and uncommitted);
 *   - chrome-initiated detach drops the commitment with no immediate
 *     re-attach; the next epoch re-attaches;
 *   - the low-frequency poll runs only while anything could be desired;
 *   - unchanged attached-tab input short-circuits (no discovery).
 */

import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { BrowserTargetAttachController } from '@/background/correlator-host/browser-target-attach-controller';
import type { BrowserTargetDescriptor } from '@/background/correlator-host/browser-target-source';

const SW = 'SW-TARGET-1';
const SW_URL = 'https://app.openheaders.io/sw.js?v=1';
const TAB = 5;
const OTHER_TAB = 6;

interface FakeSource {
  targets: BrowserTargetDescriptor[];
  discoverServiceWorkers: Mock<() => Promise<BrowserTargetDescriptor[]>>;
  attach: Mock<(targetId: string) => Promise<void>>;
  detach: Mock<(targetId: string) => Promise<void>>;
  onDetach(listener: (targetId: string, reason: string) => void): () => void;
  emitDetach(targetId: string, reason: string): void;
}

function makeSource(): FakeSource {
  const listeners = new Set<(targetId: string, reason: string) => void>();
  const source: FakeSource = {
    targets: [],
    discoverServiceWorkers: vi.fn(() => Promise.resolve([...source.targets])),
    attach: vi.fn(() => Promise.resolve()),
    detach: vi.fn(() => Promise.resolve()),
    onDetach(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emitDetach(targetId, reason) {
      for (const listener of [...listeners]) listener(targetId, reason);
    },
  };
  return source;
}

/** Drain the reconciler's promise chains (discovery epoch + per-target ops). */
async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

describe('BrowserTargetAttachController', () => {
  let source: FakeSource;
  let origins: Map<number, string | null>;
  let controller: BrowserTargetAttachController;
  let ownerChanges: Array<{ targetId: string; added: readonly number[]; removed: readonly number[] }>;

  beforeEach(() => {
    source = makeSource();
    origins = new Map([[TAB, 'https://app.openheaders.io']]);
    controller = new BrowserTargetAttachController({
      source,
      originOf: (tabId) => Promise.resolve(origins.get(tabId) ?? null),
      pollIntervalMs: 1_000,
    });
    ownerChanges = [];
    controller.onOwnersChanged((targetId, added, removed) => ownerChanges.push({ targetId, added, removed }));
    source.targets = [{ targetId: SW, url: SW_URL }];
  });

  afterEach(() => {
    controller.dispose();
    vi.useRealTimers();
  });

  it('attaches a worker whose origin matches an attached tab and commits the owner', async () => {
    controller.setEnabled(true);
    controller.noteAttachedTabs([TAB]);
    await settle();
    expect(source.attach).toHaveBeenCalledWith(SW);
    expect(controller.ownersOf(SW)).toEqual([TAB]);
    expect(ownerChanges).toEqual([{ targetId: SW, added: [TAB], removed: [] }]);
  });

  it('attaches nothing while the master switch is OFF', async () => {
    controller.noteAttachedTabs([TAB]);
    await settle();
    expect(source.discoverServiceWorkers).not.toHaveBeenCalled();
    expect(source.attach).not.toHaveBeenCalled();
  });

  it('attaches nothing for a worker with no owning tab (origin mismatch)', async () => {
    origins.set(TAB, 'https://other.openheaders.io');
    controller.setEnabled(true);
    controller.noteAttachedTabs([TAB]);
    await settle();
    expect(source.attach).not.toHaveBeenCalled();
    expect(controller.ownersOf(SW)).toEqual([]);
  });

  it('fans the membership delta when a second owner joins a live attachment', async () => {
    controller.setEnabled(true);
    controller.noteAttachedTabs([TAB]);
    await settle();
    origins.set(OTHER_TAB, 'https://app.openheaders.io');
    controller.noteAttachedTabs([TAB, OTHER_TAB]);
    await settle();
    expect(source.attach).toHaveBeenCalledTimes(1);
    expect([...controller.ownersOf(SW)].sort()).toEqual([TAB, OTHER_TAB]);
    expect(ownerChanges).toEqual([
      { targetId: SW, added: [TAB], removed: [] },
      { targetId: SW, added: [OTHER_TAB], removed: [] },
    ]);
  });

  it('fans a removal when an owner navigates off the worker origin while others remain', async () => {
    origins.set(OTHER_TAB, 'https://app.openheaders.io');
    controller.setEnabled(true);
    controller.noteAttachedTabs([TAB, OTHER_TAB]);
    await settle();
    origins.set(OTHER_TAB, 'https://other.openheaders.io');
    controller.requestDiscovery();
    await settle();
    expect(controller.ownersOf(SW)).toEqual([TAB]);
    expect(ownerChanges.at(-1)).toEqual({ targetId: SW, added: [], removed: [OTHER_TAB] });
    expect(source.detach).not.toHaveBeenCalled();
  });

  it('detaches when the last owning tab leaves the attached set', async () => {
    controller.setEnabled(true);
    controller.noteAttachedTabs([TAB]);
    await settle();
    controller.noteAttachedTabs([]);
    await settle();
    expect(source.detach).toHaveBeenCalledWith(SW);
    expect(controller.ownersOf(SW)).toEqual([]);
    expect(ownerChanges.at(-1)).toEqual({ targetId: SW, added: [], removed: [TAB] });
  });

  it('detaches everything on flag OFF', async () => {
    controller.setEnabled(true);
    controller.noteAttachedTabs([TAB]);
    await settle();
    controller.setEnabled(false);
    await settle();
    expect(source.detach).toHaveBeenCalledWith(SW);
    expect(controller.ownersOf(SW)).toEqual([]);
  });

  it('re-reads desire after the attach await: inputs lost mid-handshake leave the target off', async () => {
    let releaseAttach = (): void => {};
    source.attach.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releaseAttach = resolve;
        }),
    );
    controller.setEnabled(true);
    controller.noteAttachedTabs([TAB]);
    await settle();
    expect(source.attach).toHaveBeenCalledTimes(1);
    controller.noteAttachedTabs([]);
    await settle();
    releaseAttach();
    await settle();
    expect(source.detach).toHaveBeenCalledWith(SW);
    expect(controller.ownersOf(SW)).toEqual([]);
    expect(ownerChanges).toEqual([]);
  });

  it('drops the commitment on a chrome-initiated detach without re-attaching until the next epoch', async () => {
    controller.setEnabled(true);
    controller.noteAttachedTabs([TAB]);
    await settle();
    source.emitDetach(SW, 'canceled_by_user');
    expect(controller.ownersOf(SW)).toEqual([]);
    expect(ownerChanges.at(-1)).toEqual({ targetId: SW, added: [], removed: [TAB] });
    await settle();
    expect(source.attach).toHaveBeenCalledTimes(1);
    controller.requestDiscovery();
    await settle();
    expect(source.attach).toHaveBeenCalledTimes(2);
  });

  it('polls while enabled with attached tabs and stops when disabled', async () => {
    vi.useFakeTimers();
    controller.setEnabled(true);
    controller.noteAttachedTabs([TAB]);
    await vi.advanceTimersByTimeAsync(3_000);
    const polled = source.discoverServiceWorkers.mock.calls.length;
    expect(polled).toBeGreaterThanOrEqual(3);
    controller.setEnabled(false);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(source.discoverServiceWorkers.mock.calls.length).toBe(polled);
  });

  it('short-circuits an unchanged attached-tab input', async () => {
    controller.setEnabled(true);
    controller.noteAttachedTabs([TAB]);
    await settle();
    const discoveries = source.discoverServiceWorkers.mock.calls.length;
    controller.noteAttachedTabs([TAB]);
    await settle();
    expect(source.discoverServiceWorkers.mock.calls.length).toBe(discoveries);
  });
});
