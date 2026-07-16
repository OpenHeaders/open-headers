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
import { App, Button, Collapse, Modal, Skeleton, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import ImportReportPanel from './ImportReportPanel';

const { Text, Paragraph } = Typography;

interface WorkspaceReportEntry {
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
 */
function serializeReport(summary: PostmanImportSummary, entries: WorkspaceReportEntry[]): string {
  return JSON.stringify(
    {
      source: 'postman-pull',
      generatedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      summary,
      workspaces: entries.map(({ workspace, report }) => ({ ...workspace, report })),
    },
    null,
    2,
  );
}

const WorkspaceReportBody: React.FC<{ entry: WorkspaceReportEntry }> = ({ entry }) => {
  const { token } = theme.useToken();
  const { report } = entry;
  if (report === null) {
    return (
      <Text type="secondary" style={{ fontSize: 12 }}>
        No import report found for this workspace.
      </Text>
    );
  }
  if (report.drops.length === 0 && report.transforms.length === 0) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <CheckCircleFilled style={{ color: token.colorSuccess }} />
        <Text type="secondary" style={{ fontSize: 12 }}>
          Everything imported cleanly — no drops or transforms.
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
  const [entries, setEntries] = useState<WorkspaceReportEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const copyReport = useCallback(() => {
    if (!summary) return;
    navigator.clipboard
      .writeText(serializeReport(summary, entries))
      .then(() => message.success('Report copied as JSON'))
      .catch(() => message.error('The report could not be copied.'));
  }, [summary, entries, message]);

  const downloadReport = useCallback(() => {
    if (!summary) return;
    const blob = new Blob([serializeReport(summary, entries)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `openheaders-postman-import-report-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [summary, entries]);

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
            {workspace.collections} collections · {workspace.environments} environments · {workspace.requests}{' '}
            requests{workspace.examples > 0 ? ` · ${workspace.examples} saved examples` : ''}
            {workspace.globals > 0 ? ` · ${workspace.globals} global variables` : ''}
            {notes > 0 ? ` · ${notes} note${notes === 1 ? '' : 's'}` : ''}
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
          Open workspace
        </Button>
      ),
      children: <WorkspaceReportBody entry={entry} />,
    };
  });

  return (
    <Modal
      title="Postman import report"
      open={open}
      onCancel={onClose}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button icon={<CopyOutlined />} onClick={copyReport} disabled={loading || !summary}>
            Copy report
          </Button>
          <Button icon={<DownloadOutlined />} onClick={downloadReport} disabled={loading || !summary}>
            Download
          </Button>
          <div style={{ flex: 1 }} />
          <Button type="primary" onClick={onClose}>
            Close
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
          Imported <Text strong>{summary.collections}</Text> collection{summary.collections === 1 ? '' : 's'},{' '}
          <Text strong>{summary.environments}</Text> environment{summary.environments === 1 ? '' : 's'}, and{' '}
          <Text strong>{summary.requests}</Text> request{summary.requests === 1 ? '' : 's'}
          {summary.examples > 0 || summary.globals > 0 ? (
            <>
              {' '}
              (with
              {summary.examples > 0 ? (
                <>
                  {' '}
                  <Text strong>{summary.examples}</Text> saved example{summary.examples === 1 ? '' : 's'}
                </>
              ) : null}
              {summary.examples > 0 && summary.globals > 0 ? ' and' : null}
              {summary.globals > 0 ? (
                <>
                  {' '}
                  <Text strong>{summary.globals}</Text> global variable{summary.globals === 1 ? '' : 's'}
                </>
              ) : null}
              )
            </>
          ) : null}{' '}
          into{' '}
          <Text strong>
            {summary.workspaces.length} workspace{summary.workspaces.length === 1 ? '' : 's'}
          </Text>
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
