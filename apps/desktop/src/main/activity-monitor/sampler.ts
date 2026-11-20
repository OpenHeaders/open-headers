/**
 * The activity monitor's sampler (the activity monitor plan §6, laws 2
 * and 3): it answers from a read no older than a second and holds no
 * timer of its own — it reads only when it is asked. Every rate is its
 * own delta between two of its reads. It has two callers, a viewer's
 * ask and the history's beat, and they share its ONE read; the history
 * takes its own rates from the counters each read carries.
 *
 * The clock and the read are dependencies: the read is the seam the
 * in-house process reader fills (the plan §7, fork 10), and both make
 * the sampler testable outside the runtime.
 */

import {
  type ActivityMonitorMemoryKind,
  type ActivityMonitorPlatform,
  type ActivityMonitorProcessRow,
  type CpuCounterState,
  foldCpuCounters,
  processIdentity,
} from '@openheaders/core/activity-monitor';
import type { OwnedProcessRead } from './owned-figures';
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
  /** The owners of what the host started itself, each with its subtree's total (the plan §6, law 13). */
  readOwned(): OwnedProcessRead[];
  now(): number;
  platform: ActivityMonitorPlatform;
  logicalCores: number;
  /** Which figure the read's memory is. */
  memoryKind: ActivityMonitorMemoryKind;
}

/** One read of the processes. */
export interface ActivityMonitorProcessSample {
  /** ms since epoch. */
  sampledAt: number;
  platform: ActivityMonitorPlatform;
  logicalCores: number;
  memoryKind: ActivityMonitorMemoryKind;
  processes: ActivityMonitorProcessRow[];
  /**
   * CPU seconds each row has used so far, by identity — the read's own
   * counter, the one rebuilt from the runtime's percent, or an owner's
   * subtree total. A row whose cost could not be read is absent. Never
   * sent to a viewer.
   */
  cpuSeconds: ReadonlyMap<string, number>;
}

export interface ActivityMonitorSampler {
  sample(): ActivityMonitorProcessSample;
}

export function createActivityMonitorSampler(deps: ActivityMonitorSamplerDeps): ActivityMonitorSampler {
  let counters: CpuCounterState | null = null;
  /**
   * The own counters of what runs beneath the owners, kept apart from
   * `counters`: none of them is in a sample's `cpuSeconds`, so none
   * reaches the history — a single descendant is shown live only (the
   * plan §6, law 13).
   */
  let childCounters: CpuCounterState | null = null;
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
      const owned = deps.readOwned();
      const baselineOf = (state: CpuCounterState | null): CpuCounterState | null =>
        state !== null && at - state.at <= BASELINE_MAX_AGE_MS ? state : null;
      const baseline = baselineOf(counters);
      // A process with neither a counter nor a percent has no CPU figure: it stays out of the fold and reads a dash.
      const counted = reads.filter((read) => read.cumulativeCpuSeconds !== undefined || read.percentCpu !== null);
      // An owner's total rides the same fold under the owner's key: a total that fell reads zero, never less.
      const fold = foldCpuCounters(
        baseline,
        [
          ...counted.map((read) => ({
            id: processIdentity(read.pid, read.creationTime),
            cumulativeSeconds: read.cumulativeCpuSeconds,
            percentOfMachine: read.percentCpu ?? 0,
          })),
          ...owned
            .filter((read) => read.cumulativeCpuSeconds !== undefined)
            .map((read) => ({ id: read.id, cumulativeSeconds: read.cumulativeCpuSeconds, percentOfMachine: 0 })),
        ],
        at,
        deps.logicalCores,
      );
      counters = fold.state;

      // What runs beneath an owner takes its rate from its OWN counter, never from a share of the owner's total.
      const childFold = foldCpuCounters(
        baselineOf(childCounters),
        owned
          .flatMap((read) => read.children)
          .filter((child) => child.cumulativeCpuSeconds !== undefined)
          .map((child) => ({
            id: processIdentity(child.pid, child.startedAt),
            cumulativeSeconds: child.cumulativeCpuSeconds,
            percentOfMachine: 0,
          })),
        at,
        deps.logicalCores,
      );
      childCounters = childFold.state;

      latest = {
        sampledAt: at,
        platform: deps.platform,
        logicalCores: deps.logicalCores,
        memoryKind: deps.memoryKind,
        processes: [
          ...reads.map((read) => {
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
          ...owned.map((read) => ({
            id: read.id,
            kind: read.kind,
            ...(read.terminalSessionId === undefined ? {} : { terminalSessionId: read.terminalSessionId }),
            processCount: read.processCount,
            ...(read.children.length === 0
              ? {}
              : {
                  children: read.children.map((child) => ({
                    pid: child.pid,
                    startedAt: child.startedAt,
                    name: child.name,
                    cpuRate: childFold.rates.get(processIdentity(child.pid, child.startedAt)) ?? null,
                    memoryBytes: child.memoryBytes,
                  })),
                }),
            pid: read.pid,
            startedAt: read.startedAt,
            cpuRate: fold.rates.get(read.id) ?? null,
            memoryBytes: read.memoryBytes,
          })),
        ],
        cpuSeconds: fold.state.seconds,
      };
      return latest;
    },
  };
}
