/**
 * The four actions in the pure runner, over a fake session (the workflow
 * runs plan, The model).
 *
 * One workflow throughout — the reboot scenario: listen on the probe
 * session, call the reboot endpoint, expect the device's status within
 * ten seconds of the call starting. The session is a fake behind the
 * port; the clock and every deadline are the test's.
 */

import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import type { FetchAdapter } from '../../src/live/chain-runner';
import { runChain } from '../../src/live/chain-runner';
import type { StepResponse } from '../../src/live/extractor';
import type { StepProduct, WorkflowRunEvent, WorkflowRunFact } from '../../src/live/run-events';
import { runFactOf } from '../../src/live/run-events';
import { createRunProductHold } from '../../src/live/run-products';
import { applyRunFact, runTotals, runVerdict, type WorkflowRunRecord } from '../../src/live/run-record';
import type {
  RunSession,
  SessionHost,
  SessionMessage,
  SessionOpening,
  SessionOpenResult,
  SessionSendResult,
} from '../../src/live/session-port';
import { RUN_WINDOW_MAX_MESSAGES } from '../../src/live/session-window';
import { isKnownStep } from '../../src/live/step-actions';
import { LiveWorkflowSchema } from '../../src/schemas/live';
import type { ChainWorkflow, LiveWorkflow } from '../../src/types/live';

const STATUS_TOPIC = 'devices/dev-1/status';

const LISTEN = {
  uid: 'stplistn',
  id: 'probe',
  action: 'listen',
  sessionRequestUid: 'mqttreq1',
  timeoutMs: 10_000,
  captures: [],
};
const CALL = {
  uid: 'stpcall0',
  id: 'reboot',
  requestUid: 'httpreq1',
  captures: [{ uid: 'capcmd00', name: 'command', extractor: { kind: 'json-path', path: '$.command' } }],
};
const EXPECT = {
  uid: 'stpexpct',
  id: 'status',
  action: 'expect',
  on: 'probe',
  after: 'reboot',
  address: STATUS_TOPIC,
  match: [{ kind: 'equals', uid: 'crtstate', extractor: { kind: 'json-path', path: '$.state' }, value: 'rebooting' }],
  timeoutMs: 10_000,
  captures: [{ uid: 'capstate', name: 'state', extractor: { kind: 'json-path', path: '$.state' } }],
};
const SEND = {
  uid: 'stpsend0',
  id: 'rename',
  action: 'send',
  on: 'probe',
  messageUid: 'msgname1',
  captures: [{ uid: 'capname0', name: 'name', extractor: { kind: 'json-path', path: '$.name' } }],
};

const CONTEXT = { workflowUid: 'wfdevice', workspaceId: 'ws-devices', environmentId: null };

function isChainWorkflow(workflow: LiveWorkflow): workflow is ChainWorkflow {
  return workflow.steps.every(isKnownStep);
}

function scenario(steps: unknown[] = [LISTEN, CALL, EXPECT]): ChainWorkflow {
  const workflow = v.parse(LiveWorkflowSchema, {
    schemaVersion: 5,
    uid: 'wfdevice',
    path: 'live-workflows/reboot-wfdevice',
    name: 'Reboot',
    steps,
    refresh: { kind: 'manual' },
    enabled: true,
    published: true,
  });
  if (!isChainWorkflow(workflow)) throw new Error('the scenario holds a step the runner does not know');
  return workflow;
}

/** A clock that moves only when told, and deadlines that fire only as it passes them. */
function fakeClock() {
  let clock = 1_000;
  let timers: Array<{ at: number; resolve: () => void; signal: AbortSignal }> = [];
  const asked: number[] = [];
  return {
    asked,
    now: () => clock,
    timer: (ms: number, signal: AbortSignal) =>
      new Promise<void>((resolve) => {
        asked.push(ms);
        timers.push({ at: clock + ms, resolve, signal });
      }),
    advance(ms: number): void {
      clock += ms;
      const due = timers.filter((timer) => !timer.signal.aborted && timer.at <= clock);
      timers = timers.filter((timer) => !timer.signal.aborted && timer.at > clock);
      for (const timer of due) timer.resolve();
    },
  };
}

