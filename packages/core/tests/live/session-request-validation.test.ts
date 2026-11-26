/**
 * What a workflow's session steps ask of their session requests (the
 * workflow runs plan, The model): a `listen` opens an MQTT request of the
 * workspace, an MQTT session has no end of input, and an `expect` that
 * passes over stored messages is refused where a row of its session's
 * request makes the stored mark unsure.
 *
 * One workflow throughout — the reboot scenario on the probe request.
 */

import { describe, expect, it } from 'vitest';
import { validateSessionRequests } from '../../src/live/session-request-validation';
import type { LiveWorkflow, WorkflowStep } from '../../src/types/live';
import type { MqttRequest } from '../../src/types/mqtt-request';

type TopicRow = MqttRequest['topics'][number];

function makeRow(overrides: Partial<TopicRow> = {}): TopicRow {
  return { uid: 'rowdevc1', topicFilter: 'devices/dev-1/#', ...overrides };
}

function makeProbe(overrides: Partial<MqttRequest> = {}): MqttRequest {
  return {
    schemaVersion: 5,
    uid: 'mqttprob',
    path: 'requests/probe-mqtt-mqttprob',
    name: 'Probe MQTT',
    url: 'mqtt://broker.openheaders.io:1883',
    topic: '',
    payload: '',
    topics: [makeRow()],
    savedMessages: [],
    userProperties: [],
    ...overrides,
  };
}

const LISTEN: WorkflowStep = {
  uid: 'stplistn',
  id: 'probe',
  action: 'listen',
  sessionRequestUid: 'mqttprob',
  timeoutMs: 5_000,
  captures: [],
};
const CALL: WorkflowStep = { uid: 'stpreboo', id: 'reboot', requestUid: 'reqreboo', captures: [] };

function makeExpect(overrides: Record<string, unknown> = {}): WorkflowStep {
  return {
    uid: 'stpexpct',
    id: 'status',
    action: 'expect',
    on: 'probe',
    after: 'reboot',
    address: 'devices/dev-1/status',
    match: [],
    timeoutMs: 5_000,
    captures: [],
    ...overrides,
  };
}

function makeWorkflow(steps: WorkflowStep[] = [LISTEN, CALL, makeExpect()]): LiveWorkflow {
  return {
    schemaVersion: 5,
    uid: 'wfdevice',
    path: 'live-workflows/device-wfdevice',
    name: 'Device',
    steps,
    refresh: { kind: 'manual' },
    enabled: true,
    published: true,
  };
}

function issues(probe: MqttRequest | null, workflow: LiveWorkflow = makeWorkflow()): string[] {
  return validateSessionRequests(workflow, (uid) => (probe !== null && uid === probe.uid ? probe : null)).map(
    (error) => `${error.issue} ${error.stepId}`,
  );
}

const RETAINING = makeRow({ retainAsPublished: true });

describe('validateSessionRequests', () => {
  it('passes the scenario on a request whose rows keep the retain flag as the broker sets it', () => {
    expect(issues(makeProbe())).toEqual([]);
  });

  it('answers nothing for a workflow with no session step', () => {
    expect(issues(null, makeWorkflow([CALL]))).toEqual([]);
  });

  it('refuses a listen whose request is not an MQTT request of the workspace, by name', () => {
    expect(validateSessionRequests(makeWorkflow(), () => null)).toEqual([
      {
        issue: 'listen-request-missing',
        stepId: 'probe',
        message: 'Step "probe" names a session request that is not an MQTT request in this workspace.',
      },
    ]);
  });

  it('refuses a send that ends the input: an MQTT session has none', () => {
    const send: WorkflowStep = {
      uid: 'stpsend0',
      id: 'finish',
      action: 'send',
      on: 'probe',
      endInput: true,
      captures: [],
    };
    expect(validateSessionRequests(makeWorkflow([LISTEN, send]), () => makeProbe())).toEqual([
      {
        issue: 'send-end-input-unsupported',
        stepId: 'finish',
        message: 'Step "finish" cannot run here: an MQTT session has no end of input.',
      },
    ]);
  });

  it('refuses an expect that passes over stored messages on a row with Retain As Published on', () => {
    expect(validateSessionRequests(makeWorkflow(), () => makeProbe({ topics: [RETAINING] }))).toEqual([
      {
        issue: 'expect-stored-unsure',
        stepId: 'status',
        referencedStepId: 'probe',
        message:
          'Step "status" passes over stored messages, but "Probe MQTT" subscribes to devices/dev-1/# with Retain As Published on, so a live message can look stored.',
      },
    ]);
  });

  it('lets the expect be where it takes stored messages, the session is 3.1.1, or the row is not subscribed at open', () => {
    const retaining = makeProbe({ topics: [RETAINING] });
    expect(issues(retaining, makeWorkflow([LISTEN, CALL, makeExpect({ includeStored: true })]))).toEqual([]);
    expect(issues(makeProbe({ topics: [RETAINING], protocolVersion: '3.1.1' }))).toEqual([]);
    expect(issues(makeProbe({ topics: [makeRow({ retainAsPublished: true, subscribe: false })] }))).toEqual([]);
  });

  it('counts a row only where its filter can take a topic the address takes', () => {
    const logs = makeProbe({ topics: [makeRow({ topicFilter: 'logs/#', retainAsPublished: true })] });
    const shared = makeProbe({
      topics: [makeRow({ topicFilter: '$share/fleet/devices/+/status', retainAsPublished: true })],
    });
    expect(issues(logs)).toEqual([]);
    expect(issues(shared)).toEqual(['expect-stored-unsure status']);
  });

  it('reads a template in the address or the filter, and an absent address, as taking the topic', () => {
    const logs = makeProbe({ topics: [makeRow({ topicFilter: 'logs/#', retainAsPublished: true })] });
    const templated = makeProbe({ topics: [makeRow({ topicFilter: '{{env.ROOT}}/#', retainAsPublished: true })] });
    expect(issues(logs, makeWorkflow([LISTEN, CALL, makeExpect({ address: 'devices/{{env.ID}}/status' })]))).toEqual([
      'expect-stored-unsure status',
    ]);
    expect(issues(templated)).toEqual(['expect-stored-unsure status']);
    expect(issues(logs, makeWorkflow([LISTEN, CALL, makeExpect({ address: undefined })]))).toEqual([
      'expect-stored-unsure status',
    ]);
  });

  it('answers in declared step order', () => {
    const second: WorkflowStep = { ...LISTEN, uid: 'stplist2', id: 'other', sessionRequestUid: 'mqttnone' };
    const workflow = makeWorkflow([second, LISTEN, CALL, makeExpect()]);
    expect(issues(makeProbe({ topics: [RETAINING] }), workflow)).toEqual([
      'listen-request-missing other',
      'expect-stored-unsure status',
    ]);
  });
});
