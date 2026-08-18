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
 * header rules (the migration status log S2 decision): the publication gate
 * keeps them inert until the user scopes and publishes them.
 *
 * ARCHITECTURE.md §23 — re-import diff + single `recordImportReport`
 * per run, identical to the curl / HAR / Postman flows.
 */

import { ExperimentOutlined, FileTextOutlined, FolderOutlined, ImportOutlined, TagsOutlined } from '@ant-design/icons';
import {
  type BrunoFile,
  BrunoParseError,
  type BrunoParseResult,
  diffImportReports,
  hashImportSource,
  type ImportReport,
  type ImportReportDiff,
  InsomniaParseError,
  OpenApiParseError,
  type OpenApiSpecFormat,
  PostmanBackupParseError,
  parseBruno,
  parseBrunoFiles,
  parseInsomnia,
  parseOpenApi,
  parsePostmanBackup,
  recordDrop,
} from '@openheaders/core/import';
import type { AuthConfig, Request, RequestHeader, Variable } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { trackProductTelemetryEvent } from '@openheaders/ui/shared/product-telemetry';
import { Alert, App as AntApp, Button, Divider, Input, Modal, Radio, Space, Tag, Tooltip, Typography, theme } from 'antd';
import type { MessageKey } from '@openheaders/i18n';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import ImportReportPanel from './ImportReportPanel';
import { landSectionedCollections, type SectionedCollection } from './land-collections';
import ReimportDiffPanel from './ReimportDiffPanel';
import { useImportShortcut } from './use-import-shortcut';

const { Text, Paragraph } = Typography;

// ── Source-neutral parse shape ─────────────────────────────────────

export type SectionedSourceKind = 'postman-backup' | 'insomnia' | 'bruno' | 'openapi';

interface SectionedEnvironment {
  name: string;
  variables: Array<{ name: string; value: string; type: 'default' | 'secret'; enabled?: boolean }>;
}

interface SectionedPreset {
  name: string;
  headers: RequestHeader[];
}

/** One importable spec document — verbatim source paired (by index)
 *  with the collection it generated, so the landing step can mint the
 *  spec entity and bind the collection's `specLink`. */
interface SectionedSpec {
  name: string;
  content: string;
  format: OpenApiSpecFormat;
  collectionIndex: number | null;
}

interface SectionedParse {
  collections: SectionedCollection[];
  environments: SectionedEnvironment[];
  headerPresets: SectionedPreset[];
  specs: SectionedSpec[];
  report: ImportReport;
}

const SOURCE_LABELS: Record<SectionedSourceKind, { title: MessageKey; blurb: MessageKey }> = {
  'postman-backup': {
    title: 'workbench.importExport.sectioned.titlePostmanBackup',
    blurb: 'workbench.importExport.sectioned.blurbPostmanBackup',
  },
  insomnia: {
    title: 'workbench.importExport.sectioned.titleInsomnia',
    blurb: 'workbench.importExport.sectioned.blurbInsomnia',
  },
  bruno: {
    title: 'workbench.importExport.sectioned.titleBruno',
    blurb: 'workbench.importExport.sectioned.blurbBruno',
  },
  openapi: {
    title: 'workbench.importExport.sectioned.titleOpenapi',
    blurb: 'workbench.importExport.sectioned.blurbOpenapi',
  },
};

