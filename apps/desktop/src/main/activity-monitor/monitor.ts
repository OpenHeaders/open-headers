/**
 * The activity monitor on this host: the sampler and the history over
 * it (the activity monitor plan §7, forks 2 and 4).
 *
 * The history's beat is the ONLY background work this tool does, and it
 * is slow: one read every fifteen seconds, viewer or no viewer, kept an
 * hour in memory and gone at quit. It reads through the one sampler
 * (the plan §6, law 3) — a beat and a viewer's ask inside the same
 * second share a read. The fast rate still exists only as the answer to
 * an ask (law 2): nothing here runs FOR a viewer, so nothing is left
 * running by a window that went away.
 */

import {
  ACTIVITY_MONITOR_HISTORY_BEAT_MS,
  type ActivityMonitorCursor,
  type ActivityMonitorSnapshot,
  appendHistoryBeat,
  EMPTY_ACTIVITY_MONITOR_HISTORY,
  endedProcesses,
  historyBeatsSince,
  historyCursor,
  observeHistoryProcesses,
} from '@openheaders/core/activity-monitor';
import type { ActivityMonitorSampler } from './sampler';

export interface ActivityMonitorDeps {
  sampler: ActivityMonitorSampler;
  /** Run `beat` every `everyMs` until the returned stop is called. */
  startBeat(beat: () => void, everyMs: number): () => void;
}

/** The monitor's half of the answer: the processes and their history. The services are read by their own owners at ask time. */
export type ActivityMonitorProcessAnswer = Omit<ActivityMonitorSnapshot, 'services'>;

export interface ActivityMonitor {
  /** A viewer's ask: what runs now, and the history's beats past the cursor the viewer holds. */
  answer(cursor: ActivityMonitorCursor | null): ActivityMonitorProcessAnswer;
  /** Stop the beat. The history goes with the process. */
  dispose(): void;
}

export function createActivityMonitor(deps: ActivityMonitorDeps): ActivityMonitor {
  let history = EMPTY_ACTIVITY_MONITOR_HISTORY;

  const stopBeat = deps.startBeat(() => {
    const sample = deps.sampler.sample();
    history = appendHistoryBeat(history, {
      at: sample.sampledAt,
      processes: sample.processes,
      cpuSeconds: sample.cpuSeconds,
    });
  }, ACTIVITY_MONITOR_HISTORY_BEAT_MS);

  return {
    answer(cursor) {
      const sample = deps.sampler.sample();
      history = observeHistoryProcesses(history, sample.sampledAt, sample.processes);
      return {
        sampledAt: sample.sampledAt,
        logicalCores: sample.logicalCores,
        memoryKind: sample.memoryKind,
        processes: sample.processes,
        history: historyBeatsSince(history, cursor),
        ended: endedProcesses(history),
        cursor: historyCursor(history),
      };
    },
    dispose: stopBeat,
  };
}
