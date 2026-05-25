import '@/host/install-host-storage';
import '@/host/install-host-bridge';
import '@/host/install-host-logger';
import '@/host/install-build-info';
import '@/host/install-awareness-host';
import '@/host/install-navigation-host';
import '@/host/install-source-map-fetcher';
import '@/host/install-cookie-jar-fetcher';
import '@/host/install-assets-host';
import '@/host/install-parity-bridge';
import { eagerInitRendererMirrors, ThemeProvider } from '@openheaders/ui/context';
import App from '@openheaders/ui/panel/App';
import { SurfaceProvider } from '@openheaders/ui/shared/surface';
import { SettingsProvider } from '@openheaders/ui/workbench/settings';
import { App as AntApp } from 'antd';
import { createRoot } from 'react-dom/client';
import { resolveDevPanelIdentity } from '@/host/surface-identity-resolvers';
import '@openheaders/ui/shared/dock-layout/dock-layout.css';
import '@openheaders/ui/panel/styles/panel.css';

// Subscribe every entity mirror to `syncBroadcast` and kick off each
// snapshot RPC before React mounts — see `eager-mirror-init.ts` for
// the full architectural rationale.
eagerInitRendererMirrors();

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(
  <SurfaceProvider mode="devpanel">
    <SettingsProvider>
      <ThemeProvider>
        <AntApp>
          <App resolveIdentity={resolveDevPanelIdentity} />
        </AntApp>
      </ThemeProvider>
    </SettingsProvider>
  </SurfaceProvider>,
);
