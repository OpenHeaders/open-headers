/**
 * The agent save tool in a build that authors session steps (the
 * workflow runs plan, Decisions log, S16): it takes a `listen`, a `send`
 * and an `expect`, holds them to the checks the editor and the run make,
 * mints the uid of a match row, takes no `exposes` on a workflow that
 * holds a session, and keeps read-only only a workflow with a step of an
 * action the model does not know.
 *
 * A build without the opt-in authors calls alone — pinned beside the
 * unknown-step cases in `mcp-unknown-step.test.ts`.
 */

import { isExpectStep, isListenStep } from '@openheaders/core/live';
import { setHostLogger } from '@openheaders/core/logger';
import { LiveWorkflowSchema } from '@openheaders/core/schemas';
import { setHostStorage } from '@openheaders/core/storage';
import { buildAddLiveWorkflowBatch } from '@openheaders/core/sync-builders/mutations/live-workflow-mutations';
import { buildMqttAddBatch } from '@openheaders/core/sync-builders/mutations/mqtt-request-mutations';
import type { LiveWorkflow, MqttRequest } from '@openheaders/core/types';
import { logger as consoleLogger } from '@openheaders/core/utils';
import {
  __initSyncServiceForTests,
  dispose as disposeSyncService,
  snapshotLiveVariablePostStates,
  snapshotLiveWorkflowPostStates,
} from '@openheaders/oracle/sync/service';
import * as v from 'valibot';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type McpToolDefinition, McpToolInputError } from '../../src/mcp/registry';
import { applyMcpMutation, mintMcpContext } from '../../src/mcp/tools/common';
import { createWriteToolDefinitions } from '../../src/mcp/tools/write-tools';
import { createHostStorageFake } from './_host-storage-fake';

const wsId = 'ws-session-authoring';
const CTX = { tokenId: 'token-1', userId: 'user-1' };
const MINTED_UID = /^[a-z0-9]{8}$/;

const tools = new Map<string, McpToolDefinition>(
  createWriteToolDefinitions({ workflowSessionAuthoring: true }).map((tool) => [tool.name, tool]),
);

function call(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const tool = tools.get(name);
  if (!tool) throw new Error(`missing tool ${name}`);
  return tool.handler({ workspaceId: wsId, ...args }, CTX) as Promise<Record<string, unknown>>;
}

async function saveRequest(name: string, method: string, url: string): Promise<string> {
  const saved = (await call('requests_save', { request: { name, method, url } })) as { request: { uid: string } };
  return saved.request.uid;
}

async function saveProbe(overrides: Partial<MqttRequest> = {}): Promise<void> {
  const probe: MqttRequest = {
    schemaVersion: 5,
    uid: 'mqttprob',
    path: 'requests/probe-mqtt-mqttprob',
    name: 'Probe MQTT',
    url: 'mqtt://broker.openheaders.io:1883',
    protocolVersion: '3.1.1',
    topic: '',
    payload: '',
    topics: [{ uid: 'rowdevc1', topicFilter: 'devices/dev-1/#' }],
    savedMessages: [
      {
        uid: 'msgname1',
        name: 'Set name',
        topic: 'devices/dev-1/name',
        payload: '{"name":"John Doe"}',
        format: 'json',
        qos: 1,
      },
    ],
    userProperties: [],
    ...overrides,
  };
  await applyMcpMutation(buildMqttAddBatch(probe, mintMcpContext(wsId), null));
}

const LISTEN = { id: 'probe', action: 'listen', sessionRequestUid: 'mqttprob', timeoutMs: 5_000, captures: [] };

const rebootCall = (requestUid: string) => ({
  id: 'reboot',
  requestUid,
  captures: [{ name: 'command', extractor: { kind: 'json-path', path: '$.command' } }],
});

const STATUS = {
  id: 'status',
  action: 'expect',
  on: 'probe',
  after: 'reboot',
  address: 'devices/dev-1/status',
  match: [
    { kind: 'equals', extractor: { kind: 'json-path', path: '$.state' }, value: 'rebooting' },
    { kind: 'equals', extractor: { kind: 'json-path', path: '$.command' }, value: '{{step.reboot.command}}' },
  ],
  timeoutMs: 5_000,
  captures: [{ name: 'state', extractor: { kind: 'json-path', path: '$.state' } }],
};

/** Scenario 1: a reboot commanded over HTTP, acknowledged over MQTT. */
async function rebootSteps(): Promise<Record<string, unknown>[]> {
  await saveProbe();
  const requestUid = await saveRequest('Reboot dev-1', 'POST', 'https://api.openheaders.io/devices/dev-1/reboot');
  return [LISTEN, rebootCall(requestUid), STATUS];
}

