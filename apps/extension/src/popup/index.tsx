import { ThemeProvider } from '@context/ThemeContext';
import { App as AntApp } from 'antd';
import { createRoot } from 'react-dom/client';
import { SettingsProvider } from '@/workbench/settings';
import { SurfaceProvider } from '@/shared/surface';
import App from './App';
import './styles/popup.less';

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(
  <SurfaceProvider mode="popup">
    <SettingsProvider>
      <ThemeProvider>
        <AntApp>
          <App />
        </AntApp>
      </ThemeProvider>
    </SettingsProvider>
  </SurfaceProvider>,
);
