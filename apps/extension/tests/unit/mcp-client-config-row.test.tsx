/**
 * The program an MCP client is told to run. A host that knows where it
 * is installed answers for itself; every other host keeps the platform's
 * standard install location.
 */

import { registerCapability, unregisterCapability } from '@openheaders/core/capabilities';
import { binaryPathForThisPlatform } from '@openheaders/ui/workbench/settings/components/mcp-client-config-row';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('the MCP client snippets program path', () => {
  afterEach(() => {
    unregisterCapability('mcpClientCommand');
    vi.restoreAllMocks();
  });

  it.each([
    ['Win32', 'C:\\Users\\YOU\\AppData\\Local\\Programs\\open-headers\\OpenHeaders.exe'],
    ['Linux x86_64', '/opt/OpenHeaders/open-headers'],
    ['MacIntel', '/Applications/OpenHeaders.app/Contents/MacOS/OpenHeaders'],
  ])('is the standard install location on %s when the host gives none', (platform, expected) => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue(platform);
    expect(binaryPathForThisPlatform()).toBe(expected);
  });

  it("is the host's own answer when it gives one", () => {
    const alias = 'C:\\Users\\John Doe\\AppData\\Local\\Microsoft\\WindowsApps\\openheaders.exe';
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('Win32');
    registerCapability('mcpClientCommand', () => alias);
    expect(binaryPathForThisPlatform()).toBe(alias);
  });
});
