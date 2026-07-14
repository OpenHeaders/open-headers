/**
 * Safe-runtime integration — the REAL broker + fork transport + BUILT
 * `dist/script-runner.js`, end to end: a script executes inside a live
 * `--permission` child, its `oh.*` RPCs cross the fork IPC channel to
 * an injected host handler, mutations flush back, and the sandbox
 * actually denies what Safe mode promises to deny (require, fs, child
 * processes). Skips when the runner bundle hasn't been built
 * (`pnpm --filter @openheaders/daemon build` stages it).
 */

import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { setHostLogger } from '@openheaders/core/logger';
import type { ScriptHostRequest } from '@openheaders/core/scripts';
import { createScriptBroker, type ScriptBroker } from '@openheaders/oracle-host-node/daemon';
import { afterAll, describe, expect, it } from 'vitest';
import { createForkTransport } from '../../src/script-sandbox/fork-transport';

setHostLogger({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} });

const RUNNER_PATH = path.resolve(__dirname, '../../dist/script-runner.js');

const snapshot = {
  method: 'GET' as const,
  url: 'https://api.openheaders.io/live',
  headers: [],
  params: [],
  body: { type: 'none' as const },
};

let broker: ScriptBroker | null = null;

function makeBroker(): ScriptBroker {
  broker = createScriptBroker({
    createTransport: createForkTransport(RUNNER_PATH),
    handleHostRequest: async (request: ScriptHostRequest) => ({
      executionId: request.executionId,
      rpcId: request.rpcId,
      ok: true,
      value: request.op === 'variables.get' ? 'live-token' : null,
    }),
    listScriptPackages: () => [],
  });
  return broker;
}

afterAll(() => {
  broker?.dispose();
});

describe.skipIf(!existsSync(RUNNER_PATH))('built script-runner under the real fork', () => {
  it('executes a script with an oh.* round-trip and a mutation flush', async () => {
    const result = await makeBroker().runScript({
      kind: 'pre-request',
      source: `
        const token = await oh.variables.get('apiToken');
        oh.setHeader('Authorization', 'Bearer ' + token);
        await oh.test('token resolved', () => oh.expect(token).toBe('live-token'));
      `,
      request: snapshot,
    });
    expect(result.succeeded).toBe(true);
    expect(result.mutation?.headers).toEqual([{ key: 'Authorization', value: 'Bearer live-token' }]);
    expect(result.assertions).toEqual([expect.objectContaining({ name: 'token resolved', passed: true })]);
  }, 20_000);

  it('denies require, filesystem, and child processes inside the sandbox', async () => {
    const result = await makeBroker().runScript({
      kind: 'pre-request',
      source: `
        const report = {};
        try { require('fs'); report.require = 'ALLOWED'; } catch (e) { report.require = e.name; }
        try { (await import('node:fs')).readFileSync('/etc/hosts'); report.fs = 'ALLOWED'; } catch (e) { report.fs = e.code; }
        try { (await import('node:child_process')).spawnSync('ls'); report.spawn = 'ALLOWED'; } catch (e) { report.spawn = e.code; }
        console.log(JSON.stringify(report));
      `,
      request: snapshot,
    });
    expect(result.succeeded).toBe(true);
    const report = JSON.parse(result.consoleLog[0]?.args[0] ?? '{}') as Record<string, string>;
    expect(report).toEqual({
      require: 'ReferenceError',
      fs: 'ERR_ACCESS_DENIED',
      spawn: 'ERR_ACCESS_DENIED',
    });
  }, 20_000);
});
