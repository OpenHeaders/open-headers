import '@/host/install-host-storage';
import '@/host/install-host-bridge';
import '@/host/install-host-logger';
import '@/host/install-build-info';
import '@/host/install-awareness-host';
import '@/host/install-navigation-host';
import '@/host/install-assets-host';
import '@/host/install-cdp-capability';
import '@/host/install-csp-exempt-capability';
import { registerCapability } from '@openheaders/core/capabilities';
import { eagerInitRendererMirrors, ThemeProvider } from '@openheaders/ui/context';
import Workbench from '@openheaders/ui/workbench/App';
import { SettingsProvider } from '@openheaders/ui/workbench/settings';
import { App as AntApp } from 'antd';
import { createRoot } from 'react-dom/client';
import { pairWithCode } from '@/host/pair-with-code';
import { resolveWorkbenchIdentity } from '@/host/surface-identity-resolvers';
import '@openheaders/ui/shared/dock-layout/dock-layout.css';
import '@openheaders/ui/workbench/styles/rules.less';
import '@openheaders/ui/workbench/styles/rule-flow.less';

// In-app daemon pairing for the Authentication setting (WS-A2). The
// popup / panel / sidepanel get this via `install-capabilities`, but the
// workbench curates its host installs and must skip that module's
// popup-only RPC capabilities (`announceSurfaceReady`,
// `getActiveWorkspaceId`) — so register just the pairing one here.
registerCapability('pairWithCode', pairWithCode);

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
    <ThemeProvider>
      <AntApp>
        <Workbench resolveIdentity={resolveWorkbenchIdentity} />
      </AntApp>
    </ThemeProvider>
  </SettingsProvider>,
);
