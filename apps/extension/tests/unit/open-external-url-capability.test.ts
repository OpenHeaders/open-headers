/**
 * `openExternalUrl` host impl — the capability body shared by the
 * standard capability install and the workbench's curated entry (the
 * server wizard's "Sign in on <host>" opens the approval page through
 * it from the workbench tab): relays through the SW's `openTab` bridge
 * RPC, reshapes its verdict, and folds bridge failures to an honest
 * `{ ok: false, error }`.
 */

import type { HostBridge } from '@openheaders/core/bridge';
import { setHostBridge } from '@openheaders/core/bridge';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openExternalUrl } from '@/host/open-external-url';

const call = vi.fn<(...args: unknown[]) => Promise<unknown>>();

beforeEach(() => {
  call.mockReset();
  setHostBridge({ call } as unknown as HostBridge);
});

describe('openExternalUrl capability impl', () => {
  it('opens the URL through the SW tab relay and reports success', async () => {
    call.mockResolvedValueOnce({ success: true, tabId: 7 });
    await expect(openExternalUrl('http://192.168.1.20:8137/pair/123456')).resolves.toEqual({
      ok: true,
      error: undefined,
    });
    expect(call).toHaveBeenCalledWith('openTab', { url: 'http://192.168.1.20:8137/pair/123456' });
  });

  it('carries the tab refusal through', async () => {
    call.mockResolvedValueOnce({ success: false, error: 'Invalid url' });
    await expect(openExternalUrl('nope')).resolves.toEqual({ ok: false, error: 'Invalid url' });
  });

  it('folds a bridge failure to an honest refusal', async () => {
    call.mockRejectedValueOnce(new Error('bridge(openTab) failed: SW gone'));
    await expect(openExternalUrl('https://openheaders.io')).resolves.toEqual({
      ok: false,
      error: 'bridge(openTab) failed: SW gone',
    });
  });
});
