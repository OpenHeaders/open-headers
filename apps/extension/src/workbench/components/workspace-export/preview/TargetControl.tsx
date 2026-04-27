/**
 * Import-target picker — segmented switch with a contextual second
 * field that morphs based on the choice:
 *   - Current → no extra field
 *   - New     → editable name input (defaults to the export's
 *               workspace name, user can override)
 *   - Pick    → workspace dropdown
 */

import type { V5 } from '@openheaders/core/types';
import type { WorkspaceExport } from '@openheaders/core/workspace-export';
import { Input, Segmented, Select, Typography } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';

const { Text } = Typography;

export type ImportTargetSelection =
  | { mode: 'current' }
  | { mode: 'new'; name?: string }
  | { mode: 'picked'; workspaceId: string };

const TargetControl: React.FC<{
  target: ImportTargetSelection;
  onChange: (t: ImportTargetSelection) => void;
  workspaces: V5.ExtensionWorkspace[];
  activeWorkspaceId: string | null;
  envelope: WorkspaceExport;
}> = ({ target, onChange, workspaces, activeWorkspaceId, envelope }) => {
  const exportName = envelope.workspace.name;

  // Local name buffer so the user can type freely without re-render
  // churn. Kept in sync when the radio flips back to `new`.
  const [newName, setNewName] = useState<string>(target.mode === 'new' ? (target.name ?? exportName) : exportName);
  useEffect(() => {
    if (target.mode === 'new' && target.name !== undefined) setNewName(target.name);
  }, [target]);

  const options = [
    { label: 'Current', value: 'current', disabled: !activeWorkspaceId },
    { label: 'New', value: 'new' },
    { label: 'Pick existing', value: 'picked', disabled: workspaces.length === 0 },
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <Text strong style={{ fontSize: 12 }}>
        Import into
      </Text>
      <Segmented
        size="small"
        value={target.mode}
        onChange={(v) => {
          const mode = v as ImportTargetSelection['mode'];
          if (mode === 'current') onChange({ mode: 'current' });
          else if (mode === 'new') onChange({ mode: 'new', name: newName });
          else onChange({ mode: 'picked', workspaceId: workspaces[0]?.id ?? '' });
        }}
        options={options}
      />
      {target.mode === 'new' && (
        <Input
          size="small"
          value={newName}
          placeholder={exportName}
          onChange={(e) => {
            const v = e.target.value;
            setNewName(v);
            onChange({ mode: 'new', name: v });
          }}
          style={{ width: 240 }}
        />
      )}
      {target.mode === 'picked' && (
        <Select
          size="small"
          value={target.workspaceId || undefined}
          onChange={(id) => onChange({ mode: 'picked', workspaceId: id })}
          style={{ width: 240 }}
          options={workspaces.map((w) => ({ label: w.name, value: w.id }))}
          placeholder="Select a workspace"
        />
      )}
    </div>
  );
};

export default TargetControl;
