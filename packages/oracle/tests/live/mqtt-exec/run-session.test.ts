/**
 * The MQTT adapter behind the session port — over the REAL executor and
 * the real resolver, against the scripted transport (the entity stores
 * mocked): when a `listen` is ready and when it is refused, what a
 * message carries, a `send` done at the broker's acknowledgement under
 * the `listen` step's deadline, and a drop ending the session.
 */

import { decodeMqttPacket, encodeMqttPacket, MQTT_PROTOCOL_VERSIONS, type MqttPacket } from '@openheaders/core/mqtt';
import type { ListenWorkflowStep, MqttRequest, SendWorkflowStep } from '@openheaders/core/types';
import { describe, expect, it, vi } from 'vitest';
import { treeOracleFrom } from '../request-exec/tree-oracle';

vi.mock('../../../src/entity/environment-store', () => ({
  getActiveEnvironmentId: () => null,
  getDefaultEnvironmentId: () => null,
  getActiveEnvironmentIdForWorkspace: async () => null,
  getDefaultEnvironmentIdForWorkspace: async () => null,
  getEnvironments: () => [],
  getEnvironmentsForWorkspace: () => [],
  getVault: () => ({ schemaVersion: 5, secrets: [] }),
  getVaultForWorkspace: () => ({ schemaVersion: 5, secrets: [] }),
  getWorkspaceVariables: () => ({ schemaVersion: 5, variables: [] }),
  getWorkspaceVariablesForWorkspace: () => ({ schemaVersion: 5, variables: [] }),
}));
vi.mock('../../../src/entity/request-store', () => ({
  getRequest: () => null,
  getRequestInWorkspace: () => null,
  getRequestCollections: () => [],
  getRequestCollectionsForWorkspace: () => [],
  getRequestFolders: () => [],
  getRequestFoldersForWorkspace: () => [],
}));
vi.mock('../../../src/sync/service/accessors', () => ({
  getOracleForCurrentWorkspace: () => treeOracleFrom([], []).oracle,
  getOracleForWorkspace: () => treeOracleFrom([], []).oracle,
}));
vi.mock('../../../src/entity/rule-store', () => ({
  getCollections: () => [],
  getCollectionsForWorkspace: () => [],
}));
vi.mock('../../../src/entity/template-store', () => ({
  getTemplateCollections: () => [],
  getTemplateCollectionsForWorkspace: () => [],
}));
vi.mock('../../../src/entity/files-store', () => ({
  getFileBlob: async () => null,
  listFiles: async () => [],
}));
vi.mock('../../../src/rule-engine/variables-resolver', () => ({
  getLiveRegistrySnapshot: () => new Map(),
  getLiveRegistrySnapshotForWorkspace: () => new Map(),
}));
vi.mock('../../../src/entity/totp-cooldown-store', () => ({
  checkCooldown: () => ({ inCooldown: false }),
  recordUsage: () => {},
}));
vi.mock('../../../src/workspace/extension-workspace-store', () => ({
  getActiveWorkspaceId: () => 'ws-devices',
  peekActiveWorkspaceId: () => 'ws-devices',
}));
vi.mock('../../../src/entity/trusted-roots-store', () => ({
  getTrustedRootPemsForWorkspace: () => [],
}));
vi.mock('../../../src/entity/device-trust-store', () => ({
  getDeviceTrustPems: () => [],
}));

import type { SessionMessage, SessionOpenResult } from '@openheaders/core/live';
import type { ScriptExecutionResult } from '@openheaders/core/scripts';
import { createMqttRunSessionHost, type MqttRunSessionHostOptions } from '../../../src/live/mqtt-exec/run-session';
import {
  type MqttByteTransport,
  type MqttStreamCallbacks,
  MqttTransportError,
} from '../../../src/live/mqtt-exec/transport';
import type { SessionScriptHost, SessionScriptInput } from '../../../src/live/request-exec/script-hooks';

