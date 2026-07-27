/**
 * `companionReveal` host impl — the capability body shared by the
 * standard capability install and the workbench's curated entry:
 * relays through the SW bridge RPC and folds bridge failures to an
 * honest `{ ok: false, reason }`.
 */

import type { HostBridge } from '@openheaders/core/bridge';
import { setHostBridge } from '@openheaders/core/bridge';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { companionReveal } from '@/host/companion-reveal';

const call = vi.fn<(...args: unknown[]) => Promise<unknown>>();

beforeEach(() => {
  call.mockReset();
  setHostBridge({ call } as unknown as HostBridge);
});

describe('companionReveal capability impl', () => {
  it('relays the target over the bridge and returns the verdict', async () => {
    call.mockResolvedValueOnce({ ok: true });
    await expect(companionReveal('terminal')).resolves.toEqual({ ok: true });
    expect(call).toHaveBeenCalledWith('companionReveal', { target: 'terminal' });
  });

  it('carries the refusal reason through', async () => {
    call.mockResolvedValueOnce({ ok: false, reason: 'Unknown reveal target.' });
    await expect(companionReveal('git')).resolves.toEqual({ ok: false, reason: 'Unknown reveal target.' });
  });

  it('folds a bridge failure to an honest refusal', async () => {
    call.mockRejectedValueOnce(new Error('bridge(companionReveal) failed: SW gone'));
    await expect(companionReveal('terminal')).resolves.toEqual({
      ok: false,
      reason: 'bridge(companionReveal) failed: SW gone',
    });
  });
});
