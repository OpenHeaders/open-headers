/**
 * SettingsTab — tab-mode wrapper around SettingsShell.
 *
 * Used when the user promotes the settings modal to a full editor tab
 * via the modal header "Open in Editor" button, or when the command
 * palette/deep-link router opens settings directly as a tab.
 *
 * Just a thin frame that forwards deep-link props — zero extra chrome
 * because the tab already lives inside the standard editor tab frame.
 */

import type React from 'react';
import SettingsShell from './SettingsShell';

interface SettingsTabProps {
  initialSettingKey?: string;
  initialCategoryId?: string;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ initialSettingKey, initialCategoryId }) => {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <SettingsShell initialSettingKey={initialSettingKey} initialCategoryId={initialCategoryId} />
    </div>
  );
};

export default SettingsTab;
