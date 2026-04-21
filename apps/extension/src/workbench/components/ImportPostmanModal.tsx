/**
 * ImportPostmanModal — import a Postman v2.1 collection JSON (and
 * optionally a companion environment JSON) into a new V5 Collection
 * + matching folder tree + optional V5 Environment.
 *
 * The modal is the thin UI layer over `parsePostman` /
 * `parsePostmanEnvironment` in `@openheaders/core/import`. It:
 *   • Reads both files via File API (drag-and-drop or click picker).
 *   • Renders a preview tree of folders + requests + variables so the
 *     user can audit BEFORE any writes land.
 *   • Surfaces drops + transforms via the shared `ReimportDiffPanel`
 *     when the same source was previously imported.
 *   • Writes everything sequentially through the SW's bridge (one
 *     collection → folders → requests → optional environment) so
 *     collection/folder versions advance deterministically and
 *     stale-draft protection stays correct.
 *
 * ARCHITECTURE.md §23 — re-import diff is handled identically to the
 * curl / HAR flows. Single `recordImportReport` per import run.
 */

import {
  DownloadOutlined,
  ExperimentOutlined,
  FolderOutlined,
  InfoCircleOutlined,
  UploadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  diffImportReports,
  hashImportSource,
  type ImportReport,
  type ImportReportDiff,
  type PostmanEnvironmentParseResult,
  PostmanParseError,
  type PostmanParseResult,
  parsePostman,
  parsePostmanEnvironment,
} from '@openheaders/core/import';
import type { V5 } from '@openheaders/core/types';
import { Alert, App as AntApp, Button, Divider, Input, Modal, Space, Tag, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import ReimportDiffPanel from './ReimportDiffPanel';

const { Text, Paragraph } = Typography;

interface ImportPostmanModalProps {
  open: boolean;
  onCancel: () => void;
  onImported: (result: {
    collectionUid: string;
    collectionName: string;
    requestsImported: number;
    environmentUid: string | null;
    report: ImportReport;
  }) => void;
  /** Creates a new request collection; returns the new uid + path. */
  createCollection: (name: string) => Promise<{ uid: string; path: string } | null>;
  /** Creates a folder under `parentPath`; returns the new folder's full path. */
  createFolder: (name: string, parentPath: string) => Promise<{ uid: string; path: string } | null>;
  /**
   * Creates a request under `parentPath`. We route through parentPath
   * directly (not collectionUid) so requests land inside the folder
   * tree we just built.
   */
  createRequest: (payload: {
    name: string;
    parentPath: string;
    seed: Partial<V5.Request>;
  }) => Promise<{ uid: string } | null>;
  /**
   * Creates a V5 Environment with the given name + variables.
   */
  createEnvironment: (payload: { name: string; variables: V5.Variable[] }) => Promise<{ uid: string } | null>;
  findPreviousReport?: (sourceHash: string) => Promise<ImportReport | null>;
}

type Stage =
  | { kind: 'empty' }
  | {
      kind: 'parsed';
      source: string;
      result: PostmanParseResult;
      envFile: { source: string; result: PostmanEnvironmentParseResult } | null;
    }
  | { kind: 'error'; message: string };

const ImportPostmanModal: React.FC<ImportPostmanModalProps> = ({
  open,
  onCancel,
  onImported,
  createCollection,
  createFolder,
  createRequest,
  createEnvironment,
  findPreviousReport,
}) => {
  const { token } = theme.useToken();
  const { message } = AntApp.useApp();
  const [stage, setStage] = useState<Stage>({ kind: 'empty' });
  const [collectionName, setCollectionName] = useState('');
  const [busy, setBusy] = useState(false);
  const [diff, setDiff] = useState<ImportReportDiff | null>(null);

  useEffect(() => {
    if (!open) return;
    setStage({ kind: 'empty' });
    setCollectionName('');
    setBusy(false);
    setDiff(null);
  }, [open]);

  // Re-import-diff lookup on every parse.
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

  const handleCollectionFilePicked = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const result = parsePostman(text);
      setStage({ kind: 'parsed', source: text, result, envFile: null });
      setCollectionName(result.collectionName);
    } catch (err) {
      const msg = err instanceof PostmanParseError ? err.message : `Failed to read file: ${String(err)}`;
      setStage({ kind: 'error', message: msg });
    }
  }, []);

  const handleEnvFilePicked = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const result = parsePostmanEnvironment(text);
        setStage((prev) => (prev.kind === 'parsed' ? { ...prev, envFile: { source: text, result } } : prev));
      } catch (err) {
        const msg = err instanceof PostmanParseError ? err.message : `Failed to read environment: ${String(err)}`;
        message.error(msg);
      }
    },
    [message],
  );

  const clearEnv = useCallback(() => {
    setStage((prev) => (prev.kind === 'parsed' ? { ...prev, envFile: null } : prev));
  }, []);

  const canImport = stage.kind === 'parsed' && collectionName.trim().length > 0 && !busy;

  const handleImport = useCallback(async () => {
    if (stage.kind !== 'parsed') return;
    const { result, source, envFile } = stage;
    setBusy(true);
    try {
      const sourceHash = await hashImportSource(source);
      // 1. Create the target collection.
      const coll = await createCollection(collectionName.trim());
      if (!coll) {
        message.error('Failed to create collection');
        setBusy(false);
        return;
      }

      // 2. Walk folders depth-first, record each folder's full path
      //    keyed by Postman path so requests can find their parent.
      const folderPathMap = new Map<string, string>();
      folderPathMap.set('', coll.path);
      // Sort folders by path depth so parents come first.
      const sortedFolders = [...result.folders].sort((a, b) => a.path.length - b.path.length);
      for (const f of sortedFolders) {
        const parentKey = f.path.slice(0, -1).join('/');
        const parentPath = folderPathMap.get(parentKey);
        if (!parentPath) continue; // should not happen after the sort
        const name = f.path[f.path.length - 1];
        if (!name) continue;
        const created = await createFolder(name, parentPath);
        if (created) {
          folderPathMap.set(f.path.join('/'), created.path);
        }
      }

      // 3. Create each request under its folder path.
      let requestsImported = 0;
      for (const { folderPath, request } of result.requests) {
        const key = folderPath.join('/');
        const parentPath = folderPathMap.get(key) ?? coll.path;
        const seed: Partial<V5.Request> = {
          method: request.method,
          url: request.url,
          headers: request.headers,
          params: request.params,
          auth: request.auth,
          body: request.body,
        };
        const created = await createRequest({
          name: request.name,
          parentPath,
          seed,
        });
        if (created) requestsImported += 1;
      }

      // 4. Optional environment.
      let environmentUid: string | null = null;
      if (envFile) {
        const variables: V5.Variable[] = envFile.result.variables.map((v) => ({
          name: v.name,
          value: v.value,
          type: v.type,
        }));
        const env = await createEnvironment({
          name: envFile.result.name,
          variables,
        });
        if (env) environmentUid = env.uid;
      }

      // 5. Hydrate the report with the hash so the next re-import can
      //    diff against it.
      const report: ImportReport = { ...result.report, sourceHash };

      onImported({
        collectionUid: coll.uid,
        collectionName: collectionName.trim(),
        requestsImported,
        environmentUid,
        report,
      });

      const summaryParts: string[] = [`Imported ${requestsImported} request${requestsImported === 1 ? '' : 's'}`];
      if (result.folders.length > 0) {
        summaryParts.push(`${result.folders.length} folder${result.folders.length === 1 ? '' : 's'}`);
      }
      if (environmentUid) summaryParts.push('1 environment');
      if (report.summary.dropped > 0) {
        summaryParts.push(`${report.summary.dropped} drop${report.summary.dropped === 1 ? '' : 's'}`);
      }
      message.success(summaryParts.join(' · '));
    } catch (err) {
      message.error(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }, [stage, collectionName, createCollection, createFolder, createRequest, createEnvironment, onImported, message]);

  return (
    <Modal
      open={open}
      title={<span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>IMPORT FROM POSTMAN</span>}
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
      width={760}
      destroyOnClose
    >
      <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 12 }}>
        Import a Postman Collection v2.1 JSON. Folder structure, collection variables, and per-request auth (basic /
        bearer / api-key) are preserved. Scripts, OAuth 2.0, AWS sigv4, and file uploads are tracked as drops until
        those features land in V5. Optionally attach a Postman environment file to land a matching V5 Environment.
      </Paragraph>

      {stage.kind === 'empty' && (
        <PostmanFilePicker onPick={handleCollectionFilePicked} token={token} target="collection" />
      )}

      {stage.kind === 'error' && (
        <>
          <Alert
            type="error"
            showIcon
            message="Couldn't read this file"
            description={stage.message}
            style={{ marginBottom: 12 }}
          />
          <PostmanFilePicker onPick={handleCollectionFilePicked} token={token} target="collection" />
        </>
      )}

      {stage.kind === 'parsed' && (
        <>
          <div style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>COLLECTION NAME</Text>
            <Input
              size="small"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              placeholder="Name for the new V5 Collection"
              style={{ fontSize: 12 }}
            />
          </div>

          {diff?.hasChanges && <ReimportDiffPanel diff={diff} />}

          <ParsedPreview result={stage.result} token={token} />

          <Divider style={{ margin: '12px 0' }} />

          <EnvironmentSlot envFile={stage.envFile} onPick={handleEnvFilePicked} onClear={clearEnv} token={token} />

          <ReportPanel report={stage.result.report} token={token} />
        </>
      )}
    </Modal>
  );
};

