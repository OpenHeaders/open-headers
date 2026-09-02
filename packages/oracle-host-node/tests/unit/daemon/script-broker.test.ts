/**
 * Node script broker — the composition over the core broker: the
 * active workspace's script packages ride every execute off the sync
 * cache unless the caller injects its own lister. The broker contract
 * itself is pinned in core (`tests/scripts/broker.test.ts`).
 */

import { setHostLogger } from '@openheaders/core/logger';
import type { ScriptExecutionRequest, ScriptExecutionResult } from '@openheaders/core/scripts';
import { describe, expect, it, vi } from 'vitest';

const cachedPackages = vi.fn(() => [{ name: 'cached', source: 'module.exports = { fromCache: true };' }]);

vi.mock('@openheaders/oracle/sync/service', () => ({
  getActiveCacheForRegistration: () => ({ getScriptPackages: cachedPackages }),
}));

import { createScriptBroker, type SandboxTransport } from '../../../src/daemon/script-broker';

setHostLogger({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });

const snapshot = {
  method: 'GET' as const,
  url: 'https://api.openheaders.io/x',
  headers: [],
  params: [],
  body: { type: 'none' as const },
};

function makeRig(listScriptPackages?: () => Array<{ name: string; source: string }>) {
  let upListener: ((message: unknown) => void) | null = null;
  const executes: ScriptExecutionRequest[] = [];
  const transport: SandboxTransport = {
    ensureReady: async () => {},
    post: (message) => {
      if (message.type !== 'script.execute') return;
      executes.push(message.request);
      const result: ScriptExecutionResult = {
        executionId: message.request.executionId,
        succeeded: true,
        assertions: [],
        consoleLog: [],
        durationMs: 1,
      };
      queueMicrotask(() => upListener?.({ type: 'script.result', result }));
    },
    close: () => {},
  };
  const broker = createScriptBroker({
    createTransport: (onUp) => {
      upListener = onUp;
      return transport;
    },
    handleHostRequest: async (request) => ({
      executionId: request.executionId,
      rpcId: request.rpcId,
      ok: true,
      value: null,
    }),
    ...(listScriptPackages !== undefined ? { listScriptPackages } : {}),
  });
  return { broker, executes };
}

describe('createScriptBroker (node)', () => {
  it('reads the active workspace packages off the sync cache by default', async () => {
    const rig = makeRig();
    await rig.broker.runScript({ kind: 'pre-request', source: 'x;', request: snapshot });
    expect(cachedPackages).toHaveBeenCalled();
    expect(rig.executes[0]?.packages).toEqual([{ name: 'cached', source: 'module.exports = { fromCache: true };' }]);
    rig.broker.dispose();
  });

  it('an injected lister replaces the cache read', async () => {
    const rig = makeRig(() => [{ name: 'own', source: 'module.exports = {};' }]);
    await rig.broker.runScript({ kind: 'pre-request', source: 'x;', request: snapshot });
    expect(rig.executes[0]?.packages).toEqual([{ name: 'own', source: 'module.exports = {};' }]);
    rig.broker.dispose();
  });
});
