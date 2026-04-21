/**
 * VaultEditor — tab body for the per-workspace secrets vault.
 *
 * Highest priority in the 4-scope resolution chain and
 * local-per-device: secrets never leave this browser profile. Team
 * workspace sync (v2) explicitly excludes the vault keyspace. The
 * banner makes this contract visible to the user.
 *
 * Vault secrets have no `type` discriminator (they're all sensitive),
 * but we reuse the shared `VariableTable` by mapping to/from a
 * `V5.Variable`-shaped list with `type: 'secret'`. Keeps the UX
 * consistent with the other editors.
 */

import { LockOutlined } from '@ant-design/icons';
import { useEnvironments } from '@hooks/useEnvironments';
import type { V5 } from '@openheaders/core/types';
import { Alert, App, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDirtyDraft } from '../hooks/useDirtyDraft';
import VariableTable from './panels/VariableTable';
import StaleDraftBanner from './StaleDraftBanner';

const { Text, Title } = Typography;

interface VaultEditorProps {
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
}

function toVars(vault: V5.Vault): V5.Variable[] {
  return vault.secrets.map((s) => ({ name: s.name, value: s.value, type: 'secret' as const }));
}
function fromVars(vars: V5.Variable[]): V5.Vault {
  return {
    schemaVersion: 5,
    // Placeholder — the SW stamps the real version on write. Only the
    // `secrets` field feeds `setVault`.
    version: 1,
    secrets: vars.filter((v) => v.name.trim()).map((v) => ({ name: v.name, value: v.value })),
  };
}
// Module-level — `useDirtyDraft` requires a stable fingerprint reference.
// Signature is `(V5.Variable[]) => string` so the hook can fingerprint
// the draft directly without needing the `fromVars` transform.
function fingerprintVars(vars: V5.Variable[]): string {
  return JSON.stringify(vars.filter((v) => v.name.trim()).map((v) => [v.name, v.value]));
}
const EMPTY_VARS: V5.Variable[] = [];

const VaultEditor: React.FC<VaultEditorProps> = ({ onDirtyChange, registerSaveRef }) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { vault, setVault } = useEnvironments();

  // Server-side Vault is transformed to draft shape before the hook
  // sees it. Fingerprint is also in draft shape for symmetry — blank
  // rows are filtered by `fingerprintVars` so an unsubmitted blank
  // doesn't falsely mark the draft dirty.
  const serverDraft = useMemo(() => toVars(vault), [vault]);
  const { draft, setDraft, isDirty, markPersisted, resetToServer } = useDirtyDraft<V5.Variable[]>({
    serverDraft,
    fingerprint: fingerprintVars,
    empty: EMPTY_VARS,
  });

  // Phase 10 — snapshot loaded version once; only our own successful
  // saves advance it. See `RuleEditor` for the full contract.
  const [loadedVersion, setLoadedVersion] = useState<number | null>(null);
  const [staleDraft, setStaleDraft] = useState<{ serverVersion: number; loadedVersion: number } | null>(null);

  useEffect(() => {
    if (loadedVersion !== null) return;
    setLoadedVersion(vault.version);
  }, [vault.version, loadedVersion]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleSave = useCallback(async () => {
    if (!isDirty) return;
    const next = fromVars(draft);
    const result = await setVault(next, loadedVersion ?? undefined);
    if (result.ok) {
      // Persisted shape drops blank-name rows — pass the filtered
      // draft so the hook's "clean baseline" matches what's on disk.
      markPersisted(toVars(next));
      setLoadedVersion(result.version);
      setStaleDraft(null);
      onDirtyChange?.(false);
    } else if (result.reason === 'stale-draft') {
      setStaleDraft({ serverVersion: result.serverVersion, loadedVersion: loadedVersion ?? 0 });
    } else {
      message.error(`Failed to save vault${'message' in result ? `: ${result.message}` : ''}`);
    }
  }, [isDirty, draft, setVault, onDirtyChange, loadedVersion, message, markPersisted]);

  const handleStaleDraftReload = useCallback(() => {
    // Discard this tab's edits; re-hydrate from the broadcast-fresh
    // vault + snap loadedVersion forward.
    resetToServer();
    setLoadedVersion(vault.version);
    setStaleDraft(null);
    onDirtyChange?.(false);
  }, [vault.version, onDirtyChange, resetToServer]);

  const handleStaleDraftKeepEditing = useCallback(() => {
    setLoadedVersion(vault.version);
    setStaleDraft(null);
  }, [vault.version]);

  const handleSaveSync = useCallback(() => {
    void handleSave();
  }, [handleSave]);

  useEffect(() => {
    registerSaveRef?.(handleSaveSync);
  }, [registerSaveRef, handleSaveSync]);

  // Force every row to be treated as secret by the table. Table's
  // `allowSecrets` governs whether the user can toggle; passing false
  // here keeps values masked with no toggle.
  const secretDraft = useMemo<V5.Variable[]>(() => draft.map((v) => ({ ...v, type: 'secret' as const })), [draft]);

  const nonEmptyCount = draft.filter((v) => v.name.trim()).length;

  return (
    <div style={{ padding: 24, background: token.colorBgContainer, overflow: 'auto', height: '100%' }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        {staleDraft && (
          <StaleDraftBanner
            entityLabel="vault"
            serverVersion={staleDraft.serverVersion}
            loadedVersion={staleDraft.loadedVersion}
            onReload={handleStaleDraftReload}
            onKeepEditing={handleStaleDraftKeepEditing}
          />
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <LockOutlined style={{ fontSize: 18, color: token.colorError }} />
          <Title level={4} style={{ margin: 0 }}>
            Vault
          </Title>
        </div>

        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Local-per-device"
          description="Vault secrets are stored only in this browser profile. They take priority over every other scope. They are never synced — not via Git, not via the desktop WebSocket."
        />

        <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 11, fontWeight: 600 }}>
          SECRETS ({nonEmptyCount})
        </Text>

        <VariableTable
          variables={secretDraft}
          onChange={(next) => setDraft(next.map((v) => ({ ...v, type: 'secret' })))}
          allowSecrets={false}
        />
      </div>
    </div>
  );
};

export default VaultEditor;
