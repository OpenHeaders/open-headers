/**
 * Runner core — the session context: `oh.session` persists across the
 * hook calls of one session and nowhere else, each call still runs in
 * a fresh scope, the object cannot be reassigned, and `endScriptSession`
 * drops it. One-shot executions (no `sessionId`) have no `oh.session`.
 */

import type { RequestSnapshot, ScriptExecutionRequest, ScriptHostRequest } from '@openheaders/core/scripts';
import { endScriptSession, executeScript } from '@openheaders/core/scripts/runner';
import { describe, expect, it } from 'vitest';

const REQUEST: RequestSnapshot = {
  method: 'GET',
  url: 'https://api.openheaders.io/v1/ping',
  headers: [],
  params: [],
  body: { type: 'none' },
};

let executions = 0;

async function run(source: string, sessionId?: string) {
  executions += 1;
  const req: ScriptExecutionRequest = {
    executionId: `exec-${executions}`,
    kind: 'pre-request',
    source,
    request: REQUEST,
    ...(sessionId !== undefined ? { sessionId } : {}),
  };
  return executeScript(req, {
    sendHostRequest: async (request: ScriptHostRequest) => ({
      executionId: request.executionId,
      rpcId: request.rpcId,
      ok: true,
      value: null,
    }),
  });
}

const logged = (result: Awaited<ReturnType<typeof run>>): string[] => result.consoleLog.map((e) => e.args.join(' '));

describe('executeScript — one-shot executions', () => {
  it('exposes no oh.session without a session id', async () => {
    const result = await run(`console.log(typeof oh.session);`);
    expect(result.succeeded).toBe(true);
    expect(logged(result)).toEqual(['undefined']);
  });

  it('runs every execution in a fresh scope', async () => {
    await run(`var marker = 'first';`);
    const result = await run(`console.log(typeof marker);`);
    expect(logged(result)).toEqual(['undefined']);
  });
});

describe('executeScript — session context', () => {
  it('shares oh.session across the hook calls of one session', async () => {
    await run(`oh.session.count = (oh.session.count ?? 0) + 1;`, 'session-a');
    await run(`oh.session.count = (oh.session.count ?? 0) + 1;`, 'session-a');
    const result = await run(`console.log(oh.session.count);`, 'session-a');
    expect(result.succeeded).toBe(true);
    expect(logged(result)).toEqual(['2']);
    endScriptSession('session-a');
  });

  it('keeps sessions apart', async () => {
    await run(`oh.session.token = 'alpha';`, 'session-b');
    const result = await run(`console.log(typeof oh.session.token);`, 'session-c');
    expect(logged(result)).toEqual(['undefined']);
    endScriptSession('session-b');
    endScriptSession('session-c');
  });

  it('keeps each hook call in a fresh scope — only oh.session carries state', async () => {
    await run(`let local = 1; oh.session.seen = true;`, 'session-d');
    const result = await run(`console.log(typeof local, oh.session.seen);`, 'session-d');
    expect(logged(result)).toEqual(['undefined true']);
    endScriptSession('session-d');
  });

  it('refuses to reassign oh.session', async () => {
    const result = await run(`oh.session = { detached: true };`, 'session-e');
    expect(result.succeeded).toBe(false);
    expect(result.error?.name).toBe('TypeError');
    const after = await run(`console.log(typeof oh.session.detached);`, 'session-e');
    expect(logged(after)).toEqual(['undefined']);
    endScriptSession('session-e');
  });

  it('reuses the compiled hook and compiles an edited source afresh', async () => {
    const first = await run(`oh.session.n = (oh.session.n ?? 0) + 1; console.log('v1', oh.session.n);`, 'session-f');
    const second = await run(`oh.session.n = (oh.session.n ?? 0) + 1; console.log('v1', oh.session.n);`, 'session-f');
    const edited = await run(`oh.session.n = (oh.session.n ?? 0) + 10; console.log('v2', oh.session.n);`, 'session-f');
    expect(logged(first)).toEqual(['v1 1']);
    expect(logged(second)).toEqual(['v1 2']);
    expect(logged(edited)).toEqual(['v2 12']);
    endScriptSession('session-f');
  });

  it('folds a syntax error into the failed result without poisoning the session', async () => {
    const broken = await run(`oh.session.x = ;`, 'session-g');
    expect(broken.succeeded).toBe(false);
    expect(broken.error?.name).toBe('SyntaxError');
    const fixed = await run(`oh.session.x = 1; console.log(oh.session.x);`, 'session-g');
    expect(fixed.succeeded).toBe(true);
    expect(logged(fixed)).toEqual(['1']);
    endScriptSession('session-g');
  });

  it('endScriptSession drops the state; the next hook starts clean', async () => {
    await run(`oh.session.count = 5;`, 'session-h');
    endScriptSession('session-h');
    const result = await run(`console.log(typeof oh.session.count);`, 'session-h');
    expect(logged(result)).toEqual(['undefined']);
    endScriptSession('session-h');
    expect(() => endScriptSession('never-ran')).not.toThrow();
  });
});
