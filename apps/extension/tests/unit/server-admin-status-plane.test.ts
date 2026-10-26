/**
 * The admin-status store's host gate: a host that registers no
 * `serverAdmin` plane settles `denied` without ever dialing the
 * `oh.daemon.admin.status` channel (the extension — the call would land
 * nowhere and the re-ask cooldown would loop on it forever); a host
 * that registers the plane runs the per-user probe as before.
 */

import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import {
  __resetServerAdminStatusForTests,
  getServerAdminIdentity,
  getServerAdminStatus,
  getServerAdminStatusSettled,
  reprobeServerAdminStatus,
} from '@openheaders/ui/workbench/components/server-admin/use-server-admin-status';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCall } = vi.hoisted(() => ({ mockCall: vi.fn() }));

vi.mock('@openheaders/core/bridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openheaders/core/bridge')>();
  return {
    ...actual,
    hostBridge: { call: mockCall, subscribe: vi.fn(() => () => {}), broadcast: vi.fn(), presence: vi.fn() },
  };
});

beforeEach(() => {
  __resetServerAdminStatusForTests();
  mockCall.mockReset();
});

afterEach(() => {
  unregisterCapability('serverAdmin');
});

describe('server-admin status without a serverAdmin plane', () => {
  it('settles denied on the first read and never dials the channel', () => {
    expect(getServerAdminStatus()).toBe('denied');
    expect(getServerAdminStatusSettled()).toBe(true);
    expect(getServerAdminIdentity()).toBeNull();
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('stays settled across a forced re-ask', () => {
    getServerAdminStatus();
    reprobeServerAdminStatus();
    expect(getServerAdminStatus()).toBe('denied');
    expect(mockCall).not.toHaveBeenCalled();
  });
});

describe('server-admin status with a serverAdmin plane', () => {
  beforeEach(() => {
    registerCapability('serverAdmin', () => true);
  });

  it('runs the per-user probe and settles on its answer', async () => {
    mockCall.mockResolvedValue({ admin: true, user: { displayName: 'John Doe', email: 'john.doe@openheaders.io' } });
    expect(getServerAdminStatus()).toBe('unknown');
    expect(getServerAdminStatusSettled()).toBe(false);
    expect(mockCall).toHaveBeenCalledWith('oh.daemon.admin.status');
    await vi.waitFor(() => expect(getServerAdminStatusSettled()).toBe(true));
    expect(getServerAdminStatus()).toBe('admin');
    expect(getServerAdminIdentity()).toEqual({ displayName: 'John Doe', email: 'john.doe@openheaders.io' });
  });

  it('reads a transport rejection as an unsettled denied', async () => {
    mockCall.mockRejectedValue(new Error('wire not joined'));
    getServerAdminStatus();
    await vi.waitFor(() => expect(getServerAdminStatus()).toBe('denied'));
    expect(getServerAdminStatusSettled()).toBe(false);
  });
});
