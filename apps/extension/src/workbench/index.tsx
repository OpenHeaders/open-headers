import '@/host/install-host-storage';
import '@/host/install-host-bridge';
import { ThemeProvider } from '@context/ThemeContext';
import { App as AntApp } from 'antd';
import { createRoot } from 'react-dom/client';
import { eagerInitRendererMirrors } from '@/context/eager-mirror-init';
import Workbench from './App';
import { SettingsProvider } from './settings';
import '@/shared/dock-layout/dock-layout.css';
import './styles/rules.less';
import './styles/rule-flow.less';

// Subscribe every entity mirror to `syncBroadcast` and kick off each
// snapshot RPC before React mounts — see `eager-mirror-init.ts` for
// the full architectural rationale.
eagerInitRendererMirrors();

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(
  <SettingsProvider>
    <ThemeProvider>
      <AntApp>
        <Workbench />
      </AntApp>
    </ThemeProvider>
  </SettingsProvider>,
);