// ── File picker ────────────────────────────────────────────────────

interface PostmanFilePickerProps {
  onPick: (file: File) => Promise<void> | void;
  token: ReturnType<typeof theme.useToken>['token'];
  target: 'collection' | 'environment';
}

const PostmanFilePicker: React.FC<PostmanFilePickerProps> = ({ onPick, token, target }) => {
  const heading =
    target === 'collection'
      ? 'Drop a Postman Collection v2.1 JSON here, or click to pick one'
      : 'Drop a Postman Environment JSON here (optional)';
  const subtext =
    target === 'collection'
      ? 'Exported from Postman → Collection → ⋯ → Export (Collection v2.1)'
      : 'Exported from Postman → Environments → ⋯ → Export';
  return (
    <label
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: target === 'collection' ? '36px 16px' : '20px 16px',
        gap: 6,
        border: `2px dashed ${token.colorBorder}`,
        borderRadius: 8,
        cursor: 'pointer',
        background: token.colorFillAlter,
        marginBottom: 12,
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) void onPick(file);
      }}
    >
      <UploadOutlined style={{ fontSize: target === 'collection' ? 24 : 18, color: token.colorTextSecondary }} />
      <Text style={{ fontSize: target === 'collection' ? 13 : 12 }}>{heading}</Text>
      <Text type="secondary" style={{ fontSize: 11 }}>
        {subtext}
      </Text>
      <input
        type="file"
        accept=".json,application/json"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          if (file) void onPick(file);
        }}
        style={{ display: 'none' }}
      />
    </label>
  );
};

