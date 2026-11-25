/**
 * `useCapturePartition` — read one lifecycle partition as a reader of
 * the window's shared view (`capture-partition-registry.ts`).
 *
 * The surface holds a seat on the partition for as long as it is
 * mounted and re-renders when the shared view changes. It returns
 * `null` until the partition's owner has published a view; a surface
 * that joins a partition another reader already holds gets the view on
 * its first render, with nothing new crossing any wire.
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { CapturePartitionHost } from './capture-partition-host';
import {
  type CapturePartitionSeat,
  type CapturePartitionTarget,
  type CapturePartitionView,
  capturePartitionKey,
  capturePartitions,
} from './capture-partition-registry';

export function useCapturePartition(target: CapturePartitionTarget): CapturePartitionView | null {
  const key = capturePartitionKey(target);
  const targetRef = useRef(target);
  targetRef.current = target;
  const seatRef = useRef<CapturePartitionSeat | null>(null);

  // The seat follows the partition's identity; the seam is offered below.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` IS the partition — a new one is a new seat
  useEffect(() => {
    const seat = capturePartitions.join(targetRef.current, CapturePartitionHost);
    seatRef.current = seat;
    return () => {
      seatRef.current = null;
      seat.leave();
    };
  }, [key]);

  const { wireJoin } = target;
  useEffect(() => {
    seatRef.current?.offer(wireJoin);
  }, [wireJoin]);

  const subscribe = useCallback((listener: () => void) => capturePartitions.subscribeView(key, listener), [key]);
  const read = useCallback(() => capturePartitions.readView(key), [key]);
  return useSyncExternalStore(subscribe, read);
}
