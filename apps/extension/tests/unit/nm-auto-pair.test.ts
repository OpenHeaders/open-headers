/**
 * `nmAutoPair` capability impl — the wizard's pair-without-a-code
 * gesture: one handoff for the given URL, install id hydrated so the
 * daemon's rotation hygiene still scopes wizard-minted tokens, results
 * mapped to the capability's typed shape.
 */

import { describe, expect, it } from 'vitest';
import { nmAutoPair } from '../../src/host/nm-auto-pair';
import { NM_HOST_NAME } from '../../src/shared/nm-handoff';

describe('nmAutoPair', () => {
  it('performs one handoff for the given URL and returns the minted token', async () => {
    const sent: Array<{ host: string; message: Record<string, unknown> }> = [];
    const result = await nmAutoPair({ url: 'ws://127.0.0.1:8137' }, async (host, message) => {
      sent.push({ host, message });
      return { ok: true, token: 'oh_wizard', tokenId: 't1', browser: 'Google Chrome' };
    });
    expect(result).toEqual({ ok: true, token: 'oh_wizard', browser: 'Google Chrome' });
    expect(sent).toHaveLength(1);
    expect(sent[0].host).toBe(NM_HOST_NAME);
    expect(sent[0].message.kind).toBe('bootstrap');
    expect(sent[0].message.url).toBe('ws://127.0.0.1:8137');
    // The hydrated install id rides along to scope daemon-side rotation.
    expect(typeof sent[0].message.installId).toBe('string');
  });

  it('maps a missing native host to the unavailable reason', async () => {
    const result = await nmAutoPair({ url: 'ws://127.0.0.1:8137' }, async () => {
      throw new Error('Specified native messaging host not found.');
    });
    expect(result).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('relays the daemon refusal coarsely', async () => {
    const result = await nmAutoPair({ url: 'ws://127.0.0.1:8137' }, async () => ({ ok: false, reason: 'refused' }));
    expect(result).toEqual({ ok: false, reason: 'refused' });
  });
});
