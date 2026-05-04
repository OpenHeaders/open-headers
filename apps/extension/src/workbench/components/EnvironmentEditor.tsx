/**
 * EnvironmentEditor — tab body for editing one environment's variables.
 *
 * Routes saves through `useEnvironmentMutator.replaceVariables`, which
 * folds the editor's pre-image + post-image into the catalog
 * primitives (`setEnvVar` for adds/changes, `removeEnvVar` for
 * deletions) and emits one all-or-nothing batch through `oh.sync.apply`.
 * Concurrent edits reconcile per-(env, name) via HLC LWW + the
 * awareness ribbon.
 *
 * Awareness: contributes through `useEditorDirty` + `<EntityScopeProvider>`;
 * the surface's `<SurfaceAwarenessPublisher>` composes the published claim.
 * Variable rows are name-keyed and dynamic — field-level paths defer
 * until set-modeled paths land for the env entity; the entity-level
 * presence chip suffices.
 */

import { CheckCircleTwoTone, StarFilled, StarOutlined } from '@ant-design/icons';
import { useActiveWorkspaceId } from '@hooks/useActiveWorkspaceId';
import { useEnvironments } from '@hooks/useEnvironments';
import { useEnvironmentMutator } from '@hooks/useEnvironmentMutator';
import { ENVIRONMENT_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { App, Button, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { EntityScopeProvider } from '@/shared/awareness';
import { useEditorDirty } from '@/shared/awareness/use-editor-dirty';
import { useDirtyDraft } from '../hooks/useDirtyDraft';
import { useEnvSwitcher } from '../services/env-switcher';
import EditorHeader from './EditorHeader';
import VariableTable from './panels/VariableTable';
import { scopeBadge } from './shared/scope-colors';

const { Text, Title } = Typography;

interface EnvironmentEditorProps {
  environmentUid: string;
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
}

// Module-level — `useDirtyDraft` requires a stable fingerprint reference.
function fingerprint(vars: V5.Variable[]): string {
  return JSON.stringify(vars.map((v) => [v.name, v.value, v.type]));
}
// Shared empty-fallback — ensures identity stability so the hook's
// initial-state factory never sees a fresh `[]` per render.
const EMPTY_VARS: V5.Variable[] = [];

const SURFACE_ID = 'workbench';

const EnvironmentEditor: React.FC<EnvironmentEditorProps> = ({ environmentUid, onDirtyChange, registerSaveRef }) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { environments, activeEnvironmentId, defaultEnvironmentId, setDefaultEnvironment } = useEnvironments();
  const { pickActiveEnvironment } = useEnvSwitcher();
  const workspaceId = useActiveWorkspaceId();
  const mutator = useEnvironmentMutator({ workspaceId, surfaceId: SURFACE_ID });

  const env = useMemo(() => environments.find((e) => e.uid === environmentUid) ?? null, [environments, environmentUid]);

  const { draft, setDraft, isDirty, markPersisted } = useDirtyDraft<V5.Variable[]>({
    serverDraft: env?.variables ?? null,
    fingerprint,
    empty: EMPTY_VARS,
  });

  useEditorDirty(
    { entityType: ENVIRONMENT_ENTITY_TYPE, entityId: env?.uid ?? null },
    isDirty,
  );

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleSave = useCallback(async () => {
    if (!env || !isDirty) return;
    const result = await mutator.replaceVariables(env.uid, draft, env.variables);
    if (result.ok) {
      markPersisted(draft);
      onDirtyChange?.(false);
    } else if (result.reason === 'not-found') {
      message.error('Environment was deleted from another tab');
    } else {
      message.error(`Failed to update environment${result.message ? `: ${result.message}` : ''}`);
    }
  }, [env, isDirty, draft, mutator, onDirtyChange, message, markPersisted]);

  // registerSaveRef takes a sync callback; wrap our async handler so
  // the breadcrumb Save button kicks off the save without awaiting.
  const handleSaveSync = useCallback(() => {
    void handleSave();
  }, [handleSave]);

  useEffect(() => {
    registerSaveRef?.(handleSaveSync);
  }, [registerSaveRef, handleSaveSync]);

  if (!env) {
    return (
      <div style={{ padding: 24, background: token.colorBgContainer }}>
        <Text type="secondary">Environment not found.</Text>
      </div>
    );
  }

  const isActive = activeEnvironmentId === env.uid;
  const isDefault = defaultEnvironmentId === env.uid;
  const nonEmptyCount = draft.filter((v) => v.name.trim()).length;

  const headerTitle = (
    <>
      {scopeBadge('environment', 20)}
      <Title level={5} style={{ margin: 0 }}>
        {env.name}
      </Title>
      {isActive && <Tag color="blue">Active</Tag>}
      {isDefault && (
        <Tooltip title="Resolver falls back here when the active env is missing a variable.">
          <Tag color="gold" icon={<StarFilled />}>
            Default
          </Tag>
        </Tooltip>
      )}
    </>
  );

  const headerActions = (
    <>
      {!isActive && (
        <Button size="small" icon={<CheckCircleTwoTone />} onClick={() => pickActiveEnvironment(env.uid)}>
          Set active
        </Button>
      )}
      <Tooltip
        title={
          isDefault
            ? 'Unset as default — resolver will stop falling back to this env.'
            : 'Set as default — resolver falls back here when the active env is missing a variable.'
        }
      >
        <Button
          size="small"
          icon={isDefault ? <StarFilled style={{ color: token.colorWarning }} /> : <StarOutlined />}
          onClick={() => void setDefaultEnvironment(isDefault ? null : env.uid)}
        >
          {isDefault ? 'Unset default' : 'Set as default'}
        </Button>
      </Tooltip>
    </>
  );

  return (
    <EntityScopeProvider entityType={ENVIRONMENT_ENTITY_TYPE} entityId={env.uid}>
      <div style={{ display: 'flex', flexDirection: 'column', background: token.colorBgContainer, height: '100%' }}>
        <EditorHeader title={headerTitle} actions={headerActions} isDirty={isDirty} onSave={handleSaveSync} />
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          <div style={{ maxWidth: 920, margin: '0 auto' }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 11, fontWeight: 600 }}>
              VARIABLES ({nonEmptyCount})
            </Text>

            <VariableTable variables={draft} onChange={setDraft} allowSecrets />
          </div>
        </div>
      </div>
    </EntityScopeProvider>
  );
};

export default EnvironmentEditor;
