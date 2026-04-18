/**
 * CollectionVariablesEditor — tab body for editing a single collection's
 * scoped variables.
 *
 * Collection variables sit between workspace and environment scope in
 * priority; they apply only to rules inside the collection's subtree.
 * Secrets are NOT supported here — collection vars are synced via Git
 * in team workspaces (v2), and secrets must stay local-per-device
 * (Bruno model). The Vault is the only safe home for sensitive values.
 */

import { FolderOpenOutlined } from '@ant-design/icons';
import { useEnvironments } from '@hooks/useEnvironments';
import { useRules } from '@hooks/useRules';
import type { V5 } from '@openheaders/core/types';
import { Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import VariableTable from './panels/VariableTable';

const { Text, Title } = Typography;

interface CollectionVariablesEditorProps {
  collectionUid: string;
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
}

function fingerprint(vars: V5.Variable[]): string {
  return JSON.stringify(vars.map((v) => [v.name, v.value, v.type]));
}

const CollectionVariablesEditor: React.FC<CollectionVariablesEditorProps> = ({
  collectionUid,
  onDirtyChange,
  registerSaveRef,
}) => {
  const { token } = theme.useToken();
  const { localCollections } = useRules();
  const { updateCollectionVariables } = useEnvironments();

  const collection = useMemo(
    () => localCollections.find((c) => c.uid === collectionUid) ?? null,
    [localCollections, collectionUid],
  );

  const initialVars = collection?.variables ?? [];
  const [draft, setDraft] = useState<V5.Variable[]>(() => initialVars);
  const persistedFpRef = useRef<string>(fingerprint(initialVars));

  useEffect(() => {
    if (!collection) return;
    const fp = fingerprint(collection.variables);
    if (fp !== persistedFpRef.current) {
      persistedFpRef.current = fp;
      setDraft(collection.variables);
    }
  }, [collection]);

  const isDirty = useMemo(() => fingerprint(draft) !== persistedFpRef.current, [draft]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleSave = useCallback(() => {
    if (!collection || !isDirty) return;
    void updateCollectionVariables(collection.uid, draft).then((ok) => {
      if (ok) {
        persistedFpRef.current = fingerprint(draft);
        onDirtyChange?.(false);
      }
    });
  }, [collection, isDirty, draft, updateCollectionVariables, onDirtyChange]);

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

  return (
    <div style={{ padding: 24, background: token.colorBgContainer, overflow: 'auto', height: '100%' }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <FolderOpenOutlined style={{ fontSize: 18, color: token.colorTextTertiary }} />
          <Title level={4} style={{ margin: 0 }}>
            {collection.name} · Variables
          </Title>
        </div>

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
  );
};

export default CollectionVariablesEditor;
