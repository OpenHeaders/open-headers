import '@/host/install-host-storage';
import '@/host/install-host-bridge';
import '@/host/install-host-logger';
import { ThemeProvider } from '@context/ThemeContext';
import { App as AntApp } from 'antd';
import { createRoot } from 'react-dom/client';
import { eagerInitRendererMirrors } from '@/context/eager-mirror-init';
import { SurfaceProvider } from '@openheaders/ui/shared/surface';
import { SettingsProvider } from '@/workbench/settings';
import App from './App';
import '@openheaders/ui/shared/dock-layout/dock-layout.css';
import './styles/panel.css';

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
          <App />
        </AntApp>
      </ThemeProvider>
    </SettingsProvider>
  </SurfaceProvider>,
);