const PROBE: MqttRequest = {
  schemaVersion: 5,
  uid: 'mqttreq1',
  path: 'requests/devices-col1/probe-mqttreq1',
  name: 'Probe MQTT',
  url: 'mqtt://broker.openheaders.io:1883',
  clientId: 'probe-1',
  topic: '',
  payload: '',
  topics: [{ uid: 'row00001', topicFilter: 'devices/dev-1/#' }],
  savedMessages: [
    {
      uid: 'msgname1',
      name: 'Set name',
      topic: 'devices/dev-1/name',
      payload: '{"name":"{{step.reboot.command}}-1"}',
      format: 'json',
      qos: 1,
    },
  ],
  userProperties: [],
};

const LISTEN: ListenWorkflowStep = {
  uid: 'stplistn',
  id: 'probe',
  action: 'listen',
  sessionRequestUid: 'mqttreq1',
  timeoutMs: 10_000,
  captures: [],
};

const SEND: SendWorkflowStep = {
  uid: 'stpsend0',
  id: 'rename',
  action: 'send',
  on: 'probe',
  messageUid: 'msgname1',
  captures: [],
};

const CONTEXT = { workflowUid: 'wfdevice', workspaceId: 'ws-devices', environmentId: null };

function scriptedTransport() {
  const version = MQTT_PROTOCOL_VERSIONS.v5;
  let seenCallbacks: MqttStreamCallbacks | null = null;
  let connects = 0;
  let ended = false;
  const written: MqttPacket[] = [];
  const transport: MqttByteTransport = {
    connect(_request, callbacks, signal) {
      connects += 1;
      seenCallbacks = callbacks;
      const finish = (): void => {
        if (ended) return;
        ended = true;
        queueMicrotask(() => callbacks.onEnd());
      };
      signal?.addEventListener('abort', finish);
      return {
        write: (bytes) => {
          const decoded = decodeMqttPacket(bytes, version);
          if (!decoded.ok) throw new Error(`client wrote a malformed packet: ${decoded.error}`);
          written.push(decoded.packet);
        },
        end: finish,
      };
    },
  };
  const callbacks = (): MqttStreamCallbacks => {
    if (seenCallbacks === null) throw new Error('connect never reached the transport');
    return seenCallbacks;
  };
  return {
    transport,
    written,
    connects: () => connects,
    establish: () => callbacks().onConnect(),
    push: (packet: MqttPacket) => {
      const encoded = encodeMqttPacket(packet, version);
      if (!encoded.ok) throw new Error(`broker packet did not encode: ${encoded.error}`);
      callbacks().onData(encoded.bytes);
    },
    sever: (error?: MqttTransportError) => {
      ended = true;
      callbacks().onEnd(error);
    },
  };
}

const settleTick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const text = (value: string): Uint8Array => new TextEncoder().encode(value);

/** A `listen` being opened: the socket is up and the CONNECT written, the broker has not answered. */
async function opening(request: MqttRequest = PROBE, over: Partial<MqttRunSessionHostOptions> = {}) {
  const rig = scriptedTransport();
  const messages: SessionMessage[] = [];
  const ended: string[] = [];
  const stepCaptures = new Map<string, Map<string, string>>();
  const deadline = new AbortController();
  const waits: number[] = [];
  let passDeadline: () => void = () => {};
  const host = createMqttRunSessionHost({
    workspaceId: 'ws-devices',
    environmentId: null,
    transport: rig.transport,
    findRequest: (uid) => (uid === request.uid ? request : null),
    timer: (ms) =>
      new Promise<void>((resolve) => {
        waits.push(ms);
        passDeadline = resolve;
      }),
    ...over,
  });
  const opened = host.open(LISTEN, {
    stepCaptures,
    context: CONTEXT,
    signal: deadline.signal,
    onMessage: (message) => messages.push(message),
    onEnded: (reason) => ended.push(reason),
  });
  await settleTick();
  rig.establish();
  const grant = (...reasonCodes: number[]): void => {
    rig.push({ type: 'connack', sessionPresent: false, reasonCode: 0 });
    const subscribe = rig.written.at(-1);
    if (subscribe?.type !== 'subscribe') throw new Error('expected the open-time SUBSCRIBE');
    rig.push({ type: 'suback', packetId: subscribe.packetId, reasonCodes });
  };
  /** The open session, or a throw naming why there is none. */
  const session = async () => {
    const result: SessionOpenResult = await opened;
    if (!result.ok) throw new Error(`not opened: ${result.reason}`);
    return result.session;
  };
  return {
    rig,
    messages,
    ended,
    stepCaptures,
    deadline,
    waits,
    opened,
    grant,
    session,
    passDeadline: () => passDeadline(),
  };
}

