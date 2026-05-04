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
import { useCallback, useEffect, useMemo } from 'react';
import { EntityScopeProvider, VARIABLE_PATHS } from '@/shared/awareness';
import { useEditorDirty } from '@/shared/awareness/use-editor-dirty';
import { useDirtyDraft } from '../hooks/useDirtyDraft';
import EditorHeader from './EditorHeader';
import VariableTable from './panels/VariableTable';
import { scopeBadge } from './shared/scope-colors';

const { Text, Title } = Typography;

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

function fingerprint(vars: V5.Variable[]): string {
  return JSON.stringify(vars.map((v) => [v.name, v.value, v.type]));
}
const EMPTY_VARS: V5.Variable[] = [];

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

  const { draft, setDraft, isDirty, markPersisted } = useDirtyDraft<V5.Variable[]>({
    serverDraft: collection?.variables ?? null,
    fingerprint,
    empty: EMPTY_VARS,
  });

  const entityType = entityTypeFor(kind);

  useEditorDirty({ entityType, entityId: collectionUid }, isDirty);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleSave = useCallback(() => {
    if (!collection || !isDirty) return;
    void replaceVariables(collection.uid, draft).then((result) => {
      if (result.ok) {
        markPersisted(draft);
        onDirtyChange?.(false);
        return;
      }
      if (result.reason === 'not-found') {
        message.error('Collection was deleted from another tab');
        return;
      }
      const detail = 'message' in result ? result.message : undefined;
      message.error(`Failed to save collection variables${detail ? `: ${detail}` : ''}`);
    });
  }, [collection, isDirty, draft, replaceVariables, onDirtyChange, message, markPersisted]);

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

  const scopeNoun = kind === 'request' ? 'request' : kind === 'template' ? 'template' : 'rule';

  const headerTitle = (
    <>
      {scopeBadge('collection', 20)}
      <Title level={5} style={{ margin: 0 }}>
        {collection.name} · Variables
      </Title>
    </>
  );

  return (
    <EntityScopeProvider entityType={entityType} entityId={collectionUid}>
      <div style={{ display: 'flex', flexDirection: 'column', background: token.colorBgContainer, height: '100%' }}>
        <EditorHeader title={headerTitle} isDirty={isDirty} onSave={handleSave} />
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          <div style={{ maxWidth: 920, margin: '0 auto' }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              Variables available to every {scopeNoun} inside this collection. Overridden by environment and vault scopes;
              overrides the workspace scope. Stored in plain text — use the Vault for secrets.
            </Text>

            <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 11, fontWeight: 600 }}>
              VARIABLES ({nonEmptyCount})
            </Text>

            <VariableTable variables={draft} onChange={setDraft} allowSecrets={false} rowPath={VARIABLE_PATHS.row} />
          </div>
        </div>
      </div>
    </EntityScopeProvider>
  );
};

export default CollectionVariablesEditor;
