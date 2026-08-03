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

import whatsNewNotes from 'virtual:whats-new';
import { hostBridge } from '@openheaders/core/bridge';
import { registerCapability, type TerminalSession, type TerminalSpawnOptions } from '@openheaders/core/capabilities';

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

// Named-browser opens for the extension-install CTAs — a store listing
// must land in the browser that will install the extension. Main falls
// back to the default browser when the named one isn't installed.
registerCapability('openUrlInBrowser', (url, browser) => window.oh.openInBrowser(url, browser));

// Reveal one of the app's own files in the OS file manager (the
// Traffic Monitor's capture-session rows). Main refuses paths outside
// the app data directory.
registerCapability('revealInFolder', (path) => window.oh.revealInFolder(path));

// In-app updater (docs/UPDATES_PLAN.md): report a seen-but-not-installed
// update so the gear menu shows its dot. No `url` — the gear routes to
// the Settings update row, where download/restart run in-app.
registerCapability('getAppUpdate', async () => {
  const state = await hostBridge.call('oh.updates.getState');
  const pending = state.phase === 'available' || state.phase === 'downloading' || state.phase === 'downloaded';
  return pending && state.availableVersion !== null ? { version: state.availableVersion } : null;
});

// Release notes bundled at build time from the running version's
// canonical changelog entry (`changelog/desktop/<year>/<version>.md`,
// frontmatter stripped by the config's whats-new-entry plugin — never
// fetched at runtime). Backs the workbench's What's New tab; a version
// without an entry reports null and the tab affordances stay hidden.
registerCapability('getWhatsNew', () => (whatsNewNotes.length > 0 ? whatsNewNotes : null));

// Online release history for the What's New tab's "Previous releases"
// section — enhancement-only reads of the changelog feed's desktop
// stream, bridged to the main process because this document's CSP
// forbids dialing the feed. Null answers hide the section.
registerCapability('whatsNewHistory', () => ({
  list: async () => {
    try {
      return (await hostBridge.call('oh.whatsNew.history')).rows;
    } catch {
      return null;
    }
  },
  entryBody: async (version) => {
    try {
      return (await hostBridge.call('oh.whatsNew.historyEntry', { version })).body;
    } catch {
      return null;
    }
  },
}));

// Real pty sessions for the workbench Terminal tool window — the
// desktop is a pty host (node-pty in the main process); browser
// surfaces never register this, which drops the Terminal window from
// their dock registry. The preload wire is a single global data/exit
// stream; this adapter narrows it to per-session handles.
async function spawnTerminalSession(options: TerminalSpawnOptions): Promise<TerminalSession> {
  const result = await window.oh.terminal.spawn({
    cols: options.cols,
    rows: options.rows,
    ...(options.profile !== undefined
      ? {
          profile: {
            shell: options.profile.shell,
            args: [...options.profile.args],
            ...(options.profile.cwd !== undefined ? { cwd: options.profile.cwd } : {}),
          },
        }
      : {}),
    ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
  });
  if (!result.ok) throw new Error(result.error);
  const id = result.id;
  let disposed = false;
  return {
    id,
    write: (data) => window.oh.terminal.write({ id, data }),
    resize: (cols, rows) => window.oh.terminal.resize({ id, cols, rows }),
    onData: (listener) =>
      window.oh.terminal.onData((envelope) => {
        if (envelope.id === id) listener(envelope.data);
      }),
    onExit: (listener) =>
      window.oh.terminal.onExit((envelope) => {
        if (envelope.id === id) listener(envelope.exitCode);
      }),
    hasChildren: () => (disposed ? Promise.resolve(false) : window.oh.terminal.hasChildren({ id })),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      window.oh.terminal.kill({ id });
    },
  };
}

registerCapability('terminal', () => ({ spawn: spawnTerminalSession }));

// The workbench Proxy tool window — the desktop runs the daemon spine
// in-process (capture service + lifecycle lifeline over the same IPC
// lifeline transport the awareness pipe uses), so it drives the L7
// capture proxy. Browser surfaces never register this, which drops the
// Proxy window from their dock registry.
registerCapability('proxyCapture', () => true);

// The workbench Live Network tool window — the desktop's in-process
// daemon spine relays browser lifecycle streams from the connected
// extension over the same lifeline transport, so the live view has a
// source to attach. Browser surfaces never register this, which drops
// the window from their dock registry.
registerCapability('liveNetwork', () => true);

// The workbench Git tool window — the desktop's bridge reaches the
// workspace-tree runtime in-process, so the log/history surface has a
// live `oh.workspaceTree.*` verb table to read. Browser surfaces never
// register this, which drops the Git window from their dock registry.
registerCapability('workspaceGit', () => true);

// No `closeSurface` registration — the workbench window is the long-
// lived primary; nothing in shared UI should close it implicitly.
