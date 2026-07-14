/**
 * Migration pull mirror over the web tab's wire — the mirror's laws:
 * `migrationPullEvent` frames claim synchronously and re-broadcast
 * their payload verbatim into the in-tab fan-out (a malformed frame is
 * still ours to drop, other types pass onward), and the getState
 * hydration forwards up the wire with the idle run state on every
 * failure leg — a daemon refusal, a dead wire — never a rejection.
 */

import { setHostLogger } from '@openheaders/core/logger';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { subscribeLocal } from '@/host/web-broadcast';
import {
  fetchMigrationPullState,
  handleIncomingMigrationPullFrame,
  MIGRATION_GET_STATE_CHANNEL,
} from '@/host/wire-migration-mirror';
import { handleWireRpcResponseFrame, setWireRpcSender } from '@/host/wire-rpc';

const RESPONSE_CHANNEL = `${MIGRATION_GET_STATE_CHANNEL}:response`;

function pullFrame(overrides?: Partial<{ runId: unknown; seq: unknown; event: unknown }>): Record<string, unknown> {
  return {
    type: 'migrationPullEvent',
    payload: { runId: 'run-1', seq: 3, event: { kind: 'item' }, ...overrides },
  };
}

describe('wire-migration-mirror', () => {
  let sent: Record<string, unknown>[];
  let received: unknown[];
  let unsubscribe: () => void;

  beforeAll(() => {
    setHostLogger({ error() {}, warn() {}, info() {}, debug() {} });
  });

  beforeEach(() => {
    sent = [];
    received = [];
    setWireRpcSender((frame) => {
      sent.push(frame);
      return true;
    });
    unsubscribe = subscribeLocal('migrationPullEvent', (payload) => {
      received.push(payload);
    });
    return () => unsubscribe();
  });

  it('claims a pull frame and re-broadcasts its payload verbatim', () => {
    const frame = pullFrame();
    expect(handleIncomingMigrationPullFrame(frame)).toBe(true);
    expect(received).toEqual([frame.payload]);
  });

  it('claims a malformed frame of its type without broadcasting', () => {
    expect(handleIncomingMigrationPullFrame(pullFrame({ seq: 'not-a-number' }))).toBe(true);
    expect(handleIncomingMigrationPullFrame({ type: 'migrationPullEvent' })).toBe(true);
    expect(received).toEqual([]);
  });

  it('passes other frame types onward', () => {
    expect(handleIncomingMigrationPullFrame({ type: 'pong' })).toBe(false);
    expect(handleIncomingMigrationPullFrame(null)).toBe(false);
    expect(received).toEqual([]);
  });

  it('forwards getState up the wire and passes the daemon state through', async () => {
    const call = fetchMigrationPullState();
    await Promise.resolve();
    expect(sent[0]).toEqual({ type: MIGRATION_GET_STATE_CHANNEL });
    handleWireRpcResponseFrame({ type: RESPONSE_CHANNEL, payload: { runId: 'run-9', phase: 'pulling' } });
    await expect(call).resolves.toMatchObject({ runId: 'run-9', phase: 'pulling' });
  });

  it('answers the idle run state on a daemon refusal', async () => {
    const call = fetchMigrationPullState();
    await Promise.resolve();
    handleWireRpcResponseFrame({
      type: RESPONSE_CHANNEL,
      __error: 'permission denied: migration pull state is only available to the host operator',
    });
    await expect(call).resolves.toMatchObject({ runId: null, phase: 'idle' });
  });

  it('answers the idle run state on a dead wire', async () => {
    setWireRpcSender(() => false);
    await expect(fetchMigrationPullState()).resolves.toMatchObject({ runId: null, phase: 'idle' });
  });
});
