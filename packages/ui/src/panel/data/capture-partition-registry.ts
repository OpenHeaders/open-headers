/**
 * Capture partition registry — which lifecycle partitions this window
 * reads, and the one view of each that every reader shares.
 *
 * A capture surface (the traffic list, each inspected request's editor
 * tab) is a READER of its partition, never its owner. The first reader
 * opens the partition, the last one out closes it, and in between every
 * reader sees the same view: one lifeline, one store, one projection,
 * however many surfaces show it. The owner runs the data pipeline and
 * publishes its view here. A reader brings the owner with it when it
 * joins, so this module — and `CapturePartitionHosts`, which mounts the
 * owners above every reader — loads without the pipeline, and a
 * partition opens in the same pass its first reader mounts in.
 *
 * A partition is identified by its lifeline name and its wire-join mode.
 * Readers of one partition may differ only in the label they offer for
 * the wire-seen record (the traffic list knows the tab's title, an
 * inspect tab does not): the owner runs with a labelled seam when any
 * reader offers one.
 */

import { type LifecycleSource, lifecyclePortName } from '@openheaders/core/request-lifecycle';
import type { ComponentType } from 'react';
import type { WatchRefusedReason } from './stores/use-lifecycle-client';
import type { UsePanelDataResult } from './use-panel-data';
import type { WireJoinMode } from './use-wire-join';

/**
 * The host's wire-join binding for one capture surface. `'browser'`
 * joins the watched tab's rows with the local wire partition (`nodeId`
 * + `sourceLabel` feed the historical seen record); `'wire'` annotates
 * the wire partition's rows from that record.
 */
export interface WireJoinSeam {
  readonly mode: Exclude<WireJoinMode, 'off'>;
  readonly nodeId?: string;
  readonly sourceLabel?: string | null;
}

/** What a reader names to read a partition. */
export interface CapturePartitionTarget {
  /** Lifecycle partition — a reserved synthetic tab id, or a real
   *  browser tab id when `portName` addresses a remote engine. */
  readonly tabId: number;
  /** Port-name override; defaults to the local `oh-lifecycle:<tabId>`. */
  readonly portName?: ((tabId: number) => string) | undefined;
  readonly wireJoin?: WireJoinSeam | undefined;
}

/** One open partition, as its owner runs it. */
export interface CapturePartition {
  readonly key: string;
  readonly tabId: number;
  readonly portName: ((tabId: number) => string) | undefined;
  readonly wireJoin: WireJoinSeam | undefined;
  /** The element that owns the partition — mounted once, while it is open. */
  readonly Owner: CapturePartitionOwner;
}

export interface CapturePartitionOwnerProps {
  readonly partition: CapturePartition;
}

export type CapturePartitionOwner = ComponentType<CapturePartitionOwnerProps>;

/** The view of a partition every reader shares. */
export interface CapturePartitionView {
  readonly data: UsePanelDataResult;
  /** Which correlator feeds the partition. */
  readonly source: LifecycleSource;
  /** Why the watch is refused, `null` while it is not. */
  readonly watchRefusedReason: WatchRefusedReason | null;
  /** `'browser'` mode: requestIds carrying a derived wire layer. */
  readonly joinedIds: ReadonlySet<string> | undefined;
  /** `'wire'` mode: wireRequestId → witnessing tab title. */
  readonly seenLabels: ReadonlyMap<string, string | null> | undefined;
  /** Clear the partition — for every reader, and at the engine. */
  clearSession(): void;
  /** Pull one hop's response body; it lands in the shared view. */
  requestResponseBody(requestId: string, hopIndex: number): void;
}

/** A reader's place on a partition. */
export interface CapturePartitionSeat {
  /** The reader's seam changed (a tab's title labels the seen record). */
  offer(wireJoin: WireJoinSeam | undefined): void;
  /** The reader is gone; the last one out closes the partition. */
  leave(): void;
}

export interface CapturePartitionRegistry {
  /** A reader joins; its partition opens with the first one, run by `Owner`. */
  join(target: CapturePartitionTarget, Owner: CapturePartitionOwner): CapturePartitionSeat;
  /** The open partitions — the same array until the set changes. */
  getPartitions(): readonly CapturePartition[];
  subscribePartitions(listener: () => void): () => void;
  /** The owner's word: this is the partition's view now. */
  publish(key: string, view: CapturePartitionView): void;
  /** A partition's view; `null` until its owner has published one. */
  readView(key: string): CapturePartitionView | null;
  subscribeView(key: string, listener: () => void): () => void;
}

