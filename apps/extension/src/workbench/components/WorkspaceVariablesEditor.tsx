/**
 * WorkspaceVariablesEditor — tab body for editing workspace-wide vars.
 *
 * Workspace vars are the lowest-priority scope in the 4-tier resolution
 * chain; they're shared across every environment as a baseline. Save
 * commits via `useVariableMutator.replaceWorkspaceVariables`, which
 * delegates to the sync engine (`applyWorkspaceVariablesReplacement` →
 * `oh.sync.apply`); dirty state is tracked locally by comparing the
 * draft's fingerprint against the broadcast-driven canonical view.
 *
 * Awareness: contributes through `useEditorShell` (which bundles
 * `useEditorDirty` + branded `<EntityScopeProvider>` wiring) pinned to
 * the singleton id (`WORKSPACE_VARIABLES_ID`). The surface's
 * `<SurfaceAwarenessPublisher>` composes the published claim. Variable
 * rows are uid-keyed (post-session-66): `VARIABLE_PATHS.row` threads
 * through `VariableTable`'s `rowPath` so each row's name + value input
 * publishes per-field focus + renders presence chips that survive
 * reorder + rename.
 */

import { useWorkspaceVariables } from '@hooks/useWorkspaceVariables';
import { useVariableMutator } from '@hooks/useVariableMutator';
import {
  WORKSPACE_VARIABLES_ENTITY_TYPE,
  WORKSPACE_VARIABLES_ID,
} from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { App, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { EntityScopeProvider, PresenceBadge, useLocalInstanceId, VARIABLE_PATHS } from '@/shared/awareness';
import {
  type ConflictResolution,
  EntityConflictBanner,
  EntityConflictDialog,
  prettyPathMap,
  useAutoMergeForm,
} from '@/shared/conflicts';
import { useEditorShell, useReprime } from '@/shared/editor-shell';
import { stableStringify } from '@/shared/forms';
import EditorHeader from './EditorHeader';
import VariableTable, { type VariableTableConflictBridge } from './panels/VariableTable';
import { scopeBadge } from './shared/scope-colors';
import { type VariableEntity, variableResolveAdapter } from './variable-conflict-adapter';
import { projectVariablesToForm, useVariableConflicts } from './use-variable-conflicts';

const { Text } = Typography;

interface WorkspaceVariablesEditorProps {
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
}

const EMPTY_VARS: V5.Variable[] = [];

function variablesSignature(vars: readonly V5.Variable[]): string {
  return stableStringify(vars);
}

const WorkspaceVariablesEditor: React.FC<WorkspaceVariablesEditorProps> = ({ onDirtyChange, registerSaveRef }) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { workspaceVariables } = useWorkspaceVariables();
  const { replaceWorkspaceVariables } = useVariableMutator();

  const [draft, setDraft] = useState<V5.Variable[]>(() => workspaceVariables.variables ?? EMPTY_VARS);
  const formFingerprint = useMemo(() => variablesSignature(draft), [draft]);

  const liveEntity: VariableEntity = useMemo(
    () => ({ uid: WORKSPACE_VARIABLES_ID, variables: workspaceVariables.variables }),
    [workspaceVariables.variables],
  );

  // Conflict-baseline ref pattern (canonical recipe).
  const setBaselineRef = useRef<(e: VariableEntity) => void>(() => undefined);
  const baselineVariablesRef = useRef<readonly V5.Variable[] | null>(null);

  const reprime = useReprime<V5.WorkspaceVariables>({
    liveEntity: workspaceVariables,
    scope: { entityType: WORKSPACE_VARIABLES_ENTITY_TYPE, entityId: WORKSPACE_VARIABLES_ID },
    enabled: true,
    formFingerprint,
    signature: (e) => variablesSignature(e.variables),
    populate: (e) => setDraft(e.variables),
    onPrimed: (e) => {
      setBaselineRef.current({ uid: WORKSPACE_VARIABLES_ID, variables: e.variables });
      baselineVariablesRef.current = e.variables;
    },
  });
  const isDirty = reprime.isDirty;

  const conflicts = useVariableConflicts({
    liveEntity,
    isDirty,
    enabled: true,
    entityType: WORKSPACE_VARIABLES_ENTITY_TYPE,
  });
  setBaselineRef.current = conflicts.setBaseline;

  const formProjection = useMemo(() => projectVariablesToForm(draft), [draft]);
  const formSetOrders = useMemo(
    () => new Map<string, readonly string[]>([['variables', draft.map((v) => v.uid)]]),
    [draft],
  );

  // Per-leaf auto-rebase — see EnvironmentEditor for the full discipline.
  const applyAutoMerge = useCallback(
    (path: string, theirs: string) => {
      const transient: VariableEntity = { uid: WORKSPACE_VARIABLES_ID, variables: [...draft] };
      if (!variableResolveAdapter.applyResolutionToEntity(transient, path, { base: '', theirs })) return;
      setDraft(transient.variables);
    },
    [draft],
  );
  useAutoMergeForm({ conflicts, formProjection, applyToForm: applyAutoMerge });
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
        const transient: VariableEntity = { uid: WORKSPACE_VARIABLES_ID, variables: [...draft] };
        if (!variableResolveAdapter.applyResolutionToEntity(transient, path, { base: '', theirs })) return;
        setDraft(transient.variables);
        conflicts.acceptTheirs(path, theirs);
      },
      onDismiss: (path) => conflicts.dismiss(path),
    }),
    [conflicts, draft, setDraft],
  );

  const projectWithResolutions = useCallback(
    (resolutions: ReadonlyMap<string, ConflictResolution>): VariableEntity => {
      const transient: VariableEntity = { uid: WORKSPACE_VARIABLES_ID, variables: [...draft] };
      for (const [path, choice] of resolutions) {
        if (choice !== 'theirs') continue;
        const conflict = allConflicts.get(path);
        if (!conflict) continue;
        variableResolveAdapter.applyResolutionToEntity(transient, path, conflict);
      }
      return transient;
    },
    [allConflicts, draft],
  );

  const handleKeepAllMine = useCallback(() => {
    for (const path of allConflicts.keys()) conflicts.dismiss(path);
  }, [allConflicts, conflicts]);

  const handleUseAllSaved = useCallback(() => {
    const all = new Map<string, ConflictResolution>();
    for (const path of allConflicts.keys()) all.set(path, 'theirs');
    const projected = projectWithResolutions(all);
    setDraft(projected.variables);
    for (const [path, conflict] of allConflicts) conflicts.acceptTheirs(path, conflict.theirs);
  }, [allConflicts, conflicts, projectWithResolutions, setDraft]);

  // Phase 6 commit seam — JSON.parse the merge-editor's result text
  // back into the variables array, replace the draft, dismiss every
  // conflict path. Throws on malformed JSON or non-array shape.
  const handleResolveText = useCallback(
    (text: string) => {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error('Workspace variables must be a JSON array.');
      setDraft(parsed as V5.Variable[]);
      for (const path of allConflicts.keys()) conflicts.dismiss(path);
    },
    [allConflicts, conflicts, setDraft],
  );

  const savedText = useMemo(() => {
    if (!isConflictDialogOpen) return '';
    return JSON.stringify(workspaceVariables.variables, null, 2);
  }, [isConflictDialogOpen, workspaceVariables.variables]);

  const baseText = useMemo(() => {
    if (!isConflictDialogOpen) return undefined;
    const baseline = baselineVariablesRef.current;
    if (!baseline) return undefined;
    return JSON.stringify(baseline, null, 2);
  }, [isConflictDialogOpen]);

  const mineText = useMemo(() => {
    if (!isConflictDialogOpen) return '';
    return JSON.stringify(draft, null, 2);
  }, [isConflictDialogOpen, draft]);

  const handleSave = useCallback(async () => {
    if (!isDirty) return;
    const result = await replaceWorkspaceVariables(draft);
    if (result.ok) {
      // Dirty derives from form-vs-canonical equality; the post-save
      // broadcast brings them into alignment automatically.
      conflicts.clearDismissed();
    } else {
      const detail = 'message' in result && result.message ? `: ${result.message}` : '';
      message.error(`Failed to save workspace variables${detail}`);
    }
  }, [isDirty, draft, replaceWorkspaceVariables, message, conflicts]);

  const handleSaveSync = useCallback(() => {
    void handleSave();
  }, [handleSave]);

  const shell = useEditorShell({
    entityType: WORKSPACE_VARIABLES_ENTITY_TYPE,
    entityId: WORKSPACE_VARIABLES_ID,
    isDirty,
    onSave: handleSaveSync,
    onDirtyChange,
    registerSaveRef,
  });

  const nonEmptyCount = draft.filter((v) => v.name.trim()).length;
  const localInstanceId = useLocalInstanceId();

  const headerTitle = (
    <>
      {scopeBadge('workspace', 14)}
      <Typography.Text strong style={{ fontSize: 13 }}>
        Workspace Variables
      </Typography.Text>
      <PresenceBadge
        entityType={WORKSPACE_VARIABLES_ENTITY_TYPE}
        entityId={WORKSPACE_VARIABLES_ID}
        excludeInstanceId={localInstanceId}
        style={{ marginLeft: 6 }}
      />
    </>
  );

  return (
    <EntityScopeProvider shell={shell.scopeProps}>
      <div style={{ display: 'flex', flexDirection: 'column', background: token.colorBgContainer, height: '100%' }}>
        <EditorHeader title={headerTitle} shell={shell.headerProps} />
        <EntityConflictBanner
          count={allConflicts.size}
          onReview={() => setConflictDialogOpen(true)}
          onKeepAllMine={handleKeepAllMine}
          onUseAllSaved={handleUseAllSaved}
        />
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          <div style={{ maxWidth: 920, margin: '0 auto' }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              Shared across every environment in this workspace. Lowest priority — overridden by collection,
              environment, and vault scopes.
            </Text>

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

export default WorkspaceVariablesEditor;
