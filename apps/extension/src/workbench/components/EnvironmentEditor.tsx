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
 * Variable rows are uid-keyed (post-session-66): `VARIABLE_PATHS.row(uid, leaf)`
 * threads through `VariableTable`'s `rowPath` so each row's name + value
 * input publishes per-field focus + renders presence chips that survive
 * reorder + rename.
 */

import { CheckCircleTwoTone, StarFilled, StarOutlined } from '@ant-design/icons';
import { useActiveWorkspaceId } from '@hooks/useActiveWorkspaceId';
import { useEnvironments } from '@hooks/useEnvironments';
import { useEnvironmentMutator } from '@hooks/useEnvironmentMutator';
import { ENVIRONMENT_ENTITY_TYPE } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { App, Button, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EntityScopeProvider, PresenceBadge, useLocalInstanceId, VARIABLE_PATHS } from '@/shared/awareness';
import { useEditorDirty } from '@/shared/awareness/use-editor-dirty';
import {
  type ConflictResolution,
  EntityConflictBanner,
  EntityConflictDialog,
  prettyPathMap,
} from '@/shared/conflicts';
import { useDirtyDraft } from '../hooks/useDirtyDraft';
import { useEnvSwitcher } from '../services/env-switcher';
import EditorHeader from './EditorHeader';
import VariableTable, { type VariableTableConflictBridge } from './panels/VariableTable';
import { scopeBadge } from './shared/scope-colors';
import { type VariableEntity, variableResolveAdapter } from './variable-conflict-adapter';
import { projectVariablesToForm, useVariableConflicts } from './use-variable-conflicts';