/** Let the run go as far as it can without the test's next move. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

interface FakeSession {
  log: string[];
  /** What `open` answers; a ready session when unset. */
  openResult: SessionOpenResult | null;
  /** What `send` answers; the saved name message as sent when unset. */
  sendResult: SessionSendResult | null;
  endResult: Promise<{ warning?: string }>;
  /** What `open` does before it answers — a session may deliver before it is ready. */
  whileOpening: () => void;
  /** A message at the session's next position; the device's status unless overridden. */
  message(overrides?: Partial<SessionMessage>): SessionMessage;
  /** A message, handed to the run as the session's capture point would. */
  deliver(overrides?: Partial<SessionMessage>): SessionMessage;
  drop(reason: string): void;
  session: RunSession;
  host: SessionHost;
}

function fakeSession(clock: { now: () => number }): FakeSession {
  const log: string[] = [];
  let position = 0;
  let opening: SessionOpening | null = null;
  const message = (overrides: Partial<SessionMessage> = {}): SessionMessage => {
    const address = overrides.address === undefined ? STATUS_TOPIC : overrides.address;
    const made: SessionMessage = {
      position,
      at: clock.now(),
      address,
      body: '{"state":"rebooting","command":"reboot"}',
      fields: address === null ? [] : [{ key: 'topic', value: address }],
      stored: false,
      ...overrides,
    };
    position += 1;
    return made;
  };
  const fake: FakeSession = {
    log,
    openResult: null,
    sendResult: null,
    endResult: Promise.resolve({}),
    whileOpening: () => {},
    message,
    deliver(overrides) {
      const made = message(overrides);
      opening?.onMessage(made);
      return made;
    },
    drop(reason) {
      opening?.onEnded(reason);
    },
    session: {
      position: () => position,
      matchesAddress: (address, landed) => landed.address === address,
      send: async (step) => {
        log.push(`send ${step.messageUid}`);
        return (
          fake.sendResult ?? { ok: true, message: message({ address: 'devices/dev-1/name', body: '{"name":"n-1"}' }) }
        );
      },
      endInput: async () => {
        log.push('end-input');
      },
      end: () => {
        log.push('end');
        return fake.endResult;
      },
    },
    host: {
      open: async (step, opened) => {
        log.push(`open ${step.sessionRequestUid}`);
        opening = opened;
        fake.whileOpening();
        return fake.openResult ?? { ok: true, session: fake.session };
      },
    },
  };
  return fake;
}

function response(body: string, status = 200): StepResponse {
  return { status, statusText: 'OK', url: 'https://api.openheaders.io/devices/dev-1/reboot', headers: [], body };
}

function adapterOf(answer: () => StepResponse | Promise<StepResponse>): FetchAdapter & { sent: number } {
  const adapter = {
    sent: 0,
    executeStep: async () => {
      adapter.sent += 1;
      return answer();
    },
  };
  return adapter;
}

/** Substitutes `{{step.<id>.<name>}}` from the run's captures, as a host's resolver would. */
async function resolveTemplate(
  template: string,
  stepCaptures: ReadonlyMap<string, ReadonlyMap<string, string>>,
): Promise<string> {
  return template.replace(/\{\{step\.([\w-]+)\.([\w-]+)\}\}/g, (_, stepId: string, name: string) => {
    const value = stepCaptures.get(stepId)?.get(name);
    if (value === undefined) throw new Error(`Variable step.${stepId}.${name} is not set.`);
    return value;
  });
}

function rig(steps?: unknown[]) {
  const clock = fakeClock();
  const session = fakeSession(clock);
  const events: WorkflowRunEvent[] = [];
  const adapter = adapterOf(() => response('{"command":"reboot"}'));
  const start = (overrides: Partial<Parameters<typeof runChain>[0]> = {}) =>
    runChain({
      workflow: scenario(steps),
      adapter,
      context: CONTEXT,
      now: clock.now,
      timer: clock.timer,
      sleep: async () => {},
      onEvent: (event) => events.push(event),
      sessions: session.host,
      resolveTemplate,
      ...overrides,
    });
  const lines = (): string[] =>
    events.map((event) => {
      if (event.type === 'step-settle') return `settle ${event.stepId} ${event.settlement.state}`;
      if (event.type === 'begin' || event.type === 'end') return event.type;
      return `${event.type} ${event.stepId}`;
    });
  const settlementOf = (stepId: string) =>
    events.flatMap((event) => (event.type === 'step-settle' && event.stepId === stepId ? [event] : []))[0];
  return { clock, session, events, adapter, start, lines, settlementOf };
}

