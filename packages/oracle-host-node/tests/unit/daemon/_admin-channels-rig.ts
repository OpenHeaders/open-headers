/**
 * Minimal `createAdminChannelHandlers` rig for direct handler-table
 * tests — every dep that is not under test answers an inert shape.
 * The socket-gated peer plane has its own coverage in
 * `ws-server-rbac.test.ts`; this rig exercises handler logic only.
 */

import { createDaemonPairingService } from '@openheaders/core/identity';
import { type AdminChannelHandler, createAdminChannelHandlers } from '../../../src/daemon/admin-channels';

export function buildAdminChannels(): ReadonlyMap<string, AdminChannelHandler> {
  return createAdminChannelHandlers({
    pairing: createDaemonPairingService(),
    getBoundPort: () => 0,
    getWsServer: () => null,
    queryAudit: () => [],
    license: {
      getSnapshot: () => ({ status: 'unlicensed' as const }),
      getInstalledText: async () => null,
      install: async () => ({ ok: false as const, error: 'not under test' }),
      remove: async () => ({ ok: true as const, snapshot: { status: 'unlicensed' as const } }),
      reload: async () => ({ status: 'unlicensed' as const }),
      dispose: () => undefined,
    },
    cliProvision: {
      status: async () => ({
        configPath: '/dev/null',
        state: 'unconfigured' as const,
        binaryInstalled: false,
        hostPlatform: 'linux',
      }),
      provision: async () => ({ ok: false as const, error: 'not under test' }),
    },
    proxyTrust: {
      status: async () => ({ ca: null, stores: [], changes: [], systemKeychainTrustSupported: false }),
      install: async () => ({ ok: false as const, error: 'not under test' }),
      remove: async () => ({ ok: true, results: [] }),
      helperState: async () => ({ present: false, available: false, registration: null }),
      helperRegister: async () => ({ ok: false as const, error: 'not under test' }),
      helperUnregister: async () => ({ ok: false as const, error: 'not under test' }),
      helperOpenLoginItems: async () => ({ ok: false as const, error: 'not under test' }),
    },
    proxyCapture: {
      status: async () => ({
        running: false,
        boundPort: null,
        port: 8138,
        scopePatterns: [],
        caPresent: false,
        lastError: null,
      }),
      start: async () => ({ ok: false as const, error: 'not under test' }),
      stop: async () => ({ ok: true as const }),
      setScope: async () => ({ ok: false as const, error: 'not under test' }),
    },
    workspaceTreeDispatch: async () => ({ ok: false, error: 'not under test' }),
  });
}
