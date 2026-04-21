import { ThemeProvider } from '@context/ThemeContext';
import { App as AntApp } from 'antd';
import { createRoot } from 'react-dom/client';
import { SettingsProvider } from '@/workbench/settings';
import App from './App';
import '@/shared/dock-layout/dock-layout.css';
import './styles/panel.css';

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(
  <SettingsProvider>
    <ThemeProvider>
      <AntApp>
        <App />
      </AntApp>
    </ThemeProvider>
  </SettingsProvider>,
);