describe('the reboot scenario', () => {
  it('passes when the status arrives while the call is still out', async () => {
    const { session, adapter, start, lines, events } = rig();
    adapter.executeStep = async () => {
      session.deliver();
      return response('{"command":"reboot"}');
    };
    const outcome = await start();

    expect(outcome.ok).toBe(true);
    expect(lines()).toEqual([
      'begin',
      'step-start probe',
      'settle probe ready',
      'step-start reboot',
      'settle reboot passed',
      'step-start status',
      'settle status matched',
      'end',
    ]);
    expect(outcome.ok && Object.fromEntries(outcome.stepCaptures.get('status') ?? [])).toEqual({ state: 'rebooting' });
    expect(outcome.ok && [...outcome.stepStatuses.keys()]).toEqual(['reboot']);
    expect(session.log).toEqual(['open mqttreq1', 'end']);
    expect(events.at(-1)).toMatchObject({ type: 'end', ok: true, sessions: [{ stepId: 'probe', openForMs: 0 }] });
  });

  it('settles each step with its own facts and hands over what it produced', async () => {
    const { clock, session, adapter, start, settlementOf } = rig();
    adapter.executeStep = async () => {
      clock.advance(300);
      session.deliver({ body: '{"state":"online"}', stored: true });
      session.deliver({ body: '{"state":"updating"}' });
      session.deliver();
      return response('{"command":"reboot"}');
    };
    await start();

    expect(settlementOf('probe')).toMatchObject({ settlement: { state: 'ready', readyMs: 0, captureNames: [] } });
    expect(settlementOf('probe').product).toBeUndefined();
    const matched = settlementOf('status');
    expect(matched.settlement).toEqual({ state: 'matched', afterMs: 300, captureNames: ['state'] });
    expect(matched.product).toMatchObject({
      kind: 'message',
      message: { address: STATUS_TOPIC, body: '{"state":"rebooting","command":"reboot"}' },
      window: [
        { message: { body: '{"state":"online"}' }, outcome: 'stored' },
        { message: { body: '{"state":"updating"}' }, outcome: 'not-matched' },
        { message: { body: '{"state":"rebooting","command":"reboot"}' }, outcome: 'matched' },
      ],
    });
  });

  it('waits for a status that comes after the call', async () => {
    const { session, start, lines } = rig();
    const run = start();
    await settle();
    expect(lines().at(-1)).toBe('step-start status');
    session.deliver();
    expect((await run).ok).toBe(true);
  });
});