const { Text } = Typography;

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
  const localInstanceId = useLocalInstanceId();

  const { draft, setDraft, isDirty, markPersisted } = useDirtyDraft<V5.Variable[]>({
    serverDraft: env?.variables ?? null,
    fingerprint,
    empty: EMPTY_VARS,
  });

  useEditorDirty(
    { entityType: ENVIRONMENT_ENTITY_TYPE, entityId: env?.uid ?? null },
    isDirty,
  );

  // ── Conflict tracking ──────────────────────────────────────────
  const liveEntity: VariableEntity | null = useMemo(
    () => (env ? { uid: env.uid, variables: env.variables } : null),
    [env],
  );
  const conflicts = useVariableConflicts({
    liveEntity,
    isDirty,
    enabled: !!env,
    entityType: ENVIRONMENT_ENTITY_TYPE,
  });
  const setBaseline = conflicts.setBaseline;

  // Snap conflict baseline whenever the editor is clean against the
  // canonical entity — initial seed + post-save echo + clean-state
  // rebroadcasts. `useDirtyDraft`'s resync already keeps `draft` aligned
  // with `env.variables` while clean; this effect keeps the conflict
  // baseline aligned with the same fingerprint.
  useEffect(() => {
    if (!liveEntity || isDirty) return;
    setBaseline(liveEntity);
  }, [liveEntity, isDirty, setBaseline]);

  const formProjection = useMemo(() => projectVariablesToForm(draft), [draft]);
  const formSetOrders = useMemo(
    () => new Map<string, readonly string[]>([['variables', draft.map((v) => v.uid)]]),
    [draft],
  );
  const allConflicts = useMemo(
    () => conflicts.getAllConflicts(formProjection, formSetOrders),
    [conflicts, formProjection, formSetOrders],
  );
  const [isConflictDialogOpen, setConflictDialogOpen] = useState(false);

  const conflictBridge = useMemo<VariableTableConflictBridge>(
    () => ({
      getLeafConflict: (path, local) => conflicts.getConflict(path, local),
      onAcceptTheirs: (path, theirs) => {
        // Apply the saved value into the local draft, then ack the
        // tracker so the chip dismisses + baseline catches up.
        const transient: VariableEntity = { uid: env?.uid ?? '', variables: [...draft] };
        if (variableResolveAdapter.applyResolutionToEntity(transient, path, { base: '', theirs })) {
          setDraft(transient.variables);
        }
        conflicts.acceptTheirs(path, theirs);
      },
      onDismiss: (path) => conflicts.dismiss(path),
    }),
    [conflicts, draft, env?.uid, setDraft],
  );

  const projectWithResolutions = useCallback(
    (resolutions: ReadonlyMap<string, ConflictResolution>): VariableEntity | null => {
      if (!env) return null;
      const transient: VariableEntity = { uid: env.uid, variables: [...draft] };
      for (const [path, choice] of resolutions) {
        if (choice !== 'theirs') continue;
        const conflict = allConflicts.get(path);
        if (!conflict) continue;
        variableResolveAdapter.applyResolutionToEntity(transient, path, conflict);
      }
      return transient;
    },
    [allConflicts, draft, env],
  );

  const handleKeepAllMine = useCallback(() => {
    for (const path of allConflicts.keys()) conflicts.dismiss(path);
  }, [allConflicts, conflicts]);

  const handleUseAllSaved = useCallback(() => {
    if (!env) return;
    const all = new Map<string, ConflictResolution>();
    for (const path of allConflicts.keys()) all.set(path, 'theirs');
    const projected = projectWithResolutions(all);
    if (!projected) return;
    setDraft(projected.variables);
    for (const [path, conflict] of allConflicts) conflicts.acceptTheirs(path, conflict.theirs);
  }, [allConflicts, conflicts, env, projectWithResolutions, setDraft]);

  const applyResolutions = useCallback(
    (resolutions: Map<string, ConflictResolution>) => {
      if (!env) return;
      const projected = projectWithResolutions(resolutions);
      if (projected) setDraft(projected.variables);
      for (const [path, choice] of resolutions) {
        const conflict = allConflicts.get(path);
        if (!conflict) continue;
        if (choice === 'theirs') conflicts.acceptTheirs(path, conflict.theirs);
        else conflicts.dismiss(path);
      }
    },
    [allConflicts, conflicts, env, projectWithResolutions, setDraft],
  );

  const conflictPathLabels = useMemo(
    () =>
      liveEntity
        ? prettyPathMap(variableResolveAdapter, liveEntity, allConflicts.keys())
        : new Map<string, string>(),
    [liveEntity, allConflicts],
  );

  const savedText = useMemo(() => {
    if (!isConflictDialogOpen || !env) return '';
    return JSON.stringify(env.variables, null, 2);
  }, [isConflictDialogOpen, env]);

  const buildLocalText = useCallback(
    (resolutions: ReadonlyMap<string, ConflictResolution>): string => {
      const projected = projectWithResolutions(resolutions);
      if (!projected) return '';
      return JSON.stringify(projected.variables, null, 2);
    },
    [projectWithResolutions],
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
      {scopeBadge('environment', 14)}
      <Typography.Text strong style={{ fontSize: 13 }}>
        {env.name}
      </Typography.Text>
      <PresenceBadge
        entityType={ENVIRONMENT_ENTITY_TYPE}
        entityId={env.uid}
        excludeInstanceId={localInstanceId}
        style={{ marginLeft: 6 }}
      />
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
        <EntityConflictBanner
          count={allConflicts.size}
          onReview={() => setConflictDialogOpen(true)}
          onKeepAllMine={handleKeepAllMine}
          onUseAllSaved={handleUseAllSaved}
        />
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          <div style={{ maxWidth: 920, margin: '0 auto' }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 11, fontWeight: 600 }}>
              VARIABLES ({nonEmptyCount})
            </Text>

            <VariableTable
              variables={draft}
              onChange={setDraft}
              allowSecrets
              rowPath={VARIABLE_PATHS.row}
              conflictBridge={conflictBridge}
            />
          </div>
        </div>
        <EntityConflictDialog
          open={isConflictDialogOpen}
          savedText={savedText}
          buildLocalText={buildLocalText}
          conflicts={allConflicts}
          localValuesByPath={new Map(Object.entries(formProjection))}
          pathLabels={conflictPathLabels}
          onResolve={applyResolutions}
          onClose={() => setConflictDialogOpen(false)}
        />
      </div>
    </EntityScopeProvider>
  );
};

export default EnvironmentEditor;
