/**
 * A workflow with session steps on a node host (the workflow runs plan,
 * The model — the two device scenarios).
 *
 * The real chain runner, the real MQTT executor and both real Node
 * transports against a loopback backend and its broker, which speaks
 * through the same `@openheaders/core/mqtt` codec at 3.1.1: a reboot is
 * commanded over HTTP and the device answers on its status topic; a name
 * published by the device is stored by the backend a moment later.
 */

import 'reflect-metadata';
import { createServer as createHttpServer, type Server as HttpServer } from 'node:http';
import * as net from 'node:net';
import { setHostLogger } from '@openheaders/core/logger';
import {
  createMqttStreamDecoder,
  encodeMqttPacket,
  MQTT_PROTOCOL_VERSIONS,
  type MqttPacket,
  topicMatchesFilter,
} from '@openheaders/core/mqtt';
import { setHostStorage } from '@openheaders/core/storage';
import { buildAddLiveWorkflowBatch } from '@openheaders/core/sync-builders/mutations/live-workflow-mutations';
import { buildMqttAddBatch } from '@openheaders/core/sync-builders/mutations/mqtt-request-mutations';
import type { LiveWorkflow, MqttRequest, WorkflowStep } from '@openheaders/core/types';
import { logger as consoleLogger } from '@openheaders/core/utils';
import { getWorkflowRunCache } from '@openheaders/oracle/live/live-cache-store';
import {
  __configureRateLimiterForTests,
  __resetRateLimiterForTests,
} from '@openheaders/oracle/live/request-exec/rate-limiter';
import { __initSyncServiceForTests, dispose as disposeSyncService } from '@openheaders/oracle/sync/service';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runWorkflowRefresh } from '../../src/daemon/live/chain-runner';
import { type HostScriptRunOptions, setHostScriptCapabilities } from '../../src/daemon/script-capability';
import type { McpToolDefinition } from '../../src/mcp/registry';
import { applyMcpMutation, mintMcpContext } from '../../src/mcp/tools/common';
import { createWriteToolDefinitions } from '../../src/mcp/tools/write-tools';
import { createHostStorageFake } from './_host-storage-fake';

const wsId = 'ws-devices';
const WORKFLOW_UID = 'wfdevice';
const CTX = { tokenId: 'token-1', userId: 'user-1' };
const VERSION = MQTT_PROTOCOL_VERSIONS.v311;
const DEVICE_ACK_MS = 30;
const DEVICE_STORE_MS = 150;

// ── The backend, its broker and its one device ──────────────────────

let http: HttpServer;
let broker: net.Server;
let httpPort = 0;
let brokerPort = 0;
/** What the broker saw of its clients, in order. */
let seen: string[] = [];
let gets = 0;
let deviceName: string | null = null;
let refuseSubscriptions = false;
const subscribers = new Map<net.Socket, string[]>();

function write(socket: net.Socket, packet: MqttPacket): void {
  const encoded = encodeMqttPacket(packet, VERSION);
  if (!encoded.ok) throw new Error(encoded.error);
  socket.write(encoded.bytes);
}

function publishFromBackend(topic: string, body: Record<string, string>): void {
  const payload = new TextEncoder().encode(JSON.stringify(body));
  for (const [socket, filters] of subscribers) {
    if (!filters.some((filter) => topicMatchesFilter(topic, filter))) continue;
    write(socket, { type: 'publish', topic, payload, qos: 0, retain: false, dup: false, packetId: null });
  }
}

function brokerAnswer(socket: net.Socket, packet: MqttPacket): void {
  switch (packet.type) {
    case 'connect':
      seen.push('connect');
      write(socket, { type: 'connack', sessionPresent: false, reasonCode: 0 });
      return;
    case 'subscribe': {
      const filters = packet.subscriptions.map((subscription) => subscription.topicFilter);
      seen.push(`subscribe ${filters.join(',')}`);
      if (!refuseSubscriptions) subscribers.set(socket, filters);
      write(socket, {
        type: 'suback',
        packetId: packet.packetId,
        reasonCodes: filters.map(() => (refuseSubscriptions ? 0x80 : 0)),
      });
      return;
    }
    case 'publish': {
      const body = new TextDecoder().decode(packet.payload);
      seen.push(`publish ${packet.topic} ${body}`);
      if (packet.packetId !== null) write(socket, { type: 'puback', packetId: packet.packetId, reasonCode: null });
      if (packet.topic === 'devices/dev-1/name') {
        const { name } = JSON.parse(body) as { name: string };
        setTimeout(() => {
          deviceName = name;
        }, DEVICE_STORE_MS);
      }
      return;
    }
    case 'disconnect':
      seen.push('disconnect');
      subscribers.delete(socket);
      socket.end();
      return;
    default:
      return;
  }
}

