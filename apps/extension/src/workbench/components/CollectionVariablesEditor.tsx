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

import { useRequests } from '@hooks/useRequests';
import { useRules } from '@hooks/useRules';
import { useVariableMutator } from '@hooks/useVariableMutator';
import {
  COLLECTION_ENTITY_TYPE,
  REQUEST_COLLECTION_ENTITY_TYPE,
  TEMPLATE_COLLECTION_ENTITY_TYPE,
} from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { App, Typography, theme } from 'antd';
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
import EditorHeader from './EditorHeader';
import VariableTable, { type VariableTableConflictBridge } from './panels/VariableTable';
import { scopeBadge } from './shared/scope-colors';
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

const EMPTY_VARS: V5.Variable[] = [];

function variablesSignature(vars: readonly V5.Variable[]): string {
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

  const [draft, setDraft] = useState<V5.Variable[]>(() => collection?.variables ?? EMPTY_VARS);

  const entityType = entityTypeFor(kind);

  // Derived dirty (universal contract).
  const formSig = useMemo(() => variablesSignature(draft), [draft]);
  const liveSig = useMemo(
    () => (collection ? variablesSignature(collection.variables) : null),
    [collection],
  );
  const isDirty = liveSig !== null && formSig !== liveSig;

  useEditorDirty({ entityType, entityId: collectionUid }, isDirty);

  // ── Conflict tracking ──────────────────────────────────────────
  const liveEntity: VariableEntity | null = useMemo(
    () => (collection ? { uid: collection.uid, variables: collection.variables } : null),
    [collection],
  );
  const conflicts = useVariableConflicts({
    liveEntity,
    isDirty,
    enabled: !!collection,
    entityType,
  });
  const setConflictBaseline = conflicts.setBaseline;

  useEntityReprime<V5.Collection>({
    liveEntity: collection,
    scope: { entityType, entityId: collectionUid },
    isDirty,
    enabled: collection !== null,
    signature: (e) => variablesSignature(e.variables),
    populate: (e) => {
      setDraft(e.variables);
      setConflictBaseline({ uid: e.uid, variables: e.variables });
    },
  });
  useEffect(() => {
    if (!liveEntity || isDirty) return;
    setConflictBaseline(liveEntity);
  }, [liveEntity, isDirty, setConflictBaseline]);

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
        const transient: VariableEntity = { uid: collectionUid, variables: [...draft] };
        if (variableResolveAdapter.applyResolutionToEntity(transient, path, { base: '', theirs })) {
          setDraft(transient.variables);
        }
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

  const applyResolutions = useCallback(
    (resolutions: Map<string, ConflictResolution>) => {
      const projected = projectWithResolutions(resolutions);
      setDraft(projected.variables);
      for (const [path, choice] of resolutions) {
        const conflict = allConflicts.get(path);
        if (!conflict) continue;
        if (choice === 'theirs') conflicts.acceptTheirs(path, conflict.theirs);
        else conflicts.dismiss(path);
      }
    },
    [allConflicts, conflicts, projectWithResolutions, setDraft],
  );

  const conflictPathLabels = useMemo(
    () =>
      liveEntity
        ? prettyPathMap(variableResolveAdapter, liveEntity, allConflicts.keys())
        : new Map<string, string>(),
    [liveEntity, allConflicts],
  );

  const savedText = useMemo(() => {
    if (!isConflictDialogOpen || !collection) return '';
    return JSON.stringify(collection.variables, null, 2);
  }, [isConflictDialogOpen, collection]);

  const buildLocalText = useCallback(
    (resolutions: ReadonlyMap<string, ConflictResolution>): string => {
      const projected = projectWithResolutions(resolutions);
      return JSON.stringify(projected.variables, null, 2);
    },
    [projectWithResolutions],
  );

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

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
        message.error('Collection was deleted from another tab');
        return;
      }
      const detail = 'message' in result ? result.message : undefined;
      message.error(`Failed to save collection variables${detail ? `: ${detail}` : ''}`);
    });
  }, [collection, isDirty, draft, replaceVariables, message, conflicts]);

  useEffect(() => {
    registerSaveRef?.(handleSave);
  }, [registerSaveRef, handleSave]);

  if (!collection) {
    return (
      <div style={{ padding: 24, background: token.colorBgContainer }}>
        <Text type="secondary">Collection not found.</Text>
      </div>
    );
  }

  const nonEmptyCount = draft.filter((v) => v.name.trim()).length;
  const localInstanceId = useLocalInstanceId();

  const scopeNoun = kind === 'request' ? 'request' : kind === 'template' ? 'template' : 'rule';

  const headerTitle = (
    <>
      {scopeBadge('collection', 14)}
      <Typography.Text strong style={{ fontSize: 13 }}>
        {collection.name} · Variables
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
    <EntityScopeProvider entityType={entityType} entityId={collectionUid}>
      <div style={{ display: 'flex', flexDirection: 'column', background: token.colorBgContainer, height: '100%' }}>
        <EditorHeader title={headerTitle} isDirty={isDirty} onSave={handleSave} />
        <EntityConflictBanner
          count={allConflicts.size}
          onReview={() => setConflictDialogOpen(true)}
          onKeepAllMine={handleKeepAllMine}
          onUseAllSaved={handleUseAllSaved}
        />
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          <div style={{ maxWidth: 920, margin: '0 auto' }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              Variables available to every {scopeNoun} inside this collection. Overridden by environment and vault scopes;
              overrides the workspace scope. Stored in plain text — use the Vault for secrets.
            </Text>

            <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 11, fontWeight: 600 }}>
              VARIABLES ({nonEmptyCount})
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

export default CollectionVariablesEditor;
