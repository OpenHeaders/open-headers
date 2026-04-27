/**
 * ImportPreviewModal — preview a workspace-export envelope and confirm
 * an import (design §5.2 / §5.3 / §5.4).
 *
 * Flow inside the modal:
 *   1. File / clipboard text arrives → `parseWorkspaceExport` (renderer-
 *      side, pure). Envelope-level rejections render as a hard error
 *      banner; per-entity drops surface alongside the importable tree.
 *   2. SW preview RPC (`previewWorkspaceImport`) runs `diff` +
 *      `walkMissingDeps` against the chosen target. SW returns a
 *      `snapshotHash` so we can detect concurrent edits between
 *      preview-open and submit.
 *   3. Soft-dedup banner (§5.2 precedence): SW walks every workspace's
 *      `importReports` ring for `exportId` / `workspace.uid` matches.
 *   4. User picks per-entity strategies + the import target
 *      (current / new / pick existing). On submit we re-run the
 *      preview RPC; if `snapshotHash` changed, surface the
 *      concurrent-edit banner and re-render before allowing import.
 *   5. `importWorkspace` RPC drives the SW orchestrator's lock + writes.
 *
 * Untrusted-string discipline (§4.1 gate 10): every export-supplied
 * string (workspace.name, source.workspaceLabel, entity.name, notes)
 * renders as a React text node. Never `dangerouslySetInnerHTML`,
 * never markdown.
 *
 * "Trust this export" (rule-enable + script-enable) lives in PR 5.
 * For PR 2D, the modal scaffolds an Advanced disclosure but exposes
 * only "Backup-restore mode" inside it — the §5.5 toggles ship later.
 */

import { UploadOutlined, WarningOutlined } from '@ant-design/icons';
import { hashImportSource } from '@openheaders/core/import';
import type { V5 } from '@openheaders/core/types';
import {
  type CollisionStrategy,
  type DiffResult,
  decryptVaultBlock,
  type ImportDrop,
  type MissingDep,
  parseWorkspaceExport,
  type StrategyMap,
  VaultDecryptionFailedError,
  VaultPayloadShapeError,
  type WorkspaceExport,
} from '@openheaders/core/workspace-export';
import { Alert, App as AntApp, Button, Empty, Modal, Space, Spin, Typography } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DedupMatchesResult } from '@/background/modules/workspace-import-dedup';
import { call } from '@/utils/bridge';
import AdvancedDisclosure from './preview/AdvancedDisclosure';
import DedupBanner from './preview/DedupBanner';
import ImportDiffWorkspace from './preview/ImportDiffWorkspace';
import MissingDepsPanel from './preview/MissingDepsPanel';
import RejectionBanner, { type ParseRejection } from './preview/RejectionBanner';
import SourceAttribution from './preview/SourceAttribution';
import StripScriptsTopRow from './preview/StripScriptsTopRow';
import TargetControl, { type ImportTargetSelection } from './preview/TargetControl';
import type { ImportPreviewSource } from './preview/types';
import { VaultDecryptedBanner, VaultEncryptedBlock, VaultPartialDecryptPanel } from './preview/VaultBlocks';

const { Text } = Typography;

// ── Types ──────────────────────────────────────────────────────────

export type { ImportTargetSelection } from './preview/TargetControl';
export type { ImportPreviewSource } from './preview/types';

interface ImportPreviewModalProps {
  open: boolean;
  /** Raw export text (YAML or JSON) — modal handles parse + preview. */
  rawText: string | null;
  /**
   * Pre-parse error surfaced by the caller (e.g. "link expired",
   * "couldn't decompress payload"). Renders the same error banner the
   * parse pipeline uses for envelope rejections.
   */
  initialError?: string | null;
  /** Provenance of the source (drives tone of the modal & "Save & re-open" hint). */
  source?: ImportPreviewSource;
  /** All workspaces the user can pick as the import target. */
  workspaces: V5.ExtensionWorkspace[];
  activeWorkspaceId: string | null;
  /** Default target when the modal opens. */
  initialTarget?: ImportTargetSelection;
  onCancel: () => void;
  /** Called after a successful import — caller closes modal + shows post-import toast. */
  onImported: (result: { targetWorkspaceId: string; importedCount: number; sourceLabel: string }) => void;
}

