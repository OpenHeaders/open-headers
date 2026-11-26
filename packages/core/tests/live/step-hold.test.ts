/**
 * A call behind its host's rate limit (the workflow runs plan, Decisions
 * log, S10): the run says when the call waits and when it leaves, an
 * `expect` the call triggers opens its window as the call leaves, and a
 * poll's re-send asks for a start the limit does not count.
 *
 * The reboot scenario over a fake session; the adapter stands where a
 * host's rate limit would and drives the signals by hand.
 *
 * And what a session step's row is told: how a `listen`'s session
 * opened, and what an `expect` waits for from when.
 */

import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { type FetchAdapter, runChain, type StepSend } from '../../src/live/chain-runner';
import type { StepResponse } from '../../src/live/extractor';
import type { WorkflowRunEvent } from '../../src/live/run-events';
import type { SessionHost, SessionMessage, SessionOpening } from '../../src/live/session-port';
import { isChainWorkflow } from '../../src/live/step-actions';
import { LiveWorkflowSchema } from '../../src/schemas/live';
import type { ChainWorkflow } from '../../src/types/live';

const STATUS_TOPIC = 'devices/dev-1/status';
const REBOOTING = '{"state":"rebooting","command":"reboot"}';

const LISTEN = {
  uid: 'stplistn',
  id: 'probe',
  action: 'listen',
  sessionRequestUid: 'mqttreq1',
  timeoutMs: 10_000,
  captures: [],
};
const CALL = { uid: 'stpcall0', id: 'reboot', requestUid: 'httpreq1', captures: [] };
const EXPECT = {
  uid: 'stpexpct',
  id: 'status',
  action: 'expect',
  on: 'probe',
  after: 'reboot',
  address: STATUS_TOPIC,
  match: [{ kind: 'equals', uid: 'crtstate', extractor: { kind: 'json-path', path: '$.state' }, value: 'rebooting' }],
  timeoutMs: 5_000,
  captures: [],
};

