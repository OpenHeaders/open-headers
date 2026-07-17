/**
 * ImportHarModal — import a HAR file, preview + select entries,
 * write each selected entry as a request in the chosen collection.
 *
 * HAR differs from curl: a single file carries many requests, most of
 * which are noise (OCSP checks, favicon, analytics). The modal:
 *   1. Accepts a .har via file picker.
 *   2. Parses it via `@openheaders/core/import` (platform-agnostic,
 *      28 tests).
 *   3. Shows each entry with a checkbox + method/URL summary.
 *   4. Lets the user toggle-all / toggle-by-host / individual picks.
 *   5. Writes selected entries in order + records one combined report.
 *
 * Report semantics match the curl flow (ARCHITECTURE §23): drops +
 * transforms describe the SOURCE's lossiness, not the user's
 * selection. Selecting fewer entries reduces `summary.imported`.
 */

import { ImportOutlined, InfoCircleOutlined, UploadOutlined, WarningOutlined } from '@ant-design/icons';
import {
  diffImportReports,
  type HarParsedEntry,
  HarParseError,
  type HarParseResult,
  hashImportSource,
  type ImportReport,
  type ImportReportDiff,
  parseHar,
  selectHarEntries,
} from '@openheaders/core/import';
import type { Collection, Request } from '@openheaders/core/types';
import { trackProductTelemetryEvent } from '@openheaders/ui/shared/product-telemetry';
import { Alert, App as AntApp, Button, Checkbox, Input, Modal, Space, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import { type CollectionPickerHandle, CollectionPickerPanel, NEW_COLLECTION_VALUE } from '../collection-picker';
import ReimportDiffPanel from './ReimportDiffPanel';
import { useImportShortcut } from './use-import-shortcut';

const { Text, Paragraph } = Typography;

interface ImportHarModalProps {
  open: boolean;
  /** All request collections the user can pick as the import target. */
  collections: Collection[];
  /** Id of the collection in focus when the modal opened (preselect). */
  initialCollectionId?: string;
  /**
   * Pre-read HAR text — set when the import hub detected a pasted or
   * dropped HAR and handed off to this modal. Parsed on open, skipping
   * the file-picker stage.
   */
  initialText?: string;
  onCancel: () => void;
  /**
   * Called after a successful import run with the new request uids
   * plus the hydrated report. Caller typically closes the modal and
   * shows a summary toast.
   */
  onImported: (result: {
    requestUids: string[];
    collectionId: string;
    sourceHash: string;
    report: ImportReport;
  }) => void;
  /** Creates one request in the target collection. Sequential writes. */
  createRequest: (payload: {
    name: string;
    collectionUid: string;
    seed: Partial<Request>;
  }) => Promise<{ uid: string } | null>;
  /**
   * Creates a collection so the import never blocks on "no collections
   * yet". Auto-selected when the workspace has none; always offered as
   * the picker's pinned "New collection" row otherwise.
   */
  createCollection: (name: string) => Promise<{ uid: string } | null>;
  /**
   * Look up a prior import report by source hash so the modal can
   * render a re-import-diff banner when the same HAR is re-imported.
   * Same semantics as {@link ImportCurlModal}.
   */
  findPreviousReport?: (sourceHash: string) => Promise<ImportReport | null>;
}

type Stage =
  | { kind: 'empty' }
  | { kind: 'parsed'; source: string; result: HarParseResult; selection: Set<number> }
  | { kind: 'error'; message: string };

const MAX_ENTRIES_DISPLAY = 200;

/**
 * Parses HAR text into a stage. Default to all entries selected —
 * users who imported the file usually want everything; they narrow
 * from there. Committed input (picked file / hub hand-off) failing to
 * parse beacons `import-parse-failed` — mid-typing churn never lands
 * here.
 */
function parseHarText(text: string, t: Translate): Stage {
  try {
    const result = parseHar(text);
    const selection = new Set(result.entries.map((e) => e.index));
    return { kind: 'parsed', source: text, result, selection };
  } catch (err) {
    const msg =
      err instanceof HarParseError
        ? err.message
        : t('workbench.importExport.har.readFailed', { message: String(err) });
    trackProductTelemetryEvent({ name: 'error_beacon', code: 'import-parse-failed' });
    return { kind: 'error', message: msg };
  }
}

const ImportHarModal: React.FC<ImportHarModalProps> = ({
  open,
  collections,
  initialCollectionId,
  initialText,
  onCancel,
  onImported,
  createRequest,
  createCollection,
  findPreviousReport,
}) => {
  const { token } = theme.useToken();
  const { message } = AntApp.useApp();
  const t = useT();
  const [stage, setStage] = useState<Stage>({ kind: 'empty' });
  const [targetCollectionId, setTargetCollectionId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [diff, setDiff] = useState<ImportReportDiff | null>(null);
  const pickerRef = useRef<CollectionPickerHandle>(null);

  // Reset on OPEN so repeated imports start clean — guarded on the
  // closed→open transition so store updates that change `collections`
  // identity mid-import don't wipe the parsed stage or the user's
  // entry selection. Hub hand-offs arrive with the HAR text already
  // read — parse straight away so the modal opens on the entry
  // checklist instead of the file picker.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;
    if (!open || wasOpen) return;
    setStage(initialText ? parseHarText(initialText, t) : { kind: 'empty' });
    setTargetCollectionId(initialCollectionId ?? collections[0]?.uid ?? NEW_COLLECTION_VALUE);
    setFilter('');
    setBusy(false);
    setDiff(null);
  }, [open, initialCollectionId, initialText, collections, t]);

  // Keyboard flow starts at the picker's search — the HAR modal has no
  // name field, so that's where ↑↓/Enter/⌘S become live after parse.
  // Two triggers: the file-picker → parsed transition (modal already
  // open, no focus contention), and afterOpenChange for hub hand-offs
  // that open on the parsed stage — a timeout there would race the
  // Modal's focus trap and leave Enter on the ✕ button.
  useEffect(() => {
    if (open && stage.kind === 'parsed') pickerRef.current?.focusSearch();
  }, [open, stage.kind]);

  const handleAfterOpenChange = useCallback(
    (opened: boolean) => {
      if (opened && stage.kind === 'parsed') pickerRef.current?.focusSearch();
    },
    [stage.kind],
  );

  // Hash the parsed HAR text once per file choice and look up a prior
  // report. Unlike curl (which parses on every keystroke) HAR parses
  // once per file — so we can hash + diff synchronously after parse.
  useEffect(() => {
    if (stage.kind !== 'parsed' || !findPreviousReport) {
      setDiff(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const hash = await hashImportSource(stage.source);
        if (cancelled) return;
        const prev = await findPreviousReport(hash);
        if (cancelled) return;
        if (!prev) {
          setDiff(null);
          return;
        }
        const next: ImportReport = { ...stage.result.report, sourceHash: hash };
        setDiff(diffImportReports(prev, next));
      } catch {
        if (!cancelled) setDiff(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stage, findPreviousReport]);

  const handleFilePicked = useCallback(
    async (file: File) => {
      const text = await file.text().catch((err: Error) => err);
      if (text instanceof Error) {
        setStage({ kind: 'error', message: t('workbench.importExport.har.readFailed', { message: text.message }) });
        return;
      }
      setStage(parseHarText(text, t));
    },
    [t],
  );

  const toggleEntry = useCallback((index: number) => {
    setStage((prev) => {
      if (prev.kind !== 'parsed') return prev;
      const next = new Set(prev.selection);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return { ...prev, selection: next };
    });
  }, []);

  const setAllSelection = useCallback((enable: boolean) => {
    setStage((prev) => {
      if (prev.kind !== 'parsed') return prev;
      const next = enable ? new Set(prev.result.entries.map((e) => e.index)) : new Set<number>();
      return { ...prev, selection: next };
    });
  }, []);

  const filteredEntries = useMemo<HarParsedEntry[]>(() => {
    if (stage.kind !== 'parsed') return [];
    const needle = filter.trim().toLowerCase();
    if (!needle) return stage.result.entries;
    return stage.result.entries.filter((e) => {
      const r = e.request;
      return (
        r.url.toLowerCase().includes(needle) ||
        r.method.toLowerCase().includes(needle) ||
        r.name.toLowerCase().includes(needle)
      );
    });
  }, [stage, filter]);

  // Name for an auto-created collection: the most common hostname
  // across the parsed entries reads naturally in the sidebar; fall
  // back to a generic label when nothing parses.
  const newCollectionName = useMemo(() => {
    if (stage.kind !== 'parsed') return 'Imported requests';
    const counts = new Map<string, number>();
    for (const entry of stage.result.entries) {
      try {
        const host = new URL(entry.request.url).hostname;
        if (host) counts.set(host, (counts.get(host) ?? 0) + 1);
      } catch {
        // unparseable URL — skip
      }
    }
    let best: string | null = null;
    let bestCount = 0;
    for (const [host, count] of counts) {
      if (count > bestCount) {
        best = host;
        bestCount = count;
      }
    }
    return best ?? 'Imported requests';
  }, [stage]);

  const selectedCount = stage.kind === 'parsed' ? stage.selection.size : 0;
  const canImport = stage.kind === 'parsed' && selectedCount > 0 && targetCollectionId !== null && !busy;

  const handleImport = useCallback(async () => {
    if (stage.kind !== 'parsed' || !targetCollectionId || selectedCount === 0) return;
    setBusy(true);
    try {
      let collectionUid = targetCollectionId;
      if (collectionUid === NEW_COLLECTION_VALUE) {
        const collection = await createCollection(newCollectionName);
        if (!collection) {
          message.error(t('workbench.importExport.import.failedCreateCollection'));
          trackProductTelemetryEvent({ name: 'import_run', source: 'har', ok: false });
          return;
        }
        collectionUid = collection.uid;
      }
      const narrowed = selectHarEntries(stage.result, Array.from(stage.selection));
      const hash = await hashImportSource(stage.source);
      const requestUids: string[] = [];
      // Sequential writes — each request's create RPC round-trips the
      // SW. Parallelizing would race the same collection's version
      // counter needlessly for a feature users trigger by hand.
      for (const entry of narrowed.entries) {
        const seed: Partial<Request> = {
          method: entry.request.method,
          url: entry.request.url,
          headers: entry.request.headers,
          params: entry.request.params,
          auth: entry.request.auth,
          body: entry.request.body,
        };
        const created = await createRequest({
          name: entry.request.name,
          collectionUid,
          seed,
        });
        if (created) requestUids.push(created.uid);
      }
      const report: ImportReport = { ...narrowed.report, sourceHash: hash };
      trackProductTelemetryEvent({ name: 'import_run', source: 'har', ok: true });
      onImported({ requestUids, collectionId: collectionUid, sourceHash: hash, report });
      const summaryLine = t('workbench.importExport.import.importedRequests', { count: requestUids.length });
      message.success(
        report.summary.dropped + report.summary.transformed === 0
          ? summaryLine
          : `${summaryLine} · ${t('workbench.importExport.import.transformsCount', { count: report.summary.transformed })}, ${t('workbench.importExport.import.dropsCount', { count: report.summary.dropped })}`,
      );
    } catch (err) {
      message.error(
        t('workbench.importExport.import.importFailed', {
          message: err instanceof Error ? err.message : String(err),
        }),
      );
      trackProductTelemetryEvent({ name: 'import_run', source: 'har', ok: false });
    } finally {
      setBusy(false);
    }
  }, [stage, targetCollectionId, selectedCount, createRequest, createCollection, newCollectionName, onImported, message, t]);

  const confirmImport = useCallback(() => {
    if (canImport) void handleImport();
  }, [canImport, handleImport]);

  const saveLabel = useImportShortcut(open, canImport, confirmImport);

  const importTooltip =
    stage.kind !== 'parsed'
      ? t('workbench.importExport.har.tooltipChooseFile')
      : selectedCount === 0
        ? t('workbench.importExport.har.tooltipSelectEntry')
        : saveLabel
          ? t('workbench.importExport.import.importShortcutTooltip', { shortcut: saveLabel })
          : t('workbench.importExport.import.importCta');

  return (
    <Modal
      open={open}
      title={
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>
          {t('workbench.importExport.har.title')}
        </span>
      }
      onCancel={onCancel}
      afterOpenChange={handleAfterOpenChange}
      footer={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {stage.kind === 'parsed'
                ? t('workbench.importExport.har.footerSelected', {
                    selected: selectedCount,
                    total: stage.result.entries.length,
                  })
                : t('workbench.importExport.har.footerChooseFile')}
            </Text>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={onCancel} size="small" disabled={busy}>
                {t('workbench.importExport.import.cancel')}
              </Button>
              <Tooltip title={importTooltip}>
                <span>
                  <Button
                    type="primary"
                    size="small"
                    icon={<ImportOutlined />}
                    onClick={confirmImport}
                    disabled={!canImport}
                    loading={busy}
                    style={canImport ? { background: '#f5722d', borderColor: '#f5722d' } : undefined}
                  >
                    {selectedCount > 0
                      ? t('workbench.importExport.import.importCtaCount', { count: selectedCount })
                      : t('workbench.importExport.import.importCta')}
                  </Button>
                </span>
              </Tooltip>
            </div>
          </div>
          {stage.kind === 'parsed' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                fontSize: 10,
                color: token.colorTextTertiary,
                borderTop: `1px solid ${token.colorBorderSecondary}`,
                paddingTop: 6,
              }}
            >
              <span>↑↓ {t('workbench.importExport.import.hintNavigate')}</span>
              <span>↵ {t('workbench.importExport.import.hintSelect')}</span>
              {saveLabel && (
                <span>
                  {saveLabel} {t('workbench.importExport.import.hintImport')}
                </span>
              )}
              <span style={{ marginLeft: 'auto' }}>
                <kbd style={{ fontFamily: 'inherit' }}>esc</kbd> {t('workbench.importExport.import.hintClose')}
              </span>
            </div>
          )}
        </div>
      }
      width={760}
      destroyOnClose
    >
      <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 12 }}>
        {t('workbench.importExport.har.introPrefix')} <code>.har</code> {t('workbench.importExport.har.introSuffix')}
      </Paragraph>

      {stage.kind === 'empty' && <HarFilePicker onPick={handleFilePicked} token={token} />}

      {stage.kind === 'error' && (
        <>
          <Alert
            type="error"
            showIcon
            message={t('workbench.importExport.import.cantReadFile')}
            description={stage.message}
            style={{ marginBottom: 12 }}
          />
          <HarFilePicker onPick={handleFilePicked} token={token} />
        </>
      )}

      {stage.kind === 'parsed' && (
        <>
          <div style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
              {t('workbench.importExport.import.importTo')}
            </Text>
            <CollectionPickerPanel
              ref={pickerRef}
              collections={collections}
              value={targetCollectionId}
              onChange={setTargetCollectionId}
              newCollectionName={newCollectionName}
              listMaxHeight={140}
              listMinHeight={90}
              onConfirm={confirmImport}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <Input
              size="small"
              placeholder={t('workbench.importExport.har.filterPlaceholder')}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ flex: 1, fontSize: 12 }}
              allowClear
            />
            <Button size="small" onClick={() => setAllSelection(true)}>
              {t('workbench.importExport.har.selectAll')}
            </Button>
            <Button size="small" onClick={() => setAllSelection(false)}>
              {t('workbench.importExport.har.selectNone')}
            </Button>
          </div>

          {diff?.hasChanges && <ReimportDiffPanel diff={diff} />}

          <EntryList
            entries={filteredEntries}
            selection={stage.selection}
            onToggle={toggleEntry}
            token={token}
            totalCount={stage.result.entries.length}
          />

          <ReportPanel report={stage.result.report} token={token} />
        </>
      )}
    </Modal>
  );
};

