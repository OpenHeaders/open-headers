/**
 * MQTT executor — the TOTP cooldown plane over an injected resolution
 * and an injected plane: Connect's codes (the CONNECT's password here)
 * are ONE batch gated before the dial (a refusal is the session's failed
 * outcome in the HTTP send's wording, nothing dialed) and recorded on
 * the accepting CONNACK alone; a publish rider and a subscription
 * toggle are each their OWN batch — gated before the write in the
 * rider's answer, recorded after it.
 */

import { decodeMqttPacket, encodeMqttPacket, MQTT_PROTOCOL_VERSIONS, type MqttPacket } from '@openheaders/core/mqtt';
import { createTotpUsageTracker, type TotpCooldownPlane, type TotpUsage } from '@openheaders/core/totp';
import type { MqttRequest, Vault } from '@openheaders/core/types';
import { executeMqttSession } from '@openheaders/oracle/live/mqtt-exec/execute';
import {
  closeActiveMqttSession,
  publishActiveMqttMessage,
  setActiveMqttSubscription,
} from '@openheaders/oracle/live/mqtt-exec/session-plane';
import type { MqttByteTransport, MqttStreamCallbacks } from '@openheaders/oracle/live/mqtt-exec/transport';
import type { SessionResolve } from '@openheaders/oracle/live/request-exec/session-resolution';
import { describe, expect, it } from 'vitest';

const vault: Vault = {
  schemaVersion: 5,
  secrets: [
    { uid: 'totp0001', kind: 'totp', name: 'otp', seed: 'JBSWY3DPEHPK3PXP', algorithm: 'SHA1', digits: 6, period: 30 },
  ],
};

const REFUSAL = "TOTP 'otp' code can't be reused — wait 9s for the next window.";

/** The CONNECT's password is the code — Connect's one TOTP usage. */
const BASIC_OTP: MqttRequest['auth'] = { type: 'basic', username: 'device', password: '{{vault.otp}}' };

function makeMqttRequest(overrides: Partial<MqttRequest> = {}): MqttRequest {
  return {
    schemaVersion: 5,
    uid: 'mqtt-totp-1',
    path: 'requests/suite-col1/probe-totp',
    name: 'Probe TOTP',
    url: 'mqtt://broker.openheaders.io:1883',
    protocolVersion: '5.0',
    auth: BASIC_OTP,
    topic: 'probe/echo',
    payload: 'hello',
    topics: [],
    savedMessages: [],
    userProperties: [],
    ...overrides,
  };
}

function resolutionAnsweringCode(code: () => string): SessionResolve {
  return (template, _unresolved, totp) =>
    template.replace(/\{\{([^}]+)\}\}/g, (whole, name: string) => {
      if (name.trim() !== 'vault.otp') return whole;
      const value = code();
      totp?.observe([{ name: 'vault.otp', resolved: true, value, scope: 'vault' }]);
      return value;
    });
}

function scriptedPlane(refusals: Record<string, string | null> = {}) {
  const gated: TotpUsage[][] = [];
  const recorded: TotpUsage[][] = [];
  const plane: TotpCooldownPlane = {
    tracker: () => createTotpUsageTracker(vault),
    refusal: (usages) => {
      if (usages.length === 0) return null;
      gated.push([...usages]);
      for (const usage of usages) {
        const refusal = refusals[usage.code];
        if (refusal !== undefined && refusal !== null) return refusal;
      }
      return null;
    },
    record: (usages) => {
      if (usages.length === 0) return;
      recorded.push([...usages]);
    },
  };
  return { plane, gated, recorded };
}

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
  };
}

const settleTick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
const acceptedConnack: MqttPacket = { type: 'connack', sessionPresent: false, reasonCode: 0 };
const packetTypes = (written: readonly MqttPacket[]): string[] => written.map((p) => p.type);

