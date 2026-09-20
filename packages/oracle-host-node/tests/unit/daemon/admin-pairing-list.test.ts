/**
 * The admin console's pairing list (`oh.daemon.pairing.list`) — the
 * admin initiative's own projection. A person's device sign-in (the
 * client sign-in plan §6, the client initiative) rides the same pairing
 * table but is settled on the server's page and read by the client's
 * poll; its rows never appear in the Pair a device modal's list, whose
 * status vocabulary they do not share.
 */

import { createDaemonPairingService } from '@openheaders/core/identity';
import { describe, expect, it } from 'vitest';
import { buildAdminChannels } from './_admin-channels-rig';

describe('oh.daemon.pairing.list', () => {
  it('lists admin-initiated pairs only', async () => {
    let next = 100000;
    const pairing = createDaemonPairingService({ generateCode: () => String(++next) });
    const table = buildAdminChannels({ pairing });
    const admin = pairing.startPair({ deviceLabel: 'Work Chrome' });
    await pairing.startClientPair({ client: 'extension', peer: '10.0.0.7', deviceLabel: 'Alice laptop' });
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
    // Both pairs live in the one table — the console's list is a view, not a second table.
    expect(pairing.list()).toHaveLength(2);
  });
});
