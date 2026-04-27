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

import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  UploadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { hashImportSource } from '@openheaders/core/import';
import type { V5 } from '@openheaders/core/types';
import {
  type CollisionStrategy,
  type DiffEntry,
  type DiffResult,
  type DiffSingleton,
  decryptVaultBlock,
  type ImportDrop,
  type MissingDep,
  type ParseResult,
  parseWorkspaceExport,
  type StrategyMap,
  VaultDecryptionFailedError,
  VaultPayloadShapeError,
  type WorkspaceExport,
} from '@openheaders/core/workspace-export';
import {
  Alert,
  App as AntApp,
  Button,
  Checkbox,
  Collapse,
  Empty,
  Input,
  Modal,
  Radio,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  theme,
} from 'antd';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DedupMatchesResult } from '@/background/modules/workspace-import-dedup';
import { call } from '@/utils/bridge';
import CollisionStrategyControl from './CollisionStrategyControl';
import RequestSummary from './RequestSummary';
import RuleSummary from './RuleSummary';

const { Text, Paragraph } = Typography;

// ── Types ──────────────────────────────────────────────────────────

export type ImportTargetSelection = { mode: 'current' } | { mode: 'new' } | { mode: 'picked'; workspaceId: string };

/**
 * Where the import flow originated. The first three (file / clipboard /
 * menu) are local-trust sources — the user has the bytes locally and
 * could read them. The last four (link / playground / context-menu /
 * paste) match `source.via` on the workspace-intent envelope and
 * generally indicate lower-trust paths (deep link, playground CTA).
 *
 * `context-menu` here matches the intent picklist; the in-extension
 * "Import from file…" entry stays under `'menu'`.
 */
export type ImportPreviewSource = 'file' | 'clipboard' | 'menu' | 'link' | 'playground' | 'context-menu' | 'paste';

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

/**
 * Structured rejection state. `kind: 'parse'` carries the discriminator
 * from `parseWorkspaceExport` so the UI can pick a tailored copy block
 * (forward-compat banner for `export-format-version`, schema-version
 * mismatch, discriminator gate, etc.). `kind: 'caller'` covers errors
 * surfaced by the caller before any parse ran (link expired, decompress
 * failure, fetch refusal).
 */
