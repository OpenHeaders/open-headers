import { describe, expect, it, vi } from 'vitest';
import type { FetchAdapter } from '../../src/live/chain-runner';
import { runChain } from '../../src/live/chain-runner';
import type { StepResponse } from '../../src/live/extractor';
import type { LiveWorkflow, WorkflowStep } from '../../src/types/live';

function jsonResponse(payload: unknown, headers: Array<{ key: string; value: string }> = []): StepResponse {
  return {
    status: 200,
    statusText: 'OK',
    url: 'https://api.openheaders.io/x',
    headers: [{ key: 'Content-Type', value: 'application/json' }, ...headers],
    body: JSON.stringify(payload),
  };
}

function singleStep(id: string, requestUid: string, captureExtractors: Array<[string, unknown]> = []): WorkflowStep {
  return {
    uid: `stp${id.padEnd(5, 'x').slice(0, 5)}`,
    id,
    requestUid,
    captures: captureExtractors.map(([name, extractor], i) => ({
      uid: `cap${String(i).padEnd(2, '0')}${name.slice(0, 3).padEnd(3, 'x')}`,
      name,
      extractor: extractor as WorkflowStep['captures'][number]['extractor'],
    })),
  };
}

function workflow(steps: WorkflowStep[]): LiveWorkflow {
  return {
    schemaVersion: 5,
    uid: 'wflow001',
    path: 'live-workflows/demo-wflow001',
    name: 'Demo',
    enabled: true,
    refresh: { kind: 'manual' },
    steps,
  };
}

