import '@/host/install-host-storage';
import '@/host/install-host-bridge';
import '@/host/install-host-logger';
import '@/host/install-build-info';
import '@/host/install-awareness-host';
import { resolveSidePanelIdentity } from '@/host/surface-identity-resolvers';
import { ThemeProvider } from '@context/ThemeContext';
import { App as AntApp } from 'antd';
import { createRoot } from 'react-dom/client';
import { SurfaceProvider } from '@openheaders/ui/shared/surface';
import { SettingsProvider } from '@/workbench/settings';
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
