import type React from 'react';
import { useEffect } from 'react';
import { V5Shell } from './components/v5-shell';

const AppComponent: React.FC = () => {
  // Signal to main process that renderer is ready (once)
  useEffect(() => {
    window.electronAPI?.signalRendererReady?.();
  }, []);

  return <V5Shell />;
};

export default AppComponent;
