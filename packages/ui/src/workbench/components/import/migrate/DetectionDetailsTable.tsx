/**
 * DetectionDetailsTable — the compact table below the vendor list
 * (S14 UI law: vendor rows carry status only; backup dates, counts,
 * guided-export walkthroughs, and skipped stores all land here).
 *
 * Actions stay per-row consent clicks: a Postman backup imports through
 * the host-validated `readBackup` → sectioned flow; Insomnia's local
 * data imports through the host-validated `readInsomniaData` envelope,
 * with the guided export→drop hand-off staying as the fallback line.
 */

import { type DataScanSkip, MIGRATION_TOOL_NAMES, type ToolDataFinding } from '@openheaders/core/import';
import { Button, Table, Typography } from 'antd';
import type React from 'react';
import { VENDOR_GLYPHS } from './vendor-icons';

const { Text } = Typography;

interface DetectionDetailsTableProps {
  /** False until a scan has run — the table renders with an invitation
   *  empty state so the surface keeps its post-scan shape from the start. */
  scanned: boolean;
  findings: ToolDataFinding[];
  skipped: DataScanSkip[];
  /** The backup path or data dir currently being read, for the row's loading state. */
  readingPath: string | null;
  onImportBackup: (path: string) => void;
  onImportInsomniaData: (dir: string) => void;
  onOpenImportHub: () => void;
}

interface DetailRow {
  key: string;
  finding: ToolDataFinding;
}

const DetectionDetailsTable: React.FC<DetectionDetailsTableProps> = ({
  scanned,
  findings,
  skipped,
  readingPath,
  onImportBackup,
  onImportInsomniaData,
  onOpenImportHub,
}) => {
  const emptyText = scanned
    ? 'No importable data stores were found on this computer.'
    : 'Nothing scanned yet — “Scan this computer” lists importable data here.';

  const rows: DetailRow[] = findings.map((finding) => ({
    key: finding.store === 'postman-backup' ? finding.path : finding.dir,
    finding,
  }));

  const columns = [
    {
      title: 'Vendor',
      key: 'vendor',
      width: 160,
      render: (_: unknown, row: DetailRow) => {
        const Glyph = VENDOR_GLYPHS[row.finding.tool];
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Glyph style={{ fontSize: 16 }} />
            <Text>{MIGRATION_TOOL_NAMES[row.finding.tool]}</Text>
          </span>
        );
      },
    },
    {
      title: 'Data found',
      key: 'data',
      width: 220,
      render: (_: unknown, row: DetailRow) =>
        row.finding.store === 'postman-backup' ? (
          <Text style={{ fontSize: 12 }}>Backup from {new Date(row.finding.mtimeMs).toLocaleDateString()}</Text>
        ) : (
          <Text style={{ fontSize: 12 }}>Local data</Text>
        ),
    },
    {
      title: 'Contents',
      key: 'contents',
      render: (_: unknown, row: DetailRow) => {
        const { finding } = row;
        const contents =
          finding.store === 'postman-backup'
            ? `${finding.counts.collections} collections · ${finding.counts.environments} environments · ${finding.counts.headerPresets} header presets · ${finding.counts.globals} globals`
            : `${finding.counts.collections} collections · ${finding.counts.environments} environments · ${finding.counts.requests} requests`;
        return (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {contents}
          </Text>
        );
      },
    },
    {
      title: '',
      key: 'action',
      width: 220,
      align: 'right' as const,
      render: (_: unknown, row: DetailRow) => {
        const { finding } = row;
        if (finding.store === 'postman-backup') {
          const { path } = finding;
          return (
            <Button size="small" loading={readingPath === path} onClick={() => onImportBackup(path)}>
              Import…
            </Button>
          );
        }
        const { dir } = finding;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <Button size="small" loading={readingPath === dir} onClick={() => onImportInsomniaData(dir)}>
              Import…
            </Button>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Or export it (Preferences → Data → Export), then drop the file in the{' '}
              <Button
                type="link"
                size="small"
                style={{ padding: 0, fontSize: 12, height: 'auto' }}
                onClick={onOpenImportHub}
              >
                import hub
              </Button>
            </Text>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <Table<DetailRow>
        columns={columns}
        dataSource={rows}
        size="small"
        pagination={false}
        rowKey="key"
        locale={{
          emptyText: (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {emptyText}
            </Text>
          ),
        }}
      />
      {skipped.length > 0 && (
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
          {skipped.length} store file{skipped.length === 1 ? ' was' : 's were'} skipped — {skipped[0].reason}
        </Text>
      )}
    </>
  );
};

export default DetectionDetailsTable;