const stored = (): LiveWorkflow[] => snapshotLiveWorkflowPostStates(wsId).map((ps) => ps.workflow);

beforeEach(() => {
  setHostLogger(consoleLogger);
  setHostStorage(createHostStorageFake());
  __initSyncServiceForTests(wsId);
});

afterEach(() => {
  disposeSyncService();
});

describe('authoring a workflow with session steps', () => {
  it('saves a listen, a call and an expect, minting the uid of every step and match row', async () => {
    const result = (await call('workflows_save', { workflow: { name: 'Reboot', steps: await rebootSteps() } })) as {
      workflow: { uid: string; stepCount: number; refresh: unknown };
    };

    expect(result.workflow.stepCount).toBe(3);
    expect(result.workflow.refresh).toEqual({ kind: 'manual' });
    const [workflow] = stored();
    expect(workflow.steps.map((step) => step.id)).toEqual(['probe', 'reboot', 'status']);
    for (const step of workflow.steps) expect(step.uid).toMatch(MINTED_UID);
    const [listen, , expectStep] = workflow.steps;
    if (!isListenStep(listen) || !isExpectStep(expectStep)) throw new Error('the session steps were not kept');
    expect(listen).toMatchObject({ sessionRequestUid: 'mqttprob', timeoutMs: 5_000, captures: [] });
    expect(expectStep).toMatchObject({ on: 'probe', after: 'reboot', address: 'devices/dev-1/status' });
    expect(expectStep.match.map((row) => row.kind)).toEqual(['equals', 'equals']);
    for (const row of expectStep.match) expect(row.uid).toMatch(MINTED_UID);
    expect(expectStep.captures[0].uid).toMatch(MINTED_UID);
  });

  it('saves a send of a saved message ahead of a polled call', async () => {
    await saveProbe();
    const requestUid = await saveRequest('Device dev-1', 'GET', 'https://api.openheaders.io/devices/dev-1');
    const send = { id: 'rename', action: 'send', on: 'probe', messageUid: 'msgname1', captures: [] };
    const device = {
      id: 'device',
      requestUid,
      captures: [],
      successCriteria: [{ kind: 'equals', extractor: { kind: 'json-path', path: '$.name' }, value: 'John Doe' }],
      poll: { maxAttempts: 10, delayMs: 200 },
    };

    await call('workflows_save', { workflow: { name: 'Rename', steps: [LISTEN, send, device] } });

    expect(stored()[0].steps[1]).toMatchObject({ action: 'send', on: 'probe', messageUid: 'msgname1' });
  });

  it('keeps the row uids an agent hands back, and takes a change to a session step', async () => {
    const created = (await call('workflows_save', { workflow: { name: 'Reboot', steps: await rebootSteps() } })) as {
      workflow: { uid: string };
    };
    const before = stored()[0].steps;
    const patched = before.map((step) => (isExpectStep(step) ? { ...step, timeoutMs: 8_000 } : step));

    await call('workflows_save', { uid: created.workflow.uid, workflow: { steps: patched } });

    expect(stored()[0].steps).toEqual(patched);
  });
});

