/**
 * Web sign-out — drops the daemon session (token + consumed orgs) and
 * navigates back to the gate, and still navigates when the storage
 * cleanup throws so a user is never stranded in a half-signed-out tab.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const tokenModule = vi.hoisted(() => ({ clearDaemonToken: vi.fn(async () => {}) }));
vi.mock('@/host/daemon-token', () => tokenModule);

const storageModule = vi.hoisted(() => ({
  hostStorage: { remove: vi.fn(async () => {}) },
  OH: { joinedOrgs: 'oh.joinedOrgs', webBackendToken: 'oh.webBackendToken' },
}));
vi.mock('@openheaders/core/storage', () => storageModule);

vi.mock('@openheaders/core/logger', () => ({
  hostLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { signOutWeb } from '@/host/sign-out';

describe('signOutWeb', () => {
  beforeEach(() => {
    tokenModule.clearDaemonToken.mockClear();
    storageModule.hostStorage.remove.mockClear();
    storageModule.hostStorage.remove.mockImplementation(async () => {});
  });

  it('clears the token, removes consumed orgs, then navigates to the gate', async () => {
    const navigate = vi.fn();
    await signOutWeb(navigate);
    expect(tokenModule.clearDaemonToken).toHaveBeenCalledOnce();
    expect(storageModule.hostStorage.remove).toHaveBeenCalledWith(storageModule.OH.joinedOrgs);
    expect(navigate).toHaveBeenCalledOnce();
  });

  it('navigates even when the cleanup throws', async () => {
    storageModule.hostStorage.remove.mockRejectedValueOnce(new Error('idb unavailable'));
    const navigate = vi.fn();
    await signOutWeb(navigate);
    expect(navigate).toHaveBeenCalledOnce();
  });
});
