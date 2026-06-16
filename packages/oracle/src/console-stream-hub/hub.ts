/**
 * `ConsoleStreamHub` — per-tab broadcaster for captured console output.
 *
 * Hub owns an internal `ConsoleStore` (bounded append log); the per-tab sink
 * fanout substrate is delegated to `TabSinkRegistry`. `recordEntry` is the
 * engine input; `attach`/`detach` are the consumer outputs.
 *
 * Console capture is observation-only and append-only — every captured line
 * is a distinct event, so (unlike `RuleFireHub`) there is no dedup, no merge,
 * and no no-op short-circuit: `recordEntry` always appends + broadcasts.
 *
 * `forgetTab(tabId)` drops the tab's log and broadcasts `'tab-cleared'`
 * (mirror of `PageStreamHub` / `RuleFireHub`), driven by `TabLifecycleBus` on
 * tab close.
 *
 * Replay: `attach` delivers `ready` then re-emits the tab's ordered snapshot
 * as `'entry'` updates synchronously. JS single-threaded; `recordEntry`
 * mutates + broadcasts synchronously, so no live update interleaves between
 * snapshot read and replay emit.
 *
 * Failure isolation: the registry catches per-sink `deliverUpdate` throws so
 * one failure does not stop fanout to siblings.
 */

import type { ConsoleEntry, ConsoleStreamUpdate } from '@openheaders/core/console-stream';

import type { TabLifecycleBus } from '../tab-lifecycle-bus';
import { TabSinkRegistry } from '../tab-sink-registry';

import { snapshotToUpdates } from './replay';
import { ConsoleStore } from './store';
import type { AttachmentHandle, Sink } from './types';

export interface ConsoleStreamHubOptions {
  readonly bus?: TabLifecycleBus;
}

export class ConsoleStreamHub {
  private readonly store = new ConsoleStore();
  private readonly registry = new TabSinkRegistry<ConsoleStreamUpdate>('ConsoleStreamHub');
  private readonly unsubscribeBus: (() => void) | null;

  constructor(options: ConsoleStreamHubOptions = {}) {
    this.unsubscribeBus = options.bus
      ? options.bus.subscribe((event) => {
          if (event.kind === 'tab-forgotten') this.forgetTab(event.tabId);
        })
      : null;
  }

  /** Engine input — a captured console entry for the tab. Appends to the
   *  store and broadcasts. No no-op gate: every entry is a distinct event. */
  recordEntry(tabId: number, entry: ConsoleEntry): void {
    this.registry.guardDisposed();
    this.store.append(tabId, entry);
    this.registry.broadcast(tabId, { kind: 'entry', tabId, entry });
  }

  forgetTab(tabId: number): void {
    this.registry.guardDisposed();
    if (!this.store.forgetTab(tabId)) return;
    this.registry.broadcast(tabId, { kind: 'tab-cleared', tabId });
  }

  /** Read-only snapshot — exposed for tests + parity tooling. */
  snapshotTab(tabId: number): readonly ConsoleEntry[] {
    return this.store.snapshotTab(tabId);
  }

  attach(tabId: number, sink: Sink): AttachmentHandle {
    return this.registry.attach(tabId, sink, (s) => {
      s.deliverReady(tabId);
      for (const update of snapshotToUpdates(tabId, this.store.snapshotTab(tabId))) {
        s.deliverUpdate(update);
      }
    });
  }

  dispose(): void {
    this.unsubscribeBus?.();
    this.registry.dispose();
  }
}
