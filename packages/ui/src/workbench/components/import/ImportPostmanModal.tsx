/**
 * ImportPostmanModal — import a Postman v2.1 collection JSON (and
 * optionally a companion environment JSON) into a new Collection
 * + matching folder tree + optional Environment.
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

import { ExperimentOutlined, FolderOutlined, ImportOutlined, UploadOutlined } from '@ant-design/icons';
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
import type { AuthConfig, Request, Variable } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { trackProductTelemetryEvent } from '@openheaders/ui/shared/product-telemetry';
import { Alert, App as AntApp, Button, Divider, Input, type InputRef, Modal, Space, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import ImportReportPanel from './ImportReportPanel';
import ReimportDiffPanel from './ReimportDiffPanel';
import { useImportShortcut } from './use-import-shortcut';

const { Text, Paragraph } = Typography;

interface ImportPostmanModalProps {
  open: boolean;
  /**
   * Pre-read collection JSON — set when the import hub detected a
   * pasted or dropped Postman export and handed off to this modal.
   * Parsed on open, skipping the file-picker stage.
   */
  initialText?: string;
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
  /** Lands collection-level scripts on the new collection's slots. */
  setCollectionScripts?: (
    collectionUid: string,
    scripts: { preRequestScript?: string; postResponseScript?: string },
  ) => Promise<boolean>;
  /** Lands folder-level scripts on a new folder's slots. */
  setFolderScripts?: (
    folderUid: string,
    scripts: { preRequestScript?: string; postResponseScript?: string },
  ) => Promise<boolean>;
  /** Lands collection-level default auth on the new collection. */
  setCollectionAuth?: (collectionUid: string, auth: AuthConfig) => Promise<boolean>;
  /** Lands folder-level default auth on a new folder. */
  setFolderAuth?: (folderUid: string, auth: AuthConfig) => Promise<boolean>;
  /**
   * Creates a request under `parentPath`. We route through parentPath
   * directly (not collectionUid) so requests land inside the folder
   * tree we just built.
   */
  createRequest: (payload: {
    name: string;
    parentPath: string;
    seed: Partial<Request>;
  }) => Promise<{ uid: string } | null>;
  /**
   * Creates a Environment with the given name + variables.
   */
  createEnvironment: (payload: { name: string; variables: Variable[] }) => Promise<{ uid: string } | null>;
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

// Committed input only lands here (picked file / hub hand-off), so a
// parse failure beacons `import-parse-failed`.
function parseCollectionText(text: string, t: Translate): Stage {
  try {
    const result = parsePostman(text);
    return { kind: 'parsed', source: text, result, envFile: null };
  } catch (err) {
    const msg =
      err instanceof PostmanParseError
        ? err.message
        : t('workbench.importExport.postman.readFileFailed', { message: String(err) });
    trackProductTelemetryEvent({ name: 'error_beacon', code: 'import-parse-failed' });
    return { kind: 'error', message: msg };
  }
}