describe('an expect’s window', () => {
  it('opens when its trigger starts: a status from between the listen and the call is not in it', async () => {
    const { clock, session, start, settlementOf } = rig([
      LISTEN,
      { ...CALL, uid: 'stpcall1', id: 'warmup', captures: [] },
      CALL,
      { ...EXPECT, dependsOn: ['reboot'] },
    ]);
    let calls = 0;
    const run = start({
      adapter: adapterOf(() => {
        calls += 1;
        if (calls === 1) session.deliver();
        return response('{"command":"reboot"}');
      }),
    });
    await settle();
    clock.advance(10_000);
    const outcome = await run;

    expect(outcome).toMatchObject({
      ok: false,
      failedStepId: 'status',
      failedPhase: 'expect',
      failedReason: `No message on ${STATUS_TOPIC} matched within 10 s of "reboot" starting.`,
    });
    expect(settlementOf('status').settlement).toMatchObject({ state: 'failed', phase: 'expect', timedOut: true });
    expect(settlementOf('status').product).toEqual({ kind: 'message', message: null, window: [] });
  });

  it('opens at a position: a message held for an earlier window is not in a later one', async () => {
    const warmup = { ...CALL, uid: 'stpcall1', id: 'warmup', captures: [] };
    const early = { ...EXPECT, uid: 'stpexpc1', id: 'early', after: 'warmup', captures: [], dependsOn: ['warmup'] };
    const { clock, session, start, lines, settlementOf } = rig([
      LISTEN,
      warmup,
      early,
      { ...CALL, dependsOn: ['early'] },
      { ...EXPECT, dependsOn: ['reboot'] },
    ]);
    let calls = 0;
    const run = start({
      adapter: adapterOf(() => {
        calls += 1;
        if (calls === 1) session.deliver();
        return response('{"command":"reboot"}');
      }),
    });
    await settle();
    clock.advance(10_000);

    expect(await run).toMatchObject({ ok: false, failedStepId: 'status', failedPhase: 'expect' });
    expect(lines()).toContain('settle early matched');
    expect(settlementOf('status').product).toEqual({ kind: 'message', message: null, window: [] });
  });

  it('counts its deadline from the trigger’s start, not from its own', async () => {
    const { clock, start } = rig();
    const run = start({
      adapter: adapterOf(() => {
        clock.advance(4_000);
        return response('{"command":"reboot"}');
      }),
    });
    await settle();
    expect(clock.asked.at(-1)).toBe(6_000);
    clock.advance(6_000);
    expect(await run).toMatchObject({ ok: false, failedPhase: 'expect' });
  });

  it('fails at once when its deadline passed while the trigger was out', async () => {
    const { clock, start } = rig();
    const outcome = await start({
      adapter: adapterOf(() => {
        clock.advance(10_000);
        return response('{"command":"reboot"}');
      }),
    });
    expect(outcome).toMatchObject({ ok: false, failedStepId: 'status', failedPhase: 'expect' });
  });

  it('holds only what lands on its address, and says what arrived there without matching', async () => {
    const { clock, session, start, settlementOf } = rig();
    const run = start({
      adapter: adapterOf(() => {
        session.deliver({ address: 'devices/dev-2/status' });
        session.deliver({ body: '{"state":"updating"}' });
        return response('{"command":"reboot"}');
      }),
    });
    await settle();
    clock.advance(10_000);

    expect(await run).toMatchObject({
      failedReason: `No message on ${STATUS_TOPIC} matched within 10 s of "reboot" starting; 1 arrived and did not match.`,
    });
    expect(settlementOf('status').product).toMatchObject({
      window: [{ message: { body: '{"state":"updating"}' }, outcome: 'not-matched' }],
    });
  });

  it('passes over a stored message unless the step asks for it', async () => {
    const passedOver = rig();
    const waiting = passedOver.start({
      adapter: adapterOf(() => {
        passedOver.session.deliver({ stored: true });
        return response('{"command":"reboot"}');
      }),
    });
    await settle();
    passedOver.clock.advance(10_000);
    expect(await waiting).toMatchObject({ ok: false, failedPhase: 'expect' });

    const asked = rig([LISTEN, CALL, { ...EXPECT, includeStored: true }]);
    const taken = await asked.start({
      adapter: adapterOf(() => {
        asked.session.deliver({ stored: true });
        return response('{"command":"reboot"}');
      }),
    });
    expect(taken.ok).toBe(true);
  });

  it('judges with the trigger’s own capture, resolved when the expect starts', async () => {
    const criterion = { ...EXPECT.match[0], extractor: { kind: 'json-path', path: '$.command' } };
    const byCommand = { ...EXPECT, match: [{ ...criterion, value: '{{step.reboot.command}}' }] };
    const { session, start } = rig([LISTEN, CALL, byCommand]);
    const outcome = await start({
      adapter: adapterOf(() => {
        session.deliver({ body: '{"state":"rebooting","command":"shutdown"}' });
        session.deliver();
        return response('{"command":"reboot"}');
      }),
    });
    expect(outcome.ok).toBe(true);
  });

  it('takes every message of a kind with one stream', async () => {
    const { address: _address, ...oneStream } = EXPECT;
    const { session, start } = rig([LISTEN, CALL, oneStream]);
    const outcome = await start({
      adapter: adapterOf(() => {
        session.deliver({ address: null });
        return response('{"command":"reboot"}');
      }),
    });
    expect(outcome.ok).toBe(true);
  });

  it('is not consumed by a match: a second expect reads the same message', async () => {
    const again = { ...EXPECT, uid: 'stpexpc2', id: 'again', captures: [], dependsOn: ['status'] };
    const { session, start, lines } = rig([LISTEN, CALL, EXPECT, again]);
    const outcome = await start({
      adapter: adapterOf(() => {
        session.deliver();
        return response('{"command":"reboot"}');
      }),
    });
    expect(outcome.ok).toBe(true);
    expect(lines().filter((line) => line.endsWith('matched'))).toEqual([
      'settle status matched',
      'settle again matched',
    ]);
  });

  it('takes the listen itself as its trigger, a message from before the session was ready included', async () => {
    const { session, start } = rig([LISTEN, { ...EXPECT, after: 'probe' }]);
    session.whileOpening = () => {
      session.deliver({ address: 'devices/dev-2/status' });
      session.deliver();
    };
    const outcome = await start();
    expect(outcome.ok).toBe(true);
  });

  it('fails by name when the run has held all it may', async () => {
    const { session, start } = rig();
    const outcome = await start({
      adapter: adapterOf(() => {
        for (let count = 0; count <= RUN_WINDOW_MAX_MESSAGES; count++)
          session.deliver({ body: '{"state":"updating"}' });
        return response('{"command":"reboot"}');
      }),
    });
    expect(outcome).toMatchObject({
      ok: false,
      failedStepId: 'status',
      failedReason: `The run held 10,000 messages before a match on ${STATUS_TOPIC}.`,
    });
  });

  it('fails by name when the session ends while it waits, and after what it already held is read', async () => {
    const { session, start } = rig();
    const run = start();
    await settle();
    session.drop('The connection dropped.');
    expect(await run).toMatchObject({
      ok: false,
      failedPhase: 'expect',
      failedReason: 'The session of "probe" ended before a match: The connection dropped.',
    });

    const held = rig();
    const outcome = await held.start({
      adapter: adapterOf(() => {
        held.session.deliver();
        held.session.drop('The connection dropped.');
        return response('{"command":"reboot"}');
      }),
    });
    expect(outcome.ok).toBe(true);
  });

  it('fails as an extraction when the matched message lacks a capture', async () => {
    const lacking = {
      ...EXPECT,
      captures: [{ ...EXPECT.captures[0], extractor: { kind: 'json-path', path: '$.since' } }],
    };
    const { session, start } = rig([LISTEN, CALL, lacking]);
    const outcome = await start({
      adapter: adapterOf(() => {
        session.deliver();
        return response('{"command":"reboot"}');
      }),
    });
    expect(outcome).toMatchObject({
      ok: false,
      failedStepId: 'status',
      failedPhase: 'extract',
      extractorFailure: { captureName: 'state', kind: 'no-match' },
    });
  });
});

