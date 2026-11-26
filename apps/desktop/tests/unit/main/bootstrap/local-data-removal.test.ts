/**
 * A Windows package removes its own data and capture trust: the running
 * app undoes what lies outside its folder and leaves a request, and a new
 * start deletes the folder — that one folder, and only on the request.
 * The folders are real ones under a temporary root; what Windows answers
 * (the alias, a store that keeps its trust, a delete refused while a file
 * is held) is injected, so every rule runs on every platform.
 */

import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BridgeRpcResponse } from '@openheaders/core/bridge';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InstallKind } from '@/main/bootstrap/install-kind';
import {
  LOCAL_DATA_REMOVAL_EXIT,
  type LocalDataRemovalRequestSeams,
  localDataRemovalTarget,
  REMOVAL_REQUEST_FILE_NAME,
  REMOVE_LOCAL_DATA_SWITCH,
  removeLocalData,
  requestLocalDataRemoval,
  withdrawRemovalRequest,
} from '@/main/bootstrap/local-data-removal';

type TrustTeardown = BridgeRpcResponse<'oh.daemon.proxy.trust.remove'>;

const FIREFOX_PROFILE = 'C:\\Users\\John Doe\\AppData\\Roaming\\Mozilla\\Firefox\\Profiles\\ab12cd34.default-release';

function fileError(code: string): Error {
  return Object.assign(new Error(code), { code });
}

describe('the folder a removal deletes', () => {
  const facts = {
    installKind: 'msix' as InstallKind | null,
    userDataOverride: undefined,
    localAppDataDir: join('C:', 'Users', 'John Doe', 'AppData', 'Local'),
    homeDir: join('C:', 'Users', 'John Doe'),
  };

  it("is the Windows package's own data folder", () => {
    expect(localDataRemovalTarget(facts)).toBe(join(facts.localAppDataDir, 'OpenHeaders-Data'));
  });

  it('is found under the home folder when Windows names no Local AppData', () => {
    expect(localDataRemovalTarget({ ...facts, localAppDataDir: undefined })).toBe(
      join(facts.homeDir, 'AppData', 'Local', 'OpenHeaders-Data'),
    );
  });

  it.each<InstallKind | null>(['nsis', 'msi', 'dev', null])('is none in an install of kind %s', (installKind) => {
    expect(localDataRemovalTarget({ ...facts, installKind })).toBeNull();
  });

  it('is none in a package running on a data folder named from outside', () => {
    expect(localDataRemovalTarget({ ...facts, userDataOverride: join('D:', 'scratch', 'profile') })).toBeNull();
  });
});

