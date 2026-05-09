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

import { CloseOutlined, ExperimentOutlined, UploadOutlined } from '@ant-design/icons';
import { hashImportSource } from '@openheaders/core/import';
import type { V5 } from '@openheaders/core/types';
import {
  type CollisionStrategy,
  type DiffResult,
  decryptVaultBlock,
  type ImportDrop,
  type MissingDep,
  parseWorkspaceExport,
  type SerializableEntityKind,
  serializeEntityYaml,
  type StrategyMap,
  VaultDecryptionFailedError,
  VaultPayloadShapeError,
  type WorkspaceExport,
} from '@openheaders/core/workspace-export';
import { Alert, App as AntApp, Button, Empty, Modal, Space, Spin, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DedupMatchesResult } from '@/background/modules/workspace-import-dedup';
import { call } from '@/utils/bridge';
import {
  parseCollection,
  parseEnvironment,
  parseFolder,
  parseLiveVariable,
  parseLiveWorkflow,
  parseRequest,
  parseRule,
  parseTemplate,
  parseVault,
  parseWorkspaceVariables,
} from '@openheaders/core/codec/yaml';
import { useTheme } from '@context/ThemeContext';
import type { MergeApplyOutcome, MergeFile } from '@/shared/merge-editor';
import { MergeConflictModal } from '@/shared/merge-editor';
import { renderWorkspacePrefix } from '@/workbench/components/workspace-prefix';
import { buildImportStatusChips } from './preview/buildImportStatusChips';
import { applyMergeResultsToEnvelope, diffResultToImportBundle } from './preview/diff-to-import-bundle';
import ImportDiffWorkspace from './preview/ImportDiffWorkspace';
import RejectionBanner, { type ParseRejection } from './preview/RejectionBanner';
import StatusChips from './preview/StatusChips';
import StripScriptsTopRow from './preview/StripScriptsTopRow';
import TargetControl, { type ImportTargetSelection } from './preview/TargetControl';
import type { ImportPreviewSource } from './preview/types';
import { VaultDecryptedBanner, VaultEncryptedBlock, VaultPartialDecryptPanel } from './preview/VaultBlocks';

const { Text } = Typography;

/**
 * Compact "X rules, Y envs" summary used in the header + sidebar.
 * Same shape SourceAttribution renders, hoisted here so we can hand
 * it to whoever needs it (sidebar header, future post-import toast).
 */
