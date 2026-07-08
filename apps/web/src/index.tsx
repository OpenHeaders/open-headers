import '@/host/install-host-logger';
import '@/host/install-host-storage';
import '@/host/install-host-bridge';
import '@/host/install-rpc-fallback';
import '@/host/install-build-info';
import '@/host/install-awareness-host';
import '@/host/install-navigation-host';
import '@/host/install-assets-host';
import { eagerInitRendererMirrors, ThemeProvider } from '@openheaders/ui/context';
import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import Workbench from '@openheaders/ui/workbench/App';
import { SettingsProvider } from '@openheaders/ui/workbench/settings';
import { App as AntApp } from 'antd';
import { createRoot } from 'react-dom/client';
import { resolveWorkbenchIdentity } from '@/host/surface-identity-resolvers';
import '@openheaders/ui/shared/dock-layout/dock-layout.css';
import '@openheaders/ui/workbench/styles/rules.less';
import '@openheaders/ui/workbench/styles/rule-flow.less';

// Declare the web host BEFORE any UI renders so user-facing strings
// read from the right vocabulary on first paint.
setCurrentHost('web');

// Subscribe every entity mirror to `syncBroadcast` and kick off each
// snapshot RPC before React mounts — see `eager-mirror-init.ts` for the
// full rationale. Against the Phase-4a stub bridge the host skips the
// per-workspace seed (no `getActiveWorkspaceId` capability registered)
// and only the workspace-independent mirrors come up.
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