type ParseRejection =
  | { kind: 'parse'; reason: Extract<ParseResult, { ok: false }>['reason']; details: string }
  | { kind: 'caller'; details: string };

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
  const { token } = theme.useToken();
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
      width={840}
      destroyOnClose
      footer={footer}
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
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
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
              message="This export contains plaintext vault secrets"
              description="Anyone with this file can read every secret it carries. Consider re-issuing as encrypted before forwarding."
            />
          )}

          {staleSnapshotHash && (
            <Alert
              type="warning"
              showIcon
              message="Data changed since you opened this preview"
              description="The target workspace was modified by another tab. The collision tree below has been refreshed — review and click Import again."
            />
          )}

          {previewing && !preview && (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Spin />
            </div>
          )}

          {previewError && (
            <Alert type="error" showIcon message="Couldn't compute collision diff" description={previewError} />
          )}

          {preview && (
            <>
              {preview.missingDeps.length > 0 && <MissingDepsPanel missingDeps={preview.missingDeps} />}

              {isLowTrustSource && (
                <StripScriptsTopRow source={source ?? 'link'} stripScripts={stripScripts} onChange={setStripScripts} />
              )}

              <DiffTree diff={preview.diff} strategies={strategies} onChangeStrategy={setStrategyFor} token={token} />

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

// ── Sub-components ─────────────────────────────────────────────────

const RejectionBanner: React.FC<{ rejection: ParseRejection }> = ({ rejection }) => {
  const { title, body } = describeRejection(rejection);
  return (
    <Alert
      type="error"
      showIcon
      message={title}
      description={
        <div>
          <Paragraph style={{ marginBottom: 4 }}>{body}</Paragraph>
          <Text type="secondary" style={{ fontSize: 11, fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
            {rejection.details}
          </Text>
        </div>
      }
      style={{ marginBottom: 12 }}
    />
  );
};

function describeRejection(rejection: ParseRejection): { title: string; body: string } {
  if (rejection.kind === 'caller') {
    return {
      title: "Couldn't load the import",
      body: 'The source returned an error before the file could be parsed.',
    };
  }
  switch (rejection.reason) {
    case 'export-format-version':
      return {
        title: 'This export was created with a newer version of OpenHeaders',
        body: "Your installation can't read it yet. Update OpenHeaders, then try again — older versions are read forward, but newer ones aren't read backward.",
      };
    case 'schema-version':
      return {
        title: 'Incompatible workspace model version',
        body: 'This export targets a different major version of the OpenHeaders data model. Update OpenHeaders if the export is newer, or ask the sender to re-export from a current version.',
      };
    case 'discriminator':
      return {
        title: 'This file is not a workspace export',
        body: 'A workspace export starts with `kind: workspace-export`. This file has a different shape — double-check that you picked the right file.',
      };
    case 'format':
      return {
        title: "Couldn't parse the file as YAML or JSON",
        body: 'A workspace export is YAML (preferred) or JSON. The parser rejected this input — the file may be truncated or corrupted.',
      };
    case 'size-cap':
      return {
        title: 'This export is too large to import',
        body: 'Workspace exports are capped at 50 MB. Split the source workspace into smaller pieces and re-export.',
      };
    case 'envelope-schema':
      return {
        title: "The export envelope doesn't match what the importer expects",
        body: 'One or more top-level fields are missing or invalid. If this came from a trusted source, ask them to re-export.',
      };
    case 'crypto-envelope':
      return {
        title: "The encrypted block in this export isn't well-formed",
        body: "We can't decrypt the secrets without a valid envelope. Ask the sender to re-export.",
      };
  }
}

const SourceAttribution: React.FC<{ envelope: WorkspaceExport; drops: ImportDrop[] }> = ({ envelope, drops }) => {
  const counts = envelope.meta.counts;
  return (
    <div>
      <Paragraph style={{ marginBottom: 4 }}>
        <Text strong>From: </Text>
        <Text>{envelope.source.workspaceLabel ?? envelope.workspace.name}</Text>
        <Text type="secondary"> · </Text>
        <Text type="secondary">
          {envelope.source.app} {envelope.source.appVersion} · {envelope.source.platform}
        </Text>
      </Paragraph>
      <Paragraph style={{ marginBottom: 4, fontSize: 12 }}>
        <Text type="secondary">Exported {new Date(envelope.exportedAt).toLocaleString()}</Text>
      </Paragraph>
      <Paragraph style={{ marginBottom: 0, fontSize: 12 }}>
        <Text type="secondary">
          {counts.rules} rule{counts.rules === 1 ? '' : 's'}, {counts.requests} request
          {counts.requests === 1 ? '' : 's'}, {counts.environments} env{counts.environments === 1 ? '' : 's'},{' '}
          {counts.templates} template
          {counts.templates === 1 ? '' : 's'}, {counts.liveWorkflows} workflow
          {counts.liveWorkflows === 1 ? '' : 's'}
        </Text>
      </Paragraph>
      {envelope.notes && (
        <Paragraph style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}>
          <Text type="secondary">Notes: </Text>
          <Text>{envelope.notes}</Text>
        </Paragraph>
      )}
      {drops.length > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          message={`${drops.length} entit${drops.length === 1 ? 'y' : 'ies'} couldn't be parsed and will be skipped`}
          description={
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {drops.slice(0, 5).map((d, idx) => (
                <li key={`${d.path}-${idx}`} style={{ fontSize: 11 }}>
                  <Text code>{d.path}</Text> — {d.reason}
                </li>
              ))}
              {drops.length > 5 && <li style={{ fontSize: 11 }}>…and {drops.length - 5} more</li>}
            </ul>
          }
          style={{ marginTop: 8 }}
        />
      )}
    </div>
  );
};

const TargetControl: React.FC<{
  target: ImportTargetSelection;
  onChange: (t: ImportTargetSelection) => void;
  workspaces: V5.ExtensionWorkspace[];
  activeWorkspaceId: string | null;
  envelope: WorkspaceExport;
}> = ({ target, onChange, workspaces, activeWorkspaceId, envelope }) => {
  const newWsName = envelope.workspace.name;
  return (
    <div>
      <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>IMPORT INTO</Text>
      <Radio.Group
        value={target.mode}
        onChange={(e) => {
          const mode = e.target.value as ImportTargetSelection['mode'];
          if (mode === 'current') onChange({ mode: 'current' });
          else if (mode === 'new') onChange({ mode: 'new' });
          else onChange({ mode: 'picked', workspaceId: workspaces[0]?.id ?? '' });
        }}
      >
        <Radio value="current" disabled={!activeWorkspaceId}>
          Current workspace
        </Radio>
        <Radio value="new">New workspace ("{newWsName}")</Radio>
        <Radio value="picked" disabled={workspaces.length === 0}>
          Pick existing
        </Radio>
      </Radio.Group>
      {target.mode === 'picked' && (
        <Select
          size="small"
          value={target.workspaceId || undefined}
          onChange={(id) => onChange({ mode: 'picked', workspaceId: id })}
          style={{ marginTop: 6, width: 280 }}
          options={workspaces.map((w) => ({ label: w.name, value: w.id }))}
          placeholder="Select a workspace"
        />
      )}
    </div>
  );
};

const VaultEncryptedBlock: React.FC<{
  envelope: WorkspaceExport;
  passphrase: string;
  onChangePassphrase: (v: string) => void;
  onDecrypt: () => void;
  decrypting: boolean;
  error: string | null;
}> = ({ envelope, passphrase, onChangePassphrase, onDecrypt, decrypting, error }) => {
  const secretCount = envelope.meta.counts.secrets;
  const hint = envelope.secrets?.encryption.kind === 'pbkdf2-aes-gcm' ? envelope.secrets.encryption.hint : undefined;
  return (
    <Alert
      type="info"
      showIcon
      message={`Encrypted vault — ${secretCount} secret${secretCount === 1 ? '' : 's'}`}
      description={
        <Space direction="vertical" size={6} style={{ width: '100%' }}>
          {hint && (
            <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 12 }}>
              <Text strong>Hint from sender: </Text>
              <Text>{hint}</Text>
            </Paragraph>
          )}
          <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 12 }}>
            Enter the passphrase to decrypt these secrets locally. Skipping decryption proceeds with the rest of the
            import — secrets are simply omitted.
          </Paragraph>
          <Input.Password
            placeholder="Passphrase"
            value={passphrase}
            onChange={(e) => onChangePassphrase(e.target.value)}
            onPressEnter={() => {
              if (passphrase) onDecrypt();
            }}
            autoComplete="off"
          />
          <Button type="primary" size="small" loading={decrypting} disabled={!passphrase} onClick={onDecrypt}>
            Decrypt vault
          </Button>
          {error && (
            <Text type="danger" style={{ fontSize: 12 }}>
              {error}
            </Text>
          )}
        </Space>
      }
    />
  );
};

