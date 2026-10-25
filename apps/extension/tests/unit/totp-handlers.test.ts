/**
 * The service worker's `oh.totp.*` channels — the page realm's live
 * sessions gating and recording TOTP usage through this worker's
 * cooldown store (the one the HTTP sends ride): the gate answers the
 * oracle's refusal sentence for a code inside its window and `null`
 * for a clean batch, the record writes every row with its period, the
 * partition key is the session's workspace else the runtime-Active one,
 * and an empty batch never reaches the store.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const checkCooldown = vi.fn<
  (ws: string, name: string, code: string) => { inCooldown: boolean; remainingSeconds?: number }
>(() => ({ inCooldown: false }));
const recordUsage = vi.fn();
vi.mock('@openheaders/oracle/entity/totp-cooldown-store', () => ({
  checkCooldown: (ws: string, name: string, code: string) => checkCooldown(ws, name, code),
  recordUsage: (...args: unknown[]) => recordUsage(...args),
}));
vi.mock('@/background/modules/workspace/workspace-store', () => ({
  getActiveWorkspaceId: () => 'ws-active',
}));

import { totpHandlers } from '@/background/modules/message-handler/handlers/totp';
import type { HandlerArgs } from '@/background/modules/message-handler/types';

function invoke(type: string, message: Record<string, unknown>): unknown {
  const respond = vi.fn();
  totpHandlers[type]({
    message: { type, ...message },
    sender: {} as chrome.runtime.MessageSender,
    respond,
    ctx: {},
  } as unknown as HandlerArgs);
  expect(respond).toHaveBeenCalledTimes(1);
  return respond.mock.calls[0][0];
}

const otp = { name: 'otp', code: '123456', period: 30 };

beforeEach(() => {
  checkCooldown.mockReset();
  checkCooldown.mockReturnValue({ inCooldown: false });
  recordUsage.mockReset();
});

describe('oh.totp.checkCooldown', () => {
  it('answers null for a clean batch, keyed by the pinned workspace', () => {
    expect(invoke('oh.totp.checkCooldown', { workspaceId: 'ws-pinned', usages: [otp] })).toEqual({ refusal: null });
    expect(checkCooldown).toHaveBeenCalledWith('ws-pinned', 'otp', '123456');
  });

  it("answers the oracle's refusal sentence for a code inside its window, keyed by the runtime-Active workspace when none is pinned", () => {
    checkCooldown.mockReturnValue({ inCooldown: true, remainingSeconds: 17 });
    expect(invoke('oh.totp.checkCooldown', { workspaceId: null, usages: [otp] })).toEqual({
      refusal: "TOTP 'otp' code can't be reused — wait 17s for the next window.",
    });
    expect(checkCooldown).toHaveBeenCalledWith('ws-active', 'otp', '123456');
  });

  it('never reaches the store for an empty batch', () => {
    expect(invoke('oh.totp.checkCooldown', { workspaceId: null, usages: [] })).toEqual({ refusal: null });
    expect(checkCooldown).not.toHaveBeenCalled();
  });
});

describe('oh.totp.recordUsage', () => {
  it('records every row with its period under the session workspace', () => {
    expect(
      invoke('oh.totp.recordUsage', {
        workspaceId: 'ws-pinned',
        usages: [otp, { name: 'otp2', code: '654321', period: 60 }],
      }),
    ).toEqual({ ok: true });
    expect(recordUsage.mock.calls).toEqual([
      ['ws-pinned', 'otp', '123456', 30],
      ['ws-pinned', 'otp2', '654321', 60],
    ]);
  });

  it('writes nothing for an empty batch', () => {
    expect(invoke('oh.totp.recordUsage', { workspaceId: null, usages: [] })).toEqual({ ok: true });
    expect(recordUsage).not.toHaveBeenCalled();
  });
});
