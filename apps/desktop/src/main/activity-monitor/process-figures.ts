/**
 * Where a process row's figures come from (the activity monitor plan
 * §7, fork 10). With a process reader, the reader supplies EVERY figure
 * and the start time beside them; the runtime's metrics read supplies
 * the pid and what the runtime calls the process, and nothing else.
 * Without one — a platform whose reader has not landed — the metrics
 * read's own figures stand.
 */

import type { ProcessReader } from '@openheaders/oracle-host-node/process-reader';
import type { ProcessRead } from './process-naming';

/** One process as the runtime's metrics read gives it. */
export interface RuntimeProcessMetric {
  pid: number;
  /** ms since epoch, by the runtime's own record. */
  creationTime: number;
  type: string;
  name: string | undefined;
  serviceName: string | undefined;
  cumulativeCpuSeconds: number | undefined;
  percentCpu: number;
  workingSetBytes: number;
}

export function readProcessFigures(
  metrics: readonly RuntimeProcessMetric[],
  reader: ProcessReader | null,
): ProcessRead[] {
  if (reader === null) {
    return metrics.map((metric) => ({
      pid: metric.pid,
      creationTime: metric.creationTime,
      type: metric.type,
      name: metric.name,
      serviceName: metric.serviceName,
      cumulativeCpuSeconds: metric.cumulativeCpuSeconds,
      percentCpu: metric.percentCpu,
      memoryBytes: metric.workingSetBytes,
    }));
  }

  const reads: ProcessRead[] = [];
  for (const metric of metrics) {
    const record = reader.read(metric.pid);
    // Gone between the two reads: the process has ended, and has no row.
    if (record === null) continue;
    reads.push({
      pid: metric.pid,
      creationTime: record.startedAt,
      type: metric.type,
      name: metric.name,
      serviceName: metric.serviceName,
      cumulativeCpuSeconds: record.cost?.cpuSeconds,
      percentCpu: null,
      memoryBytes: record.cost?.memoryBytes ?? null,
    });
  }
  return reads;
}