beforeAll(async () => {
  broker = net.createServer((socket) => {
    const decoder = createMqttStreamDecoder(VERSION);
    socket.on('error', () => {});
    socket.on('close', () => subscribers.delete(socket));
    socket.on('data', (chunk) => {
      for (const event of decoder.push(new Uint8Array(chunk))) {
        if (!event.ok) throw new Error(`broker saw a malformed packet: ${event.error}`);
        brokerAnswer(socket, event.packet);
      }
    });
  });
  await new Promise<void>((resolve) => broker.listen(0, '127.0.0.1', () => resolve()));
  brokerPort = (broker.address() as net.AddressInfo).port;

  http = createHttpServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.method === 'POST' && req.url === '/api/devices/dev-1/reboot') {
      publishFromBackend('devices/dev-1/commands', { command: 'reboot' });
      setTimeout(
        () => publishFromBackend('devices/dev-1/status', { state: 'rebooting', command: 'reboot' }),
        DEVICE_ACK_MS,
      );
      res.statusCode = 202;
      res.end(JSON.stringify({ id: 'dev-1', command: 'reboot' }));
      return;
    }
    gets += 1;
    res.end(JSON.stringify({ id: 'dev-1', name: deviceName }));
  });
  await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', () => resolve()));
  httpPort = (http.address() as net.AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((resolve) => http.close(() => resolve()));
  await new Promise<void>((resolve) => broker.close(() => resolve()));
});

// ── The workspace ───────────────────────────────────────────────────

const tools = new Map<string, McpToolDefinition>(createWriteToolDefinitions().map((tool) => [tool.name, tool]));

async function saveRequest(request: Record<string, unknown>): Promise<string> {
  const tool = tools.get('requests_save');
  if (!tool) throw new Error('missing tool requests_save');
  const result = (await tool.handler({ workspaceId: wsId, request }, CTX)) as { request: { uid: string } };
  return result.request.uid;
}

async function saveProbe(overrides: Partial<MqttRequest> = {}): Promise<void> {
  const probe: MqttRequest = {
    schemaVersion: 5,
    uid: 'mqttprob',
    path: 'requests/probe-mqtt-mqttprob',
    name: 'Probe MQTT',
    url: `mqtt://127.0.0.1:${brokerPort}`,
    protocolVersion: '3.1.1',
    topic: '',
    payload: '',
    topics: [{ uid: 'rowdevc1', topicFilter: 'devices/dev-1/#' }],
    savedMessages: [
      {
        uid: 'msgname1',
        name: 'Set name',
        topic: 'devices/dev-1/name',
        payload: '{"name":"n-{{dynamic.uuid}}"}',
        format: 'json',
        qos: 1,
      },
    ],
    userProperties: [],
    ...overrides,
  };
  await applyMcpMutation(buildMqttAddBatch(probe, mintMcpContext(wsId), null));
}

const LISTEN: WorkflowStep = {
  uid: 'stplistn',
  id: 'probe',
  action: 'listen',
  sessionRequestUid: 'mqttprob',
  timeoutMs: 5_000,
  captures: [],
};

async function rebootStep(): Promise<WorkflowStep> {
  return {
    uid: 'stpreboo',
    id: 'reboot',
    requestUid: await saveRequest({
      name: 'Reboot dev-1',
      method: 'POST',
      url: `http://127.0.0.1:${httpPort}/api/devices/dev-1/reboot`,
    }),
    captures: [{ uid: 'capcmd00', name: 'command', extractor: { kind: 'json-path', path: '$.command' } }],
  };
}

function statusStep(overrides: Record<string, unknown> = {}): WorkflowStep {
  return {
    uid: 'stpexpct',
    id: 'status',
    action: 'expect',
    on: 'probe',
    after: 'reboot',
    address: 'devices/dev-1/status',
    match: [
      { kind: 'equals', uid: 'crtstate', extractor: { kind: 'json-path', path: '$.state' }, value: 'rebooting' },
      {
        kind: 'equals',
        uid: 'crtcmd00',
        extractor: { kind: 'json-path', path: '$.command' },
        value: '{{step.reboot.command}}',
      },
    ],
    timeoutMs: 5_000,
    captures: [{ uid: 'capstate', name: 'state', extractor: { kind: 'json-path', path: '$.state' } }],
    ...overrides,
  };
}

