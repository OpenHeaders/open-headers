import { ThemeProvider } from '@context/ThemeContext';
import { App as AntApp } from 'antd';
import { createRoot } from 'react-dom/client';
import RulesApp from './App';
import './styles/rules.less';

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(
  <ThemeProvider>
    <AntApp>
      <RulesApp />
    </AntApp>
  </ThemeProvider>,
);