function fromBrunoResult(r: BrunoParseResult): SectionedParse {
  return {
    collections: [{ name: r.collectionName, folders: r.folders, requests: r.requests }],
    environments: r.environments.map((e) => ({ name: e.name, variables: e.variables })),
    headerPresets: [],
    specs: [],
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
          ...(c.collectionPreRequestScript !== undefined ? { preRequestScript: c.collectionPreRequestScript } : {}),
          ...(c.collectionPostResponseScript !== undefined
            ? { postResponseScript: c.collectionPostResponseScript }
            : {}),
          ...(c.collectionAuth !== undefined ? { auth: c.collectionAuth } : {}),
          folders: c.folders,
          requests: c.requests,
        })),
        environments: [...r.environments, ...(r.globals ? [r.globals] : [])].map((e) => ({
          name: e.name,
          variables: e.variables,
        })),
        headerPresets: r.headerPresets,
        specs: [],
        report: r.report,
      };
    }
    case 'insomnia': {
      const r = parseInsomnia(text);
      return {
        collections: r.collections.map((c) => ({
          name: c.name,
          ...(c.auth !== undefined ? { auth: c.auth } : {}),
          ...(c.variables !== undefined && c.variables.length > 0 ? { variables: c.variables } : {}),
          folders: c.folders,
          requests: c.requests,
        })),
        environments: r.environments.map((e) => ({ name: e.name, variables: e.variables })),
        headerPresets: [],
        // Retained embedded design documents — each pairs (by index)
        // with the collection the OpenAPI importer minted from it.
        specs: r.specs.map((s) => ({
          name: s.name,
          content: s.contents,
          format: s.format,
          collectionIndex: s.collectionIndex,
        })),
        report: r.report,
      };
    }
    case 'bruno':
      return fromBrunoResult(parseBruno(text));
    case 'openapi': {
      // Response examples stay off — this modal has no example write
      // leg yet, so the parser keeps the honest aggregate note instead
      // of emitting payloads that would be silently discarded.
      const r = parseOpenApi(text);
      return {
        collections: [
          {
            name: r.collectionName,
            ...(r.collectionAuth !== undefined ? { auth: r.collectionAuth } : {}),
            ...(r.collectionVariables.length > 0 ? { variables: r.collectionVariables } : {}),
            folders: r.folders,
            requests: r.requests,
          },
        ],
        environments: [],
        headerPresets: [],
        // The document itself is importable as a spec entity — the
        // chooser (vendor shape) decides whether this bucket lands.
        specs: [{ name: r.collectionName, content: text, format: r.specFormat, collectionIndex: 0 }],
        report: r.report,
      };
    }
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
  /** Lands collection-level scripts on a new collection's slots. */
  setCollectionScripts?: (
    collectionUid: string,
    scripts: { preRequestScript?: string; postResponseScript?: string },
  ) => Promise<boolean>;
  /** Lands folder-level scripts on a new folder's slots. */
  setFolderScripts?: (
    folderUid: string,
    scripts: { preRequestScript?: string; postResponseScript?: string },
  ) => Promise<boolean>;
  /** Lands collection-level default auth on a new collection. */
  setCollectionAuth?: (collectionUid: string, auth: AuthConfig) => Promise<boolean>;
  /** Lands folder-level default auth on a new folder. */
  setFolderAuth?: (folderUid: string, auth: AuthConfig) => Promise<boolean>;
  /** Lands collection variables on a new collection (OpenAPI's
   *  `{{baseUrl}}` — every imported URL references it). */
  setCollectionVariables?: (collectionUid: string, variables: Variable[]) => Promise<boolean>;
  createRequest: (payload: {
    name: string;
    parentPath: string;
    seed: Partial<Request>;
  }) => Promise<{ uid: string } | null>;
  /** Lands an imported document as a spec entity (API Specs Phase G).
   *  Absent on hosts without a spec plane — importable documents then
   *  drop from the spec leg with a report entry. */
  createSpec?: (payload: { name: string; content: string; format: OpenApiSpecFormat }) => Promise<{
    uid: string;
  } | null>;
  /** Binds a landed collection to the spec it was generated from —
   *  the Generate Collection link contract ({specUid, sourceHash}). */
  setCollectionSpecLink?: (collectionUid: string, link: { specUid: string; sourceHash: string }) => Promise<boolean>;
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

function toStageError(err: unknown, t: Translate): Stage {
  const known =
    err instanceof PostmanBackupParseError ||
    err instanceof InsomniaParseError ||
    err instanceof BrunoParseError ||
    err instanceof OpenApiParseError;
  return {
    kind: 'error',
    message: known
      ? (err as Error).message
      : t('workbench.importExport.sectioned.readInputFailed', { message: String(err) }),
  };
}

