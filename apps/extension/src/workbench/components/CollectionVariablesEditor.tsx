/**
 * CollectionVariablesEditor — tab body for editing a single collection's
 * scoped variables.
 *
 * Collection variables sit between workspace and environment scope in
 * priority; they apply only to rules inside the collection's subtree.
 * Secrets are NOT supported here — collection vars are synced via Git
 * in team workspaces (v2), and secrets must stay local-per-device.
 * The Vault is the only safe home for sensitive values.
 *
 * Phase B — writes route through the sync oracle via
 * `useVariableMutator.replaceCollectionVariables` (which delegates to
 * `applyCollectionVariablesReplacement`). Convergence is per-(name)
 * LWW at the oracle; the legacy stale-draft contract is retired (§24).
 */

import { useRules } from '@hooks/useRules';
import { useVariableMutator } from '@hooks/useVariableMutator';
import type { V5 } from '@openheaders/core/types';
import { App, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { useDirtyDraft } from '../hooks/useDirtyDraft';
import EditorHeader from './EditorHeader';
import VariableTable from './panels/VariableTable';
import { scopeBadge } from './shared/scope-colors';

const { Text, Title } = Typography;

interface CollectionVariablesEditorProps {
  collectionUid: string;
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
}

function fingerprint(vars: V5.Variable[]): string {
  return JSON.stringify(vars.map((v) => [v.name, v.value, v.type]));
}
const EMPTY_VARS: V5.Variable[] = [];

const CollectionVariablesEditor: React.FC<CollectionVariablesEditorProps> = ({
  collectionUid,
  onDirtyChange,
  registerSaveRef,
}) => {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const { localCollections } = useRules();
  const { replaceCollectionVariables } = useVariableMutator();

  const collection = useMemo(
    () => localCollections.find((c) => c.uid === collectionUid) ?? null,
    [localCollections, collectionUid],
  );

  const { draft, setDraft, isDirty, markPersisted } = useDirtyDraft<V5.Variable[]>({
    serverDraft: collection?.variables ?? null,
    fingerprint,
    empty: EMPTY_VARS,
  });

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleSave = useCallback(() => {
    if (!collection || !isDirty) return;
    void replaceCollectionVariables(collection.uid, draft).then((result) => {
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
  }, [collection, isDirty, draft, replaceCollectionVariables, onDirtyChange, message, markPersisted]);

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

  const headerTitle = (
    <>
      {scopeBadge('collection', 20)}
      <Title level={5} style={{ margin: 0 }}>
        {collection.name} · Variables
      </Title>
    </>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: token.colorBgContainer, height: '100%' }}>
      <EditorHeader title={headerTitle} isDirty={isDirty} onSave={handleSave} />
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            Variables available to every rule inside this collection. Overridden by environment and vault scopes;
            overrides the workspace scope. Stored in plain text — use the Vault for secrets.
          </Text>

          <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 11, fontWeight: 600 }}>
            VARIABLES ({nonEmptyCount})
          </Text>

          <VariableTable variables={draft} onChange={setDraft} allowSecrets={false} />
        </div>
      </div>
    </div>
  );
};

export default CollectionVariablesEditor;
