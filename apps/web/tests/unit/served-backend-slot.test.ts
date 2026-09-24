/**
 * The served tab's one per-backend `sync` slot — empty until the wire
 * speaks, then the wire's state under the fixed backend id, every
 * write fanned out on `backendSyncStatusUpdated` the way the extension's
 * worker broadcasts its slots.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  __resetServedBackendSlotForTests,
  getServedBackendSnapshot,
  reportServedBackendSlot,
} from '@/host/served-backend-slot';
import { WEB_DAEMON_BACKEND_ID } from '@/host/web-backend-id';
import { subscribeLocal } from '@/host/web-broadcast';

afterEach(() => {
  __resetServedBackendSlotForTests();
});

describe('the served backend slot', () => {
  it('is empty until the wire speaks, then files the state under the fixed id and broadcasts it', () => {
    expect(getServedBackendSnapshot()).toEqual({});
    const seen: unknown[] = [];
    const unsubscribe = subscribeLocal('backendSyncStatusUpdated', (payload) => seen.push(payload));

    reportServedBackendSlot({ state: 'green', message: 'Synced with the serving daemon' });
    reportServedBackendSlot({
      state: 'red',
      message: 'The daemon requires a pairing token',
      context: { reason: 'auth-required' },
    });
    unsubscribe();

    expect(getServedBackendSnapshot()).toEqual({
      [WEB_DAEMON_BACKEND_ID]: {
        state: 'red',
        message: 'The daemon requires a pairing token',
        context: { reason: 'auth-required' },
      },
    });
    expect(seen).toEqual([
      { [WEB_DAEMON_BACKEND_ID]: { state: 'green', message: 'Synced with the serving daemon' } },
      {
        [WEB_DAEMON_BACKEND_ID]: {
          state: 'red',
          message: 'The daemon requires a pairing token',
          context: { reason: 'auth-required' },
        },
      },
    ]);
  });
});