describe('a listen on an MQTT request', () => {
  it('is ready once the broker has granted what the session subscribes to as it opens', async () => {
    const listen = await opening();
    let answered = false;
    void listen.opened.then(() => {
      answered = true;
    });
    listen.rig.push({ type: 'connack', sessionPresent: false, reasonCode: 0 });
    await settleTick();
    expect(answered).toBe(false);

    const subscribe = listen.rig.written.at(-1);
    if (subscribe?.type !== 'subscribe') throw new Error('expected the open-time SUBSCRIBE');
    listen.rig.push({ type: 'suback', packetId: subscribe.packetId, reasonCodes: [0] });

    expect((await listen.opened).ok).toBe(true);
    await (await listen.session()).end();
  });

  it('is refused by the filter and the reason when the broker refuses a subscription', async () => {
    const listen = await opening();
    listen.grant(0x87);

    expect(await listen.opened).toEqual({
      ok: false,
      reason: 'The broker refused the subscription to devices/dev-1/#: Not authorized (code 135).',
    });
    await settleTick();
    expect(listen.rig.written.at(-1)?.type).toBe('disconnect');
    expect(listen.ended).toEqual([]);
  });

  it('is refused in the broker’s own words when the connection is', async () => {
    const listen = await opening();
    listen.rig.push({ type: 'connack', sessionPresent: false, reasonCode: 0x87 });

    expect(await listen.opened).toEqual({
      ok: false,
      reason: 'The broker refused the connection: Not authorized (code 135).',
    });
  });

  it('is refused when the workspace holds no such request', async () => {
    const host = createMqttRunSessionHost({
      workspaceId: 'ws-devices',
      environmentId: null,
      transport: scriptedTransport().transport,
      findRequest: () => null,
    });
    const opened = await host.open(LISTEN, {
      stepCaptures: new Map(),
      context: CONTEXT,
      signal: new AbortController().signal,
      onMessage: () => {},
      onEnded: () => {},
    });
    expect(opened).toEqual({ ok: false, reason: 'Session request mqttreq1 was not found.' });
  });

  it('stops dialing when the step’s deadline passes first', async () => {
    const listen = await opening();
    listen.deadline.abort();

    expect(await listen.opened).toEqual({ ok: false, reason: 'The session was stopped before it opened.' });
    expect(listen.ended).toEqual([]);
  });
});

describe('a message on a run’s session', () => {
  it('carries its topic as its address and its fields, and a retained one is stored', async () => {
    const listen = await opening();
    listen.grant(0);
    const session = await listen.session();
    expect(session.position()).toBe(1);

    listen.rig.push({
      type: 'publish',
      topic: 'devices/dev-1/status',
      payload: text('{"state":"online"}'),
      qos: 0,
      retain: true,
      dup: false,
      packetId: null,
    });
    listen.rig.push({
      type: 'publish',
      topic: 'devices/dev-1/status',
      payload: text('{"state":"rebooting"}'),
      qos: 1,
      retain: false,
      dup: false,
      packetId: 9,
      properties: {
        correlationData: text('cmd-1'),
        responseTopic: 'devices/dev-1/replies',
        contentType: 'application/json',
        userProperties: [
          { key: 'owner', value: 'John Doe' },
          { key: 'topic', value: 'shadowed' },
        ],
      },
    });

    expect(listen.messages).toEqual([
      {
        position: 1,
        at: expect.any(Number),
        address: 'devices/dev-1/status',
        body: '{"state":"online"}',
        fields: [
          { key: 'topic', value: 'devices/dev-1/status' },
          { key: 'qos', value: '0' },
          { key: 'retain', value: 'true' },
        ],
        stored: true,
      },
      {
        position: 2,
        at: expect.any(Number),
        address: 'devices/dev-1/status',
        body: '{"state":"rebooting"}',
        fields: [
          { key: 'topic', value: 'devices/dev-1/status' },
          { key: 'qos', value: '1' },
          { key: 'retain', value: 'false' },
          { key: 'response-topic', value: 'devices/dev-1/replies' },
          { key: 'correlation-data', value: 'cmd-1' },
          { key: 'content-type', value: 'application/json' },
          { key: 'owner', value: 'John Doe' },
          { key: 'topic', value: 'shadowed' },
        ],
        stored: false,
      },
    ]);
    expect(session.position()).toBe(3);
    expect(session.matchesAddress('devices/+/status', listen.messages[0])).toBe(true);
    expect(session.matchesAddress('devices/dev-2/#', listen.messages[0])).toBe(false);
    await session.end();
  });

  it('carries bytes that are not text as base64', async () => {
    const listen = await opening();
    listen.grant(0);
    listen.rig.push({
      type: 'publish',
      topic: 'devices/dev-1/blob',
      payload: new Uint8Array([0xff, 0xfe, 0x00]),
      qos: 0,
      retain: false,
      dup: false,
      packetId: null,
    });

    expect(listen.messages[0]).toMatchObject({ body: '//4A', bodyEncoding: 'base64' });
    await (await listen.session()).end();
  });
});

