/**
 * Desktop renderer's capability registrations. Lists every
 * capability the desktop shell supports and wires it to the
 * appropriate transport (engine RPC, preload bridge, IPC channel).
 *
 * Shared `@openheaders/ui` code reads through
 * `@openheaders/core/capabilities` and never knows which shell answered.
 * Capabilities the desktop doesn't support (e.g. `popupAnnounce` once it
 * lands) simply aren't registered here, and shared code branches off
 * `hasCapability`.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { registerCapability } from '@openheaders/core/capabilities';

registerCapability('getActiveWorkspaceId', () => hostBridge.call('getActiveWorkspaceId'));

// Desktop opens external URLs in the OS default browser via the
// main-process `shell.openExternal` allowlist (http(s) + mailto). The
// preload bridge takes care of marshalling.
registerCapability('openExternalUrl', (url) => window.oh.openExternal(url));

// In-app updater (docs/UPDATES_PLAN.md): report a seen-but-not-installed
// update so the gear menu shows its dot. No `url` — the gear routes to
// the Settings update row, where download/restart run in-app.
registerCapability('getAppUpdate', async () => {
  const state = await hostBridge.call('oh.updates.getState');
  const pending = state.phase === 'available' || state.phase === 'downloading' || state.phase === 'downloaded';
  return pending && state.availableVersion !== null ? { version: state.availableVersion } : null;
});

// No `closeSurface` registration — the workbench window is the long-
// lived primary; nothing in shared UI should close it implicitly.
