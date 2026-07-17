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
import { getDateTimeFormat } from '@openheaders/i18n';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
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
  const { t, locale } = useLocale();
  const emptyText = scanned
    ? t('workbench.importExport.detection.emptyScanned')
    : t('workbench.importExport.detection.emptyNotScanned');

  const rows: DetailRow[] = findings.map((finding) => ({
    key: finding.store === 'postman-backup' ? finding.path : finding.dir,
    finding,
  }));

  const columns = [
    {
      title: t('workbench.importExport.detection.vendorCol'),
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
      title: t('workbench.importExport.detection.dataFoundCol'),
      key: 'data',
      width: 220,
      render: (_: unknown, row: DetailRow) =>
        row.finding.store === 'postman-backup' ? (
          <Text style={{ fontSize: 12 }}>
            {t('workbench.importExport.detection.backupFrom', {
              date: getDateTimeFormat(locale).format(new Date(row.finding.mtimeMs)),
            })}
          </Text>
        ) : (
          <Text style={{ fontSize: 12 }}>{t('workbench.importExport.detection.localData')}</Text>
        ),
    },
    {
      title: t('workbench.importExport.detection.contentsCol'),
      key: 'contents',
      render: (_: unknown, row: DetailRow) => {
        const { finding } = row;
        const contents =
          finding.store === 'postman-backup'
            ? t('workbench.importExport.detection.backupContents', {
                collections: finding.counts.collections,
                environments: finding.counts.environments,
                headerPresets: finding.counts.headerPresets,
                globals: finding.counts.globals,
              })
            : t('workbench.importExport.detection.localContents', {
                collections: finding.counts.collections,
                environments: finding.counts.environments,
                requests: finding.counts.requests,
              });
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
              {t('workbench.importExport.detection.importCta')}
            </Button>
          );
        }
        const { dir } = finding;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <Button size="small" loading={readingPath === dir} onClick={() => onImportInsomniaData(dir)}>
              {t('workbench.importExport.detection.importCta')}
            </Button>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('workbench.importExport.detection.exportFallbackPrefix')}{' '}
              <Button
                type="link"
                size="small"
                style={{ padding: 0, fontSize: 12, height: 'auto' }}
                onClick={onOpenImportHub}
              >
                {t('workbench.importExport.migrate.importHub')}
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
          {t('workbench.importExport.detection.skippedLead', { count: skipped.length })} {skipped[0].reason}
        </Text>
      )}
    </>
  );
};

export default DetectionDetailsTable;
