/**
 * CollectionVariablesEditor — tab body for editing a single collection's
 * scoped variables.
 *
 * Polymorphic over `kind`: 'rule' (rule-collection / `useRules`) and
 * 'template' (template-collection / `useRules.templateCollections`).
 * Three layers vary per kind:
 *  - which hook list to read the collection from
 *  - which `useVariableMutator` write method to invoke
 *  - the scope-badge label / kind-specific copy
 *
 * A REQUEST collection's variables are a section of its container
 * editor ({@link RequestContainerEditor}) — one tab per collection,
 * the concerns as sub-tabs — so that family never mounts this editor.
 *
 * Everything else — dirty-tracking, fingerprint, save flow, draft
 * shape, table, the conflict wiring (shared through
 * {@link useCollectionVariableConflictsUi}) — is identical across kinds.
 *
 * Collection variables sit between workspace and environment scope in
 * priority; they apply only to entities (rules, templates) inside the
 * collection's subtree. Secrets are NOT supported here — collection
 * vars are synced via Git in team workspaces (v2), and secrets must
 * stay local-per-device. The Vault is the only safe home for sensitive
 * values.
 */

import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import { useVariableMutator } from '@openheaders/ui/shared/hooks/mutators/useVariableMutator';
import { COLLECTION_ENTITY_TYPE, TEMPLATE_COLLECTION_ENTITY_TYPE } from '@openheaders/core/sync';
import type { Collection, Variable } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { App, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { EntityScopeProvider, PresenceBadge, useLocalInstanceId, VARIABLE_PATHS } from '@openheaders/ui/shared/awareness';
import { EntityConflictBanner, EntityConflictDialog } from '@openheaders/ui/shared/conflicts';
import { useEditorShell, useReprime } from '@openheaders/ui/shared/editor-shell';
import { stableStringify } from '@openheaders/ui/shared/forms';
import EditorHeader from '../shell/EditorHeader';
import VariableTable from '../panels/VariableTable';
import { scopeBadge } from '../shared/scope-colors';
import { useCollectionVariableConflictsUi } from './use-collection-variable-conflicts-ui';

const { Text } = Typography;

export type CollectionVariablesKind = 'rule' | 'template';

function entityTypeFor(kind: CollectionVariablesKind): string {
  return kind === 'template' ? TEMPLATE_COLLECTION_ENTITY_TYPE : COLLECTION_ENTITY_TYPE;
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
export function variablesSignature(vars: readonly Variable[]): string {
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
  const { replaceCollectionVariables, replaceTemplateCollectionVariables } = useVariableMutator();

  const collection = useMemo(() => {
    const list = kind === 'template' ? templateCollections : localCollections;
    return list.find((c) => c.uid === collectionUid) ?? null;
  }, [kind, localCollections, templateCollections, collectionUid]);

  const replaceVariables = kind === 'template' ? replaceTemplateCollectionVariables : replaceCollectionVariables;

  const [draft, setDraft] = useState<Variable[]>(() => collection?.variables ?? EMPTY_VARS);
  const formFingerprint = useMemo(() => variablesSignature(draft), [draft]);

  const entityType = entityTypeFor(kind);

  // Conflict-baseline ref pattern (canonical recipe): the reprime
  // primes before the conflict wiring exists, so the baseline advance
  // goes through a ref the wiring fills in below.
  const onPrimedRef = useRef<(variables: Variable[]) => void>(() => undefined);

  const reprime = useReprime<Collection>({
    liveEntity: collection,
    scope: { entityType, entityId: collectionUid },
    enabled: collection !== null,
    formFingerprint,
    signature: (e) => variablesSignature(e.variables),
    populate: (e) => setDraft(e.variables),
    onPrimed: (e) => onPrimedRef.current(e.variables),
  });
  const isDirty = reprime.isDirty;

  const conflictsUi = useCollectionVariableConflictsUi({
    collectionUid,
    entityType,
    savedVariables: collection?.variables ?? null,
    draft,
    setDraft,
    isDirty,
  });
  onPrimedRef.current = conflictsUi.onPrimed;

  const handleSave = useCallback(() => {
    if (!collection || !isDirty) return;
    void replaceVariables(collection.uid, draft).then((result) => {
      if (result.ok) {
        // Dirty derives from form-vs-canonical equality; the post-save
        // broadcast brings them into alignment automatically.
        conflictsUi.clearDismissed();
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
  }, [collection, isDirty, draft, replaceVariables, message, conflictsUi, t]);

  const shell = useEditorShell({
    entityType,
    entityId: collectionUid,
    isDirty,
    onSave: handleSave,
    onDirtyChange,
    registerSaveRef,
  });

  const localInstanceId = useLocalInstanceId();

  if (!collection) {
    return (
      <div style={{ padding: 24, background: token.colorBgContainer }}>
        <Text type="secondary">{t('workbench.variables.collection.notFound')}</Text>
      </div>
    );
  }

  const nonEmptyCount = draft.filter((v) => v.name.trim()).length;

  const description =
    kind === 'template'
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
        <EntityConflictBanner count={conflictsUi.conflictCount} {...conflictsUi.banner} />
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
              conflictBridge={conflictsUi.conflictBridge}
            />
          </div>
        </div>
        <EntityConflictDialog language="json" {...conflictsUi.dialog} />
      </div>
    </EntityScopeProvider>
  );
};

export default CollectionVariablesEditor;
