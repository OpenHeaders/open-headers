/**
 * Transport connection — the peer's frame limit. A frame over it is
 * refused before it leaves: sent, it would make the peer close the
 * connection and every plane on it.
 */
import { DEFAULT_MAX_FRAME_BYTES } from '@openheaders/core/protocol';
import { describe, expect, it } from 'vitest';

import { createTransportConnection, type TransportConnection } from '../../../src/sync/client/transport-connection';

class FakeSocket {
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((e?: { code?: number; reason?: string }) => void) | null = null;
  sent: string[] = [];

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = 3;
    this.onclose?.({ code: 1000 });
  }

  fireOpen(): void {
    this.readyState = 1;
    this.onopen?.();
  }
}

async function openTransport(): Promise<{ transport: TransportConnection; sockets: FakeSocket[] }> {
  const sockets: FakeSocket[] = [];
  const transport = createTransportConnection({
    getUrl: () => 'ws://127.0.0.1:8137',
    shouldConnect: () => true,
    getReconnectDelayMs: () => 1000,
    getMaxReconnectDelayMs: () => 30_000,
    getPingIntervalMs: () => 0,
    probeReachable: () => Promise.resolve(true),
    createSocket: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket as unknown as WebSocket;
    },
    onOpen: () => undefined,
    onClose: () => undefined,
    onMessage: () => undefined,
    setTimer: () => 0,
    clearTimer: () => undefined,
  });
  transport.ensureConnected();
  await Promise.resolve();
  sockets[0].fireOpen();
  return { transport, sockets };
}

describe('createTransportConnection — the peer frame limit', () => {
  it('starts from the default limit', async () => {
    const { transport } = await openTransport();
    expect(transport.maxFrameBytes()).toBe(DEFAULT_MAX_FRAME_BYTES);
  });

  it('sends a serialised frame as the text it was given', async () => {
    const { transport, sockets } = await openTransport();
    const text = '{"type":"oh.telemetry.lifecycle.batch","messages":[]}';
    expect(transport.sendSerialized(text)).toBe(true);
    expect(sockets[0].sent).toEqual([text]);
  });

  it('send serialises once and takes the same path', async () => {
    const { transport, sockets } = await openTransport();
    expect(transport.send({ type: 'ping', t: 1 })).toBe(true);
    expect(sockets[0].sent).toEqual(['{"type":"ping","t":1}']);
  });

  it('refuses a frame over the limit and leaves the socket open', async () => {
    const { transport, sockets } = await openTransport();
    transport.setMaxFrameBytes(64);
    expect(transport.sendSerialized('x'.repeat(65))).toBe(false);
    expect(transport.send({ pad: 'x'.repeat(65) })).toBe(false);
    expect(sockets[0].sent).toEqual([]);
    expect(transport.isConnected()).toBe(true);
    // The next frame that fits still goes.
    expect(transport.sendSerialized('x'.repeat(64))).toBe(true);
  });

  it('measures bytes, not characters', async () => {
    const { transport, sockets } = await openTransport();
    transport.setMaxFrameBytes(64);
    // 22 three-byte characters are 66 bytes.
    expect(transport.sendSerialized('€'.repeat(22))).toBe(false);
    expect(transport.sendSerialized('€'.repeat(21))).toBe(true);
    expect(sockets[0].sent).toHaveLength(1);
  });

  it('a new socket starts from the default again', async () => {
    const { transport, sockets } = await openTransport();
    transport.setMaxFrameBytes(64);
    transport.reconnect();
    await Promise.resolve();
    sockets[1].fireOpen();
    expect(transport.maxFrameBytes()).toBe(DEFAULT_MAX_FRAME_BYTES);
  });

  it('sends nothing without an open socket', async () => {
    const { transport, sockets } = await openTransport();
    sockets[0].close();
    expect(transport.sendSerialized('{}')).toBe(false);
  });
});