// ── File picker ─────────────────────────────────────────────────────

interface HarFilePickerProps {
  onPick: (file: File) => Promise<void> | void;
  token: ReturnType<typeof theme.useToken>['token'];
}

const HarFilePicker: React.FC<HarFilePickerProps> = ({ onPick, token }) => {
  const t = useT();
  return (
    <label
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '36px 16px',
      gap: 8,
      border: `2px dashed ${token.colorBorder}`,
      borderRadius: 8,
      cursor: 'pointer',
      background: token.colorFillAlter,
    }}
    onDragOver={(e) => e.preventDefault()}
    onDrop={(e) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) void onPick(file);
    }}
  >
      <UploadOutlined style={{ fontSize: 24, color: token.colorTextSecondary }} />
      <Text style={{ fontSize: 13 }}>{t('workbench.importExport.har.dropTitle')}</Text>
      <Text type="secondary" style={{ fontSize: 11 }}>
        {t('workbench.importExport.har.dropHint')}
      </Text>
      <input
        type="file"
        accept=".har,application/json"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          if (file) void onPick(file);
        }}
        style={{ display: 'none' }}
      />
    </label>
  );
};

// ── Entry list ──────────────────────────────────────────────────────

interface EntryListProps {
  entries: HarParsedEntry[];
  selection: Set<number>;
  onToggle: (index: number) => void;
  token: ReturnType<typeof theme.useToken>['token'];
  totalCount: number;
}

