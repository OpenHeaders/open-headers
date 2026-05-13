/**
 * ImportCurlModal — paste a curl command, preview the parsed V5
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
 *     request collection (or creates the default one).
 *
 * On import we:
 *   1. Compute the sourceHash (WebCrypto) — scaffold for the future
 *      re-import-diff flow.
 *   2. Call `createLocalRequest` with the parsed seed.
 *   3. Persist the report (v1: wired in a follow-up; the report is
 *      returned so the caller can show a toast summary).
 *   4. Close the modal + open the new request in an editor tab.
 */

import { DownloadOutlined, InfoCircleOutlined, WarningOutlined } from '@ant-design/icons';
import {
  CurlParseError,
  diffImportReports,
  hashImportSource,
  type ImportReport,
  type ImportReportDiff,
  parseCurl,
} from '@openheaders/core/import';
import type { Collection, Request } from '@openheaders/core/types';
import { Alert, App as AntApp, Button, Input, Modal, Select, Space, Tag, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import ReimportDiffPanel from './ReimportDiffPanel';

const { Text, Paragraph } = Typography;

interface ImportCurlModalProps {
  open: boolean;
  /** All request collections the user can pick as the import target. */
  collections: Collection[];
  /** Id of the collection that was in focus when the modal opened (preselect). */
  initialCollectionId?: string;
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

const ImportCurlModal: React.FC<ImportCurlModalProps> = ({
  open,
  collections,
  initialCollectionId,
  onCancel,
  onImported,
  createRequest,
  findPreviousReport,
}) => {
  const { token } = theme.useToken();
  const { message } = AntApp.useApp();
  const [source, setSource] = useState('');
  const [name, setName] = useState('');
  const [nameDirty, setNameDirty] = useState(false);
  const [targetCollectionId, setTargetCollectionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [diff, setDiff] = useState<ImportReportDiff | null>(null);

  // Reset every time the modal opens so repeated imports start clean.
  useEffect(() => {
    if (!open) return;
    setSource('');
    setName('');
    setNameDirty(false);
    setTargetCollectionId(initialCollectionId ?? collections[0]?.uid ?? null);
    setBusy(false);
    setDiff(null);
  }, [open, initialCollectionId, collections]);

  // Live parse. Empty input → no state (nothing to show). Parse
  // errors render as an Alert so the user knows what needs fixing.
  const parsed = useMemo<ParsedState | ParseErrorState | null>(() => {
    const trimmed = source.trim();
    if (trimmed.length === 0) return null;
    try {
      const { request, report } = parseCurl(trimmed);
      return { ok: true, request, report };
    } catch (err) {
      const msg = err instanceof CurlParseError ? err.message : 'Could not parse — check the command and try again.';
      return { ok: false, message: msg };
    }
  }, [source]);

  // Auto-fill the request-name field from the parser until the user
  // touches it themselves. Keeps pastes ergonomic without fighting
  // explicit edits.
  useEffect(() => {
    if (nameDirty) return;
    if (parsed?.ok) setName(parsed.request.name);
    else if (parsed === null) setName('');
  }, [parsed, nameDirty]);

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
        collectionUid: targetCollectionId,
        seed,
      });
      if (!created) {
        message.error('Failed to create request');
        return;
      }
      // Hydrate the report with the source hash (parser leaves it blank).
      const report: ImportReport = { ...parsed.report, sourceHash: hash };
      onImported({
        requestUid: created.uid,
        name: name.trim(),
        method: req.method,
        collectionId: targetCollectionId,
        sourceHash: hash,
        report,
      });
      const summary =
        report.summary.dropped + report.summary.transformed === 0
          ? `Imported "${name.trim()}"`
          : `Imported "${name.trim()}" · ${report.summary.transformed} transform${report.summary.transformed === 1 ? '' : 's'}, ${report.summary.dropped} drop${report.summary.dropped === 1 ? '' : 's'}`;
      message.success(summary);
    } catch (err) {
      message.error(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }, [parsed, source, name, targetCollectionId, createRequest, onImported, message]);

  return (
    <Modal
      open={open}
      title={<span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>IMPORT FROM CURL</span>}
      onCancel={onCancel}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onCancel} size="small" disabled={busy}>
            Cancel
          </Button>
          <Button
            type="primary"
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => void handleImport()}
            disabled={!canImport}
            loading={busy}
          >
            Import
          </Button>
        </div>
      }
      width={640}
      destroyOnClose
    >
      <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 12 }}>
        Paste a <code>curl</code> command — typically copied from browser DevTools ("Copy as cURL") or API docs.
        Unsupported flags are listed below; auth headers are promoted to first-class auth types.
      </Paragraph>

      <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>CURL COMMAND</Text>
      <Input.TextArea
        value={source}
        onChange={(e) => setSource(e.target.value)}
        placeholder={`curl -X POST 'https://api.openheaders.io/v1/things' \\
  -H 'authorization: Bearer xyz' \\
  -H 'content-type: application/json' \\
  --data-raw '{"name":"hello"}'`}
        rows={8}
        style={{ fontFamily: 'var(--ant-font-family-code)', fontSize: 12, marginBottom: 12 }}
        autoSize={{ minRows: 6, maxRows: 14 }}
      />

      {parsed?.ok === false && (
        <Alert
          type="error"
          showIcon
          message="Couldn't parse this command"
          description={parsed.message}
          style={{ marginBottom: 12 }}
        />
      )}

      {parsed?.ok && (
        <>
          <div style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>REQUEST NAME</Text>
            <Input
              size="small"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameDirty(true);
              }}
              placeholder="How this request appears in the sidebar"
              style={{ fontSize: 12 }}
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>TARGET COLLECTION</Text>
            <Select
              value={targetCollectionId ?? undefined}
              onChange={(id) => setTargetCollectionId(id)}
              size="small"
              style={{ width: '100%' }}
              options={collections.map((c) => ({ label: c.name, value: c.uid }))}
              placeholder={collections.length === 0 ? 'No collections yet — create one first' : 'Select a collection'}
              disabled={collections.length === 0}
            />
          </div>

          {diff?.hasChanges && <ReimportDiffPanel diff={diff} />}
          <ParsedPreview request={parsed.request} token={token} />
          <ReportPanel report={parsed.report} token={token} />
        </>
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
  const headerCount = request.headers.length;
  const paramCount = request.params.length;
  return (
    <div
      style={{
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 6,
        padding: 10,
        marginBottom: 12,
        background: token.colorFillAlter,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>
        PARSED REQUEST
      </Text>
      <Space size={6} wrap>
        <Tag color="blue" style={{ fontWeight: 700 }}>
          {request.method}
        </Tag>
        <span style={{ fontFamily: 'var(--ant-font-family-code)', fontSize: 12, wordBreak: 'break-all' }}>
          {request.url}
        </span>
      </Space>
      <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Tag>
          Headers: <strong>{headerCount}</strong>
        </Tag>
        <Tag>
          Query params: <strong>{paramCount}</strong>
        </Tag>
        <Tag>
          Body: <strong>{request.body.type}</strong>
        </Tag>
        <Tag>
          Auth: <strong>{request.auth.type}</strong>
        </Tag>
      </div>
    </div>
  );
};

// ── Drops + transforms panel ───────────────────────────────────────

interface ReportPanelProps {
  report: ImportReport;
  token: ReturnType<typeof theme.useToken>['token'];
}

const ReportPanel: React.FC<ReportPanelProps> = ({ report, token }) => {
  if (report.drops.length === 0 && report.transforms.length === 0) {
    return null;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {report.transforms.length > 0 && (
        <Alert
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          message={`${report.transforms.length} transform${report.transforms.length === 1 ? '' : 's'}`}
          description={
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
              {report.transforms.map((t, i) => (
                <li key={i} style={{ marginBottom: 2 }}>
                  <strong>{t.path}:</strong> <span style={{ color: token.colorTextSecondary }}>{t.from}</span> →{' '}
                  <span style={{ color: token.colorPrimary }}>{t.to}</span>
                  <div style={{ color: token.colorTextTertiary, fontSize: 11 }}>{t.reason}</div>
                </li>
              ))}
            </ul>
          }
        />
      )}
      {report.drops.length > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          message={`${report.drops.length} flag${report.drops.length === 1 ? '' : 's'} dropped`}
          description={
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
              {report.drops.map((d, i) => (
                <li key={i} style={{ marginBottom: 2 }}>
                  <strong>{d.path}:</strong> {d.reason}
                  {d.tracking && (
                    <div style={{ color: token.colorTextTertiary, fontSize: 11 }}>tracking: {d.tracking}</div>
                  )}
                </li>
              ))}
            </ul>
          }
        />
      )}
    </div>
  );
};

export default ImportCurlModal;
