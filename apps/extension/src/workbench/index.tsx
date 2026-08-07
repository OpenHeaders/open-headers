import '@/host/install-host-storage';
import '@/host/install-host-bridge';
// AFTER install-host-bridge: decorates the installed bridge with the
// page-realm WebSocket session host (executes sessions in this page
// over the platform socket) and registers `wsPageSession`.
import '@/host/install-ws-session-host';
import '@/host/install-host-logger';
import '@/host/install-build-info';
import '@/host/install-awareness-host';
import '@/host/install-navigation-host';
import '@/host/install-assets-host';
import '@/host/install-cdp-capability';
import '@/host/install-csp-exempt-capability';
import '@/host/install-whats-new-capability';
import { registerCapability } from '@openheaders/core/capabilities';
import { eagerInitRendererMirrors, LocaleProvider, ThemeProvider } from '@openheaders/ui/context';
import Workbench from '@openheaders/ui/workbench/App';
import { SettingsProvider } from '@openheaders/ui/workbench/settings';
import { App as AntApp } from 'antd';
import { createRoot } from 'react-dom/client';
import { companionReveal } from '@/host/companion-reveal';
import { desktopLaunch } from '@/host/desktop-launch';
import { nmAutoPair } from '@/host/nm-auto-pair';
import { nmHostPresence } from '@/host/nm-presence';
import { pairWithCode } from '@/host/pair-with-code';
import { resolveWorkbenchIdentity } from '@/host/surface-identity-resolvers';
import { getBrowserAPI } from '@/types/browser';
import '@openheaders/ui/shared/dock-layout/dock-layout.css';
import '@openheaders/ui/workbench/styles/rules.less';

// In-app daemon pairing for the Authentication setting (WS-A2). The
// popup / panel / sidepanel get this via `install-capabilities`, but the
// workbench curates its host installs and must skip that module's
// popup-only RPC capabilities (`announceSurfaceReady`,
// `getActiveWorkspaceId`) — so register just the pairing one here.
registerCapability('pairWithCode', pairWithCode);

// NM auto-pairing (Phase 7): the wizard's pair-without-a-code gesture,
// manifest-gated like the curated installs' other permission-shaped
// capabilities — absent on Firefox/Safari, where the wizard honestly
// offers the code instead.
if (getBrowserAPI().runtime.getManifest().permissions?.includes('nativeMessaging')) {
  registerCapability('nmAutoPair', nmAutoPair);
  registerCapability('nmHostPresence', () => nmHostPresence());
  // Explicit launch gesture for a disconnected companion — the desktop
  // teaser's "Open the desktop app" renders IN the workbench too.
  registerCapability('desktopLaunch', () => desktopLaunch());
}

// Companion reveal: the desktop teasers' "Open in the desktop app"
// renders IN the workbench (dock tool windows + settings categories),
// so the curated entry must carry the relay the standard install
// registers — without it the teaser honestly falls back to download.
registerCapability('companionReveal', companionReveal);

// gRPC invokes forward to a connected companion over the backend wire —
// the seam exists on every extension surface, and the gRPC editor is a
// workbench tab, so the curated entry must carry it too; LIVE connection
// state gates the editor's Invoke separately.
registerCapability('grpcCompanionInvoke', () => true);

// Debug mode (opt-in CDP path) is registered by `install-cdp-capability`
// imported above — gated on the runtime exposing the debugging protocol.

// Subscribe every entity mirror to `syncBroadcast` and kick off each
// snapshot RPC before React mounts — see `eager-mirror-init.ts` for
// the full architectural rationale.
eagerInitRendererMirrors();

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(
  <SettingsProvider>
    <LocaleProvider>
      <ThemeProvider>
        <AntApp>
          <Workbench resolveIdentity={resolveWorkbenchIdentity} />
        </AntApp>
      </ThemeProvider>
    </LocaleProvider>
  </SettingsProvider>,
);
