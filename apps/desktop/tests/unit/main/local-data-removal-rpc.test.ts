/**
 * The desktop's main-process `oh.desktop.localData.remove` plane — the
 * one channel a Windows package answers to remove its own data. The rule
 * it runs is pinned where it lives (`bootstrap/local-data-removal`); here,
 * who gains the channel and what the plane hands the rule.
 */

import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createLocalDataRemovalRpc, type LocalDataRemovalRpcOptions } from '../../../src/main/local-data-removal-rpc';

const TARGET = join('C:', 'Users', 'John Doe', 'AppData', 'Local', 'OpenHeaders-Data');

function makePlane(overrides: Partial<LocalDataRemovalRpcOptions> = {}) {
  const undoTrust = vi.fn<LocalDataRemovalRpcOptions['undoTrust']>(async () => ({ ok: true, results: [] }));
  const appAlias = vi.fn(() => ({ on: true, name: 'OpenHeaders' }));
  const removeBrowserKeys = vi.fn(async () => undefined);
  const quitToRemove = vi.fn();
  const writeRequest = vi.fn();
  const plane = createLocalDataRemovalRpc({
    target: TARGET,
    undoTrust,
    log: { info: vi.fn(), warn: vi.fn() },
    seams: { appAlias, removeBrowserKeys, quitToRemove, writeRequest },
    ...overrides,
  });
  return { plane, undoTrust, appAlias, removeBrowserKeys, quitToRemove, writeRequest };
}

describe('desktop localData rpc', () => {
  it('answers only its own channel', () => {
    const { plane, undoTrust } = makePlane();
    expect(plane.dispatch('oh.daemon.proxy.trust.remove', { dropCa: true })).toBeUndefined();
    expect(plane.dispatch('oh.secrets.relaunch', {})).toBeUndefined();
    expect(undoTrust).not.toHaveBeenCalled();
  });

  it('answers nothing in an install that has no removal: no other install gains the channel', () => {
    const { plane, undoTrust, appAlias } = makePlane({ target: null });
    expect(plane.dispatch('oh.desktop.localData.remove', { force: true })).toBeUndefined();
    expect(appAlias).not.toHaveBeenCalled();
    expect(undoTrust).not.toHaveBeenCalled();
  });

  it("runs the removal on the package's own folder and answers that the app is closing", async () => {
    const { plane, undoTrust, removeBrowserKeys, quitToRemove, writeRequest } = makePlane();
    expect(await plane.dispatch('oh.desktop.localData.remove', {})).toEqual({ outcome: 'restarting' });
    expect(undoTrust).toHaveBeenCalledOnce();
    expect(removeBrowserKeys).toHaveBeenCalledWith(TARGET);
    expect(writeRequest).toHaveBeenCalledWith(TARGET);
    expect(quitToRemove).toHaveBeenCalledWith(TARGET);
  });

  it.each<[string, Record<string, unknown>]>([
    ['no word', {}],
    ['a word that is not a plain yes', { force: 'true' }],
  ])('stops at a store that keeps its trust on %s', async (_case, message) => {
    const undoTrust = vi.fn<LocalDataRemovalRpcOptions['undoTrust']>(async () => ({
      ok: false,
      results: [{ store: 'nss-firefox', ref: 'ab12cd34.default-release', ok: false }],
    }));
    const { plane, quitToRemove } = makePlane({ undoTrust });
    expect(await plane.dispatch('oh.desktop.localData.remove', message)).toEqual({
      outcome: 'trust-refused',
      stores: [{ store: 'nss-firefox', ref: 'ab12cd34.default-release' }],
    });
    expect(quitToRemove).not.toHaveBeenCalled();
  });

  it("goes on past that store on the person's second word", async () => {
    const undoTrust = vi.fn<LocalDataRemovalRpcOptions['undoTrust']>(async () => ({
      ok: false,
      results: [{ store: 'nss-firefox', ref: 'ab12cd34.default-release', ok: false }],
    }));
    const { plane, quitToRemove } = makePlane({ undoTrust });
    expect(await plane.dispatch('oh.desktop.localData.remove', { force: true })).toEqual({ outcome: 'restarting' });
    expect(quitToRemove).toHaveBeenCalledOnce();
  });
});
