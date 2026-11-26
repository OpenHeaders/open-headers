/**
 * The handlers behind the renderer's `packageAliases` capability exist in
 * a Windows package alone: no other install has launch aliases, and none
 * of them gains a channel.
 */

import { ipcMain } from 'electron';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InstallKind } from '@/main/bootstrap/install-kind';
import { installPackageAliasHandlers } from '@/main/bootstrap/package-alias-bridge';

describe("the package aliases' handlers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each<InstallKind | null>(['nsis', 'msi', 'dev', null])('are not installed in an install of kind %s', (kind) => {
    const handle = vi.spyOn(ipcMain, 'handle');
    installPackageAliasHandlers(kind);
    expect(handle).not.toHaveBeenCalled();
  });

  it('answer the read and the open in a Windows package', () => {
    const handle = vi.spyOn(ipcMain, 'handle');
    installPackageAliasHandlers('msix');
    expect(handle.mock.calls.map((call) => call[0])).toEqual([
      'oh:package-aliases:read',
      'oh:package-aliases:open-settings',
    ]);
  });
});