describe('a listen', () => {
  it('fails with the session’s own words when it is refused, and nothing after it runs', async () => {
    const { session, adapter, start, lines } = rig();
    session.openResult = { ok: false, reason: 'The broker refused devices/dev-1/# (code 135).' };
    const outcome = await start();

    expect(outcome).toMatchObject({
      ok: false,
      failedStepId: 'probe',
      failedPhase: 'listen',
      failedReason: 'The broker refused devices/dev-1/# (code 135).',
    });
    expect(adapter.sent).toBe(0);
    expect(lines()).toEqual([
      'begin',
      'step-start probe',
      'settle probe failed',
      'settle reboot not-run',
      'settle status not-run',
      'end',
    ]);
    expect(session.log).toEqual(['open mqttreq1']);
  });

  it('fails at its deadline, tells the session so, and ends one that becomes ready too late', async () => {
    const { clock, session, start, settlementOf } = rig();
    let answer: (result: SessionOpenResult) => void = () => {};
    session.host.open = (step, opened) => {
      session.log.push(`open ${step.sessionRequestUid}`);
      opened.signal.addEventListener('abort', () => session.log.push('aborted'));
      return new Promise<SessionOpenResult>((resolve) => {
        answer = resolve;
      });
    };
    const run = start();
    await settle();
    clock.advance(10_000);

    expect(await run).toMatchObject({ ok: false, failedPhase: 'listen', failedReason: 'Not ready within 10 s.' });
    expect(settlementOf('probe').settlement).toMatchObject({ state: 'failed', phase: 'listen', timedOut: true });
    answer({ ok: true, session: session.session });
    await settle();
    expect(session.log).toEqual(['open mqttreq1', 'aborted', 'end']);
  });

  it('fails with the error when opening throws', async () => {
    const { session, start, settlementOf } = rig();
    session.host.open = async () => {
      throw new Error('No such request.');
    };
    expect(await start()).toMatchObject({ ok: false, failedPhase: 'listen', failedReason: 'No such request.' });
    expect(settlementOf('probe').settlement).not.toHaveProperty('timedOut');
  });

  it('hands the session the run’s captures by reference', async () => {
    const { session, start } = rig([CALL, { ...LISTEN, dependsOn: ['reboot'] }, { ...SEND, dependsOn: ['probe'] }]);
    let handed: ReadonlyMap<string, ReadonlyMap<string, string>> = new Map();
    session.host.open = async (_step, opened) => {
      handed = opened.stepCaptures;
      return { ok: true, session: session.session };
    };
    const outcome = await start();
    expect(outcome.ok).toBe(true);
    expect([...handed.keys()]).toEqual(['reboot', 'probe', 'rename']);
  });
});