describe('what the model refuses, the save tool refuses by the same sentence', () => {
  it('refuses a listen on a request that is not an MQTT request', async () => {
    const requestUid = await saveRequest('Reboot dev-1', 'POST', 'https://api.openheaders.io/devices/dev-1/reboot');
    const listen = { ...LISTEN, sessionRequestUid: requestUid };

    const authoring = call('workflows_save', { workflow: { name: 'Probe', steps: [listen] } });

    await expect(authoring).rejects.toThrow(McpToolInputError);
    await expect(authoring).rejects.toThrow(
      'invalid workflow: Step "probe" names a session request that is not an MQTT request in this workspace.',
    );
    expect(stored()).toEqual([]);
  });

  it('refuses a send on a step that is not a listen', async () => {
    const [listen, reboot] = await rebootSteps();
    const send = { id: 'rename', action: 'send', on: 'reboot', messageUid: 'msgname1', captures: [] };

    await expect(
      call('workflows_save', { workflow: { name: 'Rename', steps: [listen, reboot, send] } }),
    ).rejects.toThrow('invalid workflow: Step "rename" names "reboot" as its session, which is not a listen step.');
    expect(stored()).toEqual([]);
  });

  it('refuses an expect that passes over stored messages where its session blurs the mark', async () => {
    await saveProbe({
      protocolVersion: '5.0',
      topics: [{ uid: 'rowdevc1', topicFilter: 'devices/dev-1/#', retainAsPublished: true }],
    });
    const requestUid = await saveRequest('Reboot dev-1', 'POST', 'https://api.openheaders.io/devices/dev-1/reboot');

    await expect(
      call('workflows_save', { workflow: { name: 'Reboot', steps: [LISTEN, rebootCall(requestUid), STATUS] } }),
    ).rejects.toThrow(
      'invalid workflow: Step "status" passes over stored messages, but "Probe MQTT" subscribes to devices/dev-1/# with Retain As Published on, so a live message can look stored.',
    );
  });

  it('refuses a refresh policy other than manual, at the create and on a patch', async () => {
    const steps = await rebootSteps();
    const sentence =
      'invalid workflow: A workflow with a session step is refreshed by hand; this one\'s refresh policy is "interval".';

    await expect(
      call('workflows_save', { workflow: { name: 'Reboot', steps, refresh: { kind: 'interval', seconds: 60 } } }),
    ).rejects.toThrow(sentence);
    const created = (await call('workflows_save', { workflow: { name: 'Reboot', steps } })) as {
      workflow: { uid: string };
    };
    await expect(
      call('workflows_save', { uid: created.workflow.uid, workflow: { refresh: { kind: 'interval', seconds: 60 } } }),
    ).rejects.toThrow(sentence);
    expect(stored()[0].refresh).toEqual({ kind: 'manual' });
  });
});

describe('a workflow that holds a session gives a verdict', () => {
  const sentence =
    "'exposes' cannot bind — a workflow with session steps gives a verdict; its captures are not exposed as live variables.";

  it('takes no exposes at the create, and saves nothing', async () => {
    const authoring = call('workflows_save', {
      workflow: { name: 'Reboot', steps: await rebootSteps() },
      exposes: [{ name: 'rebootCommand', stepId: 'reboot', captureName: 'command' }],
    });

    await expect(authoring).rejects.toThrow(sentence);
    expect(stored()).toEqual([]);
    expect(snapshotLiveVariablePostStates(wsId)).toEqual([]);
  });

  it('takes none on a patch either', async () => {
    const created = (await call('workflows_save', { workflow: { name: 'Reboot', steps: await rebootSteps() } })) as {
      workflow: { uid: string };
    };

    await expect(
      call('workflows_save', {
        uid: created.workflow.uid,
        workflow: {},
        exposes: [{ name: 'deviceState', stepId: 'status', captureName: 'state' }],
      }),
    ).rejects.toThrow(sentence);
    expect(snapshotLiveVariablePostStates(wsId)).toEqual([]);
  });
});

describe('a step of an action the model does not know', () => {
  const WATCH = { uid: 'stpwatch', id: 'probe', action: 'watch', session: 'mqttreq1' };

  it('is still refused by name when it is authored', async () => {
    await expect(call('workflows_save', { workflow: { name: 'Probe', steps: [WATCH] } })).rejects.toThrow(
      'invalid workflow: Step "probe" needs a newer version of OpenHeaders (action "watch").',
    );
    expect(stored()).toEqual([]);
  });

  it('still keeps its workflow read-only', async () => {
    const workflow: LiveWorkflow = v.parse(LiveWorkflowSchema, {
      schemaVersion: 5,
      uid: 'wfdevice',
      path: 'live-workflows/probe-wfdevice',
      name: 'Probe',
      steps: [WATCH],
      refresh: { kind: 'manual' },
      enabled: true,
      published: true,
    });
    await applyMcpMutation(buildAddLiveWorkflowBatch(workflow, mintMcpContext(wsId)));

    await call('workflows_save', { uid: 'wfdevice', workflow: { name: 'Probe dev-1' } });
    await expect(call('workflows_save', { uid: 'wfdevice', workflow: { steps: [LISTEN] } })).rejects.toThrow(
      /it cannot change steps\./,
    );
    expect(stored()[0]).toMatchObject({ name: 'Probe dev-1', steps: workflow.steps });
  });
});

describe('what the tool says of itself', () => {
  const descriptionOf = (definitions: McpToolDefinition[]): string =>
    definitions.find((tool) => tool.name === 'workflows_save')?.description ?? '';

  it('names the session steps only in a build that authors them', () => {
    expect(descriptionOf(createWriteToolDefinitions())).not.toContain('listen');
    expect(descriptionOf(createWriteToolDefinitions({ workflowSessionAuthoring: true }))).toContain(
      'A step with an action works on an MQTT session instead of sending a request',
    );
  });
});