function scenario(steps: unknown[]): ChainWorkflow {
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

function response(body: string): StepResponse {
  return { status: 200, statusText: 'OK', url: 'https://api.openheaders.io/devices/dev-1/reboot', headers: [], body };
}

function rig(steps: unknown[] = [LISTEN, CALL, EXPECT]) {
  let clock = 1_000;
  let position = 0;
  let opening: SessionOpening | null = null;
  const events: WorkflowRunEvent[] = [];
  const sessions: SessionHost = {
    open: async (_step, opened) => {
      opening = opened;
      return {
        ok: true,
        facts: { identityGenerated: true, cleanStart: true, resumed: false, granted: 1 },
        session: {
          position: () => position,
          matchesAddress: (address, landed) => landed.address === address,
          send: async () => ({ ok: false, reason: 'This session sends nothing.' }),
          endInput: async () => {},
          end: async () => ({}),
        },
      };
    },
  };
  const deliver = (body: string): void => {
    const message: SessionMessage = {
      position,
      at: clock,
      address: STATUS_TOPIC,
      body,
      fields: [{ key: 'topic', value: STATUS_TOPIC }],
      stored: false,
    };
    position += 1;
    opening?.onMessage(message);
  };
  const start = (adapter: FetchAdapter) =>
    runChain({
      workflow: scenario(steps),
      adapter,
      context: { workflowUid: 'wfdevice', workspaceId: 'ws-devices', environmentId: null },
      now: () => clock,
      timer: () => new Promise<void>(() => {}),
      sleep: async () => {},
      onEvent: (event) => events.push(event),
      sessions,
    });
  const advance = (ms: number): void => {
    clock += ms;
  };
  const settlementOf = (stepId: string) =>
    events.flatMap((event) => (event.type === 'step-settle' && event.stepId === stepId ? [event] : []))[0];
  return { events, deliver, advance, start, settlementOf };
}

describe('a call its host’s rate limit holds', () => {
  it('says so once as it waits and once as it leaves', async () => {
    const { events, advance, start } = rig([CALL]);
    const outcome = await start({
      executeStep: async (_step, _captures, _context, send) => {
        send?.onHeld();
        advance(19_000);
        send?.onLeave();
        return response('{}');
      },
    });

    expect(outcome.ok).toBe(true);
    expect(events.filter((event) => event.type === 'step-hold')).toEqual([
      { type: 'step-hold', at: 1_000, stepId: 'reboot', held: true },
      { type: 'step-hold', at: 20_000, stepId: 'reboot', held: false },
    ]);
  });

  it('says nothing for a call that leaves at once', async () => {
    const { events, start } = rig([CALL]);
    await start({
      executeStep: async (_step, _captures, _context, send) => {
        send?.onLeave();
        return response('{}');
      },
    });

    expect(events.map((event) => event.type)).toEqual(['begin', 'step-start', 'step-settle', 'end']);
  });
});

describe('an expect’s window, behind a held trigger', () => {
  it('opens as the call leaves: the wait is neither in it nor on its deadline', async () => {
    const { deliver, advance, start, settlementOf } = rig();
    const outcome = await start({
      executeStep: async (_step, _captures, _context, send) => {
        send?.onHeld();
        advance(19_000);
        deliver(REBOOTING);
        send?.onLeave();
        advance(300);
        deliver(REBOOTING);
        return response('{}');
      },
    });

    expect(outcome.ok).toBe(true);
    const matched = settlementOf('status');
    expect(matched.settlement).toEqual({ state: 'matched', afterMs: 300, captureNames: [] });
    expect(matched.product).toMatchObject({ window: [{ message: { position: 1 }, outcome: 'matched' }] });
  });

  it('stays where the first send left it when a poll sends the call again', async () => {
    const polled = {
      ...CALL,
      successCriteria: [
        { kind: 'equals', uid: 'crtdone0', extractor: { kind: 'json-path', path: '$.done' }, value: 'yes' },
      ],
      poll: { maxAttempts: 3, delayMs: 200 },
    };
    const { deliver, advance, start, settlementOf } = rig([LISTEN, polled, EXPECT]);
    let sent = 0;
    const outcome = await start({
      executeStep: async (_step, _captures, _context, send) => {
        sent += 1;
        send?.onLeave();
        advance(100);
        if (sent === 1) deliver(REBOOTING);
        return response(sent === 1 ? '{"done":"no"}' : '{"done":"yes"}');
      },
    });

    expect(outcome.ok).toBe(true);
    expect(settlementOf('status').settlement).toMatchObject({ state: 'matched', afterMs: 100 });
  });
});

describe('what a session step’s row is told', () => {
  it('a listen settles with how its session opened', async () => {
    const { start, settlementOf } = rig([LISTEN]);
    await start({ executeStep: async () => response('{}') });

    expect(settlementOf('probe').settlement).toEqual({
      state: 'ready',
      readyMs: 0,
      captureNames: [],
      facts: { identityGenerated: true, cleanStart: true, resumed: false, granted: 1 },
    });
  });

  it('an expect starts with its address, its deadline and when its window opened', async () => {
    const { events, deliver, advance, start } = rig();
    await start({
      executeStep: async (_step, _captures, _context, send) => {
        send?.onHeld();
        advance(19_000);
        send?.onLeave();
        advance(300);
        deliver(REBOOTING);
        return response('{}');
      },
    });

    expect(events.filter((event) => event.type === 'step-start')).toEqual([
      { type: 'step-start', at: 1_000, stepId: 'probe', maxAttempts: 1 },
      { type: 'step-start', at: 1_000, stepId: 'reboot', maxAttempts: 1 },
      {
        type: 'step-start',
        at: 20_300,
        stepId: 'status',
        maxAttempts: 1,
        awaiting: { address: STATUS_TOPIC, since: 20_000, timeoutMs: 5_000 },
      },
    ]);
  });
});

describe('a poll, to the rate limit', () => {
  it('asks for an uncounted start on its own re-send alone — never the first send, never a retry', async () => {
    const polled = {
      ...CALL,
      retry: { maxAttempts: 2, delayMs: 0 },
      successCriteria: [
        { kind: 'equals', uid: 'crtdone0', extractor: { kind: 'json-path', path: '$.done' }, value: 'yes' },
      ],
      poll: { maxAttempts: 3, delayMs: 200 },
    };
    const { start } = rig([polled]);
    const asked: boolean[] = [];
    const answers: Array<() => StepResponse> = [
      () => response('{"done":"no"}'),
      () => {
        throw new Error('Connection refused by 127.0.0.1:3000.');
      },
      () => response('{"done":"yes"}'),
    ];
    const outcome = await start({
      executeStep: async (_step, _captures, _context, send?: StepSend) => {
        asked.push(send?.resend === true);
        return answers[asked.length - 1]();
      },
    });

    expect(outcome.ok).toBe(true);
    expect(asked).toEqual([false, true, false]);
  });
});
