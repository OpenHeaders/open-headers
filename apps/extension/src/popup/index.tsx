import '@/host/install-host-storage';
import '@/host/install-host-bridge';
import '@/host/install-error-report-sink';
import '@/host/install-host-logger';
import '@/host/install-build-info';
import '@/host/install-awareness-host';
import '@/host/install-navigation-host';
import '@/host/install-assets-host';
import '@/host/install-capabilities';
import '@/host/install-self-close-capability';
import '@/host/install-popup-resize-squelch';
import ErrorBoundary from '@openheaders/ui/components/ErrorBoundary';
import { eagerInitRendererMirrors, LocaleProvider, ThemeProvider } from '@openheaders/ui/context';
import App from '@openheaders/ui/popup/App';
import { installErrorFunnel } from '@openheaders/ui/shared/error-funnel';
import { SurfaceProvider } from '@openheaders/ui/shared/surface';
import { SettingsProvider } from '@openheaders/ui/workbench/settings';
import { App as AntApp } from 'antd';
import { createRoot } from 'react-dom/client';
import { resolvePopupIdentity } from '@/host/surface-identity-resolvers';
import '@openheaders/ui/popup/styles/popup.less';

// Subscribe every entity mirror to `syncBroadcast` and kick off each
// snapshot RPC before React mounts — see `eager-mirror-init.ts` for
// the full architectural rationale.
eagerInitRendererMirrors();

const container = document.getElementById('root');
// The error funnel + the root boundary above the providers (the popup
// app keeps its own inner boundary for the list; this one catches a
// provider that throws).
const root = createRoot(container!, installErrorFunnel({ surface: 'popup' }));

root.render(
  <ErrorBoundary>
    <SurfaceProvider mode="popup">
      <SettingsProvider>
        <LocaleProvider>
          <ThemeProvider>
            <AntApp>
              <App resolveIdentity={resolvePopupIdentity} />
            </AntApp>
          </ThemeProvider>
        </LocaleProvider>
      </SettingsProvider>
    </SurfaceProvider>
  </ErrorBoundary>,
);