// Everything this modal parses is committed input (routed paste, picked
// file or folder), so a parse failure beacons `import-parse-failed`.
function parseText(sourceKind: SectionedSourceKind, text: string, t: Translate): Stage {
  try {
    return { kind: 'parsed', source: text, result: parseSectioned(sourceKind, text) };
  } catch (err) {
    trackProductTelemetryEvent({ name: 'error_beacon', code: 'import-parse-failed' });
    return toStageError(err, t);
  }
}

function parseFiles(files: BrunoFile[], t: Translate): Stage {
  try {
    // The re-import hash needs one stable string per folder — the same
    // folder re-picked must hash identically regardless of walk order.
    const source = [...files]
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((f) => `${f.path}\n${f.content}`)
      .join('\n');
    return { kind: 'parsed', source, result: fromBrunoResult(parseBrunoFiles(files)) };
  } catch (err) {
    trackProductTelemetryEvent({ name: 'error_beacon', code: 'import-parse-failed' });
    return toStageError(err, t);
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
  setCollectionScripts,
  setFolderScripts,
  setCollectionAuth,
  setFolderAuth,
  setCollectionVariables,
  createRequest,
  createSpec,
  setCollectionSpecLink,
  createEnvironment,
  createHeaderRules,
  findPreviousReport,
}) => {
  const { token } = theme.useToken();
  const { message } = AntApp.useApp();
  const t = useT();
  const [stage, setStage] = useState<Stage>({ kind: 'empty' });
  const [collectionNames, setCollectionNames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [diff, setDiff] = useState<ImportReportDiff | null>(null);
  // OpenAPI chooser (vendor shape): "Specification with a Collection"
  // (default — the document lives on as a spec entity) vs "Collection"
  // (convert-only). Other sources have no chooser: Insomnia's embedded
  // specs always retain; the rest carry no documents.
  const [includeSpec, setIncludeSpec] = useState(true);

  useEffect(() => {
    if (!open) return;
    const next = initialFiles
      ? parseFiles(initialFiles, t)
      : initialText
        ? parseText(sourceKind, initialText, t)
        : ({ kind: 'empty' } as const);
    setStage(next);
    setCollectionNames(next.kind === 'parsed' ? next.result.collections.map((c) => c.name) : []);
    setBusy(false);
    setDiff(null);
    setIncludeSpec(true);
  }, [open, sourceKind, initialText, initialFiles, t]);

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
      //    source names; folders depth-first so parents exist. The
      //    loop is the shared landing path (`land-collections.ts`) —
      //    the spec editor's Generate Collection rides the same one.
      const landed = await landSectionedCollections(
        result.collections,
        collectionNames,
        {
          createCollection,
          createFolder,
          ...(setCollectionScripts ? { setCollectionScripts } : {}),
          ...(setFolderScripts ? { setFolderScripts } : {}),
          ...(setCollectionAuth ? { setCollectionAuth } : {}),
          ...(setFolderAuth ? { setFolderAuth } : {}),
          ...(setCollectionVariables ? { setCollectionVariables } : {}),
          createRequest,
        },
        report,
      );
      const { collectionsImported, requestsImported } = landed;

      // 1.5 Spec entities (API Specs Phase G): the OpenAPI chooser's
      //     "Specification with a Collection" and Insomnia's retained
      //     `api_spec` documents land verbatim, then bind their
      //     generated collection's specLink — born in sync (the hash
      //     is over the exact content the entity stores).
      let specsImported = 0;
      const specsToLand = sourceKind === 'openapi' && !includeSpec ? [] : result.specs;
      if (specsToLand.length > 0 && !createSpec) {
        recordDrop(report, {
          path: 'specs',
          reason: `${specsToLand.length} specification${specsToLand.length === 1 ? '' : 's'} not retained — this surface has no spec plane.`,
          tracking: 'PERMANENT: spec plane availability',
        });
      }
      if (createSpec) {
        for (let i = 0; i < specsToLand.length; i++) {
          const spec = specsToLand[i];
          if (!spec) continue;
          const created = await createSpec({ name: spec.name, content: spec.content, format: spec.format });
          if (!created) {
            recordDrop(report, {
              path: `specs[${i}]`,
              reason: `Failed to create specification "${spec.name}" — the document was not retained.`,
              tracking: 'PERMANENT: write-path failure',
            });
            continue;
          }
          specsImported += 1;
          const collectionUid =
            spec.collectionIndex !== null ? (landed.collectionUids[spec.collectionIndex] ?? null) : null;
          if (collectionUid !== null && setCollectionSpecLink) {
            const specSourceHash = await hashImportSource(spec.content);
            const linked = await setCollectionSpecLink(collectionUid, {
              specUid: created.uid,
              sourceHash: specSourceHash,
            });
            if (!linked) {
              recordDrop(report, {
                path: `specs[${i}].specLink`,
                reason: `The collection generated from "${spec.name}" could not record its spec link — it will not appear under the spec's Collections.`,
                tracking: 'PERMANENT: write-path failure',
              });
            }
          }
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
          ...(v.enabled === false ? { enabled: false } : {}),
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

      trackProductTelemetryEvent({ name: 'import_run', source: sourceKind, ok: true });
      onImported({ importedCollections: collectionsImported, report });

      const summaryParts: string[] = [];
      if (requestsImported > 0) {
        summaryParts.push(t('workbench.importExport.sectioned.requestsPart', { count: requestsImported }));
      }
      if (specsImported > 0) {
        summaryParts.push(t('workbench.importExport.sectioned.specificationsPart', { count: specsImported }));
      }
      if (environmentsImported > 0) {
        summaryParts.push(t('workbench.importExport.sectioned.environmentsPart', { count: environmentsImported }));
      }
      if (presetRules > 0) {
        summaryParts.push(t('workbench.importExport.sectioned.headerRulesPart', { count: presetRules }));
      }
      if (report.summary.dropped > 0) {
        summaryParts.push(t('workbench.importExport.import.dropsCount', { count: report.summary.dropped }));
      }
      message.success(
        summaryParts.length > 0
          ? t('workbench.importExport.sectioned.importedLead', { parts: summaryParts.join(' · ') })
          : t('workbench.importExport.sectioned.emptyFinish'),
      );
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
  }, [
    stage,
    sourceKind,
    collectionNames,
    includeSpec,
    createCollection,
    createFolder,
    setCollectionScripts,
    setFolderScripts,
    setCollectionAuth,
    setFolderAuth,
    setCollectionVariables,
    createRequest,
    createSpec,
    setCollectionSpecLink,
    createEnvironment,
    createHeaderRules,
    onImported,
    message,
    t,
  ]);

  const confirmImport = useCallback(() => {
    if (canImport) void handleImport();
  }, [canImport, handleImport]);

  const saveLabel = useImportShortcut(open, canImport, confirmImport);

  const labels = SOURCE_LABELS[sourceKind];
  const importTooltip =
    stage.kind !== 'parsed'
      ? t('workbench.importExport.sectioned.tooltipNothingParsed')
      : !canImport && !busy
        ? t('workbench.importExport.sectioned.tooltipNeedsNames')
        : saveLabel
          ? t('workbench.importExport.import.importShortcutTooltip', { shortcut: saveLabel })
          : t('workbench.importExport.import.importCta');

  return (
    <Modal
      open={open}
      title={<span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5 }}>{t(labels.title)}</span>}
      onCancel={onCancel}
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
        {t(labels.blurb)}
      </Paragraph>

      {stage.kind === 'error' && (
        <Alert
          type="error"
          showIcon
          message={t('workbench.importExport.sectioned.cantReadImport')}
          description={stage.message}
        />
      )}

      {stage.kind === 'parsed' && (
        <>
          {diff?.hasChanges && <ReimportDiffPanel diff={diff} />}

          {sourceKind === 'openapi' && createSpec !== undefined && stage.result.specs.length > 0 && (
            <SectionBox title={t('workbench.importExport.sectioned.importAs')} token={token}>
              <Radio.Group
                value={includeSpec ? 'spec-collection' : 'collection'}
                onChange={(e) => setIncludeSpec(e.target.value === 'spec-collection')}
                disabled={busy}
              >
                <Space direction="vertical" size={2}>
                  <Radio value="spec-collection" style={{ fontSize: 12 }}>
                    {t('workbench.importExport.sectioned.specWithCollection')}
                  </Radio>
                  <Text type="secondary" style={{ fontSize: 11, display: 'block', marginLeft: 24 }}>
                    {t('workbench.importExport.sectioned.specWithCollectionHelp')}
                  </Text>
                  <Radio value="collection" style={{ fontSize: 12 }}>
                    {t('workbench.importExport.sectioned.collectionOnly')}
                  </Radio>
                  <Text type="secondary" style={{ fontSize: 11, display: 'block', marginLeft: 24 }}>
                    {t('workbench.importExport.sectioned.collectionOnlyHelp')}
                  </Text>
                </Space>
              </Radio.Group>
            </SectionBox>
          )}

          {createSpec !== undefined &&
            (sourceKind !== 'openapi' || includeSpec) &&
            stage.result.specs.length > 0 && (
              <SectionBox
                title={t('workbench.importExport.sectioned.specificationsSection', {
                  count: stage.result.specs.length,
                })}
                token={token}
              >
                <Space size={6} wrap>
                  {stage.result.specs.map((s, i) => (
                    <Tag key={i} icon={<FileTextOutlined />}>
                      {s.name} · {s.format === 'openapi-3.0' ? 'OpenAPI 3.0' : 'OpenAPI 3.1'}
                    </Tag>
                  ))}
                </Space>
              </SectionBox>
            )}

          {stage.result.collections.length > 0 && (
            <SectionBox
              title={t('workbench.importExport.sectioned.collectionsSection', {
                count: stage.result.collections.length,
              })}
              token={token}
            >
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
                    placeholder={t('workbench.importExport.sectioned.collectionNamePlaceholder')}
                    style={{ fontSize: 12, maxWidth: 280 }}
                  />
                  <Space size={6} wrap>
                    <Tag>
                      {t('workbench.importExport.postman.requestsLabel')} <strong>{c.requests.length}</strong>
                    </Tag>
                    <Tag icon={<FolderOutlined />}>
                      {t('workbench.importExport.postman.foldersLabel')} <strong>{c.folders.length}</strong>
                    </Tag>
                    {c.variables !== undefined && c.variables.length > 0 && (
                      <Tag>
                        {t('workbench.importExport.postman.collectionVarsLabel')} <strong>{c.variables.length}</strong>
                      </Tag>
                    )}
                  </Space>
                </div>
              ))}
            </SectionBox>
          )}

          {stage.result.environments.length > 0 && (
            <SectionBox
              title={t('workbench.importExport.sectioned.environmentsSection', {
                count: stage.result.environments.length,
              })}
              token={token}
            >
              <Space size={6} wrap>
                {stage.result.environments.map((e, i) => (
                  <Tag key={i} icon={<ExperimentOutlined />}>
                    {e.name} · {t('workbench.importExport.sectioned.varsShort', { count: e.variables.length })}
                  </Tag>
                ))}
              </Space>
            </SectionBox>
          )}

          {stage.result.headerPresets.length > 0 && (
            <SectionBox
              title={t('workbench.importExport.sectioned.headerPresetsSection', {
                count: stage.result.headerPresets.length,
              })}
              token={token}
            >
              <Space size={6} wrap>
                {stage.result.headerPresets.map((p, i) => (
                  <Tag key={i} icon={<TagsOutlined />}>
                    {p.name} · {t('workbench.importExport.sectioned.headersShort', { count: p.headers.length })}
                  </Tag>
                ))}
              </Space>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 6 }}>
                {t('workbench.importExport.sectioned.presetsNote')}
              </Text>
            </SectionBox>
          )}

          {stage.result.collections.length === 0 &&
            stage.result.environments.length === 0 &&
            stage.result.headerPresets.length === 0 && (
              <Alert
                type="info"
                showIcon
                message={t('workbench.importExport.sectioned.nothingImportable')}
                description={t('workbench.importExport.sectioned.nothingImportableDesc')}
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
