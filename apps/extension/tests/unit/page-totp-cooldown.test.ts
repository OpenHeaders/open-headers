/**
 * The page realm's TOTP cooldown plane — a session executing in the
 * workbench page gates and records through the host bridge onto the
 * service worker's store: the tracker is the core's over the scope's
 * vault (none when the vault holds no TOTP entry), the gate asks
 * `oh.totp.checkCooldown` with the session's workspace and answers the
 * worker's refusal, the record fires `oh.totp.recordUsage`, an empty
 * batch never crosses the bridge, and a bridge that cannot answer lets
 * the batch go.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const call = vi.fn<(type: string, payload: unknown) => Promise<unknown>>();
vi.mock('@openheaders/core/bridge', () => ({
  hostBridge: { call: (type: string, payload: unknown) => call(type, payload) },
}));

import type { Vault } from '@openheaders/core/types';
import { pageTotpCooldownPlane } from '@openheaders/ui/shared/totp-cooldown';

const vault: Vault = {
  schemaVersion: 5,
  secrets: [
    { uid: 'sec00001', kind: 'string', name: 'api_key', value: 'k-1' },
    { uid: 'totp0001', kind: 'totp', name: 'otp', seed: 'JBSWY3DPEHPK3PXP', algorithm: 'SHA1', digits: 6, period: 30 },
  ],
};
const otp = { name: 'otp', code: '123456', period: 30 };

beforeEach(() => {
  call.mockReset();
});

describe('pageTotpCooldownPlane', () => {
  it('hands a tracker over the vault, none when the vault holds no TOTP entry', () => {
    const tracker = pageTotpCooldownPlane(vault, 'ws-1').tracker();
    expect(tracker).not.toBeNull();
    tracker?.observe([{ name: 'vault.otp', resolved: true, value: '123456', scope: 'vault' }]);
    expect(tracker?.used).toEqual([otp]);
    expect(pageTotpCooldownPlane({ schemaVersion: 5, secrets: [vault.secrets[0]] }, 'ws-1').tracker()).toBeNull();
  });

  it("the gate asks the worker with the session's workspace and answers its refusal", async () => {
    call.mockResolvedValue({ refusal: "TOTP 'otp' code can't be reused — wait 4s for the next window." });
    const plane = pageTotpCooldownPlane(vault, 'ws-1');
    await expect(plane.refusal([otp])).resolves.toBe("TOTP 'otp' code can't be reused — wait 4s for the next window.");
    expect(call).toHaveBeenCalledWith('oh.totp.checkCooldown', { workspaceId: 'ws-1', usages: [otp] });
    call.mockResolvedValue({ refusal: null });
    await expect(plane.refusal([otp])).resolves.toBeNull();
  });

  it('an empty batch never crosses the bridge; a bridge that cannot answer lets the batch go', async () => {
    const plane = pageTotpCooldownPlane(vault, null);
    await expect(plane.refusal([])).resolves.toBeNull();
    plane.record([]);
    expect(call).not.toHaveBeenCalled();
    call.mockRejectedValue(new Error('worker away'));
    await expect(plane.refusal([otp])).resolves.toBeNull();
  });

  it('the record fires the worker write with the workspace', async () => {
    call.mockResolvedValue({ ok: true });
    pageTotpCooldownPlane(vault, null).record([otp]);
    expect(call).toHaveBeenCalledWith('oh.totp.recordUsage', { workspaceId: null, usages: [otp] });
  });
});
