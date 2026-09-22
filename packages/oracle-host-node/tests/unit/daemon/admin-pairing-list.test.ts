/**
 * The admin console's pairing list (`oh.daemon.pairing.list`) — the
 * admin initiative's projection of the pairing table. A person's own
 * sign-in from a native client lives in the authorization service (the
 * client sign-in plan §14), never in this list.
 */

import { createDaemonPairingService } from '@openheaders/core/identity';
import { describe, expect, it } from 'vitest';
import { buildAdminChannels } from './_admin-channels-rig';

describe('oh.daemon.pairing.list', () => {
  it('lists the pending admin pairs', async () => {
    let next = 100000;
    const pairing = createDaemonPairingService({ generateCode: () => String(++next) });
    const table = buildAdminChannels({ pairing });
    const admin = pairing.startPair({ deviceLabel: 'Work Chrome' });
    const list = table.get('oh.daemon.pairing.list');
    if (!list) throw new Error('channel missing');

    const listed = (await list({})) as { pairs: Array<{ code: string; deviceLabel?: string; status: string }> };

    expect(listed.pairs).toEqual([
      {
        code: admin.code,
        deviceLabel: 'Work Chrome',
        createdAt: expect.any(Number),
        expiresAt: expect.any(Number),
        status: 'pending',
      },
    ]);
    expect(pairing.list()).toHaveLength(1);
  });
});
