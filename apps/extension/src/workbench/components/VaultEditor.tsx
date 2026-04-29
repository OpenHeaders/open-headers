/**
 * VaultEditor — tab body for the per-workspace secrets vault.
 *
 * Highest priority in the resolution chain and local-per-device:
 * secrets never leave this browser profile (§12.3 — vault is
 * non-syncing in v1). The banner makes this contract visible.
 *
 * Each entry carries a `kind` discriminator:
 *   - `string` rows hold a literal value returned verbatim by `{{vault.X}}`.
 *   - `totp`   rows hold a base32 seed + RFC 6238 parameters; `{{vault.X}}`
 *              resolves to the freshly-computed code at request time.
 *
 * Save commits via `useVariableMutator.replaceVault`, which delegates
 * to the sync engine (`applyVaultReplacement` → `oh.sync.apply`); dirty
 * state is tracked locally by comparing the draft's fingerprint
 * against the broadcast-driven canonical view.
 *
 * Awareness publishes only `entityFocus = { type: VAULT_ENTITY_TYPE }`
 * — the SW awareness store scrubs `fieldFocus` for this entity (§14.4)
 * so per-secret-name presence never leaks the secret namespace.
 */

import { useActiveWorkspaceId } from '@hooks/useActiveWorkspaceId';
import { useAwareness } from '@hooks/useAwareness';
import { useEnvironments } from '@hooks/useEnvironments';
import { useVariableMutator } from '@hooks/useVariableMutator';
import { VAULT_ENTITY_TYPE, VAULT_ID } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { Alert, App, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo } from 'react';
import { useDirtyDraft } from '../hooks/useDirtyDraft';
import EditorHeader from './EditorHeader';
import VariableTable from './panels/VariableTable';
import { scopeBadge } from './shared/scope-colors';

const { Text, Title } = Typography;
const SURFACE_ID = 'workbench';

interface VaultEditorProps {
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
}

const EMPTY_SECRETS: V5.VaultSecret[] = [];

function fingerprintSecrets(secrets: V5.VaultSecret[]): string {
  return JSON.stringify(
    secrets
      .filter((s) => s.name.trim())
      .map((s) =>
        s.kind === 'totp'
          ? ['totp', s.name, s.seed, s.algorithm, s.digits, s.period, s.issuer ?? '']
          : ['string', s.name, s.value],
      ),
  );
}

const VaultEditor: React.FC<VaultEditorProps> = ({ onDirtyChange, registerSaveRef }) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { vault } = useEnvironments();
  const { replaceVault } = useVariableMutator();
  const workspaceId = useActiveWorkspaceId();

  const serverDraft = useMemo<V5.VaultSecret[]>(() => [...vault.secrets], [vault]);
  const { draft, setDraft, isDirty, markPersisted } = useDirtyDraft<V5.VaultSecret[]>({
    serverDraft,
    fingerprint: fingerprintSecrets,
    empty: EMPTY_SECRETS,
  });

  // Awareness — entity-level only. Vault is §12.1 schema-marked
  // sensitive; the SW awareness store drops `fieldFocus` for this
  // entity type even if a surface tries to publish it.
  useAwareness({
    workspaceId,
    surfaceId: SURFACE_ID,
    entityFocus: { type: VAULT_ENTITY_TYPE, id: VAULT_ID },
    fieldFocus: null,
    dirtyFields: isDirty ? ['*'] : [],
  });

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleSave = useCallback(async () => {
    if (!isDirty) return;
    const result = await replaceVault(draft);
    if (result.ok) {
      markPersisted([...draft]);
      onDirtyChange?.(false);
    } else {
      const detail = 'message' in result && result.message ? `: ${result.message}` : '';
      message.error(`Failed to save vault${detail}`);
    }
  }, [isDirty, draft, replaceVault, onDirtyChange, message, markPersisted]);

  const handleSaveSync = useCallback(() => {
    void handleSave();
  }, [handleSave]);

  useEffect(() => {
    registerSaveRef?.(handleSaveSync);
  }, [registerSaveRef, handleSaveSync]);

  const counts = useMemo(() => {
    let strings = 0;
    let totps = 0;
    for (const s of draft) {
      if (s.kind === 'totp') totps++;
      else strings++;
    }
    return { strings, totps };
  }, [draft]);

  const headerTitle = (
    <>
      {scopeBadge('vault', 20)}
      <Title level={5} style={{ margin: 0 }}>
        Vault
      </Title>
    </>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: token.colorBgContainer, height: '100%' }}>
      <EditorHeader title={headerTitle} isDirty={isDirty} onSave={handleSaveSync} />
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <div style={{ maxWidth: 920, margin: '0 auto' }}>
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="Local-per-device"
            description="Vault secrets are stored only in this browser profile. They take priority over every other scope. They are never synced — not via Git, not via the desktop WebSocket. Add a TOTP entry to reference its current 6-digit code as {{vault.NAME}} from any request."
          />

          <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 11, fontWeight: 600 }}>
            SECRETS ({counts.strings} string · {counts.totps} TOTP)
          </Text>

          <VariableTable mode="vault" secrets={draft} onChange={setDraft} />
        </div>
      </div>
    </div>
  );
};

export default VaultEditor;