const VaultDecryptedBanner: React.FC<{ fingerprints: { ciphertext: string; key: string }; secretCount: number }> = ({
  fingerprints,
  secretCount,
}) => (
  <Alert
    type="success"
    showIcon
    icon={<CheckCircleOutlined />}
    message={`Vault decrypted — ${secretCount} secret${secretCount === 1 ? '' : 's'} ready to import`}
    description={
      <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 12 }}>
        <div>
          <Text strong>Key fingerprint: </Text>
          <Text code>{fingerprints.key}</Text>
          <Text type="secondary" style={{ marginLeft: 6 }}>
            (compare with sender)
          </Text>
        </div>
        <div>
          <Text strong>Ciphertext fingerprint: </Text>
          <Text code>{fingerprints.ciphertext}</Text>
        </div>
      </div>
    }
  />
);

/**
 * Per-secret decrypt-side fail-soft UI. The AES-GCM payload was decrypted
 * with the right passphrase but one or more decoded secret entries
 * didn't match `VaultSecretSchema`. The importer's vault path will only
 * see the survivors, so the user just needs to know what got dropped and
 * why — not approve the recovery (decryptVaultBlock already filtered).
 */
const VaultPartialDecryptPanel: React.FC<{ drops: { index: number; reason: string }[] }> = ({ drops }) => (
  <Alert
    type="warning"
    showIcon
    icon={<ExclamationCircleOutlined />}
    message={`${drops.length} secret${drops.length === 1 ? '' : 's'} couldn't be decoded — will be omitted from the import`}
    description={
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        {drops.slice(0, 6).map((d) => (
          <li key={d.index} style={{ fontSize: 11 }}>
            <Tag>#{d.index}</Tag>
            <Text>{d.reason}</Text>
          </li>
        ))}
        {drops.length > 6 && (
          <li style={{ fontSize: 11 }}>
            <Text type="secondary">…and {drops.length - 6} more</Text>
          </li>
        )}
      </ul>
    }
  />
);

