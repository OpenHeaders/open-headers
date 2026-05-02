/**
 * WorkspaceVariablesEditor — tab body for editing workspace-wide vars.
 *
 * Workspace vars are the lowest-priority scope in the 4-tier resolution
 * chain; they're shared across every environment as a baseline. Save
 * commits via `useVariableMutator.replaceWorkspaceVariables`, which
 * delegates to the sync engine (`applyWorkspaceVariablesReplacement` →
 * `oh.sync.apply`); dirty state is tracked locally by comparing the
 * draft's fingerprint against the broadcast-driven canonical view.
 */

import { useActiveWorkspaceId } from '@hooks/useActiveWorkspaceId';
import { useAwareness } from '@hooks/useAwareness';
import { useEnvironments } from '@hooks/useEnvironments';
import { useVariableMutator } from '@hooks/useVariableMutator';
import {
  WORKSPACE_VARIABLES_ENTITY_TYPE,
  WORKSPACE_VARIABLES_ID,
} from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { App, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect } from 'react';
import { useSurfaceIdentity } from '@/shared/awareness';
import { useDirtyDraft } from '../hooks/useDirtyDraft';
import EditorHeader from './EditorHeader';
import VariableTable from './panels/VariableTable';
import { scopeBadge } from './shared/scope-colors';

const { Text, Title } = Typography;
const SURFACE_ID = 'workbench';

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
  const { workspaceVariables } = useEnvironments();
  const { replaceWorkspaceVariables } = useVariableMutator();
  const workspaceId = useActiveWorkspaceId();
  const identity = useSurfaceIdentity();

  const { draft, setDraft, isDirty, markPersisted } = useDirtyDraft<V5.Variable[]>({
    serverDraft: workspaceVariables.variables,
    fingerprint,
    empty: EMPTY_VARS,
  });

  // Awareness — declare the surface is editing the singleton entity.
  useAwareness({
    workspaceId,
    identity,
    entityFocus: { type: WORKSPACE_VARIABLES_ENTITY_TYPE, id: WORKSPACE_VARIABLES_ID },
    fieldFocus: null,
    dirtyFields: isDirty ? ['*'] : [],
  });

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleSave = useCallback(async () => {
    if (!isDirty) return;
    const result = await replaceWorkspaceVariables(draft);
    if (result.ok) {
      markPersisted(draft);
      onDirtyChange?.(false);
    } else {
      const detail = 'message' in result && result.message ? `: ${result.message}` : '';
      message.error(`Failed to save workspace variables${detail}`);
    }
  }, [isDirty, draft, replaceWorkspaceVariables, onDirtyChange, message, markPersisted]);

  const handleSaveSync = useCallback(() => {
    void handleSave();
  }, [handleSave]);

  useEffect(() => {
    registerSaveRef?.(handleSaveSync);
  }, [registerSaveRef, handleSaveSync]);

  const nonEmptyCount = draft.filter((v) => v.name.trim()).length;

  const headerTitle = (
    <>
      {scopeBadge('workspace', 20)}
      <Title level={5} style={{ margin: 0 }}>
        Workspace Variables
      </Title>
    </>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: token.colorBgContainer, height: '100%' }}>
      <EditorHeader title={headerTitle} isDirty={isDirty} onSave={handleSaveSync} />
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
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
    </div>
  );
};

export default WorkspaceVariablesEditor;
