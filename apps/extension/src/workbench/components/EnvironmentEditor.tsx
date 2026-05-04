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
import { stableStringify, useEntityReprime } from '@/shared/forms';
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

const EMPTY_VARS: V5.Variable[] = [];

const SURFACE_ID = 'workbench';

// Order-sensitive signature — `stableStringify` preserves array order
// while sorting object keys, so reorder shows up as a real edit (it's a
// user-visible change you'd save). Reorder convergence is tracked
// separately by the conflict adapter via `formSetOrders` for the
// set-reorder kind.
function variablesSignature(vars: readonly V5.Variable[]): string {
  return stableStringify(vars);
}

const EnvironmentEditor: React.FC<EnvironmentEditorProps> = ({ environmentUid, onDirtyChange, registerSaveRef }) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { environments, activeEnvironmentId, defaultEnvironmentId, setDefaultEnvironment } = useEnvironments();
  const { pickActiveEnvironment } = useEnvSwitcher();
  const workspaceId = useActiveWorkspaceId();
  const mutator = useEnvironmentMutator({ workspaceId, surfaceId: SURFACE_ID });

  const env = useMemo(() => environments.find((e) => e.uid === environmentUid) ?? null, [environments, environmentUid]);
  const localInstanceId = useLocalInstanceId();

  // Derived dirty (universal contract — `feedback_derived_dirty.md`).
  //
  // Two fingerprints, two roles:
  //   - `formSig`         — the draft as the user has typed it
  //   - `lastPrimedSig`   — the canonical signature the form was last
  //                         seeded with (initial mount + reprime on
  //                         clean rebroadcast + auto-rebase when form
  //                         converges with canonical)
  //
  // `isDirty = formSig !== lastPrimedSig` — i.e. "user typed edits the
  // form hasn't been re-seeded past." This is the right gate for the
  // Save button + the reprime hook's "is it safe to overwrite".
  //
  // Comparing against `liveSig` directly (form-vs-canonical) is wrong:
  // when a peer commits and the user is clean, `liveSig` jumps but
  // `formSig` doesn't — naive derivation would report dirty even
  // though the user never typed, blocking the reprime hook from
  // catching the form up to the new canonical.
  //
  // Auto-rebase: when `formSig === liveSig` (form catches up to
  // canonical via Use Saved, post-save echo, or peer-mirrors-our-edit),
  // advance `lastPrimedSig` so dirty drops to false on the next render.
  const [draft, setDraft] = useState<V5.Variable[]>(() => env?.variables ?? EMPTY_VARS);
  const [lastPrimedSig, setLastPrimedSig] = useState<string | null>(null);

  const formSig = useMemo(() => variablesSignature(draft), [draft]);
  const liveSig = useMemo(() => (env ? variablesSignature(env.variables) : null), [env]);
  const isDirty = lastPrimedSig !== null && formSig !== lastPrimedSig;

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
  const setConflictBaseline = conflicts.setBaseline;

  // Reprime: "user clean, peer just committed" — pull canonical into
  // the form + advance primed-fingerprint + advance conflict baseline.
  useEntityReprime<V5.Environment>({
    liveEntity: env,
    scope: { entityType: ENVIRONMENT_ENTITY_TYPE, entityId: env?.uid ?? null },
    isDirty,
    enabled: env !== null,
    signature: (e) => variablesSignature(e.variables),
    populate: (e) => {
      setDraft(e.variables);
      setLastPrimedSig(variablesSignature(e.variables));
      setConflictBaseline({ uid: e.uid, variables: e.variables });
    },
  });

  // Auto-rebase: form converged with canonical (Use Saved sweep,
  // post-save echo, etc). Advance primed-fingerprint + baseline so
  // dirty drops to false naturally + future peer divergence shows up
  // against the just-converged state.
  useEffect(() => {
    if (formSig === null || liveSig === null) return;
    if (formSig !== liveSig) return;
    if (lastPrimedSig === liveSig) return;
    setLastPrimedSig(liveSig);
    if (liveEntity) setConflictBaseline(liveEntity);
  }, [formSig, liveSig, lastPrimedSig, liveEntity, setConflictBaseline]);

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
      getSetConflict: (setPath, uid, formContainsUid) => conflicts.getSetConflict(setPath, uid, formContainsUid),
      onAcceptTheirs: (path, theirs) => {
        // Apply the saved value into the local draft, then ack the
        // tracker so the chip dismisses + baseline catches up. Gate the
        // ack on apply success: if the resolver rejected the write
        // (kind transition, missing row), keep the chip so the user
        // can resolve via the dialog.
        const transient: VariableEntity = { uid: env?.uid ?? '', variables: [...draft] };
        if (!variableResolveAdapter.applyResolutionToEntity(transient, path, { base: '', theirs })) return;
        setDraft(transient.variables);
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
      // Dirty derives from form-vs-canonical equality (universal
      // contract). Once the commit broadcast lands and the mirror
      // updates `env.variables` to match the just-saved draft, the
      // next render reports `isDirty=false` automatically. Clear
      // dismissed conflict paths so a future peer edit on a
      // previously-dismissed field surfaces a fresh chip.
      conflicts.clearDismissed();
    } else if (result.reason === 'not-found') {
      message.error('Environment was deleted from another tab');
    } else {
      message.error(`Failed to update environment${result.message ? `: ${result.message}` : ''}`);
    }
  }, [env, isDirty, draft, mutator, message, conflicts]);

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
