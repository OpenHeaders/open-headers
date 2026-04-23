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
 * Phase 10 — same stale-draft contract as RuleEditor / EnvironmentEditor.
 * The editor captures `loadedVersion` on first arrival, sends it as
 * `expectedVersion` on save, and renders `StaleDraftBanner` when the
 * SW rejects because another tab landed a newer write.
 */

import { scopeBadge } from './shared/scope-colors';
import { useEnvironments } from '@hooks/useEnvironments';
import { useRules } from '@hooks/useRules';
import type { V5 } from '@openheaders/core/types';
import { App, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDirtyDraft } from '../hooks/useDirtyDraft';
import VariableTable from './panels/VariableTable';
import StaleDraftBanner from './StaleDraftBanner';

const { Text, Title } = Typography;

interface CollectionVariablesEditorProps {
  collectionUid: string;
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
}

// Module-level — `useDirtyDraft` requires a stable fingerprint reference.
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
  const { updateCollectionVariables } = useEnvironments();

  const collection = useMemo(
    () => localCollections.find((c) => c.uid === collectionUid) ?? null,
    [localCollections, collectionUid],
  );

  const { draft, setDraft, isDirty, markPersisted, resetToServer } = useDirtyDraft<V5.Variable[]>({
    serverDraft: collection?.variables ?? null,
    fingerprint,
    empty: EMPTY_VARS,
  });

  // Phase 10 stale-draft tracking — see RuleEditor for the full
  // rationale. `loadedVersion` is snapped once on first arrival and
  // only advances on our own successful saves; cross-tab broadcasts
  // do NOT bump it (that would defeat protection).
  const [loadedVersion, setLoadedVersion] = useState<number | null>(null);
  const [staleDraft, setStaleDraft] = useState<{ serverVersion: number; loadedVersion: number } | null>(null);

  useEffect(() => {
    if (loadedVersion !== null) return;
    if (typeof collection?.version !== 'number') return;
    setLoadedVersion(collection.version);
  }, [collection?.version, loadedVersion]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleSave = useCallback(() => {
    if (!collection || !isDirty) return;
    void updateCollectionVariables(collection.uid, draft, loadedVersion ?? undefined).then((result) => {
      if (result.ok) {
        markPersisted(draft);
        setLoadedVersion(result.version);
        setStaleDraft(null);
        onDirtyChange?.(false);
        return;
      }
      if (result.reason === 'stale-draft') {
        // Another tab saved first — prompt the user to reload or keep
        // editing. No toast; the banner is the interaction surface.
        setStaleDraft({ serverVersion: result.serverVersion, loadedVersion: loadedVersion ?? 0 });
        return;
      }
      if (result.reason === 'not-found') {
        message.error('Collection was deleted from another tab');
        return;
      }
      message.error(`Failed to save collection variables: ${result.message}`);
    });
  }, [collection, isDirty, draft, updateCollectionVariables, onDirtyChange, loadedVersion, message, markPersisted]);

  useEffect(() => {
    registerSaveRef?.(handleSave);
  }, [registerSaveRef, handleSave]);

  const handleStaleReload = useCallback(() => {
    // Discard local edits; snap loadedVersion forward to the server's
    // current version. The collection reference from context has
    // already been broadcast-refreshed so `resetToServer` picks up the
    // winning save.
    const current = collection?.version ?? loadedVersion ?? 0;
    setLoadedVersion(current);
    setStaleDraft(null);
    resetToServer();
    onDirtyChange?.(false);
  }, [collection, loadedVersion, onDirtyChange, resetToServer]);

  const handleStaleKeepEditing = useCallback(() => {
    // Snap loadedVersion forward so the next save's expectedVersion
    // matches and the overwrite lands.
    const current = collection?.version ?? loadedVersion ?? 0;
    setLoadedVersion(current);
    setStaleDraft(null);
  }, [collection, loadedVersion]);

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
          {scopeBadge('collection', 20)}
          <Title level={4} style={{ margin: 0 }}>
            {collection.name} · Variables
          </Title>
        </div>

        {staleDraft && (
          <StaleDraftBanner
            entityLabel="collection"
            serverVersion={staleDraft.serverVersion}
            loadedVersion={staleDraft.loadedVersion}
            onReload={handleStaleReload}
            onKeepEditing={handleStaleKeepEditing}
          />
        )}

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
