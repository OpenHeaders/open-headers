/**
 * Script chain runners — the per-level `chain` record beside the folded
 * outcome. Pins:
 *   - every level that ran is recorded in execution order with its
 *     level, container uid/name, duration and verdict;
 *   - a failing level's record carries its own unprefixed error while
 *     the folded error keeps the level-labeled message;
 *   - lenient runs record the levels after a failure (they ran),
 *     strict runs stop and list only the levels reached;
 *   - an empty chain records nothing (no outcome at all).
 */

import type { RequestSnapshot, ResponseSnapshot, ScriptExecutionResult } from '@openheaders/core/scripts';
import {
  type ChainScript,
  runPostResponseChain,
  runPreRequestChain,
} from '@openheaders/oracle/live/request-exec/script-chain';
import type { StepScriptRunner } from '@openheaders/oracle/live/request-exec/script-hooks';
import { describe, expect, it } from 'vitest';

const COLLECTION: ChainScript = {
  level: 'collection',
  uid: 'col00001',
  name: 'Payments',
  label: "Collection 'Payments'",
  source: 'collection();',
};
const FOLDER: ChainScript = {
  level: 'folder',
  uid: 'fld00001',
  name: 'Tokens',
  label: "Folder 'Tokens'",
  source: 'folder();',
};
const REQUEST: ChainScript = { level: 'request', uid: 'req00001', name: 'Charge', label: 'Request', source: 'own();' };

const SNAPSHOT: RequestSnapshot = { method: 'GET', url: 'https://api.openheaders.io/v1/ping', headers: [], params: [] };
const RESPONSE: ResponseSnapshot = {
  status: 200,
  statusText: 'OK',
  url: SNAPSHOT.url,
  headers: [],
  body: '{}',
  durationMs: 3,
};

const result = (over: Partial<ScriptExecutionResult> = {}): ScriptExecutionResult => ({
  executionId: 'exec',
  succeeded: true,
  assertions: [],
  consoleLog: [],
  durationMs: 5,
  ...over,
});

/** A runner answering per SOURCE, recording the order it was asked in. */
function runnerBySource(answers: Record<string, ScriptExecutionResult>): { runner: StepScriptRunner; ran: string[] } {
  const ran: string[] = [];
  const runner: StepScriptRunner = async (input) => {
    ran.push(input.source);
    return answers[input.source] ?? result();
  };
  return { runner, ran };
}

describe('runPreRequestChain — the chain record', () => {
  it('records every level that ran in order with level, uid, name, duration and verdict', async () => {
    const { runner } = runnerBySource({
      'collection();': result({ durationMs: 12 }),
      'folder();': result({ durationMs: 3 }),
      'own();': result({ durationMs: 5 }),
    });
    const run = await runPreRequestChain(
      [COLLECTION, FOLDER, REQUEST],
      runner,
      () => SNAPSHOT,
      () => {},
      {
        strict: false,
      },
    );
    expect(run.outcome?.chain).toEqual([
      { level: 'collection', uid: 'col00001', name: 'Payments', durationMs: 12, succeeded: true },
      { level: 'folder', uid: 'fld00001', name: 'Tokens', durationMs: 3, succeeded: true },
      { level: 'request', uid: 'req00001', name: 'Charge', durationMs: 5, succeeded: true },
    ]);
    expect(run.outcome?.durationMs).toBe(20);
  });

  it("a failing level's record carries its own unprefixed error; the fold keeps the labeled message", async () => {
    const { runner, ran } = runnerBySource({
      'folder();': result({ succeeded: false, error: { name: 'TypeError', message: 'boom' } }),
    });
    const run = await runPreRequestChain(
      [COLLECTION, FOLDER, REQUEST],
      runner,
      () => SNAPSHOT,
      () => {},
      {
        strict: false,
      },
    );
    expect(ran).toEqual(['collection();', 'folder();', 'own();']);
    expect(run.outcome?.succeeded).toBe(false);
    expect(run.outcome?.error).toEqual({ name: 'TypeError', message: "Folder 'Tokens': boom" });
    expect(run.failedLabel).toBe("Folder 'Tokens'");
    expect(run.outcome?.chain?.map((s) => [s.level, s.succeeded])).toEqual([
      ['collection', true],
      ['folder', false],
      ['request', true],
    ]);
    expect(run.outcome?.chain?.[1].error).toEqual({ name: 'TypeError', message: 'boom' });
    expect(run.outcome?.chain?.[0].error).toBeUndefined();
  });

  it('a strict run stops at the failure and lists only the levels reached', async () => {
    const { runner, ran } = runnerBySource({
      'folder();': result({ succeeded: false, error: { name: 'Error', message: 'boom' } }),
    });
    const run = await runPreRequestChain(
      [COLLECTION, FOLDER, REQUEST],
      runner,
      () => SNAPSHOT,
      () => {},
      {
        strict: true,
      },
    );
    expect(ran).toEqual(['collection();', 'folder();']);
    expect(run.outcome?.chain?.map((s) => s.level)).toEqual(['collection', 'folder']);
  });

  it('an empty chain records no outcome', async () => {
    const { runner, ran } = runnerBySource({});
    const run = await runPreRequestChain(
      [],
      runner,
      () => SNAPSHOT,
      () => {},
      { strict: false },
    );
    expect(run.outcome).toBeUndefined();
    expect(ran).toEqual([]);
  });
});

describe('runPostResponseChain — the chain record', () => {
  it('records the levels in order; assertions and a failed level ride beside the record', async () => {
    const { runner } = runnerBySource({
      'collection();': result({ durationMs: 7, assertions: [{ name: 'status is 200', passed: true }] }),
      'own();': result({ succeeded: false, durationMs: 2, error: { name: 'Error', message: 'crash' } }),
    });
    const run = await runPostResponseChain([COLLECTION, REQUEST], runner, SNAPSHOT, RESPONSE, { strict: false });
    expect(run.outcome?.assertions).toEqual([{ name: 'status is 200', passed: true }]);
    expect(run.outcome?.chain).toEqual([
      { level: 'collection', uid: 'col00001', name: 'Payments', durationMs: 7, succeeded: true },
      {
        level: 'request',
        uid: 'req00001',
        name: 'Charge',
        durationMs: 2,
        succeeded: false,
        error: { name: 'Error', message: 'crash' },
      },
    ]);
    expect(run.outcome?.error?.message).toBe('Request: crash');
  });

  it('a request-only chain keeps the unprefixed error on both the fold and the record', async () => {
    const { runner } = runnerBySource({
      'own();': result({ succeeded: false, error: { name: 'Error', message: 'crash' } }),
    });
    const run = await runPostResponseChain([REQUEST], runner, SNAPSHOT, RESPONSE, { strict: true });
    expect(run.outcome?.error?.message).toBe('crash');
    expect(run.outcome?.chain?.[0].error?.message).toBe('crash');
  });
});
