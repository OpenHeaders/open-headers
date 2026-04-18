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
import { Alert, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import VariableTable from './panels/VariableTable';

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
    secrets: vars.filter((v) => v.name.trim()).map((v) => ({ name: v.name, value: v.value })),
  };
}
function fingerprint(vault: V5.Vault): string {
  return JSON.stringify(vault.secrets.map((s) => [s.name, s.value]));
}

const VaultEditor: React.FC<VaultEditorProps> = ({ onDirtyChange, registerSaveRef }) => {
  const { token } = theme.useToken();
  const { vault, setVault } = useEnvironments();

  const [draft, setDraft] = useState<V5.Variable[]>(() => toVars(vault));
  const persistedFpRef = useRef<string>(fingerprint(vault));

  useEffect(() => {
    const fp = fingerprint(vault);
    if (fp !== persistedFpRef.current) {
      persistedFpRef.current = fp;
      setDraft(toVars(vault));
    }
  }, [vault]);

  const isDirty = useMemo(() => fingerprint(fromVars(draft)) !== persistedFpRef.current, [draft]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleSave = useCallback(() => {
    if (!isDirty) return;
    const next = fromVars(draft);
    void setVault(next).then((ok) => {
      if (ok) {
        persistedFpRef.current = fingerprint(next);
        onDirtyChange?.(false);
      }
    });
  }, [isDirty, draft, setVault, onDirtyChange]);

  useEffect(() => {
    registerSaveRef?.(handleSave);
  }, [registerSaveRef, handleSave]);

  // Force every row to be treated as secret by the table. Table's
  // `allowSecrets` governs whether the user can toggle; passing false
  // here keeps values masked with no toggle.
  const secretDraft = useMemo<V5.Variable[]>(() => draft.map((v) => ({ ...v, type: 'secret' as const })), [draft]);

  const nonEmptyCount = draft.filter((v) => v.name.trim()).length;

  return (
    <div style={{ padding: 24, background: token.colorBgContainer, overflow: 'auto', height: '100%' }}>
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
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
