/**
 * ImportSectionedModal — stage-2 confirmation for multi-section import
 * sources: a Postman backup (N collections + M environments + header
 * presets), an Insomnia export (collections + environments), or a
 * Bruno `.bru` file / collection folder. One component parameterized
 * by the parse result; `ImportPostmanModal` is the styling template.
 *
 * Sections render per-source counts, a parsed preview, and import
 * notes (drops/transforms with full reasons). Target collections are
 * auto-created from the source names (editable inline) — the import
 * never blocks on structure. Header presets materialize as UNPUBLISHED
 * header rules (MIGRATION_STATUS.md S2 decision): the publication gate
 * keeps them inert until the user scopes and publishes them.
 *
 * ARCHITECTURE.md §23 — re-import diff + single `recordImportReport`
 * per run, identical to the curl / HAR / Postman flows.
 */

import { ExperimentOutlined, FolderOutlined, ImportOutlined, TagsOutlined } from '@ant-design/icons';
import {
  type BrunoFile,
  BrunoParseError,
  type BrunoParseResult,
  type CurlRequest,
  diffImportReports,
  hashImportSource,
  type ImportReport,
  type ImportReportDiff,
  InsomniaParseError,
  PostmanBackupParseError,
  parseBruno,
  parseBrunoFiles,
  parseInsomnia,
  parsePostmanBackup,
  recordDrop,
} from '@openheaders/core/import';
import type { Request, RequestHeader, Variable } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { Alert, App as AntApp, Button, Divider, Input, Modal, Space, Tag, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import ImportReportPanel from './ImportReportPanel';
import ReimportDiffPanel from './ReimportDiffPanel';
import { useImportShortcut } from './use-import-shortcut';

const { Text, Paragraph } = Typography;

// ── Source-neutral parse shape ─────────────────────────────────────

export type SectionedSourceKind = 'postman-backup' | 'insomnia' | 'bruno';

interface SectionedCollection {
  name: string;
  folders: Array<{ path: string[] }>;
  requests: Array<{ folderPath: string[]; request: CurlRequest }>;
}

interface SectionedEnvironment {
  name: string;
  variables: Array<{ name: string; value: string; type: 'default' | 'secret' }>;
}

interface SectionedPreset {
  name: string;
  headers: RequestHeader[];
}

interface SectionedParse {
  collections: SectionedCollection[];
  environments: SectionedEnvironment[];
  headerPresets: SectionedPreset[];
  report: ImportReport;
}

const SOURCE_LABELS: Record<SectionedSourceKind, { title: string; blurb: string }> = {
  'postman-backup': {
    title: 'IMPORT FROM POSTMAN BACKUP',
    blurb:
      'Import a Postman backup data dump. Collections, environments, globals, and header presets are recognized; ' +
      'header presets land as unpublished header rules. Scripts, OAuth 2.0, AWS sigv4, and file uploads are tracked as drops.',
  },
  insomnia: {
    title: 'IMPORT FROM INSOMNIA',
    blurb:
      'Import an Insomnia export (v4 JSON or v5 YAML). Workspaces become collections with their folder trees; ' +
      'environments flatten (sub-environments merge over their base) and {{ _.var }} references rewrite to {{var}}.',
  },
  bruno: {
    title: 'IMPORT FROM BRUNO',
    blurb:
      'Import a Bruno .bru request or a whole collection folder. Method, headers, params, body, and ' +
      'basic/bearer/api-key auth are preserved; a folder brings its folder tree, ordering, and environments; ' +
      'scripts, tests, and docs blocks are tracked as drops.',
  },
};

function fromBrunoResult(r: BrunoParseResult): SectionedParse {
  return {
    collections: [{ name: r.collectionName, folders: r.folders, requests: r.requests }],
    environments: r.environments.map((e) => ({ name: e.name, variables: e.variables })),
    headerPresets: [],
    report: r.report,
  };
}

function parseSectioned(kind: SectionedSourceKind, text: string): SectionedParse {
  switch (kind) {
    case 'postman-backup': {
      const r = parsePostmanBackup(text);
      return {
        collections: r.collections.map((c) => ({
          name: c.collectionName,
          folders: c.folders,
          requests: c.requests,
        })),
        environments: [...r.environments, ...(r.globals ? [r.globals] : [])].map((e) => ({
          name: e.name,
          variables: e.variables,
        })),
        headerPresets: r.headerPresets,
        report: r.report,
      };
    }
    case 'insomnia': {
      const r = parseInsomnia(text);
      return {
        collections: r.collections.map((c) => ({ name: c.name, folders: c.folders, requests: c.requests })),
        environments: r.environments.map((e) => ({ name: e.name, variables: e.variables })),
        headerPresets: [],
        report: r.report,
      };
    }
    case 'bruno':
      return fromBrunoResult(parseBruno(text));
  }
}

// ── Modal ──────────────────────────────────────────────────────────

interface ImportSectionedModalProps {
  open: boolean;
  sourceKind: SectionedSourceKind;
  /** The recognized paste/file text — parsed on open, like the hub's Postman hand-off. */
  initialText?: string;
  /** A picked Bruno collection folder (`bruno` only) — collection-relative
   *  paths + contents from the hub's folder picker. Wins over `initialText`. */
  initialFiles?: BrunoFile[];
  onCancel: () => void;
  onImported: (result: { importedCollections: number; report: ImportReport }) => void;
  createCollection: (name: string) => Promise<{ uid: string; path: string } | null>;
  createFolder: (name: string, parentPath: string) => Promise<{ uid: string; path: string } | null>;
  createRequest: (payload: {
    name: string;
    parentPath: string;
    seed: Partial<Request>;
  }) => Promise<{ uid: string } | null>;
  createEnvironment: (payload: { name: string; variables: Variable[] }) => Promise<{ uid: string } | null>;
  /**
   * Materialize header presets as unpublished header rules (extension
   * surface). Absent on hosts without a rule plane — the presets then
   * drop with a report entry instead of vanishing.
   */
  createHeaderRules?: (presets: SectionedPreset[]) => Promise<number>;
  findPreviousReport?: (sourceHash: string) => Promise<ImportReport | null>;
}

type Stage = { kind: 'empty' } | { kind: 'parsed'; source: string; result: SectionedParse } | { kind: 'error'; message: string };

function toStageError(err: unknown): Stage {
  const known =
    err instanceof PostmanBackupParseError || err instanceof InsomniaParseError || err instanceof BrunoParseError;
  return { kind: 'error', message: known ? (err as Error).message : `Failed to read input: ${String(err)}` };
}

function parseText(sourceKind: SectionedSourceKind, text: string): Stage {
  try {
    return { kind: 'parsed', source: text, result: parseSectioned(sourceKind, text) };
  } catch (err) {
    return toStageError(err);
  }
}

function parseFiles(files: BrunoFile[]): Stage {
  try {
    // The re-import hash needs one stable string per folder — the same
    // folder re-picked must hash identically regardless of walk order.
    const source = [...files]
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((f) => `${f.path}\n${f.content}`)
      .join('\n');
    return { kind: 'parsed', source, result: fromBrunoResult(parseBrunoFiles(files)) };
  } catch (err) {
    return toStageError(err);
  }
}

const ImportSectionedModal: React.FC<ImportSectionedModalProps> = ({
  open,
  sourceKind,
  initialText,
  initialFiles,
  onCancel,
  onImported,
  createCollection,
  createFolder,
  createRequest,
  createEnvironment,
  createHeaderRules,
  findPreviousReport,
}) => {
  const { token } = theme.useToken();
  const { message } = AntApp.useApp();
  const [stage, setStage] = useState<Stage>({ kind: 'empty' });
  const [collectionNames, setCollectionNames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [diff, setDiff] = useState<ImportReportDiff | null>(null);

  useEffect(() => {
    if (!open) return;
    const next = initialFiles
      ? parseFiles(initialFiles)
      : initialText
        ? parseText(sourceKind, initialText)
        : ({ kind: 'empty' } as const);
    setStage(next);
    setCollectionNames(next.kind === 'parsed' ? next.result.collections.map((c) => c.name) : []);
    setBusy(false);
    setDiff(null);
  }, [open, sourceKind, initialText, initialFiles]);

  // Re-import-diff lookup on every parse — same contract as the other
  // stage-2 modals (keyed by sourceHash, nice-to-have on failure).
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

  const canImport =
    stage.kind === 'parsed' &&
    !busy &&
    (stage.result.collections.length === 0 || collectionNames.every((n) => n.trim().length > 0));

  const handleImport = useCallback(async () => {
    if (stage.kind !== 'parsed') return;
    const { result, source } = stage;
    setBusy(true);
    try {
      const sourceHash = await hashImportSource(source);
      const report: ImportReport = { ...result.report, sourceHash };

      // 1. Collections — auto-created from the (possibly renamed)
      //    source names; folders depth-first so parents exist.
      let requestsImported = 0;
      let collectionsImported = 0;
      for (let i = 0; i < result.collections.length; i++) {
        const section = result.collections[i];
        if (!section) continue;
        const name = (collectionNames[i] ?? section.name).trim() || section.name;
        const coll = await createCollection(name);
        if (!coll) {
          recordDrop(report, {
            path: `collections[${i}]`,
            reason: `Failed to create collection "${name}" — its requests were not imported.`,
            tracking: 'PERMANENT: write-path failure',
          });
          continue;
        }
        collectionsImported++;
        const folderPathMap = new Map<string, string>();
        folderPathMap.set('', coll.path);
        const sortedFolders = [...section.folders].sort((a, b) => a.path.length - b.path.length);
        for (const f of sortedFolders) {
          const parentKey = f.path.slice(0, -1).join('/');
          const parentPath = folderPathMap.get(parentKey);
          const folderName = f.path[f.path.length - 1];
          if (!parentPath || !folderName) continue;
          const created = await createFolder(folderName, parentPath);
          if (created) folderPathMap.set(f.path.join('/'), created.path);
        }
        for (const { folderPath, request } of section.requests) {
          const parentPath = folderPathMap.get(folderPath.join('/')) ?? coll.path;
          const seed: Partial<Request> = {
            ...(request.description !== undefined ? { description: request.description } : {}),
            ...request.settings,
            method: request.method,
            url: request.url,
            headers: request.headers,
            params: request.params,
            auth: request.auth,
            body: request.body,
          };
          const created = await createRequest({ name: request.name, parentPath, seed });
          if (created) requestsImported += 1;
        }
      }

      // 2. Environments.
      let environmentsImported = 0;
      for (const env of result.environments) {
        const variables: Variable[] = env.variables.map((v) => ({
          uid: generateUid(),
          name: v.name,
          value: v.value,
          type: v.type,
        }));
        const created = await createEnvironment({ name: env.name, variables });
        if (created) environmentsImported += 1;
      }

      // 3. Header presets → unpublished header rules (S2 decision).
      let presetRules = 0;
      if (result.headerPresets.length > 0) {
        if (createHeaderRules) {
          // Disabled preset rows can't ride along — HeaderModification
          // has no enabled axis — so they drop with a reason instead
          // of silently becoming active modifications.
          for (const preset of result.headerPresets) {
            for (const h of preset.headers) {
              if (h.enabled === false) {
                recordDrop(report, {
                  path: `backup.headerPresets["${preset.name}"].${h.key}`,
                  reason: `Header "${h.key}" is disabled in the preset — not included in the minted rule.`,
                  tracking: 'PERMANENT: disabled-header policy',
                });
              }
            }
          }
          presetRules = await createHeaderRules(result.headerPresets);
        } else {
          recordDrop(report, {
            path: 'backup.headerPresets',
            reason: `${result.headerPresets.length} header preset${result.headerPresets.length === 1 ? '' : 's'} not imported — this surface has no header-rule plane.`,
            tracking: 'PERMANENT: desktop preset pass-through',
          });
        }
      }

      onImported({ importedCollections: collectionsImported, report });

      const summaryParts: string[] = [];
      if (requestsImported > 0) {
        summaryParts.push(`${requestsImported} request${requestsImported === 1 ? '' : 's'}`);
      }
      if (environmentsImported > 0) {
        summaryParts.push(`${environmentsImported} environment${environmentsImported === 1 ? '' : 's'}`);
      }
      if (presetRules > 0) summaryParts.push(`${presetRules} header rule${presetRules === 1 ? '' : 's'} (unpublished)`);
      if (report.summary.dropped > 0) {
        summaryParts.push(`${report.summary.dropped} drop${report.summary.dropped === 1 ? '' : 's'}`);
      }
      message.success(summaryParts.length > 0 ? `Imported ${summaryParts.join(' · ')}` : 'Import finished — nothing to bring over');
    } catch (err) {
      message.error(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }, [stage, collectionNames, createCollection, createFolder, createRequest, createEnvironment, createHeaderRules, onImported, message]);

  const confirmImport = useCallback(() => {
    if (canImport) void handleImport();
  }, [canImport, handleImport]);

  const saveLabel = useImportShortcut(open, canImport, confirmImport);

  const labels = SOURCE_LABELS[sourceKind];
  const importTooltip =
    stage.kind !== 'parsed'
      ? 'Nothing parsed yet'
      : !canImport && !busy
        ? 'Every collection needs a name'
        : saveLabel
          ? `Import (${saveLabel})`
          : 'Import';

  return (
    <Modal
      open={open}
      title={<span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>{labels.title}</span>}
      onCancel={onCancel}
      footer={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={onCancel} size="small" disabled={busy}>
              Cancel
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
                >
                  Import
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
              {saveLabel && <span>{saveLabel} import</span>}
              <span style={{ marginLeft: 'auto' }}>esc close</span>
            </div>
          )}
        </div>
      }
      width={760}
      destroyOnClose
    >
      <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 12 }}>
        {labels.blurb}
      </Paragraph>

      {stage.kind === 'error' && (
        <Alert type="error" showIcon message="Couldn't read this import" description={stage.message} />
      )}

      {stage.kind === 'parsed' && (
        <>
          {diff?.hasChanges && <ReimportDiffPanel diff={diff} />}

          {stage.result.collections.length > 0 && (
            <SectionBox title={`COLLECTIONS · ${stage.result.collections.length}`} token={token}>
              {stage.result.collections.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Input
                    size="small"
                    value={collectionNames[i] ?? c.name}
                    onChange={(e) =>
                      setCollectionNames((prev) => {
                        const next = [...prev];
                        next[i] = e.target.value;
                        return next;
                      })
                    }
                    onPressEnter={confirmImport}
                    placeholder="Collection name"
                    style={{ fontSize: 12, maxWidth: 280 }}
                  />
                  <Space size={6} wrap>
                    <Tag>
                      Requests: <strong>{c.requests.length}</strong>
                    </Tag>
                    <Tag icon={<FolderOutlined />}>
                      Folders: <strong>{c.folders.length}</strong>
                    </Tag>
                  </Space>
                </div>
              ))}
            </SectionBox>
          )}

          {stage.result.environments.length > 0 && (
            <SectionBox title={`ENVIRONMENTS · ${stage.result.environments.length}`} token={token}>
              <Space size={6} wrap>
                {stage.result.environments.map((e, i) => (
                  <Tag key={i} icon={<ExperimentOutlined />}>
                    {e.name} · {e.variables.length} var{e.variables.length === 1 ? '' : 's'}
                  </Tag>
                ))}
              </Space>
            </SectionBox>
          )}

          {stage.result.headerPresets.length > 0 && (
            <SectionBox title={`HEADER PRESETS · ${stage.result.headerPresets.length}`} token={token}>
              <Space size={6} wrap>
                {stage.result.headerPresets.map((p, i) => (
                  <Tag key={i} icon={<TagsOutlined />}>
                    {p.name} · {p.headers.length} header{p.headers.length === 1 ? '' : 's'}
                  </Tag>
                ))}
              </Space>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 6 }}>
                Each preset lands as an unpublished header rule — add conditions and publish it when ready; nothing
                touches live traffic until then.
              </Text>
            </SectionBox>
          )}

          {stage.result.collections.length === 0 &&
            stage.result.environments.length === 0 &&
            stage.result.headerPresets.length === 0 && (
              <Alert
                type="info"
                showIcon
                message="Nothing importable in this file"
                description="The file parsed, but every section was empty or dropped — see the import notes below."
                style={{ marginBottom: 12 }}
              />
            )}

          <Divider style={{ margin: '12px 0' }} />

          <ImportReportPanel report={stage.result.report} token={token} />
        </>
      )}
    </Modal>
  );
};

// ── Section chrome ─────────────────────────────────────────────────

const SectionBox: React.FC<{
  title: string;
  token: ReturnType<typeof theme.useToken>['token'];
  children: React.ReactNode;
}> = ({ title, token, children }) => (
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
      {title}
    </Text>
    {children}
  </div>
);

export default ImportSectionedModal;
export type { SectionedPreset };