async function seedWorkflow(
  steps: WorkflowStep[],
  refresh: LiveWorkflow['refresh'] = { kind: 'manual' },
): Promise<LiveWorkflow> {
  const workflow: LiveWorkflow = {
    schemaVersion: 5,
    uid: WORKFLOW_UID,
    path: `live-workflows/device-${WORKFLOW_UID}`,
    name: 'Device',
    steps,
    refresh,
    enabled: true,
    published: true,
  };
  await applyMcpMutation(buildAddLiveWorkflowBatch(workflow, mintMcpContext(wsId)));
  return workflow;
}

const run = (workflow: LiveWorkflow) => runWorkflowRefresh({ workspaceId: wsId, workflow, environmentId: null });

beforeEach(() => {
  setHostLogger(consoleLogger);
  setHostStorage(createHostStorageFake());
  __initSyncServiceForTests(wsId);
  __resetRateLimiterForTests();
  __configureRateLimiterForTests({ maxConcurrent: 8, maxPerMinute: 1_000 });
  seen = [];
  gets = 0;
  deviceName = null;
  refuseSubscriptions = false;
});

afterEach(() => {
  __resetRateLimiterForTests();
  disposeSyncService();
});

// ── The scenarios ───────────────────────────────────────────────────

describe('a reboot commanded over HTTP, acknowledged over MQTT', () => {
  it('passes as one workflow, commits every step’s captures at once and closes its session cleanly', async () => {
    await saveProbe();
    const workflow = await seedWorkflow([LISTEN, await rebootStep(), statusStep()]);

    expect(await run(workflow)).toEqual({ ok: true, skippedStepIds: [] });

    const cache = await getWorkflowRunCache(WORKFLOW_UID, null, wsId);
    expect(cache?.stepCaptures).toEqual({ probe: {}, reboot: { command: 'reboot' }, status: { state: 'rebooting' } });
    expect(cache?.stepOutcomes).toEqual({ probe: 'completed', reboot: 'completed', status: 'completed' });
    expect(Object.keys(cache?.stepResponseBytes ?? {})).toEqual(['reboot']);
    expect(seen).toEqual(['connect', 'subscribe devices/dev-1/#', 'disconnect']);
  });

  it('fails the expect at its deadline, naming what it waited for, and still closes its session', async () => {
    await saveProbe();
    const workflow = await seedWorkflow([
      LISTEN,
      await rebootStep(),
      statusStep({ address: 'devices/dev-1/health', timeoutMs: 200 }),
    ]);

    expect(await run(workflow)).toEqual({
      ok: false,
      failedStepId: 'status',
      failedPhase: 'expect',
      message: 'No message on devices/dev-1/health matched within 200 ms of "reboot" starting.',
    });

    const cache = await getWorkflowRunCache(WORKFLOW_UID, null, wsId);
    expect(cache?.stepCaptures ?? {}).toEqual({});
    expect(cache?.lastErrorStepId).toBe('status');
    expect(seen.at(-1)).toBe('disconnect');
  });

  it('fails the listen by the filter when the broker refuses the subscription, and commands nothing', async () => {
    refuseSubscriptions = true;
    await saveProbe();
    const workflow = await seedWorkflow([LISTEN, await rebootStep(), statusStep()]);

    expect(await run(workflow)).toEqual({
      ok: false,
      failedStepId: 'probe',
      failedPhase: 'listen',
      message: 'The broker refused the subscription to devices/dev-1/# (code 128).',
    });
    expect(seen).toEqual(['connect', 'subscribe devices/dev-1/#', 'disconnect']);
  });
});

describe('a name published by the device, stored by the backend a moment later', () => {
  it('passes as one workflow whose only wait is the call’s poll', async () => {
    await saveProbe();
    const device = await saveRequest({ name: 'Device', url: `http://127.0.0.1:${httpPort}/api/devices/dev-1` });
    const workflow = await seedWorkflow([
      LISTEN,
      {
        uid: 'stpsend0',
        id: 'rename',
        action: 'send',
        on: 'probe',
        messageUid: 'msgname1',
        captures: [{ uid: 'capname0', name: 'name', extractor: { kind: 'json-path', path: '$.name' } }],
      },
      {
        uid: 'stpdevic',
        id: 'device',
        requestUid: device,
        captures: [],
        successCriteria: [
          {
            kind: 'equals',
            uid: 'crtname0',
            extractor: { kind: 'json-path', path: '$.name' },
            value: '{{step.rename.name}}',
          },
        ],
        poll: { maxAttempts: 10, delayMs: 100 },
      },
    ]);

    expect(await run(workflow)).toEqual({ ok: true, skippedStepIds: [] });

    const cache = await getWorkflowRunCache(WORKFLOW_UID, null, wsId);
    const sent = cache?.stepCaptures.rename?.name;
    expect(sent).toMatch(/^n-.+/);
    expect(deviceName).toBe(sent);
    expect(seen).toEqual([
      'connect',
      'subscribe devices/dev-1/#',
      `publish devices/dev-1/name {"name":"${sent}"}`,
      'disconnect',
    ]);
    expect(gets).toBeGreaterThan(1);
  });
});

