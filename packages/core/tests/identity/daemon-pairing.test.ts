/**
 * Coverage for the daemon device-flow pairing service (U3.3,
 * the data-plane topologies design §11.4 hybrid pattern).
 *
 * Exercises the pure pairing state machine — code allocation, TTL
 * expiry, confirm-once semantics, mint reuse — against the shared
 * in-memory `HostStorage` fake. The confirm path is wired through the
 * real `mintDaemonAuthToken` so we verify the resulting token row
 * actually lands in `OH.daemonAuthTokens` (no fork of the mint path).
 *
 * The client initiative (the client sign-in plan §6.1) rides the same
 * table: the code alone never yields a secret, the poll handle answers
 * it exactly once, approve/deny settle a pair, the two caps hold, and
 * every unknown lookup — code or handle — draws the one global budget.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDaemonPairingService,
  type DaemonPairingService,
  defaultGenerateCode,
  listDaemonAuthTokens,
} from '../../src/identity';
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

  it('confirm binds the minted token to the userId given at startPair', async () => {
    const svc = createDaemonPairingService({ generateCode: () => '555333' });
    svc.startPair({ deviceLabel: 'alice phone', userId: 'user-42' });
    const result = await svc.confirm('555333');
    expect(result.ok).toBe(true);
    const after = await listDaemonAuthTokens();
    expect(after[0].userId).toBe('user-42');
  });

  it('confirm mints an unbound token when no userId was given', async () => {
    const svc = createDaemonPairingService({ generateCode: () => '555444' });
    svc.startPair({ deviceLabel: 'solo' });
    const result = await svc.confirm('555444');
    expect(result.ok).toBe(true);
    const after = await listDaemonAuthTokens();
    expect(after[0].userId).toBeUndefined();
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

  describe('client initiative', () => {
    const CLIENT = { client: 'extension' as const, peer: '192.168.1.20' };

    function clientService(overrides: Parameters<typeof createDaemonPairingService>[0] = {}): DaemonPairingService {
      return createDaemonPairingService({ generateCode: () => '246810', ...overrides });
    }

    it('starts a pair with a code and a poll handle; the entry stores only the handle hash', async () => {
      const svc = clientService();
      const start = await svc.startClientPair({ ...CLIENT, deviceLabel: '  Work Chrome ' });
      expect(start.code).toBe('246810');
      expect(start.pollToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(start.expiresAt).toBeGreaterThan(Date.now());
      const entry = svc.peek('246810');
      expect(entry).toMatchObject({
        initiative: 'client',
        client: 'extension',
        peer: '192.168.1.20',
        deviceLabel: 'Work Chrome',
        status: 'pending',
      });
      expect(entry?.pollTokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(entry?.pollTokenHash).not.toBe(start.pollToken);
      expect(JSON.stringify(entry)).not.toContain(start.pollToken);
    });

    it('the code alone never yields a secret: confirm against a client pair reads as consumed and mints nothing', async () => {
      const svc = clientService();
      await svc.startClientPair(CLIENT);
      expect(await svc.confirm('246810')).toEqual({ ok: false, reason: 'consumed' });
      expect(await listDaemonAuthTokens()).toHaveLength(0);
      // Still approvable — the confirm attempt touched nothing.
      expect(svc.approve('246810', 'user-1')).toEqual({ ok: true });
    });

    it('poll waits, then mints ONCE after approval: a bound, expiring session token labelled for the device', async () => {
      const now = 5_000_000;
      const svc = clientService({ now: () => now, sessionTtlMs: 1000 });
      const { pollToken, expiresAt } = await svc.startClientPair({ ...CLIENT, deviceLabel: 'Work Chrome' });
      expect(await svc.poll(pollToken)).toEqual({ status: 'pending', expiresAt });
      expect(await listDaemonAuthTokens()).toHaveLength(0);
      expect(svc.approve('246810', 'user-1')).toEqual({ ok: true });
      expect(svc.peek('246810')?.status).toBe('approved');
      // Approval minted nothing — the poll does.
      expect(await listDaemonAuthTokens()).toHaveLength(0);
      const polled = await svc.poll(pollToken);
      expect(polled.status).toBe('approved');
      if (polled.status !== 'approved') return;
      expect(polled.secret).toMatch(/^oh_/);
      expect(polled.userId).toBe('user-1');
      const [token] = await listDaemonAuthTokens();
      expect(token.id).toBe(polled.tokenId);
      expect(token).toMatchObject({
        kind: 'session',
        userId: 'user-1',
        label: 'device:extension:Work Chrome',
        expiresAt: now + 1000,
      });
      // One-shot: the same handle answers unknown from now on, and no
      // second token is minted.
      expect(await svc.poll(pollToken)).toEqual({ status: 'unknown' });
      expect(await listDaemonAuthTokens()).toHaveLength(1);
      expect(svc.peek('246810')?.status).toBe('consumed');
    });

    it('labels an unnamed device by its client kind alone', async () => {
      const svc = clientService();
      const { pollToken } = await svc.startClientPair({ client: 'cli', peer: '10.0.0.5' });
      svc.approve('246810', 'user-1');
      await svc.poll(pollToken);
      expect((await listDaemonAuthTokens())[0].label).toBe('device:cli');
    });

    it('deny settles the pair: the poll reads denied and a later approve is refused', async () => {
      const svc = clientService();
      const { pollToken } = await svc.startClientPair(CLIENT);
      expect(svc.deny('246810')).toEqual({ ok: true });
      expect(await svc.poll(pollToken)).toEqual({ status: 'denied' });
      expect(svc.approve('246810', 'user-1')).toEqual({ ok: false, reason: 'denied' });
      expect(await listDaemonAuthTokens()).toHaveLength(0);
    });

    it('a second decision on a decided pair is refused as consumed', async () => {
      const svc = clientService();
      await svc.startClientPair(CLIENT);
      expect(svc.approve('246810', 'user-1')).toEqual({ ok: true });
      expect(svc.approve('246810', 'user-2')).toEqual({ ok: false, reason: 'consumed' });
      expect(svc.deny('246810')).toEqual({ ok: false, reason: 'consumed' });
      expect(svc.peek('246810')?.approvedUserId).toBe('user-1');
    });

    it('an expired pair answers expired to the poll and refuses approval', async () => {
      let now = 6_000_000;
      const svc = clientService({ now: () => now, ttlMs: 1000 });
      const { pollToken } = await svc.startClientPair(CLIENT);
      now += 2000;
      expect(await svc.poll(pollToken)).toEqual({ status: 'expired' });
      expect(svc.approve('246810', 'user-1')).toEqual({ ok: false, reason: 'expired' });
    });

    it('an approval nobody polled for expires with its code — nothing minted for a client that left', async () => {
      let now = 7_000_000;
      const svc = clientService({ now: () => now, ttlMs: 1000 });
      const { pollToken } = await svc.startClientPair(CLIENT);
      svc.approve('246810', 'user-1');
      now += 2000;
      expect(await svc.poll(pollToken)).toEqual({ status: 'expired' });
      expect(await listDaemonAuthTokens()).toHaveLength(0);
    });

    it('the client verbs refuse an admin-initiated pair, and the admin verb keeps it', async () => {
      const svc = clientService();
      svc.startPair({ deviceLabel: 'admin pair' });
      expect(svc.approve('246810', 'user-1')).toEqual({ ok: false, reason: 'not-client' });
      expect(svc.deny('246810')).toEqual({ ok: false, reason: 'not-client' });
      expect(svc.peek('246810')?.status).toBe('pending');
      expect((await svc.confirm('246810')).ok).toBe(true);
    });

    it('caps client pairs at 32 without touching the admin cap, and at 4 per peer', async () => {
      let i = 0;
      const svc = createDaemonPairingService({ generateCode: () => String(100000 + i++) });
      // Eight peers × four pairs fill the client cap exactly.
      for (let peer = 0; peer < 8; peer++) {
        for (let k = 0; k < 4; k++) await svc.startClientPair({ client: 'desktop', peer: `10.0.0.${peer}` });
      }
      await expect(svc.startClientPair({ client: 'desktop', peer: '10.0.0.99' })).rejects.toThrow(/waiting/);
      // The admin initiative still has its whole cap.
      expect(svc.startPair().code).toBeTruthy();
      // A settled pair frees its slot: deny one, and a fresh peer starts.
      svc.deny('100000');
      await expect(svc.startClientPair({ client: 'desktop', peer: '10.0.0.99' })).resolves.toBeTruthy();
      // The per-peer cap: the freed peer already holds three, so a
      // fourth fits and a fifth does not.
      await expect(svc.startClientPair({ client: 'desktop', peer: '10.0.0.0' })).rejects.toThrow(/waiting/);
    });

    it('a per-peer flood cannot fill the client cap: the fifth start from one address is refused', async () => {
      let i = 0;
      const svc = createDaemonPairingService({ generateCode: () => String(200000 + i++) });
      for (let k = 0; k < 4; k++) await svc.startClientPair({ client: 'cli', peer: '203.0.113.7' });
      await expect(svc.startClientPair({ client: 'cli', peer: '203.0.113.7' })).rejects.toThrow(/this address/);
      await expect(svc.startClientPair({ client: 'cli', peer: '203.0.113.8' })).resolves.toBeTruthy();
    });

    it('an unknown poll handle and an unknown code both draw the one global budget', async () => {
      const now = 8_000_000;
      const svc = clientService({ now: () => now, maxFailedLookups: 2 });
      const { pollToken } = await svc.startClientPair(CLIENT);
      expect(await svc.poll('not-a-handle')).toEqual({ status: 'unknown' });
      expect(svc.approve('000000', 'user-1')).toEqual({ ok: false, reason: 'unknown' });
      // Locked: the real pair is hidden from every verb, uniformly.
      expect(svc.peek('246810')).toBeNull();
      expect(await svc.poll(pollToken)).toEqual({ status: 'unknown' });
      expect(svc.approve('246810', 'user-1')).toEqual({ ok: false, reason: 'unknown' });
    });

    it('a live handle polling never draws the budget', async () => {
      const svc = clientService({ maxFailedLookups: 1 });
      const { pollToken } = await svc.startClientPair(CLIENT);
      for (let k = 0; k < 5; k++) expect((await svc.poll(pollToken)).status).toBe('pending');
      expect(svc.approve('246810', 'user-1')).toEqual({ ok: true });
      expect((await svc.poll(pollToken)).status).toBe('approved');
    });

    it('parallel polls on one approved handle mint exactly one token', async () => {
      const svc = clientService();
      const { pollToken } = await svc.startClientPair(CLIENT);
      svc.approve('246810', 'user-1');
      const results = await Promise.all([svc.poll(pollToken), svc.poll(pollToken)]);
      expect(results.filter((r) => r.status === 'approved')).toHaveLength(1);
      expect(await listDaemonAuthTokens()).toHaveLength(1);
    });

    it('a failed mint releases the approval so the next poll retries without a second approval', async () => {
      let fail = true;
      const svc = clientService({
        mintToken: async (input) => {
          if (fail) throw new Error('storage exploded');
          return {
            secret: 'oh_retry',
            record: {
              id: 'token-retry',
              tokenHash: 'h',
              label: input?.label,
              kind: 'session',
              createdAt: 0,
              lastUsedAt: null,
              revokedAt: null,
            },
          };
        },
      });
      const { pollToken } = await svc.startClientPair(CLIENT);
      svc.approve('246810', 'user-1');
      await expect(svc.poll(pollToken)).rejects.toThrow('storage exploded');
      expect(svc.peek('246810')?.status).toBe('approved');
      fail = false;
      expect(await svc.poll(pollToken)).toMatchObject({ status: 'approved', secret: 'oh_retry' });
    });

    it('cancel drops a client pair: its handle reads unknown afterwards', async () => {
      const svc = clientService();
      const { pollToken } = await svc.startClientPair(CLIENT);
      svc.cancel('246810');
      expect(svc.peek('246810')).toBeNull();
      expect(await svc.poll(pollToken)).toEqual({ status: 'unknown' });
    });

    it('a settled pair stays answerable through the retire grace, then leaves the table', async () => {
      let now = 9_000_000;
      const svc = clientService({ now: () => now, ttlMs: 1000 });
      const { pollToken } = await svc.startClientPair(CLIENT);
      svc.deny('246810');
      // Past expiry but inside the grace: the verdict still reads.
      now += 1500;
      expect(await svc.poll(pollToken)).toEqual({ status: 'denied' });
      // Past the grace: retired — and its code is free again.
      now += 5 * 60_000;
      expect(await svc.poll(pollToken)).toEqual({ status: 'unknown' });
      expect(svc.peek('246810')).toBeNull();
    });
  });

  describe('default code generator', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('produces digit strings of the requested length', () => {
      expect(defaultGenerateCode(6)).toMatch(/^\d{6}$/);
      expect(defaultGenerateCode(8)).toMatch(/^\d{8}$/);
    });

    it('rejection-samples bytes ≥ 250 so no digit is over-represented', () => {
      // Two deterministic fills: the first mixes rejected bytes (250,
      // 251, 255 — the values that would bias `% 10` toward 0–5) with
      // accepted ones; the second supplies the remainder.
      const fills = [
        [250, 251, 255, 0, 9, 10],
        [23, 249, 100, 250, 7, 77],
      ];
      let call = 0;
      vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((array) => {
        const bytes = array as Uint8Array;
        bytes.set(fills[call++] ?? []);
        return array;
      });
      // Accepted in order: 0→0, 9→9, 10→0, then 23→3, 249→9, 100→0.
      expect(defaultGenerateCode(6)).toBe('090390');
    });
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
