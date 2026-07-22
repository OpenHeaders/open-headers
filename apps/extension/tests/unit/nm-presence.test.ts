/**
 * `nmHostPresence` capability impl — OS truth for "was the desktop app
 * ever installed": ANY framed answer from the spawned host (its
 * `bad-request` refusal included) proves the manifest + binary exist;
 * a spawn error proves they don't. Injected sends bypass the cache.
 */

import { describe, expect, it } from 'vitest';
import { nmHostPresence } from '../../src/host/nm-presence';
import { NM_HOST_NAME } from '../../src/shared/nm-handoff';

describe('nmHostPresence', () => {
  it('any framed answer — even a refusal — proves presence', async () => {
    const sent: Array<{ host: string; message: Record<string, unknown> }> = [];
    const present = await nmHostPresence(async (host, message) => {
      sent.push({ host, message });
      return { ok: false, reason: 'bad-request' };
    });
    expect(present).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0].host).toBe(NM_HOST_NAME);
    // Never a bootstrap — the probe must not dial the daemon or mint.
    expect(sent[0].message.kind).not.toBe('bootstrap');
  });

  it('a spawn error proves absence', async () => {
    const present = await nmHostPresence(async () => {
      throw new Error('Specified native messaging host not found.');
    });
    expect(present).toBe(false);
  });
});