describe('a send', () => {
  it('captures from the message as sent and settles as sent', async () => {
    const { session, start, settlementOf } = rig([LISTEN, SEND]);
    const outcome = await start();

    expect(outcome.ok && Object.fromEntries(outcome.stepCaptures.get('rename') ?? [])).toEqual({ name: 'n-1' });
    expect(settlementOf('rename').settlement).toEqual({ state: 'sent', captureNames: ['name'] });
    expect(settlementOf('rename').product).toMatchObject({ kind: 'message', message: { body: '{"name":"n-1"}' } });
    expect(session.log).toEqual(['open mqttreq1', 'send msgname1', 'end']);
  });

  it('captures from the reply where the kind answers the send, and says how long the answer took', async () => {
    const { session, start, settlementOf } = rig([LISTEN, SEND]);
    session.sendResult = {
      ok: true,
      message: session.message({ body: '{"name":"asked"}' }),
      reply: session.message({ body: '{"name":"acked"}' }),
      ackMs: 6,
    };
    const outcome = await start();

    expect(outcome.ok && outcome.stepCaptures.get('rename')?.get('name')).toBe('acked');
    expect(settlementOf('rename').settlement).toEqual({ state: 'sent', ackMs: 6, captureNames: ['name'] });
    expect(settlementOf('rename').product).toMatchObject({ reply: { body: '{"name":"acked"}' } });
  });

  it('fails with the refusal, and when its session has ended', async () => {
    const refused = rig([LISTEN, SEND]);
    refused.session.sendResult = { ok: false, reason: 'The broker refused the publish (code 135).' };
    expect(await refused.start()).toMatchObject({
      ok: false,
      failedStepId: 'rename',
      failedPhase: 'send',
      failedReason: 'The broker refused the publish (code 135).',
    });

    const ended = rig([LISTEN, CALL, { ...SEND, dependsOn: ['reboot'] }]);
    const outcome = await ended.start({
      adapter: adapterOf(() => {
        ended.session.drop('The connection dropped.');
        return response('{"command":"reboot"}');
      }),
    });
    expect(outcome).toMatchObject({
      ok: false,
      failedPhase: 'send',
      failedReason: 'The session of "probe" had ended: The connection dropped.',
    });
    expect(ended.session.log).toEqual(['open mqttreq1', 'end']);
  });

  it('ends the input after the message, or alone', async () => {
    const after = rig([LISTEN, { ...SEND, endInput: true }]);
    await after.start();
    expect(after.session.log).toEqual(['open mqttreq1', 'send msgname1', 'end-input', 'end']);

    const { messageUid: _message, captures: _captures, ...bare } = SEND;
    const alone = rig([LISTEN, { ...bare, captures: [], endInput: true }]);
    expect((await alone.start()).ok).toBe(true);
    expect(alone.session.log).toEqual(['open mqttreq1', 'end-input', 'end']);
  });
});

describe('a run’s sessions', () => {
  const SECOND = { ...LISTEN, uid: 'stplist2', id: 'events', sessionRequestUid: 'mqttreq2' };

  it('are ended last opened first, on a failure as on a pass', async () => {
    const passing = rig([LISTEN, SECOND]);
    await passing.start();
    expect(passing.events.at(-1)).toMatchObject({
      type: 'end',
      ok: true,
      sessions: [{ stepId: 'events' }, { stepId: 'probe' }],
    });

    const failing = rig([LISTEN, SECOND, { ...CALL, dependsOn: ['events'] }]);
    const outcome = await failing.start({
      adapter: adapterOf(() => {
        throw new Error('Connection refused by 127.0.0.1.');
      }),
    });
    expect(outcome).toMatchObject({ ok: false, failedPhase: 'fetch' });
    expect(failing.session.log).toEqual(['open mqttreq1', 'open mqttreq2', 'end', 'end']);
    expect(failing.events.at(-1)).toMatchObject({ ok: false, sessions: [{ stepId: 'events' }, { stepId: 'probe' }] });
  });

  it('close under a deadline: one that misses it is a warning and never a verdict', async () => {
    const { clock, session, start, events } = rig([LISTEN]);
    session.endResult = new Promise(() => {});
    const run = start();
    await settle();
    clock.advance(5_000);

    expect((await run).ok).toBe(true);
    expect(events.at(-1)).toMatchObject({
      ok: true,
      sessions: [{ stepId: 'probe', openForMs: 5_000, warning: 'Not closed within 5 s.' }],
    });
  });

  it('carry the close’s own warning', async () => {
    const { session, start, events } = rig([LISTEN]);
    session.endResult = Promise.resolve({ warning: 'The After close script failed.' });
    await start();
    expect(events.at(-1)).toMatchObject({ sessions: [{ stepId: 'probe', warning: 'The After close script failed.' }] });
  });

  it('are ended when the run is thrown out of', async () => {
    const { session, start } = rig();
    const run = start({
      onEvent: (event) => {
        if (event.type === 'step-start' && event.stepId === 'reboot') throw new Error('the listener broke');
      },
    });
    await expect(run).rejects.toThrow('the listener broke');
    expect(session.log).toEqual(['open mqttreq1', 'end']);
  });

  it('are named on the end of a run alone when it opened one', async () => {
    const { start, events } = rig([CALL]);
    await start();
    expect(events.at(-1)).toEqual({ type: 'end', at: 1_000, ok: true, durationMs: 0 });
  });
});