describe('a send on a run’s session', () => {
  it('publishes the saved message with the run’s captures and is done at the broker’s acknowledgement', async () => {
    const listen = await opening();
    listen.grant(0);
    const session = await listen.session();
    listen.stepCaptures.set('reboot', new Map([['command', 'reboot']]));

    const sending = session.send(SEND);
    await settleTick();
    const publish = listen.rig.written.at(-1);
    if (publish?.type !== 'publish' || publish.packetId === null) throw new Error('expected a QoS 1 PUBLISH');
    expect(publish.topic).toBe('devices/dev-1/name');
    expect(new TextDecoder().decode(publish.payload)).toBe('{"name":"reboot-1"}');
    expect(listen.waits).toEqual([10_000]);

    listen.rig.push({ type: 'puback', packetId: publish.packetId, reasonCode: 0 });

    expect(await sending).toEqual({
      ok: true,
      message: {
        position: 1,
        at: expect.any(Number),
        address: 'devices/dev-1/name',
        body: '{"name":"reboot-1"}',
        fields: [
          { key: 'topic', value: 'devices/dev-1/name' },
          { key: 'qos', value: '1' },
          { key: 'retain', value: 'false' },
        ],
        stored: false,
      },
      ackMs: expect.any(Number),
    });
    await session.end();
  });

  it('fails by name when the broker refuses the publish', async () => {
    const listen = await opening();
    listen.grant(0);
    const session = await listen.session();
    const sending = session.send(SEND);
    await settleTick();
    const publish = listen.rig.written.at(-1);
    if (publish?.type !== 'publish' || publish.packetId === null) throw new Error('expected a QoS 1 PUBLISH');

    listen.rig.push({ type: 'puback', packetId: publish.packetId, reasonCode: 0x87 });

    expect(await sending).toEqual({
      ok: false,
      reason: 'The broker refused the publish: Not authorized (code 135).',
    });
    await session.end();
  });

  it('fails at the listen step’s deadline when the broker never acknowledges', async () => {
    const listen = await opening();
    listen.grant(0);
    const session = await listen.session();
    const sending = session.send(SEND);
    await settleTick();

    listen.passDeadline();

    expect(await sending).toEqual({
      ok: false,
      reason: 'The broker did not acknowledge the publish within 10 s.',
    });
    await session.end();
  });

  it('fails by name for a message the request does not hold, and for an end of input', async () => {
    const listen = await opening();
    listen.grant(0);
    const session = await listen.session();

    expect(await session.send({ ...SEND, messageUid: 'msggone0' })).toEqual({
      ok: false,
      reason: 'Message msggone0 is not saved on "Probe MQTT".',
    });
    await expect(session.endInput()).rejects.toThrow('An MQTT session has no end of input.');
    await session.end();
  });
});

