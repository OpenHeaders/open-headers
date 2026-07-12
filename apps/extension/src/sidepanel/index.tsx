import './self-close-if-popup-mode';
import '@/host/install-host-storage';
import '@/host/install-host-bridge';
import '@/host/install-host-logger';
import '@/host/install-build-info';
import '@/host/install-awareness-host';
import '@/host/install-navigation-host';
import '@/host/install-assets-host';
import '@/host/install-capabilities';
import '@/host/install-self-close-capability';
import { LocaleProvider, ThemeProvider } from '@openheaders/ui/context';
import App from '@openheaders/ui/popup/App';
import { SurfaceProvider } from '@openheaders/ui/shared/surface';
import { SettingsProvider } from '@openheaders/ui/workbench/settings';
import { App as AntApp } from 'antd';
import { createRoot } from 'react-dom/client';
import { resolveSidePanelIdentity } from '@/host/surface-identity-resolvers';
import '@openheaders/ui/popup/styles/popup.less';
import './styles/sidepanel.less';

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(
  <SurfaceProvider mode="sidepanel">
    <SettingsProvider>
      <LocaleProvider>
        <ThemeProvider>
          <AntApp>
            <App resolveIdentity={resolveSidePanelIdentity} />
          </AntApp>
        </ThemeProvider>
      </LocaleProvider>
    </SettingsProvider>
  </SurfaceProvider>,
);
