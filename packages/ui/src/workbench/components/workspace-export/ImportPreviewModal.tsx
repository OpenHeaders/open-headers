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

import { CloseOutlined } from '@ant-design/icons';
import { hashImportSource } from '@openheaders/core/import';
import type { ExtensionWorkspace } from '@openheaders/core/types';
import {
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
import { Alert, App as AntApp, Button, Drawer, Empty, Modal, Space, Spin, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DedupMatchesResult } from '@openheaders/core/types';
import { hostBridge } from '@openheaders/core/bridge';
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
import { useUiTheme } from '@openheaders/ui/context';
import type { MergeApplyOutcome, MergeFile } from '@openheaders/ui/shared/merge-editor';
import { MergeConflictModal } from '@openheaders/ui/shared/merge-editor';
import { renderWorkspacePrefix } from '../workspace/workspace-prefix';
import { buildImportStatusChips } from './preview/buildImportStatusChips';
import { AdvancedTogglesList } from './preview/AdvancedPanel';
import { applyMergeResultsToEnvelope, diffResultToImportBundle } from './preview/diff-to-import-bundle';
import RejectionBanner, { type ParseRejection } from './preview/RejectionBanner';
import StatusChips from './preview/StatusChips';
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
  workspaces: ExtensionWorkspace[];
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
  const { isDarkMode, monacoTheme } = useUiTheme();

  // Phase 7.3.5: merge editor is the import surface. The legacy
  // diff/strategy-chips body is gone; this modal now serves as the
  // parse-pipeline shell and auto-opens `<MergeConflictModal>` once
  // preview resolves.
  const [mergePreviewOpen, setMergePreviewOpen] = useState(false);
  // Drawer-hosted advanced toggles inside the merge modal — opens via
  // the modal's `footerLeading` button. Lives in this scope so the
  // toggles bind to the same state the legacy preview reads.
  const [mergeAdvancedOpen, setMergeAdvancedOpen] = useState(false);

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

  // Auto-open the merge editor as soon as preview resolves. The
  // parse-pipeline shell mounts behind it (so all chrome state stays
  // alive), but the merge modal IS the user-facing flow.
  useEffect(() => {
    if (!preview) return;
    setMergePreviewOpen((prev) => prev || true);
  }, [preview]);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [backupRestore, setBackupRestore] = useState(false);
  const [trustExport, setTrustExport] = useState(false);
  // Strip-scripts is an opt-in Advanced toggle; defaults off for the
  // local file/clipboard/menu sources this modal serves (design §5.5).
  const [stripScripts, setStripScripts] = useState(false);
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
  const [staleSnapshotHash, setStaleSnapshotHash] = useState<string | null>(null);
  // Per-uid YAML snapshots from the most recent import into the
  // resolved target. Promotes collisions to honest 3-pane in the merge
  // editor (snapshot = base; theirs = new incoming; mine = local
  // edits since last import). Empty when the target has never been
  // imported into.
  const [lastImportedSnapshots, setLastImportedSnapshots] = useState<Record<string, string>>({});
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
    setBackupRestore(false);
    setTrustExport(false);
    setStripScripts(false);
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
  }, [open, rawText, initialError]);

  // Reset on close so a second open starts clean.
  useEffect(() => {
    if (open) return;
    setParseRejection(null);
    setParsed(null);
    setPreview(null);
    setPreviewError(null);
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
    void hostBridge.call('previewWorkspaceImport', {
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

  // Fetch per-uid snapshots from the most recent import into the
  // resolved target. Re-runs whenever the target changes; no-op for
  // `target=new` (a fresh workspace has no prior imports). Failures
  // degrade silently to 2-pane diff per plan §7.
  useEffect(() => {
    const targetWsId = preview?.targetWorkspaceId;
    if (!targetWsId) {
      setLastImportedSnapshots({});
      return;
    }
    let cancelled = false;
    void hostBridge.call('getLastImportedSnapshots', { workspaceId: targetWsId })
      .then((res) => {
        if (cancelled) return;
        setLastImportedSnapshots(res.snapshots ?? {});
      })
      .catch(() => {
        if (cancelled) return;
        setLastImportedSnapshots({});
      });
    return () => {
      cancelled = true;
    };
  }, [preview?.targetWorkspaceId]);

  // ── Stage 3: dedup walker ─────────────────────────────────────────
  useEffect(() => {
    if (!parsed || !preview) {
      setDedup(null);
      return;
    }
    let cancelled = false;
    void hostBridge.call('findWorkspaceExportImportMatches', {
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
        const fresh = await hostBridge.call('previewWorkspaceImport', {
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
        const res = await hostBridge.call('importWorkspace', {
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
      onCancel={onCancel}
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
            onClick={onCancel}
            aria-label="Close import preview"
          />
        </div>
      </div>

      {/* Phase 7.3.5: legacy preview body retired. The merge editor
          (auto-opened in `useEffect` once `preview` resolves) is the
          actual import surface; everything else here is a brief
          loading shell that the merge modal stacks on top of. */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: 16,
        }}
      >
        {parseRejection ? (
          <div style={{ ...cardStyle, padding: 12, maxWidth: 600, width: '100%' }}>
            <RejectionBanner rejection={parseRejection} />
          </div>
        ) : !parsed ? (
          <Empty
            description={
              source === 'file'
                ? 'Drop a .openheaders.yaml file to preview it.'
                : 'Paste a workspace export to preview it.'
            }
          />
        ) : (
          <Spin size="large" tip="Preparing import…" />
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
        <Button onClick={onCancel}>Cancel</Button>
      </div>
      {mergePreviewOpen && preview ? (
        <MergeConflictModal
          open
          isDarkMode={isDarkMode}
          monacoTheme={monacoTheme}
          surfaceId="workspace-import"
          onClose={() => {
            // Closing the merge editor cancels the whole import (the
            // legacy preview body is no longer the user-facing flow
            // when the flag is on). The legacy modal closes via the
            // `onCancel` prop fed in by the caller.
            setMergePreviewOpen(false);
            onCancel();
          }}
          footerLeading={
            <Button key="advanced" onClick={() => setMergeAdvancedOpen(true)}>
              {(() => {
                const count =
                  (backupRestore ? 1 : 0) +
                  (trustExport ? 1 : 0) +
                  (stripScripts ? 1 : 0) +
                  (omitOAuthConfigs ? 1 : 0) +
                  (keepTargetCollectionOrder ? 1 : 0) +
                  (refuseUidCollision ? 1 : 0);
                return count > 0 ? `Advanced (${count})` : 'Advanced';
              })()}
            </Button>
          }
          headerSlot={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Target picker — choose the workspace to import into.
                  State stays in ImportPreviewModal; mirrors the legacy
                  topbar control. The next preview RPC reruns whenever
                  `target` changes (existing useEffect dependency). */}
              {parsed && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Import into:
                  </Text>
                  <TargetControl
                    target={target}
                    onChange={setTarget}
                    workspaces={workspaces}
                    activeWorkspaceId={activeWorkspaceId}
                    envelope={parsed.envelope}
                    size="middle"
                  />
                  {/* Status chips — soft-dedup signal, missing-deps,
                      preview errors. Same buildImportStatusChips()
                      result the legacy header already renders. */}
                  {statusChips.length > 0 && (
                    <div style={{ marginLeft: 'auto' }}>
                      <StatusChips chips={statusChips} />
                    </div>
                  )}
                </div>
              )}
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
              // 3-pane when we have a snapshot from a prior import —
              // the snapshot is what we last brought in, so it's the
              // honest common ancestor between `theirs` (new incoming)
              // and `mine` (local evolution since then).
              const snapshot = lastImportedSnapshots[incoming.uid];
              return {
                id: incoming.uid,
                label: incoming.path,
                language: 'yaml',
                group: incoming.entityType,
                kind: 'modify' as const,
                base: snapshot,
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
      {/* Advanced toggles drawer — opened from the merge modal's
          footerLeading button. zIndex=1200 keeps it above the merge
          modal (1100) so the user can flip toggles without leaving
          the merge editor. */}
      <Drawer
        open={mergeAdvancedOpen}
        onClose={() => setMergeAdvancedOpen(false)}
        title="Advanced"
        placement="right"
        width={360}
        zIndex={1200}
      >
        <AdvancedTogglesList
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
      </Drawer>
    </Modal>
  );
};

export default ImportPreviewModal;