describe('what the page keeps of a run with session steps', () => {
  it('counts a ready listen, a sent message and a matched expect as passed', async () => {
    const { session, start, events } = rig([LISTEN, SEND, { ...CALL, dependsOn: ['rename'] }, EXPECT]);
    await start({
      adapter: adapterOf(() => {
        session.deliver();
        return response('{"command":"reboot"}');
      }),
    });
    const facts: WorkflowRunFact[] = events.map(runFactOf);
    const record = facts.reduce<WorkflowRunRecord | null>(
      (kept, fact) => applyRunFact(kept, { runId: 'run-1', environmentId: null }, fact),
      null,
    );

    expect(record && runVerdict(record)).toBe('passed');
    expect(record && runTotals(record)).toEqual({ passed: 4, failed: 0, skipped: 0, notRun: 0, cannotRun: 0 });
    expect(facts.flatMap((fact) => (fact.type === 'step-settle' ? [[fact.stepId, fact.hasProduct]] : []))).toEqual([
      ['probe', false],
      ['rename', true],
      ['reboot', false],
      ['status', true],
    ]);
  });

  it('bounds held message products by their bodies', () => {
    const hold = createRunProductHold(30);
    const clock = fakeClock();
    const session = fakeSession(clock);
    const sent = (body: string): StepProduct => ({ kind: 'message', message: session.message({ body }) });
    hold.open('wf-old', 'run-old');
    hold.put('wf-old', 'run-old', 'rename', sent('x'.repeat(20)));
    hold.open('wf-new', 'run-new');
    hold.put('wf-new', 'run-new', 'status', {
      kind: 'message',
      message: null,
      window: [{ message: session.message({ body: 'y'.repeat(20) }), outcome: 'not-matched' }],
    });

    expect(hold.get('run-old', 'rename')).toBeNull();
    expect(hold.get('run-new', 'status')).not.toBeNull();
  });
});

describe('a run this host cannot run', () => {
  it('runs none of it where the host opens no session', async () => {
    const { adapter, start, events } = rig();
    const outcome = await start({ sessions: undefined });

    expect(outcome).toMatchObject({
      ok: false,
      failedStepId: 'probe',
      failedPhase: 'unsupported',
      failedReason: 'Step "probe" cannot run here: this host opens no session.',
    });
    expect(adapter.sent).toBe(0);
    expect(events.map((event) => (event.type === 'step-settle' ? event.settlement : event.type))).toEqual([
      'begin',
      { state: 'cannot-run', reason: 'Step "probe" cannot run here: this host opens no session.' },
      { state: 'not-run' },
      { state: 'cannot-run', reason: 'Step "status" cannot run here: this host opens no session.' },
      'end',
    ]);
  });

  it('runs none of it where a criterion’s value is a template the host cannot resolve', async () => {
    const held = {
      ...CALL,
      successCriteria: [
        { kind: 'equals', uid: 'crtname0', extractor: { kind: 'json-path', path: '$.name' }, value: '{{env.name}}' },
      ],
    };
    const { adapter, start } = rig([held]);
    expect(await start({ resolveTemplate: undefined })).toMatchObject({
      ok: false,
      failedPhase: 'unsupported',
      failedReason: 'Step "reboot" cannot run here: this host resolves no template outside a request.',
    });
    expect(adapter.sent).toBe(0);
  });

  it('runs a criterion with a plain value on a host that resolves none', async () => {
    const held = { ...CALL, successCriteria: [{ kind: 'status', uid: 'crtstat0', match: '2xx' }] };
    const { start } = rig([held]);
    expect((await start({ resolveTemplate: undefined, sessions: undefined })).ok).toBe(true);
  });
});

