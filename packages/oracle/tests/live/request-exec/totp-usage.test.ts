/**
 * TOTP usage of one send — the tracker notes every TOTP entry whose
 * code a resolved template carried (prefixed or flat), one row per
 * entry with a rolled window replacing the row, nothing for other
 * vault kinds or misses; the gate's refusal names the first code still
 * inside its window and lets a clean list go; the record writes every
 * row to the cooldown store.
 */

import type { TemplateVariable } from '@openheaders/core/variables';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const checkCooldown = vi.fn(
  (_ws: string, _name: string, _code: string) =>
    ({ inCooldown: false }) as {
      inCooldown: boolean;
      remainingSeconds?: number;
    },
);
const recordUsage = vi.fn();
vi.mock('../../../src/entity/totp-cooldown-store', () => ({
  checkCooldown: (ws: string, name: string, code: string) => checkCooldown(ws, name, code),
  recordUsage: (...args: unknown[]) => recordUsage(...args),
}));

import {
  createTotpUsageTracker,
  recordTotpUsages,
  totpCooldownRefusal,
} from '../../../src/live/request-exec/totp-usage';

const vault = {
  schemaVersion: 5 as const,
  secrets: [
    { uid: 'sec00001', kind: 'string' as const, name: 'api_key', value: 'k-1' },
    {
      uid: 'totp0001',
      kind: 'totp' as const,
      name: 'otp',
      seed: 'JBSWY3DPEHPK3PXP',
      algorithm: 'SHA1' as const,
      digits: 6,
      period: 30,
    },
    {
      uid: 'totp0002',
      kind: 'totp' as const,
      name: 'otp2',
      seed: 'JBSWY3DPEHPK3PXP',
      algorithm: 'SHA1' as const,
      digits: 6,
      period: 60,
    },
  ],
};

const resolved = (name: string, value: string): TemplateVariable => ({ name, resolved: true, value, scope: 'vault' });

beforeEach(() => {
  checkCooldown.mockReset();
  checkCooldown.mockReturnValue({ inCooldown: false });
  recordUsage.mockReset();
});

describe('createTotpUsageTracker', () => {
  it('notes a TOTP code under the prefixed or the flat name, one row per entry, a rolled code in place', () => {
    const tracker = createTotpUsageTracker(vault);
    tracker.observe([resolved('vault.otp', '111111'), resolved('api_key', 'k-1')]);
    tracker.observe([resolved('otp2', '222222'), { name: 'workspace.region', resolved: true, value: 'eu', scope: 'workspace' }]);
    expect(tracker.used).toEqual([
      { name: 'otp', code: '111111', period: 30 },
      { name: 'otp2', code: '222222', period: 60 },
    ]);
    tracker.observe([resolved('otp', '333333')]);
    expect(tracker.used).toEqual([
      { name: 'otp', code: '333333', period: 30 },
      { name: 'otp2', code: '222222', period: 60 },
    ]);
  });

  it('ignores a miss, an empty code and a vault without TOTP entries', () => {
    const tracker = createTotpUsageTracker(vault);
    tracker.observe([{ name: 'vault.otp', resolved: false }, resolved('otp', '')]);
    expect(tracker.used).toEqual([]);
    const none = createTotpUsageTracker({ schemaVersion: 5, secrets: [] });
    none.observe([resolved('otp', '111111')]);
    expect(none.used).toEqual([]);
  });
});

describe('totpCooldownRefusal / recordTotpUsages', () => {
  it('refuses on the first code still inside its window, naming the wait; a clean list goes', () => {
    const usages = [
      { name: 'otp', code: '111111', period: 30 },
      { name: 'otp2', code: '222222', period: 60 },
    ];
    expect(totpCooldownRefusal('ws-1', usages)).toBeNull();
    expect(checkCooldown.mock.calls).toEqual([
      ['ws-1', 'otp', '111111'],
      ['ws-1', 'otp2', '222222'],
    ]);
    checkCooldown.mockImplementation((_ws, name) =>
      name === 'otp2' ? { inCooldown: true, remainingSeconds: 17 } : { inCooldown: false },
    );
    expect(totpCooldownRefusal('ws-1', usages)).toBe(
      "TOTP 'otp2' code can't be reused — wait 17s for the next window.",
    );
  });

  it('records every row to the cooldown store under the workspace', () => {
    recordTotpUsages('ws-1', [
      { name: 'otp', code: '111111', period: 30 },
      { name: 'otp2', code: '222222', period: 60 },
    ]);
    expect(recordUsage.mock.calls).toEqual([
      ['ws-1', 'otp', '111111', 30],
      ['ws-1', 'otp2', '222222', 60],
    ]);
  });
});