describe('runChain — happy path', () => {
  it('executes a single-step workflow and extracts captures', async () => {
    const wf = workflow([
      singleStep('fetch', 'reqfetch1', [
        ['access_token', { kind: 'json-path', path: '$.access_token' }],
        ['expires_in', { kind: 'json-path', path: '$.expires_in' }],
      ]),
    ]);
    const adapter: FetchAdapter = {
      async executeStep() {
        return jsonResponse({ access_token: 'tk-42', expires_in: 300 });
      },
    };
    const outcome = await runChain({
      workflow: wf,
      adapter,
      context: { workflowUid: wf.uid, workspaceId: 'ws-1', environmentId: null },
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.stepCaptures.get('fetch')?.get('access_token')).toBe('tk-42');
      expect(outcome.stepCaptures.get('fetch')?.get('expires_in')).toBe('300');
    }
  });

  it('executes a 3-step chain and passes captures forward to the adapter', async () => {
    const wf = workflow([
      singleStep('login', 'reqlogin1', [['sessionId', { kind: 'json-path', path: '$.session' }]]),
      singleStep('csrf', 'reqcsrf01', [['token', { kind: 'header', name: 'X-CSRF-Token' }]]),
      singleStep('final', 'reqfinal1', [['access_token', { kind: 'json-path', path: '$.access_token' }]]),
    ]);
    const calls: Array<{ stepId: string; capturesSnapshot: Record<string, Record<string, string>> }> = [];
    const adapter: FetchAdapter = {
      async executeStep(step, stepCaptures) {
        const snap: Record<string, Record<string, string>> = {};
        for (const [sid, caps] of stepCaptures) {
          snap[sid] = {};
          for (const [k, v] of caps) snap[sid][k] = v;
        }
        calls.push({ stepId: step.id, capturesSnapshot: snap });
        if (step.id === 'login') return jsonResponse({ session: 'sid-aaa' });
        if (step.id === 'csrf') return jsonResponse({}, [{ key: 'X-CSRF-Token', value: 'csrf-bbb' }]);
        return jsonResponse({ access_token: 'final-ccc' });
      },
    };
    const outcome = await runChain({
      workflow: wf,
      adapter,
      context: { workflowUid: wf.uid, workspaceId: 'ws-1', environmentId: null },
    });
    expect(outcome.ok).toBe(true);

    // Adapter saw the captures accumulate across steps.
    expect(calls[0].capturesSnapshot).toEqual({});
    expect(calls[1].capturesSnapshot).toEqual({ login: { sessionId: 'sid-aaa' } });
    expect(calls[2].capturesSnapshot).toEqual({
      login: { sessionId: 'sid-aaa' },
      csrf: { token: 'csrf-bbb' },
    });

    if (outcome.ok) {
      expect(outcome.stepCaptures.get('final')?.get('access_token')).toBe('final-ccc');
      expect(outcome.stepCaptures.size).toBe(3);
    }
  });

  it('records per-step response byte counts', async () => {
    const wf = workflow([singleStep('only', 'reqonly01', [['v', { kind: 'whole-body' }]])]);
    const adapter: FetchAdapter = {
      async executeStep() {
        return { status: 200, statusText: 'OK', url: '', headers: [], body: 'abc' };
      },
    };
    const outcome = await runChain({
      workflow: wf,
      adapter,
      context: { workflowUid: wf.uid, workspaceId: 'ws', environmentId: null },
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.stepResponseBytes.get('only')).toBe(3);
  });

  it('uses the injected clock for completedAt', async () => {
    const wf = workflow([singleStep('only', 'reqonly01', [])]);
    const adapter: FetchAdapter = {
      async executeStep() {
        return jsonResponse({});
      },
    };
    const outcome = await runChain({
      workflow: wf,
      adapter,
      context: { workflowUid: wf.uid, workspaceId: 'ws', environmentId: null },
      now: () => 42_000,
    });
    if (outcome.ok) expect(outcome.completedAt).toBe(42_000);
  });
});

describe('runChain — failure semantics (atomic)', () => {
  it('returns fetch failure when an adapter throws', async () => {
    const wf = workflow([singleStep('first', 'reqfirst1', [])]);
    const adapter: FetchAdapter = {
      async executeStep() {
        throw new Error('DNS broke');
      },
    };
    const outcome = await runChain({
      workflow: wf,
      adapter,
      context: { workflowUid: wf.uid, workspaceId: 'ws', environmentId: null },
    });
    expect(outcome).toMatchObject({ ok: false, failedStepId: 'first', failedPhase: 'fetch' });
    if (!outcome.ok) expect(outcome.failedReason).toContain('DNS broke');
  });

  it('halts the chain when any extractor fails — later steps never run', async () => {
    const wf = workflow([
      singleStep('first', 'reqfirst1', [['v', { kind: 'json-path', path: '$.missing' }]]),
      singleStep('second', 'reqsecnd1', []),
    ]);
    const executeStep = vi.fn(async () => jsonResponse({ other: 'x' }));
    const adapter: FetchAdapter = { executeStep };
    const outcome = await runChain({
      workflow: wf,
      adapter,
      context: { workflowUid: wf.uid, workspaceId: 'ws', environmentId: null },
    });
    expect(outcome).toMatchObject({ ok: false, failedStepId: 'first', failedPhase: 'extract' });
    // The second step's executeStep was never called — atomic semantics.
    expect(executeStep).toHaveBeenCalledTimes(1);
  });

  it('reports partial captures from successful earlier steps on failure', async () => {
    const wf = workflow([
      singleStep('first', 'reqfirst1', [['ok', { kind: 'json-path', path: '$.ok' }]]),
      singleStep('second', 'reqsecnd1', [['bad', { kind: 'json-path', path: '$.missing' }]]),
    ]);
    const adapter: FetchAdapter = {
      async executeStep(step) {
        if (step.id === 'first') return jsonResponse({ ok: 'yes' });
        return jsonResponse({ other: 'no' });
      },
    };
    const outcome = await runChain({
      workflow: wf,
      adapter,
      context: { workflowUid: wf.uid, workspaceId: 'ws', environmentId: null },
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.partialStepCaptures.get('first')?.get('ok')).toBe('yes');
      expect(outcome.partialStepCaptures.has('second')).toBe(false);
    }
  });

  it('surfaces extractor failure detail (kind + message) on extract phase', async () => {
    const wf = workflow([singleStep('first', 'reqfirst1', [['bad', { kind: 'json-path', path: '$.missing' }]])]);
    const adapter: FetchAdapter = {
      async executeStep() {
        return jsonResponse({ other: 'x' });
      },
    };
    const outcome = await runChain({
      workflow: wf,
      adapter,
      context: { workflowUid: wf.uid, workspaceId: 'ws', environmentId: null },
    });
    if (!outcome.ok) {
      expect(outcome.extractorFailure?.kind).toBe('no-match');
      expect(outcome.extractorFailure?.captureName).toBe('bad');
    }
  });
});

// ── Phase I — DAG execution ──────────────────────────────────────

function dagStep(
  id: string,
  opts: {
    requestUid?: string;
    captures?: Array<[string, unknown]>;
    dependsOn?: string[];
    runIf?: WorkflowStep['runIf'];
    priorityFrom?: WorkflowStep['priorityFrom'];
  } = {},
): WorkflowStep {
  return {
    uid: `stp${id.padEnd(5, 'x').slice(0, 5)}`,
    id,
    requestUid: opts.requestUid ?? `req${id.slice(0, 5).padEnd(5, 'x')}`,
    captures: (opts.captures ?? []).map(([name, extractor], i) => ({
      uid: `cap${String(i).padEnd(2, '0')}${name.slice(0, 3).padEnd(3, 'x')}`,
      name,
      extractor: extractor as WorkflowStep['captures'][number]['extractor'],
    })),
    dependsOn: opts.dependsOn,
    runIf: opts.runIf,
    priorityFrom: opts.priorityFrom,
  };
}

describe('runChain — DAG (Phase I)', () => {
  it('linear chain with explicit dependsOn matches implicit-prior-dep behavior', async () => {
    const wf = workflow([
      dagStep('a', { captures: [['v', { kind: 'json-path', path: '$.x' }]] }),
      dagStep('b', { dependsOn: ['a'], captures: [['v', { kind: 'json-path', path: '$.x' }]] }),
      dagStep('c', { dependsOn: ['b'], captures: [['v', { kind: 'json-path', path: '$.x' }]] }),
    ]);
    const order: string[] = [];
    const adapter: FetchAdapter = {
      async executeStep(step) {
        order.push(step.id);
        return jsonResponse({ x: step.id });
      },
    };
    const outcome = await runChain({
      workflow: wf,
      adapter,
      context: { workflowUid: wf.uid, workspaceId: 'ws', environmentId: null },
    });
    expect(outcome.ok).toBe(true);
    expect(order).toEqual(['a', 'b', 'c']);
    if (outcome.ok) {
      expect(outcome.skippedStepIds).toEqual([]);
      expect(outcome.stepCaptures.size).toBe(3);
    }
  });

  it('branching — only the gate-passing sibling runs', async () => {
    const wf = workflow([
      dagStep('probe', { captures: [['flag', { kind: 'json-path', path: '$.flag' }]] }),
      dagStep('pathA', {
        dependsOn: ['probe'],
        runIf: {
          all: [{ uid: 'gat0eqa1', kind: 'capture-equals', stepId: 'probe', captureName: 'flag', value: 'a' }],
        },
        captures: [['result', { kind: 'whole-body' }]],
      }),
      dagStep('pathB', {
        dependsOn: ['probe'],
        runIf: {
          all: [{ uid: 'gat0eqb1', kind: 'capture-equals', stepId: 'probe', captureName: 'flag', value: 'b' }],
        },
        captures: [['result', { kind: 'whole-body' }]],
      }),
    ]);
    const executed: string[] = [];
    const adapter: FetchAdapter = {
      async executeStep(step) {
        executed.push(step.id);
        if (step.id === 'probe') return jsonResponse({ flag: 'a' });
        return jsonResponse({});
      },
    };
    const outcome = await runChain({
      workflow: wf,
      adapter,
      context: { workflowUid: wf.uid, workspaceId: 'ws', environmentId: null },
    });
    expect(outcome.ok).toBe(true);
    expect(executed).toEqual(['probe', 'pathA']);
    if (outcome.ok) {
      expect(outcome.skippedStepIds).toEqual(['pathB']);
      expect(outcome.stepCaptures.has('pathA')).toBe(true);
      expect(outcome.stepCaptures.has('pathB')).toBe(false);
    }
  });

  it('status-gate — pathA runs on 2xx, pathB runs on 5xx', async () => {
    const wf = workflow([
      dagStep('probe', { captures: [['status', { kind: 'status-code' }]] }),
      dagStep('pathOk', {
        dependsOn: ['probe'],
        runIf: { all: [{ uid: 'gat0sta1', kind: 'status', stepId: 'probe', match: '2xx' }] },
      }),
      dagStep('pathErr', {
        dependsOn: ['probe'],
        runIf: { all: [{ uid: 'gat0sta2', kind: 'status', stepId: 'probe', match: '5xx' }] },
      }),
    ]);
    const executed: string[] = [];
    const adapter: FetchAdapter = {
      async executeStep(step) {
        executed.push(step.id);
        return jsonResponse({});
      },
    };
    const outcome = await runChain({
      workflow: wf,
      adapter,
      context: { workflowUid: wf.uid, workspaceId: 'ws', environmentId: null },
    });
    expect(outcome.ok).toBe(true);
    expect(executed).toEqual(['probe', 'pathOk']);
    if (outcome.ok) expect(outcome.skippedStepIds).toEqual(['pathErr']);
  });

  it('priorityFrom reorders ready-set (lower value runs first)', async () => {
    const wf = workflow([
      dagStep('manifest', {
        captures: [
          ['pa', { kind: 'json-path', path: '$.pa' }],
          ['pb', { kind: 'json-path', path: '$.pb' }],
        ],
      }),
      // Declared order [a, b] — priorities 5 vs 1 force b-first.
      dagStep('a', {
        dependsOn: ['manifest'],
        priorityFrom: { stepId: 'manifest', captureName: 'pa', sort: 'numeric' },
      }),
      dagStep('b', {
        dependsOn: ['manifest'],
        priorityFrom: { stepId: 'manifest', captureName: 'pb', sort: 'numeric' },
      }),
    ]);
    const order: string[] = [];
    const adapter: FetchAdapter = {
      async executeStep(step) {
        order.push(step.id);
        if (step.id === 'manifest') return jsonResponse({ pa: 5, pb: 1 });
        return jsonResponse({});
      },
    };
    const outcome = await runChain({
      workflow: wf,
      adapter,
      context: { workflowUid: wf.uid, workspaceId: 'ws', environmentId: null },
    });
    expect(outcome.ok).toBe(true);
    expect(order).toEqual(['manifest', 'b', 'a']);
  });

  it('fan-in — descendant runs after both parents complete', async () => {
    const wf = workflow([
      dagStep('p1', { dependsOn: [], captures: [['v', { kind: 'whole-body' }]] }),
      dagStep('p2', { dependsOn: [], captures: [['v', { kind: 'whole-body' }]] }),
      dagStep('child', { dependsOn: ['p1', 'p2'], captures: [['v', { kind: 'whole-body' }]] }),
    ]);
    const order: string[] = [];
    const adapter: FetchAdapter = {
      async executeStep(step) {
        order.push(step.id);
        return { status: 200, statusText: 'OK', url: '', headers: [], body: step.id };
      },
    };
    const outcome = await runChain({
      workflow: wf,
      adapter,
      context: { workflowUid: wf.uid, workspaceId: 'ws', environmentId: null },
    });
    expect(outcome.ok).toBe(true);
    expect(order.indexOf('child')).toBe(2); // child last
    expect(order.indexOf('p1')).toBeLessThan(order.indexOf('child'));
    expect(order.indexOf('p2')).toBeLessThan(order.indexOf('child'));
  });

  it('skip cascade — descendant gated on skipped ancestor capture skips too', async () => {
    const wf = workflow([
      dagStep('probe', { captures: [['flag', { kind: 'json-path', path: '$.flag' }]] }),
      dagStep('middle', {
        dependsOn: ['probe'],
        runIf: {
          all: [{ uid: 'gat0eqa2', kind: 'capture-equals', stepId: 'probe', captureName: 'flag', value: 'a' }],
        },
        captures: [['v', { kind: 'whole-body' }]],
      }),
      dagStep('tail', {
        dependsOn: ['middle'],
        runIf: { all: [{ uid: 'gat0exv1', kind: 'capture-exists', stepId: 'middle', captureName: 'v' }] },
      }),
    ]);
    const executed: string[] = [];
    const adapter: FetchAdapter = {
      async executeStep(step) {
        executed.push(step.id);
        return jsonResponse({ flag: 'not-a' });
      },
    };
    const outcome = await runChain({
      workflow: wf,
      adapter,
      context: { workflowUid: wf.uid, workspaceId: 'ws', environmentId: null },
    });
    expect(outcome.ok).toBe(true);
    expect(executed).toEqual(['probe']);
    if (outcome.ok) expect(outcome.skippedStepIds).toEqual(['middle', 'tail']);
  });

  it('success outcome records one attempt per step without a retry policy', async () => {
    const wf = workflow([singleStep('only', 'reqonly01', [])]);
    const adapter: FetchAdapter = {
      async executeStep() {
        return jsonResponse({});
      },
    };
    const outcome = await runChain({
      workflow: wf,
      adapter,
      context: { workflowUid: wf.uid, workspaceId: 'ws', environmentId: null },
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.stepAttempts.get('only')).toBe(1);
  });

  it('atomic abort — late-step failure reports zero captures from this run', async () => {
    const wf = workflow([
      dagStep('p1', { dependsOn: [], captures: [['v', { kind: 'whole-body' }]] }),
      dagStep('p2', { dependsOn: ['p1'], captures: [['bad', { kind: 'json-path', path: '$.missing' }]] }),
    ]);
    const adapter: FetchAdapter = {
      async executeStep(step) {
        if (step.id === 'p1') return { status: 200, statusText: 'OK', url: '', headers: [], body: 'ok' };
        return jsonResponse({ other: 'x' });
      },
    };
    const outcome = await runChain({
      workflow: wf,
      adapter,
      context: { workflowUid: wf.uid, workspaceId: 'ws', environmentId: null },
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.failedStepId).toBe('p2');
      expect(outcome.failedPhase).toBe('extract');
      // p1 ran and extracted successfully; its captures appear in the
      // partial trail (observability-only — NOT committed to cache).
      expect(outcome.partialStepCaptures.get('p1')?.get('v')).toBe('ok');
    }
  });
});

// ── Retry policy ──────────────────────────────────────────────────

describe('runChain — retry policy', () => {
  const context = { workflowUid: 'wflow001', workspaceId: 'ws', environmentId: null };

  function retryStep(id: string, retry: WorkflowStep['retry'], timeoutMs?: number): WorkflowStep {
    return { ...singleStep(id, `req${id.slice(0, 5).padEnd(6, 'x')}`), retry, timeoutMs };
  }

  it('retries a fetch failure and succeeds on the second attempt', async () => {
    const wf = workflow([retryStep('flaky', { maxAttempts: 3 })]);
    const executeStep = vi
      .fn()
      .mockRejectedValueOnce(new Error('connection reset'))
      .mockResolvedValue(jsonResponse({}));
    const sleep = vi.fn(async () => {});
    const outcome = await runChain({ workflow: wf, adapter: { executeStep }, context, sleep });
    expect(outcome.ok).toBe(true);
    expect(executeStep).toHaveBeenCalledTimes(2);
    if (outcome.ok) expect(outcome.stepAttempts.get('flaky')).toBe(2);
  });

  it('exhausts attempts and reports the attempt count in the failure', async () => {
    const wf = workflow([retryStep('down', { maxAttempts: 3, delayMs: 50 })]);
    const executeStep = vi.fn().mockRejectedValue(new Error('DNS broke'));
    const sleep = vi.fn(async () => {});
    const outcome = await runChain({ workflow: wf, adapter: { executeStep }, context, sleep });
    expect(executeStep).toHaveBeenCalledTimes(3);
    expect(outcome).toMatchObject({ ok: false, failedStepId: 'down', failedPhase: 'fetch', attemptsMade: 3 });
    if (!outcome.ok) expect(outcome.failedReason).toBe('DNS broke (after 3 attempts)');
  });

  it('does not retry without a policy — first fetch failure aborts', async () => {
    const wf = workflow([singleStep('plain', 'reqplain1')]);
    const executeStep = vi.fn().mockRejectedValue(new Error('offline'));
    const sleep = vi.fn(async () => {});
    const outcome = await runChain({ workflow: wf, adapter: { executeStep }, context, sleep });
    expect(executeStep).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    if (!outcome.ok) {
      expect(outcome.failedReason).toBe('offline');
      expect(outcome.attemptsMade).toBe(1);
    }
  });

  it('retryOn 5xx retries a 503 and accepts the recovered 200', async () => {
    const wf = workflow([retryStep('svc', { maxAttempts: 3, retryOn: '5xx' })]);
    const executeStep = vi
      .fn()
      .mockResolvedValueOnce({ status: 503, statusText: 'Service Unavailable', url: '', headers: [], body: '' })
      .mockResolvedValue(jsonResponse({}));
    const sleep = vi.fn(async () => {});
    const outcome = await runChain({ workflow: wf, adapter: { executeStep }, context, sleep });
    expect(outcome.ok).toBe(true);
    expect(executeStep).toHaveBeenCalledTimes(2);
    if (outcome.ok) {
      expect(outcome.stepStatuses.get('svc')).toBe(200);
      expect(outcome.stepAttempts.get('svc')).toBe(2);
    }
  });

  it('retryOn exhaustion accepts the final matching response instead of failing', async () => {
    const wf = workflow([retryStep('svc', { maxAttempts: 2, retryOn: ['eq', 429] })]);
    const executeStep = vi
      .fn()
      .mockResolvedValue({ status: 429, statusText: 'Too Many Requests', url: '', headers: [], body: '' });
    const sleep = vi.fn(async () => {});
    const outcome = await runChain({ workflow: wf, adapter: { executeStep }, context, sleep });
    expect(executeStep).toHaveBeenCalledTimes(2);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.stepStatuses.get('svc')).toBe(429);
  });

  it('retryOn does not retry a non-matching status', async () => {
    const wf = workflow([retryStep('svc', { maxAttempts: 3, retryOn: '5xx' })]);
    const executeStep = vi
      .fn()
      .mockResolvedValue({ status: 404, statusText: 'Not Found', url: '', headers: [], body: '' });
    const sleep = vi.fn(async () => {});
    const outcome = await runChain({ workflow: wf, adapter: { executeStep }, context, sleep });
    expect(executeStep).toHaveBeenCalledTimes(1);
    expect(outcome.ok).toBe(true);
  });

  it('fixed backoff repeats the base delay; default delay is 1000 ms', async () => {
    const wf = workflow([retryStep('down', { maxAttempts: 3 })]);
    const executeStep = vi.fn().mockRejectedValue(new Error('x'));
    const sleep = vi.fn(async (_ms: number) => {});
    await runChain({ workflow: wf, adapter: { executeStep }, context, sleep });
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 1000]);
  });

  it('exponential backoff doubles the base delay per attempt', async () => {
    const wf = workflow([retryStep('down', { maxAttempts: 4, delayMs: 500, backoff: 'exponential' })]);
    const executeStep = vi.fn().mockRejectedValue(new Error('x'));
    const sleep = vi.fn(async (_ms: number) => {});
    await runChain({ workflow: wf, adapter: { executeStep }, context, sleep });
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([500, 1000, 2000]);
  });

  it('zero delay skips the sleep call entirely', async () => {
    const wf = workflow([retryStep('down', { maxAttempts: 2, delayMs: 0 })]);
    const executeStep = vi.fn().mockRejectedValue(new Error('x'));
    const sleep = vi.fn(async () => {});
    await runChain({ workflow: wf, adapter: { executeStep }, context, sleep });
    expect(sleep).not.toHaveBeenCalled();
  });

  it('extract failures never retry', async () => {
    const wf = workflow([
      {
        ...retryStep('svc', { maxAttempts: 3 }),
        captures: [{ uid: 'cap00bad', name: 'bad', extractor: { kind: 'json-path', path: '$.missing' } }],
      },
    ]);
    const executeStep = vi.fn().mockResolvedValue(jsonResponse({ other: 'x' }));
    const sleep = vi.fn(async () => {});
    const outcome = await runChain({ workflow: wf, adapter: { executeStep }, context, sleep });
    expect(executeStep).toHaveBeenCalledTimes(1);
    expect(outcome).toMatchObject({ ok: false, failedPhase: 'extract' });
  });

  it('a retried step failure preserves earlier steps in the partial trail', async () => {
    const wf = workflow([
      dagStep('first', { captures: [['v', { kind: 'whole-body' }]] }),
      { ...dagStep('second', { dependsOn: ['first'] }), retry: { maxAttempts: 2 } },
    ]);
    const executeStep = vi.fn(async (step: WorkflowStep) => {
      if (step.id === 'first') return { status: 200, statusText: 'OK', url: '', headers: [], body: 'ok' };
      throw new Error('down');
    });
    const sleep = vi.fn(async () => {});
    const outcome = await runChain({ workflow: wf, adapter: { executeStep }, context, sleep });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.failedStepId).toBe('second');
      expect(outcome.attemptsMade).toBe(2);
      expect(outcome.partialStepCaptures.get('first')?.get('v')).toBe('ok');
    }
  });
});
