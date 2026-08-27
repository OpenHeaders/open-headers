/**
 * MQTT session plane — the flush-batched `mqttStreamEvent` emitter
 * (open immediate, items pooled by the time window with an eager
 * bound, end flushes then settles, per-send monotonic seq) and the
 * active-session registry behind the `publishMqttMessage` /
 * `setMqttSubscription` / `closeMqttSession` riders.
 */

import type { MqttStreamEventWire, MqttStreamItemWire } from '@openheaders/core/bridge';
import {
  closeActiveMqttSession,
  createMqttStreamEmitter,
  publishActiveMqttMessage,
  reconnectActiveMqttSessionNow,
  registerActiveMqttSession,
  setActiveMqttSubscription,
} from '@openheaders/oracle/live/mqtt-exec/session-plane';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const messageItem = (direction: 'up' | 'down'): MqttStreamItemWire => ({
  kind: 'message',
  direction,
  topic: 'probe/echo',
  payloadBase64: 'AA==',
  qos: 0,
  retain: false,
  dup: false,
  atMs: 1_700_000_000_000,
});

describe('createMqttStreamEmitter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits open immediately with the CONNACK facts and pools items until the flush window', () => {
    const events: MqttStreamEventWire[] = [];
    const emitter = createMqttStreamEmitter('send-1', (e) => events.push(e));
    emitter.open({ sessionPresent: true, reasonCode: 0, remainingLength: 3, clientId: 'oh-abc12345' });
    emitter.item(messageItem('down'));
    emitter.item({ kind: 'subscribed', grants: [{ topicFilter: 'probe/#', reasonCode: 1 }], atMs: 1 });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: 'open',
      seq: 0,
      sessionPresent: true,
      reasonCode: 0,
      remainingLength: 3,
      clientId: 'oh-abc12345',
    });
    vi.advanceTimersByTime(100);
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({ kind: 'items', seq: 1 });
    if (events[1].kind !== 'items') throw new Error('expected items frame');
    expect(events[1].items.map((i) => i.kind)).toEqual(['message', 'subscribed']);
  });

  it('flushes eagerly on the item bound instead of pooling a burst', () => {
    const events: MqttStreamEventWire[] = [];
    const emitter = createMqttStreamEmitter('send-1', (e) => events.push(e));
    for (let i = 0; i < 256; i++) emitter.item(messageItem('down'));
    expect(events).toHaveLength(1);
    if (events[0].kind !== 'items') throw new Error('expected items frame');
    expect(events[0].items).toHaveLength(256);
  });

  it('end flushes pending items first, then settles with the end frame', () => {
    const events: MqttStreamEventWire[] = [];
    const emitter = createMqttStreamEmitter('send-1', (e) => events.push(e));
    emitter.item(messageItem('up'));
    emitter.end();
    expect(events.map((e) => e.kind)).toEqual(['items', 'end']);
    expect(events.map((e) => e.seq)).toEqual([0, 1]);
    emitter.item(messageItem('down'));
    emitter.open({ sessionPresent: false, reasonCode: 0, remainingLength: 3, clientId: 'x' });
    emitter.end();
    expect(events).toHaveLength(2);
  });

  it('stamps the lifecycle frames with the host wall-clock — the item frames atMs law', () => {
    vi.setSystemTime(1_700_000_111_222);
    const events: MqttStreamEventWire[] = [];
    const emitter = createMqttStreamEmitter('send-1', (e) => events.push(e));
    emitter.open({ sessionPresent: true, reasonCode: 0, remainingLength: 3, clientId: 'oh-abc12345' });
    vi.setSystemTime(1_700_000_333_444);
    emitter.end();
    expect(events.map((e) => e.kind)).toEqual(['open', 'end']);
    if (events[0].kind !== 'open' || events[1].kind !== 'end') throw new Error('expected open then end');
    expect(events[0].atMs).toBe(1_700_000_111_222);
    expect(events[1].atMs).toBe(1_700_000_333_444);
  });
});

describe('active MQTT session registry', () => {
  it('routes publish, subscription toggles, reconnect-now and close to the registered handle until unregistered', async () => {
    const published: string[] = [];
    let closedCount = 0;
    let reconnectNowCount = 0;
    const unregister = registerActiveMqttSession('send-2', {
      publish: (message) => {
        published.push(message.topic);
        return { success: true };
      },
      setSubscription: (subscription) => Promise.resolve({ success: true, grantCode: subscription.subscribe ? 1 : 0 }),
      close: () => {
        closedCount++;
      },
      reconnectNow: () => {
        reconnectNowCount++;
        return true;
      },
    });
    expect(publishActiveMqttMessage('send-2', { topic: 'probe/echo', payload: 'x' })).toEqual({ success: true });
    expect(published).toEqual(['probe/echo']);
    await expect(setActiveMqttSubscription('send-2', { topicFilter: 'probe/#', subscribe: true })).resolves.toEqual({
      success: true,
      grantCode: 1,
    });
    expect(reconnectActiveMqttSessionNow('send-2')).toBe(true);
    expect(reconnectNowCount).toBe(1);
    expect(closeActiveMqttSession('send-2')).toBe(true);
    expect(closedCount).toBe(1);
    unregister();
    expect(reconnectActiveMqttSessionNow('send-2')).toBe(false);
    expect(publishActiveMqttMessage('send-2', { topic: 'late', payload: '' }).success).toBe(false);
    expect(closeActiveMqttSession('send-2')).toBe(false);
  });

  it('answers an unknown id without touching any handle', async () => {
    const result = publishActiveMqttMessage('missing', { topic: 'x', payload: '' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('No open MQTT session');
    const sub = await setActiveMqttSubscription('missing', { topicFilter: 'x', subscribe: true });
    expect(sub.success).toBe(false);
  });
});
