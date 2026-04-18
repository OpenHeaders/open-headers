/**
 * WorkspaceVariablesEditor — tab body for editing workspace-wide vars.
 *
 * Workspace vars are the lowest-priority scope in the 4-tier resolution
 * chain; they're shared across every environment as a baseline. Save
 * commits via `setWorkspaceVariables`; dirty is tracked by comparing
 * the draft's fingerprint against the last persisted snapshot.
 */

import { AppstoreOutlined } from '@ant-design/icons';
import { useEnvironments } from '@hooks/useEnvironments';
import type { V5 } from '@openheaders/core/types';
import { Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import VariableTable from './panels/VariableTable';

const { Text, Title } = Typography;

interface WorkspaceVariablesEditorProps {
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
}

function fingerprint(vars: V5.Variable[]): string {
  return JSON.stringify(vars.map((v) => [v.name, v.value, v.type]));
}

const WorkspaceVariablesEditor: React.FC<WorkspaceVariablesEditorProps> = ({ onDirtyChange, registerSaveRef }) => {
  const { token } = theme.useToken();
  const { workspaceVariables, setWorkspaceVariables } = useEnvironments();

  const [draft, setDraft] = useState<V5.Variable[]>(() => workspaceVariables.variables);
  const persistedFpRef = useRef<string>(fingerprint(workspaceVariables.variables));

  useEffect(() => {
    const fp = fingerprint(workspaceVariables.variables);
    if (fp !== persistedFpRef.current) {
      persistedFpRef.current = fp;
      setDraft(workspaceVariables.variables);
    }
  }, [workspaceVariables]);

  const isDirty = useMemo(() => fingerprint(draft) !== persistedFpRef.current, [draft]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleSave = useCallback(() => {
    if (!isDirty) return;
    void setWorkspaceVariables({ schemaVersion: 1, variables: draft }).then((ok) => {
      if (ok) {
        persistedFpRef.current = fingerprint(draft);
        onDirtyChange?.(false);
      }
    });
  }, [isDirty, draft, setWorkspaceVariables, onDirtyChange]);

  useEffect(() => {
    registerSaveRef?.(handleSave);
  }, [registerSaveRef, handleSave]);

  const nonEmptyCount = draft.filter((v) => v.name.trim()).length;

  return (
    <div style={{ padding: 24, background: token.colorBgContainer, overflow: 'auto', height: '100%' }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <AppstoreOutlined style={{ fontSize: 18, color: token.colorTextTertiary }} />
          <Title level={4} style={{ margin: 0 }}>
            Workspace Variables
          </Title>
        </div>

        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Shared across every environment in this workspace. Lowest priority — overridden by collection, environment,
          and vault scopes.
        </Text>

        <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 11, fontWeight: 600 }}>
          VARIABLES ({nonEmptyCount})
        </Text>

        <VariableTable variables={draft} onChange={setDraft} allowSecrets />
      </div>
    </div>
  );
};

export default WorkspaceVariablesEditor;
