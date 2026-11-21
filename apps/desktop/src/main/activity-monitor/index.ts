/**
 * The desktop's activity monitor — the production binding of the
 * sampler over the runtime's own processes, and of the history's beat
 * (the activity monitor plan
 * §9). This module is the ONE caller of the runtime's metrics read (the
 * plan §6, law 3): its percent is "since the previous call", so a
 * second caller anywhere would corrupt both. Where the host has a
 * process reader, that read names the processes and the reader supplies
 * every figure (the plan §7, fork 10) — and the owners of what the host
 * started itself are read from the registry of roots (law 5).
 */

import * as os from 'node:os';
import { hostProcessRoots } from '@openheaders/oracle-host-node/process-reader';
import { app, BrowserWindow } from 'electron';
import { desktopProcessReader } from '../process-reader';
import { scriptSandboxProcessId } from '../script-sandbox/sandbox-window';
import { type ActivityMonitor, createActivityMonitor } from './monitor';
import { readOwnedFigures } from './owned-figures';
import { type RuntimeProcessMetric, readProcessFigures } from './process-figures';
import type { ProcessOwners } from './process-naming';
import { createActivityMonitorSampler } from './sampler';

const BYTES_PER_KB = 1024;

function readAppMetrics(): RuntimeProcessMetric[] {
  return app.getAppMetrics().map((metric) => ({
    pid: metric.pid,
    creationTime: metric.creationTime,
    type: metric.type,
    name: metric.name,
    serviceName: metric.serviceName,
    cumulativeCpuSeconds: metric.cpu.cumulativeCPUUsage,
    percentCpu: metric.cpu.percentCPUUsage,
    workingSetBytes: metric.memory.workingSetSize * BYTES_PER_KB,
  }));
}

/** Every open window but the script sandbox's is a workbench window. */
function readProcessOwners(): ProcessOwners {
  const scriptSandboxPid = scriptSandboxProcessId();
  const windowPids = new Set<number>();
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    const pid = win.webContents.getOSProcessId();
    if (pid !== 0 && pid !== scriptSandboxPid) windowPids.add(pid);
  }
  return { windowPids, scriptSandboxPid };
}

/**
 * The history's beat starts here, with the engine, and is stopped by
 * the engine's quit teardown. The timer never keeps a quitting app's
 * event loop alive.
 */
export function createDesktopActivityMonitor(): ActivityMonitor {
  const reader = desktopProcessReader();
  return createActivityMonitor({
    sampler: createActivityMonitorSampler({
      readProcesses: () => readProcessFigures(readAppMetrics(), reader),
      readOwners: readProcessOwners,
      readOwned: () => readOwnedFigures(hostProcessRoots.list(), reader),
      now: Date.now,
      logicalCores: os.cpus().length,
      memoryKind: reader?.memoryKind ?? 'working-set',
    }),
    startBeat: (beat, everyMs) => {
      const timer = setInterval(beat, everyMs);
      timer.unref();
      return () => clearInterval(timer);
    },
  });
}
