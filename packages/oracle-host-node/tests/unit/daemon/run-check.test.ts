/**
 * The host check's retain rule (the workflow runs plan, The model —
 * "Stored, not live"): an `expect` that passes over stored messages is
 * refused where a row of its session's request can hand it a live message
 * marked retained.
 */

import type { LiveWorkflow, MqttRequest, WorkflowStep } from '@openheaders/core/types';
import { describe, expect, it } from 'vitest';
import { checkWorkflowRun } from '../../../src/daemon/live/run-check';

type TopicRow = MqttRequest['topics'][number];

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

function makeRow(overrides: Partial<TopicRow> = {}): TopicRow {
  return { uid: 'rowdevc1', topicFilter: 'devices/dev-1/#', retainAsPublished: true, ...overrides };
}

function makeWorkflow(expectOverrides: Record<string, unknown> = {}): LiveWorkflow {
  const steps: WorkflowStep[] = [
    {
      uid: 'stplistn',
      id: 'probe',
      action: 'listen',
      sessionRequestUid: 'mqttprob',
      timeoutMs: 5_000,
      captures: [],
    },
    { uid: 'stpreboo', id: 'reboot', requestUid: 'reqreboo', captures: [] },
    {
      uid: 'stpexpct',
      id: 'status',
      action: 'expect',
      on: 'probe',
      after: 'reboot',
      address: 'devices/dev-1/status',
      match: [],
      timeoutMs: 5_000,
      captures: [],
      ...expectOverrides,
    },
  ];
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

function reasons(probe: MqttRequest, workflow: LiveWorkflow = makeWorkflow()): string[] {
  const checked = checkWorkflowRun(workflow, {
    findMqttRequest: (uid) => (uid === probe.uid ? probe : null),
    runsScripts: true,
  });
  return checked.ok ? [] : checked.refusals.map((refusal) => `${refusal.stepId}: ${refusal.reason}`);
}

const refusedBy = (filter: string): string[] => [
  `status: Step "status" passes over stored messages, but "Probe MQTT" subscribes to ${filter} with Retain As Published on, so a live message can look stored.`,
];

describe('the retain rule', () => {
  it('refuses on a row whose filter takes the address, naming the filter as written', () => {
    expect(reasons(makeProbe())).toEqual(refusedBy('devices/dev-1/#'));
    expect(reasons(makeProbe({ topics: [makeRow({ topicFilter: ' devices/+/status ' })] }))).toEqual(
      refusedBy('devices/+/status'),
    );
  });

  it('names the first such row and refuses the step once', () => {
    const probe = makeProbe({
      topics: [
        makeRow({ uid: 'rowlogs0', topicFilter: 'logs/#' }),
        makeRow({ uid: 'rowstat0', topicFilter: 'devices/dev-1/status' }),
        makeRow(),
      ],
    });

    expect(reasons(probe)).toEqual(refusedBy('devices/dev-1/status'));
  });

  it('lets a run through on a row that cannot deliver on the address', () => {
    expect(reasons(makeProbe({ topics: [makeRow({ topicFilter: 'logs/#' })] }))).toEqual([]);
    expect(reasons(makeProbe({ topics: [makeRow({ topicFilter: 'devices/dev-2/#' })] }))).toEqual([]);
  });

  it('lets a run through where the option is off, the row is not subscribed at open or its filter is blank', () => {
    expect(reasons(makeProbe({ topics: [makeRow({ retainAsPublished: false })] }))).toEqual([]);
    expect(reasons(makeProbe({ topics: [{ uid: 'rowdevc1', topicFilter: 'devices/dev-1/#' }] }))).toEqual([]);
    expect(reasons(makeProbe({ topics: [makeRow({ subscribe: false })] }))).toEqual([]);
    expect(reasons(makeProbe({ topics: [makeRow({ topicFilter: '  ' })] }))).toEqual([]);
  });

  it('lets a run through on a 3.1.1 request, which never sends the option', () => {
    expect(reasons(makeProbe({ protocolVersion: '3.1.1' }))).toEqual([]);
    expect(reasons(makeProbe({ protocolVersion: '5.0' }))).toEqual(refusedBy('devices/dev-1/#'));
  });

  it('lets a run through for an expect that takes stored messages', () => {
    expect(reasons(makeProbe(), makeWorkflow({ includeStored: true }))).toEqual([]);
  });

  it('reads a template in the address or in a row’s filter as taking it', () => {
    expect(
      reasons(
        makeProbe({ topics: [makeRow({ topicFilter: 'logs/#' })] }),
        makeWorkflow({ address: 'devices/{{env.DEVICE}}/status' }),
      ),
    ).toEqual(refusedBy('logs/#'));
    expect(reasons(makeProbe({ topics: [makeRow({ topicFilter: '{{env.PREFIX}}/logs/#' })] }))).toEqual(
      refusedBy('{{env.PREFIX}}/logs/#'),
    );
  });

  it('reads an expect with no address as taking every topic', () => {
    expect(
      reasons(makeProbe({ topics: [makeRow({ topicFilter: 'logs/#' })] }), makeWorkflow({ address: undefined })),
    ).toEqual(refusedBy('logs/#'));
  });

  it('reads a shared subscription by the filter after its group', () => {
    expect(reasons(makeProbe({ topics: [makeRow({ topicFilter: '$share/fleet/devices/dev-1/#' })] }))).toEqual(
      refusedBy('$share/fleet/devices/dev-1/#'),
    );
    expect(reasons(makeProbe({ topics: [makeRow({ topicFilter: '$share/fleet/logs/#' })] }))).toEqual([]);
  });
});
