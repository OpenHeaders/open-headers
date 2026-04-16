import { ThemeProvider } from '@context/ThemeContext';
import { createRoot } from 'react-dom/client';
import { SettingsProvider } from '@/rules/settings';
import App from './App';
import './styles/panel.css';

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(
  <SettingsProvider>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </SettingsProvider>,
);