const DedupBanner: React.FC<{ dedup: DedupMatchesResult; onDismiss: () => void }> = ({ dedup, onDismiss }) => {
  if (dedup.exportIdSameTarget.length > 0) {
    const m = dedup.exportIdSameTarget[0];
    if (!m) return null;
    return (
      <Alert
        type="info"
        showIcon
        closable
        onClose={onDismiss}
        icon={<InfoCircleOutlined />}
        message={`You imported export ${m.exportId} here on ${new Date(m.importedAt).toLocaleDateString()}`}
        description="Re-importing it will apply your current per-entity strategy choices."
      />
    );
  }
  if (dedup.exportIdOtherTargets.length > 0) {
    const m = dedup.exportIdOtherTargets[0];
    if (!m) return null;
    return (
      <Alert
        type="info"
        showIcon
        closable
        onClose={onDismiss}
        message={`You also imported export ${m.exportId} into "${m.workspaceName}"`}
        description="That workspace is unaffected by this import."
      />
    );
  }
  if (dedup.workspaceUidMatches.length > 0) {
    const m = dedup.workspaceUidMatches[0];
    if (!m) return null;
    return (
      <Alert
        type="info"
        showIcon
        closable
        onClose={onDismiss}
        message={`A workspace from this source already exists ("${m.workspaceName}")`}
        description="Switch the target above to refresh it, or import as a new copy."
      />
    );
  }
  return null;
};

const MissingDepsPanel: React.FC<{ missingDeps: MissingDep[] }> = ({ missingDeps }) => (
  <Alert
    type="warning"
    showIcon
    icon={<ExclamationCircleOutlined />}
    message={`${missingDeps.length} unresolved reference${missingDeps.length === 1 ? '' : 's'}`}
    description={
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        {missingDeps.slice(0, 8).map((d) => (
          <li key={`${d.type}:${d.name}`} style={{ fontSize: 11 }}>
            <Tag>{d.type}</Tag>
            <Text>{d.name}</Text>
            <Text type="secondary"> · referenced by {d.referencedBy.length}</Text>
          </li>
        ))}
        {missingDeps.length > 8 && (
          <li style={{ fontSize: 11 }}>
            <Text type="secondary">…and {missingDeps.length - 8} more</Text>
          </li>
        )}
      </ul>
    }
  />
);

