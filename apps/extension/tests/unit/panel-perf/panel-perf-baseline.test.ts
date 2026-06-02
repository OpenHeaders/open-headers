/**
 * Phase-2 profiling gate — drives the replay harness through a real
 * `LifecycleClientStore` + the pure `projectPanelData` projector and
 * records baseline numbers that decide Phases 3 (incremental data) and 4
 * (canvas).
 *
 * Two things are asserted deterministically (no wall-clock thresholds —
 * those would be flaky):
 *   1. **Coalescing.** Under the synchronous scheduler a capture notifies
 *      once per mutating update (the pre-batching regime); under a single
 *      frame it notifies once — that is the Phase-1 win, exactly.
 *   2. **Oracle parity.** Projecting the snapshot once at the end yields
 *      the same row set as the last of N incremental projections — the
 *      property a future incremental path must preserve.
 *
 * Timing is measured and logged (not asserted) so the numbers land in
 * `docs/PANEL_PERF_FOUNDATION_STATUS.md`. The unbatched total is the sum
 * of a projection after every event (today's O(n²)-across-a-capture cost);
 * the batched total is one projection per frame.
 */

import type { FireClientSnapshot } from '@openheaders/ui/panel/data/fire-client-store';
import { LifecycleClientStore } from '@openheaders/ui/panel/data/lifecycle';
import {
  createManualNotifyScheduler,
  createSyncNotifyScheduler,
  setNotifyScheduler,
} from '@openheaders/ui/panel/data/notify-scheduler';
import type { PageClientSnapshot } from '@openheaders/ui/panel/data/page-client-store';
import { projectPanelData } from '@openheaders/ui/panel/data/panel-data-projection';
import { afterEach, describe, expect, it } from 'vitest';

import { synthesizeCapture } from './synthesize-capture';

const EMPTY_PAGE: PageClientSnapshot = { pages: [] };
const EMPTY_FIRE: FireClientSnapshot = { fires: [] };

function projectStore(store: LifecycleClientStore): number {
  return projectPanelData({ lifecycle: store.getSnapshot(), page: EMPTY_PAGE, fire: EMPTY_FIRE }).rows.length;
}

afterEach(() => setNotifyScheduler(null));

describe('panel perf — Phase 1 coalescing baseline', () => {
  it('synchronous: one notify per mutating update; one frame: a single notify', () => {
    const updates = synthesizeCapture(1000);

    // Pre-batching regime — the synchronous scheduler fans out per event.
    setNotifyScheduler(createSyncNotifyScheduler());
    const syncStore = new LifecycleClientStore();
    let syncNotifies = 0;
    syncStore.subscribe(() => syncNotifies++);
    for (const u of updates) syncStore.apply(u);

    // Phase-1 regime — the whole capture lands in one frame.
    const manual = createManualNotifyScheduler();
    setNotifyScheduler(manual);
    const batchedStore = new LifecycleClientStore();
    let batchedNotifies = 0;
    batchedStore.subscribe(() => batchedNotifies++);
    for (const u of updates) batchedStore.apply(u);
    manual.flushNow();

    // The synthesized stream has no noops, so every update mutates.
    expect(syncNotifies).toBe(updates.length);
    expect(batchedNotifies).toBe(1);

    console.log(
      `[panel-perf] coalescing  requests=1000 updates=${updates.length}  ` +
        `notifies sync=${syncNotifies}  batched(1 frame)=${batchedNotifies}`,
    );
  });
});

describe('panel perf — projection cost scaling', () => {
  it('records per-frame full-recompute cost as the capture grows', () => {
    setNotifyScheduler(createManualNotifyScheduler());
    const checkpoints = [100, 250, 500, 1000];
    const rows: string[] = [];

    for (const n of checkpoints) {
      const store = new LifecycleClientStore();
      for (const u of synthesizeCapture(n)) store.apply(u);

      // Warm once, then time a single full projection (one batched frame).
      projectStore(store);
      const t0 = performance.now();
      const rowCount = projectStore(store);
      const ms = performance.now() - t0;
      rows.push(`n=${n} rows=${rowCount} oneFrameMs=${ms.toFixed(3)}`);
    }

    console.log(`[panel-perf] projection scaling  ${rows.join('  |  ')}`);
    expect(rows).toHaveLength(checkpoints.length);
  });
});

describe('panel perf — unbatched vs batched across a capture', () => {
  it('sums per-event recompute cost (pre-Phase-1) against one-per-frame, and proves oracle parity', () => {
    setNotifyScheduler(createManualNotifyScheduler());
    const requestCount = 400;
    const updates = synthesizeCapture(requestCount);

    // Pre-Phase-1: a full projection after every mutating event.
    const unbatchedStore = new LifecycleClientStore();
    let unbatchedRecomputes = 0;
    const tUnbatched0 = performance.now();
    let lastIncrementalRows = 0;
    for (const u of updates) {
      unbatchedStore.apply(u);
      lastIncrementalRows = projectStore(unbatchedStore);
      unbatchedRecomputes++;
    }
    const unbatchedMs = performance.now() - tUnbatched0;

    // Phase-1: apply the whole capture, project once.
    const batchedStore = new LifecycleClientStore();
    for (const u of updates) batchedStore.apply(u);
    const tBatched0 = performance.now();
    const batchedRows = projectStore(batchedStore);
    const batchedMs = performance.now() - tBatched0;

    expect(unbatchedRecomputes).toBe(updates.length);
    // Oracle parity: the final incremental projection equals the single
    // batched projection of the same input.
    expect(lastIncrementalRows).toBe(batchedRows);

    console.log(
      `[panel-perf] capture requests=${requestCount} updates=${updates.length} rows=${batchedRows}  ` +
        `unbatched: ${unbatchedRecomputes} recomputes in ${unbatchedMs.toFixed(1)}ms  ` +
        `batched: 1 recompute in ${batchedMs.toFixed(3)}ms  ` +
        `speedup=${(unbatchedMs / Math.max(batchedMs, 0.001)).toFixed(0)}x`,
    );
  });
});
