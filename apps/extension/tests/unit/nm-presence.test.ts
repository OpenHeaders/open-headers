/**
 * `nmHostPresence` capability impl — OS truth for "was the desktop app
 * ever installed" plus launch-anchoring: ANY framed answer from the
 * spawned host proves presence; only an explicit `anchored: false`
 * (the dev-layout host's presence answer) demotes anchoring, because a
 * packaged host predating the presence verb answers `bad-request` with
 * no field and is anchored by construction. A spawn error proves
 * absence. Injected sends bypass the cache.
 */

import { describe, expect, it } from 'vitest';
import { nmHostPresence } from '../../src/host/nm-presence';
import { NM_HOST_NAME } from '../../src/shared/nm-handoff';

describe('nmHostPresence', () => {
  it('a presence answer reporting anchored reads present + anchored', async () => {
    const sent: Array<{ host: string; message: Record<string, unknown> }> = [];
    const verdict = await nmHostPresence(async (host, message) => {
      sent.push({ host, message });
      return { ok: true, anchored: true };
    });
    expect(verdict).toEqual({ present: true, anchored: true });
    expect(sent).toHaveLength(1);
    expect(sent[0].host).toBe(NM_HOST_NAME);
    expect(sent[0].message.kind).toBe('presence');
  });

  it('an explicit unanchored answer — the dev-layout host — keeps presence, drops anchoring', async () => {
    const verdict = await nmHostPresence(async () => ({ ok: true, anchored: false }));
    expect(verdict).toEqual({ present: true, anchored: false });
  });

  it('a field-less refusal — a host predating the verb — proves presence and stays anchored', async () => {
    const sent: Array<{ host: string; message: Record<string, unknown> }> = [];
    const verdict = await nmHostPresence(async (host, message) => {
      sent.push({ host, message });
      return { ok: false, reason: 'bad-request' };
    });
    expect(verdict).toEqual({ present: true, anchored: true });
    // Never a bootstrap — the probe must not dial the daemon or mint.
    expect(sent[0].message.kind).not.toBe('bootstrap');
  });

  it('a spawn error proves absence', async () => {
    const verdict = await nmHostPresence(async () => {
      throw new Error('Specified native messaging host not found.');
    });
    expect(verdict).toEqual({ present: false, anchored: false });
  });
});
