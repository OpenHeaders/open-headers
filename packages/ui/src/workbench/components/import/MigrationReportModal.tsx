/**
 * MigrationReportModal — the "view report" click-through for a
 * finished background migration pull. Opens IN PLACE: the active
 * workspace never switches (unsaved drafts stay untouched).
 *
 * Workspace parity (1 vendor workspace = 1 Open Headers workspace)
 * means a run lands one report per imported workspace; each section
 * reads that workspace's ring by id and offers an explicit "Open
 * workspace" jump — switching is the user's choice, never a side
 * effect of viewing the report.
 */

import { CheckCircleFilled, CopyOutlined, DownloadOutlined, ExclamationCircleFilled } from '@ant-design/icons';
import { hostBridge } from '@openheaders/core/bridge';
import type { ImportReport, PostmanImportedWorkspace, PostmanImportSummary } from '@openheaders/core/import';
import { App, Button, Checkbox, Collapse, Modal, Skeleton, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import ImportReportPanel from './ImportReportPanel';

const { Text, Paragraph } = Typography;

export interface WorkspaceReportEntry {
  workspace: PostmanImportedWorkspace;
  report: ImportReport | null;
}

/** The newest pull report in a ring is the run's — rings are oldest-first. */
function newestPullReport(reports: ImportReport[]): ImportReport | null {
  return [...reports].reverse().find((r) => r.source === 'postman-pull') ?? null;
}

/**
 * The full run as portable JSON — the debugging hand-off for a GitHub
 * issue: the summary plus each workspace's report (drops/transforms).
 * Never contains credentials (reports are key-free by the key law).
 *
 * With `anonymize` the payload is safe to post publicly: workspace
 * names become stable "Workspace N" aliases (including inside note
 * strings) and transform from/to values are redacted to their length.
 * Paths, reasons, counts, and tracking links stay — they carry the
 * debugging signal.
 */
export function serializeReport(
  summary: PostmanImportSummary,
  entries: WorkspaceReportEntry[],
  anonymize: boolean,
): string {
  const aliases = new Map<string, string>();
  const alias = (name: string): string => {
    const existing = aliases.get(name);
    if (existing) return existing;
    const next = `Workspace ${aliases.size + 1}`;
    aliases.set(name, next);
    return next;
  };
  if (anonymize) for (const workspace of summary.workspaces) alias(workspace.workspaceName);
  // Longest name first — a name that prefixes another ("new" / "new2")
  // must never partially rewrite the longer one's occurrences.
  const scrubOrder = [...aliases].sort(([a], [b]) => b.length - a.length);
  const scrub = (text: string): string => {
    let out = text;
    for (const [name, replacement] of scrubOrder) out = out.split(name).join(replacement);
    return out;
  };
  const redact = (value: string): string => `[redacted ${value.length} chars]`;
  const cleanReport = (report: ImportReport | null): ImportReport | null => {
    if (!anonymize || report === null) return report;
    return {
      ...report,
      drops: report.drops.map((drop) => ({
        ...drop,
        path: scrub(drop.path),
        reason: scrub(drop.reason),
        ...(drop.names !== undefined ? { names: drop.names.map(redact) } : {}),
      })),
      transforms: report.transforms.map((transform) => ({
        ...transform,
        path: scrub(transform.path),
        reason: scrub(transform.reason),
        from: redact(transform.from),
        to: redact(transform.to),
      })),
    };
  };
  return JSON.stringify(
    {
      source: 'postman-pull',
      generatedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      anonymized: anonymize,
      summary: anonymize
        ? {
            ...summary,
            workspaces: summary.workspaces.map((workspace) => ({
              ...workspace,
              workspaceName: alias(workspace.workspaceName),
            })),
          }
        : summary,
      workspaces: entries.map(({ workspace, report }) => ({
        ...workspace,
        ...(anonymize ? { workspaceName: alias(workspace.workspaceName) } : {}),
        report: cleanReport(report),
      })),
    },
    null,
    2,
  );
}

const WorkspaceReportBody: React.FC<{ entry: WorkspaceReportEntry }> = ({ entry }) => {
  const { token } = theme.useToken();
  const t = useT();
  const { report } = entry;
  if (report === null) {
    return (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {t('workbench.importExport.report.noReport')}
      </Text>
    );
  }
  if (report.drops.length === 0 && report.transforms.length === 0) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <CheckCircleFilled style={{ color: token.colorSuccess }} />
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('workbench.importExport.report.cleanImport')}
        </Text>
      </span>
    );
  }
  return <ImportReportPanel report={report} token={token} />;
};

