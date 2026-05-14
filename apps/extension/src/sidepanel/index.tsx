import '@/host/install-host-storage';
import '@/host/install-host-bridge';
import '@/host/install-host-logger';
import '@/host/install-build-info';
import '@/host/install-awareness-host';
import '@/host/install-navigation-host';
import '@/host/install-assets-host';
import { ThemeProvider } from '@context/ThemeContext';
import { SurfaceProvider } from '@openheaders/ui/shared/surface';
import { SettingsProvider } from '@openheaders/ui/workbench/settings';
import { App as AntApp } from 'antd';
import { createRoot } from 'react-dom/client';
import { resolveSidePanelIdentity } from '@/host/surface-identity-resolvers';
import App from '../popup/App';
import './styles/sidepanel.less';

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(
  <SurfaceProvider mode="sidepanel">
    <SettingsProvider>
      <ThemeProvider>
        <AntApp>
          <App resolveIdentity={resolveSidePanelIdentity} />
        </AntApp>
      </ThemeProvider>
    </SettingsProvider>
  </SurfaceProvider>,
);
