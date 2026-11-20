/**
 * The activity monitor's sampler (the activity monitor plan §6, laws 2
 * and 3): it answers a viewer's ask from a read no older than a second
 * and holds no timer of its own — with nobody asking, nothing is read.
 * Every rate is its own delta between two of its reads.
 *
 * The clock and the read are dependencies: the read is the seam the
 * in-house process reader later fills (the plan §7, fork 10), and both
 * make the sampler testable outside the runtime.
 */

import {
  type ActivityMonitorPlatform,
  type ActivityMonitorSnapshot,
  type CpuCounterState,
  foldCpuCounters,
  processIdentity,
} from '@openheaders/core/activity-monitor';
import { nameProcess, type ProcessOwners, type ProcessRead } from './process-naming';

/** Two asks closer than this share one read. */
export const SAMPLE_MAX_AGE_MS = 1_000;

/**
 * A read older than this is no baseline for "now": the first answer
 * after a long quiet reads a dash, not the average since the monitor
 * was last looked at.
 */
export const BASELINE_MAX_AGE_MS = 30_000;

export interface ActivityMonitorSamplerDeps {
  readProcesses(): ProcessRead[];
  readOwners(): ProcessOwners;
  now(): number;
  platform: ActivityMonitorPlatform;
  logicalCores: number;
}

/** The sampler's half of the answer: the processes. The services are read by their own owners at ask time. */
export type ActivityMonitorProcessSample = Omit<ActivityMonitorSnapshot, 'services'>;

export interface ActivityMonitorSampler {
  sample(): ActivityMonitorProcessSample;
}

export function createActivityMonitorSampler(deps: ActivityMonitorSamplerDeps): ActivityMonitorSampler {
  let counters: CpuCounterState | null = null;
  let latest: ActivityMonitorProcessSample | null = null;

  return {
    sample(): ActivityMonitorProcessSample {
      const at = deps.now();
      if (latest !== null) {
        const age = at - latest.sampledAt;
        if (age >= 0 && age < SAMPLE_MAX_AGE_MS) return latest;
      }

      const reads = deps.readProcesses();
      const owners = deps.readOwners();
      const baseline = counters !== null && at - counters.at <= BASELINE_MAX_AGE_MS ? counters : null;
      const fold = foldCpuCounters(
        baseline,
        reads.map((read) => ({
          id: processIdentity(read.pid, read.creationTime),
          cumulativeSeconds: read.cumulativeCpuSeconds,
          percentOfMachine: read.percentCpu,
        })),
        at,
        deps.logicalCores,
      );
      counters = fold.state;

      latest = {
        sampledAt: at,
        platform: deps.platform,
        logicalCores: deps.logicalCores,
        processes: reads.map((read) => {
          const id = processIdentity(read.pid, read.creationTime);
          return {
            id,
            ...nameProcess(read, owners),
            pid: read.pid,
            startedAt: read.creationTime,
            cpuRate: fold.rates.get(id) ?? null,
            memoryBytes: read.memoryBytes,
          };
        }),
        cursor: 0,
      };
      return latest;
    },
  };
}