function summarizeImportCounts(counts: WorkspaceExport['meta']['counts']): string {
  const parts: string[] = [];
  const push = (n: number, singular: string, plural: string): void => {
    if (n > 0) parts.push(`${n} ${n === 1 ? singular : plural}`);
  };
  push(counts.rules, 'rule', 'rules');
  push(counts.requests, 'request', 'requests');
  push(counts.environments, 'env', 'envs');
  push(counts.templates, 'template', 'templates');
  push(counts.liveWorkflows, 'workflow', 'workflows');
  push(counts.liveVariables, 'live var', 'live vars');
  push(counts.secrets, 'secret', 'secrets');
  return parts.join(', ');
}

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
  const { token } = theme.useToken();
  const { isDarkMode } = useTheme();

  // Phase 7.3 — flag-gated preview of the new merge-editor surface.
  // Flip in the DevTools console to opt in:
  //   localStorage.setItem('oh.workspace-import.merge-editor', '1')
  // Read once per mount; the button + stacked modal only appear when
  // the flag is on. No-commit: Apply just closes back to this preview.
  const mergeEditorPreviewEnabled = useState(() => {
    try {
      return globalThis.localStorage?.getItem('oh.workspace-import.merge-editor') === '1';
    } catch {
      return false;
    }
  })[0];
  const [mergePreviewOpen, setMergePreviewOpen] = useState(false);

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
  // Default to `current` unconditionally — the user is already in
  // their workspace and "import here" is the most common intent. The
  // segmented control still lets them flip to `new` / `picked` if
  // they want; we don't try to be clever about fallbacks because the
  // initial state-init can race with `activeWorkspaceId` resolution.
  const [target, setTarget] = useState<ImportTargetSelection>(() => initialTarget ?? { mode: 'current' });
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

  // ── Merge-editor surface (Phase 7.3.3a) ───────────────────────────
  // Per-codec parser dispatcher. Each non-singleton codec needs the
  // entity's `path` from the envelope; we look it up by uid across the
  // typed buckets. Throws on unknown uid / unknown entityType so the
  // merge editor surfaces the broken row inline.
  const deserializeMergeFile = useCallback(
    (text: string, file: MergeFile): unknown => {
      if (!effectiveEnvelope) throw new Error('No envelope available for path lookup.');
      const ent = effectiveEnvelope.entities;
      const findPath = (uid: string): string => {
        const lists: ReadonlyArray<{ uid: string; path?: string }>[] = [
          ent.collections,
          ent.folders,
          ent.rules,
          ent.requests,
          ent.templates,
          ent.environments,
          ent.liveWorkflows,
          ent.liveVariables,
        ];
        for (const list of lists) {
          const found = list.find((e) => e.uid === uid);
          if (found?.path) return found.path;
        }
        throw new Error(`Could not resolve path for uid ${uid}`);
      };
      switch (file.group) {
        case 'rule':
          return parseRule(text, { path: findPath(file.id) }).value;
        case 'request':
          return parseRequest(text, { path: findPath(file.id) }).value;
        case 'template':
          return parseTemplate(text, { path: findPath(file.id) }).value;
        case 'collection':
          return parseCollection(text, { path: findPath(file.id) }).value;
        case 'folder':
          return parseFolder(text, { path: findPath(file.id) }).value;
        case 'environment':
          return parseEnvironment({ default: text }).value;
        case 'liveWorkflow':
          return parseLiveWorkflow(text, { path: findPath(file.id) }).value;
        case 'liveVariable':
          return parseLiveVariable(text, { path: findPath(file.id) }).value;
        case 'workspaceVars':
          return parseWorkspaceVariables(text).value;
        case 'vault':
          return parseVault(text).value;
        default:
          throw new Error(`Unknown merge entity type: ${String(file.group)}`);
      }
    },
    [effectiveEnvelope],
  );

  // Bundle-wide commit through the merge editor: derive a fresh
  // envelope + StrategyMap from per-file results, re-run the SW
  // preview to detect concurrent edits, then submit through
  // `importWorkspace`. Mirrors `handleImport` but the merged envelope
  // carries the user's resolved entities instead of relying on a
  // strategy map alone.
  const handleMergeApply = useCallback(
    async (filesArg: readonly MergeFile[], results: Map<string, string>): Promise<MergeApplyOutcome[]> => {
      const failAll = (err: string): MergeApplyOutcome[] =>
        filesArg.map((f) => ({ fileId: f.id, ok: false, status: 'resolved' as const, error: err }));
      if (!effectiveEnvelope || !preview || !sourceHash) return failAll('Preview is not ready.');
      let mergedEnvelope: WorkspaceExport;
      let derivedStrategies: StrategyMap;
      try {
        const out = applyMergeResultsToEnvelope({
          envelope: effectiveEnvelope,
          files: filesArg,
          results,
          diff: preview.diff,
          deserialize: deserializeMergeFile,
        });
        mergedEnvelope = out.envelope;
        derivedStrategies = out.strategies;
      } catch (err) {
        return failAll(err instanceof Error ? err.message : String(err));
      }
      try {
        const fresh = await call('previewWorkspaceImport', {
          incoming: mergedEnvelope,
          target,
          backupRestore,
        });
        if (!fresh.success || !fresh.snapshotHash) return failAll(fresh.error ?? 'Preview re-check failed');
        if (fresh.snapshotHash !== preview.snapshotHash) {
          setStaleSnapshotHash(preview.snapshotHash);
          if (fresh.diff && fresh.missingDeps) {
            setPreview({
              diff: fresh.diff,
              missingDeps: fresh.missingDeps,
              snapshotHash: fresh.snapshotHash,
              targetWorkspaceId: fresh.targetWorkspaceId ?? null,
            });
          }
          return failAll('Workspace changed since preview opened. Re-confirm in the legacy preview and retry.');
        }
        const res = await call('importWorkspace', {
          incoming: mergedEnvelope,
          strategies: derivedStrategies,
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
          return failAll(res.error ?? 'Import failed');
        }
        // Success — close the merge modal and notify the parent.
        setMergePreviewOpen(false);
        onImported({
          targetWorkspaceId: res.targetWorkspaceId,
          importedCount: res.report.summary.imported,
          sourceLabel: mergedEnvelope.source.workspaceLabel ?? mergedEnvelope.workspace.name,
        });
        return filesArg.map((f) => ({ fileId: f.id, ok: true, status: 'resolved' as const }));
      } catch (err) {
        return failAll(err instanceof Error ? err.message : String(err));
      }
    },
    [
      effectiveEnvelope,
      preview,
      sourceHash,
      target,
      backupRestore,
      trustExport,
      stripScripts,
      omitOAuthConfigs,
      keepTargetCollectionOrder,
      refuseUidCollision,
      onImported,
      deserializeMergeFile,
    ],
  );

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

  // Status chips computed once and reused across header (right side,
  // next to the title) and the modal-empty / loading branches if those
  // ever need them. Hoisting them out of the body lets the diff
  // workspace claim the entire body height.
  const statusChips = parsed
    ? buildImportStatusChips({
        envelope: parsed.envelope,
        drops: parsed.drops,
        dedup,
        dedupDismissed,
        effectiveEnvelope,
        staleSnapshot: !!staleSnapshotHash,
        previewError,
        missingDeps: preview?.missingDeps ?? [],
        targetWorkspaceId: preview?.targetWorkspaceId ?? null,
        onDismissDedup: () => {
          const key = `${parsed.envelope.exportId}:${preview?.targetWorkspaceId ?? 'new'}`;
          setDedupDismissed((prev) => {
            const next = new Set(prev);
            next.add(key);
            try {
              window.sessionStorage.setItem('oh.workspace-export.dedup-dismissed', JSON.stringify(Array.from(next)));
            } catch {
              // sessionStorage can throw under privacy modes — dismissal stays for the modal lifetime
            }
            return next;
          });
        },
      })
    : [];

  // ── Card recipe ───────────────────────────────────────────────────
  // Mirrors the workspace shell's `.rules-dock-body` exactly: white
  // surface, 6 px border-radius, sitting inside a 3 px gutter of the
  // body's `colorBgLayout` gray. The work-area parent supplies that
  // gutter via `padding: 3`; adjacent cards in its flex column share a
  // 6 px `gap` (3 + 3 effective). Activity rails inside the diff card
  // get their outer corners clipped by the card's rounded edges —
  // same look the workspace shell ships.
  const cardStyle: React.CSSProperties = {
    background: token.colorBgContainer,
    borderRadius: 6,
    overflow: 'hidden',
  };

  // Strip-style row used for the custom header / secondary header /
  // footer. They share the modal body's gray bg — only the dock panels
  // (vault cards + diff workspace) paint white. The strips are
  // distinguished by their layout (3-column for the top header,
  // centered for the secondary header) rather than by surface colour.
  const stripStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    height: 44,
    padding: '0 12px',
    background: token.colorBgLayout,
    flexShrink: 0,
    gap: 12,
  };

  return (
    <Modal
      open={open}
      // Antd's built-in title/footer/close chrome is replaced by our
      // own strips below so the modal can mirror the workspace shell
      // (white topbar / gray work area / white status bar). We keep
      // antd Modal for the overlay, focus trap, mask, keyboard
      // handling, and centering — just not its visual chrome.
      title={null}
      footer={null}
      closable={false}
      onCancel={importing ? undefined : onCancel}
      width="95vw"
      centered
      destroyOnHidden
      styles={{
        // Zero modal-container padding (antd v6 renamed v5's `content`
        // slot to `container`): without this, the container's default
        // ~24 px gutter bleeds through even when body padding is zero,
        // leaving a visible white frame around the gray body. Zeroing
        // it lets our header/body/footer strips fill edge-to-edge.
        container: { padding: 0, overflow: 'hidden' },
        body: {
          height: '95vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          background: token.colorBgLayout,
        },
      }}
    >
      {/* Top header — workspace prefix icon + name on the left
          (replaces the generic "IMPORT WORKSPACE EXPORT" title with
          the actual import target so the user immediately sees what's
          coming in), status chips + close X on the right. The entity
          counts that used to live here have moved into the sidebar's
          own header (above the entity tree) — same pattern as a
          workspace's own sidebar. */}
      <div style={stripStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {parsed ? (
            <>
              {renderWorkspacePrefix(
                { icon: parsed.envelope.workspace.icon, color: parsed.envelope.workspace.color },
                token,
                { size: 20 },
              )}
              <Text strong style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {parsed.envelope.source.workspaceLabel ?? parsed.envelope.workspace.name}
              </Text>
            </>
          ) : (
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>IMPORT WORKSPACE EXPORT</span>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {statusChips.length > 0 && <StatusChips chips={statusChips} />}
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            onClick={importing ? undefined : onCancel}
            aria-label="Close import preview"
            disabled={importing}
          />
        </div>
      </div>

      {/* Secondary header — primary action (target picker) centered,
          rendered at `size="middle"` so it visually outranks the
          smaller controls inside the diff toolbar. Slightly taller than
          the topbar to read as the "main action" row. The TargetControl
          sits inside a white pill so its boundaries are obvious on the
          gray strip — without it, antd Segmented's own gray bg blends
          into the modal bg and the user can't see where the options
          end. */}
      {parsed && (
        <div style={{ ...stripStyle, height: 52, justifyContent: 'center' }}>
          <div
            style={{
              background: token.colorBgContainer,
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: 6,
              padding: '6px 12px',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            <TargetControl
              target={target}
              onChange={setTarget}
              workspaces={workspaces}
              activeWorkspaceId={activeWorkspaceId}
              envelope={parsed.envelope}
              size="middle"
            />
          </div>
        </div>
      )}

      {/* Middle area — flex column of cards on gray. The ONLY white
          surfaces in the modal live below this point: vault cards (when
          present) and the diff workspace card. `padding: 3` + flex
          `gap: 6` reproduces the workspace shell's `.rules-dock-body`
          margin pattern (3 px gutter to the modal edge, 6 px between
          adjacent cards). */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          padding: 3,
          overflow: 'hidden',
        }}
      >
        {parseRejection && (
          <div style={{ ...cardStyle, padding: 12 }}>
            <RejectionBanner rejection={parseRejection} />
          </div>
        )}

        {!parsed && !parseRejection && (
          <div style={{ ...cardStyle, padding: 24 }}>
            <Empty
              description={
                source === 'file'
                  ? 'Drop a .openheaders.yaml file to preview it.'
                  : source === 'link' || source === 'playground'
                    ? 'Resolving import link…'
                    : 'Paste a workspace export to preview it.'
              }
            />
          </div>
        )}

        {parsed && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              position: 'relative',
              flex: 1,
              minHeight: 0,
            }}
          >
            {/* Vault + strip-scripts card — rendered only when the
                envelope has secrets or the source is low-trust. The
                source attribution + target picker that used to live
                here have been hoisted into the modal's top header and
                secondary header strips. */}
            {(parsed.envelope.secrets || decryptedEnvelope || (preview && isLowTrustSource)) && (
              <div style={{ ...cardStyle, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
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

                {decryptedEnvelope && vaultPartialDrops.length > 0 && (
                  <VaultPartialDecryptPanel drops={vaultPartialDrops} />
                )}

                {preview && isLowTrustSource && (
                  <StripScriptsTopRow
                    source={source ?? 'link'}
                    stripScripts={stripScripts}
                    onChange={setStripScripts}
                  />
                )}
              </div>
            )}

            {previewing && !preview && (
              <div style={{ ...cardStyle, padding: 24, textAlign: 'center' }}>
                <Spin />
              </div>
            )}

            {preview && (
              // No outer card wrapper here — `ImportDiffWorkspace`
              // owns its own white rounded card around the Allotment,
              // with the activity rails living *outside* the card so
              // the rounded corners stay visible. Wrapping it in
              // another cardStyle would double-frame and re-hide the
              // rails behind the outer card edge.
              <div style={{ flex: 1, minHeight: 360, display: 'flex', flexDirection: 'column' }}>
                <ImportDiffWorkspace
                  diff={preview.diff}
                  summary={summarizeImportCounts(parsed.envelope.meta.counts)}
                  incomingEntities={{
                    workspaceVars: effectiveEnvelope?.entities.workspaceVars,
                    vault: effectiveEnvelope?.entities.vault,
                  }}
                  strategies={strategies}
                  onChangeStrategy={setStrategyFor}
                  advanced={{
                    activeCount:
                      (backupRestore ? 1 : 0) +
                      (trustExport ? 1 : 0) +
                      (stripScripts && !isLowTrustSource ? 1 : 0) +
                      (omitOAuthConfigs ? 1 : 0) +
                      (keepTargetCollectionOrder ? 1 : 0) +
                      (refuseUidCollision ? 1 : 0),
                    lowTrustSource: isLowTrustSource,
                    source: source ?? 'file',
                    backupRestore,
                    onBackupRestoreChange: setBackupRestore,
                    trustExport,
                    onTrustExportChange: setTrustExport,
                    stripScripts,
                    onStripScriptsChange: setStripScripts,
                    omitOAuthConfigs,
                    onOmitOAuthConfigsChange: setOmitOAuthConfigs,
                    keepTargetCollectionOrder,
                    onKeepTargetCollectionOrderChange: setKeepTargetCollectionOrder,
                    includeWorkspaceSettings,
                    onIncludeWorkspaceSettingsChange: setIncludeWorkspaceSettings,
                    refuseUidCollision,
                    onRefuseUidCollisionChange: setRefuseUidCollision,
                    targetMode: target.mode,
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer strip — same gray bg; layout (fixed-height row at the
          bottom of a flex column) is the visual cue, no border needed. */}
      <div style={{ ...stripStyle, justifyContent: 'space-between' }}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          {parsed
            ? `Export ${parsed.envelope.exportId} · ${parsed.envelope.scope}`
            : source === 'file'
              ? 'Pick a file to preview'
              : 'No data'}
        </Text>
        <Space>
          {mergeEditorPreviewEnabled && (
            <Button
              icon={<ExperimentOutlined />}
              onClick={() => setMergePreviewOpen(true)}
              disabled={!preview || importing}
            >
              Preview merge editor
            </Button>
          )}
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
      {mergeEditorPreviewEnabled && mergePreviewOpen && preview ? (
        <MergeConflictModal
          open
          isDarkMode={isDarkMode}
          surfaceId="workspace-import"
          onClose={() => setMergePreviewOpen(false)}
          headerSlot={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Vault decrypt prompt — when the envelope carries an
                  encrypted secrets block the user must unlock it
                  before importWorkspace will see the secrets. State
                  stays in ImportPreviewModal; this is just chrome. */}
              {parsed?.envelope.secrets && !decryptedEnvelope && (
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
              {decryptedEnvelope && vaultPartialDrops.length > 0 && (
                <VaultPartialDecryptPanel drops={vaultPartialDrops} />
              )}
              {/* Concurrent-edit warning — `handleMergeApply` sets
                  `staleSnapshotHash` when the SW preview re-check finds
                  newer data after the user opened the modal. */}
              {staleSnapshotHash !== null && (
                <Alert
                  type="warning"
                  showIcon
                  message="Workspace changed since this preview opened"
                  description="Reopen Import Preview to refresh the diff, then retry."
                />
              )}
            </div>
          }
          session={(() => {
            // Project the preview's typed diff into the generic
            // bundle/workspace shape, then hand-roll the session so
            // `onApply` runs the bundle-wide commit through
            // `importWorkspace` rather than the per-file `applyEntity`
            // shape `buildImportMergeSession` defaults to.
            const { bundle, workspace } = diffResultToImportBundle(preview.diff, effectiveEnvelope ?? undefined);
            const files: MergeFile[] = bundle.entities.map((incoming) => {
              const existing = workspace.findByPathOrUid(incoming);
              const incomingYaml = serializeEntityYaml(incoming.entityType as SerializableEntityKind, incoming.entity);
              if (existing === undefined) {
                return {
                  id: incoming.uid,
                  label: incoming.path,
                  language: 'yaml',
                  group: incoming.entityType,
                  kind: 'add' as const,
                  theirs: incomingYaml,
                  mine: '',
                  initialResult: incomingYaml,
                  badges: [{ label: 'added by import', tone: 'success' as const }],
                };
              }
              const existingYaml = serializeEntityYaml(incoming.entityType as SerializableEntityKind, existing);
              return {
                id: incoming.uid,
                label: incoming.path,
                language: 'yaml',
                group: incoming.entityType,
                kind: 'modify' as const,
                theirs: incomingYaml,
                mine: existingYaml,
                initialResult: existingYaml,
                badges: [{ label: 'collision', tone: 'warn' as const }],
              };
            });
            return {
              title: `Import — ${files.length} ${files.length === 1 ? 'item' : 'items'}`,
              files,
              onApply: handleMergeApply,
              onCancel: () => setMergePreviewOpen(false),
            };
          })()}
        />
      ) : null}
    </Modal>
  );
};

export default ImportPreviewModal;