interface DiffTreeProps {
  diff: DiffResult;
  strategies: StrategyMap;
  onChangeStrategy: (kind: keyof StrategyMap, uid: string, value: CollisionStrategy) => void;
  token: ReturnType<typeof theme.useToken>['token'];
}

const DiffTree: React.FC<DiffTreeProps> = ({ diff, strategies, onChangeStrategy, token }) => {
  const sections: Array<{
    title: string;
    kind: keyof StrategyMap;
    entries: DiffEntry<{ uid: string; name: string }>[];
    renderExtra?: (e: DiffEntry<{ uid: string; name: string }>) => React.ReactNode;
  }> = [
    {
      title: 'Rules',
      kind: 'rules',
      entries: diff.rules as DiffEntry<{ uid: string; name: string }>[],
      renderExtra: (e) => <RuleSummary rule={e.entity as unknown as V5.Rule} />,
    },
    {
      title: 'Requests',
      kind: 'requests',
      entries: diff.requests as DiffEntry<{ uid: string; name: string }>[],
      renderExtra: (e) => <RequestSummary request={e.entity as unknown as V5.Request} />,
    },
    { title: 'Templates', kind: 'templates', entries: diff.templates as DiffEntry<{ uid: string; name: string }>[] },
    {
      title: 'Environments',
      kind: 'environments',
      entries: diff.environments as DiffEntry<{ uid: string; name: string }>[],
    },
    {
      title: 'Live workflows',
      kind: 'liveWorkflows',
      entries: diff.liveWorkflows as DiffEntry<{ uid: string; name: string }>[],
    },
    {
      title: 'Live variables',
      kind: 'liveVariables',
      entries: diff.liveVariables as DiffEntry<{ uid: string; name: string }>[],
    },
    {
      title: 'Collections',
      kind: 'collections',
      entries: diff.collections as DiffEntry<{ uid: string; name: string }>[],
    },
    { title: 'Folders', kind: 'folders', entries: diff.folders as DiffEntry<{ uid: string; name: string }>[] },
  ];

  const totalEntries = sections.reduce((acc, s) => acc + s.entries.length, 0);
  if (totalEntries === 0 && diff.workspaceVars.state === 'no-collision' && diff.vault.state === 'no-collision') {
    return <Empty description="Nothing to import" />;
  }

  return (
    <div
      style={{ border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 6, maxHeight: 320, overflowY: 'auto' }}
    >
      {sections.map(
        (section) =>
          section.entries.length > 0 && (
            <DiffSection
              key={section.kind}
              title={section.title}
              kind={section.kind}
              entries={section.entries}
              strategies={(strategies[section.kind] as Record<string, CollisionStrategy> | undefined) ?? {}}
              onChangeStrategy={onChangeStrategy}
              token={token}
              renderExtra={section.renderExtra}
            />
          ),
      )}
      {(diff.workspaceVars.state !== 'no-collision' || diff.vault.state !== 'no-collision') && (
        <SingletonsSection
          workspaceVars={diff.workspaceVars}
          vault={diff.vault}
          strategies={strategies}
          onChangeWorkspaceVars={(v) => {
            // singletons use PlanSingletonAction values within the StrategyMap.
            onChangeStrategyForSingleton('workspaceVars', v, onChangeStrategy);
          }}
          onChangeVault={(v) => onChangeStrategyForSingleton('vault', v, onChangeStrategy)}
          token={token}
        />
      )}
    </div>
  );
};

// Singleton update flows through the same strategy-map setter; the caller
// just needs to write under the singleton key. The `kind` cast is safe —
// `StrategyMap.workspaceVars` / `.vault` carry `PlanSingletonAction`,
// which is a subset of `CollisionStrategy`.
function onChangeStrategyForSingleton(
  key: 'workspaceVars' | 'vault',
  value: 'merge-by-name' | 'replace' | 'skip',
  onChangeStrategy: (kind: keyof StrategyMap, uid: string, value: CollisionStrategy) => void,
): void {
  onChangeStrategy(key, '__singleton__', value as CollisionStrategy);
}

