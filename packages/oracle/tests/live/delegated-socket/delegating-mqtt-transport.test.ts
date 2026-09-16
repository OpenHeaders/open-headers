/**
 * The delegating MQTT byte-stream transport over a fake socket wire —
 * the reporter's case: an mqtt(s):// dial rides the open frame to the
 * place; `connect` and `data` feed the seam (chunks decoded, in
 * order); writes ride as base64 bytes; the clean end and the abort
 * ride their riders; `end` settles exactly once with the classified
 * error when the place could not dial.
 */

import type { DelegatedSocketEvent } from '@openheaders/core/protocol';
import { describe, expect, it, vi } from 'vitest';
import { createDelegatingMqttTransport } from '../../../src/live/delegated-socket/delegating-mqtt-transport';
import type { DelegatedSocketWire } from '../../../src/live/delegated-socket/wire';
import { type MqttStreamCallbacks, MqttTransportError } from '../../../src/live/mqtt-exec/transport';

const REQUEST = { url: 'mqtts://broker.openheaders.io:8883', sslVerification: true, timeoutMs: 5000 };
const EXECUTED_ON = { kind: 'backend' as const, name: 'workbox' };

interface FakeWire extends DelegatedSocketWire {
  calls: Array<Record<string, unknown>>;
  listeners: Map<string, (event: DelegatedSocketEvent) => void>;
  emit(socketId: string, event: Omit<DelegatedSocketEvent, 'socketId' | 'seq'>): void;
}

function fakeWire(answer: (frame: Record<string, unknown>) => Promise<unknown>): FakeWire {
  const wire: FakeWire = {
    calls: [],
    listeners: new Map(),
    call: (frame) => {
      wire.calls.push(frame);
      return answer(frame);
    },
    subscribe: (socketId, onEvent) => {
      wire.listeners.set(socketId, onEvent);
      return () => {
        wire.listeners.delete(socketId);
      };
    },
    emit: (socketId, event) => {
      wire.listeners.get(socketId)?.({ socketId, seq: 0, ...event } as DelegatedSocketEvent);
    },
  };
  return wire;
}

function callbacks(): MqttStreamCallbacks & { chunks: Uint8Array[]; ends: Array<MqttTransportError | undefined> } {
  const chunks: Uint8Array[] = [];
  const ends: Array<MqttTransportError | undefined> = [];
  return {
    chunks,
    ends,
    onConnect: vi.fn(),
    onData: (chunk) => {
      chunks.push(chunk);
    },
    onEnd: (error) => {
      ends.push(error);
    },
  };
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('createDelegatingMqttTransport', () => {
  it('rides the open frame with the resolved dial and feeds connect, data and end to the seam', async () => {
    const wire = fakeWire(async () => ({ success: true, executedOn: EXECUTED_ON }));
    const transport = createDelegatingMqttTransport({ wire, workspaceId: 'ws-1', mintSocketId: () => 'sock-1' });
    const cb = callbacks();
    const writer = transport.connect(REQUEST, cb);
    await flush();
    expect(wire.calls[0]).toEqual({
      type: 'delegateMqttOpen',
      socketId: 'sock-1',
      workspaceId: 'ws-1',
      request: REQUEST,
    });
    expect(transport.executedOn()).toEqual(EXECUTED_ON);
    wire.emit('sock-1', { kind: 'connect', proxyRoute: { plane: 'system', source: 'env', proxyUrl: 'http://p:1' } });
    expect(cb.onConnect).toHaveBeenCalledWith({ plane: 'system', source: 'env', proxyUrl: 'http://p:1' });
    wire.emit('sock-1', { kind: 'data', dataBase64: 'IAIAAA==' });
    wire.emit('sock-1', { kind: 'data', dataBase64: 'kAM=' });
    expect(cb.chunks.map((c) => Array.from(c))).toEqual([
      [32, 2, 0, 0],
      [144, 3],
    ]);
    writer.write(new Uint8Array([16, 0]));
    writer.end();
    expect(wire.calls.slice(1)).toEqual([
      { type: 'delegateMqttWrite', socketId: 'sock-1', bytesBase64: 'EAA=' },
      { type: 'delegateMqttEnd', socketId: 'sock-1' },
    ]);
    wire.emit('sock-1', { kind: 'end' });
    expect(cb.ends).toEqual([undefined]);
    expect(wire.listeners.size).toBe(0);
    writer.write(new Uint8Array([1]));
    expect(wire.calls).toHaveLength(3);
  });

  it("forwards the executor's abort and settles with the place's dial failure", async () => {
    const wire = fakeWire(async () => ({ success: true, executedOn: EXECUTED_ON }));
    const transport = createDelegatingMqttTransport({ wire, workspaceId: 'ws-1', mintSocketId: () => 'sock-2' });
    const controller = new AbortController();
    const cb = callbacks();
    transport.connect(REQUEST, cb, controller.signal);
    await flush();
    controller.abort();
    expect(wire.calls.at(-1)).toEqual({ type: 'delegateSocketAbort', socketId: 'sock-2' });
    wire.emit('sock-2', { kind: 'end', error: { message: 'Could not reach broker.openheaders.io:8883' } });
    expect(cb.ends).toHaveLength(1);
    expect(cb.ends[0]).toBeInstanceOf(MqttTransportError);
    expect(cb.ends[0]?.message).toBe('Could not reach broker.openheaders.io:8883');
  });

  it("settles on the place's open refusal without a stream", async () => {
    const wire = fakeWire(async () => ({
      success: false,
      error: 'Sending requests from other connected devices is disabled on this host.',
      executedOn: EXECUTED_ON,
    }));
    const cb = callbacks();
    createDelegatingMqttTransport({ wire, workspaceId: 'ws-1' }).connect(REQUEST, cb);
    await flush();
    expect(cb.ends[0]?.message).toMatch(/disabled on this host/);
    expect(cb.onConnect).not.toHaveBeenCalled();
    expect(wire.listeners.size).toBe(0);
  });
});