const ImportPostmanModal: React.FC<ImportPostmanModalProps> = ({
  open,
  initialText,
  onCancel,
  onImported,
  createCollection,
  createFolder,
  setCollectionScripts,
  setFolderScripts,
  setCollectionAuth,
  setFolderAuth,
  createRequest,
  createEnvironment,
  findPreviousReport,
}) => {
  const { token } = theme.useToken();
  const { message } = AntApp.useApp();
  const t = useT();
  const [stage, setStage] = useState<Stage>({ kind: 'empty' });
  const [collectionName, setCollectionName] = useState('');
  const [busy, setBusy] = useState(false);
  const [diff, setDiff] = useState<ImportReportDiff | null>(null);
  const nameInputRef = useRef<InputRef>(null);

  // Reset on open. Hub hand-offs arrive with the collection JSON
  // already read — parse straight away so the modal opens on the
  // preview tree instead of the file picker.
  useEffect(() => {
    if (!open) return;
    const stage = initialText ? parseCollectionText(initialText, t) : ({ kind: 'empty' } as const);
    setStage(stage);
    setCollectionName(stage.kind === 'parsed' ? stage.result.collectionName : '');
    setBusy(false);
    setDiff(null);
  }, [open, initialText, t]);

  // Keyboard flow starts at the collection-name field once parsed —
  // Enter there (or ⌘S anywhere) runs the import. Two triggers: the
  // file-picker → parsed transition, and afterOpenChange for hub
  // hand-offs that open on the parsed stage — a timeout there would
  // race the Modal's focus trap and leave Enter on the ✕ button.
  useEffect(() => {
    if (open && stage.kind === 'parsed') nameInputRef.current?.focus();
  }, [open, stage.kind]);

  const handleAfterOpenChange = useCallback(
    (opened: boolean) => {
      if (opened && stage.kind === 'parsed') nameInputRef.current?.focus();
    },
    [stage.kind],
  );

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

  const handleCollectionFilePicked = useCallback(
    async (file: File) => {
      const text = await file.text().catch((err: Error) => err);
      if (text instanceof Error) {
        setStage({
          kind: 'error',
          message: t('workbench.importExport.postman.readFileFailed', { message: text.message }),
        });
        return;
      }
      const stage = parseCollectionText(text, t);
      setStage(stage);
      if (stage.kind === 'parsed') setCollectionName(stage.result.collectionName);
    },
    [t],
  );

  const handleEnvFilePicked = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const result = parsePostmanEnvironment(text);
        setStage((prev) => (prev.kind === 'parsed' ? { ...prev, envFile: { source: text, result } } : prev));
      } catch (err) {
        const msg =
          err instanceof PostmanParseError
            ? err.message
            : t('workbench.importExport.postman.readEnvFailed', { message: String(err) });
        message.error(msg);
      }
    },
    [message, t],
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
        message.error(t('workbench.importExport.import.failedCreateCollection'));
        trackProductTelemetryEvent({ name: 'import_run', source: 'postman', ok: false });
        setBusy(false);
        return;
      }
      // Collection-level scripts land on the new collection's slots.
      if (
        setCollectionScripts &&
        (result.collectionPreRequestScript !== undefined || result.collectionPostResponseScript !== undefined)
      ) {
        await setCollectionScripts(coll.uid, {
          ...(result.collectionPreRequestScript !== undefined
            ? { preRequestScript: result.collectionPreRequestScript }
            : {}),
          ...(result.collectionPostResponseScript !== undefined
            ? { postResponseScript: result.collectionPostResponseScript }
            : {}),
        });
      }

      // Collection-level default auth lands on the new collection —
      // requests imported as `inherit` resolve it at send time.
      if (setCollectionAuth && result.collectionAuth !== undefined) {
        await setCollectionAuth(coll.uid, result.collectionAuth);
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
          if (setFolderScripts && (f.preRequestScript !== undefined || f.postResponseScript !== undefined)) {
            await setFolderScripts(created.uid, {
              ...(f.preRequestScript !== undefined ? { preRequestScript: f.preRequestScript } : {}),
              ...(f.postResponseScript !== undefined ? { postResponseScript: f.postResponseScript } : {}),
            });
          }
          if (setFolderAuth && f.auth !== undefined) {
            await setFolderAuth(created.uid, f.auth);
          }
        }
      }

      // 3. Create each request under its folder path.
      let requestsImported = 0;
      for (const { folderPath, request } of result.requests) {
        const key = folderPath.join('/');
        const parentPath = folderPathMap.get(key) ?? coll.path;
        const seed: Partial<Request> = {
          ...(request.description !== undefined ? { description: request.description } : {}),
          ...request.settings,
          ...(request.preRequestScript !== undefined ? { preRequestScript: request.preRequestScript } : {}),
          ...(request.postResponseScript !== undefined ? { postResponseScript: request.postResponseScript } : {}),
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
        const variables: Variable[] = envFile.result.variables.map((v) => ({
          uid: generateUid(),
          name: v.name,
          value: v.value,
          type: v.type,
          ...(v.enabled === false ? { enabled: false } : {}),
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

      trackProductTelemetryEvent({ name: 'import_run', source: 'postman', ok: true });
      onImported({
        collectionUid: coll.uid,
        collectionName: collectionName.trim(),
        requestsImported,
        environmentUid,
        report,
      });

      const summaryParts: string[] = [t('workbench.importExport.import.importedRequests', { count: requestsImported })];
      if (result.folders.length > 0) {
        summaryParts.push(t('workbench.importExport.postman.foldersCount', { count: result.folders.length }));
      }
      if (environmentUid) summaryParts.push(t('workbench.importExport.postman.oneEnvironment'));
      if (report.summary.dropped > 0) {
        summaryParts.push(t('workbench.importExport.import.dropsCount', { count: report.summary.dropped }));
      }
      message.success(summaryParts.join(' · '));
    } catch (err) {
      message.error(
        t('workbench.importExport.import.importFailed', {
          message: err instanceof Error ? err.message : String(err),
        }),
      );
      trackProductTelemetryEvent({ name: 'import_run', source: 'postman', ok: false });
    } finally {
      setBusy(false);
    }
  }, [
    stage,
    collectionName,
    createCollection,
    createFolder,
    setCollectionScripts,
    setFolderScripts,
    setCollectionAuth,
    setFolderAuth,
    createRequest,
    createEnvironment,
    onImported,
    message,
    t,
  ]);

  const confirmImport = useCallback(() => {
    if (canImport) void handleImport();
  }, [canImport, handleImport]);

  const saveLabel = useImportShortcut(open, canImport, confirmImport);

  const importTooltip =
    stage.kind !== 'parsed'
      ? t('workbench.importExport.postman.tooltipChooseFile')
      : !collectionName.trim()
        ? t('workbench.importExport.postman.tooltipEnterName')
        : saveLabel
          ? t('workbench.importExport.import.importShortcutTooltip', { shortcut: saveLabel })
          : t('workbench.importExport.import.importCta');

  return (
    <Modal
      open={open}
      title={
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>
          {t('workbench.importExport.postman.title')}
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
        {t('workbench.importExport.postman.intro')}
      </Paragraph>

      {stage.kind === 'empty' && (
        <PostmanFilePicker onPick={handleCollectionFilePicked} token={token} target="collection" />
      )}

      {stage.kind === 'error' && (
        <>
          <Alert
            type="error"
            showIcon
            message={t('workbench.importExport.import.cantReadFile')}
            description={stage.message}
            style={{ marginBottom: 12 }}
          />
          <PostmanFilePicker onPick={handleCollectionFilePicked} token={token} target="collection" />
        </>
      )}

      {stage.kind === 'parsed' && (
        <>
          <div style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
              {t('workbench.importExport.postman.collectionNameLabel')}
            </Text>
            <Input
              ref={nameInputRef}
              size="small"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              onPressEnter={confirmImport}
              placeholder={t('workbench.importExport.postman.collectionNamePlaceholder')}
              style={{ fontSize: 12 }}
            />
          </div>

          {diff?.hasChanges && <ReimportDiffPanel diff={diff} />}

          <ParsedPreview result={stage.result} token={token} />

          <Divider style={{ margin: '12px 0' }} />

          <EnvironmentSlot envFile={stage.envFile} onPick={handleEnvFilePicked} onClear={clearEnv} token={token} />

          <ImportReportPanel report={stage.result.report} token={token} />
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
  const t = useT();
  const heading =
    target === 'collection'
      ? t('workbench.importExport.postman.dropCollectionTitle')
      : t('workbench.importExport.postman.dropEnvTitle');
  const subtext =
    target === 'collection'
      ? t('workbench.importExport.postman.dropCollectionHint')
      : t('workbench.importExport.postman.dropEnvHint');
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
  const t = useT();
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
        {t('workbench.importExport.postman.parsedCollection')}
      </Text>
      <Space size={6} wrap>
        <Tag>
          {t('workbench.importExport.postman.requestsLabel')} <strong>{result.requests.length}</strong>
        </Tag>
        <Tag icon={<FolderOutlined />}>
          {t('workbench.importExport.postman.foldersLabel')} <strong>{result.folders.length}</strong>
        </Tag>
        <Tag>
          {t('workbench.importExport.postman.collectionVarsLabel')} <strong>{result.collectionVariables.length}</strong>
        </Tag>
      </Space>
      {result.folders.length > 0 && (
        <div style={{ marginTop: 8, maxHeight: 140, overflowY: 'auto', overscrollBehavior: 'none' }}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {t('workbench.importExport.postman.folderTree')}
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
  const t = useT();
  if (!envFile) {
    return (
      <div style={{ marginBottom: 12 }}>
        <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
          {t('workbench.importExport.postman.optionalEnvFile')}
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
            {t('workbench.importExport.postman.environmentLabel', { name: envFile.result.name })}
          </Text>
          <Tag>{t('workbench.importExport.postman.varsCount', { count: envFile.result.variables.length })}</Tag>
          {envFile.result.variables.some((v) => v.type === 'secret') && (
            <Tag color="gold">
              {t('workbench.importExport.postman.secretCount', {
                count: envFile.result.variables.filter((v) => v.type === 'secret').length,
              })}
            </Tag>
          )}
        </Space>
        <Button size="small" type="link" onClick={onClear}>
          {t('workbench.importExport.postman.remove')}
        </Button>
      </div>
      {envFile.result.report.drops.length > 0 && (
        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
          {t('workbench.importExport.postman.envDropped', { count: envFile.result.report.drops.length })}
        </Text>
      )}
    </div>
  );
};

export default ImportPostmanModal;
