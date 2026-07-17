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
import { type ImportDrop, parseWorkspaceExport, type WorkspaceExport } from '@openheaders/core/workspace-export';
import { Alert, Button, Drawer, Empty, Modal, Spin, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DedupMatchesResult } from '@openheaders/core/types';
import { hostBridge } from '@openheaders/core/bridge';
import { useUiTheme } from '@openheaders/ui/context';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
import { MergeConflictModal } from '@openheaders/ui/shared/merge-editor';
import { trackProductTelemetryEvent } from '@openheaders/ui/shared/product-telemetry';
import { renderWorkspacePrefix } from '../workspace/workspace-prefix';
import { buildImportStatusChips } from './preview/buildImportStatusChips';
import { AdvancedTogglesList } from './preview/AdvancedPanel';
import RejectionBanner, { type ParseRejection } from './preview/RejectionBanner';
import StatusChips from './preview/StatusChips';
import TargetControl, { type ImportTargetSelection } from './preview/TargetControl';
import type { ImportPreviewSource, PreviewState } from './preview/types';
import { useImportMergeSession } from './preview/use-import-merge-session';
import { useVaultDecrypt } from './preview/use-vault-decrypt';
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

// PreviewState lives in ./preview/types — shared with the merge-session
// hook. ParseRejection lives in ./preview/RejectionBanner.

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
  const { isDarkMode, monacoTheme } = useUiTheme();
  const { t, locale } = useLocale();

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
  // Vault decryption state + handler — see `useVaultDecrypt` for the
  // passphrase / injection semantics.
  const vault = useVaultDecrypt(parsed?.envelope ?? null);
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
      trackProductTelemetryEvent({ name: 'error_beacon', code: 'import-parse-failed' });
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
      trackProductTelemetryEvent({ name: 'error_beacon', code: 'import-parse-failed' });
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
    vault.reset();
    void hashImportSource(rawText)
      .then(setSourceHash)
      .catch(() => setSourceHash(''));
  }, [open, rawText, initialError, vault.reset]);

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
    vault.reset();
  }, [open, vault.reset]);

  // The envelope used for preview + import. When the user has decrypted
  // the secrets block, swap in the decrypted envelope; otherwise the
  // parsed (encrypted) envelope is what we ship — the importer treats a
  // missing entities.vault as "no secrets to merge", which is what we
  // want for un-decrypted imports.
  const effectiveEnvelope: WorkspaceExport | null = vault.decryptedEnvelope ?? parsed?.envelope ?? null;

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
          setPreviewError(res.error ?? t('workbench.importExport.preview.previewFailed'));
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
  }, [effectiveEnvelope, target, backupRestore, t]);

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
  // Deserializer, bundle-wide commit and MergeFile projection live in
  // `useImportMergeSession`; state stays here, setters go in.
  const closeMergeModal = useCallback(() => setMergePreviewOpen(false), []);
  const handleImported = useCallback(
    (result: { targetWorkspaceId: string; importedCount: number; sourceLabel: string }) => {
      trackProductTelemetryEvent({ name: 'import_run', source: 'workspace', ok: true });
      onImported(result);
    },
    [onImported],
  );
  const { handleMergeApply, buildMergeFiles } = useImportMergeSession({
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
    lastImportedSnapshots,
    setPreview,
    setStaleSnapshotHash,
    closeMergeModal,
    onImported: handleImported,
  });

  // ── Render ────────────────────────────────────────────────────────

  // Status chips computed once and reused across header (right side,
  // next to the title) and the modal-empty / loading branches if those
  // ever need them. Hoisting them out of the body lets the diff
  // workspace claim the entire body height.
  const statusChips = parsed
    ? buildImportStatusChips({
        t,
        locale,
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
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>
              {t('workbench.importExport.preview.fallbackTitle')}
            </span>
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
            aria-label={t('workbench.importExport.preview.closeAria')}
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
                ? t('workbench.importExport.preview.emptyFile')
                : t('workbench.importExport.preview.emptyClipboard')
            }
          />
        ) : (
          <Spin size="large" tip={t('workbench.importExport.preview.preparing')} />
        )}
      </div>

      {/* Footer strip — same gray bg; layout (fixed-height row at the
          bottom of a flex column) is the visual cue, no border needed. */}
      <div style={{ ...stripStyle, justifyContent: 'space-between' }}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          {parsed
            ? t('workbench.importExport.preview.footerExportInfo', {
                id: parsed.envelope.exportId,
                scope: parsed.envelope.scope,
              })
            : source === 'file'
              ? t('workbench.importExport.preview.footerPickFile')
              : t('workbench.importExport.preview.footerNoData')}
        </Text>
        <Button onClick={onCancel}>{t('workbench.importExport.preview.cancel')}</Button>
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
                return count > 0
                  ? t('workbench.importExport.preview.advancedCount', { count })
                  : t('workbench.importExport.preview.advanced');
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
                    {t('workbench.importExport.preview.importInto')}
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
              {parsed?.envelope.secrets && !vault.decryptedEnvelope && (
                <VaultEncryptedBlock
                  envelope={parsed.envelope}
                  passphrase={vault.passphrase}
                  onChangePassphrase={vault.setPassphrase}
                  onDecrypt={() => void vault.decrypt()}
                  decrypting={vault.decrypting}
                  error={vault.decryptError}
                />
              )}
              {vault.decryptedEnvelope && vault.fingerprints && (
                <VaultDecryptedBanner
                  fingerprints={vault.fingerprints}
                  secretCount={vault.decryptedEnvelope.entities.vault?.secrets.length ?? 0}
                />
              )}
              {vault.decryptedEnvelope && vault.partialDrops.length > 0 && (
                <VaultPartialDecryptPanel drops={vault.partialDrops} />
              )}
              {/* Concurrent-edit warning — `handleMergeApply` sets
                  `staleSnapshotHash` when the SW preview re-check finds
                  newer data after the user opened the modal. */}
              {staleSnapshotHash !== null && (
                <Alert
                  type="warning"
                  showIcon
                  message={t('workbench.importExport.preview.staleTitle')}
                  description={t('workbench.importExport.preview.staleDescription')}
                />
              )}
            </div>
          }
          session={(() => {
            // Hand-rolled session so `onApply` runs the bundle-wide
            // commit through `importWorkspace` rather than the per-file
            // `applyEntity` shape `buildImportMergeSession` defaults to.
            const files = buildMergeFiles();
            return {
              title: t('workbench.importExport.preview.mergeTitle', { count: files.length }),
              files,
              onApply: handleMergeApply,
              onCancel: closeMergeModal,
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
        title={t('workbench.importExport.preview.advanced')}
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
