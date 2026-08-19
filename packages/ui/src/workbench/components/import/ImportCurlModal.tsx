/**
 * ImportCurlModal — paste a curl command, preview the parsed destination
 * request + any drops/transforms, pick a collection, import.
 *
 * The parser lives in `@openheaders/core/import` (platform-agnostic,
 * covered by 54 core tests). This modal is the thin UI layer:
 *   • Live-parse as the user types (no button round-trips — pasted
 *     curl commands are small and the parser is ~μs).
 *   • Show the resulting method/URL/headers/body summary so the user
 *     can audit BEFORE writing anything to storage.
 *   • Surface drops + transforms prominently — per ARCHITECTURE §23,
 *     every import is lossy and the report is the contract.
 *   • Target collection selector defaults to the workspace's first
 *     request collection. With no collections (or on demand via the
 *     "New collection" option) one is auto-created at import time,
 *     named after the request's hostname — the flow never blocks on
 *     collection setup.
 *
 * On import we:
 *   1. Compute the sourceHash (WebCrypto) — scaffold for the future
 *      re-import-diff flow.
 *   2. Create the target collection if the user picked the
 *      auto-create option.
 *   3. Call `createLocalRequest` with the parsed seed.
 *   4. Close the modal + open the new request in an editor tab.
 */

import { ImportOutlined, InfoCircleOutlined, WarningOutlined } from '@ant-design/icons';
import {
  CurlParseError,
  diffImportReports,
  hashImportSource,
  type ImportReport,
  type ImportReportDiff,
  parseCurl,
} from '@openheaders/core/import';
import type { Collection, Request } from '@openheaders/core/types';
import { trackProductTelemetryEvent } from '@openheaders/ui/shared/product-telemetry';
import { Alert, App as AntApp, Button, Input, type InputRef, Modal, Tag, Tooltip, Typography, theme } from 'antd';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { type CollectionPickerHandle, CollectionPickerPanel, NEW_COLLECTION_VALUE } from '../collection-picker';
import ReimportDiffPanel from './ReimportDiffPanel';
import { useImportShortcut } from './use-import-shortcut';

const { Text, Paragraph } = Typography;

interface ImportCurlModalProps {
  open: boolean;
  /** All request collections the user can pick as the import target. */
  collections: Collection[];
  /** Id of the collection that was in focus when the modal opened (preselect). */
  initialCollectionId?: string;
  /**
   * Pre-filled curl source — set when the import hub detected a pasted
   * curl command / URL and handed off to this modal. The live parser
   * runs on it immediately, so the modal opens on the confirm stage.
   */
  initialSource?: string;
  /**
   * What the hub actually detected — a curl command or a bare URL it
   * synthesized into one. Product telemetry's `import_run` keeps the
   * distinction; the modal behaves identically either way.
   */
  sourceKind?: 'curl' | 'url';
  onCancel: () => void;
  /** Called after a successful import. Payload includes the new uid
   *  and the name the user chose, so the caller can open the request
   *  editor tab with the correct label. */
  onImported: (result: {
    requestUid: string;
    name: string;
    method: string;
    collectionId: string;
    sourceHash: string;
    report: ImportReport;
  }) => void;
  /**
   * Creates the request in the target collection. Matches the
   * existing `createLocalRequest` bridge call signature.
   */
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
   * render a re-import-diff banner when the user pastes the same
   * curl command twice. `null` when there is no match. Errors from
   * the underlying RPC must be swallowed by the caller — the diff
   * is a nice-to-have enhancement, not a hard requirement.
   */
  findPreviousReport?: (sourceHash: string) => Promise<ImportReport | null>;
}

interface ParsedState {
  ok: true;
  request: ReturnType<typeof parseCurl>['request'];
  report: ImportReport;
}

interface ParseErrorState {
  ok: false;
  message: string;
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 0.4,
  display: 'block',
  marginBottom: 4,
};

