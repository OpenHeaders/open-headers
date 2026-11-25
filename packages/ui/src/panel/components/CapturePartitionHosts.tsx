/**
 * CapturePartitionHosts — mounts the owner of every lifecycle partition
 * this window reads, for as long as the partition has a reader.
 *
 * Mounted once, above every capture surface (the dock's traffic list
 * and the editor's inspect tabs sit in different subtrees), so a
 * partition outlives any one of its readers. The owner comes with the
 * partition's first reader, so nothing of the data pipeline is loaded
 * here, and with no partition open this renders nothing.
 */

import { useSyncExternalStore } from 'react';
import { capturePartitions } from '../data/capture-partition-registry';

export function CapturePartitionHosts() {
  const partitions = useSyncExternalStore(capturePartitions.subscribePartitions, capturePartitions.getPartitions);
  return (
    <>
      {partitions.map((partition) => (
        <partition.Owner key={partition.key} partition={partition} />
      ))}
    </>
  );
}