interface PreviewState {
  diff: DiffResult;
  missingDeps: MissingDep[];
  snapshotHash: string;
  targetWorkspaceId: string | null;
}

// ParseRejection lives in ./preview/RejectionBanner — re-imported below.

// ── Modal ──────────────────────────────────────────────────────────

const ImportPreviewModal: React.FC<ImportPreviewModalProps> = ({
  open,
  rawText,
  initialError,
  source,
  workspaces,
  activeWorkspaceId,
  initialTarget,
  onCancel,
  onImported,
}) => {
  const { message } = AntApp.useApp();

  const [parseRejection, setParseRejection] = useState<ParseRejection | null>(null);
  const [parsed, setParsed] = useState<{ envelope: WorkspaceExport; drops: ImportDrop[] } | null>(null);
  const [sourceHash, setSourceHash] = useState<string | null>(null);
  // Vault decryption state — when the envelope carries a `secrets` block,
  // the user enters a passphrase and we decrypt client-side, then inject
  // the resulting secrets into envelope.entities.vault.secrets so the
  // importer's standard vault path picks them up. The passphrase never
  // crosses the bridge — only the decrypted secrets do, and only inside
  // the `incoming` envelope payload of `importWorkspace`.
  const [vaultPassphrase, setVaultPassphrase] = useState('');
  const [vaultDecryptError, setVaultDecryptError] = useState<string | null>(null);
  const [vaultDecrypting, setVaultDecrypting] = useState(false);
  const [vaultFingerprints, setVaultFingerprints] = useState<{ ciphertext: string; key: string } | null>(null);
  // Per-secret decode failures surfaced by `decryptVaultBlock` — these
  // are well-formed envelope + correct passphrase, but one or more
  // entries inside the AES-GCM payload didn't validate against
  // `VaultSecretSchema`. Surfaced alongside the decrypted banner so the
  // user can see "N secret(s) skipped" with the per-entry reason
  // (design §3.2 — fail-soft per secret instead of all-or-nothing).
  const [vaultPartialDrops, setVaultPartialDrops] = useState<{ index: number; reason: string }[]>([]);
  /** When set, the rendered envelope has decrypted secrets injected. */
  const [decryptedEnvelope, setDecryptedEnvelope] = useState<WorkspaceExport | null>(null);
  const [target, setTarget] = useState<ImportTargetSelection>(
    initialTarget ?? (activeWorkspaceId ? { mode: 'current' } : { mode: 'new' }),
  );
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [strategies, setStrategies] = useState<StrategyMap>({});
  const [backupRestore, setBackupRestore] = useState(false);
  const [trustExport, setTrustExport] = useState(false);
  // Strip-scripts default depends on source trust posture (design §5.5).
  // Low-trust sources (URL fetch / deep link) pre-check; local sources start unchecked.
  const isLowTrustSource = source === 'link' || source === 'playground' || source === 'context-menu';
  const [stripScripts, setStripScripts] = useState<boolean>(isLowTrustSource);
  const [omitOAuthConfigs, setOmitOAuthConfigs] = useState(false);
  const [keepTargetCollectionOrder, setKeepTargetCollectionOrder] = useState(false);
  const [includeWorkspaceSettings, setIncludeWorkspaceSettings] = useState(false);
  const [refuseUidCollision, setRefuseUidCollision] = useState(false);
  const [dedup, setDedup] = useState<DedupMatchesResult | null>(null);
  // Per-`(exportId, target)` dismissals for the soft-dedup banner. Lives
  // in sessionStorage so the dismissal persists across modal opens within
  // the same browser session but doesn't outlive the tab — the banner is
  // a soft signal, not a permanent suppression. Keyed by exportId plus
  // the resolved target workspace id (or `'new'` for new-workspace target),
  // matching design §5.2's "dismissable per (exportId, current-target)
  // pair" so re-importing into a sequence of fresh workspaces only shows
  // the banner once per pair.
  const [dedupDismissed, setDedupDismissed] = useState<ReadonlySet<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = window.sessionStorage.getItem('oh.workspace-export.dedup-dismissed');
      const arr = raw ? (JSON.parse(raw) as unknown) : null;
      return Array.isArray(arr) ? new Set(arr.filter((x): x is string => typeof x === 'string')) : new Set();
    } catch {
      return new Set();
    }
  });
  const [importing, setImporting] = useState(false);
  const [staleSnapshotHash, setStaleSnapshotHash] = useState<string | null>(null);
  const requestSeq = useRef(0);

  // ── Stage 1: parse on open / when raw text changes ────────────────
  useEffect(() => {
    if (!open) return;
    if (initialError) {
      setParseRejection({ kind: 'caller', details: initialError });
      setParsed(null);
      setSourceHash(null);
      return;
    }
    if (rawText === null) {
      setParseRejection(null);
      setParsed(null);
      setSourceHash(null);
      return;
    }
    const result = parseWorkspaceExport(rawText);
    if (!result.ok) {
      setParseRejection({ kind: 'parse', reason: result.reason, details: result.details });
      setParsed(null);
      setSourceHash(null);
      return;
    }
    setParseRejection(null);
    setParsed({ envelope: result.export, drops: result.drops });
    setStrategies({});
    setBackupRestore(false);
    setTrustExport(false);
    setStripScripts(isLowTrustSource);
    setOmitOAuthConfigs(false);
    setKeepTargetCollectionOrder(false);
    setIncludeWorkspaceSettings(false);
    setRefuseUidCollision(false);
    setStaleSnapshotHash(null);
    // Reset vault decrypt state when a fresh envelope arrives — a new
    // file shouldn't carry over the prior passphrase or decrypted vault.
    setVaultPassphrase('');
    setVaultDecryptError(null);
    setVaultFingerprints(null);
    setVaultPartialDrops([]);
    setDecryptedEnvelope(null);
    void hashImportSource(rawText)
      .then(setSourceHash)
      .catch(() => setSourceHash(''));
  }, [open, rawText, initialError, isLowTrustSource]);

  // Reset on close so a second open starts clean.
  useEffect(() => {
    if (open) return;
    setParseRejection(null);
    setParsed(null);
    setPreview(null);
    setPreviewError(null);
    setStrategies({});
    setBackupRestore(false);
    setTrustExport(false);
    setStripScripts(false);
    setOmitOAuthConfigs(false);
    setKeepTargetCollectionOrder(false);
    setIncludeWorkspaceSettings(false);
    setRefuseUidCollision(false);
    setDedup(null);
    setStaleSnapshotHash(null);
    setSourceHash(null);
    setVaultPassphrase('');
    setVaultDecryptError(null);
    setVaultFingerprints(null);
    setVaultPartialDrops([]);
    setDecryptedEnvelope(null);
  }, [open]);

  // The envelope used for preview + import. When the user has decrypted
  // the secrets block, swap in the decrypted envelope; otherwise the
  // parsed (encrypted) envelope is what we ship — the importer treats a
  // missing entities.vault as "no secrets to merge", which is what we
  // want for un-decrypted imports.
  const effectiveEnvelope: WorkspaceExport | null = decryptedEnvelope ?? parsed?.envelope ?? null;

  // ── Stage 2: SW-side preview (diff + missing-deps) ────────────────
  useEffect(() => {
    if (!effectiveEnvelope) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    let cancelled = false;
    const seq = ++requestSeq.current;
    setPreviewing(true);
    setPreviewError(null);
    void call('previewWorkspaceImport', {
      incoming: effectiveEnvelope,
      target: target,
      backupRestore,
    })
      .then((res) => {
        if (cancelled || seq !== requestSeq.current) return;
        if (!res.success || !res.diff || !res.missingDeps || !res.snapshotHash) {
          setPreviewError(res.error ?? 'Preview failed');
          setPreview(null);
          return;
        }
        setPreview({
          diff: res.diff,
          missingDeps: res.missingDeps,
          snapshotHash: res.snapshotHash,
          targetWorkspaceId: res.targetWorkspaceId ?? null,
        });
        setStaleSnapshotHash(null);
      })
      .catch((err: Error) => {
        if (cancelled || seq !== requestSeq.current) return;
        setPreviewError(err.message);
        setPreview(null);
      })
      .finally(() => {
        if (cancelled || seq !== requestSeq.current) return;
        setPreviewing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [effectiveEnvelope, target, backupRestore]);

  // ── Stage 3: dedup walker ─────────────────────────────────────────
  useEffect(() => {
    if (!parsed || !preview) {
      setDedup(null);
      return;
    }
    let cancelled = false;
    void call('findWorkspaceExportImportMatches', {
      exportId: parsed.envelope.exportId,
      workspaceUid: parsed.envelope.workspace.uid,
      currentTargetWorkspaceId: preview.targetWorkspaceId,
    })
      .then((res) => {
        if (cancelled) return;
        setDedup(res);
        // Same-install detection (design §5.5): if the export's
        // workspace.uid matches the current target's workspace, the
        // recipient is almost certainly looking at their own backup.
        // Pre-check "this is mine — prefer update by uid". Skipped if
        // the user already toggled something (we don't stomp their
        // pick); the auto-pick is a one-shot helpful default.
        if (
          target.mode === 'current' &&
          res.workspaceUidMatches.some((m) => m.workspaceId === preview.targetWorkspaceId)
        ) {
          setBackupRestore((prev) => prev || true);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setDedup(null);
      });
    return () => {
      cancelled = true;
    };
  }, [parsed, preview, target.mode]);

  // ── Submit ────────────────────────────────────────────────────────
  const handleImport = useCallback(async () => {
    if (!parsed || !preview || !sourceHash || !effectiveEnvelope) return;
    setImporting(true);
    try {
      // Re-run preview to detect concurrent edits since the user opened
      // the modal (design §9 — "data changed since you opened this preview").
      const fresh = await call('previewWorkspaceImport', {
        incoming: effectiveEnvelope,
        target,
        backupRestore,
      });
      if (!fresh.success || !fresh.snapshotHash) {
        message.error(fresh.error ?? 'Preview re-check failed');
        return;
      }
      if (fresh.snapshotHash !== preview.snapshotHash) {
        // Surface the change and require a second confirmation.
        setStaleSnapshotHash(preview.snapshotHash);
        if (fresh.diff && fresh.missingDeps) {
          setPreview({
            diff: fresh.diff,
            missingDeps: fresh.missingDeps,
            snapshotHash: fresh.snapshotHash,
            targetWorkspaceId: fresh.targetWorkspaceId ?? null,
          });
        }
        return;
      }
      const res = await call('importWorkspace', {
        incoming: effectiveEnvelope,
        strategies,
        backupRestore,
        trustExport,
        stripScripts,
        omitOAuthConfigs,
        keepTargetCollectionOrder,
        refuseUidCollision,
        target,
        sourceHash,
      });
      if (!res.success || !res.report || !res.targetWorkspaceId) {
        message.error(res.error ?? 'Import failed');
        return;
      }
      onImported({
        targetWorkspaceId: res.targetWorkspaceId,
        importedCount: res.report.summary.imported,
        sourceLabel: effectiveEnvelope.source.workspaceLabel ?? effectiveEnvelope.workspace.name,
      });
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }, [
    parsed,
    preview,
    sourceHash,
    target,
    backupRestore,
    trustExport,
    stripScripts,
    omitOAuthConfigs,
    keepTargetCollectionOrder,
    refuseUidCollision,
    strategies,
    message,
    onImported,
    effectiveEnvelope,
  ]);

  // ── Vault decryption handler ────────────────────────────────────
  const handleDecryptVault = useCallback(async () => {
    if (!parsed?.envelope.secrets) return;
    setVaultDecrypting(true);
    setVaultDecryptError(null);
    try {
      const result = await decryptVaultBlock(parsed.envelope.secrets, vaultPassphrase);
      // Inject decrypted secrets into a new envelope copy. The importer's
      // standard vault path handles merge/replace/skip; we don't need to
      // touch the importer to support encrypted exports.
      const next: WorkspaceExport = {
        ...parsed.envelope,
        entities: {
          ...parsed.envelope.entities,
          vault: {
            schemaVersion: 5,
            version: 1,
            secrets: result.secrets,
          },
        },
      };
      // Drop the encrypted block from the working copy — it served its
      // purpose; the decrypted secrets are now in entities.vault and the
      // importer reads from there.
      delete (next as { secrets?: unknown }).secrets;
      setDecryptedEnvelope(next);
      setVaultFingerprints({ ciphertext: result.ciphertextFingerprint, key: result.keyFingerprint });
      setVaultPartialDrops(result.drops);
      setVaultPassphrase(''); // wipe from memory
    } catch (err) {
      if (err instanceof VaultDecryptionFailedError) {
        setVaultDecryptError(
          'Could not decrypt — wrong passphrase or tampered ciphertext. Check the passphrase with the sender.',
        );
      } else if (err instanceof VaultPayloadShapeError) {
        setVaultDecryptError(`The encrypted payload didn't match an expected vault shape: ${err.message}`);
      } else {
        setVaultDecryptError(err instanceof Error ? err.message : 'Decryption failed');
      }
    } finally {
      setVaultDecrypting(false);
    }
  }, [parsed, vaultPassphrase]);

  // ── Strategy update helpers ──────────────────────────────────────

  const setStrategyFor = useCallback((kind: keyof StrategyMap, uid: string, value: CollisionStrategy) => {
    setStrategies((prev) => {
      const bucket = (prev[kind] as Record<string, CollisionStrategy> | undefined) ?? {};
      return { ...prev, [kind]: { ...bucket, [uid]: value } };
    });
  }, []);

  // ── Render ────────────────────────────────────────────────────────

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text type="secondary" style={{ fontSize: 11 }}>
        {parsed
          ? `Export ${parsed.envelope.exportId} · ${parsed.envelope.scope}`
          : source === 'file'
            ? 'Pick a file to preview'
            : 'No data'}
      </Text>
      <Space>
        <Button onClick={onCancel} disabled={importing}>
          Cancel
        </Button>
        <Button
          type="primary"
          icon={<UploadOutlined />}
          onClick={() => void handleImport()}
          disabled={!parsed || !preview || previewing || !sourceHash || importing}
          loading={importing}
        >
          Import
        </Button>
      </Space>
    </div>
  );

  return (
    <Modal
      open={open}
      title={<span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>IMPORT WORKSPACE EXPORT</span>}
      onCancel={importing ? undefined : onCancel}
      width="90vw"
      centered
      destroyOnHidden
      footer={footer}
      styles={{ body: { maxHeight: 'calc(90vh - 110px)', overflowY: 'auto', paddingTop: 12 } }}
    >
      {parseRejection && <RejectionBanner rejection={parseRejection} />}

      {!parsed && !parseRejection && (
        <Empty
          description={
            source === 'file'
              ? 'Drop a .openheaders.yaml file to preview it.'
              : source === 'link' || source === 'playground'
                ? 'Resolving import link…'
                : 'Paste a workspace export to preview it.'
          }
        />
      )}

      {parsed && (
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <SourceAttribution envelope={parsed.envelope} drops={parsed.drops} />

          <TargetControl
            target={target}
            onChange={setTarget}
            workspaces={workspaces}
            activeWorkspaceId={activeWorkspaceId}
            envelope={parsed.envelope}
          />

          {dedup &&
            (() => {
              const key = `${parsed.envelope.exportId}:${preview?.targetWorkspaceId ?? 'new'}`;
              if (dedupDismissed.has(key)) return null;
              return (
                <DedupBanner
                  dedup={dedup}
                  envelope={effectiveEnvelope}
                  onDismiss={() => {
                    setDedupDismissed((prev) => {
                      const next = new Set(prev);
                      next.add(key);
                      try {
                        window.sessionStorage.setItem(
                          'oh.workspace-export.dedup-dismissed',
                          JSON.stringify(Array.from(next)),
                        );
                      } catch {
                        // sessionStorage can throw under privacy modes — dismissal stays for the modal lifetime
                      }
                      return next;
                    });
                  }}
                />
              );
            })()}

          {parsed.envelope.secrets && !decryptedEnvelope && (
            <VaultEncryptedBlock
              envelope={parsed.envelope}
              passphrase={vaultPassphrase}
              onChangePassphrase={setVaultPassphrase}
              onDecrypt={() => void handleDecryptVault()}
              decrypting={vaultDecrypting}
              error={vaultDecryptError}
            />
          )}

          {decryptedEnvelope && vaultFingerprints && (
            <VaultDecryptedBanner
              fingerprints={vaultFingerprints}
              secretCount={decryptedEnvelope.entities.vault?.secrets.length ?? 0}
            />
          )}

          {decryptedEnvelope && vaultPartialDrops.length > 0 && <VaultPartialDecryptPanel drops={vaultPartialDrops} />}

          {parsed.envelope.meta.redactions.vault === 'plaintext' && (
            <Alert
              type="warning"
              showIcon
              icon={<WarningOutlined />}
              title="This export contains plaintext vault secrets"
              description="Anyone with this file can read every secret it carries. Consider re-issuing as encrypted before forwarding."
            />
          )}

          {staleSnapshotHash && (
            <Alert
              type="warning"
              showIcon
              title="Data changed since you opened this preview"
              description="The target workspace was modified by another tab. The collision tree below has been refreshed — review and click Import again."
            />
          )}

          {previewing && !preview && (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Spin />
            </div>
          )}

          {previewError && (
            <Alert type="error" showIcon title="Couldn't compute collision diff" description={previewError} />
          )}

          {preview && (
            <>
              {preview.missingDeps.length > 0 && <MissingDepsPanel missingDeps={preview.missingDeps} />}

              {isLowTrustSource && (
                <StripScriptsTopRow source={source ?? 'link'} stripScripts={stripScripts} onChange={setStripScripts} />
              )}

              <div style={{ height: '60vh', minHeight: 420, display: 'flex', flexDirection: 'column' }}>
                <ImportDiffWorkspace
                  diff={preview.diff}
                  incomingEntities={{
                    workspaceVars: effectiveEnvelope?.entities.workspaceVars,
                    vault: effectiveEnvelope?.entities.vault,
                  }}
                  strategies={strategies}
                  onChangeStrategy={setStrategyFor}
                />
              </div>

              <AdvancedDisclosure
                lowTrustSource={isLowTrustSource}
                source={source ?? 'file'}
                backupRestore={backupRestore}
                onBackupRestoreChange={setBackupRestore}
                trustExport={trustExport}
                onTrustExportChange={setTrustExport}
                stripScripts={stripScripts}
                onStripScriptsChange={setStripScripts}
                omitOAuthConfigs={omitOAuthConfigs}
                onOmitOAuthConfigsChange={setOmitOAuthConfigs}
                keepTargetCollectionOrder={keepTargetCollectionOrder}
                onKeepTargetCollectionOrderChange={setKeepTargetCollectionOrder}
                includeWorkspaceSettings={includeWorkspaceSettings}
                onIncludeWorkspaceSettingsChange={setIncludeWorkspaceSettings}
                refuseUidCollision={refuseUidCollision}
                onRefuseUidCollisionChange={setRefuseUidCollision}
                targetMode={target.mode}
              />
            </>
          )}
        </Space>
      )}
    </Modal>
  );
};

export default ImportPreviewModal;