const EntryList: React.FC<EntryListProps> = ({ entries, selection, onToggle, token, totalCount }) => {
  const t = useT();
  const truncated = entries.length > MAX_ENTRIES_DISPLAY;
  const shown = truncated ? entries.slice(0, MAX_ENTRIES_DISPLAY) : entries;

  if (totalCount === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Text type="secondary">{t('workbench.importExport.har.noImportableEntries')}</Text>
      </div>
    );
  }

  return (
    <div
      style={{
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 6,
        maxHeight: 280,
        overflowY: 'auto', overscrollBehavior: 'none',
        marginBottom: 12,
      }}
    >
      {entries.length === 0 && (
        <div style={{ padding: 16, textAlign: 'center' }}>
          <Text type="secondary">{t('workbench.importExport.har.noFilterMatch')}</Text>
        </div>
      )}
      {shown.map((entry) => (
        <div
          key={entry.index}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '6px 10px',
            fontSize: 12,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            cursor: 'pointer',
          }}
          onClick={() => onToggle(entry.index)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onToggle(entry.index);
            }
          }}
          role="button"
          tabIndex={0}
        >
          <Checkbox checked={selection.has(entry.index)} onChange={() => onToggle(entry.index)} />
          <Tag color="blue" style={{ fontWeight: 700, minWidth: 56, textAlign: 'center' }}>
            {entry.request.method}
          </Tag>
          <span
            style={{
              flex: 1,
              fontFamily: 'var(--ant-font-family-code)',
              color: token.colorText,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={entry.request.url}
          >
            {entry.request.url}
          </span>
          <Text type="secondary" style={{ fontSize: 10, minWidth: 50, textAlign: 'right' }}>
            {entry.request.auth.type !== 'none' && `${entry.request.auth.type}`}
          </Text>
        </div>
      ))}
      {truncated && (
        <div style={{ padding: '8px 10px', textAlign: 'center', background: token.colorFillAlter }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {t('workbench.importExport.har.showingFirst', { shown: MAX_ENTRIES_DISPLAY, total: totalCount })}
          </Text>
        </div>
      )}
    </div>
  );
};

