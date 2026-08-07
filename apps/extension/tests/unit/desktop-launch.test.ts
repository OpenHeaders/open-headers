/**
 * `desktopLaunch` capability impl — one launch-verb exchange with the
 * NM host: the wire carries no binary path (the host anchors WHAT it
 * launches to its own install root), and every failure — refusal,
 * missing host — folds to `{ ok: false }`.
 */

import { describe, expect, it } from 'vitest';
import { desktopLaunch } from '../../src/host/desktop-launch';
import { NM_HOST_NAME } from '../../src/shared/nm-handoff';

describe('desktopLaunch', () => {
  it('sends the bare launch verb and relays success', async () => {
    const sent: Array<{ host: string; message: Record<string, unknown> }> = [];
    const result = await desktopLaunch(async (host, message) => {
      sent.push({ host, message });
      return { ok: true };
    });
    expect(result).toEqual({ ok: true });
    expect(sent).toEqual([{ host: NM_HOST_NAME, message: { kind: 'launch' } }]);
  });

  it('folds a host refusal to ok:false', async () => {
    const result = await desktopLaunch(async () => ({ ok: false, reason: 'unanchored' }));
    expect(result).toEqual({ ok: false });
  });

  it('folds a missing host to ok:false', async () => {
    const result = await desktopLaunch(async () => {
      throw new Error('Specified native messaging host not found.');
    });
    expect(result).toEqual({ ok: false });
  });
});
