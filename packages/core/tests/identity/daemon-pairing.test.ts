/**
 * Coverage for the daemon device-flow pairing service (U3.3,
 * `DATA_PLANE_TOPOLOGIES.md` §11.4 hybrid pattern).
 *
 * Exercises the pure pairing state machine — code allocation, TTL
 * expiry, confirm-once semantics, mint reuse — against the shared
 * in-memory `HostStorage` fake. The confirm path is wired through the
 * real `mintDaemonAuthToken` so we verify the resulting token row
 * actually lands in `OH.daemonAuthTokens` (no fork of the mint path).
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { createDaemonPairingService, listDaemonAuthTokens } from '../../src/identity';
import { setHostStorage } from '../../src/storage/host-storage';
import { createHostStorageFake } from './_host-storage-fake';

describe('daemon pairing service', () => {
  beforeEach(() => {
    setHostStorage(createHostStorageFake());
  });

  it('allocates a fresh code on start and exposes it via peek', () => {
    const svc = createDaemonPairingService({ generateCode: () => '123456' });
    const start = svc.startPair({ deviceLabel: 'alice' });
    expect(start.code).toBe('123456');
    expect(start.expiresAt).toBeGreaterThan(Date.now());
    const peeked = svc.peek('123456');
    expect(peeked).not.toBeNull();
    expect(peeked?.deviceLabel).toBe('alice');
    expect(peeked?.status).toBe('pending');
  });

  it('returns null on peek of an unknown code', () => {
    const svc = createDaemonPairingService();
    expect(svc.peek('999999')).toBeNull();
  });

  it('confirm mints a fresh DaemonAuthToken and returns the secret once', async () => {
    const svc = createDaemonPairingService({ generateCode: () => '555000' });
    svc.startPair({ deviceLabel: 'bob' });
    const before = await listDaemonAuthTokens();
    expect(before).toHaveLength(0);
    const result = await svc.confirm('555000');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.secret).toMatch(/^oh_/);
      expect(result.tokenId).toMatch(/^[0-9a-f-]+$/i);
    }
    const after = await listDaemonAuthTokens();
    expect(after).toHaveLength(1);
    expect(after[0].label).toBe('bob');
  });

  it('confirm propagates a label override from the confirm form', async () => {
    const svc = createDaemonPairingService({ generateCode: () => '555111' });
    svc.startPair({ deviceLabel: 'alice-default' });
    const result = await svc.confirm('555111', { deviceLabel: 'alice-override' });
    expect(result.ok).toBe(true);
    const after = await listDaemonAuthTokens();
    expect(after[0].label).toBe('alice-override');
  });

  it('rejects a second confirm against the same code with reason consumed', async () => {
    const svc = createDaemonPairingService({ generateCode: () => '555222' });
    svc.startPair();
    const first = await svc.confirm('555222');
    expect(first.ok).toBe(true);
    const second = await svc.confirm('555222');
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe('consumed');
    // The mint path must not have run twice.
    const after = await listDaemonAuthTokens();
    expect(after).toHaveLength(1);
  });

  it('rejects unknown codes with reason unknown', async () => {
    const svc = createDaemonPairingService();
    const result = await svc.confirm('424242');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unknown');
  });

  it('treats an expired code as expired on both peek and confirm', async () => {
    let now = 1_000_000;
    const svc = createDaemonPairingService({
      now: () => now,
      generateCode: () => '600600',
      ttlMs: 1000,
    });
    svc.startPair();
    expect(svc.peek('600600')?.status).toBe('pending');
    now += 2000;
    expect(svc.peek('600600')?.status).toBe('expired');
    const result = await svc.confirm('600600');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('expired');
  });

  it('cancel removes a pending entry', () => {
    const svc = createDaemonPairingService({ generateCode: () => '700700' });
    svc.startPair();
    expect(svc.peek('700700')).not.toBeNull();
    svc.cancel('700700');
    expect(svc.peek('700700')).toBeNull();
  });

  it('parallel confirms against the same code mint exactly one token', async () => {
    const svc = createDaemonPairingService({ generateCode: () => '800800' });
    svc.startPair();
    const [a, b] = await Promise.all([svc.confirm('800800'), svc.confirm('800800')]);
    const okCount = [a, b].filter((r) => r.ok).length;
    expect(okCount).toBe(1);
    const after = await listDaemonAuthTokens();
    expect(after).toHaveLength(1);
  });

  it('list reflects current pending + non-pending entries', () => {
    const codes = ['111111', '222222'];
    let i = 0;
    const svc = createDaemonPairingService({ generateCode: () => codes[i++] });
    svc.startPair();
    svc.startPair();
    expect(svc.list()).toHaveLength(2);
    svc.cancel('111111');
    expect(svc.list()).toHaveLength(1);
  });

  it('throws after dispose', () => {
    const svc = createDaemonPairingService();
    svc.dispose();
    expect(() => svc.startPair()).toThrow();
  });

  describe('brute-force lockout', () => {
    it('locks the surface after the failed-lookup budget and fails closed', async () => {
      let now = 1_000_000;
      const svc = createDaemonPairingService({
        now: () => now,
        generateCode: () => '314159',
        maxFailedLookups: 5,
        failureWindowMs: 60_000,
        lockoutMs: 60_000,
      });
      svc.startPair();
      // The real pending code is reachable before the budget trips.
      expect(svc.peek('314159')?.status).toBe('pending');
      // Five unknown-code probes exhaust the budget.
      for (let i = 0; i < 5; i++) expect(svc.peek('000000')).toBeNull();
      // Fail closed: even the valid code is hidden and confirm refuses.
      expect(svc.peek('314159')).toBeNull();
      const blocked = await svc.confirm('314159');
      expect(blocked.ok).toBe(false);
      if (!blocked.ok) expect(blocked.reason).toBe('unknown');
      // After the cooldown elapses the valid code confirms again.
      now += 60_001;
      const ok = await svc.confirm('314159');
      expect(ok.ok).toBe(true);
    });

    it('shares one budget across peek and confirm probes', async () => {
      const now = 2_000_000;
      const svc = createDaemonPairingService({
        now: () => now,
        generateCode: () => '271828',
        maxFailedLookups: 4,
      });
      svc.startPair();
      // Two GET probes + two POST probes = four unknown lookups → locked.
      expect(svc.peek('100000')).toBeNull();
      expect(svc.peek('200000')).toBeNull();
      expect((await svc.confirm('300000')).ok).toBe(false);
      expect((await svc.confirm('400000')).ok).toBe(false);
      // Budget drawn down across both surfaces — the real code is hidden.
      expect(svc.peek('271828')).toBeNull();
    });

    it('ages failed lookups out of the rolling window so spread-out misses never trip', () => {
      let now = 3_000_000;
      const svc = createDaemonPairingService({
        now: () => now,
        generateCode: () => '161803',
        maxFailedLookups: 3,
        failureWindowMs: 1000,
      });
      svc.startPair();
      // One miss every 600ms: the window only ever holds two, never three.
      for (let i = 0; i < 10; i++) {
        expect(svc.peek('000001')).toBeNull();
        now += 600;
      }
      // Never locked — the real code stays reachable throughout.
      expect(svc.peek('161803')?.status).toBe('pending');
    });

    it('never counts a valid lookup toward the budget', async () => {
      const now = 4_000_000;
      const svc = createDaemonPairingService({
        now: () => now,
        generateCode: () => '141421',
        // A single failure would lock — prove valid traffic is exempt.
        maxFailedLookups: 1,
      });
      svc.startPair();
      expect(svc.peek('141421')?.status).toBe('pending');
      const ok = await svc.confirm('141421');
      expect(ok.ok).toBe(true);
    });
  });
});