const DiffSection: React.FC<{
  title: string;
  kind: keyof StrategyMap;
  entries: DiffEntry<{ uid: string; name: string }>[];
  strategies: Record<string, CollisionStrategy>;
  onChangeStrategy: (kind: keyof StrategyMap, uid: string, value: CollisionStrategy) => void;
  token: ReturnType<typeof theme.useToken>['token'];
  renderExtra?: (e: DiffEntry<{ uid: string; name: string }>) => React.ReactNode;
}> = ({ title, kind, entries, strategies, onChangeStrategy, token, renderExtra }) => (
  <div>
    <div
      style={{
        padding: '6px 10px',
        background: token.colorFillAlter,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.5,
        color: token.colorTextSecondary,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        position: 'sticky',
        top: 0,
        zIndex: 1,
      }}
    >
      {title.toUpperCase()} · {entries.length}
    </div>
    {entries.map((entry) => (
      <DiffRow
        key={entry.entity.uid}
        entry={entry}
        currentStrategy={strategies[entry.entity.uid] ?? entry.defaultStrategy}
        onChange={(s) => onChangeStrategy(kind, entry.entity.uid, s)}
        token={token}
        extra={renderExtra ? renderExtra(entry) : null}
      />
    ))}
  </div>
);

const DiffRow: React.FC<{
  entry: DiffEntry<{ uid: string; name: string }>;
  currentStrategy: CollisionStrategy;
  onChange: (s: CollisionStrategy) => void;
  token: ReturnType<typeof theme.useToken>['token'];
  extra?: React.ReactNode;
}> = ({ entry, currentStrategy, onChange, token, extra }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '6px 10px',
      borderBottom: `1px solid ${token.colorBorderSecondary}`,
      fontSize: 12,
    }}
  >
    <CollisionBadge state={entry.state} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <Text>{entry.entity.name}</Text>
        {entry.divergedFromExport && (
          <Tag color="orange" style={{ marginLeft: 6, fontSize: 10 }}>
            edited locally
          </Tag>
        )}
      </div>
      {extra}
    </div>
    <CollisionStrategyControl value={currentStrategy} allowed={entry.allowedStrategies} onChange={onChange} />
  </div>
);

const CollisionBadge: React.FC<{ state: 'no-collision' | 'collision-uid' | 'collision-name' }> = ({ state }) => {
  if (state === 'no-collision')
    return (
      <Tag color="green" style={{ fontSize: 10, minWidth: 56, textAlign: 'center' }}>
        new
      </Tag>
    );
  if (state === 'collision-uid')
    return (
      <Tag color="blue" style={{ fontSize: 10, minWidth: 56, textAlign: 'center' }}>
        update
      </Tag>
    );
  return (
    <Tag color="gold" style={{ fontSize: 10, minWidth: 56, textAlign: 'center' }}>
      conflict
    </Tag>
  );
};

