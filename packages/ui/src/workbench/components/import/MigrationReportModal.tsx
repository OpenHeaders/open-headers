/**
 * MigrationReportModal — the "view report" click-through for a
 * finished background migration pull (MIGRATION_STATUS.md S5 addendum:
 * ONE aggregated end-of-run report, never per-collection toasts).
 *
 * Reads the newest `postman-pull` report from the ACTIVE workspace's
 * ring — the caller switches to the landing workspace before opening —
 * and renders the run's counts plus the standard drops/transforms
 * readout (`ImportReportPanel`).
 */

import { CheckCircleFilled } from '@ant-design/icons';
import type { ImportReport, PostmanImportSummary } from '@openheaders/core/import';
import { hostBridge } from '@openheaders/core/bridge';
import { Modal, Skeleton, Typography, theme } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
import ImportReportPanel from './ImportReportPanel';

const { Text, Paragraph } = Typography;

const MigrationReportModal: React.FC<{
  open: boolean;
  summary: PostmanImportSummary | null;
  onClose: () => void;
}> = ({ open, summary, onClose }) => {
  const { token } = theme.useToken();
  const [report, setReport] = useState<ImportReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setReport(null);
    void hostBridge
      .call('listImportReports')
      .then(({ reports }) => {
        if (cancelled) return;
        // Ring is oldest-first — the newest pull report is the run's.
        const match = [...reports].reverse().find((r) => r.source === 'postman-pull') ?? null;
        setReport(match);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const clean = report !== null && report.drops.length === 0 && report.transforms.length === 0;

  return (
    <Modal
      title="Postman import report"
      open={open}
      onCancel={onClose}
      onOk={onClose}
      cancelButtonProps={{ style: { display: 'none' } }}
      okText="Close"
      width={560}
    >
      {summary && (
        <Paragraph style={{ marginBottom: 12 }}>
          Imported <Text strong>{summary.collections}</Text> collection{summary.collections === 1 ? '' : 's'},{' '}
          <Text strong>{summary.environments}</Text> environment{summary.environments === 1 ? '' : 's'}, and{' '}
          <Text strong>{summary.requests}</Text> request{summary.requests === 1 ? '' : 's'} into{' '}
          <Text strong>“{summary.workspaceName}”</Text>.
        </Paragraph>
      )}
      {loading ? (
        <Skeleton active paragraph={{ rows: 2 }} />
      ) : report === null ? (
        <Text type="secondary">No import report found in this workspace.</Text>
      ) : clean ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <CheckCircleFilled style={{ color: token.colorSuccess }} />
          <Text type="secondary">Everything imported cleanly — no drops or transforms.</Text>
        </span>
      ) : (
        <ImportReportPanel report={report} token={token} />
      )}
      {report && (
        <div style={{ marginTop: 12, fontSize: 12, color: token.colorTextTertiary }}>
          Imported {new Date(report.importedAt).toLocaleString()}
        </div>
      )}
    </Modal>
  );
};

export default MigrationReportModal;