export function capturePartitionKey(target: CapturePartitionTarget): string {
  const name = target.portName?.(target.tabId) ?? lifecyclePortName(target.tabId);
  return `${target.wireJoin?.mode ?? 'off'} ${name}`;
}

interface PartitionEntry {
  partition: CapturePartition;
  view: CapturePartitionView | null;
  /** Each reader's seam, in the order the readers joined. */
  readonly readers: Map<CapturePartitionSeat, WireJoinSeam | undefined>;
}

function sameSeam(a: WireJoinSeam | undefined, b: WireJoinSeam | undefined): boolean {
  return a?.mode === b?.mode && a?.nodeId === b?.nodeId && (a?.sourceLabel ?? null) === (b?.sourceLabel ?? null);
}

/** A labelled seam when any reader offers one, else the first reader's. */
function ownerSeam(readers: ReadonlyMap<CapturePartitionSeat, WireJoinSeam | undefined>): WireJoinSeam | undefined {
  let first: WireJoinSeam | undefined;
  for (const seam of readers.values()) {
    if (seam?.sourceLabel != null) return seam;
    first ??= seam;
  }
  return first;
}

export function createCapturePartitionRegistry(): CapturePartitionRegistry {
  const entries = new Map<string, PartitionEntry>();
  const partitionListeners = new Set<() => void>();
  const viewListeners = new Map<string, Set<() => void>>();
  let partitions: readonly CapturePartition[] = [];

  function partitionsChanged(): void {
    partitions = [...entries.values()].map((entry) => entry.partition);
    for (const listener of partitionListeners) listener();
  }

  function viewChanged(key: string): void {
    const listeners = viewListeners.get(key);
    if (listeners === undefined) return;
    for (const listener of listeners) listener();
  }

  /** Re-pick the owner's seam after the readers' seams changed. */
  function settleSeam(entry: PartitionEntry): void {
    const wireJoin = ownerSeam(entry.readers);
    if (sameSeam(wireJoin, entry.partition.wireJoin)) return;
    entry.partition = { ...entry.partition, wireJoin };
    partitionsChanged();
  }

  return {
    join(target, Owner) {
      const key = capturePartitionKey(target);
      const seat: CapturePartitionSeat = {
        offer(wireJoin) {
          const entry = entries.get(key);
          if (entry === undefined || !entry.readers.has(seat)) return;
          entry.readers.set(seat, wireJoin);
          settleSeam(entry);
        },
        leave() {
          const entry = entries.get(key);
          if (entry === undefined || !entry.readers.delete(seat)) return;
          if (entry.readers.size > 0) {
            settleSeam(entry);
            return;
          }
          entries.delete(key);
          partitionsChanged();
          if (entry.view !== null) viewChanged(key);
        },
      };
      const entry = entries.get(key);
      if (entry !== undefined) {
        entry.readers.set(seat, target.wireJoin);
        settleSeam(entry);
        return seat;
      }
      entries.set(key, {
        partition: { key, tabId: target.tabId, portName: target.portName, wireJoin: target.wireJoin, Owner },
        view: null,
        readers: new Map([[seat, target.wireJoin]]),
      });
      partitionsChanged();
      return seat;
    },

    getPartitions: () => partitions,

    subscribePartitions(listener) {
      partitionListeners.add(listener);
      return () => {
        partitionListeners.delete(listener);
      };
    },

    publish(key, view) {
      const entry = entries.get(key);
      // An owner that outlived its last reader has nobody to tell.
      if (entry === undefined || entry.view === view) return;
      entry.view = view;
      viewChanged(key);
    },

    readView: (key) => entries.get(key)?.view ?? null,

    subscribeView(key, listener) {
      let listeners = viewListeners.get(key);
      if (listeners === undefined) {
        listeners = new Set();
        viewListeners.set(key, listeners);
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && viewListeners.get(key) === listeners) viewListeners.delete(key);
      };
    },
  };
}

/** The window's one registry — readers join it, the owners serve it. */
export const capturePartitions: CapturePartitionRegistry = createCapturePartitionRegistry();