const MigrationReportModal: React.FC<{
  open: boolean;
  summary: PostmanImportSummary | null;
  onClose: () => void;
  /** Explicit jump into an imported workspace — the user's choice. */
  onOpenWorkspace?: (workspaceId: string) => void;
}> = ({ open, summary, onClose, onOpenWorkspace }) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const t = useT();
  const [entries, setEntries] = useState<WorkspaceReportEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [anonymize, setAnonymize] = useState(false);

  const copyReport = useCallback(() => {
    if (!summary) return;
    navigator.clipboard
      .writeText(serializeReport(summary, entries, anonymize))
      .then(() =>
        message.success(
          anonymize
            ? t('workbench.importExport.report.copyAnonymizedOk')
            : t('workbench.importExport.report.copyOk'),
        ),
      )
      .catch(() => message.error(t('workbench.importExport.report.copyFailed')));
  }, [summary, entries, anonymize, message, t]);

  const downloadReport = useCallback(() => {
    if (!summary) return;
    const blob = new Blob([serializeReport(summary, entries, anonymize)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    anchor.download = `openheaders-postman-import-report${anonymize ? '-anonymized' : ''}-${stamp}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [summary, entries, anonymize]);

  useEffect(() => {
    if (!open || !summary) return;
    let cancelled = false;
    setLoading(true);
    setEntries([]);
    void Promise.all(
      summary.workspaces.map((workspace) =>
        hostBridge
          .call('listImportReports', { workspaceId: workspace.workspaceId })
          .then(({ reports }) => ({ workspace, report: newestPullReport(reports) }))
          .catch(() => ({ workspace, report: null })),
      ),
    )
      .then((loaded) => {
        if (!cancelled) setEntries(loaded);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, summary]);

  const items = entries.map((entry) => {
    const { workspace, report } = entry;
    const clean = report !== null && report.drops.length === 0 && report.transforms.length === 0;
    const notes = report ? report.drops.length + report.transforms.length : 0;
    return {
      key: workspace.workspaceId,
      label: (
        // Aligned to the FIRST line (not centered): the Collapse caret
        // rides the header's first text line, so icon, name, and the
        // counts' first line all share its 22px rhythm even when the
        // counts wrap.
        <span style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
          {report !== null &&
            (clean ? (
              <CheckCircleFilled style={{ color: token.colorSuccess, fontSize: 13, marginTop: 4.5 }} />
            ) : (
              <ExclamationCircleFilled style={{ color: token.colorWarning, fontSize: 13, marginTop: 4.5 }} />
            ))}
          <Text
            strong
            style={{
              whiteSpace: 'nowrap',
              flex: 'none',
              maxWidth: 280,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: '22px',
            }}
          >
            {workspace.workspaceName}
          </Text>
          <Text type="secondary" style={{ fontSize: 12, lineHeight: '22px', minWidth: 0 }}>
            {t('workbench.importExport.report.countsLine', {
              collections: workspace.collections,
              environments: workspace.environments,
              requests: workspace.requests,
            })}
            {workspace.examples > 0
              ? ` · ${t('workbench.importExport.report.savedExamplesPart', { count: workspace.examples })}`
              : ''}
            {workspace.globals > 0
              ? ` · ${t('workbench.importExport.report.globalVariablesPart', { count: workspace.globals })}`
              : ''}
            {notes > 0 ? ` · ${t('workbench.importExport.report.notesPart', { count: notes })}` : ''}
          </Text>
        </span>
      ),
      extra: onOpenWorkspace && (
        <Button
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onOpenWorkspace(workspace.workspaceId);
          }}
        >
          {t('workbench.importExport.report.openWorkspace')}
        </Button>
      ),
      children: <WorkspaceReportBody entry={entry} />,
    };
  });

  return (
    <Modal
      title={t('workbench.importExport.report.title')}
      open={open}
      onCancel={onClose}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button icon={<CopyOutlined />} onClick={copyReport} disabled={loading || !summary}>
            {t('workbench.importExport.report.copyReport')}
          </Button>
          <Button icon={<DownloadOutlined />} onClick={downloadReport} disabled={loading || !summary}>
            {t('workbench.importExport.report.download')}
          </Button>
          <Tooltip title={t('workbench.importExport.report.anonymizeTooltip')}>
            <Checkbox checked={anonymize} onChange={(e) => setAnonymize(e.target.checked)} style={{ fontSize: 12 }}>
              {t('workbench.importExport.report.anonymize')}
            </Checkbox>
          </Tooltip>
          <div style={{ flex: 1 }} />
          <Button type="primary" onClick={onClose}>
            {t('workbench.importExport.report.close')}
          </Button>
        </div>
      }
      width={840}
      centered
      maskClosable={false}
      // One scroll container: the modal stays in view and only its body
      // scrolls — never the app behind it.
      styles={{ body: { maxHeight: '65vh', overflowY: 'auto' } }}
    >
      {summary && (
        <Paragraph style={{ marginBottom: 12 }}>
          {t('workbench.importExport.report.summaryImported')} <Text strong>{summary.collections}</Text>{' '}
          {t('workbench.importExport.report.wordCollection', { count: summary.collections })},{' '}
          <Text strong>{summary.environments}</Text>{' '}
          {t('workbench.importExport.report.wordEnvironment', { count: summary.environments })},{' '}
          {t('workbench.importExport.report.and')} <Text strong>{summary.requests}</Text>{' '}
          {t('workbench.importExport.report.wordRequest', { count: summary.requests })}
          {summary.examples > 0 || summary.globals > 0 ? (
            <>
              {' '}
              {t('workbench.importExport.report.withOpen')}
              {summary.examples > 0 ? (
                <>
                  {' '}
                  <Text strong>{summary.examples}</Text>{' '}
                  {t('workbench.importExport.report.wordSavedExample', { count: summary.examples })}
                </>
              ) : null}
              {summary.examples > 0 && summary.globals > 0 ? ` ${t('workbench.importExport.report.and')}` : null}
              {summary.globals > 0 ? (
                <>
                  {' '}
                  <Text strong>{summary.globals}</Text>{' '}
                  {t('workbench.importExport.report.wordGlobalVariable', { count: summary.globals })}
                </>
              ) : null}
              )
            </>
          ) : null}{' '}
          {t('workbench.importExport.report.into')}{' '}
          <Text strong>{t('workbench.importExport.report.wordWorkspace', { count: summary.workspaces.length })}</Text>
          .
        </Paragraph>
      )}
      {loading ? (
        <Skeleton active paragraph={{ rows: 2 }} />
      ) : (
        <Collapse
          items={items}
          bordered={false}
          size="small"
          // A single-workspace run opens expanded — the caret dance is
          // only worth it when many workspaces compete for space.
          defaultActiveKey={entries.length === 1 ? [entries[0].workspace.workspaceId] : []}
        />
      )}
    </Modal>
  );
};

export default MigrationReportModal;
