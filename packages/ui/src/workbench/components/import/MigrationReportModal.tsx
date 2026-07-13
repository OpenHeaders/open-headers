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

import { CheckCircleFilled } from '@ant-design/icons';
import { hostBridge } from '@openheaders/core/bridge';
import type { ImportReport, PostmanImportedWorkspace, PostmanImportSummary } from '@openheaders/core/import';
import { Button, Modal, Skeleton, Typography, theme } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
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

const WorkspaceReportSection: React.FC<{
  entry: WorkspaceReportEntry;
  onOpenWorkspace?: (workspaceId: string) => void;
}> = ({ entry, onOpenWorkspace }) => {
  const { token } = theme.useToken();
  const { workspace, report } = entry;
  const clean = report !== null && report.drops.length === 0 && report.transforms.length === 0;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Text strong style={{ flex: 1, minWidth: 0 }}>
          {workspace.workspaceName}
        </Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {workspace.collections} collections · {workspace.environments} environments · {workspace.requests} requests
        </Text>
        {onOpenWorkspace && (
          <Button size="small" onClick={() => onOpenWorkspace(workspace.workspaceId)}>
            Open workspace
          </Button>
        )}
      </div>
      {report === null ? (
        <Text type="secondary" style={{ fontSize: 12 }}>
          No import report found for this workspace.
        </Text>
      ) : clean ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <CheckCircleFilled style={{ color: token.colorSuccess }} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Everything imported cleanly — no drops or transforms.
          </Text>
        </span>
      ) : (
        <ImportReportPanel report={report} token={token} />
      )}
    </div>
  );
};

const MigrationReportModal: React.FC<{
  open: boolean;
  summary: PostmanImportSummary | null;
  onClose: () => void;
  /** Explicit jump into an imported workspace — the user's choice. */
  onOpenWorkspace?: (workspaceId: string) => void;
}> = ({ open, summary, onClose, onOpenWorkspace }) => {
  const [entries, setEntries] = useState<WorkspaceReportEntry[]>([]);
  const [loading, setLoading] = useState(false);

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

  return (
    <Modal
      title="Postman import report"
      open={open}
      onCancel={onClose}
      onOk={onClose}
      cancelButtonProps={{ style: { display: 'none' } }}
      okText="Close"
      width={640}
    >
      {summary && (
        <Paragraph style={{ marginBottom: 12 }}>
          Imported <Text strong>{summary.collections}</Text> collection{summary.collections === 1 ? '' : 's'},{' '}
          <Text strong>{summary.environments}</Text> environment{summary.environments === 1 ? '' : 's'}, and{' '}
          <Text strong>{summary.requests}</Text> request{summary.requests === 1 ? '' : 's'} into{' '}
          <Text strong>
            {summary.workspaces.length} workspace{summary.workspaces.length === 1 ? '' : 's'}
          </Text>
          .
        </Paragraph>
      )}
      {loading ? (
        <Skeleton active paragraph={{ rows: 2 }} />
      ) : (
        entries.map((entry) => (
          <WorkspaceReportSection key={entry.workspace.workspaceId} entry={entry} onOpenWorkspace={onOpenWorkspace} />
        ))
      )}
    </Modal>
  );
};

export default MigrationReportModal;