describe('the end of a run’s session', () => {
  it('is a clean DISCONNECT that tells the run nothing ended on its own', async () => {
    const listen = await opening();
    listen.grant(0);
    const session = await listen.session();

    expect(await session.end()).toEqual({});
    expect(listen.rig.written.at(-1)?.type).toBe('disconnect');
    expect(listen.ended).toEqual([]);
  });

  it('is told to the run when the connection drops, and nothing redials', async () => {
    const listen = await opening({ ...PROBE, autoReconnect: true });
    listen.grant(0);
    await listen.session();

    listen.rig.sever(new MqttTransportError('read ECONNRESET'));
    await settleTick();

    expect(listen.ended).toEqual(['The connection dropped: read ECONNRESET']);
    expect(listen.rig.connects()).toBe(1);
  });

  it('is told by the broker’s reason when the broker disconnects', async () => {
    const listen = await opening();
    listen.grant(0);
    await listen.session();

    listen.rig.push({ type: 'disconnect', reasonCode: 0x8e });
    await settleTick();

    expect(listen.ended).toEqual(['The broker disconnected: Session taken over (code 142).']);
  });
});

describe('how a run’s session opened', () => {
  it('is said for the request’s own client id on a clean start', async () => {
    const listen = await opening();
    listen.grant(0);

    expect(await listen.opened).toMatchObject({
      ok: true,
      facts: { identityGenerated: false, cleanStart: true, resumed: false, granted: 1 },
    });
    await (await listen.session()).end();
  });

  it('is said for a generated client id and a stored session the broker resumed', async () => {
    const listen = await opening({ ...PROBE, clientId: '', cleanStart: false });
    listen.rig.push({ type: 'connack', sessionPresent: true, reasonCode: 0 });
    const subscribe = listen.rig.written.at(-1);
    if (subscribe?.type !== 'subscribe') throw new Error('expected the open-time SUBSCRIBE');
    listen.rig.push({ type: 'suback', packetId: subscribe.packetId, reasonCodes: [0] });

    expect(await listen.opened).toMatchObject({
      ok: true,
      facts: { identityGenerated: true, cleanStart: false, resumed: true, granted: 1 },
    });
    await (await listen.session()).end();
  });
});

