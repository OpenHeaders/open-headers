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
import whatsNewNotes from '../../../whats-new.md?raw';

registerCapability('getActiveWorkspaceId', () => hostBridge.call('getActiveWorkspaceId'));

// API requests execute in the Electron main process over Node's fetch
// (undici), not a browser network stack — the request editor's Settings
// tab shows the Node fact sheet and hides browser-only knobs.
registerCapability('requestRuntime', () => 'node');

// Pre/post request scripts run on this host — Safe mode's hidden
// sandboxed renderer by default, or the Developer-mode utilityProcess
// worker where a workspace opted in. This registration is the
// availability gate (+ the secure default); the live per-workspace
// mode rides the host-local `OH.scriptExecutionModes` slot behind the
// Settings tab's Script execution chooser.
registerCapability('scriptRuntime', () => 'safe');

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

// Release notes bundled at build time from `apps/desktop/whats-new.md`
// (raw import — never fetched at runtime). Backs the workbench's
// What's New tab; a build with an empty notes file reports null and
// the tab affordances stay hidden.
registerCapability('getWhatsNew', () => {
  const trimmed = whatsNewNotes.replace(/<!--[\s\S]*?-->/, '').trim();
  return trimmed.length > 0 ? trimmed : null;
});

// No `closeSurface` registration — the workbench window is the long-
// lived primary; nothing in shared UI should close it implicitly.