describe('executeMqttSession — TOTP cooldown', () => {
  it('gates Connect before the dial: a code in cooldown fails the session in the HTTP wording and nothing dials', async () => {
    const rig = scriptedTransport();
    const { plane, gated, recorded } = scriptedPlane({ '111111': REFUSAL });
    const snapshot = await executeMqttSession(makeMqttRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-mqtt-totp-gate',
      resolution: resolutionAnsweringCode(() => '111111'),
      totp: plane,
    });
    expect(snapshot.outcome).toEqual({ kind: 'failed', error: REFUSAL });
    expect(rig.connects()).toBe(0);
    expect(gated).toEqual([[{ name: 'otp', code: '111111', period: 30 }]]);
    expect(recorded).toEqual([]);
  });

  it("records Connect's codes on the accepting CONNACK; a refused CONNACK records nothing", async () => {
    const refused = scriptedTransport();
    const { plane, recorded } = scriptedPlane();
    const refusedSettled = executeMqttSession(makeMqttRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: refused.transport,
      sendId: 'send-mqtt-totp-refused',
      resolution: resolutionAnsweringCode(() => '222222'),
      totp: plane,
    });
    await settleTick();
    refused.establish();
    const connect = refused.written[0];
    if (connect?.type !== 'connect') throw new Error('expected CONNECT first');
    expect(new TextDecoder().decode(connect.password)).toBe('222222');
    refused.push({ type: 'connack', sessionPresent: false, reasonCode: 0x86 });
    await refusedSettled;
    expect(recorded).toEqual([]);

    const accepted = scriptedTransport();
    const settled = executeMqttSession(makeMqttRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: accepted.transport,
      sendId: 'send-mqtt-totp-open',
      resolution: resolutionAnsweringCode(() => '333333'),
      totp: plane,
    });
    await settleTick();
    accepted.establish();
    accepted.push(acceptedConnack);
    expect(recorded).toEqual([[{ name: 'otp', code: '333333', period: 30 }]]);
    closeActiveMqttSession('send-mqtt-totp-open');
    await settled;
    expect(recorded).toHaveLength(1);
  });

  it('a publish rider and a subscription toggle are each their own batch — gated before the write, recorded after', async () => {
    const rig = scriptedTransport();
    let code = '444444';
    const { plane, gated, recorded } = scriptedPlane({ '666666': REFUSAL });
    const settled = executeMqttSession(makeMqttRequest(), {
      workspaceId: null,
      environmentId: undefined,
      transport: rig.transport,
      sendId: 'send-mqtt-totp-riders',
      resolution: resolutionAnsweringCode(() => code),
      totp: plane,
    });
    await settleTick();
    rig.establish();
    rig.push(acceptedConnack);
    expect(gated).toHaveLength(1);
    expect(recorded).toHaveLength(1);

    code = '555555';
    expect(await publishActiveMqttMessage('send-mqtt-totp-riders', { topic: 'a/b', payload: '{{vault.otp}}' })).toEqual(
      { success: true },
    );
    expect(gated.at(-1)).toEqual([{ name: 'otp', code: '555555', period: 30 }]);
    expect(recorded.at(-1)).toEqual([{ name: 'otp', code: '555555', period: 30 }]);
    expect(packetTypes(rig.written)).toEqual(['connect', 'publish']);

    code = '666666';
    expect(await publishActiveMqttMessage('send-mqtt-totp-riders', { topic: 'a/b', payload: '{{vault.otp}}' })).toEqual(
      { success: false, error: REFUSAL },
    );
    expect(packetTypes(rig.written)).toEqual(['connect', 'publish']);
    expect(recorded).toHaveLength(2);

    code = '777777';
    const toggled = setActiveMqttSubscription('send-mqtt-totp-riders', {
      topicFilter: 'devices/{{vault.otp}}/#',
      subscribe: true,
    });
    await settleTick();
    expect(packetTypes(rig.written)).toEqual(['connect', 'publish', 'subscribe']);
    expect(gated.at(-1)).toEqual([{ name: 'otp', code: '777777', period: 30 }]);
    expect(recorded.at(-1)).toEqual([{ name: 'otp', code: '777777', period: 30 }]);
    const subscribe = rig.written[2];
    if (subscribe?.type !== 'subscribe') throw new Error('expected SUBSCRIBE');
    rig.push({ type: 'suback', packetId: subscribe.packetId, reasonCodes: [0] });
    expect(await toggled).toEqual({ success: true, grantCode: 0 });

    code = '666666';
    expect(
      await setActiveMqttSubscription('send-mqtt-totp-riders', {
        topicFilter: 'devices/{{vault.otp}}/#',
        subscribe: true,
      }),
    ).toEqual({ success: false, error: REFUSAL });
    expect(packetTypes(rig.written)).toEqual(['connect', 'publish', 'subscribe']);

    closeActiveMqttSession('send-mqtt-totp-riders');
    await settled;
  });
});