const ImportCurlModal: React.FC<ImportCurlModalProps> = ({
  open,
  collections,
  initialCollectionId,
  initialSource,
  sourceKind = 'curl',
  onCancel,
  onImported,
  createRequest,
  createCollection,
  findPreviousReport,
}) => {
  const { token } = theme.useToken();
  const { message } = AntApp.useApp();
  const t = useT();
  const [source, setSource] = useState('');
  const [name, setName] = useState('');
  const [nameDirty, setNameDirty] = useState(false);
  const [targetCollectionId, setTargetCollectionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [diff, setDiff] = useState<ImportReportDiff | null>(null);
  const sourceInputRef = useRef<TextAreaRef>(null);
  const nameInputRef = useRef<InputRef>(null);
  const pickerRef = useRef<CollectionPickerHandle>(null);

  // Reset every time the modal OPENS so repeated imports start clean.
  // Guarded on the closed→open transition — store updates that change
  // the `collections` identity while the modal is up must not wipe
  // what the user is editing. With no collections in the workspace the
  // auto-create option is preselected — the user can import straight
  // away.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;
    if (!open || wasOpen) return;
    setSource(initialSource ?? '');
    setName('');
    setNameDirty(false);
    setTargetCollectionId(initialCollectionId ?? collections[0]?.uid ?? NEW_COLLECTION_VALUE);
    setBusy(false);
    setDiff(null);
  }, [open, initialCollectionId, initialSource, collections]);

  // Focus lands where typing starts: on a hub hand-off the source is
  // already parsed, so the NAME field; otherwise the paste area. Runs
  // from the Modal's afterOpenChange — a timeout would race the focus
  // trap (and the hub modal's close-time focus restore), leaving Enter
  // on the ✕ button.
  const handleAfterOpenChange = useCallback(
    (opened: boolean) => {
      if (!opened) return;
      if (initialSource) nameInputRef.current?.focus();
      else sourceInputRef.current?.focus();
    },
    [initialSource],
  );

  // Live parse. Empty input → no state (nothing to show). Parse
  // errors render as an Alert so the user knows what needs fixing.
  const parsed = useMemo<ParsedState | ParseErrorState | null>(() => {
    const trimmed = source.trim();
    if (trimmed.length === 0) return null;
    try {
      const { request, report } = parseCurl(trimmed);
      return { ok: true, request, report };
    } catch (err) {
      const msg = err instanceof CurlParseError ? err.message : t('workbench.importExport.curl.parseFallback');
      return { ok: false, message: msg };
    }
  }, [source, t]);

  // A hub hand-off that fails to parse is committed input, not mid-typing
  // churn — beacon it once per open. Live typing never fires: the source
  // must still be the untouched hand-off text.
  const handoffFailureNotedRef = useRef(false);
  useEffect(() => {
    if (!open) {
      handoffFailureNotedRef.current = false;
      return;
    }
    if (handoffFailureNotedRef.current || !initialSource) return;
    if (parsed?.ok !== false || source !== initialSource) return;
    handoffFailureNotedRef.current = true;
    trackProductTelemetryEvent({ name: 'error_beacon', code: 'import-parse-failed' });
  }, [open, initialSource, parsed, source]);

  // Suggested request name: the URL path alone — the collection
  // already carries the host (auto-created collections are named by
  // it), so `/v1/workspaces/ws_123/rules` reads better in the sidebar
  // than repeating the domain. Host-only URLs and unparseable
  // templates fall back to the parser's derived name.
  const suggestedName = useMemo(() => {
    if (!parsed?.ok) return '';
    try {
      const path = new URL(parsed.request.url).pathname;
      if (path && path !== '/') return path;
    } catch {
      // {{VAR}} templates and other non-URLs — use the parser's name
    }
    return parsed.request.name;
  }, [parsed]);

  // Auto-fill the request-name field until the user touches it
  // themselves. Keyed on the current value too, so a modal-state
  // reset that clears the field refills it instead of leaving the
  // placeholder behind.
  useEffect(() => {
    if (nameDirty) return;
    if (name !== suggestedName) setName(suggestedName);
  }, [name, suggestedName, nameDirty]);

  // Name for an auto-created collection: the request's hostname reads
  // naturally in the sidebar ("api.openheaders.com"); fall back to a
  // generic label when the URL isn't parseable.
  const newCollectionName = useMemo(() => {
    if (parsed?.ok) {
      try {
        const host = new URL(parsed.request.url).hostname;
        if (host) return host;
      } catch {
        // fall through to the generic label
      }
    }
    return 'Imported requests';
  }, [parsed]);

  // Re-import-diff lookup. Triggered when the parse succeeds; hashes
  // the source (WebCrypto, ~ms) and asks the caller for a prior
  // report. Debounced via cancellation so mid-paste churn doesn't
  // spam the RPC. Errors swallowed — the diff is best-effort.
  useEffect(() => {
    if (!parsed?.ok || !findPreviousReport) {
      setDiff(null);
      return;
    }
    const trimmed = source.trim();
    if (trimmed.length === 0) {
      setDiff(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const hash = await hashImportSource(trimmed);
        if (cancelled) return;
        const prev = await findPreviousReport(hash);
        if (cancelled) return;
        if (!prev) {
          setDiff(null);
          return;
        }
        // Synthesize a "next" report with the just-hashed value so
        // the diff sees both sides with matching identity.
        const next: ImportReport = { ...parsed.report, sourceHash: hash };
        const d = diffImportReports(prev, next);
        setDiff(d);
      } catch {
        if (!cancelled) setDiff(null);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [parsed, source, findPreviousReport]);

  const canImport = parsed?.ok === true && name.trim().length > 0 && targetCollectionId !== null && !busy;

  const handleImport = useCallback(async () => {
    if (!parsed?.ok || !targetCollectionId || !name.trim()) return;
    setBusy(true);
    try {
      let collectionUid = targetCollectionId;
      if (collectionUid === NEW_COLLECTION_VALUE) {
        const collection = await createCollection(newCollectionName);
        if (!collection) {
          message.error(t('workbench.importExport.import.failedCreateCollection'));
          trackProductTelemetryEvent({ name: 'import_run', source: sourceKind, ok: false });
          return;
        }
        collectionUid = collection.uid;
      }
      const hash = await hashImportSource(source.trim());
      const req = parsed.request;
      const seed: Partial<Request> = {
        method: req.method,
        url: req.url,
        headers: req.headers,
        params: req.params,
        auth: req.auth,
        body: req.body,
      };
      const created = await createRequest({
        name: name.trim(),
        collectionUid,
        seed,
      });
      if (!created) {
        message.error(t('workbench.importExport.curl.failedCreateRequest'));
        trackProductTelemetryEvent({ name: 'import_run', source: sourceKind, ok: false });
        return;
      }
      // Hydrate the report with the source hash (parser leaves it blank).
      const report: ImportReport = { ...parsed.report, sourceHash: hash };
      trackProductTelemetryEvent({ name: 'import_run', source: sourceKind, ok: true });
      onImported({
        requestUid: created.uid,
        name: name.trim(),
        method: req.method,
        collectionId: collectionUid,
        sourceHash: hash,
        report,
      });
      const importedLine = t('workbench.importExport.curl.importedName', { name: name.trim() });
      const summary =
        report.summary.dropped + report.summary.transformed === 0
          ? importedLine
          : `${importedLine} · ${t('workbench.importExport.import.transformsCount', { count: report.summary.transformed })}, ${t('workbench.importExport.import.dropsCount', { count: report.summary.dropped })}`;
      message.success(summary);
    } catch (err) {
      message.error(
        t('workbench.importExport.import.importFailed', {
          message: err instanceof Error ? err.message : String(err),
        }),
      );
      trackProductTelemetryEvent({ name: 'import_run', source: sourceKind, ok: false });
    } finally {
      setBusy(false);
    }
  }, [parsed, source, name, targetCollectionId, createRequest, createCollection, newCollectionName, onImported, message, sourceKind, t]);

  const confirmImport = useCallback(() => {
    if (canImport) void handleImport();
  }, [canImport, handleImport]);

  const saveLabel = useImportShortcut(open, canImport, confirmImport);

  const importTooltip = !parsed?.ok
    ? t('workbench.importExport.curl.tooltipPasteFirst')
    : !name.trim()
      ? t('workbench.importExport.curl.tooltipEnterName')
      : saveLabel
        ? t('workbench.importExport.import.importShortcutTooltip', { shortcut: saveLabel })
        : t('workbench.importExport.import.importCta');

  return (
    <Modal
      open={open}
      title={
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>
          {t('workbench.importExport.curl.title')}
        </span>
      }
      onCancel={onCancel}
      afterOpenChange={handleAfterOpenChange}
      footer={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
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
                  {t('workbench.importExport.import.importCta')}
                </Button>
              </span>
            </Tooltip>
          </div>
          {parsed?.ok && (
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
      width={620}
      destroyOnClose
    >
      <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 8 }}>
        {t('workbench.importExport.curl.introPrefix')} <code>curl</code> {t('workbench.importExport.curl.introSuffix')}
      </Paragraph>

      <Input.TextArea
        ref={sourceInputRef}
        value={source}
        onChange={(e) => setSource(e.target.value)}
        placeholder={t('workbench.importExport.curl.sourcePlaceholder')}
        style={{ fontFamily: 'var(--ant-font-family-code)', fontSize: 12, marginBottom: 10 }}
        autoSize={{ minRows: 4, maxRows: 8 }}
      />

      {parsed?.ok === false && (
        <Alert
          type="error"
          showIcon
          message={t('workbench.importExport.curl.cantParse')}
          description={parsed.message}
        />
      )}

      {parsed?.ok && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <Text style={labelStyle}>{t('workbench.importExport.curl.nameLabel')}</Text>
            <Input
              ref={nameInputRef}
              size="small"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameDirty(true);
              }}
              onPressEnter={confirmImport}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  pickerRef.current?.focusSearch();
                }
              }}
              placeholder={t('workbench.importExport.curl.namePlaceholder')}
              style={{ fontSize: 12 }}
            />
          </div>
          <div>
            <Text style={labelStyle}>{t('workbench.importExport.import.importTo')}</Text>
            <CollectionPickerPanel
              ref={pickerRef}
              collections={collections}
              value={targetCollectionId}
              onChange={setTargetCollectionId}
              newCollectionName={newCollectionName}
              listMaxHeight={160}
              listMinHeight={100}
              onConfirm={confirmImport}
            />
          </div>

          {diff?.hasChanges && <ReimportDiffPanel diff={diff} />}
          <ParsedPreview request={parsed.request} token={token} />
          <ReportPanel report={parsed.report} token={token} />
        </div>
      )}
    </Modal>
  );
};

