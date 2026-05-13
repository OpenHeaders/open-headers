import { beforeEach, describe, expect, it } from 'vitest';
import {
  __resetForTests,
  checkCooldown,
  purgeWorkspaceCooldowns,
  recordUsage,
} from '@openheaders/oracle/entity/totp-cooldown-store';

describe('totp-cooldown-store', () => {
  beforeEach(() => {
    __resetForTests();
  });

  it('returns inCooldown:false for an unrecorded code', () => {
    expect(checkCooldown('ws-1', 'GitHubTOTP', '123456')).toEqual({ inCooldown: false });
  });

  it('blocks the same code inside the same window after recordUsage', () => {
    // Record at t=0 (window start) for a 30s period.
    const t0 = 0;
    recordUsage('ws-1', 'GitHubTOTP', '123456', 30, t0);

    // Same code, 5 seconds later → still in cooldown, 25s remaining.
    const status = checkCooldown('ws-1', 'GitHubTOTP', '123456', t0 + 5_000);
    expect(status.inCooldown).toBe(true);
    if (status.inCooldown) {
      expect(status.remainingSeconds).toBe(25);
    }
  });

  it('lifts the cooldown once the window flips', () => {
    const t0 = 0;
    recordUsage('ws-1', 'GitHubTOTP', '123456', 30, t0);
    // 30s later — new window, code expired → cooldown lifted.
    expect(checkCooldown('ws-1', 'GitHubTOTP', '123456', 30_000)).toEqual({ inCooldown: false });
  });

  it('a different code for the same name is NOT in cooldown', () => {
    recordUsage('ws-1', 'GitHubTOTP', '123456', 30, 0);
    // Window flipped + a fresh code computed. Different code → fresh
    // request OK.
    expect(checkCooldown('ws-1', 'GitHubTOTP', '654321', 5_000)).toEqual({ inCooldown: false });
  });

  it('isolates per workspace', () => {
    recordUsage('ws-1', 'GitHubTOTP', '123456', 30, 0);
    expect(checkCooldown('ws-1', 'GitHubTOTP', '123456', 5_000).inCooldown).toBe(true);
    expect(checkCooldown('ws-2', 'GitHubTOTP', '123456', 5_000).inCooldown).toBe(false);
  });

  it('isolates per vault entry name', () => {
    recordUsage('ws-1', 'GitHubTOTP', '123456', 30, 0);
    expect(checkCooldown('ws-1', 'AwsTOTP', '123456', 5_000).inCooldown).toBe(false);
  });

  it('purgeWorkspaceCooldowns drops every entry for that workspace only', () => {
    recordUsage('ws-1', 'A', '111111', 30, 0);
    recordUsage('ws-1', 'B', '222222', 30, 0);
    recordUsage('ws-2', 'C', '333333', 30, 0);
    purgeWorkspaceCooldowns('ws-1');
    expect(checkCooldown('ws-1', 'A', '111111', 5_000).inCooldown).toBe(false);
    expect(checkCooldown('ws-1', 'B', '222222', 5_000).inCooldown).toBe(false);
    expect(checkCooldown('ws-2', 'C', '333333', 5_000).inCooldown).toBe(true);
  });

  it('non-30s periods compute the right remaining seconds', () => {
    recordUsage('ws-1', 'X', '99', 60, 10_000);
    // Window starts at 0 (60s aligned), 10s in → 50s remaining.
    const status = checkCooldown('ws-1', 'X', '99', 15_000);
    expect(status.inCooldown).toBe(true);
    if (status.inCooldown) expect(status.remainingSeconds).toBe(45);
  });
});