describe('a run this host refuses before its first step', () => {
  it('refuses a listen on a request that is not an MQTT request, and sends nothing', async () => {
    const workflow = await seedWorkflow([LISTEN, await rebootStep(), statusStep()]);

    expect(await run(workflow)).toEqual({
      ok: false,
      failedStepId: 'probe',
      failedPhase: 'unsupported',
      message: 'Step "probe" names a session request that is not an MQTT request in this workspace.',
    });
    expect(seen).toEqual([]);
    const cache = await getWorkflowRunCache(WORKFLOW_UID, null, wsId);
    expect(cache?.lastErrorStepId).toBe('probe');
  });

  it('refuses what the model’s validator refuses, by its sentence', async () => {
    await saveProbe();
    const workflow = await seedWorkflow([LISTEN, await rebootStep(), statusStep()], { kind: 'interval', seconds: 60 });

    expect(await run(workflow)).toMatchObject({
      ok: false,
      failedStepId: 'probe',
      failedPhase: 'unsupported',
      message: 'A workflow with a session step is refreshed by hand; this one\'s refresh policy is "interval".',
    });
    expect(seen).toEqual([]);
  });

  it('refuses a listen that asks for its session’s scripts', async () => {
    await saveProbe();
    const workflow = await seedWorkflow([{ ...LISTEN, runScripts: true }, await rebootStep(), statusStep()]);

    expect(await run(workflow)).toMatchObject({
      ok: false,
      failedPhase: 'unsupported',
      message: 'Step "probe" cannot run here: this host runs no script on a run\'s session.',
    });
    expect(seen).toEqual([]);
  });
});

describe('a listen that runs its request’s scripts, on a host with a script runtime', () => {
  const calls: HostScriptRunOptions[] = [];

  /** A Safe runtime that answers a Before connect per source and lets every other hook pass. */
  function installRuntime(beforeConnect: 'narrow' | 'error'): void {
    setHostScriptCapabilities({
      safe: {
        mode: 'safe',
        runScript: async (options) => {
          calls.push(options);
          const base = { executionId: 'e', assertions: [], consoleLog: [], durationMs: 1 };
          if (options.kind !== 'mqtt-before-connect') return { ...base, succeeded: true };
          if (beforeConnect === 'error') {
            return { ...base, succeeded: false, error: { name: 'Error', message: 'no key' } };
          }
          return {
            ...base,
            succeeded: true,
            sessionMutation: { kind: 'mqtt-connect', subscriptions: [{ topicFilter: 'devices/dev-1/status', qos: 0 }] },
          };
        },
        endSession: () => {},
      },
    });
  }

  beforeEach(() => {
    calls.length = 0;
  });

  afterEach(() => setHostScriptCapabilities(null));

  it('passes the scenario on the connection its Before connect left, every hook on the run’s tier', async () => {
    installRuntime('narrow');
    await saveProbe({ scripts: { 'mqtt-before-connect': 'narrow();', 'mqtt-on-message': 'check();' } });
    const workflow = await seedWorkflow([{ ...LISTEN, runScripts: true }, await rebootStep(), statusStep()]);

    expect(await run(workflow)).toEqual({ ok: true, skippedStepIds: [] });

    expect(seen).toEqual(['connect', 'subscribe devices/dev-1/status', 'disconnect']);
    expect(calls.map((call) => call.kind)).toEqual(['mqtt-before-connect', 'mqtt-on-message']);
    expect(calls.map((call) => call.hostContext)).toEqual(['chain', 'chain']);
  });

  it('fails the listen before anything is dialled when its Before connect errors, and commands nothing', async () => {
    installRuntime('error');
    await saveProbe({ scripts: { 'mqtt-before-connect': 'sign();' } });
    const workflow = await seedWorkflow([{ ...LISTEN, runScripts: true }, await rebootStep(), statusStep()]);

    expect(await run(workflow)).toEqual({
      ok: false,
      failedStepId: 'probe',
      failedPhase: 'listen',
      message: 'Before connect script failed at Request: no key',
    });
    expect(seen).toEqual([]);
  });

  it('runs no script for a listen that does not ask for them', async () => {
    installRuntime('error');
    await saveProbe({ scripts: { 'mqtt-before-connect': 'sign();' } });
    const workflow = await seedWorkflow([LISTEN, await rebootStep(), statusStep()]);

    expect(await run(workflow)).toEqual({ ok: true, skippedStepIds: [] });
    expect(calls).toEqual([]);
  });
});
