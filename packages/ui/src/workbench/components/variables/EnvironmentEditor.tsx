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
 * Awareness: contributes through `useEditorShell` (which bundles
 * `useEditorDirty` + branded `<EntityScopeProvider>` wiring);
 * the surface's `<SurfaceAwarenessPublisher>` composes the published claim.
 * Variable rows are uid-keyed (post-session-66): `VARIABLE_PATHS.row(uid, leaf)`
 * threads through `VariableTable`'s `rowPath` so each row's name + value
 * input publishes per-field focus + renders presence chips that survive
 * reorder + rename.
 */

import { CheckCircleTwoTone, StarFilled, StarOutlined } from '@ant-design/icons';
import { useEnvironments } from '@openheaders/ui/shared/hooks/readers/useEnvironments';
import { useEnvironmentMutator } from '@openheaders/ui/shared/hooks/mutators/useEnvironmentMutator';
import { canonicalJsonPretty, ENVIRONMENT_ENTITY_TYPE } from '@openheaders/core/sync';
import type { Environment, Variable } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { App, Button, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EntityScopeProvider, PresenceBadge, useLocalInstanceId, VARIABLE_PATHS } from '@openheaders/ui/shared/awareness';
import {
  type ConflictResolution,
  EntityConflictBanner,
  EntityConflictDialog,
  useAutoMergeForm,
} from '@openheaders/ui/shared/conflicts';
import { useEditorShell, useReprime } from '@openheaders/ui/shared/editor-shell';
import { stableStringify } from '@openheaders/ui/shared/forms';
import { useWorkbenchEditingScopeWorkspaceId } from '../../hooks/EditingScopeWorkspaceContext';
import { useEnvSwitcher } from '../../services/env-switcher';
import EditorHeader from '../shell/EditorHeader';
import VariableTable, { type VariableTableConflictBridge } from '../panels/VariableTable';
import { scopeBadge } from '../shared/scope-colors';
import { type VariableEntity, variableResolveAdapter } from './variable-conflict-adapter';
import { projectVariablesToForm, useVariableConflicts } from './use-variable-conflicts';

const { Text } = Typography;

interface EnvironmentEditorProps {
  environmentUid: string;
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
}

const EMPTY_VARS: Variable[] = [];

const SURFACE_ID = 'workbench';

// Order-SENSITIVE signature — env variables now persist their row order as
// fractional-index keys (see `applyEnvVariablesReplacement`), so the
// materialized order matches the editor's. Order-sensitivity is therefore
// correct AND load-bearing: a drag-reorder shifts the fingerprint, flips
// `isDirty`, and Save persists the new order.
function variablesSignature(vars: readonly Variable[]): string {
  return stableStringify(vars);
}

