import '@/host/install-host-logger';
import '@/host/install-host-storage';
import '@/host/install-host-bridge';
import '@/host/install-rpc-fallback';
import '@/host/install-build-info';
import '@/host/install-awareness-host';
import '@/host/install-navigation-host';
import '@/host/install-assets-host';
import '@/host/install-capabilities';
import { eagerInitRendererMirrors, ThemeProvider } from '@openheaders/ui/context';
import { setCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import Workbench from '@openheaders/ui/workbench/App';
import { SettingsProvider } from '@openheaders/ui/workbench/settings';
import { App as AntApp } from 'antd';
import { createRoot } from 'react-dom/client';
import { bootWebHost } from '@/host/boot-web-host';
import { resolveWorkbenchIdentity } from '@/host/surface-identity-resolvers';
import '@openheaders/ui/shared/dock-layout/dock-layout.css';
import '@openheaders/ui/workbench/styles/rules.less';
import '@openheaders/ui/workbench/styles/rule-flow.less';

// Declare the web host BEFORE any UI renders so user-facing strings
// read from the right vocabulary on first paint.
setCurrentHost('web');

// Boot the tab oracle to completion BEFORE the mirrors seed and React
// mounts: every snapshot RPC and capability probe below must land on a
// live engine with the active workspace hydrated, or first paint would
// race the boot and render empty mirrors that never re-seed.
await bootWebHost();

// Subscribe every entity mirror to `syncBroadcast` and kick off each
// snapshot RPC before React mounts — see `eager-mirror-init.ts` for the
// full rationale.
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
