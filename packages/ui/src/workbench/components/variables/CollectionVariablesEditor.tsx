/**
 * CollectionVariablesEditor — tab body for editing a single collection's
 * scoped variables.
 *
 * Polymorphic over `kind`: 'rule' (rule-collection / `useRules`),
 * 'request' (`useRequests`), 'template' (template-collection /
 * `useRules.templateCollections`). Three layers vary per kind:
 *  - which hook list to read the collection from
 *  - which `useVariableMutator` write method to invoke
 *  - the scope-badge label / kind-specific copy
 *
 * Everything else — dirty-tracking, fingerprint, save flow, draft
 * shape, table — is identical across kinds.
 *
 * Collection variables sit between workspace and environment scope in
 * priority; they apply only to entities (rules, requests, templates)
 * inside the collection's subtree. Secrets are NOT supported here —
 * collection vars are synced via Git in team workspaces (v2), and
 * secrets must stay local-per-device. The Vault is the only safe home
 * for sensitive values.
 */

import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import { useVariableMutator } from '@openheaders/ui/shared/hooks/mutators/useVariableMutator';
import {
  canonicalJsonPretty,
  COLLECTION_ENTITY_TYPE,
  REQUEST_COLLECTION_ENTITY_TYPE,
  TEMPLATE_COLLECTION_ENTITY_TYPE,
} from '@openheaders/core/sync';
import type { Collection, Variable } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { App, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { EntityScopeProvider, PresenceBadge, useLocalInstanceId, VARIABLE_PATHS } from '@openheaders/ui/shared/awareness';
import {
  type ConflictResolution,
  EntityConflictBanner,
  EntityConflictDialog,
  useAutoMergeForm,
} from '@openheaders/ui/shared/conflicts';
import { useEditorShell, useReprime } from '@openheaders/ui/shared/editor-shell';
import { stableStringify } from '@openheaders/ui/shared/forms';
import EditorHeader from '../shell/EditorHeader';
import VariableTable, { type VariableTableConflictBridge } from '../panels/VariableTable';
import { scopeBadge } from '../shared/scope-colors';
import { type VariableEntity, variableResolveAdapter } from './variable-conflict-adapter';
import { projectVariablesToForm, useVariableConflicts } from './use-variable-conflicts';

const { Text } = Typography;

export type CollectionVariablesKind = 'rule' | 'request' | 'template';

function entityTypeFor(kind: CollectionVariablesKind): string {
  switch (kind) {
    case 'request':
      return REQUEST_COLLECTION_ENTITY_TYPE;
    case 'template':
      return TEMPLATE_COLLECTION_ENTITY_TYPE;
    default:
      return COLLECTION_ENTITY_TYPE;
  }
}

interface CollectionVariablesEditorProps {
  /** Which collection family this editor targets. Defaults to 'rule' for back-compat with existing call sites. */
  kind?: CollectionVariablesKind;
  collectionUid: string;
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
}

const EMPTY_VARS: Variable[] = [];

// Order-SENSITIVE signature — collection vars now persist their row order
// as fractional-index keys (see `buildVariablesReplacement`), so the
// materialized order matches the editor's. Order-sensitivity is therefore
// correct AND load-bearing: a drag-reorder shifts the fingerprint, flips
// `isDirty`, and Save persists the new order.
function variablesSignature(vars: readonly Variable[]): string {
  return stableStringify(vars);
}

const CollectionVariablesEditor: React.FC<CollectionVariablesEditorProps> = ({
  kind = 'rule',
  collectionUid,
  onDirtyChange,
  registerSaveRef,
}) => {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const t = useT();
  const { localCollections, templateCollections } = useRules();
  const { collections: requestCollections } = useRequests();
  const {
    replaceCollectionVariables,
    replaceRequestCollectionVariables,
    replaceTemplateCollectionVariables,
  } = useVariableMutator();

  const collection = useMemo(() => {
    const list =
      kind === 'rule' ? localCollections : kind === 'request' ? requestCollections : templateCollections;
    return list.find((c) => c.uid === collectionUid) ?? null;
  }, [kind, localCollections, requestCollections, templateCollections, collectionUid]);

  const replaceVariables = useMemo(() => {
    switch (kind) {
      case 'request':
        return replaceRequestCollectionVariables;
      case 'template':
        return replaceTemplateCollectionVariables;
      default:
        return replaceCollectionVariables;
    }
  }, [kind, replaceCollectionVariables, replaceRequestCollectionVariables, replaceTemplateCollectionVariables]);

  const [draft, setDraft] = useState<Variable[]>(() => collection?.variables ?? EMPTY_VARS);
  const formFingerprint = useMemo(() => variablesSignature(draft), [draft]);

  const entityType = entityTypeFor(kind);

  const liveEntity: VariableEntity | null = useMemo(
    () => (collection ? { uid: collection.uid, variables: collection.variables } : null),
    [collection],
  );

  // Conflict-baseline ref pattern (canonical recipe).
  const setBaselineRef = useRef<(e: VariableEntity) => void>(() => undefined);
  const baselineVariablesRef = useRef<readonly Variable[] | null>(null);

  const reprime = useReprime<Collection>({
    liveEntity: collection,
    scope: { entityType, entityId: collectionUid },
    enabled: collection !== null,
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
    enabled: !!collection,
    entityType,
  });
  setBaselineRef.current = conflicts.setBaseline;

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

  // Per-leaf auto-rebase — see EnvironmentEditor for the full discipline.
  const applyAutoMerge = useCallback(
    (path: string, theirs: string) => {
      const transient: VariableEntity = { uid: collectionUid, variables: [...draft] };
      if (!variableResolveAdapter.applyResolutionToEntity(transient, path, { base: '', theirs })) return;
      setDraft(transient.variables);
    },
    [collectionUid, draft],
  );
  useAutoMergeForm({ conflicts, formProjection, applyToForm: applyAutoMerge });

  const conflictBridge = useMemo<VariableTableConflictBridge>(
    () => ({
      getLeafConflict: (path, local) => conflicts.getConflict(path, local),
      getSetConflict: (setPath, uid, formContainsUid) => conflicts.getSetConflict(setPath, uid, formContainsUid),
      onAcceptTheirs: (path, theirs) => {
        const transient: VariableEntity = { uid: collectionUid, variables: [...draft] };
        if (!variableResolveAdapter.applyResolutionToEntity(transient, path, { base: '', theirs })) return;
        setDraft(transient.variables);
        conflicts.acceptTheirs(path, theirs);
      },
      onDismiss: (path) => conflicts.dismiss(path),
    }),
    [conflicts, draft, collectionUid, setDraft],
  );

  const projectWithResolutions = useCallback(
    (resolutions: ReadonlyMap<string, ConflictResolution>): VariableEntity => {
      const transient: VariableEntity = { uid: collectionUid, variables: [...draft] };
      for (const [path, choice] of resolutions) {
        if (choice !== 'theirs') continue;
        const conflict = allConflicts.get(path);
        if (!conflict) continue;
        variableResolveAdapter.applyResolutionToEntity(transient, path, conflict);
      }
      return transient;
    },
    [allConflicts, draft, collectionUid],
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
      if (!Array.isArray(parsed)) throw new Error('Collection variables must be a JSON array.');
      setDraft(parsed as Variable[]);
      for (const path of allConflicts.keys()) conflicts.dismiss(path);
    },
    [allConflicts, conflicts, setDraft],
  );

  // All three panes serialize via canonicalJsonPretty: the saved side
  // round-tripped chrome.storage (alphabetized row keys) while the mine
  // side carries literal construction order — an insertion-ordered dump
  // would light spurious diff lines on structurally-equal rows.
  const savedText = useMemo(() => {
    if (!isConflictDialogOpen || !collection) return '';
    return canonicalJsonPretty(collection.variables);
  }, [isConflictDialogOpen, collection]);

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

  const handleSave = useCallback(() => {
    if (!collection || !isDirty) return;
    void replaceVariables(collection.uid, draft).then((result) => {
      if (result.ok) {
        // Dirty derives from form-vs-canonical equality; the post-save
        // broadcast brings them into alignment automatically.
        conflicts.clearDismissed();
        return;
      }
      if (result.reason === 'not-found') {
        message.error(t('workbench.variables.collection.deletedElsewhere'));
        return;
      }
      const detail = 'message' in result ? result.message : undefined;
      message.error(
        detail
          ? t('workbench.variables.collection.saveFailedDetail', { message: detail })
          : t('workbench.variables.collection.saveFailed'),
      );
    });
  }, [collection, isDirty, draft, replaceVariables, message, conflicts, t]);

  const shell = useEditorShell({
    entityType,
    entityId: collectionUid,
    isDirty,
    onSave: handleSave,
    onDirtyChange,
    registerSaveRef,
  });

  if (!collection) {
    return (
      <div style={{ padding: 24, background: token.colorBgContainer }}>
        <Text type="secondary">{t('workbench.variables.collection.notFound')}</Text>
      </div>
    );
  }

  const nonEmptyCount = draft.filter((v) => v.name.trim()).length;
  const localInstanceId = useLocalInstanceId();

  const description =
    kind === 'request'
      ? t('workbench.variables.collection.descriptionRequest')
      : kind === 'template'
        ? t('workbench.variables.collection.descriptionTemplate')
        : t('workbench.variables.collection.descriptionRule');

  const headerTitle = (
    <>
      {scopeBadge('collection', 14)}
      <Typography.Text strong style={{ fontSize: 13 }}>
        {t('workbench.variables.collection.title', { name: collection.name })}
      </Typography.Text>
      <PresenceBadge
        entityType={entityType}
        entityId={collectionUid}
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
        <div style={{ flex: 1, overflow: 'auto', overscrollBehavior: 'none', padding: 24 }}>
          <div style={{ maxWidth: 920, margin: '0 auto' }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              {description}
            </Text>

            <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 11, fontWeight: 600 }}>
              {t('workbench.variables.variablesCount', { count: nonEmptyCount })}
            </Text>

            <VariableTable
              variables={draft}
              onChange={setDraft}
              allowSecrets={false}
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

export default CollectionVariablesEditor;
