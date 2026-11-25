/**
 * Who registers `openheaders://` with the system: every install but a
 * Windows package, whose manifest declares the scheme.
 */

import { app } from 'electron';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InstallKind } from '@/main/bootstrap/install-kind';
import { registerAsProtocolHandler } from '@/main/bootstrap/protocol';

describe('registering as the protocol handler', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each<InstallKind | null>(['nsis', 'msi', 'dev', null])('registers for an install of kind %s', (installKind) => {
    const register = vi.spyOn(app, 'setAsDefaultProtocolClient');
    registerAsProtocolHandler(installKind);
    expect(register).toHaveBeenCalledOnce();
    expect(register.mock.calls[0][0]).toBe('openheaders');
  });

  it('registers nothing inside a Windows package', () => {
    const register = vi.spyOn(app, 'setAsDefaultProtocolClient');
    registerAsProtocolHandler('msix');
    expect(register).not.toHaveBeenCalled();
  });
});
