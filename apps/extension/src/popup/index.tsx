import { ThemeProvider } from '@context/ThemeContext';
import { SettingsProvider } from '@/rules/settings';
import { App as AntApp } from 'antd';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/popup.less';

// Initialize React app
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