// ── Report panel (drops + transforms) ──────────────────────────────

interface ReportPanelProps {
  report: ImportReport;
  token: ReturnType<typeof theme.useToken>['token'];
}

const ReportPanel: React.FC<ReportPanelProps> = ({ report, token }) => {
  const t = useT();
  const totalDrops = report.drops.length;
  const totalTransforms = report.transforms.length;
  if (totalDrops === 0 && totalTransforms === 0) return null;
  return (
    <Space direction="vertical" size={6} style={{ width: '100%' }}>
      {totalTransforms > 0 && (
        <Alert
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          message={t('workbench.importExport.har.transformsApplied', { count: totalTransforms })}
          description={
            <Tooltip title={t('workbench.importExport.har.transformsTooltip')}>
              <span style={{ fontSize: 11, color: token.colorTextSecondary, cursor: 'help' }}>
                {t('workbench.importExport.har.reportHover')}
              </span>
            </Tooltip>
          }
        />
      )}
      {totalDrops > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          message={t('workbench.importExport.har.dropsRecorded', { count: totalDrops })}
          description={
            <Tooltip title={t('workbench.importExport.har.dropsTooltip')}>
              <span style={{ fontSize: 11, color: token.colorTextSecondary, cursor: 'help' }}>
                {t('workbench.importExport.har.reportHover')}
              </span>
            </Tooltip>
          }
        />
      )}
    </Space>
  );
};

export default ImportHarModal;
