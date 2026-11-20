/**
 * The pid → name mapping (the activity monitor plan §6, law 1): each
 * process the interface has a name for gets it, and one it has none for
 * goes to `other` under the runtime's own name — never dropped.
 */

import { describe, expect, it } from 'vitest';
import { nameProcess, type ProcessOwners, type ProcessRead } from '@/main/activity-monitor/process-naming';
import { SCRIPT_WORKER_SERVICE_NAME } from '@/main/script-sandbox/worker-service-name';

function makeRead(overrides: Partial<ProcessRead> = {}): ProcessRead {
  return {
    pid: 4312,
    creationTime: 1_763_625_600_000,
    type: 'Utility',
    name: undefined,
    serviceName: undefined,
    cumulativeCpuSeconds: 1,
    percentCpu: 0,
    memoryBytes: 64 * 1024 * 1024,
    ...overrides,
  };
}

const OWNERS: ProcessOwners = { windowPids: new Set([61_007]), scriptSandboxPid: 61_377 };

describe('nameProcess', () => {
  it('names the engine, graphics and the network service by the runtime type', () => {
    expect(nameProcess(makeRead({ type: 'Browser' }), OWNERS)).toEqual({ kind: 'engine' });
    expect(nameProcess(makeRead({ type: 'GPU', serviceName: 'GPU' }), OWNERS)).toEqual({ kind: 'graphics' });
    expect(
      nameProcess(makeRead({ name: 'Network Service', serviceName: 'network.mojom.NetworkService' }), OWNERS),
    ).toEqual({ kind: 'network' });
  });

  it('names the script runtime by the service name its fork was given', () => {
    expect(
      nameProcess(makeRead({ name: SCRIPT_WORKER_SERVICE_NAME, serviceName: 'node.mojom.NodeService' }), OWNERS),
    ).toEqual({ kind: 'script-runtime' });
  });

  it('names a window and the script sandbox by the pid behind their webContents', () => {
    expect(nameProcess(makeRead({ type: 'Tab', pid: 61_007 }), OWNERS)).toEqual({ kind: 'window' });
    expect(nameProcess(makeRead({ type: 'Tab', pid: 61_377 }), OWNERS)).toEqual({ kind: 'script-sandbox' });
  });

  it('sends a process it has no name for to other, by the runtime name', () => {
    expect(nameProcess(makeRead({ name: 'Audio Service', serviceName: 'audio.mojom.AudioService' }), OWNERS)).toEqual({
      kind: 'other',
      runtimeName: 'Audio Service',
    });
    // Another utility fork is not the script runtime.
    expect(nameProcess(makeRead({ name: 'bench-worker', serviceName: 'node.mojom.NodeService' }), OWNERS)).toEqual({
      kind: 'other',
      runtimeName: 'bench-worker',
    });
  });

  it('falls back to the runtime type where a process carries no name — a renderer no window owns', () => {
    expect(nameProcess(makeRead({ type: 'Tab', pid: 61_012 }), OWNERS)).toEqual({ kind: 'other', runtimeName: 'Tab' });
    expect(
      nameProcess(makeRead({ type: 'Tab', pid: 61_377 }), { windowPids: new Set(), scriptSandboxPid: null }),
    ).toEqual({
      kind: 'other',
      runtimeName: 'Tab',
    });
  });
});