describe('a call’s success criteria', () => {
  const NAME = { kind: 'equals', uid: 'crtname0', extractor: { kind: 'json-path', path: '$.name' }, value: 'n-1' };
  const GET = { ...CALL, id: 'device', captures: [], successCriteria: [NAME] };

  it('fail the step with the criterion that did not hold, its response kept', async () => {
    const { start, settlementOf } = rig([GET]);
    const outcome = await start({ adapter: adapterOf(() => response('{"name":"old"}')) });

    expect(outcome).toMatchObject({
      ok: false,
      failedStepId: 'device',
      failedPhase: 'criteria',
      failedReason: 'Expected $.name to equal "n-1"; got "old".',
      attemptsMade: 1,
    });
    expect(settlementOf('device').settlement).toEqual({
      state: 'failed',
      phase: 'criteria',
      reason: 'Expected $.name to equal "n-1"; got "old".',
      attempts: 1,
      maxAttempts: 1,
      status: 200,
    });
  });

  it('are held to a value from an earlier step', async () => {
    const fromSend = { ...GET, successCriteria: [{ ...NAME, value: '{{step.rename.name}}' }] };
    const { start } = rig([LISTEN, SEND, fromSend]);
    expect((await start({ adapter: adapterOf(() => response('{"name":"n-1"}')) })).ok).toBe(true);
  });

  it('send the call again under a poll until they hold', async () => {
    const polled = { ...GET, poll: { maxAttempts: 10, delayMs: 200 } };
    const { start, events, settlementOf } = rig([polled]);
    const waits: number[] = [];
    const bodies = ['{"name":"old"}', '{"name":"old"}', '{"name":"n-1"}'];
    const adapter = adapterOf(() => response(bodies[adapter.sent - 1]));
    const outcome = await start({
      adapter,
      sleep: async (ms) => {
        waits.push(ms);
      },
    });

    expect(outcome.ok && outcome.stepAttempts.get('device')).toBe(3);
    expect(waits).toEqual([200, 200]);
    expect(events.filter((event) => event.type === 'attempt-end')).toEqual([
      {
        type: 'attempt-end',
        at: 1_000,
        stepId: 'device',
        attempt: 1,
        maxAttempts: 10,
        cause: { kind: 'criteria', message: 'Expected $.name to equal "n-1"; got "old".' },
        retryInMs: 200,
      },
      {
        type: 'attempt-end',
        at: 1_000,
        stepId: 'device',
        attempt: 2,
        maxAttempts: 10,
        cause: { kind: 'criteria', message: 'Expected $.name to equal "n-1"; got "old".' },
        retryInMs: 200,
      },
    ]);
    expect(settlementOf('device').settlement).toMatchObject({ state: 'passed', attempts: 3, maxAttempts: 10 });
  });

  it('fail the step when the poll runs out, naming the criterion and the last value seen', async () => {
    const polled = { ...GET, poll: { maxAttempts: 3, delayMs: 200 } };
    const { start } = rig([polled]);
    const answered = adapterOf(() => response('{"name":"old"}'));
    expect(await start({ adapter: answered })).toMatchObject({
      ok: false,
      failedPhase: 'criteria',
      failedReason: 'Expected $.name to equal "n-1"; got "old". (after 3 attempts)',
      attemptsMade: 3,
    });
    expect(answered.sent).toBe(3);
  });

  it('stop a poll that would outlast its limit', async () => {
    const polled = { ...GET, poll: { maxAttempts: 100, delayMs: 60_000 } };
    const { clock, start } = rig([polled]);
    const answered = adapterOf(() => {
      clock.advance(100_000);
      return response('{"name":"old"}');
    });
    expect(await start({ adapter: answered })).toMatchObject({ ok: false, failedPhase: 'criteria' });
    expect(answered.sent).toBe(3);
  });

  it('end a poll at a send that fails', async () => {
    const polled = { ...GET, poll: { maxAttempts: 10, delayMs: 200 } };
    const { start } = rig([polled]);
    const answered = adapterOf(() => {
      if (answered.sent === 2) throw new Error('Connection refused by 127.0.0.1.');
      return response('{"name":"old"}');
    });
    expect(await start({ adapter: answered })).toMatchObject({
      ok: false,
      failedPhase: 'fetch',
      failedReason: 'Connection refused by 127.0.0.1.',
      attemptsMade: 2,
    });
  });
});
