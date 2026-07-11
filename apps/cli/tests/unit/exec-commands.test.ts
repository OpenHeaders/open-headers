/**
 * Execute/diff command table — group/verb lookup, positional/flag →
 * tool-arg mapping, the request/workflow name → uid resolvers, and the
 * in-band failure classification (failed send/run → exit 1 class).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Connection } from '../../src/connection';
import { EXEC_COMMANDS, findExecCommand } from '../../src/exec-commands';
import { EXIT_OPERATION_FAILED, exitCodeFor, OperationFailedError, UsageError } from '../../src/exit-codes';
import { resolveRequestTarget, resolveWorkflowTarget } from '../../src/resolvers';

const CONN: Connection = { daemonUrl: 'http://127.0.0.1:8137', token: 'oh_secret' };

function spec(group: string, verb: string) {
  const match = findExecCommand(group, verb);
  if (!match) throw new Error(`missing exec command: ${group} ${verb}`);
  return match;
}

function listResult(payload: unknown): Response {
  return Response.json({
    jsonrpc: '2.0',
    id: 1,
    result: { content: [{ type: 'text', text: JSON.stringify(payload) }] },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('findExecCommand', () => {
  it('matches the three Phase 3 verbs', () => {
    expect(findExecCommand('request', 'send')?.tool).toBe('requests_send');
    expect(findExecCommand('workflow', 'run')?.tool).toBe('workflows_run');
    expect(findExecCommand('workspace', 'diff')?.tool).toBe('workspaces_diff');
  });

  it('rejects unknown groups and verbs', () => {
    expect(findExecCommand('request', 'list')).toBeUndefined();
    expect(findExecCommand('workspace', 'switch')).toBeUndefined();
    expect(findExecCommand(undefined, undefined)).toBeUndefined();
  });
});

describe('EXEC_COMMANDS table', () => {
  it('maps only onto the shipped execute + diff catalog', () => {
    const allowed = new Set(['requests_send', 'workflows_run', 'workspaces_diff']);
    for (const entry of EXEC_COMMANDS) {
      expect(allowed.has(entry.tool), entry.tool).toBe(true);
    }
    expect(new Set(EXEC_COMMANDS.map((entry) => entry.tool)).size).toBe(EXEC_COMMANDS.length);
  });
});

describe('request send args', () => {
  const send = spec('request', 'send');

  it('maps the target and forwards --env onto environmentId', () => {
    expect(send.buildArgs(['login'], {})).toEqual({ uid: 'login' });
    expect(send.buildArgs(['login'], { env: 'staging' })).toEqual({ uid: 'login', environmentId: 'staging' });
  });

  it('rejects a missing target and extra positionals', () => {
    expect(() => send.buildArgs([], {})).toThrow(UsageError);
    expect(() => send.buildArgs(['a', 'b'], {})).toThrow(UsageError);
  });

  it('classifies sent: false as an operation failure carrying the tool error', () => {
    expect(send.checkFailure?.({ sent: false, error: 'unresolved {{host}}' })).toBe(
      'send failed — unresolved {{host}}',
    );
    expect(send.checkFailure?.({ sent: true })).toBeUndefined();
  });
});

describe('workflow run args', () => {
  const run = spec('workflow', 'run');

  it('maps the target and forwards --env onto environmentId', () => {
    expect(run.buildArgs(['auth'], { env: 'e-1' })).toEqual({ uid: 'auth', environmentId: 'e-1' });
  });

  it('classifies ok: false with step + phase + message', () => {
    expect(run.checkFailure?.({ ok: false, failedStepId: 's-2', failedPhase: 'extract', message: 'no match' })).toBe(
      'run failed at step s-2 (extract): no match',
    );
    expect(run.checkFailure?.({ ok: true })).toBeUndefined();
  });
});

describe('workspace diff args', () => {
  const diff = spec('workspace', 'diff');

  it('treats one positional as other-vs-active and two as base + other', () => {
    expect(diff.buildArgs(['ws-2'], {})).toEqual({ otherWorkspaceId: 'ws-2' });
    expect(diff.buildArgs(['ws-1', 'ws-2'], {})).toEqual({ workspaceId: 'ws-1', otherWorkspaceId: 'ws-2' });
  });

  it('rejects no ids and extra positionals', () => {
    expect(() => diff.buildArgs([], {})).toThrow(UsageError);
    expect(() => diff.buildArgs(['a', 'b', 'c'], {})).toThrow(UsageError);
  });
});

describe('request/workflow name resolvers', () => {
  it('resolves a unique request name to its uid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        listResult({
          requests: [
            { uid: 'q-1', name: 'login' },
            { uid: 'q-2', name: 'ping' },
          ],
        }),
      ),
    );
    expect(await resolveRequestTarget({ uid: 'ping' }, CONN)).toEqual({ uid: 'q-2' });
  });

  it('keeps a workflow uid match verbatim and fails plainly on a miss', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(listResult({ workflows: [{ uid: 'wf-1', name: 'auth' }] }))),
    );
    expect(await resolveWorkflowTarget({ uid: 'wf-1' }, CONN)).toEqual({ uid: 'wf-1' });
    await expect(resolveWorkflowTarget({ uid: 'ghost' }, CONN)).rejects.toThrow(
      "no workflow named 'ghost' — see oh workflow list",
    );
  });
});

describe('OperationFailedError', () => {
  it('classifies as exit 1 and carries optional stdout payload lines', () => {
    const err = new OperationFailedError('send failed — timeout', ['{"sent":false}']);
    expect(exitCodeFor(err)).toBe(EXIT_OPERATION_FAILED);
    expect(err.stdout).toEqual(['{"sent":false}']);
  });
});
