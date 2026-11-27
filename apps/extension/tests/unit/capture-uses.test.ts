/**
 * Coverage for the capture readers of the workflow view's step panel:
 * which captures of other steps a step reads, and where it reads each.
 */

import type { MqttRequest, Request, WorkflowStep } from '@openheaders/core/types';
import { captureUsesOf, stepRequestTemplates } from '@openheaders/ui/workbench/components/live/capture-uses';
import type { StepRequests } from '@openheaders/ui/workbench/components/live/use-step-requests';
import { describe, expect, it } from 'vitest';

function makeRequest(overrides: Partial<Request> = {}): Request {
  return {
    schemaVersion: 5,
    uid: 'reqdev01',
    path: 'requests/device-reqdev01',
    name: 'Get device',
    method: 'GET',
    url: 'https://api.openheaders.io/devices/dev-1',
    headers: [],
    params: [],
    auth: { type: 'none' },
    body: { type: 'none' },
    ...overrides,
  };
}

function makeMqttRequest(overrides: Partial<MqttRequest> = {}): MqttRequest {
  return {
    schemaVersion: 5,
    uid: 'mqttreq1',
    path: 'api-requests/probe-mqttreq1',
    name: 'Probe MQTT',
    url: 'ws://openheaders.io/mqtt',
    topic: '',
    payload: '',
    topics: [],
    savedMessages: [],
    userProperties: [],
    ...overrides,
  };
}

function requestsOf(http: Request[] = [], mqtt: MqttRequest[] = []): StepRequests {
  return {
    requestsByUid: new Map(http.map((request) => [request.uid, request])),
    graphqlByUid: new Map(),
    mqttRequests: mqtt,
    ready: true,
  };
}

describe('captureUsesOf', () => {
  it('a call reads in its request, its success criteria, its run condition and its priority', () => {
    const request = makeRequest({
      url: 'https://api.openheaders.io/devices/{{step.login.deviceId}}',
      headers: [{ uid: 'hdrauth1', key: 'Authorization', value: 'Bearer {{step.login.token}}', enabled: true }],
      params: [{ uid: 'prmdev01', key: 'device', value: '{{step.login.deviceId}}', enabled: true }],
    });
    const step: WorkflowStep = {
      uid: 'stpver01',
      id: 'verify',
      requestUid: 'reqdev01',
      captures: [],
      successCriteria: [
        { kind: 'status', uid: 'crtstat1', match: '2xx' },
        {
          kind: 'equals',
          uid: 'crtcmd01',
          extractor: { kind: 'json-path', path: '$.commandId' },
          value: '{{step.reboot.commandId}}',
        },
      ],
      runIf: {
        all: [
          { uid: 'gat2xx01', kind: 'status', stepId: 'reboot', match: '2xx' },
          { uid: 'gatcmd01', kind: 'capture-exists', stepId: 'reboot', captureName: 'commandId' },
        ],
      },
      priorityFrom: { stepId: 'login', captureName: 'token' },
    };
    const uses = captureUsesOf(step, requestsOf([request]));
    // A capture read twice in the request is one row of it.
    const inRequest = uses.filter((use) => use.place === 'request');
    expect(inRequest).toHaveLength(2);
    expect(inRequest).toEqual(
      expect.arrayContaining([
        { stepId: 'login', captureName: 'deviceId', place: 'request' },
        { stepId: 'login', captureName: 'token', place: 'request' },
      ]),
    );
    expect(uses.filter((use) => use.place !== 'request')).toEqual([
      { stepId: 'reboot', captureName: 'commandId', place: 'criteria' },
      { stepId: 'reboot', captureName: 'commandId', place: 'condition' },
      { stepId: 'login', captureName: 'token', place: 'priority' },
    ]);
  });

  it('a Wait reads in its topic and in its match values', () => {
    const step: WorkflowStep = {
      uid: 'stpexp01',
      id: 'rebooting',
      action: 'expect',
      on: 'probe',
      after: 'reboot',
      address: 'devices/{{step.login.deviceId}}/status',
      match: [
        {
          kind: 'equals',
          uid: 'crtcmd01',
          extractor: { kind: 'json-path', path: '$.commandId' },
          value: '{{step.reboot.commandId}}',
        },
      ],
      timeoutMs: 5000,
      captures: [],
    };
    expect(captureUsesOf(step, requestsOf())).toEqual([
      { stepId: 'login', captureName: 'deviceId', place: 'topic' },
      { stepId: 'reboot', captureName: 'commandId', place: 'match' },
    ]);
  });

  it('a Listen reads in the request it opens — its connection', () => {
    const step: WorkflowStep = {
      uid: 'stplis01',
      id: 'probe',
      action: 'listen',
      sessionRequestUid: 'mqttreq1',
      timeoutMs: 5000,
      captures: [],
    };
    const session = makeMqttRequest({ url: 'ws://openheaders.io/mqtt?device={{step.login.deviceId}}' });
    expect(captureUsesOf(step, requestsOf([], [session]))).toEqual([
      { stepId: 'login', captureName: 'deviceId', place: 'connection' },
    ]);
    expect(stepRequestTemplates(step, requestsOf())).toEqual([]);
  });

  it('a priority with no capture picked reads nothing, and neither does a step no build knows', () => {
    const unpicked: WorkflowStep = {
      uid: 'stpcal02',
      id: 'plain',
      requestUid: 'reqgone0',
      captures: [],
      priorityFrom: { stepId: 'login', captureName: '' },
    };
    expect(captureUsesOf(unpicked, requestsOf())).toEqual([]);
    expect(captureUsesOf({ uid: 'stpwat01', id: 'later', action: 'watch' }, requestsOf())).toEqual([]);
  });
});
