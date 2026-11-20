/**
 * A runtime process → the name the interface knows it by (the activity
 * monitor plan §6, law 1). Windows and the script sandbox are known by
 * the pid behind their webContents, the script runtime by the service
 * name its fork was given, the engine, graphics and the network service
 * by the runtime's own type. Everything else is `other`, carried by the
 * runtime's own name — never dropped, never guessed.
 */

import type { ActivityMonitorProcessKind } from '@openheaders/core/activity-monitor';
import { SCRIPT_WORKER_SERVICE_NAME } from '../script-sandbox/worker-service-name';

const NETWORK_SERVICE_NAME = 'network.mojom.NetworkService';

/** One process as the runtime's metrics read gives it — its figures, and what it calls itself. */
export interface ProcessRead {
  pid: number;
  /** ms since epoch. */
  creationTime: number;
  type: string;
  name: string | undefined;
  /** The runtime's non-localized name for the process. */
  serviceName: string | undefined;
  /** CPU seconds since the process started; absent where the runtime does not report it. */
  cumulativeCpuSeconds: number | undefined;
  /** The runtime's percent since its previous read, as a share of the whole machine. */
  percentCpu: number;
  memoryBytes: number | null;
}

/** Which OS processes the shell knows the owner of. */
export interface ProcessOwners {
  /** The renderer processes of the workbench windows. */
  windowPids: ReadonlySet<number>;
  /** The renderer process of the Safe-mode script sandbox, while one is up. */
  scriptSandboxPid: number | null;
}

export interface ProcessName {
  kind: ActivityMonitorProcessKind;
  /** The runtime's own name — on `other` only. */
  runtimeName?: string;
}

export function nameProcess(read: ProcessRead, owners: ProcessOwners): ProcessName {
  if (read.type === 'Browser') return { kind: 'engine' };
  if (read.type === 'GPU') return { kind: 'graphics' };
  if (read.serviceName === NETWORK_SERVICE_NAME) return { kind: 'network' };
  if (read.name === SCRIPT_WORKER_SERVICE_NAME) return { kind: 'script-runtime' };
  if (owners.windowPids.has(read.pid)) return { kind: 'window' };
  if (read.pid === owners.scriptSandboxPid) return { kind: 'script-sandbox' };
  return { kind: 'other', runtimeName: read.name ?? read.type };
}