const EnvironmentEditor: React.FC<EnvironmentEditorProps> = ({ environmentUid, onDirtyChange, registerSaveRef }) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const t = useT();
  const { environments, activeEnvironmentId, defaultEnvironmentId, setDefaultEnvironment } = useEnvironments();
  const { pickActiveEnvironment } = useEnvSwitcher();
  const workspaceId = useWorkbenchEditingScopeWorkspaceId();
  const mutator = useEnvironmentMutator({ workspaceId, surfaceId: SURFACE_ID });

  const env = useMemo(() => environments.find((e) => e.uid === environmentUid) ?? null, [environments, environmentUid]);
  const localInstanceId = useLocalInstanceId();

  const [draft, setDraft] = useState<Variable[]>(() => env?.variables ?? EMPTY_VARS);
  const formFingerprint = useMemo(() => variablesSignature(draft), [draft]);

  // ── Conflict tracking ──────────────────────────────────────────
  const liveEntity: VariableEntity | null = useMemo(
    () => (env ? { uid: env.uid, variables: env.variables } : null),
    [env],
  );

  // Conflict tracker is a hook order earlier than reprime by necessity:
  // reprime's `onPrimed` callback advances the conflict baseline, and
  // we want a live reference. We pass an `isDirty` placeholder of
  // `false` here — the tracker only reads it inside its own effects on
  // a later render, by which time `reprime.isDirty` has propagated up
  // through the loop below via `useEffect`.
  const setBaselineRef = useRef<(e: VariableEntity) => void>(() => undefined);
  // Snapshot of variables at the most recent re-prime — feeds the
  // merge-editor preview's Show Base layouts via `baseText`.
  const baselineVariablesRef = useRef<readonly Variable[] | null>(null);

  // Reprime: hook-owned comparison + populate sequencing. Editor never
  // reads both fingerprints simultaneously — the hook IS the comparison.
  const reprime = useReprime<Environment>({
    liveEntity: env,
    scope: { entityType: ENVIRONMENT_ENTITY_TYPE, entityId: env?.uid ?? null },
    enabled: env !== null,
    formFingerprint,
    signature: (e) => variablesSignature(e.variables),
    populate: (e) => setDraft(e.variables),
    onPrimed: (e) => {
      setBaselineRef.current({ uid: e.uid, variables: e.variables });
      baselineVariablesRef.current = e.variables;
    },
  });
  const isDirty = reprime.isDirty;

  const conflicts = useVariableConflicts({
    liveEntity,
    isDirty,
    enabled: !!env,
    entityType: ENVIRONMENT_ENTITY_TYPE,
  });
  setBaselineRef.current = conflicts.setBaseline;

  const formProjection = useMemo(() => projectVariablesToForm(draft), [draft]);

  // Per-leaf auto-rebase: when a peer commits to a variable leaf the user
  // hasn't touched, silently catch the draft up. Whole-form `useReprime`
  // gates on every leaf clean and stops at the first dirty leaf; this
  // complements it for the partial-dirty case (§6.2 killer demo). Real
  // conflicts (same leaf in both tabs) are filtered out by
  // `getAutoMergeable` and continue surfacing as chips.
  const applyAutoMerge = useCallback(
    (path: string, theirs: string) => {
      if (!env) return;
      const transient: VariableEntity = { uid: env.uid, variables: [...draft] };
      if (!variableResolveAdapter.applyResolutionToEntity(transient, path, { base: '', theirs })) return;
      setDraft(transient.variables);
    },
    [env, draft],
  );
  useAutoMergeForm({ conflicts, formProjection, applyToForm: applyAutoMerge });
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

  // Phase 6 commit seam — JSON.parse the merge-editor's result text
  // back into the variables array, replace the draft, dismiss every
  // conflict path. Throws on malformed JSON or non-array shape.
  const handleResolveText = useCallback(
    (text: string) => {
      if (!env) return;
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error('Environment variables must be a JSON array.');
      setDraft(parsed as Variable[]);
      for (const path of allConflicts.keys()) conflicts.dismiss(path);
    },
    [env, allConflicts, conflicts, setDraft],
  );

  // All three panes serialize via canonicalJsonPretty: the saved side
  // round-tripped chrome.storage (alphabetized row keys) while the mine
  // side carries literal construction order — an insertion-ordered dump
  // would light spurious diff lines on structurally-equal rows.
  const savedText = useMemo(() => {
    if (!isConflictDialogOpen || !env) return '';
    return canonicalJsonPretty(env.variables);
  }, [isConflictDialogOpen, env]);

  const baseText = useMemo(() => {
    if (!isConflictDialogOpen) return undefined;
    const baseline = baselineVariablesRef.current;
    if (!baseline) return undefined;
    return canonicalJsonPretty(baseline);
  }, [isConflictDialogOpen]);

  const mineText = useMemo(() => {
    if (!isConflictDialogOpen) return '';
    return canonicalJsonPretty(draft);
  }, [isConflictDialogOpen, draft]);

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
      message.error(t('workbench.variables.environment.deletedElsewhere'));
    } else {
      message.error(
        result.message
          ? t('workbench.variables.environment.updateFailedDetail', { message: result.message })
          : t('workbench.variables.environment.updateFailed'),
      );
    }
  }, [env, isDirty, draft, mutator, message, conflicts, t]);

  const handleSaveSync = useCallback(() => {
    void handleSave();
  }, [handleSave]);

  const shell = useEditorShell({
    entityType: ENVIRONMENT_ENTITY_TYPE,
    entityId: env?.uid ?? null,
    isDirty,
    onSave: handleSaveSync,
    onDirtyChange,
    registerSaveRef,
  });

  if (!env) {
    return (
      <div style={{ padding: 24, background: token.colorBgContainer }}>
        <Text type="secondary">{t('workbench.variables.environment.notFound')}</Text>
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
      {isActive && <Tag color="blue">{t('workbench.variables.environment.activeTag')}</Tag>}
      {isDefault && (
        <Tooltip title={t('workbench.variables.environment.defaultTooltip')}>
          <Tag color="gold" icon={<StarFilled />}>
            {t('workbench.variables.environment.defaultTag')}
          </Tag>
        </Tooltip>
      )}
    </>
  );

  const headerActions = (
    <>
      {!isActive && (
        <Button size="small" icon={<CheckCircleTwoTone />} onClick={() => pickActiveEnvironment(env.uid)}>
          {t('workbench.variables.environment.setActive')}
        </Button>
      )}
      <Tooltip
        title={
          isDefault
            ? t('workbench.variables.environment.unsetDefaultTooltip')
            : t('workbench.variables.environment.setDefaultTooltip')
        }
      >
        <Button
          size="small"
          icon={isDefault ? <StarFilled style={{ color: token.colorWarning }} /> : <StarOutlined />}
          onClick={() => void setDefaultEnvironment(isDefault ? null : env.uid)}
        >
          {isDefault
            ? t('workbench.variables.environment.unsetDefault')
            : t('workbench.variables.environment.setDefault')}
        </Button>
      </Tooltip>
    </>
  );

  return (
    <EntityScopeProvider shell={shell.scopeProps}>
      <div style={{ display: 'flex', flexDirection: 'column', background: token.colorBgContainer, height: '100%' }}>
        <EditorHeader title={headerTitle} actions={headerActions} shell={shell.headerProps} />
        <EntityConflictBanner
          count={allConflicts.size}
          onReview={() => setConflictDialogOpen(true)}
          onKeepAllMine={handleKeepAllMine}
          onUseAllSaved={handleUseAllSaved}
        />
        <div style={{ flex: 1, overflow: 'auto', overscrollBehavior: 'none', padding: 24 }}>
          <div style={{ maxWidth: 920, margin: '0 auto' }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 11, fontWeight: 600 }}>
              {t('workbench.variables.variablesCount', { count: nonEmptyCount })}
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
          mineText={mineText}
          baseText={baseText}
          language="json"
          onResolveText={handleResolveText}
          onClose={() => setConflictDialogOpen(false)}
        />
      </div>
    </EntityScopeProvider>
  );
};

export default EnvironmentEditor;