const SingletonsSection: React.FC<{
  workspaceVars: DiffSingleton<V5.WorkspaceVariables>;
  vault: DiffSingleton<V5.Vault>;
  strategies: StrategyMap;
  onChangeWorkspaceVars: (v: 'merge-by-name' | 'replace' | 'skip') => void;
  onChangeVault: (v: 'merge-by-name' | 'replace' | 'skip') => void;
  token: ReturnType<typeof theme.useToken>['token'];
}> = ({ workspaceVars, vault, strategies, onChangeWorkspaceVars, onChangeVault, token }) => (
  <div>
    <div
      style={{
        padding: '6px 10px',
        background: token.colorFillAlter,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.5,
        color: token.colorTextSecondary,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      WORKSPACE-LEVEL · 2
    </div>
    {workspaceVars.state !== 'no-collision' && (
      <SingletonRow
        label="Workspace variables"
        diff={workspaceVars}
        currentStrategy={strategies.workspaceVars ?? workspaceVars.defaultStrategy}
        onChange={onChangeWorkspaceVars}
        token={token}
      />
    )}
    {vault.state !== 'no-collision' && (
      <SingletonRow
        label="Vault"
        diff={vault}
        currentStrategy={strategies.vault ?? vault.defaultStrategy}
        onChange={onChangeVault}
        token={token}
      />
    )}
  </div>
);

const SingletonRow: React.FC<{
  label: string;
  diff: DiffSingleton<unknown>;
  currentStrategy: CollisionStrategy;
  onChange: (v: 'merge-by-name' | 'replace' | 'skip') => void;
  token: ReturnType<typeof theme.useToken>['token'];
}> = ({ label, diff, currentStrategy, onChange, token }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '6px 10px',
      borderBottom: `1px solid ${token.colorBorderSecondary}`,
      fontSize: 12,
    }}
  >
    <CollisionBadge state={diff.state} />
    <Text style={{ flex: 1 }}>{label}</Text>
    <CollisionStrategyControl
      value={currentStrategy}
      allowed={diff.allowedStrategies}
      onChange={(v) => onChange(v as 'merge-by-name' | 'replace' | 'skip')}
    />
  </div>
);

const StripScriptsTopRow: React.FC<{
  source: ImportPreviewSource;
  stripScripts: boolean;
  onChange: (next: boolean) => void;
}> = ({ source, stripScripts, onChange }) => {
  const sourceLabel = source === 'link' ? 'deep-link' : source === 'playground' ? 'playground' : 'remote';
  return (
    <Alert
      type="warning"
      showIcon
      icon={<WarningOutlined />}
      message="Strip request scripts on import"
      description={
        <Space direction="vertical" size={4}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Pre-checked for {sourceLabel} sources — request `preRequestScript` and `postResponseScript` will be removed
            so untrusted JavaScript can't run when you click Send.
          </Text>
          <Checkbox checked={stripScripts} onChange={(e) => onChange(e.target.checked)}>
            <Text strong>Strip scripts on import</Text>
          </Checkbox>
        </Space>
      }
    />
  );
};

