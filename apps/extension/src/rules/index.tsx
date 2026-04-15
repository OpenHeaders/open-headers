import { ThemeProvider } from '@context/ThemeContext';
import { App as AntApp } from 'antd';
import { createRoot } from 'react-dom/client';
import RulesApp from './App';
import { SettingsProvider } from './settings';
import './styles/rules.less';
import './styles/rule-flow.less';

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(
  <SettingsProvider>
    <ThemeProvider>
      <AntApp>
        <RulesApp />
      </AntApp>
    </ThemeProvider>
  </SettingsProvider>,
);
