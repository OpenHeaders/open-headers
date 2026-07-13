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
 *   - `client-certificate` rows hold a TLS client cert + key PEM pair
 *              (+ optional passphrase). Not template-resolvable —
 *              requests reference the entry by name via their
 *              "Client certificate" setting.
 *
 * Save commits via `useVariableMutator.replaceVault`, which delegates
 * to the sync engine (`applyVaultReplacement` → `oh.sync.apply`); dirty
 * state is tracked locally by comparing the draft's fingerprint
 * against the broadcast-driven canonical view.
 *
 * Awareness: contributes through `useEditorShell` (which bundles
 * `useEditorDirty` + branded `<EntityScopeProvider>` wiring) pinned to
 * the singleton id (`VAULT_ID`). Sensitive entity per §14.4 — passes
 * `options.disableFieldFocus: true` so `shell.field === null`; the SW
 * awareness store also scrubs `fieldFocus` for this entity type
 * defensively. The entity-level presence chip is the only signal.
 */

import { useVariableMutator } from '@openheaders/ui/shared/hooks/mutators/useVariableMutator';
import { useVault } from '@openheaders/ui/shared/hooks/readers/useVault';
import { canonicalJsonPretty, VAULT_ENTITY_TYPE, VAULT_ID } from '@openheaders/core/sync';
import type { Vault, VaultSecret } from '@openheaders/core/types';
import { Alert, App, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { EntityScopeProvider, PresenceBadge, useLocalInstanceId } from '@openheaders/ui/shared/awareness';
import {
  type ConflictResolution,
  EntityConflictBanner,
  EntityConflictDialog,
  prettyPathMap,
  useAutoMergeForm,
} from '@openheaders/ui/shared/conflicts';
import { useEditorShell, useReprime } from '@openheaders/ui/shared/editor-shell';
import { stableStringify } from '@openheaders/ui/shared/forms';
import EditorHeader from '../shell/EditorHeader';
import VariableTable, { type VariableTableConflictBridge } from '../panels/VariableTable';
import { scopeBadge } from '../shared/scope-colors';
import { projectSecretsToForm, useVaultConflicts } from './use-vault-conflicts';
import { vaultResolveAdapter } from './vault-conflict-adapter';

const { Text } = Typography;

interface VaultEditorProps {
  onDirtyChange?: (dirty: boolean) => void;
  registerSaveRef?: (save: () => void) => void;
}

const EMPTY_SECRETS: VaultSecret[] = [];

// Order-SENSITIVE signature — vault secrets now persist their row order as
// fractional-index keys (see `applyVaultReplacement`), so the materialized
// order matches the editor's. Order-sensitivity is therefore correct AND
// load-bearing: a drag-reorder shifts the fingerprint, flips `isDirty`,
// and Save persists the new order.
function secretsSignature(secrets: readonly VaultSecret[]): string {
  return stableStringify(secrets);
}

const VaultEditor: React.FC<VaultEditorProps> = ({ onDirtyChange, registerSaveRef }) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { vault, isLocked } = useVault();
  const { replaceVault } = useVariableMutator();

  const [draft, setDraft] = useState<VaultSecret[]>(() => vault.secrets ?? EMPTY_SECRETS);
  const formFingerprint = useMemo(() => secretsSignature(draft), [draft]);
  const liveVaultWithUid = useMemo(() => ({ ...vault, uid: VAULT_ID }), [vault]);

  // Conflict-baseline ref pattern (canonical recipe — see RuleEditor /
  // EnvironmentEditor): conflict tracker reads `isDirty` from reprime,
  // reprime's `onPrimed` advances the tracker's baseline. Break the
  // ordering cycle with a ref.
  const setBaselineRef = useRef<(e: Vault & { uid: string }) => void>(() => undefined);
  // Snapshot of secrets at the most recent re-prime — feeds the
  // merge-editor preview's Show Base layouts via `baseText`.
  const baselineSecretsRef = useRef<readonly VaultSecret[] | null>(null);

  const reprime = useReprime<Vault>({
    liveEntity: vault,
    scope: { entityType: VAULT_ENTITY_TYPE, entityId: VAULT_ID },
    enabled: true,
    formFingerprint,
    signature: (e) => secretsSignature(e.secrets),
    populate: (e) => setDraft(e.secrets),
    onPrimed: (e) => {
      setBaselineRef.current({ ...e, uid: VAULT_ID });
      baselineSecretsRef.current = e.secrets;
    },
  });
  const isDirty = reprime.isDirty;

  const conflicts = useVaultConflicts({ liveVault: vault, isDirty, enabled: true });
  setBaselineRef.current = conflicts.setBaseline;

  const formProjection = useMemo(() => projectSecretsToForm(draft), [draft]);
  const formSetOrders = useMemo(
    () => new Map<string, readonly string[]>([['secrets', draft.map((s) => s.uid)]]),
    [draft],
  );

  // Per-leaf auto-rebase — see EnvironmentEditor for the full discipline.
  // For Vault: kind-transition leaves (`kind` flips) are not auto-merged
  // because `vaultResolveAdapter.applyResolutionToEntity` rejects partial
  // kind writes; user must resolve those via the dialog. `getAutoMergeable`
  // still surfaces them — the apply returning false leaves the chip up.
  const applyAutoMerge = useCallback(
    (path: string, theirs: string) => {
      const transient = { uid: VAULT_ID, schemaVersion: vault.schemaVersion, secrets: [...draft] } as Vault & {
        uid: string;
      };
      if (!vaultResolveAdapter.applyResolutionToEntity(transient, path, { base: '', theirs })) return;
      setDraft(transient.secrets);
    },
    [draft, vault.schemaVersion],
  );
  useAutoMergeForm({ conflicts, formProjection, applyToForm: applyAutoMerge });
  const allConflicts = useMemo(
    () => conflicts.getAllConflicts(formProjection, formSetOrders),
    [conflicts, formProjection, formSetOrders],
  );
  const [isConflictDialogOpen, setConflictDialogOpen] = useState(false);

  const conflictBridge = useMemo<VariableTableConflictBridge>(
    () => ({
      getLeafConflict: (path, local) => conflicts.getConflict(path, local),
      getSetConflict: (setPath, uid, formContainsUid) => conflicts.getSetConflict(setPath, uid, formContainsUid),
      onAcceptTheirs: (path, theirs) => {
        const transient = { uid: VAULT_ID, schemaVersion: vault.schemaVersion, secrets: [...draft] } as Vault & {
          uid: string;
        };
        // Only dismiss the chip when the apply succeeded. Kind-transition leaf
        // writes (`secrets.<uid>.kind`) reject inline — the user must resolve
        // those via the dialog's row-level Use Saved which carries the full
        // payload. Dismissing on a no-op apply would hide the conflict
        // without changing the data.
        if (!vaultResolveAdapter.applyResolutionToEntity(transient, path, { base: '', theirs })) return;
        setDraft(transient.secrets);
        conflicts.acceptTheirs(path, theirs);
      },
      onDismiss: (path) => conflicts.dismiss(path),
    }),
    [conflicts, draft, vault.schemaVersion, setDraft],
  );

  const projectWithResolutions = useCallback(
    (resolutions: ReadonlyMap<string, ConflictResolution>): Vault & { uid: string } => {
      const transient = { uid: VAULT_ID, schemaVersion: vault.schemaVersion, secrets: [...draft] } as Vault & {
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

  // Phase 6 commit seam — JSON.parse the merge-editor's result text
  // back into the secrets array, replace the draft, dismiss every
  // conflict path. Throws on malformed JSON or non-array shape.
  const handleResolveText = useCallback(
    (text: string) => {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error('Vault secrets must be a JSON array.');
      setDraft(parsed as VaultSecret[]);
      for (const path of allConflicts.keys()) conflicts.dismiss(path);
    },
    [allConflicts, conflicts, setDraft],
  );

  // All three panes serialize via canonicalJsonPretty: the saved side
  // round-tripped chrome.storage (alphabetized row keys) while the mine
  // side carries literal construction order — an insertion-ordered dump
  // would light spurious diff lines on structurally-equal rows.
  const savedText = useMemo(() => {
    if (!isConflictDialogOpen) return '';
    return canonicalJsonPretty(vault.secrets);
  }, [isConflictDialogOpen, vault.secrets]);

  // Baseline JSON for the merge-editor preview's Show Base layouts.
  const baseText = useMemo(() => {
    if (!isConflictDialogOpen) return undefined;
    const baseline = baselineSecretsRef.current;
    if (!baseline) return undefined;
    return canonicalJsonPretty(baseline);
  }, [isConflictDialogOpen]);

  // Local projection serialized for the merge editor's mine pane.
  const mineText = useMemo(() => {
    if (!isConflictDialogOpen) return '';
    return canonicalJsonPretty(draft);
  }, [isConflictDialogOpen, draft]);

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

  const shell = useEditorShell({
    entityType: VAULT_ENTITY_TYPE,
    entityId: VAULT_ID,
    isDirty,
    onSave: handleSaveSync,
    onDirtyChange,
    registerSaveRef,
    options: { disableFieldFocus: true },
  });

  const counts = useMemo(() => {
    let strings = 0;
    let totps = 0;
    let certs = 0;
    for (const s of draft) {
      if (s.kind === 'totp') totps++;
      else if (s.kind === 'client-certificate') certs++;
      else strings++;
    }
    return { strings, totps, certs };
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
    <EntityScopeProvider shell={shell.scopeProps}>
      <div style={{ display: 'flex', flexDirection: 'column', background: token.colorBgContainer, height: '100%' }}>
        <EditorHeader title={headerTitle} shell={shell.headerProps} />
        <EntityConflictBanner
          count={allConflicts.size}
          onReview={() => setConflictDialogOpen(true)}
          onKeepAllMine={handleKeepAllMine}
          onUseAllSaved={handleUseAllSaved}
        />
        <div style={{ flex: 1, overflow: 'auto', overscrollBehavior: 'none', padding: 24 }}>
          <div style={{ maxWidth: 920, margin: '0 auto' }}>
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="Local-per-device"
              description="Vault secrets are stored only in this browser profile. They take priority over every other scope. They are never synced — not via Git, not via the desktop WebSocket. Add a TOTP entry to reference its current 6-digit code as {{vault.NAME}} from any request."
            />

            {isLocked ? (
              <Alert
                type="error"
                showIcon
                message="Vault locked — at-rest key lost"
                description="This vault's secrets are still stored on this device but can no longer be decrypted: the at-rest key that sealed them is gone (cleared browser data, a new profile, or a reset extension key). Editing is disabled so a new entry can't overwrite the sealed data. Re-enter the secrets to unlock the vault — the existing entries will be replaced."
              />
            ) : (
              <>
                <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 11, fontWeight: 600 }}>
                  SECRETS ({counts.strings} string · {counts.totps} TOTP · {counts.certs} certificate)
                </Text>

                <VariableTable mode="vault" secrets={draft} onChange={setDraft} conflictBridge={conflictBridge} />
              </>
            )}
          </div>
        </div>
        <EntityConflictDialog
          open={isConflictDialogOpen}
          savedText={savedText}
          mineText={mineText}
          baseText={baseText}
          language="json"
          onResolveText={handleResolveText}
          onClose={() => setConflictDialogOpen(false)}
        />
      </div>
    </EntityScopeProvider>
  );
};

export default VaultEditor;
