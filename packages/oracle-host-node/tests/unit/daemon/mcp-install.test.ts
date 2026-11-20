/**
 * The MCP install's switch read — what the activity monitor's MCP row
 * answers from (the activity monitor plan §6, law 4): the same mirrored
 * setting the handler consults for the next request, so the row can
 * never say "on" for an endpoint that would 404.
 */

import { hostStorage, OH, setHostStorage } from '@openheaders/core/storage';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installMcpServer, type McpServerInstall } from '../../../src/daemon/mcp-install';
import { createHostStorageFake } from '../_host-storage-fake';

let install: McpServerInstall | null = null;

beforeEach(() => {
  setHostStorage(createHostStorageFake());
});

afterEach(() => {
  install?.dispose();
  install = null;
});

describe('installMcpServer — the switch as the handler reads it', () => {
  it('is off until the setting is on, and follows each flip without a reinstall', async () => {
    install = await installMcpServer({ serverVersion: '2026.11.0' });
    expect(install.isEnabled()).toBe(false);

    await hostStorage.set(OH.settingsUser, { 'mcp.enabled': true });
    expect(install.isEnabled()).toBe(true);

    await hostStorage.set(OH.settingsUser, { 'mcp.enabled': false });
    expect(install.isEnabled()).toBe(false);
  });

  it('reads a switch that was already on at install', async () => {
    await hostStorage.set(OH.settingsUser, { 'mcp.enabled': true });
    install = await installMcpServer({ serverVersion: '2026.11.0' });
    expect(install.isEnabled()).toBe(true);
  });
});