const AdvancedDisclosure: React.FC<{
  lowTrustSource: boolean;
  source: ImportPreviewSource;
  backupRestore: boolean;
  onBackupRestoreChange: (next: boolean) => void;
  trustExport: boolean;
  onTrustExportChange: (next: boolean) => void;
  stripScripts: boolean;
  onStripScriptsChange: (next: boolean) => void;
  omitOAuthConfigs: boolean;
  onOmitOAuthConfigsChange: (next: boolean) => void;
  keepTargetCollectionOrder: boolean;
  onKeepTargetCollectionOrderChange: (next: boolean) => void;
  includeWorkspaceSettings: boolean;
  onIncludeWorkspaceSettingsChange: (next: boolean) => void;
  refuseUidCollision: boolean;
  onRefuseUidCollisionChange: (next: boolean) => void;
  targetMode: ImportTargetSelection['mode'];
}> = ({
  lowTrustSource,
  source,
  backupRestore,
  onBackupRestoreChange,
  trustExport,
  onTrustExportChange,
  stripScripts,
  onStripScriptsChange,
  omitOAuthConfigs,
  onOmitOAuthConfigsChange,
  keepTargetCollectionOrder,
  onKeepTargetCollectionOrderChange,
  includeWorkspaceSettings,
  onIncludeWorkspaceSettingsChange,
  refuseUidCollision,
  onRefuseUidCollisionChange,
  targetMode,
}) => {
  const sourceLabel = source === 'link' ? 'deep-link' : 'URL-fetch';
  // Per design §5.5 discovery rules: hide override toggles entirely on
  // low-trust sources. The collapse ribbon stays visible but expands to
  // an explainer pointing the user at the safe path.
  if (lowTrustSource) {
    return (
      <Collapse
        size="small"
        items={[
          {
            key: 'advanced',
            label: 'Advanced',
            children: (
              <Alert
                type="info"
                showIcon
                icon={<InfoCircleOutlined />}
                message="Advanced overrides are hidden for low-trust sources"
                description={`Save the file locally and use "Import from file…" if you need to override the protective defaults for this ${sourceLabel} import.`}
              />
            ),
          },
        ]}
      />
    );
  }
  return (
    <Collapse
      size="small"
      items={[
        {
          key: 'advanced',
          label: 'Advanced',
          children: (
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Checkbox checked={backupRestore} onChange={(e) => onBackupRestoreChange(e.target.checked)}>
                <Text strong>This is mine — prefer update by uid</Text>
                <div style={{ fontSize: 11 }}>
                  <Text type="secondary">
                    Switches the default for uid-matched entities from "create new copy" to "update existing". Skipped
                    for entities edited locally since the export was made.
                  </Text>
                </div>
              </Checkbox>
              <Checkbox checked={trustExport} onChange={(e) => onTrustExportChange(e.target.checked)}>
                <Text strong>Trust this export — import enabled flags as-is</Text>
                <div style={{ fontSize: 11 }}>
                  <Text type="secondary">
                    Imported rules / live workflows / live variables land disabled by default. Enable this only when you
                    trust the sender — it lets the export turn things on the moment it lands.
                  </Text>
                </div>
              </Checkbox>
              <Checkbox checked={stripScripts} onChange={(e) => onStripScriptsChange(e.target.checked)}>
                <Text strong>Strip request scripts on import</Text>
                <div style={{ fontSize: 11 }}>
                  <Text type="secondary">
                    Removes pre-request and post-response scripts from every imported request. Recommended when the
                    sender is unfamiliar.
                  </Text>
                </div>
              </Checkbox>
              <Checkbox checked={omitOAuthConfigs} onChange={(e) => onOmitOAuthConfigsChange(e.target.checked)}>
                <Text strong>Omit OAuth configs</Text>
                <div style={{ fontSize: 11 }}>
                  <Text type="secondary">
                    By default, OAuth2 configs ride with the request (token endpoint, client id, scopes — never client
                    secret or tokens). With this on, every OAuth2 request lands with auth set to none — you wire it up
                    from scratch.
                  </Text>
                </div>
              </Checkbox>
              <Checkbox
                checked={keepTargetCollectionOrder}
                onChange={(e) => onKeepTargetCollectionOrderChange(e.target.checked)}
              >
                <Text strong>Keep target collection order on update</Text>
                <div style={{ fontSize: 11 }}>
                  <Text type="secondary">
                    By default, an updated collection takes the export's child order. With this on, your existing target
                    ordering is preserved when collisions update by uid.
                  </Text>
                </div>
              </Checkbox>
              <Checkbox
                checked={includeWorkspaceSettings}
                onChange={(e) => onIncludeWorkspaceSettingsChange(e.target.checked)}
                disabled
              >
                <Text strong>Include workspace-level settings</Text>
                <div style={{ fontSize: 11 }}>
                  <Text type="secondary">
                    Reserved for a future allowlist of workspace-semantic settings. The current allowlist is empty —
                    nothing ships through this toggle in v1.
                  </Text>
                </div>
              </Checkbox>
              {targetMode === 'new' && (
                <Checkbox checked={refuseUidCollision} onChange={(e) => onRefuseUidCollisionChange(e.target.checked)}>
                  <Text strong>Refuse on workspace.uid collision</Text>
                  <div style={{ fontSize: 11 }}>
                    <Text type="secondary">
                      By default, importing into a new workspace silently regenerates the workspace uid on collision.
                      With this on, an existing workspace with the same uid blocks the import — switch to "Pick
                      existing" to merge into it instead.
                    </Text>
                  </div>
                </Checkbox>
              )}
            </Space>
          ),
        },
      ]}
    />
  );
};

export default ImportPreviewModal;
