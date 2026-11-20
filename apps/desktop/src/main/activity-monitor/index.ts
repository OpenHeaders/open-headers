/**
 * The desktop's activity monitor — the production binding of the
 * sampler over the runtime's own processes (the activity monitor plan
 * §9). This module is the ONE caller of the runtime's metrics read (the
 * plan §6, law 3): its percent is "since the previous call", so a
 * second caller anywhere would corrupt both.
 */

import * as os from 'node:os';
import type { ActivityMonitorPlatform } from '@openheaders/core/activity-monitor';
import { app, BrowserWindow } from 'electron';
import { scriptSandboxProcessId } from '../script-sandbox/sandbox-window';
import type { ProcessOwners, ProcessRead } from './process-naming';
import { type ActivityMonitorSampler, createActivityMonitorSampler } from './sampler';

const BYTES_PER_KB = 1024;

function readAppProcesses(): ProcessRead[] {
  return app.getAppMetrics().map((metric) => ({
    pid: metric.pid,
    creationTime: metric.creationTime,
    type: metric.type,
    name: metric.name,
    serviceName: metric.serviceName,
    cumulativeCpuSeconds: metric.cpu.cumulativeCPUUsage,
    percentCpu: metric.cpu.percentCPUUsage,
    memoryBytes: metric.memory.workingSetSize * BYTES_PER_KB,
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

/** "CPU %" has two conventions (the plan §7, fork 8); any platform that is not Windows counts per core. */
export function activityMonitorPlatform(platform: NodeJS.Platform): ActivityMonitorPlatform {
  if (platform === 'win32') return 'win32';
  return platform === 'darwin' ? 'darwin' : 'linux';
}

export function createDesktopActivityMonitor(): ActivityMonitorSampler {
  return createActivityMonitorSampler({
    readProcesses: readAppProcesses,
    readOwners: readProcessOwners,
    now: Date.now,
    platform: activityMonitorPlatform(process.platform),
    logicalCores: os.cpus().length,
  });
}
