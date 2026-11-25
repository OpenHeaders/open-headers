/**
 * Which folder an install keeps its data in. Only a Windows package
 * leaves the folder every install has always had; the log file follows
 * whichever folder was chosen.
 */

import { join } from 'node:path';
import { app } from 'electron';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { chooseDataDir, type DataDirFacts } from '@/main/bootstrap/data-dir';
import { PACKAGE_DATA_DIR_NAME } from '@/main/bootstrap/data-folder-return';
import type { InstallKind } from '@/main/bootstrap/install-kind';
import { logsRootDir } from '@/main/bootstrap/logger';

const ROAMING = join('C:', 'Users', 'John Doe', 'AppData', 'Roaming');
const LOCAL = join('C:', 'Users', 'John Doe', 'AppData', 'Local');
const HOME = join('C:', 'Users', 'John Doe');

function makeFacts(overrides: Partial<DataDirFacts> = {}): DataDirFacts {
  return {
    installKind: 'nsis',
    isPackaged: true,
    appDataDir: ROAMING,
    localAppDataDir: LOCAL,
    homeDir: HOME,
    ...overrides,
  };
}

describe('the data folder an install chooses', () => {
  it.each<InstallKind | null>(['nsis', 'msi', null])(
    'is the folder it always was for an installed app of kind %s',
    (installKind) => {
      expect(chooseDataDir(makeFacts({ installKind }))).toBe(join(ROAMING, 'OpenHeaders'));
    },
  );

  it.each<InstallKind | null>(['dev', null])(
    'is the suffixed folder for a development run of kind %s',
    (installKind) => {
      expect(chooseDataDir(makeFacts({ installKind, isPackaged: false }))).toBe(join(ROAMING, 'OpenHeaders-Dev'));
    },
  );

  it("is the package's own folder under Local AppData in a Windows package", () => {
    expect(chooseDataDir(makeFacts({ installKind: 'msix' }))).toBe(join(LOCAL, PACKAGE_DATA_DIR_NAME));
  });

  it.each([undefined, ''])(
    'never falls back to the classic folder when Local AppData is not named (%s)',
    (localAppDataDir) => {
      expect(chooseDataDir(makeFacts({ installKind: 'msix', localAppDataDir }))).toBe(
        join(HOME, 'AppData', 'Local', PACKAGE_DATA_DIR_NAME),
      );
    },
  );
});

describe('the log folder', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lies in the chosen data folder', () => {
    const chosen = chooseDataDir(makeFacts({ installKind: 'msix' }));
    vi.spyOn(app, 'getPath').mockImplementation((name) => (name === 'userData' ? chosen : join(HOME, name)));
    expect(logsRootDir()).toBe(join(LOCAL, PACKAGE_DATA_DIR_NAME, 'logs'));
  });
});
