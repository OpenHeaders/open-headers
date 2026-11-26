/**
 * A classic app hands its start over to the Windows package: through the
 * app's launch alias and no other path, with what the start was asked to
 * open, and with an honest answer when the package could not be started.
 */

import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { PACKAGE_APP_ALIAS } from '@/main/bootstrap/package-aliases';
import { handOverToPackage } from '@/main/bootstrap/package-hand-over';

describe('the start handed over to the Windows package', () => {
  const localAppDataDir = join('C:', 'Users', 'JohnDoe', 'AppData', 'Local');
  const alias = join(localAppDataDir, 'Microsoft', 'WindowsApps', PACKAGE_APP_ALIAS);

  it("starts the package's app through its launch alias", async () => {
    const start = vi.fn(async () => true);
    await expect(handOverToPackage({ localAppDataDir, args: [] }, { start })).resolves.toBe(true);
    expect(start).toHaveBeenCalledExactlyOnceWith(alias, []);
  });

  it('passes on the link the start was asked to open', async () => {
    const start = vi.fn(async () => true);
    const link = 'openheaders://openheaders.io/import?source=team';
    await handOverToPackage({ localAppDataDir, args: [link] }, { start });
    expect(start).toHaveBeenCalledExactlyOnceWith(alias, [link]);
  });

  it('says so when the package could not be started', async () => {
    const start = vi.fn(async () => false);
    await expect(handOverToPackage({ localAppDataDir, args: [] }, { start })).resolves.toBe(false);
  });

  it('answers no for a program that is not there, as a switched-off alias is not', async () => {
    const missing = join(localAppDataDir, 'oh-no-such-folder');
    await expect(handOverToPackage({ localAppDataDir: missing, args: [] })).resolves.toBe(false);
  });
});
