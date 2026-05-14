import '@/host/install-host-storage';
import '@/host/install-host-bridge';
import '@/host/install-host-logger';
import '@/host/install-build-info';
import '@/host/install-awareness-host';
import '@/host/install-navigation-host';
import { resolvePopupIdentity } from '@/host/surface-identity-resolvers';
import { ThemeProvider } from '@context/ThemeContext';
import { App as AntApp } from 'antd';
import { createRoot } from 'react-dom/client';
import { eagerInitRendererMirrors } from '@openheaders/ui/context';
import { SurfaceProvider } from '@openheaders/ui/shared/surface';
import { SettingsProvider } from '@/workbench/settings';
import App from './App';
import './styles/popup.less';

// Subscribe every entity mirror to `syncBroadcast` and kick off each
// snapshot RPC before React mounts — see `eager-mirror-init.ts` for
// the full architectural rationale.
eagerInitRendererMirrors();

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(
  <SurfaceProvider mode="popup">
    <SettingsProvider>
      <ThemeProvider>
        <AntApp>
          <App resolveIdentity={resolvePopupIdentity} />
        </AntApp>
      </ThemeProvider>
    </SettingsProvider>
  </SurfaceProvider>,
);