describe('a removal', () => {
  let root: string;
  let target: string;

  function seedData(withRequest = false): void {
    mkdirSync(join(target, 'data'), { recursive: true });
    writeFileSync(join(target, 'data', 'settings.json'), '{"owner":"John Doe"}');
    if (withRequest) writeFileSync(join(target, REMOVAL_REQUEST_FILE_NAME), '{}');
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'oh-data-removal-'));
    target = join(root, 'Local', 'OpenHeaders-Data');
    mkdirSync(join(root, 'Local'), { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  describe('asked of the running app', () => {
    const appAlias = vi.fn<LocalDataRemovalRequestSeams['appAlias']>();
    const undoTrust = vi.fn<LocalDataRemovalRequestSeams['undoTrust']>();
    const removeBrowserKeys = vi.fn<LocalDataRemovalRequestSeams['removeBrowserKeys']>();
    const quitToRemove = vi.fn<LocalDataRemovalRequestSeams['quitToRemove']>();
    const seams: LocalDataRemovalRequestSeams = { appAlias, undoTrust, removeBrowserKeys, quitToRemove };

    const refused: TrustTeardown = {
      ok: false,
      results: [
        { store: 'nss-firefox', ref: FIREFOX_PROFILE, ok: false, error: 'the profile is in use' },
        { store: 'nss-firefox', ref: `${FIREFOX_PROFILE}-1`, ok: true },
      ],
    };

    function requestPresent(): boolean {
      return existsSync(join(target, REMOVAL_REQUEST_FILE_NAME));
    }

    beforeEach(() => {
      seedData();
      appAlias.mockReset().mockReturnValue({ on: true, name: 'OpenHeaders' });
      undoTrust.mockReset().mockResolvedValue({ ok: true, results: [] });
      removeBrowserKeys.mockReset().mockResolvedValue(undefined);
      quitToRemove.mockReset();
    });

    it('undoes trust, removes the browser keys, leaves the request and quits — in that order', async () => {
      const order: string[] = [];
      undoTrust.mockImplementation(async () => {
        order.push('trust');
        return { ok: true, results: [] };
      });
      removeBrowserKeys.mockImplementation(async () => {
        order.push(`keys before the request: ${!requestPresent()}`);
      });
      quitToRemove.mockImplementation(() => {
        order.push(`quit after the request: ${requestPresent()}`);
      });

      expect(await requestLocalDataRemoval({ target, force: false }, seams)).toEqual({ outcome: 'restarting' });
      expect(order).toEqual(['trust', 'keys before the request: true', 'quit after the request: true']);
      expect(removeBrowserKeys).toHaveBeenCalledWith(target);
      expect(quitToRemove).toHaveBeenCalledWith(target);
      expect(existsSync(join(target, 'data', 'settings.json'))).toBe(true);
    });

    it('changes nothing while Windows keeps no alias for the app: it could not start itself again', async () => {
      appAlias.mockReturnValue({ on: false, name: 'OpenHeaders' });
      expect(await requestLocalDataRemoval({ target, force: false }, seams)).toEqual({
        outcome: 'alias-off',
        name: 'OpenHeaders',
      });
      expect(undoTrust).not.toHaveBeenCalled();
      expect(removeBrowserKeys).not.toHaveBeenCalled();
      expect(quitToRemove).not.toHaveBeenCalled();
      expect(requestPresent()).toBe(false);
    });

    it('stops at a store that keeps its trust, lists it, and changes nothing else', async () => {
      undoTrust.mockResolvedValue(refused);
      expect(await requestLocalDataRemoval({ target, force: false }, seams)).toEqual({
        outcome: 'trust-refused',
        stores: [{ store: 'nss-firefox', ref: FIREFOX_PROFILE, error: 'the profile is in use' }],
      });
      expect(removeBrowserKeys).not.toHaveBeenCalled();
      expect(quitToRemove).not.toHaveBeenCalled();
      expect(requestPresent()).toBe(false);
    });

    it("goes on past that store on the person's second word", async () => {
      undoTrust.mockResolvedValue(refused);
      expect(await requestLocalDataRemoval({ target, force: true }, seams)).toEqual({ outcome: 'restarting' });
      expect(undoTrust).toHaveBeenCalledOnce();
      expect(removeBrowserKeys).toHaveBeenCalledOnce();
      expect(quitToRemove).toHaveBeenCalledOnce();
      expect(requestPresent()).toBe(true);
    });

    it.each<[string, () => Promise<TrustTeardown>]>([
      ['answers that it did not run', async () => ({ ok: false, results: [], error: 'record unreadable' })],
      [
        'throws',
        async () => {
          throw new Error('record unreadable');
        },
      ],
    ])('stops when the teardown %s, and says why', async (_case, teardown) => {
      undoTrust.mockImplementation(teardown);
      expect(await requestLocalDataRemoval({ target, force: false }, seams)).toEqual({
        outcome: 'trust-refused',
        stores: [],
        error: 'record unreadable',
      });
      expect(quitToRemove).not.toHaveBeenCalled();
    });

    it('does not quit when the request cannot be left in the folder', async () => {
      const writeRequest = vi.fn(() => {
        throw fileError('EPERM');
      });
      expect(await requestLocalDataRemoval({ target, force: false }, { ...seams, writeRequest })).toEqual({
        outcome: 'failed',
        reason: 'EPERM',
      });
      expect(quitToRemove).not.toHaveBeenCalled();
    });

    it('answers an install that has no removal without touching anything', async () => {
      expect(await requestLocalDataRemoval({ target: null, force: true }, seams)).toEqual({
        outcome: 'failed',
        reason: 'unavailable',
      });
      expect(appAlias).not.toHaveBeenCalled();
      expect(undoTrust).not.toHaveBeenCalled();
    });

    it('has its request withdrawn by an ordinary start, and a start with no request is left alone', async () => {
      await requestLocalDataRemoval({ target, force: false }, seams);
      expect(requestPresent()).toBe(true);

      withdrawRemovalRequest(target);
      expect(requestPresent()).toBe(false);
      expect(existsSync(join(target, 'data', 'settings.json'))).toBe(true);

      expect(() => withdrawRemovalRequest(target)).not.toThrow();
      expect(() => withdrawRemovalRequest(join(root, 'Local', 'Absent'))).not.toThrow();
    });
  });

  describe('made by the start the app asked for', () => {
    const sleep = vi.fn<(ms: number) => void>();

    beforeEach(() => {
      sleep.mockReset();
    });

    it('deletes the folder with everything in it', () => {
      seedData(true);
      expect(removeLocalData({ target }, { sleep })).toEqual({ outcome: 'removed', target });
      expect(existsSync(target)).toBe(false);
      expect(existsSync(join(root, 'Local'))).toBe(true);
      expect(sleep).not.toHaveBeenCalled();
    });

    it('removes nothing from a folder that carries no request: the switch alone is not the word', () => {
      seedData();
      const remove = vi.fn();
      expect(removeLocalData({ target }, { remove }).outcome).toBe('not-requested');
      expect(remove).not.toHaveBeenCalled();
      expect(existsSync(join(target, 'data', 'settings.json'))).toBe(true);
    });

    it('removes nothing in an install that has no removal', () => {
      const remove = vi.fn();
      expect(removeLocalData({ target: null }, { remove }).outcome).toBe('not-requested');
      expect(remove).not.toHaveBeenCalled();
    });

    it('removes nothing when no folder is there', () => {
      const remove = vi.fn();
      expect(removeLocalData({ target }, { remove }).outcome).toBe('not-requested');
      expect(remove).not.toHaveBeenCalled();
    });

    it('does not follow a link standing where the folder would be', () => {
      const elsewhere = join(root, 'Elsewhere');
      mkdirSync(elsewhere);
      writeFileSync(join(elsewhere, REMOVAL_REQUEST_FILE_NAME), '{}');
      symlinkSync(elsewhere, target, 'junction');
      const remove = vi.fn();
      expect(removeLocalData({ target }, { remove }).outcome).toBe('not-requested');
      expect(remove).not.toHaveBeenCalled();
      expect(existsSync(join(elsewhere, REMOVAL_REQUEST_FILE_NAME))).toBe(true);
    });

    it('does not take a folder of the request’s name for a request', () => {
      seedData();
      mkdirSync(join(target, REMOVAL_REQUEST_FILE_NAME));
      const remove = vi.fn();
      expect(removeLocalData({ target }, { remove }).outcome).toBe('not-requested');
      expect(remove).not.toHaveBeenCalled();
    });

    it.each(['EBUSY', 'EPERM', 'EACCES', 'ENOTEMPTY'])(
      'waits out a file the old process still holds (%s), then deletes',
      (code) => {
        seedData(true);
        let refusals = 3;
        const remove = vi.fn((folder: string) => {
          if (refusals-- > 0) throw fileError(code);
          rmSync(folder, { recursive: true });
        });
        expect(removeLocalData({ target }, { remove, sleep })).toEqual({ outcome: 'removed', target });
        expect(remove).toHaveBeenCalledTimes(4);
        expect(sleep).toHaveBeenCalledTimes(3);
        expect(sleep).toHaveBeenCalledWith(500);
        expect(existsSync(target)).toBe(false);
      },
    );

    it('carries on with what a refused delete left, the request gone or not', () => {
      seedData(true);
      let first = true;
      const remove = vi.fn((folder: string) => {
        if (first) {
          first = false;
          rmSync(join(folder, REMOVAL_REQUEST_FILE_NAME));
          throw fileError('EBUSY');
        }
        rmSync(folder, { recursive: true });
      });
      expect(removeLocalData({ target }, { remove, sleep })).toEqual({ outcome: 'removed', target });
      expect(existsSync(target)).toBe(false);
    });

    it('gives up on a held file after fifteen seconds and names the folder', () => {
      seedData(true);
      const remove = vi.fn(() => {
        throw fileError('EBUSY');
      });
      expect(removeLocalData({ target }, { remove, sleep })).toEqual({ outcome: 'left', target, code: 'EBUSY' });
      expect(sleep.mock.calls.length * 500).toBeLessThanOrEqual(15_000);
      expect(sleep.mock.calls.length * 500).toBeGreaterThanOrEqual(14_000);
    });

    it('does not wait on a refusal that cannot pass', () => {
      seedData(true);
      const remove = vi.fn(() => {
        throw fileError('EIO');
      });
      expect(removeLocalData({ target }, { remove, sleep })).toEqual({ outcome: 'left', target, code: 'EIO' });
      expect(remove).toHaveBeenCalledOnce();
      expect(sleep).not.toHaveBeenCalled();
    });
  });

  it('keeps the names both of its starts agree on', () => {
    expect(REMOVE_LOCAL_DATA_SWITCH).toBe('--remove-local-data');
    expect(REMOVAL_REQUEST_FILE_NAME).toBe('remove-local-data.json');
    expect(LOCAL_DATA_REMOVAL_EXIT).toEqual({ removed: 0, notRequested: 8, left: 9 });
  });
});
