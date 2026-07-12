import './host/install-host-logger';
import './host/install-protocol-host';
import './host/install-rpc-fallback';
import './host/install-host-storage';
import './host/install-host-bridge';
import './host/install-capabilities';
import './host/install-build-info';
import './host/install-navigation-host';
import './host/install-assets-host';
import './host/install-awareness-host';
import { eagerInitRendererMirrors, LocaleProvider, ThemeProvider } from '@openheaders/ui/context';
import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import Workbench from '@openheaders/ui/workbench/App';
import { SettingsProvider } from '@openheaders/ui/workbench/settings';
import { App as AntApp } from 'antd';
import { createRoot } from 'react-dom/client';
import { resolveWorkbenchIdentity } from './host/surface-identity-resolvers';
import '@openheaders/ui/shared/dock-layout/dock-layout.css';
import '@openheaders/ui/workbench/styles/rules.less';

// Declare desktop as the running host BEFORE any UI renders so user-facing
// strings ("window" vs "tab") read from the desktop vocabulary on first paint.
setCurrentHost('desktop');

// Tag the document body with the OS family so the native-titlebar CSS
// reservations in `index.html` apply correctly. Uses authoritative
// `process.platform` exposed via the preload (`window.oh.platform`);
// `navigator.platform` is unreliable on modern Chromium.
{
  const platform = window.oh?.platform ?? 'linux';
  const platformClass = platform === 'darwin' ? 'host-darwin' : platform === 'win32' ? 'host-win32' : 'host-linux';
  document.body.classList.add(platformClass);
}

// Subscribe every entity mirror to `syncBroadcast` and kick off each
// snapshot RPC before React mounts — see `eager-mirror-init.ts` for the
// full rationale. Against the first-cut stub bridge the snapshots resolve
// empty and the per-workspace mirrors short-circuit on the empty active id.
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
