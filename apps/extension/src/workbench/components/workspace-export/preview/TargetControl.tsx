/**
 * Import-target picker — `current` / `new` / `pick existing`.
 */

import type { V5 } from '@openheaders/core/types';
import type { WorkspaceExport } from '@openheaders/core/workspace-export';
import { Radio, Select, Typography } from 'antd';
import type React from 'react';

const { Text } = Typography;

export type ImportTargetSelection = { mode: 'current' } | { mode: 'new' } | { mode: 'picked'; workspaceId: string };

const TargetControl: React.FC<{
  target: ImportTargetSelection;
  onChange: (t: ImportTargetSelection) => void;
  workspaces: V5.ExtensionWorkspace[];
  activeWorkspaceId: string | null;
  envelope: WorkspaceExport;
}> = ({ target, onChange, workspaces, activeWorkspaceId, envelope }) => {
  const newWsName = envelope.workspace.name;
  return (
    <div>
      <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>IMPORT INTO</Text>
      <Radio.Group
        value={target.mode}
        onChange={(e) => {
          const mode = e.target.value as ImportTargetSelection['mode'];
          if (mode === 'current') onChange({ mode: 'current' });
          else if (mode === 'new') onChange({ mode: 'new' });
          else onChange({ mode: 'picked', workspaceId: workspaces[0]?.id ?? '' });
        }}
      >
        <Radio value="current" disabled={!activeWorkspaceId}>
          Current workspace
        </Radio>
        <Radio value="new">New workspace ("{newWsName}")</Radio>
        <Radio value="picked" disabled={workspaces.length === 0}>
          Pick existing
        </Radio>
      </Radio.Group>
      {target.mode === 'picked' && (
        <Select
          size="small"
          value={target.workspaceId || undefined}
          onChange={(id) => onChange({ mode: 'picked', workspaceId: id })}
          style={{ marginTop: 6, width: 280 }}
          options={workspaces.map((w) => ({ label: w.name, value: w.id }))}
          placeholder="Select a workspace"
        />
      )}
    </div>
  );
};

export default TargetControl;
