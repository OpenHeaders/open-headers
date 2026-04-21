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
import { App, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useDirtyDraft } from '../hooks/useDirtyDraft';
import VariableTable from './panels/VariableTable';
import StaleDraftBanner from './StaleDraftBanner';

const { Text, Title } = Typography;

interface WorkspaceVariablesEditorProps {
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
}

// Module-level — `useDirtyDraft` requires a stable fingerprint reference.
function fingerprint(vars: V5.Variable[]): string {
  return JSON.stringify(vars.map((v) => [v.name, v.value, v.type]));
}
const EMPTY_VARS: V5.Variable[] = [];

const WorkspaceVariablesEditor: React.FC<WorkspaceVariablesEditorProps> = ({ onDirtyChange, registerSaveRef }) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { workspaceVariables, setWorkspaceVariables } = useEnvironments();

  const { draft, setDraft, isDirty, markPersisted, resetToServer } = useDirtyDraft<V5.Variable[]>({
    serverDraft: workspaceVariables.variables,
    fingerprint,
    empty: EMPTY_VARS,
  });

  // Phase 10 — same tracking shape as the other singleton editors.
  const [loadedVersion, setLoadedVersion] = useState<number | null>(null);
  const [staleDraft, setStaleDraft] = useState<{ serverVersion: number; loadedVersion: number } | null>(null);

  useEffect(() => {
    if (loadedVersion !== null) return;
    setLoadedVersion(workspaceVariables.version);
  }, [workspaceVariables.version, loadedVersion]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleSave = useCallback(async () => {
    if (!isDirty) return;
    const result = await setWorkspaceVariables(
      { schemaVersion: 5, version: loadedVersion ?? 1, variables: draft },
      loadedVersion ?? undefined,
    );
    if (result.ok) {
      markPersisted(draft);
      setLoadedVersion(result.version);
      setStaleDraft(null);
      onDirtyChange?.(false);
    } else if (result.reason === 'stale-draft') {
      setStaleDraft({ serverVersion: result.serverVersion, loadedVersion: loadedVersion ?? 0 });
    } else {
      message.error(`Failed to save workspace variables${'message' in result ? `: ${result.message}` : ''}`);
    }
  }, [isDirty, draft, setWorkspaceVariables, onDirtyChange, loadedVersion, message, markPersisted]);

  const handleStaleDraftReload = useCallback(() => {
    resetToServer();
    setLoadedVersion(workspaceVariables.version);
    setStaleDraft(null);
    onDirtyChange?.(false);
  }, [workspaceVariables.version, onDirtyChange, resetToServer]);

  const handleStaleDraftKeepEditing = useCallback(() => {
    setLoadedVersion(workspaceVariables.version);
    setStaleDraft(null);
  }, [workspaceVariables.version]);

  const handleSaveSync = useCallback(() => {
    void handleSave();
  }, [handleSave]);

  useEffect(() => {
    registerSaveRef?.(handleSaveSync);
  }, [registerSaveRef, handleSaveSync]);

  const nonEmptyCount = draft.filter((v) => v.name.trim()).length;

  return (
    <div style={{ padding: 24, background: token.colorBgContainer, overflow: 'auto', height: '100%' }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        {staleDraft && (
          <StaleDraftBanner
            entityLabel="workspace variables"
            serverVersion={staleDraft.serverVersion}
            loadedVersion={staleDraft.loadedVersion}
            onReload={handleStaleDraftReload}
            onKeepEditing={handleStaleDraftKeepEditing}
          />
        )}
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