// ── Preview panel ──────────────────────────────────────────────────

interface ParsedPreviewProps {
  request: ParsedState['request'];
  token: ReturnType<typeof theme.useToken>['token'];
}

const ParsedPreview: React.FC<ParsedPreviewProps> = ({ request, token }) => {
  const t = useT();
  const meta = [
    t('workbench.importExport.curl.headersCount', { count: request.headers.length }),
    t('workbench.importExport.curl.paramsCount', { count: request.params.length }),
    request.body.type === 'none'
      ? t('workbench.importExport.curl.noBody')
      : t('workbench.importExport.curl.bodyType', { type: request.body.type }),
    request.auth.type === 'none'
      ? t('workbench.importExport.curl.noAuth')
      : t('workbench.importExport.curl.authType', { type: request.auth.type }),
  ].join(' · ');
  return (
    <div
      style={{
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 6,
        padding: '8px 10px',
        background: token.colorFillAlter,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <Tag color="blue" style={{ fontWeight: 700, flexShrink: 0 }}>
          {request.method}
        </Tag>
        <span style={{ fontFamily: 'var(--ant-font-family-code)', fontSize: 12, wordBreak: 'break-all' }}>
          {request.url}
        </span>
      </div>
      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
        {meta}
      </Text>
    </div>
  );
};

// ── Drops + transforms panel ───────────────────────────────────────

interface ReportPanelProps {
  report: ImportReport;
  token: ReturnType<typeof theme.useToken>['token'];
}

const ReportPanel: React.FC<ReportPanelProps> = ({ report, token }) => {
  const translate = useT();
  if (report.drops.length === 0 && report.transforms.length === 0) {
    return null;
  }
  const lineStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 6,
    fontSize: 12,
  };
  return (
    <div
      style={{
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 6,
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      {report.transforms.map((t, i) => (
        <div key={`t-${i}`} style={lineStyle}>
          <InfoCircleOutlined style={{ color: token.colorPrimary, fontSize: 12, flexShrink: 0, position: 'relative', top: 1 }} />
          <span style={{ minWidth: 0 }}>
            <strong>{t.path}:</strong> <span style={{ color: token.colorTextSecondary }}>{t.from}</span> →{' '}
            <span style={{ color: token.colorPrimary }}>{t.to}</span>
            <span style={{ color: token.colorTextTertiary, fontSize: 11 }}> — {t.reason}</span>
          </span>
        </div>
      ))}
      {report.drops.map((d, i) => (
        <div key={`d-${i}`} style={lineStyle}>
          <WarningOutlined style={{ color: token.colorWarning, fontSize: 12, flexShrink: 0, position: 'relative', top: 1 }} />
          <span style={{ minWidth: 0 }}>
            <strong>{d.path}</strong> {translate('workbench.importExport.curl.droppedWord')}
            <span style={{ color: token.colorTextTertiary, fontSize: 11 }}>
              {' '}
              — {d.reason}
              {d.tracking ? ` (tracking: ${d.tracking})` : ''}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
};

export default ImportCurlModal;