describe('a listen that runs its request’s scripts', () => {
  const SCRIPTED: MqttRequest = {
    ...PROBE,
    scripts: { 'mqtt-before-connect': 'sign();', 'mqtt-on-message': 'check();', 'mqtt-after-close': 'bye();' },
  };
  const ran = (over: Partial<ScriptExecutionResult> = {}): ScriptExecutionResult => ({
    executionId: 'e',
    succeeded: true,
    assertions: [],
    consoleLog: [],
    durationMs: 1,
    ...over,
  });
  /** A run that threw, as the runtime reports it: the error, and its own row among the tests. */
  const failed = (message: string): ScriptExecutionResult =>
    ran({
      succeeded: false,
      error: { name: 'Error', message },
      assertions: [{ name: 'script error', passed: false, message }],
    });

  /** A listen being opened over a script host that answers per source; `null` = a host that runs no script. */
  function scripted(
    step: ListenWorkflowStep,
    answers: Record<string, (input: SessionScriptInput) => ScriptExecutionResult> | null,
  ) {
    const rig = scriptedTransport();
    const sources: string[] = [];
    const scriptHost: SessionScriptHost = {
      mode: 'safe',
      run: async (input) => {
        sources.push(input.source);
        return answers?.[input.source]?.(input) ?? ran();
      },
      endSession: () => {},
    };
    const resolveScriptHost = vi.fn(async () => (answers === null ? null : scriptHost));
    const host = createMqttRunSessionHost({
      workspaceId: 'ws-devices',
      environmentId: null,
      transport: rig.transport,
      findRequest: () => SCRIPTED,
      resolveScriptHost,
    });
    const opened = host.open(step, {
      stepCaptures: new Map(),
      context: CONTEXT,
      signal: new AbortController().signal,
      onMessage: () => {},
      onEnded: () => {},
    });
    /** The broker accepts the connection and grants the open-time SUBSCRIBE. */
    const accept = async (): Promise<void> => {
      await settleTick();
      rig.establish();
      rig.push({ type: 'connack', sessionPresent: false, reasonCode: 0 });
      const subscribe = rig.written.at(-1);
      if (subscribe?.type !== 'subscribe') throw new Error('expected the open-time SUBSCRIBE');
      rig.push({ type: 'suback', packetId: subscribe.packetId, reasonCodes: [0] });
    };
    const session = async () => {
      const result: SessionOpenResult = await opened;
      if (!result.ok) throw new Error(`not opened: ${result.reason}`);
      return result.session;
    };
    const publish = (payload: string): void =>
      rig.push({
        type: 'publish',
        topic: 'devices/dev-1/status',
        payload: text(payload),
        qos: 0,
        retain: false,
        dup: false,
        packetId: null,
      });
    return { rig, sources, resolveScriptHost, opened, accept, session, publish };
  }

  const WITH_SCRIPTS: ListenWorkflowStep = { ...LISTEN, runScripts: true };

  it('connects as its Before connect script left the connection', async () => {
    const listen = scripted(WITH_SCRIPTS, {
      'sign();': () => ran({ sessionMutation: { kind: 'mqtt-connect', password: 'signed' } }),
    });
    await listen.accept();

    const connect = listen.rig.written[0];
    if (connect.type !== 'connect') throw new Error('expected CONNECT');
    expect(connect.password === undefined ? null : new TextDecoder().decode(connect.password)).toBe('signed');
    expect(listen.resolveScriptHost).toHaveBeenCalledTimes(1);
    expect(await (await listen.session()).end()).toEqual({});
    expect(listen.sources).toEqual(['sign();', 'bye();']);
  });

  it('runs no script for a listen that does not ask for them', async () => {
    const listen = scripted(LISTEN, {});
    await listen.accept();
    const session = await listen.session();
    listen.publish('{"state":"rebooting"}');

    expect(await session.end()).toEqual({});
    expect(listen.resolveScriptHost).not.toHaveBeenCalled();
    expect(listen.sources).toEqual([]);
  });

  it('fails before anything is dialled when a Before connect level errors', async () => {
    const listen = scripted(WITH_SCRIPTS, { 'sign();': () => failed('no key') });

    expect(await listen.opened).toEqual({ ok: false, reason: 'Before connect script failed at Request: no key' });
    expect(listen.rig.connects()).toBe(0);
  });

  it('is refused where the host runs no script, and nothing is dialled', async () => {
    const listen = scripted(WITH_SCRIPTS, null);

    expect(await listen.opened).toEqual({
      ok: false,
      reason: 'Step "probe" cannot run here: this host runs no script on a run\'s session.',
    });
    expect(listen.rig.connects()).toBe(0);
  });

  it('says at its close what its scripts did not do cleanly, as a warning', async () => {
    let messages = 0;
    const listen = scripted(WITH_SCRIPTS, {
      'check();': () => {
        messages += 1;
        return messages === 1
          ? ran({
              assertions: [
                { name: 'is rebooting', passed: false, message: 'was idle' },
                { name: 'has a state', passed: true },
              ],
            })
          : failed('not json');
      },
      'bye();': () => failed('bye'),
    });
    await listen.accept();
    const session = await listen.session();
    listen.publish('{"state":"idle"}');
    listen.publish('not json');

    expect(await session.end()).toEqual({
      warning: 'After close script failed: bye · 1 script test failed · On message script failed 1 time',
    });
  });
});

describe('a listen in a realm that hands its own scopes in', () => {
  it('resolves through them, reading a capture made after the session opened', async () => {
    const scoped: Array<{ uid: string; captures: ReadonlyMap<string, ReadonlyMap<string, string>> }> = [];
    const listen = await opening(PROBE, {
      workspaceId: null,
      sessionScope: async (request, stepCaptures) => {
        scoped.push({ uid: request.uid, captures: stepCaptures });
        return {
          resolution: (template) =>
            template.replace('{{step.reboot.command}}', stepCaptures.get('reboot')?.get('command') ?? ''),
        };
      },
    });
    listen.grant(0);
    const session = await listen.session();
    expect(scoped).toEqual([{ uid: 'mqttreq1', captures: listen.stepCaptures }]);
    listen.stepCaptures.set('reboot', new Map([['command', 'restart']]));

    const sending = session.send(SEND);
    await settleTick();
    const publish = listen.rig.written.at(-1);
    if (publish?.type !== 'publish' || publish.packetId === null) throw new Error('expected a QoS 1 PUBLISH');
    expect(new TextDecoder().decode(publish.payload)).toBe('{"name":"restart-1"}');
    listen.rig.push({ type: 'puback', packetId: publish.packetId, reasonCode: 0 });

    expect((await sending).ok).toBe(true);
    await session.end();
  });
});
