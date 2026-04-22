import { ThemeProvider } from '@context/ThemeContext';
import { App as AntApp } from 'antd';
import { createRoot } from 'react-dom/client';
import { SurfaceProvider } from '@/shared/surface';
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
          <App />
        </AntApp>
      </ThemeProvider>
    </SettingsProvider>
  </SurfaceProvider>,
);
