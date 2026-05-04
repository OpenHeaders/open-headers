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
 * Awareness: contributes through `useEditorDirty` + `<EntityScopeProvider>`
 * pinned to the singleton id (`VAULT_ID`). Sensitive entity per §14.4 —
 * NO per-secret field paths are published; the SW awareness store also
 * scrubs `fieldFocus` for this entity type defensively. The entity-level
 * presence chip is the only signal.
 */

import { useEnvironments } from '@hooks/useEnvironments';
import { useVariableMutator } from '@hooks/useVariableMutator';
import { VAULT_ENTITY_TYPE, VAULT_ID } from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { Alert, App, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EntityScopeProvider, PresenceBadge, useLocalInstanceId } from '@/shared/awareness';
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
import { vaultResolveAdapter } from './vault-conflict-adapter';
import { projectSecretsToForm, useVaultConflicts } from './use-vault-conflicts';

const { Text } = Typography;

interface VaultEditorProps {
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
}

const EMPTY_SECRETS: V5.VaultSecret[] = [];

function secretsSignature(secrets: readonly V5.VaultSecret[]): string {
  return stableStringify(secrets);
}

const VaultEditor: React.FC<VaultEditorProps> = ({ onDirtyChange, registerSaveRef }) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { vault } = useEnvironments();
  const { replaceVault } = useVariableMutator();

  // Derived dirty (universal contract). See EnvironmentEditor for the
  // lastPrimedSig rationale.
  const [draft, setDraft] = useState<V5.VaultSecret[]>(() => vault.secrets ?? EMPTY_SECRETS);
  const [lastPrimedSig, setLastPrimedSig] = useState<string | null>(null);

  const formSig = useMemo(() => secretsSignature(draft), [draft]);
  const liveSig = useMemo(() => secretsSignature(vault.secrets), [vault.secrets]);
  const isDirty = lastPrimedSig !== null && formSig !== lastPrimedSig;

  useEditorDirty({ entityType: VAULT_ENTITY_TYPE, entityId: VAULT_ID }, isDirty);

  // ── Conflict tracking ──────────────────────────────────────────
  const conflicts = useVaultConflicts({ liveVault: vault, isDirty, enabled: true });
  const setConflictBaseline = conflicts.setBaseline;
  const liveVaultWithUid = useMemo(() => ({ ...vault, uid: VAULT_ID }), [vault]);

  useEntityReprime<V5.Vault>({
    liveEntity: vault,
    scope: { entityType: VAULT_ENTITY_TYPE, entityId: VAULT_ID },
    isDirty,
    enabled: true,
    signature: (e) => secretsSignature(e.secrets),
    populate: (e) => {
      setDraft(e.secrets);
      setLastPrimedSig(secretsSignature(e.secrets));
      setConflictBaseline({ ...e, uid: VAULT_ID });
    },
  });

  useEffect(() => {
    if (formSig === null || liveSig === null) return;
    if (formSig !== liveSig) return;
    if (lastPrimedSig === liveSig) return;
    setLastPrimedSig(liveSig);
    setConflictBaseline(liveVaultWithUid);
  }, [formSig, liveSig, lastPrimedSig, liveVaultWithUid, setConflictBaseline]);

  const formProjection = useMemo(() => projectSecretsToForm(draft), [draft]);
  const formSetOrders = useMemo(
    () => new Map<string, readonly string[]>([['secrets', draft.map((s) => s.uid)]]),
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
        const transient = { uid: VAULT_ID, schemaVersion: vault.schemaVersion, secrets: [...draft] } as V5.Vault & {
          uid: string;
        };
        if (vaultResolveAdapter.applyResolutionToEntity(transient, path, { base: '', theirs })) {
          setDraft(transient.secrets);
        }
        conflicts.acceptTheirs(path, theirs);
      },
      onDismiss: (path) => conflicts.dismiss(path),
    }),
    [conflicts, draft, vault.schemaVersion, setDraft],
  );

  const projectWithResolutions = useCallback(
    (resolutions: ReadonlyMap<string, ConflictResolution>): V5.Vault & { uid: string } => {
      const transient = { uid: VAULT_ID, schemaVersion: vault.schemaVersion, secrets: [...draft] } as V5.Vault & {
        uid: string;
      };
      for (const [path, choice] of resolutions) {
        if (choice !== 'theirs') continue;
        const conflict = allConflicts.get(path);
        if (!conflict) continue;
        vaultResolveAdapter.applyResolutionToEntity(transient, path, conflict);
      }
      return transient;
    },
    [allConflicts, draft, vault.schemaVersion],
  );

  const handleKeepAllMine = useCallback(() => {
    for (const path of allConflicts.keys()) conflicts.dismiss(path);
  }, [allConflicts, conflicts]);

  const handleUseAllSaved = useCallback(() => {
    const all = new Map<string, ConflictResolution>();
    for (const path of allConflicts.keys()) all.set(path, 'theirs');
    const projected = projectWithResolutions(all);
    setDraft(projected.secrets);
    for (const [path, conflict] of allConflicts) conflicts.acceptTheirs(path, conflict.theirs);
  }, [allConflicts, conflicts, projectWithResolutions, setDraft]);

  const applyResolutions = useCallback(
    (resolutions: Map<string, ConflictResolution>) => {
      const projected = projectWithResolutions(resolutions);
      setDraft(projected.secrets);
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
    () => prettyPathMap(vaultResolveAdapter, liveVaultWithUid, allConflicts.keys()),
    [liveVaultWithUid, allConflicts],
  );

  const savedText = useMemo(() => {
    if (!isConflictDialogOpen) return '';
    return JSON.stringify(vault.secrets, null, 2);
  }, [isConflictDialogOpen, vault.secrets]);

  const buildLocalText = useCallback(
    (resolutions: ReadonlyMap<string, ConflictResolution>): string => {
      const projected = projectWithResolutions(resolutions);
      return JSON.stringify(projected.secrets, null, 2);
    },
    [projectWithResolutions],
  );

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleSave = useCallback(async () => {
    if (!isDirty) return;
    const result = await replaceVault(draft);
    if (result.ok) {
      // Dirty derives from form-vs-canonical equality; the post-save
      // broadcast brings them into alignment automatically.
      conflicts.clearDismissed();
    } else {
      const detail = 'message' in result && result.message ? `: ${result.message}` : '';
      message.error(`Failed to save vault${detail}`);
    }
  }, [isDirty, draft, replaceVault, message, conflicts]);

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

  const localInstanceId = useLocalInstanceId();

  const headerTitle = (
    <>
      {scopeBadge('vault', 14)}
      <Typography.Text strong style={{ fontSize: 13 }}>
        Vault
      </Typography.Text>
      <PresenceBadge
        entityType={VAULT_ENTITY_TYPE}
        entityId={VAULT_ID}
        excludeInstanceId={localInstanceId}
        style={{ marginLeft: 6 }}
      />
    </>
  );

  return (
    <EntityScopeProvider entityType={VAULT_ENTITY_TYPE} entityId={VAULT_ID}>
      <div style={{ display: 'flex', flexDirection: 'column', background: token.colorBgContainer, height: '100%' }}>
        <EditorHeader title={headerTitle} isDirty={isDirty} onSave={handleSaveSync} />
        <EntityConflictBanner
          count={allConflicts.size}
          onReview={() => setConflictDialogOpen(true)}
          onKeepAllMine={handleKeepAllMine}
          onUseAllSaved={handleUseAllSaved}
        />
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

            <VariableTable mode="vault" secrets={draft} onChange={setDraft} conflictBridge={conflictBridge} />
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

export default VaultEditor;
