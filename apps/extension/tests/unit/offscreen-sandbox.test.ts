/**
 * Drives the sandboxed script runner through its real postMessage
 * protocol — in jsdom `window.parent === window`, so the test plays the
 * offscreen broker: it posts `script.execute`, answers the sandbox's
 * `script.host-request` messages, and resolves on `script.result`.
 */

import type {
  RequestSnapshot,
  ScriptExecutionResult,
  ScriptHostRequest,
  ScriptPackageModule,
} from '@openheaders/core/scripts';
import { describe, expect, it } from 'vitest';
import '@/offscreen/sandbox';

const BASE_REQUEST: RequestSnapshot = {
  method: 'GET',
  url: 'https://api.openheaders.io/v1/ping',
  headers: [],
  params: [],
  body: { type: 'none' },
};

let nextExecution = 0;

function runInSandbox(
  source: string,
  onHostRequest: (req: ScriptHostRequest) => unknown,
  packages?: ScriptPackageModule[],
): Promise<{ result: ScriptExecutionResult; hostRequests: ScriptHostRequest[] }> {
  nextExecution += 1;
  const executionId = `exec-${nextExecution}`;
  const hostRequests: ScriptHostRequest[] = [];
  return new Promise((resolve) => {
    const listener = (ev: MessageEvent) => {
      const data = ev.data as
        | { type: 'script.host-request'; request: ScriptHostRequest }
        | { type: 'script.result'; result: ScriptExecutionResult }
        | undefined;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'script.host-request' && data.request.executionId === executionId) {
        hostRequests.push(data.request);
        window.postMessage(
          {
            type: 'script.host-response',
            response: {
              executionId: data.request.executionId,
              rpcId: data.request.rpcId,
              ok: true,
              value: onHostRequest(data.request),
            },
          },
          '*',
        );
        return;
      }
      if (data.type === 'script.result' && data.result.executionId === executionId) {
        window.removeEventListener('message', listener);
        resolve({ result: data.result, hostRequests });
      }
    };
    window.addEventListener('message', listener);
    window.postMessage(
      {
        type: 'script.execute',
        request: { executionId, kind: 'pre-request', source, request: BASE_REQUEST, packages },
      },
      '*',
    );
  });
}

describe('sandbox request mutations', () => {
  it('reports no mutation when a later call reverts an earlier one', async () => {
    const { result } = await runInSandbox(
      `oh.setHeader('X-Api-Key', 'value');
       oh.removeHeader('X-Api-Key');`,
      () => null,
    );
    expect(result.succeeded).toBe(true);
    expect(result.mutation).toBeUndefined();
  });

  it('keeps the surviving change when only part of a mutation is reverted', async () => {
    const { result } = await runInSandbox(
      `oh.setQueryParam('page', '1');
       oh.setHeader('X-Api-Key', 'value');
       oh.removeHeader('X-Api-Key');`,
      () => null,
    );
    expect(result.succeeded).toBe(true);
    expect(result.mutation?.headers).toBeUndefined();
    expect(result.mutation?.params).toEqual([{ key: 'page', value: '1' }]);
  });
});

describe('sandbox oh.require', () => {
  const UTILS_PACKAGE: ScriptPackageModule = {
    name: 'utils',
    source: `console.log('utils evaluated');
function add(a, b) { return a + b; }
module.exports = { add };`,
  };

  it('loads a package and exposes its module.exports', async () => {
    const { result } = await runInSandbox(
      `const utils = oh.require('utils');
       console.log('sum', utils.add(2, 3));`,
      () => null,
      [UTILS_PACKAGE],
    );
    expect(result.succeeded).toBe(true);
    expect(result.consoleLog.some((e) => e.args.join(' ').includes('sum 5'))).toBe(true);
  });

  it('memoizes the package body within one execution', async () => {
    const { result } = await runInSandbox(
      `oh.require('utils');
       oh.require('utils');`,
      () => null,
      [UTILS_PACKAGE],
    );
    expect(result.succeeded).toBe(true);
    const evaluations = result.consoleLog.filter((e) => e.args.join(' ').includes('utils evaluated'));
    expect(evaluations).toHaveLength(1);
  });

  it('fails with the available package names when the name is unknown', async () => {
    const { result } = await runInSandbox(`oh.require('missing');`, () => null, [UTILS_PACKAGE]);
    expect(result.succeeded).toBe(false);
    expect(result.error?.message).toContain('"missing" not found');
    expect(result.error?.message).toContain('utils');
  });

  it('refuses oh.require inside a package body', async () => {
    const { result } = await runInSandbox(`oh.require('outer');`, () => null, [
      UTILS_PACKAGE,
      { name: 'outer', source: `module.exports = oh.require('utils');` },
    ]);
    expect(result.succeeded).toBe(false);
    expect(result.error?.message).toContain('not available inside packages');
  });

  it('lets package code drive the oh.* mutators against the live draft', async () => {
    const { result } = await runInSandbox(
      `const auth = oh.require('auth');
       auth.sign('token-123');`,
      () => null,
      [
        {
          name: 'auth',
          source: `module.exports = { sign(token) { oh.setHeader('Authorization', 'Bearer ' + token); } };`,
        },
      ],
    );
    expect(result.succeeded).toBe(true);
    expect(result.mutation?.headers).toEqual([{ key: 'Authorization', value: 'Bearer token-123' }]);
  });
});

describe('sandbox oh.sendRequest', () => {
  it('defaults omitted headers / params / body before crossing to the host', async () => {
    const { result, hostRequests } = await runInSandbox(
      `const r = await oh.sendRequest({ url: 'https://api.openheaders.io/v1/items', method: 'GET' });
       console.log('adhoc', r.status);`,
      () => ({
        status: 200,
        statusText: 'OK',
        url: 'https://api.openheaders.io/v1/items',
        headers: [],
        body: '',
        durationMs: 1,
      }),
    );
    expect(result.succeeded).toBe(true);
    expect(result.consoleLog.some((e) => e.args.join(' ').includes('adhoc 200'))).toBe(true);

    const send = hostRequests.find((r) => r.op === 'sendRequest');
    expect(send).toBeDefined();
    if (send?.op !== 'sendRequest') throw new Error('unreachable');
    expect(send.request).toMatchObject({
      method: 'GET',
      url: 'https://api.openheaders.io/v1/items',
      headers: [],
      params: [],
      body: { type: 'none' },
    });
  });

  it('passes explicit headers and body through unchanged', async () => {
    const { hostRequests } = await runInSandbox(
      `await oh.sendRequest({
         url: 'https://api.openheaders.io/v1/items',
         method: 'POST',
         headers: [{ key: 'Content-Type', value: 'application/json' }],
         body: { type: 'json', content: '{"name":"value"}' },
       });`,
      () => ({
        status: 200,
        statusText: 'OK',
        url: 'https://api.openheaders.io/v1/items',
        headers: [],
        body: '',
        durationMs: 1,
      }),
    );
    const send = hostRequests.find((r) => r.op === 'sendRequest');
    if (send?.op !== 'sendRequest') throw new Error('sendRequest host op not captured');
    expect(send.request.headers).toEqual([{ key: 'Content-Type', value: 'application/json' }]);
    expect(send.request.body).toEqual({ type: 'json', content: '{"name":"value"}' });
    expect(send.request.params).toEqual([]);
  });
});
