import { App } from 'antd';
import type React from 'react';
import { SettingsProvider, ThemeProvider, WorkspaceSwitchProvider } from '@/renderer/contexts/ui';
import { MessageInitializer, MessageProvider } from '@/renderer/utils';

/**
 * Root App Provider — V5
 * Only Settings, Theme, WorkspaceSwitch, and Ant Design message/notification config.
 * Data flows through CentralizedWorkspaceService, not React contexts.
 */
export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <MessageProvider>
      <SettingsProvider>
        <ThemeProvider>
          <WorkspaceSwitchProvider>
            <App
              message={{ maxCount: 5 }}
              notification={{
                top: 70,
                duration: 3,
                maxCount: 5,
                placement: 'topRight',
              }}
            >
              <MessageInitializer />
              {children}
            </App>
          </WorkspaceSwitchProvider>
        </ThemeProvider>
      </SettingsProvider>
    </MessageProvider>
  );
};