// ── Preview ────────────────────────────────────────────────────────

const ParsedPreview: React.FC<{
  result: PostmanParseResult;
  token: ReturnType<typeof theme.useToken>['token'];
}> = ({ result, token }) => {
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
        PARSED COLLECTION
      </Text>
      <Space size={6} wrap>
        <Tag>
          Requests: <strong>{result.requests.length}</strong>
        </Tag>
        <Tag icon={<FolderOutlined />}>
          Folders: <strong>{result.folders.length}</strong>
        </Tag>
        <Tag>
          Collection vars: <strong>{result.collectionVariables.length}</strong>
        </Tag>
      </Space>
      {result.folders.length > 0 && (
        <div style={{ marginTop: 8, maxHeight: 140, overflowY: 'auto' }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            Folder tree
          </Text>
          <ul style={{ margin: '2px 0 0', paddingLeft: 14, fontSize: 11, color: token.colorTextSecondary }}>
            {result.folders.map((f) => (
              <li key={f.path.join('/')}>{f.path.join(' / ')}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// ── Environment slot ───────────────────────────────────────────────

const EnvironmentSlot: React.FC<{
  envFile: { source: string; result: PostmanEnvironmentParseResult } | null;
  onPick: (file: File) => Promise<void> | void;
  onClear: () => void;
  token: ReturnType<typeof theme.useToken>['token'];
}> = ({ envFile, onPick, onClear, token }) => {
  if (!envFile) {
    return (
      <div style={{ marginBottom: 12 }}>
        <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
          OPTIONAL · ENVIRONMENT FILE
        </Text>
        <PostmanFilePicker onPick={onPick} token={token} target="environment" />
      </div>
    );
  }
  return (
    <div
      style={{
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 6,
        padding: 10,
        marginBottom: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space size={6}>
          <ExperimentOutlined />
          <Text strong style={{ fontSize: 12 }}>
            Environment: {envFile.result.name}
          </Text>
          <Tag>{envFile.result.variables.length} vars</Tag>
          {envFile.result.variables.some((v) => v.type === 'secret') && (
            <Tag color="gold">{envFile.result.variables.filter((v) => v.type === 'secret').length} secret</Tag>
          )}
        </Space>
        <Button size="small" type="link" onClick={onClear}>
          Remove
        </Button>
      </div>
      {envFile.result.report.drops.length > 0 && (
        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
          {envFile.result.report.drops.length} env variable
          {envFile.result.report.drops.length === 1 ? '' : 's'} dropped (disabled entries)
        </Text>
      )}
    </div>
  );
};

// ── Report panel (drops + transforms — non-diff flow) ─────────────

const ReportPanel: React.FC<{
  report: ImportReport;
  token: ReturnType<typeof theme.useToken>['token'];
}> = ({ report, token }) => {
  if (report.drops.length === 0 && report.transforms.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {report.transforms.length > 0 && (
        <Alert
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          message={`${report.transforms.length} transform${report.transforms.length === 1 ? '' : 's'}`}
          description={
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, maxHeight: 140, overflowY: 'auto' }}>
              {report.transforms.map((t, i) => (
                <li key={i}>
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
          message={`${report.drops.length} item${report.drops.length === 1 ? '' : 's'} dropped`}
          description={
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, maxHeight: 160, overflowY: 'auto' }}>
              {report.drops.map((d, i) => (
                <li key={i}>
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

export default ImportPostmanModal;
